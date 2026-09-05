const { createProxyMiddleware } = require('http-proxy-middleware');

module.exports = function(app) {
  app.use(
    '/api',
    createProxyMiddleware({
      target: 'http://localhost:5001',
      changeOrigin: true,
      cookieDomainRewrite: 'localhost',
      onProxyReq: (proxyReq, req, res) => {
        // Forward cookies
        if (req.headers.cookie) {
          proxyReq.setHeader('Cookie', req.headers.cookie);
        }
      },
      onProxyRes: (proxyRes, req, res) => {
        // Rewrite cookie domains for localhost
        const cookies = proxyRes.headers['set-cookie'];
        if (cookies) {
          const newCookies = cookies.map(cookie => {
            return cookie.replace(/Domain=[^;]*/g, 'Domain=localhost');
          });
          res.setHeader('set-cookie', newCookies);
        }
      },
    })
  );
};