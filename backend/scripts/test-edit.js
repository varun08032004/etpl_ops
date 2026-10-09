'use strict';

require('dotenv').config();
const axios = require('axios');

const API_BASE = 'http://localhost:5001/api';

async function testEdit() {
  try {
    // First login as admin/owner
    const loginRes = await axios.post(`${API_BASE}/auth/login`, {
      email: 'founder@ethertrack.in',
      password: 'password123'
    });
    const token = loginRes.data.accessToken || loginRes.data.token;
    console.log('Logged in successfully');
    console.log('Token preview:', token ? token.substring(0, 20) + '...' : 'none');

    const headers = { Authorization: `Bearer ${token}` };

    // Get employees list
    const employeesRes = await axios.get(`${API_BASE}/employees`, { headers });
    const employees = employeesRes.data.employees;
    console.log('\nEmployees:');
    employees.forEach(e => console.log(`  ${e.employee_code}: ${e.full_name} (${e.work_email}) - ${e.status}`));

    // Test editing the first employee (Archana - ET-EMP-0003)
    const testEmployee = employees[0];
    console.log(`\nTesting edit for ${testEmployee.full_name} (${testEmployee.id})`);

    // Test 1: Edit with empty strings for optional fields (should work now)
    try {
      const editRes = await axios.put(`${API_BASE}/employees/${testEmployee.id}`, {
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

      console.log('\n✓ Edit with empty strings succeeded!');
      console.log('Updated employee:', editRes.data.employee.full_name);
    } catch (err) {
      console.log('\n✗ Edit with empty strings failed:');
      if (err.response) {
        console.log('Status:', err.response.status);
        console.log('Data:', JSON.stringify(err.response.data, null, 2));
      } else {
        console.log('Error:', err.message);
      }
    }

  } catch (err) {
    console.error('\n❌ Test failed:', err.message);
    if (err.response) {
      console.error('Status:', err.response.status);
      console.error('Data:', JSON.stringify(err.response.data, null, 2));
    }
  }
}

testEdit();