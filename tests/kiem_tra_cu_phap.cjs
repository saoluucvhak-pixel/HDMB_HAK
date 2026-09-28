// Kiểm tra cú pháp JavaScript của toàn bộ .gs và các khối <script> trong .html (bỏ qua chú thích HTML và
// thẻ mẫu <?...?> của HtmlService). Chạy: node tests/kiem_tra_cu_phap.cjs
const fs = require('fs'), path = require('path');
const GOC = path.resolve(__dirname, '..');
let loi = 0, soKhoi = 0;
function thu(ma, nhan) {
  soKhoi++;
  try { new Function(ma); } catch (e) { loi++; console.log('LỖI CÚ PHÁP ' + nhan + ': ' + e.message); }
}
fs.readdirSync(GOC).sort().forEach(function (f) {
  const p = path.join(GOC, f);
  if (f.endsWith('.gs')) return thu(fs.readFileSync(p, 'utf8'), f);
  if (!f.endsWith('.html')) return;
  const html = fs.readFileSync(p, 'utf8').replace(/<!--[\s\S]*?-->/g, '');
  const re = /<script(\s[^>]*)?>([\s\S]*?)<\/script>/gi;
  let m, i = 0;
  while ((m = re.exec(html))) {
    i++;
    const thuocTinh = m[1] || '';
    if (/\bsrc=/.test(thuocTinh) || /type=["'](?!text\/javascript|module)/i.test(thuocTinh)) continue;
    // Thẻ mẫu HtmlService: <?!= ... ?> / <?= ... ?> thay bằng giá trị hợp lệ; <? ... ?> (câu lệnh) bỏ đi
    const ma = m[2].replace(/<\?!?=[\s\S]*?\?>/g, 'null').replace(/<\?[\s\S]*?\?>/g, '');
    thu(ma, f + ' <script #' + i + '>');
  }
});
console.log(soKhoi + ' khối mã đã kiểm tra, ' + loi + ' lỗi');
process.exit(loi ? 1 : 0);
