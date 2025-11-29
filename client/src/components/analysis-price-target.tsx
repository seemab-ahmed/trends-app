import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";

interface Props {
  t: any;
  displayData: any;
  assetSymbol: string;
  livePriceData?: { price?: number; change24h?: number }; // ✅ added type for live price
}

export default function PriceTargetPanel({
  t,
  displayData,
  assetSymbol,
  livePriceData,
}: Props) {
  const priceHistory = displayData.priceHistory || [];
  const lastHistoricalData =
    priceHistory.length > 0 ? priceHistory[priceHistory.length - 1] : null;
  const prevHistoricalData =
    priceHistory.length > 1 ? priceHistory[priceHistory.length - 2] : null;

  // ✅ Prefer live price from API, fallback to historical/average
  const headlinePrice =
    livePriceData?.price ??
    (lastHistoricalData
      ? lastHistoricalData.price
      : displayData.averagePrice) ??
    0;

  const headlineChangePct =
    livePriceData?.change24h ??
    (prevHistoricalData
      ? ((headlinePrice - prevHistoricalData.price) /
          (prevHistoricalData.price || 1)) *
        100
      : 0);

  // Combine history + projections
  const combinedChartData = [
    ...(displayData.priceHistory || []),
    ...(displayData.priceProjections || []),
  ];

  return (
    <Card className="bg-[#1E1F25] border-none rounded-2xl text-white font-poppins">
      <CardContent>
        {/* --- Price Section --- */}
        <div className="mb-6">
          <div className="text-3xl font-bold text-white">
            $
            {headlinePrice.toLocaleString(undefined, {
              maximumFractionDigits: 5,
            })}
          </div>
          <div
            className={`text-sm mt-1 ${
              headlineChangePct >= 0 ? "text-green-500" : "text-red-500"
            }`}
          >
            {headlineChangePct >= 0 ? "+" : ""}
            {Math.abs(headlineChangePct).toFixed(2)}%
          </div>
        </div>

        {/* --- Chart --- */}
        <div className="h-56 bg-[#1E1F25] rounded-lg">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={combinedChartData}
              margin={{ top: 10, right: 20, left: 0, bottom: 10 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                vertical={false}
                stroke="#2C2F36"
              />
              <XAxis
                dataKey="date"
                type="category"
                interval="preserveStartEnd"
                tickFormatter={(date) =>
                  new Date(date).toLocaleDateString("en-GB", { month: "short" })
                }
                tick={{ fill: "#6b7280", fontSize: 10 }}
                tickLine={false}
                axisLine={false}
                minTickGap={25}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                width={45}
                domain={["auto", "auto"]}
                tick={{ fill: "#6b7280", fontSize: 10 }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#2C2F36",
                  border: "none",
                  borderRadius: "8px",
                  color: "#fff",
                }}
                labelFormatter={(date) =>
                  new Date(date).toLocaleDateString("en-GB", {
                    day: "numeric",
                    month: "short",
                  })
                }
                formatter={(value: number) => [`$${value}`, "Price"]}
              />
              <Line
                type="monotone"
                dataKey="price"
                stroke="#3b82f6"
                strokeWidth={2}
                dot={false}
                isAnimationActive={true}
                animationDuration={1200}
                animationBegin={100}
                activeDot={{ r: 3 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* --- Forecast Section --- */}
        <div className="mt-6 grid grid-cols-2 gap-6">
          {/* Downward Forecast */}
          <div className="bg-[#2C2F36] rounded-xl p-5 flex flex-col items-center justify-center shadow-inner">
            <p className="text-gray-400 text-sm mb-1">Downward forecast</p>
            <p className="text-red-500 font-bold text-lg">Place</p>
            <p className="text-xs text-gray-500 mt-2">
              {displayData.sell || 0} predictions
            </p>
          </div>

          {/* Upward Forecast */}
          <div className="bg-[#2C2F36] rounded-xl p-5 flex flex-col items-center justify-center shadow-inner">
            <p className="text-gray-400 text-sm mb-1">Upward forecast</p>
            <p className="text-green-500 font-bold text-lg">Buy</p>
            <p className="text-xs text-gray-500 mt-2">
              {displayData.buy || 0} predictions
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
