(function () {
  'use strict';
  var P = window.Panel, esc = P.esc;

  // photos are shrunk in the browser (phones take big pictures) before they are sent
  function shrink(file, done, fail) {
    var url = URL.createObjectURL(file), img = new Image();
    img.onload = function () {
      var r = Math.min(1, 1600 / Math.max(img.width, img.height)), c = document.createElement('canvas');
      c.width = Math.round(img.width * r); c.height = Math.round(img.height * r);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url); done(c.toDataURL('image/jpeg', 0.82));
    };
    img.onerror = function () { URL.revokeObjectURL(url); fail(new Error('That file is not a photo')); };
    img.src = url;
  }

  // ---- payment screenshot: pick a file, or take a photo with the camera ----
  var COARSE = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
  function overlay(html) {
    var o = document.createElement('div'); o.className = 'pay-overlay'; o.innerHTML = '<div class="pay-box">' + html + '</div>';
    o.close = function () { if (o.stop) o.stop(); o.remove(); };
    o.addEventListener('click', function (e) { if (e.target === o) o.close(); });
    document.body.appendChild(o); return o;
  }
  // phones: the camera app opens straight from the file input. Computers: a live preview with a Capture button.
  function liveCamera(onShot, fallback) {
    if (COARSE || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { fallback(); return; }
    navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false }).then(function (stream) {
      var o = overlay('<h3 style="margin:0 0 8px">Take a photo of the payment</h3><video playsinline autoplay muted class="pay-video"></video><div class="actions" style="margin-top:10px"><button class="btn" type="button" data-shot>Capture</button><button class="btn ghost" type="button" data-cancel>Cancel</button></div>');
      var v = o.querySelector('video'); v.srcObject = stream;
      o.stop = function () { stream.getTracks().forEach(function (t) { t.stop(); }); };
      o.querySelector('[data-cancel]').addEventListener('click', o.close);
      o.querySelector('[data-shot]').addEventListener('click', function () {
        if (!v.videoWidth) { P.toast('The camera is still starting, try again'); return; }
        var r = Math.min(1, 1600 / Math.max(v.videoWidth, v.videoHeight)), c = document.createElement('canvas');
        c.width = Math.round(v.videoWidth * r); c.height = Math.round(v.videoHeight * r);
        c.getContext('2d').drawImage(v, 0, 0, c.width, c.height);
        var url = c.toDataURL('image/jpeg', 0.85); o.close(); onShot(url);
      });
    }).catch(function () { P.toast('Could not open the camera. Choose a photo from your device instead.'); fallback(); });
  }

  P.register({ id: 'requests', label: 'Customer requests', roles: ['admin', 'employee'], order: 3, render: function (el) {
    var isAdmin = P.me.role === 'admin', filter = 'open', who = '', steps = [], sources = [], editing = '';
    // one pair of hidden inputs serves every card: a file picker, and one that opens the phone's camera
    var payTarget = null;
    var fileIn = document.createElement('input'); fileIn.type = 'file'; fileIn.accept = 'image/*'; fileIn.hidden = true;
    var camIn = document.createElement('input'); camIn.type = 'file'; camIn.accept = 'image/*'; camIn.setAttribute('capture', 'environment'); camIn.hidden = true;
    // they live on the page itself, because the list is redrawn (el.innerHTML) after every change
    Array.prototype.forEach.call(document.querySelectorAll('[data-payin]'), function (n) { n.remove(); });
    fileIn.setAttribute('data-payin', ''); camIn.setAttribute('data-payin', '');
    document.body.appendChild(fileIn); document.body.appendChild(camIn);
    function sendPhoto(rid, dataUrl, thenTick) {
      P.toast('Uploading...');
      return P.api('POST', '/api/requests/' + rid + '/screenshot', { dataUrl: dataUrl })
        .then(function () { return thenTick ? P.api('PUT', '/api/requests/' + rid + '/steps/payment', { done: true }) : null; })
        .then(function () { P.toast(thenTick ? 'Screenshot saved, marked as paid' : 'Screenshot saved'); return load(); }).catch(P.fail);
    }
    function onPicked(input) {
      var f = input.files && input.files[0], t = payTarget; input.value = '';
      if (!f || !t) return;
      shrink(f, function (dataUrl) { sendPhoto(t.id, dataUrl, t.tick); }, P.fail);
    }
    fileIn.addEventListener('change', function () { onPicked(fileIn); });
    camIn.addEventListener('change', function () { onPicked(camIn); });
    function chooseFile(target) { payTarget = target; fileIn.click(); }
    function takePhoto(target) { payTarget = target; liveCamera(function (dataUrl) { sendPhoto(target.id, dataUrl, target.tick); }, function () { camIn.click(); }); }
    // ticking Paid starts here when there is no screenshot yet: nothing is marked paid until one is saved
    function askForProof(rid) {
      var o = overlay('<h3 style="margin:0 0 6px">Payment screenshot needed</h3><p class="muted small" style="margin:0 0 12px">Add the screenshot of the payment. The request is marked as paid once it is saved.</p><div class="actions"><button class="btn" type="button" data-cam>&#128247; Take photo</button><button class="btn ghost" type="button" data-file>Upload screenshot</button><button class="btn ghost" type="button" data-cancel>Cancel</button></div>');
      o.querySelector('[data-cancel]').addEventListener('click', o.close);
      o.querySelector('[data-file]').addEventListener('click', function () { o.close(); chooseFile({ id: rid, tick: true }); });
      o.querySelector('[data-cam]').addEventListener('click', function () { o.close(); takePhoto({ id: rid, tick: true }); });
    }
    var photoButtons = '<button class="btn ghost sm" type="button" data-pay-file>+ Upload screenshot</button><button class="btn ghost sm" type="button" data-pay-cam>&#128247; Take photo</button>';

    function stepRow(r, s, can) {
      var d = r.steps[s.key], hasPhoto = r.screenshots.length > 0;
      var disabled = !can || (s.needsPhoto && !hasPhoto && !d);
      return '<div class="step check rstep ' + (d ? 'on' : '') + '"><input type="checkbox" data-step="' + s.key + '"' + (d ? ' checked' : '') + (disabled ? ' disabled' : '') + ' id="s' + r.id + s.key + '"><label for="s' + r.id + s.key + '" class="t" style="font-size:12.5px;color:inherit;font-weight:600">' + esc(s.label) + '</label>' +
        (d ? '<span class="stamp">' + P.stamp(d.at, d.by) + '</span>' : (s.needsPhoto && !hasPhoto && can ? '<span class="stamp">upload the screenshot first</span>' : '')) +
        (s.needsPhoto ? '<div class="actions">' + r.screenshots.map(function (p) { return '<a href="/api/files/' + p.name + '" target="_blank" rel="noopener" title="' + esc(p.byName) + ' &middot; ' + P.fmtTime(p.at) + '"><img src="/api/files/' + p.name + '" alt="Payment screenshot" style="height:36px;border-radius:8px;border:1px solid #e2e8f0"></a>'; }).join('') +
          (can && r.screenshots.length < 5 ? '<label class="btn ghost sm" style="display:inline-block;cursor:pointer">+ Upload screenshot<input type="file" accept="image/*" data-photo hidden></label>' : '') + '</div>' : '') + '</div>';
    }

    // the payment screenshots live under the track, since the Paid step cannot be ticked without one
    function photoRow(r, can) {
      if (!r.screenshots.length && !can) return '';
      return '<div class="actions"><span class="muted small">Payment screenshot:</span> ' + r.screenshots.map(function (p) { return '<a href="/api/files/' + p.name + '" target="_blank" rel="noopener" title="' + esc(p.byName) + ' &middot; ' + P.fmtTime(p.at) + '"><img src="/api/files/' + p.name + '" alt="Payment screenshot" style="height:36px;border-radius:8px;border:1px solid #e2e8f0"></a>'; }).join('') +
        (can && r.screenshots.length < 5 ? photoButtons : '') + '</div>';
    }

    function cardFull(r) {
      var mine = r.ownerId === P.me.id, can = mine || isAdmin;
      var tone = r.complete ? 'good' : r.needsAttention ? 'hot' : r.followUpDue ? 'warn' : '';
      return '<div class="item ' + tone + '" data-id="' + r.id + '"><div class="head"><b>' + esc(r.customerName) + (r.company ? ' <span class="muted">' + esc(r.company) + '</span>' : '') + (r.amount ? ' <span class="muted">' + P.money(r.amount) + '</span>' : '') + '</b>' +
        '<span class="chips">' + P.pill(r.customerType === 'existing' ? 'Existing customer' : 'New customer', r.customerType === 'existing' ? 'ok' : 'new') + P.pill(r.source) + (r.complete ? P.pill('Sent successfully', 'ok') : P.pill(r.progress.percent + '% completed (' + r.progress.done + ' of ' + r.progress.total + ' steps)', (r.progress.percent >= 100 ? 'ok ' : '') + 'pcr')) + (r.needsAttention ? P.pill('Not touched for ' + r.daysSinceTouched + ' day' + (r.daysSinceTouched === 1 ? '' : 's'), 'overdue') : '') + (r.followUpDue ? P.pill('Follow up today', 'due') : '') + '</span></div>' +
        '<div class="meta">' + (r.phone ? '<span>&#9742; <b>' + esc(r.phone) + '</b></span>' : '') + '<span>Owner: <b>' + (r.ownerId ? esc(r.ownerName) : 'nobody yet') + '</b></span><span>Open for ' + r.daysOpen + ' day' + (r.daysOpen === 1 ? '' : 's') + '</span>' + (r.complete ? '' : '<span>Next: <b>' + esc(r.nextStep) + '</b></span>') + (r.nextDate && !r.complete ? '<span>Follow up on <b>' + P.fmtDate(r.nextDate) + '</b></span>' : '') + (r.zohoSoNumber ? '<span>Zoho ' + esc(r.zohoSoNumber) + '</span>' : '') + '</div>' +
        (r.request ? '<div>' + esc(r.request) + '</div>' : '') + P.track(r, can) +
        photoRow(r, can) +
        (r.notes.length ? '<div class="hist">' + r.notes.slice(-4).map(function (n) { return '<div><b>' + P.stamp(n.at, n.byName) + '</b> ' + esc(n.text) + (n.nextDate ? ' <span class="muted">(follow up ' + P.fmtDate(n.nextDate) + ')</span>' : '') + '</div>'; }).join('') + '</div>' : '') +
        (can && !isAdmin && !r.complete ? '<form class="row" data-note><label style="flex:3 1 220px">Note (what happened with the customer)<input name="text" maxlength="1000" placeholder="e.g. Customer will send the address tomorrow"></label><label>Follow up on<input type="date" name="nextDate" min="' + P.today + '"></label><button class="btn sm fit" type="submit">Add note</button></form>' : '') +
        '<div class="actions">' + (!r.ownerId && !isAdmin ? '<button class="btn sm" data-act="pick" type="button">I will handle this request</button>' : '') + (isAdmin ? '<select data-assign style="width:auto"><option value="">Nobody</option>' + P.userOptions(r.ownerId) + '</select>' : '') +
        (can ? '<button class="btn ghost sm" data-edit type="button">Edit details</button>' : '') + (isAdmin ? '<button class="btn ghost sm" data-del type="button" style="color:#b91c1c">Delete</button>' : '') + (r.updatedAt ? '<span class="stamp">Updated ' + P.fmtTime(r.updatedAt) + '</span>' : '') + '</div>' +
        (editing === r.id ? '<form class="fu" data-editform><div class="row"><label>Customer<input name="customerName" value="' + esc(r.customerName) + '" maxlength="100" required></label><label>Phone<input name="phone" value="' + esc(r.phone) + '" maxlength="20"></label><label>Company<input name="company" value="' + esc(r.company) + '" maxlength="100"></label><label>Amount (₹)<input name="amount" type="number" min="0" step="0.01" value="' + (r.amount || '') + '"></label></div><label>What they want<input name="request" value="' + esc(r.request) + '" maxlength="1000"></label><div class="actions"><button class="btn sm" type="submit">Save</button><button class="btn ghost sm" type="button" data-edit-cancel>Cancel</button></div></form>' : '') +
        '</div>';
    }

    // the owner's list is folded: just the customer and how far along the request is, a click opens the whole card
    var rOpen = {};
    function card(r) {
      if (!isAdmin) return cardFull(r);
      var open = rOpen[r.id] === true;
      return '<div class="rcard' + (open ? ' open' : '') + '" data-rc="' + r.id + '"><div class="rsum" data-rtoggle role="button" tabindex="0"><span class="caret">' + (open ? '&#9662;' : '&#9656;') + '</span><b class="rname">' + esc(r.customerName) + '</b>' + P.pill(r.progress.percent + '% completed', (r.complete ? 'ok ' : '') + 'pcr') + '<button class="btn ghost sm" data-rdel="' + r.id + '" type="button" style="color:#b91c1c">Delete</button></div><div class="rbody">' + cardFull(r) + '</div></div>';
    }

    // the owner sees everybody's requests side by side, one column per person (and one for requests nobody has picked yet)
    function byPerson(list) {
      var people = P.users.filter(function (u) { return u.active !== false; });
      var cols = people.map(function (u) { return { name: u.name, items: list.filter(function (x) { return x.ownerId === u.id; }) }; });
      var loose = list.filter(function (x) { return !people.some(function (u) { return u.id === x.ownerId; }); });
      if (loose.length) cols.push({ name: 'Nobody yet', items: loose });
      return '<div class="twgrid">' + cols.map(function (c) { return '<section class="tcol"><div class="tname2"><h3>' + esc(c.name) + ' <span class="muted small">(' + c.items.length + ')</span></h3></div>' + (c.items.length ? c.items.map(card).join('') : '<div class="muted small">Nothing here.</div>') + '</section>'; }).join('') + '</div>';
    }
    function load(refresh) {
      var url = '/api/requests?filter=' + filter + (who ? '&userId=' + who : '') + (refresh ? '&refresh=1' : '');
      return P.api('GET', url).then(function (r) {
        steps = r.steps; sources = r.sources;
        var seg = [['open', 'Open'], ['unassigned', 'Waiting to be picked']].concat(isAdmin ? [['nofollow', 'No follow-up date']] : [], [['done', 'Finished'], ['all', 'All']]);
        el.innerHTML = '<div class="card"><div class="between"><div class="seg">' + seg.map(function (s) { return '<button class="btn ' + (filter === s[0] ? '' : 'ghost') + '" data-f="' + s[0] + '" type="button">' + s[1] + '</button>'; }).join('') + '</div><div class="actions">' + (isAdmin ? '<select id="rw" style="width:auto"><option value="">All owners</option>' + P.userOptions(who) + '</select><button class="btn ghost sm" id="rf" type="button">Check Zoho</button>' : '') + '<button class="btn" id="addR" type="button">+ Log a customer request</button></div></div>' +
          '<form id="rForm" class="list" hidden><div class="row"><label class="check"><input type="checkbox" name="existing"> This is an existing customer (choose them from the list)</label></div>' +
          '<div class="row" data-existing hidden><label style="flex:3 1 300px">Existing customer<select name="customerId"><option value="">Loading the customer list...</option></select></label></div>' +
          '<div class="row"><label>Came through<select name="source">' + sources.map(function (s) { return '<option>' + esc(s) + '</option>'; }).join('') + '</select></label><label>Customer name<input name="customerName" required maxlength="100"></label><label>Phone<input name="phone" type="tel" maxlength="20"></label><label>Company<input name="company" maxlength="100"></label></div>' +
          '<div class="row"><label style="flex:3 1 260px">What do they want?<input name="request" maxlength="1000" placeholder="e.g. 20 kg nickel strip 0.15 mm"></label><label>Follow up on<input type="date" name="nextDate" min="' + P.today + '"></label>' + (isAdmin ? '<label>Give it to<select name="ownerId"><option value="">Nobody (let the team pick)</option>' + P.userOptions('') + '</select></label>' : '') + '<button class="btn fit" type="submit">Save request</button></div></form>' +
          '<div class="muted small">Every customer who asks for something goes through five steps: quote sent and payment asked, payment received (with the screenshot), material ready, dispatched, sent successfully. Tick each when it is done. A request that is not finished shows up again tomorrow.</div></div>' +
          (r.zoho && !r.zoho.ok && isAdmin ? '<div class="banner">Zoho did not answer (' + esc(r.zoho.error) + '). New website orders will appear once it is reachable.</div>' : '') +
          (r.requests.length ? (isAdmin && !who ? byPerson(r.requests) : '<div class="list">' + r.requests.map(card).join('') + '</div>') : P.empty(filter === 'open' ? 'No open customer requests. When a customer asks for something, tap "+ Log a customer request".' : 'Nothing here.'));
        el.querySelector('#addR').addEventListener('click', function () { var f = el.querySelector('#rForm'); f.hidden = !f.hidden; });
        el.querySelector('#rForm').addEventListener('submit', function (e) {
          e.preventDefault(); var f = e.target;
          P.api('POST', '/api/requests', { customerName: f.customerName.value, phone: f.phone.value, company: f.company.value, source: f.source.value, request: f.request.value, nextDate: f.nextDate.value, ownerId: f.ownerId ? f.ownerId.value : undefined, customerType: f.existing.checked ? 'existing' : 'new', customerId: f.existing.checked ? f.customerId.value : '' }).then(function () { P.toast('Request logged'); filter = 'open'; return load(); }).catch(P.fail);
        });
        // an existing customer is picked from the Zoho list, and their details fill in
        var rf = el.querySelector('#rForm'), custs = null;
        function fillOptions() {
          var sel = rf.customerId;
          sel.innerHTML = '<option value="">Choose a customer...</option>' + custs.map(function (c) { return '<option value="' + esc(c.id) + '">' + esc(c.name) + (c.phone ? ' - ' + esc(c.phone) : '') + '</option>'; }).join('');
        }
        rf.existing.addEventListener('change', function () {
          rf.querySelector('[data-existing]').hidden = !rf.existing.checked;
          if (!rf.existing.checked || custs) return;
          P.api('GET', '/api/customer-options').then(function (r) {
            custs = r.customers; fillOptions();
            if (r.error) P.toast(r.error);
            else if (!custs.length) rf.customerId.innerHTML = '<option value="">No customers found in Zoho</option>';
          }).catch(P.fail);
        });
        rf.customerId.addEventListener('change', function () {
          var c = (custs || []).filter(function (x) { return x.id === rf.customerId.value; })[0]; if (!c) return;
          rf.customerName.value = c.name; rf.phone.value = c.phone || ''; rf.company.value = c.company || '';
        });
        var rw = el.querySelector('#rw'); if (rw) rw.addEventListener('change', function () { who = rw.value; load().catch(P.fail); });
      });
    }

    el.addEventListener('click', function (e) {
      var rd = e.target.closest('[data-rdel]');
      if (rd) { e.stopPropagation(); if (!window.confirm('Delete this customer request for good? Its notes and screenshots are removed too. This cannot be undone.')) return; P.api('DELETE', '/api/requests/' + rd.dataset.rdel).then(function () { P.toast('Request deleted'); return load(); }).catch(P.fail); return; }
      var rt = e.target.closest('[data-rtoggle]');
      if (rt) { var rc = rt.parentNode, on = !rc.classList.contains('open'); rc.classList.toggle('open', on); rOpen[rc.dataset.rc] = on; rt.querySelector('.caret').innerHTML = on ? '&#9662;' : '&#9656;'; return; }
      var f = e.target.closest('[data-f]'); if (f) { filter = f.dataset.f; load().catch(P.fail); return; }
      if (e.target.id === 'rf') { e.target.disabled = true; load(true).then(function () { P.toast('Checked Zoho'); }).catch(P.fail); return; }
      var id = (e.target.closest('[data-id]') || { dataset: {} }).dataset;
      if (e.target.closest('[data-act="pick"]')) { P.api('POST', '/api/requests/' + id.id + '/pick', {}).then(function () { P.toast('Picked. It is yours now.'); return load(); }).catch(P.fail); return; }
      if (e.target.closest('[data-del]')) {
        if (!window.confirm('Delete this customer request for good?\n\nIts notes and screenshots are removed too. This cannot be undone.')) return;
        P.api('DELETE', '/api/requests/' + id.id).then(function () { P.toast('Request deleted'); return load(); }).catch(P.fail); return;
      }
      if (e.target.closest('[data-pay-file]')) { chooseFile({ id: id.id, tick: false }); return; }
      if (e.target.closest('[data-pay-cam]')) { takePhoto({ id: id.id, tick: false }); return; }
      var tk = e.target.closest('[data-tick]');
      if (tk) {
        var on = tk.dataset.on === '1';
        if (!on && tk.dataset.tick === 'payment' && !tk.closest('[data-id]').querySelector('img[alt="Payment screenshot"]')) { askForProof(id.id); return; }
        if (on && !window.confirm('Undo this step?')) return;
        P.api('PUT', '/api/requests/' + id.id + '/steps/' + tk.dataset.tick, { done: !on }).then(function (res) { P.toast((on ? 'Unticked, saved ' : 'Done, saved ') + P.fmtTime(res.request.updatedAt)); return load(); }).catch(P.fail); return;
      }
      if (e.target.closest('[data-edit]')) { editing = editing === id.id ? '' : id.id; load().catch(P.fail); return; }
      if (e.target.closest('[data-edit-cancel]')) { editing = ''; load().catch(P.fail); }
    });
    el.addEventListener('change', function (e) {
      var item = e.target.closest('[data-id]'); if (!item) return;
      var rid = item.dataset.id;
      var st = e.target.closest('[data-step]');
      if (st) { P.api('PUT', '/api/requests/' + rid + '/steps/' + st.dataset.step, { done: st.checked }).then(function (r) { P.toast((st.checked ? 'Done, saved ' : 'Unticked, saved ') + P.fmtTime(r.request.updatedAt)); return load(); }).catch(function (err) { st.checked = !st.checked; P.fail(err); }); return; }
      var as = e.target.closest('[data-assign]');
      if (as) { P.api('POST', '/api/requests/' + rid + '/assign', { ownerId: as.value }).then(function () { P.toast('Assigned'); return load(); }).catch(P.fail); return; }
      var ph = e.target.closest('[data-photo]');
      if (ph && ph.files && ph.files[0]) {
        P.toast('Uploading...');
        shrink(ph.files[0], function (dataUrl) { P.api('POST', '/api/requests/' + rid + '/screenshot', { dataUrl: dataUrl }).then(function () { P.toast('Screenshot saved'); return load(); }).catch(P.fail); }, P.fail);
      }
    });
    el.addEventListener('submit', function (e) {
      var n = e.target.closest('[data-note]'), ed = e.target.closest('[data-editform]');
      if (n) { e.preventDefault(); P.api('POST', '/api/requests/' + n.closest('[data-id]').dataset.id + '/note', { text: n.text.value, nextDate: n.nextDate.value }).then(function () { P.toast('Note saved ' + P.fmtTime(new Date().toISOString())); return load(); }).catch(P.fail); }
      if (ed) { e.preventDefault(); P.api('PATCH', '/api/requests/' + ed.closest('[data-id]').dataset.id, { customerName: ed.customerName.value, phone: ed.phone.value, company: ed.company.value, amount: ed.amount.value, request: ed.request.value }).then(function () { editing = ''; P.toast('Saved'); return load(); }).catch(P.fail); }
    });
    return load();
  } });
})();
