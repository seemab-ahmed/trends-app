// Import Firebase scripts for service worker
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');

// Initialize Firebase in the service worker
firebase.initializeApp({
  apiKey: "AIzaSyCPGu7mgL9jYnSGbhEU9_L8TM7YStcs6yw",
  authDomain: "trend-60388.firebaseapp.com",
  projectId: "trend-60388",
  storageBucket: "trend-60388.appspot.com",
  messagingSenderId: "556257364266",
  appId: "1:556257364266:web:d12e96ab0d88a4b391f653",
  measurementId: "G-FL25931ZMS"
});

// Retrieve an instance of Firebase Messaging
const messaging = firebase.messaging();

// Handle background messages
messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message:', payload);

  const notificationTitle = payload.notification?.title || 'New Notification';
  const notificationOptions = {
    body: payload.notification?.body || '',
    icon: '/icon-192x192.png', // You can customize this icon
    badge: '/badge-72x72.png', // You can customize this badge
    data: payload.data,
    tag: payload.data?.type || 'notification',
    requireInteraction: false,
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
  console.log('[firebase-messaging-sw.js] Notification clicked:', event);
  
  event.notification.close();

  // Determine the URL to open based on notification data
  let urlToOpen = '/';
  
  if (event.notification.data) {
    const data = event.notification.data;
    
    if (data.type === 'new_prediction' && data.creatorUsername) {
      urlToOpen = `/user/${data.creatorUsername}`;
    } else if (data.type === 'badge_earned') {
      urlToOpen = '/profile';
    } else if (data.type === 'leaderboard_update') {
      urlToOpen = '/leaderboard';
    }
  }

  // Open or focus the app window
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // Check if there's already a window open
        for (let i = 0; i < clientList.length; i++) {
          const client = clientList[i];
          if (client.url.includes(self.location.origin) && 'focus' in client) {
            return client.focus().then(() => client.navigate(urlToOpen));
          }
        }
        // If no window is open, open a new one
        if (clients.openWindow) {
          return clients.openWindow(urlToOpen);
        }
      })
  );
});

