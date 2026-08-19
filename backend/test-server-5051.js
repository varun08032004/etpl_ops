require('dotenv').config();
const express = require('express');
const app = express();

app.get('/health', (req, res) => res.json({ ok: true }));

const PORT = 5051;
app.listen(PORT, '127.0.0.1', () => {
  console.log(`[internal-ops] listening on 127.0.0.1:${PORT}`);
});