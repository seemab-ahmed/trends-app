import { getMonthlyLeaderboard } from './server/leaderboard-service';

async function testLeaderboardFunction() {
  try {
    console.log('Testing getMonthlyLeaderboard function...');
    const result = await getMonthlyLeaderboard('2025-09');
    console.log('Result:', result);
    console.log('Success!');
  } catch (error) {
    console.error('Error:', error);
  } finally {
    process.exit(0);
  }
}

testLeaderboardFunction();
