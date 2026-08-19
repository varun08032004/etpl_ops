const axios = require('axios');

async function testConfirmation() {
  try {
    // Login
    const loginResponse = await axios.post('http://127.0.0.1:5001/api/auth/login', {
      email: process.env.TEST_ADMIN_EMAIL || 'admin@ethertrack.in',
      password: process.env.TEST_ADMIN_PASSWORD || 'Heylove03'
    }, {
      withCredentials: true
    });
    
    const cookie = loginResponse.headers['set-cookie'];
    console.log('Login successful');
    
    // Test AI query that should trigger a confirmation (create_employee requires confirmation)
    const aiResponse = await axios.post('http://127.0.0.1:5001/api/ai/query', {
      question: 'Create a new employee named John Doe in Finance department'
    }, {
      withCredentials: true,
      headers: {
        Cookie: cookie.join('; ')
      }
    });
    
    console.log('AI Response:', JSON.stringify(aiResponse.data, null, 2));
  } catch (err) {
    console.error('Error:', err.response?.data || err.message);
  }
}
    });
    
    console.log('AI Response:', JSON.stringify(aiResponse.data, null, 2));
  } catch (err) {
    console.error('Error:', err.response?.data || err.message);
  }
}

testConfirmation();