// يفحص كل روابط المصادر في قاعدة البيانات ويقول أيها يعمل: node scripts/check-links.js
// (يحتاج إنترنت. بعض المواقع تمنع الطلبات الآلية فتظهر 403: افتح الرابط يدوياً للتأكد.)
const db = require('../db');
(async () => {
  await db.ready;
  const pts = (await db.allPoints()).filter(p => /^https?:/.test(p.source));
  const urls = [...new Set(pts.map(p => p.source))];
  let bad = 0;
  for (const u of urls) {
    let st = 'ERR';
    try {
      const r = await fetch(u, { redirect: 'follow', headers: { 'user-agent': 'Mozilla/5.0 (link-check)' }, signal: AbortSignal.timeout(20000) });
      st = r.status;
    } catch (e) { st = 'ERR ' + (e.cause?.code || e.message); }
    const ok = st >= 200 && st < 400;
    if (!ok) bad++;
    console.log((ok ? 'OK   ' : 'FAIL ') + st + '  ' + u + '  [' + pts.filter(p => p.source === u).map(p => p.id).join(',') + ']');
  }
  console.log(`\n${urls.length - bad}/${urls.length} روابط تعمل`);
  process.exit(0);
})();
