'use strict';

require('dotenv').config();
const axios = require('axios');

const API_BASE = 'http://localhost:5001/api';

async function test() {
  try {
    const loginRes = await axios.post(`${API_BASE}/auth/login`, {
      email: 'founder@ethertrack.in',
      password: 'password123'
    });
    const token = loginRes.data.accessToken || loginRes.data.token;
    const headers = { Authorization: `Bearer ${token}` };

    // Test GET tiers
    const tiersRes = await axios.get(`${API_BASE}/org-hierarchy-tiers`, { headers });
    console.log('✓ GET /org-hierarchy-tiers');
    console.table(tiersRes.data.tiers);

    // Test GET designations (should include tier info now)
    const desRes = await axios.get(`${API_BASE}/designations`, { headers });
    console.log('\n✓ GET /designations (with tier info)');
    console.table(desRes.data.designations.slice(0, 5));

    console.log('\n✅ API tests passed!');
  } catch (err) {
    console.error('❌ Test failed:', err.message);
    if (err.response) {
      console.error('Status:', err.response.status);
      console.error('Data:', err.response.data);
    }
  }
}

test();