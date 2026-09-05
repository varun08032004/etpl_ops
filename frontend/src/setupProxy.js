const { createProxyMiddleware } = require('http-proxy-middleware');

module.exports = function(app) {
  app.use(
    '/api',
    createProxyMiddleware({
      target: 'http://localhost:5001',
      changeOrigin: true,
      ws: true,
      logLevel: 'debug',
      cookieDomainRewrite: 'localhost',
      // Don't rewrite cookie paths - let backend set correct paths
      onProxyReq: (proxyReq, req, res) => {
        // Forward cookies from the client request to the backend
        if (req.headers.cookie) {
          console.log('[PROXY] >>> Forwarding cookies to backend:', req.path);
          console.log('[PROXY] >>> Cookie header:', req.headers.cookie.substring(0, 300));
          proxyReq.setHeader('cookie', req.headers.cookie);
        } else {
          console.log('[PROXY] >>> No cookies in request to:', req.path);
        }
      },
      onProxyRes: (proxyRes, req, res) => {
        // Forward Set-Cookie headers from backend to frontend
        const cookies = proxyRes.headers['set-cookie'];
        console.log('[PROXY] <<< Response from backend:', req.path, 'status:', proxyRes.statusCode);
        if (proxyRes.headers['set-cookie']) {
          const cookies = proxyRes.headers['set-cookie'];
          console.log('[PROXY] <<< Backend Set-Cookie count:', cookies.length);
          cookies.forEach((c, i) => console.log(`[PROXY] <<< Set-Cookie[${i}]:`, c.substring(0, 200)));
          res.setHeader('set-cookie', cookies);
        } else {
          console.log('[PROXY] <<< No Set-Cookie from backend for:', req.path, 'status:', proxyRes.statusCode);
        }
      },
    })
  );
};