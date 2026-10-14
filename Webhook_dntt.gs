var WEBHOOK_URL = "https://script.google.com/macros/s/AKfycbxx0g8iFoeEusDpMNaaGQKCKXlSmGD_XwPY2xyCmVIcoTn-MFw/exec";
var WEBHOOK_SECRET = "2fef9ece-5a0b-43f5-b0e3-d020940e0c7b";

// Bảo mật (nâng cấp 10/2026): mã bí mật đọc từ Script Properties "DNTT_WEBHOOK_SECRET". Giá trị ghi cứng ở trên đã lộ
// trong repo công khai và CHỈ còn là dự phòng để webhook không ngừng chạy trước khi xoay khóa — xem
// docs/qa/SECURITY_ACTIONS.md: đặt khóa mới ở dự án DNTT + Script Properties của HDMB, rồi xóa giá trị cứng.
function _maBiMatWebhookDntt_() {
  var v = '';
  try { v = PropertiesService.getScriptProperties().getProperty('DNTT_WEBHOOK_SECRET') || ''; } catch (e) { /* dùng dự phòng */ }
  return v || WEBHOOK_SECRET;
}

function onChangeLamMoiCache(e) {
  try {
    UrlFetchApp.fetch(WEBHOOK_URL + "?action=lam_moi_cache&secret=" + encodeURIComponent(_maBiMatWebhookDntt_()), { muteHttpExceptions: true });
  } catch (err) {
    // bo qua loi mang - khong chan thao tac cua nguoi dung tren file nay
  }
}
