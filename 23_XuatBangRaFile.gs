/**
 * ============================================================
 *  23_XuatBangRaFile.gs
 *  XUẤT EXCEL/PDF DÙNG CHUNG cho mọi bảng báo cáo (Báo cáo hợp đồng, Tình hình
 *  thực hiện, Thanh lý, Hồ sơ rừng, Thanh toán...) — nhận vào tiêu đề cột +
 *  dữ liệu (đã tính đầy đủ, KHÔNG phân trang) từ mỗi tab, tạo file thật rồi
 *  trả về dạng base64 để trình duyệt tự tải xuống — KHÔNG lưu gì vào Drive,
 *  không để lại rác (file trung gian dùng để chuyển đổi định dạng bị xóa
 *  ngay sau khi xuất xong, kể cả khi có lỗi giữa chừng nhờ try/finally).
 * ============================================================
 */

/**
 * @param {string} tenFile Tên file KHÔNG kèm đuôi (vd "BaoCaoHopDong_2026")
 * @param {string[]} header Tiêu đề cột
 * @param {Array<Array>} rows Dữ liệu — mỗi dòng 1 mảng giá trị, ĐÚNG thứ tự khớp header
 * @param {"xlsx"|"pdf"} dinhDang
 */
/**
 * P-07b / H-13 (rà soát 28/09): MÁY CHỦ tự dựng dữ liệu xuất theo loại báo cáo + bộ lọc — trình duyệt không gửi bảng dữ
 * liệu lên nữa (trước đây gửi toàn bộ dòng: nặng, và nội dung file do trình duyệt quyết định). Cột và định dạng ngày giữ
 * đúng như bản xuất cũ ở trang Báo cáo.
 *  loai 'baoCaoHD' — boLoc như layBaoCaoHopDongPhanTrang_ · loai 'hoSoRung' — boLoc { soHD, tenChuRung, tinhTrang }
 */
function XUAT_BAO_CAO_FILE_(loai, boLoc, dinhDang) {
  _yeuCauQuyen_(QUYEN.XEM);
  boLoc = boLoc || {};
  dinhDang = dinhDang === 'pdf' ? 'pdf' : 'xlsx';
  const mau = mauNgayXuatFile_();
  const ngay = function (v) { return v ? _ngayXuatFile_(v, mau) : ''; };
  const homNay = Utilities.formatDate(new Date(), layMuiGioBangTinh_(), 'yyyy-MM-dd');
  const tron = function (v) { return Math.round(Number(v) || 0); };
  let tenFile, header, rows;
  if (loai === 'baoCaoHD') {
    const kq = layBaoCaoHopDongPhanTrang_(boLoc, 1, 100000, false);
    if (kq && kq.loi) return { thanhCong: false, loi: kq.loi };
    tenFile = 'BaoCaoHopDong_' + homNay;
    header = ['Số HĐ', 'Ngày ký', 'Chủ rừng', 'CCCD', 'Người ủy quyền', 'Số TK', 'Số lô rừng', 'KL dự kiến (Tấn)', 'KL thực hiện (Tấn)', 'Giá trị HĐ (đ)', 'Giá trị TH (đ)', 'Từ ngày TH', 'Đến ngày TH', 'Có ảnh', 'Đủ GPS', 'Đủ hồ sơ', 'Tình trạng', 'Ghi chú'];
    rows = (kq.items || []).map(function (r) {
      return [r.soHD || '', ngay(r.ngayKy), r.tenChuRung || '', r.cccdChuRung || '', r.tenUyQuyen || '',
        r.soTaiKhoan || 0, r.soLoRung || 0, tron(r.khoiLuongDuKien), tron(r.khoiLuongThucHien), tron(r.giaTriHopDong), tron(r.giaTriThucHien),
        ngay(r.thucHienTuNgay), ngay(r.thucHienDenNgay),
        r.coAnh ? 'Có' : 'Chưa', r.daDoGPSDu ? 'Đủ' : 'Chưa đủ', r.hoSoDu ? 'Đủ' : 'Chưa đủ', r.tinhTrang || '',
        r.mucDo === 'do' ? (r.thieuDo || []).join('; ') : (r.mucDo === 'vang' ? (r.thieuVang || []).join('; ') : '')];
    });
  } else if (loai === 'hoSoRung') {
    const tkSoHD = (boLoc.soHD || '').toString().trim().toLowerCase();
    const tkTen = (boLoc.tenChuRung || '').toString().trim().toLowerCase();
    const locTT = (boLoc.tinhTrang || '').toString();
    tenFile = 'HoSoRung_' + homNay;
    header = ['Mã rừng', 'Số HĐ', 'Chủ rừng', 'Tình trạng', 'Diện tích (m²)', 'KL dự kiến (Tấn)', 'Đơn giá (đ)', 'Giá trị (đ)', 'Hồ sơ nguồn gốc', 'Số giấy tờ'];
    rows = layBaoCaoHoSoRung_().filter(function (r) {
      if (tkSoHD && (r.soHD || '').toString().trim().toLowerCase().indexOf(tkSoHD) === -1) return false;
      if (tkTen && (r.tenChuRung || '').toString().trim().toLowerCase().indexOf(tkTen) === -1) return false;
      if (locTT && (r.tinhTrang || '') !== locTT) return false;
      return true;
    }).map(function (r) {
      return [r.idRung || '', r.soHD || '', r.tenChuRung || '', r.tinhTrang || '', tron(r.dienTich), tron(r.khoiLuongDuKien), tron(r.donGia), tron(r.giaTri), r.hoSoNguonGoc || '', r.soGiayTo || ''];
    });
  } else {
    return { thanhCong: false, loi: 'Loại báo cáo không hỗ trợ xuất: ' + loai };
  }
  return _taoFileTuBang_(tenFile, header, rows, dinhDang);
}

/** Bản cũ nhận bảng từ trình duyệt — giữ lại cho tương thích, KHÔNG còn trong bảng quyền api (trang dùng XUAT_BAO_CAO_FILE). */
function XUAT_BANG_RA_FILE_(tenFile, header, rows, dinhDang) {
  _yeuCauQuyen_(QUYEN.XEM);
  return _taoFileTuBang_(tenFile, header, rows, dinhDang);
}

function _taoFileTuBang_(tenFile, header, rows, dinhDang) {
  if (!rows || !rows.length) return { thanhCong: false, loi: 'Không có dữ liệu để xuất (bảng đang trống).' };
  // H-13 (rà soát 28/09): dữ liệu do trình duyệt gửi lên được ghi vào 1 Google Sheet của chủ script rồi xuất xlsx/pdf.
  // Chuỗi bắt đầu bằng = + @ (hoặc - không phải số âm) bị Sheets/Excel hiểu là CÔNG THỨC (vd =IMPORTXML gọi ra ngoài)
  // -> thêm ' để giữ nguyên là chữ. Giới hạn kích thước để 1 lần xuất không làm cạn quota Drive/UrlFetch.
  if (!Array.isArray(rows) || rows.length > 50000) return { thanhCong: false, loi: 'Bảng quá lớn để xuất (tối đa 50.000 dòng) — lọc bớt rồi xuất lại.' };
  const soCot = Math.max(header && header.length ? header.length : 0, rows[0].length || 0);
  if (!soCot || soCot > 80) return { thanhCong: false, loi: 'Số cột không hợp lệ (tối đa 80).' };
  const anToan = function (v) {
    if (v === null || v === undefined) return '';
    if (typeof v === 'number' || typeof v === 'boolean') return v;
    const t = String(v);
    return /^[=+@\t\r]/.test(t) || /^-(?![\d.,]+$)/.test(t) ? "'" + t : t;
  };
  const chuanDong = function (r) { const a = []; for (let j = 0; j < soCot; j++) a.push(anToan(Array.isArray(r) ? r[j] : '')); return a; };
  header = header && header.length ? chuanDong(header) : header;
  rows = rows.map(chuanDong);
  let ssTam;
  try {
    ssTam = SpreadsheetApp.create('TAM_XUAT_BANG_' + new Date().getTime());
    const sh = ssTam.getSheets()[0];
    if (header && header.length) {
      sh.getRange(1, 1, 1, soCot).setValues([header]).setFontWeight('bold');
      sh.setFrozenRows(1);
    }
    const dongBatDau = header && header.length ? 2 : 1;
    sh.getRange(dongBatDau, 1, rows.length, rows[0].length).setValues(rows);
    sh.autoResizeColumns(1, rows[0].length);
    SpreadsheetApp.flush();

    let url, mimeType, duoiFile;
    if (dinhDang === 'pdf') {
      url = 'https://docs.google.com/spreadsheets/d/' + ssTam.getId() + '/export?format=pdf&gid=' + sh.getSheetId() +
        '&size=A4&portrait=false&fitw=true&gridlines=true&top_margin=0.4&bottom_margin=0.4&left_margin=0.4&right_margin=0.4';
      mimeType = 'application/pdf'; duoiFile = '.pdf';
    } else {
      url = 'https://docs.google.com/spreadsheets/d/' + ssTam.getId() + '/export?format=xlsx';
      mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'; duoiFile = '.xlsx';
    }
    const resp = UrlFetchApp.fetch(url, { headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() } });
    const base64 = Utilities.base64Encode(resp.getBlob().getBytes());
    return { thanhCong: true, base64: base64, tenFile: tenFile + duoiFile, mimeType: mimeType, soDong: rows.length };
  } catch (e) {
    return { thanhCong: false, loi: 'Lỗi khi tạo file: ' + e.message };
  } finally {
    // ⚠️ LUÔN dọn sạch file trung gian, kể cả khi có lỗi giữa chừng — không để lại rác trong Drive
    if (ssTam) { try { DriveApp.getFileById(ssTam.getId()).setTrashed(true); } catch (e2) { /* đã cố hết sức, bỏ qua nếu vẫn lỗi */ } }
  }
}
