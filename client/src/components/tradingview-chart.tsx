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

export default function TradingViewChart({
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
    <div className={`p-4  rounded-2xl bg-white  shadow-[0_0_10px_rgba(0,0,0,0.15)] ${className}`}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row gap-3 justify-between items-start sm:items-center mb-4">
        <div>
          <h2 className="text-lg font-semibold text-black">Advanced Chart</h2>
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
          className="text-black hover:text-white  bg-gray-300 hover:bg-blue-600 transition-all duration-500 ease-in-out rounded-lg"
        >
          <RefreshCw
            className={`h-4 w-4 mr-2 ${
              isLoading ? "animate-spin text-white" : "text-black hover:text-white   transition-all duration-500 ease-in-out "
            }`}
          />
          <span className="text-sm font-medium">Refresh</span>
        </Button>
      </div>

      {/* Inputs */}
      <div className="flex flex-col sm:flex-row gap-4 mb-4">
        <div className="flex-1">
          <Label className="text-black">Symbol</Label>
          <div className="flex gap-2 mt-1">
            <Input
              placeholder="e.g., NASDAQ:AAPL, OANDA:EURUSD, BINANCE:BTCUSDT"
              value={symbol}
              onChange={(e) => handleSymbolChange(e.target.value)}
              onKeyPress={(e) => e.key === "Enter" && handleSymbolSubmit()}
              // focus:ring-2 focus:ring-blue-500
              className="bg-[#fff] border border-gray-400 outlne-none text-black placeholder:text-gray-500 "
            />
            <Button
              onClick={handleSymbolSubmit}
              disabled={isLoading}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              <Search className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="sm:w-32">
          <Label className="text-black">Timeframe</Label>
          <Select value={timeframe} onValueChange={setTimeframe}>
            <SelectTrigger className="bg-gray-100 text-black border border-[#2B2E34] mt-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-gray-100 text-black border-[#2B2E34]">
              {TIMEFRAMES.map((tf) => (
                <SelectItem key={tf.value} value={tf.value}>
                  {tf.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Quick Examples */}
      <div className="space-y-2 mb-4">
        <Label className="text-sm text-gray-400">Quick Examples:</Label>
        <div className="flex flex-wrap gap-2">
          {Object.entries(SYMBOL_EXAMPLES).map(([type, symbols]) =>
            symbols.map((sym) => (
              <Button
                key={sym}
                variant="ghost"
                size="sm"
                onClick={() => handleQuickSymbol(sym)}
                className="text-xs h-7 px-3 text-black hover:text-white bg-gray-200 hover:bg-blue-600 transition-all duration-500 ease-in-outrounded-lg transition-all"
              >
                {sym}
              </Button>
            ))
          )}
        </div>
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
                className="text-black bg-red-600 hover:bg-red-700"
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
