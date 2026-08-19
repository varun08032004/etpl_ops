require('dotenv').config();
const express = require('express');
const app = express();

app.get('/health', (req, res) => res.json({ ok: true }));

const PORT = process.env.INTERNAL_OPS_PORT || 5050;
app.listen(PORT, '127.0.0.1', () => {
  console.log(`[internal-ops] listening on 127.0.0.1:${PORT}`);
});