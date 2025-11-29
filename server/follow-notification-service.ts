import { db } from './db';
import { notifications, users, userFollows, assets, predictions, fcmTokens } from '../shared/schema';
import { eq, and, desc, inArray } from 'drizzle-orm';
import { sendVerificationEmail } from './email-service';
import { getAdminAuth } from './firebase-admin';
import nodemailer from 'nodemailer';

// Gmail transporter setup (reusing email-service config)
const GMAIL_USER = process.env.GMAIL_USER;
const GMAIL_PASS = process.env.GMAIL_PASS;
const FROM_EMAIL = process.env.FROM_EMAIL || 'noreply@trend-app.com';
const BASE_URL = process.env.BASE_URL || 'https://natural-pest-production.up.railway.app';

let transporter: nodemailer.Transporter | null = null;

// Initialize email transporter
async function initializeEmailTransporter() {
  if (GMAIL_USER && GMAIL_PASS) {
    try {
      transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: GMAIL_USER,
          pass: GMAIL_PASS,
        },
        secure: true,
        port: 465,
      });
      
      await new Promise((resolve, reject) => {
        transporter!.verify((error, success) => {
          if (error) {
            console.error('❌ Email transporter verification failed:', error);
            transporter = null;
            reject(error);
          } else {
            console.log('✅ Email transporter ready for notifications');
            resolve(success);
          }
        });
      });
      
      return true;
    } catch (error) {
      console.error('❌ Failed to initialize email transporter:', error);
      transporter = null;
      return false;
    }
  } else {
    console.log('📧 Gmail credentials not configured for notifications.');
    return false;
  }
}

// Initialize on module load
initializeEmailTransporter();

/**
 * Create a notification in the database
 */
export async function createNotification(data: {
  userId: string;
  type: 'new_prediction' | 'badge_earned' | 'leaderboard_update';
  title: string;
  message: string;
  relatedUserId?: string;
  relatedPredictionId?: string;
  relatedAssetId?: string;
  metadata?: any;
}) {
  try {
    const [notification] = await db.insert(notifications).values({
      userId: data.userId,
      type: data.type,
      title: data.title,
      message: data.message,
      relatedUserId: data.relatedUserId,
      relatedPredictionId: data.relatedPredictionId,
      relatedAssetId: data.relatedAssetId,
      metadata: data.metadata,
    }).returning();

    console.log(`📬 Notification created for user ${data.userId}: ${data.title}`);
    return notification;
  } catch (error) {
    console.error('❌ Failed to create notification:', error);
    throw error;
  }
}

/**
 * Send email notification
 */
export async function sendEmailNotification(
  email: string,
  subject: string,
  htmlContent: string,
  textContent: string
) {
  try {
    if (!transporter) {
      console.log('⚠️  Email transporter not available, skipping email notification');
      return { success: false, emailSent: false };
    }

    const mailOptions = {
      from: `"Trend App" <${FROM_EMAIL}>`,
      to: email,
      subject,
      html: htmlContent,
      text: textContent,
    };

    await transporter.sendMail(mailOptions);
    console.log(`✅ Email notification sent to: ${email}`);
    return { success: true, emailSent: true };
  } catch (error) {
    console.error('❌ Failed to send email notification:', error);
    return { success: false, emailSent: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

/**
 * Send FCM push notification to user's devices
 */
export async function sendPushNotification(
  userId: string,
  title: string,
  body: string,
  data?: Record<string, string>
) {
  try {
    // Get user's FCM tokens
    const userTokens = await db.query.fcmTokens.findMany({
      where: eq(fcmTokens.userId, userId),
    });

    if (userTokens.length === 0) {
      console.log(`📱 No FCM tokens found for user ${userId}`);
      return { success: true, sent: 0 };
    }

    // Send notification to all user devices
    const auth = getAdminAuth();
    const messaging = await import('firebase-admin/messaging').then(m => m.getMessaging());
    
    const tokens = userTokens.map(t => t.token);
    const message = {
      notification: {
        title,
        body,
      },
      data: data || {},
      tokens,
    };

    const response = await messaging.sendEachForMulticast(message);
    console.log(`📱 Push notifications sent: ${response.successCount}/${tokens.length}`);

    // Remove invalid tokens
    if (response.failureCount > 0) {
      const invalidTokens: string[] = [];
      response.responses.forEach((resp, idx) => {
        if (!resp.success) {
          invalidTokens.push(tokens[idx]);
        }
      });

      if (invalidTokens.length > 0) {
        await db.delete(fcmTokens).where(inArray(fcmTokens.token, invalidTokens));
        console.log(`🗑️  Removed ${invalidTokens.length} invalid FCM tokens`);
      }
    }

    return { success: true, sent: response.successCount, failed: response.failureCount };
  } catch (error) {
    console.error('❌ Failed to send push notification:', error);
    return { success: false, sent: 0, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

/**
 * Notify followers when a user creates a new prediction
 */
export async function notifyFollowersOfNewPrediction(
  creatorUserId: string,
  predictionId: string,
  assetId: string
) {
  try {
    console.log(`📣 Notifying followers of user ${creatorUserId} about new prediction`);

    // Get the creator's username
    const creator = await db.query.users.findFirst({
      where: eq(users.id, creatorUserId),
    });

    if (!creator) {
      console.error('❌ Creator user not found');
      return;
    }

    // Get the asset details
    const asset = await db.query.assets.findFirst({
      where: eq(assets.id, assetId),
    });

    if (!asset) {
      console.error('❌ Asset not found');
      return;
    }

    // Get the prediction details
    const prediction = await db.query.predictions.findFirst({
      where: eq(predictions.id, predictionId),
    });

    if (!prediction) {
      console.error('❌ Prediction not found');
      return;
    }

    // Get all followers
    const followers = await db.query.userFollows.findMany({
      where: eq(userFollows.followingId, creatorUserId),
    });

    if (followers.length === 0) {
      console.log(`📭 No followers to notify for user ${creatorUserId}`);
      return;
    }

    console.log(`📬 Found ${followers.length} followers to notify`);

    // Create notifications and send emails for each follower
    const notificationPromises = followers.map(async (follow) => {
      const follower = await db.query.users.findFirst({
        where: eq(users.id, follow.followerId),
      });

      if (!follower) {
        console.error(`❌ Follower ${follow.followerId} not found`);
        return;
      }

      const title = `New prediction from ${creator.username}`;
      const message = `${creator.username} predicted that ${asset.symbol} will go ${prediction.direction} (${prediction.duration} term)`;

      // Create in-app notification
      await createNotification({
        userId: follower.id,
        type: 'new_prediction',
        title,
        message,
        relatedUserId: creatorUserId,
        relatedPredictionId: predictionId,
        relatedAssetId: assetId,
        metadata: {
          assetSymbol: asset.symbol,
          assetName: asset.name,
          direction: prediction.direction,
          duration: prediction.duration,
          creatorUsername: creator.username,
        },
      });

      // Send push notification
      await sendPushNotification(
        follower.id,
        title,
        message,
        {
          type: 'new_prediction',
          predictionId,
          assetSymbol: asset.symbol,
          creatorUsername: creator.username,
        }
      );

      // Send email notification
      const emailHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9;">
          <div style="background-color: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
            <div style="text-align: center; margin-bottom: 30px;">
              <h1 style="color: #333; margin: 0; font-size: 24px;">📈 New Prediction Alert</h1>
            </div>
            
            <div style="margin-bottom: 30px;">
              <p style="color: #333; font-size: 16px; line-height: 1.6;">
                <strong>${creator.username}</strong> just made a new prediction:
              </p>
              
              <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #007bff;">
                <p style="margin: 5px 0; color: #333;"><strong>Asset:</strong> ${asset.name} (${asset.symbol})</p>
                <p style="margin: 5px 0; color: #333;"><strong>Direction:</strong> ${prediction.direction === 'up' ? '📈 UP' : '📉 DOWN'}</p>
                <p style="margin: 5px 0; color: #333;"><strong>Duration:</strong> ${prediction.duration}</p>
              </div>
            </div>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${BASE_URL}/user/${creator.username}" 
                 style="background-color: #007bff; color: white; padding: 12px 30px; text-decoration: none; border-radius: 8px; display: inline-block; font-weight: bold;">
                View Profile
              </a>
            </div>
            
            <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; text-align: center;">
              <p style="color: #999; font-size: 12px; margin: 0;">
                This notification was sent because you follow ${creator.username} on Trend App.
              </p>
              <p style="color: #999; font-size: 12px; margin: 10px 0 0 0;">
                <a href="${BASE_URL}/profile" style="color: #007bff;">Manage notification settings</a>
              </p>
            </div>
          </div>
        </div>
      `;

      const emailText = `
New Prediction from ${creator.username}

${creator.username} just made a new prediction:

Asset: ${asset.name} (${asset.symbol})
Direction: ${prediction.direction.toUpperCase()}
Duration: ${prediction.duration}

View ${creator.username}'s profile: ${BASE_URL}/user/${creator.username}

This notification was sent because you follow ${creator.username} on Trend App.
      `;

      await sendEmailNotification(
        follower.email,
        `New prediction from ${creator.username}`,
        emailHtml,
        emailText
      );
    });

    await Promise.all(notificationPromises);
    console.log(`✅ Notifications sent to ${followers.length} followers`);
  } catch (error) {
    console.error('❌ Failed to notify followers:', error);
  }
}

/**
 * Get user notifications
 */
export async function getUserNotifications(
  userId: string,
  options?: { limit?: number; offset?: number; unreadOnly?: boolean }
) {
  const { limit = 50, offset = 0, unreadOnly = false } = options || {};

  const conditions = [eq(notifications.userId, userId)];
  if (unreadOnly) {
    conditions.push(eq(notifications.isRead, false));
  }

  const userNotifications = await db.query.notifications.findMany({
    where: and(...conditions),
    orderBy: [desc(notifications.createdAt)],
    limit,
    offset,
  });

  // Enrich notifications with related data
  const enrichedNotifications = await Promise.all(
    userNotifications.map(async (notification) => {
      let relatedUser = null;
      let relatedAsset = null;

      if (notification.relatedUserId) {
        const user = await db.query.users.findFirst({
          where: eq(users.id, notification.relatedUserId),
        });
        if (user) {
          relatedUser = { id: user.id, username: user.username };
        }
      }

      if (notification.relatedAssetId) {
        const asset = await db.query.assets.findFirst({
          where: eq(assets.id, notification.relatedAssetId),
        });
        if (asset) {
          relatedAsset = { id: asset.id, symbol: asset.symbol, name: asset.name };
        }
      }

      return {
        ...notification,
        relatedUser,
        relatedAsset,
      };
    })
  );

  return enrichedNotifications;
}

/**
 * Get unread notification count
 */
export async function getUnreadNotificationCount(userId: string) {
  const unreadNotifications = await db.query.notifications.findMany({
    where: and(
      eq(notifications.userId, userId),
      eq(notifications.isRead, false)
    ),
  });

  return unreadNotifications.length;
}

/**
 * Mark notification as read
 */
export async function markNotificationAsRead(notificationId: string, userId: string) {
  try {
    const [updated] = await db
      .update(notifications)
      .set({ isRead: true })
      .where(and(
        eq(notifications.id, notificationId),
        eq(notifications.userId, userId)
      ))
      .returning();

    return updated;
  } catch (error) {
    console.error('❌ Failed to mark notification as read:', error);
    throw error;
  }
}

/**
 * Mark all notifications as read
 */
export async function markAllNotificationsAsRead(userId: string) {
  try {
    await db
      .update(notifications)
      .set({ isRead: true })
      .where(and(
        eq(notifications.userId, userId),
        eq(notifications.isRead, false)
      ));

    console.log(`✅ Marked all notifications as read for user ${userId}`);
  } catch (error) {
    console.error('❌ Failed to mark all notifications as read:', error);
    throw error;
  }
}

/**
 * Delete a notification
 */
export async function deleteNotification(notificationId: string, userId: string) {
  try {
    await db
      .delete(notifications)
      .where(and(
        eq(notifications.id, notificationId),
        eq(notifications.userId, userId)
      ));

    console.log(`🗑️  Deleted notification ${notificationId}`);
  } catch (error) {
    console.error('❌ Failed to delete notification:', error);
    throw error;
  }
}

/**
 * Save FCM token for a user
 */
export async function saveFCMToken(userId: string, token: string, deviceInfo?: string) {
  try {
    // Check if token already exists
    const existing = await db.query.fcmTokens.findFirst({
      where: eq(fcmTokens.token, token),
    });

    if (existing) {
      // Update existing token
      const [updated] = await db
        .update(fcmTokens)
        .set({ userId, deviceInfo, updatedAt: new Date() })
        .where(eq(fcmTokens.token, token))
        .returning();
      
      console.log(`✅ Updated FCM token for user ${userId}`);
      return updated;
    } else {
      // Insert new token
      const [newToken] = await db.insert(fcmTokens).values({
        userId,
        token,
        deviceInfo,
      }).returning();
      
      console.log(`✅ Saved new FCM token for user ${userId}`);
      return newToken;
    }
  } catch (error) {
    console.error('❌ Failed to save FCM token:', error);
    throw error;
  }
}

/**
 * Delete FCM token
 */
export async function deleteFCMToken(token: string) {
  try {
    await db.delete(fcmTokens).where(eq(fcmTokens.token, token));
    console.log(`🗑️  Deleted FCM token`);
  } catch (error) {
    console.error('❌ Failed to delete FCM token:', error);
    throw error;
  }
}

