import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Bell, TrendingUp, Trophy, X, Loader2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { formatDistanceToNow } from "date-fns";
import { Link } from "wouter";
import { API_BASE_URL } from "@/lib/api-config";
import { authenticatedFetch } from "@/lib/auth-helpers";

interface Notification {
  id: string;
  type: 'new_prediction' | 'badge_earned' | 'leaderboard_update';
  title: string;
  message: string;
  isRead: boolean;
  createdAt: Date;
  relatedUser?: {
    id: string;
    username: string;
  };
  relatedAsset?: {
    id: string;
    symbol: string;
    name: string;
  };
  metadata?: any;
}

export function NotificationList() {
  const queryClient = useQueryClient();

  // Fetch notifications
  const { data: notifications, isLoading } = useQuery<Notification[]>({
    queryKey: ["/api/notifications"],
    queryFn: async () => {
      console.log('📬 Fetching notifications from:', `${API_BASE_URL}/api/notifications?limit=50`);
      const response = await authenticatedFetch(`${API_BASE_URL}/api/notifications?limit=50`);
      
      if (!response.ok) {
        console.error('❌ Failed to fetch notifications:', response.status, response.statusText);
        throw new Error('Failed to fetch notifications');
      }
      
      const data = await response.json();
      console.log('📋 Notifications response:', data);
      return data;
    },
  });

  // Mark all as read mutation
  const markAllAsReadMutation = useMutation({
    mutationFn: async () => {
      const response = await authenticatedFetch(`${API_BASE_URL}/api/notifications/read-all`, {
        method: 'PATCH',
      });
      
      if (!response.ok) {
        throw new Error('Failed to mark all notifications as read');
      }
      
      return response.json();
    },
    onSuccess: () => {
      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/notifications/unread/count"] });
    },
  });

  // Mark notification as read mutation
  const markAsReadMutation = useMutation({
    mutationFn: async (notificationId: string) => {
      const response = await authenticatedFetch(`${API_BASE_URL}/api/notifications/${notificationId}/read`, {
        method: 'PATCH',
      });
      
      if (!response.ok) {
        throw new Error('Failed to mark notification as read');
      }
      
      return response.json();
    },
    onSuccess: () => {
      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/notifications/unread/count"] });
    },
  });

  // Delete notification mutation
  const deleteNotificationMutation = useMutation({
    mutationFn: async (notificationId: string) => {
      const response = await authenticatedFetch(`${API_BASE_URL}/api/notifications/${notificationId}`, {
        method: 'DELETE',
      });
      
      if (!response.ok) {
        throw new Error('Failed to delete notification');
      }
      
      return response.json();
    },
    onSuccess: () => {
      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/notifications/unread/count"] });
    },
  });

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'new_prediction':
        return <TrendingUp className="h-5 w-5 text-blue-500" />;
      case 'badge_earned':
        return <Trophy className="h-5 w-5 text-yellow-500" />;
      case 'leaderboard_update':
        return <Trophy className="h-5 w-5 text-green-500" />;
      default:
        return <Bell className="h-5 w-5 text-gray-500" />;
    }
  };

  const getNotificationLink = (notification: Notification) => {
    if (notification.type === 'new_prediction' && notification.relatedUser) {
      return `/user/${notification.relatedUser.username}`;
    }
    if (notification.type === 'badge_earned') {
      return '/profile';
    }
    if (notification.type === 'leaderboard_update') {
      return '/leaderboard';
    }
    return null;
  };

  if (isLoading) {
    return (
      <div className="p-4 flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!notifications || notifications.length === 0) {
    return (
      <div className="p-8 text-center">
        <Bell className="h-12 w-12 mx-auto mb-3 text-muted-foreground/50" />
        <p className="text-sm text-muted-foreground">No notifications yet</p>
        <p className="text-xs text-muted-foreground mt-1">
          You'll be notified when users you follow make predictions
        </p>
      </div>
    );
  }

  // Separate unread and read notifications
  const unreadNotifications = notifications.filter(n => !n.isRead);
  const readNotifications = notifications.filter(n => n.isRead);

  return (
    <div className="flex flex-col">
      <div className="p-4 border-b flex items-center justify-between">
        <h3 className="font-semibold text-lg">Notifications</h3>
        {unreadNotifications.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => markAllAsReadMutation.mutate()}
            disabled={markAllAsReadMutation.isPending}
            className="text-xs"
          >
            <Check className="h-3 w-3 mr-1" />
            Mark all read
          </Button>
        )}
      </div>
      
      <ScrollArea className="h-[400px]">
        <div className="divide-y">
          {/* Show unread notifications first */}
          {unreadNotifications.map((notification) => {
            const link = getNotificationLink(notification);
            const content = (
              <div className={`p-4 hover:bg-muted/50 transition-colors relative group ${!notification.isRead ? 'bg-blue-50/10 border-l-2 border-l-blue-500' : ''}`}>
                <div className="flex gap-3">
                  <div className="flex-shrink-0 mt-1">
                    {getNotificationIcon(notification.type)}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground mb-1">
                      {notification.title}
                    </p>
                    <p className="text-sm text-muted-foreground mb-2">
                      {notification.message}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })}
                    </p>
                  </div>

                  <Button
                    variant="ghost"
                    size="sm"
                    className="opacity-0 group-hover:opacity-100 transition-opacity h-6 w-6 p-0"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      deleteNotificationMutation.mutate(notification.id);
                    }}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            );

            if (link) {
              return (
                <Link key={notification.id} href={link}>
                  <div 
                    className="cursor-pointer"
                    onClick={() => {
                      // Mark as read when clicked
                      if (!notification.isRead) {
                        markAsReadMutation.mutate(notification.id);
                      }
                    }}
                  >
                    {content}
                  </div>
                </Link>
              );
            }

            return <div key={notification.id}>{content}</div>;
          })}
          
          {/* Show read notifications after unread ones */}
          {readNotifications.length > 0 && (
            <>
              {unreadNotifications.length > 0 && (
                <div className="px-4 py-2 bg-muted/30">
                  <p className="text-xs text-muted-foreground font-medium">Earlier</p>
                </div>
              )}
              {readNotifications.map((notification) => {
                const link = getNotificationLink(notification);
                const content = (
                  <div className="p-4 hover:bg-muted/50 transition-colors relative group opacity-75">
                    <div className="flex gap-3">
                      <div className="flex-shrink-0 mt-1">
                        {getNotificationIcon(notification.type)}
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground mb-1">
                          {notification.title}
                        </p>
                        <p className="text-sm text-muted-foreground mb-2">
                          {notification.message}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })}
                        </p>
                      </div>

                      <Button
                        variant="ghost"
                        size="sm"
                        className="opacity-0 group-hover:opacity-100 transition-opacity h-6 w-6 p-0"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          deleteNotificationMutation.mutate(notification.id);
                        }}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                );

                if (link) {
                  return (
                    <Link key={notification.id} href={link}>
                      <div 
                        className="cursor-pointer"
                        onClick={() => {
                          // Mark as read when clicked (even if already read, no harm)
                          if (!notification.isRead) {
                            markAsReadMutation.mutate(notification.id);
                          }
                        }}
                      >
                        {content}
                      </div>
                    </Link>
                  );
                }

                return <div key={notification.id}>{content}</div>;
              })}
            </>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

