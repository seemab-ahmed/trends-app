import React from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from "recharts";

interface Props {
  t: any;
  displayData: any;
  assetSymbol: string;
}

export default function AnalystConsensusPanel({
  t,
  displayData,
  assetSymbol,
}: Props) {
  const pieData = [
    { name: "Up", value: displayData.buy || 0, color: "#22c55e" },
    { name: "Down", value: displayData.sell || 0, color: "#ef4444" },
  ];

  const getRecommendationColor = (r: string) => {
    if (!r) return "text-yellow-500";
    const v = r.toLowerCase();
    if (v.includes("buy") || v.includes("up")) return "text-green-500";
    if (v.includes("sell") || v.includes("down")) return "text-red-500";
    return "text-yellow-500";
  };

  const hasNoAnalystData =
    (displayData.analystCount || 0) === 0 ||
    ((displayData.buy || 0) === 0 && (displayData.sell || 0) === 0);
  const isTie =
    !hasNoAnalystData && (displayData.buy || 0) === (displayData.sell || 0);

  const normalized = (displayData.recommendation || "").toLowerCase();
  let baseRecommendation: "Buy" | "Sell" | "Neutral" | "" = "";
  if (normalized.includes("buy")) baseRecommendation = "Buy";
  else if (normalized.includes("sell")) baseRecommendation = "Sell";
  else if (normalized.includes("hold")) baseRecommendation = "Neutral";

  // Map to display terms
  const recommendationDisplay =
    hasNoAnalystData || isTie
      ? "Neutral"
      : baseRecommendation === "Buy"
      ? "Up"
      : baseRecommendation === "Sell"
      ? "Down"
      : "Neutral";

  // --- Calculate percentage values for Buy/Sell/Consensus ---
  const totalVotes = (displayData.buy || 0) + (displayData.sell || 0);

  const buyPct =
    totalVotes > 0 ? ((displayData.buy || 0) / totalVotes) * 100 : 0;
  const sellPct =
    totalVotes > 0 ? ((displayData.sell || 0) / totalVotes) * 100 : 0;

  let consensusPct = 0;
  if (totalVotes > 0) {
    if (recommendationDisplay === "Up") consensusPct = Math.round(buyPct);
    else if (recommendationDisplay === "Down")
      consensusPct = Math.round(sellPct);
    else consensusPct = 50;
  }

  return (
    <Card className="bg-white border-0 rounded-3xl text-white font-poppins">
      {/* Header */}
      <CardHeader className="pb-4">
        <CardTitle className="text-lg font-semibold text-black">
          Analyst Consensus
        </CardTitle>
      </CardHeader>

      {/* Content */}
      <CardContent className="flex flex-col sm:flex-row items-center justify-center sm:justify-start gap-6 sm:gap-10 px-4 sm:px-8 pb-6">
        {/* Pie Chart */}
        <div className="relative w-40 h-40 sm:w-48 sm:h-48 flex-shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={80}
                paddingAngle={2}
                dataKey="value"
                startAngle={90}
                endAngle={450}
                stroke="none"
              >
                {pieData.map((entry, index) => (
                  <Cell key={index} fill={entry.color} stroke="none" />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  backgroundColor: "#2C2F36",
                  border: "none",
                  borderRadius: "8px",
                  color: "#fff",
                }}
                formatter={(value: any, name: string) => [
                  `${value} votes`,
                  name,
                ]}
              />
            </PieChart>
          </ResponsiveContainer>

          {/* Center Label */}
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
            <span
              className={`text-xl sm:text-2xl font-bold ${getRecommendationColor(
                recommendationDisplay
              )}`}
            >
              {recommendationDisplay}
            </span>
            <span className="text-xs sm:text-sm text-gray-400">
              {consensusPct}%
            </span>
          </div>
        </div>

        {/* Summary Section */}
        <div className="flex flex-col items-center sm:items-start justify-center space-y-3 sm:space-y-4">
          <div className="flex items-center justify-between w-40 sm:w-44">
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 rounded-full bg-green-500"></div>
              <span className="text-base sm:text-lg font-semibold text-green-500">
                Up
              </span>
            </div>
            <span className="text-base sm:text-lg text-green-500 font-medium">
              {Math.round(buyPct)}%
            </span>
          </div>

          <div className="flex items-center justify-between w-40 sm:w-44">
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 rounded-full bg-red-500"></div>
              <span className="text-base sm:text-lg font-semibold text-red-500">
                Down
              </span>
            </div>
            <span className="text-base sm:text-lg text-red-500 font-medium">
              {Math.round(sellPct)}%
            </span>
          </div>

          <div
            className={`text-base sm:text-lg font-bold mt-2 sm:mt-3 ${
              recommendationDisplay === "Up"
                ? "text-green-500"
                : recommendationDisplay === "Down"
                ? "text-red-500"
                : "text-yellow-500"
            }`}
          ></div>
        </div>
      </CardContent>
    </Card>
  );
}
