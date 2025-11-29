#!/usr/bin/env tsx

/**
 * Test Notification Creator
 * Creates a test notification to verify the notification system works
 */

import { db } from './server/db';
import { notifications, users } from './shared/schema';
import { eq } from 'drizzle-orm';

async function createTestNotification() {
  try {
    console.log('🔔 Creating test notification...');

    // Get the first user from the database
    const firstUser = await db.query.users.findFirst({
      orderBy: (users, { asc }) => [asc(users.createdAt)],
    });

    if (!firstUser) {
      console.error('❌ No users found in database. Please create a user first.');
      return;
    }

    console.log(`📧 Creating notification for user: ${firstUser.username} (${firstUser.email})`);

    // Create a test notification
    const [notification] = await db.insert(notifications).values({
      userId: firstUser.id,
      type: 'new_prediction',
      title: 'Test Notification',
      message: 'This is a test notification to verify the notification system is working correctly!',
      isRead: false,
      metadata: {
        test: true,
        createdBy: 'test-script',
      },
    }).returning();

    console.log('✅ Test notification created successfully!');
    console.log(`   Notification ID: ${notification.id}`);
    console.log(`   User: ${firstUser.username}`);
    console.log(`   Type: ${notification.type}`);
    console.log(`   Title: ${notification.title}`);
    console.log(`   Message: ${notification.message}`);
    console.log(`   Is Read: ${notification.isRead}`);

    console.log('\n🎯 Next steps:');
    console.log('1. Refresh your browser');
    console.log('2. Look for the notification bell with a badge');
    console.log('3. Click the bell to see the notification');
    console.log('4. Click the notification to mark it as read');

  } catch (error) {
    console.error('❌ Error creating test notification:', error);
  }
}

// Run the test
createTestNotification().then(() => {
  console.log('\n✨ Test notification script completed!');
  process.exit(0);
}).catch((error) => {
  console.error('❌ Script failed:', error);
  process.exit(1);
});

