// يبني نسخة ثابتة مجانية في مجلد dist/ تُرفع على Netlify / Cloudflare Pages / GitHub Pages بدون سيرفر.
// الاستخدام: node scripts/build-static.js   (بعد ملء static.config.json)
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..'), dist = path.join(root, 'dist');
const db = require('../db');
let cfg = {};
try { cfg = JSON.parse(fs.readFileSync(path.join(root, 'static.config.json'), 'utf8')); } catch (e) { console.warn('لا يوجد static.config.json: انسخ static.config.example.json إليه واملأه.'); }

(async () => {
await db.ready;
const all = await db.allPoints(), nw = await db.news(10);
fs.rmSync(dist, { recursive: true, force: true });
fs.cpSync(path.join(root, 'public'), dist, { recursive: true });
fs.mkdirSync(path.join(dist, 'api'), { recursive: true });
const w = (n, o) => fs.writeFileSync(path.join(dist, 'api', n), JSON.stringify(o));
w('governorates', JSON.parse(fs.readFileSync(path.join(root, 'data', 'governorates.json'), 'utf8')));
w('points', all);
w('news', nw);
w('ranks', require('../ranks').LEVELS.map(({ lv, min, acc, ar, en, day, pending }) => ({ lv, min, acc: Math.round(acc * 100), ar, en, day, pending })));
const up = path.join(process.env.DATA_DIR || path.join(root, 'data'), 'uploads');
if (fs.existsSync(up)) fs.cpSync(up, path.join(dist, 'uploads'), { recursive: true });
fs.writeFileSync(path.join(dist, 'config.js'), 'window.GC = ' + JSON.stringify({ STATIC: true, AUTH: false, REPORT_EMAIL: cfg.reportEmail || '', WHATSAPP: String(cfg.whatsapp || '').replace(/\D/g, ''), IMGBB: cfg.imgbbKey || '' }) + ';\n');
fs.writeFileSync(path.join(dist, '_headers'), '/api/*\n  Content-Type: application/json; charset=utf-8\n  Cache-Control: public, max-age=300\n/css/*\n  Cache-Control: public, max-age=31536000, immutable\n/js/*\n  Cache-Control: public, max-age=31536000, immutable\n/sw.js\n  Cache-Control: no-cache\n');
['admin.html', 'login.html', 'profile.html', 'leaderboard.html'].forEach(f => fs.rmSync(path.join(dist, f), { force: true }));
['login.js', 'profile.js', 'leaderboard.js'].forEach(f => fs.rmSync(path.join(dist, 'js', f), { force: true }));
fs.rmSync(path.join(dist, 'js', 'admin.js'), { force: true });

console.log('تم البناء في dist/  |  نقاط:', all.length);
if (!fs.existsSync(path.join(dist, 'data', 'iraq.geojson'))) console.warn('تحذير: public/data/iraq.geojson غير موجود، لن تظهر حدود المحافظات!');
if (!cfg.imgbbKey) console.warn('ملاحظة: بدون imgbbKey سترسل الصور عبر قائمة المشاركة في الموبايل فقط.');
if (!cfg.reportEmail && !cfg.whatsapp) console.warn('تحذير: املأ reportEmail أو whatsapp في static.config.json حتى يستقبل البلاغات.');
})().catch(e => { console.error(e); process.exit(1); });
