# نشر الموقع ليشوفه الجميع

الموقع يحتاج Node 22.5+ وقاعدة SQLite وملفات صور مرفوعة، فلازم استضافة تشغّل Node وفيها **قرص دائم** (Persistent Disk/Volume). استضافات الملفات الثابتة مثل GitHub Pages لا تكفي.

## الطريقة الأسهل: Render.com
1. ارفع المشروع إلى GitHub (بدون .env ولا data/app.db).
2. في Render: New → Blueprint → اختر المستودع (يقرأ render.yaml تلقائياً).
3. املأ المتغيرات: ADMIN_KEY (8 أحرف فأكثر، سرّي)، BASE_URL (رابط موقعك بعد الإنشاء)، DEV_EMAILS، SMTP_USER، SMTP_PASS (كلمة مرور تطبيق Gmail).
4. بعد النشر افتح الرابط، وادخل /admin.html بالمفتاح.
5. مهم: لا تستخدم خطة مجانية بدون قرص، لأن البيانات والصور ستضيع عند كل إعادة تشغيل.

## بدائل
- Railway أو Fly.io: يستخدمان نفس Dockerfile. اربط Volume على /data وضع DATA_DIR=/data.
- VPS (مثل Hetzner/DigitalOcean): `npm install` ثم `NODE_ENV=production pm2 start server.js` خلف Nginx مع HTTPS.

## بعد النشر
- فحص الروابط: `node scripts/check-links.js`
- نسخ احتياطي: انسخ مجلد /data كاملاً (app.db + uploads).
