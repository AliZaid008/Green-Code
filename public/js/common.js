const TYPES = {
  air:       { ar: 'هواء / دخان',    en: 'Air / Smoke',        c: '#78909c' },
  water:     { ar: 'مياه',           en: 'Water',              c: '#1e88e5' },
  waste:     { ar: 'نفايات',         en: 'Waste',              c: '#e53935' },
  soil:      { ar: 'تربة',           en: 'Soil',               c: '#8d6e63' },
  oil:       { ar: 'نفطي / كيميائي', en: 'Oil / Chemical',     c: '#fb8c00' },
  radiation: { ar: 'إشعاعي',         en: 'Radiation',          c: '#8e24aa' }
};
const TYPE_INFO = {
  air: {
    effects: ['تهيّج الجهاز التنفسي وتفاقم الربو وأمراض الرئة.', 'ارتبط تلوث الهواء بأمراض القلب والأوعية الدموية.', 'الجسيمات الدقيقة PM2.5 تصل عمق الرئة وهي الأخطر على الأطفال وكبار السن.', 'غازات الكبريت والنيتروجين تضر النباتات وتسبب الأمطار الحمضية.'],
    solutions: ['إيقاف الحرق المفتوح وتطبيق العقوبات القانونية.', 'تركيب فلاتر انبعاثات في المصانع ومحطات الكهرباء.', 'التقاط الغاز المصاحب بدل حرقه واستخدامه لإنتاج الكهرباء.', 'نقل المعامل الملوثة بعيداً عن المناطق السكنية.', 'للسكان: تقليل التعرض وقت الذروة وارتداء كمامة N95 عند الحاجة.'],
    effects_en: ['Irritates the respiratory system and worsens asthma and lung disease.', 'Air pollution is linked to cardiovascular disease.', 'Fine particles (PM2.5) reach deep into the lungs and are most dangerous for children and the elderly.', 'Sulfur and nitrogen gases harm plants and cause acid rain.'],
    solutions_en: ['Stop open burning and enforce legal penalties.', 'Install emission filters in factories and power plants.', 'Capture associated gas instead of flaring it and use it for electricity.', 'Relocate polluting plants away from residential areas.', 'Residents: limit exposure at peak times and wear an N95 mask when needed.']
  },
  water: {
    effects: ['أمراض الجهاز الهضمي والإسهال والتهابات الكبد عند شرب مياه غير معالجة.', 'حالات تسمم جماعية كما حدث في أزمة البصرة 2018.', 'ارتفاع الملوحة يضر المحاصيل ويقتل الأسماك.', 'الري بمياه ملوثة ينقل الملوثات إلى التربة والغذاء.'],
    solutions: ['معالجة مياه المجاري قبل تصريفها للأنهار.', 'إعادة تأهيل محطات التصفية والمعالجة.', 'منع رمي المخلفات الصناعية والنفايات في الأنهار.', 'فحص دوري ومعلن لجودة المياه.', 'للسكان: غلي الماء أو استخدام فلتر عند الشك بجودته.'],
    effects_en: ['Stomach illness, diarrhea and hepatitis from drinking untreated water.', 'Mass poisoning cases, as in the 2018 Basra crisis.', 'High salinity damages crops and kills fish.', 'Irrigating with polluted water moves contaminants into soil and food.'],
    solutions_en: ['Treat sewage before discharging it into rivers.', 'Rehabilitate water treatment plants.', 'Ban dumping industrial waste and garbage in rivers.', 'Regular, public water-quality testing.', 'Residents: boil water or use a filter if in doubt.']
  },
  waste: {
    effects: ['الحرق المفتوح للنفايات يطلق الديوكسينات والجسيمات الدقيقة.', 'عصارة المكبات تلوث المياه الجوفية.', 'انتشار الحشرات والقوارض والأمراض.', 'روائح ودخان يؤذي السكان القريبين.'],
    solutions: ['فرز النفايات من المصدر.', 'مطامر صحية هندسية بدل المكبات العشوائية.', 'إعادة التدوير وتحويل النفايات العضوية إلى سماد.', 'منع الحرق المفتوح وتفعيل الرقابة.', 'جمع منتظم للنفايات من الأحياء.'],
    effects_en: ['Open burning releases dioxins and fine particles.', 'Landfill leachate contaminates groundwater.', 'Spreads insects, rodents and disease.', 'Odors and smoke harm nearby residents.'],
    solutions_en: ['Sort waste at the source.', 'Engineered sanitary landfills instead of random dumps.', 'Recycle and compost organic waste.', 'Ban open burning and enforce monitoring.', 'Regular waste collection in neighborhoods.']
  },
  soil: {
    effects: ['تراكم المعادن الثقيلة في التربة والمحاصيل.', 'تلوث المياه الجوفية.', 'انخفاض خصوبة الأرض.', 'دخول الملوثات إلى السلسلة الغذائية.'],
    solutions: ['فحص وتحليل عينات التربة.', 'عزل المواقع الملوثة ومنع الاقتراب منها.', 'إزالة التربة الملوثة ومعالجتها.', 'منع الزراعة في الموقع حتى تتم المعالجة.'],
    effects_en: ['Heavy metals build up in soil and crops.', 'Groundwater contamination.', 'Reduced land fertility.', 'Contaminants enter the food chain.'],
    solutions_en: ['Test soil samples.', 'Isolate contaminated sites and keep people away.', 'Remove and treat contaminated soil.', 'No farming on the site until it is treated.']
  },
  oil: {
    effects: ['تسمم المياه والتربة بالهيدروكربونات.', 'نفوق الأسماك وتضرر المواشي.', 'خطر حرائق وانفجارات.', 'بعض مركبات النفط مسرطنة عند التعرض الطويل.'],
    solutions: ['احتواء التسرب فوراً ومنع انتشاره.', 'إزالة التربة والمياه الملوثة ومعالجتها.', 'صيانة الأنابيب والخزانات ومراقبتها.', 'مساءلة الجهة المسؤولة عن التسرب.'],
    effects_en: ['Hydrocarbons poison water and soil.', 'Fish die-offs and livestock harm.', 'Fire and explosion risk.', 'Some oil compounds are carcinogenic with long exposure.'],
    solutions_en: ['Contain the spill immediately.', 'Remove and treat contaminated soil and water.', 'Maintain and monitor pipes and tanks.', 'Hold the responsible party accountable.']
  },
  radiation: {
    effects: ['التعرض الطويل للإشعاع قد يرفع مخاطر السرطان.', 'غبار مشع قد يلوث التربة والمياه.', 'خطر مضاعف على العاملين بجمع الخردة.', 'الحوامل والأطفال أكثر حساسية للإشعاع.'],
    solutions: ['عزل الموقع وتسييجه ووضع علامات تحذير.', 'قياس مستوى الإشعاع بفرق متخصصة.', 'منع جمع الخردة وبيعها من الموقع.', 'إبلاغ وزارة البيئة والجهات الرقابية المختصة.'],
    effects_en: ['Long exposure may raise cancer risk.', 'Radioactive dust may contaminate soil and water.', 'Higher risk for scrap collectors.', 'Pregnant women and children are more sensitive.'],
    solutions_en: ['Fence off the site and post warning signs.', 'Measure radiation levels with specialist teams.', 'Stop scrap collection and sales from the site.', 'Report to the Ministry of Environment and regulators.']
  }
};

const I18N = {
  ar: {
    news_btn: '🔔 الأخبار', news_t: 'آخر الأخبار', news_new: 'أحدث التلوثات المضافة', news_gone: 'أحدث التلوثات التي أُزيلت', news_none_new: 'لا توجد إضافات جديدة بعد.', news_none_gone: 'لا توجد إزالات موثقة بعد.',
    added_on: 'أُضيفت', removed_on: 'أُزيلت', removed_t: 'تمت إزالة هذا التلوث', removed_tag: 'أُزيل ✓', lg_removed: 'أُزيل / أُوقف', back_list: '→ رجوع للمحافظات', no_src: 'لا يوجد رابط مصدر',
    st_photos: 'بعد الضغط على الإرسال سيفتح تطبيق واتساب أو الإيميل، أرفق فيه 3 صور للتلوث.', st_wa: 'إرسال عبر واتساب', st_mail: 'إرسال عبر الإيميل', st_pick: 'حدد الموقع على الخارطة أولاً.',
    st_uploading: '⏳ جاري رفع الصور...', st_upfail: 'فشل رفع الصور. تأكد من الإنترنت وحاول مرة أخرى.', st_name_opt: 'الاسم والهاتف اختياريان (رقمك يظهر لنا أصلاً في واتساب).',
    title_home: 'كود أخضر | خارطة التلوث في العراق', title_map: 'خارطة التلوث', title_report: 'الإبلاغ عن تلوث',
    brand: 'كود أخضر', brand_map: 'خارطة التلوث', brand_report: 'الإبلاغ عن تلوث', home: '→ الرئيسية', stat1: 'نقطة تلوث موثقة', stat2: 'محافظة', stat3: 'أنواع تلوث',
    home_title: 'خارطة التلوث في العراق',
    home_p: 'منصة وطنية مفتوحة لرصد مصادر التلوث الهوائي والمائي وتلوث التربة والنفايات في العراق. يوثّق المواطنون البلاغات بالصور والموقع الدقيق، ويراجعها فريق التحقق، ثم تُنشر على خارطة تفاعلية لكل محافظة مع الآثار الصحية والحلول المقترحة.',
    step1: '<b>1</b> بلّغ بالصور والموقع', step2: '<b>2</b> يراجع الفريق البلاغ', step3: '<b>3</b> يُنشر على الخارطة',
    report_t: 'أبلّغ عن تلوث', report_s: 'صور وموقع دقيق ووصف. بياناتك تصل فريق المراجعة فقط.',
    view_t: 'أستعرض التلوث', view_s: 'اختر محافظة وشاهد مواقع التلوث وأنواعه والحلول المقترحة.',
    choose_gov: 'اختر محافظة', back_iraq: '→ رجوع للعراق', points: 'نقاط التلوث', no_points: 'لا توجد نقاط مطابقة في هذه المحافظة.',
    all_types: 'كل أنواع التلوث', search_ph: 'ابحث عن تلوث أو محافظة...',
    d_problem: 'وصف المشكلة', d_loc: 'الموقع', d_maps: 'فتح الموقع على Google Maps', d_approx: '(الموقع تقريبي ويحتاج تأكيداً ميدانياً)',
    d_effects: 'الآثار الصحية والبيئية المحتملة', d_solutions: 'الحلول المقترحة', d_site: 'لهذا الموقع:', d_photos: 'صور من الموقع',
    d_source: 'المصدر', open_src: 'اضغط لفتح المصدر', copy: 'نسخ الرابط', d_note: 'الآثار والحلول العامة للتوعية، وليست تقييماً طبياً أو هندسياً لهذا الموقع.',
    pot_t: 'مصدر محتمل للتلوث', pot_p: 'هذه منشأة مسجّلة في خريطة OpenStreetMap وقد تكون مصدر تلوث، وليست بلاغاً مؤكداً.', back_map: '→ رجوع للخارطة',
    form_t: 'بيانات البلاغ', name: 'الاسم', phone: 'رقم الهاتف', email: 'الإيميل', gov: 'المحافظة', type: 'نوع التلوث', desc: 'وصف المشكلة', photos3: '3 صور للتلوث',
    pick_t: 'حدد الموقع بدقة', pick_h: 'اضغط على الخارطة لوضع الدبوس مكان التلوث.', gps: 'استخدم موقعي الحالي', send: 'إرسال البلاغ',
    sending: 'جاري الإرسال...', sent: 'وصل بلاغك. سنراجعه وننشره بعد التأكد. شكراً لك.', pick_err: 'اضغط على الخارطة لتحديد موقع التلوث بدقة.',
    conn_err: 'تعذر الاتصال بالخادم.', gps_err: 'تعذر تحديد موقعك', map_err: 'تعذر تحميل الخارطة. تأكد من وجود الملف public/data/iraq.geojson'
  },
  en: {
    news_btn: '🔔 News', news_t: 'Latest news', news_new: 'Newest pollution added', news_gone: 'Most recent pollution removed', news_none_new: 'Nothing new has been added yet.', news_none_gone: 'No documented removals yet.',
    added_on: 'Added', removed_on: 'Removed', removed_t: 'This pollution was removed', removed_tag: 'Removed ✓', lg_removed: 'Removed / stopped', back_list: '← Back to governorates', no_src: 'No source link',
    st_photos: 'After you tap send, WhatsApp or your email app opens. Attach 3 photos of the pollution there.', st_wa: 'Send via WhatsApp', st_mail: 'Send via email', st_pick: 'Pin the location on the map first.',
    st_uploading: '⏳ Uploading photos...', st_upfail: 'Photo upload failed. Check your connection and try again.', st_name_opt: 'Name and phone are optional (WhatsApp already shows us your number).',
    title_home: 'Green Code | Iraq Pollution Map', title_map: 'Pollution Map', title_report: 'Report Pollution',
    brand: 'Green Code', brand_map: 'Pollution Map', brand_report: 'Report Pollution', home: '← Home', stat1: 'Documented points', stat2: 'Governorates', stat3: 'Pollution types',
    home_title: 'Iraq Pollution Map',
    home_p: 'An open national platform tracking sources of air, water and soil pollution and waste across Iraq. Citizens document reports with photos and exact locations, a verification team reviews them, and they are published on an interactive map for every governorate, with health effects and suggested solutions.',
    step1: '<b>1</b> Report with photos and location', step2: '<b>2</b> The team reviews it', step3: '<b>3</b> Published on the map',
    report_t: 'Report pollution', report_s: 'Photos, exact location and a description. Your details reach the review team only.',
    view_t: 'Explore pollution', view_s: 'Pick a governorate to see pollution sites, their types and suggested solutions.',
    choose_gov: 'Choose a governorate', back_iraq: '← Back to Iraq', points: 'Pollution points', no_points: 'No matching points in this governorate.',
    all_types: 'All pollution types', search_ph: 'Search pollution or governorate...',
    d_problem: 'Problem description', d_loc: 'Location', d_maps: 'Open location in Google Maps', d_approx: '(Approximate location, needs field confirmation)',
    d_effects: 'Possible health and environmental effects', d_solutions: 'Suggested solutions', d_site: 'For this site:', d_photos: 'Photos from the site',
    d_source: 'Source', open_src: 'Click to open the source', copy: 'Copy link', d_note: 'General effects and solutions are for awareness, not a medical or engineering assessment of this site.',
    pot_t: 'Potential pollution source', pot_p: 'This facility is listed on OpenStreetMap and may be a source of pollution. It is not a confirmed report.', back_map: '← Back to map',
    form_t: 'Report details', name: 'Name', phone: 'Phone number', email: 'Email', gov: 'Governorate', type: 'Pollution type', desc: 'Describe the problem', photos3: '3 photos of the pollution',
    pick_t: 'Pin the exact location', pick_h: 'Click the map to place the pin at the pollution site.', gps: 'Use my current location', send: 'Send report',
    sending: 'Sending...', sent: 'Your report was received. We will review it and publish after verification. Thank you.', pick_err: 'Click the map to mark the exact pollution location.',
    conn_err: 'Could not reach the server.', gps_err: 'Could not get your location', map_err: 'Could not load the map. Make sure public/data/iraq.geojson exists.'
  }
};

let lang = localStorage.getItem('lang') || 'ar';
const $ = id => document.getElementById(id);
const t = k => (I18N[lang] && I18N[lang][k]) || I18N.ar[k] || k;
const pick = (o, f) => (lang === 'en' && o[f + '_en']) || o[f];
const tn = k => TYPES[k][lang];
const info = (k, f) => (lang === 'en' ? TYPE_INFO[k][f + '_en'] : TYPE_INFO[k][f]);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const legend = () => Object.keys(TYPES).map(k => `<span class="lg"><i style="background:${TYPES[k].c}"></i>${tn(k)}</span>`).join('') + `<span class="lg"><i style="background:transparent;border:3px solid #22c55e"></i>${t('lg_removed')}</span>`;
const fmtDate = d => { if (!d) return ''; const x = new Date(d); return isNaN(x) ? d : x.toLocaleDateString(lang === 'en' ? 'en-GB' : 'ar-IQ', { year: 'numeric', month: 'long', day: 'numeric' }); };

function applyLang() {
  document.documentElement.lang = lang;
  document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
  document.querySelectorAll('[data-i18n]').forEach(e => e.innerHTML = t(e.dataset.i18n));
  document.querySelectorAll('[data-i18n-ph]').forEach(e => e.placeholder = t(e.dataset.i18nPh));
  if (document.body.dataset.title) document.title = t(document.body.dataset.title);
  const b = $('langbtn'); if (b) b.textContent = lang === 'ar' ? 'English' : 'العربية';
  const lg = $('lg'); if (lg) lg.innerHTML = legend();
}
function setLang(l) { lang = l; localStorage.setItem('lang', l); applyLang(); if (window.onLang) window.onLang(); }
document.addEventListener('click', e => { if (e.target.id === 'langbtn') setLang(lang === 'ar' ? 'en' : 'ar'); });

/* ================= v15: الحسابات والرتب ================= */
Object.assign(I18N.ar, {
  login: 'دخول', logout: 'خروج', profile: 'حسابي', board: 'المتصدّرون', stats_t: 'إحصائيات', nav_home: 'الرئيسية', nav_map: 'الخارطة', nav_report: 'بلّغ', nav_board: 'الأوائل', nav_me: 'حسابي',
  need_login: 'سجّل الدخول لتبلّغ', need_login_p: 'الحساب يحفظ بياناتك فلا تعيد كتابتها، ويرفع رتبتك مع كل بلاغ صحيح.',
  r_name: 'الاسم الكامل', r_phone: 'رقم الهاتف', r_email: 'الإيميل', r_pass: 'كلمة المرور (8 أحرف على الأقل)', r_public: 'أظهر اسمي في لوحة المتصدّرين',
  tab_in: 'تسجيل الدخول', tab_up: 'حساب جديد', do_in: 'دخول', do_up: 'إنشاء الحساب', cur_pass: 'كلمة المرور الحالية', new_pass: 'كلمة المرور الجديدة',
  rank: 'الرتبة', approved: 'بلاغ معتمد', rejected: 'مرفوض', accuracy: 'الدقة', score: 'النقاط', next_rank: 'الرتبة التالية', max_rank: 'وصلت لأعلى رتبة 🎉',
  need_more: 'تحتاج {n} بلاغات معتمدة أخرى', need_acc: 'والدقة {a}% على الأقل', limit_day: 'الحد اليومي', limit_pend: 'قيد المراجعة',
  my_reports: 'بلاغاتي', no_reports: 'لم ترسل بلاغات بعد.', st_pending: 'قيد المراجعة', st_approved: 'معتمد ومنشور', st_rejected: 'مرفوض', view_pt: 'عرض على الخارطة',
  settings: 'الإعدادات', save: 'حفظ', saved: 'تم الحفظ ✓', change_pw: 'تغيير كلمة المرور', del_acc: 'حذف حسابي', del_confirm: 'اكتب كلمة المرور لحذف الحساب نهائياً. بلاغاتك المنشورة تبقى بدون اسمك.',
  all_ranks: 'سلّم الرتب', top_title: 'أفضل المبلّغين', top_empty: 'لا يوجد متصدّرون بعد. كن الأول!', pos: 'الترتيب',
  rep_auto: 'المحافظة تُحدَّد تلقائياً من الموقع', rep_detected: 'المحافظة المكتشفة', rep_waiting: 'حدّد الموقع على الخارطة', rep_outside: 'الموقع خارج العراق. حرّك الدبوس.',
  rep_as: 'سيُرسل البلاغ باسم', rep_slots: 'اضغط لإضافة صورة', rep_done: 'وصل بلاغك ✓ سنراجعه. رتبتك ترتفع بعد اعتماده.', rep_pub: 'تم نشر بلاغك فوراً بفضل رتبتك 🎉',
  confirm_pt: 'أؤكد أن هذا التلوث موجود', confirmed_pt: 'أكّدت ✓', confirms: 'تأكيد', by_citizen: 'بلاغ من', login_to_confirm: 'سجّل الدخول لتأكيد النقطة',
  pw_changed: 'تم تغيير كلمة المرور', err_generic: 'حدث خطأ، حاول مرة أخرى.', err_net: 'تعذر الاتصال بالخادم.',
  lv0: 'مبتدئ', lv1: 'راصد', lv2: 'مراقب', lv3: 'حارس البيئة', lv4: 'سفير أخضر'
});
Object.assign(I18N.en, {
  login: 'Sign in', logout: 'Sign out', profile: 'My account', board: 'Leaderboard', stats_t: 'Stats', nav_home: 'Home', nav_map: 'Map', nav_report: 'Report', nav_board: 'Top', nav_me: 'Me',
  need_login: 'Sign in to report', need_login_p: 'An account saves your details so you never retype them, and raises your rank with every correct report.',
  r_name: 'Full name', r_phone: 'Phone number', r_email: 'Email', r_pass: 'Password (min. 8 characters)', r_public: 'Show my name on the leaderboard',
  tab_in: 'Sign in', tab_up: 'New account', do_in: 'Sign in', do_up: 'Create account', cur_pass: 'Current password', new_pass: 'New password',
  rank: 'Rank', approved: 'approved', rejected: 'rejected', accuracy: 'Accuracy', score: 'Score', next_rank: 'Next rank', max_rank: 'You reached the top rank 🎉',
  need_more: '{n} more approved reports needed', need_acc: 'and at least {a}% accuracy', limit_day: 'Daily limit', limit_pend: 'Under review',
  my_reports: 'My reports', no_reports: 'You have not sent any reports yet.', st_pending: 'Under review', st_approved: 'Approved & published', st_rejected: 'Rejected', view_pt: 'View on map',
  settings: 'Settings', save: 'Save', saved: 'Saved ✓', change_pw: 'Change password', del_acc: 'Delete my account', del_confirm: 'Enter your password to delete your account permanently. Your published reports stay, without your name.',
  all_ranks: 'Rank ladder', top_title: 'Top reporters', top_empty: 'No leaders yet. Be the first!', pos: 'Pos',
  rep_auto: 'The governorate is detected automatically from the location', rep_detected: 'Detected governorate', rep_waiting: 'Pin the location on the map', rep_outside: 'Location is outside Iraq. Move the pin.',
  rep_as: 'The report will be sent as', rep_slots: 'Tap to add a photo', rep_done: 'Report received ✓ We will review it. Your rank rises once it is approved.', rep_pub: 'Your report was published instantly thanks to your rank 🎉',
  confirm_pt: 'I confirm this pollution exists', confirmed_pt: 'Confirmed ✓', confirms: 'confirmations', by_citizen: 'Reported by', login_to_confirm: 'Sign in to confirm this point',
  pw_changed: 'Password changed', err_generic: 'Something went wrong, try again.', err_net: 'Could not reach the server.',
  lv0: 'Newcomer', lv1: 'Observer', lv2: 'Monitor', lv3: 'Eco Guardian', lv4: 'Green Ambassador'
});
const RANK_COL = ['#8aa39b', '#4fb3a1', '#3aa7e0', '#e9b44c', '#ff8a3d'];
// ختم الرتبة: درع SVG بعدد نجوم يساوي مستوى الرتبة
const seal = (lv, sz = 36) => {
  const c = RANK_COL[lv] || RANK_COL[0], stars = Array.from({ length: Math.max(1, lv) }, (_, i) => {
    const n = Math.max(1, lv), x = 24 + (i - (n - 1) / 2) * 7; return `<circle cx="${x}" cy="24" r="2.4" fill="#0b2a26"/>`;
  }).join('');
  return `<svg class="seal" width="${sz}" height="${sz}" viewBox="0 0 48 48" aria-hidden="true"><path d="M24 3l17 6v13c0 11-7 19-17 23C14 41 7 33 7 22V9z" fill="${c}"/><path d="M24 3l17 6v13c0 11-7 19-17 23z" fill="#fff" opacity=".18"/>${stars}</svg>`;
};
const rankName = r => lang === 'en' ? r.en : r.ar;
let ME = null, CONFIRMED = [];
const GC_AUTH = !(window.GC && window.GC.AUTH === false);
async function api(method, url, body, isForm) {
  let r;
  try { r = await fetch(url, { method, headers: body && !isForm ? { 'Content-Type': 'application/json' } : undefined, body: body ? (isForm ? body : JSON.stringify(body)) : undefined }); }
  catch (e) { throw Object.assign(new Error(t('err_net')), { code: 'net' }); }
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error(j.error || t('err_generic')), { code: j.code, status: r.status });
  return j;
}
function toast(msg, bad) {
  let h = $('toasts'); if (!h) { h = document.createElement('div'); h.id = 'toasts'; document.body.appendChild(h); }
  const d = document.createElement('div'); d.className = 'toast' + (bad ? ' bad' : ''); d.textContent = msg; h.appendChild(d);
  setTimeout(() => d.classList.add('out'), 3200); setTimeout(() => d.remove(), 3700);
}
async function loadMe() {
  if (!GC_AUTH) return null;
  try { const j = await api('GET', '/api/me'); ME = j.user; CONFIRMED = j.confirmed || []; } catch (e) { ME = null; }
  return ME;
}
// شريط علوي موحّد + شريط سفلي للجوال
function renderNav(active) {
  const top = document.querySelector('.top .tools') || document.querySelector('.top');
  if (GC_AUTH && top && !$('acct')) {
    const a = document.createElement('a'); a.id = 'acct'; a.className = 'acct'; top.prepend(a);
  }
  paintAcct();
  if (!$('bnav') && GC_AUTH) {
    const n = document.createElement('nav'); n.id = 'bnav'; n.className = 'bnav';
    n.innerHTML = [['/', 'nav_home', '⌂'], ['/map.html', 'nav_map', '◉'], ['/report.html', 'nav_report', '＋'], ['/leaderboard.html', 'nav_board', '★'], ['/profile.html', 'nav_me', '☺']]
      .map(([h, k, i]) => `<a href="${h}" class="${h === active ? 'on' : ''}"><i>${i}</i><span data-i18n="${k}"></span></a>`).join('');
    document.body.appendChild(n); document.body.classList.add('hasnav');
  }
  applyLang();
}
function paintAcct() {
  const a = $('acct'); if (!a) return;
  if (ME) { a.href = '/profile.html'; a.innerHTML = `${seal(ME.rank.lv, 24)}<span>${esc(ME.name.split(' ')[0])}</span>${ME.admin ? '<small class="admtag">ADMIN</small>' : ''}`; a.classList.add('in'); }
  else { a.href = '/login.html?next=' + encodeURIComponent(location.pathname); a.textContent = t('login'); a.classList.remove('in'); }
}
const _al = applyLang;
applyLang = function () { _al(); paintAcct(); };
async function boot(active) { await loadMe(); renderNav(active); }
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}));
// كاشف المحافظة في المتصفح (نفس الملف الذي يستخدمه السيرفر). يُحمَّل عند الحاجة فقط.
let _det;
function detector() {
  return _det || (_det = Promise.all([fetch('/api/governorates').then(r => r.json()), fetch('/data/iraq.geojson').then(r => r.json()), new Promise((ok, no) => { const s = document.createElement('script'); s.src = '/js/geo-detect.js?v=21'; s.onload = ok; s.onerror = no; document.head.appendChild(s); })])
    .then(([g, j]) => ({ govs: g, d: GeoDetect.create(g, j) })));
}
Object.assign(I18N.ar, { title_login: 'الدخول', title_profile: 'حسابي', title_board: 'المتصدّرون', title_stats: 'إحصائيات' });
Object.assign(I18N.en, { title_login: 'Sign in', title_profile: 'My account', title_board: 'Leaderboard', title_stats: 'Stats' });
async function rankLadder(el) {
  let rs = []; try { rs = await api('GET', '/api/ranks'); } catch (e) { return; }
  el.innerHTML = rs.map(r => `<div>${seal(r.lv, 44)}<b>${lang === 'en' ? r.en : r.ar}</b><small>${r.min}+ ✓ · ${r.acc ? r.acc + '%' : '—'}</small><small>${t('limit_day')}: ${r.day}</small></div>`).join('');
}
