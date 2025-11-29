import React, { useEffect, useMemo, useState } from "react";
import { buildApiUrl } from "@/lib/api-config";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TrendingUp, TrendingDown } from "lucide-react";
import { ResponsiveContainer, AreaChart, Area, XAxis, Tooltip } from "recharts";
import { useLanguage } from "@/hooks/use-language";

import { API_ENDPOINTS } from "@/lib/api-config";
type DurationKey = "short" | "medium" | "long";

interface GlobalSentimentSlot {
  slotNumber: number;
  slotLabel?: string;
  up: number;
  down: number;
  total: number;
  slotStart?: string | Date;
  slotEnd?: string | Date;
}

interface GlobalSentimentResponse {
  duration: DurationKey;
  slots: GlobalSentimentSlot[];
  summary: {
    totalPredictions: number;
    totalUp: number;
    totalDown: number;
    upPercentage: number;
    downPercentage: number;
    overallSentiment: "bullish" | "bearish" | "neutral";
  };
  timestamp: string;
}

function formatTimeLabel(iso: string | Date | undefined): string {
  if (!iso) return "";
  const d = typeof iso === "string" ? new Date(iso) : iso;
  return d.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function GlobalSentimentCard(): JSX.Element {
  const { t } = useLanguage();
  const [duration, setDuration] = useState<DurationKey>("short");
  const [period, setPeriod] = useState<"1w" | "1m" | "3m">("1w");
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<GlobalSentimentResponse | null>(null);
  const [topUp, setTopUp] = useState<
    Array<{
      symbol: string;
      name: string;
      up: number;
      down: number;
      total: number;
      share: number;
    }>
  >([]);
  const [topDown, setTopDown] = useState<
    Array<{
      symbol: string;
      name: string;
      up: number;
      down: number;
      total: number;
      share: number;
    }>
  >([]);

  const buildNeutralFallback = (d: DurationKey): GlobalSentimentResponse => {
    // For simplified slot system, we only have one slot per duration
    const slots: GlobalSentimentSlot[] = [
      {
        slotNumber: 1,
        slotLabel: "Current Period",
        up: 0,
        down: 0,
        total: 0,
      },
    ];
    return {
      duration: d,
      slots,
      summary: {
        totalPredictions: 0,
        totalUp: 0,
        totalDown: 0,
        upPercentage: 0,
        downPercentage: 0,
        overallSentiment: "neutral",
      },
      timestamp: new Date().toISOString(),
    };
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      // Use query param variant to avoid path conflicts and ensure proxying
      const res = await fetch(
        buildApiUrl(
          `/api/sentiment/global?duration=${encodeURIComponent(duration)}`
        )
      );
      if (!res.ok) {
        // Graceful client-side fallback to neutral data instead of showing error
        const fallback = buildNeutralFallback(duration);
        setData(fallback);
        setError(null);
        return;
      }
      try {
        const json: GlobalSentimentResponse = await res.json();
        setData(json);
      } catch {
        // If parsing fails, still show neutral fallback
        const fallback = buildNeutralFallback(duration);
        setData(fallback);
        setError(null);
      }
    } catch (e: any) {
      // Network failure: show neutral fallback quietly
      const fallback = buildNeutralFallback(duration);
      setData(fallback);
      setError(null);
    } finally {
      setLoading(false);
    }
  };

  const fetchTopAssets = async () => {
    try {
      const res = await fetch(
        buildApiUrl(
          `/api/sentiment/global/top-assets?period=${encodeURIComponent(
            period
          )}`
        )
      );
      if (!res.ok) return;
      const json = await res.json();
      setTopUp(json.topUp || []);
      setTopDown(json.topDown || []);
    } catch {}
  };

  // Sync period with duration on mount
  useEffect(() => {
    if (duration === "short") setPeriod("1w");
    else if (duration === "medium") setPeriod("1m");
    else if (duration === "long") setPeriod("3m");
  }, [duration]);

  useEffect(() => {
    fetchData();
    fetchTopAssets();
  }, [duration, period]);

  // Refresh hourly
  useEffect(() => {
    const id = setInterval(() => {
      fetchData();
      fetchTopAssets();
    }, 60 * 60 * 1000);
    return () => clearInterval(id);
  }, [duration, period]);

  const upPercentage = data?.summary.upPercentage ?? 0;
  const downPercentage = data?.summary.downPercentage ?? 0;
  // Net balance: right (Up) positive, left (Down) negative. Range -100..+100
  const balancePct = Math.max(
    -100,
    Math.min(100, Math.round(upPercentage - downPercentage))
  );

  const needleAngleDeg = useMemo(() => {
    // Map balance -100..+100 => -90..+90
    return (balancePct / 100) * 90;
  }, [balancePct]);

  const sentimentLabel = useMemo(() => {
    if (!data) return "Neutral";
    if (data.summary.overallSentiment === "bullish") return "Up";
    if (data.summary.overallSentiment === "bearish") return "Down";
    return "Neutral";
  }, [data]);

  const timelineData = useMemo(() => {
    if (!data)
      return [] as Array<{ name: string; upPct: number; downPct: number }>;
    return data.slots
      .sort((a, b) => a.slotNumber - b.slotNumber)
      .map((s) => {
        const total = Math.max(s.total, 0);
        const upPct = total > 0 ? Math.round((s.up / total) * 100) : 0;
        const downPct = total > 0 ? Math.round((s.down / total) * 100) : 0;
        const label = s.slotStart
          ? formatTimeLabel(s.slotStart)
          : `Slot ${s.slotNumber}`;
        return { name: label, upPct, downPct };
      });
  }, [data]);

  return (
    // bg-[#1E1F25] bg-gradient-to-r from-green-300 to-gray-200
    <Card className="rounded-3xl bg-white   border-0 h-full shadow-[0_0_10px_rgba(0,0,0,0.15)]" >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-black mb-2">
              {t("global.title")}
            </CardTitle>
            <CardDescription className="text-black text-sm">
              {t("global.description")}
            </CardDescription>
            <div className="text-xs text-black mt-1">
              {t("global.period_rules")}
            </div>
          </div>
          <div className="flex-col items-center space-y-2">
            <span className="text-sm text-black">{t("global.period")}</span>
            <Select
              value={duration}
              onValueChange={(v) => {
                setDuration(v as DurationKey);
                // Update period to match duration
                if (v === "short") setPeriod("1w");
                else if (v === "medium") setPeriod("1m");
                else if (v === "long") setPeriod("3m");
              }}
            >
              <SelectTrigger className="w-28 h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="short">{t("global.short")}</SelectItem>
                <SelectItem value="medium">{t("global.medium")}</SelectItem>
                <SelectItem value="long">{t("global.long")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      {/*  max-h-[320px] */}
      <CardContent className=" overflow-y-auto custom-scrollbar no-scrollbar  px-6">
        {loading ? (
          <div className="flex flex-col items-center">
            <Skeleton className="w-[260px] h-[130px] rounded-t-full" />
            <Skeleton className="w-40 h-6 mt-4" />
            <Skeleton className="w-full h-[120px] mt-6" />
          </div>
        ) : error ? (
          <div className="text-center text-red-600">{error}</div>
        ) : (
          <div className="space-y-6">
            {/* Row 1: Gauge only */}
            <div className="flex flex-col items-center justify-start">
              <div className="relative w-[300px] h-[160px]">
                {/* Arc background */}
                <div className="absolute inset-0 flex items-end justify-center overflow-hidden">
                  <div
                    className="w-[280px] h-[140px] rounded-t-[9999px]"
                    style={{
                      background:
                        "linear-gradient(90deg, rgba(239,68,68,1) 0%, rgba(234,179,8,1) 50%, rgba(34,197,94,1) 100%)",
                      boxShadow: "inset 0 -8px 16px rgba(0,0,0,0.15)",
                    }}
                  />
                </div>
                {/* Inner mask to create ring */}
                <div className="absolute left-1/2 -translate-x-1/2 bottom-0 w-[220px] h-[110px] bg-gray-700 rounded-t-[9999px]" />
                {/* Needle */}
                <div className="absolute left-1/2 bottom-[6px] h-[8px] w-[8px] -translate-x-1/2">
                  <div
                    className="origin-bottom left-1/2 -translate-x-1/2 absolute bottom-0 w-[2px] h-[110px] bg-gradient-to-b from-zinc-300 to-zinc-500"
                    style={{ transform: `rotate(${needleAngleDeg}deg)` }}
                  />
                  <div className="absolute -left-3 -bottom-3 w-6 h-6 rounded-full bg-zinc-200 border border-zinc-400" />
                </div>
                {/* Center labels */}
                <div className="absolute left-1/2 -translate-x-1/2 bottom-6 text-center">
                  <div
                    className={`text-3xl font-bold ${
                      balancePct > 0
                        ? "text-green-600"
                        : balancePct < 0
                        ? "text-red-600"
                        : ""
                    }`}
                  >
                    {balancePct > 0 ? `+${balancePct}` : balancePct}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {t("global.now")}: {sentimentLabel}
                  </div>
                </div>
                {/* Left label - Down */}
                <div className="absolute -left-16 bottom-0 text-red-500 text-xs flex items-center gap-1">
                  <TrendingDown className="h-4 w-4" />
                  <span>{t("global.down")}</span>
                </div>
                {/* Right label - Up */}
                <div className="absolute -right-12 bottom-0 text-green-600 text-xs flex items-center gap-1">
                  <TrendingUp className="h-4 w-4" />
                  <span>{t("global.up")}</span>
                </div>
              </div>
            </div>
            {/* Visual separator between gauge and lists */}
            {/* border-border/60 */}
            <div className="mt-8 mb-2 border-t border-black " />
            {/* Row 2: Two columns — Left: Top Down, Right: Top Up */}
            <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-2">
              {/* Left: Top Down */}
              <div className="space-y-4  bg-white rounded-[10px] px-3 py-5 shadow-[0_0_10px_rgba(0,0,0,0.15)]">
                <div>
                  <div className="text-xs font-semibold mb-2 text-black">
                    {t("global.top_down", { count: topDown.length })}
                  </div>
                  <div className="rounded-lg overflow-hidden  border-0 ">
                    <table className="w-full text-sm">
                      <thead className="border-b border-gray-500">
                        <tr className="text-black  text-xs font-medium">
                          <th className="text-left p-3 text-black">
                            {t("global.asset")}
                          </th>
                          <th className="text-center p-3 text-black">
                            {t("global.votes")}
                          </th>
                          <th className="text-center p-3 text-black">
                            {t("global.share")}
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {topDown.length === 0 ? (
                          <tr className="text-black  text-xs font-medium">
                            <td
                              colSpan={3}
                              className="text-center p-4 text-black-300"
                            >
                              {t("global.no_data")}
                            </td>
                          </tr>
                        ) : (
                          topDown.map((a, idx) => (
                            <tr
                              key={`down-${a.symbol}-${idx}`}
                              className="text-black  text-xs font-medium"
                            >
                              <td className="p-2">
                                <div className="font-medium text-black">
                                  {a.symbol}
                                </div>
                                <div
                                  className="text-xs text-muted-foreground truncate max-w-24"
                                  title={a.name}
                                >
                                  {a.name}
                                </div>
                              </td>
                              <td className="p-2 text-center">{a.down}</td>
                              <td className="p-2">
                                <div className="flex items-center gap-2">
                                  <div className="flex-1 h-2 bg-muted rounded">
                                    <div
                                      className="h-2 bg-red-500 rounded"
                                      style={{
                                        width: `${Math.min(
                                          100,
                                          Math.round(
                                            (a.down / Math.max(1, a.total)) *
                                              100
                                          )
                                        )}%`,
                                      }}
                                    />
                                  </div>
                                  <span className="text-xs w-8 text-right">
                                    {Math.round(
                                      (a.down / Math.max(1, a.total)) * 100
                                    )}
                                    %
                                  </span>
                                </div>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
              {/* Right: Top Up */}
              <div className="space-y-4  bg-white rounded-[10px] px-3 py-5 shadow-[0_0_10px_rgba(0,0,0,0.15)]">
                <div>
                  <div className="text-xs font-semibold mb-2 text-black">
                    {t("global.top_up", { count: topUp.length })}
                  </div>
                  <div className="rounded-lg overflow-hidden border-0">
                    <table className="w-full text-sm">
                      <thead className="border-b border-gray-500">
                        <tr className="text-black  text-xs font-medium">
                          <th className="text-left p-2">{t("global.asset")}</th>
                          <th className="text-center p-3">
                            {t("global.votes")}
                          </th>
                          <th className="text-center p-3">
                            {t("global.share")}
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {topUp.length === 0 ? (
                          <tr className="text-black  text-xs font-medium">
                            <td
                              colSpan={3}
                              className="text-center p-4 text-black-300"
                            >
                              {t("global.no_data")}
                            </td>
                          </tr>
                        ) : (
                          topUp.map((a, idx) => (
                            <tr
                              key={`up-${a.symbol}-${idx}`}
                              className="text-black bg-white text-xs font-medium"
                            >
                              <td className="p-2">
                                <div className="font-medium">{a.symbol}</div>
                                <div
                                  className="text-xs text-muted-foreground truncate max-w-24"
                                  title={a.name}
                                >
                                  {a.name}
                                </div>
                              </td>
                              <td className="p-2 text-center">{a.up}</td>
                              <td className="p-2">
                                <div className="flex items-center gap-2">
                                  <div className="flex-1 h-2 bg-muted rounded">
                                    <div
                                      className="h-2 bg-green-500 rounded"
                                      style={{
                                        width: `${Math.min(
                                          100,
                                          Math.round(
                                            (a.up / Math.max(1, a.total)) * 100
                                          )
                                        )}%`,
                                      }}
                                    />
                                  </div>
                                  <span className="text-xs w-8 text-right">
                                    {Math.round(
                                      (a.up / Math.max(1, a.total)) * 100
                                    )}
                                    %
                                  </span>
                                </div>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
