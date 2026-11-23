// Uploads: one shared place for the whole team's files. Anyone signed in (members and the admin) can make folders, add files,
// download them (a folder downloads as a zip), rename and remove. Files sit under random names in DATA_DIR/uploads; the real
// name, size and who added them are in the database. A file is only ever sent back as a download, never shown by the page.
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const filecheck = require('./filecheck');

const MAX_BYTES = 50 * 1024 * 1024;
const now = () => new Date().toISOString();
const id = () => crypto.randomUUID();
const cleanName = (v, max) => String(v == null ? '' : v).replace(/[\\/:*?"<>|\u0000-\u001f]/g, '').replace(/^\.+/, '').trim().slice(0, max);

module.exports = function makeUploads({ get, all, run, audit, plain, dataDir }) {
  const dir = path.join(dataDir, 'uploads');
  fs.mkdirSync(dir, { recursive: true });
  const folderRow = (fid) => get('SELECT * FROM up_folders WHERE id = ?', String(fid || ''));
  const sameName = (a, b) => String(a).toLowerCase() === String(b).toLowerCase();

  return {
    UPLOAD_MAX: MAX_BYTES,
    uploadsTree() {
      return {
        folders: all('SELECT id, name, parent_id, by_name, at FROM up_folders ORDER BY name COLLATE NOCASE').map(plain),
        files: all('SELECT id, name, folder_id, size, by_name, at FROM up_files ORDER BY name COLLATE NOCASE').map(plain),
      };
    },
    addUploadFolder(name, parentId, by) {
      name = cleanName(name, 80); parentId = String(parentId || '');
      if (!name) return { error: 'Give the folder a name' };
      if (parentId && !folderRow(parentId)) return { error: 'Folder not found', status: 404 };
      if (all('SELECT name FROM up_folders WHERE parent_id = ?', parentId).some((f) => sameName(f.name, name))) return { error: 'A folder with that name is already here' };
      const f = { id: id(), name, parent_id: parentId, by_name: by.name, at: now() };
      run('INSERT INTO up_folders (id, name, parent_id, by_name, at) VALUES (?, ?, ?, ?, ?)', f.id, f.name, f.parent_id, f.by_name, f.at);
      audit(by.id, 'Created the Uploads folder ' + name);
      return { folder: f };
    },
    renameUploadFolder(fid, name, by) {
      const f = folderRow(fid); if (!f) return { error: 'Folder not found', status: 404 };
      name = cleanName(name, 80); if (!name) return { error: 'Give the folder a name' };
      if (all('SELECT id, name FROM up_folders WHERE parent_id = ?', f.parent_id).some((x) => x.id !== f.id && sameName(x.name, name))) return { error: 'A folder with that name is already here' };
      run('UPDATE up_folders SET name = ? WHERE id = ?', name, f.id);
      audit(by.id, 'Renamed the Uploads folder ' + f.name + ' to ' + name);
      return { ok: true };
    },
    // only an empty folder can be removed, so nobody loses files with one wrong tap
    deleteUploadFolder(fid, by) {
      const f = folderRow(fid); if (!f) return { error: 'Folder not found', status: 404 };
      if (get('SELECT id FROM up_files WHERE folder_id = ?', f.id) || get('SELECT id FROM up_folders WHERE parent_id = ?', f.id)) return { error: 'Empty the folder first (remove what is inside)' };
      run('DELETE FROM up_folders WHERE id = ?', f.id);
      audit(by.id, 'Removed the Uploads folder ' + f.name);
      return { ok: true };
    },
    addUploadFile({ name, folderId, buffer }, by) {
      name = cleanName(name, 150); folderId = String(folderId || '');
      if (!name) return { error: 'The file needs a name' };
      if (folderId && !folderRow(folderId)) return { error: 'Folder not found', status: 404 };
      if (!buffer || !buffer.length) return { error: 'The file is empty' };
      if (buffer.length > MAX_BYTES) return { error: 'The file is too big (50 MB at most)' };
      const ck = filecheck.check(name, buffer); if (!ck.ok) return { error: ck.error };
      const f = { id: id(), name, folder_id: folderId, size: buffer.length, by_name: by.name, at: now() };
      fs.writeFileSync(path.join(dir, f.id), buffer);
      run('INSERT INTO up_files (id, name, folder_id, size, by_name, at) VALUES (?, ?, ?, ?, ?, ?)', f.id, f.name, f.folder_id, f.size, f.by_name, f.at);
      audit(by.id, 'Uploaded ' + name + ' to Uploads');
      return { file: f };
    },
    renameUploadFile(fid, name, by) {
      const f = get('SELECT * FROM up_files WHERE id = ?', String(fid || '')); if (!f) return { error: 'File not found', status: 404 };
      name = cleanName(name, 150); if (!name) return { error: 'The file needs a name' };
      run('UPDATE up_files SET name = ? WHERE id = ?', name, f.id);
      audit(by.id, 'Renamed Uploads file ' + f.name + ' to ' + name);
      return { ok: true };
    },
    deleteUploadFile(fid, by) {
      const f = get('SELECT * FROM up_files WHERE id = ?', String(fid || '')); if (!f) return { error: 'File not found', status: 404 };
      run('DELETE FROM up_files WHERE id = ?', f.id);
      try { fs.unlinkSync(path.join(dir, f.id)); } catch (e) { /* already gone */ }
      audit(by.id, 'Removed ' + f.name + ' from Uploads');
      return { ok: true };
    },
    uploadFile(fid) {
      const f = plain(get('SELECT * FROM up_files WHERE id = ?', String(fid || '')));
      return f ? { ...f, path: path.join(dir, f.id) } : null;
    },
    uploadFolder: (fid) => plain(folderRow(fid)),
    // everything under a folder as zip entries, with the folder's own name at the top (empty folders are kept too)
    uploadZipEntries(fid) {
      const root = folderRow(fid); if (!root) return null;
      const folders = all('SELECT id, name, parent_id FROM up_folders').map(plain), files = all('SELECT id, name, folder_id FROM up_files ORDER BY name COLLATE NOCASE').map(plain);
      const entries = [], walk = (fold, prefix) => {
        entries.push({ name: prefix, dir: true });
        const used = new Set();
        for (const f of files.filter((x) => x.folder_id === fold.id)) {
          let n = f.name, k = 1; while (used.has(n.toLowerCase())) { const e = path.extname(f.name); n = f.name.slice(0, f.name.length - e.length) + ' (' + (++k) + ')' + e; }
          used.add(n.toLowerCase()); entries.push({ name: prefix + n, file: path.join(dir, f.id) });
        }
        for (const s of folders.filter((x) => x.parent_id === fold.id)) walk(s, prefix + s.name + '/');
      };
      walk(root, root.name + '/');
      return { name: root.name, entries };
    },
  };
};
