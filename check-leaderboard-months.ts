import { db } from './server/db';
import { monthlyLeaderboards } from './shared/schema';
import { sql } from 'drizzle-orm';

async function checkLeaderboardMonths() {
  try {
    console.log('Checking months in monthlyLeaderboards table...');
    
    // Get all unique months in the database
    const months = await db.execute(sql`
      SELECT DISTINCT "monthYear" 
      FROM "monthlyLeaderboards" 
      ORDER BY "monthYear" DESC
    `);
    
    console.log('Available months in database:', months.rows);
    
    // Get count of entries per month
    const monthCounts = await db.execute(sql`
      SELECT "monthYear", COUNT(*) as count
      FROM "monthlyLeaderboards" 
      GROUP BY "monthYear"
      ORDER BY "monthYear" DESC
    `);
    
    console.log('Entry counts per month:', monthCounts.rows);
    
    // Get sample data for each month
    for (const month of months.rows) {
      const monthYear = month.monthYear;
      console.log(`\nSample data for ${monthYear}:`);
      
      const sampleData = await db.query.monthlyLeaderboards.findMany({
        where: sql`"monthYear" = ${monthYear}`,
        limit: 3,
        orderBy: sql`"rank" ASC`
      });
      
      console.log(sampleData.map(entry => ({
        rank: entry.rank,
        username: entry.username,
        totalScore: entry.totalScore,
        monthYear: entry.monthYear
      })));
    }
    
  } catch (error) {
    console.error('Error checking leaderboard months:', error);
  } finally {
    process.exit(0);
  }
}

checkLeaderboardMonths();
