// Chạy toàn bộ kiểm thử: cú pháp -> máy chủ (giả lập GAS) -> giao diện (Playwright, bỏ qua nếu thiếu và KHONG_BAT_BUOC_UI=1).
// Chạy: npm test   hoặc   node tests/chay_tat_ca.cjs
const { spawnSync } = require('child_process');
const path = require('path');
const env = Object.assign({}, process.env, { TZ: 'Asia/Ho_Chi_Minh' });
const buoc = [
  ['Cú pháp', 'kiem_tra_cu_phap.cjs'],
  ['Máy chủ (giả lập Apps Script)', 'test_may_chu.cjs'],
  ['Giao diện: khóa nút khi đang gửi (A1)', 'ui_khoa_nut.cjs', true],
  ['Giao diện: hộp thoại + nhớ bộ lọc (A3/A4)', 'ui_hop_thoai_bo_loc.cjs', true],
  ['Giao diện: chế độ tối + hỗ trợ truy cập (A5)', 'ui_giao_dien.cjs', true]
];
let hong = 0;
buoc.forEach(function (b) {
  console.log('\n===== ' + b[0] + ' =====');
  const kq = spawnSync(process.execPath, [path.join(__dirname, b[1])], { stdio: 'inherit', env: env });
  if (kq.status !== 0) {
    if (b[2] && env.KHONG_BAT_BUOC_UI === '1') console.log('(bỏ qua lỗi giao diện vì KHONG_BAT_BUOC_UI=1)');
    else hong++;
  }
});
console.log('\n' + (hong ? '❌ ' + hong + ' nhóm kiểm thử thất bại' : '✅ Tất cả kiểm thử đạt'));
process.exit(hong ? 1 : 0);
