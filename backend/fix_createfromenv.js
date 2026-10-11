// fix_createfromenv.js
const fs = require('fs');

const filePath = 'C:\\Users\\ASUS\\Desktop\\etpl_ops\\backend\\services\\crypto\\fieldEncryption.js';
const content = fs.readFileSync(filePath, 'utf8');

const oldFunc = `function createFromEnv() {
  const activeKeyId = process.env.FIELD_ENC_KEY_ACTIVE;
  const keys = {};
  const keyMetadata = {};
  
  for (const [envVar, value] of Object.entries(process.env)) {
    const match = envVar.match(/^FIELD_ENC_KEY_(.+)$/);
    if (match) {
      const keyId = match[1];
      if (keyId === "ACTIVE") continue;
      if (value && value.length === 64 && /^[0-9a-fA-F]+$/.test(value)) {
        keys[keyId] = value;
      }
    }
  }
  
  return new FieldEncryption({
    activeKeyId,
    keys,
    keyMetadata
  });
}`;

const newFunc = `function createFromEnv() {
  const activeKeyId = process.env.FIELD_ENC_KEY_ACTIVE;
  const keys = {};
  const keyMetadata = {};
  
  for (const [envVar, value] of Object.entries(process.env)) {
    const match = envVar.match(/^FIELD_ENC_KEY_(.+)$/);
    if (match) {
      const keyId = match[1];
      if (keyId === "ACTIVE") continue;
      if (value && value.length === 64 && /^[0-9a-fA-F]+$/.test(value)) {
        keys[keyId] = value;
      }
    }
  }
  
  if (!activeKeyId) {
    throw new EncryptionError("FIELD_ENC_KEY_ACTIVE not set", "MISSING_CONFIG");
  }
  
  if (Object.keys(keys).length === 0) {
    throw new EncryptionError("No keys configured in environment", "MISSING_CONFIG");
  }
  
  return new FieldEncryption({
    activeKeyId,
    keys,
    keyMetadata
  });
}`;

const content = fs.readFileSync('C:\\Users\\ASUS\\Desktop\\etpl_ops\\backend\\services\\crypto\\fieldEncryption.js', 'utf8');
const newContent = content.replace(
  /function createFromEnv\(\) \{[\s\S]*?^\}/m,
  `function createFromEnv() {
  const activeKeyId = process.env.FIELD_ENC_KEY_ACTIVE;
  const keys = {};
  const keyMetadata = {};
  
  for (const [envVar, value] of Object.entries(process.env)) {
    const match = envVar.match(/^FIELD_ENC_KEY_(.+)$/);
    if (match) {
      const keyId = match[1];
      if (keyId === "ACTIVE") continue;
      if (value && value.length === 64 && /^[0-9a-fA-F]+$/.test(value)) {
        keys[keyId] = value;
      }
    }
  }
  
  if (!activeKeyId) {
    throw new EncryptionError("FIELD_ENC_KEY_ACTIVE not set", "MISSING_CONFIG");
  }
  
  if (Object.keys(keys).length === 0) {
    throw new EncryptionError("No keys configured in environment", "MISSING_CONFIG");
  }
  
  return new FieldEncryption({
    activeKeyId,
    keys,
    keyMetadata
  });
}`
);

fs.writeFileSync('C:\\Users\\ASUS\\Desktop\\etpl_ops\\backend\\services\\crypto\\fieldEncryption.js', content, 'utf8');
console.log('Fixed createFromEnv');