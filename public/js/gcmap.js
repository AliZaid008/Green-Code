// gcmap.js: محرك خرائط خفيف (Web Mercator) بدون مكتبات خارجية.
// بلاطات OpenStreetMap على canvas سفلي + canvas علوي يرسم عليه التطبيق (المحافظات، النقاط، التجميع).
// يدعم: سحب، عجلة ماوس، قرص بإصبعين، نقر مزدوج، لوحة مفاتيح، وانتقال متحرك (flyTo / fitBounds).
(function (root) {
  const TS = 256, MINZ = 4.2, MAXZ = 18;
  const mx = lng => (lng + 180) / 360;
  const my = lat => { const s = Math.sin(lat * Math.PI / 180); return 0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI); };
  const lngOf = x => x * 360 - 180;
  const latOf = y => { const n = Math.PI - 2 * Math.PI * y; return 180 / Math.PI * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n))); };
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;

  class GCMap {
    constructor(host, opt = {}) {
      this.host = host; this.tileUrl = opt.tileUrl || 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
      this.tc = document.createElement('canvas'); this.tc.className = 'gcm-tiles';
      this.vc = document.createElement('canvas'); this.vc.className = 'gcm-vec';
      host.prepend(this.vc); host.prepend(this.tc);
      this.tctx = this.tc.getContext('2d'); this.vctx = this.vc.getContext('2d');
      this.cx = mx(43.7); this.cy = my(33); this.z = 5.6;
      this.h = {}; this.tiles = new Map(); this.dirty = true; this.anim = null; this.keep = false;
      this.resize();
      new ResizeObserver(() => this.resize()).observe(host);
      this.bind();
      this.loop = this.loop.bind(this); requestAnimationFrame(this.loop);
    }
    get scale() { return TS * Math.pow(2, this.z); }
    toScreen(x, y) { const s = this.scale; return [(x - this.cx) * s + this.W / 2, (y - this.cy) * s + this.H / 2]; }
    toWorld(px, py) { const s = this.scale; return [(px - this.W / 2) / s + this.cx, (py - this.H / 2) / s + this.cy]; }
    ll2px(lng, lat) { return this.toScreen(mx(lng), my(lat)); }
    px2ll(px, py) { const [x, y] = this.toWorld(px, py); return [lngOf(x), latOf(y)]; }
    on(e, f) { this.h[e] = f; return this; }
    emit(e, a) { this.h[e] && this.h[e](a); }
    redraw() { this.dirty = true; }
    resize() {
      const r = this.host.getBoundingClientRect(); this.W = r.width; this.H = r.height; this.d = Math.min(devicePixelRatio || 1, 2);
      [this.tc, this.vc].forEach(c => { c.width = Math.max(1, this.W * this.d); c.height = Math.max(1, this.H * this.d); c.style.width = this.W + 'px'; c.style.height = this.H + 'px'; });
      this.dirty = true;
    }
    clampView() {
      this.z = clamp(this.z, MINZ, MAXZ);
      this.cx = clamp(this.cx, mx(37), mx(50.5)); this.cy = clamp(this.cy, my(38.8), my(27.8));
    }
    zoomAt(px, py, dz) {
      const [wx, wy] = this.toWorld(px, py); this.z = clamp(this.z + dz, MINZ, MAXZ);
      const s = this.scale; this.cx = wx - (px - this.W / 2) / s; this.cy = wy - (py - this.H / 2) / s; this.clampView(); this.dirty = true;
    }
    animateTo(t, dur = 900) {
      t.z = clamp(t.z, MINZ, MAXZ);
      if (REDUCED || dur <= 0) { this.cx = t.cx; this.cy = t.cy; this.z = t.z; this.clampView(); this.dirty = true; this.emit('moveend'); return; }
      this.anim = { f: { cx: this.cx, cy: this.cy, z: this.z }, t, t0: performance.now(), dur };
    }
    // pad = {l,r,t,b}: مناطق مغطاة بواجهة (لوحة/درج). الهدف يظهر في وسط المساحة المتبقية.
    fitBounds(b, pad = {}, dur = 900) {
      const pl = pad.l || 0, pr = pad.r || 0, pt = pad.t || 0, pb = pad.b || 0;
      const x0 = mx(b.w), x1 = mx(b.e), y0 = my(b.n), y1 = my(b.s);
      const aw = Math.max(60, this.W - pl - pr), ah = Math.max(60, this.H - pt - pb);
      const z = Math.min(Math.log2(aw / (Math.max(1e-9, x1 - x0) * TS)), Math.log2(ah / (Math.max(1e-9, y1 - y0) * TS)), MAXZ);
      const s = TS * Math.pow(2, z), ax = pl + aw / 2, ay = pt + ah / 2;
      this.animateTo({ cx: (x0 + x1) / 2 - (ax - this.W / 2) / s, cy: (y0 + y1) / 2 - (ay - this.H / 2) / s, z }, dur);
    }
    flyTo(lng, lat, z, pad = {}, dur = 900) {
      const pl = pad.l || 0, pr = pad.r || 0, pt = pad.t || 0, pb = pad.b || 0;
      const zz = clamp(z, MINZ, MAXZ), s = TS * Math.pow(2, zz), ax = pl + (this.W - pl - pr) / 2, ay = pt + (this.H - pt - pb) / 2;
      this.animateTo({ cx: mx(lng) - (ax - this.W / 2) / s, cy: my(lat) - (ay - this.H / 2) / s, z: zz }, dur);
    }
    rel(e) { const r = this.host.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; }
    bind() {
      const host = this.host, pts = new Map(); let down = null, pinch = 0;
      host.style.touchAction = 'none';
      const dist = () => { const a = [...pts.values()]; return Math.hypot(a[0][0] - a[1][0], a[0][1] - a[1][1]); };
      host.addEventListener('pointerdown', e => {
        if (e.target.closest('.gcm-ui')) return;
        host.setPointerCapture(e.pointerId); pts.set(e.pointerId, [e.clientX, e.clientY]); this.anim = null;
        if (pts.size === 1) {
          down = { x: e.clientX, y: e.clientY, t: performance.now(), moved: false }; const [lx, ly] = this.rel(e); clearTimeout(this.lp);
          this.lp = setTimeout(() => { if (down && !down.moved && pts.size === 1) { down.moved = true; this.fireLong(lx, ly); } }, 560);
        }
        else { if (down) down.moved = true; pinch = dist(); }
      });
      host.addEventListener('pointermove', e => {
        const [px, py] = this.rel(e);
        if (!pts.has(e.pointerId)) { this.emit('hover', { px, py, ev: e }); return; }
        const prev = pts.get(e.pointerId); pts.set(e.pointerId, [e.clientX, e.clientY]);
        if (pts.size === 1) {
          const s = this.scale; this.cx -= (e.clientX - prev[0]) / s; this.cy -= (e.clientY - prev[1]) / s; this.clampView(); this.dirty = true;
          if (down && Math.hypot(e.clientX - down.x, e.clientY - down.y) > 6) { down.moved = true; clearTimeout(this.lp); }
          this.host.classList.add('dragging');
        } else if (pts.size === 2) {
          const a = [...pts.values()], d = dist(), r = this.host.getBoundingClientRect();
          if (pinch > 0 && d > 0) this.zoomAt((a[0][0] + a[1][0]) / 2 - r.left, (a[0][1] + a[1][1]) / 2 - r.top, Math.log2(d / pinch));
          pinch = d;
        }
      });
      const up = e => {
        clearTimeout(this.lp);
        if (!pts.has(e.pointerId)) return;
        pts.delete(e.pointerId); this.host.classList.remove('dragging');
        if (pts.size === 0 && down && !down.moved && performance.now() - down.t < 700) { const [px, py] = this.rel(e); this.emit('click', { px, py, ev: e }); }
        if (pts.size === 0) { down = null; this.emit('moveend'); }
      };
      host.addEventListener('contextmenu', e => { if (e.target.closest('.gcm-ui')) return; e.preventDefault(); const [px, py] = this.rel(e); this.fireLong(px, py); });
      host.addEventListener('pointerup', up); host.addEventListener('pointercancel', up);
      host.addEventListener('pointerleave', e => { if (!pts.size && e.pointerType === 'mouse') this.emit('hover', null); });
      host.addEventListener('wheel', e => {
        e.preventDefault(); this.anim = null;
        const [px, py] = this.rel(e);
        this.zoomAt(px, py, clamp(-e.deltaY * (e.ctrlKey ? 0.012 : 0.0018), -0.7, 0.7));
      }, { passive: false });
      host.addEventListener('dblclick', e => { if (e.target.closest('.gcm-ui')) return; const [px, py] = this.rel(e); this.zoomAtAnimated(px, py, 1); });
      host.addEventListener('keydown', e => {
        const k = e.key, s = this.scale, st = 70;
        if (k === 'ArrowLeft') this.cx -= st / s; else if (k === 'ArrowRight') this.cx += st / s; else if (k === 'ArrowUp') this.cy -= st / s; else if (k === 'ArrowDown') this.cy += st / s;
        else if (k === '+' || k === '=') this.zoomAtAnimated(this.W / 2, this.H / 2, 1); else if (k === '-') this.zoomAtAnimated(this.W / 2, this.H / 2, -1); else return;
        e.preventDefault(); this.clampView(); this.dirty = true;
      });
    }
    setTileUrl(u) { this.tileUrl = u || ''; this.tiles.clear(); this.dirty = true; }
    zoomAtAnimated(px, py, dz) {
      const [wx, wy] = this.toWorld(px, py), z2 = clamp(this.z + dz, MINZ, MAXZ), s2 = TS * Math.pow(2, z2);
      this.animateTo({ cx: wx - (px - this.W / 2) / s2, cy: wy - (py - this.H / 2) / s2, z: z2 }, 280);
    }
    fireLong(px, py) { const n = performance.now(); if (this.lastLong && n - this.lastLong < 900) return; this.lastLong = n; this.emit('longpress', { px, py }); }
    tile(z, x, y) {
      const k = z + '/' + x + '/' + y; let im = this.tiles.get(k);
      if (!im) {
        im = new Image(); im.onload = () => { this.dirty = true; }; im.onerror = () => {};
        im.src = this.tileUrl.replace('{z}', z).replace('{x}', x).replace('{y}', y); this.tiles.set(k, im);
        if (this.tiles.size > 360) this.tiles.delete(this.tiles.keys().next().value);
      }
      return im;
    }
    drawTiles() {
      const c = this.tctx, d = this.d; c.setTransform(d, 0, 0, d, 0, 0); c.clearRect(0, 0, this.W, this.H);
      if (!this.tileUrl) return;
      const zi = clamp(Math.round(this.z), 3, 18), n = 1 << zi, size = this.scale / n;
      const [wx0, wy0] = this.toWorld(0, 0), [wx1, wy1] = this.toWorld(this.W, this.H);
      const x0 = Math.floor(wx0 * n), x1 = Math.floor(wx1 * n), y0 = Math.max(0, Math.floor(wy0 * n)), y1 = Math.min(n - 1, Math.floor(wy1 * n));
      if ((x1 - x0 + 1) * (y1 - y0 + 1) > 80) return;
      for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) {
        const im = this.tile(zi, ((x % n) + n) % n, y);
        if (im.complete && im.naturalWidth) { const [sx, sy] = this.toScreen(x / n, y / n); c.drawImage(im, sx, sy, size + 0.6, size + 0.6); }
      }
    }
    loop(ts) {
      requestAnimationFrame(this.loop);
      if (document.hidden) return;
      const a = this.anim;
      if (a) {
        const k = Math.min(1, (performance.now() - a.t0) / a.dur), e = k < .5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
        this.cx = a.f.cx + (a.t.cx - a.f.cx) * e; this.cy = a.f.cy + (a.t.cy - a.f.cy) * e; this.z = a.f.z + (a.t.z - a.f.z) * e;
        this.dirty = true; if (k >= 1) { this.anim = null; this.clampView(); this.emit('moveend'); }
      }
      if (this.dirty || this.keep) {
        this.dirty = false; this.drawTiles();
        const c = this.vctx; c.setTransform(this.d, 0, 0, this.d, 0, 0); c.clearRect(0, 0, this.W, this.H);
        this.emit('draw', { ctx: c, ts });
      }
    }
  }
  GCMap.mx = mx; GCMap.my = my; GCMap.lngOf = lngOf; GCMap.latOf = latOf;
  root.GCMap = GCMap;
})(window);
