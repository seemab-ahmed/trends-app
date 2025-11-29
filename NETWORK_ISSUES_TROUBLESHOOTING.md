# Network Issues Troubleshooting Guide

## Overview

You're experiencing network timeout errors with external services. These are **not bugs in your code** but connectivity issues with external APIs.

## Issues Identified

### 1. ✅ Favicon Missing (FIXED)
**Error**: `Failed to load resource: the server responded with a status of 404 (Not Found)` for `favicon.ico`

**Solution**: Added favicon.svg to `/client/public/` and updated index.html with proper favicon links.

**Status**: ✅ RESOLVED

---

### 2. ⚠️ CoinGecko API Timeouts
**Error**: 
```
api.coingecko.com/api/v3/coins/markets?vs_currency=usd...
Failed to load resource: net::ERR_TIMED_OUT
```

**Cause**: The CoinGecko API is not responding, likely due to:
- Network connectivity issues
- Rate limiting (free tier has limits)
- API server issues
- Firewall/proxy blocking requests
- VPN/network restrictions

**Impact**: Asset search shows "0 CoinGecko assets" but database assets (16,033) still work fine.

**Solutions**:

#### Option 1: Check Network Connectivity
```bash
# Test if you can reach CoinGecko
curl -I https://api.coingecko.com/api/v3/ping

# Check if there's a network proxy/firewall
ping api.coingecko.com
```

#### Option 2: Use Database Assets Only
The app already has 16,033 assets in the database, which is sufficient. You can disable CoinGecko fetching in `asset-search.tsx`:

```typescript
// In asset-search.tsx, comment out or disable CoinGecko fetching
// The database assets are already working
```

#### Option 3: Add Retry Logic with Exponential Backoff
```typescript
const fetchWithRetry = async (url: string, retries = 3, delay = 1000) => {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(10000) });
      return response;
    } catch (error) {
      if (i === retries - 1) throw error;
      await new Promise(resolve => setTimeout(resolve, delay * Math.pow(2, i)));
    }
  }
};
```

#### Option 4: Use Alternative API
Consider using alternative crypto data APIs:
- CoinMarketCap API
- Binance API
- Kraken API
- Your database (already working with 16,033 assets!)

---

### 3. ⚠️ Firebase Authentication Timeouts
**Error**: 
```
identitytoolkit.googleapis.com/v1/accounts:signInWithPassword...
Failed to load resource: net::ERR_TIMED_OUT
Firebase: Error (auth/network-request-failed)
```

**Cause**: Firebase Authentication API is not responding, likely due to:
- Network connectivity issues
- Firewall blocking Google services
- VPN/proxy interference
- DNS resolution issues
- Geographic restrictions

**Solutions**:

#### Option 1: Check Network Connectivity
```bash
# Test if you can reach Firebase
curl -I https://identitytoolkit.googleapis.com/

# Check DNS resolution
nslookup identitytoolkit.googleapis.com

# Try with Google DNS
# On macOS:
networksetup -setdnsservers Wi-Fi 8.8.8.8 8.8.4.4
```

#### Option 2: Disable VPN/Proxy Temporarily
If you're using a VPN or proxy, try disabling it temporarily to see if that resolves the issue.

#### Option 3: Check Firewall Settings
Ensure your firewall allows connections to:
- `*.googleapis.com`
- `*.firebaseio.com`
- `*.firebaseapp.com`

#### Option 4: Use Alternative DNS
Try changing your DNS to:
- Google DNS: 8.8.8.8, 8.8.4.4
- Cloudflare DNS: 1.1.1.1, 1.0.0.1

#### Option 5: Add Better Error Handling in Code

Update `use-auth.tsx` to provide better feedback:

```typescript
// In use-auth.tsx
catch (error) {
  if (error.code === 'auth/network-request-failed') {
    toast({
      title: 'Network Error',
      description: 'Cannot connect to authentication servers. Please check your internet connection or try again later.',
      variant: 'destructive',
    });
  }
  // ... rest of error handling
}
```

---

## Quick Diagnosis Commands

Run these commands to diagnose the issue:

```bash
# 1. Check internet connectivity
ping 8.8.8.8

# 2. Check if you can reach Google services
curl -I https://www.google.com

# 3. Check if you can reach Firebase
curl -I https://firebase.google.com

# 4. Check if you can reach CoinGecko
curl -I https://www.coingecko.com

# 5. Check DNS resolution
nslookup identitytoolkit.googleapis.com
nslookup api.coingecko.com

# 6. Check if there's a proxy
echo $http_proxy
echo $https_proxy

# 7. Check network interfaces
ifconfig | grep inet
```

---

## Recommended Immediate Actions

### 1. For Development (Right Now)

Since you have 16,033 assets in the database, the CoinGecko timeout is not critical. The app will work fine with database assets.

**For Firebase Auth timeouts:**

1. **Try a different network**: Switch to mobile hotspot or different WiFi
2. **Disable VPN/Proxy**: If you're using one
3. **Wait and retry**: Sometimes APIs have temporary outages
4. **Check Firebase Status**: Visit https://status.firebase.google.com/

### 2. For Production

Add proper error handling and fallbacks:

```typescript
// Example: Better error handling in asset-search.tsx
const fetchCoinGeckoAssets = async () => {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout
    
    const response = await fetch(url, { 
      signal: controller.signal,
      // Add timeout header
    });
    
    clearTimeout(timeoutId);
    return await response.json();
  } catch (error) {
    if (error.name === 'AbortError') {
      console.warn('CoinGecko request timed out, using database assets only');
    }
    return []; // Return empty array, database assets will still work
  }
};
```

---

## System Status Check

Create a simple status check page to monitor external services:

```typescript
// services-status.tsx
const checkServices = async () => {
  const services = {
    firebase: 'https://identitytoolkit.googleapis.com/',
    coingecko: 'https://api.coingecko.com/api/v3/ping',
  };
  
  for (const [name, url] of Object.entries(services)) {
    try {
      const response = await fetch(url, { method: 'HEAD', signal: AbortSignal.timeout(5000) });
      console.log(`${name}: ✅ OK (${response.status})`);
    } catch (error) {
      console.error(`${name}: ❌ FAILED`, error.message);
    }
  }
};
```

---

## Summary

| Issue | Status | Action Required |
|-------|--------|-----------------|
| Favicon 404 | ✅ Fixed | None |
| CoinGecko Timeout | ⚠️ Non-critical | Check network, use DB assets |
| Firebase Timeout | ⚠️ Critical | Check network, change DNS, disable VPN |

**Most Likely Cause**: Network connectivity issue or firewall/VPN blocking external APIs.

**Quick Test**: Try accessing these URLs in your browser:
- https://api.coingecko.com/api/v3/ping
- https://firebase.google.com/

If they don't load, it's definitely a network issue on your end.

---

## Additional Resources

- [Firebase Status](https://status.firebase.google.com/)
- [CoinGecko API Status](https://status.coingecko.com/)
- [Network Troubleshooting Guide](https://docs.google.com/document/d/network-troubleshooting)

---

## Need Help?

If the issues persist:
1. Check if you're behind a corporate firewall
2. Contact your network administrator
3. Try from a different network/location
4. Check if your ISP is blocking these services

