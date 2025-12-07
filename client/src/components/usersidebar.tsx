

import React, { useState, useCallback } from "react";
import { LayoutGrid, LineChart, Trophy, User, LogOut } from "lucide-react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { LanguageSelectorButton } from "@/components/language-selector";
import {  Shield, Search, ChevronDown } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";

interface CoinCatalogEntry {
  id: string;
  coinId: string;
  symbol: string;
  name: string;
  slug?: string;
  marketCapRank?: number;
  isActive: boolean;
  logoUrl?: string;
  type: string;
  lastUpdated?: string;
  createdAt?: string;
}

const Sidebar = () => {
  const [collapsed, setCollapsed] = useState(false);
  const [location, setLocation] = useLocation();
  const { logoutMutation } = useAuth();
   const [searchQuery, setSearchQuery] = useState("");
    const [debouncedQuery, setDebouncedQuery] = useState("");
    const [debounceTimer, setDebounceTimer] = useState<NodeJS.Timeout | null>(null);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [selectedAssetType, setSelectedAssetType] = useState<"crypto" | "stock" | "forex">("crypto");

  const btnClass = (path: string) =>
    `flex items-center gap-3 w-full ${
      collapsed ? "px-2 justify-center" : "px-6"
    } py-3 rounded-l-xl font-medium transition ${
      location === path
        ? "bg-white text-black shadow-[0_0_10px_rgba(0,0,0,0.15)]"
        : "text-white hover:bg-white hover:text-black transition-all ease-in-out duration-300"
    }`;

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
    <aside
      className={`${
        collapsed ? "w-[80px]" : "w-[256px]"
      } transition-all duration-300 h-screen bg-[#1F2A40] text-gray-300 flex flex-col justify-between py-6 pl-4`}
    >
      <div>
        {/* Logo + Toggle */}
        <div className="flex items-center gap-2 mb-8 relative">
          {/* {!collapsed && (
            <>
              <img
                src="/images/trend-logo.png"
                alt="Trend Logo"
                className="w-8 h-8"
              />
              <h1 className="text-white font-bold text-2xl">Trend</h1>
            </>
          )} */}

             <img
              src="/images/trend-logo.png"
              alt="Trend Logo"
              className="w-8 h-8"
            />
            {!collapsed && <h1 className="text-white font-bold text-2xl">Trend</h1>} 

          {/* Toggle Button */}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="absolute right-[8px] top-[-15px]  bottom-0 m-0 h-fit m-auto md:block hidden "
          >
            {collapsed ? (
              <svg
                className="w-6 h-6 text-white"
                fill="none"
                viewBox="0 0 24 24"
              >
                <path
                  stroke="currentColor"
                  strokeWidth="2"
                  d="M4 6h16M4 12h10M4 18h16"
                />
              </svg>
            ) : (
              <svg
                className="w-6 h-6 text-white"
                fill="none"
                viewBox="0 0 24 24"
              >
                <path
                  stroke="currentColor"
                  strokeWidth="2"
                  d="M6 6h12M6 12h16M6 18h12"
                />
              </svg>
            )}
          </button>
        </div>

        {/* Nav Items */}
        <nav className="flex flex-col gap-1">
          {/* searchbar mobile */}

          <div className="flex-1 relative md:hidden">
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
                        className="w-full bg-gray-50 text-gray-900 placeholder:text-gray-500 rounded-l-lg h-10 pl-10 pr-4 border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        onFocus={() => setShowSuggestions(searchQuery.length > 0)}
                      />
          
                      {/* Search Results Dropdown */}
                      {showSuggestions && (
                        <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-gray-200 rounded-lg shadow-lg z-[99] max-h-96 overflow-y-auto">
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

          <Link href="/">
            <button className={btnClass("/")}>
              <LayoutGrid size={18} />
              {!collapsed && <span>Overview</span>}
            </button>
          </Link>

          <Link href="/chart">
            <button className={btnClass("/chart")}>
              <LineChart size={18} />
              {!collapsed && <span>Chart</span>}
            </button>
          </Link>

          <Link href="/leaderboard">
            <button className={btnClass("/leaderboard")}>
              <Trophy size={18} />
              {!collapsed && <span>Leaderboard</span>}
            </button>
          </Link>
        </nav>
      </div>

      {/* Bottom */}
      <div className="flex flex-col gap-2">
        <div className="block md:hidden rounded-l-xl hover:bg-white overflow-hidden "><LanguageSelectorButton /></div>

        <Link href="/profile">
          <button className={btnClass("/profile")}>
            <User size={18} />
            {!collapsed && <span>Profile</span>}
          </button>
        </Link>

        <button
          onClick={() => logoutMutation.mutate()}
          className={`flex items-center gap-3 w-full ${
            collapsed ? "px-2 justify-center" : "px-6"
          } py-3 rounded-l-xl hover:bg-white  hover:text-black text-white transition`}
        >
          <LogOut size={18} />
          {!collapsed && <span>Logout</span>}
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;





// import React, { useState } from "react";
// import { LayoutGrid, LineChart, Trophy, User, LogOut } from "lucide-react";
// import { Link, useLocation } from "wouter";
// import { useAuth } from "@/hooks/use-auth";

// interface SidebarProps {
//   isMobile?: boolean;
// }
// const Sidebar = () => {
//   const [collapsed, setCollapsed] = useState(false);
//   const [location] = useLocation();
//   const { logoutMutation } = useAuth();

//   return (
//     <aside
//       className={`${
//         collapsed ? "w-[80px]" : "w-[240px]"
//       } transition-all duration-300 h-screen bg-[#1F2A40] text-gray-300 flex flex-col justify-between py-6 px-4`}
//     >
//       <div>
//         {/* Logo + Toggle */}
//         <div className="ml-4 flex items-center gap-2 mb-8 relative">
//           {!collapsed && (
//             <>
//               <img
//                 src="/images/trend-logo.png"
//                 alt="Trend Logo"
//                 className="w-8 h-8"
//               />
//               <h1 className="text-white font-bold text-2xl">Trend</h1>
//             </>
//           )}

//           {/* Toggle Button */}
//           <button
//             onClick={() => setCollapsed(!collapsed)}
//             className="absolute right-0 top-0 bottom-0 m-auto"
//           >
//             {collapsed ? (
//               <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24">
//                 <path stroke="currentColor" strokeWidth="2" d="M4 6h16M4 12h10M4 18h16" />
//               </svg>
//             ) : (
//               <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24">
//                 <path stroke="currentColor" strokeWidth="2" d="M6 6h12M6 12h16M6 18h12" />
//               </svg>
//             )}
//           </button>
//         </div>

//         {/* Nav Items */}
//         <nav className="flex flex-col gap-1">
//           <Link href="/">
//             <button
//               className={`flex items-center gap-3 w-full px-6 py-3 rounded-xl font-medium transition ${
//                 collapsed ? "justify-center" : ""
//               } ${location === "/" ? "bg-gray-400 text-white" : "hover:bg-gray-400 hover:text-white"}`}
//             >
//               <LayoutGrid size={18} />
//               <span className={`${collapsed ? "hidden" : "block"}`}>Overview</span>
//             </button>
//           </Link>

//           <Link href="/chart">
//             <button
//               className={`flex items-center gap-3 w-full px-6 py-3 rounded-xl font-medium transition ${
//                 collapsed ? "justify-center" : ""
//               } ${location === "/chart" ? "bg-gray-400 text-white" : "hover:bg-gray-400 hover:text-white"}`}
//             >
//               <LineChart size={18} />
//               <span className={`${collapsed ? "hidden" : "block"}`}>Chart</span>
//             </button>
//           </Link>

//           <Link href="/leaderboard">
//             <button
//               className={`flex items-center gap-3 w-full px-6 py-3 rounded-xl font-medium transition ${
//                 collapsed ? "justify-center" : ""
//               } ${location === "/leaderboard" ? "bg-gray-400 text-white" : "hover:bg-gray-400 hover:text-white"}`}
//             >
//               <Trophy size={18} />
//               <span className={`${collapsed ? "hidden" : "block"}`}>Leaderboard</span>
//             </button>
//           </Link>
//         </nav>
//       </div>

//       {/* Bottom */}
//       <div className="flex flex-col gap-2">
//         <Link href="/profile">
//           <button
//             className={`flex items-center gap-3 w-full px-6 py-3 rounded-xl transition ${
//               collapsed ? "justify-center" : ""
//             } ${location === "/profile" ? "bg-gray-400 text-white" : "hover:bg-gray-400 hover:text-white"}`}
//           >
//             <User size={18} />
//             <span className={`${collapsed ? "hidden" : "block"}`}>Profile</span>
//           </button>
//         </Link>

//         <button
//           onClick={() => logoutMutation.mutate()}
//           className={`flex items-center gap-3 w-full px-6 py-3 rounded-xl hover:bg-gray-400 hover:text-white transition ${
//             collapsed ? "justify-center" : ""
//           }`}
//         >
//           <LogOut size={18} />
//           <span className={`${collapsed ? "hidden" : "block"}`}>Logout</span>
//         </button>
//       </div>
//     </aside>
//   );
// };

// // const Sidebar: React.FC<SidebarProps> = ({ isMobile = false }) => {
// //   const [location] = useLocation();
// //   const { logoutMutation } = useAuth();
// //   const handleLogout = () => {
// //     logoutMutation.mutate();
// //   };

// //   return (
// //     <aside
// //       className={`${
// //         isMobile
// //         // bg-gradient-to-b from-gray-200 to-gray-200
// //           ? "flex flex-col h-full w-full bg-[#1F2A40] text-gray-300 justify-between py-6 px-4"
// //           : "hidden md:flex h-screen w-[240px] bg-[#1F2A40] text-gray-300 flex-col justify-between py-6 px-4"
// //       }`}
// //     >
// //       {/* bg-[#1E1F25] */}
// //       {/* Top Section */}
// //       <div>
// //         {/* Logo */}
// //         <div className="ml-8 flex items-center gap-2 mb-8 relative">
// //           <img
// //             src="/images/trend-logo.png"
// //             alt="Trend Logo"
// //             className="w-8 h-8 object-contain"
// //           />
// //           <h1 className="text-white font-bold text-2xl">Trend</h1>
// //           {/* toogle btn */}
// //           <button className="bg-transperent border-0 absolute top-0 bottom-0 right-0 m-auto">
// //             <svg className="w-6 h-6 text-white dark:text-white" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24">
// //             <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18 6H6m12 4H6m12 4H6m12 4H6"/>
// //           </svg>

// //           </button>
// //         </div>

// //         {/* Navigation */}
// //         <nav className="flex flex-col gap-1">
// //           {/* Overview */}
// //           <Link href="/" className="block">
// //             <button
// //               className={`flex items-center gap-3 w-full px-6 py-3 rounded-xl font-medium transition ${
// //                 location === "/"
// //                   ? "bg-gray-400 text-white"
// //                   : "text-white hover:bg-gray-400 hover:text-white transition-all ease-in-out duration-500"
// //               }`}
// //             >
// //               <LayoutGrid size={18} />
// //               <span>Overview</span>
// //             </button>
// //           </Link>

// //           {/* Chart */}
// //           <Link href="/chart" className="block">
// //             <button
// //               className={`flex items-center gap-3 w-full px-6 py-3 rounded-xl font-medium transition ${
// //                 location === "/chart"
// //                   ? "bg-gray-400 text-white"
// //                   : "text-white hover:bg-gray-400 hover:text-white transition-all ease-in-out duration-500"
// //               }`}
// //             >
// //               <LineChart size={18} />
// //               <span>Chart</span>
// //             </button>
// //           </Link>

// //           {/* Leaderboard */}
// //           <Link href="/leaderboard" className="block">
// //             <button
// //               className={`flex items-center gap-3 w-full px-6 py-3 rounded-xl font-medium transition ${
// //                 location === "/leaderboard"
// //                   ? "bg-gray-400 text-white"
// //                   : "text-white hover:bg-gray-400 hover:text-white transition-all ease-in-out duration-500"
// //               }`}
// //             >
// //               <Trophy size={18} />
// //               <span>Leaderboard</span>
// //             </button>
// //           </Link>
// //         </nav>
// //       </div>

// //       {/* Bottom Section */}
// //       <div className="flex flex-col gap-2 ">
// //         <Link href="/profile" className="block">
// //           <button
// //             className={`flex items-center px-6 gap-3 w-full py-3 rounded-xl font-medium transition ${
// //               location === "/profile"
// //                 ? "bg-gray-400 text-white"
// //                 : "text-white hover:bg-gray-400 hover:text-white transition-all ease-in-out duration-500"
// //             }`}
// //           >
// //             <User size={18} />
// //             <span>Profile</span>
// //           </button>
// //         </Link>

// //         <button
// //           onClick={handleLogout}
// //           className="flex items-center px-6 gap-3 w-full py-3 rounded-xl hover:bg-gray-400 hover:text-white transition-all ease-in-out duration-500  transition text-white"
// //         >
// //           <LogOut size={18} />
// //           <span>Logout</span>
// //         </button>
// //       </div>
// //     </aside>
// //   );
// // };

// export default Sidebar;