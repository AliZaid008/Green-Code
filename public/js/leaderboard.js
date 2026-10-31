async function paint() {
  const rows = await api('GET', '/api/leaderboard').catch(() => []);
  $('rows').innerHTML = rows.length ? rows.map(r => `<div class="lb"><span class="pos">${r.pos}</span>${seal(r.rank.lv, 38)}<span class="nm">${esc(r.name)}<small class="muted" style="display:block;font-weight:500">${rankName(r.rank)}</small></span><span class="sc">${r.rank.approved} ✓</span></div>`).join('') : `<p class="muted">${t('top_empty')}</p>`;
  rankLadder($('ladder'));
}
window.onLang = paint; boot('/leaderboard.html'); applyLang(); paint();
