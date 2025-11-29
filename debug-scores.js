const { drizzle } = require('drizzle-orm/postgres-js');
const postgres = require('postgres');
const { predictions, userProfiles } = require('./shared/schema.ts');

async function checkScores() {
  try {
    const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5432/trend_prediction';
    const client = postgres(connectionString);
    const db = drizzle(client);

    console.log('=== CHECKING PREDICTIONS ===');
    const preds = await db.select().from(predictions).limit(10);
    console.log('Sample predictions:');
    preds.forEach(p => {
      console.log(`  ID: ${p.id}, User: ${p.userId}, Status: ${p.status}, Points: ${p.pointsAwarded}, Result: ${p.result}, Created: ${p.timestampCreated}`);
    });

    console.log('\n=== CHECKING USER PROFILES ===');
    const profiles = await db.select().from(userProfiles).limit(10);
    console.log('Sample user profiles:');
    profiles.forEach(p => {
      console.log(`  User: ${p.userId}, MonthlyScore: ${p.monthlyScore}, TotalPredictions: ${p.totalPredictions}, Correct: ${p.correctPredictions}`);
    });

    console.log('\n=== CHECKING EVALUATED PREDICTIONS ===');
    const evaluatedPreds = await db.select().from(predictions).where(eq(predictions.status, 'evaluated')).limit(10);
    console.log('Evaluated predictions:');
    evaluatedPreds.forEach(p => {
      console.log(`  ID: ${p.id}, User: ${p.userId}, Points: ${p.pointsAwarded}, Result: ${p.result}`);
    });

    await client.end();
  } catch (error) {
    console.error('Error:', error);
  }
}

checkScores();
