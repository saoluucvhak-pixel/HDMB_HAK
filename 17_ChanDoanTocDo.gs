/**
 * ============================================================
 *  17_ChanDoanTocDo.gs
 *  CHẠY 1 LẦN để biết CHÍNH XÁC bước nào đang làm chậm trang Báo cáo — thay vì
 *  đoán tiếp qua đọc code. Đo thời gian (mili-giây) từng bước riêng biệt.
 *
 *  CÁCH DÙNG:
 *  1) Trong Apps Script editor, chọn hàm CHAY_CHAN_DOAN_TOC_DO_ ở thanh chọn hàm
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
  _yeuCauQuyen_(QUYEN.QUAN_TRI);
  return '✅ Kết nối OK lúc ' + new Date().toLocaleTimeString('vi-VN');
}

/**
 * Xóa trigger lỗi "GEO_DETECT_LOCATION" (còn sót lại từ project mẫu cũ, không
 * thuộc hệ thống HAK, đang chạy mỗi 5 phút và luôn Failed).
 * CÁCH DÙNG: chọn hàm này ở thanh chọn hàm trong Apps Script editor → bấm ▶ Run.
 * Chạy 1 lần là xong, không cần chạy lại.
 */
function XOA_TRIGGER_LOI_GEO_DETECT_LOCATION() {
  _yeuCauQuyen_(QUYEN.QUAN_TRI);
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

function CHAY_CHAN_DOAN_TOC_DO_() {
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
  do_('9. layBaoCaoHoSoRung_() -- đọc cache hồ sơ rừng', function () { return layBaoCaoHoSoRung_().length + ' dòng'; });
  do_('10. layTinhHinhThucHien_() -- KPI tình hình thực hiện', function () { return layTinhHinhThucHien_().tongSoHopDong + ' hợp đồng'; });
  do_('11. layBaoCaoHopDongPhanTrang_() -- trang 1, 20 dòng', function () { return layBaoCaoHopDongPhanTrang_({}, 1, 20, false).tongSo + ' tổng'; });
  do_('12. layDanhSachThanhLy_() -- trang 1, 20 dòng', function () { return layDanhSachThanhLy_(1, 20, {}, false).tongSo + ' tổng'; });

  Logger.log('===== HẾT CHẨN ĐOÁN =====');
  return ketQua.join('\n');
}

/** Gọi từ menu Sheet — hiện kết quả ngay trong 1 hộp thoại, không cần mở Apps Script editor để xem log */
function CHAY_CHAN_DOAN_TOC_DO_VA_HIEN_KQ() {
  _yeuCauQuyen_(QUYEN.QUAN_TRI);
  const ketQua = CHAY_CHAN_DOAN_TOC_DO_();
  SpreadsheetApp.getUi().alert('⏱️ Kết quả đo thời gian (từng bước):\n\n' + ketQua);
}

/**
 * ============================================================
 *  GIÁM SÁT HIỆU NĂNG KHI VẬN HÀNH (nâng cấp 10/2026)
 * ============================================================
 * Cửa api() (34_PhanQuyen.gs) đo thời gian MỌI lời gọi từ trang web nhưng CHỈ GHI SỔ lời gọi chậm hơn ngưỡng (mặc định
 * 5.000 ms; đổi bằng Script Properties "HIEU_NANG_NGUONG_MS") hoặc bị lỗi -> lời gọi bình thường không tốn thêm lệnh nào.
 * Sổ: sheet NhatKy_HieuNang trong file báo cáo (Thời gian, Chức năng, ms, Kết quả, Lỗi, Vai trò). KHÔNG ghi tham số / dữ liệu
 * người dùng / email. Tối đa 5.000 dòng (tự cắt dòng cũ). Chỉ số đọc/ghi Sheet theo từng bước không đo được đáng tin cậy
 * trên Apps Script thật nên không ghi (dùng tests/do_hieu_suat.cjs trên bộ giả lập để so sánh).
 */
const HIEU_NANG_SHEET_ = 'NhatKy_HieuNang';
const HIEU_NANG_TOI_DA_DONG_ = 5000;
let _nguongHieuNangMs_ = null;
function _nguongHieuNang_() {
  if (_nguongHieuNangMs_ !== null) return _nguongHieuNangMs_;
  let p = null;
  try { p = PropertiesService.getScriptProperties().getProperty('HIEU_NANG_NGUONG_MS'); } catch (e) { /* mặc định */ }
  const v = p === null || p === '' ? NaN : Number(p);
  _nguongHieuNangMs_ = isFinite(v) && v >= 0 ? v : 5000;
  return _nguongHieuNangMs_;
}

/** Gọi từ api() sau mỗi lời gọi. Không bao giờ ném lỗi (giám sát không được làm hỏng thao tác chính). */
function ghiHieuNangNeuCham_(tenHam, ms, loi, vaiTro) {
  try {
    if (!loi && ms < _nguongHieuNang_()) return;
    const ss = getReportSS_();
    let sh = ss.getSheetByName(HIEU_NANG_SHEET_);
    if (!sh) {
      sh = ss.insertSheet(HIEU_NANG_SHEET_);
      sh.getRange(1, 1, 1, 6).setValues([['Thời gian', 'Chức năng', 'Thời gian xử lý (ms)', 'Kết quả', 'Lỗi', 'Vai trò']]);
    }
    // Che dãy số dài (CCCD / SĐT / số tài khoản có thể lọt vào thông báo lỗi)
    const thongDiep = loi ? String(loi.message || loi).replace(/\d{9,}/g, '…').replace(/\s+/g, ' ').slice(0, 200) : '';
    sh.appendRow([new Date(), String(tenHam).slice(0, 80), ms, loi ? 'LỖI' : (ms >= _nguongHieuNang_() ? 'CHẬM' : 'OK'), thongDiep, vaiTro || '']);
    const last = sh.getLastRow();
    if (last > HIEU_NANG_TOI_DA_DONG_ + 500) sh.deleteRows(2, last - 1 - HIEU_NANG_TOI_DA_DONG_);
  } catch (e) { /* bỏ qua */ }
}

/** Thống kê sổ hiệu năng theo chức năng: số lần chậm / lỗi, p50, p95, lớn nhất (ms). Chỉ Quản trị (qua api). */
function LAY_THONG_KE_HIEU_NANG_(soNgay) {
  _yeuCauQuyen_(QUYEN.QUAN_TRI);
  const sh = getReportSS_().getSheetByName(HIEU_NANG_SHEET_);
  if (!sh || sh.getLastRow() < 2) return { nguongMs: _nguongHieuNang_(), chucNang: [] };
  const tu = Date.now() - (Number(soNgay) > 0 ? Number(soNgay) : 7) * 86400000;
  const theoHam = {};
  sh.getRange(2, 1, sh.getLastRow() - 1, 4).getValues().forEach(function (r) {
    if (!(r[0] instanceof Date) || r[0].getTime() < tu) return;
    const k = String(r[1]);
    const g = theoHam[k] = theoHam[k] || { chucNang: k, ms: [], soLoi: 0 };
    g.ms.push(Number(r[2]) || 0);
    if (r[3] === 'LỖI') g.soLoi++;
  });
  const pv = function (a, p) { return a.length ? a[Math.min(a.length - 1, Math.ceil(p * a.length) - 1)] : 0; };
  const ds = Object.keys(theoHam).map(function (k) {
    const g = theoHam[k]; g.ms.sort(function (a, b) { return a - b; });
    return { chucNang: k, soLan: g.ms.length, soLoi: g.soLoi, p50: pv(g.ms, 0.5), p95: pv(g.ms, 0.95), lonNhat: g.ms[g.ms.length - 1] };
  }).sort(function (a, b) { return b.p95 - a.p95; });
  return { nguongMs: _nguongHieuNang_(), chucNang: ds };
}
