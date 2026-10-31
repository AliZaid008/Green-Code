// يرسل بلاغاً تجريبياً عبر القنوات المفعّلة في .env ويطبع النتيجة:  node scripts/test-notify.js
require('dotenv').config();
require('../notify')({ id: 'test', name: 'اختبار', phone: '+964000000000', email: 'test@example.com', type: 'test', gov: 'test', lat: 32.6, lng: 44.02,
  desc: 'بلاغ تجريبي. إذا وصلك فالإشعارات تعمل.', photos: [], date: new Date().toISOString() }, process.env.BASE_URL || 'http://localhost:3000')
  .then(r => { console.table(r); process.exit(0); });
