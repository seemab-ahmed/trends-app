"use client";

import React, { useEffect, useRef, useState } from "react";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { Button } from "./ui/button";
import { Search, RefreshCw, AlertCircle } from "lucide-react";
import { useTheme } from "next-themes";

interface TradingViewChartProps {
  className?: string;
  defaultSymbol?: string;
  height?: number;
}

declare global {
  interface Window {
    TradingView: any;
  }
}

const TIMEFRAMES = [
  { value: "1", label: "1m" },
  { value: "5", label: "5m" },
  { value: "15", label: "15m" },
  { value: "60", label: "1h" },
  { value: "240", label: "4h" },
  { value: "1D", label: "1d" },
  { value: "1W", label: "1w" },
];

const SYMBOL_EXAMPLES = {
  stocks: ["NASDAQ:AAPL", "NYSE:MSFT", "NASDAQ:GOOGL", "NYSE:TSLA"],
  forex: ["OANDA:EURUSD", "OANDA:GBPUSD", "OANDA:USDJPY", "OANDA:AUDUSD"],
  crypto: [
    "BINANCE:BTCUSDT",
    "BINANCE:ETHUSDT",
    "BINANCE:ADAUSDT",
    "BINANCE:DOTUSDT",
  ],
};

export default function TradingViewChartCoin({
  className = "",
  defaultSymbol = "NASDAQ:AAPL",
  height = 500,
}: TradingViewChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const widgetRef = useRef<any>(null);
  const [symbol, setSymbol] = useState(defaultSymbol);
  const [timeframe, setTimeframe] = useState("60");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { theme } = useTheme();
  // Update chart if defaultSymbol prop changes (e.g., when user clicks new asset)
  useEffect(() => {
    if (defaultSymbol && defaultSymbol !== symbol) {
      setSymbol(defaultSymbol);
    }
  }, [defaultSymbol]);

  const initWidget = () => {
    if (!chartContainerRef.current || !window.TradingView) return;

    if (widgetRef.current) {
      try {
        widgetRef.current.remove();
      } catch {}
    }

    try {
      setIsLoading(true);
      setError(null);

      const containerId = `tradingview-chart-${Date.now()}`;
      chartContainerRef.current.id = containerId;

      const widget = new window.TradingView.widget({
        symbol,
        interval: timeframe,
        container_id: containerId,
        autosize: true,
        theme: "dark",
        style: "1",
        locale: "en",
        toolbar_bg: "#1E1F25",
        enable_publishing: false,
        allow_symbol_change: true,
        width: "100%",
        height: height,
        backgroundColor: "#1E1F25",
      });

      widgetRef.current = widget;
      setTimeout(() => setIsLoading(false), 1500);
    } catch {
      setError("Failed to initialize chart.");
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (typeof window === "undefined") return;

    if (window.TradingView) {
      setTimeout(initWidget, 100);
      return;
    }

    const existingScript = document.querySelector(
      'script[src*="tradingview.com"]'
    );
    if (existingScript) {
      const checkScript = setInterval(() => {
        if (window.TradingView) {
          clearInterval(checkScript);
          setTimeout(initWidget, 100);
        }
      }, 100);
      return;
    }

    const script = document.createElement("script");
    script.src = "https://s3.tradingview.com/tv.js";
    script.async = true;
    script.onload = () => setTimeout(initWidget, 100);
    script.onerror = () => {
      setError("Failed to load TradingView script.");
      setIsLoading(false);
    };
    document.head.appendChild(script);
  }, []);

  useEffect(() => {
    if (window.TradingView && !isLoading) {
      setTimeout(initWidget, 400);
    }
  }, [symbol, timeframe, theme]);

  const handleSymbolChange = (newSymbol: string) =>
    setSymbol(newSymbol.trim().toUpperCase());

  const handleSymbolSubmit = () => {
    if (symbol.trim()) initWidget();
  };

  const handleQuickSymbol = (quickSymbol: string) => setSymbol(quickSymbol);
  const handleRefresh = () => {
    setError(null);
    initWidget();
  };

  return (
    // bg-[#1E1F25]
    <div className={`p-4 bg-white bg-gradient-to-r from-gray-200 to-white shadow-md shadow-gray-400  rounded-2xl ${className}`}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4">
        <div>
          <h2 className="text-lg font-semibold text-white">Advanced Chart</h2>
          <p className="text-sm text-gray-400">
            Professional trading chart for {symbol} –{" "}
            {TIMEFRAMES.find((tf) => tf.value === timeframe)?.label}
          </p>
        </div>

        {/* 🔄 Refresh button - dark theme fixed */}
        <Button
          variant="ghost"
          size="sm"
          onClick={handleRefresh}
          disabled={isLoading}
          className="text-white bg-[#2B2E34] hover:bg-[#3A3F46] border border-[#2B2E34] rounded-lg"
        >
          <RefreshCw
            className={`h-4 w-4 mr-2 ${
              isLoading ? "animate-spin text-blue-400" : "text-gray-300"
            }`}
          />
          <span className="text-sm font-medium">Refresh</span>
        </Button>
      </div>

      {/* Chart */}
      <div className="relative rounded-lg bg-[#1E1F25] overflow-hidden">
        {error && (
          <div className="absolute inset-0 flex items-center justify-center bg-red-500/10 rounded-lg z-10">
            <div className="text-center p-6">
              <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
              <p className="text-red-400 font-medium text-lg mb-2">
                Chart Error
              </p>
              <p className="text-red-400 text-sm mb-4">{error}</p>
              <Button
                onClick={handleRefresh}
                className="text-white bg-red-600 hover:bg-red-700"
              >
                Retry
              </Button>
            </div>
          </div>
        )}
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-[#1E1F25]/70 z-10">
            <div className="text-center">
              <RefreshCw className="h-8 w-8 animate-spin text-blue-500 mx-auto mb-2" />
              <p className="text-gray-300">Loading chart...</p>
            </div>
          </div>
        )}
        <div
          ref={chartContainerRef}
          className="w-full rounded-lg"
          style={{ height: `${height}px` }}
        />
      </div>
    </div>
  );
}
