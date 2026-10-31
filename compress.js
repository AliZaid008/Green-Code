// ضغط Brotli/Gzip للنصوص (JSON, HTML, JS, CSS, SVG) بدون أي مكتبة خارجية.
const zlib = require('zlib');
module.exports = (req, res, next) => {
  const ae = req.headers['accept-encoding'] || '', enc = /\bbr\b/.test(ae) ? 'br' : /\bgzip\b/.test(ae) ? 'gzip' : null;
  if (!enc || req.method === 'HEAD') return next();
  const w = res.write.bind(res), e = res.end.bind(res); let on = null, st;
  const decide = () => {
    if (on !== null) return;
    const ty = String(res.getHeader('Content-Type') || '');
    on = !res.getHeader('Content-Encoding') && /json|text|javascript|svg|xml|manifest/.test(ty) && ![204, 304].includes(res.statusCode);
    if (!on) return;
    res.setHeader('Content-Encoding', enc); res.setHeader('Vary', 'Accept-Encoding'); res.removeHeader('Content-Length');
    st = enc === 'br' ? zlib.createBrotliCompress({ params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 4 } }) : zlib.createGzip({ level: 6 });
    st.on('data', c => w(c)); st.on('end', () => e());
    st.on('drain', () => res.emit('drain'));   // بدون هذا يتجمّد تدفق الملفات الكبيرة (pipe ينتظر drain من res)
    res.on('close', () => st.destroy());
  };
  res.write = (c, a, b) => { decide(); return on ? st.write(c, a, b) : w(c, a, b); };
  res.end = (c, a, b) => { decide(); if (!on) return e(c, a, b); if (c && typeof c !== 'function') st.write(c, typeof a === 'string' ? a : undefined); st.end(); return res; };
  next();
};
