'use strict';

require('dotenv').config();
const axios = require('axios');

const API_BASE = 'http://localhost:5001/api';

async function testEdit() {
  try {
    const loginRes = await axios.post(`${API_BASE}/auth/login`, {
      email: 'founder@ethertrack.in',
      password: 'password123'
    });
    const token = loginRes.data.accessToken || loginRes.data.token;
    console.log('Logged in successfully');

    const headers = { Authorization: `Bearer ${token}` };

    const employeesRes = await axios.get(`${API_BASE}/employees`, { headers });
    const employees = employeesRes.data.employees;
    
    const testEmployee = employees.find(e => e.employee_code === 'ET-EMP-0003');
    console.log(`\nTesting edit for ${testEmployee.full_name} (${testEmployee.id})`);

    // Test 1: Edit with empty strings for optional fields
    console.log('\n--- Test 1: Edit with empty strings ---');
    let editRes = await axios.put(`${API_BASE}/employees/${testEmployee.id}`, {
      full_name: testEmployee.full_name,
      personal_email: '',
      work_email: testEmployee.work_email,
      phone: '',
      city: '',
      state: 'Maharashtra',
      pan_number: '',
      employment_type: 'full_time',
      department_id: '',
      team_id: '',
      designation_id: '',
      manager_id: '',
      bank_account_number: '',
      bank_ifsc: '',
      ctc_annual: '',
      basic_monthly: '',
      da_monthly: '',
      hra_monthly: '',
      other_allowances_monthly: '',
      tax_regime: 'new',
      pf_applicable: true,
    }, { headers });
    console.log('✓ PASSED');

    // Test 2: Edit with valid data
    console.log('\n--- Test 2: Edit with valid data ---');
    editRes = await axios.put(`${API_BASE}/employees/${testEmployee.id}`, {
      full_name: testEmployee.full_name,
      personal_email: 'personal@test.com',
      work_email: testEmployee.work_email,
      phone: '9876543210',
      city: 'Mumbai',
      state: 'Maharashtra',
      pan_number: 'ABCDE1234F',
      employment_type: 'full_time',
      ctc_annual: 1200000,
      basic_monthly: 50000,
      da_monthly: 10000,
      hra_monthly: 20000,
      other_allowances_monthly: 5000,
      tax_regime: 'new',
      pf_applicable: true,
      bank_account_number: '1234567890',
      bank_ifsc: 'HDFC0001234',
    }, { headers });
    console.log('✓ PASSED');

    // Test 3: Edit with invalid phone (should fail)
    console.log('\n--- Test 3: Edit with invalid phone ---');
    try {
      await axios.put(`${API_BASE}/employees/${testEmployee.id}`, {
        full_name: testEmployee.full_name,
        phone: '123',
      }, { headers });
      console.log('✗ FAILED - should have rejected invalid phone');
    } catch (err) {
      if (err.response && err.response.status === 400) {
        console.log('✓ PASSED - correctly rejected:', err.response.data.details?.[0]?.message || err.response.data.error);
      } else {
        console.log('✗ FAILED - unexpected error:', err.message);
      }
    }

    // Test 4: Edit with invalid email (should fail)
    console.log('\n--- Test 4: Edit with invalid email ---');
    try {
      await axios.put(`${API_BASE}/employees/${testEmployee.id}`, {
        full_name: testEmployee.full_name,
        work_email: 'invalid-email',
      }, { headers });
      console.log('✗ FAILED - should have rejected invalid email');
    } catch (err) {
      if (err.response && err.response.status === 400) {
        console.log('✓ PASSED - correctly rejected:', err.response.data.details?.[0]?.message || err.response.data.error);
      } else {
        console.log('✗ FAILED - unexpected error:', err.message);
      }
    }

    // Test 5: Edit with invalid PAN (should fail)
    console.log('\n--- Test 5: Edit with invalid PAN ---');
    try {
      await axios.put(`${API_BASE}/employees/${testEmployee.id}`, {
        full_name: testEmployee.full_name,
        pan_number: 'INVALID',
      }, { headers });
      console.log('✗ FAILED - should have rejected invalid PAN');
    } catch (err) {
      if (err.response && err.response.status === 400) {
        console.log('✓ PASSED - correctly rejected:', err.response.data.details?.[0]?.message || err.response.data.error);
      } else {
        console.log('✗ FAILED - unexpected error:', err.message);
      }
    }

    // Test 6: Edit with invalid UUID (should fail)
    console.log('\n--- Test 6: Edit with invalid UUID ---');
    try {
      await axios.put(`${API_BASE}/employees/${testEmployee.id}`, {
        full_name: testEmployee.full_name,
        department_id: 'not-a-uuid',
      }, { headers });
      console.log('✗ FAILED - should have rejected invalid UUID');
    } catch (err) {
      if (err.response && err.response.status === 400) {
        console.log('✓ PASSED - correctly rejected:', err.response.data.details?.[0]?.message || err.response.data.error);
      } else {
        console.log('✗ FAILED - unexpected error:', err.message);
      }
    }

    // Test 7: Edit with invalid money (should fail)
    console.log('\n--- Test 7: Edit with invalid money (too many decimals) ---');
    try {
      await axios.put(`${API_BASE}/employees/${testEmployee.id}`, {
        full_name: testEmployee.full_name,
        ctc_annual: 123456.789,
      }, { headers });
      console.log('✗ FAILED - should have rejected invalid money');
    } catch (err) {
      if (err.response && err.response.status === 400) {
        console.log('✓ PASSED - correctly rejected:', err.response.data.details?.[0]?.message || err.response.data.error);
      } else {
        console.log('✗ FAILED - unexpected error:', err.message);
      }
    }

    console.log('\n✅ All tests completed!');

  } catch (err) {
    console.error('\n❌ Test failed:', err.message);
    if (err.response) {
      console.error('Status:', err.response.status);
      console.error('Data:', JSON.stringify(err.response.data, null, 2));
    }
  }
}

testEdit();