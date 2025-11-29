import { db } from './server/db.ts';
import { users, userFollows } from './shared/schema.ts';
import { eq } from 'drizzle-orm';

async function checkFollowRelationships() {
  try {
    console.log('🔍 Checking follow relationships in database...');
    
    // Get all users
    const allUsers = await db.query.users.findMany();
    console.log('👥 All users:', allUsers.map(u => ({
      id: u.id,
      username: u.username,
      email: u.email
    })));
    
    // Get all follow relationships
    const allFollows = await db.query.userFollows.findMany();
    console.log('🤝 All follow relationships:', allFollows.map(f => ({
      followerId: f.followerId,
      followingId: f.followingId,
      createdAt: f.createdAt
    })));
    
    // Check specific follow relationship
    const walaUser = allUsers.find(u => u.username === 'wala');
    const aghaUser = allUsers.find(u => u.username === 'Agha Shah Hyder');
    
    if (walaUser && aghaUser) {
      console.log('🔍 Checking specific follow relationship:');
      console.log('Wala user ID:', walaUser.id);
      console.log('Agha user ID:', aghaUser.id);
      
      const followRelationship = await db.query.userFollows.findFirst({
        where: eq(userFollows.followerId, walaUser.id),
      });
      
      console.log('Follow relationship found:', followRelationship);
      
      if (followRelationship) {
        console.log('✅ Follow relationship exists');
      } else {
        console.log('❌ No follow relationship found');
      }
    } else {
      console.log('❌ Could not find one or both users');
    }
    
  } catch (error) {
    console.error('❌ Error checking follow relationships:', error);
  } finally {
    process.exit(0);
  }
}

checkFollowRelationships();
