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
function XUAT_BANG_RA_FILE(tenFile, header, rows, dinhDang) {
  if (!rows || !rows.length) return { thanhCong: false, loi: 'Không có dữ liệu để xuất (bảng đang trống).' };
  let ssTam;
  try {
    ssTam = SpreadsheetApp.create('TAM_XUAT_BANG_' + new Date().getTime());
    const sh = ssTam.getSheets()[0];
    if (header && header.length) {
      sh.getRange(1, 1, 1, header.length).setValues([header]).setFontWeight('bold');
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
