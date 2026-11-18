// A zip file written straight to the response, so a big folder never has to fit in memory. Files are stored as they are (no compression).
// Each file's size and checksum are written after its bytes (a "data descriptor"), which is why they do not have to be known up front.
'use strict';
const fs = require('fs');
const { once } = require('events');

const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
const crcStep = (crc, buf) => { let c = crc; for (let i = 0; i < buf.length; i++) c = CRC[(c ^ buf[i]) & 0xff] ^ (c >>> 8); return c >>> 0; };

function dosTime(d) { return { time: (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1), date: ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate() }; }

// entries: [{ name: 'Folder/file.pdf', file: '/path/on/disk' }] or [{ name: 'Folder/Empty/', dir: true }]
async function writeZip(res, entries) {
  const out = (b) => (res.write(b) ? null : once(res, 'drain'));
  const { time, date } = dosTime(new Date());
  const central = [];
  let offset = 0;
  const send = async (b) => { offset += b.length; const w = out(b); if (w) await w; };
  for (const e of entries) {
    const name = Buffer.from(e.name, 'utf8');
    const isDir = !!e.dir;
    const h = Buffer.alloc(30);
    h.writeUInt32LE(0x04034b50, 0); h.writeUInt16LE(20, 4); h.writeUInt16LE(isDir ? 0x0800 : 0x0808, 6); h.writeUInt16LE(0, 8);
    h.writeUInt16LE(time, 10); h.writeUInt16LE(date, 12); h.writeUInt16LE(name.length, 26);
    const start = offset;
    await send(Buffer.concat([h, name]));
    let crc = 0xffffffff, size = 0;
    if (!isDir) {
      for await (const chunk of fs.createReadStream(e.file)) { crc = crcStep(crc, chunk); size += chunk.length; await send(chunk); }
      crc = (crc ^ 0xffffffff) >>> 0;
      const d = Buffer.alloc(16); d.writeUInt32LE(0x08074b50, 0); d.writeUInt32LE(crc, 4); d.writeUInt32LE(size, 8); d.writeUInt32LE(size, 12);
      await send(d);
    } else crc = 0;
    central.push({ name, isDir, crc, size, start });
  }
  const cdStart = offset;
  for (const c of central) {
    const h = Buffer.alloc(46);
    h.writeUInt32LE(0x02014b50, 0); h.writeUInt16LE(20, 4); h.writeUInt16LE(20, 6); h.writeUInt16LE(c.isDir ? 0x0800 : 0x0808, 8); h.writeUInt16LE(0, 10);
    h.writeUInt16LE(time, 12); h.writeUInt16LE(date, 14); h.writeUInt32LE(c.crc, 16); h.writeUInt32LE(c.size, 20); h.writeUInt32LE(c.size, 24);
    h.writeUInt16LE(c.name.length, 28); h.writeUInt32LE(c.isDir ? 0x10 : 0, 38); h.writeUInt32LE(c.start, 42);
    await send(Buffer.concat([h, c.name]));
  }
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(central.length, 8); end.writeUInt16LE(central.length, 10); end.writeUInt32LE(offset - cdStart, 12); end.writeUInt32LE(cdStart, 16);
  await send(end);
  res.end();
}

module.exports = { writeZip };
