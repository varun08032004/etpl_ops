const fs = require('fs');
const PNG = require('pngjs').PNG;

function createIcon(width, height, text, bgColor, textColor) {
  const png = new PNG({ width, height, colorType: 6 }); // RGBA
  
  // Parse colors
  const bgR = parseInt(bgColor.slice(1, 3), 16);
  const bgG = parseInt(bgColor.slice(3, 5), 16);
  const bgB = parseInt(bgColor.slice(5, 7), 16);
  
  const textR = parseInt(textColor.slice(1, 3), 16);
  const textG = parseInt(textColor.slice(3, 5), 16);
  const textB = parseInt(textColor.slice(5, 7), 16);
  
  // Fill background
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (width * y + x) << 2;
      png.data[idx] = bgR;
      png.data[idx + 1] = bgG;
      png.data[idx + 2] = bgB;
      png.data[idx + 3] = 255;
    }
  }
  
  // Draw simple text (centered box as placeholder for text)
  // Since we don't have font rendering, draw a simple white rectangle in center
  const boxW = Math.floor(width * 0.6);
  const boxH = Math.floor(height * 0.2);
  const boxX = Math.floor((width - boxW) / 2);
  const boxY = Math.floor((height - boxH) / 2);
  
  for (let y = boxY; y < boxY + boxH; y++) {
    for (let x = boxX; x < boxX + boxW; x++) {
      const idx = (width * y + x) << 2;
      png.data[idx] = textR;
      png.data[idx + 1] = textG;
      png.data[idx + 2] = textB;
      png.data[idx + 3] = 255;
    }
  }
  
  return new Promise((resolve, reject) => {
    const buffers = [];
    png.pack()
      .on('data', (buf) => buffers.push(buf))
      .on('end', () => resolve(Buffer.concat(buffers)))
      .on('error', reject);
  });
}

async function main() {
  const icons = [
    { name: 'pwa-192.png', size: 192, text: 'ETPL' },
    { name: 'pwa-512.png', size: 512, text: 'ETPL' },
    { name: 'apple-touch-icon.png', size: 180, text: 'ETPL' },
    { name: 'dashboard-icon.png', size: 192, text: 'DASH' },
    { name: 'finance-icon.png', size: 192, text: 'FIN' },
    { name: 'sales-icon.png', size: 192, text: 'SALES' },
    { name: 'ai-icon.png', size: 192, text: 'AI' },
  ];
  
  for (const icon of icons) {
    const buf = await createIcon(icon.size, icon.size, icon.text, '#1e3a5f', '#ffffff');
    fs.writeFileSync(icon.name, buf);
    console.log(`Created ${icon.name} (${icon.size}x${icon.size})`);
  }
  
  console.log('All icons created successfully!');
}

main().catch(console.error);