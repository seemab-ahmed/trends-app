#!/usr/bin/env node

/**
 * Network Status Checker
 * Diagnoses connectivity issues with external services
 */

const https = require('https');
const http = require('http');
const dns = require('dns').promises;

const TIMEOUT = 10000; // 10 seconds

// Services to check
const services = [
  { name: 'Google', url: 'https://www.google.com', critical: false },
  { name: 'Firebase Auth', url: 'https://identitytoolkit.googleapis.com/', critical: true },
  { name: 'Firebase', url: 'https://firebase.google.com', critical: true },
  { name: 'CoinGecko API', url: 'https://api.coingecko.com/api/v3/ping', critical: false },
  { name: 'CoinGecko Website', url: 'https://www.coingecko.com', critical: false },
];

// DNS servers to check
const dnsServers = [
  { name: 'Current System DNS', server: null },
  { name: 'Google DNS', server: '8.8.8.8' },
  { name: 'Cloudflare DNS', server: '1.1.1.1' },
];

// Color codes for terminal
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[36m',
};

function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function checkUrl(url) {
  return new Promise((resolve) => {
    const protocol = url.startsWith('https') ? https : http;
    const startTime = Date.now();

    const req = protocol.get(url, { timeout: TIMEOUT }, (res) => {
      const duration = Date.now() - startTime;
      resolve({
        success: true,
        status: res.statusCode,
        duration,
        error: null,
      });
      res.resume(); // Consume response
    });

    req.on('error', (error) => {
      const duration = Date.now() - startTime;
      resolve({
        success: false,
        status: null,
        duration,
        error: error.message,
      });
    });

    req.on('timeout', () => {
      req.destroy();
      const duration = Date.now() - startTime;
      resolve({
        success: false,
        status: null,
        duration,
        error: 'Request timeout',
      });
    });
  });
}

async function checkDNS(hostname, server = null) {
  try {
    const options = server ? { servers: [server] } : {};
    const resolver = server ? new dns.Resolver() : dns;
    
    if (server) {
      resolver.setServers([server]);
    }

    const startTime = Date.now();
    const addresses = await (server ? resolver.resolve4(hostname) : dns.resolve4(hostname));
    const duration = Date.now() - startTime;

    return {
      success: true,
      addresses,
      duration,
      error: null,
    };
  } catch (error) {
    return {
      success: false,
      addresses: [],
      duration: 0,
      error: error.message,
    };
  }
}

async function main() {
  log('\n═══════════════════════════════════════════════════════', colors.bright);
  log('  🔍 TREND APP - NETWORK DIAGNOSTICS', colors.bright);
  log('═══════════════════════════════════════════════════════\n', colors.bright);

  // Check internet connectivity
  log('📡 Checking Internet Connectivity...', colors.blue);
  const googleCheck = await checkUrl('https://www.google.com');
  
  if (googleCheck.success) {
    log('  ✅ Internet connection: OK', colors.green);
  } else {
    log('  ❌ Internet connection: FAILED', colors.red);
    log('  ⚠️  Cannot reach the internet. Check your connection.\n', colors.yellow);
    return;
  }

  console.log();

  // Check DNS resolution
  log('🌐 Checking DNS Resolution...', colors.blue);
  const testDomain = 'identitytoolkit.googleapis.com';
  
  for (const { name, server } of dnsServers) {
    const result = await checkDNS(testDomain, server);
    if (result.success) {
      log(`  ✅ ${name}: ${result.addresses[0]} (${result.duration}ms)`, colors.green);
    } else {
      log(`  ❌ ${name}: FAILED - ${result.error}`, colors.red);
    }
  }

  console.log();

  // Check each service
  log('🔌 Checking External Services...', colors.blue);
  let criticalFailed = false;

  for (const service of services) {
    const result = await checkUrl(service.url);
    
    if (result.success) {
      const emoji = service.critical ? '✅' : '✓';
      log(`  ${emoji} ${service.name}: OK (${result.status}, ${result.duration}ms)`, colors.green);
    } else {
      const emoji = service.critical ? '❌' : '⚠️';
      log(`  ${emoji} ${service.name}: FAILED - ${result.error}`, service.critical ? colors.red : colors.yellow);
      if (service.critical) criticalFailed = true;
    }
  }

  console.log();

  // Check environment
  log('⚙️  Environment Information:', colors.blue);
  log(`  Platform: ${process.platform}`, colors.reset);
  log(`  Node Version: ${process.version}`, colors.reset);
  log(`  HTTP Proxy: ${process.env.HTTP_PROXY || process.env.http_proxy || 'None'}`, colors.reset);
  log(`  HTTPS Proxy: ${process.env.HTTPS_PROXY || process.env.https_proxy || 'None'}`, colors.reset);

  console.log();

  // Summary
  log('═══════════════════════════════════════════════════════', colors.bright);
  log('  📊 SUMMARY', colors.bright);
  log('═══════════════════════════════════════════════════════', colors.bright);

  if (!criticalFailed) {
    log('\n  ✅ All critical services are accessible!', colors.green);
    log('     Your app should work correctly.\n', colors.green);
  } else {
    log('\n  ❌ Some critical services are not accessible!', colors.red);
    log('     This will prevent login and core functionality.\n', colors.red);
    
    log('  💡 Troubleshooting Steps:', colors.yellow);
    log('     1. Check if you\'re behind a firewall or VPN', colors.reset);
    log('     2. Try disabling VPN temporarily', colors.reset);
    log('     3. Change DNS to Google DNS (8.8.8.8)', colors.reset);
    log('     4. Contact your network administrator', colors.reset);
    log('     5. Try from a different network (mobile hotspot)\n', colors.reset);
  }

  log('  📄 For more details, see: NETWORK_ISSUES_TROUBLESHOOTING.md\n', colors.blue);
}

// Run the diagnostics
main().catch(console.error);

