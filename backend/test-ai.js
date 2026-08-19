async function testAI() {
  const res = await fetch('http://localhost:5060/api/ai/query', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question: 'What is the company leave policy?' })
  });
  const data = await res.json();
  console.log('Status:', res.status);
  console.log('Response:', JSON.stringify(data, null, 2));
}

testAI().catch(console.error);