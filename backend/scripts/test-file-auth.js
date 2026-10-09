'use strict';

require('dotenv').config();
const axios = require('axios');

async function test() {
  // Login first
  try {
    const loginRes = await axios.post('http://localhost:5001/api/auth/login', {
      email: 'founder@ethertrack.in',
      password: 'password123'
    }, { withCredentials: true });
    
    const cookies = loginRes.headers['set-cookie'];
    console.log('Login success, cookies:', cookies);
    
    // Test the file endpoint
    const docId = 'cd4a7184-b8f4-4475-8469-a932126eaa92';
    const res = await axios.get(`http://localhost:5001/api/documents/${docId}/file`, {
      withCredentials: true,
      headers: { Cookie: cookies.join('; ') }
    });
    console.log('File endpoint status:', res.status);
    console.log('Content-Type:', res.headers['content-type']);
    console.log('Content-Length:', res.headers['content-length']);
  } catch (err) {
    console.error('Error:', err.response?.status, err.response?.data);
  }
}

test();