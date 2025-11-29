const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function migrateDurationEnum() {
  const client = await pool.connect();
  
  try {
    console.log('Starting duration enum migration...');
    
    // First, update existing predictions to use new enum values
    console.log('Updating existing predictions...');
    
    // Map old durations to new ones
    const durationMapping = {
      '1h': 'short',
      '3h': 'short', 
      '6h': 'short',
      '24h': 'short',
      '48h': 'short',
      '1w': 'short',
      '1m': 'medium',
      '3m': 'long',
      '6m': 'long',
      '1y': 'long'
    };
    
    // Update predictions table
    for (const [oldDuration, newDuration] of Object.entries(durationMapping)) {
      const result = await client.query(
        'UPDATE predictions SET duration = $1 WHERE duration = $2',
        [newDuration, oldDuration]
      );
      console.log(`Updated ${result.rowCount} predictions from ${oldDuration} to ${newDuration}`);
    }
    
    // Drop the old enum and create new one
    console.log('Recreating duration enum...');
    
    // First, drop the constraint
    await client.query('ALTER TABLE predictions DROP CONSTRAINT IF EXISTS predictions_duration_duration_check');
    
    // Create new enum type
    await client.query('CREATE TYPE duration_new AS ENUM (\'short\', \'medium\', \'long\')');
    
    // Update the column to use new enum
    await client.query('ALTER TABLE predictions ALTER COLUMN duration TYPE duration_new USING duration::text::duration_new');
    
    // Drop old enum and rename new one
    await client.query('DROP TYPE IF EXISTS duration');
    await client.query('ALTER TYPE duration_new RENAME TO duration');
    
    console.log('Duration enum migration completed successfully!');
    
  } catch (error) {
    console.error('Migration failed:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

migrateDurationEnum().catch(console.error);
