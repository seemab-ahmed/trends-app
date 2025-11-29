/**
 * Centralized API configuration
 * This file manages the base URL for all API calls
 */

// Determine the API base URL based on environment
const getApiBaseUrl = (): string => {
  // Check if we're in development (localhost)
  if (typeof window !== "undefined") {
    // Client-side: check if we're on localhost
    if (
      window.location.hostname === "localhost" ||
      window.location.hostname === "127.0.0.1"
    ) {
      // Use relative URLs in development since Vite proxy handles the routing
      return "";
    }
    // Production: use the same domain as the frontend
    return window.location.origin;
  }

  // Server-side: use environment variable or default
  return (
    process.env.API_BASE_URL || "https://web-production-88309.up.railway.app"
  );
};

export const API_BASE_URL = "https://web-production-88309.up.railway.app"; //getApiBaseUrl();
console.log(API_BASE_URL);
// Helper function to build API URLs
export const buildApiUrl = (endpoint: string): string => {
  // Remove leading slash if present
  const cleanEndpoint = endpoint.startsWith("/") ? endpoint.slice(1) : endpoint;

  // If API_BASE_URL is empty (development with proxy), just return the endpoint with leading slash
  if (!API_BASE_URL) {
    return `/${cleanEndpoint}`;
  }

  return `${API_BASE_URL}/${cleanEndpoint}`;
};

// Common API endpoints
export const API_ENDPOINTS = {
  // Assets
  ASSETS: () => buildApiUrl("/api/assets"),
  ASSET_PRICE: (symbol: string) =>
    buildApiUrl(`/api/assets/${encodeURIComponent(symbol)}/price`),
  ASSET_LIVE_PRICE: (symbol: string) =>
    buildApiUrl(`/api/assets/${encodeURIComponent(symbol)}/live-price`),

  // Auth
  LOGIN: () => buildApiUrl("/api/auth/login"),
  REGISTER: () => buildApiUrl("/api/auth/register"),
  LOGOUT: () => buildApiUrl("/api/auth/logout"),

  // Predictions
  PREDICTIONS: () => buildApiUrl("/api/predictions"),
  PREDICTION: (id: string) => buildApiUrl(`/api/predictions/${id}`),

  // User
  USER_PROFILE: () => buildApiUrl("/api/user/profile"),
  USER_PROFILE_BY_EMAIL: (email: string) =>
    buildApiUrl(`/api/user/profile/email/${encodeURIComponent(email)}`),
  USER_PREDICTIONS: () => buildApiUrl("/api/user/predictions"),

  // Leaderboard
  LEADERBOARD: () => buildApiUrl("/api/leaderboard"),
  LEADERBOARD_COUNTDOWN: () => buildApiUrl("/api/leaderboard/countdown"),
  LEADERBOARD_MINI: () => buildApiUrl("/api/leaderboard/mini"),

  // Referral
  REFERRAL_INFO: () => buildApiUrl("/api/referral"),
  REFERRAL_GENERATE: () => buildApiUrl("/api/referral/generate"),
  REFERRAL_STATS: () => buildApiUrl("/api/referral/stats"),
  REFERRAL_ACCEPT: () => buildApiUrl("/api/referral/accept"),

  // Public feed
  FEED_PUBLIC: () => buildApiUrl("/api/feed"),

  // Sentiment
  GLOBAL_SENTIMENT: () => buildApiUrl("/api/sentiment/global"),
  GLOBAL_SENTIMENT_TOP_ASSETS: (period: string) =>
    buildApiUrl(`/api/sentiment/global/top-assets?period=${period}`),
} as const;

// Debug helper
export const logApiConfig = () => {
  console.log("API Configuration:", {
    baseUrl: API_BASE_URL,
    isLocalhost:
      typeof window !== "undefined" &&
      (window.location.hostname === "localhost" ||
        window.location.hostname === "127.0.0.1"),
    currentHost:
      typeof window !== "undefined" ? window.location.hostname : "server-side",
  });
};
