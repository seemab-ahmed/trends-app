import { db } from './db';
import { coinCatalog } from '../shared/schema';
import { eq, or, ilike, desc, sql } from 'drizzle-orm';
import dotenv from 'dotenv';
dotenv.config({ path: '../.env' });

// CoinGecko API configuration
const COINGECKO_API_KEY = process.env.COINGECKO_API_KEY;
const COINGECKO_BASE_URL = 'https://api.coingecko.com/api/v3';

// Logger for monitoring search and price calls
function logEvent(eventType: 'search' | 'price', details: any) {
  console.log(`[${new Date().toISOString()}] ${eventType.toUpperCase()}:`, JSON.stringify(details));
}

/**
 * Populate the coin catalog from CoinGecko
 * This should be called once per day via scheduled job
 */
export async function populateCoinCatalog(limit: number = 250) {
  try {
    console.log(`Fetching top ${limit} coins from CoinGecko for catalog...`);
    
    const cgHeaders: Record<string, string> = { 'User-Agent': 'Trend-App/1.0' };
    if (COINGECKO_API_KEY) cgHeaders['x-cg-demo-api-key'] = COINGECKO_API_KEY;
    
    const response = await fetch(
      `${COINGECKO_BASE_URL}/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=${limit}&page=1&sparkline=false` +
      (COINGECKO_API_KEY ? `&x_cg_demo_api_key=${COINGECKO_API_KEY}` : ''),
      { headers: cgHeaders }
    );

    if (!response.ok) {
      console.error(`Failed to fetch coin catalog from CoinGecko: ${response.statusText}`);
      return { success: false, error: response.statusText };
    }

    const coins = await response.json();
    console.log(`Fetched ${coins.length} coins from CoinGecko`);

    let addedCount = 0;
    let updatedCount = 0;

    for (const coin of coins) {
      try {
        // Check if coin already exists
        const existingCoin = await db.query.coinCatalog.findFirst({
          where: eq(coinCatalog.coinId, coin.id),
        });

        if (existingCoin) {
          // Update existing coin
          await db
            .update(coinCatalog)
            .set({
              symbol: coin.symbol.toUpperCase(),
              name: coin.name,
              slug: coin.id,
              marketCapRank: coin.market_cap_rank || null,
              logoUrl: coin.image || null,
              isActive: true,
              lastUpdated: new Date(),
            })
            .where(eq(coinCatalog.coinId, coin.id));
          updatedCount++;
        } else {
          // Insert new coin
          await db.insert(coinCatalog).values({
            coinId: coin.id,
            symbol: coin.symbol.toUpperCase(),
            name: coin.name,
            slug: coin.id,
            marketCapRank: coin.market_cap_rank || null,
            logoUrl: coin.image || null,
            isActive: true,
            type: 'crypto',
            lastUpdated: new Date(),
          });
          addedCount++;
        }
      } catch (error) {
        console.error(`Error processing coin ${coin.id}:`, error);
      }
    }

    console.log(`Catalog update completed: ${addedCount} added, ${updatedCount} updated`);
    return { success: true, added: addedCount, updated: updatedCount };
  } catch (error) {
    console.error('Error populating coin catalog:', error);
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}

/**
 * Search the local coin catalog with fuzzy matching
 * NO PRICE CALLS - Pure metadata search only
 */
export async function searchCoinCatalog(query: string, limit: number = 50) {
  try {
    const startTime = Date.now();
    logEvent('search', { query, limit, timestamp: new Date().toISOString() });

    if (!query || query.trim().length === 0) {
      return [];
    }

    const searchQuery = query.trim().toLowerCase();

    // Disambiguation rules:
    // 1. Exact symbol match (highest priority)
    // 2. Exact name match
    // 3. Partial symbol match
    // 4. Partial name match
    // Within each category, sort by market cap rank (lower is better)

    const exactSymbolMatches = await db
      .select()
      .from(coinCatalog)
      .where(
        sql`LOWER(${coinCatalog.symbol}) = ${searchQuery}`
      )
      .orderBy(coinCatalog.marketCapRank)
      .limit(limit);

    if (exactSymbolMatches.length > 0) {
      const duration = Date.now() - startTime;
      logEvent('search', { 
        query, 
        resultsCount: exactSymbolMatches.length, 
        matchType: 'exact_symbol',
        duration: `${duration}ms`,
        priceCallsMade: 0
      });
      return exactSymbolMatches;
    }

    const exactNameMatches = await db
      .select()
      .from(coinCatalog)
      .where(
        sql`LOWER(${coinCatalog.name}) = ${searchQuery}`
      )
      .orderBy(coinCatalog.marketCapRank)
      .limit(limit);

    if (exactNameMatches.length > 0) {
      const duration = Date.now() - startTime;
      logEvent('search', { 
        query, 
        resultsCount: exactNameMatches.length, 
        matchType: 'exact_name',
        duration: `${duration}ms`,
        priceCallsMade: 0
      });
      return exactNameMatches;
    }

    // Partial matches with fuzzy search
    const partialMatches = await db
      .select()
      .from(coinCatalog)
      .where(
        or(
          ilike(coinCatalog.symbol, `%${searchQuery}%`),
          ilike(coinCatalog.name, `%${searchQuery}%`)
        )
      )
      .orderBy(coinCatalog.marketCapRank)
      .limit(limit);

    const duration = Date.now() - startTime;
    logEvent('search', { 
      query, 
      resultsCount: partialMatches.length, 
      matchType: 'partial',
      duration: `${duration}ms`,
      priceCallsMade: 0
    });

    return partialMatches;
  } catch (error) {
    console.error('Error searching coin catalog:', error);
    logEvent('search', { query, error: error instanceof Error ? error.message : String(error), priceCallsMade: 0 });
    return [];
  }
}

/**
 * Get a single coin from catalog by coinId
 */
export async function getCoinFromCatalog(coinId: string) {
  try {
    const coin = await db.query.coinCatalog.findFirst({
      where: eq(coinCatalog.coinId, coinId),
    });
    return coin;
  } catch (error) {
    console.error('Error fetching coin from catalog:', error);
    return null;
  }
}

// Get a specific coin from catalog by symbol (e.g., "BTC", "ETH")
export async function getCoinFromCatalogBySymbol(symbol: string) {
  try {
    const coin = await db.query.coinCatalog.findFirst({
      where: eq(coinCatalog.symbol, symbol.toUpperCase()),
    });
    return coin;
  } catch (error) {
    console.error('Error fetching coin from catalog by symbol:', error);
    return null;
  }
}

/**
 * On-demand enrichment: Search CoinGecko if coin not found in catalog
 * Stores the result for future searches
 */
export async function enrichCatalogOnDemand(query: string) {
  try {
    console.log(`Enriching catalog on-demand for query: ${query}`);
    
    const cgHeaders: Record<string, string> = { 'User-Agent': 'Trend-App/1.0' };
    if (COINGECKO_API_KEY) cgHeaders['x-cg-demo-api-key'] = COINGECKO_API_KEY;
    
    const response = await fetch(
      `${COINGECKO_BASE_URL}/search?query=${encodeURIComponent(query)}` +
      (COINGECKO_API_KEY ? `&x_cg_demo_api_key=${COINGECKO_API_KEY}` : ''),
      { headers: cgHeaders }
    );

    if (!response.ok) {
      console.error(`Failed to search CoinGecko: ${response.statusText}`);
      return null;
    }

    const data = await response.json();
    
    if (!data.coins || data.coins.length === 0) {
      console.log(`No coins found for query: ${query}`);
      return null;
    }

    // Take the first result (most relevant)
    const coin = data.coins[0];

    // Check if already in catalog
    const existing = await db.query.coinCatalog.findFirst({
      where: eq(coinCatalog.coinId, coin.id),
    });

    if (!existing) {
      // Add to catalog
      const newCoin = await db.insert(coinCatalog).values({
        coinId: coin.id,
        symbol: coin.symbol.toUpperCase(),
        name: coin.name,
        slug: coin.id,
        marketCapRank: coin.market_cap_rank || null,
        logoUrl: coin.large || coin.thumb || null,
        isActive: true,
        type: 'crypto',
        lastUpdated: new Date(),
      }).returning();

      console.log(`Added coin to catalog: ${coin.name} (${coin.symbol})`);
      return newCoin[0];
    }

    return existing;
  } catch (error) {
    console.error('Error enriching catalog on-demand:', error);
    return null;
  }
}

/**
 * Fetch live price for a specific coin by coinId
 * IMPORTANT: This makes a FRESH EXTERNAL API call to CoinGecko each time
 * NO CACHING - Always returns real-time data from CoinGecko
 * This should ONLY be called when user selects an asset or submits prediction
 */
export async function fetchLivePriceForCoin(coinId: string) {
  try {
    const startTime = Date.now();
    console.log(`💰 [EXTERNAL API CALL] Fetching FRESH price from CoinGecko for: ${coinId}`);
    
    logEvent('price', { 
      coinId, 
      timestamp: new Date().toISOString(),
      trigger: 'asset_selection',
      source: 'coingecko_external_api'
    });

    const cgHeaders: Record<string, string> = { 'User-Agent': 'Trend-App/1.0' };
    if (COINGECKO_API_KEY) cgHeaders['x-cg-demo-api-key'] = COINGECKO_API_KEY;
    
    // FRESH API CALL - No cache headers
    const response = await fetch(
      `${COINGECKO_BASE_URL}/simple/price?ids=${coinId}&vs_currencies=usd&include_24hr_change=true&include_market_cap=true` +
      (COINGECKO_API_KEY ? `&x_cg_demo_api_key=${COINGECKO_API_KEY}` : ''),
      { 
        headers: cgHeaders,
        cache: 'no-store' // Prevent any HTTP caching
      }
    );

    if (!response.ok) {
      console.error(`❌ External API call failed for ${coinId}: ${response.statusText}`);
      logEvent('price', { coinId, error: response.statusText, source: 'coingecko_external_api' });
      return null;
    }

    const data = await response.json();
    const priceData = data[coinId];

    if (!priceData || !priceData.usd) {
      console.error(`❌ No price data from external API for ${coinId}`);
      logEvent('price', { coinId, error: 'no_price_data', source: 'coingecko_external_api' });
      return null;
    }

    const duration = Date.now() - startTime;
    console.log(`✅ [EXTERNAL API] Fresh CoinGecko price for ${coinId}: $${priceData.usd} (${duration}ms)`);
    
    logEvent('price', {
      coinId,
      price: priceData.usd,
      change24h: priceData.usd_24h_change,
      duration: `${duration}ms`,
      success: true,
      source: 'coingecko_external_api'
    });

    return {
      price: priceData.usd,
      change24h: priceData.usd_24h_change || 0,
      marketCap: priceData.usd_market_cap || 0,
      timestamp: new Date(),
    };
  } catch (error) {
    console.error(`❌ Error fetching external price for ${coinId}:`, error);
    logEvent('price', { coinId, error: error instanceof Error ? error.message : String(error), source: 'coingecko_external_api' });
    return null;
  }
}

/**
 * Batch fetch prices for multiple coins
 * IMPORTANT: Makes FRESH EXTERNAL API call to CoinGecko
 * Use this when showing multiple selected assets on one screen
 */
export async function fetchBatchPrices(coinIds: string[]) {
  try {
    if (coinIds.length === 0) return {};

    const startTime = Date.now();
    console.log(`💰 [EXTERNAL API CALL] Fetching FRESH batch prices from CoinGecko for ${coinIds.length} coins`);
    
    logEvent('price', { 
      type: 'batch',
      coinIds, 
      count: coinIds.length,
      timestamp: new Date().toISOString(),
      source: 'coingecko_external_api'
    });

    const cgHeaders: Record<string, string> = { 'User-Agent': 'Trend-App/1.0' };
    if (COINGECKO_API_KEY) cgHeaders['x-cg-demo-api-key'] = COINGECKO_API_KEY;
    
    const idsParam = coinIds.join(',');
    // FRESH API CALL - No cache
    const response = await fetch(
      `${COINGECKO_BASE_URL}/simple/price?ids=${idsParam}&vs_currencies=usd&include_24hr_change=true&include_market_cap=true` +
      (COINGECKO_API_KEY ? `&x_cg_demo_api_key=${COINGECKO_API_KEY}` : ''),
      { 
        headers: cgHeaders,
        cache: 'no-store' // Prevent any HTTP caching
      }
    );

    if (!response.ok) {
      console.error(`❌ External batch API call failed: ${response.statusText}`);
      logEvent('price', { type: 'batch', coinIds, error: response.statusText, source: 'coingecko_external_api' });
      return {};
    }

    const data = await response.json();
    
    const duration = Date.now() - startTime;
    console.log(`✅ [EXTERNAL API] Fresh CoinGecko batch prices received: ${coinIds.length} coins (${duration}ms)`);
    
    logEvent('price', {
      type: 'batch',
      coinIds,
      count: coinIds.length,
      duration: `${duration}ms`,
      success: true,
      source: 'coingecko_external_api'
    });

    return data;
  } catch (error) {
    console.error('❌ Error fetching external batch prices:', error);
    logEvent('price', { type: 'batch', coinIds, error: error instanceof Error ? error.message : String(error), source: 'coingecko_external_api' });
    return {};
  }
}

/**
 * Schedule daily catalog update
 */
export function scheduleCatalogUpdate() {
  // Run immediately on startup
  console.log('Running initial catalog population...');
  populateCoinCatalog(250).then(result => {
    console.log('Initial catalog population result:', result);
  });

  // Schedule daily updates at 2 AM
  const now = new Date();
  const next2AM = new Date();
  next2AM.setHours(2, 0, 0, 0);
  
  if (next2AM <= now) {
    next2AM.setDate(next2AM.getDate() + 1);
  }
  
  const timeUntilNext2AM = next2AM.getTime() - now.getTime();
  
  setTimeout(() => {
    populateCoinCatalog(250);
    
    // Then run every 24 hours
    setInterval(() => {
      populateCoinCatalog(250);
    }, 24 * 60 * 60 * 1000);
  }, timeUntilNext2AM);
  
  console.log(`Catalog update scheduled for ${next2AM.toISOString()}`);
}

