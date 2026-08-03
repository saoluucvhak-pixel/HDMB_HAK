/**
 * ============================================================
 *  21_DinhDangText.gs
 *  Đặt định dạng TEXT ('@') cho các cột dễ bị Google Sheets tự động chuyển
 *  thành SỐ — gây mất số 0 ở đầu hoặc làm tròn/đổi định dạng dữ liệu:
 *    - Số CCCD / Số Căn cước công dân
 *    - Số điện thoại (Số ĐT)
 *    - Mã số thuế (MST) — với cá nhân thường trùng số CCCD
 *    - Mã hợp đồng / Số hợp đồng
 *    - Số tài khoản (Số TK)
 *    - Mã khách hàng / ID_HD / Nhóm KH
 *
 *  Chỉ cần chạy 1 LẦN (menu "📝 Định dạng TEXT cho cột quan trọng") — sau khi
 *  đặt, định dạng TEXT áp dụng cho CẢ CÁC DÒNG TRONG TƯƠNG LAI (không chỉ dữ
 *  liệu hiện có), vì Google Sheets giữ định dạng theo CỘT khi có dữ liệu mới
 *  được ghi vào (kể cả ghi bằng script qua setValues()).
 * ============================================================
 */
function DINH_DANG_TEXT_CHO_COT_QUAN_TRONG() {
  const SO_DONG_DU_PHONG = 5000; // đặt định dạng cho cả các dòng chưa có dữ liệu, để tương lai ghi vào vẫn giữ TEXT

  function datTextChoCot(sheet, chiSoCotAr) {
    chiSoCotAr.forEach(function (chiSoCot) {
      sheet.getRange(2, chiSoCot + 1, SO_DONG_DU_PHONG, 1).setNumberFormat('@');
    });
  }

  const shNCC = getSheet_(SHEET_NAME.HD_NCC);
  datTextChoCot(shNCC, [
    NCC_COL.SO_HD, NCC_COL.CCCD_CHU_RUNG, NCC_COL.CCCD_UY_QUYEN,
    NCC_COL.SDT_CHU_RUNG, NCC_COL.SDT_UQ, NCC_COL.SO_TK,
    NCC_COL.NHOM_KH, NCC_COL.ID_HD
  ]);

  const shRung = getSheet_(SHEET_NAME.HD_RUNG);
  datTextChoCot(shRung, [RUNG_COL.SO_HD, RUNG_COL.CCCD, RUNG_COL.ID_KEY_HD, RUNG_COL.ID_RUNG, RUNG_COL.MA_RUNG]);

  const shStk = getSheet_(SHEET_NAME.HD_STK);
  datTextChoCot(shStk, [STK_COL.ID_HD, STK_COL.CCCD, STK_COL.SO_TK, STK_COL.SO_HD]);

  // ⚠️ QUAN TRỌNG: chỉ ĐẶT ĐỊNH DẠNG, KHÔNG tự sửa dữ liệu đã có sẵn — nếu 1 ô
  // đã bị Sheets chuyển thành SỐ từ trước (vd mất số 0 đầu), đổi định dạng
  // TEXT bây giờ KHÔNG khôi phục lại số 0 đã mất (vì giá trị số đã lưu không
  // còn giữ số 0 đầu). Cần rà lại thủ công những dòng cũ nếu nghi ngờ đã mất
  // số 0 đầu trước khi áp dụng định dạng này.
  return {
    thanhCong: true,
    thongBao: '✅ Đã khóa định dạng TEXT cho các cột: Số HĐ, Số CCCD, Số ĐT, Số TK, Mã hợp đồng, Nhóm KH, ID_HD, ID_RUNG, Mã rừng — trong HD_NCC, HD_RUNG, HD_STK. ' +
      '⚠️ Lưu ý: chỉ áp dụng cho dữ liệu NHẬP TỪ NAY. Nếu dữ liệu cũ đã lỡ mất số 0 ở đầu do từng bị chuyển thành số, cần kiểm tra và sửa tay lại các dòng đó (đổi định dạng không tự khôi phục số đã mất).'
  };
}

/** Bản gọi từ menu Google Sheets (SpreadsheetApp.getUi() chỉ dùng được ở đây,
 *  KHÔNG dùng được nếu gọi từ webapp — vì vậy tách riêng, hàm chính ở trên chỉ trả object). */
function DINH_DANG_TEXT_CHO_COT_QUAN_TRONG_TU_MENU() {
  const kq = DINH_DANG_TEXT_CHO_COT_QUAN_TRONG();
  SpreadsheetApp.getUi().alert(kq.thongBao);
}

/** Kiểm tra trạng thái ĐÃ KHÓA định dạng TEXT hay CHƯA — dùng để hiện 🔒/🔓 trên
 *  trang Thiết lập, không cần đoán mò có bấm nút chưa. Chỉ cần xem định dạng
 *  của DÒNG 2 (đại diện) trong mỗi cột quan trọng — vì hàm khóa luôn áp dụng
 *  đồng loạt 1 lần cho cả 5000 dòng, dòng 2 phản ánh đúng trạng thái chung. */
function KIEM_TRA_TRANG_THAI_KHOA_TEXT() {
  function laText_(sheet, cot) {
    try { return sheet.getRange(2, cot + 1).getNumberFormat() === '@'; } catch (e) { return false; }
  }

  const shNCC = getSheet_(SHEET_NAME.HD_NCC);
  const shRung = getSheet_(SHEET_NAME.HD_RUNG);
  const shStk = getSheet_(SHEET_NAME.HD_STK);

  const cotNCC = [NCC_COL.SO_HD, NCC_COL.CCCD_CHU_RUNG, NCC_COL.CCCD_UY_QUYEN, NCC_COL.SDT_CHU_RUNG, NCC_COL.SDT_UQ, NCC_COL.SO_TK, NCC_COL.NHOM_KH, NCC_COL.ID_HD];
  const cotRung = [RUNG_COL.SO_HD, RUNG_COL.CCCD, RUNG_COL.ID_KEY_HD, RUNG_COL.ID_RUNG, RUNG_COL.MA_RUNG];
  const cotStk = [STK_COL.ID_HD, STK_COL.CCCD, STK_COL.SO_TK, STK_COL.SO_HD];

  const tatCa = cotNCC.map(function (c) { return laText_(shNCC, c); })
    .concat(cotRung.map(function (c) { return laText_(shRung, c); }))
    .concat(cotStk.map(function (c) { return laText_(shStk, c); }));

  const soDaKhoa = tatCa.filter(Boolean).length;
  const tongSo = tatCa.length;
  return { daKhoaHoanToan: soDaKhoa === tongSo, coMotPhan: soDaKhoa > 0 && soDaKhoa < tongSo, soDaKhoa: soDaKhoa, tongSo: tongSo };
}

/**
 * Đặt định dạng hiển thị ngày tháng kiểu Việt Nam (dd/mm/yyyy) cho TẤT CẢ cột
 * ngày trong HD_NCC, HD_RUNG và cả 2 sheet Draft báo cáo (file riêng) — đồng bộ
 * với vùng Việt Nam, tránh nhầm lẫn dd/mm khi ai đó mở trực tiếp Google Sheet
 * bằng tài khoản có vùng/ngôn ngữ khác (vd Mỹ hiển thị mm/dd/yyyy).
 *
 * LƯU Ý QUAN TRỌNG: định dạng CỘT chỉ quyết định cách HIỂN THỊ, không tự đổi
 * "vùng" (Locale) của cả file Google Sheets — nếu file đang để Locale không
 * phải Việt Nam, khi ai đó GÕ TAY ngày kiểu "16/7/2026" trực tiếp vào ô,
 * Sheets vẫn có thể hiểu sai theo Locale hiện tại. Để chắc chắn tuyệt đối, vào
 * File → Cài đặt bảng tính (Spreadsheet settings) → Vùng địa lý → chọn
 * "Việt Nam" cho CẢ file dữ liệu chính (HDMB_GK_DN) LẪN file Draft/Báo cáo
 * riêng — chỉ cần làm 1 lần, không cần script.
 */
/** Nút menu Sheets nhanh (chỉ Việt Nam) — thực chất chỉ gọi thẳng DAT_VUNG_HE_THONG('vi_VN')
 *  để dùng chung logic với dialog/trang webapp, tránh 2 nơi làm 2 kiểu khác nhau. */
function DINH_DANG_NGAY_THANG_NAM_DONG_BO() {
  const kq = DAT_VUNG_HE_THONG('vi_VN');
  SpreadsheetApp.getUi().alert('✅ ' + kq.thongBao);
}

/** Mở dialog cài đặt Vùng (Locale) — cho phép chọn vùng bất kỳ, không chỉ cố định Việt Nam */
function MO_DIALOG_CAI_DAT_VUNG() {
  const html = HtmlService.createHtmlOutputFromFile('23_CaiDatVung').setWidth(480).setHeight(420);
  SpreadsheetApp.getUi().showModalDialog(html, '⚙️ Cài đặt Vùng (Locale)');
}

/** Đọc Locale hiện tại của cả 2 file — dùng để hiện sẵn lựa chọn đúng trong dialog */
function LAY_VUNG_HIEN_TAI() {
  let locChinh = '', locDraft = '';
  try { locChinh = getSS_().getSpreadsheetLocale(); } catch (e) { /* bỏ qua */ }
  try { locDraft = getReportSS_().getSpreadsheetLocale(); } catch (e) { /* file Draft có thể chưa mở được lúc này */ }
  return { locChinh: locChinh, locDraft: locDraft };
}

/** Áp dụng 1 Locale cụ thể (vd 'vi_VN', 'en_US'...) cho cả file dữ liệu chính lẫn file Draft/Báo cáo */
// Ngày/tháng theo từng vùng — mỗi vùng có thói quen viết ngày khác nhau, không
// nên ép cứng dd/mm/yyyy cho MỌI vùng (vd chọn United States thì phải là mm/dd/yyyy
// mới đúng thói quen, nếu không sẽ "trống đánh xuôi, kèn thổi ngược" với chính vùng đã chọn).
const MAU_NGAY_THEO_VUNG_ = {
  vi_VN: 'dd/mm/yyyy', en_US: 'mm/dd/yyyy', en_GB: 'dd/mm/yyyy', fr_FR: 'dd/mm/yyyy',
  ja_JP: 'yyyy/mm/dd', ko_KR: 'yyyy.mm.dd', zh_CN: 'yyyy/mm/dd'
};
// Định dạng SỐ (phân cách hàng nghìn/thập phân) dùng CHUNG 1 mẫu ký hiệu — Google
// Sheets tự đổi dấu phẩy/dấu chấm hiển thị theo ĐÚNG Locale đang chọn (vd vi_VN hiện
// "1.234.567,89", en_US hiện "1,234,567.89") — không cần mẫu ký hiệu khác nhau theo vùng.
const MAU_SO_CHUAN_ = '#,##0.###';

/**
 * ĐẶT VÙNG (Locale) + định dạng ngày (đúng kiểu của vùng đó) + định dạng số
 * (tự đổi dấu phân cách theo vùng) — TẤT CẢ TRONG 1 HÀM DUY NHẤT, chỉ chạy khi
 * người dùng bấm "✅ Áp dụng" (không tự chạy khi mở trang Thiết lập — trang chỉ
 * ĐỌC qua LAY_VUNG_HIEN_TAI(), không hề gọi hàm này lúc tải trang).
 */
function DAT_VUNG_HE_THONG(locale) {
  locale = (locale || '').toString().trim();
  if (!locale) return { thongBao: 'Chưa chọn vùng nào.' };
  const SO_DONG_DU_PHONG = 5000;
  const mauNgay = MAU_NGAY_THEO_VUNG_[locale] || 'dd/mm/yyyy';

  function apDungChoFile_(ss) {
    ss.setSpreadsheetLocale(locale);
  }
  function datDinhDangCot_(sheet, chiSoCotAr, mau) {
    chiSoCotAr.forEach(function (c) { sheet.getRange(2, c + 1, SO_DONG_DU_PHONG, 1).setNumberFormat(mau); });
  }

  const ssChinh = getSS_();
  const locGoc = ssChinh.getSpreadsheetLocale();
  apDungChoFile_(ssChinh);

  const shNCC = getSheet_(SHEET_NAME.HD_NCC);
  const shRung = getSheet_(SHEET_NAME.HD_RUNG);
  datDinhDangCot_(shNCC, [NCC_COL.NGAY_KY, NCC_COL.NGAY_CAP, NCC_COL.NGAY_CAP_UQ], mauNgay);
  datDinhDangCot_(shNCC, [NCC_COL.DIEN_TICH_KY, NCC_COL.SL_DU_KIEN, NCC_COL.DON_GIA], MAU_SO_CHUAN_);
  datDinhDangCot_(shRung, [RUNG_COL.NGAY_KY, RUNG_COL.NGAY_GIAY_TO], mauNgay);
  datDinhDangCot_(shRung, [RUNG_COL.DIEN_TICH_M2, RUNG_COL.DON_GIA, RUNG_COL.KHOI_LUONG_DK, RUNG_COL.DIEN_TICH_GPS, RUNG_COL.KHOI_LUONG_THUC_HIEN], MAU_SO_CHUAN_);

  let locDraftGoc = null;
  try {
    const ssDraft = getReportSS_();
    locDraftGoc = ssDraft.getSpreadsheetLocale();
    apDungChoFile_(ssDraft);
    const shDraftBC = getOrCreateDraftBaoCaoSheet_();
    datDinhDangCot_(shDraftBC, [DRAFT_BAOCAO_COL.NGAY_KY, DRAFT_BAOCAO_COL.NGAY_CAP, DRAFT_BAOCAO_COL.THUC_HIEN_TU_NGAY, DRAFT_BAOCAO_COL.THUC_HIEN_DEN_NGAY], mauNgay);
    datDinhDangCot_(shDraftBC, [DRAFT_BAOCAO_COL.KHOI_LUONG_DU_KIEN, DRAFT_BAOCAO_COL.DON_GIA_DU_KIEN, DRAFT_BAOCAO_COL.GIA_TRI_HOP_DONG,
      DRAFT_BAOCAO_COL.KHOI_LUONG_THUC_HIEN, DRAFT_BAOCAO_COL.DON_GIA_THUC_HIEN, DRAFT_BAOCAO_COL.GIA_TRI_THUC_HIEN,
      DRAFT_BAOCAO_COL.KHOI_LUONG_CON_LAI, DRAFT_BAOCAO_COL.GIA_TRI_CON_LAI], MAU_SO_CHUAN_);
    const shDraftHSR = getOrCreateDraftHoSoRungSheet_();
    datDinhDangCot_(shDraftHSR, [DRAFT_HSR_COL.NGAY_KY, DRAFT_HSR_COL.NGAY_GIAY_TO], mauNgay);
    datDinhDangCot_(shDraftHSR, [DRAFT_HSR_COL.DIEN_TICH, DRAFT_HSR_COL.KHOI_LUONG_DU_KIEN, DRAFT_HSR_COL.DON_GIA, DRAFT_HSR_COL.GIA_TRI], MAU_SO_CHUAN_);
  } catch (e) { /* không chặn nếu file Draft chưa mở được lúc này — phần file chính đã xong */ }

  let thongBao = 'Đã đặt vùng "' + locale + '" (định dạng ngày ' + mauNgay + ', số theo đúng vùng) cho file dữ liệu chính (trước đó: ' + locGoc + ')';
  thongBao += locDraftGoc !== null ? ' và file Draft/Báo cáo (trước đó: ' + locDraftGoc + ').' : ' — CHƯA đặt được cho file Draft (thử lại sau).';
  return { thongBao: thongBao };
}
