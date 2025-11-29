import { db } from '../server/db.js';
import { predictions, users } from '../shared/schema.js';
import { and, gte, lte, inArray } from 'drizzle-orm';

async function checkSeptemberData() {
  try {
    // September 2025
    const startOfMonth = new Date(Date.UTC(2025, 8, 1, 0, 0, 0, 0)); // Month 8 = September
    const endOfMonth = new Date(Date.UTC(2025, 8, 30, 23, 59, 59, 999));
    
    console.log('=== SEPTEMBER 2025 CHECK ===\n');
    console.log('Start:', startOfMonth.toISOString());
    console.log('End:', endOfMonth.toISOString());
    console.log('');
    
    // Get predictions for September
    const preds = await db
      .select({
        userId: predictions.userId,
        status: predictions.status,
        timestampCreated: predictions.timestampCreated,
        pointsAwarded: predictions.pointsAwarded,
        result: predictions.result,
      })
      .from(predictions)
      .where(
        and(
          inArray(predictions.status, ['active', 'evaluated']),
          gte(predictions.timestampCreated, startOfMonth),
          lte(predictions.timestampCreated, endOfMonth)
        )
      );
    
    console.log(`📊 Total predictions found: ${preds.length}\n`);
    
    // Aggregate by user
    const userStats = new Map<string, {
      totalScore: number;
      totalPredictions: number;
      correctPredictions: number;
    }>();
    
    for (const pred of preds) {
      if (!userStats.has(pred.userId)) {
        userStats.set(pred.userId, {
          totalScore: 0,
          totalPredictions: 0,
          correctPredictions: 0,
        });
      }
      
      const stats = userStats.get(pred.userId)!;
      stats.totalPredictions++;
      
      if (pred.status === 'evaluated') {
        stats.totalScore += pred.pointsAwarded || 0;
        if (pred.result === 'correct') {
          stats.correctPredictions++;
        }
      }
    }
    
    console.log(`👥 Unique users: ${userStats.size}\n`);
    
    // Get user details
    const userIds = Array.from(userStats.keys());
    if (userIds.length > 0) {
      const usersData = await db
        .select({
          id: users.id,
          username: users.username,
          role: users.role,
        })
        .from(users)
        .where(inArray(users.id, userIds));
      
      const userMap = new Map(usersData.map(u => [u.id, u]));
      
      // Sort by score
      const sorted = Array.from(userStats.entries())
        .sort((a, b) => b[1].totalScore - a[1].totalScore);
      
      console.log('=== TOP USERS (by score) ===\n');
      for (const [userId, stats] of sorted) {
        const user = userMap.get(userId);
        console.log(`${user?.username || 'Unknown'} (${user?.role || 'user'})`);
        console.log(`  Score: ${stats.totalScore}`);
        console.log(`  Predictions: ${stats.totalPredictions}`);
        console.log(`  Correct: ${stats.correctPredictions}`);
        console.log('');
      }
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    process.exit(0);
  }
}

checkSeptemberData();

