let KEY = sessionStorage.getItem('gc_admin') || '', govs = [], pts = [], editing = null;
const aapi = async (m, u, b) => {
  const r = await fetch(u, { method: m, headers: { 'x-admin-key': KEY, 'Content-Type': 'application/json' }, body: b ? JSON.stringify(b) : undefined });
  if (r.status === 403) { logout(); throw new Error('المفتاح غير صحيح'); }
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || r.status);
  return j;
};
function logout() { sessionStorage.removeItem('gc_admin'); KEY = ''; $('app').hidden = true; $('login').hidden = false; }
const gname = id => (govs.find(g => g.id === id) || {}).ar || id;

async function load() {
  govs = await fetch('/api/governorates').then(r => r.json());
  $('f_gov').innerHTML = govs.map(g => `<option value="${g.id}">${esc(g.ar)}</option>`).join(''); $('sg').innerHTML = '<option value="">كل المحافظات</option>' + $('f_gov').innerHTML;
  $('f_type').innerHTML = Object.keys(TYPES).map(k => `<option value="${k}">${TYPES[k].ar}</option>`).join('');
  const [p, pd] = await Promise.all([fetch('/api/points').then(r => r.json()), aapi('GET', '/api/admin/pending')]);
  pts = p; renderPending(pd); renderPts(); renderUsers().catch(() => {}); renderOverview().catch(() => {});
  $('login').hidden = true; $('app').hidden = false;
}
$('go').onclick = async () => {
  KEY = $('key').value; sessionStorage.setItem('gc_admin', KEY); $('lerr').textContent = '';
  try { await load(); } catch (e) { $('lerr').textContent = e.message; }
};
if (KEY) load().catch(() => {});
else fetch('/api/me').then(r => r.json()).then(j => { if (j.user && j.user.admin) load().catch(() => {}); else if (!j.user) $('lerr').innerHTML = 'أو <a href="/login.html?next=/admin.html">سجّل الدخول بحساب المدير</a>'; }).catch(() => {});

function renderPending(list) {
  $('pc').textContent = list.length; $('pbadge').textContent = list.length; $('pbadge').hidden = !list.length; $('selall').checked = false;
  const rk = r => r.rep ? ` | <span style="background:${r.rep.lv >= 3 ? '#e9b44c' : '#cfe8df'};padding:2px 10px;border-radius:99px;font-weight:800">${esc(r.rep.ar)}${r.rep.lv >= 3 ? ' ⭐' : ''}</span> <small>${r.rep.approved} معتمد / ${r.rep.rejected} مرفوض${r.rep.banned ? ' — موقوف' : ''}</small>` : ' | <small>زائر (بدون حساب)</small>';
  const near = r => { let b = null, bd = 1.5; const k = Math.PI / 180; for (const p of pts) { const d = Math.hypot((p.lat - r.lat) * k, (p.lng - r.lng) * k * Math.cos(r.lat * k)) * 6371; if (d < bd) { bd = d; b = p; } } return b ? `<div style="background:#fff3cd;border:1px solid #e9b44c;border-radius:8px;padding:6px 10px;margin:6px 0">⚠ احتمال تكرار: «${esc(b.title)}» على بعد ${Math.round(bd * 1000)} م — <a target="_blank" href="/map.html#p=${encodeURIComponent(b.id)}">عرض</a></div>` : ''; };
  $('pending').innerHTML = list.length ? list.map(r => `<div class="pend"><input type="checkbox" class="ck" data-k="${r.id}">
    <b>${esc(r.name)}</b> | ${esc(r.phone)} | ${esc(r.email)}${rk(r)}<br>${TYPES[r.type].ar} - المحافظة (تلقائي): <select data-g="${r.id}">${govs.map(g => `<option value="${g.id}"${g.id === r.gov ? ' selected' : ''}>${esc(g.ar)}</option>`).join('')}</select> - <a target="_blank" rel="noopener" href="https://www.google.com/maps?q=${r.lat},${r.lng}">الموقع</a>
    ${near(r)}<p>${esc(r.desc)}</p><div>${r.photos.map(u => `<a target="_blank" href="${esc(u)}"><img src="${esc(u)}"></a>`).join('')}</div>
    <div class="row"><button class="sm" data-a="${r.id}">اعتماد ونشر</button><button class="sm del" data-r="${r.id}">رفض (يخصم من رتبته)</button><button class="sm" data-n="${r.id}">حذف بدون خصم (مكرر…)</button></div></div>`).join('') : '<p>لا توجد بلاغات جديدة.</p>';
  $('pending').querySelectorAll('[data-a]').forEach(b => b.onclick = () => act('POST', `/api/admin/pending/${b.dataset.a}/approve`, { gov: $('pending').querySelector(`[data-g="${b.dataset.a}"]`).value }));
  $('pending').querySelectorAll('[data-r]').forEach(b => b.onclick = () => (() => { const n = prompt('سبب الرفض (يظهر للمبلّغ في صفحته، اختياري):'); if (n !== null) act('POST', `/api/admin/pending/${b.dataset.r}/reject`, { penalize: true, note: n }); })());
  $('pending').querySelectorAll('[data-n]').forEach(b => b.onclick = () => act('POST', `/api/admin/pending/${b.dataset.n}/reject`, { penalize: false }));
}
async function renderUsers() {
  const list = await aapi('GET', '/api/admin/users');
  $('users').innerHTML = list.length ? `<table><tr><th>الاسم</th><th>الإيميل</th><th>الرتبة</th><th>معتمد/مرفوض</th><th></th></tr>${list.map(u => `<tr><td>${esc(u.name)}</td><td>${esc(u.email)}</td><td>${esc(u.rank.ar)}</td><td>${u.rank.approved}/${u.rank.rejected}</td>
    <td><button class="sm ${u.banned ? '' : 'del'}" data-u="${u.id}" data-b="${u.banned ? 0 : 1}">${u.banned ? 'رفع الحظر' : 'حظر'}</button></td></tr>`).join('')}</table>` : '<p>لا توجد حسابات بعد.</p>';
  $('users').querySelectorAll('[data-u]').forEach(b => b.onclick = async () => { await aapi('POST', `/api/admin/users/${b.dataset.u}/ban`, { banned: b.dataset.b === '1' }); renderUsers(); });
}
async function act(m, u, b) { try { await aapi(m, u, b); await load(); } catch (e) { alert(e.message); } }

function renderPts() {
  const s = $('s').value.trim().toLowerCase(), sg = $('sg').value, ss = $('ss').value;
  const list = pts.filter(p => (!sg || p.gov === sg) && (!ss || (ss === 'removed') === (p.status === 'removed')) && (!s || [p.title, p.title_en, gname(p.gov), TYPES[p.type].ar].join(' ').toLowerCase().includes(s)));
  $('nc').textContent = pts.length;
  $('rows').innerHTML = list.map(p => `<tr><td>${esc(p.title)}</td><td>${esc(gname(p.gov))}</td><td>${TYPES[p.type].ar}</td><td>${p.status === 'removed' ? '✓ أُزيلت ' + esc(p.removed_at || '') : 'قائمة'}</td>
    <td>${/^https?:/.test(p.source) ? `<a target="_blank" rel="noopener" href="${esc(p.source)}">رابط</a>` : esc(p.source)}</td>
    <td><button class="sm" data-e="${p.id}">تعديل</button> <button class="sm del" data-d="${p.id}">حذف</button></td></tr>`).join('');
  $('rows').querySelectorAll('[data-e]').forEach(b => b.onclick = () => openForm(pts.find(p => p.id === b.dataset.e)));
  $('rows').querySelectorAll('[data-d]').forEach(b => b.onclick = () => confirm('حذف هذه النقطة نهائياً؟') && act('DELETE', `/api/admin/points/${b.dataset.d}`));
}
$('s').oninput = renderPts; $('sg').onchange = renderPts; $('ss').onchange = renderPts;

const F = ['title', 'title_en', 'desc', 'desc_en', 'type', 'gov', 'lat', 'lng', 'source', 'solution', 'solution_en', 'kind', 'status', 'removed_at', 'removed_note', 'removed_note_en'];
function openForm(p) {
  editing = p ? p.id : null; $('ferr').textContent = '';
  $('dt').textContent = p ? 'تعديل نقطة' : 'إضافة نقطة';
  F.forEach(k => $('f_' + k).value = p ? (p[k] ?? '') : (k === 'kind' ? 'documented' : k === 'status' ? 'active' : ''));
  $('f_approx').checked = p ? !!p.approx : false;
  $('dlg').showModal();
}
$('add').onclick = () => openForm(null);
$('cancel').onclick = () => $('dlg').close();
$('pf').onsubmit = async e => {
  e.preventDefault();
  const b = {}; F.forEach(k => b[k] = $('f_' + k).value); b.approx = $('f_approx').checked;
  if (editing) b.photos = (pts.find(p => p.id === editing) || {}).photos || [];
  try { await aapi(editing ? 'PUT' : 'POST', editing ? `/api/admin/points/${editing}` : '/api/admin/points', b); $('dlg').close(); await load(); }
  catch (er) { $('ferr').textContent = er.message; }
};

$('testn').onclick = async () => {
  $('testr').textContent = '...';
  try {
    const { results } = await aapi('POST', '/api/admin/test-notify');
    $('testr').innerHTML = results.map(r => `${r.channel}: ` + (r.status === 'ok' ? '✅ أُرسل' : r.status === 'skipped' ? '⚪ غير مفعّل' : '❌ ' + esc(r.error))).join(' &nbsp;|&nbsp; ');
  } catch (e) { $('testr').textContent = '❌ ' + e.message; }
};


/* ---------- v18: تبويبات، تحليلات، تدقيق، تصدير، إجراءات جماعية ---------- */
const tabs = $('tabs');
tabs.onclick = e => {
  const b = e.target.closest('[data-t]'); if (!b) return;
  tabs.querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b));
  document.querySelectorAll('.panel').forEach(p => p.hidden = p.dataset.p !== b.dataset.t);
  if (b.dataset.t === 'au') renderAudit().catch(() => {}); if (b.dataset.t === 'tl') renderSys().catch(() => {}); if (b.dataset.t === 'ov') renderOverview().catch(() => {});
};
const bars = (obj, label, n = 99) => { const e = Object.entries(obj).sort((a, b) => b[1] - a[1]).slice(0, n), m = Math.max(1, ...e.map(x => x[1])); return e.length ? e.map(([k, v]) => `<div class="r"><span>${esc(label(k))}</span><i style="width:${v / m * 100}%"></i><b>${v}</b></div>`).join('') : '<p>لا بيانات.</p>'; };
async function renderOverview() {
  const d = await aapi('GET', '/api/admin/stats'), t = d.totals, rv = d.review;
  const K = (n, l, c) => `<div class="akpi"${c ? ` style="border-color:${c}"` : ''}><b>${n}</b><small>${l}</small></div>`;
  $('kpis').innerHTML = K(t.active, 'نقطة تلوث قائمة') + K(t.removed, 'تمت إزالتها (' + d.removalRate + '٪)', '#2e9d6a') + K(t.pending, 'بلاغ بانتظار المراجعة', t.pending ? '#e9b44c' : '') + K(t.users, 'حساب مسجّل') + K(t.reports90, 'بلاغ في آخر 90 يوماً');
  const mx = Math.max(1, ...d.perDay.map(x => x.n));
  $('spark').innerHTML = d.perDay.map(x => `<i title="${x.d}: ${x.n}" style="height:${Math.max(2, x.n / mx * 100)}%"></i>`).join('');
  $('sparkl').textContent = 'المجموع: ' + d.perDay.reduce((a, x) => a + x.n, 0) + ' بلاغ';
  $('review').innerHTML = `<p>نسبة الاعتماد: <b class="ok">${rv.approvalRate == null ? '—' : rv.approvalRate + '٪'}</b> <small>(${rv.approved} معتمد / ${rv.rejected} مرفوض)</small></p>
    <p>متوسط زمن المراجعة: <b>${rv.medianHours == null ? '—' : rv.medianHours < 1 ? 'أقل من ساعة' : rv.medianHours + ' ساعة'}</b></p>
    <p>أقدم بلاغ ينتظر: <b class="${rv.oldestPendingHours > 48 ? 'no' : ''}">${t.pending ? rv.oldestPendingHours + ' ساعة' : 'لا يوجد'}</b></p>`;
  $('btype').innerHTML = bars(d.byType, k => TYPES[k] ? TYPES[k].ar : k);
  $('bgov').innerHTML = bars(d.byGov, gname, 8);
  $('topr').innerHTML = d.topReporters.length ? `<table>${d.topReporters.map(u => `<tr><td>${esc(u.name)}</td><td><span class="pill">${esc(u.rank)}</span></td><td>${u.approved} معتمد / ${u.rejected} مرفوض</td></tr>`).join('')}</table>` : '<p>لا يوجد مساهمون بعد.</p>';
  $('gen').textContent = 'أُنشئ: ' + new Date(d.generatedAt).toLocaleString('ar-IQ');
}
$('refresh').onclick = () => load().catch(e => alert(e.message));
$('print').onclick = () => { tabs.querySelector('[data-t=ov]').click(); setTimeout(() => print(), 150); };
const ACT = { 'point.add': 'إضافة نقطة', 'point.edit': 'تعديل نقطة', 'point.delete': 'حذف نقطة', 'report.approve': 'اعتماد بلاغ', 'report.reject': 'رفض بلاغ', 'report.dismiss': 'حذف بلاغ (بدون خصم)', 'user.ban': 'حظر حساب', 'user.unban': 'رفع حظر', 'export': 'تصدير بيانات', 'bulk.approve': 'اعتماد جماعي', 'bulk.reject': 'رفض جماعي', 'bulk.dismiss': 'حذف جماعي' };
async function renderAudit() {
  const l = await aapi('GET', '/api/admin/audit');
  $('audit').innerHTML = l.length ? `<table><tr><th>الوقت</th><th>المسؤول</th><th>الإجراء</th><th>التفاصيل</th></tr>${l.map(a => `<tr><td dir="ltr">${new Date(a.at).toLocaleString('en-GB')}</td><td>${esc(a.actor)}</td><td><span class="pill">${esc(ACT[a.action] || a.action)}</span></td><td>${esc(a.target)} ${esc(a.detail)}</td></tr>`).join('')}</table>` : '<p>لا توجد إجراءات مسجّلة بعد. أي اعتماد أو رفض أو تعديل سيظهر هنا تلقائياً.</p>';
}
async function renderSys() {
  const s = await aapi('GET', '/api/admin/system'), ch = s.channels, y = v => v ? '<span class="ok">✅ مفعّل</span>' : '<span style="opacity:.6">⚪ غير مفعّل</span>';
  $('sys').innerHTML = `<table><tr><td>إصدار الموقع</td><td dir="ltr">v${esc(s.version)}</td></tr><tr><td>قاعدة البيانات</td><td>${esc(s.db)}</td></tr><tr><td>Node.js</td><td dir="ltr">${esc(s.node)}</td></tr><tr><td>مدة التشغيل</td><td>${s.uptimeMin} دقيقة</td></tr>${s.uploadsMB != null ? `<tr><td>حجم الصور المرفوعة</td><td>${s.uploadsMB} MB</td></tr>` : ''}
    <tr><td>المدراء (حسابات)</td><td>${s.admins}</td></tr><tr><td>مفتاح الإدارة (ADMIN_KEY)</td><td>${y(s.keyEnabled)}</td></tr><tr><td>النشر التلقائي للموثوقين</td><td>${s.autoPublishLevel ? 'من الرتبة ' + s.autoPublishLevel : 'متوقف (كل بلاغ يُراجع)'}</td></tr>
    <tr><td>إشعارات</td><td>Telegram ${y(ch.telegram)} &nbsp; Brevo ${y(ch.brevo)} &nbsp; SMTP ${y(ch.smtp)} &nbsp; WhatsApp ${y(ch.whatsapp)}</td></tr></table>`;
}
async function dl(what) {
  const r = await fetch('/api/admin/export/' + what, { headers: { 'x-admin-key': KEY } }); if (!r.ok) return alert('فشل التصدير');
  const a = document.createElement('a'); a.href = URL.createObjectURL(await r.blob()); a.download = (r.headers.get('content-disposition') || '').split('filename="')[1]?.replace('"', '') || what + '.csv'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 3000);
}
document.querySelectorAll('[data-x]').forEach(b => b.onclick = () => dl(b.dataset.x));
$('x_au').onclick = e => { e.preventDefault(); dl('audit'); };
$('selall').onchange = e => document.querySelectorAll('#pending .ck').forEach(c => c.checked = e.target.checked);
async function bulk(action) {
  const ids = [...document.querySelectorAll('#pending .ck:checked')].map(c => c.dataset.k); if (!ids.length) return alert('حدّد بلاغاً واحداً على الأقل');
  let note = ''; if (action === 'reject') { note = prompt('سبب الرفض (اختياري):'); if (note === null) return; } else if (!confirm(`${{ approve: 'اعتماد', dismiss: 'حذف بدون خصم' }[action]} ${ids.length} بلاغ؟`)) return;
  try { const j = await aapi('POST', '/api/admin/bulk', { action, ids, note }); $('bmsg').textContent = `تم: ${j.done}`; await load(); } catch (e) { alert(e.message); }
}
$('b_ok').onclick = () => bulk('approve'); $('b_no').onclick = () => bulk('reject'); $('b_dis').onclick = () => bulk('dismiss');
