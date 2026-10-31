const STX = { pending: 'st_pending', approved: 'st_approved', rejected: 'st_rejected' }, STC = { pending: '#ffd77a', approved: '#7ff0c4', rejected: '#ff8f8f' };
function paintMe() {
  const r = ME.rank;
  $('seal').innerHTML = seal(r.lv, 84); $('rname').textContent = rankName(r); $('uname').innerHTML = esc(ME.name) + (ME.admin ? ' <a class="cta" style="padding:4px 14px;font-size:.9rem" href="/admin.html">⚙ لوحة الإدارة</a>' : '');
  $('kpis').innerHTML = [[r.approved, 'approved'], [r.rejected, 'rejected'], [r.accuracy + '%', 'accuracy'], [r.score, 'score'], [r.dayLimit, 'limit_day']].map(([v, k]) => `<div class="kpi"><b>${v}</b><span>${t(k)}</span></div>`).join('');
  const n = r.next;
  $('next').innerHTML = n ? `<div class="muted">${t('next_rank')}: <b style="color:#fff">${lang === 'en' ? n.en : n.ar}</b> — ${t('need_more').replace('{n}', n.needApproved)}${n.needAccuracy ? ' ' + t('need_acc').replace('{a}', n.needAccuracy) : ''}</div><div class="bar"><i style="width:${Math.round(n.progress * 100)}%"></i></div>` : `<b>${t('max_rank')}</b>`;
  const f = $('sf'); f.name.value = ME.name; f.phone.value = ME.phone; f.public.checked = ME.public;
}
async function paintReps() {
  const list = await api('GET', '/api/me/reports');
  $('reps').innerHTML = list.length ? list.map(r => `<div class="rep"><span class="dot" style="background:${TYPES[r.type] ? TYPES[r.type].c : '#999'}"></span><p>${esc(r.desc || '')}</p><span class="pill ${r.status}" style="color:${STC[r.status]}">${t(STX[r.status])}</span></div>`).join('') : `<p class="muted">${t('no_reports')}</p>`;
}
window.onLang = () => { if (ME) { paintMe(); paintReps(); rankLadder($('ladder')); } };
(async () => {
  await boot('/profile.html');
  if (!ME) return location.replace('/login.html?next=/profile.html');
  $('app').hidden = false; paintMe(); paintReps(); rankLadder($('ladder'));
})();
$('sf').onsubmit = async e => {
  e.preventDefault(); const f = e.target;
  try { const j = await api('PUT', '/api/me', { name: f.name.value, phone: f.phone.value, public: f.public.checked }); ME = { ...ME, ...j.user }; paintMe(); paintAcct(); $('smsg').className = 'msg ok'; $('smsg').textContent = t('saved'); }
  catch (er) { $('smsg').className = 'msg'; $('smsg').textContent = er.message; }
};
$('pf').onsubmit = async e => {
  e.preventDefault(); const f = e.target;
  try { await api('PUT', '/api/me/password', { current: f.current.value, next: f.next.value }); f.reset(); $('pmsg').className = 'msg ok'; $('pmsg').textContent = t('pw_changed'); }
  catch (er) { $('pmsg').className = 'msg'; $('pmsg').textContent = er.message; }
};
$('out').onclick = async () => { await api('POST', '/api/auth/logout'); location.href = '/'; };
$('del').onclick = async () => {
  const pw = prompt(t('del_confirm')); if (!pw) return;
  try { await api('DELETE', '/api/me', { password: pw }); location.href = '/'; } catch (er) { toast(er.message, true); }
};
