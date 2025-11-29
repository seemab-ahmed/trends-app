import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Coins, LineChart, DollarSign, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { Asset } from "@shared/schema";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";

interface AssetCardProps {
  asset: Asset;
}

export default function AssetCard({ asset }: AssetCardProps) {
  // Check if asset already has price data from CoinGecko
  const hasDirectPrice = (asset as any).currentPrice !== undefined;
  
  // Fetch real-time price for this asset from CoinGecko
  const { data: priceData, isLoading: isLoadingPrice } = useQuery<{ symbol: string; price: number }>({
    queryKey: [`coingecko-price-${asset.symbol}`],
    queryFn: async () => {
      // If asset already has price data, use it
      if (hasDirectPrice) {
        return { symbol: asset.symbol, price: (asset as any).currentPrice };
      }

      if (asset.type !== 'crypto') {
        return { symbol: asset.symbol, price: 0 };
      }

      // Map common symbols to CoinGecko IDs
      const symbolMap: { [key: string]: string } = {
        'bitcoin': 'bitcoin',
        'btc': 'bitcoin',
        'ethereum': 'ethereum',
        'eth': 'ethereum',
        'cardano': 'cardano',
        'ada': 'cardano',
        'solana': 'solana',
        'sol': 'solana',
        'polkadot': 'polkadot',
        'dot': 'polkadot',
        'avalanche-2': 'avalanche-2',
        'avax': 'avalanche-2',
        'chainlink': 'chainlink',
        'link': 'chainlink',
        'cosmos': 'cosmos',
        'atom': 'cosmos',
        'near': 'near',
        'fantom': 'fantom',
        'ftm': 'fantom',
        'algorand': 'algorand',
        'algo': 'algorand',
        'vechain': 'vechain',
        'vet': 'vechain',
        'internet-computer': 'internet-computer',
        'icp': 'internet-computer',
        'filecoin': 'filecoin',
        'fil': 'filecoin',
        'aave': 'aave',
        'uniswap': 'uniswap',
        'uni': 'uniswap',
        'sushi': 'sushi',
        'compound-governance-token': 'compound-governance-token',
        'comp': 'compound-governance-token',
        'maker': 'maker',
        'mkr': 'maker',
        'havven': 'havven',
        'snx': 'havven',
        'yearn-finance': 'yearn-finance',
        'yfi': 'yearn-finance',
        'curve-dao-token': 'curve-dao-token',
        'crv': 'curve-dao-token',
        '1inch': '1inch',
        'balancer': 'balancer',
        'bal': 'balancer',
        'republic-protocol': 'republic-protocol',
        'ren': 'republic-protocol',
        'kyber-network-crystal': 'kyber-network-crystal',
        'knc': 'kyber-network-crystal',
        '0x': '0x',
        'zrx': '0x',
        'bancor': 'bancor',
        'bnt': 'bancor',
        'loopring': 'loopring',
        'lrc': 'loopring',
        'enjincoin': 'enjincoin',
        'enj': 'enjincoin',
        'decentraland': 'decentraland',
        'mana': 'decentraland',
        'the-sandbox': 'the-sandbox',
        'sand': 'the-sandbox',
        'axie-infinity': 'axie-infinity',
        'axs': 'axie-infinity',
        'chiliz': 'chiliz',
        'chz': 'chiliz',
        'flow': 'flow',
        'theta-token': 'theta-token',
        'theta': 'theta-token',
        'tezos': 'tezos',
        'xtz': 'tezos',
        'eos': 'eos',
        'tron': 'tron',
        'trx': 'tron',
        'stellar': 'stellar',
        'xlm': 'stellar',
        'ripple': 'ripple',
        'xrp': 'ripple',
        'litecoin': 'litecoin',
        'ltc': 'litecoin',
        'bitcoin-cash': 'bitcoin-cash',
        'bch': 'bitcoin-cash',
        'dogecoin': 'dogecoin',
        'doge': 'dogecoin',
        'shiba-inu': 'shiba-inu',
        'shib': 'shiba-inu',
        'pepe': 'pepe',
        'floki': 'floki',
        'bonk': 'bonk'
      };

      const coinGeckoId = symbolMap[asset.symbol.toLowerCase()] || asset.symbol.toLowerCase();
      
      const response = await fetch(
        `https://api.coingecko.com/api/v3/simple/price?ids=${coinGeckoId}&vs_currencies=usd&x_cg_demo_api_key=CG-g77UEfUkyAFFwCRJJWFCDmSz`,
        {
          headers: {
            'User-Agent': 'Trend-App/1.0',
            'x-cg-demo-api-key': 'CG-g77UEfUkyAFFwCRJJWFCDmSz',
          },
        }
      );

      if (!response.ok) {
        throw new Error('Failed to fetch price');
      }

      const data = await response.json();
      const price = data[coinGeckoId]?.usd;

      if (price === undefined || price === null) {
        throw new Error('Price not found');
      }

      return { symbol: asset.symbol, price };
    },
    staleTime: Infinity, // Don't auto-refresh - price is fetched once
    gcTime: 5 * 60 * 1000, // Keep in cache for 5 minutes
    retry: 2,
  });

  // Fetch price history for sparkline (cached, no auto-refresh)
  const { data: priceHistory } = useQuery<Array<{ price: number; timestamp: string; source: string }>>({
    queryKey: [`/api/assets/${asset.symbol}/history`, 7], // Last 7 days
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
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
        return <TrendingUp className="h-5 w-5 text-muted-foreground" />;
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
    if (!priceHistory || priceHistory.length < 2) return <Minus className="h-4 w-4 text-muted-foreground" />;
    
    const currentPrice = priceHistory[0]?.price;
    const previousPrice = priceHistory[priceHistory.length - 1]?.price;
    
    if (!currentPrice || !previousPrice) return <Minus className="h-4 w-4 text-muted-foreground" />;
    
    const change = currentPrice - previousPrice;
    if (change > 0) return <TrendingUp className="h-4 w-4 text-green-500" />;
    if (change < 0) return <TrendingDown className="h-4 w-4 text-red-500" />;
    return <Minus className="h-4 w-4 text-muted-foreground" />;
  };

  const formatPrice = (price: number) => {
    if (asset.type === 'forex') {
      return price.toFixed(4);
    } else if (asset.type === 'crypto') {
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
    <Card className="overflow-hidden transition-all hover:shadow-md">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between">
          <span className="text-lg">{asset.name}</span>
          <span className="text-sm font-medium text-muted-foreground">{asset.symbol}</span>
        </CardTitle>
        <CardDescription className="flex items-center">
          {getAssetIcon(asset.type)}
          <span className="ml-2">{getAssetTypeLabel(asset.type)}</span>
        </CardDescription>
      </CardHeader>
      <CardContent>
        {/* Real-time Price Display */}
        <div className="mb-4">
          {isLoadingPrice ? (
            <div className="space-y-2">
              <Skeleton className="h-8 w-24" />
              <Skeleton className="h-4 w-16" />
            </div>
          ) : priceData ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-2xl font-bold">${formatPrice(priceData.price)}</span>
                {getPriceChangeIndicator()}
              </div>
              {(() => {
                const changePercent = getPriceChangePercentage();
                if (changePercent !== null) {
                  const isPositive = changePercent >= 0;
                  return (
                    <div className={`text-sm ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
                      {isPositive ? '+' : ''}{changePercent.toFixed(2)}% (7d)
                    </div>
                  );
                }
                return null;
              })()}
            </div>
          ) : (
            <div className="text-sm text-muted-foreground">Price unavailable</div>
          )}
        </div>

        {/* Asset Status */}
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center">
            <div className={`h-3 w-3 rounded-full mr-2 ${asset.isActive ? 'bg-green-500' : 'bg-muted-foreground'}`}></div>
            <span className="text-sm font-medium">
              {asset.isActive ? "Active" : "Inactive"}
            </span>
          </div>
          <div className="text-sm text-muted-foreground">
            {asset.apiSource}
          </div>
        </div>
      </CardContent>
      <CardFooter className="pt-0 space-y-2">
        <Button asChild variant="outline" className="w-full">
          <Link href={`/assets/${encodeURIComponent(asset.symbol)}`}>
            View Details
          </Link>
        </Button>
        <Button asChild className="w-full">
          <Link href={`/predict/${encodeURIComponent(asset.symbol)}`}>
            <TrendingUp className="h-4 w-4 mr-2" />
            Make Prediction
          </Link>
        </Button>
      </CardFooter>
    </Card>
  );
}
