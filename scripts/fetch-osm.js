// يجلب منشآت حقيقية يُحتمل أن تكون مصادر تلوث من OpenStreetMap ويوزعها على المحافظات.
// التشغيل (مرة واحدة): node scripts/fetch-osm.js
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..');
const geo = JSON.parse(fs.readFileSync(path.join(root, 'public/data/iraq.geojson'), 'utf8'));
const govs = JSON.parse(fs.readFileSync(path.join(root, 'data/governorates.json'), 'utf8'));
const PER_GOV = 40; // أقصى عدد نقاط لكل محافظة

function inRing(pt, ring) {
  let c = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if ((yi > pt[1]) !== (yj > pt[1]) && pt[0] < (xj - xi) * (pt[1] - yi) / (yj - yi) + xi) c = !c;
  }
  return c;
}
const inFeature = (pt, f) => (f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates).some(p => inRing(pt, p[0]));
const featGov = geo.features.map(f => govs.find(g => inFeature([g.center[1], g.center[0]], f)));
const govOf = (lat, lng) => { const i = geo.features.findIndex(f => inFeature([lng, lat], f)); return i < 0 || !featGov[i] ? null : featGov[i].id; };

const QUERY = `[out:json][timeout:300];
area["ISO3166-1"="IQ"][admin_level=2]->.a;
(
 nwr(area.a)["landuse"="landfill"];
 nwr(area.a)["power"="plant"];
 nwr(area.a)["industrial"="brickworks"];
 nwr(area.a)["industrial"="refinery"];
 nwr(area.a)["man_made"="flare"];
 nwr(area.a)["man_made"="petroleum_well"];
 nwr(area.a)["man_made"="wastewater_plant"];
 nwr(area.a)["amenity"="fuel"];
 nwr(area.a)["landuse"="quarry"];
 nwr(area.a)["man_made"="works"];
 nwr(area.a)["landuse"="industrial"];
 nwr(area.a)["man_made"="chimney"];
 nwr(area.a)["man_made"="storage_tank"];
);
out center tags;`;

function classify(t) {
  if (t.landuse === 'landfill') return { type: 'waste', label: 'مكب نفايات' };
  if (t.power === 'plant') return { type: 'air', label: 'محطة توليد كهرباء' };
  if (t.industrial === 'brickworks') return { type: 'air', label: 'معمل طابوق' };
  if (t.man_made === 'flare') return { type: 'air', label: 'مشعل غاز' };
  if (t.industrial === 'refinery') return { type: 'oil', label: 'مصفى نفط' };
  if (t.man_made === 'petroleum_well') return { type: 'oil', label: 'بئر نفط' };
  if (t.man_made === 'wastewater_plant') return { type: 'water', label: 'محطة معالجة مياه صرف (نقطة تصريف محتملة)' };
  if (t.amenity === 'fuel') return { type: 'oil', label: 'محطة وقود' };
  if (t.landuse === 'quarry') return { type: 'soil', label: 'مقلع (غبار وتأثير على التربة)' };
  if (t.man_made === 'works') return { type: 'air', label: 'معمل / منشأة صناعية' };
  if (t.landuse === 'industrial') return { type: 'air', label: 'منطقة صناعية' };
  if (t.man_made === 'chimney') return { type: 'air', label: 'مدخنة' };
  if (t.man_made === 'storage_tank') return { type: 'oil', label: 'خزان تخزين وقود/مواد' };
  return null;
}

(async () => {
  let data;
  for (const url of ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter']) {
    try {
      console.log('جاري الجلب من', url, '... (قد يستغرق دقيقة)');
      const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'data=' + encodeURIComponent(QUERY) });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      data = await r.json(); break;
    } catch (e) { console.log('فشل:', e.message); }
  }
  if (!data) return console.log('تعذر الجلب. جرّب مرة ثانية بعد دقائق.');

  const byGov = {};
  let classified = 0, assigned = 0;
  for (const el of data.elements) {
    const lat = el.lat ?? el.center?.lat, lng = el.lon ?? el.center?.lon, t = el.tags || {};
    const c = classify(t); if (!c || lat == null) continue;
    classified++;
    const gov = govOf(lat, lng); if (!gov) continue;
    assigned++;
    const name = t['name:ar'] || t.name || '';
    ((byGov[gov] ??= {})[c.label] ??= []).push({
      id: `osm-${el.type}-${el.id}`, title: name ? `${c.label}: ${name}` : c.label, type: c.type, gov, lat, lng,
      desc: `${c.label} مسجّل في خريطة OpenStreetMap. هذا مصدر محتمل للتلوث وليس بلاغاً مؤكداً، ويحتاج زيارة ميدانية للتحقق.`,
      solution: '', source: `https://www.openstreetmap.org/${el.type}/${el.id}`, approx: false, kind: 'potential', photos: []
    });
  }

  console.log(`\nتم جلب ${data.elements.length} عنصر، صُنّف منها ${classified}، ووُزّع على المحافظات ${assigned}.`);
  const added = [];
  for (const gov of Object.keys(byGov)) { // توزيع متوازن بين أنواع المنشآت
    const buckets = Object.values(byGov[gov]); let n = 0;
    for (let i = 0; n < PER_GOV; i++) {
      let any = false;
      for (const b of buckets) if (b[i] && n < PER_GOV) { added.push(b[i]); n++; any = true; }
      if (!any) break;
    }
  }
  const file = path.join(root, 'data/points.json');
  const keep = JSON.parse(fs.readFileSync(file, 'utf8')).filter(p => !String(p.id).startsWith('osm-'));
  fs.writeFileSync(file, JSON.stringify([...keep, ...added], null, 2));

  console.log('\nعدد النقاط لكل محافظة (مع النقاط اليدوية):');
  const all = [...keep, ...added];
  for (const g of govs) console.log(g.ar.padEnd(14), all.filter(p => p.gov === g.id).length);
})();
