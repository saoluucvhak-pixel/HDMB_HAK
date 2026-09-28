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
function XUAT_BANG_RA_FILE_(tenFile, header, rows, dinhDang) {
  _yeuCauQuyen_(QUYEN.XEM);
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
