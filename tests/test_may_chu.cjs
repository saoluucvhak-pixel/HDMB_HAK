// Test hồi quy phía máy chủ (.gs) trên bộ giả lập gasmock.cjs — các lỗi đã sửa trong rà soát 28/09/2026
// (C-01..C-03, H-01..H-12, M-01..M-18, P-01..P-11, B2). Không cần tài khoản Google.
// Chạy: TZ=Asia/Ho_Chi_Minh node tests/test_may_chu.cjs [thư mục mã nguồn — mặc định thư mục gốc repo]
const { taoMoiTruong } = require('./gasmock.cjs');
const vm = require('vm');
const path = require('path');
const THU_MUC = process.argv[2] || path.resolve(__dirname, '..');
let dat = 0, truot = 0; const ketQua = [];
function kiem(ten, dk, chiTiet) { if (dk) { dat++; ketQua.push('PASS ' + ten); } else { truot++; ketQua.push('FAIL ' + ten + (chiTiet ? ' — ' + chiTiet : '')); } }

function moi() {
  const m = taoMoiTruong(THU_MUC);
  const run = (code) => vm.runInContext(code, m.ctx);
  const ss = m.ssChinh;
  const tieuDe = (ten, n) => { const sh = ss.insertSheet(ten); sh.getRange(1, 1, 1, n).setValues([Array.from({ length: n }, (_, i) => ten + '_C' + (i + 1))]); return sh; };
  tieuDe('HD_NCC', 33); tieuDe('HD_RUNG', 20); tieuDe('HD_STK', 10); tieuDe('HD_GPS', 10); tieuDe('HD_Picture', 13); tieuDe('DM_DIACHI', 8);
  m.props.set('REPORT_SPREADSHEET_ID', 'REPORT');
  const tao = (ten, cccd, soTK, soHD, ngay) => run('TAO_HOP_DONG_MOI_(' + JSON.stringify({ tenChuRung: ten, cccdChuRung: cccd, ngayKy: ngay || '2026-05-10', soTK: soTK, nganHang: 'VCB', soHD: soHD || '', diaChiRung: 'Thôn A', dienTichKy: 10000, slDuKien: 120, donGia: 1000 }) + ')');
  const stk = () => ss.getSheetByName('HD_STK').getDataRange().getValues().slice(1);
  // Bổ sung đủ hồ sơ (37_KiemTraDuHoSo.gs) để được chuyển "Đang thực hiện": MST + địa chỉ chủ rừng, hồ sơ pháp lý + GPS (kèm ảnh) từng lô
  const duHoSo = (idHD) => run('(function (id) { CAP_NHAT_HOP_DONG_(timSoDongTheoGiaTri_(SHEET_NAME.HD_NCC, NCC_COL.ID_HD, id), ' +
    '{ maSoThue: "8000000001", diaChiThuongTru: "Quế Phước" }, id);' +
    'layDanhSachRung_(id).forEach(function (lo) { CAP_NHAT_LO_RUNG_(lo.idRung, { diaChiRung: lo.diaChiRung || "Thôn A", dienTichM2: lo.dienTichM2 || 10000, donGia: lo.donGia || 1000,' +
    ' khoiLuongDuKien: lo.khoiLuongDuKien || 120, hoSoNguonGoc: "Giấy chứng nhận QSDĐ", soGiayTo: "CS 01", dinhKemGiayTo: "https://drive.google.com/file/d/HS1/view" });' +
    ' CAP_NHAT_GPS_RUNG_(lo.idRung, { lat: 15.5, lng: 108.1, anhUrl: "https://drive.google.com/file/d/ANH1/view" }, false); }); })(' + JSON.stringify(idHD) + ')');
  return { m, run, ss, tao, stk, duHoSo };
}
const J = JSON.stringify;

function chay(f) { try { f(); } catch (e) { truot++; ketQua.push('LỖI ' + String(e.message).slice(0, 120)); } }
try {
  // ---------- C-01: xóa 2 TK trong 1 lần lưu + dòng đã dịch ----------
  chay(function () {
    const t = moi();
    const A = t.tao('Nguyen A', '049000000001', '1111', 'A1');
    t.tao('Tran B', '049000000002', '2222', 'B1');
    t.run('THEM_TAI_KHOAN_MOI_(' + J({ idHD: A.idHD, soTK: '1112', nganHang: 'VCB' }) + ')');
    t.tao('Le C', '049000000003', '3333', 'C1');
    // HD_STK: 1111(A) 2222(B) 1112(A) 3333(C)
    const nhap = t.run('LAY_DRAFT_THEO_ID_HD_(' + J(A.idHD) + ')');
    nhap.du.taiKhoan.forEach(x => { x.xoa = true; });
    t.run('LUU_DRAFT_(' + J(nhap.idDraft) + ',' + J(J(nhap.du)) + ')');
    const kq = t.run('LUU_CHINH_THUC_(' + J(nhap.idDraft) + ')');
    const conLai = t.stk().map(r => String(r[5])).sort();
    kiem('C-01a xóa 2 TK của A không đụng TK của B/C', J(conLai) === J(['2222', '3333']), 'còn ' + J(conLai) + ' kq=' + J(kq));
  });

  chay(function () {
    const t = moi();
    t.tao('Pham X', '049000000009', '9999', 'X1'); // dòng sẽ bị xóa -> dịch
    const A = t.tao('Nguyen A', '049000000001', '1111', 'A1');
    t.tao('Tran B', '049000000002', '2222', 'B1');
    const nhap = t.run('LAY_DRAFT_THEO_ID_HD_(' + J(A.idHD) + ')');
    nhap.du.taiKhoan[0].soTK = '1111-MOI';
    t.run('LUU_DRAFT_(' + J(nhap.idDraft) + ',' + J(J(nhap.du)) + ')');
    // Người khác xóa TK của X (phía trên) -> số dòng trong nháp của A đã cũ
    const soDongX = t.stk().findIndex(r => String(r[5]) === '9999') + 2;
    const idX = t.stk()[soDongX - 2][0];
    t.run('XOA_TAI_KHOAN_(' + soDongX + ',' + J(idX) + ',"9999")');
    const kq = t.run('LUU_CHINH_THUC_(' + J(nhap.idDraft) + ')');
    const tk = t.stk().map(r => r[0] + ':' + r[5]);
    kiem('C-01b sửa TK sau khi dòng dịch: sửa đúng TK của A, TK của B nguyên vẹn',
      tk.indexOf(A.idHD + ':1111-MOI') !== -1 && tk.some(x => /:2222$/.test(x)), J(tk) + ' ' + J(kq));
  });

  chay(function () {
    const t = moi();
    const A = t.tao('Nguyen A', '049000000001', '1111', 'A1');
    const B = t.tao('Tran B', '049000000002', '2222', 'B1');
    const kq = t.run('XOA_TAI_KHOAN_(2,' + J(B.idHD) + ',"2222")'); // dòng 2 là TK của A
    kiem('C-01c XOA_TAI_KHOAN_ dòng lệch -> tìm đúng TK của B theo Số TK gốc, TK của A còn', kq.thanhCong === true && J(t.stk().map(r => String(r[5]))) === J(['1111']), J(kq) + J(t.stk().map(r => r[5])));
    const kqKhongPhu = t.run('XOA_TAI_KHOAN_(2,' + J(B.idHD) + ')');
    kiem('C-01e XOA_TAI_KHOAN_ không có Số TK gốc + dòng không thuộc HĐ -> từ chối', kqKhongPhu.thanhCong === false && t.stk().length === 1, J(kqKhongPhu));
    const kq2 = t.run('CAP_NHAT_TAI_KHOAN_(2, {soTK:"x"}, "KHONG_CO", "1111")');
    kiem('C-01d CAP_NHAT_TAI_KHOAN_ sai ID_HD -> từ chối, không ghi', kq2.thanhCong === false && String(t.stk()[0][5]) === '1111', J(kq2));
  });

  // ---------- C-02: sửa theo dòng cũ ----------
  chay(function () {
    const t = moi();
    const X = t.tao('Pham X', '049000000009', '9999', 'X1');
    const A = t.tao('Nguyen A', '049000000001', '1111', 'A1');
    const B = t.tao('Tran B', '049000000002', '2222', 'B1');
    const soDongA = 3; // HD_NCC: X(2) A(3) B(4)
    t.run('XOA_VINH_VIEN_HOP_DONG_(' + J(X.idHD) + ', true)'); // A lên dòng 2, B lên dòng 3
    const kq = t.run('CAP_NHAT_HOP_DONG_WEB_(' + soDongA + ', {diaChiThuongTru:"Địa chỉ mới"}, ' + J(A.idHD) + ')');
    const ncc = t.ss.getSheetByName('HD_NCC').getDataRange().getValues().slice(1);
    const dongA = ncc.find(r => r[29] === A.idHD), dongB = ncc.find(r => r[29] === B.idHD);
    kiem('C-02a sửa với số dòng cũ -> ghi đúng HĐ A, HĐ B không đổi', dongA[5] === 'Địa chỉ mới' && dongB[5] !== 'Địa chỉ mới', J(kq));
    const kq2 = t.run('CAP_NHAT_HOP_DONG_(2, {tenChuRung:"X"})');
    kiem('C-02b CAP_NHAT_HOP_DONG_ thiếu ID_HD -> từ chối', kq2.thanhCong === false);
  });

  // ---------- C-03: Số HĐ trùng, ID_RUNG trùng, lan truyền ----------
  chay(function () {
    const t = moi();
    const A = t.tao('Nguyen A', '049000000001', '1111', '293', '2025-01-01');
    const B = t.tao('Tran B', '049000000002', '2222', '293', '2026-01-01');
    kiem('C-03a tạo HĐ trùng Số HĐ -> từ chối', B.thanhCong === false, J(B));
    // dữ liệu cũ đã trùng số: chép tay 1 hợp đồng 293 khác ngày rồi thêm lô
    const shN = t.ss.getSheetByName('HD_NCC');
    const r = shN.getRange(2, 1, 1, 33).getValues()[0]; r[29] = '293-20260101'; r[3] = new Date('2026-01-01T00:00:00+07:00');
    shN.appendRow(r);
    const lo = t.run('THEM_LO_RUNG_MOI_(' + J({ idHD: '293-20260101', soHD: '293', cccd: '049000000001' }) + ')');
    const idsRung = t.ss.getSheetByName('HD_RUNG').getDataRange().getValues().slice(1).map(x => x[2]);
    kiem('C-03b lô mới của HĐ trùng số không trùng ID_RUNG', lo.idRung !== 'HAK293_1' && new Set(idsRung).size === idsRung.length, lo.idRung + ' ' + J(idsRung));
    const shR = t.ss.getSheetByName('HD_RUNG');
    const cccdLo = shR.getDataRange().getValues().slice(1).map(x => x[6]);
    kiem('M-06 CCCD của lô rừng mới giữ số 0 đầu (chuỗi)', cccdLo.every(v => typeof v === 'string' && v.charAt(0) === '0'), J(cccdLo));
    // Đổi số HĐ -> lan xuống HD_RUNG/HD_STK
    const kqDoi = t.run('CAP_NHAT_HOP_DONG_WEB_(2, {soHD:"294"}, ' + J(A.idHD) + ')');
    const rungA = shR.getDataRange().getValues().slice(1).filter(x => x[0] === A.idHD).map(x => String(x[3]));
    const stkA = t.stk().filter(x => x[0] === A.idHD).map(x => String(x[8]));
    kiem('C-03c đổi Số HĐ lan xuống HD_RUNG + HD_STK', kqDoi.thanhCong && rungA.every(v => v === '294') && stkA.every(v => v === '294'), J(rungA) + J(stkA) + J(kqDoi));
    const kqTrung = t.run('CAP_NHAT_HOP_DONG_WEB_(2, {soHD:"293"}, ' + J(A.idHD) + ')');
    kiem('C-03d đổi Số HĐ sang số đã có -> từ chối', kqTrung.thanhCong === false, J(kqTrung));
  });

  // ---------- H-01: trạng thái + Draft + nhật ký ----------
  chay(function () {
    const t = moi();
    const A = t.tao('Nguyen A', '049000000001', '1111', 'A1');
    t.duHoSo(A.idHD);
    const kq = t.run('CAP_NHAT_HOP_DONG_WEB_(2, {tinhTrang:"Đang thực hiện"}, ' + J(A.idHD) + ')');
    const draft = t.run('_draftDataCache = null; docToanBoDraftBaoCao_()').find(x => x.idHD === A.idHD);
    const nk = t.ss.getSheetByName('NhatKy_SuaDoi').getDataRange().getValues().map(r => r[2]);
    kiem('H-01a Duyệt ở trang 27 cập nhật Draft báo cáo', kq.thanhCong && draft && draft.tinhTrang === 'Đang thực hiện', J(kq) + ' draft=' + (draft && draft.tinhTrang));
    kiem('H-01b Duyệt ghi nhật ký', nk.indexOf('Đổi tình trạng hợp đồng') !== -1, J(nk));
    const kq2 = t.run('CAP_NHAT_HOP_DONG_WEB_(2, {tinhTrang:"Đã thanh lý"}, ' + J(A.idHD) + ')');
    kiem('H-01c bước chuyển không hợp lệ (Đang thực hiện -> Đã thanh lý) bị từ chối', kq2.thanhCong === false, J(kq2));
    const kq3 = t.run('HUY_HOP_DONG_(' + J(A.idHD) + ')');
    kiem('M-01 hủy HĐ "Đang thực hiện" vẫn được', kq3.thanhCong === true, J(kq3));
    const kq4 = t.run('HUY_HOP_DONG_(' + J(A.idHD) + ')');
    kiem('M-01 hủy lại HĐ đã hủy -> từ chối', kq4.thanhCong === false, J(kq4));
  });

  // ---------- H-03: duyệt ảnh 2 lần ----------
  chay(function () {
    const t = moi();
    const A = t.tao('Nguyen A', '049000000001', '1111', 'A1');
    const idRung = t.ss.getSheetByName('HD_RUNG').getRange(2, 3).getValue();
    const shD = t.run('getOrCreateDraftAnhSheet_()');
    shD.appendRow(['D1', A.idHD, idRung, 'a.jpg', 'F1', 'https://drive.google.com/file/d/F1/view', 15.5, 108.2, '', '', 'Chờ duyệt', new Date()]);
    const k1 = t.run('DUYET_ANH_RUNG_(2, "D1")');
    const k2 = t.run('DUYET_ANH_RUNG_(2, "D1")');
    const soAnh = t.ss.getSheetByName('HD_Picture').getDataRange().getValues().slice(1).reduce((s, r) => s + r.slice(3).filter(Boolean).length, 0);
    const soGps = t.ss.getSheetByName('HD_GPS').getDataRange().getValues().slice(1).filter(r => r[2] !== '').length;
    kiem('H-03a Duyệt 2 lần chỉ ghi 1 ảnh + 1 điểm GPS', k1.thanhCong && !k2.thanhCong && soAnh === 1 && soGps === 1, J([k1, k2, soAnh, soGps]));
    const k3 = t.run('TU_CHOI_ANH_RUNG_(2, "D1")');
    kiem('H-03b Từ chối ảnh đã duyệt -> không được', k3.thanhCong === false, J(k3));
  });

  // ---------- H-05: dòng Draft trùng ----------
  chay(function () {
    const t = moi();
    const A = t.tao('Nguyen A', '049000000001', '1111', 'A1');
    const sh = t.m.ssBaoCao.getSheetByName('Draft_BaoCaoHopDong');
    const dong = sh.getRange(2, 1, 1, 31).getValues()[0]; sh.appendRow(dong); // giả lập append trùng
    const tongTruoc = t.run('_draftDataCache = null; docToanBoDraftBaoCao_()').filter(x => x.idHD === A.idHD).length;
    t.run('CAP_NHAT_DRAFT_MOT_HOP_DONG_(' + J(A.idHD) + ')');
    const soDong = sh.getDataRange().getValues().slice(1).filter(r => r[0] === A.idHD).length;
    kiem('H-05 đọc Draft bỏ dòng trùng + cập nhật tự dọn', tongTruoc === 1 && soDong === 1, tongTruoc + '/' + soDong);
  });

  // ---------- Luồng tạo -> nháp -> sửa -> lưu vẫn hoạt động ----------
  chay(function () {
    const t = moi();
    const nhapMoi = t.run('TAO_DRAFT_MOI_()');
    const du = { idHD: null, hopDong: { tenChuRung: 'Moi', cccdChuRung: '049000000077', ngayKy: '2026-05-10', soHD: '' }, rung: [{ tempId: 't1', diaChiRung: 'X', dienTichM2: 5000, donGia: 1000, khoiLuongDuKien: 60 }], taiKhoan: [{ tempId: 'k1', soTK: '0123', nganHang: 'VCB' }], phuLuc: [{ tempId: 'p1', donGia: 10, khoiLuong: 2 }] };
    t.run('LUU_DRAFT_(' + J(nhapMoi.idDraft) + ',' + J(J(du)) + ')');
    const kq = t.run('LUU_CHINH_THUC_(' + J(nhapMoi.idDraft) + ')');
    const nhap2 = t.run('LAY_DRAFT_THEO_ID_HD_(' + J(kq.idHD) + ')');
    nhap2.du.phuLuc[0].donGia = 20; nhap2.du.taiKhoan[0].nganHang = 'ACB';
    t.run('LUU_DRAFT_(' + J(nhap2.idDraft) + ',' + J(J(nhap2.du)) + ')');
    const kq2 = t.run('LUU_CHINH_THUC_(' + J(nhap2.idDraft) + ')');
    const pl = t.ss.getSheetByName('PhuLucHopDong').getDataRange().getValues().slice(1);
    const tk = t.stk().filter(r => r[0] === kq.idHD);
    kiem('Luồng đầy đủ: tạo mới + sửa phụ lục/TK qua nháp', kq.thanhCong && kq2.thanhCong && !kq2.canhBao && pl.length === 1 && pl[0][4] === 20 && tk.length === 1 && tk[0][6] === 'ACB' && tk[0][5] === '0123', J([kq2, pl, tk]));
    kiem('Không lồng ScriptLock', t.m.lockInfo().max <= 1, J(t.m.lockInfo()));
  });
  // ---------- H-02: nháp cũ không ghi đè thay đổi của người khác ----------
  chay(function () {
    const t = moi();
    const A = t.tao('Nguyen A', '049000000001', '1111', 'A1');
    const nhap = t.run('LAY_DRAFT_THEO_ID_HD_(' + J(A.idHD) + ')');
    // người khác sửa địa chỉ trên trang 27 trong lúc nháp đang mở
    t.run('CAP_NHAT_HOP_DONG_WEB_(2, {diaChiThuongTru:"ĐC người khác"}, ' + J(A.idHD) + ')');
    nhap.du.hopDong.sdtChuRung = '0905000000'; // người mở nháp chỉ sửa SĐT
    t.run('LUU_DRAFT_(' + J(nhap.idDraft) + ',' + J(J(nhap.du)) + ')');
    const kq = t.run('LUU_CHINH_THUC_(' + J(nhap.idDraft) + ')');
    const r = t.ss.getSheetByName('HD_NCC').getRange(2, 1, 1, 33).getValues()[0];
    kiem('H-02a lưu nháp cũ không ghi đè địa chỉ người khác vừa sửa', r[5] === 'ĐC người khác' && r[9] === '0905000000', J([r[5], r[9], kq]));
    const nhap2 = t.run('LAY_DRAFT_THEO_ID_HD_(' + J(A.idHD) + ')');
    t.run('CAP_NHAT_HOP_DONG_WEB_(2, {noiCap:"CA Quảng Nam"}, ' + J(A.idHD) + ')');
    nhap2.du.hopDong.noiCap = 'CA Đà Nẵng';
    t.run('LUU_DRAFT_(' + J(nhap2.idDraft) + ',' + J(J(nhap2.du)) + ')');
    const kq2 = t.run('LUU_CHINH_THUC_(' + J(nhap2.idDraft) + ')');
    kiem('H-02b cùng sửa 1 trường -> giữ giá trị người lưu + có cảnh báo', t.ss.getSheetByName('HD_NCC').getRange(2, 9).getValue() === 'CA Đà Nẵng' && kq2.canhBao && /noiCap/.test(kq2.canhBao.join(' ')), J(kq2));
  });

  // ---------- H-11 ----------
  chay(function () {
    const t = moi();
    t.m.props.set('REPORT_SPREADSHEET_ID', 'MAT_QUYEN');
    t.m.ctx.SpreadsheetApp.openByUrl = function () { throw new Error('Service error tạm thời'); };
    let loi = null; try { t.run('_reportSSCache = null; getReportSS_()'); } catch (e) { loi = e.message; }
    kiem('H-11 file báo cáo đã cấu hình không mở được -> báo lỗi, không tạo file mới/ghi đè ID', !!loi && t.m.props.get('REPORT_SPREADSHEET_ID') === 'MAT_QUYEN', loi);
  });

  // ---------- M-07: xóa vĩnh viễn dọn đủ bảng phụ ----------
  chay(function () {
    const t = moi();
    const A = t.tao('Nguyen A', '049000000001', '1111', 'A1');
    const B = t.tao('Tran B', '049000000002', '2222', 'B1');
    t.run('LUU_PHU_LUC_(' + J({ idHD: A.idHD, soHD: 'A1', donGia: 1, khoiLuong: 1 }) + ')');
    t.run('LAY_DRAFT_THEO_ID_HD_(' + J(A.idHD) + ')');
    const kq = t.run('XOA_VINH_VIEN_HOP_DONG_(' + J(A.idHD) + ', true)');
    const conA = ['HD_NCC', 'HD_RUNG', 'HD_STK', 'PhuLucHopDong', 'ct_hopdong', 'Draft_HopDong', 'HD_GPS'].filter(function (ten) {
      const sh = t.ss.getSheetByName(ten); if (!sh) return false;
      return sh.getDataRange().getValues().slice(1).some(r => r.some(v => String(v).indexOf(A.idHD) !== -1 || String(v) === 'HAKA1_1'));
    });
    const conB = t.ss.getSheetByName('HD_NCC').getDataRange().getValues().slice(1).some(r => r[29] === B.idHD);
    kiem('M-07 xóa vĩnh viễn không để lại dữ liệu mồ côi, HĐ khác còn nguyên', kq.thanhCong && !conA.length && conB, J(conA) + J(kq));
  });

  // ---------- M-05: báo cáo kiểm tra hồ sơ ----------
  chay(function () {
    const t = moi();
    t.tao('Nguyen A', '049000000001', '1111', 'A1');
    t.run('KIEM_TRA_HO_SO_TOAN_BO_()');
    t.tao('Nguyen A', '049000000001', '1112', 'A2'); // cùng chủ rừng -> cùng Mã Rừng HAK0490..._1
    t.run('KIEM_TRA_HO_SO_TOAN_BO_()');
    t.run('KIEM_TRA_HO_SO_TOAN_BO_()'); // chạy lại không nhân dòng
    const bc = t.ss.getSheetByName('BaoCao_KiemTra').getDataRange().getValues().slice(1).filter(r => r[0] !== '');
    kiem('M-05 2 hợp đồng cùng Mã Rừng đều có dòng riêng, chạy lại không trùng', bc.length === 2 && new Set(bc.map(r => r[0])).size === 2, J(bc.map(r => r[0] + '|' + r[2])));
  });

  // ---------- H-12: số lượt đọc khi lưu ----------
  chay(function () {
    const t = moi();
    const nhapMoi = t.run('TAO_DRAFT_MOI_()');
    const du = { idHD: null, hopDong: { tenChuRung: 'Moi', cccdChuRung: '049000000077', ngayKy: '2026-05-10' },
      rung: [1, 2, 3].map(i => ({ tempId: 't' + i, diaChiRung: 'X' + i, dienTichM2: 5000, donGia: 1000, khoiLuongDuKien: 60, gpsMoi: [{ lat: 15.1, lng: 108.1 + i / 100 }, { lat: 15.2, lng: 108.2 }] })),
      taiKhoan: [{ tempId: 'k1', soTK: '0123', nganHang: 'VCB' }, { tempId: 'k2', soTK: '0456', nganHang: 'ACB' }], phuLuc: [] };
    t.run('LUU_DRAFT_(' + J(nhapMoi.idDraft) + ',' + J(J(du)) + ')');
    t.m.demDoc.n = 0;
    const kq = t.run('LUU_CHINH_THUC_(' + J(nhapMoi.idDraft) + ')');
    const draft = t.m.ssBaoCao.getSheetByName('Draft_BaoCaoHopDong').getDataRange().getValues().slice(1).filter(r => r[0] === kq.idHD);
    console.error('[H-12] số lệnh getValues khi Lưu chính thức (3 lô, 6 GPS, 2 TK): ' + t.m.demDoc.n);
    kiem('H-12 Lưu chính thức: Draft vẫn đúng (1 dòng, 3 lô, 2 TK)', kq.thanhCong && draft.length === 1 && draft[0][22] === 3 && draft[0][23] === 2, J(draft.map(r => [r[22], r[23]])));
    ketQua.push('INFO H-12 getValues = ' + t.m.demDoc.n);
  });

  // ---------- M-09: sửa tay nhiều dòng ----------
  chay(function () {
    const t = moi();
    const A = t.tao('Nguyen A', '049000000001', '1111', 'A1');
    const B = t.tao('Tran B', '049000000002', '2222', 'B1');
    const sh = t.ss.getSheetByName('HD_NCC');
    sh.getRange(2, 31).setValue('Đang thực hiện'); sh.getRange(3, 31).setValue('Đã hủy');
    t.run('xuLyOnEditDraft_')({ range: sh.getRange(2, 1, 2, 33) });
    const d = t.run('_draftDataCache = null; docToanBoDraftBaoCao_()');
    kiem('M-09 dán/sửa nhiều dòng trên HD_NCC cập nhật Draft cho mọi hợp đồng', d.find(x => x.idHD === A.idHD).tinhTrang === 'Đang thực hiện' && d.find(x => x.idHD === B.idHD).tinhTrang === 'Đã hủy');
  });
  // ---------- M-18: chặn công thức ----------
  chay(function () {
    const t = moi();
    const kq = t.run('TAO_HOP_DONG_MOI_(' + J({ tenChuRung: '=HYPERLINK("x")', cccdChuRung: '049000000001', ngayKy: '2026-05-10', diaChiThuongTru: '+ Thôn A', soTK: '1111', nganHang: 'VCB', diaChiRung: '@rung' }) + ')');
    const tatCa = ['HD_NCC', 'HD_RUNG', 'HD_STK', 'DM_DIACHI', 'NhatKy_SuaDoi'].map(function (n) { const sh = t.ss.getSheetByName(n); return sh ? sh.getDataRange().getValues() : []; });
    const coCongThuc = JSON.stringify(tatCa).indexOf('#CONG_THUC#') !== -1;
    const r = t.ss.getSheetByName('HD_NCC').getRange(2, 1, 1, 33).getValues()[0];
    kiem('M-18 tên/địa chỉ bắt đầu = + @ được lưu nguyên văn, không thành công thức', kq.thanhCong && !coCongThuc && r[4] === '=HYPERLINK("x")' && r[5] === '+ Thôn A', JSON.stringify(tatCa).match(/#CONG_THUC#[^"]*/g));
  });

  // ---------- M-15: DM_DIACHI ----------
  chay(function () {
    const t = moi();
    const A = t.tao('Nguyen A', '049000000001', '1111', 'A1');
    const sh = t.ss.getSheetByName('DM_DIACHI');
    sh.appendRow(sh.getRange(2, 1, 1, 8).getValues()[0]); // dòng trùng do ghi song song trước đây
    t.run('dongBoDiaChiTuRung_(' + J(A.idHD) + ', {diaChiRung:"Rừng mới"})');
    const dong = sh.getDataRange().getValues().slice(1).filter(r => r[0] === A.idHD);
    kiem('M-15 DM_DIACHI cập nhật đúng 1 dòng, gộp dòng trùng', dong.length === 1 && dong[0][6] === 'Rừng mới' && dong[0][3] === 'Nguyen A', J(dong));
  });

  // ---------- M-10: xây lại Draft ----------
  chay(function () {
    const t = moi();
    const A = t.tao('Nguyen A', '049000000001', '1111', 'A1');
    const B = t.tao('Tran B', '049000000002', '2222', 'B1');
    const sh = t.m.ssBaoCao.getSheetByName('Draft_BaoCaoHopDong');
    sh.appendRow(['HD_DA_XOA', 'x']); // dòng rác
    const kq = t.run('XAY_DUNG_LAI_TOAN_BO_DRAFT_()');
    const ids = sh.getDataRange().getValues().slice(1).map(r => r[0]).filter(Boolean).sort();
    kiem('M-10 xây lại Draft: đúng tập hợp đồng, bỏ dòng rác, xóa sheet tạm', /OK/.test(kq) && J(ids) === J([A.idHD, B.idHD].sort()) && !t.m.ssBaoCao.getSheetByName('Draft_BaoCaoHopDong_TAM'), kq + J(ids));
  });

  // ---------- L-01 ----------
  chay(function () {
    const t = moi();
    kiem('L-01 include() không còn là hàm công khai; include_ có sẵn cho template', typeof t.m.ctx.include === 'undefined' && typeof t.m.ctx.include_ === 'function');
  });
  // ---------- Đợt 1 (H-12 còn lại) ----------
  chay(function () {
    const t = moi();
    const A = t.tao('Nguyen A', '049000000001', '1111', 'A1');
    const idRung = t.ss.getSheetByName('HD_RUNG').getRange(2, 3).getValue();
    t.run('THEM_LO_RUNG_MOI_(' + J({ idHD: A.idHD, dienTichM2: 3000, donGia: 2000, khoiLuongDuKien: 36 }) + ')');
    t.run('CAP_NHAT_GPS_RUNG_(' + J(idRung) + ', {lat:"15.5", lng:"108.1"}, false)');
    t.run('CAP_NHAT_GPS_RUNG_(' + J(idRung) + ', {lat:"15.7", lng:"108.3"}, false)');
    const hsr = t.m.ssBaoCao.getSheetByName('Draft_HoSoRung').getDataRange().getValues().slice(1).filter(r => r[1] === A.idHD);
    const lo1 = hsr.find(r => r[0] === idRung);
    kiem('P-10 cache Hồ sơ rừng: đủ 2 lô, tọa độ TB + số điểm đúng', hsr.length === 2 && lo1 && Math.abs(lo1[13] - 15.6) < 1e-9 && lo1[15] === 2, J(hsr.map(r => [r[0], r[13], r[15]])));
    t.run('XOA_LO_RUNG_(' + J(idRung) + ')');
    const hsr2 = t.m.ssBaoCao.getSheetByName('Draft_HoSoRung').getDataRange().getValues().slice(1).filter(r => r[1] === A.idHD);
    kiem('P-10 xóa lô -> cache Hồ sơ rừng bỏ lô đó', hsr2.length === 1 && hsr2[0][0] !== idRung, J(hsr2.map(r => r[0])));
    t.duHoSo(A.idHD);
    const kqDoi = t.run('CAP_NHAT_HOP_DONG_WEB_(2, {tinhTrang:"Đang thực hiện"}, ' + J(A.idHD) + ')');
    const hsr3 = t.m.ssBaoCao.getSheetByName('Draft_HoSoRung').getDataRange().getValues().slice(1).filter(r => r[1] === A.idHD);
    kiem('P-10 đổi tình trạng HĐ -> cache Hồ sơ rừng cập nhật tình trạng', kqDoi.thanhCong && hsr3.every(r => r[5] === 'Đang thực hiện'), J(hsr3.map(r => r[5])));
  });
  chay(function () {
    const t = moi();
    const A = t.tao('Nguyen A', '049000000001', '1111', 'A1');
    const r = t.run('TAI_TRANG_BAO_CAO_TONG_HOP_({}, {}, 1, 1, false)');
    kiem('P-07a báo cáo không còn trả danh sách chi tiết "Tình hình thực hiện", số đếm vẫn đúng', r.tinhHinhThucHien && !r.tinhHinhThucHien.chiTiet && r.tinhHinhThucHien.tongSoHopDong === 1, J(Object.keys(r.tinhHinhThucHien || {})));
  });
  // ---------- Đợt 2 ----------
  chay(function () {
    const t = moi();
    const A = t.tao('Nguyen A', '049000000001', '1111', 'A1');
    const B = t.tao('Tran B', '049000000002', '2222', 'B1');
    t.duHoSo(A.idHD); t.duHoSo(B.idHD);
    const kq = t.run('DOI_TINH_TRANG_HANG_LOAT_([{soDong:2,idHD:' + J(A.idHD) + '},{soDong:3,idHD:' + J(B.idHD) + '},{soDong:9,idHD:"KHONG_CO"}], "Đang thực hiện")');
    const d = t.run('_draftDataCache = null; docToanBoDraftBaoCao_()');
    kiem('A2 duyệt hàng loạt 1 lệnh: 2 thành công, 1 lỗi có lý do, Draft cập nhật', kq.soXong === 2 && kq.loi.length === 1 && d.every(x => x.tinhTrang === 'Đang thực hiện'), J(kq));
  });
  chay(function () {
    const t = moi();
    for (let i = 0; i < 25; i++) t.tao('KH ' + i, String(49000000100 + i).padStart(12, '0'), '9' + i, 'S' + String(i).padStart(2, '0'));
    const p1 = t.run('layTongHopChoWebapp_(false, {}, 1, 20)');
    const p2 = t.run('layTongHopChoWebapp_(false, {}, 2, 20)');
    const loc = t.run('layTongHopChoWebapp_(false, {soHD:"S1"}, 1, 20)');
    kiem('P-07b Tổng hợp chia trang ở máy chủ: KPI trên toàn bộ, trang 1=20, trang 2=5, lọc đúng', p1.soHopDong === 25 && p1.chiTiet.length === 20 && p2.chiTiet.length === 5 && p1.tongTrang === 2 && loc.tongSo === 10 && loc.soHopDong === 25, J([p1.soHopDong, p1.chiTiet.length, p2.chiTiet.length, loc.tongSo]));
    const g = t.run('TAI_TRANG_BAO_CAO_TONG_HOP_({}, {}, 1, 1, false, {}, 1)');
    kiem('P-07b trang Báo cáo tải lần đầu chỉ nhận 1 trang Tổng hợp', g.tongHopWebapp.chiTiet.length === 20 && g.tongHopWebapp.tongSo === 25);
  });
  chay(function () {
    const t = moi();
    t.tao('Nguyen A', '049000000001', '1111', 'A1'); t.tao('Tran B', '049000000002', '2222', 'B1');
    let bat = null;
    t.run('_taoFileTuBang_ = function (ten, h, r, d) { return { thanhCong: true, ten: ten, header: h, rows: r, dinhDang: d }; }');
    const kq = t.run('XUAT_BAO_CAO_FILE_("baoCaoHD", {soHD:"A1"}, "xlsx")');
    const kq2 = t.run('XUAT_BAO_CAO_FILE_("hoSoRung", {}, "pdf")');
    const kq3 = t.run('XUAT_BAO_CAO_FILE_("khac", {}, "xlsx")');
    kiem('P-07b xuất file do máy chủ dựng: lọc đúng, đủ 18 cột, ngày theo mẫu', kq.rows.length === 1 && kq.rows[0][0] === 'A1' && kq.header.length === 18 && kq.rows[0].length === 18 && /^\d{2}\/\d{2}\/\d{4}$/.test(kq.rows[0][1]), J(kq.rows));
    kiem('P-07b xuất Hồ sơ rừng + chặn loại lạ', kq2.rows.length === 2 && kq2.dinhDang === 'pdf' && kq3.thanhCong === false, J([kq2.rows.length, kq3]));
    kiem('P-07b XUAT_BANG_RA_FILE (nhận bảng từ trình duyệt) không còn gọi được qua api', !t.run('_bangQuyenApi_()').hasOwnProperty('XUAT_BANG_RA_FILE') && t.run('_bangQuyenApi_()').hasOwnProperty('XUAT_BAO_CAO_FILE'));
  });
  chay(function () {
    const t = moi();
    for (let i = 0; i < 12; i++) t.tao('KH ' + i, String(49000000200 + i).padStart(12, '0'), '8' + i, 'C' + i);
    t.duHoSo(t.ss.getSheetByName('HD_NCC').getRange(2, 30).getValue());
    t.run('CAP_NHAT_HOP_DONG_WEB_(2, {tinhTrang:"Đang thực hiện"}, ' + J(t.ss.getSheetByName('HD_NCC').getRange(2, 30).getValue()) + ')');
    const ng = t.run('timNguCanhChatbot_("Có bao nhiêu hợp đồng đang thực hiện chưa có ảnh?", [])');
    const tk = ng.thongKeTongHop;
    kiem('P-08 chatbot: thống kê tính sẵn đúng, danh sách lọc sẵn theo câu hỏi, không gửi CCCD',
      tk && tk.tongSoHopDong === 12 && tk.theoTinhTrang['Đang thực hiện'].soHopDong === 1 && tk.theoTinhTrang['Chờ thực hiện'].soHopDong === 11 &&
      ng.toanBoHopDong.length === 1 && ng.toanBoHopDong.every(x => !('cccdChuRung' in x)) && /tình trạng Đang thực hiện/.test(ng.ghiChuDanhSach) && /chưa có ảnh/.test(ng.ghiChuDanhSach),
      J({ tk: tk && tk.theoTinhTrang, n: ng.toanBoHopDong && ng.toanBoHopDong.length, g: ng.ghiChuDanhSach }));
    const ng2 = t.run('timNguCanhChatbot_("liệt kê hợp đồng chưa thanh lý", [])');
    kiem('P-08 "chưa thanh lý" không bị lọc nhầm thành "đã thanh lý"', ng2.toanBoHopDong.length === 12, J(ng2.ghiChuDanhSach));
  });
  // ---------- B2: nhật ký chi tiết cũ -> mới + lưu trữ xóa + khôi phục ----------
  chay(function () {
    const t = moi();
    const A = t.tao('Nguyen A', '049000000001', '1111', 'A1');
    const B = t.tao('Tran B', '049000000002', '2222', 'B1');
    t.run('LUU_PHU_LUC_(' + J({ idHD: A.idHD, soHD: 'A1', donGia: 1, khoiLuong: 1 }) + ')');
    t.run('CAP_NHAT_HOP_DONG_WEB_(2, {diaChiThuongTru:"Địa chỉ mới", soHD:"A1-MOI"}, ' + J(A.idHD) + ')');
    const nk = t.run('LAY_NHAT_KY_CHI_TIET_(' + J(A.idHD) + ')');
    kiem('B2 nhật ký chi tiết: ghi đủ từng trường cũ -> mới', nk.some(r => r.truong === 'soHD' && r.cu === 'A1' && r.moi === 'A1-MOI') && nk.some(r => r.truong === 'diaChiThuongTru' && r.moi === 'Địa chỉ mới'), J(nk));
    const truoc = {};
    ['HD_NCC', 'HD_RUNG', 'HD_STK', 'PhuLucHopDong', 'DM_DIACHI'].forEach(ten => { truoc[ten] = J(t.ss.getSheetByName(ten).getDataRange().getValues().slice(1).filter(r => r.some(v => String(v).indexOf(A.idHD) !== -1)).map(r => r.slice(0, 20).map(v => v instanceof Date ? v.toISOString() : v))); });
    t.run('XOA_VINH_VIEN_HOP_DONG_(' + J(A.idHD) + ', true)');
    const ds = t.run('LAY_DS_LUU_TRU_XOA_(10)');
    kiem('B2 xóa vĩnh viễn -> 1 đợt lưu trữ đủ các sheet', ds.length === 1 && ds[0].idHD === A.idHD && ds[0].theoSheet.HD_NCC === 1 && ds[0].theoSheet.HD_RUNG === 1 && ds[0].theoSheet.HD_STK === 1 && ds[0].theoSheet.PhuLucHopDong === 1, J(ds));
    const kq = t.run('KHOI_PHUC_DU_LIEU_DA_XOA_(' + J(ds[0].maDot) + ')');
    const sau = {};
    ['HD_NCC', 'HD_RUNG', 'HD_STK', 'PhuLucHopDong', 'DM_DIACHI'].forEach(ten => { sau[ten] = J(t.ss.getSheetByName(ten).getDataRange().getValues().slice(1).filter(r => r.some(v => String(v).indexOf(A.idHD) !== -1)).map(r => r.slice(0, 20).map(v => v instanceof Date ? v.toISOString() : v))); });
    const lech = Object.keys(truoc).filter(k => truoc[k] !== sau[k]);
    kiem('B2 khôi phục đợt xóa -> dữ liệu về y như trước (kể cả CCCD số 0 đầu, ngày)', kq.thanhCong && !lech.length, J(kq) + ' lệch: ' + lech.map(k => k + '\n' + truoc[k] + '\n' + sau[k]).join('\n'));
    const draft = t.m.ssBaoCao.getSheetByName('Draft_BaoCaoHopDong').getDataRange().getValues().slice(1).some(r => r.indexOf(A.idHD) !== -1);
    kiem('B2 khôi phục -> Draft báo cáo có lại hợp đồng', draft);
    const kq2 = t.run('KHOI_PHUC_DU_LIEU_DA_XOA_(' + J(ds[0].maDot) + ')');
    kiem('B2 khôi phục lần 2 bị từ chối (không nhân bản)', kq2.thanhCong === false && t.ss.getSheetByName('HD_NCC').getDataRange().getValues().slice(1).filter(r => r[29] === A.idHD).length === 1, J(kq2));
    const nccB = t.ss.getSheetByName('HD_NCC').getDataRange().getValues().slice(1).filter(r => r[29] === B.idHD).length;
    kiem('B2 HĐ khác không bị ảnh hưởng', nccB === 1);
  });
  chay(function () {
    const t = moi();
    const A = t.tao('Nguyen A', '049000000001', '1111', 'A1');
    t.run('THEM_TAI_KHOAN_MOI_(' + J({ idHD: A.idHD, soTK: '0123', nganHang: 'VCB' }) + ')');
    t.run('XOA_TAI_KHOAN_(3,' + J(A.idHD) + ',"0123")');
    const idRung = t.ss.getSheetByName('HD_RUNG').getRange(2, 3).getValue();
    t.run('CAP_NHAT_GPS_RUNG_(' + J(idRung) + ', {lat:"15.5", lng:"108.1"}, false)');
    t.run('CAP_NHAT_LO_RUNG_(' + J(idRung) + ', {donGia: 5000})');
    const nk = t.run('LAY_NHAT_KY_CHI_TIET_(' + J(A.idHD) + ')');
    kiem('B2 sửa lô rừng ghi cũ -> mới', nk.some(r => r.hanhDong === 'Sửa lô rừng' && r.truong === 'donGia' && r.cu === '1000' && r.moi === '5000'), J(nk));
    t.run('XOA_LO_RUNG_(' + J(idRung) + ')');
    const ds = t.run('LAY_DS_LUU_TRU_XOA_(10)');
    kiem('B2 xóa TK + xóa lô (kèm GPS) -> 2 đợt riêng', ds.length === 2 && ds[0].theoSheet.HD_RUNG === 1 && ds[0].theoSheet.HD_GPS >= 1 && ds[1].theoSheet.HD_STK === 1, J(ds));
    const kqTK = t.run('KHOI_PHUC_DU_LIEU_DA_XOA_(' + J(ds[1].maDot) + ')');
    kiem('B2 khôi phục TK giữ số 0 đầu', kqTK.thanhCong && t.stk().some(r => r[5] === '0123'), J(t.stk().map(r => r[5])));
    const kqLo = t.run('KHOI_PHUC_DU_LIEU_DA_XOA_(' + J(ds[0].maDot) + ')');
    const coLo = t.ss.getSheetByName('HD_RUNG').getDataRange().getValues().slice(1).some(r => r[2] === idRung);
    const coGps = t.ss.getSheetByName('HD_GPS').getDataRange().getValues().slice(1).some(r => r.indexOf(idRung) !== -1);
    kiem('B2 khôi phục lô rừng + GPS', kqLo.thanhCong && coLo && coGps, J(kqLo));
    // Lô bị xóa rồi được tạo lại cùng ID -> khôi phục bỏ qua, không trùng
    t.run('XOA_LO_RUNG_(' + J(idRung) + ')');
    const ds2 = t.run('LAY_DS_LUU_TRU_XOA_(10)');
    t.ss.getSheetByName('HD_RUNG').appendRow(['x', A.idHD, idRung]);
    const kq3 = t.run('KHOI_PHUC_DU_LIEU_DA_XOA_(' + J(ds2[0].maDot) + ')');
    const soLo = t.ss.getSheetByName('HD_RUNG').getDataRange().getValues().slice(1).filter(r => r[2] === idRung).length;
    kiem('B2 khóa đã tồn tại lại -> bỏ qua dòng đó', soLo === 1 && kq3.boQua.some(x => x.indexOf(idRung) !== -1), J(kq3));
    kiem('B2 API khôi phục chỉ dành cho Quản trị', t.run('_bangQuyenApi_()').KHOI_PHUC_DU_LIEU_DA_XOA !== undefined);
  });

  // ================= Đợt 5 (28/09/2026): SL dự kiến từ lô rừng, chống tạo trùng, ngày 00:00, link ảnh QR =================
  const N = { Z: 25, T: 19, AA: 26, ID: 29, TT: 30, NGAY: 3, CCCD: 6 }; // cột HD_NCC (0-based) app Thanh toán đọc
  const dongNcc = (t, idHD) => t.ss.getSheetByName('HD_NCC').getDataRange().getValues().find(r => r[N.ID] === idHD);
  const ctHD = (t, idHD) => (t.ss.getSheetByName('ct_hopdong') ? t.ss.getSheetByName('ct_hopdong').getDataRange().getValues() : []).find(r => r[0] === idHD);
  const loCua = (t, idHD) => t.ss.getSheetByName('HD_RUNG').getDataRange().getValues().slice(1).filter(r => r[0] === idHD).map(r => r[2]);
  const taoQuaNhap = (t, hd, rung) => {
    const nhap = t.run('TAO_DRAFT_MOI_()');
    const du = { idHD: null, hopDong: hd, rung: rung.map((l, i) => Object.assign({ tempId: 'tr' + i, gpsMoi: [] }, l)), taiKhoan: [], phuLuc: [] };
    t.run('LUU_DRAFT_(' + J(nhap.idDraft) + ',' + J(J(du)) + ')');
    return t.run('LUU_CHINH_THUC_(' + J(nhap.idDraft) + ')');
  };
  const datTinhTrang = (t, idHD, tt, z) => { const sh = t.ss.getSheetByName('HD_NCC'); const i = sh.getDataRange().getValues().findIndex(r => r[N.ID] === idHD) + 1; sh.getRange(i, N.TT + 1).setValue(tt); if (z !== undefined) sh.getRange(i, N.Z + 1).setValue(z); };

  chay(function () {
    const t = moi();
    const kq = taoQuaNhap(t, { tenChuRung: 'Ong Binh', cccdChuRung: '049065014631', ngayKy: '2026-09-28', soHD: '' },
      [{ diaChiRung: 'Lo A', dienTichM2: 25000, donGia: 1600000, khoiLuongDuKien: 300 }, { diaChiRung: 'Lo B', dienTichM2: 16666.5, donGia: 1500000, khoiLuongDuKien: 200 }]);
    const r = dongNcc(t, kq.idHD), ct = ctHD(t, kq.idHD);
    kiem('SL-01 tạo HĐ qua nháp, 2 lô 300 + 200 tấn -> HD_NCC Z = 500, T = 41666.5, AA = 1550000 (số)', r[N.Z] === 500 && r[N.T] === 41666.5 && r[N.AA] === 1550000, J([r[N.Z], r[N.T], r[N.AA]]));
    kiem('SL-01 ct_hopdong cùng số với HD_NCC', ct && ct[4] === 500 && ct[2] === 41666.5 && ct[3] === 1550000, J(ct));
    kiem('SL-01 CCCD giữ số 0 đầu, HĐ mới "Chờ thực hiện" + nhắc Duyệt', r[N.CCCD] === '049065014631' && r[N.TT] === 'Chờ thực hiện' && /Duyệt/.test(kq.nhacDuyet || ''), J([r[N.CCCD], r[N.TT], kq.nhacDuyet]));
    const h = t.run('Utilities.formatDate(' + 'new Date(' + J(r[N.NGAY]) + '), "Asia/Ho_Chi_Minh", "yyyy-MM-dd HH:mm")');
    kiem('BUG-12 ngày ký lưu 00:00 giờ VN (không phải 07:00)', h === '2026-09-28 00:00', h);

    const [lo1, lo2] = loCua(t, kq.idHD);
    t.run('CAP_NHAT_LO_RUNG_(' + J(lo1) + ', {khoiLuongDuKien: 350})');
    t.run('THEM_LO_RUNG_MOI_(' + J({ idHD: kq.idHD, diaChiRung: 'Lo C', dienTichM2: 8000, donGia: 1700000, khoiLuongDuKien: 100 }) + ')');
    t.run('XOA_LO_RUNG_(' + J(lo2) + ')');
    const r2 = dongNcc(t, kq.idHD);
    kiem('SL-02 "Chờ thực hiện": sửa 300->350, thêm 100, xóa 200 -> Z = 450', r2[N.Z] === 450 && ctHD(t, kq.idHD)[4] === 450, J([r2[N.Z], ctHD(t, kq.idHD)]));
    const lo3 = loCua(t, kq.idHD).find(x => x !== lo1);
    kiem('SL-02 lô mới lấy ngày ký + CCCD của hợp đồng', J(t.ss.getSheetByName('HD_RUNG').getDataRange().getValues().find(x => x[2] === lo3).slice(1, 2)).indexOf('049065014631') !== -1, lo3);
    const ctx = t.run('layChiTietHopDong_(' + J(kq.idHD) + ')');
    kiem('CT-01 Chi tiết hợp đồng (trang Thêm/Sửa) = số mới sau khi lưu lô', ctx.tongHop.tongKhoiLuong === 450 && ctx.hdNcc.slDuKien === 450 && ctx.tongHop.soLo === 2, J(ctx));

    datTinhTrang(t, kq.idHD, 'Đang thực hiện', 480);
    t.run('THEM_LO_RUNG_MOI_(' + J({ idHD: kq.idHD, diaChiRung: 'Lo D', dienTichM2: 5000, donGia: 1600000, khoiLuongDuKien: 60 }) + ')');
    kiem('SL-03a "Đang thực hiện" Z = 480 -> thêm lô, Z giữ 480 (ct_hopdong vẫn 510)', dongNcc(t, kq.idHD)[N.Z] === 480 && ctHD(t, kq.idHD)[4] === 510, J([dongNcc(t, kq.idHD)[N.Z], ctHD(t, kq.idHD)[4]]));
  });

  chay(function () {
    const t = moi();
    const kq = taoQuaNhap(t, { tenChuRung: 'Tran Hoa', cccdChuRung: '049065014632', ngayKy: '2026-09-28', soHD: '' }, []);
    datTinhTrang(t, kq.idHD, 'Đang thực hiện', 0);
    t.run('THEM_LO_RUNG_MOI_(' + J({ idHD: kq.idHD, diaChiRung: 'Lo E', dienTichM2: 20000, donGia: 1600000, khoiLuongDuKien: 240 }) + ')');
    const r = dongNcc(t, kq.idHD);
    kiem('SL-03b "Đang thực hiện" Z = 0 -> thêm lô 240, Z/T/AA được điền', r[N.Z] === 240 && r[N.T] === 20000 && r[N.AA] === 1600000, J([r[N.Z], r[N.T], r[N.AA]]));
    // Sửa tay HD_RUNG trên Sheet (bẫy onEdit)
    datTinhTrang(t, kq.idHD, 'Chờ thực hiện');
    const sh = t.ss.getSheetByName('HD_RUNG'); const d = sh.getDataRange().getValues().findIndex(x => x[0] === kq.idHD) + 1;
    sh.getRange(d, 12).setValue(300);
    t.run('xuLyOnEditDraft_({ range: getSheet_(SHEET_NAME.HD_RUNG).getRange(' + d + ', 12) })');
    kiem('SL-06 sửa tay KL lô trên Sheet (onEdit) -> Z cập nhật', dongNcc(t, kq.idHD)[N.Z] === 300, dongNcc(t, kq.idHD)[N.Z]);
  });

  chay(function () {
    const t = moi();
    const A = t.tao('Ong Binh cu', '049000000011', '1111', 'BINH1');   // TAO_HOP_DONG_MOI_ tạo sẵn 1 lô 120 tấn
    const B = t.tao('Z trong', '049000000012', '2222', 'ZT1');
    const C = t.tao('Du so', '049000000013', '3333', 'DS1');
    const sh = t.ss.getSheetByName('HD_NCC');
    const dong = id => sh.getDataRange().getValues().findIndex(r => r[N.ID] === id) + 1;
    [N.Z, N.T, N.AA].forEach(c => sh.getRange(dong(A.idHD), c + 1).setValue(0)); // dữ liệu cũ: Z/T/AA = 0
    sh.getRange(dong(B.idHD), N.Z + 1).setValue('');
    datTinhTrang(t, A.idHD, 'Đang thực hiện');
    sh.appendRow(Array.from({ length: 31 }, (_, i) => i === N.ID ? 'KHONGLO-1' : (i === N.Z ? 0 : ''))); // HĐ không có lô
    const xem = t.run('XEM_TRUOC_DIEN_SL_TU_LO_RUNG_()');
    const ids = xem.ds.map(x => x.idHD).sort();
    kiem('SL-04a xem trước liệt kê đúng HĐ Z/T/AA = 0 hoặc trống (không có HĐ đủ số / không lô), chưa ghi gì', J(ids) === J([A.idHD, B.idHD].sort()) && sh.getRange(dong(A.idHD), N.Z + 1).getValue() === 0, J(xem));
    const ghi = t.run('AP_DUNG_DIEN_SL_TU_LO_RUNG_(' + J(ids) + ')');
    const rA = dongNcc(t, A.idHD);
    kiem('SL-04b ghi: HĐ ông Bình (Đang thực hiện) Z = 120, T = 10000, AA = 1000', ghi.soDaSua === 2 && rA[N.Z] === 120 && rA[N.T] === 10000 && rA[N.AA] === 1000, J([ghi, rA[N.Z], rA[N.T], rA[N.AA]]));
    kiem('SL-04c chạy lại lần 2 không còn gì, HĐ đủ số giữ nguyên', t.run('XEM_TRUOC_DIEN_SL_TU_LO_RUNG_()').soHopDong === 0 && t.run('AP_DUNG_DIEN_SL_TU_LO_RUNG_(' + J(ids) + ')').soDaSua === 0 && dongNcc(t, C.idHD)[N.Z] === 120);
    kiem('SL-04d API bảo trì chỉ Quản trị', t.run('_bangQuyenApi_().AP_DUNG_DIEN_SL_TU_LO_RUNG.quyen === QUYEN.QUAN_TRI'));
  });

  chay(function () {
    const t = moi();
    const hd = { tenChuRung: 'Truong Qua', cccdChuRung: '049065014631', ngayKy: '2026-09-16', soTK: '0123', nganHang: 'VCB', maThaoTac: 'HDtest12345' };
    const k1 = t.run('TAO_HOP_DONG_MOI_(' + J(hd) + ')'), k2 = t.run('TAO_HOP_DONG_MOI_(' + J(hd) + ')');
    const soHD = () => t.ss.getSheetByName('HD_NCC').getDataRange().getValues().slice(1).filter(r => r[N.ID]).length;
    kiem('DUP-01 bấm Lưu 2 lần cùng 1 form -> 1 hợp đồng, lần 2 trả lại HĐ cũ', soHD() === 1 && k2.daTaoTruocDo === true && k2.idHD === k1.idHD, J([k1.idHD, k2]));
    t.run('TAO_HOP_DONG_MOI_(' + J(Object.assign({}, hd, { maThaoTac: 'HDkhac67890' })) + ')');
    kiem('DUP-01 mở form mới -> tạo được HĐ thứ 2 (hợp lệ)', soHD() === 2);
  });

  chay(function () {
    const t = moi();
    const nhap = t.run('TAO_DRAFT_MOI_()');
    const du = { idHD: null, hopDong: { tenChuRung: 'Le Nam', cccdChuRung: '049065014633', ngayKy: '2026-09-16', soHD: '' }, rung: [{ tempId: 'r1', diaChiRung: 'Lo F', dienTichM2: 10000, donGia: 1500000, khoiLuongDuKien: 120, gpsMoi: [] }], taiKhoan: [{ tempId: 'k1', soTK: '0999', nganHang: 'ACB' }], phuLuc: [] };
    t.run('LUU_DRAFT_(' + J(nhap.idDraft) + ',' + J(J(du)) + ')');
    t.run('var __goc = THEM_TAI_KHOAN_MOI_; THEM_TAI_KHOAN_MOI_ = function () { THEM_TAI_KHOAN_MOI_ = __goc; throw new Error("Exceeded maximum execution time"); }');
    let loi1 = '';
    try { t.run('LUU_CHINH_THUC_(' + J(nhap.idDraft) + ')'); } catch (e) { loi1 = e.message; }
    t.run('LUU_DRAFT_(' + J(nhap.idDraft) + ',' + J(J(du)) + ')'); // trình duyệt tự lưu nháp đè bản cũ trong bộ nhớ
    const kq = t.run('LUU_CHINH_THUC_(' + J(nhap.idDraft) + ')');
    const soHD = t.ss.getSheetByName('HD_NCC').getDataRange().getValues().slice(1).filter(r => r[N.ID]).length;
    const soLo = t.ss.getSheetByName('HD_RUNG').getDataRange().getValues().slice(1).filter(r => r[0]).length;
    const soTK = t.stk().filter(r => r[5] === '0999').length;
    kiem('DUP-02 lưu chính thức lỗi giữa chừng rồi lưu lại -> 1 HĐ, 1 lô, 1 TK', /Exceeded/.test(loi1) && kq.thanhCong && soHD === 1 && soLo === 1 && soTK === 1, J([loi1, kq, soHD, soLo, soTK]));
    const soHDGhi = dongNcc(t, kq.idHD)[2];
    kiem('DUP-02 lưu lại không xóa Số HĐ tự sinh', !!soHDGhi && String(soHDGhi) === String(kq.soHD), J([soHDGhi, kq.soHD]));
  });

  chay(function () {
    const t = moi();
    const A = t.tao('Anh QR', '049000000021', '1111', 'QR1');
    const B = t.tao('Khac', '049000000022', '2222', 'QR2');
    const idAnh = 'A'.repeat(25), idHoSo = 'H'.repeat(25), idKhac = 'K'.repeat(25);
    const url = id => 'https://drive.google.com/file/d/' + id + '/view';
    t.ss.getSheetByName('HD_Picture').appendRow([A.idHD, 'P1', 'Anh QR', url(idAnh)]);
    t.ss.getSheetByName('HD_Picture').appendRow([B.idHD, 'P2', 'Khac', url(idKhac)]);
    const shR = t.ss.getSheetByName('HD_RUNG'); const d = shR.getDataRange().getValues().findIndex(r => r[0] === A.idHD) + 1;
    shR.getRange(d, t.run('RUNG_COL.DINH_KEM_GIAY_TO') + 1).setValue(url(idHoSo));
    const link = t.run('linkAnhCongKhai_(' + J(A.idHD) + ')');
    const k = new URL(link).searchParams.get('k');
    kiem('QR-01 link ảnh có chữ ký; sai chữ ký / dùng cho HĐ khác -> từ chối',
      t.run('_hopLeAnhCongKhai_(' + J(A.idHD) + ',' + J(k) + ')') && !t.run('_hopLeAnhCongKhai_(' + J(A.idHD) + ',"sai")') && !t.run('_hopLeAnhCongKhai_(' + J(B.idHD) + ',' + J(k) + ')'), link);
    const ds = t.run('_danhSachAnhCongKhai_(' + J(A.idHD) + ')');
    const chuoi = J(ds);
    kiem('QR-02 trang công khai chỉ có ảnh hiện trường, không hồ sơ pháp lý / CCCD / ảnh HĐ khác', chuoi.indexOf(idAnh) !== -1 && chuoi.indexOf(idHoSo) === -1 && chuoi.indexOf(idKhac) === -1 && chuoi.indexOf('049000000021') === -1, chuoi);
    const anh = t.run('ANH_CONG_KHAI(' + J(A.idHD) + ',' + J(k) + ',' + J([idAnh, idHoSo, idKhac]) + ', false)');
    kiem('QR-03 ANH_CONG_KHAI chỉ trả ảnh công khai của đúng HĐ', J(Object.keys(anh.anh)) === J([idAnh]), J(anh));
    let loiGoc = ''; try { t.run('ANH_CONG_KHAI(' + J(A.idHD) + ',' + J(k) + ',' + J([idHoSo]) + ', true)'); } catch (e) { loiGoc = e.message; }
    kiem('QR-03 tải bản gốc hồ sơ pháp lý qua link công khai -> chặn', /không thuộc/.test(loiGoc), loiGoc);
  });

  chay(function () {
    // NHUNG-01: chuyển trang trong khung dùng CÙNG template/biến như doGet; trang lạ -> Tổng quan; ph sai bị bỏ
    const t = moi();
    t.run(`HtmlService.createTemplateFromFile = function (f) { var tm = { evaluate: function () { var o = { getContent: function () { return 'FILE=' + f + '|TRANG=' + tm.currentPage + '|PHIEN=' + tm.phien + '|BASE=' + tm.baseUrl; } };
      o.setTitle = function () { return o; }; o.addMetaTag = function () { return o; }; o.setXFrameOptionsMode = function () { return o; }; return o; } }; return tm; };
      HtmlService.XFrameOptionsMode = { ALLOWALL: 1 };`);
    const a = t.run('trangTrongKhung({ page: "tracuu" })');
    const b = t.run('trangTrongKhung({ page: "constructor", ph: "sai" })');
    const c = t.run('trangTrongKhung({ page: "meconn" })');
    const g = t.run('doGet({ parameter: { page: "tracuu" } }).getContent()');
    kiem('NHUNG-01 trangTrongKhung trả đúng trang + tiêu đề như doGet',
      a.html === g && /FILE=33_Page_TraCuuHopDong\|TRANG=tracuu\|PHIEN=\|BASE=https:/.test(a.html) && /Tra cứu/.test(a.tieuDe) &&
      /FILE=30_Page_TongQuanHopDong\|TRANG=tongquan\|PHIEN=\|/.test(b.html) && /TRANG=hopdongmc/.test(c.html), J([a, b, c, g]));
  });
  // ---------- Giao diện mới đợt 2: dữ liệu Tổng quan + tiến độ hồ sơ 5 bước ----------
  // ---------- API-DATE: kết quả api() có Date -> google.script.run trả null cho cả kết quả (trang Nhập liệu lỗi khongTimThay) ----------
  chay(function () {
    const t = moi();
    const A = t.tao('Nguyen A', '049000000001', '1111', 'A1');
    const rungSh = t.ss.getSheetByName('HD_RUNG'), nccSh = t.ss.getSheetByName('HD_NCC');
    const dongLo = rungSh.getDataRange().getValues().findIndex(r => String(r[0]) === A.idHD) + 1;
    rungSh.getRange(dongLo, 20).setValue(t.run('new Date(2019, 0, 1)'));           // "Năm trồng" bị Sheets đổi thành ngày
    const dongHD = nccSh.getDataRange().getValues().findIndex(r => String(r[29]) === A.idHD) + 1;
    nccSh.getRange(dongHD, 23).setValue(t.run('new Date(2024, 4, 6, 9, 30, 0)')); // ô Số giấy tờ lỡ là ngày giờ
    const coDate = t.run('(function kt(v){ if (v && typeof v === "object") { if (Object.prototype.toString.call(v) === "[object Date]") return true; return Object.keys(v).some(function(k){ return kt(v[k]); }); } return false; })');
    const kq = t.run('api("", "layHopDongTheoIdHD", [' + J(A.idHD) + '])');
    const lo = (kq.danhSachRung || [])[0] || {};
    kiem('API-DATE kết quả api() không còn giá trị Date (Năm trồng -> năm, ngày giờ -> chuỗi)', kq && !coDate(kq) && lo.namTrong === 2019 && kq.soGiayTo === '2024-05-06 09:30:00', J({ nam: lo.namTrong, sgt: kq && kq.soGiayTo }));
  });

  // ---------- SO-NGAY: ô số chứa NGÀY (HD_RUNG "KL thực hiện" = ngày giờ) -> KL thực hiện 1.790.735.658.000 ----------
  chay(function () {
    const t = moi();
    const A = t.tao('Mai Thanh', '049064018539', '1111', '20260914003');
    t.run('THEM_LO_RUNG_MOI_(' + J({ idHD: A.idHD, diaChiRung: 'Lo 1', dienTichM2: 29650, donGia: 1750000, khoiLuongDuKien: 355.8 }) + ')');
    const rungSh = t.ss.getSheetByName('HD_RUNG');
    const dong = rungSh.getDataRange().getValues().findIndex(r => String(r[0]) === A.idHD && String(r[8]) === 'Lo 1') + 1;
    rungSh.getRange(dong, 19).setValue(t.run('new Date(2026, 8, 30, 9, 34, 18)')); // cột S "Khối lượng thực hiện"
    t.run('CAP_NHAT_DRAFT_MOT_HOP_DONG_(' + J(A.idHD) + ')');
    const th = t.run('_tinhHinhThucHienCuaHD_(' + J(A.idHD) + ')');
    kiem('SO-NGAY ô KL thực hiện chứa ngày giờ -> KL / giá trị thực hiện không nhảy số (coi là 0)', Number(th.khoiLuongThucHien) === 0 && Number(th.giaTriThucHien) === 0, J(th));
    const cd = t.run('CHAN_DOAN_MO_COI_TOAN_HE_THONG_()');
    const o = cd.o_soLaNgay || [];
    kiem('SO-NGAY chẩn đoán tìm đúng ô S của lô đó', o.length === 1 && o[0].o === 'S' + dong && o[0].tenCot === 'KL thực hiện' && o[0].bang === 'HD_RUNG', J(o));
    const x = t.run('LAM_SACH_O_SO_LA_NGAY_()');
    const nk = t.ss.getSheetByName('NhatKy_ChiTiet');
    kiem('SO-NGAY dọn: xóa trống đúng 1 ô, ghi nhật ký chi tiết, chẩn đoán lại sạch', x.soO === 1 && rungSh.getRange(dong, 19).getValue() === '' && !!nk && nk.getLastRow() >= 2
      && t.run('CHAN_DOAN_MO_COI_TOAN_HE_THONG_()').o_soLaNgay.length === 0 && Number(rungSh.getRange(dong, 12).getValue()) === 355.8, J(x));
    kiem('SO-NGAY API dọn chỉ Quản trị', t.run('_bangQuyenApi_().LAM_SACH_O_SO_LA_NGAY.quyen === QUYEN.QUAN_TRI'));
  });

  // ---------- TOC-DO: cache cập nhật từng HĐ (đọc có chọn lọc) phải GIỐNG HỆT xây lại toàn bộ ----------
  chay(function () {
    const t = moi();
    const A = t.tao('Nguyen A', '049000000001', '1111', 'A1');
    const B = t.tao('Tran B', '049000000002', '2222', 'B1');
    // Lô / GPS / ảnh của A và B xen kẽ nhau trên sheet (dòng của 1 HĐ không liền nhau)
    const la = t.run('THEM_LO_RUNG_MOI_(' + J({ idHD: A.idHD, diaChiRung: 'Lo A2', dienTichM2: 3000, donGia: 2000, khoiLuongDuKien: 36, namTrong: '2019' }) + ')');
    const lb = t.run('THEM_LO_RUNG_MOI_(' + J({ idHD: B.idHD, diaChiRung: 'Lo B2', dienTichM2: 5000, donGia: 1500, khoiLuongDuKien: 60 }) + ')');
    t.run('CAP_NHAT_GPS_RUNG_(' + J(la.idRung) + ', {lat: 15.1, lng: 108.1}, false)');
    t.run('CAP_NHAT_GPS_RUNG_(' + J(lb.idRung) + ', {lat: 15.3, lng: 108.3}, false)');
    t.run('CAP_NHAT_GPS_RUNG_(' + J(la.idRung) + ', {lat: 15.2, lng: 108.2}, false)');
    t.ss.getSheetByName('HD_Picture').appendRow([A.idHD, A.idHD, 'Nguyen A', 'https://drive.google.com/file/d/ANH1/view']);
    t.run('CAP_NHAT_DRAFT_MOT_HOP_DONG_(' + J(A.idHD) + ')');
    t.run('CAP_NHAT_LO_RUNG_(' + J(la.idRung) + ', {donGia: 2100})');
    const chup = (code, cotId, cotBo) => t.run('(function(){ var v = ' + code + '.getDataRange().getValues().slice(1).filter(function(r){ return String(r[' + cotId + ']).trim(); }); return v.map(function(r){ return r.map(function(x,i){ return i === ' + cotBo + ' ? "" : (Object.prototype.toString.call(x) === "[object Date]" ? x.getTime() : x); }); }).sort(function(a,b){ return String(a[' + cotId + ']) < String(b[' + cotId + ']) ? -1 : 1; }); })()');
    const bc1 = chup('getOrCreateDraftBaoCaoSheet_()', 'DRAFT_BAOCAO_COL.ID_HD', 'DRAFT_BAOCAO_COL.CAP_NHAT_LUC');
    const hs1 = chup('getOrCreateDraftHoSoRungSheet_()', 'DRAFT_HSR_COL.ID_RUNG', 'DRAFT_HSR_COL.CAP_NHAT_LUC');
    t.run('XAY_DUNG_LAI_TOAN_BO_DRAFT_()'); t.run('XAY_DUNG_LAI_DRAFT_HOSORUNG_()');
    const bc2 = chup('getOrCreateDraftBaoCaoSheet_()', 'DRAFT_BAOCAO_COL.ID_HD', 'DRAFT_BAOCAO_COL.CAP_NHAT_LUC');
    const hs2 = chup('getOrCreateDraftHoSoRungSheet_()', 'DRAFT_HSR_COL.ID_RUNG', 'DRAFT_HSR_COL.CAP_NHAT_LUC');
    kiem('TOC-DO cache Báo cáo cập nhật từng HĐ (đọc chọn lọc) giống hệt xây lại toàn bộ', bc1.length === 2 && J(bc1) === J(bc2), J(bc1) + '\n' + J(bc2));
    kiem('TOC-DO cache Hồ sơ rừng ghi đúng dòng giống hệt xây lại toàn bộ', hs1.length === 4 && J(hs1) === J(hs2), J(hs1) + '\n' + J(hs2));
    const ct = t.run('_tinhHinhThucHienCuaHD_(' + J(A.idHD) + ')');
    kiem('TOC-DO số liệu HĐ A đúng dù dòng xen kẽ (KL dự kiến gồm lô tự sinh + lô thêm)', Number(ct.khoiLuongDuKien) > 36, J(ct));
    // Lưu lại lô KHÔNG đổi gì -> không ghi, không tính lại
    const khong = t.run('CAP_NHAT_LO_RUNG_(' + J(la.idRung) + ', {donGia: "2100", dienTichM2: 3000, namTrong: 2019})');
    kiem('TOC-DO lưu lô không đổi gì -> bỏ qua (khongDoi), không ghi ô nào', khong.thanhCong && khong.khongDoi === true, J(khong));
  });

  // ---------- TOC-DO-2: tra cứu 1 HĐ đọc chọn lọc phải ra đúng như đọc cả sheet ----------
  chay(function () {
    const t = moi();
    const ds = [];
    for (let i = 0; i < 6; i++) ds.push(t.tao('KH ' + i, '0490000000' + (10 + i), '1' + i, 'S' + i));
    ds.forEach((x, i) => { x.lo = t.run('THEM_LO_RUNG_MOI_(' + J({ idHD: x.idHD, diaChiRung: 'Lo ' + i, dienTichM2: 1000, donGia: 2000, khoiLuongDuKien: 12 }) + ')').idRung; });
    ds.forEach((x, i) => { if (i % 2) t.run('THEM_TAI_KHOAN_MOI_(' + J({ idHD: x.idHD, soTK: '9' + i, nganHang: 'ACB' }) + ')'); });
    ds.forEach((x, i) => { if (i % 3) t.run('CAP_NHAT_GPS_RUNG_(' + J(x.lo) + ', {lat: 15.' + i + ', lng: 108.' + i + '}, false)'); });
    t.ss.getSheetByName('HD_Picture').appendRow([ds[2].lo, ds[2].idHD, 'KH', 'https://drive.google.com/file/d/A/view']); // ảnh lưu nhầm ID_RUNG
    const sai = [];
    ds.forEach(x => {
      const moiTD = J(t.run('TIEN_DO_HO_SO_HD_(' + J(x.idHD) + ')'));
      const cuTD = J(t.run('(function(){ _draftDataCache = null; var m = docToanBoDraftBaoCao_().filter(function(z){ return String(z.idHD).trim() === ' + J(x.idHD) + '; })[0]; _draftDataCache = null; return { coDuLieu: true, soTaiKhoan: Number(m.soTaiKhoan) || 0, soLoRung: Number(m.soLoRung) || 0, hoSoDu: !!m.hoSoDu, daDoGPSDu: !!m.daDoGPSDu, coAnh: !!m.coAnh, thieuHoSoChiTiet: String(m.thieuHoSoChiTiet || "") }; })()'));
      if (moiTD !== cuTD) sai.push('tiến độ ' + x.idHD + ' ' + moiTD + ' / ' + cuTD);
      const tk = t.run('layDanhSachTaiKhoan_(' + J(x.idHD) + ')');
      const tkThat = t.stk().map((r, i) => ({ r, soDong: i + 2 })).filter(z => String(z.r[0]) === x.idHD).map(z => z.soDong + ':' + z.r[5]);
      if (J(tk.map(z => z.soDong + ':' + z.soTK)) !== J(tkThat)) sai.push('tài khoản ' + x.idHD);
    });
    const coAnh2 = t.run('TIEN_DO_HO_SO_HD_(' + J(ds[2].idHD) + ')').coAnh;
    kiem('TOC-DO-2 thanh tiến độ (đọc 1 HĐ) = đọc cả cache; số dòng tài khoản đúng; ảnh lưu nhầm ID_RUNG vẫn nhận', !sai.length && coAnh2 === true, J(sai));
  });

  // ---------- TC-NHANH: tra cứu dùng chỉ mục (cache), tự làm mới khi ghi, trả kèm chi tiết HĐ đầu ----------
  chay(function () {
    const t = moi();
    const A = t.tao('Mai Thành', '049064018539', '1111', 'A1');
    t.tao('Trần Thị Lan', '049000000002', '2222', 'B1');
    const r1 = t.run('TRA_CUU_HOP_DONG_("mai thanh", "", "", true)');
    t.m.demDoc.n = 0; t.m.demDoc.o = 0; t.m.demDoc.theo = {};
    const r2 = t.run('TRA_CUU_HOP_DONG_("mai thanh", "", "")');
    const docNcc = Object.keys(t.m.demDoc.theo || {}).filter(k => /^HD_NCC|^HD_STK/.test(k)).length;
    kiem('TC-NHANH lần tìm thứ 2 không đọc lại HD_NCC / HD_STK, cùng kết quả', r1.tongSo === 1 && J(r1.ketQua) === J(r2.ketQua) && docNcc === 0, J({ theo: t.m.demDoc.theo, r1: r1.tongSo, r2: r2.tongSo }));
    kiem('TC-NHANH màn rộng: trả kèm chi tiết HĐ đầu giống hệt CHI_TIET_TRA_CUU', !!r1.chiTietDau && J(r1.chiTietDau) === J(t.run('CHI_TIET_TRA_CUU_HOP_DONG_(' + J(A.idHD) + ')')) && r2.chiTietDau === undefined);
    t.run('THEM_TAI_KHOAN_MOI_(' + J({ idHD: A.idHD, soTK: '777555333', nganHang: 'BIDV' }) + ')');
    const r3 = t.run('TRA_CUU_HOP_DONG_("777555333", "", "")');
    kiem('TC-NHANH ghi dữ liệu -> chỉ mục làm mới (tìm thấy số TK vừa thêm)', r3.tongSo === 1 && r3.ketQua[0].khopTheo === 'Số tài khoản', J(r3));
  });

  // ---------- NAM-TRONG: năm trồng phải là năm 4 chữ số ----------
  chay(function () {
    const t = moi();
    const A = t.tao('Nguyen A', '049000000001', '1111', 'A1');
    const sai = t.run('THEM_LO_RUNG_MOI_(' + J({ idHD: A.idHD, diaChiRung: 'X', namTrong: '01/2019' }) + ')');
    const lo = t.run('THEM_LO_RUNG_MOI_(' + J({ idHD: A.idHD, diaChiRung: 'Y', namTrong: '2019' }) + ')');
    const sh = t.ss.getSheetByName('HD_RUNG');
    const dong = sh.getDataRange().getValues().findIndex(r => r[2] === lo.idRung) + 1;
    const sai2 = t.run('CAP_NHAT_LO_RUNG_(' + J(lo.idRung) + ', {namTrong: "1800"})');
    const dung = t.run('CAP_NHAT_LO_RUNG_(' + J(lo.idRung) + ', {namTrong: "2020"})');
    kiem('NAM-TRONG sai định dạng / ngoài khoảng bị từ chối, năm đúng lưu thành SỐ với định dạng số',
      !sai.thanhCong && !sai2.thanhCong && dung.thanhCong && sh.getRange(dong, 20).getValue() === 2020 && sh.fmt[dong + ',20'] === '0', J([sai, sai2, dung, sh.getRange(dong, 20).getValue()]));
  });

  // ---------- XOA-GPS / XOA-ANH: xóa điểm GPS, ảnh của lô rừng ----------
  chay(function () {
    const t = moi();
    const A = t.tao('Nguyen A', '049000000001', '1111', 'A1');
    const lo = t.run('THEM_LO_RUNG_MOI_(' + J({ idHD: A.idHD, diaChiRung: 'Lo 1' }) + ')');
    t.run('CAP_NHAT_GPS_RUNG_(' + J(lo.idRung) + ', {lat: 15.1, lng: 108.1}, false)');
    t.run('CAP_NHAT_GPS_RUNG_(' + J(lo.idRung) + ', {lat: 15.2, lng: 108.2}, false)');
    let ds = t.run('layGPSCuaRung_(' + J(lo.idRung) + ')');
    const sai = t.run('XOA_DIEM_GPS_(' + J(lo.idRung) + ',' + ds[0].soDong + ', "sai")');
    const x = t.run('XOA_DIEM_GPS_(' + J(lo.idRung) + ',' + ds[0].soDong + ',' + J(ds[0].dau) + ')');
    ds = t.run('layGPSCuaRung_(' + J(lo.idRung) + ')');
    kiem('XOA-GPS xóa đúng 1 điểm (điểm 15.2 còn lại), dòng sai dấu bị từ chối, có mã lưu trữ', !sai.thanhCong && x.thanhCong && ds.length === 1 && ds[0].lat === 15.2 && !!x.maDot, J([sai, x, ds]));
    t.run('KHOI_PHUC_DU_LIEU_DA_XOA_(' + J(x.maDot) + ')');
    kiem('XOA-GPS khôi phục lại được điểm đã xóa', t.run('layGPSCuaRung_(' + J(lo.idRung) + ')').length === 2);
    // Ảnh mới (Draft_AnhRung đã duyệt + link trong HD_Picture) và ảnh cũ (chỉ HD_Picture)
    const shD = t.run('getOrCreateDraftAnhSheet_()');
    const urlMoi = 'https://drive.google.com/file/d/MOI/view';
    t.run('getOrCreateDraftAnhSheet_().appendRow(["D1",' + J(A.idHD) + ',' + J(lo.idRung) + ',"moi.jpg","MOI",' + J(urlMoi) + ',"","","","","Đã duyệt",new Date()])');
    t.ss.getSheetByName('HD_Picture').appendRow([A.idHD, A.idHD, 'Nguyen A', 'https://drive.google.com/file/d/CU/view', urlMoi]);
    let anh = t.run('layDraftAnhChoRung_(' + J(lo.idRung) + ',' + J(A.idHD) + ')').filter(a => a.trangThai === 'Đã duyệt');
    const aMoi = anh.find(a => a.nguon === 'moi'), aCu = anh.find(a => a.nguon === 'cu' && /CU/.test(a.url));
    const x1 = t.run('XOA_ANH_RUNG_(' + J({ idRung: lo.idRung, idDraft: aMoi.idDraft }) + ')');
    const x2 = t.run('XOA_ANH_RUNG_(' + J({ idRung: lo.idRung, soDongPic: aCu.soDongPic, cot: aCu.cot, giaTriGoc: aCu.giaTriGoc }) + ')');
    anh = t.run('layDraftAnhChoRung_(' + J(lo.idRung) + ',' + J(A.idHD) + ')').filter(a => a.trangThai === 'Đã duyệt');
    const nk = t.ss.getSheetByName('NhatKy_ChiTiet').getDataRange().getValues().filter(r => r[2] === 'Xóa ảnh lô rừng');
    kiem('XOA-ANH xóa ảnh mới (bỏ link HD_Picture + nháp "Đã xóa") và ảnh cũ; link cũ ghi nhật ký chi tiết', x1.thanhCong && x2.thanhCong && anh.length === 0 && nk.length === 2, J([x1, x2, anh, nk.length]));
    // Hợp đồng đã chốt -> không xóa được
    t.ss.getSheetByName('HD_NCC').getRange(2, 31).setValue('Đã thanh lý');
    const ds2 = t.run('layGPSCuaRung_(' + J(lo.idRung) + ')');
    const chot = t.run('XOA_DIEM_GPS_(' + J(lo.idRung) + ',' + ds2[0].soDong + ',' + J(ds2[0].dau) + ')');
    kiem('XOA-GPS hợp đồng đã chốt -> từ chối', !chot.thanhCong && /chốt/.test(chot.loi), J(chot));
    const q = t.run('_bangQuyenApi_()');
    kiem('XOA-GPS/ANH API cho quyền Nhập liệu', t.run('_bangQuyenApi_().XOA_DIEM_GPS.quyen === QUYEN.NHAP_LIEU && _bangQuyenApi_().XOA_ANH_RUNG.quyen === QUYEN.NHAP_LIEU'));
  });

  // ---------- BT-01..: bảo trì — dòng nghi trùng & dòng mồ côi ----------
  chay(function () {
    const t = moi();
    const nccSh = () => t.ss.getSheetByName('HD_NCC'), rungSh = () => t.ss.getSheetByName('HD_RUNG');
    const nccRows = () => nccSh().getDataRange().getValues().slice(1), rungRows = () => rungSh().getDataRange().getValues().slice(1);
    const A = t.tao('Nguyen A', '049000000001', '1111', 'A1', '2026-05-10');
    t.run('THEM_LO_RUNG_MOI_(' + J({ idHD: A.idHD, diaChiRung: 'Lo 1', dienTichM2: 3000, donGia: 2000, khoiLuongDuKien: 36 }) + ')');
    const B = t.tao('Nguyen A', '049000000001', '2222', 'A2', '2026-05-10'); // bấm tạo 2 lần: cùng CCCD + ngày ký, khác ID
    t.tao('Tran C', '049000000003', '3333', 'C1');
    // Dòng HD_NCC bị chép trùng nguyên văn (cùng ID_HD) do sửa tay trên Sheet
    const dongA = nccRows().find(r => String(r[29]) === A.idHD);
    nccSh().appendRow(dongA);
    // Lô rừng chép trùng (cùng ID_RUNG)
    const soLoA = rungRows().filter(r => String(r[0]) === A.idHD).length; // tạo HĐ tự sinh 1 lô + lô thêm ở trên
    const loA = rungRows().find(r => String(r[0]) === A.idHD);
    rungSh().appendRow(loA);
    const kq = t.run('TIM_DONG_NGHI_TRUNG_()');
    const nhomA = kq.hopDong.find(n => n.dong.some(d => d.idHD === A.idHD));
    kiem('BT-01 tìm được 1 nhóm hợp đồng nghi trùng gồm 3 dòng (2 dòng cùng ID + 1 HĐ cùng CCCD & ngày ký), lý do đủ',
      kq.hopDong.length === 1 && nhomA && nhomA.dong.length === 3 && nhomA.lyDo.indexOf('Cùng ID_HD') !== -1 && nhomA.lyDo.indexOf('Cùng CCCD chủ rừng + ngày ký') !== -1, J(kq.hopDong.map(n => [n.lyDo, n.dong.length])));
    kiem('BT-02 tìm được lô rừng trùng cùng ID_RUNG, gợi ý giữ dòng trên', kq.loRung.length === 1 && kq.loRung[0].dong.length === 2 && kq.loRung[0].dong[0].goiYGiu === true && kq.loRung[0].dong[0].cheDoXoa === 'dong', J(kq.loRung));
    // Chọn xóa hết cả nhóm -> bị chặn
    const chan = t.run('XOA_DONG_NGHI_TRUNG_(' + J(nhomA.dong.map(d => ({ bang: d.bang, dong: d.dong, dau: d.dau }))) + ')');
    kiem('BT-03 không cho xóa hết cả nhóm (phải giữ ít nhất 1 dòng), không xóa gì', !chan.thanhCong && nccRows().length === 4, J(chan));
    // Dòng đã bị sửa sau khi xem -> bỏ qua
    const saoA = nhomA.dong.filter(d => d.idHD === A.idHD)[1];
    nccSh().getRange(saoA.dong, 5).setValue('Nguyen A (sửa)');
    const cu = t.run('XOA_DONG_NGHI_TRUNG_(' + J([{ bang: 'HD_NCC', dong: saoA.dong, dau: saoA.dau }]) + ')');
    kiem('BT-04 dòng đã đổi sau khi xem -> bỏ qua, không xóa', !cu.thanhCong && nccRows().length === 4 && /thay đổi/.test(J(cu.boQua)), J(cu));
    // Quét lại, xóa dòng chép trùng cùng ID + hợp đồng trùng B (khác ID) + lô chép trùng
    const kq2 = t.run('TIM_DONG_NGHI_TRUNG_()');
    const n2 = kq2.hopDong[0].dong;
    const chonXoa = n2.filter(d => d.idHD === B.idHD || (d.idHD === A.idHD && d.dong !== n2.find(x => x.idHD === A.idHD).dong)).concat([kq2.loRung[0].dong[1]]);
    const x = t.run('XOA_DONG_NGHI_TRUNG_(' + J(chonXoa.map(d => ({ bang: d.bang, dong: d.dong, dau: d.dau }))) + ')');
    const conNcc = nccRows().map(r => String(r[29]));
    kiem('BT-05 xóa dòng trùng: còn đúng 1 dòng HĐ A (lô, TK của A còn nguyên), HĐ B bị xóa kèm TK, lô chép trùng bị xóa',
      x.thanhCong && conNcc.filter(i => i === A.idHD).length === 1 && conNcc.indexOf(B.idHD) === -1 && conNcc.length === 2
      && rungRows().filter(r => String(r[0]) === A.idHD).length === soLoA && t.stk().some(r => String(r[0]) === A.idHD) && !t.stk().some(r => String(r[0]) === B.idHD), J(x) + ' ' + J(conNcc));
    const lt = t.run('LAY_DS_LUU_TRU_XOA_(20)');
    kiem('BT-06 các dòng bị xóa đều được lưu trữ (khôi phục được)', lt.some(d => /trùng ID ở HD_NCC|trùng ID/.test(d.hanhDong)) && lt.some(d => d.idHD === B.idHD), J(lt.map(d => d.hanhDong)));
    kiem('BT-07 quét lại không còn nhóm trùng', t.run('TIM_DONG_NGHI_TRUNG_()').soNhom === 0);
  });

  chay(function () {
    const t = moi();
    const A = t.tao('Nguyen A', '049000000001', '1111', 'A1');
    const rungSh = t.ss.getSheetByName('HD_RUNG'), gpsSh = t.ss.getSheetByName('HD_GPS'), stkSh = t.ss.getSheetByName('HD_STK');
    const gpsTruoc = gpsSh.getLastRow(); // tạo HĐ tự sinh 1 dòng GPS khung
    const dongRung = Array(20).fill(''); dongRung[0] = 'HD_KHONG_CO'; dongRung[1] = 'MR_X'; dongRung[2] = 'RUNG_MOCOI_1'; dongRung[3] = 'X9';
    rungSh.appendRow(dongRung);
    gpsSh.appendRow(['RUNG_MOCOI_1', 'G1', 15.4, 108.3, '', '', 'X', '', '', '']);
    gpsSh.appendRow(['RUNG_MOCOI_1', 'G2', 15.41, 108.31, '', '', 'X', '', '', '']);
    stkSh.appendRow(['HD_KHONG_CO_2', 'HD_KHONG_CO_2', 'Y', '', '', '5555', 'VCB', '', '', '']);
    const cd = t.run('CHAN_DOAN_MO_COI_TOAN_HE_THONG_()');
    kiem('BT-08 chẩn đoán: 1 lô, 1 STK mồ côi (GPS gắn theo lô mồ côi chưa tính), có dấu vân tay dòng', cd.rung_moCoi.length === 1 && cd.gps_moCoi.length === 0 && cd.stk_moCoi.length === 1 && !!cd.rung_moCoi[0].dau, J(cd));
    const ds = [{ loai: 'rung_moCoi', dong: cd.rung_moCoi[0].dong, dau: cd.rung_moCoi[0].dau }, { loai: 'stk_moCoi', dong: cd.stk_moCoi[0].dong, dau: cd.stk_moCoi[0].dau }, { loai: 'stk_moCoi', dong: 2, dau: 'sai' }];
    const x = t.run('XOA_DONG_MO_COI_(' + J(ds) + ')');
    kiem('BT-09 xóa lô mồ côi kéo theo 2 điểm GPS của lô đó, xóa STK mồ côi; dòng sai dấu bị bỏ qua; TK của A còn',
      x.thanhCong && x.daXoa === 2 && x.daXoaKem === 2 && x.boQua.length === 1 && gpsSh.getLastRow() === gpsTruoc && t.stk().length === 1 && String(t.stk()[0][0]) === A.idHD, J(x));
    kiem('BT-10 chẩn đoán lại sạch', t.run('CHAN_DOAN_MO_COI_TOAN_HE_THONG_()').tongSoVanDe === 0);
    const kp = t.run('KHOI_PHUC_DU_LIEU_DA_XOA_(' + J(x.maDot) + ')');
    kiem('BT-11 khôi phục đợt xóa mồ côi: lô, 2 GPS, STK trở lại', rungSh.getDataRange().getValues().some(r => r[2] === 'RUNG_MOCOI_1') && gpsSh.getLastRow() === gpsTruoc + 2 && t.stk().length === 2, J(kp));
    const q = t.run('_bangQuyenApi_()');
    kiem('BT-12 API bảo trì xóa trùng / mồ côi chỉ dành cho Quản trị', ['TIM_DONG_NGHI_TRUNG', 'XOA_DONG_NGHI_TRUNG', 'XOA_DONG_MO_COI'].every(k => q[k] && q[k].quyen === t.run('QUYEN.QUAN_TRI')));
  });

  chay(function () {
    const t = moi();
    const A = t.tao('Nguyen A', '049000000001', '1111', 'A1');
    const tq = t.run('LAY_TONG_QUAN_HOP_DONG_({})');
    const it = (tq.items || [])[0] || {};
    kiem('GD2 Tổng quan: trả thêm khối lượng dự kiến / thực hiện / giá trị từng HĐ + tổng dự kiến',
      it.khoiLuongDuKien === 120 && it.khoiLuongThucHien === 0 && it.giaTriHopDong > 0 && tq.tongKhoiLuongDuKien === 120 && it.soHD === 'A1', J({ it: it, tong: tq.tongKhoiLuongDuKien }));
    const td = t.run('TIEN_DO_HO_SO_HD_(' + J(A.idHD) + ')');
    kiem('GD2 Tiến độ hồ sơ: đọc đúng số TK / số lô / cờ đủ hồ sơ-GPS-ảnh từ cache báo cáo',
      td.coDuLieu === true && td.soTaiKhoan === 1 && td.soLoRung === 1 && td.daDoGPSDu === false && td.coAnh === false, J(td));
    kiem('GD2 Tiến độ hồ sơ: ID không có -> coDuLieu=false', t.run('TIEN_DO_HO_SO_HD_("KHONG_CO")').coDuLieu === false);
    const th = t.run('_tongHopWebappTuDraft_([{soHD:"1",tinhTrang:"Đang thực hiện",khoiLuongDuKien:100,khoiLuongThucHien:40,giaTriHopDong:1000,giaTriThucHien:400},{soHD:"2",tinhTrang:"Chờ thực hiện",khoiLuongDuKien:50,khoiLuongThucHien:10,giaTriHopDong:500,giaTriThucHien:"100"},{soHD:"3",tinhTrang:"Đã hủy",khoiLuongDuKien:999,khoiLuongThucHien:999}], {}, 1, 20)');
    kiem('GD2 Báo cáo: tổng đã thực hiện (KL/giá trị) chỉ cộng HĐ đang/chờ thực hiện',
      th.tongKhoiLuongThucHien === 50 && th.tongGiaTriThucHien === 500 && th.tongKhoiLuong === 150 && th.soHopDong === 2);
    kiem('GD2 API TIEN_DO_HO_SO_HD mở cho quyền Xem', t.run('_bangQuyenApi_()').TIEN_DO_HO_SO_HD !== undefined);
  });

  // ---------- MISA tính DOUBLE: lô rỗng tự tạo + dòng cũ của lô/hợp đồng đã xóa ----------
  chay(function () {
    const t = moi();
    const A = t.run('TAO_HOP_DONG_MOI_(' + J({ tenChuRung: 'Mai Thanh', cccdChuRung: '049064018539', ngayKy: '2026-09-10', soTK: '1050001', nganHang: 'VCB' }) + ')');
    const loA = t.run('THEM_LO_RUNG_MOI_(' + J({ idHD: A.idHD, soHD: A.soHD, diaChiRung: 'Thôn A', dienTichM2: 10000, khoiLuongDuKien: 120, donGia: 1000 }) + ')');
    const B = t.tao('Tran B', '049000000002', '2222', 'B1');
    const C = t.run('TAO_HOP_DONG_MOI_(' + J({ tenChuRung: 'Le C', cccdChuRung: '049000000003', ngayKy: '2026-09-11' }) + ')');
    const d = t.run('layDuLieuMisaHienTai_("","")');
    const hdmbCua = (id) => d.rowsHDMB.filter(r => r[22] === id);
    kiem('MISA-01 HĐ có lô rỗng tự tạo + lô thật -> chỉ xuất 1 dòng HDMB (lô thật)',
      hdmbCua(A.idHD).length === 1 && hdmbCua(A.idHD)[0][15] === 120 && hdmbCua(A.idHD)[0][17] === 120000, J(hdmbCua(A.idHD)));
    kiem('MISA-02 HĐ chỉ có 1 lô (kể cả lô rỗng) vẫn có đúng 1 dòng', hdmbCua(B.idHD).length === 1 && hdmbCua(C.idHD).length === 1);
    t.m.props.set('MISA_MASTER_SHEET_ID', 'REPORT');
    t.run('DONG_BO_VAO_MISA_MASTER_("","")');
    const sh = () => t.run('SpreadsheetApp.openById("REPORT").getSheetByName("Update_HDMB").getDataRange().getValues().slice(1).filter(r => r.some(o => o !== ""))');
    const tongKL = () => sh().reduce((s, r) => s + (Number(r[15]) || 0), 0);
    kiem('MISA-03 đồng bộ lần đầu: 3 dòng HDMB, tổng KL 240', sh().length === 3 && tongKL() === 240, J(sh().map(r => [r[22], r[23], r[15]])));
    // Xóa lô thật của A rồi thêm lại (ID_RUNG mới) + xóa hẳn HĐ B -> trước đây dòng cũ còn nằm lại => KL bị nhân đôi
    // Lô thật của A bị xóa (chỉ còn lô rỗng _1) + xóa hẳn HĐ B -> trước đây dòng cũ còn nằm lại trong Sheet MISA
    t.run('XOA_LO_RUNG_(' + J(loA.idRung) + ')');
    t.run('XOA_VINH_VIEN_HOP_DONG_(' + J(B.idHD) + ', true)');
    const kq = t.run('DONG_BO_VAO_MISA_MASTER_("","")');
    kiem('MISA-04 đồng bộ lại: bỏ dòng cũ (lô đã xóa + HĐ đã xóa), không còn tính double',
      kq.thanhCong && sh().length === 2 && tongKL() === 0 && kq.hdmb.soDongCuDaBo === 2 && sh().filter(r => r[22] === A.idHD).length === 1, J({ kq: kq.hdmb, rows: sh().map(r => [r[22], r[23], r[15]]) }));
    t.run('THEM_LO_RUNG_MOI_(' + J({ idHD: A.idHD, soHD: A.soHD, diaChiRung: 'Thôn A', dienTichM2: 10000, khoiLuongDuKien: 120, donGia: 1000 }) + ')');
    const kq1 = t.run('DONG_BO_VAO_MISA_MASTER_("","")');
    kiem('MISA-04b thêm lại lô thật: dòng lô rỗng bị thay bằng lô thật, A vẫn 1 dòng', kq1.hdmb.soDongCuDaBo === 1 && sh().length === 2 && tongKL() === 120, J(kq1.hdmb));
    kiem('MISA-05 sheet NCC bỏ dòng của HĐ đã xóa', kq.ncc.soDongCuDaBo === 1 &&
      t.run('SpreadsheetApp.openById("REPORT").getSheetByName("Update_DM_NCC").getDataRange().getValues().slice(1).filter(r => r[26]).length') === 2);
    // Đồng bộ theo khoảng ngày chỉ đụng tới HĐ trong khoảng — dòng HĐ ngoài khoảng giữ nguyên
    const kq2 = t.run('DONG_BO_VAO_MISA_MASTER_("2026-09-11","2026-09-11")');
    kiem('MISA-06 đồng bộ theo khoảng ngày không xóa dòng HĐ ngoài khoảng', kq2.hdmb.soDongCuDaBo === 0 && sh().length === 2 && tongKL() === 120, J(kq2.hdmb));
  });

  // ---------- Đủ hồ sơ mới được chuyển "Đang thực hiện" + cảnh báo tọa độ cách địa chỉ rừng > 5 km ----------
  const gaiMaps = (t, ketQua) => { t.m.ctx.Maps.newGeocoder = () => ({ setRegion() { return this; }, setLanguage() { return this; }, geocode: (dc) => ketQua(dc) }); };
  chay(function () {
    const t = moi();
    const A = t.run('TAO_HOP_DONG_MOI_(' + J({ tenChuRung: 'Mai Thanh', cccdChuRung: '049064018539', ngayKy: '2026-09-10', tinhTrang: 'Đang thực hiện' }) + ')');
    const ttA = () => t.ss.getSheetByName('HD_NCC').getDataRange().getValues().find(r => r[29] === A.idHD)[30];
    kiem('DHS-01 tạo HĐ mới xin "Đang thực hiện" -> vẫn bắt đầu "Chờ thực hiện"', ttA() === 'Chờ thực hiện', ttA());
    const kq = t.run('CAP_NHAT_HOP_DONG_WEB_(2, {tinhTrang:"Đang thực hiện"}, ' + J(A.idHD) + ')');
    const th = (kq.thieuHoSo || []).join(' | ');
    kiem('DHS-02 HĐ trống: không cho chuyển, liệt kê đúng mục thiếu (MST, địa chỉ, TK, địa chỉ rừng, file hồ sơ pháp lý, tọa độ, ảnh) — KHÔNG đòi CCCD đính kèm / ngày cấp / SĐT / diện tích',
      kq.thanhCong === false && /bổ sung đầy đủ hồ sơ/.test(kq.loi) && /mã số thuế/.test(th) && /địa chỉ,/.test(th) && /số tài khoản \+ ngân hàng/.test(th) &&
      /địa chỉ rừng/.test(th) && /file hồ sơ pháp lý đính kèm/.test(th) && /tọa độ GPS/.test(th) && /ảnh GPS hoặc ảnh hiện trường/.test(th) &&
      !/CCCD chủ rừng|ngày cấp|điện thoại|diện tích|đơn giá|số giấy tờ/.test(th) && ttA() === 'Chờ thực hiện', J(kq));
    const xt = t.run('KIEM_TRA_DU_HO_SO_HD_(' + J(A.idHD) + ')');
    kiem('DHS-03 API xem trước còn thiếu gì', xt.du === false && xt.thieu.length === kq.thieuHoSo.length);
    t.run('THEM_TAI_KHOAN_MOI_(' + J({ idHD: A.idHD, soTK: '1050001', nganHang: 'VCB' }) + ')');
    t.duHoSo(A.idHD);
    // bỏ ảnh của điểm GPS -> chỉ còn thiếu ảnh
    const gps = t.ss.getSheetByName('HD_GPS'); for (let r = 2; r <= gps.getLastRow(); r++) gps.getRange(r, 8).setValue('');
    const kq2 = t.run('CAP_NHAT_HOP_DONG_WEB_(2, {tinhTrang:"Đang thực hiện"}, ' + J(A.idHD) + ')');
    kiem('DHS-04 đủ mọi thứ trừ ảnh -> chỉ báo thiếu ảnh GPS / hiện trường', kq2.thanhCong === false && kq2.thieuHoSo.length === 1 && /ảnh GPS hoặc ảnh hiện trường/.test(kq2.thieuHoSo[0]), J(kq2.thieuHoSo));
    t.run('ghiAnhVaoHDPicture_(' + J(A.idHD) + ', "Mai Thanh", "https://drive.google.com/file/d/HT1/view")');
    const kq3 = t.run('CAP_NHAT_HOP_DONG_WEB_(2, {tinhTrang:"Đang thực hiện"}, ' + J(A.idHD) + ')');
    kiem('DHS-05 có ảnh hiện trường (đã duyệt) -> chuyển "Đang thực hiện" được', kq3.thanhCong === true && ttA() === 'Đang thực hiện', J(kq3));
    kiem('DHS-06 không còn cột / API đính kèm CCCD riêng', t.ss.getSheetByName('HD_NCC').getRange(1, 34).getValue() === '' &&
      !t.run('_bangQuyenApi_()').hasOwnProperty('DINH_KEM_CCCD_HOP_DONG'));
  });
  chay(function () {
    const t = moi();
    const A = t.tao('Nguyen A', '049000000001', '1111', 'A1');
    const B = t.tao('Tran B', '049000000002', '2222', 'B1');
    t.duHoSo(A.idHD);
    const kq = t.run('DOI_TINH_TRANG_HANG_LOAT_([{soDong:2,idHD:' + J(A.idHD) + '},{soDong:3,idHD:' + J(B.idHD) + '}], "Đang thực hiện")');
    kiem('DHS-07 duyệt hàng loạt: HĐ đủ hồ sơ chuyển được, HĐ thiếu bị từ chối kèm lý do', kq.soXong === 1 && kq.loi.length === 1 && kq.loi[0].idHD === B.idHD && /bổ sung/.test(kq.loi[0].loi), J(kq));
    // Lưu cả hồ sơ (trang Nhập liệu) kèm chọn "Đang thực hiện" khi còn thiếu: dữ liệu khác vẫn lưu, trạng thái giữ nguyên + cảnh báo
    const kqL = t.run('LUU_HOP_DONG_DAY_DU_(' + J({ idHD: B.idHD, hopDong: { sdtChuRung: '0905999888', tinhTrang: 'Đang thực hiện' }, rung: [], taiKhoan: [] }) + ')');
    const rowB = t.ss.getSheetByName('HD_NCC').getDataRange().getValues().find(r => r[29] === B.idHD);
    kiem('DHS-08 Lưu hồ sơ chọn "Đang thực hiện" khi thiếu: lưu SĐT, giữ "Chờ thực hiện", trả cảnh báo bổ sung',
      kqL.thanhCong && String(rowB[9]) === '0905999888' && rowB[30] === 'Chờ thực hiện' && /bổ sung đầy đủ hồ sơ/.test(kqL.canhBaoHoSo) && kqL.thieuHoSo.length > 0, J(kqL));
    t.duHoSo(B.idHD);
    const kqL2 = t.run('LUU_HOP_DONG_DAY_DU_(' + J({ idHD: B.idHD, hopDong: { tinhTrang: 'Đang thực hiện' }, rung: [], taiKhoan: [] }) + ')');
    kiem('DHS-09 đủ hồ sơ rồi lưu lại -> chuyển "Đang thực hiện"', kqL2.thanhCong && !kqL2.canhBaoHoSo &&
      t.ss.getSheetByName('HD_NCC').getDataRange().getValues().find(r => r[29] === B.idHD)[30] === 'Đang thực hiện', J(kqL2));
    const q = t.run('_bangQuyenApi_()');
    kiem('DHS-10 API xem thiếu hồ sơ mở cho quyền Xem', q.KIEM_TRA_DU_HO_SO_HD.quyen === t.run('QUYEN.XEM'));
    // Lô chỉ có địa chỉ rừng + file hồ sơ pháp lý + tọa độ (không diện tích/đơn giá/loại hồ sơ/số giấy tờ) vẫn đủ
    const C = t.run('TAO_HOP_DONG_MOI_(' + J({ tenChuRung: 'Le C', cccdChuRung: '049000000003', ngayKy: '2026-09-11', soTK: '3333', nganHang: 'VCB', maSoThue: '049000000003', diaChiThuongTru: 'Quế Lâm' }) + ')');
    const loC = t.run('THEM_LO_RUNG_MOI_(' + J({ idHD: C.idHD, diaChiRung: 'Thôn C', dinhKemGiayTo: 'https://drive.google.com/file/d/HSC/view' }) + ')');
    t.run('CAP_NHAT_GPS_RUNG_(' + J(loC.idRung) + ', {lat:15.5, lng:108.1, anhUrl:"https://drive.google.com/file/d/AC/view"}, false)');
    const ktC = t.run('KIEM_TRA_DU_HO_SO_HD_(' + J(C.idHD) + ')');
    kiem('DHS-11 đủ: CCCD, MST, tên, địa chỉ, TK + lô có địa chỉ rừng, file hồ sơ pháp lý, tọa độ, ảnh (lô rỗng tự tạo bỏ qua)', ktC.du === true, J(ktC));
  });
  chay(function () {
    const t = moi();
    const A = t.tao('Nguyen A', '049000000001', '1111', 'A1'); // lô "Thôn A"
    const idRung = t.ss.getSheetByName('HD_RUNG').getRange(2, 3).getValue();
    let soLanGoi = 0;
    gaiMaps(t, () => { soLanGoi++; return { status: 'OK', results: [{ types: ['locality', 'political'], geometry: { location: { lat: 15.60, lng: 108.10 } } }] }; });
    const gan = t.run('CAP_NHAT_GPS_RUNG_(' + J(idRung) + ', {lat:"15.61", lng:"108.11"}, false)');
    kiem('GPS-01 điểm cách địa chỉ rừng ~1,5 km -> không cảnh báo', gan.thanhCong && gan.canhBaoKhoangCach === '', J(gan));
    const soDiem = t.ss.getSheetByName('HD_GPS').getLastRow();
    const xa = t.run('CAP_NHAT_GPS_RUNG_(' + J(idRung) + ', {lat:"15.80", lng:"108.10"}, false)');
    kiem('GPS-02 điểm cách ~22 km -> VẪN lưu + cảnh báo "trên 5 km"', xa.thanhCong && /cách địa chỉ rừng "Thôn A" khoảng 22,\d km \(trên 5 km\)/.test(xa.canhBaoKhoangCach) &&
      t.ss.getSheetByName('HD_GPS').getLastRow() === soDiem + 1, J(xa));
    kiem('GPS-03 định vị địa chỉ chỉ gọi Maps 1 lần (nhớ theo địa chỉ)', soLanGoi === 1, soLanGoi);
    t.run('CAP_NHAT_LO_RUNG_(' + J(idRung) + ', {diaChiRung: "Quảng Nam"})');
    gaiMaps(t, () => ({ status: 'OK', results: [{ types: ['administrative_area_level_1', 'political'], geometry: { location: { lat: 15.6, lng: 108.1 } } }] }));
    const tho = t.run('CAP_NHAT_GPS_RUNG_(' + J(idRung) + ', {lat:"16.5", lng:"107.5"}, false)');
    kiem('GPS-04 địa chỉ chỉ định vị được mức tỉnh -> không cảnh báo (quá thô)', tho.thanhCong && tho.canhBaoKhoangCach === '', J(tho));
    t.run('CAP_NHAT_LO_RUNG_(' + J(idRung) + ', {diaChiRung: "Thôn B, xã Quế Lâm"})');
    gaiMaps(t, () => { throw new Error('Maps quota'); });
    const loi = t.run('CAP_NHAT_GPS_RUNG_(' + J(idRung) + ', {lat:"16.5", lng:"107.5"}, false)');
    kiem('GPS-05 Maps lỗi -> vẫn lưu, không cảnh báo', loi.thanhCong && loi.canhBaoKhoangCach === '', J(loi));
    t.run('CAP_NHAT_LO_RUNG_(' + J(idRung) + ', {diaChiRung: "Lô 3 — 15.600000, 108.100000"})');
    gaiMaps(t, () => { throw new Error('không được gọi'); });
    const sanToaDo = t.run('CAP_NHAT_GPS_RUNG_(' + J(idRung) + ', {lat:"15.9", lng:"108.1"}, false)');
    kiem('GPS-06 địa chỉ rừng có ghi sẵn tọa độ -> so thẳng, không cần Maps', /trên 5 km/.test(sanToaDo.canhBaoKhoangCach), J(sanToaDo));
    // Lưu chính thức (Nhập liệu): HĐ mới chọn "Đang thực hiện" + GPS xa -> cảnh báo khoảng cách + cảnh báo thiếu hồ sơ, giữ "Chờ thực hiện"
    gaiMaps(t, () => ({ status: 'OK', results: [{ types: ['locality'], geometry: { location: { lat: 15.60, lng: 108.10 } } }] }));
    const du = { idHD: null, hopDong: { tenChuRung: 'Le C', cccdChuRung: '049000000003', ngayKy: '2026-09-12', ngayCap: '2020-01-01', noiCap: 'Cục CS', sdtChuRung: '0905',
      diaChiThuongTru: 'Quế Phước', soTK: '333', nganHang: 'VCB', uyQuyenTT: 'Không', tinhTrang: 'Đang thực hiện', maSoThue: '049000000003' },
      rung: [{ diaChiRung: 'Thôn C', dienTichM2: 10000, donGia: 1000, khoiLuongDuKien: 120, hoSoNguonGoc: 'GCN', soGiayTo: 'S1', gpsMoi: [{ lat: 15.9, lng: 108.1, anhUrl: 'https://drive.google.com/file/d/G/view' }] }], taiKhoan: [] };
    const kqCT = t.run('luuChinhThucThucThi_(' + J(du) + ', "NHAP_TEST1")');
    const ttC = t.ss.getSheetByName('HD_NCC').getDataRange().getValues().find(r => r[29] === kqCT.idHD)[30];
    const cb = (kqCT.canhBao || []).join(' | ');
    kiem('DHS-12 Lưu chính thức HĐ mới chọn "Đang thực hiện": kiểm tra sau khi ghi lô + GPS, thiếu file hồ sơ rừng -> giữ "Chờ thực hiện" + cảnh báo; GPS xa -> cảnh báo 5 km',
      kqCT.thanhCong && ttC === 'Chờ thực hiện' && /file hồ sơ pháp lý đính kèm/.test(cb) && !/tọa độ GPS/.test(cb) && /trên 5 km/.test(cb), J(kqCT));
  });
} catch (e) { truot++; ketQua.push('LỖI ' + e.stack); }

console.log(ketQua.join('\n'));
console.log('\n' + dat + ' đạt, ' + truot + ' trượt');
process.exit(truot ? 1 : 0);
