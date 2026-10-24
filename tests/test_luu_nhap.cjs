// Máy chủ (rà soát 24/10/2026): LUU_DRAFT_ không để bản nháp CŨ của cùng tab (lượt chậm về sau) ghi đè bản mới.
// Chạy: TZ=Asia/Ho_Chi_Minh node tests/test_luu_nhap.cjs [thư mục mã nguồn]
const { taoMoiTruong } = require('./gasmock.cjs');
const vm = require('vm');
const path = require('path');
const THU_MUC = process.argv[2] || path.resolve(__dirname, '..');
const J = JSON.stringify;
let dat = 0, truot = 0; const ketQua = [];
function kiem(ten, dk, chiTiet) { if (dk) { dat++; ketQua.push('PASS ' + ten); } else { truot++; ketQua.push('FAIL ' + ten + (chiTiet ? ' — ' + chiTiet : '')); } }

const m = taoMoiTruong(THU_MUC);
const run = code => vm.runInContext(code, m.ctx);
const nhap = run('TAO_DRAFT_MOI_()');
const luu = (ten, luuNhap) => run('LUU_DRAFT_(' + J(nhap.idDraft) + ',' + J(J({ idHD: null, hopDong: { tenChuRung: ten }, rung: [], taiKhoan: [], phuLuc: [], _luuNhap: luuNhap })) + ')');
const tenDangLuu = () => {
  const sh = m.ssChinh.getSheetByName('Draft_HopDong');
  const dong = sh.getDataRange().getValues().find(r => r[0] === nhap.idDraft);
  return JSON.parse(dong[2]).hopDong.tenChuRung;
};

luu('Ban 2', { tab: 'T1', seq: 2 });
const kq = luu('Ban 1 ve muon', { tab: 'T1', seq: 1 });
kiem('L1 cùng tab, lượt CŨ (seq 1) về sau lượt mới (seq 2): không ghi đè', tenDangLuu() === 'Ban 2', tenDangLuu());
kiem('L1 lượt cũ vẫn trả thanhCong (trình duyệt không báo lỗi giả)', kq && kq.thanhCong === true, J(kq));
luu('Ban 3', { tab: 'T1', seq: 3 });
kiem('L2 cùng tab, lượt mới hơn: ghi bình thường', tenDangLuu() === 'Ban 3', tenDangLuu());
luu('Tab khac', { tab: 'T2', seq: 1 });
kiem('L3 tab khác (số riêng): bản đến sau thắng như trước', tenDangLuu() === 'Tab khac', tenDangLuu());
luu('Trinh duyet cu', undefined);
kiem('L4 trình duyệt chưa cập nhật (không gửi số): ghi như trước', tenDangLuu() === 'Trinh duyet cu', tenDangLuu());
const khoa = m.lockInfo().dangGiu;
kiem('L5 khóa được nhả sau mỗi lượt lưu', khoa === 0, J(khoa));

console.log(ketQua.join('\n'));
console.log('\n' + dat + ' đạt, ' + truot + ' trượt');
process.exit(truot ? 1 : 0);
