/**
 * ============================================================
 *  17_ChanDoanTocDo.gs
 *  CHẠY 1 LẦN để biết CHÍNH XÁC bước nào đang làm chậm trang Báo cáo — thay vì
 *  đoán tiếp qua đọc code. Đo thời gian (mili-giây) từng bước riêng biệt.
 *
 *  CÁCH DÙNG:
 *  1) Trong Apps Script editor, chọn hàm CHAY_CHAN_DOAN_TOC_DO ở thanh chọn hàm
 *     phía trên, bấm ▶ Run (KHÔNG chạy từ menu Sheet, chạy trực tiếp ở editor
 *     để xem được Logger.log realtime).
 *  2) Xem kết quả ở "Execution log" (Ctrl+Enter hoặc View > Logs).
 *  3) Gửi lại toàn bộ log đó — sẽ thấy ngay bước nào chậm bất thường.
 * ============================================================
 */
/** Hàm TEST ĐƠN GIẢN NHẤT — không đọc sheet, không gọi hàm nào khác, chỉ trả về chữ.
 *  Dùng để cô lập: nếu ngay cả hàm này cũng "treo" khi gọi từ webapp, thì lỗi chắc
 *  chắn nằm ở tầng kết nối/deploy của TRANG ĐÓ, không phải do logic đọc dữ liệu. */
function TEST_KET_NOI_DON_GIAN() {
  return '✅ Kết nối OK lúc ' + new Date().toLocaleTimeString('vi-VN');
}

/**
 * Xóa trigger lỗi "GEO_DETECT_LOCATION" (còn sót lại từ project mẫu cũ, không
 * thuộc hệ thống HAK, đang chạy mỗi 5 phút và luôn Failed).
 * CÁCH DÙNG: chọn hàm này ở thanh chọn hàm trong Apps Script editor → bấm ▶ Run.
 * Chạy 1 lần là xong, không cần chạy lại.
 */
function XOA_TRIGGER_LOI_GEO_DETECT_LOCATION() {
  const triggers = ScriptApp.getProjectTriggers();
  let daXoa = 0;
  const conLai = [];
  triggers.forEach(function (t) {
    if (t.getHandlerFunction() === 'GEO_DETECT_LOCATION') {
      ScriptApp.deleteTrigger(t);
      daXoa++;
    } else {
      conLai.push(t.getHandlerFunction());
    }
  });
  const thongBao = '✅ Đã xóa ' + daXoa + ' trigger "GEO_DETECT_LOCATION".\n\n' +
    'Các trigger CÒN LẠI (không đụng tới, vẫn hoạt động bình thường):\n• ' + conLai.join('\n• ');
  Logger.log(thongBao);
  try { SpreadsheetApp.getUi().alert(thongBao); } catch (e) { /* nếu chạy từ editor (không phải menu Sheet) thì không có UI, chỉ cần xem ở Logger.log là đủ */ }
  return thongBao;
}

function CHAY_CHAN_DOAN_TOC_DO() {
  const ketQua = [];
  function do_(ten, hamChay) {
    const bd = new Date().getTime();
    let loi = null, tomTat = '';
    try {
      const r = hamChay();
      tomTat = (r === undefined) ? '' : (typeof r === 'object' ? JSON.stringify(r).slice(0, 200) : String(r).slice(0, 200));
    } catch (e) {
      loi = e.message;
    }
    const ms = new Date().getTime() - bd;
    const dong = ten + ': ' + ms + ' ms' + (loi ? ' -- LỖI: ' + loi : (tomTat ? ' -- ' + tomTat : ''));
    Logger.log(dong);
    ketQua.push(dong);
  }

  Logger.log('===== BẮT ĐẦU CHẨN ĐOÁN (' + new Date().toISOString() + ') =====');

  do_('1. Mở file dữ liệu chính (getSS_)', function () { return getSS_().getName(); });
  do_('2. Mở file Báo cáo/Cache riêng (getReportSS_)', function () { return getReportSS_().getName(); });
  do_('3. Đếm dòng HD_NCC (file chính)', function () { return getSheet_(SHEET_NAME.HD_NCC).getLastRow(); });
  do_('4. Đếm dòng HD_RUNG (file chính)', function () { return getSheet_(SHEET_NAME.HD_RUNG).getLastRow(); });
  do_('5. Đếm dòng HD_GPS (file chính)', function () { return getSheet_(SHEET_NAME.HD_GPS).getLastRow(); });
  do_('6. Đếm dòng Draft_BaoCaoHopDong (file cache)', function () { return getOrCreateDraftBaoCaoSheet_().getLastRow(); });
  do_('7. Đếm dòng Draft_HoSoRung (file cache)', function () { return getOrCreateDraftHoSoRungSheet_().getLastRow(); });
  do_('8. docToanBoDraftBaoCao_() -- đọc cache báo cáo hợp đồng', function () { return docToanBoDraftBaoCao_().length + ' dòng'; });
  do_('9. layBaoCaoHoSoRung() -- đọc cache hồ sơ rừng', function () { return layBaoCaoHoSoRung().length + ' dòng'; });
  do_('10. layTinhHinhThucHien() -- KPI tình hình thực hiện', function () { return layTinhHinhThucHien().tongSoHopDong + ' hợp đồng'; });
  do_('11. layBaoCaoHopDongPhanTrang() -- trang 1, 20 dòng', function () { return layBaoCaoHopDongPhanTrang({}, 1, 20, false).tongSo + ' tổng'; });
  do_('12. layDanhSachThanhLy() -- trang 1, 20 dòng', function () { return layDanhSachThanhLy(1, 20, {}, false).tongSo + ' tổng'; });

  Logger.log('===== HẾT CHẨN ĐOÁN =====');
  return ketQua.join('\n');
}

/** Gọi từ menu Sheet — hiện kết quả ngay trong 1 hộp thoại, không cần mở Apps Script editor để xem log */
function CHAY_CHAN_DOAN_TOC_DO_VA_HIEN_KQ() {
  const ketQua = CHAY_CHAN_DOAN_TOC_DO();
  SpreadsheetApp.getUi().alert('⏱️ Kết quả đo thời gian (từng bước):\n\n' + ketQua);
}
