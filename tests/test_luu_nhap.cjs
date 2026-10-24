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

// ---- Nhiều tab: tab A lưu bản 5, tab B lưu bản 1, rồi bản 4 của tab A về MUỘN ----
luu('A seq5', { tab: 'TA', seq: 5 });
const kqB = luu('B seq1', { tab: 'TB', seq: 1 });
kiem('L6 tab khác vừa sửa (trong 10 phút) -> máy chủ báo canhBaoTabKhac + người sửa', kqB && kqB.canhBaoTabKhac === true && /@/.test(kqB.nguoiSuaKhac || ''), J(kqB));
luu('A seq4 ve muon', { tab: 'TA', seq: 4 });
kiem('L6 bản CŨ của tab A về muộn sau khi tab B đã lưu: không ghi đè', tenDangLuu() === 'B seq1', tenDangLuu());
luu('A seq6', { tab: 'TA', seq: 6 });
kiem('L6 bản mới hơn của tab A: ghi bình thường', tenDangLuu() === 'A seq6', tenDangLuu());
const kqA = luu('A seq7', { tab: 'TA', seq: 7 });
kiem('L7 cùng tab lưu tiếp: không báo tab khác', kqA && !kqA.canhBaoTabKhac, J(kqA));
try {
  const kqHong = run('LUU_DRAFT_(' + J(nhap.idDraft) + ',' + J('{hong') + ')');
  let ten12 = '(nháp hỏng)'; try { ten12 = tenDangLuu(); } catch (e) { /* JSON hỏng đã bị ghi */ }
  kiem('L12 LUU_DRAFT nhận JSON hỏng: báo lỗi, KHÔNG ghi đè bản nháp đang tốt', kqHong && kqHong.thanhCong === false && ten12 === 'A seq7', J(kqHong) + ' ' + ten12);
} catch (e) { kiem('L12 LUU_DRAFT nhận JSON hỏng', false, e.message); }

// ---- Lưu chính thức nhận KÈM bản nháp mới nhất ----
try {
  const t = taoMoiTruong(THU_MUC); const r = code => vm.runInContext(code, t.ctx);
  const td = (ten, n) => { const sh = t.ssChinh.insertSheet(ten); sh.getRange(1, 1, 1, n).setValues([Array.from({ length: n }, (_, i) => ten + '_C' + (i + 1))]); };
  td('HD_NCC', 33); td('HD_RUNG', 20); td('HD_STK', 10); td('HD_GPS', 10); td('HD_Picture', 13); td('DM_DIACHI', 8);
  t.props.set('REPORT_SPREADSHEET_ID', 'REPORT');
  const A = r('TAO_HOP_DONG_MOI_(' + J({ tenChuRung: 'Nguyen A', cccdChuRung: '049000000001', ngayKy: '2026-05-10', soTK: '0011', nganHang: 'VCB', soHD: 'A1', diaChiRung: 'Thôn A', dienTichKy: 10000, slDuKien: 120, donGia: 1000 }) + ')');
  const sdt = () => { const sh = t.ssChinh.getSheetByName('HD_NCC'); const d = sh.getDataRange().getValues().find(x => x[r('NCC_COL.ID_HD')] === A.idHD); return String(d[r('NCC_COL.SDT_CHU_RUNG')]); };
  let nhap = r('LAY_DRAFT_THEO_ID_HD_(' + J(A.idHD) + ')');
  const du = JSON.parse(J(nhap.du)); du.hopDong.sdtChuRung = '0905111222'; du._luuNhap = { tab: 'T9', seq: 3 };
  const k1 = r('LUU_CHINH_THUC_(' + J(nhap.idDraft) + ',' + J(J(du)) + ')');
  kiem('L8 Lưu chính thức kèm bản mới nhất (chưa từng LUU_DRAFT): ghi đúng SĐT gõ cuối, giữ số 0 đầu', k1 && k1.thanhCong && sdt() === '0905111222', J(k1) + ' sdt=' + sdt());
  nhap = r('LAY_DRAFT_THEO_ID_HD_(' + J(A.idHD) + ')');
  const moi = JSON.parse(J(nhap.du)); moi.hopDong.sdtChuRung = '0905333444'; moi._luuNhap = { tab: 'T9', seq: 10 };
  r('LUU_DRAFT_(' + J(nhap.idDraft) + ',' + J(J(moi)) + ')');
  const cu = JSON.parse(J(nhap.du)); cu.hopDong.sdtChuRung = '0905999999'; cu._luuNhap = { tab: 'T9', seq: 9 };
  const k2 = r('LUU_CHINH_THUC_(' + J(nhap.idDraft) + ',' + J(J(cu)) + ')');
  kiem('L9 bản kèm theo CŨ hơn bản đã lưu (cùng tab): lưu chính thức từ bản đã lưu, không lùi dữ liệu', k2 && k2.thanhCong && sdt() === '0905333444', J(k2) + ' sdt=' + sdt());
  nhap = r('LAY_DRAFT_THEO_ID_HD_(' + J(A.idHD) + ')');
  const k3 = r('LUU_CHINH_THUC_(' + J(nhap.idDraft) + ',' + J('{hong') + ')');
  kiem('L10 bản kèm theo hỏng (JSON lạ): không lưu chính thức, báo lỗi', k3 && k3.thanhCong === false, J(k3));
  const k4 = r('LUU_CHINH_THUC_(' + J(nhap.idDraft) + ')');
  kiem('L11 trình duyệt cũ (không gửi kèm): lưu chính thức từ bản nháp như trước', k4 && k4.thanhCong === true, J(k4));
} catch (e) { kiem('L8-L11 Lưu chính thức kèm bản mới nhất', false, e.message.slice(0, 150)); }

console.log(ketQua.join('\n'));
console.log('\n' + dat + ' đạt, ' + truot + ' trượt');
process.exit(truot ? 1 : 0);
