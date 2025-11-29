import { useState, useCallback } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useLanguage } from "@/hooks/use-language";
import AppHeader from "@/components/app-header";
import AssetsWithPrices from "@/components/assets-with-prices";
import AssetSearch from "@/components/asset-search";
import SuggestAssetForm from "@/components/suggest-asset-form";
import ShareApp from "@/components/share-app";
import { useQuery } from "@tanstack/react-query";
import { Asset } from "@shared/schema";
import { API_ENDPOINTS } from "@/lib/api-config";
import { Badge } from "@/components/ui/badge";
import PredictionHistory from "@/components/user-prediction-history";
import { useLocation } from "wouter";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  TrendingUp,
  TrendingDown,
  BarChart3,
  Coins,
  LineChart,
  Search,
  Plus,
  ListPlus,
  Globe,
  Trophy,
  DollarSign,
  Bitcoin,
} from "lucide-react";
import { Link } from "wouter";
import AssetCard from "@/components/asset-card";
import SentimentSummaryChart from "@/components/sentiment-summary-chart";
import GlobalSentimentCard from "@/components/global-sentiment-card";
import MiniLeaderboard from "@/components/mini-leaderboard";
import ReferralCard from "@/components/referral-card";
import PublicFeed from "@/components/public-feed";
import { LanguageSelectorCard } from "@/components/language-selector";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

// Type for coin catalog entry
interface CoinCatalogEntry {
  id: string;
  coinId: string;
  symbol: string;
  name: string;
  slug: string | null;
  marketCapRank: number | null;
  isActive: boolean;
  logoUrl: string | null;
  type: string;
}

export default function HomePage() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [suggestDialogOpen, setSuggestDialogOpen] = useState(false);
  const [location, setLocation] = useLocation();

  // No pagination needed - show all assets with prices

  // Fetch all crypto assets (unlimited)
  const { data: cryptoData, isLoading: cryptoLoading } = useQuery({
    queryKey: ["/api/assets", "crypto", "unlimited"],
    queryFn: async () => {
      const response = await fetch(
        `${API_ENDPOINTS.ASSETS()}?type=crypto&page=1&limit=999999`
      );
      const data = await response.json();
      return data;
    },
  });

  // Fetch all stock assets (unlimited)
  const { data: stockData, isLoading: stockLoading } = useQuery({
    queryKey: ["/api/assets", "stock", "unlimited"],
    queryFn: async () => {
      const response = await fetch(
        `${API_ENDPOINTS.ASSETS()}?type=stock&page=1&limit=999999`
      );
      const data = await response.json();
      return data;
    },
  });

  // Fetch all forex assets (unlimited)
  const { data: forexData, isLoading: forexLoading } = useQuery({
    queryKey: ["/api/assets", "forex", "unlimited"],
    queryFn: async () => {
      const response = await fetch(
        `${API_ENDPOINTS.ASSETS()}?type=forex&page=1&limit=999999`
      );
      const data = await response.json();
      return data;
    },
  });

  // Extract assets from data
  const cryptoAssets = cryptoData?.assets || [];
  const stockAssets = stockData?.assets || [];
  const forexAssets = forexData?.assets || [];

  const isLoading = cryptoLoading || stockLoading || forexLoading;

  return (
    <div className="min-h-screen bg-white font-poppins">
      <main className="container max-w-6xl mx-auto px-4 py-2 ">
        <section className="flex flex-col items-start justify-between mb-4 sm:hidden">
          <div>
            <h1 className="text-2xl font-[600] text-gray-900 ">Welcome to Trend</h1>
          </div>
        </section>

        {/* Search Section */}
        {/* <section className="mb-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Search className="h-5 w-5 mr-2 text-primary" />
                  {t("search.title")}
                </CardTitle>
                <CardDescription>{t("search.description")}</CardDescription>
              </CardHeader>
              <CardContent>
                <AssetSearch />
              </CardContent>
            </Card>
            <div className="space-y-4">
              <MiniLeaderboard />
            </div>
          </div>
        </section> */}

        {/* Global App Sentiment + Referral in one row */}
        <section className="mb-8">
         <div className="grid grid-cols-3 gap-5">
          <div className="col-span-3">
            <MiniLeaderboard />
          </div>
          <div className="lg:col-span-2 col-span-3">
            <GlobalSentimentCard />
          </div>
          <div className="lg:col-span-1 col-span-3">
            <PredictionHistory />
          </div>
          
          <div className="col-span-3 ">
            <PublicFeed />
          </div>
          <div className="col-span-3  grid grid-cols-1  gap-5">
             <ReferralCard />
          </div>


{/*             
            <div className="col-span-2">
              <div className="grid grid-cols-1 lg:grid-cols-5 gap-3">
                <div className="col-span-3">
                  <GlobalSentimentCard />
                </div>
                <div className="col-span-2">
                  <MiniLeaderboard />
                </div>
              </div>
              <div className="my-4" />
              <PublicFeed />
            </div>
            <div className="col-span-1">
              <ReferralCard />
              <div className="my-4" />
              <PredictionHistory />
            </div> */}
          </div>
        </section>

        {/* App Info Section */}
        {/* <section className="mb-8">
          <Card className="bg-gradient-to-r from-background to-muted">
            <CardHeader>
              <CardTitle className="text-xl">
                {t("home.how_it_works")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="flex flex-col items-center text-center p-4">
                  <div className="bg-primary/10 p-3 rounded-full mb-4">
                    <BarChart3 className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="font-semibold mb-2">
                    {t("home.track_assets")}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {t("home.track_description")}
                  </p>
                </div>

                <div className="flex flex-col items-center text-center p-4">
                  <div className="bg-primary/10 p-3 rounded-full mb-4">
                    <TrendingUp className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="font-semibold mb-2">
                    {t("home.make_predictions")}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {t("home.predictions_description")}
                  </p>
                </div>

                <div className="flex flex-col items-center text-center p-4">
                  <div className="bg-primary/10 p-3 rounded-full mb-4">
                    <Trophy className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="font-semibold mb-2">
                    {t("home.earn_badges")}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {t("home.badges_description")}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </section> */}

        {/* Language Section */}
        {/* <section className="mb-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center">
                  <Globe className="h-5 w-5 mr-2 text-primary" />
                  {t("language.title")}
                </CardTitle>
                <CardDescription>{t("language.description")}</CardDescription>
              </CardHeader>
              <CardContent>
                <LanguageSelectorCard />
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-r from-primary/10 to-primary/5 border-primary/20">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center">
                  <TrendingUp className="h-5 w-5 mr-2 text-primary" />
                  {t("share.share_with_friends")}
                </CardTitle>
                <CardDescription>{t("share.invite_friends")}</CardDescription>
              </CardHeader>
              <CardContent className="flex justify-center">
                <ShareApp size="lg" />
              </CardContent>
            </Card>
          </div>
        </section> */}

        <section className="mb-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2"></div>
          </div>
        </section>

        {/* Crypto Assets Section - COMMENTED OUT */}
        {/* <section className="mb-8">
          <h2 className="text-2xl font-bold mb-4 flex items-center">
            <Coins className="h-6 w-6 mr-2 text-primary" />
            {t("asset.crypto_title")}
          </h2>
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[...Array(3)].map((_, i) => (
                <Card key={i} className="h-[180px]">
                  <CardHeader>
                    <Skeleton className="h-6 w-2/3" />
                    <Skeleton className="h-4 w-1/2" />
                  </CardHeader>
                  <CardContent>
                    <Skeleton className="h-20 w-full" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : cryptoAssets.length > 0 ? (
            <AssetsWithPrices assets={cryptoAssets} />
          ) : (
            <div className="text-center py-10 text-muted-foreground">
              {t("asset.no_crypto")}
            </div>
          )}
        </section> */}

        {/* Stock Assets Section - COMMENTED OUT */}
        {/* <section className="mb-8">
          <h2 className="text-2xl font-bold mb-4 flex items-center">
            <LineChart className="h-6 w-6 mr-2 text-primary" />
            {t("asset.stock_title")}
          </h2>
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[...Array(3)].map((_, i) => (
                <Card key={i} className="h-[180px]">
                  <CardHeader>
                    <Skeleton className="h-6 w-2/3" />
                    <Skeleton className="h-4 w-1/2" />
                  </CardHeader>
                  <CardContent>
                    <Skeleton className="h-20 w-full" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : stockAssets.length > 0 ? (
            <AssetsWithPrices assets={stockAssets} />
          ) : (
            <div className="text-center py-10 text-muted-foreground">
              {t("asset.no_stock")}
            </div>
          )}
        </section> */}

        {/* Forex Assets Section - COMMENTED OUT */}
        {/* <section>
          <h2 className="text-2xl font-bold mb-4 flex items-center">
            <DollarSign className="h-6 w-6 mr-2 text-primary" />
            {t("asset.forex_title") || "Forex Pairs"}
          </h2>
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[...Array(3)].map((_, i) => (
                <Card key={i} className="h-[180px]">
                  <CardHeader>
                    <Skeleton className="h-6 w-2/3" />
                    <Skeleton className="h-4 w-1/2" />
                  </CardHeader>
                  <CardContent>
                    <Skeleton className="h-20 w-full" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : forexAssets.length > 0 ? (
            <AssetsWithPrices assets={forexAssets} />
          ) : (
            <div className="text-center py-10 text-muted-foreground">
              {t("asset.no_forex") || "No forex pairs available"}
            </div>
          )}
        </section> */}
      </main>
    </div>
  );
}
