const { createCanvas } = require('canvas');
const fs = require('fs');

function makeIcon(size, text, bg) {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = '#fff';
  ctx.font = `bold ${size/3}px Arial`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, size/2, size/2 + size/12);
  return canvas.toBuffer('image/png');
}

fs.writeFileSync('pwa-192.png', makeIcon(192, 'ETPL', '#1e3a5f'));
fs.writeFileSync('pwa-512.png', makeIcon(512, 'ETPL', '#1e3a5f'));
fs.writeFileSync('apple-touch-icon.png', makeIcon(192, 'ETPL', '#1e3a5f'));
fs.writeFileSync('dashboard-icon.png', makeIcon(192, '📊', '#1e3a5f'));
fs.writeFileSync('finance-icon.png', makeIcon(192, '💰', '#1e3a5f'));
fs.writeFileSync('sales-icon.png', makeIcon(192, '📈', '#1e3a5f'));
fs.writeFileSync('ai-icon.png', makeIcon(192, '🤖', '#1e3a5f'));
console.log('Icons created');