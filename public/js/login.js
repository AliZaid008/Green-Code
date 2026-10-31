let mode = 'in';
const nextUrl = () => { const n = new URLSearchParams(location.search).get('next') || '/'; return /^\/[^\/\\]/.test(n) || n === '/' ? n : '/'; };
function paint() {
  const up = mode === 'up';
  $('upf').hidden = $('pubrow').hidden = !up;
  $('tin').classList.toggle('on', !up); $('tup').classList.toggle('on', up);
  $('go').textContent = t(up ? 'do_up' : 'do_in');
  $('f').password.autocomplete = up ? 'new-password' : 'current-password';
  $('msg').textContent = '';
}
$('tin').onclick = () => { mode = 'in'; paint(); }; $('tup').onclick = () => { mode = 'up'; paint(); };
window.onLang = paint;
$('f').onsubmit = async e => {
  e.preventDefault(); const f = e.target, b = $('go'); b.disabled = true; $('msg').className = 'msg'; $('msg').textContent = '';
  try {
    const body = { email: f.email.value, password: f.password.value };
    if (mode === 'up') Object.assign(body, { name: f.name.value, phone: f.phone.value, public: f.public.checked });
    await api('POST', '/api/auth/' + (mode === 'up' ? 'register' : 'login'), body);
    location.href = nextUrl();
  } catch (er) { $('msg').textContent = er.message; b.disabled = false; }
};
applyLang(); paint();
if (new URLSearchParams(location.search).get('mode') === 'up') { mode = 'up'; paint(); }
loadMe().then(u => { if (u) location.replace(nextUrl()); renderNav('/profile.html'); });
