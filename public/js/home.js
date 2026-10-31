// الصفحة الرئيسية v17: عراق ثلاثي الأبعاد + مكعب الأنواع + بيانات حية
Object.assign(I18N.ar, {
  h_title: 'خارطة التلوث في العراق', h_sub: 'كل موقع تلوث موثّق بمصدره وصوره وموقعه الدقيق، ويراجعه فريق التحقق قبل نشره. هذا العراق بثلاثة أبعاد: كلما ارتفعت المحافظة زاد عدد المواقع الموثقة فيها.',
  h_gone: 'تلوث أُزيل', h_drag: 'اسحب لتدوير العراق · اضغط على محافظة', h_latest: 'آخر المستجدات', h_open_gov: 'افتح على الخارطة', h_sites: 'موقع',
  h_cube_hint: 'اسحب المكعب لتدويره، واضغط على أي وجه', h_types_t: 'ستة أنواع من التلوث', h_types_p: 'اختر نوعاً لتفتح الخارطة وقد صُفّيت مواقعه فقط.',
  h_how_t: 'كيف يعمل', h_s1t: 'بلّغ', h_s1p: 'أضف 3 صور وضع دبوساً على الخارطة. المحافظة تُحدَّد تلقائياً من موقعك.',
  h_s2t: 'يراجع الفريق', h_s2p: 'يتحقق الفريق من الصور والموقع، ويبدأ بالبلاغات القادمة من أصحاب الرتب الأعلى.', h_s3t: 'يُنشر وترتفع رتبتك', h_s3p: 'يظهر البلاغ على الخارطة ويؤكده مواطنون آخرون، وترتفع رتبتك مع كل بلاغ صحيح.',
  h_where_t: 'أين تتركز المواقع؟', h_where_p: 'توزيع المواقع القائمة حسب النوع، وأكثر المحافظات توثيقاً. اضغط محافظة لتفتحها على الخارطة.',
  h_rank_t: 'كلما دقّقت ارتفعت رتبتك', h_rank_p: 'الحسابات الجديدة تبدأ برتبة «مبتدئ». كل بلاغ معتمد يرفع رتبتك ويزيد عدد البلاغات المسموحة يومياً، والرتب العليا تُراجَع بلاغاتها أولاً.', h_join: 'أنشئ حسابك',
  h_foot_p: 'منصة مفتوحة لرصد مصادر التلوث الهوائي والمائي وتلوث التربة والنفايات في العراق. لا تُنشر بيانات المبلّغين أبداً.', h_foot_hack: 'مشروع فائز بالمركز الأول في هاكاثون «كود أخضر» للحلول البيئية، بغداد، تشرين الأول 2026.'
});
Object.assign(I18N.en, {
  h_title: 'Iraq Pollution Map', h_sub: 'Every pollution site is documented with its source, photos and exact location, and reviewed before it is published. This is Iraq in three dimensions: the taller a governorate, the more documented sites it has.',
  h_gone: 'pollution removed', h_drag: 'Drag to rotate Iraq · tap a governorate', h_latest: 'Latest', h_open_gov: 'Open on the map', h_sites: 'sites',
  h_cube_hint: 'Drag the cube to spin it, tap any face', h_types_t: 'Six types of pollution', h_types_p: 'Pick a type and the map opens with only its sites.',
  h_how_t: 'How it works', h_s1t: 'Report', h_s1p: 'Add 3 photos and drop a pin on the map. The governorate is detected from your location.',
  h_s2t: 'The team reviews', h_s2p: 'The team checks the photos and location, starting with reports from higher-ranked members.', h_s3t: 'Published, and your rank rises', h_s3p: 'The report appears on the map and other citizens confirm it. Your rank rises with every correct report.',
  h_where_t: 'Where are the sites concentrated?', h_where_p: 'Active sites by type, and the most documented governorates. Tap a governorate to open it on the map.',
  h_rank_t: 'The more accurate you are, the higher you rank', h_rank_p: 'New accounts start as "Newcomer". Each approved report raises your rank and your daily report limit, and higher ranks are reviewed first.', h_join: 'Create your account',
  h_foot_p: 'An open platform tracking air, water, soil pollution and waste sources across Iraq. Reporters\' personal data is never published.', h_foot_hack: 'First-place project at the "Green Code" Environmental Solutions Hackathon, Baghdad, October 2026.'
});
const SVG = {
  air: '<path d="M3 9h11a3 3 0 1 0-3-3M3 14h15a3 3 0 1 1-3 3M3 19h7"/>', water: '<path d="M12 3c4 5 6 8 6 11a6 6 0 0 1-12 0c0-3 2-6 6-11z"/>',
  waste: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6"/>', soil: '<path d="M2 19l6-10 4 6 3-4 7 8zM2 19h20"/>',
  oil: '<rect x="6" y="4" width="12" height="16" rx="2"/><path d="M6 9h12M6 15h12"/>', radiation: '<circle cx="12" cy="12" r="1.8"/><path d="M12 10.2L12 3a9 9 0 0 1 7.8 4.5L13.6 11M10.4 13l-6.2 3.6A9 9 0 0 0 12 21v-7.2M13.6 13l6.2 3.6A9 9 0 0 1 12 21"/>'
};
const ORDER = ['air', 'water', 'waste', 'soil', 'oil', 'radiation'];
let govs = [], points = [], news = { added: [], removed: [] }, view, counts = {}, lastPick = null;
const act = () => points.filter(p => p.status !== 'removed');
const gname = g => (lang === 'en' ? g.en : g.ar);
const byType = () => { const c = {}; act().forEach(p => c[p.type] = (c[p.type] || 0) + 1); return c; };

function countUp(el, to) { const t0 = performance.now(); (function s(n) { const k = Math.min(1, (n - t0) / 1200); el.textContent = Math.round(to * (1 - Math.pow(1 - k, 3))); if (k < 1) requestAnimationFrame(s); })(t0); }

/* ---------- المشهد ثلاثي الأبعاد ---------- */
function scene(gj) {
  const gtip = $('gtip');
  view = new Iraq3D($('scene'), {
    crystals: innerWidth < 860 ? 3 : 6, crystalColors: ORDER.map(k => TYPES[k].c), touch: 'pan-y', wheel: false,
    pitch: innerWidth < 860 ? 0.98 : 0.9, yaw: lang === 'ar' ? 0.25 : -0.25,
    onHover: (id, px, py) => {
      if (!id || innerWidth < 860) { if (!view.sel || innerWidth >= 860) gtip.hidden = true; return; }
      const g = govs.find(x => x.id === id); if (!g) return;
      gtip.innerHTML = `<b>${esc(gname(g))}</b><small>${counts[id] || 0} ${t('h_sites')}</small>`; gtip.hidden = false;
      gtip.style.left = Math.min(px + 14, view.W - 170) + 'px'; gtip.style.top = Math.max(8, py - 10) + 'px';
    },
    onPick: h => {
      if (h.pin) return (location.href = '/map.html#p=' + encodeURIComponent(h.pin));
      if (lastPick === h.gov) return (location.href = '/map.html#g=' + h.gov);
      lastPick = h.gov; const g = govs.find(x => x.id === h.gov);
      gtip.innerHTML = `<b>${esc(gname(g))}</b><small>${counts[h.gov] || 0} ${t('h_sites')} · <a href="/map.html#g=${h.gov}" style="color:#7ff0c4;pointer-events:auto">${t('h_open_gov')}</a></small>`;
      gtip.hidden = false; gtip.style.pointerEvents = 'auto'; gtip.style.left = '50%'; gtip.style.transform = 'translateX(-50%)'; gtip.style.top = 'auto'; gtip.style.bottom = '34px';
    }
  });
  view.load(gj, govs); view.setInset({ l: 0, r: 0, t: 6, b: 26 });
  setTimeout(() => { view.setCounts(counts); view.setPins(points.map(p => ({ id: p.id, lat: p.lat, lng: p.lng, gov: p.gov, c: TYPES[p.type].c, gone: p.status === 'removed' }))); }, 350);
}

/* ---------- المكعب (CSS 3D) ---------- */
function cube() {
  const c = byType(), el = $('cube');
  el.innerHTML = ORDER.map((k, i) => `<a class="f${i}" href="/map.html#t=${k}" style="--c:${TYPES[k].c}" aria-label="${esc(tn(k))}"><svg viewBox="0 0 24 24">${SVG[k]}</svg>${esc(tn(k))}<small>${c[k] || 0} ${t('h_sites')}</small></a>`).join('');
}
(function cubeMotion() {
  const box = $('cubebox'), el = $('cube'); let rx = -24, ry = 32, vx = 0, drag = null, moved = false, last = performance.now(), vis = true;
  new IntersectionObserver(e => vis = e[0].isIntersecting).observe(box);
  const paint = () => { el.style.transform = `rotateX(${rx}deg) rotateY(${ry}deg)`; };
  box.addEventListener('pointerdown', e => { drag = { x: e.clientX, y: e.clientY }; moved = false; vx = 0; box.setPointerCapture(e.pointerId); });
  box.addEventListener('pointermove', e => { if (!drag) return; const dx = e.clientX - drag.x, dy = e.clientY - drag.y; if (Math.abs(dx) + Math.abs(dy) > 5) moved = true; ry += dx * 0.6; rx = Math.max(-80, Math.min(80, rx - dy * 0.5)); vx = dx * 0.6; drag = { x: e.clientX, y: e.clientY }; paint(); });
  const end = () => { drag = null; }; box.addEventListener('pointerup', end); box.addEventListener('pointercancel', end);
  box.addEventListener('click', e => { if (moved) { e.preventDefault(); e.stopPropagation(); } }, true);
  (function loop(n) {
    requestAnimationFrame(loop); const dt = Math.min(.05, (n - last) / 1000); last = n; if (!vis || document.hidden) return;
    if (!drag) { ry += (matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 16) * dt + vx * 0.05; vx *= 0.92; rx += (-24 - rx) * Math.min(1, dt * 0.8); paint(); }
  })(performance.now());
})();

/* ---------- أقسام البيانات ---------- */
function lists() {
  const c = byType(), tot = Math.max(1, act().length);
  $('tlist').innerHTML = ORDER.map(k => `<li><a href="/map.html#t=${k}" style="--c:${TYPES[k].c}"><span class="dot"></span><b>${esc(tn(k))}</b><em>${c[k] || 0}</em><small>${esc(info(k, 'effects')[0])}</small></a></li>`).join('');
  $('tbar').innerHTML = ORDER.filter(k => c[k]).map(k => `<i style="--c:${TYPES[k].c};flex:${c[k]}" title="${esc(tn(k))}: ${c[k]}"></i>`).join('');
  $('tleg').innerHTML = ORDER.map(k => `<span style="--c:${TYPES[k].c}"><i></i>${esc(tn(k))} ${Math.round((c[k] || 0) / tot * 100)}%</span>`).join('');
  const top = [...govs].sort((a, b) => (counts[b.id] || 0) - (counts[a.id] || 0)).slice(0, 6), mx = Math.max(1, counts[top[0] && top[0].id] || 1);
  $('topg').innerHTML = top.map(g => `<a href="/map.html#g=${g.id}"><b>${esc(gname(g))}</b><span class="gb"><i style="width:${(counts[g.id] || 0) / mx * 100}%"></i></span><em>${counts[g.id] || 0}</em></a>`).join('');
}
function ticker() {
  const it = [...news.added.slice(0, 8).map(p => ['+', p, t('added_on')]), ...news.removed.slice(0, 6).map(p => ['✓', p, t('removed_on')])];
  if (!it.length) return; $('ticker').hidden = false;
  const one = it.map(([s, p, l]) => `<span onclick="location.href='/map.html#p=${encodeURIComponent(p.id)}'"><i style="--c:${s === '✓' ? '#22c55e' : TYPES[p.type].c}"></i><em>${l}</em> ${esc(pick(p, 'title'))}</span>`).join('');
  $('tk').innerHTML = one + one; $('ticker').removeAttribute('href');
}
async function board() {
  if (!GC_AUTH) return; rankLadder($('ladder'));
  const rows = await api('GET', '/api/leaderboard').catch(() => []);
  $('lb3').innerHTML = rows.slice(0, 3).map(r => `<div class="lb"><span class="pos">${r.pos}</span>${seal(r.rank.lv, 34)}<span class="nm">${esc(r.name)}<small class="muted" style="display:block;font-weight:500">${rankName(r.rank)}</small></span><span class="sc">${r.rank.approved} ✓</span></div>`).join('');
}
// ميلان ثلاثي الأبعاد لبطاقات الخطوات (للماوس فقط)
document.querySelectorAll('.tilt').forEach(el => {
  if (!matchMedia('(hover:hover)').matches) return;
  el.addEventListener('pointermove', e => { const r = el.getBoundingClientRect(), x = (e.clientX - r.left) / r.width - .5, y = (e.clientY - r.top) / r.height - .5; el.style.transform = `rotateY(${x * 12}deg) rotateX(${-y * 12}deg)`; });
  el.addEventListener('pointerleave', () => { el.style.transform = ''; });
});

window.onLang = () => { cube(); lists(); ticker(); board(); if (view) view.dirty = true; };
(async function init() {
  if (!GC_AUTH) document.body.classList.add('noauth');
  boot('/'); applyLang();
  try {
    const [g, gj, p, nw] = await Promise.all(['/api/governorates', '/data/iraq.geojson', '/api/points', '/api/news'].map(u => fetch(u).then(r => r.json())));
    govs = g; points = p; news = nw; act().forEach(x => counts[x.gov] = (counts[x.gov] || 0) + 1);
    countUp($('n1'), act().length); countUp($('n2'), govs.length); countUp($('n3'), points.length - act().length);
    cube(); lists(); ticker(); board(); scene(gj);
  } catch (e) { console.error(e); }
})();
