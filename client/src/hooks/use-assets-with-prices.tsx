import { useState, useEffect } from 'react';
import { Asset } from '@shared/schema';
import { API_ENDPOINTS } from '@/lib/api-config';

// Cache for price availability
const priceCache = new Map<string, { hasPrice: boolean; timestamp: number }>();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

/**
 * Hook that filters assets to show only those with available prices
 * @param assets - Array of assets to filter
 * @returns Object with filtered assets and loading state
 */
export function useAssetsWithPrices(assets: Asset[]) {
  const [assetsWithPrices, setAssetsWithPrices] = useState<Asset[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [checkedCount, setCheckedCount] = useState(0);

  // Check if price is available for an asset using CoinGecko API
  const checkAssetPrice = async (asset: Asset): Promise<boolean> => {
    const symbol = asset.symbol;
    
    // Check cache first
    const cached = priceCache.get(symbol);
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      return cached.hasPrice;
    }

    // Check if asset already has price data (from CoinGecko)
    if ((asset as any).currentPrice !== undefined) {
      priceCache.set(symbol, { hasPrice: true, timestamp: Date.now() });
      return true; // Show assets that already have price data
    }

    // Only check prices for crypto assets using CoinGecko
    if (asset.type !== 'crypto') {
      priceCache.set(symbol, { hasPrice: true, timestamp: Date.now() });
      return true; // Show all non-crypto assets
    }

    try {
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

      const coinGeckoId = symbolMap[symbol.toLowerCase()] || symbol.toLowerCase();
      
      // Fetch price from CoinGecko API
      const response = await fetch(
        `https://api.coingecko.com/api/v3/simple/price?ids=${coinGeckoId}&vs_currencies=usd&x_cg_demo_api_key=CG-g77UEfUkyAFFwCRJJWFCDmSz`,
        {
          headers: {
            'User-Agent': 'Trend-App/1.0',
            'x-cg-demo-api-key': 'CG-g77UEfUkyAFFwCRJJWFCDmSz',
          },
        }
      );
      
      if (response.ok) {
        const data = await response.json();
        const hasPrice = data[coinGeckoId]?.usd !== undefined && data[coinGeckoId]?.usd !== null;
        
        priceCache.set(symbol, { hasPrice, timestamp: Date.now() });
        return hasPrice;
      }
    } catch (error) {
      console.log(`Error checking price for ${symbol}:`, error);
    }

    // If API failed, assume no price for crypto assets
    priceCache.set(symbol, { hasPrice: false, timestamp: Date.now() });
    return false;
  };

  // Process assets in small batches
  const processAssets = async (assetsToCheck: Asset[]) => {
    const batchSize = 5; // Smaller batch size to avoid rate limiting
    const validAssets: Asset[] = [];
    
    for (let i = 0; i < assetsToCheck.length; i += batchSize) {
      const batch = assetsToCheck.slice(i, i + batchSize);
      
      // Process batch in parallel
      const batchPromises = batch.map(async (asset) => {
        const hasPrice = await checkAssetPrice(asset);
        return { asset, hasPrice };
      });
      
      const batchResults = await Promise.all(batchPromises);
      
      // Add assets with prices to results
      const validBatchAssets = batchResults
        .filter(result => result.hasPrice)
        .map(result => result.asset);
      
      validAssets.push(...validBatchAssets);
      
      // Update state progressively
      setAssetsWithPrices([...validAssets]);
      setCheckedCount(i + batch.length);
      
      // Small delay between batches
      if (i + batchSize < assetsToCheck.length) {
        await new Promise(resolve => setTimeout(resolve, 200)); // Increased delay to avoid rate limiting
      }
    }
    
    return validAssets;
  };

  useEffect(() => {
    if (assets.length === 0) {
      setAssetsWithPrices([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setCheckedCount(0);
    setAssetsWithPrices([]);

    processAssets(assets).finally(() => {
      setIsLoading(false);
    });
  }, [assets]);

  const progress = Math.round((checkedCount / assets.length) * 100);

  return {
    assetsWithPrices,
    isLoading,
    progress,
    checkedCount,
    totalCount: assets.length,
  };
}
