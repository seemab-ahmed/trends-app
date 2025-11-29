import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "@tanstack/react-query";
import { Redirect, useLocation } from "wouter";
import { ArrowLeft } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { MonthCountdown } from "@/components/month-countdown";
import { API_ENDPOINTS, buildApiUrl } from "@/lib/api-config";
import MonthSelector from "@/components/MonthSelector";
import CurrentMonthCard from "@/components/CurrentMonthCard";
import PreviousMonthCard from "@/components/PreviousMonthCard";
import CurrentMonthLeaderboard from "@/components/CurrentMonthLeaderboard";

export default function LeaderboardPage() {
  const { user } = useAuth();
  const [_, setLocation] = useLocation();
  const [selectedMonth, setSelectedMonth] = useState<string>(
    new Date().toISOString().slice(0, 7)
  );
  const [includeAdmins, setIncludeAdmins] = useState<boolean>(true);

  useEffect(() => {
    if (user) setIncludeAdmins(true);
  }, [user]);
  const handleBack = () => {
    setLocation("/");
  };
  const getAvailableMonths = () => {
    const months = [];
    const now = new Date();
    for (let i = 0; i < 12; i++) {
      const year = now.getFullYear();
      const month = now.getMonth() - i;
      const actualYear = month < 0 ? year - 1 : year;
      const actualMonth = month < 0 ? month + 12 : month;
      const monthYear = `${actualYear}-${String(actualMonth + 1).padStart(
        2,
        "0"
      )}`;
      const label = new Date(actualYear, actualMonth, 1).toLocaleDateString(
        "en-US",
        {
          month: "long",
          year: "numeric",
        }
      );
      months.push({ value: monthYear, label });
    }
    return months;
  };

  const currentMonth = new Date().toISOString().slice(0, 7);

  const { data: leaderboardData, isLoading } = useQuery({
    queryKey: ["/api/leaderboard", selectedMonth, includeAdmins],
    queryFn: async () => {
      let endpoint = "/api/leaderboard";
      let params = `includeAdmins=${includeAdmins}`;
      const currentMonth = new Date().toISOString().slice(0, 7);
      if (selectedMonth === "current" || selectedMonth === currentMonth)
        endpoint = "/api/leaderboard/current";
      else if (selectedMonth === "previous")
        params = `month=previous&${params}`;
      else params = `month=${selectedMonth}&${params}`;
      const response = await fetch(buildApiUrl(`${endpoint}?${params}`));
      if (!response.ok) throw new Error("Failed to fetch leaderboard data");
      return response.json();
    },
  });

  const { data: leaderboardStats } = useQuery({
    queryKey: ["/api/leaderboard/stats"],
  });

  if (!user) return <Redirect to="/auth" />;

  const getRankBadge = (rank: number) => {
    const icons = ["🥇", "🥈", "🥉", "🎖️"];
    const colors = [
      "text-yellow-500",
      "text-gray-400",
      "text-amber-600",
      "text-blue-500",
    ];
    if (rank >= 1 && rank <= 4)
      return (
        <div className="flex items-center">
          <span className="text-2xl mr-2">{icons[rank - 1]}</span>
          <span className={`font-bold ${colors[rank - 1]}`}>#{rank}</span>
        </div>
      );
    return <span className="text-sm font-medium">#{rank}</span>;
  };

  const getMonthLabel = (monthYear: string) => {
    const [year, month] = monthYear.split("-");
    return new Date(parseInt(year), parseInt(month) - 1).toLocaleDateString(
      "en-US",
      {
        month: "long",
        year: "numeric",
      }
    );
  };

  const formatTimestamp = (timestamp: string, timezone: string) => {
    try {
      const date = new Date(timestamp);
      return date.toLocaleString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        timeZoneName: "short",
      });
    } catch {
      return "Invalid date";
    }
  };

  return (
    <div className="min-h-screen bg-[#f5f5f5] text-black font-poppins">
      <div className="container mx-auto px-4 py-0 space-y-6">
        <section className="flex items-center gap-3 mb-4 sm:hidden">
          <button
            onClick={handleBack}
            className="flex items-center justify-center w-9 h-9 rounded-full bg-[#1E1F25] hover:bg-[#23272b] transition"
          >
            <ArrowLeft className="h-5 w-5 text-white" />
          </button>
          <h1 className="text-2xl font text-white">Leaderboard</h1>
        </section>
        {/* Admin toggle section */}
        {user?.role === "admin" && (
          <div className="flex items-center justify-center gap-3 bg-[#1E1F25] p-4 rounded-xl border border-[#2C2F36]">
            <Switch
              id="include-admins"
              checked={includeAdmins}
              onCheckedChange={setIncludeAdmins}
            />
            <Label htmlFor="include-admins" className="text-sm">
              {includeAdmins ? "Include Admins" : "Exclude Admins"}
            </Label>
            <Badge variant="outline" className="ml-2">
              {includeAdmins ? "All Users" : "Regular Users Only"}
            </Badge>
          </div>
        )}

        {/* Top Row: Progress + Month Selector */}
        <div className="grid grid-cols-1 lg:grid-cols-8 gap-4 items-stretch">
          {/* Left: Current Month Progress */}
          <div className="h-full flex col-span-3">
            <div className="w-full h-full flex flex-col">
              <MonthCountdown />
            </div>
          </div>

          {/* Right: Month Selector */}
          <div className="h-full flex col-span-5">
            <div className="w-full h-full flex flex-col">
              <MonthSelector
                selectedMonth={selectedMonth}
                setSelectedMonth={setSelectedMonth}
                getAvailableMonths={getAvailableMonths}
              />
            </div>
          </div>
        </div>

        {/* Middle Row: Participants Cards */}
        {leaderboardStats && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <CurrentMonthCard
              participants={leaderboardStats.currentMonth?.participants || 0}
              monthYear={
                leaderboardStats.currentMonth?.monthYear || "Current Month"
              }
            />
            <PreviousMonthCard
              participants={leaderboardStats.previousMonth?.participants || 0}
              monthYear={
                leaderboardStats.previousMonth?.monthYear || "Previous Month"
              }
            />
          </div>
        )}

        {/* Leaderboard Table */}
        <CurrentMonthLeaderboard
          isLoading={isLoading}
          leaderboardData={leaderboardData}
          selectedMonth={selectedMonth}
          currentMonth={currentMonth}
          getRankBadge={getRankBadge}
          getMonthLabel={getMonthLabel}
          formatTimestamp={formatTimestamp}
          setSelectedMonth={setSelectedMonth}
        />
      </div>
    </div>
  );
}
