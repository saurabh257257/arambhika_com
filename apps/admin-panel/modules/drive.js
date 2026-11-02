// Drive: a shared place for the whole team to keep files. Anyone signed in can make folders, upload files and download them.
// Files are stored under random names in DATA_DIR/drive; the real name, size and uploader live in the "drivefiles" collection.
// A file is only ever sent back as a download (never shown in the browser), so an uploaded web page cannot run on this site.
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { str, uid, nowISO } = require('../lib/util');

const MAX_BYTES = 20 * 1024 * 1024;
const ID_RE = /^[0-9a-f-]{36}$/;

module.exports = function drive(app, ctx) {
  const dir = path.join(ctx.store.dir, 'drive');
  const folders = () => ctx.col('drivefolders');
  const files = () => ctx.col('drivefiles');
  const cleanName = (v, max) => str(v, max).replace(/[\\/:*?"<>|\u0000-\u001f]/g, '').replace(/^\.+/, '').trim();
  const folderOk = (id) => !id || folders().some((f) => f.id === id);
  const canChange = (user, item) => user.role === 'admin' || item.createdBy === user.id;

  // one folder's contents, with the path of folders above it
  app.get('/api/drive', (req, res) => {
    const parent = String(req.query.folder || '');
    if (!folderOk(parent)) return res.status(404).json({ error: 'Folder not found' });
    const trail = [];
    for (let id = parent, n = 0; id && n < 50; n++) { const f = folders().find((x) => x.id === id); if (!f) break; trail.unshift({ id: f.id, name: f.name }); id = f.parentId; }
    const byName = (a, b) => a.name.localeCompare(b.name, 'en', { sensitivity: 'base' });
    res.json({
      trail,
      folders: folders().filter((f) => (f.parentId || '') === parent).sort(byName).map((f) => ({
        id: f.id, name: f.name, createdByName: f.createdByName, createdAt: f.createdAt, canChange: canChange(req.user, f),
        items: files().filter((x) => x.folderId === f.id).length + folders().filter((x) => x.parentId === f.id).length,
      })),
      files: files().filter((f) => (f.folderId || '') === parent).sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))).map((f) => ({
        id: f.id, name: f.name, size: f.size, createdByName: f.createdByName, createdAt: f.createdAt, canChange: canChange(req.user, f),
      })),
    });
  });

  app.post('/api/drive/folders', (req, res) => {
    const name = cleanName(req.body && req.body.name, 80);
    const parentId = String((req.body && req.body.parentId) || '');
    if (!name) return res.status(400).json({ error: 'Give the folder a name' });
    if (!folderOk(parentId)) return res.status(404).json({ error: 'Folder not found' });
    if (folders().some((f) => (f.parentId || '') === parentId && f.name.toLowerCase() === name.toLowerCase())) return res.status(400).json({ error: 'A folder with that name is already here' });
    const f = { id: uid(), name, parentId, createdBy: req.user.id, createdByName: req.user.name, createdAt: nowISO() };
    folders().push(f); ctx.save('drivefolders');
    ctx.log(req.user, 'Created the Drive folder ' + name);
    res.json({ folder: f });
  });

  app.patch('/api/drive/folders/:id', (req, res) => {
    const f = folders().find((x) => x.id === req.params.id);
    if (!f) return res.status(404).json({ error: 'Folder not found' });
    if (!canChange(req.user, f)) return res.status(403).json({ error: 'Only the person who made it, or the owner, can rename this' });
    const name = cleanName(req.body && req.body.name, 80);
    if (!name) return res.status(400).json({ error: 'Give the folder a name' });
    if (folders().some((x) => x.id !== f.id && (x.parentId || '') === (f.parentId || '') && x.name.toLowerCase() === name.toLowerCase())) return res.status(400).json({ error: 'A folder with that name is already here' });
    f.name = name; ctx.save('drivefolders');
    res.json({ folder: f });
  });

  // a folder can only be removed once it is empty, so nobody loses files by one wrong tap
  app.delete('/api/drive/folders/:id', (req, res) => {
    const list = folders(), i = list.findIndex((x) => x.id === req.params.id);
    if (i < 0) return res.status(404).json({ error: 'Folder not found' });
    if (!canChange(req.user, list[i])) return res.status(403).json({ error: 'Only the person who made it, or the owner, can remove this' });
    if (files().some((x) => x.folderId === list[i].id) || list.some((x) => x.parentId === list[i].id)) return res.status(400).json({ error: 'Empty the folder first (move or remove what is inside)' });
    const [gone] = list.splice(i, 1); ctx.save('drivefolders');
    ctx.log(req.user, 'Removed the Drive folder ' + gone.name);
    res.json({ ok: true });
  });

  // the file arrives as base64 inside JSON (the same "JSON only" protection as everything else here)
  app.post('/api/drive/files', (req, res) => {
    const b = req.body || {};
    const name = cleanName(b.name, 150);
    const folderId = String(b.folderId || '');
    if (!name) return res.status(400).json({ error: 'The file needs a name' });
    if (!folderOk(folderId)) return res.status(404).json({ error: 'Folder not found' });
    const data = String(b.data || '');
    if (!/^[A-Za-z0-9+/]*={0,2}$/.test(data)) return res.status(400).json({ error: 'That file could not be read' });
    const buf = Buffer.from(data, 'base64');
    if (!buf.length) return res.status(400).json({ error: 'The file is empty' });
    if (buf.length > MAX_BYTES) return res.status(400).json({ error: 'The file is too big (20 MB at most)' });
    fs.mkdirSync(dir, { recursive: true });
    const id = uid();
    fs.writeFileSync(path.join(dir, id), buf);
    const f = { id, name, folderId, size: buf.length, createdBy: req.user.id, createdByName: req.user.name, createdAt: nowISO() };
    files().push(f); ctx.save('drivefiles');
    ctx.log(req.user, 'Uploaded ' + name + ' to Drive');
    res.json({ file: f });
  });

  app.get('/api/drive/files/:id/download', (req, res) => {
    const f = ID_RE.test(req.params.id) && files().find((x) => x.id === req.params.id);
    const p = f && path.join(dir, f.id);
    if (!f || !fs.existsSync(p)) return res.status(404).json({ error: 'File not found' });
    res.set({
      'Content-Type': 'application/octet-stream', 'Content-Length': String(f.size), 'Cache-Control': 'private, no-store',
      'Content-Disposition': 'attachment; filename="' + f.name.replace(/[^\x20-\x7e]/g, '_').replace(/"/g, '') + '"; filename*=UTF-8\'\'' + encodeURIComponent(f.name),
    });
    fs.createReadStream(p).pipe(res);
  });

  app.patch('/api/drive/files/:id', (req, res) => {
    const f = files().find((x) => x.id === req.params.id);
    if (!f) return res.status(404).json({ error: 'File not found' });
    if (!canChange(req.user, f)) return res.status(403).json({ error: 'Only the person who uploaded it, or the owner, can change this' });
    if (req.body && req.body.name !== undefined) { const name = cleanName(req.body.name, 150); if (!name) return res.status(400).json({ error: 'The file needs a name' }); f.name = name; }
    if (req.body && req.body.folderId !== undefined) { const to = String(req.body.folderId || ''); if (!folderOk(to)) return res.status(404).json({ error: 'Folder not found' }); f.folderId = to; }
    ctx.save('drivefiles');
    res.json({ file: f });
  });

  app.delete('/api/drive/files/:id', (req, res) => {
    const list = files(), i = list.findIndex((x) => x.id === req.params.id);
    if (i < 0) return res.status(404).json({ error: 'File not found' });
    if (!canChange(req.user, list[i])) return res.status(403).json({ error: 'Only the person who uploaded it, or the owner, can remove this' });
    const [gone] = list.splice(i, 1); ctx.save('drivefiles');
    try { fs.unlinkSync(path.join(dir, gone.id)); } catch (e) { /* already gone */ }
    ctx.log(req.user, 'Removed ' + gone.name + ' from Drive');
    res.json({ ok: true });
  });
};
