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
    .addToUi();
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
