"use client";

import React from "react";
import { useRoute, useLocation } from "wouter"; // ✅ <-- FIXED IMPORT
import TradingViewChart from "@/components/tradingview-chart";
import { ArrowLeft } from "lucide-react"; // ✅ Import the back icon

export default function ChartPage() {
  const [, params] = useRoute("/chart/:symbol?");
  const [_, setLocation] = useLocation(); // ✅ Correct destructure

  const symbol = params?.symbol
    ? decodeURIComponent(params.symbol)
    : "NASDAQ:AAPL";

  const handleBack = () => {
    setLocation("/"); // ✅ Navigates to homepage
  };

  return (
    <div className="min-h-screen bg-white text-white">
      <main className="container max-w-6xl mx-auto px-4 py-0 space-y-2">
        {/* 📱 Mobile-only Header */}
        <section className="flex items-center gap-3 mb-4 sm:hidden">
          {/* Back Button */}
          <button
            onClick={handleBack}
            className="flex items-center justify-center w-9 h-9 rounded-full bg-gray-200 hover:bg-blue-600 group transition"
          >
            <ArrowLeft className="h-5 w-5 text-black group-hover" />
          </button>

          {/* Title */}
          <h1 className="text-2xl font text-white">Trading Chart</h1>
        </section>

        {/* Chart Component */}
        <TradingViewChart defaultSymbol={symbol} height={520} />
      </main>
    </div>
  );
}
