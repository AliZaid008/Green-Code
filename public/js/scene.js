// عدّادات متحركة بالرئيسية (أرقام حقيقية من قاعدة البيانات)
(async function () {
  if (!document.getElementById('n1')) return;
  try {
    const [p, g] = await Promise.all([fetch('/api/points').then(r => r.json()), fetch('/api/governorates').then(r => r.json())]);
    [['n1', p.filter(x => x.status !== 'removed').length], ['n2', g.length], ['n3', Object.keys(TYPES).length]].forEach(([id, v]) => {
      const el = document.getElementById(id), t0 = performance.now();
      (function f(t) { const k = Math.min(1, (t - t0) / 1500); el.textContent = Math.round(v * (1 - Math.pow(1 - k, 3))); if (k < 1) requestAnimationFrame(f); })(t0);
    });
  } catch (e) {}
})();

// بطاقات 3D تميل مع الماوس
document.querySelectorAll('.tilt').forEach(el => {
  el.addEventListener('pointermove', e => {
    const r = el.getBoundingClientRect(), x = (e.clientX - r.left) / r.width - .5, y = (e.clientY - r.top) / r.height - .5;
    el.style.transform = `perspective(900px) rotateY(${x * 12}deg) rotateX(${-y * 12}deg) scale(1.03)`;
  });
  el.addEventListener('pointerleave', () => el.style.transform = '');
});

// كرة جسيمات ثلاثية الأبعاد تتفاعل مع حركة الماوس
(function () {
  const cv = document.getElementById('gl');
  if (!cv || !window.THREE || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  let R; try { R = new THREE.WebGLRenderer({ canvas: cv, alpha: true, antialias: true }); } catch (e) { return; }
  const SMALL = innerWidth < 800;
  R.setPixelRatio(Math.min(devicePixelRatio, SMALL ? 1.5 : 2));
  const S = new THREE.Scene(), C = new THREE.PerspectiveCamera(50, 1, .1, 100);
  C.position.z = 7;
  const palette = ['#cfd8dc', '#42a5f5', '#ff5252', '#bcaaa4', '#ffa726', '#ce93d8'].map(c => new THREE.Color(c));
  const centers = palette.map(() => new THREE.Vector3(Math.random() - .5, Math.random() - .5, Math.random() - .5).normalize());
  const N = SMALL ? 2200 : 4200, pos = new Float32Array(N * 3), col = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) {
    const y = 1 - (i / (N - 1)) * 2, r = Math.sqrt(1 - y * y), a = i * 2.399963;
    const v = new THREE.Vector3(Math.cos(a) * r, y, Math.sin(a) * r);
    let best = 0, bd = 9;
    centers.forEach((c, k) => { const d = v.distanceTo(c); if (d < bd) { bd = d; best = k; } });
    const rad = 2.4 + (Math.random() - .5) * .06;
    pos.set([v.x * rad, v.y * rad, v.z * rad], i * 3);
    const c = bd < .75 ? palette[best] : new THREE.Color('#2e7d5a');
    col.set([c.r, c.g, c.b], i * 3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const globe = new THREE.Points(g, new THREE.PointsMaterial({ size: .05, vertexColors: true, transparent: true, opacity: .95, blending: THREE.AdditiveBlending, depthWrite: false }));
  const G = new THREE.Group(); G.add(globe);
  const ringMat = new THREE.MeshBasicMaterial({ color: 0xc6f432, transparent: true, opacity: .45 });
  const ring1 = new THREE.Mesh(new THREE.TorusGeometry(3.2, .012, 8, 200), ringMat);
  const ring2 = new THREE.Mesh(new THREE.TorusGeometry(3.7, .008, 8, 200), ringMat);
  ring1.rotation.x = 1.2; ring2.rotation.y = 1.1; G.add(ring1, ring2); S.add(G);
  const dp = new Float32Array(900 * 3).map(() => (Math.random() - .5) * 22);
  const dg = new THREE.BufferGeometry(); dg.setAttribute('position', new THREE.BufferAttribute(dp, 3));
  const dust = new THREE.Points(dg, new THREE.PointsMaterial({ size: .03, color: 0x9ad9b6, transparent: true, opacity: .6 })); S.add(dust);

  // بلورات ثلاثية الأبعاد (ألوان أنواع التلوث) تدور حول الكرة
  const crystals = [];
  ['#b0bec5', '#42a5f5', '#ff5252', '#bcaaa4', '#ffa726', '#ce93d8', '#c6f432'].forEach((hex, i) => {
    const geo = i % 2 ? new THREE.OctahedronGeometry(.22) : new THREE.IcosahedronGeometry(.2);
    const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: hex, wireframe: true, transparent: true, opacity: .85 }));
    const core = new THREE.Mesh(geo.clone().scale(.55, .55, .55), new THREE.MeshBasicMaterial({ color: hex, transparent: true, opacity: .35 }));
    m.add(core); m.userData = { a: i / 7 * Math.PI * 2, r: 3.6 + (i % 3) * .45, y: (i - 3) * .55, sp: .0003 + i * .00003 };
    G.add(m); crystals.push(m);
  });
  // شبكة موجية 3D أسفل المشهد
  const WS = SMALL ? 36 : 60, wpos = new Float32Array(WS * WS * 3);
  for (let i = 0; i < WS; i++) for (let j = 0; j < WS; j++) wpos.set([(i / (WS - 1) - .5) * 16, 0, (j / (WS - 1) - .5) * 16], (i * WS + j) * 3);
  const wg = new THREE.BufferGeometry(); wg.setAttribute('position', new THREE.BufferAttribute(wpos, 3));
  const wave = new THREE.Points(wg, new THREE.PointsMaterial({ size: .045, color: 0x7ef2c0, transparent: true, opacity: .55, blending: THREE.AdditiveBlending, depthWrite: false }));
  wave.position.y = -3.3; S.add(wave);
  // فقاعات دخان صاعدة
  const NB = SMALL ? 40 : 90, bp = new Float32Array(NB * 3), bs = [];
  for (let i = 0; i < NB; i++) { bp.set([(Math.random() - .5) * 14, -3 + Math.random() * 7, (Math.random() - .5) * 6 - 1], i * 3); bs.push(.004 + Math.random() * .01); }
  const bg = new THREE.BufferGeometry(); bg.setAttribute('position', new THREE.BufferAttribute(bp, 3));
  const bubbles = new THREE.Points(bg, new THREE.PointsMaterial({ size: .16, color: 0xffd180, transparent: true, opacity: .22, depthWrite: false }));
  S.add(bubbles);

  const resize = () => { R.setSize(innerWidth, innerHeight, false); C.aspect = innerWidth / innerHeight; C.updateProjectionMatrix(); G.position.x = innerWidth < 800 ? 0 : 0; };
  addEventListener('resize', resize); resize();
  let mx = 0, my = 0, rx = 0, ry = 0, speed = .00015;
  addEventListener('pointermove', e => { mx = e.clientX / innerWidth * 2 - 1; my = e.clientY / innerHeight * 2 - 1; });
  document.querySelectorAll('.choice').forEach(c => { c.addEventListener('pointerenter', () => speed = .0007); c.addEventListener('pointerleave', () => speed = .00015); });
  (function loop(t) {
    ry += (mx * 1.1 - ry) * .05; rx += (my * .6 - rx) * .05;
    G.rotation.y = t * speed + ry; G.rotation.x = rx;
    ring1.rotation.z = t * .0003; ring2.rotation.x = t * .0002;
    G.scale.setScalar(1 + Math.sin(t * .0012) * .02 + Math.abs(mx) * .04);
    dust.rotation.y = -t * .00005;
    crystals.forEach(c => { const u = c.userData, a = u.a + t * u.sp; c.position.set(Math.cos(a) * u.r, u.y + Math.sin(t * .001 + u.a) * .25, Math.sin(a) * u.r); c.rotation.x = t * .0008; c.rotation.y = t * .0011; });
    const wa = wg.attributes.position.array;
    for (let i = 0; i < WS; i++) for (let j = 0; j < WS; j++) wa[(i * WS + j) * 3 + 1] = Math.sin(i * .35 + t * .0014) * .22 + Math.cos(j * .3 + t * .001) * .22;
    wg.attributes.position.needsUpdate = true;
    const ba = bg.attributes.position.array;
    for (let i = 0; i < NB; i++) { ba[i * 3 + 1] += bs[i]; if (ba[i * 3 + 1] > 4) ba[i * 3 + 1] = -3; }
    bg.attributes.position.needsUpdate = true;

    C.position.x += (mx * .8 - C.position.x) * .04; C.position.y += (-my * .5 - C.position.y) * .04; C.lookAt(0, 0, 0);
    R.render(S, C); requestAnimationFrame(loop);
  })(0);
})();
