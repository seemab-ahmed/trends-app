import React from "react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TrendingUp, Crown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";

interface Props {
  isLoading: boolean;
  leaderboardData: any;
  selectedMonth: string;
  currentMonth: string;
  getRankBadge: (rank: number) => React.ReactNode;
  getMonthLabel: (monthYear: string) => string;
  formatTimestamp: (timestamp: string, timezone: string) => string;
  setSelectedMonth: (value: string) => void;
}

export default function CurrentMonthLeaderboard({
  isLoading,
  leaderboardData,
  selectedMonth,
  currentMonth,
  getRankBadge,
  getMonthLabel,
  formatTimestamp,
  setSelectedMonth,
}: Props) {
  const hasData = leaderboardData?.data && leaderboardData.data.length > 0;

  return (
    <Card className="bg-[#1E1F25] border border-[#2C2F36] text-gray-100 font-poppins">
      <CardHeader>
        {/* Title */}
        <CardTitle className="flex items-center gap-2 text-white">
          {selectedMonth === currentMonth && (
            <TrendingUp className="h-5 w-5 text-blue-500" />
          )}
          {selectedMonth === "previous"
            ? "Previous Month"
            : selectedMonth === "current"
            ? "Current Month"
            : getMonthLabel(selectedMonth)}{" "}
          Leaderboard
        </CardTitle>

        {/* Timezone and Timestamp */}
        {leaderboardData && (
          <div className="mt-1 text-xs text-gray-500">
            <span>Timezone: {leaderboardData.timezone || "Europe/Berlin"}</span>
            {leaderboardData.timestamp && (
              <span className="ml-3">
                Updated:{" "}
                {formatTimestamp(
                  leaderboardData.timestamp,
                  leaderboardData.timezone
                )}
              </span>
            )}
          </div>
        )}

        {/* Description */}
        <CardDescription className="text-sm text-gray-400 mt-2">
          {leaderboardData && selectedMonth === currentMonth && <span></span>}
        </CardDescription>
      </CardHeader>

      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            {[...Array(10)].map((_, i) => (
              <div key={i} className="flex items-center space-x-4">
                <Skeleton className="h-4 w-8" />
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-4 w-20" />
              </div>
            ))}
          </div>
        ) : hasData ? (
          <Table className="border-collapse w-full">
            <TableHeader>
              <TableRow className="text-gray-100 border-b border-[#2C2F36] ">
                <TableHead>Rank</TableHead>
                <TableHead>User</TableHead>
                <TableHead>Score</TableHead>
                <TableHead>Predictions</TableHead>
                <TableHead>Accuracy</TableHead>
                <TableHead>Badges</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {leaderboardData.data.map((entry: any) => (
                <TableRow
                  key={entry.userId}
                  className="transition-colors border-b border-[#2C2F36] hover:bg-[#272A31]/70"
                >
                  <TableCell>{getRankBadge(entry.rank)}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/user/${entry.username}`}
                        className="font-medium text-blue-400 hover:underline"
                      >
                        {entry.username}
                      </Link>
                      {entry.isAdmin && (
                        <Badge
                          variant="secondary"
                          className="flex items-center gap-1 text-xs bg-[#33383F] text-gray-300"
                        >
                          <Crown className="h-3 w-3" /> Admin
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="font-mono">
                    {entry.totalScore}
                  </TableCell>
                  <TableCell>{entry.totalPredictions}</TableCell>
                  <TableCell>
                    {entry.accuracyPercentage
                      ? parseFloat(entry.accuracyPercentage.toString()).toFixed(
                          1
                        )
                      : "0.0"}
                    %
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1 flex-wrap">
                      {entry.badges && entry.badges.length > 0 ? (
                        entry.badges.map((badge: string, index: number) => (
                          <Badge
                            key={index}
                            variant="outline"
                            className="text-xs flex items-center gap-1 border-[#3A3D44] text-gray-300"
                          >
                            {badge === "1st_place" && "🥇"}
                            {badge === "2nd_place" && "🥈"}
                            {badge === "3rd_place" && "🥉"}
                            {badge === "4th_place" && "🎖️"}
                            {badge === "starter" && "⭐"}
                            {badge.startsWith("streak") && "🔥"}
                            {badge.startsWith("accuracy") && "🎯"}
                            {badge.startsWith("volume") && "📊"}
                            {badge}
                          </Badge>
                        ))
                      ) : (
                        <span className="text-gray-500">No badges</span>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <div className="text-center py-8 text-gray-400">
            <strong>No leaderboard data for this month</strong>
            <div className="mt-3 text-sm">
              <p>This could be because:</p>
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>No predictions this month</li>
                <li>The month hasn’t ended yet</li>
                <li>Future month selected</li>
              </ul>
            </div>
            <div className="mt-4 flex gap-2 justify-center">
              <Button
                variant="outline"
                onClick={() => setSelectedMonth("previous")}
                className="bg-[#2B2E34] border-none text-white hover:bg-[#35383F]"
              >
                View Previous
              </Button>
              <Button
                variant="outline"
                onClick={() => setSelectedMonth("current")}
                className="bg-[#2B2E34] border-none text-white hover:bg-[#35383F]"
              >
                View Current
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
