import React, { useState, useEffect } from "react";
import { Card, CardContent } from "./ui/card";
import { Clock } from "lucide-react";
import { API_ENDPOINTS } from "@/lib/api-config";

interface CountdownData {
  isExpired: boolean;
  message: string;
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  endDate: string;
}

export function MonthCountdown() {
  const [countdown, setCountdown] = useState<CountdownData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCountdown = async () => {
    try {
      const response = await fetch(API_ENDPOINTS.LEADERBOARD_COUNTDOWN());
      if (!response.ok) {
        throw new Error(
          `Failed to fetch countdown: ${response.status} ${response.statusText}`
        );
      }

      const text = await response.text();
      if (!text) {
        throw new Error("Empty response from server");
      }

      let data: CountdownData;
      try {
        data = JSON.parse(text);
      } catch (parseError) {
        console.error("Failed to parse JSON response:", text);
        throw new Error(
          `Invalid JSON response: ${
            parseError instanceof Error
              ? parseError.message
              : "Unknown parse error"
          }`
        );
      }

      if (!data || typeof data !== "object") {
        throw new Error("Invalid response format: expected object");
      }

      if (
        typeof data.isExpired !== "boolean" ||
        typeof data.message !== "string"
      ) {
        throw new Error("Invalid response format: missing required fields");
      }

      setCountdown(data);
    } catch (err) {
      console.error("Error fetching countdown:", err);
      setError(err instanceof Error ? err.message : "Failed to load countdown");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCountdown();
    const interval = setInterval(fetchCountdown, 30000);
    return () => clearInterval(interval);
  }, []);

  const formatTimeRemaining = (data: CountdownData) => {
    if (data.isExpired) {
      return "Month has ended";
    }

    const { days, hours, minutes, seconds } = data;

    if (days > 0) {
      return `${days}d ${hours.toString().padStart(2, "0")}:${minutes
        .toString()
        .padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
    } else if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, "0")}:${seconds
        .toString()
        .padStart(2, "0")}`;
    } else {
      return `${minutes}:${seconds.toString().padStart(2, "0")}`;
    }
  };

  // Shared card styling
  const cardClass =
    "rounded-3xl bg-white pt-4  border-0 shadow-[0_0_10px_rgba(0,0,0,0.15)] text-gray-100 font-poppins h-full flex flex-col justify-between";

  if (loading) {
    return (
      <Card className={cardClass}>
        <CardContent className="flex flex-col">
          <div className="flex items-center gap-3 mb-2">
            <div className="bg-blue-600/10 p-3 rounded-full">
              <Clock className="h-5 w-5 text-black animate-spin" />
            </div>
            <h3 className="text-sm font-medium text-black">
              Current Month Progress
            </h3>
          </div>
          <span className="text-sm text-balck">Loading...</span>
        </CardContent>
      </Card>
    );
  }

  if (error || !countdown) {
    return (
      <Card className={cardClass}>
        <CardContent className="flex flex-col">
          <div className="flex items-center gap-3 mb-2">
            <div className="bg-blue-600/10 p-3 rounded-full">
              <Clock className="h-5 w-5 text-blue-500" />
            </div>
            <h3 className="text-sm font-medium text-black">
              Current Month Progress
            </h3>
          </div>
          <span className="text-sm text-red-500">
            {error || "Countdown unavailable"}
          </span>
        </CardContent>
      </Card>
    );
  }

  if (countdown.isExpired) {
    return (
      <Card className={cardClass}>
        <CardContent className="flex flex-col">
          <div className="flex items-center gap-3 mb-2">
            <div className="bg-blue-600/10 p-3 rounded-full">
              <Clock className="h-5 w-5 text-blue-500" />
            </div>
            <h3 className="text-sm font-medium text-black">
              Current Month Progress
            </h3>
          </div>
          <span className="text-sm text-orange-500">{countdown.message}</span>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cardClass}>
      <CardContent>
        {/* Header with icon and title */}
        <div className="flex items-center gap-3 mb-2">
          <div className="bg-blue-600/10 p-3 rounded-full">
            <Clock className="h-5 w-5 text-blue-500" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-black font-poppins">
              Current Month Progress
            </h3>
            <p className="text-[13px] font-mono text-black mt-1">
              {formatTimeRemaining(countdown)}
            </p>
          </div>
        </div>

        {/* End date */}
        <div className="mt-3 text-[12px] text-black border-gray-300 p-2 font-poppins rounded-full bg-gray-300 text-center py-4">
          Ends:{" "}
          {new Date(countdown.endDate).toLocaleDateString("en-US", {
            timeZone: "Europe/Rome",
            year: "numeric",
            month: "long",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
            timeZoneName: "short",
          })}
        </div>
      </CardContent>
    </Card>
  );
}
