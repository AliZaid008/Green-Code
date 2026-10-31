require('dotenv').config();
const express = require('express'), multer = require('multer');
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const db = require('./db'), notify = require('./notify'), geo = require('./geo'), auth = require('./auth'), R = require('./ranks'), compress = require('./compress');

const app = express();
app.set('trust proxy', 1);
app.disable('x-powered-by');
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const PROD = process.env.NODE_ENV === 'production';
const TYPES = ['air', 'water', 'waste', 'soil', 'oil', 'radiation'];
const govs = geo.govs, GOV_IDS = govs.map(g => g.id);
const BASE = () => process.env.BASE_URL || 'http://localhost:' + (process.env.PORT || 3000);
const AUTO_LEVEL = +process.env.AUTO_PUBLISH_LEVEL || 0;   // 0 = لا نشر تلقائي. مثال: 4 يعني أن "سفير أخضر" يُنشر بلاغه فوراً

const UPLOADS = path.join(DATA_DIR, 'uploads');
if (!db.IS_REMOTE) fs.mkdirSync(UPLOADS, { recursive: true });
const upload = multer({
  storage: db.IS_REMOTE ? multer.memoryStorage() : multer.diskStorage({
    destination: UPLOADS,
    filename: (q, f, cb) => cb(null, crypto.randomUUID() + path.extname(f.originalname).toLowerCase())
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (q, f, cb) => cb(null, /^image\/(jpeg|png|webp)$/.test(f.mimetype))
});
const EXT = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' };
const dropFiles = files => (files || []).forEach(f => f.path && fs.unlink(f.path, () => {}));

// ---------- طبقة الأداء والأمان ----------
app.use(compress);
app.use((q, r, n) => {
  r.set({ 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'strict-origin-when-cross-origin', 'X-Frame-Options': 'SAMEORIGIN', 'Permissions-Policy': 'geolocation=(self), camera=(), microphone=()' });
  n();
});
app.use(express.json({ limit: '200kb' }));
// حماية CSRF إضافية فوق SameSite=Lax: طلبات التعديل يجب أن تأتي من نفس الموقع
app.use('/api', (q, r, n) => {
  if (!['POST', 'PUT', 'DELETE', 'PATCH'].includes(q.method)) return n();
  const o = q.get('origin'); if (!o) return n();
  try { if (new URL(o).host === q.get('host')) return n(); } catch (e) {}
  r.status(403).json({ code: 'origin', error: 'forbidden' });
});

const readCfg = () => { try { return JSON.parse(fs.readFileSync(path.join(__dirname, 'static.config.json'), 'utf8')); } catch (e) { return {}; } };
const waNumber = () => String(process.env.WHATSAPP || readCfg().whatsapp || '').replace(/\D/g, '');
app.get('/config.js', (q, r) => {   // يُقرأ عند كل طلب: تعديل الرقم لا يحتاج إعادة تشغيل
  r.set('Cache-Control', 'no-store').type('js').send('window.GC = ' + JSON.stringify({ STATIC: false, AUTH: true, REPORT_EMAIL: '', WHATSAPP: waNumber(), IMGBB: process.env.IMGBB_KEY || readCfg().imgbbKey || '' }) + ';');
});
// الملفات الثابتة: الملفات ذات ?v=رقم تُخزَّن سنة كاملة، الصفحات تُعاد مراجعتها دائماً (ETag)، والسيرفس وركر لا يُخزَّن أبداً
app.use(express.static(path.join(__dirname, 'public'), {
  etag: true,
  setHeaders: (res, file) => {
    if (!PROD) return res.setHeader('Cache-Control', 'no-cache');
    const url = res.req.originalUrl || '';
    if (/sw\.js$/.test(file) || /\.html$/.test(file) || /manifest/.test(file)) res.setHeader('Cache-Control', 'no-cache');
    else if (/[?&]v=/.test(url)) res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    else res.setHeader('Cache-Control', 'public, max-age=86400');
    if (/sw\.js$/.test(file)) res.setHeader('Service-Worker-Allowed', '/');
  }
}));
app.use('/uploads', express.static(UPLOADS, { maxAge: PROD ? '30d' : 0, immutable: PROD }));
app.get('/healthz', async (q, r) => { try { await db.health(); r.send('ok'); } catch (e) { r.status(500).send('db error'); } });
const wrap = fn => (q, r, n) => Promise.resolve(fn(q, r, n)).catch(e => { console.error(e); r.status(500).json({ code: 'server', error: 'حدث خطأ في الخادم.' }); });
const err = (res, status, code, error) => res.status(status).json({ code, error });

// ---------- مساعدات ----------
const s = (v, n) => String(v ?? '').trim().slice(0, n);
const ADMINS = () => String(process.env.ADMIN_EMAILS || '').toLowerCase().split(/[\s,;]+/).filter(Boolean);
const isAdmin = u => !!u && ADMINS().includes(String(u.email).toLowerCase());
const userView = u => ({ admin: isAdmin(u), name: u.name, email: u.email, phone: u.phone, public: !!u.public, created_at: u.created_at, rank: R.view(u.approved, u.rejected) });
const loadUser = auth.loader(db);
const needUser = [loadUser, (q, r, n) => q.user ? n() : err(r, 401, 'auth_required', 'سجّل الدخول أولاً.')];
const ipLimit = auth.limiter(40, 3600e3);
const loginLimit = auth.limiter(10, 15 * 60e3);
const emailLimit = auth.limiter(8, 15 * 60e3, q => 'e:' + String((q.body && q.body.email) || '').toLowerCase());
const regLimit = auth.limiter(+process.env.REG_LIMIT || 6, 3600e3);

// لوحة الإدارة: إما حساب مسجّل إيميله في ADMIN_EMAILS، أو المفتاح السري ADMIN_KEY (للتوافق مع النسخة القديمة)
const adminAuth = (req, res, next) => {
  const k = Buffer.from(String(req.get('x-admin-key') || '')), a = Buffer.from(String(process.env.ADMIN_KEY || ''));
  if (a.length >= 8 && k.length === a.length && crypto.timingSafeEqual(k, a)) return next();
  loadUser(req, res, () => isAdmin(req.user) ? next() : res.status(403).json({ error: 'forbidden' }));
};

// سجل التدقيق: من فعل ماذا ومتى (لا يُسقط الطلب إذا تعذّر الكتابة)
const actorOf = req => req.user && req.user.email ? req.user.email : 'ADMIN_KEY';
const audit = (req, action, target, detail) => Promise.resolve(db.addAudit({ id: crypto.randomUUID(), actor: actorOf(req), action, target, detail: String(detail || '').slice(0, 300) })).catch(e => console.error('audit:', e.message));

// ---------- عام ----------
app.get('/api/governorates', (q, r) => r.json(govs));
app.get('/api/points', wrap(async (q, r) => { r.set('Cache-Control', 'public, max-age=20'); r.json(await db.allPoints()); }));
app.get('/api/news', wrap(async (q, r) => { r.set('Cache-Control', 'public, max-age=20'); r.json(await db.news(10)); }));
app.get('/api/ranks', (q, r) => r.json(R.LEVELS.map(({ lv, min, acc, ar, en, day, pending }) => ({ lv, min, acc: Math.round(acc * 100), ar, en, day, pending }))));
app.get('/api/leaderboard', wrap(async (q, r) => {
  const rows = (await db.topUsers(50)).filter(u => u.public).slice(0, 20);
  r.set('Cache-Control', 'public, max-age=30');
  r.json(rows.map((u, i) => ({ pos: i + 1, name: R.publicName(u.name), rank: R.view(u.approved, u.rejected) })));
}));
// تحديد المحافظة من الموقع (القرار النهائي دائماً من السيرفر عند الإرسال)
app.get('/api/locate', (q, r) => {
  const d = geo.detect(+q.query.lat, +q.query.lng);
  r.json({ gov: d ? d.id : null, how: d ? d.how : null });
});

// ---------- الحسابات ----------
app.post('/api/auth/register', regLimit, wrap(async (req, res) => {
  const b = req.body || {}, name = s(b.name, 80), email = s(b.email, 120).toLowerCase(), phone = s(b.phone, 20), pw = String(b.password || '');
  if (name.length < 2) return err(res, 400, 'invalid_name', 'اكتب اسمك.');
  if (!/^\S+@\S+\.\S+$/.test(email)) return err(res, 400, 'invalid_email', 'الإيميل غير صحيح.');
  if (!/^[0-9+\s-]{7,16}$/.test(phone)) return err(res, 400, 'invalid_phone', 'رقم الهاتف غير صحيح.');
  if (pw.length < 8 || pw.length > 128) return err(res, 400, 'weak_password', 'كلمة المرور 8 أحرف على الأقل.');
  if (await db.userByEmail(email)) return err(res, 409, 'email_taken', 'هذا الإيميل مسجّل مسبقاً.');
  const now = new Date().toISOString();
  const u = { id: crypto.randomUUID(), email, name, phone, pass: await auth.hash(pw), public: b.public === false ? 0 : 1, approved: 0, rejected: 0, banned: 0, sv: 0, created_at: now, last_login: now };
  try { await db.createUser(u); } catch (e) { if (/unique|duplicate/i.test(e.message)) return err(res, 409, 'email_taken', 'هذا الإيميل مسجّل مسبقاً.'); throw e; }
  auth.setSession(res, u, req); res.json({ user: userView(u) });
}));
app.post('/api/auth/login', loginLimit, emailLimit, wrap(async (req, res) => {
  const email = s(req.body && req.body.email, 120).toLowerCase(), pw = String((req.body && req.body.password) || '');
  const u = email && await db.userByEmail(email);
  const ok = await auth.verify(pw, u && u.pass);   // يعمل دائماً بنفس الزمن تقريباً حتى لو الحساب غير موجود
  if (!u || !ok) return err(res, 401, 'bad_login', 'الإيميل أو كلمة المرور غير صحيحة.');
  if (u.banned) return err(res, 403, 'banned', 'هذا الحساب موقوف.');
  await db.updateUser(u.id, { last_login: new Date().toISOString() });
  auth.setSession(res, u, req); res.json({ user: userView(u) });
}));
app.post('/api/auth/logout', (q, r) => { auth.clearSession(r); r.json({ ok: true }); });
app.get('/api/me', loadUser, wrap(async (req, res) => {
  res.set('Cache-Control', 'no-store');
  if (!req.user) return res.json({ user: null });
  res.json({ user: userView(req.user), confirmed: await db.myConfirms(req.user.id) });
}));
app.put('/api/me', ...needUser, wrap(async (req, res) => {
  const b = req.body || {}, patch = {};
  if (b.name !== undefined) { patch.name = s(b.name, 80); if (patch.name.length < 2) return err(res, 400, 'invalid_name', 'اكتب اسمك.'); }
  if (b.phone !== undefined) { patch.phone = s(b.phone, 20); if (!/^[0-9+\s-]{7,16}$/.test(patch.phone)) return err(res, 400, 'invalid_phone', 'رقم الهاتف غير صحيح.'); }
  if (b.public !== undefined) patch.public = b.public ? 1 : 0;
  await db.updateUser(req.user.id, patch); res.json({ user: userView({ ...req.user, ...patch }) });
}));
app.put('/api/me/password', ...needUser, loginLimit, wrap(async (req, res) => {
  const cur = String(req.body.current || ''), next = String(req.body.next || '');
  if (!(await auth.verify(cur, req.user.pass))) return err(res, 401, 'bad_login', 'كلمة المرور الحالية غير صحيحة.');
  if (next.length < 8 || next.length > 128) return err(res, 400, 'weak_password', 'كلمة المرور 8 أحرف على الأقل.');
  const patch = { pass: await auth.hash(next), sv: (req.user.sv || 0) + 1 };   // رفع sv يُنهي كل الجلسات القديمة
  await db.updateUser(req.user.id, patch); auth.setSession(res, { ...req.user, ...patch }, req); res.json({ ok: true });
}));
app.delete('/api/me', ...needUser, loginLimit, wrap(async (req, res) => {
  if (!(await auth.verify(String((req.body && req.body.password) || ''), req.user.pass))) return err(res, 401, 'bad_login', 'كلمة المرور غير صحيحة.');
  (await db.pendingByUser(req.user.id)).forEach(p => !db.IS_REMOTE && p.photos.forEach(u => /^\/uploads\//.test(u) && fs.unlink(path.join(UPLOADS, path.basename(u)), () => {})));
  await db.deleteUser(req.user.id); auth.clearSession(res); res.json({ ok: true });
}));
app.get('/api/me/reports', ...needUser, wrap(async (req, res) => {
  res.set('Cache-Control', 'no-store');
  res.json((await db.userReports(req.user.id)).map(r => ({ id: r.id, type: r.type, gov: r.gov, desc: r.desc, status: r.status, created_at: r.created_at, decided_at: r.decided_at, point_id: r.point_id, note: r.note })));
}));

// ---------- تأكيد النقاط من المواطنين ----------
app.post('/api/points/:id/confirm', ...needUser, auth.limiter(60, 3600e3, q => q.user ? q.user.id : q.ip), wrap(async (req, res) => {
  const p = await db.getPoint(req.params.id);
  if (!p) return err(res, 404, 'not_found', 'النقطة غير موجودة.');
  if (p.reporter_id && p.reporter_id === req.user.id) return err(res, 400, 'own_point', 'لا يمكنك تأكيد بلاغك بنفسك.');
  res.json(await db.toggleConfirm(p.id, req.user.id));
}));

// ---------- استقبال بلاغ ----------
// الترتيب مهم: نتأكد من تسجيل الدخول والحدود قبل أن يُرفع أي ملف
const reportGate = wrap(async (req, res, next) => {
  const u = req.user, lv = R.level(u.approved, u.rejected);
  const day = await db.countReports(u.id, { since: new Date(Date.now() - 864e5).toISOString() });
  if (day >= lv.day) return err(res, 429, 'limit_daily', `وصلت للحد اليومي لرتبتك (${lv.day} بلاغات).`);
  const pend = await db.countReports(u.id, { status: 'pending' });
  if (pend >= lv.pending) return err(res, 429, 'limit_pending', `لديك ${pend} بلاغات قيد المراجعة. انتظر مراجعتها.`);
  next();
});
async function publish(r, o = {}) {
  const gov = o.gov && GOV_IDS.includes(o.gov) ? o.gov : r.gov, pid = 'c-' + crypto.randomUUID().slice(0, 8);
  const first = String(r.desc).split(/[.\n،!؟?]/)[0].trim();
  await db.savePoint({ id: pid, title: (first || r.desc).slice(0, 60), type: r.type, gov, lat: r.lat, lng: r.lng, desc: r.desc, source: 'بلاغ مواطن', kind: 'reported', approx: false, photos: r.photos, reporter_id: r.user_id || null });
  await db.deletePending(r.id);   // بيانات المبلّغ لا تنتقل للنقطة العامة
  if (r.user_id) { await db.setReportStatus(r.id, 'approved', { point_id: pid }); await db.bumpUser(r.user_id, { approved: 1 }); }
  return pid;
}
async function reject(r, { penalize = true, note = '' } = {}) {
  await db.deletePending(r.id);
  if (!db.IS_REMOTE) r.photos.forEach(u => /^\/uploads\//.test(u) && fs.unlink(path.join(UPLOADS, path.basename(u)), () => {}));
  else if (db.removePhotos) await db.removePhotos(r.photos).catch(e => console.error('تعذر حذف صور البلاغ المرفوض:', e.message));
  if (r.user_id) { await db.setReportStatus(r.id, 'rejected', { note: s(note, 300) }); if (penalize) await db.bumpUser(r.user_id, { rejected: 1 }); }
}
app.post('/api/report', ipLimit, ...needUser, reportGate, upload.array('photos', 3), wrap(async (req, res) => {
  const b = req.body, lat = +b.lat, lng = +b.lng, u = req.user;
  const bad = (code, msg, st = 400) => { dropFiles(req.files); return err(res, st, code, msg); };
  if (!(lat > 28 && lat < 38 && lng > 38 && lng < 49)) return bad('outside_iraq', 'الموقع خارج العراق.');
  const g = geo.govAt(lat, lng);   // المحافظة تُحدَّد تلقائياً من الموقع ولا يمكن للمستخدم تغييرها
  if (!g) return bad('outside_iraq', 'الموقع خارج حدود العراق. حدّد مكان التلوث على الخارطة.');
  const desc = s(b.description, 1000);
  if (!TYPES.includes(b.type) || desc.length < 10) return bad('bad_input', 'اختر نوع التلوث واكتب وصفاً من 10 أحرف على الأقل.');
  if (!req.files || req.files.length !== 3) return bad('need_photos', 'ارفع 3 صور للتلوث.');
  const photos = db.IS_REMOTE
    ? await Promise.all(req.files.map(f => db.uploadPhoto(f.buffer, crypto.randomUUID() + (EXT[f.mimetype] || '.jpg'), f.mimetype)))
    : req.files.map(f => '/uploads/' + f.filename);
  const lv = R.level(u.approved, u.rejected);
  const rec = { id: crypto.randomUUID(), name: u.name, phone: u.phone, email: u.email, type: b.type, gov: g, lat, lng, desc, photos, date: new Date().toISOString(), user_id: u.id, rank_lv: lv.lv };
  await db.addPending(rec);
  await db.addUserReport({ id: rec.id, user_id: u.id, type: rec.type, gov: g, desc });
  let published = null;
  if (isAdmin(u) || (AUTO_LEVEL && lv.lv >= AUTO_LEVEL)) published = await publish(rec);
  res.json({ ok: true, gov: g, published: !!published, point_id: published });
  if (!published) notify({ ...rec, rank: `${lv.ar} (${u.approved} معتمد / ${u.rejected} مرفوض)`, trusted: lv.lv >= 3 }, BASE()).catch(e => console.error('فشل الإشعار:', e.message));
}));

// ---------- لوحة الإدارة ----------
function cleanPoint(b) {
  const x = (v, n) => String(v || '').trim().slice(0, n), lat = +b.lat, lng = +b.lng;
  const p = {
    title: x(b.title, 200), title_en: x(b.title_en, 200), type: b.type, gov: b.gov, lat, lng, desc: x(b.desc, 2000), desc_en: x(b.desc_en, 2000),
    solution: x(b.solution, 1000), solution_en: x(b.solution_en, 1000), source: x(b.source, 1000),
    kind: ['documented', 'reported', 'potential'].includes(b.kind) ? b.kind : 'documented', approx: !!b.approx,
    status: b.status === 'removed' ? 'removed' : 'active', removed_at: /^\d{4}-\d{2}-\d{2}$/.test(b.removed_at || '') ? b.removed_at : '',
    removed_note: x(b.removed_note, 400), removed_note_en: x(b.removed_note_en, 400),
    photos: Array.isArray(b.photos) ? b.photos.filter(v => typeof v === 'string').slice(0, 10) : []
  };
  if (!p.title || !p.desc) return { error: 'العنوان والوصف مطلوبان' };
  if (p.status === 'removed' && !p.removed_at) return { error: 'اكتب تاريخ الإزالة (YYYY-MM-DD)' };
  if (!TYPES.includes(p.type)) return { error: 'نوع التلوث غير صحيح' };
  if (!GOV_IDS.includes(p.gov)) return { error: 'المحافظة غير صحيحة' };
  if (!(lat > 28 && lat < 38 && lng > 38 && lng < 49)) return { error: 'الإحداثيات خارج العراق' };
  if (p.kind !== 'reported' && !/^https?:\/\/\S+$/.test(p.source)) return { error: 'المصدر لازم يكون رابطاً يبدأ بـ http' };
  return { p };
}
app.post('/api/admin/points', adminAuth, wrap(async (req, res) => {
  const c = cleanPoint(req.body); if (c.error) return res.status(400).json(c);
  const p = { id: 'p-' + crypto.randomUUID().slice(0, 8), ...c.p }; await db.savePoint(p); await audit(req, 'point.add', p.id, p.title); res.json(p);
}));
app.put('/api/admin/points/:id', adminAuth, wrap(async (req, res) => {
  const old = await db.getPoint(req.params.id);
  if (!old) return res.status(404).json({ error: 'غير موجود' });
  const c = cleanPoint(req.body); if (c.error) return res.status(400).json(c);
  await db.savePoint({ id: req.params.id, created_at: old.created_at, ...c.p }); await audit(req, 'point.edit', req.params.id, c.p.title + (old.status !== c.p.status ? ' [' + old.status + '→' + c.p.status + ']' : '')); res.json({ ok: true });
}));
app.delete('/api/admin/points/:id', adminAuth, wrap(async (req, res) => { const o = await db.getPoint(req.params.id); await db.deletePoint(req.params.id); await audit(req, 'point.delete', req.params.id, o ? o.title : ''); res.json({ ok: true }); }));
app.get('/api/admin/pending', adminAuth, wrap(async (q, r) => {
  const list = await db.allPending();
  r.json(await Promise.all(list.map(async p => {
    const u = p.user_id && await db.userById(p.user_id);
    return { ...p, rep: u ? { ...R.view(u.approved, u.rejected), banned: !!u.banned } : null };
  })));
}));
app.post('/api/admin/pending/:id/approve', adminAuth, wrap(async (req, res) => {
  const r = await db.getPending(req.params.id); if (!r) return res.status(404).json({ error: 'غير موجود أو تم اعتماده سابقاً' });
  const pid = await publish(r, { gov: req.body && req.body.gov }); await audit(req, 'report.approve', r.id, r.type + ' / ' + (req.body && req.body.gov || r.gov) + ' → ' + pid); res.json({ ok: true, point_id: pid });
}));
// رفض: penalize=false يحذف البلاغ بدون خصم من رتبة المبلّغ (مثلاً بلاغ مكرر)
app.post('/api/admin/pending/:id/reject', adminAuth, wrap(async (req, res) => {
  const r = await db.getPending(req.params.id); if (!r) return res.status(404).json({ error: 'غير موجود' });
  const pen = !(req.body && req.body.penalize === false); await reject(r, { penalize: pen, note: req.body && req.body.note }); await audit(req, pen ? 'report.reject' : 'report.dismiss', r.id, (req.body && req.body.note) || ''); res.json({ ok: true });
}));
app.delete('/api/admin/pending/:id', adminAuth, wrap(async (req, res) => {
  const r = await db.getPending(req.params.id); if (r) { await reject(r, { penalize: true }); await audit(req, 'report.reject', r.id, ''); } res.json({ ok: true });
}));
app.get('/api/admin/users', adminAuth, wrap(async (q, r) => r.json((await db.listUsers()).map(u => ({
  id: u.id, name: u.name, email: u.email, phone: u.phone, banned: !!u.banned, created_at: u.created_at, last_login: u.last_login, rank: R.view(u.approved, u.rejected)
})))));
app.post('/api/admin/users/:id/ban', adminAuth, wrap(async (req, res) => {
  const u = await db.userById(req.params.id); if (!u) return res.status(404).json({ error: 'غير موجود' });
  const banned = req.body && req.body.banned ? 1 : 0;
  await db.updateUser(u.id, { banned, sv: (u.sv || 0) + 1 }); await audit(req, banned ? 'user.ban' : 'user.unban', u.id, u.email); res.json({ ok: true, banned: !!banned });
}));
// ---------- تحليلات وتقارير وتصدير ----------
const day = d => String(d || '').slice(0, 10);
app.get('/api/admin/stats', adminAuth, wrap(async (req, res) => {
  const since90 = new Date(Date.now() - 90 * 864e5).toISOString();
  const [pts, users, pend, reps] = await Promise.all([db.allPoints(), db.listUsers(), db.allPending(), db.allReports(since90)]);
  const cnt = (arr, f) => arr.reduce((m, x) => { const k = f(x); m[k] = (m[k] || 0) + 1; return m; }, {});
  const active = pts.filter(p => p.status !== 'removed'), removed = pts.length - active.length;
  const byDay = cnt(reps, r => day(r.created_at)), days = [];
  for (let i = 29; i >= 0; i--) { const k = new Date(Date.now() - i * 864e5).toISOString().slice(0, 10); days.push({ d: k, n: byDay[k] || 0 }); }
  const decided = reps.filter(r => r.decided_at && r.status !== 'pending');
  const hrs = decided.map(r => (new Date(r.decided_at) - new Date(r.created_at)) / 36e5).filter(h => h >= 0).sort((a, b) => a - b);
  const approved = reps.filter(r => r.status === 'approved').length, rejected = reps.filter(r => r.status === 'rejected').length;
  const oldest = pend.length ? Math.max(...pend.map(p => (Date.now() - new Date(p.date)) / 36e5)) : 0;
  const top = [...users].filter(u => !u.banned).sort((a, b) => b.approved - a.approved).slice(0, 5).map(u => ({ name: u.name, approved: u.approved, rejected: u.rejected, rank: R.view(u.approved, u.rejected).ar }));
  res.json({
    totals: { points: pts.length, active: active.length, removed, pending: pend.length, users: users.length, banned: users.filter(u => u.banned).length, reports90: reps.length },
    byType: cnt(active, p => p.type), byGov: cnt(active, p => p.gov), byKind: cnt(pts, p => p.kind || 'documented'),
    removalRate: pts.length ? Math.round(removed / pts.length * 100) : 0,
    review: { approved, rejected, approvalRate: approved + rejected ? Math.round(approved / (approved + rejected) * 100) : null, medianHours: hrs.length ? +hrs[Math.floor(hrs.length / 2)].toFixed(1) : null, oldestPendingHours: Math.round(oldest) },
    perDay: days, topReporters: top, generatedAt: new Date().toISOString()
  });
}));
app.get('/api/admin/audit', adminAuth, wrap(async (q, r) => r.json(await db.listAudit(300))));
app.get('/api/admin/system', adminAuth, wrap(async (req, res) => {
  let up = 0; if (!db.IS_REMOTE) { try { up = fs.readdirSync(UPLOADS).reduce((n, f) => n + fs.statSync(path.join(UPLOADS, f)).size, 0); } catch (e) {} }
  res.json({
    version: require('./package.json').version, node: process.version, uptimeMin: Math.round(process.uptime() / 60), db: db.IS_REMOTE ? 'Supabase (PostgreSQL)' : 'SQLite',
    uploadsMB: db.IS_REMOTE ? null : +(up / 1048576).toFixed(1), autoPublishLevel: AUTO_LEVEL, admins: ADMINS().length, keyEnabled: String(process.env.ADMIN_KEY || '').length >= 8,
    channels: { telegram: !!(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID), brevo: !!process.env.BREVO_API_KEY, smtp: !!(process.env.SMTP_USER && process.env.SMTP_PASS), whatsapp: !!waNumber() }, baseUrl: BASE()
  });
}));
const csvCell = v => { let t = v == null ? '' : String(v).replace(/\r?\n/g, ' '); if (/^[=+\-@]/.test(t)) t = "'" + t; return /[",]/.test(t) ? '"' + t.replace(/"/g, '""') + '"' : t; };
const sendCsv = (res, name, head, rows) => { res.set({ 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="${name}"` }); res.send('﻿' + [head, ...rows].map(r => r.map(csvCell).join(',')).join('\r\n')); };
app.get('/api/admin/export/:what', adminAuth, wrap(async (req, res) => {
  const stamp = new Date().toISOString().slice(0, 10), w = req.params.what, gname = id => (govs.find(g => g.id === id) || {}).ar || id;
  if (w === 'points') { const l = await db.allPoints(); await audit(req, 'export', 'points', l.length + ' rows'); return sendCsv(res, `pollution-points-${stamp}.csv`, ['id', 'title', 'type', 'governorate', 'lat', 'lng', 'kind', 'status', 'removed_at', 'source', 'created_at'], l.map(p => [p.id, p.title, p.type, gname(p.gov), p.lat, p.lng, p.kind, p.status || 'active', p.removed_at, p.source, p.created_at])); }
  if (w === 'reports') { const l = await db.allReports(); await audit(req, 'export', 'reports', l.length + ' rows'); return sendCsv(res, `citizen-reports-${stamp}.csv`, ['id', 'type', 'governorate', 'status', 'created_at', 'decided_at', 'reviewer_note'], l.map(r => [r.id, r.type, gname(r.gov), r.status, r.created_at, r.decided_at, r.note])); }
  if (w === 'audit') { const l = await db.listAudit(5000); return sendCsv(res, `audit-log-${stamp}.csv`, ['at', 'actor', 'action', 'target', 'detail'], l.map(a => [a.at, a.actor, a.action, a.target, a.detail])); }
  res.status(404).json({ error: 'unknown export' });
}));
app.post('/api/admin/bulk', adminAuth, wrap(async (req, res) => {
  const { action, ids, note } = req.body || {}; if (!['approve', 'reject', 'dismiss'].includes(action) || !Array.isArray(ids) || ids.length > 100) return res.status(400).json({ error: 'bad request' });
  let done = 0, miss = 0;
  for (const id of ids) {
    const r = await db.getPending(String(id)); if (!r) { miss++; continue; }
    if (action === 'approve') await publish(r); else await reject(r, { penalize: action === 'reject', note });
    done++;
  }
  await audit(req, 'bulk.' + action, ids.length + ' reports', (note || '') + ` (ok ${done}, missing ${miss})`); res.json({ ok: true, done, miss });
}));
app.post('/api/admin/test-notify', adminAuth, wrap(async (req, res) => {
  const r = { id: 'test', name: 'اختبار', phone: '+964000000000', email: 'test@example.com', type: 'test', gov: 'test', lat: 32.6, lng: 44.02, desc: 'هذا بلاغ تجريبي من لوحة الإدارة. إذا وصلك فالإشعارات تعمل.', photos: [], date: new Date().toISOString(), rank: 'اختبار' };
  res.json({ results: await notify(r, BASE()) });
}));

if (require.main === module) {
  db.ready.then(() => app.listen(process.env.PORT || 3000, () => {
    console.log('http://localhost:' + (process.env.PORT || 3000));
    console.log(waNumber() ? 'واتساب: مفعّل (الرقم ينتهي بـ ' + waNumber().slice(-4) + ')' : 'واتساب: غير مفعّل. اكتب WHATSAPP=+964... في ملف .env أو whatsapp في static.config.json');
    if (AUTO_LEVEL) console.log('النشر التلقائي مفعّل للرتبة', AUTO_LEVEL, 'وما فوق');
  })).catch(e => { console.error('تعذر الاتصال بقاعدة البيانات:', e.message); process.exit(1); });
}
module.exports = app;
