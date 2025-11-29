const { Pool } = require('pg');

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:erXKZIzQTMZHWCHbbgLHnAzYDljXdrIe@hopper.proxy.rlwy.net:26012/railway',
  ssl: { rejectUnauthorized: false }
});

async function updateUsernameToWala() {
  try {
    console.log('Updating username from "Agha" to "wala" for email xappifai@gmail.com...');
    
    // Update username from "Agha" to "wala" for the specific user
    const result = await pool.query(
      'UPDATE users SET username = $1 WHERE email = $2',
      ['wala', 'xappifai@gmail.com']
    );
    
    console.log('Update result:', result);
    console.log('Rows affected:', result.rowCount);
    
    if (result.rowCount > 0) {
      console.log('✅ Username updated successfully from "Agha" to "wala"');
    } else {
      console.log('❌ No user found with email "xappifai@gmail.com"');
    }
    
    // Verify the update
    const verifyResult = await pool.query(
      'SELECT id, username, email, "createdAt" FROM users WHERE email = $1',
      ['xappifai@gmail.com']
    );
    
    console.log('Current user data:', verifyResult.rows[0]);
    
  } catch (error) {
    console.error('Error updating username:', error);
  } finally {
    await pool.end();
  }
}

updateUsernameToWala();
