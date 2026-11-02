(function () {
  'use strict';
  var P = window.Panel, esc = P.esc;
  var MAX = 20 * 1024 * 1024;

  function size(n) { return n >= 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB'; }
  // the file as base64 text
  function readBase64(file) {
    return new Promise(function (ok, no) {
      var r = new FileReader();
      r.onload = function () { ok(String(r.result).split(',')[1] || ''); };
      r.onerror = function () { no(new Error('Could not read ' + file.name)); };
      r.readAsDataURL(file);
    });
  }
  var kind = function (name) {
    var e = String(name).split('.').pop().toLowerCase();
    if (/^(png|jpe?g|gif|webp)$/.test(e)) return 'image';
    if (e === 'pdf') return 'pdf';
    if (/^(mp4|webm)$/.test(e)) return 'video';
    if (/^(mp3|wav)$/.test(e)) return 'audio';
    return 'text';
  };

  P.register({ id: 'drive', label: 'Drive', roles: ['admin', 'employee'], order: 99, render: function (el) {
    var data = { folders: [], files: [] }, open = {}, uploadTo = '', previewing = null;

    // one folder's branch: its sub-folders, then its files, indented underneath it
    function branch(parent, depth) {
      var subs = data.folders.filter(function (f) { return f.parentId === parent; });
      var fls = data.files.filter(function (f) { return f.folderId === parent; });
      return subs.map(function (f) {
        var on = open[f.id] === true, count = data.folders.filter(function (x) { return x.parentId === f.id; }).length + data.files.filter(function (x) { return x.folderId === f.id; }).length;
        return '<div class="dvnode"><div class="item dvrow"><div class="between"><div class="dvname" data-tog="' + f.id + '" role="button" tabindex="0"><span class="caret">' + (on ? '&#9662;' : '&#9656;') + '</span>&#128193; <b>' + esc(f.name) + '</b> <span class="muted small">' + count + ' item' + (count === 1 ? '' : 's') + '</span></div>' +
          '<div class="actions"><button class="btn ghost sm" data-addf="' + f.id + '" type="button">+ Folder</button><button class="btn ghost sm" data-up="' + f.id + '" type="button">Upload</button><button class="btn ghost sm" data-rnf="' + f.id + '" data-name="' + esc(f.name) + '" type="button">Rename</button><button class="btn ghost sm" data-delf="' + f.id + '" type="button">Remove</button></div></div></div>' +
          (on ? '<div class="dvkids">' + (branch(f.id) || '<div class="muted small dvempty">Empty folder</div>') + '</div>' : '') + '</div>';
      }).join('') + fls.map(function (f) {
        return '<div class="item dvrow"><div class="between"><div class="dvname">&#128196; <b>' + esc(f.name) + '</b> <span class="muted small">' + size(f.size) + ' &middot; ' + P.stamp(f.createdAt, f.createdByName) + '</span></div>' +
          '<div class="actions">' + (f.previewable ? '<button class="btn ghost sm" data-prev="' + f.id + '" type="button">Preview</button>' : '') + '<a class="btn sm" href="/api/drive/files/' + f.id + '/download" download>Download</a><button class="btn ghost sm" data-rn="' + f.id + '" data-name="' + esc(f.name) + '" type="button">Rename</button><button class="btn ghost sm" data-del="' + f.id + '" data-name="' + esc(f.name) + '" type="button">Remove</button></div></div></div>';
      }).join('');
    }

    function previewHtml() {
      if (!previewing) return '';
      var f = previewing, url = '/api/drive/files/' + f.id + '/preview', k = kind(f.name), body;
      if (k === 'image') body = '<img class="dvimg" src="' + url + '" alt="' + esc(f.name) + '">';
      else if (k === 'pdf') body = '<iframe class="dvframe" src="' + url + '" title="' + esc(f.name) + '"></iframe>';
      else if (k === 'video') body = '<video class="dvimg" src="' + url + '" controls></video>';
      else if (k === 'audio') body = '<audio src="' + url + '" controls></audio>';
      else body = '<pre class="dvtext" id="dvText">Loading...</pre>';
      return '<div class="card dvprev"><div class="between"><b>' + esc(f.name) + '</b><div class="actions"><a class="btn sm" href="/api/drive/files/' + f.id + '/download" download>Download</a><button class="btn ghost sm" data-closeprev type="button">Close</button></div></div>' + body + '</div>';
    }

    function paint() {
      el.innerHTML = '<div class="card"><h3>Drive</h3><div class="muted small">Shared with the whole team. Anyone can make folders, upload files (20 MB each), preview, download, rename and remove. Open a folder to see what is inside it.</div>' +
        '<div class="actions"><button class="btn sm" data-addf="" type="button">+ New folder</button><button class="btn sm" data-up="" type="button">Upload a file</button></div><input type="file" id="upFiles" multiple hidden></div>' +
        previewHtml() +
        '<div class="card"><div class="list">' + (branch('') || '<div class="muted">Nothing here yet. Create a folder or upload a file.</div>') + '</div></div>';
      if (previewing && kind(previewing.name) === 'text') {
        fetch('/api/drive/files/' + previewing.id + '/preview').then(function (r) { return r.text(); }).then(function (t) { var pre = el.querySelector('#dvText'); if (pre) pre.textContent = t.length > 200000 ? t.slice(0, 200000) + '\n... (preview cut short, download for the rest)' : t; });
      }
    }

    function load() {
      return P.api('GET', '/api/drive').then(function (r) { data = r; paint(); });
    }

    el.addEventListener('change', function (e) {
      if (e.target.id !== 'upFiles') return;
      var list = [].slice.call(e.target.files), input = e.target, to = uploadTo, chain = Promise.resolve();
      list.forEach(function (f) {
        chain = chain.then(function () {
          if (f.size > MAX) { P.toast(f.name + ' is over 20 MB, skipped'); return; }
          P.toast('Uploading ' + f.name + '...');
          return readBase64(f).then(function (b) { return P.api('POST', '/api/drive/files', { name: f.name, folderId: to, data: b }); }).then(function () { P.toast('Uploaded ' + f.name); }).catch(P.fail);
        });
      });
      chain.then(function () { if (to) open[to] = true; input.value = ''; return load(); });
    });
    el.addEventListener('click', function (e) {
      var t = e.target.closest('[data-tog]'); if (t) { open[t.dataset.tog] = !open[t.dataset.tog]; paint(); return; }
      var cp = e.target.closest('[data-closeprev]'); if (cp) { previewing = null; paint(); return; }
      var pv = e.target.closest('[data-prev]');
      if (pv) { previewing = data.files.filter(function (f) { return f.id === pv.dataset.prev; })[0]; paint(); window.scrollTo(0, 0); return; }
      var up = e.target.closest('[data-up]'); if (up) { uploadTo = up.dataset.up; el.querySelector('#upFiles').click(); return; }
      var af = e.target.closest('[data-addf]');
      if (af) { var nm = window.prompt('Folder name'); if (nm) P.api('POST', '/api/drive/folders', { name: nm, parentId: af.dataset.addf }).then(function () { if (af.dataset.addf) open[af.dataset.addf] = true; P.toast('Folder created'); return load(); }).catch(P.fail); return; }
      var rf = e.target.closest('[data-rnf]');
      if (rf) { var n = window.prompt('Folder name', rf.dataset.name); if (n) P.api('PATCH', '/api/drive/folders/' + rf.dataset.rnf, { name: n }).then(load).catch(P.fail); return; }
      var rn = e.target.closest('[data-rn]');
      if (rn) { var m = window.prompt('File name', rn.dataset.name); if (m) P.api('PATCH', '/api/drive/files/' + rn.dataset.rn, { name: m }).then(function () { if (previewing && previewing.id === rn.dataset.rn) previewing = null; return load(); }).catch(P.fail); return; }
      var df = e.target.closest('[data-delf]');
      if (df) { if (window.confirm('Remove this folder? It must be empty.')) P.api('DELETE', '/api/drive/folders/' + df.dataset.delf).then(function () { P.toast('Folder removed'); return load(); }).catch(P.fail); return; }
      var d = e.target.closest('[data-del]');
      if (d && window.confirm('Remove ' + d.dataset.name + ' for everyone? This cannot be undone.')) P.api('DELETE', '/api/drive/files/' + d.dataset.del).then(function () { if (previewing && previewing.id === d.dataset.del) previewing = null; P.toast('File removed'); return load(); }).catch(P.fail);
    });
    el.addEventListener('keydown', function (e) {
      var t = e.target.closest && e.target.closest('[data-tog]');
      if (t && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); open[t.dataset.tog] = !open[t.dataset.tog]; paint(); }
    });
    return load();
  } });
})();
