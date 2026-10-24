'use strict';
require('dotenv').config();
const path = require('path');
const { createApp } = require('./app');

const PORT = Number(process.env.PORT) || 4100;
let app;
try {
  app = createApp({
    dataDir: process.env.DATA_DIR || path.join(__dirname, 'data'),
    adminPassword: process.env.ADMIN_PASSWORD || '',
    sessionSecret: process.env.SESSION_SECRET || '',
  });
} catch (err) {
  console.error(err.message);
  process.exit(1);
}
app.listen(PORT, () => console.log(`Admin panel running on http://localhost:${PORT}`));
