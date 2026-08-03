/**
 * ============================================================
 *  05_Menu.gs
 *  MENU TỔNG — thay thế/mở rộng onOpen() trong file Code.gs gốc.
 *  Nếu bạn đã có onOpen() trong Code.gs (bản đồ HAK), hãy XÓA
 *  hàm onOpen() cũ đi và chỉ giữ lại hàm onOpen() dưới đây,
 *  để tránh xung đột (Apps Script chỉ chạy 1 onOpen() được định nghĩa cuối).
 * ============================================================
 */
function onOpen() {
  SpreadsheetApp.getUi().createMenu('🚀 HỆ THỐNG HAK - QUẢN LÝ GỖ KEO')
    .addItem('📖 Hướng dẫn sử dụng', 'HIEN_HUONG_DAN_SU_DUNG')
    .addSeparator()
    .addItem('🗺️ Mở bản đồ (GPS + diện tích)', 'RUN_HAK_SYSTEM_FINAL')
    .addItem('📝 Nhập liệu: HĐ mới / Rừng / Tài khoản', 'moFormNhapLieu')
    .addSeparator()
    .addItem('🗑️ Dọn dẹp sheet TongHop_HopDong cũ (không dùng nữa)', 'XOA_SHEET_TONGHOP_CU')
    .addItem('📋 Kiểm tra hồ sơ pháp lý (CCCD/GCN QSDĐ/Ủy quyền...)', 'KIEM_TRA_HO_SO_TOAN_BO')
    .addItem('🖼️ Kiểm tra ảnh (GPS ảnh, dấu hiệu chỉnh sửa)', 'KIEM_TRA_ANH_TOAN_BO')
    .addItem('🔎 Đối chiếu OCR file gốc với dữ liệu Sheet', 'DOI_CHIEU_HO_SO_DINH_KY')
    .addSeparator()
    .addItem('⏰ Thiết lập chạy tự động hàng tuần', 'THIET_LAP_TRIGGER_DINH_KY')
    .addSeparator()
    .addItem('🔄 Xây dựng lại Draft báo cáo (chạy 1 lần khi mới cài đặt)', 'XAY_DUNG_LAI_TOAN_BO_DRAFT')
    .addItem('🌲 Xây dựng lại cache Hồ sơ rừng (chạy 1 lần khi mới cài đặt tính năng này)', 'CHAY_XAY_DUNG_LAI_DRAFT_HOSORUNG')
    .addItem('⏱️ Chẩn đoán tốc độ báo cáo (đo thời gian từng bước)', 'CHAY_CHAN_DOAN_TOC_DO_VA_HIEN_KQ')
    .addItem('📂 Mở file Báo cáo/Cache riêng', 'MO_FILE_BAO_CAO_RIENG')
    .addItem('⚡ Bật bẫy nhật ký tự động (HD_NCC/RUNG/STK/GPS/Picture)', 'THIET_LAP_TRIGGER_ONEDIT_DRAFT')
    .addItem('⏱️ Bật đồng bộ định kỳ phần thanh toán (30 phút/lần)', 'THIET_LAP_TRIGGER_DONG_BO_THANH_TOAN')
    .addItem('💰 Đồng bộ thanh toán NGAY (không chờ 30 phút)', 'CHAY_DONG_BO_THANH_TOAN_NGAY')
    .addItem('🛰️ Chẩn đoán GPS lô rừng (vì sao không hiện tọa độ)', 'CHAN_DOAN_GPS_TOAN_BO')
    .addItem('🖼️ Chẩn đoán ảnh (vì sao không có link xem)', 'CHAN_DOAN_ANH_TOAN_BO')
    .addItem('🔎 Chẩn đoán ảnh theo 1 lô rừng cụ thể (lệch ID_HD)', 'CHAN_DOAN_ANH_THEO_RUNG_TU_MENU')
    .addItem('🔎 Chẩn đoán Số HĐ trong Hồ sơ rừng (lọc ra trống)', 'CHAN_DOAN_SO_HD_HOSORUNG')
    .addItem('📝 Định dạng TEXT cho cột quan trọng (CCCD/SĐT/Số HĐ/Số TK...)', 'DINH_DANG_TEXT_CHO_COT_QUAN_TRONG_TU_MENU')
    .addItem('📅 Đồng bộ định dạng ngày/tháng/năm (dd/mm/yyyy)', 'DINH_DANG_NGAY_THANG_NAM_DONG_BO')
    .addItem('⚙️ Cài đặt Vùng (Locale)...', 'MO_DIALOG_CAI_DAT_VUNG')
    .addItem('📤 Xuất báo cáo MISA (Update_Hopdong_NCC_DN.xlsx)', 'XUAT_BAO_CAO_MISA_TU_MENU')
    .addItem('⚡ Chuyển tên file ảnh sang URL thật (khắc phục "Xem chi tiết" chậm/treo — chạy 1 lần)', 'CHUYEN_DOI_TEN_FILE_ANH_SANG_URL')
    .addItem('⚡ Chuyển hồ sơ pháp lý (DinhKemGiayTo) sang URL thật — chạy 1 lần', 'CHUYEN_DOI_HO_SO_PHAP_LY_SANG_URL')
    .addToUi();
}

/** Hiện hướng dẫn sử dụng đầy đủ trong 1 cửa sổ dialog ngay trong Google Sheet */
function HIEN_HUONG_DAN_SU_DUNG() {
  const html = HtmlService.createHtmlOutputFromFile('13_HuongDan')
    .setWidth(900).setHeight(650);
  SpreadsheetApp.getUi().showModalDialog(html, '📖 Hướng dẫn sử dụng — Hệ thống HAK');
}

/** Hiện link file Google Sheet riêng chứa Draft/Cache báo cáo (tách khỏi file dữ liệu chính) */
function MO_FILE_BAO_CAO_RIENG() {
  const url = getReportSS_().getUrl();
  SpreadsheetApp.getUi().alert('File Báo cáo/Cache riêng:\n' + url + '\n\n(Copy link này để mở trong tab mới)');
}

/** Mở sidebar nhập liệu Tạo hợp đồng / Thêm rừng / Thêm tài khoản / Sửa rừng */
function moFormNhapLieu() {
  const html = HtmlService.createTemplateFromFile('07_Form_HopDong')
    .evaluate()
    .setTitle('📝 Nhập liệu HAK')
    .setWidth(380);
  SpreadsheetApp.getUi().showSidebar(html);
}

/**
 * Dùng trong các file HTML templated (createTemplateFromFile) để ghép các phần
 * dùng chung (CSS, sidebar) vào trang, ví dụ: <?!= include('09_Style') ?>
 */
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}
