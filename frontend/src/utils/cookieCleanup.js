import client from '../api/client';

/**
 * Call this on app startup or before login to clear stale cookies
 * from previous deployments with different cookie paths.
 */
export async function clearStaleCookies() {
  try {
    const response = await client.post('/auth/clear-stale-cookies');
    console.log('[cookieCleanup] Stale cookies cleared:', response.data);
    return response.data;
  } catch (err) {
    console.warn('[cookieCleanup] Failed to clear stale cookies:', err.message);
    return { ok: false, error: err.message };
  }
}

/**
 * Force clear cookies client-side as a fallback
 * (in case server endpoint is unreachable)
 */
export function forceClearCookiesClientSide() {
  const cookieNames = ['internal_ops_token', 'internal_ops_refresh', 'trusted_device_id', 'pending_device_id'];
  const paths = ['/', '/api/', '/api/v1/', '/api/auth/'];
  
  for (const name of cookieNames) {
    for (const path of paths) {
      document.cookie = `${name}=; Path=${path}; Expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax`;
      document.cookie = `${name}=; Path=${path}; Expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=None; Secure`;
    }
  }
  console.log('[cookieCleanup] Client-side cookie clearing attempted');
}