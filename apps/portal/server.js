'use strict';
require('dotenv').config();
const path = require('path');
const { createApp } = require('./app');

const PORT = Number(process.env.PORT) || 4200;
let app;
try {
  app = createApp({
    dataDir: process.env.DATA_DIR || path.join(__dirname, 'data'),
    adminPassword: process.env.ADMIN_PASSWORD || '',
    // derived, so sharing the Admin Panel's secret never lets one app's cookie work in the other
    startSync: true,
    sessionSecret: process.env.SESSION_SECRET ? require('crypto').createHmac('sha256', process.env.SESSION_SECRET).update('portal').digest('hex') : '',
  });
} catch (err) {
  console.error(err.message);
  process.exit(1);
}
app.listen(PORT, () => console.log(`Portal running on http://localhost:${PORT}`));
