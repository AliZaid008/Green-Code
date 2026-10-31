// حسابات المستخدمين: تشفير كلمات المرور (scrypt)، جلسات موقّعة في كوكي HttpOnly، وحدود محاولات.
const crypto = require('crypto'), fs = require('fs'), path = require('path'), { promisify } = require('util');
const scrypt = promisify(crypto.scrypt);
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const COOKIE = 'gc_sess', MAXAGE = 30 * 86400;

let SECRET = process.env.SESSION_SECRET && process.env.SESSION_SECRET.length >= 16 ? process.env.SESSION_SECRET : '';
if (!SECRET) {
  const f = path.join(DATA_DIR, 'session.secret');
  try { SECRET = fs.readFileSync(f, 'utf8').trim(); } catch (e) {}
  if (!SECRET) {
    SECRET = crypto.randomBytes(32).toString('hex');
    try { fs.mkdirSync(DATA_DIR, { recursive: true }); fs.writeFileSync(f, SECRET, { mode: 0o600 }); } catch (e) {}
    console.warn('تنبيه: SESSION_SECRET غير مضبوط. تم توليد مفتاح محلي. على الاستضافة المجانية ضع SESSION_SECRET في المتغيرات حتى لا تنتهي الجلسات عند كل إعادة تشغيل.');
  }
}
const sign = p => crypto.createHmac('sha256', SECRET).update(p).digest('hex').slice(0, 40);

async function hash(pw) {
  const salt = crypto.randomBytes(16), key = await scrypt(pw, salt, 64);
  return 's1$' + salt.toString('hex') + '$' + key.toString('hex');
}
async function verify(pw, stored) {
  const parts = String(stored || '').split('$');
  if (parts.length !== 3 || parts[0] !== 's1') { await scrypt(pw, Buffer.alloc(16), 64); return false; }   // نفس الزمن تقريباً حتى لو الحساب غير موجود
  const key = await scrypt(pw, Buffer.from(parts[1], 'hex'), 64), want = Buffer.from(parts[2], 'hex');
  return key.length === want.length && crypto.timingSafeEqual(key, want);
}

const parseCookies = h => Object.fromEntries(String(h || '').split(';').map(s => s.trim()).filter(Boolean).map(s => { const i = s.indexOf('='); return [s.slice(0, i), decodeURIComponent(s.slice(i + 1))]; }));
function setSession(res, u, req) {
  const payload = `${u.id}.${Math.floor(Date.now() / 1000) + MAXAGE}.${u.sv || 0}`, secure = req.secure || req.get('x-forwarded-proto') === 'https' || process.env.NODE_ENV === 'production';
  res.append('Set-Cookie', `${COOKIE}=${payload}.${sign(payload)}; Max-Age=${MAXAGE}; Path=/; HttpOnly; SameSite=Lax${secure ? '; Secure' : ''}`);
}
const clearSession = res => res.append('Set-Cookie', `${COOKIE}=; Max-Age=0; Path=/; HttpOnly; SameSite=Lax`);
function readToken(req) {
  const v = parseCookies(req.headers.cookie)[COOKIE]; if (!v) return null;
  const i = v.lastIndexOf('.'); if (i < 0) return null;
  const payload = v.slice(0, i), sig = v.slice(i + 1), want = sign(payload);
  if (sig.length !== want.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(want))) return null;
  const [uid, exp, sv] = payload.split('.');
  if (!uid || +exp < Date.now() / 1000) return null;
  return { uid, sv: +sv || 0 };
}
// يحمّل المستخدم الحالي (أو null) ويتحقق أنه غير محظور وأن الجلسة لم تُلغَ (تغيير كلمة المرور يلغي الجلسات القديمة)
const loader = db => async (req, res, next) => {
  req.user = null;
  try {
    const t = readToken(req);
    if (t) { const u = await db.userById(t.uid); if (u && !u.banned && (u.sv || 0) === t.sv) req.user = u; }
  } catch (e) { console.error('session:', e.message); }
  next();
};
// حد محاولات بسيط في الذاكرة
function limiter(max, windowMs, key = req => req.ip) {
  const hits = new Map();
  setInterval(() => { const now = Date.now(); for (const [k, a] of hits) if (!a.some(t => now - t < windowMs)) hits.delete(k); }, 60e3).unref();
  const mw = (req, res, next) => {
    const k = key(req), now = Date.now(), a = (hits.get(k) || []).filter(t => now - t < windowMs);
    if (a.length >= max) return res.status(429).json({ code: 'rate', error: 'محاولات كثيرة، حاول لاحقاً.' });
    a.push(now); hits.set(k, a); next();
  };
  mw.reset = k => hits.delete(k);
  return mw;
}
module.exports = { hash, verify, setSession, clearSession, loader, limiter, readToken };
