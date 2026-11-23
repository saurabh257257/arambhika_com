// Is this file whole? A picture or document that was cut off or altered on its way in (for example when Claude has to type the whole
// file out as text) is refused instead of being saved broken. Known types are checked from their own structure; the file's type
// comes from its name, never from what the sender claims.
'use strict';

const MIME = {
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', pdf: 'application/pdf',
  txt: 'text/plain', csv: 'text/csv', json: 'application/json', zip: 'application/zip',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel', doc: 'application/msword', ppt: 'application/vnd.ms-powerpoint', pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
};

const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
function crc32(buf) { let c = 0xffffffff; for (let i = 0; i < buf.length; i++) c = CRC[(c ^ buf[i]) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }

function png(b) {
  if (b.length < 33 || b.readUInt32BE(0) !== 0x89504e47 || b.readUInt32BE(4) !== 0x0d0a1a0a) return 'not a PNG picture';
  let p = 8, sawEnd = false;
  while (p + 12 <= b.length) {
    const len = b.readUInt32BE(p), type = b.toString('latin1', p + 4, p + 8);
    if (p + 12 + len > b.length) return 'the picture is cut off';
    if (crc32(b.subarray(p + 4, p + 8 + len)) !== b.readUInt32BE(p + 8 + len)) return 'the picture data is damaged';
    p += 12 + len;
    if (type === 'IEND') { sawEnd = true; break; }
  }
  return sawEnd && p === b.length ? '' : 'the picture is cut off';
}
function jpeg(b) {
  if (b.length < 4 || b[0] !== 0xff || b[1] !== 0xd8 || b[2] !== 0xff) return 'not a JPEG picture';
  let e = b.length; while (e > 2 && b[e - 1] === 0) e--; // some cameras pad the end with zeros
  return b[e - 2] === 0xff && b[e - 1] === 0xd9 ? '' : 'the picture is cut off';
}
function gif(b) { const h = b.toString('latin1', 0, 6); return (h === 'GIF87a' || h === 'GIF89a') && b[b.length - 1] === 0x3b ? '' : 'not a whole GIF picture'; }
function webp(b) { return b.length > 12 && b.toString('latin1', 0, 4) === 'RIFF' && b.toString('latin1', 8, 12) === 'WEBP' && b.readUInt32LE(4) + 8 === b.length ? '' : 'not a whole WebP picture'; }
function pdf(b) { return b.toString('latin1', 0, 5) === '%PDF-' && b.toString('latin1', Math.max(0, b.length - 1100)).includes('%%EOF') ? '' : 'the PDF is cut off'; }
function zip(b) { return b.length > 22 && b.toString('latin1', 0, 2) === 'PK' && b.toString('latin1', Math.max(0, b.length - 66000)).includes('PK\x05\x06') ? '' : 'the file is cut off'; }
const CHECK = { png, jpg: jpeg, jpeg, gif, webp, pdf, zip, xlsx: zip, docx: zip, pptx: zip };

// { ok, mime } or { ok: false, error }
function check(name, buffer) {
  if (!buffer || !buffer.length) return { ok: false, error: 'The file is empty' };
  const ext = String(name || '').toLowerCase().split('.').pop(), fn = CHECK[ext];
  const bad = fn ? fn(buffer) : '';
  if (bad) return { ok: false, error: 'This file arrived damaged (' + bad + '), so nothing was saved. Files cannot be passed through Claude reliably: add the original from the Portal page with the Add a file button.' };
  return { ok: true, mime: MIME[ext] || 'application/octet-stream' };
}

module.exports = { check, MIME, crc32 };
