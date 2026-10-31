const pickMap = L.map('pick').setView([33, 44], 6);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap' }).addTo(pickMap);
let pin, pos, det, govId = null, lastCheck = 0;
const files = [null, null, null];
const gname = id => { const g = det && det.govs.find(x => x.id === id); return g ? (lang === 'en' ? g.en : g.ar) : id; };
function chip() {
  const c = $('govchip'); c.className = 'gov-chip';
  if (!pos) { c.classList.add('off'); c.textContent = '📍 ' + t('rep_waiting'); }
  else if (!govId) { c.classList.add('bad'); c.textContent = t('rep_outside'); }
  else c.textContent = '✓ ' + t('rep_detected') + ': ' + gname(govId);
}
async function setPin(lat, lng) {
  pos = { lat, lng }; pin ? pin.setLatLng([lat, lng]) : pin = L.marker([lat, lng], { draggable: true }).addTo(pickMap).on('dragend', e => { const p = e.target.getLatLng(); setPin(p.lat, p.lng); });
  if (!det) det = await detector();
  const r = det.d.detect(lat, lng); govId = r ? r.id : null; chip(); dupCheck();
}
/* تنبيه التكرار: أقرب موقع موثّق خلال 1.5 كم */
let _pts = null;
async function dupCheck() {
  try {
    if (!_pts) _pts = await (await fetch('/api/points')).json();
    let best = null, bd = 1.5; const k = Math.PI / 180;
    for (const p of _pts) { const dl = (p.lat - pos.lat) * k, dn = (p.lng - pos.lng) * k * Math.cos(pos.lat * k), d = Math.hypot(dl, dn) * 6371; if (d < bd) { bd = d; best = p; } }
    let el = document.getElementById('dup'); if (!el) { el = document.createElement('div'); el.id = 'dup'; el.style.cssText = 'margin:8px 0;padding:10px 12px;border-radius:10px;background:rgba(255,200,60,.12);border:1px solid rgba(255,200,60,.4);font-size:.9rem'; $('f').querySelector('textarea').parentNode.insertBefore(el, $('f').querySelector('textarea').previousElementSibling); }
    if (best) { el.hidden = false; el.innerHTML = (lang === 'en' ? 'A documented site already exists ' : 'يوجد موقع موثّق على بعد ') + Math.round(bd * 1000) + (lang === 'en' ? ' m away. ' : ' م. ') + `<a href="/map.html#p=${encodeURIComponent(best.id)}" target="_blank" rel="noopener">${lang === 'en' ? 'View it - you can confirm it instead' : 'اعرضه — يمكنك تأكيده بدل إعادة الإبلاغ'}</a>`; } else el.hidden = true;
  } catch (e) {}
}
pickMap.on('click', e => setPin(e.latlng.lat, e.latlng.lng));
$('gps').onclick = () => navigator.geolocation.getCurrentPosition(p => { setPin(p.coords.latitude, p.coords.longitude); pickMap.setView([p.coords.latitude, p.coords.longitude], 15); }, () => toast(t('gps_err'), true), { enableHighAccuracy: true, timeout: 15000 });
function fillType() { const ty = $('type').value; $('type').innerHTML = Object.keys(TYPES).map(k => `<option value="${k}">${tn(k)}</option>`).join(''); if (ty) $('type').value = ty; }
function paintWho() {
  if (!ME) return;
  $('who').innerHTML = `${seal(ME.rank.lv, 44)}<div><div class="muted">${t('rep_as')}</div><b style="font-size:1.2rem">${esc(ME.name)}</b> · <span class="muted">${rankName(ME.rank)} · ${t('limit_day')} ${ME.rank.dayLimit}</span></div>`;
}
window.onLang = () => { fillType(); chip(); paintWho(); document.querySelectorAll('.slot span').forEach(s => s.textContent = t('rep_slots')); };
// صور: تُضغط في المتصفح قبل الرفع، ومعاينة داخل الخانة
function shrink(file, max = 1600) {
  return new Promise((ok, no) => {
    const img = new Image(), url = URL.createObjectURL(file);
    img.onload = () => {
      const k = Math.min(1, max / Math.max(img.width, img.height)), c = document.createElement('canvas');
      c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(url);
      c.toBlob(b => b ? ok(b) : no(), 'image/jpeg', .8);
    };
    img.onerror = () => no(); img.src = url;
  });
}
document.querySelectorAll('#slots .slot').forEach((s, i) => s.querySelector('input').onchange = e => {
  const f = e.target.files[0]; files[i] = f || null;
  s.classList.toggle('has', !!f); s.style.backgroundImage = f ? `url(${URL.createObjectURL(f)})` : '';
});
async function sendAccount(e) {
  e.preventDefault(); const msg = $('msg'), b = $('send'); msg.className = 'msg';
  if (!pos) return msg.textContent = t('pick_err');
  if (!govId) return msg.textContent = t('rep_outside');
  if (files.some(f => !f)) return msg.textContent = t('photos3');
  b.disabled = true; msg.textContent = t('sending');
  try {
    const fd = new FormData(); fd.append('type', $('type').value); fd.append('description', e.target.description.value); fd.append('lat', pos.lat); fd.append('lng', pos.lng);
    for (const f of files) fd.append('photos', await shrink(f).catch(() => f), 'photo.jpg');
    const j = await api('POST', '/api/report', fd, true);
    msg.className = 'msg ok'; msg.textContent = t(j.published ? 'rep_pub' : 'rep_done');
    e.target.reset(); document.dispatchEvent(new Event('gc-sent')); files.fill(null); document.querySelectorAll('.slot').forEach(s => { s.classList.remove('has'); s.style.backgroundImage = ''; });
    if (pin) { pickMap.removeLayer(pin); pin = null; pos = null; govId = null; chip(); }
    const u = await loadMe(); paintWho(); paintAcct();
  } catch (er) { msg.textContent = er.message; if (er.status === 401) setTimeout(() => location.href = '/login.html?next=/report.html', 900); }
  b.disabled = false;
}
(function () {   // مسودة تلقائية + عدّاد أحرف
  const ta = document.querySelector('textarea[name=description]'); if (!ta) return;
  const c = document.createElement('small'); c.style.cssText = 'display:block;opacity:.6;text-align:end'; ta.after(c);
  const upd = () => { c.textContent = ta.value.length + ' / 1000'; };
  try { const d = localStorage.getItem('gc_draft'); if (d && !ta.value) ta.value = d; } catch (e) {}
  ta.addEventListener('input', () => { upd(); try { localStorage.setItem('gc_draft', ta.value); } catch (e) {} }); upd();
  document.addEventListener('gc-sent', () => { try { localStorage.removeItem('gc_draft'); } catch (e) {} });
})();
(async function () {
  const qs = new URLSearchParams(location.search), plat = +qs.get('lat'), plng = +qs.get('lng');
  if (plat && plng) { setPin(plat, plng); pickMap.setView([plat, plng], 15); }   // قادم من «أبلّغ عن تلوث قريب»
  await boot('/report.html'); fillType(); chip(); applyLang();
  if (!GC_AUTH) {   // النسخة الثابتة: بدون حسابات، الإرسال عبر واتساب والمحافظة تُكتشف تلقائياً
    $('f').hidden = false; $('who').parentElement.remove();
    const wa = document.createElement('button'); wa.type = 'button'; wa.className = 'cta full'; wa.textContent = t('st_wa'); $('send').replaceWith(wa);
    wa.onclick = () => {
      if (!pos || !govId) return $('msg').textContent = t('pick_err');
      const tx = `${lang === 'en' ? 'Pollution report' : 'بلاغ تلوث'}\n${tn($('type').value)} - ${gname(govId)}\n${$('f').description.value}\n📍 https://www.google.com/maps?q=${pos.lat},${pos.lng}`;
      location.href = `https://wa.me/${GC.WHATSAPP}?text=${encodeURIComponent(tx)}`;
    };
    document.querySelector('label[data-i18n="photos3"]').dataset.i18n = 'st_photos'; $('slots').remove();
    return;
  }
  if (!ME) { $('gate').hidden = false; return; }
  $('f').hidden = false; paintWho(); pickMap.invalidateSize(); $('f').onsubmit = sendAccount;
})();
