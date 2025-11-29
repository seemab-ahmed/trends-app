import { db } from '../server/db.js';
import { monthlyLeaderboards } from '../shared/schema.js';
import { eq } from 'drizzle-orm';

async function checkArchivedSeptember() {
  try {
    console.log('=== CHECKING ARCHIVED SEPTEMBER 2025 ===\n');
    
    const septemberData = await db
      .select()
      .from(monthlyLeaderboards)
      .where(eq(monthlyLeaderboards.monthYear, '2025-09'));
    
    console.log(`Found ${septemberData.length} entries in monthly_leaderboards for 2025-09\n`);
    
    if (septemberData.length > 0) {
      console.log('Archived entries:');
      septemberData.forEach((entry, index) => {
        console.log(`${index + 1}. ${entry.username} - Rank: ${entry.rank}, Score: ${entry.totalScore}, Predictions: ${entry.totalPredictions}`);
      });
    } else {
      console.log('⚠️  September 2025 has NOT been archived yet!');
      console.log('You need to run the leaderboard archiver to save September data.');
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    process.exit(0);
  }
}

checkArchivedSeptember();

