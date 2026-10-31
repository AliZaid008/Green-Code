// تحديد المحافظة تلقائياً من الإحداثيات (الكود المشترك public/js/geo-detect.js يعمل هنا وفي المتصفح).
const fs = require('fs'), path = require('path');
const govs = JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'governorates.json'), 'utf8'));
const gj = JSON.parse(fs.readFileSync(path.join(__dirname, 'public', 'data', 'iraq.geojson'), 'utf8'));
const det = require('./public/js/geo-detect.js').create(govs, gj);
module.exports = { govAt: det.govAt, detect: det.detect, govs };
