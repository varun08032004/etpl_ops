require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const bcrypt = require('bcrypt');

const hash = '$2a$06$/fW7sw2dFlydAC82E/WcRemNk85bk6yW..UzXpK6TshEEZndraeNK';

const passwords = [
  'Heylove03',
  'Heylove03@',
  'heylove03',
  'Heylove',
  'heylove',
  'Heylove03!',
  'heylove03!',
  'Heylove@123',
  'Heylove@2024',
  'EtherTrack@123',
  'admin123',
  'Admin@123',
  'password',
  'Password@123',
  'Founder@123',
  'founder@123',
];

(async () => {
  for (const pwd of passwords) {
    const result = await bcrypt.compare(pwd, hash);
    if (result) {
      console.log('FOUND:', pwd);
      break;
    } else {
      console.log('Tried:', pwd);
    }
  }
  process.exit(0);
})();