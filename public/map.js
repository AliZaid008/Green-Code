const map = L.map('map', { zoomControl: false, attributionControl: false, doubleClickZoom: false });
L.control.attribution({ prefix: false, position: 'bottomleft' }).addTo(map);
const markers = L.layerGroup().addTo(map);
let govs = [], points = [], layers = {}, geo, tile, open = null;
const list = $('list'), sel = $('typeSel'), q = $('q');
const gn = g => (g ? (lang === 'en' ? g.en : g.ar) : '');
const style = (o = {}) => ({ color: '#34d399', weight: 1.6, fillColor: '#0f766e', fillOpacity: .6, ...o });
const hot = { color: '#ffd166', fillColor: '#ffb703', fillOpacity: .85, weight: 2.5 };
const active = () => sel.value || q.value.trim();
const match = p => {
  if (sel.value && p.type !== sel.value) return false;
  const s = q.value.trim().toLowerCase(); if (!s) return true;
  const g = govs.find(x => x.id === p.gov) || {};
  return [p.title, p.title_en, p.desc, p.desc_en, TYPES[p.type].ar, TYPES[p.type].en, g.ar, g.en].join(' ').toLowerCase().includes(s);
};

function inRing(pt, ring) {
  let c = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if ((yi > pt[1]) !== (yj > pt[1]) && pt[0] < (xj - xi) * (pt[1] - yi) / (yj - yi) + xi) c = !c;
  }
  return c;
}
const inFeature = (pt, f) => (f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates).some(p => inRing(pt, p[0]));
const findGov = f => govs.find(g => inFeature([g.center[1], g.center[0]], f));

function hl(id, on) {
  if (!layers[id] || open) return;
  layers[id].setStyle(on ? hot : style());
  document.querySelectorAll('.gi').forEach(b => b.classList.toggle('on', on && b.dataset.id === id));
}

function fillSel() {
  const v = sel.value;
  sel.innerHTML = `<option value="">${t('all_types')}</option>` + Object.keys(TYPES).map(k => `<option value="${k}">${tn(k)}</option>`).join('');
  sel.value = v;
}

function renderMarkers() {
  markers.clearLayers(); window.fxSources = [];
  if (!open && !active()) return; // الخريطة الكبيرة نظيفة حتى يختار المستخدم نوعاً أو يبحث
  points.filter(p => match(p) && (!open || p.gov === open)).forEach(p => {
    const c = TYPES[p.type].c, pot = p.kind === 'potential';
    window.fxSources.push({ lat: p.lat, lng: p.lng, k: p.type });
    L.circleMarker([p.lat, p.lng], { radius: open ? 10 : 8, color: pot ? c : '#fff', weight: pot ? 3 : 2, fillColor: c, fillOpacity: pot ? .3 : .95, className: 'pm' })
      .addTo(markers).bindTooltip(pick(p, 'title')).on('click', () => openDetail(p)).bringToFront();
  });
}

function panel() {
  if (!open) {
    list.innerHTML = `<h2>${t('choose_gov')}</h2><div class="grid2">` + govs.map(g => `<button class="gi" data-id="${g.id}">${esc(gn(g))}<span class="n">${points.filter(p => p.gov === g.id && match(p)).length}</span></button>`).join('') + `</div><div class="legend">${legend()}</div>`;
    list.querySelectorAll('.gi').forEach(b => {
      b.onclick = () => openGov(b.dataset.id);
      b.onmouseenter = () => hl(b.dataset.id, true);
      b.onmouseleave = () => hl(b.dataset.id, false);
    });
    return;
  }
  const g = govs.find(x => x.id === open), pts = points.filter(p => p.gov === open && match(p));
  list.innerHTML = `<button id="back" class="back">${t('back_iraq')}</button><h2 style="margin-top:14px">${esc(gn(g))}</h2><p class="sum">${esc(pick(g, 'summary'))}</p><div class="legend">${legend()}</div><h3>${t('points')} (${pts.length})</h3>` +
    (pts.length ? pts.map((p, i) => `<button class="pt" data-i="${i}"><i style="background:${TYPES[p.type].c}"></i>${esc(pick(p, 'title'))}</button>`).join('') : `<p>${t('no_points')}</p>`);
  $('back').onclick = back;
  list.querySelectorAll('.pt').forEach(b => b.onclick = () => { const p = pts[b.dataset.i]; map.setView([p.lat, p.lng], 12); openDetail(p); });
}

function openGov(id) {
  const l = layers[id]; if (!l) return;
  open = id;
  Object.entries(layers).forEach(([k, v]) => k !== id && map.removeLayer(v));
  l.setStyle(style({ fillOpacity: .04, weight: 3 }));
  map.flyToBounds(l.getBounds(), { padding: [20, 20], duration: 1.8 });
  tile = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap', className: 'fadein dark-tiles' }).addTo(map).bringToBack();
  panel(); markers.clearLayers(); window.fxSources = [];
  map.once('moveend', renderMarkers); setTimeout(() => { if (open === id) renderMarkers(); }, 2400);
}

function back() {
  open = null; markers.clearLayers();
  if (tile) { map.removeLayer(tile); tile = null; }
  Object.values(layers).forEach(v => { v.setStyle(style()); v.addTo(map); });
  map.flyToBounds(geo.getBounds(), { duration: 1.3 });
  panel(); renderMarkers();
}

function openDetail(p) {
  const c = TYPES[p.type].c, g = govs.find(x => x.id === p.gov);
  let url = ''; try { url = new URL(p.source).href; } catch (e) {}
  const srcBtn = url ? `<a class="srcbtn" id="srcbtn" href="${esc(url)}" target="_blank" rel="noopener noreferrer">${t('open_src')} ↗</a>
    <p class="url"><span id="srcurl">${esc(url)}</span> <button type="button" class="copy" id="cp">${t('copy')}</button></p>` : esc(p.source || '—');
  const sol = pick(p, 'solution');
  const ph = (p.photos || []).length ? `<section><h3>${t('d_photos')}</h3><div class="photos">${p.photos.map(u => `<img src="${esc(u)}" alt="">`).join('')}</div></section>` : '';
  const ov = document.createElement('div');
  ov.className = 'ov';
  ov.innerHTML = `<div class="dt" style="--c:${c}" role="dialog" aria-modal="true">
    <div class="dt-h"><button class="back" id="x">${t('back_map')}</button>
      <div><span class="chip">${tn(p.type)}</span> <span class="chip">${esc(gn(g))}</span></div><h2>${esc(pick(p, 'title'))}</h2></div>
    <div class="dt-b">
      ${p.kind === 'potential' ? `<section><h3>${t('pot_t')}</h3><p>${t('pot_p')}</p></section>` : ''}
      <section><h3>${t('d_problem')}</h3><p>${esc(pick(p, 'desc'))}</p></section>
      <section><h3>${t('d_loc')}</h3><p><a href="https://www.google.com/maps?q=${p.lat},${p.lng}" target="_blank" rel="noopener">${t('d_maps')}</a>${p.approx ? ' ' + t('d_approx') : ''}</p></section>
      <section><h3>${t('d_effects')}</h3><ul>${info(p.type, 'effects').map(e => `<li>${e}</li>`).join('')}</ul></section>
      <section><h3>${t('d_solutions')}</h3><ul>${sol ? `<li><b>${t('d_site')}</b> ${esc(sol)}</li>` : ''}${info(p.type, 'solutions').map(e => `<li>${e}</li>`).join('')}</ul></section>
      ${ph}
      <section><h3>${t('d_source')}</h3><p>${srcBtn}</p></section>
    </div>
    <div class="dt-f"><span class="note">${t('d_note')}</span></div></div>`;
  const onKey = e => e.key === 'Escape' && close();
  const close = () => { ov.remove(); document.removeEventListener('keydown', onKey); };
  ov.addEventListener('click', e => { if (e.target === ov) close(); });
  document.addEventListener('keydown', onKey);
  document.body.appendChild(ov);
  ov.querySelector('#x').onclick = close;
  const cp = ov.querySelector('#cp');
  if (cp) cp.onclick = async e => { try { await navigator.clipboard.writeText(ov.querySelector('#srcbtn').href); e.target.textContent = '✓'; } catch (er) {} };
}

sel.onchange = q.oninput = () => { renderMarkers(); panel(); };
window.onLang = () => { fillSel(); panel(); renderMarkers(); };

(async function init() {
  applyLang(); fillSel();
  try {
    const [g, j, p] = await Promise.all(['/api/governorates', '/data/iraq.geojson', '/api/points'].map(u => fetch(u).then(r => r.json())));
    govs = g; points = p;
    geo = L.geoJSON(j, {
      style: () => style(),
      onEachFeature: (f, l) => {
        const gv = findGov(f); if (!gv) return;
        layers[gv.id] = l;
        l.on({ mouseover: () => hl(gv.id, true), mouseout: () => hl(gv.id, false), dblclick: () => openGov(gv.id) });
      }
    }).addTo(map);
    map.fitBounds(geo.getBounds());
    panel();
  } catch (e) { list.innerHTML = `<p>${t('map_err')}</p>`; }
})();
