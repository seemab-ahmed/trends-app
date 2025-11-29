import { useState, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Search as SearchIcon, X, Coins, TrendingUp, LineChart, DollarSign } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'wouter';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';

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

// Helper function to get icon based on asset type
const getAssetIcon = (type: string) => {
  switch (type) {
    case 'crypto':
      return <Coins className="h-5 w-5 text-yellow-500" />;
    case 'stock':
      return <LineChart className="h-5 w-5 text-blue-500" />;
    case 'forex':
      return <DollarSign className="h-5 w-5 text-green-500" />;
    default:
      return <Coins className="h-5 w-5 text-primary" />;
  }
};

// Helper function to get type label
const getTypeLabel = (type: string) => {
  switch (type) {
    case 'crypto':
      return 'Crypto';
    case 'stock':
      return 'Stock';
    case 'forex':
      return 'Forex';
    default:
      return type;
  }
};

export default function AssetSearch() {
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [debounceTimer, setDebounceTimer] = useState<NodeJS.Timeout | null>(null);

  // Debounced search input (500ms delay)
  const handleSearchInput = useCallback((value: string) => {
    setSearchQuery(value);
    
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }
    
    const timer = setTimeout(() => {
      setDebouncedQuery(value);
    }, 500);
    
    setDebounceTimer(timer);
  }, [debounceTimer]);

  // Search catalog - NO PRICE CALLS
  const { data: searchResults, isLoading: isSearching } = useQuery({
    queryKey: ['/api/catalog/search', debouncedQuery],
    queryFn: async () => {
      if (!debouncedQuery || debouncedQuery.trim().length === 0) {
        return { results: [], count: 0, priceCallsMade: 0 };
      }

      const response = await fetch(
        `/api/catalog/search?q=${encodeURIComponent(debouncedQuery.trim())}&limit=50`
      );
      
      if (!response.ok) {
        throw new Error('Search failed');
      }
      
      const data = await response.json();
      console.log('[CATALOG SEARCH] Query:', debouncedQuery, 'Results:', data.count, 'Price calls:', data.priceCallsMade);
      return data;
    },
    enabled: debouncedQuery.length > 0,
    retry: 1,
  });

  const clearSearch = () => {
    setSearchQuery('');
    setDebouncedQuery('');
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }
  };

  const handleSearch = () => {
    setDebouncedQuery(searchQuery);
  };

  const coins = searchResults?.results || [];

  return (
    <div className="w-full space-y-4">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Input
            placeholder="Search for cryptocurrencies by name or symbol..."
            value={searchQuery}
            onChange={(e) => handleSearchInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            className="pr-10"
          />
          {searchQuery && (
            <Button
              variant="ghost"
              size="sm"
              className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6 p-0"
              onClick={clearSearch}
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
        <Button onClick={handleSearch} disabled={!searchQuery.trim()}>
          <SearchIcon className="h-4 w-4 mr-2" />
          Search
        </Button>
      </div>

      {isSearching && (
        <div className="space-y-4">
          <div className="text-sm text-muted-foreground">Searching catalog...</div>
          <div className="grid grid-cols-1 gap-3">
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className="h-20 w-full" />
            ))}
          </div>
        </div>
      )}

      {!isSearching && debouncedQuery && coins.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
          <h3 className="text-lg font-medium">
              Found {coins.length} asset{coins.length !== 1 ? 's' : ''}
          </h3>
            <Badge variant="outline" className="text-xs">
              {searchResults?.priceCallsMade || 0} API calls
            </Badge>
          </div>
          
          <div className="grid grid-cols-1 gap-3 max-h-96 overflow-y-auto">
            {coins.map((coin: CoinCatalogEntry) => (
              <Card key={coin.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 flex-1">
                      {coin.logoUrl ? (
                        <img 
                          src={coin.logoUrl} 
                          alt={coin.name}
                          className="w-10 h-10 rounded-full"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                          {getAssetIcon(coin.type)}
                        </div>
                      )}
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-base">{coin.name}</span>
                          <Badge variant="outline" className="text-xs">
                            {getTypeLabel(coin.type)}
                          </Badge>
                        </div>
                        <div className="text-sm text-muted-foreground flex items-center gap-2">
                          <span>{coin.symbol}</span>
                          {coin.marketCapRank && (
                            <Badge variant="secondary" className="text-xs">
                              #{coin.marketCapRank}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button asChild variant="outline" size="sm">
                        <Link href={`/assets/${encodeURIComponent(coin.coinId)}`}>
                          View Details
                        </Link>
                      </Button>
                      <Button asChild size="sm">
                        <Link href={`/predict/${encodeURIComponent(coin.coinId)}`}>
                          <TrendingUp className="h-4 w-4 mr-1" />
                          Predict
                        </Link>
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {!isSearching && debouncedQuery && coins.length === 0 && (
        <div className="text-center py-10 text-muted-foreground">
          No assets found matching "{debouncedQuery}"
        </div>
      )}

      {!debouncedQuery && (
        <div className="text-center py-10 text-muted-foreground text-sm">
          <Coins className="h-12 w-12 mx-auto mb-3 text-muted-foreground/50" />
          <p>Search for cryptocurrencies by name or symbol</p>
          <p className="text-xs mt-2">Try "bitcoin", "BTC", or "ethereum"</p>
        </div>
      )}
    </div>
  );
}
