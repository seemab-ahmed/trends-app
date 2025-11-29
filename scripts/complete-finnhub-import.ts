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

async function addAssetsToDatabase(assetList: any[], type: 'crypto' | 'forex') {
  let addedCount = 0;
  let skippedCount = 0;
  
  for (const asset of assetList) {
    try {
      // Check if asset already exists
      const existingAsset = await db.query.assets.findFirst({
        where: eq(assets.symbol, asset.symbol)
      });
      
      if (existingAsset) {
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
    console.log('Completing Finnhub asset import...\n');
    
    // Fetch remaining asset types
    const [cryptoAssets, forexAssets] = await Promise.all([
      fetchFinnhubCrypto(),
      fetchFinnhubForex()
    ]);
    
    // Add assets to database
    console.log('\n=== Adding Remaining Assets to Database ===\n');
    
    if (cryptoAssets.length > 0) {
      await addAssetsToDatabase(cryptoAssets, 'crypto');
      console.log('');
    }
    
    if (forexAssets.length > 0) {
      await addAssetsToDatabase(forexAssets, 'forex');
      console.log('');
    }
    
    // Get final count
    const allAssets = await db.query.assets.findMany();
    console.log(`\n=== FINAL SUMMARY ===`);
    console.log(`Total assets in database: ${allAssets.length}`);
    
    const cryptoCount = allAssets.filter(a => a.type === 'crypto').length;
    const stockCount = allAssets.filter(a => a.type === 'stock').length;
    const forexCount = allAssets.filter(a => a.type === 'forex').length;
    
    console.log(`- Crypto assets: ${cryptoCount}`);
    console.log(`- Stock assets: ${stockCount}`);
    console.log(`- Forex assets: ${forexCount}`);
    
    console.log('\nFinnhub asset import completed successfully!');
    
  } catch (error) {
    console.error('Error in main process:', error);
  }
}

// Run the script
main().catch(console.error);
