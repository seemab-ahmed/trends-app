import { db } from './server/db';
import { sql } from 'drizzle-orm';

async function checkTables() {
  try {
    console.log('Checking available tables...');
    
    // Get all tables in the database
    const tables = await db.execute(sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);
    
    console.log('Available tables:', tables.rows.map(row => row.table_name));
    
    // Check if there are any leaderboard-related tables
    const leaderboardTables = tables.rows.filter(row => 
      row.table_name.toLowerCase().includes('leaderboard') || 
      row.table_name.toLowerCase().includes('monthly')
    );
    
    console.log('Leaderboard-related tables:', leaderboardTables);
    
  } catch (error) {
    console.error('Error checking tables:', error);
  } finally {
    process.exit(0);
  }
}

checkTables();
