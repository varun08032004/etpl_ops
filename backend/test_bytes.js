// test_bytes.js
const fs = require('fs');
const content = fs.readFileSync('C:\\Users\\ASUS\\Desktop\\etpl_ops\\backend\\services\\crypto\\fieldEncryption.js');

console.log('Total bytes:', content.length);

// Check the last 100 bytes
for (let i = content.length - 100; i < content.length; i++) {
  const char = String.fromCharCode(content[i]);
  const hex = content[i].toString(16).padStart(2, '0');
  console.log(`${i}: ${hex} '${char}'`);
}