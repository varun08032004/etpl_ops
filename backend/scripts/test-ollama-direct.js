fetch('http://localhost:11434/api/embeddings', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ model: 'nomic-embed-text', input: ['test'] })
})
.then(r => {
  console.log('Status:', r.status);
  return r.json();
})
.then(d => console.log('Direct Ollama:', JSON.stringify(d, null, 2)))
.catch(e => console.error('Error:', e.message));