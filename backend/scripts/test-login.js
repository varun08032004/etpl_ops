const axios = require('axios');

async function testLogin() {
  try {
    const response = await axios.post('http://127.0.0.1:5001/api/auth/login', {
      email: process.env.TEST_ADMIN_EMAIL || 'admin@ethertrack.in',
      password: process.env.TEST_ADMIN_PASSWORD || 'Heylove03'
    }, {
      withCredentials: true
    });
    console.log('Login successful:', response.data);
  } catch (err) {
    console.error('Login error:', err.response?.data || err.message);
  }
}

testLogin();