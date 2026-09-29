// Dịch file HTML dạng template Apps Script (<? ?>, <?= ?>, <?!= ?>) để dựng trang thật trong trình duyệt thử:
// include_(ten) = nội dung thô file (như createHtmlOutputFromFile), menuChung_() = dựng Menu_Chung.html như máy chủ.
const fs = require('fs'), path = require('path');
const GOC = path.resolve(__dirname, '..');
const esc = v => String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
function bienDich(src) {
  let code = 'var __o = "";\n', i = 0;
  const re = /<\?(!?=)?([\s\S]*?)\?>/g; let m;
  while ((m = re.exec(src))) {
    code += '__o += ' + JSON.stringify(src.slice(i, m.index)) + ';\n';
    if (m[1] === '=') code += '__o += __esc(' + m[2] + ');\n';
    else if (m[1] === '!=') code += '__o += (' + m[2] + ');\n';
    else code += m[2] + '\n';
    i = re.lastIndex;
  }
  code += '__o += ' + JSON.stringify(src.slice(i)) + ';\nreturn __o;';
  return new Function('__v', '__esc', 'with (__v) {\n' + code + '\n}');
}
function danhGia(tenFile, bien) {
  const src = fs.readFileSync(path.join(GOC, tenFile + '.html'), 'utf8');
  const v = Object.assign({
    include_: ten => fs.readFileSync(path.join(GOC, ten + '.html'), 'utf8'),
    menuChung_: (trang, base, tab) => danhGia('Menu_Chung', { trang: String(trang || ''), base: String(base || ''), tab: String(tab || '') })
  }, bien || {});
  return bienDich(src)(v, esc);
}
module.exports = { danhGia, GOC };
