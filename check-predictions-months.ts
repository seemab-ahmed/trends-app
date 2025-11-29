import { db } from './server/db';
import { predictions } from './shared/schema';
import { sql } from 'drizzle-orm';

async function checkPredictionsMonths() {
  try {
    console.log('Checking predictions by month...');
    
    // Get predictions grouped by month
    const monthData = await db.execute(sql`
      SELECT 
        DATE_TRUNC('month', "slot_start") as month,
        COUNT(*) as count,
        COUNT(DISTINCT "user_id") as unique_users
      FROM "predictions" 
      WHERE "status" IN ('active', 'evaluated')
      GROUP BY DATE_TRUNC('month', "slot_start")
      ORDER BY month DESC
    `);
    
    console.log('Predictions by month:', monthData.rows);
    
    // Get sample predictions for each month
    for (const monthRow of monthData.rows) {
      const month = monthRow.month;
      console.log(`\nSample predictions for ${month}:`);
      
      const samplePredictions = await db.execute(sql`
        SELECT 
          "user_id",
          "slot_start",
          "points_awarded",
          "result",
          "status"
        FROM "predictions" 
        WHERE DATE_TRUNC('month', "slot_start") = ${month}
        AND "status" IN ('active', 'evaluated')
        ORDER BY "slot_start" DESC
        LIMIT 3
      `);
      
      console.log(samplePredictions.rows);
    }
    
  } catch (error) {
    console.error('Error checking predictions months:', error);
  } finally {
    process.exit(0);
  }
}

checkPredictionsMonths();
