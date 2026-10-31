// iraq3d.js: عرض ثلاثي الأبعاد للعراق بدون مكتبات (canvas + إسقاط منظوري + ترتيب الرسّام).
// المحافظات منشورة (extruded) بارتفاع يتناسب مع عدد المواقع الموثقة، ودبابيس ملونة للنقاط، وبلورات عائمة اختيارية للزينة.
(function (root) {
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const LON0 = 43.7, LAT0 = 33.1, KX = 0.84;
  const toXY = (lng, lat) => [(lng - LON0) * KX, lat - LAT0];

  // تبسيط Douglas-Peucker (غير تكراري) لتخفيف عدد الأضلاع
  function simplify(pts, tol) {
    if (pts.length < 8) return pts;
    const keep = new Uint8Array(pts.length); keep[0] = keep[pts.length - 1] = 1; const st = [[0, pts.length - 1]];
    while (st.length) {
      const [a, b] = st.pop(); let md = 0, mi = -1; const [ax, ay] = pts[a], [bx, by] = pts[b], dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy || 1e-12;
      for (let i = a + 1; i < b; i++) {
        const t = clamp(((pts[i][0] - ax) * dx + (pts[i][1] - ay) * dy) / l2, 0, 1), px = ax + t * dx - pts[i][0], py = ay + t * dy - pts[i][1], d = px * px + py * py;
        if (d > md) { md = d; mi = i; }
      }
      if (md > tol * tol && mi > 0) { keep[mi] = 1; st.push([a, mi], [mi, b]); }
    }
    return pts.filter((_, i) => keep[i]);
  }
  const area = r => { let s = 0; for (let i = 0, j = r.length - 1; i < r.length; j = i++) s += (r[j][0] * r[i][1] - r[i][0] * r[j][1]); return s / 2; };
  const mix = (a, b, k) => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
  const rgb = (c, m = 1, a = 1) => `rgba(${Math.round(c[0] * m)},${Math.round(c[1] * m)},${Math.round(c[2] * m)},${a})`;
  const hex = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];

  class Iraq3D {
    constructor(canvas, o = {}) {
      this.cv = canvas; this.ctx = canvas.getContext('2d'); this.o = o;
      this.yaw = o.yaw ?? -0.35; this.pitch = o.pitch ?? 0.92; this.zoom = 1; this.t = 0; this.sway = 0;
      this.govs = []; this.h = {}; this.th = {}; this.counts = {}; this.max = 1; this.pins = []; this.hover = null; this.sel = null;
      this.inset = { l: 0, r: 0, t: 0, b: 0 }; this.hits = []; this.pinHits = []; this.visible = true; this.last = performance.now(); this.idle = 0; this.dirty = true;
      this.crystals = o.crystals ? [...Array(o.crystals)].map((_, i) => ({ a: i * 6.283 / o.crystals + 0.4, r: 4.5 + (i % 3) * 0.55, z: 1.1 + (i % 4) * 0.55, s: 0.34 + (i % 3) * 0.1, sp: 0.25 + (i % 5) * 0.07, c: (o.crystalColors || ['#78909c'])[i % (o.crystalColors || [1]).length] })) : [];
      this.resize(); new ResizeObserver(() => this.resize()).observe(canvas);
      new IntersectionObserver(e => { this.visible = e[0].isIntersecting; }).observe(canvas);
      if (o.interactive !== false) this.bind();
      this.loop = this.loop.bind(this); requestAnimationFrame(this.loop);
    }
    resize() {
      const r = this.cv.getBoundingClientRect(), d = Math.min(devicePixelRatio || 1, 2); this.W = r.width; this.H = r.height; this.d = d;
      this.cv.width = Math.max(1, r.width * d); this.cv.height = Math.max(1, r.height * d); this.dirty = true;
    }
    // geojson + مصفوفة المحافظات (لها iso)
    load(gj, govs) {
      this.govs = [];
      gj.features.forEach(f => {
        const g = govs.find(x => x.iso === f.properties.shapeISO); if (!g) return;
        const rings = [];
        (f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates).forEach(poly => {
          let r = simplify(poly[0].map(([lng, lat]) => toXY(lng, lat)), 0.028); if (r.length > 1 && r[0][0] === r[r.length - 1][0] && r[0][1] === r[r.length - 1][1]) r = r.slice(0, -1);
          if (r.length < 3) return; if (area(r) < 0) r.reverse(); rings.push(r);
        });
        let ent = this.govs.find(x => x.id === g.id); if (!ent) { ent = { id: g.id, rings: [], ar: g.ar, en: g.en, c: toXY(g.center[1], g.center[0]) }; this.govs.push(ent); this.h[g.id] = 0.04; this.th[g.id] = 0.04; }
        ent.rings.push(...rings);
      });
      this.dirty = true;
    }
    setCounts(c) {
      this.counts = c; this.max = Math.max(1, ...Object.values(c));
      this.govs.forEach(g => { const n = c[g.id] || 0; this.th[g.id] = 0.05 + (n ? 0.1 + 0.95 * Math.pow(n / this.max, 0.8) : 0); });
      this.dirty = true;
    }
    setPins(p) { this.pins = p; this.dirty = true; }
    setInset(i) { this.inset = i; this.dirty = true; }
    // ----- إسقاط -----
    cam() {
      const { l, r, t, b } = this.inset, aw = Math.max(80, this.W - l - r), ah = Math.max(80, this.H - t - b);
      this.cx = l + aw / 2; this.cy = t + ah / 2 + ah * 0.02; this.S = Math.min(aw / 12.6, ah * 1.12 / 9.6) * this.zoom;
      this.cy_ = Math.cos(this.yawE); this.sy_ = Math.sin(this.yawE); this.cp = Math.cos(this.pitch); this.sp = Math.sin(this.pitch);
    }
    P(x, y, z) {
      const x1 = x * this.cy_ - y * this.sy_, y1 = x * this.sy_ + y * this.cy_, up = y1 * this.sp + z * this.cp, d = -y1 * this.cp + z * this.sp, f = 1 / (1 - d * 0.055);
      return [this.cx + x1 * this.S * f, this.cy - up * this.S * f, d];
    }
    bind() {
      const cv = this.cv, pts = new Map(); let down = null, pinch = 0;
      const mode = this.o.touch === 'pan-y' ? 'pan-y' : 'none'; cv.style.touchAction = mode;
      const rel = e => { const r = cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
      cv.addEventListener('pointerdown', e => { cv.setPointerCapture(e.pointerId); pts.set(e.pointerId, [e.clientX, e.clientY]); this.idle = 0; if (pts.size === 1) down = { x: e.clientX, y: e.clientY, moved: false, t: performance.now() }; else { pinch = Math.hypot(...[...pts.values()].reduce((a, p, i) => i ? [a[0] - p[0], a[1] - p[1]] : p, [0, 0])); down && (down.moved = true); } });
      cv.addEventListener('pointermove', e => {
        const [px, py] = rel(e);
        if (!pts.has(e.pointerId)) { if (e.pointerType === 'mouse') { const h = this.pick(px, py); const id = h && (h.gov || null); if (id !== this.hover) { this.hover = id; this.dirty = true; this.o.onHover && this.o.onHover(id, px, py); } else if (id) this.o.onHover && this.o.onHover(id, px, py); cv.style.cursor = h ? 'pointer' : 'grab'; } return; }
        const pr = pts.get(e.pointerId); pts.set(e.pointerId, [e.clientX, e.clientY]); this.idle = 0;
        if (pts.size === 1) {
          if (down && Math.hypot(e.clientX - down.x, e.clientY - down.y) > 6) down.moved = true;
          if (down && down.moved) { this.yaw += (e.clientX - pr[0]) * 0.008; if (mode === 'none') this.pitch = clamp(this.pitch + (e.clientY - pr[1]) * 0.006, 0.35, 1.45); this.dirty = true; }
        } else if (pts.size === 2) {
          const a = [...pts.values()], d = Math.hypot(a[0][0] - a[1][0], a[0][1] - a[1][1]); if (pinch > 0) this.zoom = clamp(this.zoom * d / pinch, 0.6, 3); pinch = d; this.dirty = true;
        }
      });
      const up = e => {
        if (!pts.has(e.pointerId)) return; pts.delete(e.pointerId);
        if (!pts.size && down && !down.moved && performance.now() - down.t < 700) { const [px, py] = rel(e), h = this.pick(px, py); if (h) { this.sel = h.gov || this.sel; this.dirty = true; this.o.onPick && this.o.onPick(h); } }
        if (!pts.size) down = null;
      };
      cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
      cv.addEventListener('pointerleave', () => { if (this.hover) { this.hover = null; this.dirty = true; this.o.onHover && this.o.onHover(null); } });
      if (this.o.wheel !== false) cv.addEventListener('wheel', e => { e.preventDefault(); this.zoom = clamp(this.zoom * Math.exp(-e.deltaY * 0.0014), 0.6, 3); this.idle = 0; this.dirty = true; }, { passive: false });
    }
    pick(px, py) {
      for (let i = this.pinHits.length - 1; i >= 0; i--) { const h = this.pinHits[i]; if (Math.hypot(px - h.x, py - h.y) < (h.r || 11)) return h.id ? { pin: h.id, gov: h.gov } : { gov: h.gov }; }
      for (let i = this.hits.length - 1; i >= 0; i--) {
        const h = this.hits[i], p = h.p; let c = false;
        for (let a = 0, b = p.length - 2; a < p.length; b = a, a += 2) { const xi = p[a], yi = p[a + 1], xj = p[b], yj = p[b + 1]; if ((yi > py) !== (yj > py) && px < (xj - xi) * (py - yi) / (yj - yi) + xi) c = !c; }
        if (c) return { gov: h.gov };
      }
      return null;
    }
    loop(now) {
      requestAnimationFrame(this.loop);
      const dt = Math.min(0.05, (now - this.last) / 1000); this.last = now;
      if (!this.visible || document.hidden) return;
      this.t += dt; this.idle += dt;
      const amp = !REDUCED && this.o.sway !== false && this.idle > 1.8 ? 0.45 : 0; this.sway += (amp - this.sway) * Math.min(1, dt * 1.5);
      let moving = Math.abs(amp - this.sway) > 0.002 || (amp > 0);
      for (const g of this.govs) { const d = this.th[g.id] - this.h[g.id]; if (Math.abs(d) > 0.002) { this.h[g.id] += d * Math.min(1, dt * 6); moving = true; } else this.h[g.id] = this.th[g.id]; }
      if (this.crystals.length && !REDUCED) moving = true;
      if (this.dirty || moving) { this.dirty = false; this.draw(); }
    }
    draw() {
      const c = this.ctx, d = this.d; c.setTransform(d, 0, 0, d, 0, 0); c.clearRect(0, 0, this.W, this.H);
      this.yawE = this.yaw + this.sway * Math.sin(this.t * 0.42); this.cam();
      // أرضية: توهج + شبكة
      const [gx, gy] = this.P(0, 0, 0), gr = this.S * 6.5; const gl = c.createRadialGradient(gx, gy, 0, gx, gy, gr); gl.addColorStop(0, 'rgba(127,240,196,.16)'); gl.addColorStop(1, 'rgba(127,240,196,0)');
      c.fillStyle = gl; c.fillRect(0, 0, this.W, this.H);
      c.strokeStyle = 'rgba(127,240,196,.08)'; c.lineWidth = 1; c.beginPath();
      for (let i = -8; i <= 8; i += 1) { const a = this.P(i, -8, 0), b = this.P(i, 8, 0), e = this.P(-8, i, 0), f = this.P(8, i, 0); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); c.moveTo(e[0], e[1]); c.lineTo(f[0], f[1]); }
      c.stroke();
      const faces = []; this.hits = []; const cnt = this.counts, maxc = this.max;
      const LX = -0.55, LY = -0.83;   // اتجاه الإضاءة (في فضاء الشاشة)
      for (const g of this.govs) {
        const hh = this.h[g.id], k = clamp((cnt[g.id] || 0) / maxc, 0, 1), sel = this.sel === g.id, hov = this.hover === g.id;
        const base = hov ? [233, 180, 76] : sel ? [255, 138, 61] : mix([18, 74, 66], [96, 232, 188], Math.pow(k, 0.7));
        for (const ring of g.rings) {
          const n = ring.length, lo = new Array(n), hi = new Array(n);
          for (let i = 0; i < n; i++) { lo[i] = this.P(ring[i][0], ring[i][1], 0); hi[i] = this.P(ring[i][0], ring[i][1], hh); }
          for (let i = 0; i < n; i++) {
            const j = (i + 1) % n, ex = ring[j][0] - ring[i][0], ey = ring[j][1] - ring[i][1];
            const nx = ey, ny = -ex, n1y = nx * this.sy_ + ny * this.cy_;   // الناظم بعد الدوران (المحور y)
            if (n1y >= 0) continue;   // وجه خلفي
            const n1x = nx * this.cy_ - ny * this.sy_, ln = Math.hypot(n1x, n1y) || 1, lit = clamp(0.42 + 0.58 * ((n1x * LX + n1y * LY) / ln) * -1, 0.2, 1);
            const q = [lo[i][0], lo[i][1], lo[j][0], lo[j][1], hi[j][0], hi[j][1], hi[i][0], hi[i][1]];
            faces.push({ d: (lo[i][2] + lo[j][2] + hi[i][2] + hi[j][2]) / 4, q, f: rgb(base, 0.46 * lit + 0.1), s: rgb(base, 0.9, 0.18), gov: g.id, wall: 1 });
          }
          const tp = new Array(n * 2); let dd = 0; for (let i = 0; i < n; i++) { tp[i * 2] = hi[i][0]; tp[i * 2 + 1] = hi[i][1]; dd += hi[i][2]; }
          faces.push({ d: dd / n + 0.001, q: tp, f: rgb(base, hov || sel ? 1 : 0.62 + 0.38 * k), s: hov || sel ? 'rgba(255,255,255,.9)' : rgb(base, 1.25, 0.65), gov: g.id, top: 1, lw: hov || sel ? 2 : 1.1 });
        }
      }
      // دبابيس
      this.pinHits = []; const gh = id => this.h[id] ?? 0.05;
      // تجميع الدبابيس المتقاربة على الشاشة في فقاعة واحدة بعدّاد (تتفكك عند التكبير)
      const items = this.pins.map(p => { const [x, y] = toXY(p.lng, p.lat), z0 = gh(p.gov); return { p, a: this.P(x, y, z0), b: this.P(x, y, z0 + 0.3) }; }).sort((u, v) => u.a[1] - v.a[1]);
      const CR = 15, groups = [];
      items.forEach(it => { const g = groups.find(g => Math.hypot(g.b[0] - it.b[0], g.b[1] - it.b[1]) < CR); if (g) { g.m.push(it); g.b = [(g.b[0] * (g.m.length - 1) + it.b[0]) / g.m.length, (g.b[1] * (g.m.length - 1) + it.b[1]) / g.m.length, g.b[2]]; g.a = [(g.a[0] * (g.m.length - 1) + it.a[0]) / g.m.length, (g.a[1] * (g.m.length - 1) + it.a[1]) / g.m.length, g.a[2]]; } else groups.push({ m: [it], a: it.a.slice(), b: it.b.slice() }); });
      groups.forEach(g => { const p = g.m[0].p; faces.push({ d: g.a[2] + 0.4, grp: g, a: g.a, b: g.b, n: g.m.length, pin: p, col: p.c, gone: p.gone }); });
      // بلورات عائمة
      this.crystals.forEach((cr, i) => {
        const ang = cr.a + this.t * cr.sp * (REDUCED ? 0 : 1), cx = Math.cos(ang) * cr.r, cy = Math.sin(ang) * cr.r * 0.8, cz = cr.z + Math.sin(this.t * 0.9 + i) * 0.16, s = cr.s, rot = this.t * (0.6 + i * 0.13);
        const V = [[s, 0, 0], [-s, 0, 0], [0, s, 0], [0, -s, 0], [0, 0, s * 1.5], [0, 0, -s * 1.5]].map(([vx, vy, vz]) => { const rx = vx * Math.cos(rot) - vy * Math.sin(rot), ry = vx * Math.sin(rot) + vy * Math.cos(rot); return this.P(cx + rx, cy + ry, cz + vz); });
        const col = hex(cr.c); [[0, 2, 4], [2, 1, 4], [1, 3, 4], [3, 0, 4], [2, 0, 5], [1, 2, 5], [3, 1, 5], [0, 3, 5]].forEach((tri, k) => {
          const A = V[tri[0]], B = V[tri[1]], C = V[tri[2]], cross = (B[0] - A[0]) * (C[1] - A[1]) - (B[1] - A[1]) * (C[0] - A[0]);
          faces.push({ d: (A[2] + B[2] + C[2]) / 3 + 0.2, q: [A[0], A[1], B[0], B[1], C[0], C[1]], f: rgb(col, 0.55 + 0.1 * (k % 4), 0.88), s: 'rgba(255,255,255,.45)', lw: 1, crystal: 1 });
        });
      });
      faces.sort((a, b) => a.d - b.d);
      c.lineJoin = 'round';
      for (const f of faces) {
        if (f.pin) {
          const { a, b } = f, n = f.n;
          c.beginPath(); c.ellipse(a[0], a[1], n > 1 ? 7 : 4.5, n > 1 ? 3 : 2, 0, 0, 6.2832); c.fillStyle = 'rgba(0,0,0,.35)'; c.fill();   // ظل على الأرض
          c.strokeStyle = 'rgba(255,255,255,.7)'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); c.stroke();
          if (n > 1) {
            const same = f.grp.m.every(m => m.p.c === f.col), R = 8 + Math.min(5, Math.sqrt(n));
            c.beginPath(); c.arc(b[0], b[1], R, 0, 6.2832); c.fillStyle = same ? f.col : '#0f766e'; c.fill(); c.lineWidth = 2; c.strokeStyle = '#fff'; c.stroke();
            c.fillStyle = '#fff'; c.font = '700 ' + (n > 9 ? 10 : 11) + 'px system-ui,sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(n, b[0], b[1] + 0.5);
            this.pinHits.push({ x: b[0], y: b[1], r: R + 2, gov: f.pin.gov });
          } else {
            c.beginPath(); c.arc(b[0], b[1], f.gone ? 4 : 4.5, 0, 6.2832); c.fillStyle = f.gone ? 'rgba(187,247,208,.55)' : f.col; c.fill(); c.lineWidth = f.gone ? 2 : 1.6; c.strokeStyle = f.gone ? '#22c55e' : '#fff'; c.stroke();
            this.pinHits.push({ x: b[0], y: b[1], r: 11, id: f.pin.id, gov: f.pin.gov });
          }
          continue;
        }
        const q = f.q; c.beginPath(); c.moveTo(q[0], q[1]); for (let i = 2; i < q.length; i += 2) c.lineTo(q[i], q[i + 1]); c.closePath();
        c.fillStyle = f.f; c.fill(); c.lineWidth = f.lw || 0.8; c.strokeStyle = f.s; c.stroke();
        if (f.gov) this.hits.push({ gov: f.gov, p: q });
      }
      // اسم المحافظة المحددة/المؤشَّر عليها + الأسماء الدائمة
      const showAll = this.o.labels;
      c.textAlign = 'center'; c.textBaseline = 'middle'; c.lineWidth = 4; c.strokeStyle = 'rgba(4,22,19,.95)';
      const placed = [], order = [...this.govs].sort((u, v) => (+(this.hover === v.id || this.sel === v.id) - +(this.hover === u.id || this.sel === u.id)) || (cnt[v.id] || 0) - (cnt[u.id] || 0));
      order.forEach(g => {
        const on = this.hover === g.id || this.sel === g.id; if (!on && !(showAll && (cnt[g.id] || 0) > 0)) return;
        const p = this.P(g.c[0], g.c[1], this.h[g.id] + (showAll ? 0.75 : 0.35)), fs = on ? 14 : 11.5, lang = document.documentElement.lang;
        c.font = `800 ${fs}px Tajawal, sans-serif`; const txt = (lang === 'en' ? g.en : g.ar) + ' · ' + (cnt[g.id] || 0), w = c.measureText(txt).width + 6, y = p[1] - (on ? 0 : 20);
        const box = [p[0] - w / 2, y - fs / 2 - 2, p[0] + w / 2, y + fs / 2 + 2];
        if (!on && placed.some(r => box[0] < r[2] && box[2] > r[0] && box[1] < r[3] && box[3] > r[1])) return;   // لا نرسم اسماً يتداخل مع اسم آخر
        placed.push(box); c.strokeText(txt, p[0], y); c.fillStyle = on ? '#ffd166' : '#fff'; c.fillText(txt, p[0], y);
      });
    }
  }
  root.Iraq3D = Iraq3D;
})(window);
