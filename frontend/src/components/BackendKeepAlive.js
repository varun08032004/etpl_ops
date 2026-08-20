import { useEffect } from 'react';

// Ping backend every 10 minutes to prevent Render spin-down
export function useBackendKeepAlive(intervalMs = 10 * 60 * 1000) {
  useEffect(() => {
    let mounted = true;
    
    const ping = async () => {
      try {
        // Use a lightweight endpoint that doesn't require auth
        await fetch(`${process.env.REACT_APP_API_BASE_URL || '/api'}/health`, {
          method: 'GET',
          credentials: 'omit', // No cookies needed for health check
        });
      } catch (e) {
        // Ignore errors - this is just to keep backend warm
        console.debug('[keepAlive] Ping failed:', e.message);
      }
    };

    const interval = setInterval(ping, intervalMs);
    ping(); // Initial ping
    
    return () => {
      clearInterval(interval);
    };
  }, []);
}

// Auto-start component (add to App.js or Layout.jsx)
export function BackendKeepAlive() {
  useBackendKeepAlive();
  return null; // Renders nothing
}