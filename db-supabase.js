// قاعدة بيانات Supabase (Postgres + Storage للصور) عبر REST بدون أي مكتبة إضافية.
const fs = require('fs'), path = require('path');
const R = require('./ranks');
const URL_ = String(process.env.SUPABASE_URL || '').replace(/\/+$/, ''), KEY = process.env.SUPABASE_KEY || '';
const BUCKET = process.env.SUPABASE_BUCKET || 'photos';
const H = (x = {}) => ({ apikey: KEY, ...(KEY.startsWith('eyJ') ? { Authorization: 'Bearer ' + KEY } : {}), ...x });

async function rest(method, q, body, prefer) {
  const r = await fetch(`${URL_}/rest/v1/${q}`, { method, headers: H({ 'Content-Type': 'application/json', ...(prefer ? { Prefer: prefer } : {}) }), body: body === undefined ? undefined : JSON.stringify(body) });
  const t = await r.text();
  if (!r.ok) throw new Error(`Supabase ${method} ${q.split('?')[0]} -> ${r.status} ${t.slice(0, 200)}`);
  return t ? JSON.parse(t) : null;
}
const enc = encodeURIComponent;
let cache = null, cacheAt = 0;
const bust = () => { cache = null; };
const outPoint = r => r && ({ ...r, approx: !!r.approx, photos: Array.isArray(r.photos) ? r.photos : [] });

// نسخة عامة: تُخفي reporter_id وتضيف confirms و by (الاسم العام + الرتبة)
async function decorate(rows) {
  rows = rows.map(outPoint);
  if (!rows.length) return rows;
  const ids = [...new Set(rows.map(r => r.reporter_id).filter(Boolean))];
  const users = {};
  if (ids.length) (await rest('GET', `users?select=id,name,public,approved,rejected&id=in.(${ids.map(enc).join(',')})`)).forEach(u => users[u.id] = u);
  const cnt = {};
  (await rest('GET', 'confirms?select=point_id&limit=100000')).forEach(c => cnt[c.point_id] = (cnt[c.point_id] || 0) + 1);
  return rows.map(({ reporter_id, ...p }) => {
    p.confirms = cnt[p.id] || 0;
    const u = reporter_id && users[reporter_id];
    if (u) p.by = { n: u.public ? R.publicName(u.name) : null, r: R.level(u.approved, u.rejected).lv };
    return p;
  });
}
async function getPoint(id) { const a = await rest('GET', `points?id=eq.${enc(id)}&select=*`); return outPoint(a[0]); }
async function savePoint(p) {
  const old = (await getPoint(p.id)) || {};
  const status = p.status === 'removed' ? 'removed' : 'active';
  const row = {
    id: p.id, title: p.title || '', title_en: p.title_en || '', type: p.type, gov: p.gov, lat: +p.lat, lng: +p.lng,
    desc: p.desc || '', desc_en: p.desc_en || '', solution: p.solution || '', solution_en: p.solution_en || '',
    source: p.source || '', kind: p.kind || 'documented', approx: !!p.approx, photos: p.photos || [],
    created_at: 'created_at' in p ? (p.created_at || null) : (old.created_at || new Date().toISOString()),
    status, removed_at: status === 'removed' ? (p.removed_at || old.removed_at || new Date().toISOString().slice(0, 10)) : null,
    removed_note: status === 'removed' ? (p.removed_note ?? old.removed_note ?? '') : null,
    removed_note_en: status === 'removed' ? (p.removed_note_en ?? old.removed_note_en ?? '') : null,
    reporter_id: 'reporter_id' in p ? (p.reporter_id || null) : (old.reporter_id || null)
  };
  await rest('POST', 'points?on_conflict=id', [row], 'resolution=merge-duplicates,return=minimal'); bust();
}

async function init() {
  const n = await rest('GET', 'points?select=id&limit=1');
  const f = path.join(__dirname, 'data', 'points.json');
  if (!n.length && fs.existsSync(f)) {
    for (const p of JSON.parse(fs.readFileSync(f, 'utf8'))) await savePoint({ ...p, created_at: null });
    console.log('تم استيراد النقاط الأولية إلى Supabase');
  }
  for (const [file, key] of [['updates-v6.json', 'updates_v6'], ['updates-v20.json', 'updates_v20']]) {
    const uf = path.join(__dirname, 'data', file);
    const done = await rest('GET', `meta?k=eq.${key}&select=k`);
    if (!fs.existsSync(uf) || done.length) continue;
    const u = JSON.parse(fs.readFileSync(uf, 'utf8'));
    for (const p of u.points) if (!(await getPoint(p.id))) await savePoint(p);
    for (const pt of (u.patches || [])) { const cur = await getPoint(pt.id); if (cur && cur.status !== 'removed') await savePoint({ ...cur, ...pt }); }
    await rest('POST', 'meta', [{ k: key, v: new Date().toISOString() }], 'return=minimal');
    console.log('تم تطبيق تحديث البيانات على Supabase', file);
  }
}

const ready = init(); ready.catch(() => {});
module.exports = {
  IS_REMOTE: true, ready, health: () => rest('GET', 'points?select=id&limit=1'),
  savePoint, getPoint,
  async allPoints() {
    if (cache && Date.now() - cacheAt < 30000) return cache;
    cache = await decorate(await rest('GET', 'points?select=*&limit=5000')); cacheAt = Date.now(); return cache;
  },
  async news(n = 10) {
    const [a, r] = await Promise.all([
      rest('GET', `points?select=*&created_at=not.is.null&order=created_at.desc&limit=${n}`),
      rest('GET', `points?select=*&status=eq.removed&order=removed_at.desc&limit=${n}`)
    ]);
    return { added: await decorate(a), removed: await decorate(r) };
  },
  async deletePoint(id) { await rest('DELETE', `points?id=eq.${enc(id)}`); bust(); },
  async addPending(r) { await rest('POST', 'pending', [{ user_id: null, rank_lv: 0, ...r }], 'return=minimal'); },
  async allPending() { return (await rest('GET', 'pending?select=*&order=date.desc')).sort((a, b) => (b.rank_lv || 0) - (a.rank_lv || 0)); },
  pendingByUser: uid => rest('GET', `pending?user_id=eq.${enc(uid)}&select=*`),
  async getPending(id) { return (await rest('GET', `pending?id=eq.${enc(id)}&select=*`))[0]; },
  async deletePending(id) { await rest('DELETE', `pending?id=eq.${enc(id)}`); },
  // ---- المستخدمون ----
  async createUser(u) { await rest('POST', 'users', [u], 'return=minimal'); },
  async userByEmail(e) { return (await rest('GET', `users?email=eq.${enc(String(e).toLowerCase())}&select=*`))[0]; },
  async userById(id) { return (await rest('GET', `users?id=eq.${enc(id)}&select=*`))[0]; },
  async updateUser(id, patch) {
    const keys = Object.keys(patch).filter(k => k !== 'id'); if (!keys.length) return;
    await rest('PATCH', `users?id=eq.${enc(id)}`, Object.fromEntries(keys.map(k => [k, patch[k]])), 'return=minimal'); bust();
  },
  async bumpUser(id, d) {   // قراءة ثم كتابة (مراجعة المدير تتم بشكل متسلسل فلا خطر تعارض عملي)
    const u = await this.userById(id); if (!u) return;
    await rest('PATCH', `users?id=eq.${enc(id)}`, { approved: u.approved + (d.approved || 0), rejected: u.rejected + (d.rejected || 0) }, 'return=minimal'); bust();
  },
  listUsers: () => rest('GET', 'users?select=*&order=created_at.desc&limit=5000'),
  async topUsers(n) {
    const a = await rest('GET', 'users?select=*&banned=eq.0&approved=gt.0&limit=5000');
    return a.sort((x, y) => R.score(y.approved, y.rejected) - R.score(x.approved, x.rejected) || y.approved - x.approved).slice(0, n);
  },
  async deleteUser(id) {
    await rest('PATCH', `points?reporter_id=eq.${enc(id)}`, { reporter_id: null }, 'return=minimal');
    await rest('DELETE', `confirms?user_id=eq.${enc(id)}`);
    await rest('PATCH', `user_reports?user_id=eq.${enc(id)}`, { user_id: null, desc: null }, 'return=minimal');
    await rest('DELETE', `pending?user_id=eq.${enc(id)}`);
    await rest('DELETE', `users?id=eq.${enc(id)}`); bust();
  },
  // ---- سجل بلاغات المستخدم ----
  async addUserReport(r) { await rest('POST', 'user_reports', [{ status: 'pending', created_at: new Date().toISOString(), ...r }], 'return=minimal'); },
  async setReportStatus(id, status, x = {}) {
    await rest('PATCH', `user_reports?id=eq.${enc(id)}`, { status, decided_at: new Date().toISOString(), point_id: x.point_id || null, note: x.note || null }, 'return=minimal'); bust();
  },
  async addAudit(a) { await rest('POST', 'audit', [{ id: a.id, at: new Date().toISOString(), actor: a.actor, action: a.action, target: a.target || '', detail: a.detail || '' }], 'return=minimal'); },
  listAudit: (n = 200) => rest('GET', `audit?select=*&order=at.desc&limit=${n}`),
  allReports: since => rest('GET', `user_reports?select=id,user_id,type,gov,status,created_at,decided_at,note${since ? `&created_at=gte.${enc(since)}` : ''}&order=created_at.desc&limit=20000`),
  userReports: (uid, n = 100) => rest('GET', `user_reports?user_id=eq.${enc(uid)}&select=*&order=created_at.desc&limit=${n}`),
  async countReports(uid, { since, status } = {}) {
    const r = await fetch(`${URL_}/rest/v1/user_reports?user_id=eq.${enc(uid)}${since ? `&created_at=gte.${enc(since)}` : ''}${status ? `&status=eq.${status}` : ''}&select=id`, { method: 'HEAD', headers: H({ Prefer: 'count=exact' }) });
    if (!r.ok) throw new Error('Supabase count failed ' + r.status);
    return +String(r.headers.get('content-range') || '*/0').split('/')[1] || 0;
  },
  // ---- تأكيد المواطنين ----
  async toggleConfirm(pid, uid) {
    const has = (await rest('GET', `confirms?point_id=eq.${enc(pid)}&user_id=eq.${enc(uid)}&select=point_id`)).length > 0;
    if (has) await rest('DELETE', `confirms?point_id=eq.${enc(pid)}&user_id=eq.${enc(uid)}`);
    else await rest('POST', 'confirms', [{ point_id: pid, user_id: uid, created_at: new Date().toISOString() }], 'return=minimal');
    bust();
    const n = (await rest('GET', `confirms?point_id=eq.${enc(pid)}&select=point_id`)).length;
    return { confirmed: !has, count: n };
  },
  async myConfirms(uid) { return (await rest('GET', `confirms?user_id=eq.${enc(uid)}&select=point_id`)).map(r => r.point_id); },
  // رفع صورة إلى Supabase Storage وإرجاع رابطها العام
  async uploadPhoto(buf, name, mime) {
    const r = await fetch(`${URL_}/storage/v1/object/${BUCKET}/${name}`, { method: 'POST', headers: H({ 'Content-Type': mime, 'x-upsert': 'true' }), body: buf });
    if (!r.ok) throw new Error('Storage upload failed: ' + r.status + ' ' + (await r.text()).slice(0, 200));
    return `${URL_}/storage/v1/object/public/${BUCKET}/${name}`;
  }
};
