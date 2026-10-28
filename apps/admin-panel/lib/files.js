// Saving screenshots (payment proof). Photos arrive as data URLs inside a JSON request, so the "JSON only" protection against
// other websites still applies. Only real images are kept, with random names, in DATA_DIR/uploads.
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const MAX_BYTES = 5 * 1024 * 1024;
const EXT = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
const NAME_RE = /^[a-f0-9]{32}\.(jpg|png|webp)$/;
const TYPE = { jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp' };

const looksLike = (ext, b) =>
  (ext === 'jpg' && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) ||
  (ext === 'png' && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) ||
  (ext === 'webp' && b.slice(0, 4).toString() === 'RIFF' && b.slice(8, 12).toString() === 'WEBP');

function saveDataUrl(dataDir, dataUrl) {
  const m = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(String(dataUrl || ''));
  if (!m) return { error: 'Upload a photo (JPG, PNG or WebP)' };
  const buf = Buffer.from(m[2], 'base64');
  if (!buf.length) return { error: 'The photo is empty' };
  if (buf.length > MAX_BYTES) return { error: 'The photo is too big (5 MB at most)' };
  const ext = EXT[m[1]];
  if (!looksLike(ext, buf)) return { error: 'That file is not a real photo' };
  const dir = path.join(dataDir, 'uploads');
  fs.mkdirSync(dir, { recursive: true });
  const name = crypto.randomBytes(16).toString('hex') + '.' + ext;
  fs.writeFileSync(path.join(dir, name), buf);
  return { name };
}

// the full path of a saved file, or null when the name is not one we made
const filePath = (dataDir, name) => (NAME_RE.test(String(name)) ? path.join(dataDir, 'uploads', String(name)) : null);
const contentType = (name) => TYPE[String(name).split('.').pop()] || 'application/octet-stream';

module.exports = { saveDataUrl, filePath, contentType, MAX_BYTES };
