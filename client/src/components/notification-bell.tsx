import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { NotificationList } from "./notification-list";
import { API_BASE_URL } from "@/lib/api-config";
import { authenticatedFetch } from "@/lib/auth-helpers";

interface UnreadCountResponse {
  count: number;
}

export function NotificationBell() {
  const [isOpen, setIsOpen] = useState(false);
  const queryClient = useQueryClient();

  // Fetch unread notification count
  const { data: unreadData } = useQuery<UnreadCountResponse>({
    queryKey: ["/api/notifications/unread/count"],
    queryFn: async () => {
      const response = await authenticatedFetch(
        `${API_BASE_URL}/api/notifications/unread/count`
      );
      if (!response.ok) throw new Error("Failed to fetch unread count");
      return response.json();
    },
    refetchInterval: 30000, // refetch every 30s
  });

  const unreadCount = unreadData?.count || 0;

  // Mark all as read mutation
  const markAllAsReadMutation = useMutation({
    mutationFn: async () => {
      const response = await authenticatedFetch(
        `${API_BASE_URL}/api/notifications/read-all`,
        { method: "PATCH" }
      );
      if (!response.ok) throw new Error("Failed to mark notifications as read");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/notifications/unread/count"],
      });
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
    },
  });

  const handleOpenChange = (open: boolean) => setIsOpen(open);

  return (
    <Popover open={isOpen} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="relative bg-[#1E1F25] hover:bg-[#2A2D31] hover:text-white"
        >
          <Bell className="h-5 w-5 text-gray-300" />
          {unreadCount > 0 && (
            <Badge
              className="absolute -top-1.5 -right-1.5 h-5 min-w-5 flex items-center justify-center p-0 text-[10px]"
              variant="destructive"
            >
              {unreadCount > 99 ? "99+" : unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>

      {/* 🔔 Popover Content */}
      <PopoverContent
        align="end"
        className="w-96 p-0 bg-[#1E1F25] border-none shadow-xl rounded-xl overflow-hidden text-gray-300"
      >
        <div className="max-h-[420px] overflow-y-auto custom-scrollbar">
          <NotificationList />
        </div>
      </PopoverContent>
    </Popover>
  );
}
