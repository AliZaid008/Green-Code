// ينقل بياناتك المحلية (data/app.db + صور uploads) إلى Supabase مرة واحدة.
// الاستخدام (على جهازك):  SUPABASE_URL=... SUPABASE_KEY=... node scripts/migrate-to-supabase.js
// في ويندوز PowerShell:   $env:SUPABASE_URL="..."; $env:SUPABASE_KEY="..."; node scripts/migrate-to-supabase.js
const fs = require('fs'), path = require('path');
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_KEY) { console.error('حدد SUPABASE_URL و SUPABASE_KEY أولاً'); process.exit(1); }
const local = require('../db-sqlite'), remote = require('../db-supabase');
const UP = path.join(process.env.DATA_DIR || path.join(__dirname, '..', 'data'), 'uploads');
const mime = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp' };

async function movePhotos(list) {
  const out = [];
  for (const u of list || []) {
    const m = /^\/uploads\/([^/]+)$/.exec(u), f = m && path.join(UP, m[1]);
    if (m && fs.existsSync(f)) out.push(await remote.uploadPhoto(fs.readFileSync(f), m[1], mime[path.extname(f).toLowerCase()] || 'image/jpeg'));
    else out.push(u);
  }
  return out;
}
(async () => {
  await remote.ready;
  const pts = local.allPoints(); let n = 0;
  for (const p of pts) { await remote.savePoint({ ...p, photos: await movePhotos(p.photos) }); n++; }
  const pend = local.allPending(); let k = 0;
  for (const r of pend) { await remote.addPending({ ...r, photos: await movePhotos(r.photos) }); k++; }
  console.log(`تم نقل ${n} نقطة و ${k} بلاغ معلّق إلى Supabase`);
})().catch(e => { console.error(e); process.exit(1); });
