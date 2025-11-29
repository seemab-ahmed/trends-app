import { useAuth } from "@/hooks/use-auth";
import { useLanguage } from "@/hooks/use-language";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useMemo, useState, useCallback } from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { LanguageSelectorButton } from "@/components/language-selector";
import { NotificationBell } from "@/components/notification-bell";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LogOut, User, Shield, Search, ChevronDown } from "lucide-react";
import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";

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

export default function AppHeader() {
  const { user, logoutMutation } = useAuth();
  const { t } = useLanguage();
  const [location, setLocation] = useLocation();

  // Unified search state
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [debounceTimer, setDebounceTimer] = useState<NodeJS.Timeout | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedAssetType, setSelectedAssetType] = useState<"crypto" | "stock" | "forex">("crypto");

  const pageTitle = useMemo(() => {
    if (location.startsWith("/profile")) return "Profile";
    if (location.startsWith("/leaderboard")) return "Leaderboard";
    if (location.startsWith("/admin")) return "Admin Panel";
    if (location.startsWith("/assets/")) return "Asset Detail";
    if (location.startsWith("/chart")) return "Trading Chart";
    if (location.startsWith("/predict")) return "Make Prediction";
    if (location.startsWith("/auth")) return "Login / Register";
    if (location.startsWith("/user/")) return "User Profile";
    return "Dashboard";
  }, [location]);

  const handleLogout = () => logoutMutation.mutate();

  // Unified debounced search input (500ms delay)
  const handleSearchInput = useCallback(
    (value: string) => {
      setSearchQuery(value);
      setShowSuggestions(value.length > 0);

      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }

      const timer = setTimeout(() => {
        setDebouncedQuery(value);
      }, 500);

      setDebounceTimer(timer);
    },
    [debounceTimer]
  );

  // Unified search query
  const { data: searchResults, isLoading: isSearching } = useQuery({
    queryKey: ["/api/catalog/search", debouncedQuery, selectedAssetType],
    queryFn: async () => {
      if (!debouncedQuery || debouncedQuery.trim().length === 0) {
        return { results: [], count: 0, priceCallsMade: 0 };
      }

      const response = await fetch(
        `/api/catalog/search?q=${encodeURIComponent(
          debouncedQuery.trim()
        )}&limit=10&type=${selectedAssetType}`
      );

      if (!response.ok) {
        throw new Error("Search failed");
      }

      const data = await response.json();
      return data;
    },
    enabled: debouncedQuery.length > 0,
    retry: 1,
  });

  const clearSearch = () => {
    setSearchQuery("");
    setDebouncedQuery("");
    setShowSuggestions(false);
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }
  };

  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-50 shadow-sm">
      <div className="container max-w-6xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
        {/* Left: Title */}
        <div className="flex items-center space-x-4 min-w-0">
          <Link href="/" className="flex items-center">
            <span
              className="text-gray-900 font-semibold text-2xl leading-none whitespace-nowrap"
              style={{ fontFamily: "Poppins, sans-serif" }}
            >
              {pageTitle}
            </span>
          </Link>
        </div>

        {/* Center: Unified Search with Dropdown */}
        <div className="hidden lg:flex flex-1 max-w-2xl items-center gap-2 relative">
          <div className="flex-1 relative">
            <span className="absolute inset-y-0 left-3 flex items-center pointer-events-none z-10">
              <Search className="h-4 w-4 text-gray-400" />
            </span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => handleSearchInput(e.target.value)}
              placeholder={
                selectedAssetType === "crypto"
                  ? "Search Bitcoin, Ethereum, etc..."
                  : selectedAssetType === "stock"
                  ? "Search Apple, Tesla, etc..."
                  : "Search EUR/USD, GBP/USD, etc..."
              }
              className="w-full bg-gray-50 text-gray-900 placeholder:text-gray-500 rounded-lg h-10 pl-10 pr-4 border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              onFocus={() => setShowSuggestions(searchQuery.length > 0)}
            />

            {/* Search Results Dropdown */}
            {showSuggestions && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-gray-200 rounded-lg shadow-lg z-50 max-h-96 overflow-y-auto">
                {isSearching ? (
                  <div className="p-4">
                    <div className="text-gray-500 text-sm mb-3">
                      Searching...
                    </div>
                    <div className="space-y-2">
                      {[...Array(3)].map((_, i) => (
                        <div
                          key={i}
                          className="flex items-center space-x-3 p-3"
                        >
                          <div className="w-8 h-8 bg-gray-200 rounded-full animate-pulse"></div>
                          <div className="flex-1">
                            <div className="h-4 bg-gray-200 rounded animate-pulse mb-1"></div>
                            <div className="h-3 bg-gray-200 rounded w-1/2 animate-pulse"></div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : searchResults?.results &&
                  searchResults.results.length > 0 ? (
                  <div className="p-2">
                    <div className="text-gray-500 text-xs mb-2 px-3 py-2">
                      Found {searchResults.results.length}{" "}
                      {selectedAssetType} assets
                    </div>
                    {searchResults.results.map(
                      (asset: CoinCatalogEntry) => (
                        <div
                          key={asset.id}
                          className="block p-3 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                          onClick={async () => {
                            try {
                              const decodedId = decodeURIComponent(
                                asset.coinId
                              );
                              const encodedId =
                                encodeURIComponent(decodedId);

                              const priceResponse = await fetch(
                                `/api/catalog/price/${encodedId}`
                              );

                              if (priceResponse.ok) {
                                const priceData =
                                  await priceResponse.json();
                                console.log(
                                  `✅ Live price for ${asset.symbol}: $${priceData.price}`
                                );
                              }

                              setShowSuggestions(false);
                              setSearchQuery("");
                              setLocation(`/predict/${encodedId}`);
                            } catch (error) {
                              console.error(
                                `❌ Error fetching price for ${asset.symbol}:`,
                                error
                              );
                              setShowSuggestions(false);
                              setSearchQuery("");
                              setLocation(
                                `/predict/${encodeURIComponent(
                                  asset.coinId
                                )}`
                              );
                            }
                          }}
                        >
                          <div className="flex items-center space-x-3">
                            {asset.logoUrl ? (
                              <img
                                src={asset.logoUrl}
                                alt={asset.name}
                                className="w-8 h-8 rounded-full"
                              />
                            ) : (
                              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                                selectedAssetType === "crypto"
                                  ? "bg-yellow-500"
                                  : selectedAssetType === "stock"
                                  ? "bg-blue-500"
                                  : "bg-green-500"
                              }`}>
                                <span className="text-white font-bold text-xs">
                                  {selectedAssetType === "crypto"
                                    ? "₿"
                                    : selectedAssetType === "stock"
                                    ? "📈"
                                    : "💱"}
                                </span>
                              </div>
                            )}
                            <div className="flex-1">
                              <div className="text-gray-900 text-sm font-medium">
                                {asset.name}
                              </div>
                              <div className="text-gray-500 text-xs flex items-center gap-2">
                                <span>{asset.symbol}</span>
                                {asset.marketCapRank && (
                                  <span className={
                                    selectedAssetType === "crypto"
                                      ? "text-yellow-600"
                                      : selectedAssetType === "stock"
                                      ? "text-blue-600"
                                      : "text-green-600"
                                  }>
                                    #{asset.marketCapRank}
                                  </span>
                                )}
                              </div>
                            </div>
                            <Badge
                              variant="outline"
                              className={`text-xs ${
                                selectedAssetType === "crypto"
                                  ? "border-yellow-500 text-yellow-700 bg-yellow-50"
                                  : selectedAssetType === "stock"
                                  ? "border-blue-500 text-blue-700 bg-blue-50"
                                  : "border-green-500 text-green-700 bg-green-50"
                              }`}
                            >
                              {selectedAssetType.charAt(0).toUpperCase() +
                                selectedAssetType.slice(1)}
                            </Badge>
                          </div>
                        </div>
                      )
                    )}
                  </div>
                ) : debouncedQuery &&
                  searchResults?.results?.length === 0 ? (
                  <div className="p-4 text-center text-gray-500 text-sm">
                    No {selectedAssetType} assets found for "
                    {debouncedQuery}"
                  </div>
                ) : null}
              </div>
            )}
          </div>

          {/* Asset Type Dropdown */}
          <select
            value={selectedAssetType}
            onChange={(e) => {
              setSelectedAssetType(
                e.target.value as "crypto" | "stock" | "forex"
              );
              clearSearch();
            }}
            className="bg-white border border-gray-300 text-gray-700 text-sm rounded-lg px-3 py-2 h-10 outline-none cursor-pointer appearance-none pr-10
                      "
            style={{
              backgroundImage:
                "url('data:image/svg+xml;utf8,<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"24\" height=\"24\" fill=\"gray\"><path d=\"M7 10l5 5 5-5H7z\"/></svg>')",
              backgroundRepeat: "no-repeat",
              backgroundPosition: "right 10px center",
            }}
          >
            <option value="crypto" className="bg-gray-100">Cryptocurrency</option>
            <option value="stock" className="bg-gray-100">Stocks</option>
            <option value="forex" className="bg-gray-100">Forex</option>
          </select>

          {/* <select
            value={selectedAssetType}
            onChange={(e) => {
              setSelectedAssetType(
                e.target.value as "crypto" | "stock" | "forex"
              );
              clearSearch();
            }}
            className="bg-white border border-gray-300 text-gray-700 text-sm rounded-lg px-3 py-2 h-10 outline-none cursor-pointer whitespace-nowrap"
          >
            <option value="crypto" className="bg-gray-200">Cryptocurrency</option>
            <option value="stock" className="bg-gray-200">Stocks</option>
            <option value="forex" className="bg-gray-200">Forex</option>
          </select> */}
        </div>

        {/* Right: Controls */}
        <div className="flex items-center justify-end space-x-2 flex-wrap sm:space-x-3">
          {/* Mobile search */}
          <div className="lg:hidden">
            <button className="h-9 w-9 rounded-full flex items-center justify-center bg-gray-100 border border-gray-200 hover:bg-gray-200 transition">
              <Search className="h-4 w-4 text-gray-600" />
            </button>
          </div>

          <LanguageSelectorButton />
          {user && <NotificationBell />}

          {/* Avatar Dropdown OR Login/Register */}
          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center space-x-3 bg-transparent rounded-md px-2 py-1 hover:bg-gray-100 transition-colors">
                  <Avatar className="h-8 w-8 rounded">
                    <AvatarFallback className="bg-blue-600 text-white font-semibold">
                      {user.username.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="hidden sm:flex flex-col items-start leading-tight min-w-[120px]">
                    <span className="text-sm font-medium text-gray-900">
                      {user.username}
                    </span>
                  </div>
                  <ChevronDown className="h-4 w-4 text-gray-500" />
                </button>
              </DropdownMenuTrigger>

              <DropdownMenuContent
                align="end"
                className="w-60 bg-white border border-gray-200 text-gray-900 rounded-xl shadow-xl overflow-hidden p-1"
              >
                <DropdownMenuLabel className="font-normal px-3 py-2 border-gray-200">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-semibold text-gray-900">
                      {user.username}
                    </p>
                    <p className="text-xs text-gray-500">{user.email}</p>
                  </div>
                </DropdownMenuLabel>

                {/* Profile */}
                <DropdownMenuItem
                  asChild
                  className="cursor-pointer px-3 py-2 rounded-md transition-colors bg-transparent hover:bg-gray-100 hover:text-gray-900 data-[highlighted]:bg-gray-100 data-[highlighted]:text-gray-900"
                >
                  <Link href="/profile" className="flex items-center w-full">
                    <User className="mr-2 h-4 w-4 text-gray-600" />
                    <span className="text-sm text-gray-900">Profile</span>
                  </Link>
                </DropdownMenuItem>

                {/* Admin Panel */}
                {user?.role === "admin" && (
                  <DropdownMenuItem
                    asChild
                    className="cursor-pointer px-3 py-2 hover:bg-gray-100 rounded-md transition-colors"
                  >
                    <Link href="/admin" className="flex items-center w-full">
                      <Shield className="mr-2 h-4 w-4 text-gray-600" />
                      <span className="text-sm text-gray-900">Admin Panel</span>
                    </Link>
                  </DropdownMenuItem>
                )}

                {/* Logout */}
                <DropdownMenuItem
                  onClick={handleLogout}
                  className="cursor-pointer px-3 py-2 rounded-md transition-colors bg-transparent text-red-600 hover:bg-blue-700 hover:text-white data-[highlighted]:bg-red-50 data-[highlighted]:text-red-600"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  <span className="text-sm">Logout</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <div className="flex space-x-2">
              <Button
                asChild
                className="bg-white text-gray-900 border border-gray-300 hover:bg-blue-700 hover:text-white px-6 h-9 text-sm sm:h-10 sm:text-base"
              >
                <Link href="/auth">{t("nav.login")}</Link>
              </Button>

              <Button asChild className="bg-blue-600 text-white hover:bg-blue-700 h-9 text-sm sm:h-10 sm:text-base">
                <Link href="/auth?mode=register">{t("nav.register")}</Link>
              </Button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
