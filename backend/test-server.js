require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');

const app = express();

app.use(helmet());
app.use(cors({ origin: process.env.INTERNAL_OPS_ALLOWED_ORIGIN, credentials: true }));
app.use(cookieParser());
app.use(express.json());

app.get('/health', (req, res) => res.json({ ok: true }));

const PORT = process.env.INTERNAL_OPS_PORT || 5050;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`[internal-ops] listening on :${PORT}`);
});