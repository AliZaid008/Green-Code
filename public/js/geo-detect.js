// تحديد المحافظة من الإحداثيات. نفس الملف يعمل في المتصفح (للعرض الفوري) وفي السيرفر (للتحقق النهائي).
// الترتيب: 1) نصف قطر "قلب المدينة" للمحافظات التي حدودها المبسّطة غير دقيقة (بغداد)  2) نقطة داخل مضلع  3) أقرب حدود ضمن بضعة كيلومترات.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(); else root.GeoDetect = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  const TOL_KM = 6;
  const rad = Math.PI / 180;
  function inRing(x, y, ring) {
    let c = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const xi = ring[i][0], yi = ring[i][1], xj = ring[j][0], yj = ring[j][1];
      if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c;
    }
    return c;
  }
  function edgeKm(lat, lng, ring) {
    const kx = 111.32 * Math.cos(lat * rad), ky = 110.57; let best = 1e9;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const ax = (ring[j][0] - lng) * kx, ay = (ring[j][1] - lat) * ky, bx = (ring[i][0] - lng) * kx, by = (ring[i][1] - lat) * ky;
      const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy, t = l2 ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / l2)) : 0;
      best = Math.min(best, Math.hypot(ax + t * dx, ay + t * dy));
    }
    return best;
  }
  function create(govs, geojson) {
    const byIso = {}; govs.forEach(g => { byIso[g.iso] = g.id; });
    const cores = govs.filter(g => g.core_km).map(g => ({ id: g.id, lat: g.center[0], lng: g.center[1], km: g.core_km }));
    const polys = [];
    geojson.features.forEach(f => {
      const id = byIso[f.properties.shapeISO]; if (!id) return;
      (f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates).forEach(p => {
        let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
        p[0].forEach(c => { if (c[0] < x0) x0 = c[0]; if (c[0] > x1) x1 = c[0]; if (c[1] < y0) y0 = c[1]; if (c[1] > y1) y1 = c[1]; });
        polys.push({ id, ring: p[0], holes: p.slice(1), bbox: [x0, y0, x1, y1] });
      });
    });
    // يرجع {id, how} أو null إذا كان الموقع خارج العراق
    function detect(lat, lng) {
      lat = +lat; lng = +lng; if (!isFinite(lat) || !isFinite(lng)) return null;
      for (const c of cores) {
        const d = Math.hypot((lng - c.lng) * 111.32 * Math.cos(lat * rad), (lat - c.lat) * 110.57);
        if (d <= c.km) return { id: c.id, how: 'core' };
      }
      for (const p of polys) {
        const b = p.bbox; if (lng < b[0] || lng > b[2] || lat < b[1] || lat > b[3]) continue;
        if (inRing(lng, lat, p.ring) && !p.holes.some(h => inRing(lng, lat, h))) return { id: p.id, how: 'polygon' };
      }
      let best = null, bd = TOL_KM;
      for (const p of polys) { const d = edgeKm(lat, lng, p.ring); if (d < bd) { bd = d; best = p.id; } }
      return best ? { id: best, how: 'edge' } : null;
    }
    return { detect, govAt: (lat, lng) => { const r = detect(lat, lng); return r && r.id; } };
  }
  return { create };
});
