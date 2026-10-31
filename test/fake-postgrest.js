// خادم PostgREST مصغّر في الذاكرة لاختبار db-supabase.js بدون حساب Supabase حقيقي.
const http = require('http');
const PK = { points: ['id'], pending: ['id'], meta: ['k'], users: ['id'], user_reports: ['id'], confirms: ['point_id', 'user_id'], audit: ['id'] };
module.exports = () => new Promise(res => {
  const T = {}; Object.keys(PK).forEach(k => T[k] = []);
  const match = (row, [k, v]) => {
    if (['select', 'order', 'limit', 'on_conflict'].includes(k)) return true;
    const [op, ...r] = v.split('.'), val = r.join('.'), x = row[k];
    if (op === 'eq') return String(x) === val;
    if (op === 'gt') return x > +val;
    if (op === 'gte') return String(x) >= val;
    if (op === 'in') return val.replace(/^\(|\)$/g, '').split(',').map(decodeURIComponent).includes(String(x));
    if (op === 'not') return val === 'is.null' ? x !== null && x !== undefined : true;
    return true;
  };
  const srv = http.createServer((q, r) => {
    const u = new URL(q.url, 'http://x'), tb = u.pathname.split('/').pop(); let b = '';
    q.on('data', d => b += d); q.on('end', () => {
      if (u.pathname.startsWith('/storage/')) { r.writeHead(200, { 'content-type': 'application/json' }); return r.end('{}'); }
      const rows = T[tb]; if (!rows) { r.writeHead(404); return r.end('{}'); }
      const f = () => rows.filter(row => [...u.searchParams].every(p => match(row, p)));
      const send = (code, o, h = {}) => { r.writeHead(code, { 'content-type': 'application/json', ...h }); r.end(o === undefined ? '' : JSON.stringify(o)); };
      if (q.method === 'GET' || q.method === 'HEAD') {
        let o = f(); const ord = u.searchParams.get('order');
        if (ord) { const [c, d] = ord.split('.'); o = [...o].sort((a, z) => (a[c] > z[c] ? 1 : a[c] < z[c] ? -1 : 0) * (d === 'desc' ? -1 : 1)); }
        const lim = +u.searchParams.get('limit'); if (lim) o = o.slice(0, lim);
        if (q.method === 'HEAD') { r.writeHead(200, { 'content-range': `0-${o.length}/${o.length}` }); return r.end(); }
        return send(200, o);
      }
      if (q.method === 'POST') {
        const merge = /merge-duplicates/.test(q.headers.prefer || '');
        for (const n of JSON.parse(b)) {
          const i = rows.findIndex(x => PK[tb].every(k => x[k] === n[k]));
          if (i >= 0) { if (merge) rows[i] = { ...rows[i], ...n }; else return send(409, { message: 'duplicate key' }); }
          else { if (tb === 'users' && rows.some(x => x.email === n.email)) return send(409, { message: 'duplicate key unique' }); rows.push({ ...n }); }
        }
        return send(201);
      }
      if (q.method === 'PATCH') { const p = JSON.parse(b); f().forEach(x => Object.assign(x, p)); return send(204); }
      if (q.method === 'DELETE') { const del = new Set(f()); T[tb] = rows.filter(x => !del.has(x)); rows.length = 0; rows.push(...T[tb]); T[tb] = rows; return send(204); }
      send(405, {});
    });
  });
  srv.listen(0, () => res({ url: 'http://127.0.0.1:' + srv.address().port, close: () => srv.close() }));
});
