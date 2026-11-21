(function () {
  'use strict';
  var timer;
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function toast(t) {
    var el = document.getElementById('toast');
    if (!el) { el = document.createElement('div'); el.id = 'toast'; el.className = 'toast'; el.setAttribute('role', 'status'); document.body.appendChild(el); }
    el.textContent = t; el.classList.add('show'); clearTimeout(timer); timer = setTimeout(function () { el.classList.remove('show'); }, 2800);
  }
  function api(method, url, body) {
    var o = { method: method, headers: {} };
    if (body !== undefined) { o.headers['Content-Type'] = 'application/json'; o.body = JSON.stringify(body); }
    return fetch(url, o).then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { if (!r.ok) { var e = new Error(j.error || 'Something went wrong'); e.status = r.status; throw e; } return j; }); });
  }
  function money(n) { return n == null ? 'On request' : '₹' + Number(n).toLocaleString('en-IN'); }
  function when(iso) { return iso ? new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : ''; }

  // the mobile and OTP sign-in, shared by the seller page and the admin page
  function login(el, cfg, done, intro) {
    var mobile = '';
    function stepMobile(msg) {
      el.innerHTML = '<div class="panel login"><h2>Log in</h2><p class="lead">' + esc(intro || 'Enter your mobile number. We will send you a one-time code by SMS.') + '</p>' +
        '<form class="f" id="fm"><label>Mobile number<input name="mobile" inputmode="numeric" autocomplete="tel-national" maxlength="14" placeholder="10-digit mobile number" required></label>' +
        (msg ? '<div class="err" role="alert">' + esc(msg) + '</div>' : '') + (cfg.otp ? '' : '<div class="err">Login is not switched on yet.</div>') + '<button class="btn" type="submit">Send OTP</button></form></div>';
      var f = document.getElementById('fm'); f.mobile.focus();
      f.addEventListener('submit', function (e) {
        e.preventDefault(); var b = f.querySelector('button'); b.disabled = true; mobile = f.mobile.value;
        api('POST', '/api/auth/send-otp', { mobile: mobile }).then(function (r) { stepOtp('', r.length); }).catch(function (x) { stepMobile(x.message); });
      });
    }
    function stepOtp(msg, len) {
      el.innerHTML = '<div class="panel login"><h2>Enter the code</h2><p class="lead">We sent a ' + (len || 4) + '-digit code to ' + esc(mobile) + '.</p>' +
        '<form class="f" id="fo"><label>One-time code<input name="otp" inputmode="numeric" autocomplete="one-time-code" maxlength="8" required></label>' + (msg ? '<div class="err" role="alert">' + esc(msg) + '</div>' : '') +
        '<button class="btn" type="submit">Verify and continue</button><button class="btn ghost" id="again" type="button">Send a new code</button><button class="btn ghost" id="back" type="button">Change number</button></form></div>';
      var f = document.getElementById('fo'); f.otp.focus();
      f.addEventListener('submit', function (e) { e.preventDefault(); api('POST', '/api/auth/verify-otp', { mobile: mobile, otp: f.otp.value }).then(done).catch(function (x) { stepOtp(x.message, len); }); });
      document.getElementById('again').addEventListener('click', function () { api('POST', '/api/auth/send-otp', { mobile: mobile, resend: true }).then(function () { toast('New code sent'); }).catch(function (x) { stepOtp(x.message, len); }); });
      document.getElementById('back').addEventListener('click', function () { stepMobile(''); });
    }
    stepMobile('');
  }
  window.LD = { esc: esc, toast: toast, api: api, money: money, when: when, login: login };
})();
