import { auth } from '@/lib/firebase';

/**
 * Get Firebase ID token for API authentication
 */
export async function getFirebaseIdToken(): Promise<string | null> {
  try {
    if (!auth.currentUser) {
      console.log('🔐 No current user for Firebase ID token');
      return null;
    }
    
    const token = await auth.currentUser.getIdToken();
    console.log('🔐 Firebase ID token obtained');
    return token;
  } catch (error) {
    console.error('❌ Failed to get Firebase ID token:', error);
    return null;
  }
}

/**
 * Create authenticated fetch headers
 */
export async function getAuthHeaders(): Promise<HeadersInit> {
  const token = await getFirebaseIdToken();
  
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  return headers;
}

/**
 * Authenticated fetch function
 */
export async function authenticatedFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const headers = await getAuthHeaders();
  
  return fetch(url, {
    ...options,
    headers: {
      ...headers,
      ...options.headers,
    },
    credentials: 'include', // Keep cookies for session-based auth fallback
  });
}
