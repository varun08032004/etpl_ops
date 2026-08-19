const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJkMGQ3MjM3Yy0xNTU1LTQ4NjAtODc2YS05ZDEzYjBjY2Y3ZWEiLCJyb2xlIjoib3duZXIiLCJpYXQiOjE3ODY0NTcwNTMsImV4cCI6MTc4NjQ4NTg1M30.t-anawVI2OvI_VOAyFmVYSx5NXSzED1sDIwi65SYsws';

fetch('http://localhost:5050/api/ai/health', {
  method: 'GET',
  headers: { 'Authorization': `Bearer ${token}` }
})
.then(async r => {
  console.log('Status:', r.status);
  return r.json();
})
.then(d => console.log('Health:', JSON.stringify(d, null, 2)))
.catch(e => console.error('Error:', e.message));