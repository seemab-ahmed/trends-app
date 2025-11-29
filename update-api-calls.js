#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Files to update (excluding the ones we already updated)
const filesToUpdate = [
  'client/src/components/analyst-consensus-card.tsx',
  'client/src/components/enhanced-prediction-form.tsx',
  'client/src/pages/prediction-page.tsx',
  'client/src/components/global-sentiment-card.tsx',
  'client/src/components/enhanced-slot-display.tsx',
  'client/src/pages/profile-page.tsx',
  'client/src/pages/password-reset-page.tsx',
  'client/src/pages/leaderboard-page.tsx',
  'client/src/pages/email-verification-page.tsx',
  'client/src/pages/auth-page.tsx',
  'client/src/pages/admin-page.tsx',
  'client/src/hooks/use-auth.tsx',
  'client/src/components/sentiment-chart.tsx',
  'client/src/components/profile-edit-form.tsx',
  'client/src/components/prediction-history.tsx',
  'client/src/components/password-reset-request-form.tsx',
  'client/src/components/password-change-form.tsx',
  'client/src/components/month-countdown.tsx'
];

// API endpoint mappings
const apiMappings = {
  '/api/assets': 'API_ENDPOINTS.ASSETS()',
  '/api/auth/login': 'API_ENDPOINTS.LOGIN()',
  '/api/auth/register': 'API_ENDPOINTS.REGISTER()',
  '/api/auth/logout': 'API_ENDPOINTS.LOGOUT()',
  '/api/predictions': 'API_ENDPOINTS.PREDICTIONS()',
  '/api/user/profile': 'API_ENDPOINTS.USER_PROFILE()',
  '/api/user/predictions': 'API_ENDPOINTS.USER_PREDICTIONS()',
};

// Pattern to match API calls
const apiCallPattern = /fetch\(['"`](\/api\/[^'"`]+)['"`]/g;

function updateFile(filePath) {
  try {
    const fullPath = path.join(__dirname, filePath);
    
    if (!fs.existsSync(fullPath)) {
      console.log(`File not found: ${filePath}`);
      return;
    }

    let content = fs.readFileSync(fullPath, 'utf8');
    let hasChanges = false;

    // Check if API_ENDPOINTS is already imported
    const hasApiConfigImport = content.includes('from "@/lib/api-config"') || content.includes("from '@/lib/api-config'");
    
    // Add import if not present
    if (!hasApiConfigImport) {
      // Find the last import statement
      const importMatch = content.match(/import.*from.*['"`][^'"`]+['"`];?\s*$/gm);
      if (importMatch) {
        const lastImport = importMatch[importMatch.length - 1];
        const lastImportIndex = content.lastIndexOf(lastImport) + lastImport.length;
        content = content.slice(0, lastImportIndex) + '\nimport { API_ENDPOINTS } from "@/lib/api-config";' + content.slice(lastImportIndex);
        hasChanges = true;
      }
    }

    // Replace API calls
    content = content.replace(apiCallPattern, (match, apiPath) => {
      // Check if it's a dynamic API call (contains variables)
      if (apiPath.includes('${') || apiPath.includes('$')) {
        // For dynamic calls, use buildApiUrl
        const dynamicPath = apiPath.replace(/`/g, '').replace(/\$\{/g, '${');
        return `fetch(buildApiUrl(\`${dynamicPath}\`))`;
      }
      
      // For static calls, use API_ENDPOINTS
      const endpointKey = Object.keys(apiMappings).find(key => apiPath.startsWith(key));
      if (endpointKey) {
        const remainingPath = apiPath.substring(endpointKey.length);
        if (remainingPath) {
          // Dynamic endpoint with additional path
          return `fetch(\`\${${apiMappings[endpointKey]}}\${${JSON.stringify(remainingPath)}}\`)`;
        } else {
          return `fetch(${apiMappings[endpointKey]})`;
        }
      }
      
      // Fallback for unmapped endpoints
      return `fetch(buildApiUrl('${apiPath}'))`;
    });

    // Add buildApiUrl import if we used it
    if (content.includes('buildApiUrl') && !content.includes('buildApiUrl')) {
      const importMatch = content.match(/import.*API_ENDPOINTS.*from.*['"`][^'"`]+['"`];?\s*$/m);
      if (importMatch) {
        content = content.replace(importMatch[0], importMatch[0].replace('API_ENDPOINTS', 'API_ENDPOINTS, buildApiUrl'));
      }
    }

    if (hasChanges || content !== fs.readFileSync(fullPath, 'utf8')) {
      fs.writeFileSync(fullPath, content);
      console.log(`✅ Updated: ${filePath}`);
    } else {
      console.log(`⏭️  No changes needed: ${filePath}`);
    }
  } catch (error) {
    console.error(`❌ Error updating ${filePath}:`, error.message);
  }
}

console.log('🔄 Updating API calls to use centralized configuration...\n');

filesToUpdate.forEach(updateFile);

console.log('\n✅ API call updates completed!');
