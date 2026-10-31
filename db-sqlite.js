// قاعدة بيانات SQLite مدمجة في Node 22.5+ (لا تحتاج تثبيت أي مكتبة).
// المسار: DATA_DIR/app.db (الافتراضي مجلد data). عند النشر على استضافة ضع DATA_DIR على قرص دائم.
const { DatabaseSync } = require('node:sqlite');
const fs = require('fs'), path = require('path');
const R = require('./ranks');
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
fs.mkdirSync(DATA_DIR, { recursive: true });
const db = new DatabaseSync(path.join(DATA_DIR, 'app.db'));
db.exec('PRAGMA journal_mode=WAL; PRAGMA synchronous=NORMAL; PRAGMA foreign_keys=OFF;');

db.exec(`
CREATE TABLE IF NOT EXISTS points(
  id TEXT PRIMARY KEY, title TEXT, title_en TEXT, type TEXT, gov TEXT, lat REAL, lng REAL,
  "desc" TEXT, desc_en TEXT, solution TEXT, solution_en TEXT, source TEXT, kind TEXT, approx INTEGER DEFAULT 0, photos TEXT DEFAULT '[]');
CREATE TABLE IF NOT EXISTS pending(
  id TEXT PRIMARY KEY, name TEXT, phone TEXT, email TEXT, type TEXT, gov TEXT, lat REAL, lng REAL,
  "desc" TEXT, photos TEXT, date TEXT);
CREATE TABLE IF NOT EXISTS meta(k TEXT PRIMARY KEY, v TEXT);
CREATE TABLE IF NOT EXISTS users(
  id TEXT PRIMARY KEY, email TEXT UNIQUE, name TEXT, phone TEXT, pass TEXT, public INTEGER DEFAULT 1,
  approved INTEGER DEFAULT 0, rejected INTEGER DEFAULT 0, banned INTEGER DEFAULT 0, sv INTEGER DEFAULT 0, created_at TEXT, last_login TEXT);
CREATE TABLE IF NOT EXISTS user_reports(
  id TEXT PRIMARY KEY, user_id TEXT, type TEXT, gov TEXT, "desc" TEXT, status TEXT, created_at TEXT, decided_at TEXT, point_id TEXT, note TEXT);
CREATE INDEX IF NOT EXISTS idx_ur_user ON user_reports(user_id, created_at);
CREATE TABLE IF NOT EXISTS confirms(point_id TEXT, user_id TEXT, created_at TEXT, PRIMARY KEY(point_id, user_id));
CREATE INDEX IF NOT EXISTS idx_conf_user ON confirms(user_id);
CREATE TABLE IF NOT EXISTS audit(id TEXT PRIMARY KEY, at TEXT, actor TEXT, action TEXT, target TEXT, detail TEXT);
CREATE INDEX IF NOT EXISTS idx_audit_at ON audit(at);
`);
// ترقية قواعد البيانات القديمة: أعمدة جديدة (أخبار/إزالة v3-v6، حسابات v15)
const addCols = (table, list) => {
  const have = db.prepare(`PRAGMA table_info(${table})`).all().map(c => c.name);
  list.forEach(([n, t]) => { if (!have.includes(n)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${n} ${t}`); });
};
addCols('points', [['created_at', 'TEXT'], ['status', "TEXT DEFAULT 'active'"], ['removed_at', 'TEXT'], ['removed_note', 'TEXT'], ['removed_note_en', 'TEXT'], ['reporter_id', 'TEXT']]);
addCols('pending', [['user_id', 'TEXT'], ['rank_lv', 'INTEGER DEFAULT 0']]);
db.exec("UPDATE points SET status='active' WHERE status IS NULL");
db.exec('CREATE INDEX IF NOT EXISTS idx_points_gov ON points(gov); CREATE INDEX IF NOT EXISTS idx_points_created ON points(created_at); CREATE INDEX IF NOT EXISTS idx_points_reporter ON points(reporter_id)');

const PC = ['id', 'title', 'title_en', 'type', 'gov', 'lat', 'lng', 'desc', 'desc_en', 'solution', 'solution_en', 'source', 'kind', 'approx', 'photos',
  'created_at', 'status', 'removed_at', 'removed_note', 'removed_note_en', 'reporter_id'];
const upsert = db.prepare(`INSERT OR REPLACE INTO points(${PC.map(c => `"${c}"`).join(',')}) VALUES(${PC.map(c => '@' + c).join(',')})`);
const rawPoint = r => r && ({ ...r, approx: !!r.approx, photos: JSON.parse(r.photos || '[]') });
// نسخة عامة للنشر: تُخفي معرّف المبلّغ وتُظهر اسمه العام (إن سمح) ورتبته وعدد التأكيدات فقط
const pubPoint = r => {
  if (!r) return r;
  const { reporter_id, u_name, u_public, u_app, u_rej, ...p } = rawPoint(r);
  p.confirms = r.confirms || 0;
  if (reporter_id && u_app !== null && u_app !== undefined) p.by = { n: u_public ? R.publicName(u_name) : null, r: R.level(u_app, u_rej).lv };
  return p;
};
const SEL = `SELECT p.*, u.name u_name, u.public u_public, u.approved u_app, u.rejected u_rej,
  (SELECT COUNT(*) FROM confirms c WHERE c.point_id=p.id) confirms FROM points p LEFT JOIN users u ON u.id=p.reporter_id`;
const getPoint = id => rawPoint(db.prepare('SELECT * FROM points WHERE id=?').get(id));

function savePoint(p) {
  const old = getPoint(p.id) || {};
  const status = p.status === 'removed' ? 'removed' : 'active';
  upsert.run({
    id: p.id, title: p.title || '', title_en: p.title_en || '', type: p.type, gov: p.gov, lat: +p.lat, lng: +p.lng,
    desc: p.desc || '', desc_en: p.desc_en || '', solution: p.solution || '', solution_en: p.solution_en || '',
    source: p.source || '', kind: p.kind || 'documented', approx: p.approx ? 1 : 0, photos: JSON.stringify(p.photos || []),
    created_at: 'created_at' in p ? (p.created_at || null) : (old.created_at || new Date().toISOString()),
    status, removed_at: status === 'removed' ? (p.removed_at || old.removed_at || new Date().toISOString().slice(0, 10)) : null,
    removed_note: status === 'removed' ? (p.removed_note ?? old.removed_note ?? '') : null,
    removed_note_en: status === 'removed' ? (p.removed_note_en ?? old.removed_note_en ?? '') : null,
    reporter_id: 'reporter_id' in p ? (p.reporter_id || null) : (old.reporter_id || null)
  });
}

// أول تشغيل: نستورد النقاط الحالية من data/points.json (بدون تاريخ إضافة لأن تاريخها الحقيقي غير معروف)
const f = path.join(__dirname, 'data', 'points.json');
if (db.prepare('SELECT COUNT(*) c FROM points').get().c === 0 && fs.existsSync(f)) {
  JSON.parse(fs.readFileSync(f, 'utf8')).forEach(p => savePoint({ ...p, created_at: null }));
  console.log('تم استيراد النقاط من points.json إلى قاعدة البيانات');
}
// تحديثات البيانات (تُطبّق مرة واحدة فقط لكل ملف، ولا تلمس ما عدّلته من لوحة الإدارة): v6 نقاط وإزالات، v20 نقاط جديدة موثّقة
for (const [file, key] of [['updates-v6.json', 'updates_v6'], ['updates-v20.json', 'updates_v20']]) {
  const uf = path.join(__dirname, 'data', file);
  if (!fs.existsSync(uf) || db.prepare('SELECT 1 FROM meta WHERE k=?').get(key)) continue;
  const u = JSON.parse(fs.readFileSync(uf, 'utf8'));
  u.points.forEach(p => { if (!getPoint(p.id)) savePoint(p); });
  (u.patches || []).forEach(pt => { const cur = getPoint(pt.id); if (cur && cur.status !== 'removed') savePoint({ ...cur, ...pt }); });
  db.prepare('INSERT INTO meta(k,v) VALUES(?,?)').run(key, new Date().toISOString());
  console.log('تم تطبيق تحديث البيانات', file);
}

const outPending = r => r && ({ ...r, photos: JSON.parse(r.photos || '[]') });
const U = { id: 'id', email: 'email', name: 'name', phone: 'phone', pass: 'pass', public: 'public', approved: 'approved', rejected: 'rejected', banned: 'banned', sv: 'sv', created_at: 'created_at', last_login: 'last_login' };
const nowIso = () => new Date().toISOString();

module.exports = {
  IS_REMOTE: false, ready: Promise.resolve(), health: () => db.prepare('SELECT 1').get(),
  savePoint, getPoint,
  allPoints: () => db.prepare(SEL).all().map(pubPoint),
  news: (n = 10) => ({
    added: db.prepare(SEL + " WHERE p.created_at IS NOT NULL AND p.created_at<>'' ORDER BY p.created_at DESC, p.id DESC LIMIT ?").all(n).map(pubPoint),
    removed: db.prepare(SEL + " WHERE p.status='removed' ORDER BY p.removed_at DESC, p.id DESC LIMIT ?").all(n).map(pubPoint)
  }),
  deletePoint: id => { db.prepare('DELETE FROM points WHERE id=?').run(id); db.prepare('DELETE FROM confirms WHERE point_id=?').run(id); },

  // ---- البلاغات المعلّقة ----
  addPending: r => db.prepare('INSERT INTO pending(id,name,phone,email,type,gov,lat,lng,"desc",photos,date,user_id,rank_lv) VALUES(@id,@name,@phone,@email,@type,@gov,@lat,@lng,@desc,@photos,@date,@user_id,@rank_lv)')
    .run({ user_id: null, rank_lv: 0, ...r, photos: JSON.stringify(r.photos) }),
  allPending: () => db.prepare('SELECT * FROM pending ORDER BY rank_lv DESC, date DESC').all().map(outPending),
  getPending: id => outPending(db.prepare('SELECT * FROM pending WHERE id=?').get(id)),
  deletePending: id => db.prepare('DELETE FROM pending WHERE id=?').run(id),
  pendingByUser: uid => db.prepare('SELECT * FROM pending WHERE user_id=?').all(uid).map(outPending),

  // ---- المستخدمون ----
  createUser: u => db.prepare('INSERT INTO users(id,email,name,phone,pass,public,approved,rejected,banned,sv,created_at,last_login) VALUES(@id,@email,@name,@phone,@pass,@public,@approved,@rejected,@banned,@sv,@created_at,@last_login)').run(u),
  userByEmail: e => db.prepare('SELECT * FROM users WHERE email=?').get(String(e).toLowerCase()),
  userById: id => db.prepare('SELECT * FROM users WHERE id=?').get(id),
  updateUser(id, patch) {
    const keys = Object.keys(patch).filter(k => U[k] && k !== 'id'); if (!keys.length) return;
    db.prepare(`UPDATE users SET ${keys.map(k => `${k}=@${k}`).join(',')} WHERE id=@id`).run({ ...Object.fromEntries(keys.map(k => [k, patch[k]])), id });
  },
  bumpUser(id, d) {
    db.prepare('UPDATE users SET approved=approved+@a, rejected=rejected+@r WHERE id=@id').run({ a: d.approved || 0, r: d.rejected || 0, id });
  },
  listUsers: () => db.prepare('SELECT * FROM users ORDER BY created_at DESC').all(),
  topUsers: n => db.prepare('SELECT * FROM users WHERE banned=0 AND approved>0').all().sort((a, b) => R.score(b.approved, b.rejected) - R.score(a.approved, a.rejected) || b.approved - a.approved).slice(0, n),
  deleteUser(id) {
    db.prepare('UPDATE points SET reporter_id=NULL WHERE reporter_id=?').run(id);
    db.prepare('DELETE FROM confirms WHERE user_id=?').run(id);
    db.prepare('UPDATE user_reports SET user_id=NULL, "desc"=NULL WHERE user_id=?').run(id);
    db.prepare('DELETE FROM pending WHERE user_id=?').run(id);
    db.prepare('DELETE FROM users WHERE id=?').run(id);
  },

  // ---- سجل بلاغات المستخدم ----
  addUserReport: r => db.prepare('INSERT INTO user_reports(id,user_id,type,gov,"desc",status,created_at) VALUES(@id,@user_id,@type,@gov,@desc,@status,@created_at)').run({ status: 'pending', created_at: nowIso(), ...r }),
  setReportStatus: (id, status, x = {}) => db.prepare('UPDATE user_reports SET status=?, decided_at=?, point_id=?, note=? WHERE id=?').run(status, nowIso(), x.point_id || null, x.note || null, id),
  userReports: (uid, n = 100) => db.prepare('SELECT * FROM user_reports WHERE user_id=? ORDER BY created_at DESC LIMIT ?').all(uid, n),
  countReports: (uid, { since, status } = {}) => db.prepare(`SELECT COUNT(*) c FROM user_reports WHERE user_id=?${since ? ' AND created_at>=?' : ''}${status ? ' AND status=?' : ''}`)
    .get(...[uid, since, status].filter(v => v !== undefined)).c,

  // ---- سجل التدقيق والتحليلات (لوحة الإدارة) ----
  addAudit: a => db.prepare('INSERT INTO audit(id,at,actor,action,target,detail) VALUES(?,?,?,?,?,?)').run(a.id, nowIso(), a.actor, a.action, a.target || '', a.detail || ''),
  listAudit: (n = 200) => db.prepare('SELECT * FROM audit ORDER BY at DESC LIMIT ?').all(n),
  allReports: (since) => since ? db.prepare('SELECT id,user_id,type,gov,status,created_at,decided_at,note FROM user_reports WHERE created_at>=?').all(since) : db.prepare('SELECT id,user_id,type,gov,status,created_at,decided_at,note FROM user_reports').all(),

  // ---- تأكيد المواطنين للنقاط ----
  toggleConfirm(pid, uid) {
    const has = db.prepare('SELECT 1 FROM confirms WHERE point_id=? AND user_id=?').get(pid, uid);
    if (has) db.prepare('DELETE FROM confirms WHERE point_id=? AND user_id=?').run(pid, uid);
    else db.prepare('INSERT INTO confirms(point_id,user_id,created_at) VALUES(?,?,?)').run(pid, uid, nowIso());
    return { confirmed: !has, count: db.prepare('SELECT COUNT(*) c FROM confirms WHERE point_id=?').get(pid).c };
  },
  myConfirms: uid => db.prepare('SELECT point_id FROM confirms WHERE user_id=?').all(uid).map(r => r.point_id)
};
