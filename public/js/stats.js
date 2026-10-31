async function paint() {
  const [pts, govs] = await Promise.all([api('GET', '/api/points'), api('GET', '/api/governorates')]);
  const act = pts.filter(p => p.status !== 'removed'), gone = pts.length - act.length;
  $('k').innerHTML = [[act.length, 'stat1'], [gone, 'lg_removed'], [pts.reduce((a, p) => a + (p.confirms || 0), 0), 'confirms']].map(([v, k]) => `<div class="kpi"><b>${v}</b><span>${t(k)}</span></div>`).join('');
  const by = {}; act.forEach(p => by[p.gov] = (by[p.gov] || 0) + 1);
  const max = Math.max(1, ...Object.values(by));
  $('bars').innerHTML = govs.map(g => [g, by[g.id] || 0]).sort((a, b) => b[1] - a[1]).map(([g, n]) => `<div class="rep"><span style="width:110px">${esc(lang === 'en' ? g.en : g.ar)}</span><div class="bar" style="flex:1;margin:0"><i style="width:${n / max * 100}%"></i></div><b>${n}</b></div>`).join('');
}
window.onLang = paint; boot('/stats.html'); applyLang(); paint();
