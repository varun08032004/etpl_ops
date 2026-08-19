const { embedSingle } = require('../services/rag/embeddings');

embedSingle('test')
  .then(e => console.log('Embedding:', e.length, 'dimensions'))
  .catch(e => console.error('Error:', e.message));