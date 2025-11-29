import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { API_BASE_URL, API_ENDPOINTS } from "@/lib/api-config";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";

type FeedEvent = {
  type: "prediction_created" | "prediction_closed" | "badge_earned";
  createdAt: string;
  id: string;
  username: string | null;
  assetSymbol: string | null;
  direction: "up" | "down" | null;
  result: "correct" | "incorrect" | null;
  pointsAwarded: number | null;
  badgeType: string | null;
};

export default function PublicFeed() {
  const { data } = useQuery<{ events: FeedEvent[] }>({
    queryKey: [API_ENDPOINTS.FEED_PUBLIC()],
  });

  const [events, setEvents] = useState<FeedEvent[]>([]);

  useEffect(() => {
    if (data?.events) setEvents(data.events);
  }, [data]);

  // 🔄 WebSocket setup
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
        if (msg?.type === "feed_event" && msg.event) {
          setEvents((prev) => {
            const e = msg.event as FeedEvent;
            const key = `${e.type}-${e.id}`;
            const seen = new Set(prev.map((p) => `${p.type}-${p.id}`));
            if (seen.has(key)) return prev;
            const next = [e, ...prev];
            return next.slice(0, 10);
          });
        }
      } catch {
        // ignore invalid messages
      }
    };

    return () => ws.close(1000);
  }, []);

  // 🪙 Logo selector
  const getLogo = (symbol: string | null) => {
    if (!symbol) return "/images/crypto-logo.jpeg";
    const s = symbol.toLowerCase();
    if (["eur", "usd", "gbp", "jpy"].some((f) => s.includes(f)))
      return "/images/forex-logo2.jpeg";
    else if (["aapl", "tsla", "amzn", "msft"].some((f) => s.includes(f)))
      return "/images/stock-logo2.jpeg";
    return "/images/crypto-logo2.jpeg";
  };

  // ✂️ Latest 3 only
  const onlyPredictions = events
    .filter(
      (e) => e.type === "prediction_created" || e.type === "prediction_closed"
    )
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )
    .slice(0, 3);

  const onlyBadges = events
    .filter((e) => e.type === "badge_earned")
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )
    .slice(0, 3);

  // 🧩 Ensure 3 rows if data exists, but not if all empty
  const padRows = (items: FeedEvent[], type: "prediction" | "badge") => {
    if (items.length === 0) return items; // no rows → handled separately
    const rows = [...items];
    while (rows.length < 3) {
      rows.push({
        id: `placeholder-${rows.length}`,
        type: type === "prediction" ? "prediction_created" : "badge_earned",
        createdAt: "",
        username: null,
        assetSymbol: null,
        direction: null,
        result: null,
        pointsAwarded: null,
        badgeType: null,
      });
    }
    return rows;
  };

  const paddedPredictions = padRows(onlyPredictions, "prediction");
  const paddedBadges = padRows(onlyBadges, "badge");

  // 🗓️ Helper to show only date (no time)
  const formatDateOnly = (timestamp: string) => {
    try {
      return new Date(timestamp).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
      });
    } catch {
      return "-";
    }
  };

  // 📊 Prediction Table
  const renderPredictionTable = (items: FeedEvent[]) => {
    if (items.length === 0) {
      return (
        <div className="text-center text-gray-400 text-sm py-6">
          No predictions yet.
        </div>
      );
    }

    return (
      <div className="overflow-x-auto bg-white  rounded-[10px] py-5 shadow-[0_0_10px_rgba(0,0,0,0.15)]">
        <table className="min-w-full text-sm text-black-200 border-collapse rounded-[10px] overflow-hidden divide-y divide-white divide-[2px]">
          <thead className="text-black bg-gray-100 rounded-[10px] text-xs font-[700] uppercase border-0 ">
            <tr>
              <th className="py-3 px-4 text-left font-medium">Name</th>
              <th className="py-3 px-4 text-left font-medium">Coin</th>
              <th className="py-3 px-6 text-left font-medium">Direction</th>
              <th className="py-3 px-4 text-left font-medium">Status</th>
              <th className="py-3 px-4 text-left font-medium">Result</th>
              <th className="py-3 px-4 text-left font-medium">Points</th>
              <th className="py-3 px-4 text-left font-medium">Date</th>
            </tr>
          </thead>
          <tbody className=" divide-y divide-white divide-[2px]">
            {items.map((e, index) =>
              e.createdAt ? (
                <tr
                  key={`${e.type}-${e.id}`}
                  className="  transition-all ease-in-out duration-500 hover:bg-gray-100 rounded-[10px] mb-1"
                >
                  <td className="py-3 px-4 font-medium text-black">
                    {e.username || "Anonymous"}
                  </td>
                  <td className="py-3 px-4 flex items-center gap-2 min-w-[130px]">
                    <img
                      src={getLogo(e.assetSymbol)}
                      alt="logo"
                      className="h-9 w-9 rounded-full object-cover"
                    />
                    <span className="text-black-200">
                      {e.assetSymbol || "—"}
                    </span>
                  </td>
                  <td
                    className={`py-3 px-6 font-semibold ${
                      e.direction === "up"
                        ? "text-green-400"
                        : e.direction === "down"
                        ? "text-red-400"
                        : "text-gray-400"
                    }`}
                  >
                    {e.direction ? e.direction.toUpperCase() : "—"}
                  </td>
                  <td className="py-3 px-4 text-green-600 capitalize">
                    {e.type === "prediction_created"
                      ? "Active"
                      : e.type === "prediction_closed"
                      ? "Closed"
                      : "—"}
                  </td>
                  <td
                    className={`py-3 px-4 font-semibold ${
                      e.result === "correct"
                        ? "text-green-400"
                        : e.result === "incorrect"
                        ? "text-red-400"
                        : "text-red-400"
                    }`}
                  >
                    {e.result ? e.result.toUpperCase() : "PENDING"}
                  </td>
                  <td
                    className={`py-3 px-4 font-semibold ${
                      (e.pointsAwarded ?? 0) > 0
                        ? "text-green-400"
                        : (e.pointsAwarded ?? 0) < 0
                        ? "text-red-400"
                        : "text-black-300"
                    }`}
                  >
                    {typeof e.pointsAwarded === "number"
                      ? e.pointsAwarded > 0
                        ? `+${e.pointsAwarded}`
                        : e.pointsAwarded
                      : "—"}
                  </td>
                  <td className="py-3 px-4 text-gray-400 whitespace-nowrap">
                    {formatDateOnly(e.createdAt)}
                  </td>
                </tr>
              ) : (
                <tr key={`placeholder-${index}`} className="opacity-40">
                  <td
                    colSpan={7}
                    className="py-6 px-4 text-center text-gray-500"
                  >
                    —
                  </td>
                </tr>
              )
            )}
          </tbody>
        </table>
      </div>
    );
  };

  // 🏆 Achievements Table
  const renderAchievementsTable = (items: FeedEvent[]) => {
    if (items.length === 0) {
      return (
        <div className="text-center text-gray-400 text-sm py-6">
          No achievements yet.
        </div>
      );
    }

    return (
      <div className="overflow-x-auto bg-white  rounded-[10px] py-5 shadow-[0_0_10px_rgba(0,0,0,0.15)] ">
        <table className="min-w-full text-sm rounded-[10px] overflow-hidden text-black-200 border-collapse">
          <thead className="text-black bg-gray-100 font-[700] text-xs uppercase border-0">
            <tr>
              <th className="py-3 px-4 text-left font-medium">Name</th>
              <th className="py-3 px-4 text-left font-medium">Achievement</th>
              <th className="py-3 px-4 text-left font-medium">Date</th>
            </tr>
          </thead>
          <tbody className="">
            {items.map((e, index) =>
              e.createdAt ? (
                <tr
                  key={`${e.type}-${e.id}`}
                  className="  transition-all ease-in-out duration-500 hover:bg-gray-100"
                >
                  <td className="py-3 px-4 font-medium text-black">
                    {e.username || "Anonymous"}
                  </td>
                  <td className="py-3 px-4">
                    {e.badgeType ? (
                      <Badge className="bg-blue-600 text-black text-xs border-none">
                        {e.badgeType}
                      </Badge>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="py-3 px-4 text-gray-400 whitespace-nowrap">
                    {formatDateOnly(e.createdAt)}
                  </td>
                </tr>
              ) : (
                <tr key={`placeholder-${index}`} className="opacity-40">
                  <td
                    colSpan={3}
                    className="py-6 px-4 text-center text-gray-500"
                  >
                    —
                  </td>
                </tr>
              )
            )}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <Card className="rounded-2xl bg-white  border-0 shadow-md shadow-[0_0_10px_rgba(0,0,0,0.15)]">
      <CardHeader className="flex pb-3 border-0">
        <h2 className="text-lg font-semibold text-black tracking-wide">
          Latest Activity
        </h2>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="predictions" className="w-full">
          <TabsList className=" mt-2 grid grid-cols-2 mb-4 bg-tranperent rounded-xl gap-3 p-1 text-sm">
            <TabsTrigger
              value="predictions"
              className="data-[state=active]:bg-[#2563EB] data-[state=active]:text-white data-[state=active]:border-[#2563EB] p-3 text-black border border-gray-300"
            >
              Predictions
            </TabsTrigger>
            <TabsTrigger
              value="achievements"
              className="data-[state=active]:bg-[#2563EB] data-[state=active]:text-white data-[state=active]:border-[#2563EB]  p-3 text-black border border-gray-300"
            >
              Achievements
            </TabsTrigger>
          </TabsList>

          <TabsContent value="predictions">
            {renderPredictionTable(paddedPredictions)}
          </TabsContent>
          <TabsContent value="achievements">
            {renderAchievementsTable(paddedBadges)}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
