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
    .addItem('🗺️ Mở bản đồ (GPS + diện tích)', 'RUN_HAK_SYSTEM_FINAL')
    .addItem('📝 Nhập liệu: HĐ mới / Rừng / Tài khoản', 'moFormNhapLieu')
    .addSeparator()
    .addItem('📊 Tổng hợp khối lượng & giá trị hợp đồng', 'xuatBaoCaoTongHopHopDong')
    .addItem('📋 Kiểm tra hồ sơ pháp lý (CCCD/GCN QSDĐ/Ủy quyền...)', 'KIEM_TRA_HO_SO_TOAN_BO')
    .addItem('🖼️ Kiểm tra ảnh (GPS ảnh, dấu hiệu chỉnh sửa)', 'KIEM_TRA_ANH_TOAN_BO')
    .addItem('🔎 Đối chiếu OCR file gốc với dữ liệu Sheet', 'DOI_CHIEU_HO_SO_DINH_KY')
    .addSeparator()
    .addItem('⏰ Thiết lập chạy tự động hàng tuần', 'THIET_LAP_TRIGGER_DINH_KY')
    .addSeparator()
    .addItem('🔄 Xây dựng lại Draft báo cáo (chạy 1 lần khi mới cài đặt)', 'XAY_DUNG_LAI_TOAN_BO_DRAFT')
    .addItem('📂 Mở file Báo cáo/Cache riêng', 'MO_FILE_BAO_CAO_RIENG')
    .addItem('⚡ Bật bẫy nhật ký tự động (HD_NCC/RUNG/STK/GPS/Picture)', 'THIET_LAP_TRIGGER_ONEDIT_DRAFT')
    .addItem('⏱️ Bật đồng bộ định kỳ phần thanh toán (30 phút/lần)', 'THIET_LAP_TRIGGER_DONG_BO_THANH_TOAN')
    .addToUi();
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
