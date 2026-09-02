/**
 * ============================================================
 *  22_XuatBaoCaoMisa.gs
 *  Đồng bộ dữ liệu vào Google Sheet CỐ ĐỊNH "Update_Hopdong_NCC_DN" (2 sheet
 *  con Update_DM_NCC + Update_HDMB, đúng khuôn nhập liệu MISA), rồi xuất
 *  chính Sheet đó thành file .xlsx.
 *
 *  ⚠️ ĐÃ ĐỔI KIẾN TRÚC (theo yêu cầu người dùng):
 *  - TRƯỚC: mỗi lần xuất tạo 1 Google Sheet TẠM, tính lại từ đầu, xuất .xlsx
 *    rồi XÓA sheet tạm — không có nơi lưu trữ cố định nào, không đồng bộ được
 *    với hệ thống MISA đang dùng 1 Sheet Google riêng để theo dõi.
 *  - GIỜ: đồng bộ (UPSERT — cập nhật nếu đã có, thêm mới nếu chưa có, LOẠI
 *    TRÙNG theo khóa) vào ĐÚNG 1 Sheet CỐ ĐỊNH (cấu hình 1 lần), rồi xuất
 *    CHÍNH Sheet đó thành .xlsx — không cần tính lại từ đầu, không tạo/xóa
 *    sheet tạm nữa. Khóa upsert: ID_HD (Update_DM_NCC), KEY_HD=ID_RUNG (Update_HDMB).
 *
 *  QUY TẮC ĐÃ XÁC NHẬN VỚI NGƯỜI DÙNG:
 *  - Cột "Người liên hệ": có ủy quyền thanh toán → lấy thông tin NGƯỜI ỦY
 *    QUYỀN; không → lấy thông tin CHỦ RỪNG.
 *  - Cột "Mã hàng": cố định theo Thiết lập (mặc định "GK").
 *  - Xuất TẤT CẢ hợp đồng, không phân biệt tình trạng.
 *  - "Mã số thuế"/"Mã nhà cung cấp"/"Mã NCC": ưu tiên MST đã nhập, fallback CCCD.
 *  - CCCD/SĐT/Số TK/MST luôn định dạng TEXT — tránh mất số 0 đầu.
 * ============================================================
 */

/** Đọc thiết lập xuất báo cáo MISA hiện tại (Script Properties) — có mặc định an toàn nếu chưa cấu hình lần nào */
function LAY_THIET_LAP_MISA() {
  const p = PropertiesService.getScriptProperties();
  return {
    maHangMacDinh: p.getProperty('MISA_MA_HANG_MAC_DINH') || 'GK',
    tenHangMacDinh: p.getProperty('MISA_TEN_HANG_MAC_DINH') || 'Gỗ tròn keo',
    donViTinhMacDinh: p.getProperty('MISA_DON_VI_TINH_MAC_DINH') || 'Tấn',
    loaiTienMacDinh: p.getProperty('MISA_LOAI_TIEN_MAC_DINH') || 'VNĐ',
    vungDinhDangMisa: p.getProperty('MISA_VUNG_DINH_DANG') || 'vi_VN',
    masterSheetUrl: p.getProperty('MISA_MASTER_SHEET_ID') ? ('https://docs.google.com/spreadsheets/d/' + p.getProperty('MISA_MASTER_SHEET_ID') + '/edit') : ''
  };
}

/** Lưu lại thiết lập xuất báo cáo MISA (Script Properties) */
function LUU_THIET_LAP_MISA(thietLap) {
  const p = PropertiesService.getScriptProperties();
  p.setProperty('MISA_MA_HANG_MAC_DINH', (thietLap.maHangMacDinh || 'GK').toString().trim());
  p.setProperty('MISA_TEN_HANG_MAC_DINH', (thietLap.tenHangMacDinh || 'Gỗ tròn keo').toString().trim());
  p.setProperty('MISA_DON_VI_TINH_MAC_DINH', (thietLap.donViTinhMacDinh || 'Tấn').toString().trim());
  p.setProperty('MISA_LOAI_TIEN_MAC_DINH', (thietLap.loaiTienMacDinh || 'VNĐ').toString().trim());
  p.setProperty('MISA_VUNG_DINH_DANG', (thietLap.vungDinhDangMisa || 'vi_VN').toString().trim());
  // ⚠️ MỚI: URL/ID của Sheet CỐ ĐỊNH "Update_Hopdong_NCC_DN" — chấp nhận dán
  // nguyên URL, tự tách ra đúng ID để lưu.
  if (thietLap.masterSheetUrl !== undefined) {
    const url = (thietLap.masterSheetUrl || '').toString().trim();
    const khop = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
    p.setProperty('MISA_MASTER_SHEET_ID', khop ? khop[1] : url); // nếu dán thẳng ID (không phải URL đầy đủ) thì dùng luôn
  }
  return { thanhCong: true, thongBao: 'Đã lưu thiết lập xuất báo cáo MISA.' };
}

/** Lấy (hoặc tạo mới) thư mục Drive dùng để lưu các file báo cáo MISA đã xuất */
function layThuMucXuatMisa_() {
  const idDaCauHinh = PropertiesService.getScriptProperties().getProperty('MISA_FOLDER_ID');
  if (idDaCauHinh) {
    try { return DriveApp.getFolderById(idDaCauHinh); } catch (e) { /* ID đã lưu không mở được nữa -> rơi về tìm/tạo theo tên bên dưới */ }
  }
  const ten = 'BaoCao_MISA';
  const it = DriveApp.getFoldersByName(ten);
  if (it.hasNext()) return it.next();
  return DriveApp.createFolder(ten);
}

const MISA_HEADER_NCC_ = [
  'Là tổ chức/cá nhân', 'Là khách hàng', 'Mã nhà cung cấp (*)', 'Tên nhà cung cấp (*)', 'Địa chỉ',
  'Mã số thuế', 'Điện thoại', 'Fax', 'Email', 'Website', 'Nhóm KH/NCC', 'Số CCCD', 'Ngày cấp', 'Nơi cấp',
  'Xưng hô', 'Họ và tên NLH', 'Chức danh', 'Địa chỉ người liên hệ', 'ĐT di động', 'ĐT cơ quan',
  'ĐT di động khác', 'Email người liên hệ', 'Số tài khoản', 'Tên ngân hàng', 'Chi nhánh',
  'Tỉnh/TP TK ngân hàng', 'ID_HD', 'KEY_NCC', 'Trigger Export', 'Link_file'
];
const MISA_HEADER_HDMB_ = [
  'Số hợp đồng (*)', 'Ngày ký (*)', 'Trích yếu', 'Loại tiền', 'Tỷ giá', 'Giá trị HĐ', 'Giá trị HĐ quy đổi',
  'Mã NCC', 'Địa chỉ', 'Mã số thuế', 'Người liên hệ', 'Tình trạng', 'Mã hàng', 'Tên hàng', 'Đơn vị tính',
  'Số lượng', 'Đơn giá', 'Thành tiền', 'Diện tích_m2', 'Tọa độ (Kinh độ/Vĩ độ)', 'Hồ sơ pháp lý',
  'Số giấy tờ', 'ID_HD', 'KEY_HD', 'Trigger Export', 'Link_File'
];
// Cột (1-indexed) cần định dạng TEXT — tránh mất số 0 đầu
const MISA_COT_TEXT_NCC_ = [3, 6, 7, 12, 19, 20, 21, 23];
const MISA_COT_TEXT_HDMB_ = [1, 8, 10];
// Cột dùng làm KHÓA khi upsert (0-indexed, khớp header ở trên)
const MISA_COT_KHOA_NCC_ = 26; // "ID_HD"
const MISA_COT_KHOA_HDMB_ = 23; // "KEY_HD" (= idRung)

/** Tính dữ liệu MISA MỚI NHẤT từ HD_NCC/HD_RUNG/HD_GPS — KHÔNG ghi gì cả, chỉ trả về mảng dòng để nơi khác dùng (đồng bộ hoặc xem trước) */
function layDuLieuMisaHienTai_(tuNgay, denNgay) {
  let nccRows = readData_(SHEET_NAME.HD_NCC);
  let rungRows = readData_(SHEET_NAME.HD_RUNG);
  const thietLap = LAY_THIET_LAP_MISA();

  const tuNgayDate = tuNgay ? new Date(tuNgay) : null;
  const denNgayDate = denNgay ? new Date(denNgay) : null;
  if (tuNgayDate || denNgayDate) {
    nccRows = nccRows.filter(function (r) {
      const ngayKy = new Date(r[NCC_COL.NGAY_KY]);
      if (tuNgayDate && ngayKy < tuNgayDate) return false;
      if (denNgayDate && ngayKy > denNgayDate) return false;
      return true;
    });
    const idHopLe = {};
    nccRows.forEach(function (r) { idHopLe[(r[NCC_COL.ID_HD] || '').toString().trim()] = true; });
    rungRows = rungRows.filter(function (r) { return idHopLe[(r[RUNG_COL.ID_KEY_HD] || '').toString().trim()]; });
  }

  let theoIdRung = {};
  try { theoIdRung = layCoAnhVaGpsTrucTiep_().theoIdRung; } catch (e) { /* không có GPS thì để trống, không chặn */ }

  const rowsNCC = nccRows.map(function (r) {
    // ⚠️ SỬA: trước so khớp chính xác 'Có' (phân biệt hoa/thường) nên bỏ sót dữ liệu
    // ghi thường 'có' — giờ dùng đúng cách so khớp đã chuẩn hóa như kiemTraUyQuyenVaTaiKhoan_()
    // ở 02_DocumentChecker.gs, tránh xuất sai người liên hệ/địa chỉ vào MISA.
    const uyQuyenChuan = (r[NCC_COL.UY_QUYEN_TT] || '').toString().trim().toLowerCase();
    const coUyQuyen = uyQuyenChuan === 'có' || uyQuyenChuan === 'co';
    const cccd = (r[NCC_COL.CCCD_CHU_RUNG] || '').toString().trim();
    const masoThue = (r[NCC_COL.MA_SO_THUE] || '').toString().trim() || cccd;
    return [
      '', '', cccd, r[NCC_COL.TEN_CHU_RUNG] || '', r[NCC_COL.DIA_CHI_TT] || '',
      masoThue, r[NCC_COL.SDT_CHU_RUNG] || '', '', '', '', r[NCC_COL.NHOM_KH] || '',
      cccd, r[NCC_COL.NGAY_CAP] || '', r[NCC_COL.NOI_CAP] || '',
      '', coUyQuyen ? (r[NCC_COL.TEN_UY_QUYEN] || '') : (r[NCC_COL.TEN_CHU_RUNG] || ''), '',
      coUyQuyen ? (r[NCC_COL.DIA_CHI_UQ] || '') : (r[NCC_COL.DIA_CHI_TT] || ''),
      coUyQuyen ? (r[NCC_COL.SDT_UQ] || '') : (r[NCC_COL.SDT_CHU_RUNG] || ''), '', '',
      coUyQuyen ? (r[NCC_COL.EMAIL_UQ] || '') : '',
      r[NCC_COL.SO_TK] || '', r[NCC_COL.NGAN_HANG] || '', r[NCC_COL.CHI_NHANH_NH] || '', '',
      r[NCC_COL.ID_HD] || '', '', '', ''
    ];
  });

  const nccByIdHD = {};
  nccRows.forEach(function (r) { nccByIdHD[(r[NCC_COL.ID_HD] || '').toString().trim()] = r; });

  const rowsHDMB = [];
  rungRows.forEach(function (r) {
    const idHD = (r[RUNG_COL.ID_KEY_HD] || '').toString().trim();
    const idRung = (r[RUNG_COL.ID_RUNG] || '').toString().trim();
    const ncc = nccByIdHD[idHD];
    if (!ncc) return; // lô rừng mồ côi — bỏ qua, không tự đoán dữ liệu

    // ⚠️ SỬA: cùng lỗi phân biệt hoa/thường như ở rowsNCC phía trên — chuẩn hóa lowercase
    const uyQuyenHDMBChuan = (ncc[NCC_COL.UY_QUYEN_TT] || '').toString().trim().toLowerCase();
    const coUyQuyen = uyQuyenHDMBChuan === 'có' || uyQuyenHDMBChuan === 'co';
    const cccd = (ncc[NCC_COL.CCCD_CHU_RUNG] || '').toString().trim();
    const masoThue = (ncc[NCC_COL.MA_SO_THUE] || '').toString().trim() || cccd;
    const nguoiLienHe = coUyQuyen ? (ncc[NCC_COL.TEN_UY_QUYEN] || '') : (ncc[NCC_COL.TEN_CHU_RUNG] || '');
    const soLuong = Number(r[RUNG_COL.KHOI_LUONG_DK]) || 0;
    const donGia = Number(r[RUNG_COL.DON_GIA]) || 0;
    const gps = theoIdRung[idRung];
    const toaDo = gps && gps.toaDo ? (gps.toaDo.lat.toFixed(6) + ', ' + gps.toaDo.lng.toFixed(6)) : '';

    rowsHDMB.push([
      r[RUNG_COL.SO_HD] || '', r[RUNG_COL.NGAY_KY] || '', '', thietLap.loaiTienMacDinh, '',
      soLuong * donGia, '', cccd, r[RUNG_COL.THUONG_TRU] || '', masoThue, nguoiLienHe, ncc[NCC_COL.TINH_TRANG] || '',
      thietLap.maHangMacDinh, thietLap.tenHangMacDinh, thietLap.donViTinhMacDinh, soLuong, donGia, soLuong * donGia,
      Number(r[RUNG_COL.DIEN_TICH_M2]) || 0, toaDo,
      r[RUNG_COL.HO_SO_NGUON_GOC] || '', r[RUNG_COL.SO_GIAY_TO] || '',
      idHD, idRung, '', ''
    ]);
  });

  return { headerNCC: MISA_HEADER_NCC_, headerHDMB: MISA_HEADER_HDMB_, rowsNCC: rowsNCC, rowsHDMB: rowsHDMB, thietLap: thietLap };
}

/**
 * Đồng bộ (UPSERT + LOẠI TRÙNG) vào Sheet CỐ ĐỊNH đã cấu hình — không xóa/tạo
 * lại từ đầu, chỉ CẬP NHẬT đúng dòng đã có (theo khóa) hoặc THÊM dòng mới.
 * Dòng trùng khóa CÓ SẴN trong Sheet (nếu có, do nhập tay/lỗi trước đây) sẽ bị
 * GIẢM CÒN 1 DÒNG (giữ dòng đầu tiên, xóa các dòng trùng phía sau).
 */
function DONG_BO_VAO_MISA_MASTER(tuNgay, denNgay) {
  const masterId = PropertiesService.getScriptProperties().getProperty('MISA_MASTER_SHEET_ID');
  if (!masterId) return { thanhCong: false, loi: 'Chưa cấu hình Sheet cố định "Update_Hopdong_NCC_DN". Vào Thiết lập → 📊 Báo cáo MISA để dán URL.' };

  let ssMaster;
  try { ssMaster = SpreadsheetApp.openById(masterId); } catch (e) { return { thanhCong: false, loi: 'Không mở được Sheet đã cấu hình: ' + e.message }; }

  const duLieu = layDuLieuMisaHienTai_(tuNgay, denNgay);
  const kqNCC = upsertVaoSheetMisa_(ssMaster, 'Update_DM_NCC', duLieu.headerNCC, duLieu.rowsNCC, MISA_COT_KHOA_NCC_, MISA_COT_TEXT_NCC_);
  const kqHDMB = upsertVaoSheetMisa_(ssMaster, 'Update_HDMB', duLieu.headerHDMB, duLieu.rowsHDMB, MISA_COT_KHOA_HDMB_, MISA_COT_TEXT_HDMB_);

  ghiNhatKy_('Đồng bộ MISA Master', '', 'NCC: +' + kqNCC.soThem + ' /~' + kqNCC.soCapNhat + ' (dọn ' + kqNCC.soDongTrongDaDon + ' dòng trống, gộp ' + kqNCC.soTrungDaGop + ' trùng) — HDMB: +' + kqHDMB.soThem + ' /~' + kqHDMB.soCapNhat + ' (dọn ' + kqHDMB.soDongTrongDaDon + ' dòng trống, gộp ' + kqHDMB.soTrungDaGop + ' trùng)');
  return { thanhCong: true, ncc: kqNCC, hdmb: kqHDMB, masterUrl: ssMaster.getUrl() };
}

/**
 * Upsert 1 sheet con — đọc TOÀN BỘ dữ liệu hiện có, GỘP với dữ liệu mới (mới
 * luôn ghi đè cũ nếu trùng khóa), rồi GHI LẠI TỪ ĐẦU vùng dữ liệu (dòng 2 trở
 * đi) — cách này xử lý được ĐỦ 3 vấn đề trong 1 lượt: (1) cập nhật dòng đã có,
 * (2) thêm dòng mới, (3) DỌN SẠCH dòng trống/dòng trùng khóa còn sót lại từ
 * trước (thực tế phát hiện: file gốc có hàng trăm dòng trống xen giữa do
 * template/thao tác cũ để lại — không thể xử lý bằng cách sửa từng dòng riêng lẻ).
 */
function upsertVaoSheetMisa_(ssMaster, tenSheet, header, rowsMoi, cotKhoa, cotText) {
  let sh = ssMaster.getSheetByName(tenSheet);
  if (!sh) sh = ssMaster.insertSheet(tenSheet);
  if (sh.getLastRow() === 0) sh.getRange(1, 1, 1, header.length).setValues([header]);

  const lastRow = sh.getLastRow();
  const duLieuHienCo = lastRow >= 2 ? sh.getRange(2, 1, lastRow - 1, header.length).getValues() : [];

  const ketQuaTheoKhoa = {}; // khóa -> dòng dữ liệu cuối cùng (mới nhất thắng nếu trùng)
  const khongCoKhoa = []; // dòng có dữ liệu nhưng thiếu khóa (hiếm, giữ nguyên không đụng tới)
  let soDongTrongDaDon = 0;
  duLieuHienCo.forEach(function (r) {
    const conDuLieu = r.some(function (o) { return o !== '' && o !== null; });
    if (!conDuLieu) { soDongTrongDaDon++; return; } // dòng trống hoàn toàn -> dọn sạch, không giữ lại
    const khoa = (r[cotKhoa] || '').toString().trim();
    if (khoa) ketQuaTheoKhoa[khoa] = r; else khongCoKhoa.push(r);
  });
  const soKhoaCuTruocKhiGop = Object.keys(ketQuaTheoKhoa).length;
  // Số dòng bị "gộp" do trùng khóa NGAY TRONG dữ liệu cũ (trước khi có dữ liệu mới) — nếu có
  const soTrungKhoaCu = duLieuHienCo.length - soDongTrongDaDon - khongCoKhoa.length - soKhoaCuTruocKhiGop;

  let soThem = 0, soCapNhat = 0;
  rowsMoi.forEach(function (row) {
    const khoa = (row[cotKhoa] || '').toString().trim();
    if (khoa && ketQuaTheoKhoa.hasOwnProperty(khoa)) soCapNhat++; else soThem++;
    if (khoa) ketQuaTheoKhoa[khoa] = row; // dữ liệu MỚI luôn thắng nếu trùng khóa với dữ liệu cũ
  });

  const tatCa = khongCoKhoa.concat(Object.values(ketQuaTheoKhoa));
  if (lastRow >= 2) sh.getRange(2, 1, lastRow - 1, header.length).clearContent(); // dọn sạch toàn bộ vùng cũ trước khi ghi lại gọn gàng
  if (tatCa.length) {
    cotText.forEach(function (c) { sh.getRange(2, c, tatCa.length, 1).setNumberFormat('@'); }); // định dạng TEXT TRƯỚC khi ghi, tránh mất số 0
    sh.getRange(2, 1, tatCa.length, header.length).setValues(tatCa);
  }

  return { soThem: soThem, soCapNhat: soCapNhat, soDongTrongDaDon: soDongTrongDaDon, soTrungDaGop: Math.max(0, soTrungKhoaCu), tongSoDongSauCung: tatCa.length };
}

/**
 * Đồng bộ vào Sheet cố định XONG rồi xuất CHÍNH Sheet đó thành .xlsx — không
 * còn tạo/xóa sheet tạm như trước, không tính lại dữ liệu 2 lần.
 */
/**
 * ⚠️ ĐÃ ĐƠN GIẢN HÓA THEO YÊU CẦU (bản trước rắc rối — tạo file tạm lọc riêng
 * lúc xuất, gây rối): giờ CHỈ 1 quy tắc duy nhất, dễ hiểu —
 * - Từ ngày/Đến ngày QUYẾT ĐỊNH PHẠM VI ĐỒNG BỘ: có chọn ngày -> chỉ đồng bộ
 *   (cập nhật hoặc tạo mới) đúng hợp đồng trong khoảng đó; để TRỐNG cả 2 ô ->
 *   xem như đồng bộ TẤT CẢ.
 * - XUẤT EXCEL = xuất THẲNG nguyên Sheet cố định sau khi đồng bộ xong — KHÔNG
 *   còn tạo/xóa file tạm nào nữa. File luôn phản ánh ĐÚNG những gì đang có
 *   trong Sheet cố định tại thời điểm xuất (kể cả dữ liệu từ các lần đồng bộ
 *   trước đó, không riêng lần này).
 */
function XUAT_BAO_CAO_MISA(tuNgay, denNgay) {
  const kqDongBo = DONG_BO_VAO_MISA_MASTER(tuNgay, denNgay);
  if (!kqDongBo.thanhCong) return kqDongBo;

  const masterId = PropertiesService.getScriptProperties().getProperty('MISA_MASTER_SHEET_ID');
  SpreadsheetApp.flush();
  const url = 'https://docs.google.com/spreadsheets/d/' + masterId + '/export?format=xlsx';
  const response = UrlFetchApp.fetch(url, { headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() } });
  const tenFile = 'Update_Hopdong_NCC_DN_' + Utilities.formatDate(new Date(), 'GMT+7', 'yyyyMMdd_HHmm') + '.xlsx';
  const blob = response.getBlob().setName(tenFile);
  const file = layThuMucXuatMisa_().createFile(blob);

  ghiNhatKy_('Xuất báo cáo MISA', '', tenFile + ' — ' + kqDongBo.ncc.tongSoDongSauCung + ' NCC, ' + kqDongBo.hdmb.tongSoDongSauCung + ' dòng HĐMB' + ((tuNgay || denNgay) ? ' (đã đồng bộ phạm vi ' + (tuNgay || '?') + ' → ' + (denNgay || '?') + ')' : ' (đã đồng bộ toàn bộ)'));

  return {
    thanhCong: true, url: file.getUrl(), tenFile: tenFile,
    soDongNCC: kqDongBo.ncc.tongSoDongSauCung, soDongHDMB: kqDongBo.hdmb.tongSoDongSauCung,
    folderUrl: file.getParents().hasNext() ? file.getParents().next().getUrl() : '',
    masterUrl: kqDongBo.masterUrl, daLocNgay: !!(tuNgay || denNgay)
  };
}

/**
 * ⚠️ CÔNG CỤ DỌN DẸP — các phiên bản code TRƯỚC ĐÂY (kể cả bản gốc trước khi
 * sửa lần này) từng tạo Google Sheet TẠM tên "TAM_XUAT_MISA_..." ở GỐC Drive
 * (không phải trong thư mục BaoCao_MISA) rồi xóa sau khi xuất xong — nếu có
 * lần nào bị lỗi/timeout giữa chừng, file tạm đó KHÔNG kịp xóa, còn sót lại.
 * Code HIỆN TẠI (từ bản sửa này) KHÔNG còn tạo file tạm nào nữa — hàm này chỉ
 * để DỌN SẠCH những gì đã lỡ sót lại từ trước, chạy 1 lần là đủ.
 */
function DON_FILE_TAM_MISA_CON_SOT() {
  const itNormal = DriveApp.getFilesByName('TAM_XUAT_MISA'); // tên cũ (không có timestamp) — phòng trường hợp hiếm
  const itSearch = DriveApp.searchFiles('title contains "TAM_XUAT_MISA_"'); // tên có timestamp, kiểu tìm phổ biến nhất
  const daXoa = [];
  const gomLai = function (it) {
    while (it.hasNext()) {
      const f = it.next();
      if (!f.isTrashed()) { f.setTrashed(true); daXoa.push(f.getName()); }
    }
  };
  gomLai(itNormal);
  gomLai(itSearch);
  return { thanhCong: true, soDaXoa: daXoa.length, danhSach: daXoa.slice(0, 20), thongBao: daXoa.length ? ('Đã chuyển ' + daXoa.length + ' file tạm còn sót vào Thùng rác.') : 'Không tìm thấy file tạm nào còn sót lại.' };
}

/** Chạy từ menu Google Sheet */
function DON_FILE_TAM_MISA_CON_SOT_TU_MENU() {
  const kq = DON_FILE_TAM_MISA_CON_SOT();
  SpreadsheetApp.getUi().alert(kq.thongBao + (kq.danhSach.length ? '\n\n' + kq.danhSach.join('\n') : ''));
}

/** Chạy từ menu Google Sheet — hiện link tải trực tiếp trong hộp thoại */
function XUAT_BAO_CAO_MISA_TU_MENU() {
  const ui = SpreadsheetApp.getUi();
  try {
    const kq = XUAT_BAO_CAO_MISA();
    if (!kq.thanhCong) { ui.alert('❌ ' + kq.loi); return; }
    ui.alert(
      '✅ Đã đồng bộ + xuất "' + kq.tenFile + '"\n' +
      '(' + kq.soDongNCC + ' nhà cung cấp, ' + kq.soDongHDMB + ' dòng hợp đồng mua bán)\n\n' +
      'Link tải file: ' + kq.url + (kq.folderUrl ? '\nThư mục chứa file: ' + kq.folderUrl : '') +
      '\nSheet gốc (Update_Hopdong_NCC_DN): ' + kq.masterUrl
    );
  } catch (e) {
    ui.alert('❌ Lỗi khi xuất báo cáo MISA: ' + e.message);
  }
}
