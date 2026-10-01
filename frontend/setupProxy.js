const { createProxyMiddleware } = require('http-proxy-middleware');

module.exports = function(app) {
  app.use(
    '/api',
    createProxyMiddleware({
      target: 'http://localhost:5050',
      changeOrigin: true,
      onProxyReq: (proxyReq, req, res) => {
        // Forward cookies
        if (req.headers.cookie) {
          proxyReq.setHeader('Cookie', req.headers.cookie);
        }
      },
    })
  );
};