'use strict';
require('dotenv').config();
const path = require('path');
const crypto = require('crypto');
const { createApp } = require('./app');

const PORT = Number(process.env.PORT) || 4300;
let app;
try {
  app = createApp({
    dataDir: process.env.DATA_DIR || path.join(__dirname, 'data'),
    adminMobile: process.env.ADMIN_MOBILE || '8112662827',
    // derived, so sharing a secret with another app never lets one app's cookie work in the other
    sessionSecret: process.env.SESSION_SECRET ? crypto.createHmac('sha256', process.env.SESSION_SECRET).update('directory').digest('hex') : '',
    siteUrl: process.env.SITE_URL || '',
    devOtp: process.env.DEV_OTP_CODE || '',
    msg91: { authKey: process.env.MSG91_AUTHKEY || '', templateId: process.env.MSG91_TEMPLATE_ID || '', length: Number(process.env.MSG91_OTP_LENGTH) || 4, expiry: Number(process.env.MSG91_OTP_EXPIRY) || 5 },
  });
} catch (err) {
  console.error(err.message);
  process.exit(1);
}
app.listen(PORT, () => console.log(`Lithium Directory running on http://localhost:${PORT}`));
