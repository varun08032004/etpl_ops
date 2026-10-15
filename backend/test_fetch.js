require('dotenv').config({ path: '.env' });
const pc = require('./services/platformClient');
pc.fetchPlanPrices().then(r => { console.log('Prices:', r.length); process.exit(0); }).catch(e => { console.error(e); process.exit(1); });