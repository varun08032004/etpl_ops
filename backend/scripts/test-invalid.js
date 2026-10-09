'use strict';

require('dotenv').config();
const axios = require('axios');

const API_BASE = 'http://localhost:5001/api';

async function testInvalid() {
  try {
    const loginRes = await axios.post(`${API_BASE}/auth/login`, {
      email: 'founder@ethertrack.in',
      password: 'password123'
    });
    const token = loginRes.data.accessToken || loginRes.data.token;

    const headers = { Authorization: `Bearer ${token}` };

    const employeesRes = await axios.get(`${API_BASE}/employees`, { headers });
    const employees = employeesRes.data.employees;
    const testEmployee = employees.find(e => e.employee_code === 'ET-EMP-0003');

    console.log('Testing invalid phone...');
    try {
      await axios.put(`${API_BASE}/employees/${testEmployee.id}`, {
        full_name: testEmployee.full_name,
        phone: '123',
      }, { headers });
    } catch (err) {
      if (err.response) {
        console.log('Status:', err.response.status);
        console.log('Data:', JSON.stringify(err.response.data, null, 2));
      } else {
        console.log('Error:', err.message);
      }
    }
  } catch (err) {
    console.error('Error:', err.message);
  }
}

testInvalid();