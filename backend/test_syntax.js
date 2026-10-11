// Test script to verify fieldEncryption.js syntax
const vm = require('vm');
const fs = require('fs');

const content = fs.readFileSync('C:\\Users\\ASUS\\Desktop\\etpl_ops\\backend\\services\\crypto\\fieldEncryption.js', 'utf8');

console.log('Content length:', content.length);

try {
    const script = new vm.Script(content, { filename: 'fieldEncryption.js' });
    console.log('Script compiled successfully');
    
    const result = script.runInThisContext();
    console.log('Script executed successfully');
    console.log('Exports:', Object.keys(result));
} catch (e) {
    console.error('Error:', e.message);
    console.error('Stack:', e.stack);
    process.exit(1);
}