const { test, before, after } = require('node:test'), assert = require('node:assert'), http = require('http'), fs = require('fs');
process.env.DATA_DIR = fs.mkdtempSync('/tmp/gc-t-'); process.env.ADMIN_KEY = 'adminkey123'; process.env.ADMIN_EMAILS = 'boss@x.io'; process.env.REG_LIMIT = '50'; process.env.SESSION_SECRET = 'x'.repeat(40);
let fake; const REMOTE = !!process.env.REMOTE;
let app; let srv, port;
const call = (m, p, b, c, raw) => new Promise(res => {
  const isF = b && b.getBoundary; const d = b ? (isF ? b.body : JSON.stringify(b)) : null;
  const rq = http.request({ port, path: p, method: m, headers: { 'x-admin-key': 'adminkey123', ...(b ? { 'content-type': isF ? 'multipart/form-data; boundary=' + b.getBoundary() : 'application/json' } : {}), ...(c ? { cookie: c } : {}) } }, r => { let t = ''; r.on('data', x => t += x); r.on('end', () => res({ s: r.statusCode, h: r.headers, b: t && t[0] === '{' || t[0] === '[' ? JSON.parse(t) : t })); });
  if (d) rq.write(d); rq.end();
});
const form = (fields, n = 3) => { const B = 'BND' + Math.random().toString(36).slice(2); let s = '';
  for (const [k, v] of Object.entries(fields)) s += `--${B}\r\nContent-Disposition: form-data; name="${k}"\r\n\r\n${v}\r\n`;
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');
  const parts = [Buffer.from(s)]; for (let i = 0; i < n; i++) parts.push(Buffer.from(`--${B}\r\nContent-Disposition: form-data; name="photos"; filename="a${i}.png"\r\nContent-Type: image/png\r\n\r\n`), png, Buffer.from('\r\n'));
  parts.push(Buffer.from(`--${B}--\r\n`)); return { getBoundary: () => B, body: Buffer.concat(parts) }; };
before(async () => {
  if (REMOTE) { fake = await require('./fake-postgrest')(); process.env.SUPABASE_URL = fake.url; process.env.SUPABASE_KEY = 'testkey'; }
  app = require('../server'); await require('../db').ready;
  await new Promise(r => { srv = app.listen(0, () => { port = srv.address().port; r(); }); });
});
after(() => { srv.close(); fake && fake.close(); });
let ck; const U = { name: 'Ali Zaid', email: 'a@b.co', phone: '0770000000', password: 'password1' };
test('anon cannot report; validation on register', async () => {
  assert.equal((await call('POST', '/api/report', form({}))).s, 401);
  assert.equal((await call('POST', '/api/auth/register', { ...U, password: 'short' })).s, 400);
  assert.equal((await call('POST', '/api/auth/register', { ...U, email: 'bad' })).s, 400);
});
test('register, duplicate, login, wrong password', async () => {
  const r = await call('POST', '/api/auth/register', U); assert.equal(r.s, 200); assert.equal(r.b.user.rank.lv, 0); ck = r.h['set-cookie'][0].split(';')[0];
  assert.match(r.h['set-cookie'][0], /HttpOnly/);
  assert.equal((await call('POST', '/api/auth/register', U)).s, 409);
  assert.equal((await call('POST', '/api/auth/login', { email: U.email, password: 'nope-nope1' })).s, 401);
  assert.equal((await call('POST', '/api/auth/login', { email: U.email, password: U.password })).s, 200);
  assert.equal((await call('GET', '/api/me', null, ck)).b.user.email, U.email);
});
test('report: governorate comes from coordinates, validation, pending limit', async () => {
  assert.equal((await call('POST', '/api/report', form({ type: 'air', description: 'short', lat: 32.6, lng: 44.02 }), ck)).s, 400);
  assert.equal((await call('POST', '/api/report', form({ type: 'air', description: 'ten chars long enough', lat: 20, lng: 44 }), ck)).s, 400);
  assert.equal((await call('POST', '/api/report', form({ type: 'air', description: 'ten chars long enough', lat: 32.6, lng: 44.02 }, 2), ck)).s, 400);
  const r = await call('POST', '/api/report', form({ type: 'air', description: 'Smoke from a burning dump near the road', lat: 32.6, lng: 44.02, gov: 'basra' }), ck);
  assert.equal(r.s, 200); assert.equal(r.b.gov, 'karbala');   // gov حقل مُرسَل يُتجاهل
  assert.equal((await call('POST', '/api/report', form({ type: 'air', description: 'Second report in this place', lat: 32.6, lng: 44.02 }), ck)).s, 200);
  assert.equal((await call('POST', '/api/report', form({ type: 'air', description: 'Third report should hit limit', lat: 32.6, lng: 44.02 }), ck)).s, 429);
});
test('admin approve raises rank; reject penalizes; no-penalty keeps rank; public view hides reporter', async () => {
  const list = (await call('GET', '/api/admin/pending')).b; assert.equal(list.length, 2);
  const a = await call('POST', `/api/admin/pending/${list[0].id}/approve`, {}); assert.equal(a.s, 200);
  assert.equal((await call('GET', '/api/me', null, ck)).b.user.rank.approved, 1);
  assert.equal((await call('GET', '/api/me', null, ck)).b.user.rank.lv, 1);
  await call('POST', `/api/admin/pending/${list[1].id}/reject`, { penalize: false });
  assert.equal((await call('GET', '/api/me', null, ck)).b.user.rank.rejected, 0);
  const pts = (await call('GET', '/api/points')).b, p = pts.find(x => x.id === a.b.point_id);
  assert.ok(p && !('reporter_id' in p) && p.by.n === 'Ali Z.' && p.by.r === 1);
  const c = await call('POST', `/api/points/${pts[0].id}/confirm`, {}, ck); assert.equal(c.b.count, 1);
  assert.equal((await call('POST', `/api/points/${pts[0].id}/confirm`, {}, ck)).b.count, 0);
  assert.equal((await call('POST', `/api/points/${p.id}/confirm`, {}, ck)).s, 400);   // لا تؤكد بلاغك
});
test('password change revokes old session; ban blocks login; leaderboard; delete', async () => {
  const pw = await call('PUT', '/api/me/password', { current: U.password, next: 'newpassw0rd' }, ck); assert.equal(pw.s, 200);
  assert.equal((await call('GET', '/api/me', null, ck)).b.user, null);
  const ck2 = pw.h['set-cookie'][0].split(';')[0]; assert.ok((await call('GET', '/api/me', null, ck2)).b.user);
  assert.equal((await call('GET', '/api/leaderboard')).b[0].name, 'Ali Z.');
  const id = (await call('GET', '/api/admin/users')).b[0].id;
  await call('POST', `/api/admin/users/${id}/ban`, { banned: true });
  assert.equal((await call('GET', '/api/me', null, ck2)).b.user, null);
  assert.equal((await call('POST', '/api/auth/login', { email: U.email, password: 'newpassw0rd' })).s, 403);
  assert.equal((await call('GET', '/api/admin/users', null)).s, 200);
  assert.equal((await call('GET', '/api/admin/pending', null, null)).s, 200);
});
test('admin endpoints reject bad key; csrf origin guard', async () => {
  const r = await new Promise(res => http.get({ port, path: '/api/admin/pending' }, x => res(x.statusCode))); assert.equal(r, 403);
  const o = await new Promise(res => { const q = http.request({ port, path: '/api/auth/logout', method: 'POST', headers: { origin: 'https://evil.example', 'content-type': 'application/json' } }, x => res(x.statusCode)); q.end('{}'); });
  assert.equal(o, 403);
});

test('admin by account: no key needed, instant publish, normal user denied', async () => {
  const r = await call('POST', '/api/auth/register', { name: 'Boss Man', email: 'boss@x.io', phone: '0770000001', password: 'password1' });
  const c = r.h['set-cookie'][0].split(';')[0]; assert.equal(r.b.user.admin, true);
  const raw = u => new Promise(res => http.get({ port, path: u, headers: { cookie: c } }, x => res(x.statusCode)));
  assert.equal(await raw('/api/admin/pending'), 200);
  const n = await call('POST', '/api/auth/register', { name: 'Normal Guy', email: 'n@x.io', phone: '0770000002', password: 'password1' });
  const nc = n.h['set-cookie'][0].split(';')[0];
  assert.equal(await new Promise(res => http.get({ port, path: '/api/admin/pending', headers: { cookie: nc } }, x => res(x.statusCode))), 403);
  const rep = await call('POST', '/api/report', form({ type: 'air', description: 'Admin report published at once', lat: 33.3, lng: 44.4 }), c);
  assert.equal(rep.b.published, true);
});
test('v18 admin: stats, audit trail, csv export (formula-safe), bulk actions, system', async () => {
  const st = await call('GET', '/api/admin/stats');
  assert.equal(st.s, 200); assert.ok(st.b.totals.points > 0); assert.equal(st.b.perDay.length, 30); assert.ok('approvalRate' in st.b.review);
  const text = (p, hdr) => new Promise(res => http.get({ port, path: p, headers: hdr || { 'x-admin-key': 'adminkey123' } }, x => { let d = ''; x.on('data', c => d += c); x.on('end', () => res({ s: x.statusCode, t: d, h: x.headers })); }));
  const csv = await text('/api/admin/export/points'); assert.equal(csv.s, 200); assert.match(csv.h['content-type'], /text\/csv/); assert.ok(csv.t.startsWith('﻿'));
  assert.equal((await text('/api/admin/export/points', {})).s, 403);
  // formula injection is neutralised
  await call('POST', '/api/admin/points', { title: '=HYPERLINK("x")', desc: 'd', type: 'air', gov: 'baghdad', lat: 33.3, lng: 44.4, source: 'https://x.io/a', kind: 'documented' });
  assert.match((await text('/api/admin/export/points')).t, /'=HYPERLINK/);
  // bulk: two pending reports -> one approved, one rejected with reason
  const u = await call('POST', '/api/auth/register', { name: 'Bulk Guy', email: 'bulk@x.io', phone: '0770000009', password: 'password1' }); const c = u.h['set-cookie'][0].split(';')[0];
  for (const p of [[32.6, 44.02], [30.5, 47.8]]) { const r = await call('POST', '/api/report', form({ type: 'water', description: 'bulk test report text ' + p[0], lat: p[0], lng: p[1] }), c); assert.equal(r.s, 200); }
  const pend = (await call('GET', '/api/admin/pending')).b.filter(x => x.email === 'bulk@x.io'); assert.equal(pend.length, 2);
  assert.equal((await call('POST', '/api/admin/bulk', { action: 'nuke', ids: [pend[0].id] })).s, 400);
  const b1 = await call('POST', '/api/admin/bulk', { action: 'approve', ids: [pend[0].id] }); assert.equal(b1.b.done, 1);
  const b2 = await call('POST', '/api/admin/bulk', { action: 'reject', ids: [pend[1].id, 'ghost'], note: 'blurry' }); assert.equal(b2.b.done, 1); assert.equal(b2.b.miss, 1);
  const au = (await call('GET', '/api/admin/audit')).b; const acts = au.map(a => a.action);
  assert.ok(acts.includes('bulk.approve') && acts.includes('bulk.reject') && acts.includes('point.add') && acts.includes('export'));
  assert.equal(au[0].actor, 'ADMIN_KEY');
  const sys = await call('GET', '/api/admin/system'); assert.equal(sys.s, 200); assert.ok(sys.b.db && sys.b.version);
  assert.equal((await call('GET', '/api/admin/stats', null, null)).s, 200);
});
