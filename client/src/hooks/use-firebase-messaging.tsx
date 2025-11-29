import { useEffect, useState } from 'react';
import { getMessaging, getToken, onMessage, Messaging } from 'firebase/messaging';
import app from '@/lib/firebase';
import { useAuth } from './use-auth';
import { API_BASE_URL } from '@/lib/api-config';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from './use-toast';

// VAPID key - You need to generate this from Firebase Console
// Go to: Firebase Console -> Project Settings -> Cloud Messaging -> Web Push certificates
// For now, this is a placeholder - the user needs to add their own VAPID key
const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY || '';

export function useFirebaseMessaging() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [messaging, setMessaging] = useState<Messaging | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [permissionGranted, setPermissionGranted] = useState<boolean>(false);

  useEffect(() => {
    // Only initialize if user is logged in and browser supports notifications
    if (!user || !('Notification' in window) || !('serviceWorker' in navigator)) {
      return;
    }

    initializeMessaging();
  }, [user]);

  const initializeMessaging = async () => {
    try {
      // Check if service worker is supported
      if (!('serviceWorker' in navigator)) {
        console.log('Service Workers not supported');
        return;
      }

      // Register service worker
      const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
      console.log('Service Worker registered:', registration);

      // Initialize Firebase Messaging
      const messagingInstance = getMessaging(app);
      setMessaging(messagingInstance);

      // Check notification permission
      const permission = Notification.permission;
      setPermissionGranted(permission === 'granted');

      if (permission === 'granted') {
        await requestAndSaveFCMToken(messagingInstance);
      }

      // Listen for foreground messages
      onMessage(messagingInstance, (payload) => {
        console.log('Foreground message received:', payload);
        
        // Show toast notification
        toast({
          title: payload.notification?.title || 'New Notification',
          description: payload.notification?.body || '',
        });

        // Refresh notifications
        queryClient.invalidateQueries({ queryKey: ['/api/notifications'] });
        queryClient.invalidateQueries({ queryKey: ['/api/notifications/unread/count'] });
      });
    } catch (error) {
      console.error('Error initializing Firebase Messaging:', error);
    }
  };

  const requestAndSaveFCMToken = async (messagingInstance: Messaging) => {
    try {
      if (!VAPID_KEY) {
        console.warn('VAPID key not configured. FCM push notifications will not work.');
        return;
      }

      const currentToken = await getToken(messagingInstance, {
        vapidKey: VAPID_KEY,
      });

      if (currentToken) {
        console.log('FCM Token obtained:', currentToken);
        setToken(currentToken);

        // Save token to backend
        await saveFCMTokenToBackend(currentToken);
      } else {
        console.log('No registration token available');
      }
    } catch (error) {
      console.error('Error getting FCM token:', error);
    }
  };

  const saveFCMTokenToBackend = async (token: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/notifications/fcm-token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          token,
          deviceInfo: navigator.userAgent,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to save FCM token');
      }

      console.log('FCM token saved to backend');
    } catch (error) {
      console.error('Error saving FCM token:', error);
    }
  };

  const requestNotificationPermission = async () => {
    try {
      const permission = await Notification.requestPermission();
      setPermissionGranted(permission === 'granted');

      if (permission === 'granted' && messaging) {
        await requestAndSaveFCMToken(messaging);
        
        toast({
          title: 'Notifications enabled',
          description: 'You will now receive push notifications for new predictions from users you follow.',
        });
      } else if (permission === 'denied') {
        toast({
          title: 'Notifications blocked',
          description: 'Please enable notifications in your browser settings to receive push notifications.',
          variant: 'destructive',
        });
      }

      return permission;
    } catch (error) {
      console.error('Error requesting notification permission:', error);
      toast({
        title: 'Error',
        description: 'Failed to request notification permission.',
        variant: 'destructive',
      });
      return 'default';
    }
  };

  return {
    messaging,
    token,
    permissionGranted,
    requestNotificationPermission,
  };
}

