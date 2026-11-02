(function () {
  'use strict';
  var P = window.Panel, esc = P.esc;
  var MAX = 20 * 1024 * 1024;

  function size(n) { return n >= 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB'; }
  // the file as base64 text, read in pieces so a big file does not freeze the page
  function readBase64(file) {
    return new Promise(function (ok, no) {
      var r = new FileReader();
      r.onload = function () { ok(String(r.result).split(',')[1] || ''); };
      r.onerror = function () { no(new Error('Could not read ' + file.name)); };
      r.readAsDataURL(file);
    });
  }

  P.register({ id: 'drive', label: 'Drive', roles: ['admin', 'employee'], order: 99, render: function (el) {
    var folder = '';

    function load() {
      return P.api('GET', '/api/drive' + (folder ? '?folder=' + encodeURIComponent(folder) : '')).then(function (r) {
        var crumbs = '<button class="btn ghost sm" data-open="" type="button">Drive</button>' + r.trail.map(function (t) { return ' / <button class="btn ghost sm" data-open="' + t.id + '" type="button">' + esc(t.name) + '</button>'; }).join('');
        var rows = r.folders.map(function (f) {
          return '<div class="item"><div class="between"><div><button class="btn ghost sm" data-open="' + f.id + '" type="button">&#128193; <b>' + esc(f.name) + '</b></button> <span class="muted small">' + f.items + ' item' + (f.items === 1 ? '' : 's') + ' &middot; ' + P.stamp(f.createdAt, f.createdByName) + '</span></div>' +
            '<div class="actions">' + (f.canChange ? '<button class="btn ghost sm" data-rnf="' + f.id + '" data-name="' + esc(f.name) + '" type="button">Rename</button><button class="btn ghost sm" data-delf="' + f.id + '" type="button">Remove</button>' : '') + '</div></div></div>';
        }).join('') + r.files.map(function (f) {
          return '<div class="item"><div class="between"><div><b>' + esc(f.name) + '</b> <span class="muted small">' + size(f.size) + ' &middot; ' + P.stamp(f.createdAt, f.createdByName) + '</span></div>' +
            '<div class="actions"><a class="btn sm" href="/api/drive/files/' + f.id + '/download" download>Download</a>' + (f.canChange ? '<button class="btn ghost sm" data-rn="' + f.id + '" data-name="' + esc(f.name) + '" type="button">Rename</button><button class="btn ghost sm" data-del="' + f.id + '" data-name="' + esc(f.name) + '" type="button">Remove</button>' : '') + '</div></div></div>';
        }).join('');
        el.innerHTML = '<div class="card"><h3>Drive</h3><div class="muted small">Shared with the whole team. Anyone can make folders, upload files (20 MB each) and download them.</div><div>' + crumbs + '</div>' +
          '<form id="mkFolder" class="row"><label>New folder<input name="name" maxlength="80" placeholder="Folder name" required></label><button class="btn fit" type="submit">Create folder</button></form>' +
          '<div class="row"><label>Upload files here<input type="file" id="upFiles" multiple></label></div></div>' +
          '<div class="card"><div class="list">' + (rows || '<div class="muted">Nothing here yet. Create a folder or upload a file.</div>') + '</div></div>';
      });
    }

    el.addEventListener('submit', function (e) {
      if (e.target.id !== 'mkFolder') return; e.preventDefault();
      P.api('POST', '/api/drive/folders', { name: e.target.name.value, parentId: folder }).then(function () { P.toast('Folder created'); return load(); }).catch(P.fail);
    });
    el.addEventListener('change', function (e) {
      if (e.target.id !== 'upFiles') return;
      var list = [].slice.call(e.target.files), input = e.target;
      var chain = Promise.resolve();
      list.forEach(function (f) {
        chain = chain.then(function () {
          if (f.size > MAX) { P.toast(f.name + ' is over 20 MB, skipped'); return; }
          P.toast('Uploading ' + f.name + '...');
          return readBase64(f).then(function (data) { return P.api('POST', '/api/drive/files', { name: f.name, folderId: folder, data: data }); }).then(function () { P.toast('Uploaded ' + f.name); }).catch(P.fail);
        });
      });
      chain.then(function () { input.value = ''; return load(); });
    });
    el.addEventListener('click', function (e) {
      var o = e.target.closest('[data-open]'); if (o) { folder = o.dataset.open; load().catch(P.fail); return; }
      var rf = e.target.closest('[data-rnf]');
      if (rf) { var n = window.prompt('Folder name', rf.dataset.name); if (n) P.api('PATCH', '/api/drive/folders/' + rf.dataset.rnf, { name: n }).then(load).catch(P.fail); return; }
      var rn = e.target.closest('[data-rn]');
      if (rn) { var m = window.prompt('File name', rn.dataset.name); if (m) P.api('PATCH', '/api/drive/files/' + rn.dataset.rn, { name: m }).then(load).catch(P.fail); return; }
      var df = e.target.closest('[data-delf]');
      if (df) { if (window.confirm('Remove this folder? It must be empty.')) P.api('DELETE', '/api/drive/folders/' + df.dataset.delf).then(function () { P.toast('Folder removed'); return load(); }).catch(P.fail); return; }
      var d = e.target.closest('[data-del]');
      if (d && window.confirm('Remove ' + d.dataset.name + ' for everyone? This cannot be undone.')) P.api('DELETE', '/api/drive/files/' + d.dataset.del).then(function () { P.toast('File removed'); return load(); }).catch(P.fail);
    });
    return load();
  } });
})();
