import { db } from '../server/db.js';
import { predictions, userProfiles } from '../shared/schema.js';
import { eq, isNotNull } from 'drizzle-orm';
import { DateTime } from 'luxon';
import { getPointsForPrediction, getPenaltyForPrediction, type DurationKey } from '../server/lib/slots.js';

/**
 * Recalculate scores for all evaluated predictions based on new scoring rules
 */
async function recalculateScores() {
  console.log('🔄 Starting score recalculation...\n');

  try {
    // Get all evaluated predictions
    const allPredictions = await db
      .select()
      .from(predictions)
      .where(isNotNull(predictions.evaluatedAt));

    console.log(`📊 Found ${allPredictions.length} evaluated predictions\n`);

    if (allPredictions.length === 0) {
      console.log('✅ No predictions to recalculate');
      return;
    }

    // Track score changes per user
    const userScoreChanges = new Map<string, { oldTotal: number; newTotal: number; count: number }>();

    let updatedCount = 0;
    let unchangedCount = 0;

    // Process each prediction
    for (const prediction of allPredictions) {
      const { 
        id, 
        userId, 
        result, 
        duration, 
        timestampCreated, 
        pointsAwarded: oldPoints 
      } = prediction;

      // Calculate new points based on new scoring rules
      let newPoints: number;
      
      if (result === 'correct') {
        // Time-based scoring for correct predictions
        const predictionTime = DateTime.fromJSDate(timestampCreated);
        newPoints = getPointsForPrediction(duration as DurationKey, predictionTime);
      } else if (result === 'incorrect') {
        // Fixed penalty for incorrect predictions
        newPoints = getPenaltyForPrediction(duration as DurationKey);
      } else {
        // Pending results shouldn't have points
        newPoints = 0;
      }

      // Check if points changed
      if (oldPoints !== newPoints) {
        // Update prediction with new points
        await db
          .update(predictions)
          .set({ pointsAwarded: newPoints })
          .where(eq(predictions.id, id));

        // Track user score changes
        if (!userScoreChanges.has(userId)) {
          userScoreChanges.set(userId, { oldTotal: 0, newTotal: 0, count: 0 });
        }
        const userChange = userScoreChanges.get(userId)!;
        userChange.oldTotal += oldPoints || 0;
        userChange.newTotal += newPoints;
        userChange.count++;

        updatedCount++;
        console.log(
          `✏️  Prediction ${id.substring(0, 8)}... | ` +
          `${duration.padEnd(6)} | ${result.padEnd(9)} | ` +
          `Old: ${String(oldPoints || 0).padStart(4)} → New: ${String(newPoints).padStart(4)}`
        );
      } else {
        unchangedCount++;
      }
    }

    console.log(`\n📈 Updated ${updatedCount} predictions`);
    console.log(`⏭️  Unchanged ${unchangedCount} predictions\n`);

    // Update user profiles with corrected total scores
    console.log('👥 Updating user profiles...\n');

    for (const [userId, changes] of userScoreChanges.entries()) {
      // Get current user profile
      const userProfile = await db.query.userProfiles.findFirst({
        where: eq(userProfiles.userId, userId),
      });

      if (userProfile) {
        // Calculate the score adjustment
        const scoreDiff = changes.newTotal - changes.oldTotal;
        const newMonthlyScore = (userProfile.monthlyScore || 0) + scoreDiff;
        const newTotalScore = (userProfile.totalScore || 0) + scoreDiff;

        // Update user profile
        await db
          .update(userProfiles)
          .set({
            monthlyScore: newMonthlyScore,
            totalScore: newTotalScore,
            updatedAt: new Date(),
          })
          .where(eq(userProfiles.userId, userId));

        console.log(
          `✅ User ${userProfile.username}: ` +
          `${changes.count} predictions updated | ` +
          `Score adjustment: ${scoreDiff > 0 ? '+' : ''}${scoreDiff} | ` +
          `New total: ${newTotalScore}`
        );
      }
    }

    console.log(`\n✨ Score recalculation complete!`);
    console.log(`   ${updatedCount} predictions updated`);
    console.log(`   ${userScoreChanges.size} user profiles updated\n`);

  } catch (error) {
    console.error('❌ Error recalculating scores:', error);
    throw error;
  }
}

// Run the script
recalculateScores()
  .then(() => {
    console.log('✅ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });

