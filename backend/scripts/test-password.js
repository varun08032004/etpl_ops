require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const bcrypt = require('bcrypt');

(async () => {
  const hash = '$2a$06$/fW7sw2dFlydAC82E/WcRemNk85bk6yW..UzXpK6TshEEZndraeNK';
  const result = await bcrypt.compare('Heylove03', hash);
  console.log('Heylove03:', result);
  
  const result2 = await bcrypt.compare('Heylove03@', hash);
  console.log('Heylove03@:', result2);
  
  const result3 = await bcrypt.compare('heylove03', hash);
  console.log('heylove03:', result3);
  
  process.exit(0);
})();