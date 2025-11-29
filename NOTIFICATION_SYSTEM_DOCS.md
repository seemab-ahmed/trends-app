# Notification System Documentation

## Overview

The Trend App notification system provides real-time notifications to users when people they follow create new predictions. The system supports:

1. **In-App Notifications**: Bell icon in the header with a badge showing unread count
2. **Email Notifications**: Sent to the user's registered email address
3. **Push Notifications**: Firebase Cloud Messaging (FCM) for browser push notifications

## Features

### 1. In-App Notifications

- **Bell Icon**: Located in the app header (visible on both desktop and mobile)
- **Unread Badge**: Red badge showing the count of unread notifications (auto-refreshes every 30 seconds)
- **Notification List**: Dropdown showing recent notifications with:
  - Notification type icon (TrendingUp for predictions, Trophy for badges/leaderboard)
  - Title and message
  - Time since notification (e.g., "5 minutes ago")
  - Delete button (appears on hover)
  - Clickable links to relevant pages

### 2. Email Notifications

When a user you follow creates a prediction, you receive an email containing:
- Who made the prediction
- The asset being predicted (symbol and name)
- Direction (UP or DOWN)
- Duration (short, medium, or long)
- Link to view the user's profile

### 3. Push Notifications

Browser push notifications using Firebase Cloud Messaging:
- Works even when the app is closed (background notifications)
- Shows in the browser's notification tray
- Clicking opens the relevant page in the app

## Technical Implementation

### Database Schema

#### Notifications Table
```typescript
{
  id: uuid (primary key)
  userId: uuid (foreign key to users)
  type: enum ('new_prediction', 'badge_earned', 'leaderboard_update')
  title: string
  message: string
  isRead: boolean (default: false)
  relatedUserId: uuid (nullable, who triggered the notification)
  relatedPredictionId: uuid (nullable)
  relatedAssetId: uuid (nullable)
  metadata: jsonb (additional data)
  createdAt: timestamp
}
```

#### FCM Tokens Table
```typescript
{
  id: uuid (primary key)
  userId: uuid (foreign key to users)
  token: string (unique)
  deviceInfo: string (nullable, browser/device info)
  createdAt: timestamp
  updatedAt: timestamp
}
```

### Backend Services

#### Follow Notification Service (`server/follow-notification-service.ts`)

Main functions:
- `createNotification()`: Create a notification in the database
- `sendEmailNotification()`: Send email via Gmail SMTP
- `sendPushNotification()`: Send FCM push notification to user devices
- `notifyFollowersOfNewPrediction()`: Main function that orchestrates all notification types
- `getUserNotifications()`: Fetch user's notifications
- `getUnreadNotificationCount()`: Get count of unread notifications
- `markNotificationAsRead()`: Mark a single notification as read
- `markAllNotificationsAsRead()`: Mark all notifications as read
- `deleteNotification()`: Delete a notification
- `saveFCMToken()`: Save user's FCM token for push notifications
- `deleteFCMToken()`: Remove FCM token

#### Integration Points

**Prediction Service** (`server/prediction-service.ts`):
- When a prediction is created, `notifyFollowersOfNewPrediction()` is called automatically
- Runs asynchronously to not block prediction creation

### API Endpoints

All endpoints require authentication (`authMiddleware`):

```
GET    /api/notifications                    - Get user notifications
GET    /api/notifications/unread/count       - Get unread count
PATCH  /api/notifications/:id/read           - Mark notification as read
PATCH  /api/notifications/read-all           - Mark all as read
DELETE /api/notifications/:id                - Delete notification
POST   /api/notifications/fcm-token          - Save FCM token
DELETE /api/notifications/fcm-token          - Delete FCM token
```

### Frontend Components

#### NotificationBell (`client/src/components/notification-bell.tsx`)
- Bell icon with badge
- Auto-refreshes unread count every 30 seconds
- Opens popover with notification list
- Automatically marks all as read when opened

#### NotificationList (`client/src/components/notification-list.tsx`)
- Displays list of notifications in a scrollable area
- Shows notification icons, titles, messages, and timestamps
- Allows deletion of individual notifications
- Links to relevant pages based on notification type

#### NotificationPermissionPrompt (`client/src/components/notification-permission-prompt.tsx`)
- Prompts users to enable push notifications
- Appears 5 seconds after app load for new users
- Can be dismissed for 7 days
- Saves FCM token to backend when enabled

#### Firebase Messaging Hook (`client/src/hooks/use-firebase-messaging.tsx`)
- Initializes Firebase Cloud Messaging
- Requests notification permissions
- Handles FCM token registration
- Listens for foreground messages
- Shows toast notifications for incoming messages

### Firebase Configuration

#### Service Worker (`client/public/firebase-messaging-sw.js`)
- Handles background notifications
- Shows notifications when app is not in focus
- Handles notification clicks to open relevant pages
- Routes clicks to appropriate app pages based on notification type

## Setup Instructions

### 1. Firebase Setup

1. **Generate VAPID Key** (if not already done):
   - Go to [Firebase Console](https://console.firebase.google.com)
   - Select your project (trend-60388)
   - Go to Project Settings → Cloud Messaging → Web Push certificates
   - Generate a new key pair or use existing one
   - Copy the "Key pair" value

2. **Set Environment Variable**:
   Add to your `.env` file:
   ```bash
   VITE_FIREBASE_VAPID_KEY=your_vapid_key_here
   ```

### 2. Email Setup

Email notifications use Gmail SMTP (already configured):
```bash
GMAIL_USER=your_email@gmail.com
GMAIL_PASS=your_app_password
FROM_EMAIL=noreply@trend-app.com
BASE_URL=https://your-app-url.com
```

### 3. Database Migration

The database schema has been updated with two new tables:
- `notifications` - stores all notifications
- `fcm_tokens` - stores Firebase Cloud Messaging tokens

Run the migration:
```bash
npm run db:push
```

## Usage Flow

### For Users Following Someone

1. **Enable Notifications** (First Time):
   - Log in to the app
   - A prompt appears asking to enable push notifications
   - Click "Enable" and grant browser permission
   - FCM token is saved to backend

2. **Receive Notifications**:
   - When someone you follow creates a prediction:
     - Notification appears in the bell icon (badge updates)
     - Email is sent to your registered email
     - Push notification appears (if enabled)
   
3. **View Notifications**:
   - Click the bell icon in the header
   - See list of recent notifications
   - Click a notification to navigate to relevant page
   - Notifications are automatically marked as read when viewed

### For Users Creating Predictions

When you create a prediction:
1. Prediction is saved to database
2. System finds all your followers
3. For each follower:
   - Creates in-app notification
   - Sends email notification
   - Sends push notification (if they have FCM token)

## Notification Types

### New Prediction
- **Triggered**: When a user you follow creates a prediction
- **Title**: "New prediction from [username]"
- **Message**: "[username] predicted that [SYMBOL] will go [up/down] ([duration] term)"
- **Link**: `/user/[username]`

### Badge Earned
- **Triggered**: When you earn a new badge (existing feature)
- **Title**: "Badge Earned!"
- **Message**: Description of badge earned
- **Link**: `/profile`

### Leaderboard Update
- **Triggered**: Can be used for rank changes or monthly updates
- **Title**: "Leaderboard Update"
- **Message**: Description of update
- **Link**: `/leaderboard`

## Testing

### Test Notification Flow

1. **Create Two Test Accounts**:
   ```bash
   # Account A (follower)
   # Account B (creator)
   ```

2. **Set Up Following**:
   - Log in as Account A
   - Navigate to Account B's profile
   - Click "Follow"

3. **Enable Notifications** (Account A):
   - Grant notification permission when prompted
   - Verify FCM token is saved

4. **Create Prediction** (Account B):
   - Log in as Account B
   - Create a new prediction on any asset

5. **Verify Notifications** (Account A):
   - Check bell icon for badge count
   - Open notifications dropdown
   - Check email inbox
   - Check browser notifications

### Database Queries

Check notifications:
```sql
SELECT * FROM notifications WHERE user_id = 'user_uuid_here' ORDER BY created_at DESC;
```

Check FCM tokens:
```sql
SELECT * FROM fcm_tokens WHERE user_id = 'user_uuid_here';
```

Check follows:
```sql
SELECT * FROM user_follows WHERE follower_id = 'user_uuid_here';
```

## Troubleshooting

### Push Notifications Not Working

1. **Check VAPID Key**: Ensure `VITE_FIREBASE_VAPID_KEY` is set correctly
2. **Check Firebase Project**: Verify Firebase project ID matches in firebase.ts and service worker
3. **Check Browser Support**: Push notifications require HTTPS (except localhost)
4. **Check Service Worker**: Visit `chrome://serviceworker-internals/` to debug
5. **Check FCM Token**: Verify token is saved in database

### Email Notifications Not Sending

1. **Check Gmail Credentials**: Verify `GMAIL_USER` and `GMAIL_PASS` are correct
2. **Check App Password**: Use an App Password, not regular password
3. **Check Transporter**: Look for "✅ Email transporter ready" in console logs
4. **Check Email Logs**: Look for "✅ Email notification sent to:" in logs

### In-App Notifications Not Appearing

1. **Check Authentication**: Verify user is logged in
2. **Check API Endpoints**: Test `/api/notifications/unread/count` manually
3. **Check Database**: Verify notifications are being created
4. **Check Network**: Look for API errors in browser console

### No Followers Being Notified

1. **Check Follow Relationship**: Verify follower → following relationship exists
2. **Check User IDs**: Ensure correct user IDs in user_follows table
3. **Check Console Logs**: Look for "📬 Found X followers to notify"

## Performance Considerations

1. **Email Sending**: Runs asynchronously, doesn't block prediction creation
2. **Push Notifications**: Batch sent to all user devices
3. **Invalid Tokens**: Automatically removed from database when push fails
4. **Database Indexes**: Added on `user_id`, `is_read`, and `created_at` for fast queries
5. **Auto-Refresh**: Notification count refreshes every 30 seconds (configurable)

## Future Enhancements

Potential improvements:
1. Notification preferences (per notification type)
2. Quiet hours (don't send during certain times)
3. Digest emails (daily/weekly summary)
4. Web Socket integration for real-time updates
5. Notification sounds
6. Custom notification templates
7. Notification analytics (delivery rates, open rates)
8. In-app notification settings page

## Security Considerations

1. **Authentication**: All notification endpoints require authentication
2. **Authorization**: Users can only access their own notifications
3. **Token Storage**: FCM tokens are securely stored and associated with user accounts
4. **Email Content**: No sensitive information included in emails
5. **Rate Limiting**: Consider adding rate limiting to prevent notification spam

## Monitoring

Key metrics to monitor:
1. Notification creation rate
2. Email delivery success rate
3. Push notification success rate
4. FCM token count per user
5. Unread notification count distribution
6. Notification click-through rate

## Support

For issues or questions:
1. Check console logs for errors
2. Verify environment variables are set
3. Test with two accounts following each other
4. Check Firebase Console for quota/errors
5. Review email service logs

## Summary

The notification system is fully integrated and provides comprehensive notification capabilities:
- ✅ In-app notifications with bell icon and badge
- ✅ Email notifications via Gmail SMTP
- ✅ Push notifications via Firebase Cloud Messaging
- ✅ Automatic notification on new predictions
- ✅ User-friendly UI for viewing and managing notifications
- ✅ Robust error handling and fallbacks
- ✅ Database schema and API endpoints
- ✅ Permission prompt for new users
- ✅ Background notification support

Users will now receive timely notifications when people they follow make predictions, enhancing engagement and keeping the community informed!

