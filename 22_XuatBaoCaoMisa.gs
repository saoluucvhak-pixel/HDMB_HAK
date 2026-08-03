/**
 * ============================================================
 *  22_XuatBaoCaoMisa.gs
 *  Xuất báo cáo "Update_Hopdong_NCC_DN.xlsx" đúng khuôn nhập liệu của phần mềm
 *  MISA — gồm 2 sheet:
 *    - Update_DM_NCC: Danh mục Nhà cung cấp (1 dòng / hợp đồng, lấy từ HD_NCC)
 *    - Update_HDMB:   Hợp đồng mua bán (1 dòng / lô rừng, lấy từ HD_RUNG)
 *
 *  QUY TẮC ĐÃ XÁC NHẬN VỚI NGƯỜI DÙNG:
 *  - Cột "Người liên hệ" (Họ và tên NLH / Địa chỉ / ĐT di động / Email người
 *    liên hệ ở Update_DM_NCC; "Người liên hệ" ở Update_HDMB): nếu hợp đồng CÓ
 *    ủy quyền thanh toán → lấy thông tin người ỦY QUYỀN; nếu KHÔNG → lấy chính
 *    thông tin CHỦ RỪNG.
 *  - Cột "Mã hàng" (Update_HDMB): luôn điền cố định "GK" (chưa có cơ chế phân
 *    loại mã hàng chi tiết hơn trong dữ liệu hiện có).
 *  - Xuất TẤT CẢ hợp đồng, không phân biệt tình trạng.
 *  - "Mã số thuế"/"Mã nhà cung cấp"/"Mã NCC": dùng chính Số CCCD (thông lệ kế
 *    toán VN với cá nhân chưa có MST riêng).
 *
 *  Các cột "Trigger Export"/"Link_file"/"KEY_NCC"/"KEY_HD" giữ lại trong file
 *  xuất để đúng cấu trúc cột với khuôn mẫu MISA gốc, nhưng để TRỐNG (không
 *  phục vụ mục đích gì trong hệ thống này, chỉ để không lệch số cột nếu MISA
 *  yêu cầu đúng khuôn).
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
    vungDinhDangMisa: p.getProperty('MISA_VUNG_DINH_DANG') || 'vi_VN' // ⚠️ MỚI: vùng định dạng RIÊNG cho file xuất MISA, ĐỘC LẬP với vùng của hệ thống chính (vd hệ thống dùng vi_VN nhưng MISA yêu cầu định dạng khác)
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
  return { thanhCong: true, thongBao: 'Đã lưu thiết lập xuất báo cáo MISA.' };
}

/** Lấy (hoặc tạo mới) thư mục Drive dùng để lưu các file báo cáo MISA đã xuất —
 *  ưu tiên thư mục đã cấu hình qua trang Thiết lập (Script Property MISA_FOLDER_ID),
 *  chỉ tự tạo/tìm theo tên cố định "BaoCao_MISA" nếu chưa từng cấu hình. */
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

function XUAT_BAO_CAO_MISA(tuNgay, denNgay) {
  let nccRows = readData_(SHEET_NAME.HD_NCC);
  let rungRows = readData_(SHEET_NAME.HD_RUNG);
  const thietLap = LAY_THIET_LAP_MISA(); // ⚠️ ĐÃ SỬA: trước đây "Mã hàng"/"Tên hàng"/"Đơn vị tính"/"Loại tiền" hard-code cứng trong code — giờ đọc từ thiết lập có thể chỉnh trong webapp (trang "⚙️ Thiết lập"), có giá trị mặc định an toàn nếu chưa từng cấu hình.

  // ---- Lọc theo khoảng Ngày ký (nếu có truyền vào) — chỉ áp dụng cho hợp đồng,
  // rồi lọc lô rừng theo ĐÚNG các hợp đồng còn lại sau khi lọc (không lọc lô rừng
  // theo ngày ký riêng, vì lô rừng dùng chung ngày ký với hợp đồng cha).
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

  // Đọc GPS 1 LẦN DUY NHẤT cho toàn bộ, tránh đọc lại HD_GPS theo từng dòng
  // (dùng lại hàm đã có sẵn ở 00_Config.gs)
  let theoIdRung = {};
  try { theoIdRung = layCoAnhVaGpsTrucTiep_().theoIdRung; } catch (e) { /* không có GPS thì để trống, không chặn xuất báo cáo */ }

  // ---- Tạo spreadsheet TẠM để dựng 2 sheet đúng khuôn, sau đó xuất .xlsx rồi xóa file tạm ----
  const ssTam = SpreadsheetApp.create('TAM_XUAT_MISA_' + new Date().getTime());
  const shNCC = ssTam.getSheets()[0];
  shNCC.setName('Update_DM_NCC');
  const shHDMB = ssTam.insertSheet('Update_HDMB');

  // ============ SHEET 1: Update_DM_NCC ============
  const headerNCC = [
    'Là tổ chức/cá nhân', 'Là khách hàng', 'Mã nhà cung cấp (*)', 'Tên nhà cung cấp (*)', 'Địa chỉ',
    'Mã số thuế', 'Điện thoại', 'Fax', 'Email', 'Website', 'Nhóm KH/NCC', 'Số CCCD', 'Ngày cấp', 'Nơi cấp',
    'Xưng hô', 'Họ và tên NLH', 'Chức danh', 'Địa chỉ người liên hệ', 'ĐT di động', 'ĐT cơ quan',
    'ĐT di động khác', 'Email người liên hệ', 'Số tài khoản', 'Tên ngân hàng', 'Chi nhánh',
    'Tỉnh/TP TK ngân hàng', 'ID_HD', 'KEY_NCC', 'Trigger Export', 'Link_file'
  ];
  shNCC.getRange(1, 1, 1, headerNCC.length).setValues([headerNCC]);
  // Cột Mã nhà cung cấp/Mã số thuế/Số CCCD/Điện thoại/Số tài khoản đều là số dễ
  // mất số 0 đầu -> đặt TEXT trước khi ghi. ⚠️ ĐÃ SỬA: trước đây thiếu cột
  // "Điện thoại" (7), "ĐT di động" (19), "ĐT cơ quan" (20), "ĐT di động khác" (21),
  // "Số tài khoản" (23) — các cột này bị Excel tự chuyển thành số khi xuất.
  [3, 6, 7, 12, 19, 20, 21, 23].forEach(function (c) { shNCC.getRange(2, c, Math.max(nccRows.length, 1), 1).setNumberFormat('@'); });

  const rowsNCC = nccRows.map(function (r) {
    const coUyQuyen = (r[NCC_COL.UY_QUYEN_TT] || '').toString().trim() === 'Có';
    const cccd = (r[NCC_COL.CCCD_CHU_RUNG] || '').toString().trim();
    return [
      '', '', cccd, r[NCC_COL.TEN_CHU_RUNG] || '', r[NCC_COL.DIA_CHI_TT] || '',
      cccd, r[NCC_COL.SDT_CHU_RUNG] || '', '', '', '', r[NCC_COL.NHOM_KH] || '',
      cccd, r[NCC_COL.NGAY_CAP] || '', r[NCC_COL.NOI_CAP] || '',
      '', coUyQuyen ? (r[NCC_COL.TEN_UY_QUYEN] || '') : (r[NCC_COL.TEN_CHU_RUNG] || ''), '',
      coUyQuyen ? (r[NCC_COL.DIA_CHI_UQ] || '') : (r[NCC_COL.DIA_CHI_TT] || ''),
      coUyQuyen ? (r[NCC_COL.SDT_UQ] || '') : (r[NCC_COL.SDT_CHU_RUNG] || ''), '', '',
      coUyQuyen ? (r[NCC_COL.EMAIL_UQ] || '') : '',
      r[NCC_COL.SO_TK] || '', r[NCC_COL.NGAN_HANG] || '', r[NCC_COL.CHI_NHANH_NH] || '', '',
      r[NCC_COL.ID_HD] || '', '', '', ''
    ];
  });
  if (rowsNCC.length) shNCC.getRange(2, 1, rowsNCC.length, headerNCC.length).setValues(rowsNCC);

  // ============ SHEET 2: Update_HDMB (1 dòng / lô rừng) ============
  const headerHDMB = [
    'Số hợp đồng (*)', 'Ngày ký (*)', 'Trích yếu', 'Loại tiền', 'Tỷ giá', 'Giá trị HĐ', 'Giá trị HĐ quy đổi',
    'Mã NCC', 'Địa chỉ', 'Mã số thuế', 'Người liên hệ', 'Tình trạng', 'Mã hàng', 'Tên hàng', 'Đơn vị tính',
    'Số lượng', 'Đơn giá', 'Thành tiền', 'Diện tích_m2', 'Tọa độ (Kinh độ/Vĩ độ)', 'Hồ sơ pháp lý',
    'Số giấy tờ', 'ID_HD', 'KEY_HD', 'Trigger Export', 'Link_File'
  ];
  shHDMB.getRange(1, 1, 1, headerHDMB.length).setValues([headerHDMB]);
  [1, 8, 10].forEach(function (c) { shHDMB.getRange(2, c, Math.max(rungRows.length, 1), 1).setNumberFormat('@'); });

  const nccByIdHD = {};
  nccRows.forEach(function (r) { nccByIdHD[(r[NCC_COL.ID_HD] || '').toString().trim()] = r; });

  const rowsHDMB = [];
  rungRows.forEach(function (r) {
    const idHD = (r[RUNG_COL.ID_KEY_HD] || '').toString().trim();
    const idRung = (r[RUNG_COL.ID_RUNG] || '').toString().trim();
    const ncc = nccByIdHD[idHD];
    if (!ncc) return; // lô rừng mồ côi (không tìm thấy hợp đồng cha) — bỏ qua, không tự đoán dữ liệu

    const coUyQuyen = (ncc[NCC_COL.UY_QUYEN_TT] || '').toString().trim() === 'Có';
    const cccd = (ncc[NCC_COL.CCCD_CHU_RUNG] || '').toString().trim();
    const nguoiLienHe = coUyQuyen ? (ncc[NCC_COL.TEN_UY_QUYEN] || '') : (ncc[NCC_COL.TEN_CHU_RUNG] || '');
    const soLuong = Number(r[RUNG_COL.KHOI_LUONG_DK]) || 0;
    const donGia = Number(r[RUNG_COL.DON_GIA]) || 0;
    const gps = theoIdRung[idRung];
    const toaDo = gps && gps.toaDo ? (gps.toaDo.lat.toFixed(6) + ', ' + gps.toaDo.lng.toFixed(6)) : '';

    rowsHDMB.push([
      r[RUNG_COL.SO_HD] || '', r[RUNG_COL.NGAY_KY] || '', '', thietLap.loaiTienMacDinh, '',
      soLuong * donGia, '', cccd, r[RUNG_COL.THUONG_TRU] || '', cccd, nguoiLienHe, ncc[NCC_COL.TINH_TRANG] || '',
      thietLap.maHangMacDinh, thietLap.tenHangMacDinh, thietLap.donViTinhMacDinh, soLuong, donGia, soLuong * donGia,
      Number(r[RUNG_COL.DIEN_TICH_M2]) || 0, toaDo,
      r[RUNG_COL.HO_SO_NGUON_GOC] || '', r[RUNG_COL.SO_GIAY_TO] || '',
      idHD, idRung, '', ''
    ]);
  });
  if (rowsHDMB.length) shHDMB.getRange(2, 1, rowsHDMB.length, headerHDMB.length).setValues(rowsHDMB);

  // ============ Áp dụng Vùng định dạng RIÊNG cho file xuất MISA ============
  // ⚠️ ĐỘC LẬP với vùng của hệ thống chính (đặt ở trang Thiết lập, mục "Cài đặt
  // Vùng") — vì MISA có thể yêu cầu 1 định dạng cụ thể khác với vùng bạn đang
  // dùng cho HD_NCC/HD_RUNG hàng ngày. Đặt Locale cho chính spreadsheet tạm này,
  // rồi định dạng rõ ràng cột Ngày ký/Ngày cấp và các cột số tiền/số lượng,
  // trước khi xuất ra .xlsx — vì Locale chỉ ảnh hưởng đến HIỂN THỊ trong Google
  // Sheets, khi xuất file .xlsx thật, định dạng số/ngày đã áp trên ô mới là thứ
  // được giữ lại nguyên trong file Excel.
  try {
    const vungMisa = thietLap.vungDinhDangMisa || 'vi_VN';
    ssTam.setSpreadsheetLocale(vungMisa);
    const mauNgayMisa = (typeof MAU_NGAY_THEO_VUNG_ !== 'undefined' && MAU_NGAY_THEO_VUNG_[vungMisa]) || 'dd/mm/yyyy';
    shNCC.getRange(2, 13, Math.max(rowsNCC.length, 1), 1).setNumberFormat(mauNgayMisa); // cột M = "Ngày cấp"
    shHDMB.getRange(2, 2, Math.max(rowsHDMB.length, 1), 1).setNumberFormat(mauNgayMisa); // cột B = "Ngày ký (*)"
    const mauSoMisa = (typeof MAU_SO_CHUAN_ !== 'undefined') ? MAU_SO_CHUAN_ : '#,##0.###';
    shHDMB.getRange(2, 6, Math.max(rowsHDMB.length, 1), 2).setNumberFormat(mauSoMisa); // cột F,G = "Giá trị HĐ", "Giá trị HĐ quy đổi"
    shHDMB.getRange(2, 16, Math.max(rowsHDMB.length, 1), 3).setNumberFormat(mauSoMisa); // cột P,Q,R = "Số lượng", "Đơn giá", "Thành tiền"
    shHDMB.getRange(2, 19, Math.max(rowsHDMB.length, 1), 1).setNumberFormat(mauSoMisa); // cột S = "Diện tích_m2"
  } catch (e) {
    // Không chặn việc xuất báo cáo nếu bước định dạng riêng này lỗi — file vẫn xuất được, chỉ là định dạng có thể chưa như ý
  }

  // ============ Xuất thành file .xlsx THẬT, xóa Google Sheet tạm ============
  const ssId = ssTam.getId();
  SpreadsheetApp.flush();
  const url = 'https://docs.google.com/spreadsheets/d/' + ssId + '/export?format=xlsx';
  const response = UrlFetchApp.fetch(url, { headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() } });
  const tenFile = 'Update_Hopdong_NCC_DN_' + Utilities.formatDate(new Date(), 'GMT+7', 'yyyyMMdd_HHmm') + '.xlsx';
  const blob = response.getBlob().setName(tenFile);
  const file = layThuMucXuatMisa_().createFile(blob);
  DriveApp.getFileById(ssId).setTrashed(true); // dọn file Google Sheet tạm, chỉ giữ file .xlsx thật

  ghiNhatKy_('Xuất báo cáo MISA', '', tenFile + ' — ' + rowsNCC.length + ' NCC, ' + rowsHDMB.length + ' dòng HĐMB');

  return { thanhCong: true, url: file.getUrl(), tenFile: tenFile, soDongNCC: rowsNCC.length, soDongHDMB: rowsHDMB.length, folderUrl: file.getParents().hasNext() ? file.getParents().next().getUrl() : '' };
}

/** Chạy từ menu Google Sheet — hiện link tải trực tiếp trong hộp thoại */
function XUAT_BAO_CAO_MISA_TU_MENU() {
  const ui = SpreadsheetApp.getUi();
  try {
    const kq = XUAT_BAO_CAO_MISA();
    ui.alert(
      '✅ Đã xuất "' + kq.tenFile + '"\n' +
      '(' + kq.soDongNCC + ' nhà cung cấp, ' + kq.soDongHDMB + ' dòng hợp đồng mua bán)\n\n' +
      'Link tải file: ' + kq.url + (kq.folderUrl ? '\nThư mục chứa file: ' + kq.folderUrl : '')
    );
  } catch (e) {
    ui.alert('❌ Lỗi khi xuất báo cáo MISA: ' + e.message);
  }
}
