// نظام الرتب: يعتمد على عدد البلاغات المعتمدة ونسبة دقتها (معتمد / (معتمد + مرفوض)).
// الرتبة تتغير تلقائياً: كثرة البلاغات الخاطئة تخفضها.
const LEVELS = [
  { lv: 0, min: 0,  acc: 0,    ar: 'مبتدئ',        en: 'Newcomer',         day: 3,  pending: 2  },
  { lv: 1, min: 1,  acc: 0,    ar: 'راصد',         en: 'Observer',         day: 5,  pending: 3  },
  { lv: 2, min: 3,  acc: 0.6,  ar: 'مراقب',        en: 'Monitor',          day: 8,  pending: 5  },
  { lv: 3, min: 8,  acc: 0.75, ar: 'حارس البيئة',  en: 'Eco Guardian',     day: 12, pending: 8  },
  { lv: 4, min: 20, acc: 0.85, ar: 'سفير أخضر',    en: 'Green Ambassador', day: 20, pending: 12 }
];
const accuracy = (a, r) => (a + r > 0 ? a / (a + r) : 1);
const score = (a, r) => Math.max(0, a * 10 - r * 5);
function level(a, r) {
  let cur = LEVELS[0];
  for (const L of LEVELS) if (a >= L.min && accuracy(a, r) >= L.acc) cur = L;
  return cur;
}
// وصف الرتبة + التقدم نحو التالية (للعرض في الواجهة)
function view(a, r) {
  a = +a || 0; r = +r || 0;
  const cur = level(a, r), next = LEVELS[cur.lv + 1] || null, acc = accuracy(a, r);
  return {
    lv: cur.lv, ar: cur.ar, en: cur.en, score: score(a, r), approved: a, rejected: r, accuracy: Math.round(acc * 100),
    dayLimit: cur.day, pendingLimit: cur.pending,
    next: next && { lv: next.lv, ar: next.ar, en: next.en, needApproved: Math.max(0, next.min - a), needAccuracy: Math.round(next.acc * 100), accOk: acc >= next.acc, progress: Math.min(1, a / next.min) }
  };
}
// الاسم الذي يظهر للعامة: الاسم الأول + أول حرف من الاسم الأخير
function publicName(name) {
  const p = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (!p.length) return '';
  return p.length === 1 ? p[0] : p[0] + ' ' + Array.from(p[p.length - 1])[0] + '.';
}
module.exports = { LEVELS, level, view, score, accuracy, publicName };
