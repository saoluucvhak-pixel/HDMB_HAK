// Đo hiệu suất tra cứu / ghi / sửa trên bộ giả lập: số lượt đọc Sheet, số ô đọc, số lượt ghi, cho N hợp đồng.
// Chạy: SO_HD=1000 TZ=Asia/Ho_Chi_Minh node tests/do_hieu_suat.cjs [thư mục mã nguồn]   (AI_DOC=1: in hàm nào đọc > 500 ô)
// Không chạy trong npm test / CI — công cụ đo khi cần so sánh trước / sau.
const { taoMoiTruong } = require('./gasmock.cjs');
const vm = require('vm');
const J = JSON.stringify;
const THU_MUC = process.argv[2] || require('path').resolve(__dirname, '..');
const N = Number(process.env.SO_HD || 300);

const m = taoMoiTruong(THU_MUC); const run = c => vm.runInContext(c, m.ctx); const ss = m.ssChinh;
const td = (ten, n) => { const sh = ss.insertSheet(ten); sh.getRange(1, 1, 1, n).setValues([Array.from({ length: n }, (_, i) => ten + '_C' + (i + 1))]); return sh; };
const shNCC = td('HD_NCC', 33); td('HD_RUNG', 20); td('HD_STK', 10); td('HD_GPS', 10); td('HD_Picture', 13); td('DM_DIACHI', 8);
m.props.set('REPORT_SPREADSHEET_ID', 'REPORT');
// Đếm lượt GHI: bọc các hàm ghi của Range / Sheet
const demGhi = { n: 0 };
const RP = Object.getPrototypeOf(shNCC.getRange(1, 1)), SP = Object.getPrototypeOf(shNCC);
['setValue', 'setValues', 'setNumberFormat', 'setNumberFormats', 'clearContent'].forEach(k => { if (RP[k]) { const g = RP[k]; RP[k] = function () { demGhi.n++; return g.apply(this, arguments); }; } });
['appendRow', 'deleteRow', 'deleteRows', 'insertRowAfter', 'insertRows'].forEach(k => { if (SP[k]) { const g = SP[k]; SP[k] = function () { demGhi.n++; return g.apply(this, arguments); }; } });

// Ghi lại hàm .gs gọi mỗi lần đọc lớn (> 500 ô)
let docLon = {};
{ const g = RP.getValues; RP.getValues = function () { const o = this.nr * this.nc; if (o > 500 && process.env.AI_DOC) { const st = (new Error().stack || '').split('\n').slice(2).map(s => (s.match(/at ([\w$.]+) /) || [])[1]).filter(x => x && !/^(Range|Object|Array|Sheet|getValue|readData_|docDongTheoKhoa_)/.test(x)).slice(0, 2).join(' < '); const k = this.sh.name + ' ← ' + st; docLon[k] = (docLon[k] || 0) + o; } return g.apply(this, arguments); }; }
const t0 = Date.now();
const ds = [];
for (let i = 0; i < N; i++) {
  const k = run('TAO_HOP_DONG_MOI_(' + J({ tenChuRung: 'Khach Hang ' + i, cccdChuRung: '0490' + String(10000000 + i), ngayKy: '2026-0' + (1 + i % 9) + '-10', soTK: '11' + i, nganHang: 'VCB', soHD: 'S' + i, diaChiRung: 'Thon ' + i, dienTichKy: 10000, slDuKien: 120, donGia: 1000 }) + ')');
  const l = run('THEM_LO_RUNG_MOI_(' + J({ idHD: k.idHD, diaChiRung: 'Lo ' + i, dienTichM2: 3000, donGia: 2000, khoiLuongDuKien: 36 }) + ')');
  for (let g = 0; g < 3; g++) run('CAP_NHAT_GPS_RUNG_(' + J(l.idRung) + ', {lat: 15.' + g + '1' + i + ', lng: 108.1}, false)');
  ds.push({ idHD: k.idHD, idRung: l.idRung, cccd: '0490' + String(10000000 + i), ten: 'Khach Hang ' + i });
}
const X = ds[Math.floor(N / 2)];
const soDongX = () => run('timSoDongTheoGiaTri_(SHEET_NAME.HD_NCC, NCC_COL.ID_HD, ' + J(X.idHD) + ')');
const tk = () => run('layDanhSachTaiKhoan_(' + J(X.idHD) + ')')[0];

const kq = [];
const doMot = (nhom, ten, code) => {
  m.demDoc.n = 0; m.demDoc.o = 0; demGhi.n = 0; const t = Date.now();
  let loi = '';
  try { const r = run(code); if (r && r.thanhCong === false) loi = r.loi; } catch (e) { loi = e.message; }
  kq.push({ nhom, ten, doc: m.demDoc.n, o: m.demDoc.o, ghi: demGhi.n, ms: Date.now() - t, loi, theo: Object.assign({}, m.demDoc.theo || {}), docLon: docLon });
  m.demDoc.theo = {}; docLon = {};
};
// ---- TRA CỨU ----
doMot('Tra cứu', 'Tìm theo tên (Tra cứu HĐ)', 'TRA_CUU_HOP_DONG_(' + J(X.ten) + ', "", "")');
doMot('Tra cứu', 'Tìm theo CCCD', 'TRA_CUU_HOP_DONG_(' + J(X.cccd) + ', "", "")');
doMot('Tra cứu', 'Xem chi tiết 1 HĐ (Tra cứu)', 'CHI_TIET_TRA_CUU_HOP_DONG_(' + J(X.idHD) + ')');
doMot('Tra cứu', 'Danh sách khách hàng (Nhập liệu)', 'layDanhSachKhachHang_(1, 20, "")');
doMot('Tra cứu', 'HĐ của 1 khách hàng', 'layHopDongTheoKhachHang_(' + J(X.cccd) + ')');
doMot('Tra cứu', 'Mở 1 HĐ ở Nhập liệu', 'layHopDongTheoIdHD_(' + J(X.idHD) + ')');
doMot('Tra cứu', 'Thanh tiến độ 5 bước', 'TIEN_DO_HO_SO_HD_(' + J(X.idHD) + ')');
doMot('Tra cứu', 'Tab Lô rừng', 'layDanhSachRung_(' + J(X.idHD) + ')');
doMot('Tra cứu', 'Tab Số tài khoản', 'layDanhSachTaiKhoan_(' + J(X.idHD) + ')');
doMot('Tra cứu', 'Tab GPS của 1 lô', 'layGPSCuaRung_(' + J(X.idRung) + ')');
doMot('Tra cứu', 'Tab Ảnh của 1 lô', 'layDraftAnhChoRung_(' + J(X.idRung) + ',' + J(X.idHD) + ')');
doMot('Tra cứu', 'Tổng quan hợp đồng', 'LAY_TONG_QUAN_HOP_DONG_({})');
doMot('Tra cứu', 'Tổng quan (mở lại / đổi bộ lọc)', '_draftDataCache = null; LAY_TONG_QUAN_HOP_DONG_({ tinhTrangLoc: "Chờ thực hiện" })');
// ---- GHI ----
doMot('Ghi', 'Tạo hợp đồng mới', 'TAO_HOP_DONG_MOI_(' + J({ tenChuRung: 'Khach Moi', cccdChuRung: '049099999999', ngayKy: '2026-09-01', soTK: '999', nganHang: 'VCB', diaChiRung: 'Thon Moi', dienTichKy: 10000, slDuKien: 120, donGia: 1000 }) + ')');
doMot('Ghi', 'Thêm lô rừng', 'THEM_LO_RUNG_MOI_(' + J({ idHD: X.idHD, diaChiRung: 'Lo them', dienTichM2: 2000, donGia: 1800, khoiLuongDuKien: 24 }) + ')');
doMot('Ghi', 'Thêm tài khoản', 'THEM_TAI_KHOAN_MOI_(' + J({ idHD: X.idHD, soTK: '777', nganHang: 'BIDV' }) + ')');
doMot('Ghi', 'Thêm 1 điểm GPS', 'CAP_NHAT_GPS_RUNG_(' + J(X.idRung) + ', {lat: 15.9, lng: 108.9}, false)');
// ---- SỬA ----
doMot('Sửa', 'Sửa thông tin HĐ (SĐT)', 'CAP_NHAT_HOP_DONG_WEB_(' + soDongX() + ', {sdtChuRung: "0905123456"}, ' + J(X.idHD) + ')');
doMot('Sửa', 'Sửa lô rừng (đơn giá)', 'CAP_NHAT_LO_RUNG_(' + J(X.idRung) + ', {donGia: 2500})');
doMot('Sửa', 'Lưu lô không đổi gì', 'CAP_NHAT_LO_RUNG_(' + J(X.idRung) + ', {donGia: 2500})');
const t = tk();
doMot('Sửa', 'Sửa tài khoản', 'CAP_NHAT_TAI_KHOAN_(' + t.soDong + ', {nganHang: "ACB"}, ' + J(X.idHD) + ',' + J(String(t.soTK)) + ')');
doMot('Sửa', 'Duyệt trạng thái', 'CAP_NHAT_HOP_DONG_WEB_(' + soDongX() + ', {tinhTrang: "Đang thực hiện"}, ' + J(X.idHD) + ')');
doMot('Sửa', 'Sửa qua nháp: mở nháp', 'var __n = LAY_DRAFT_THEO_ID_HD_(' + J(X.idHD) + '); __n');
doMot('Sửa', 'Sửa qua nháp: lưu nháp', '__n.du.hopDong.sdtChuRung = "0911000000"; LUU_DRAFT_(__n.idDraft, JSON.stringify(__n.du))');
doMot('Sửa', 'Sửa qua nháp: lưu chính thức', 'LUU_CHINH_THUC_(__n.idDraft)');

console.log('Bộ dữ liệu: ' + N + ' HĐ, ' + N + ' x 2 lô, ' + (N * 4) + ' điểm GPS — dựng mất ' + ((Date.now() - t0) / 1000).toFixed(1) + ' s');
console.log(['Nhóm', 'Thao tác', 'Lượt đọc', 'Ô đọc', 'Lượt ghi', 'Lỗi'].join(' | '));
kq.forEach(r => console.log([r.nhom, r.ten, r.doc, r.o.toLocaleString('vi'), r.ghi, r.loi ? r.loi.slice(0, 60) : ''].join(' | ')));
if (process.env.CHI_TIET) kq.forEach(r => console.log(r.ten, J(r.theo)));
if (process.env.AI_DOC) kq.forEach(r => { console.log('## ' + r.ten); Object.keys(r.docLon).sort((a, b) => r.docLon[b] - r.docLon[a]).forEach(k => console.log('   ' + r.docLon[k] + '  ' + k)); });
