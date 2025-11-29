import { useState, useEffect } from 'react';
import { Bell, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useFirebaseMessaging } from '@/hooks/use-firebase-messaging';

export function NotificationPermissionPrompt() {
  const [isVisible, setIsVisible] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);
  const { permissionGranted, requestNotificationPermission } = useFirebaseMessaging();

  useEffect(() => {
    // Check if user has already dismissed the prompt
    const dismissed = localStorage.getItem('notification-prompt-dismissed');
    
    // Show prompt if:
    // - Notifications are supported
    // - Permission is not granted
    // - User hasn't dismissed it
    // - It hasn't been dismissed in this session
    if (
      'Notification' in window &&
      Notification.permission === 'default' &&
      !dismissed &&
      !isDismissed
    ) {
      // Show prompt after a short delay
      const timer = setTimeout(() => {
        setIsVisible(true);
      }, 5000); // Show after 5 seconds

      return () => clearTimeout(timer);
    }
  }, [permissionGranted, isDismissed]);

  const handleEnable = async () => {
    await requestNotificationPermission();
    setIsVisible(false);
    setIsDismissed(true);
  };

  const handleDismiss = () => {
    setIsVisible(false);
    setIsDismissed(true);
    // Remember dismissal for 7 days
    const dismissalDate = new Date();
    dismissalDate.setDate(dismissalDate.getDate() + 7);
    localStorage.setItem('notification-prompt-dismissed', dismissalDate.toISOString());
  };

  if (!isVisible || permissionGranted) {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-sm animate-in slide-in-from-bottom-5">
      <Card className="shadow-lg border-2">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2">
              <Bell className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg">Enable Notifications</CardTitle>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0"
              onClick={handleDismiss}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <CardDescription>
            Get instant notifications when users you follow make new predictions. Stay updated in real-time!
          </CardDescription>
          <div className="flex gap-2">
            <Button onClick={handleEnable} className="flex-1">
              Enable
            </Button>
            <Button onClick={handleDismiss} variant="outline" className="flex-1">
              Maybe Later
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

