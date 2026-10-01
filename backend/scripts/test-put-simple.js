const http = require('http');

async function main() {
  const loginData = JSON.stringify({ email: 'founder@ethertrack.in', password: 'password123' });
  
  const loginOptions = {
    hostname: 'localhost',
    port: 5001,
    path: '/api/auth/login',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(loginData)
    }
  };
  
  const loginReq = http.request(loginOptions, (res) => {
    let data = '';
    res.on('data', (chunk) => { data += chunk; });
    res.on('end', () => {
      console.log('Login status:', res.statusCode);
      
      const cookies = res.headers['set-cookie'];
      if (cookies) {
        const cookieMap = {};
        cookies.forEach(c => {
          const [nameValue] = c.split(';');
          const [name, value] = nameValue.split('=');
          cookieMap[name] = value;
        });
        const cookieHeader = Object.entries(cookieMap).map(([k, v]) => `${k}=${v}`).join('; ');
        
        const updateData = JSON.stringify({
          content: { format: 'markdown', text: '# Test' }
        });
        
        const updateOptions = {
          hostname: 'localhost',
          port: 5001,
          path: '/api/training/lessons/158b3bac-7c66-4d63-992e-59f182778663',
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(updateData),
            'Cookie': cookieHeader
          }
        };
        
        const updateReq = http.request(updateOptions, (updateRes) => {
          let updateData = '';
          updateRes.on('data', (chunk) => { updateData += chunk; });
          updateRes.on('end', () => {
            console.log('\nPUT /lessons/:id status:', updateRes.statusCode);
            console.log('Response:', updateData);
          });
        });
        
        updateReq.on('error', (e) => console.error('Update error:', e.message));
        updateReq.write(updateData);
        updateReq.end();
      }
    });
  });
  
  loginReq.on('error', (e) => console.error('Login error:', e.message));
  loginReq.write(loginData);
  loginReq.end();
}

main();