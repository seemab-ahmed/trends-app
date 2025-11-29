#!/usr/bin/env tsx

/**
 * Debug Notification System
 * Check what's in the database and verify the notification system
 */

import { db } from './server/db';
import { notifications, users } from './shared/schema';
import { eq, desc } from 'drizzle-orm';

async function debugNotifications() {
  try {
    console.log('🔍 Debugging notification system...\n');

    // Get all users
    const allUsers = await db.query.users.findMany({
      orderBy: (users, { asc }) => [asc(users.createdAt)],
    });

    console.log('👥 Users in database:');
    allUsers.forEach(user => {
      console.log(`  - ${user.username} (${user.email}) - ID: ${user.id}`);
    });

    console.log('\n📬 All notifications in database:');
    const allNotifications = await db.query.notifications.findMany({
      orderBy: [desc(notifications.createdAt)],
    });

    if (allNotifications.length === 0) {
      console.log('  ❌ No notifications found in database!');
    } else {
      allNotifications.forEach(notification => {
        console.log(`  - ID: ${notification.id}`);
        console.log(`    User ID: ${notification.userId}`);
        console.log(`    Type: ${notification.type}`);
        console.log(`    Title: ${notification.title}`);
        console.log(`    Message: ${notification.message}`);
        console.log(`    Is Read: ${notification.isRead}`);
        console.log(`    Created: ${notification.createdAt}`);
        console.log('');
      });
    }

    // Check notifications for the first user specifically
    if (allUsers.length > 0) {
      const firstUser = allUsers[0];
      console.log(`\n🔔 Notifications for user "${firstUser.username}" (${firstUser.id}):`);
      
      const userNotifications = await db.query.notifications.findMany({
        where: eq(notifications.userId, firstUser.id),
        orderBy: [desc(notifications.createdAt)],
      });

      if (userNotifications.length === 0) {
        console.log('  ❌ No notifications found for this user!');
      } else {
        userNotifications.forEach(notification => {
          console.log(`  - ${notification.title} (${notification.isRead ? 'READ' : 'UNREAD'})`);
        });

        const unreadCount = userNotifications.filter(n => !n.isRead).length;
        console.log(`\n📊 Unread count for this user: ${unreadCount}`);
      }
    }

  } catch (error) {
    console.error('❌ Error debugging notifications:', error);
  }
}

// Run the debug
debugNotifications().then(() => {
  console.log('\n✨ Debug completed!');
  process.exit(0);
}).catch((error) => {
  console.error('❌ Debug failed:', error);
  process.exit(1);
});

