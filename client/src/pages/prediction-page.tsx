import React from "react";
import { useRoute } from "wouter";
import { useQuery } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EnhancedPredictionForm } from "@/components/enhanced-prediction-form";
import AnalystConsensusPanel from "@/components/analyst-consensus-card";
import AnalystPriceTargetPanel from "@/components/analysis-price-target";
import { DollarSign } from "lucide-react";
import { Redirect, useLocation } from "wouter";
import { ArrowLeft } from "lucide-react";
import TradingViewChartCoin from "@/components/tradingview-coin";

export default function PredictionPage() {
  const [, params] = useRoute("/predict/:assetSymbol");
  const assetSymbol = params?.assetSymbol;
  const [_, setLocation] = useLocation();

  const handleBack = () => setLocation("/");

  // Format symbol for TradingView only
  const chartSymbol = assetSymbol
    ? assetSymbol
        .replace(/\//g, "") // Remove regular slashes
        .replace(/%2F/gi, "") // Remove URL-encoded slashes
        .replace(/%2f/gi, "") // Remove lowercase URL-encoded slashes
        .replace(/%3/gi, "")
        .replace(/%3f/gi, "")
        .trim()
    : "";

  // Fetch asset info
  const { data: asset, isLoading: isLoadingAsset } = useQuery({
    queryKey: ["asset", assetSymbol],
    queryFn: async () => {
      const response = await fetch(`/api/assets/${assetSymbol}`);
      if (!response.ok) throw new Error("Failed to fetch asset");
      return response.json();
    },
    enabled: !!assetSymbol,
  });

  // Fetch LIVE price immediately when page loads
  const { data: livePriceData, isLoading: isLoadingLivePrice } = useQuery({
    queryKey: ["live-price", assetSymbol],
    queryFn: async () => {
      console.log(`🔄 Fetching fresh price for: ${assetSymbol}`);
      const response = await fetch(
        `/api/catalog/price/${encodeURIComponent(assetSymbol || "")}`
      );

      if (!response.ok) throw new Error("Failed to fetch live price");
      const priceData = await response.json();
      console.log(`✅ Fresh price received: $${priceData.price}`);
      return priceData;
    },
    enabled: !!assetSymbol,
    retry: 2,
  });

  // Fetch consensus + chart data once
  const { data: consensusData, isLoading: isLoadingConsensus } = useQuery({
    queryKey: ["analyst-consensus", assetSymbol],
    queryFn: async () => {
      const response = await fetch(
        `/api/analyst-consensus/${encodeURIComponent(assetSymbol || "")}`
      );
      if (!response.ok) throw new Error("Failed to fetch consensus");
      return response.json();
    },
    enabled: !!assetSymbol,
  });

  // Combine live price with consensus data
  const enhancedConsensusData = React.useMemo(() => {
    if (!consensusData) return null;

    return {
      ...consensusData,
      livePrice: livePriceData?.price,
      priceChange: livePriceData?.change24h,
      isLive: !!livePriceData,
      timestamp: livePriceData?.timestamp || new Date().toISOString(),
    };
  }, [consensusData, livePriceData]);

  if (isLoadingAsset || isLoadingLivePrice) {
    return (
      <div className="min-h-screen bg-[#2f343a]">
        <main className="container max-w-6xl mx-auto px-4 py-6">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-muted rounded w-1/3"></div>
            <div className="h-64 bg-muted rounded"></div>
            <div className="flex items-center gap-2">
              <div className="h-4 bg-muted rounded w-24"></div>
              <div className="h-4 bg-muted rounded w-32"></div>
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (!asset) {
    return (
      <div className="min-h-screen bg-[#2f343a]">
        <main className="container max-w-6xl mx-auto px-4 py-2">
          <Card className="border-red-500/20 bg-red-500/10">
            <CardContent className="pt-6">
              <p className="text-red-400 text-center">Asset not found</p>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white text-gray-100 font-poppins">
      <main className="container max-w-6xl mx-auto px-4 py-0 space-y-4">
        {/* Header */}
        <section className="flex items-center gap-3 mb-4 sm:hidden">
          {/* Back Button */}
          <button
            onClick={handleBack}
          className="flex items-center justify-center w-9 h-9 rounded-full group bg-gray-300 hover:bg-blue-600 transition"
          >
            <ArrowLeft className="h-5 w-5 text-black group-hover:text-white" />
          </button>

          {/* Title */}
          <h1 className="text-2xl font text-black">Make Prediction</h1>
        </section>

        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-lg font-semibold text-black">
              {" "}
              See price and valuation for {asset.name} ({asset.symbol})
            </h2>
            {/* Show Live Price */}
            {livePriceData && (
              <div className="flex items-center gap-3 mt-2">
                <div className="text-2xl font-bold text-gray-600">
                  $
                  {livePriceData.price?.toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 6,
                  })}
                </div>
              </div>
            )}
          </div>
          <div className="flex items-center space-x-2">
            <Badge variant="outline" className="text-black border border-black">
              {asset.type}
            </Badge>
            <Badge
              variant="outline"
              className={asset.isActive ? "bg-blue-600 text-white border-blue-600" : "bg-gray-600 text-white border-gray-600"}
            >
              {asset.isActive ? "Active" : "Inactive"}
            </Badge>
          </div>
        </div>

        {/* ---- TOP CHART CARD ---- */}

        {/* {isLoadingConsensus ? (
              <Skeleton className="h-64 w-full rounded-lg" />
            ) : enhancedConsensusData ? (
              <AnalystPriceTargetPanel
                t={(key: string) => key}
                displayData={enhancedConsensusData}
                assetSymbol={assetSymbol || ""}
                assetType={asset.type}
                livePriceData={livePriceData}
              />
            ) : (
              <div className="text-muted-foreground">Chart unavailable</div>
            )} */}
        <TradingViewChartCoin defaultSymbol={chartSymbol} />

        {/* ---- BOTTOM ROW ---- */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left: Consensus */}
          <div className="bg-white shadow-[0_0_10px_rgba(0,0,0,0.15)] border border-0 rounded-3xl mt-4">
            {isLoadingConsensus ? (
              <Skeleton className="h-64 w-full rounded-lg" />
            ) : enhancedConsensusData ? (
              <AnalystConsensusPanel
                t={(key: string) => key}
                displayData={enhancedConsensusData}
                assetSymbol={assetSymbol || ""}
              />
            ) : (
              <div className="text-black">No consensus data</div>
            )}
          </div>

          {/* Right: Prediction Form */}
          <div className="bg-white shadow-[0_0_10px_rgba(0,0,0,0.15)]  border border-0 rounded-3xl  mt-4">
            <EnhancedPredictionForm
              assetSymbol={asset.symbol}
            />
          </div>
        </div>
      </main>
    </div>
  );
}
