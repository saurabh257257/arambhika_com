(function () {
  'use strict';
  var P = window.Panel, esc = P.esc;

  P.register({ id: 'invoices', label: 'Invoices', roles: ['admin', 'employee'], order: 6, render: function (el) {
    var isAdmin = P.me.role === 'admin', filter = isAdmin ? 'needs' : 'mine', who = '', q = '', outcomes = [], timer;

    // the customer says they paid: who marked it, the photos, and an undo for that person (or the owner)
    function claimNote(i) {
      var c = i.paidClaim; if (!c) return '';
      return '<div class="paidnote"><span class="pill ok">Paid &middot; waiting for Zoho</span> <span class="stamp">' + P.stamp(c.at, c.byName) + '</span>' +
        c.proofs.map(function (f) { return '<a href="/api/files/' + esc(f.name) + '" target="_blank" rel="noopener"><img src="/api/files/' + esc(f.name) + '" alt="Payment photo" class="thumb"></a>'; }).join('') +
        (isAdmin || c.byId === P.me.id ? '<button class="btn ghost sm" data-paid="undo" type="button">Undo</button>' : '') + '</div>';
    }
    function paidPanel() {
      return '<div class="paidpanel"><div class="muted small">Add a photo of the payment or of the invoice, then mark it paid.</div>' +
        '<div class="actions"><label class="btn ghost sm" style="cursor:pointer">Choose a file<input type="file" accept="image/*" data-paidfile hidden></label><button class="btn ghost sm" type="button" data-paid="cam">Use camera</button></div>' +
        '<video data-cam playsinline muted hidden></video><div class="actions"><button class="btn sm" type="button" data-paid="snap" hidden>Take the photo</button></div><div data-preview></div>' +
        '<div class="actions"><button class="btn sm" type="button" data-paid="save" disabled>Mark as paid</button><button class="btn ghost sm" type="button" data-paid="cancel">Cancel</button></div></div>';
    }
    // photos are shrunk in the browser before they are sent
    function shrink(file, done, fail) {
      var url = URL.createObjectURL(file), img = new Image();
      img.onload = function () { var r = Math.min(1, 1600 / Math.max(img.width, img.height)), c = document.createElement('canvas'); c.width = Math.round(img.width * r); c.height = Math.round(img.height * r); c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(url); done(c.toDataURL('image/jpeg', 0.82)); };
      img.onerror = function () { URL.revokeObjectURL(url); fail(new Error('That file is not a photo')); };
      img.src = url;
    }
    function stopCam(box) { if (box && box.__stream) { box.__stream.getTracks().forEach(function (t) { t.stop(); }); box.__stream = null; } }
    function setPhoto(box, dataUrl) {
      box.__data = dataUrl; box.querySelector('[data-preview]').innerHTML = '<img src="' + dataUrl + '" alt="Photo to attach" class="thumb big">';
      box.querySelector('[data-paid="save"]').disabled = false;
    }
    function item(i) {
      var mine = i.ownerId === P.me.id, tone = i.followStatus === 'overdue' && i.needs ? 'hot' : i.followStatus === 'due' ? 'warn' : i.needs && i.compliant ? 'good' : '';
      var due = i.daysOverdue > 0 ? '<span class="err">' + i.daysOverdue + ' day' + (i.daysOverdue === 1 ? '' : 's') + ' overdue (due ' + P.fmtDate(i.dueDate) + ')</span>' : i.dueDate ? '<span>Due ' + P.fmtDate(i.dueDate) + (i.daysToDue !== null && i.daysToDue <= 7 ? ' (in ' + i.daysToDue + ' day' + (i.daysToDue === 1 ? '' : 's') + ')' : '') + '</span>' : '';
      return '<div class="item ' + tone + '" data-id="' + esc(i.id) + '"><div class="head"><b>' + esc(i.number) + ' &middot; ' + esc(i.customerName) + '</b><span class="chips"><b>' + P.money(i.balance) + '</b>' + (i.needs || i.nextDate ? P.followBadge(i.followStatus, i.nextDate) : P.pill('Not due yet', 'none')) + '</span></div>' +
        '<div class="meta">' + due + (i.phone ? '<span>&#9742; <b>' + esc(i.phone) + '</b></span>' : '') + '<span>Invoice of ' + P.money(i.total) + ' dated ' + P.fmtDate(i.date) + '</span><span>Owner: <b>' + (i.ownerId ? esc(i.ownerName) : 'nobody yet') + '</b></span></div>' +
        (i.lastAt ? '<div class="stamp">Last follow-up: <b>' + esc(i.lastOutcome) + '</b> &middot; ' + P.stamp(i.lastAt, i.lastByName) + (i.lastNote ? ' &middot; ' + esc(i.lastNote) : '') + '</div>' : (i.needs ? '<div class="stamp err">Nobody has followed this up yet</div>' : '')) +
        '<div class="actions">' + (isAdmin ? '<select data-assign style="width:auto"><option value="">Nobody</option>' + P.userOptions(i.ownerExplicit ? i.ownerId : '') + '</select>' + (!i.ownerExplicit && i.ownerId ? '<span class="stamp">(customer\'s owner)</span>' : '') : '') +
        ((mine || isAdmin) && !i.paidClaim ? '<button class="btn sm" data-paid="open" type="button">Customer paid</button>' : '') +
        (mine ? '<button class="btn sm" data-act="follow" type="button">Log a follow-up</button>' : '') + '<button class="btn ghost sm" data-act="history" type="button">History</button></div>' + claimNote(i) + '<div data-paidbox></div><div data-slot></div></div>';
    }

    function load(refresh) {
      [].forEach.call(el.querySelectorAll('[data-paidbox]'), stopCam);
      var url = '/api/invoices?filter=' + filter + (who ? '&userId=' + who : '') + (q ? '&q=' + encodeURIComponent(q) : '') + (refresh ? '&refresh=1' : '');
      return P.api('GET', url).then(function (r) {
        outcomes = r.outcomes; var s = r.summary || {};
        var seg = isAdmin ? [['needs', 'Not followed up properly'], ['overdue', 'Overdue'], ['unassigned', 'No owner'], ['all', 'All unpaid']] : [['mine', 'My invoices']];
        var focus = document.activeElement && document.activeElement.id === 'iq';
        el.innerHTML = (s.unpaid !== undefined ? '<div class="card"><div class="stats"><div class="stat"><b>' + s.unpaid + '</b><span>unpaid invoices</span></div><div class="stat"><b>' + P.money(s.outstanding) + '</b><span>to collect</span></div><div class="stat ' + (s.overdue ? 'hot' : '') + '"><b>' + s.overdue + '</b><span>overdue</span></div><div class="stat ' + (s.percent < 100 ? 'hot' : '') + '"><b>' + s.percent + '%</b><span>follow-up on track (' + s.compliant + ' of ' + s.needing + ')</span></div></div>' +
          '<div class="muted small">An invoice needs follow-up when it is overdue or due within a few days. "On track" means somebody followed it up and a next follow-up date is set, or it was followed up today.</div></div>' : '') +
          '<div class="card"><div class="between"><div class="seg">' + seg.map(function (x) { return '<button class="btn ' + (filter === x[0] ? '' : 'ghost') + '" data-f="' + x[0] + '" type="button">' + x[1] + '</button>'; }).join('') + '</div><button class="btn ghost sm" id="rf" type="button">Refresh from Zoho</button></div>' +
          '<div class="row">' + (isAdmin ? '<label>Owner<select id="iw"><option value="">Everyone</option>' + P.userOptions(who) + '</select></label>' : '') + '<label style="flex:3 1 240px">Search<input id="iq" value="' + esc(q) + '" placeholder="Invoice number, customer or phone"></label></div></div>' +
          (r.error ? '<div class="banner">Zoho did not answer: ' + esc(r.error) + '. Try "Refresh from Zoho" in a minute.</div>' : '') +
          (r.invoices.length ? '<div class="list">' + r.invoices.map(item).join('') + '</div>' : P.empty(r.error ? 'Invoices could not be loaded.' : filter === 'needs' ? 'Every invoice that needs a follow-up has one. Well done.' : 'No invoices here.'));
        if (focus) { var i = el.querySelector('#iq'); i.focus(); i.setSelectionRange(i.value.length, i.value.length); }
      });
    }
    el.addEventListener('click', function (e) {
      var f = e.target.closest('[data-f]'); if (f) { filter = f.dataset.f; load().catch(P.fail); return; }
      if (e.target.id === 'rf') { e.target.disabled = true; e.target.textContent = 'Asking Zoho...'; load(true).then(function () { P.toast('Invoices refreshed from Zoho'); }).catch(P.fail); }
    });
    el.addEventListener('click', function (e) {
      var b = e.target.closest('[data-paid]'); if (!b) return;
      var card = b.closest('[data-id]'), id = card.dataset.id, box = card.querySelector('[data-paidbox]'), act = b.dataset.paid;
      if (act === 'open') { if (box.firstChild) { stopCam(box); box.innerHTML = ''; } else box.innerHTML = paidPanel(); return; }
      if (act === 'cancel') { stopCam(box); box.innerHTML = ''; return; }
      if (act === 'cam') {
        if (!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia)) { P.toast('The camera is not available here. Choose a file instead.'); return; }
        navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } }).then(function (stream) {
          box.__stream = stream; var v = box.querySelector('[data-cam]'); v.srcObject = stream; v.hidden = false; v.play(); box.querySelector('[data-paid="snap"]').hidden = false;
        }).catch(function () { P.toast('The camera could not be opened. Allow it in the browser, or choose a file.'); });
        return;
      }
      if (act === 'snap') {
        var v = box.querySelector('[data-cam]'); if (!v.videoWidth) { P.toast('The camera is still starting. Try again.'); return; }
        var r = Math.min(1, 1600 / Math.max(v.videoWidth, v.videoHeight)), c = document.createElement('canvas'); c.width = Math.round(v.videoWidth * r); c.height = Math.round(v.videoHeight * r);
        c.getContext('2d').drawImage(v, 0, 0, c.width, c.height); setPhoto(box, c.toDataURL('image/jpeg', 0.85)); stopCam(box); v.hidden = true; b.hidden = true; return;
      }
      if (act === 'save') {
        if (!box.__data) { P.toast('Add the photo first'); return; }
        b.disabled = true; P.api('POST', '/api/invoices/' + id + '/paid', { dataUrl: box.__data }).then(function () { P.toast('Marked as paid. Zoho will confirm it.'); return load(); }).catch(function (err) { b.disabled = false; P.fail(err); });
        return;
      }
      if (act === 'undo') { if (window.confirm('Undo "paid" for this invoice?')) P.api('DELETE', '/api/invoices/' + id + '/paid').then(function () { P.toast('Undone'); return load(); }).catch(P.fail); }
    });
    el.addEventListener('input', function (e) { if (e.target.id !== 'iq') return; q = e.target.value; clearTimeout(timer); timer = setTimeout(function () { load().catch(P.fail); }, 350); });
    el.addEventListener('change', function (e) {
      if (e.target.id === 'iw') { who = e.target.value; load().catch(P.fail); return; }
      if (e.target.hasAttribute('data-paidfile') && e.target.files[0]) { var box = e.target.closest('[data-paidbox]'); shrink(e.target.files[0], function (d) { setPhoto(box, d); }, P.fail); }
    });
    P.wireRecords(el, { base: '/api/invoices', outcomes: function () { return outcomes; }, reload: load });
    return load();
  } });
})();
