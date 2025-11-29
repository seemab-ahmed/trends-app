#!/usr/bin/env tsx

/**
 * Create Test Notification for Current User
 * Creates a test notification for the user "Agha Shah Hyder"
 */

import { db } from './server/db';
import { notifications, users } from './shared/schema';
import { eq } from 'drizzle-orm';

async function createTestNotificationForCurrentUser() {
  try {
    console.log('🔔 Creating test notification for current user...');

    // Get the user "Agha Shah Hyder" (the one who's logged in)
    const currentUser = await db.query.users.findFirst({
      where: eq(users.email, 'aghashahhyder@gmail.com'),
    });

    if (!currentUser) {
      console.error('❌ User "Agha Shah Hyder" not found in database.');
      return;
    }

    console.log(`📧 Creating notification for user: ${currentUser.username} (${currentUser.email})`);
    console.log(`   User ID: ${currentUser.id}`);

    // Create a test notification
    const [notification] = await db.insert(notifications).values({
      userId: currentUser.id,
      type: 'new_prediction',
      title: 'Test Notification for You',
      message: 'This is a test notification created specifically for your account to verify the notification system is working!',
      isRead: false,
      metadata: {
        test: true,
        createdBy: 'test-script-for-current-user',
        timestamp: new Date().toISOString(),
      },
    }).returning();

    console.log('✅ Test notification created successfully!');
    console.log(`   Notification ID: ${notification.id}`);
    console.log(`   User: ${currentUser.username}`);
    console.log(`   Type: ${notification.type}`);
    console.log(`   Title: ${notification.title}`);
    console.log(`   Message: ${notification.message}`);
    console.log(`   Is Read: ${notification.isRead}`);

    console.log('\n🎯 Next steps:');
    console.log('1. Refresh your browser (hard reload with Cmd+Shift+R)');
    console.log('2. Look for the notification bell with a badge');
    console.log('3. Click the bell to see the notification');
    console.log('4. Check browser console for API call logs');

  } catch (error) {
    console.error('❌ Error creating test notification:', error);
  }
}

// Run the test
createTestNotificationForCurrentUser().then(() => {
  console.log('\n✨ Test notification script completed!');
  process.exit(0);
}).catch((error) => {
  console.error('❌ Script failed:', error);
  process.exit(1);
});

