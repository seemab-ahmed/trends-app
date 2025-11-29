import { db } from '../server/db';
import { assets } from '../shared/schema';
import { eq } from 'drizzle-orm';

const FINNHUB_TOKEN = 'd30rl8pr01qnu2qvbpl0d30rl8pr01qnu2qvbplg';
const FINNHUB_BASE_URL = 'https://finnhub.io/api/v1';

interface FinnhubCrypto {
  symbol: string;
  description: string;
  displaySymbol: string;
}

interface FinnhubStock {
  symbol: string;
  description: string;
  displaySymbol: string;
  type: string;
}

interface FinnhubForex {
  symbol: string;
  description: string;
  displaySymbol: string;
}

async function fetchFinnhubCrypto() {
  try {
    console.log('Fetching crypto assets from Finnhub...');
    const response = await fetch(`${FINNHUB_BASE_URL}/crypto/symbol?exchange=binance&token=${FINNHUB_TOKEN}`);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data: FinnhubCrypto[] = await response.json();
    console.log(`Found ${data.length} crypto assets`);
    return data;
  } catch (error) {
    console.error('Error fetching crypto assets:', error);
    return [];
  }
}

async function fetchFinnhubStocks() {
  try {
    console.log('Fetching stock assets from Finnhub...');
    const response = await fetch(`${FINNHUB_BASE_URL}/stock/symbol?exchange=US&token=${FINNHUB_TOKEN}`);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data: FinnhubStock[] = await response.json();
    console.log(`Found ${data.length} stock assets`);
    return data;
  } catch (error) {
    console.error('Error fetching stock assets:', error);
    return [];
  }
}

async function fetchFinnhubForex() {
  try {
    console.log('Fetching forex pairs from Finnhub...');
    const response = await fetch(`${FINNHUB_BASE_URL}/forex/symbol?exchange=oanda&token=${FINNHUB_TOKEN}`);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data: FinnhubForex[] = await response.json();
    console.log(`Found ${data.length} forex pairs`);
    return data;
  } catch (error) {
    console.error('Error fetching forex pairs:', error);
    return [];
  }
}

async function addAssetsToDatabase(assetList: any[], type: 'crypto' | 'stock' | 'forex') {
  let addedCount = 0;
  let skippedCount = 0;
  
  for (const asset of assetList) {
    try {
      // Check if asset already exists
      const existingAsset = await db.query.assets.findFirst({
        where: eq(assets.symbol, asset.symbol)
      });
      
      if (existingAsset) {
        console.log(`Asset ${asset.symbol} already exists, skipping`);
        skippedCount++;
        continue;
      }
      
      // Prepare asset data
      const assetData = {
        name: asset.description || asset.displaySymbol || asset.symbol,
        symbol: asset.symbol,
        type: type,
        apiSource: 'finnhub',
        isActive: true
      };
      
      // Insert asset
      await db.insert(assets).values(assetData);
      console.log(`Added ${type}: ${assetData.name} (${assetData.symbol})`);
      addedCount++;
      
    } catch (error) {
      console.error(`Error adding asset ${asset.symbol}:`, error);
    }
  }
  
  console.log(`\n${type.toUpperCase()} Summary:`);
  console.log(`- Added: ${addedCount}`);
  console.log(`- Skipped: ${skippedCount}`);
  console.log(`- Total processed: ${assetList.length}`);
}

async function main() {
  try {
    console.log('Starting Finnhub asset import...\n');
    
    // Fetch all asset types
    const [cryptoAssets, stockAssets, forexAssets] = await Promise.all([
      fetchFinnhubCrypto(),
      fetchFinnhubStocks(),
      fetchFinnhubForex()
    ]);
    
    // Add assets to database
    console.log('\n=== Adding Assets to Database ===\n');
    
    if (cryptoAssets.length > 0) {
      await addAssetsToDatabase(cryptoAssets, 'crypto');
      console.log('');
    }
    
    if (stockAssets.length > 0) {
      // Filter out some common unwanted stock types
      const filteredStocks = stockAssets.filter(stock => 
        stock.type === 'Common Stock' && 
        !stock.symbol.includes('.') && // Exclude preferred stocks
        stock.symbol.length <= 5 // Exclude very long symbols
      );
      
      await addAssetsToDatabase(filteredStocks, 'stock');
      console.log('');
    }
    
    if (forexAssets.length > 0) {
      await addAssetsToDatabase(forexAssets, 'forex');
      console.log('');
    }
    
    console.log('Finnhub asset import completed successfully!');
    
  } catch (error) {
    console.error('Error in main process:', error);
  }
}

// Run the script
main().catch(console.error);
