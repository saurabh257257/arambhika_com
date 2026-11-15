// Sign-in for the Claude apps (claude.ai, desktop): the standard OAuth flow with PKCE. Claude opens /oauth/authorize,
// the team member types their portal username and password on OUR page, and Claude gets a short-lived token that
// belongs to that member. Passwords are never given to Claude. Claude registers itself first (dynamic registration).
'use strict';
const crypto = require('crypto');
const express = require('express');

const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const b64url = (buf) => buf.toString('base64url');
const origin = (req) => req.protocol + '://' + req.get('host');

// only addresses a Claude app really uses to come back: Claude's own https sites, or the same computer (Claude Code)
function redirectOk(uri) {
  let u; try { u = new URL(uri); } catch (e) { return false; }
  if (u.hash) return false;
  if (u.protocol === 'https:') return /^(claude\.ai|claude\.com|(www\.)?anthropic\.com)$/.test(u.hostname);
  return u.protocol === 'http:' && (u.hostname === 'localhost' || u.hostname === '127.0.0.1' || u.hostname === '[::1]');
}

function install(app, repo, tries) {
  const form = express.urlencoded({ extended: false, limit: '20kb' });
  const codes = new Map(); // code -> { memberId, clientId, redirectUri, challenge, exp }; short-lived, lost on restart (the user just signs in again)

  const meta = (req) => ({
    issuer: origin(req), authorization_endpoint: origin(req) + '/oauth/authorize', token_endpoint: origin(req) + '/oauth/token', registration_endpoint: origin(req) + '/oauth/register',
    response_types_supported: ['code'], grant_types_supported: ['authorization_code', 'refresh_token'], code_challenge_methods_supported: ['S256'], token_endpoint_auth_methods_supported: ['none'],
  });
  // the protected resource is the address Claude connected to: /mcp, or /mcp/v2 (asked for as .../oauth-protected-resource/mcp/v2)
  const resource = (req) => ({ resource: origin(req) + (req.params[0] === 'mcp/v2' ? '/mcp/v2' : '/mcp'), authorization_servers: [origin(req)], bearer_methods_supported: ['header'] });
  app.get('/.well-known/oauth-authorization-server', (req, res) => res.json(meta(req)));
  app.get('/.well-known/oauth-authorization-server/*', (req, res) => res.json(meta(req)));
  app.get('/.well-known/oauth-protected-resource', (req, res) => { req.params = [""]; res.json(resource(req)); });
  app.get('/.well-known/oauth-protected-resource/*', (req, res) => res.json(resource(req)));

  app.post('/oauth/register', (req, res) => {
    const b = req.body || {}, uris = Array.isArray(b.redirect_uris) ? b.redirect_uris.map(String) : [];
    if (!uris.length || uris.length > 10 || !uris.every(redirectOk)) return res.status(400).json({ error: 'invalid_redirect_uri', error_description: 'Only Claude addresses may be used' });
    const c = repo.saveClient(b.client_name, uris);
    res.status(201).json({ client_id: c.id, client_name: c.name, redirect_uris: uris, grant_types: ['authorization_code', 'refresh_token'], response_types: ['code'], token_endpoint_auth_method: 'none' });
  });

  // ---- the sign-in page ----
  const page = (req, p, error) => '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex"><title>Sign in | Arambhika Portal</title><link rel="stylesheet" href="/style.css"></head><body>' +
    '<div class="login"><form class="card" method="post" action="/oauth/authorize" autocomplete="on"><h2>Arambhika Portal</h2><p class="muted" style="margin:0"><b>' + esc(p.clientName) + '</b> wants to connect to the portal as you. Sign in with your portal username and password. Everything it saves will be recorded under your name.</p>' +
    ['client_id', 'redirect_uri', 'state', 'code_challenge'].map((k) => '<input type="hidden" name="' + k + '" value="' + esc(p[k]) + '">').join('') +
    '<label>Username<input name="username" autocomplete="username" autocapitalize="none" required autofocus></label><label>Password<input name="password" type="password" autocomplete="current-password" required></label>' +
    (error ? '<div class="err" role="alert">' + esc(error) + '</div>' : '') + '<button class="btn" type="submit">Sign in and allow</button></form></div></body></html>';
  const bad = (res, msg) => res.status(400).type('html').send('<!doctype html><meta charset="utf-8"><title>Cannot connect</title><body style="font-family:system-ui;max-width:420px;margin:12vh auto;padding:0 16px"><h3>Cannot connect</h3><p>' + esc(msg) + '</p></body>');
  // the address Claude asked to come back to must be exactly one it registered
  function checked(src) {
    const c = repo.client(src.client_id);
    if (!c) return { error: 'This app is not registered.' };
    if (!c.redirect_uris.includes(String(src.redirect_uri || ''))) return { error: 'The return address does not match.' };
    if (!/^[A-Za-z0-9_-]{43}$/.test(String(src.code_challenge || ''))) return { error: 'The sign-in request is incomplete.' };
    return { client: c };
  }
  app.get('/oauth/authorize', (req, res) => {
    const q = req.query;
    if (q.response_type !== 'code' || q.code_challenge_method !== 'S256') return bad(res, 'The sign-in request is not supported.');
    const v = checked(q); if (v.error) return bad(res, v.error);
    res.set({ 'X-Frame-Options': 'DENY', 'Cache-Control': 'no-store' }).type('html').send(page(req, { clientName: v.client.name, client_id: q.client_id, redirect_uri: q.redirect_uri, state: q.state || '', code_challenge: q.code_challenge }));
  });
  app.post('/oauth/authorize', form, (req, res) => {
    const b = req.body || {}, v = checked(b); if (v.error) return bad(res, v.error);
    const t = Date.now(), recent = (tries.get('oa' + req.ip) || []).filter((x) => x > t - 10 * 60 * 1000);
    const again = (msg, status) => res.status(status).set({ 'X-Frame-Options': 'DENY', 'Cache-Control': 'no-store' }).type('html').send(page(req, { clientName: v.client.name, client_id: b.client_id, redirect_uri: b.redirect_uri, state: b.state || '', code_challenge: b.code_challenge }, msg));
    if (recent.length >= 10) return again('Too many attempts. Please wait a few minutes.', 429);
    const m = repo.login(b.username, b.password);
    if (!m) { recent.push(t); tries.set('oa' + req.ip, recent); return again('Wrong username or password', 401); }
    tries.delete('oa' + req.ip);
    const code = b64url(crypto.randomBytes(32));
    codes.set(code, { memberId: m.id, clientId: b.client_id, redirectUri: b.redirect_uri, challenge: b.code_challenge, exp: t + 10 * 60 * 1000 });
    for (const [k, x] of codes) if (x.exp < t) codes.delete(k);
    const u = new URL(b.redirect_uri); u.searchParams.set('code', code); if (b.state) u.searchParams.set('state', b.state);
    res.redirect(302, u.toString());
  });

  // ---- tokens ----
  app.post('/oauth/token', form, express.json({ limit: '20kb' }), (req, res) => {
    res.set({ 'Cache-Control': 'no-store', Pragma: 'no-cache' });
    const b = req.body || {}, err = (code, status = 400) => res.status(status).json({ error: code });
    const send = (t) => res.json({ access_token: t.access, token_type: 'Bearer', expires_in: t.expiresIn, refresh_token: t.refresh });
    if (b.grant_type === 'authorization_code') {
      const c = codes.get(String(b.code || '')); codes.delete(String(b.code || '')); // one use only
      if (!c || c.exp < Date.now() || c.clientId !== b.client_id || c.redirectUri !== b.redirect_uri) return err('invalid_grant');
      const check = b64url(crypto.createHash('sha256').update(String(b.code_verifier || '')).digest());
      if (!b.code_verifier || check !== c.challenge) return err('invalid_grant');
      const m = repo.member(c.memberId); if (!m || !m.active) return err('invalid_grant');
      return send(repo.issueTokens(c.memberId, c.clientId));
    }
    if (b.grant_type === 'refresh_token') {
      const t = repo.useRefresh(b.refresh_token, String(b.client_id || ''));
      return t ? send(t) : err('invalid_grant');
    }
    return err('unsupported_grant_type');
  });
}

module.exports = { install, redirectOk };
