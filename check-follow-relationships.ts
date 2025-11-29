import { db } from './server/db';
import { userFollows, users } from './shared/schema';
import { eq } from 'drizzle-orm';

async function checkFollowRelationships() {
  try {
    console.log('Checking follow relationships...');
    
    // Get all follow relationships
    const follows = await db.query.userFollows.findMany();
    
    console.log('All follow relationships:', follows);
    
    // Get user xaps
    const xapsUser = await db.query.users.findFirst({
      where: eq(users.username, 'xaps')
    });
    
    if (xapsUser) {
      console.log('xaps user ID:', xapsUser.id);
      
      // Get followers of xaps
      const xapsFollowers = await db.query.userFollows.findMany({
        where: eq(userFollows.followingId, xapsUser.id)
      });
      
      console.log('Followers of xaps:', xapsFollowers);
    }
    
  } catch (error) {
    console.error('Error checking follow relationships:', error);
  } finally {
    process.exit(0);
  }
}

checkFollowRelationships();
