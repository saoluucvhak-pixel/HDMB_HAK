// Tiện ích chung cho test giao diện (Playwright + Chromium). Trang thử dựng từ mã .html thật của repo,
// google.script.run được giả lập ngay trong trang — không cần triển khai webapp.
const fs = require('fs'), os = require('os'), path = require('path');
const GOC = path.resolve(__dirname, '..');

function taiPlaywright_() {
  try { return require('playwright'); } catch (e) { /* thử bản cài toàn cục */ }
  const npmGoc = require('child_process').execSync('npm root -g').toString().trim();
  return require(path.join(npmGoc, 'playwright'));
}

async function moTrinhDuyet() {
  const { chromium } = taiPlaywright_();
  const duongDan = process.env.CHROMIUM_PATH; // tùy chọn: dùng Chromium có sẵn trên máy
  return duongDan ? chromium.launch({ executablePath: duongDan }) : chromium.launch();
}

function docMa(tenFile) { return fs.readFileSync(path.join(GOC, tenFile), 'utf8'); }

const THU_MUC_TAM = fs.mkdtempSync(path.join(os.tmpdir(), 'hak-ui-'));
function ghiTrangTam(ten, html) { const p = path.join(THU_MUC_TAM, ten); fs.writeFileSync(p, html); return 'file://' + p; }

function inKetQua(kq) {
  console.log(kq.map(x => (x[1] === true ? 'PASS ' : 'FAIL ') + x[0] + (x[1] === true ? '' : ' ' + x[1])).join('\n'));
}

/** Test bản đồ phục vụ leaflet NGOẠI TUYẾN từ tests/node_modules (mạng ngoài bị chặn trong test). Thiếu -> báo rõ và dừng NGAY
 *  (trước đây chờ 30 giây rồi báo timeout ở '#dsLo .lo', dễ hiểu nhầm là lỗi mã bản đồ). */
function canLeaflet() {
  try { require.resolve('leaflet/dist/leaflet.js'); return true; } catch (e) { /* thiếu */ }
  console.log('FAIL thiếu thư viện leaflet cho test bản đồ — chạy: cd tests && npm install   (package.json đã khai báo leaflet 1.9.4)');
  process.exit(1);
}

module.exports = { moTrinhDuyet, docMa, ghiTrangTam, inKetQua, canLeaflet, GOC };
