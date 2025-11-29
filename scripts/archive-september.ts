import { db } from '../server/db.js';
import { predictions, users, monthlyLeaderboards } from '../shared/schema.js';
import { and, gte, lte, inArray, eq } from 'drizzle-orm';
import { DateTime } from 'luxon';

async function archiveSeptember() {
  try {
    const monthYear = '2025-09';
    console.log(`📦 Archiving leaderboard for ${monthYear}...\n`);
    
    // September 2025 boundaries in UTC (to match database timestamps)
    const [year, month] = monthYear.split('-').map(Number);
    const monthStart = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
    const monthEnd = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));
    
    console.log('Month boundaries:');
    console.log('  Start:', monthStart.toISOString());
    console.log('  End:', monthEnd.toISOString());
    console.log('');
    
    // Get all evaluated predictions for September
    const monthlyPredictions = await db
      .select({
        userId: predictions.userId,
        pointsAwarded: predictions.pointsAwarded,
        result: predictions.result,
        evaluatedAt: predictions.evaluatedAt,
        timestampCreated: predictions.timestampCreated,
      })
      .from(predictions)
      .where(
        and(
          inArray(predictions.status, ['active', 'evaluated']),
          gte(predictions.timestampCreated, monthStart),
          lte(predictions.timestampCreated, monthEnd)
        )
      );
    
    console.log(`Found ${monthlyPredictions.length} predictions for ${monthYear}\n`);
    
    // Aggregate scores by user
    const userScores = new Map<string, {
      totalScore: number;
      totalPredictions: number;
      correctPredictions: number;
      earliestTimestamp: Date | null;
    }>();
    
    for (const prediction of monthlyPredictions) {
      const existing = userScores.get(prediction.userId);
      if (existing) {
        existing.totalScore += prediction.pointsAwarded || 0;
        existing.totalPredictions += 1;
        if (prediction.result === 'correct') {
          existing.correctPredictions += 1;
        }
        // Track earliest timestamp
        if (prediction.evaluatedAt && (!existing.earliestTimestamp || prediction.evaluatedAt < existing.earliestTimestamp)) {
          existing.earliestTimestamp = prediction.evaluatedAt;
        }
      } else {
        userScores.set(prediction.userId, {
          totalScore: prediction.pointsAwarded || 0,
          totalPredictions: 1,
          correctPredictions: prediction.result === 'correct' ? 1 : 0,
          earliestTimestamp: prediction.evaluatedAt || null,
        });
      }
    }
    
    console.log(`Aggregated data for ${userScores.size} users\n`);
    
    // Get usernames
    const userIds = Array.from(userScores.keys());
    const userList = await db
      .select({ id: users.id, username: users.username })
      .from(users)
      .where(inArray(users.id, userIds));
    
    const userMap = new Map(userList.map(u => [u.id, u]));
    
    // Sort by: 1) Total Score (desc), 2) Correct Predictions (desc), 3) Timestamp (asc), 4) UserId (asc)
    const sortedUsers = Array.from(userScores.entries())
      .map(([userId, score]) => ({ 
        userId, 
        ...score,
        username: userMap.get(userId)?.username || 'Unknown'
      }))
      .sort((a, b) => {
        // 1. Sort by total score (descending)
        if (b.totalScore !== a.totalScore) {
          return b.totalScore - a.totalScore;
        }
        
        // 2. Sort by correct predictions (descending)
        if (b.correctPredictions !== a.correctPredictions) {
          return b.correctPredictions - a.correctPredictions;
        }
        
        // 3. Sort by timestamp (ascending - earlier is better)
        const aTime = a.earliestTimestamp?.getTime() || Date.now();
        const bTime = b.earliestTimestamp?.getTime() || Date.now();
        if (aTime !== bTime) {
          return aTime - bTime;
        }
        
        // 4. Sort by userId alphabetically (ascending)
        return a.userId.localeCompare(b.userId);
      });
    
    // Take top 10
    const top10 = sortedUsers.slice(0, 10);
    
    console.log('=== TOP 10 USERS ===\n');
    top10.forEach((user, index) => {
      console.log(`${index + 1}. ${user.username}`);
      console.log(`   Score: ${user.totalScore}`);
      console.log(`   Predictions: ${user.totalPredictions}`);
      console.log(`   Correct: ${user.correctPredictions}`);
      console.log(`   Earliest: ${user.earliestTimestamp?.toISOString() || 'N/A'}`);
      console.log('');
    });
    
    // Delete existing entries for this month (if any)
    await db
      .delete(monthlyLeaderboards)
      .where(eq(monthlyLeaderboards.monthYear, monthYear));
    
    // Archive top 10 to monthly_leaderboards
    const leaderboardEntries = top10.map((user, index) => {
      const rank = index + 1;
      const accuracyPercentage = user.totalPredictions > 0 
        ? (user.correctPredictions / user.totalPredictions) * 100 
        : 0;
      
      return {
        monthYear,
        userId: user.userId,
        username: user.username,
        rank,
        totalScore: user.totalScore,
        totalPredictions: user.totalPredictions,
        correctPredictions: user.correctPredictions,
        accuracyPercentage: accuracyPercentage.toFixed(2)
      };
    });
    
    if (leaderboardEntries.length > 0) {
      await db.insert(monthlyLeaderboards).values(leaderboardEntries);
      console.log(`✅ Archived ${leaderboardEntries.length} entries to monthly_leaderboards`);
    }
    
    console.log('\n✨ September 2025 leaderboard archived successfully!');
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    process.exit(0);
  }
}

archiveSeptember();

