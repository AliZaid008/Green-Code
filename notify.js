// إشعار المطورين ببلاغ جديد. القنوات (كلها اختيارية، تُفعَّل بوجود متغيراتها):
//  1) Telegram  : TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID   (مجاني، يشتغل على Render المجاني)
//  2) Brevo API : BREVO_API_KEY + BREVO_SENDER + DEV_EMAILS (مجاني، 300 إيميل/يوم، عبر HTTPS)
//  3) SMTP      : SMTP_USER/SMTP_PASS (لا يعمل على Render المجاني لأنه يحجب منافذ SMTP)
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const abs = (base, u) => /^https?:/.test(u) ? u : base + u;

async function telegram(r, base) {
  const t = process.env.TELEGRAM_BOT_TOKEN, c = process.env.TELEGRAM_CHAT_ID; if (!t || !c) return 'skipped';
  const text = `<b>🚨 بلاغ تلوث جديد</b>\n<b>الاسم:</b> ${esc(r.name)}\n<b>الهاتف:</b> ${esc(r.phone)}\n<b>الإيميل:</b> ${esc(r.email)}\n${r.rank ? `<b>رتبة المبلّغ:</b> ${esc(r.rank)}${r.trusted ? ' ⭐ موثوق' : ''}\n` : ''}<b>النوع:</b> ${esc(r.type)} | <b>المحافظة:</b> ${esc(r.gov)}\n<b>الوصف:</b> ${esc(r.desc)}\n\n<a href="https://www.google.com/maps?q=${r.lat},${r.lng}">📍 الموقع على Google Maps</a>\n${r.photos.map((u, i) => `<a href="${esc(abs(base, u))}">🖼 صورة ${i + 1}</a>`).join(' | ')}\n\n<a href="${esc(base)}/admin.html">فتح لوحة الإدارة</a>`;
  const x = await fetch(`https://api.telegram.org/bot${t}/sendMessage`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chat_id: c, text, parse_mode: 'HTML', disable_web_page_preview: true }) });
  if (!x.ok) throw new Error('Telegram: ' + x.status + ' ' + (await x.text()).slice(0, 150));
}

function html(r, base) {
  return `<div dir="rtl"><h3>بلاغ جديد</h3><p><b>الاسم:</b> ${esc(r.name)}<br><b>الهاتف:</b> ${esc(r.phone)}<br><b>الإيميل:</b> ${esc(r.email)}${r.rank ? `<br><b>رتبة المبلّغ:</b> ${esc(r.rank)}${r.trusted ? " ⭐ موثوق" : ""}` : ""}</p>
    <p><b>النوع:</b> ${esc(r.type)} | <b>المحافظة:</b> ${esc(r.gov)}</p><p><b>الوصف:</b> ${esc(r.desc)}</p>
    <p><a href="https://www.google.com/maps?q=${r.lat},${r.lng}">الموقع على Google Maps</a></p>
    <p>${r.photos.map(u => `<a href="${esc(abs(base, u))}">صورة</a>`).join(' | ')}</p>
    <p><a href="${esc(base)}/admin.html"><b>فتح لوحة الإدارة للاعتماد أو الرفض</b></a></p></div>`;
}

async function brevo(r, base) {
  const k = process.env.BREVO_API_KEY, from = process.env.BREVO_SENDER, to = String(process.env.DEV_EMAILS || '').split(',').map(s => s.trim()).filter(Boolean);
  if (!k || !from || !to.length) return 'skipped';
  const x = await fetch('https://api.brevo.com/v3/smtp/email', { method: 'POST', headers: { 'api-key': k, 'Content-Type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({ sender: { name: 'Green Code', email: from }, to: to.map(email => ({ email })), subject: `بلاغ تلوث جديد: ${r.type} - ${r.gov}`, htmlContent: html(r, base) }) });
  if (!x.ok) throw new Error('Brevo: ' + x.status + ' ' + (await x.text()).slice(0, 150));
}

let smtp;
async function viaSmtp(r, base) {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) return 'skipped';
  smtp = smtp || require('nodemailer').createTransport({ host: process.env.SMTP_HOST, port: +process.env.SMTP_PORT, secure: +process.env.SMTP_PORT === 465, auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } });
  await smtp.sendMail({ from: process.env.SMTP_USER, to: process.env.DEV_EMAILS, subject: `بلاغ تلوث جديد: ${r.type} - ${r.gov}`, html: html(r, base) });
}

// يرجع نتيجة كل قناة: ok | skipped (غير مفعّلة) | error
module.exports = async (r, base) => {
  const names = ['Telegram', 'Brevo (إيميل)', 'SMTP (إيميل)'];
  const res = await Promise.allSettled([telegram(r, base), brevo(r, base), viaSmtp(r, base)]);
  return res.map((x, i) => {
    if (x.status === 'rejected') { console.error('فشل إشعار', names[i] + ':', x.reason.message); return { channel: names[i], status: 'error', error: x.reason.message }; }
    return { channel: names[i], status: x.value === 'skipped' ? 'skipped' : 'ok' };
  });
};
