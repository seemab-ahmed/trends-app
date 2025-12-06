import { useQuery, useMutation } from "@tanstack/react-query";
import { API_ENDPOINTS } from "@/lib/api-config";
import { apiRequest } from "@/lib/queryClient";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Copy, Link as LinkIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { queryClient } from "@/lib/queryClient";
import { API_BASE_URL } from "@/lib/api-config";
import { useAuth } from "@/hooks/use-auth";

export default function ReferralCard() {
  const { toast } = useToast();
  const { user } = useAuth();

  const { data, refetch, isFetching } = useQuery<{
    referralCode: string | null;
    referralLink: string | null;
  }>({
    queryKey: [API_ENDPOINTS.REFERRAL_INFO()],
    enabled: !!user,
  });

  const { data: stats } = useQuery<{ referredCount: number }>({
    queryKey: [API_ENDPOINTS.REFERRAL_STATS()],
    enabled: !!user,
  });

  const generate = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Please log in to generate a referral code");
      const res = await apiRequest("POST", API_ENDPOINTS.REFERRAL_GENERATE());
      if (!res.ok) throw new Error("Failed to generate referral code");
      return res.json();
    },
    onSuccess: () => {
      refetch();
      toast({ title: "Referral code created" });
    },
    onError: (e: any) =>
      toast({
        title: "Failed",
        description: e.message,
        variant: "destructive",
      }),
  });

  const code = data?.referralCode || "";
  const link = data?.referralLink || "";
  // Local live count, seeded from query once
  const [liveCount, setLiveCount] = useState<number | null>(null);
  useEffect(() => {
    if (typeof stats?.referredCount === "number")
      setLiveCount(stats.referredCount);
  }, [stats?.referredCount]);
  const referredCount = liveCount ?? stats?.referredCount ?? 0;

  // Simple levels
  const levels = [
    { name: "Connector", threshold: 1 },
    { name: "Influencer", threshold: 5 },
    { name: "Ambassador", threshold: 10 },
  ];
  const currentLevel =
    [...levels].reverse().find((l) => referredCount >= l.threshold) ||
    levels[0];
  const nextLevel = levels.find((l) => l.threshold > currentLevel.threshold);
  const progressPct = (() => {
    if (referredCount <= 0) return 0;
    if (!nextLevel) return 100;
    const num = referredCount - currentLevel.threshold;
    const den = nextLevel.threshold - currentLevel.threshold;
    return Math.max(0, Math.min(100, Math.round((num / den) * 100)));
  })();

  const copy = async () => {
    if (!link) return;
    await navigator.clipboard.writeText(link);
    toast({
      title: "Copied",
      description: "Referral link copied to clipboard",
    });
  };

  // Live updates via WebSocket
  // WebSocket like public-feed.tsx for dynamic referral updates
  const wsRef = useRef<WebSocket | null>(null);
  useEffect(() => {
    const computeWsUrl = () => {
      if (API_BASE_URL) {
        try {
          const u = new URL(API_BASE_URL);
          const wsProto = u.protocol === "https:" ? "wss:" : "ws:";
          return `${wsProto}//${u.host}`;
        } catch {}
      }
      const host = window.location.hostname || "localhost";
      const wsProto = window.location.protocol === "https:" ? "wss:" : "ws:";
      return `${wsProto}//${host}:3002`;
    };
    const wsUrl = computeWsUrl();
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;
    ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data);
        if (msg?.type === "referral_update") {
          // If this broadcast targets the logged-in referrer, update immediately
          if (user && msg.userId === user.id) {
            setLiveCount(msg.referredCount);
            queryClient.setQueryData([API_ENDPOINTS.REFERRAL_STATS()], {
              referredCount: msg.referredCount,
            });
          }
          // Ensure consistency by refetching
          queryClient.invalidateQueries({
            queryKey: [API_ENDPOINTS.REFERRAL_STATS()],
          });
        }
      } catch {
        // ignore non-JSON frames
      }
    };
    return () => {
      try {
        ws.close(1000);
      } catch {}
    };
  }, [user?.id]);

  return (
    // bg-[linear-gradient(to_bottom,#8fffb8_0%,#ffb2b2_100%)]
    <Card className="bg-white  shadow-md shadow-gray-400  border-0 rounded-3xl shadow-[0_0_10px_rgba(0,0,0,0.15)]">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2 text-black">
          <LinkIcon className="h-4 w-4" />
          Your Referral
        </CardTitle>
        <CardDescription className="text-black text-sm">
          Invite friends and grow the community
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="w-full h-3 bg-gray-100 border-0 rounded-full relative flex items-center ">
          <div
            className="h-2 bg-gray-500 rounded-full relative"
            style={{ width: `20%` }}
          >
            {/* Slider marker at the end of filled width - positioned outside borders */}
            <div className="absolute right-0 top-1/2 transform translate-x-1/2 -translate-y-1/2 w-4 h-4 bg-white border-4 border-blue-600 rounded-full shadow-lg z-50" />
          </div>
        </div>
        <div className="flex items-center justify-between text-xs  !text-black">
          <div>
            Level:{" "}
            <span className="font-medium text-black">{currentLevel.name}</span>
          </div>
          <div>
            Referred:{" "}
            <span className="font-medium text-black">{referredCount}</span>
          </div>
        </div>

        {code ? (
          <div className="space-y-2">
            <div className="text-sm !text-bl">Your code</div>
            <div className="flex gap-2">
              <Input readOnly value={code} />
              <Button
              className="bg-blue-500 text-white border border-blue-500 hover:bg-blue-600 hover:text-white"
                variant="outline"
                onClick={() => navigator.clipboard.writeText(code)}
                title="Copy code"
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
            <div className="text-sm text-black">Referral link</div>
            <div className="flex gap-2">
              <Input readOnly value={link} />
              <Button onClick={copy} title="Copy link " className=" hover:bg-blue-600 hover:text-white bg-blue-500 text-white border border-blue-500">
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <Button
              disabled={!user || isFetching || generate.isPending}
              title={user ? undefined : "Please log in to generate"}
              onClick={() => generate.mutate()}
              className="bg-white border border-black shadow-md shadow-gray-400 text-black hover:bg-blue-600 !hover:text-white transition-all ease-in-out duration-500   cursor-pointer text-xs"
            >
              Generate my referral code
            </Button>
            {nextLevel ? (
              <div className="text-xs text-black !text-black text-right">
                {Math.max(0, nextLevel.threshold - referredCount)} more to reach{" "}
                <span className="font-medium">{nextLevel.name}</span>
              </div>
            ) : (
              <div className="text-xs text-black text-right">
                Max level achieved
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
