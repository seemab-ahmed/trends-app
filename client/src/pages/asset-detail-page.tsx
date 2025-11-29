import { useQuery } from "@tanstack/react-query";
import { useRoute } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useState } from "react";
import AppHeader from "@/components/app-header";
import { EnhancedPredictionForm } from "@/components/enhanced-prediction-form";
import SentimentChart from "@/components/sentiment-chart";
import { Asset } from "@shared/schema";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  BarChart3,
  Users,
  TrendingUp,
  ArrowLeft,
  Share2,
  Clock,
  Star,
  CalendarClock,
  Coins,
  LineChart,
  DollarSign,
  TrendingDown,
  Minus,
  Maximize2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import TradingViewChart from "@/components/tradingview-chart";

export default function AssetDetailPage() {
  const [, params] = useRoute("/assets/:symbol");
  const symbol = decodeURIComponent(params?.symbol || "");
  const { user } = useAuth();
  const [selectedDuration, setSelectedDuration] = useState<string>("24h");

  const { data: asset, isLoading: isLoadingAsset } = useQuery<Asset>({
    queryKey: [`/api/assets/${symbol}`],
  });

  // Fetch price ONCE on page load - NO continuous refresh
  const { data: priceData, isLoading: isLoadingPrice } = useQuery<{
    symbol: string;
    price: number;
    change24h?: number;
  }>({
    queryKey: [`catalog-price-${symbol}`],
    queryFn: async () => {
      console.log(
        "[PRICE FETCH] Asset detail page load - fetching price for:",
        symbol
      );

      // Use catalog API - exactly ONE price call on selection
      const response = await fetch(
        `/api/catalog/price/${encodeURIComponent(symbol)}`
      );

      if (!response.ok) {
        console.log("[PRICE FETCH] Failed for:", symbol);
        throw new Error("Failed to fetch price");
      }

      const data = await response.json();
      console.log(
        "[PRICE FETCH] Success for:",
        symbol,
        "Price:",
        data.price,
        "API calls:",
        data.priceCallsMade
      );

      return {
        symbol,
        price: data.price,
        change24h: data.change24h,
      };
    },
    staleTime: Infinity, // NEVER auto-refresh
    gcTime: Infinity, // Keep in cache
    retry: 2,
  });

  // Fetch price history for sparkline
  const { data: priceHistory } = useQuery<
    Array<{ price: number; timestamp: string; source: string }>
  >({
    queryKey: [`/api/assets/${symbol}/history`, 30], // Last 30 days
    refetchInterval: 300000, // Refresh every 5 minutes
  });

  const getAssetIcon = (type: string) => {
    switch (type) {
      case "crypto":
        return <Coins className="h-5 w-5 text-yellow-500" />;
      case "stock":
        return <LineChart className="h-5 w-5 text-blue-500" />;
      case "forex":
        return <DollarSign className="h-5 w-5 text-green-500" />;
      default:
        return <TrendingUp className="h-5 w-5 text-gray-500" />;
    }
  };

  const getAssetTypeLabel = (type: string) => {
    switch (type) {
      case "crypto":
        return "Cryptocurrency";
      case "stock":
        return "Stock";
      case "forex":
        return "Forex";
      default:
        return type;
    }
  };

  const getPriceChangeIndicator = () => {
    if (!priceHistory || priceHistory.length < 2)
      return <Minus className="h-6 w-6 text-gray-400" />;

    const currentPrice = priceHistory[0]?.price;
    const previousPrice = priceHistory[priceHistory.length - 1]?.price;

    if (!currentPrice || !previousPrice)
      return <Minus className="h-6 w-6 text-gray-400" />;

    const change = currentPrice - previousPrice;
    if (change > 0) return <TrendingUp className="h-6 w-6 text-green-500" />;
    if (change < 0) return <TrendingDown className="h-6 w-6 text-red-500" />;
    return <Minus className="h-6 w-6 text-gray-400" />;
  };

  const formatPrice = (price: number) => {
    if (asset?.type === "forex") {
      return price.toFixed(4);
    } else if (asset?.type === "crypto") {
      return price < 1 ? price.toFixed(6) : price.toFixed(2);
    } else {
      return price.toFixed(2);
    }
  };

  const getPriceChangePercentage = () => {
    if (!priceHistory || priceHistory.length < 2) return null;

    const currentPrice = priceHistory[0]?.price;
    const previousPrice = priceHistory[priceHistory.length - 1]?.price;

    if (!currentPrice || !previousPrice) return null;

    const change = ((currentPrice - previousPrice) / previousPrice) * 100;
    return change;
  };

  return (
    <div className="min-h-screen bg-background">
      <main className="container max-w-6xl mx-auto px-4 py-6">
        <Link
          href="/"
          className="inline-flex items-center text-primary hover:underline mb-6"
        >
          <ArrowLeft className="h-4 w-4 mr-1" /> Back to Assets
        </Link>

        {isLoadingAsset ? (
          <Skeleton className="h-10 w-1/3 mb-4" />
        ) : (
          <h1 className="text-3xl font-bold tracking-tight mb-4">
            {asset?.name} ({asset?.symbol})
          </h1>
        )}

        {/* Real-time Price Display */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Current Price</span>
              {getPriceChangeIndicator()}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoadingPrice ? (
              <div className="space-y-2">
                <Skeleton className="h-12 w-32" />
                <Skeleton className="h-6 w-24" />
              </div>
            ) : priceData ? (
              <div className="space-y-2">
                <div className="text-4xl font-bold">
                  ${formatPrice(priceData.price)}
                </div>
                {(() => {
                  const changePercent = getPriceChangePercentage();
                  if (changePercent !== null) {
                    const isPositive = changePercent >= 0;
                    return (
                      <div
                        className={`text-lg ${
                          isPositive ? "text-green-600" : "text-red-600"
                        }`}
                      >
                        {isPositive ? "+" : ""}
                        {changePercent.toFixed(2)}% (30d)
                      </div>
                    );
                  }
                  return null;
                })()}
              </div>
            ) : (
              <div className="text-lg text-muted-foreground">
                Price unavailable
              </div>
            )}
          </CardContent>
        </Card>

        {/* TradingView Advanced Chart */}
        <Card className="mb-6">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Advanced Trading Chart</CardTitle>
                <CardDescription>
                  Professional chart for {asset?.symbol} with multiple
                  timeframes
                </CardDescription>
              </div>
              <Link
                href={`/chart/${encodeURIComponent(
                  asset?.symbol || "NASDAQ:AAPL"
                )}`}
                className="inline-flex items-center px-3 py-2 text-sm font-medium text-primary bg-primary/10 hover:bg-primary/20 rounded-md transition-colors"
              >
                <Maximize2 className="h-4 w-4 mr-2" />
                Full Chart
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            <TradingViewChart
              defaultSymbol={asset?.symbol || "NASDAQ:AAPL"}
              height={500}
            />
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Asset Type
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center">
                {!isLoadingAsset && asset && getAssetIcon(asset.type)}
                {isLoadingAsset ? (
                  <Skeleton className="h-8 w-20 ml-2" />
                ) : (
                  <span className="ml-2 font-medium">
                    {asset && getAssetTypeLabel(asset.type)}
                  </span>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Status
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center">
                <div
                  className={`h-3 w-3 rounded-full mr-2 ${
                    asset?.isActive ? "bg-green-500" : "bg-gray-400"
                  }`}
                ></div>
                {isLoadingAsset ? (
                  <Skeleton className="h-8 w-20" />
                ) : (
                  <span className="font-medium">
                    {asset?.isActive ? "Active" : "Inactive"}
                  </span>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Data Source
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center">
                <BarChart3 className="h-5 w-5 text-primary mr-2" />
                <div className="text-sm font-medium">
                  {isLoadingAsset ? (
                    <Skeleton className="h-8 w-20" />
                  ) : (
                    asset?.apiSource || "Unknown"
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <Tabs defaultValue="sentiment" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="sentiment">Market Sentiment</TabsTrigger>
                <TabsTrigger value="predictions">Make Prediction</TabsTrigger>
              </TabsList>

              <TabsContent value="sentiment" className="mt-6">
                {/* Duration filter only for sentiment chart */}
                <div className="mb-4 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
                  <div className="text-sm text-muted-foreground">
                    Select time range for sentiment analysis
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="text-sm text-muted-foreground">
                      Duration:
                    </span>
                    <div className="grid grid-cols-5 gap-1">
                      {(
                        [
                          "1h",
                          "3h",
                          "6h",
                          "24h",
                          "48h",
                          "1w",
                          "1m",
                          "3m",
                          "6m",
                          "1y",
                        ] as const
                      ).map((duration) => (
                        <button
                          key={duration}
                          onClick={() => setSelectedDuration(duration)}
                          className={`px-2 py-1 text-xs transition-colors border rounded ${
                            selectedDuration === duration
                              ? "bg-primary text-primary-foreground"
                              : "hover:bg-muted"
                          }`}
                        >
                          {duration}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
                <SentimentChart
                  assetSymbol={symbol}
                  duration={selectedDuration}
                />
              </TabsContent>

              <TabsContent value="predictions" className="mt-6">
                {!user ? (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center">
                        <Star className="h-5 w-5 mr-2 text-primary" />
                        Make a Prediction
                      </CardTitle>
                      <CardDescription>
                        Predict the price direction for {asset?.symbol}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="text-center py-8">
                        <div className="mb-4">
                          <Users className="h-12 w-12 mx-auto text-muted-foreground mb-2" />
                          <p className="text-muted-foreground">
                            You need to be logged in to make predictions
                          </p>
                        </div>
                        <Button asChild size="lg">
                          <Link href="/auth">Sign In / Register</Link>
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ) : (
                  asset && (
                    <EnhancedPredictionForm
                      assetSymbol={asset.symbol}
                      onSuccess={() => {
                        // Refresh data after successful prediction
                        window.location.reload();
                      }}
                    />
                  )
                )}
              </TabsContent>
            </Tabs>
          </div>

          <div>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Asset Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {isLoadingAsset ? (
                  <>
                    <div className="flex items-center justify-between">
                      <Skeleton className="h-8 w-24" />
                      <Skeleton className="h-8 w-16" />
                    </div>
                    <div className="flex items-center justify-between">
                      <Skeleton className="h-8 w-24" />
                      <Skeleton className="h-8 w-16" />
                    </div>
                  </>
                ) : asset ? (
                  <>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">
                        Symbol
                      </span>
                      <span className="font-medium">{asset.symbol}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">
                        Type
                      </span>
                      <Badge variant="outline">
                        {getAssetTypeLabel(asset.type)}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">
                        Status
                      </span>
                      <Badge variant={asset.isActive ? "default" : "secondary"}>
                        {asset.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">
                        Source
                      </span>
                      <span className="text-sm font-medium">
                        {asset.apiSource}
                      </span>
                    </div>
                  </>
                ) : (
                  <div className="text-center py-4 text-muted-foreground text-sm">
                    Asset not found
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Prediction Rules */}
            <div className="mt-6">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">
                    How Predictions Work
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div className="flex items-start space-x-2">
                    <div className="w-2 h-2 bg-primary rounded-full mt-2 flex-shrink-0"></div>
                    <p className="text-muted-foreground">
                      Choose a time duration (1h, 3h, 6h, 24h, 48h, 1w, 1m, 3m,
                      6m, 1y)
                    </p>
                  </div>
                  <div className="flex items-start space-x-2">
                    <div className="w-2 h-2 bg-primary rounded-full mt-2 flex-shrink-0"></div>
                    <p className="text-muted-foreground">
                      Predict if the price will go up or down
                    </p>
                  </div>
                  <div className="flex items-start space-x-2">
                    <div className="w-2 h-2 bg-primary rounded-full mt-2 flex-shrink-0"></div>
                    <p className="text-muted-foreground">
                      Earlier slots offer higher rewards but greater risk
                    </p>
                  </div>
                  <div className="flex items-start space-x-2">
                    <div className="w-2 h-2 bg-primary rounded-full mt-2 flex-shrink-0"></div>
                    <p className="text-muted-foreground">
                      Predictions are locked once submitted
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
