const bcrypt = require('bcrypt');

const hash = '$2b$12$Dzw5cxgrWQReHXnZTkJSOO5Ma4C3PXnZj0wHcvFg0FRKIOvRxa9ny';

(async () => {
  console.log('Heylove03:', await bcrypt.compare('Heylove03', hash));
  console.log('admin1234:', await bcrypt.compare('admin1234', hash));
  console.log('Admin1234:', await bcrypt.compare('Admin1234', hash));
  console.log('heylove03:', await bcrypt.compare('heylove03', hash));
  console.log('Heylove:', await bcrypt.compare('Heylove', hash));
  console.log('admin:', await bcrypt.compare('admin', hash));
  console.log('password:', await bcrypt.compare('password', hash));
})();