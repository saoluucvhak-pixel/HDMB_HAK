/**
 * ============================================================
 *  34_PhanQuyen.gs
 *  ĐĂNG NHẬP & PHÂN QUYỀN — cùng mô hình với HAK_WEBAPP_DNTT_DRAFT (v2026.7)
 *
 *  - Người dùng đăng nhập bằng tài khoản Google qua "Cổng đăng nhập": 1 dự án
 *    Apps Script RIÊNG chạy dưới quyền người truy cập (biết được email thật),
 *    ký HMAC (email + hạn dùng 5 phút + mã dùng 1 lần) rồi chuyển về webapp
 *    này qua ?sso=... Webapp xác minh chữ ký và cấp MÃ PHIÊN (ScriptCache, 6 giờ).
 *  - Mọi lời gọi từ trình duyệt đi qua api(phien, tenHam, thamSo) và bị kiểm tra
 *    quyền theo bảng _bangQuyenApi_(). Các hàm nghiệp vụ là hàm nội bộ (tên kết
 *    thúc "_") nên google.script.run KHÔNG gọi thẳng được.
 *  - Menu trong Google Sheet / sidebar nhập liệu dùng email thật của người bấm
 *    (Session.getActiveUser) — cũng phải có trong danh sách người dùng.
 *  - Chủ script và QUAN_TRI_CO_DINH luôn là Quản trị (không thể tự khóa mình).
 *  - Danh sách người dùng: sheet SYS_NguoiDung (tự tạo) trong file dữ liệu chính.
 * ============================================================
 */
const VAI_TRO = { ADMIN: 'ADMIN', NHAP_LIEU: 'NHAP_LIEU', XEM: 'XEM' };
const VAI_TRO_NHAN = { ADMIN: 'Quản trị', NHAP_LIEU: 'Nhập liệu', XEM: 'Chỉ xem' };
// XEM: xem/tra cứu/báo cáo/bản đồ. NHAP_LIEU: thêm/sửa hợp đồng, lô rừng,
// tài khoản, ảnh, GPS, kiểm tra hồ sơ. QUAN_TRI: thêm Thiết lập, người dùng, bảo trì.
const QUYEN = { XEM: 'XEM', NHAP_LIEU: 'NHAP_LIEU', QUAN_TRI: 'QUAN_TRI' };
const QUYEN_THEO_VAI_TRO = {
  ADMIN: [QUYEN.XEM, QUYEN.NHAP_LIEU, QUYEN.QUAN_TRI],
  NHAP_LIEU: [QUYEN.XEM, QUYEN.NHAP_LIEU],
  XEM: [QUYEN.XEM]
};
// Quản trị cố định (ngoài chủ script): KHÔNG đổi/khóa được từ webapp. Thêm/bớt email tại đây.
const QUAN_TRI_CO_DINH = ['saoluucvhak@gmail.com', 'phuthuy.apple@gmail.com'];
const TRANG_THAI_NGUOI_DUNG = { HOAT_DONG: 'Hoạt động', KHOA: 'Khóa' };
const NGUOI_DUNG_SHEET = 'SYS_NguoiDung';
const NGUOI_DUNG_HEADERS = ['Email', 'Họ tên', 'Vai trò', 'Trạng thái', 'Cập nhật lúc', 'Cập nhật bởi'];
const AUTH_CFG = {
  PHIEN_TTL_GIAY: 21600,            // tối đa của CacheService (6 giờ) — phiên không dùng quá 6 giờ thì hết hạn
  PHIEN_GIA_HAN_SAU_MS: 30 * 60 * 1000,        // đang dùng: cứ sau 30 phút cấp mã phiên mới (gia hạn thêm 6 giờ)
  PHIEN_TOI_DA_MS: 7 * 24 * 60 * 60 * 1000,    // dù dùng liên tục, sau 7 ngày phải đăng nhập lại
  SSO_HIEU_LUC_MS: 5 * 60 * 1000,   // link từ Cổng đăng nhập chỉ dùng được trong 5 phút
  SSO_NONCE_TTL_GIAY: 900,          // nhớ mã dùng-1-lần lâu hơn hạn link để chặn dùng lại
  CACHE_NGUOI_DUNG_GIAY: 60,        // đổi vai trò/khóa tài khoản có hiệu lực trong ≤ 60 giây
  PROP_SSO_SECRET: 'SSO_SECRET',
  PROP_CONG_DANG_NHAP_URL: 'SSO_GATEWAY_URL',
  CACHE_KEY_NGUOI_DUNG: 'sys_nguoi_dung_v1',
  TIEN_TO_PHIEN: 'phien_',
  TIEN_TO_NONCE: 'sso_n_',
  // Đăng nhập khi webapp nằm trong trang khác (iframe): Cổng mở ở cửa sổ nhỏ,
  // xong thì để phiên ở đây theo mã yêu cầu; khung nhúng hỏi lại bằng mã đó.
  TIEN_TO_YEU_CAU: 'dn_yc_',
  YEU_CAU_TTL_GIAY: 600,
  LOI_DANG_NHAP: '[AUTH] ',         // client hiện màn hình đăng nhập
  LOI_QUYEN: '[QUYEN] '             // client chỉ báo lỗi, không đăng xuất
};
const MAU_MA_PHIEN = /^[0-9a-f]{64}$/;
const MAU_MA_YEU_CAU = /^[0-9a-f]{32}$/;
const MAU_EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const MAU_URL_CONG_DANG_NHAP = /^https:\/\/script\.google\.com\/(a\/[^/]+\/)?macros\/s\/[\w-]+\/exec$/;

// Người dùng của lượt chạy hiện tại (mỗi lời gọi Apps Script là 1 lượt chạy riêng).
let _nguoiDungHienTai_ = null;
let _nguoiDungSession_ = null; // nhớ vai trò của người bấm menu trong 1 lượt chạy (tránh đọc lại danh sách người dùng)

function _chuanHoaEmail_(v) {
  return String(v || '').trim().toLowerCase();
}
function _emailChuScript_() {
  try { return _chuanHoaEmail_(Session.getEffectiveUser().getEmail()); } catch (e) { return ''; }
}
/** Email người đang thao tác (qua phiên đăng nhập hoặc người bấm menu). Rỗng nếu không xác định được. */
function _emailNguoiThucHien_() {
  const nd = _xacDinhNguoiDung_();
  return nd ? nd.email : '';
}

function _getNguoiDungSheet_() {
  const ss = getSS_();
  let sh = ss.getSheetByName(NGUOI_DUNG_SHEET);
  if (!sh) {
    sh = ss.insertSheet(NGUOI_DUNG_SHEET);
    sh.getRange(1, 1, 1, NGUOI_DUNG_HEADERS.length).setValues([NGUOI_DUNG_HEADERS]).setFontWeight('bold').setBackground('#d9d9d9');
    sh.setFrozenRows(1);
  }
  return sh;
}

/** Danh sách người dùng (cache 60 giây). */
function _docDanhSachNguoiDung_() {
  const cache = CacheService.getScriptCache();
  const raw = cache.get(AUTH_CFG.CACHE_KEY_NGUOI_DUNG);
  if (raw) return JSON.parse(raw);
  let list = [];
  try {
    const sh = getSS_().getSheetByName(NGUOI_DUNG_SHEET);
    if (sh && sh.getLastRow() > 1) {
      list = sh.getRange(2, 1, sh.getLastRow() - 1, NGUOI_DUNG_HEADERS.length).getValues()
        .map(function (r, i) {
          return {
            dong: i + 2,
            email: _chuanHoaEmail_(r[0]),
            hoTen: String(r[1] || '').trim(),
            vaiTro: String(r[2] || '').trim().toUpperCase(),
            trangThai: String(r[3] || '').trim()
          };
        })
        .filter(function (x) { return x.email; });
    }
  } catch (e) { log_('ERROR', '_docDanhSachNguoiDung_', 'Không đọc được ' + NGUOI_DUNG_SHEET, e); }
  try { cache.put(AUTH_CFG.CACHE_KEY_NGUOI_DUNG, JSON.stringify(list), AUTH_CFG.CACHE_NGUOI_DUNG_GIAY); } catch (e) { /* danh sách quá lớn cho cache -> lần sau đọc lại */ }
  return list;
}

/** Chủ script hoặc Quản trị cố định — luôn là Quản trị. */
function _laQuanTriCoDinh_(email) {
  const e = _chuanHoaEmail_(email);
  return !!e && (e === _emailChuScript_() || QUAN_TRI_CO_DINH.some(function (x) { return _chuanHoaEmail_(x) === e; }));
}

/** Vai trò hiệu lực của 1 email, null nếu chưa được cấp quyền / đã khóa. */
function _vaiTroCua_(email) {
  const e = _chuanHoaEmail_(email);
  if (!e) return null;
  if (_laQuanTriCoDinh_(e)) return VAI_TRO.ADMIN;
  const nd = _docDanhSachNguoiDung_().find(function (x) { return x.email === e; });
  if (!nd || nd.trangThai !== TRANG_THAI_NGUOI_DUNG.HOAT_DONG || !QUYEN_THEO_VAI_TRO[nd.vaiTro]) return null;
  return nd.vaiTro;
}

function _xacDinhNguoiDung_() {
  if (_nguoiDungHienTai_) return _nguoiDungHienTai_;
  let email = '';
  try { email = _chuanHoaEmail_(Session.getActiveUser().getEmail()); } catch (e) { /* ẩn danh */ }
  if (!email) return null;
  if (!_nguoiDungSession_ || _nguoiDungSession_.email !== email) _nguoiDungSession_ = { email: email, vaiTro: _vaiTroCua_(email) };
  return _nguoiDungSession_;
}

/** Chặn nếu người thao tác không có quyền `quyen` (QUYEN.*). Trả về người dùng. */
function _yeuCauQuyen_(quyen) {
  const nd = _xacDinhNguoiDung_();
  if (!nd) throw new Error(AUTH_CFG.LOI_DANG_NHAP + 'Chưa đăng nhập - vui lòng đăng nhập bằng tài khoản Google đã được cấp quyền.');
  if (!nd.vaiTro) throw new Error(AUTH_CFG.LOI_DANG_NHAP + 'Tài khoản ' + nd.email + ' chưa được cấp quyền hoặc đã bị khóa - liên hệ Quản trị.');
  if (QUYEN_THEO_VAI_TRO[nd.vaiTro].indexOf(quyen) === -1) {
    throw new Error(AUTH_CFG.LOI_QUYEN + 'Tài khoản ' + nd.email + ' (' + VAI_TRO_NHAN[nd.vaiTro] + ') không có quyền thực hiện thao tác này.');
  }
  return nd;
}

/** Người dùng hiện tại có quyền `quyen` không (không ném lỗi). */
function _coQuyen_(quyen) {
  const nd = _xacDinhNguoiDung_();
  return !!(nd && nd.vaiTro && QUYEN_THEO_VAI_TRO[nd.vaiTro].indexOf(quyen) !== -1);
}

/**
 * Hàm công khai được TRIGGER đã cài từ trước gọi theo tên (không đổi tên được vì
 * trigger cũ trỏ vào tên này): cho qua nếu đúng là lượt chạy của 1 trigger của
 * project (mã triggerUid do Google truyền vào khớp 1 trigger đang có), còn lại
 * phải có quyền như bình thường.
 */
function _yeuCauQuyenHoacTrigger_(e, quyen) {
  const uid = e && e.triggerUid ? String(e.triggerUid) : '';
  if (uid) {
    try {
      if (ScriptApp.getProjectTriggers().some(function (t) { return String(t.getUniqueId()) === uid; })) return null;
    } catch (err) { /* không đọc được danh sách trigger -> kiểm tra quyền như thường */ }
  }
  return _yeuCauQuyen_(quyen);
}

function _taoMaNgauNhien_() {
  return (Utilities.getUuid() + Utilities.getUuid()).replace(/-/g, '').toLowerCase();
}
/** Cấp mã phiên. dangNhapLuc: thời điểm đăng nhập qua Cổng (giữ nguyên khi gia hạn). */
function _taoPhien_(email, dangNhapLuc) {
  const phien = _taoMaNgauNhien_();
  const bayGio = Date.now();
  CacheService.getScriptCache().put(AUTH_CFG.TIEN_TO_PHIEN + phien, JSON.stringify({ email: email, taoLuc: bayGio, dangNhapLuc: dangNhapLuc || bayGio }), AUTH_CFG.PHIEN_TTL_GIAY);
  return phien;
}
/** Nội dung phiên còn hiệu lực { email, taoLuc, dangNhapLuc } hoặc null. */
function _docPhienDayDu_(phien) {
  if (!MAU_MA_PHIEN.test(String(phien || ''))) return null;
  const raw = CacheService.getScriptCache().get(AUTH_CFG.TIEN_TO_PHIEN + phien);
  if (!raw) return null;
  try {
    const p = JSON.parse(raw);
    const dangNhapLuc = Number(p.dangNhapLuc || p.taoLuc) || 0;
    if (Date.now() - dangNhapLuc > AUTH_CFG.PHIEN_TOI_DA_MS) return null; // quá 7 ngày kể từ lần đăng nhập
    return { email: _chuanHoaEmail_(p.email), taoLuc: Number(p.taoLuc) || 0, dangNhapLuc: dangNhapLuc };
  } catch (e) { return null; }
}
function _docPhien_(phien) {
  const p = _docPhienDayDu_(phien);
  return p ? p.email : '';
}

function _laySsoSecret_() {
  const props = PropertiesService.getScriptProperties();
  let secret = props.getProperty(AUTH_CFG.PROP_SSO_SECRET);
  if (!secret) {
    secret = _taoMaNgauNhien_();
    props.setProperty(AUTH_CFG.PROP_SSO_SECRET, secret);
  }
  return secret;
}
function _kyHmac_(data, secret) {
  return Utilities.base64EncodeWebSafe(Utilities.computeHmacSha256Signature(data, secret));
}
function _soSanhAnToan_(a, b) {
  if (a.length !== b.length) return false;
  let khac = 0;
  for (let i = 0; i < a.length; i++) khac |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return khac === 0;
}

/** Xác minh mã từ Cổng đăng nhập: đúng chữ ký, còn hạn, chưa dùng. Trả về { email, yeuCau }. */
function _xacMinhSso_(token) {
  const secret = PropertiesService.getScriptProperties().getProperty(AUTH_CFG.PROP_SSO_SECRET);
  if (!secret) throw new Error('Cổng đăng nhập chưa được cấu hình.');
  const parts = String(token || '').split('.');
  if (parts.length !== 2 || !parts[0] || !parts[1]) throw new Error('Mã đăng nhập không hợp lệ.');
  if (!_soSanhAnToan_(_kyHmac_(parts[0], secret), parts[1])) throw new Error('Mã đăng nhập không hợp lệ (sai chữ ký).');
  let payload;
  try {
    payload = JSON.parse(Utilities.newBlob(Utilities.base64DecodeWebSafe(parts[0])).getDataAsString('UTF-8'));
  } catch (e) {
    throw new Error('Mã đăng nhập không đọc được.');
  }
  if (!payload || typeof payload.exp !== 'number' || payload.exp < Date.now()) throw new Error('Link đăng nhập đã hết hạn - vui lòng đăng nhập lại.');
  const nonce = String(payload.n || '');
  const cache = CacheService.getScriptCache();
  if (!nonce || cache.get(AUTH_CFG.TIEN_TO_NONCE + nonce)) throw new Error('Link đăng nhập đã được dùng - vui lòng đăng nhập lại.');
  cache.put(AUTH_CFG.TIEN_TO_NONCE + nonce, '1', AUTH_CFG.SSO_NONCE_TTL_GIAY);
  const email = _chuanHoaEmail_(payload.email);
  if (!MAU_EMAIL.test(email)) throw new Error('Mã đăng nhập không có email hợp lệ.');
  return { email: email, yeuCau: MAU_MA_YEU_CAU.test(String(payload.yc || '')) ? payload.yc : '' };
}

/** Mã nguồn Cổng đăng nhập (dán vào 1 dự án Apps Script riêng). */
function _maNguonCongDangNhap_(appUrl, secret) {
  const soPhut = AUTH_CFG.SSO_HIEU_LUC_MS / 60000;
  return '// CỔNG ĐĂNG NHẬP - HỆ THỐNG HAK QUẢN LÝ HỢP ĐỒNG GỖ KEO (HDMB)\n'
    + '// Dán vào 1 dự án Apps Script MỚI (https://script.new), rồi Deploy > New deployment > Web app:\n'
    + '//   Execute as: User accessing the web app  ·  Who has access: Anyone with Google account\n'
    + '// Mã bí mật bên dưới phải KHỚP với webapp chính - không chia sẻ file này cho người khác.\n'
    + 'var APP_URL = ' + JSON.stringify(appUrl) + ';\n'
    + 'var SSO_SECRET = ' + JSON.stringify(secret) + ';\n'
    + 'var SSO_HIEU_LUC_MS = ' + AUTH_CFG.SSO_HIEU_LUC_MS + ';\n'
    + '\n'
    + 'function doGet(e) {\n'
    + '  var email = String(Session.getActiveUser().getEmail() || "").trim().toLowerCase();\n'
    + '  var trang = String((e && e.parameter && e.parameter.page) || "");\n'
    + '  var yc = String((e && e.parameter && e.parameter.yc) || "");  // mã yêu cầu khi đăng nhập từ trang nhúng\n'
    + '  if (!email) {\n'
    + '    return HtmlService.createHtmlOutput(\'<p style="font-family:Arial;padding:24px">Không xác định được tài khoản Google. Hãy đăng nhập Google rồi mở lại link này.</p>\');\n'
    + '  }\n'
    + '  var payload = JSON.stringify({ email: email, exp: Date.now() + SSO_HIEU_LUC_MS, n: Utilities.getUuid(), yc: /^[0-9a-f]{32}$/.test(yc) ? yc : "" });\n'
    + '  var p64 = Utilities.base64EncodeWebSafe(payload, Utilities.Charset.UTF_8);\n'
    + '  var sig = Utilities.base64EncodeWebSafe(Utilities.computeHmacSha256Signature(p64, SSO_SECRET));\n'
    + '  var url = APP_URL + "?sso=" + encodeURIComponent(p64 + "." + sig) + (/^[a-z]{1,20}$/.test(trang) ? "&page=" + trang : "");\n'
    + '  var emailHtml = email.replace(/[&<>"\']/g, function (c) { return "&#" + c.charCodeAt(0) + ";"; });\n'
    + '  var html = \'<div style="font-family:Arial,sans-serif;padding:32px;text-align:center">\'\n'
    + '    + \'<h2 style="margin:0 0 8px">Hệ thống HAK - Quản lý hợp đồng gỗ keo</h2>\'\n'
    + '    + \'<p>Tài khoản: <b>\' + emailHtml + \'</b></p>\'\n'
    + '    + \'<a href="\' + url + \'" target="_top" style="display:inline-block;margin-top:12px;padding:12px 24px;background:#16a34a;color:#fff;border-radius:8px;text-decoration:none;font-weight:600">Vào hệ thống</a>\'\n'
    + '    + \'<p style="color:#666;font-size:12px;margin-top:16px">Link có hiệu lực ' + soPhut + ' phút và chỉ dùng được 1 lần.</p></div>\';\n'
    + '  return HtmlService.createHtmlOutput(html).setTitle("Đăng nhập HAK");\n'
    + '}\n';
}

// ============================================================
//  HÀM CÔNG KHAI (không cần đăng nhập) — chỉ các hàm dưới đây và api()
// ============================================================

/** CÔNG KHAI: trạng thái đăng nhập + link Cổng đăng nhập. */
function thongTinDangNhap(phien) {
  const pd = _docPhienDayDu_(phien);
  const emailPhien = pd ? pd.email : '';
  let email = emailPhien;
  if (!email) {
    try { email = _chuanHoaEmail_(Session.getActiveUser().getEmail()); } catch (e) { /* ẩn danh */ }
  }
  const vaiTro = email ? _vaiTroCua_(email) : null;
  // Đang dùng -> gia hạn: cấp mã phiên mới (thêm 6 giờ), giữ mốc đăng nhập để vẫn giới hạn 7 ngày.
  // Mã cũ để tự hết hạn (không xóa) để các tab khác đang mở không bị đăng xuất giữa chừng.
  const phienMoi = (pd && vaiTro && Date.now() - pd.taoLuc > AUTH_CFG.PHIEN_GIA_HAN_SAU_MS) ? _taoPhien_(pd.email, pd.dangNhapLuc) : '';
  return {
    daDangNhap: !!vaiTro,
    email: email,
    vaiTro: vaiTro || '',
    vaiTroNhan: vaiTro ? VAI_TRO_NHAN[vaiTro] : '',
    quyen: vaiTro ? QUYEN_THEO_VAI_TRO[vaiTro].slice() : [],
    quaPhien: !!emailPhien,
    phienMoi: phienMoi,
    congDangNhapUrl: PropertiesService.getScriptProperties().getProperty(AUTH_CFG.PROP_CONG_DANG_NHAP_URL) || ''
  };
}

/** Đăng nhập từ trang nhúng: cửa sổ nhỏ (Cổng -> webapp ?sso) để lại phiên / lỗi theo mã yêu cầu rồi tự đóng. */
function _trangDangNhapNhung_(yeuCau, phien, loi) {
  CacheService.getScriptCache().put(AUTH_CFG.TIEN_TO_YEU_CAU + yeuCau, JSON.stringify(phien ? { phien: phien } : { loi: loi }), AUTH_CFG.YEU_CAU_TTL_GIAY);
  const noiDung = phien
    ? '<h2 style="color:#16a34a">✅ Đăng nhập thành công</h2><p>Quay lại trang đang dùng - cửa sổ này tự đóng.</p>'
    : '<h2 style="color:#dc2626">Không đăng nhập được</h2><p>' + String(loi).replace(/[&<>"']/g, function (c) { return '&#' + c.charCodeAt(0) + ';'; }) + '</p>';
  return HtmlService.createHtmlOutput('<div style="font-family:Arial,sans-serif;padding:32px;text-align:center">' + noiDung
    + '<button onclick="window.top.close()" style="margin-top:12px;padding:10px 20px">Đóng cửa sổ</button></div>'
    + (phien ? '<script>setTimeout(function () { try { window.top.close(); } catch (e) {} }, 1200);</script>' : ''))
    .setTitle('Đăng nhập HAK');
}

/** CÔNG KHAI: khung nhúng lấy phiên theo mã yêu cầu của mình (dùng 1 lần). Trả {phien}, {loi} hoặc {}. */
function nhanPhienDangNhap(yeuCau) {
  if (!MAU_MA_YEU_CAU.test(String(yeuCau || ''))) return {};
  const cache = CacheService.getScriptCache();
  const khoa = AUTH_CFG.TIEN_TO_YEU_CAU + yeuCau;
  const raw = cache.get(khoa);
  if (!raw) return {};
  cache.remove(khoa);
  try { return JSON.parse(raw); } catch (e) { return {}; }
}

/** CÔNG KHAI: hủy phiên (chỉ xóa đúng mã phiên được gửi lên). */
function dangXuat(phien) {
  if (MAU_MA_PHIEN.test(String(phien || ''))) CacheService.getScriptCache().remove(AUTH_CFG.TIEN_TO_PHIEN + phien);
  return { success: true };
}

/**
 * Xử lý ?sso=... trong doGet: xác minh, cấp phiên. Trả { phien, loi, yeuCau }.
 * Gọi từ doGet (Code.gs).
 */
function _xuLyDangNhapSso_(sso) {
  const kq = { phien: '', loi: '', yeuCau: '' };
  try {
    const xacMinh = _xacMinhSso_(sso);
    kq.yeuCau = xacMinh.yeuCau;
    const vaiTro = _vaiTroCua_(xacMinh.email);
    _nguoiDungHienTai_ = { email: xacMinh.email, vaiTro: vaiTro };
    if (vaiTro) {
      kq.phien = _taoPhien_(xacMinh.email);
      ghiNhatKy_('Đăng nhập', '', 'Đăng nhập qua Cổng đăng nhập Gmail' + (kq.yeuCau ? ' (từ trang nhúng).' : '.'));
    } else {
      kq.loi = 'Tài khoản ' + xacMinh.email + ' chưa được cấp quyền hoặc đã bị khóa - liên hệ Quản trị để được thêm vào hệ thống.';
      ghiNhatKy_('Đăng nhập bị từ chối', '', 'Email chưa được cấp quyền / đã khóa.');
    }
  } catch (err) {
    kq.loi = String((err && err.message) || err);
  } finally {
    _nguoiDungHienTai_ = null;
  }
  return kq;
}

/** CỬA VÀO DUY NHẤT cho webapp: kiểm tra phiên + quyền rồi gọi đúng hàm đã đăng ký trong _bangQuyenApi_(). */
function api(phien, tenHam, thamSo) {
  const bang = _bangQuyenApi_();
  const route = Object.prototype.hasOwnProperty.call(bang, tenHam) ? bang[tenHam] : null;
  if (!route) throw new Error('Chức năng không tồn tại: ' + tenHam);
  _nguoiDungHienTai_ = null;
  try {
    if (phien) {
      const email = _docPhien_(phien);
      if (!email) throw new Error(AUTH_CFG.LOI_DANG_NHAP + 'Phiên đăng nhập đã hết hạn - vui lòng đăng nhập lại.');
      _nguoiDungHienTai_ = { email: email, vaiTro: _vaiTroCua_(email) };
    }
    _yeuCauQuyen_(route.quyen);
    return route.fn.apply(null, Array.isArray(thamSo) ? thamSo : []);
  } finally {
    _nguoiDungHienTai_ = null;
  }
}

let _bangQuyenApiCache_ = null;
/**
 * BẢNG PHÂN QUYỀN DUY NHẤT: tên chức năng (trình duyệt gọi) -> hàm nội bộ + quyền cần có.
 * Chức năng không có trong bảng này thì KHÔNG gọi được từ webapp.
 * Dựng khi được gọi lần đầu (không dựng lúc nạp file) vì các hàm nằm ở nhiều file .gs
 * và Apps Script nạp từng file theo thứ tự — tham chiếu hàm của file nạp sau sẽ lỗi.
 */
function _bangQuyenApi_() {
  if (_bangQuyenApiCache_) return _bangQuyenApiCache_;
  const X = QUYEN.XEM, N = QUYEN.NHAP_LIEU, Q = QUYEN.QUAN_TRI;
  const r = function (fn, quyen) { return { fn: fn, quyen: quyen }; };
  _bangQuyenApiCache_ = {
    // --- Xem: tổng quan, bản đồ, báo cáo, tra cứu, trợ lý AI ---
    LAY_TONG_QUAN_HOP_DONG: r(LAY_TONG_QUAN_HOP_DONG_, X),
    TIEN_DO_HO_SO_HD: r(TIEN_DO_HO_SO_HD_, X),                 // giao diện mới: thanh 5 bước ở trang Nhập liệu
    getMapData: r(getMapData_, X),
    layThoiGianCapNhatBanDo: r(layThoiGianCapNhatBanDo_, X),
    TAI_TRANG_BAO_CAO_TONG_HOP: r(TAI_TRANG_BAO_CAO_TONG_HOP_, X),
    layBaoCaoHoSoRung: r(layBaoCaoHoSoRung_, X),
    layBaoCaoHopDongPhanTrang: r(layBaoCaoHopDongPhanTrang_, X),
    layBaoCaoThanhToan: r(layBaoCaoThanhToan_, X),
    layChiTietHoSoMotLoRung: r(layChiTietHoSoMotLoRung_, X),
    layTinhHinhThucHien: r(layTinhHinhThucHien_, X),
    layTongHopChoWebapp: r(layTongHopChoWebapp_, X),
    layDanhSachThanhLy: r(layDanhSachThanhLy_, X),
    layDanhSachHopDong: r(layDanhSachHopDong_, X),
    layDanhSachKhachHang: r(layDanhSachKhachHang_, X),
    layDanhSachLoaiHoSo: r(layDanhSachLoaiHoSo_, X),
    layDanhSachNhomKH: r(layDanhSachNhomKH_, X),
    layDanhSachRung: r(layDanhSachRung_, X),
    layChiTietHopDong: r(layChiTietHopDong_, X),
    layDanhSachTaiKhoan: r(layDanhSachTaiKhoan_, X),
    layGPSCuaRung: r(layGPSCuaRung_, X),
    layAnhCuaHopDong: r(layAnhCuaHopDong_, X),
    layHoSoCuaHopDong: r(layHoSoCuaHopDong_, X),
    layHopDongTheoKhachHang: r(layHopDongTheoKhachHang_, X),
    layDonGiaBinhQuanThang: r(layDonGiaBinhQuanThang_, X),
    layGoiYDiaChi: r(layGoiYDiaChi_, X),
    layGoiYNoiCap: r(layGoiYNoiCap_, X),
    traCuuDiaChiThamChieu: r(traCuuDiaChiThamChieu_, X),
    layPhieuCanTheoChuRung: r(layPhieuCanTheoChuRung_, X),
    LAY_DANH_SACH_NGAN_HANG_VIETQR: r(LAY_DANH_SACH_NGAN_HANG_VIETQR_, X),
    XUAT_BAO_CAO_FILE: r(XUAT_BAO_CAO_FILE_, X), // P-07b/H-13: máy chủ tự dựng dữ liệu file xuất (thay XUAT_BANG_RA_FILE nhận bảng từ trình duyệt)
    TRA_LOI_CHATBOT: r(TRA_LOI_CHATBOT_, X),
    TRA_CUU_HOP_DONG: r(TRA_CUU_HOP_DONG_, X),
    CHI_TIET_TRA_CUU_HOP_DONG: r(CHI_TIET_TRA_CUU_HOP_DONG_, X),
    LAY_ANH_TRA_CUU: r(LAY_ANH_TRA_CUU_, X),
    LAY_DU_LIEU_ANH: r(LAY_DU_LIEU_ANH_, X),
    XUAT_PDF_ANH: r(XUAT_PDF_ANH_, X),
    BAO_CAO_HOP_DONG_PDF: r(BAO_CAO_HOP_DONG_PDF_, X),
    LAY_FILE_HO_SO: r(LAY_FILE_HO_SO_, N),
    XEM_FILE_DRIVE: r(XEM_FILE_DRIVE_, X),
    // Kiểm tra & đối chiếu: chỉ đọc
    layDuLieuAnhWebapp: r(layDuLieuAnhWebapp_, X),
    layDuLieuKiemTraHoSoWebapp: r(layDuLieuKiemTraHoSoWebapp_, X),
    layDuLieuOCRWebapp: r(layDuLieuOCRWebapp_, X),
    layTatCaDraftAnh: r(layTatCaDraftAnh_, X),
    layDraftAnhChoRung: r(layDraftAnhChoRung_, X),
    layDanhSachTrigger: r(layDanhSachTrigger_, X),

    // --- Nhập liệu: hợp đồng, lô rừng, tài khoản, ảnh, GPS, hồ sơ, kiểm tra ---
    layHopDongTheoIdHD: r(layHopDongTheoIdHD_, N),
    TAO_HOP_DONG_MOI: r(TAO_HOP_DONG_MOI_, N),
    DOI_TINH_TRANG_HANG_LOAT: r(DOI_TINH_TRANG_HANG_LOAT_, N), // A2: duyệt/hủy nhiều hợp đồng trong 1 lệnh
    CAP_NHAT_HOP_DONG: r(CAP_NHAT_HOP_DONG_WEB_, N), // H-01: bản cho trang web — kiểm tra bước chuyển trạng thái, ghi nhật ký, cập nhật Draft
    THEM_LO_RUNG_MOI: r(THEM_LO_RUNG_MOI_, N),
    CAP_NHAT_LO_RUNG: r(CAP_NHAT_LO_RUNG_, N),
    XOA_LO_RUNG: r(XOA_LO_RUNG_, N),
    THEM_TAI_KHOAN_MOI: r(THEM_TAI_KHOAN_MOI_, N),
    CAP_NHAT_TAI_KHOAN: r(CAP_NHAT_TAI_KHOAN_, N),
    XOA_TAI_KHOAN: r(XOA_TAI_KHOAN_, N),
    CAP_NHAT_GPS_RUNG: r(CAP_NHAT_GPS_RUNG_, N),
    TRA_CUU_TEN_CHU_TK: r(TRA_CUU_TEN_CHU_TK_, N),
    TAO_DRAFT_MOI: r(TAO_DRAFT_MOI_, N),
    LUU_DRAFT: r(LUU_DRAFT_, N),
    MO_DRAFT_THEO_SO_DONG: r(MO_DRAFT_THEO_SO_DONG_, N),
    HUY_DRAFT: r(HUY_DRAFT_, N),
    LUU_CHINH_THUC: r(LUU_CHINH_THUC_, N),
    HUY_HOP_DONG: r(HUY_HOP_DONG_, N),
    THANH_LY_HOP_DONG: r(THANH_LY_HOP_DONG_, N),
    themLoaiHoSoMoi: r(themLoaiHoSoMoi_, N),
    TAI_ANH_GPS_LEN_DRIVE: r(TAI_ANH_GPS_LEN_DRIVE_, N),
    TAI_LEN_HO_SO_RUNG: r(TAI_LEN_HO_SO_RUNG_, N),
    THEM_ANH_RUNG: r(THEM_ANH_RUNG_, N),
    DUYET_ANH_RUNG: r(DUYET_ANH_RUNG_, N),
    TU_CHOI_ANH_RUNG: r(TU_CHOI_ANH_RUNG_, N),
    GAN_ANH_VAO_RUNG: r(GAN_ANH_VAO_RUNG_, N),
    DOC_TOA_DO_TU_ANH_WEBAPP: r(DOC_TOA_DO_TU_ANH_WEBAPP_, N),
    TRICH_XUAT_GPS_TU_ANH: r(TRICH_XUAT_GPS_TU_ANH_, N),
    OCR_TU_BAN_SCAN: r(OCR_TU_BAN_SCAN_, N),
    KIEM_TRA_ANH_DA_CHON: r(KIEM_TRA_ANH_DA_CHON_, N),
    KIEM_TRA_ANH_TU_LINK: r(KIEM_TRA_ANH_TU_LINK_, N),
    KIEM_TRA_HO_SO_TOAN_BO: r(KIEM_TRA_HO_SO_TOAN_BO_, N),
    KIEM_TRA_ANH_TOAN_BO: r(KIEM_TRA_ANH_TOAN_BO_, N),
    DOI_CHIEU_HO_SO_DINH_KY: r(DOI_CHIEU_HO_SO_DINH_KY_, N),
    doiChieuMotLoRungTheoId: r(doiChieuMotLoRungTheoId_, N),
    XUAT_BAO_CAO_MISA: r(XUAT_BAO_CAO_MISA_, N),
    DONG_BO_VAO_MISA_MASTER: r(DONG_BO_VAO_MISA_MASTER_, N),

    // --- Quản trị: xóa vĩnh viễn, thiết lập, trigger, bảo trì, chia sẻ quyền ---
    XOA_VINH_VIEN_HOP_DONG: r(XOA_VINH_VIEN_HOP_DONG_, Q),
    THIET_LAP_TRIGGER_TUY_CHINH: r(THIET_LAP_TRIGGER_TUY_CHINH_, Q),
    HUY_TAT_CA_TRIGGER: r(HUY_TAT_CA_TRIGGER_, Q),
    LAY_CAU_HINH_KET_NOI: r(LAY_CAU_HINH_KET_NOI_, Q),
    LUU_CAU_HINH_KET_NOI: r(LUU_CAU_HINH_KET_NOI_, Q),
    LAY_DANH_SACH_QUYEN_TRUY_CAP: r(LAY_DANH_SACH_QUYEN_TRUY_CAP_, Q),
    CHIA_SE_DU_LIEU_CHO_EMAIL: r(CHIA_SE_DU_LIEU_CHO_EMAIL_, Q),
    THU_HOI_QUYEN_TRUY_CAP: r(THU_HOI_QUYEN_TRUY_CAP_, Q),
    LAY_NHAT_KY_THEO_NGAY: r(LAY_NHAT_KY_THEO_NGAY_, Q),
    LAY_DS_LUU_TRU_XOA: r(LAY_DS_LUU_TRU_XOA_, Q),               // B2: các đợt xóa đã lưu trữ
    LAY_NHAT_KY_CHI_TIET: r(LAY_NHAT_KY_CHI_TIET_, Q),           // B2: lịch sử cũ -> mới theo ID_HD
    KHOI_PHUC_DU_LIEU_DA_XOA: r(KHOI_PHUC_DU_LIEU_DA_XOA_, Q),   // B2: khôi phục 1 đợt xóa
    LAY_CAI_DAT_CHATBOT: r(LAY_CAI_DAT_CHATBOT_, Q),
    LUU_CAI_DAT_CHATBOT: r(LUU_CAI_DAT_CHATBOT_, Q),
    LAY_CAI_DAT_TRA_CUU_NH: r(LAY_CAI_DAT_TRA_CUU_NH_, Q),
    LUU_CAI_DAT_TRA_CUU_NH: r(LUU_CAI_DAT_TRA_CUU_NH_, Q),
    LAY_THIET_LAP_MISA: r(LAY_THIET_LAP_MISA_, Q),
    LUU_THIET_LAP_MISA: r(LUU_THIET_LAP_MISA_, Q),
    DON_FILE_TAM_MISA_CON_SOT: r(DON_FILE_TAM_MISA_CON_SOT_, Q),
    LAY_CAI_DAT_TELEGRAM: r(LAY_CAI_DAT_TELEGRAM_, Q),
    LUU_CAI_DAT_TELEGRAM: r(LUU_CAI_DAT_TELEGRAM_, Q),
    GUI_THU_TELEGRAM: r(GUI_THU_TELEGRAM_, Q),
    TU_DONG_LAY_CHAT_ID_TELEGRAM: r(TU_DONG_LAY_CHAT_ID_TELEGRAM_, Q),
    BAT_POLLING_TELEGRAM: r(BAT_POLLING_TELEGRAM_, Q),
    TAT_POLLING_TELEGRAM: r(TAT_POLLING_TELEGRAM_, Q),
    KIEM_TRA_TRANG_THAI_POLLING_TELEGRAM: r(KIEM_TRA_TRANG_THAI_POLLING_TELEGRAM_, Q),
    BAT_WEBHOOK_TELEGRAM: r(BAT_WEBHOOK_TELEGRAM_, Q),
    TAT_WEBHOOK_TELEGRAM: r(TAT_WEBHOOK_TELEGRAM_, Q),
    KIEM_TRA_WEBHOOK_TELEGRAM: r(KIEM_TRA_WEBHOOK_TELEGRAM_, Q),
    BAT_TRIGGER_THONG_BAO_TELEGRAM: r(BAT_TRIGGER_THONG_BAO_TELEGRAM_, Q),
    TAT_TRIGGER_THONG_BAO_TELEGRAM: r(TAT_TRIGGER_THONG_BAO_TELEGRAM_, Q),
    KIEM_TRA_TRIGGER_THONG_BAO_TELEGRAM: r(KIEM_TRA_TRIGGER_THONG_BAO_TELEGRAM_, Q),
    THIET_LAP_TRIGGER_ONEDIT_DRAFT: r(THIET_LAP_TRIGGER_ONEDIT_DRAFT_, Q),
    TAT_TRIGGER_ONEDIT_DRAFT: r(TAT_TRIGGER_ONEDIT_DRAFT_, Q),
    KIEM_TRA_TRIGGER_ONEDIT_DRAFT: r(KIEM_TRA_TRIGGER_ONEDIT_DRAFT_, Q),
    THIET_LAP_TRIGGER_CHUYEN_DOI_ANH_URL: r(THIET_LAP_TRIGGER_CHUYEN_DOI_ANH_URL_, Q),
    TAT_TRIGGER_CHUYEN_DOI_ANH_URL: r(TAT_TRIGGER_CHUYEN_DOI_ANH_URL_, Q),
    KIEM_TRA_TRIGGER_CHUYEN_DOI_ANH_URL: r(KIEM_TRA_TRIGGER_CHUYEN_DOI_ANH_URL_, Q),
    CHUYEN_DOI_TEN_FILE_ANH_SANG_URL: r(CHUYEN_DOI_TEN_FILE_ANH_SANG_URL_, Q),
    CHUYEN_DOI_HO_SO_PHAP_LY_SANG_URL: r(CHUYEN_DOI_HO_SO_PHAP_LY_SANG_URL_, Q),
    DINH_DANG_TEXT_CHO_COT_QUAN_TRONG: r(DINH_DANG_TEXT_CHO_COT_QUAN_TRONG_, Q),
    KIEM_TRA_TRANG_THAI_KHOA_TEXT: r(KIEM_TRA_TRANG_THAI_KHOA_TEXT_, Q),
    LAY_VUNG_HIEN_TAI: r(LAY_VUNG_HIEN_TAI_, Q),
    DAT_VUNG_HE_THONG: r(DAT_VUNG_HE_THONG_, Q),
    LAY_VUNG_XUAT_EXCEL: r(LAY_VUNG_XUAT_EXCEL_, Q),
    DAT_VUNG_XUAT_EXCEL: r(DAT_VUNG_XUAT_EXCEL_, Q),
    LAY_MA_VUNG_XUAT_BAO_CAO: r(LAY_MA_VUNG_XUAT_BAO_CAO_, X),
    XAY_DUNG_LAI_TOAN_BO_DRAFT: r(XAY_DUNG_LAI_TOAN_BO_DRAFT_, Q),
    XAY_DUNG_LAI_DRAFT_HOSORUNG: r(XAY_DUNG_LAI_DRAFT_HOSORUNG_, Q),
    CHAN_DOAN_MO_COI_TOAN_HE_THONG: r(CHAN_DOAN_MO_COI_TOAN_HE_THONG_, Q),
    CHAY_TOAN_BO_BAO_TRI: r(CHAY_TOAN_BO_BAO_TRI_, Q),
    XEM_TRUOC_DIEN_SL_TU_LO_RUNG: r(XEM_TRUOC_DIEN_SL_TU_LO_RUNG_, Q),
    AP_DUNG_DIEN_SL_TU_LO_RUNG: r(AP_DUNG_DIEN_SL_TU_LO_RUNG_, Q),

    // --- Người dùng & Cổng đăng nhập ---
    LAY_DANH_SACH_NGUOI_DUNG: r(LAY_DANH_SACH_NGUOI_DUNG_, Q),
    LUU_NGUOI_DUNG: r(LUU_NGUOI_DUNG_, Q),
    LAY_CAU_HINH_DANG_NHAP: r(LAY_CAU_HINH_DANG_NHAP_, Q),
    LUU_LINK_CONG_DANG_NHAP: r(LUU_LINK_CONG_DANG_NHAP_, Q),
    TAO_LAI_MA_BI_MAT_DANG_NHAP: r(TAO_LAI_MA_BI_MAT_DANG_NHAP_, Q)
  };
  return _bangQuyenApiCache_;
}

// ============================================================
//  QUẢN TRỊ NGƯỜI DÙNG & CỔNG ĐĂNG NHẬP (chỉ Quản trị, qua api)
// ============================================================

function LAY_DANH_SACH_NGUOI_DUNG_() {
  _yeuCauQuyen_(QUYEN.QUAN_TRI);
  _getNguoiDungSheet_();
  CacheService.getScriptCache().remove(AUTH_CFG.CACHE_KEY_NGUOI_DUNG);
  return {
    chuScript: _emailChuScript_(),
    quanTriCoDinh: QUAN_TRI_CO_DINH.map(_chuanHoaEmail_),
    vaiTro: Object.keys(VAI_TRO).map(function (ma) { return { ma: ma, nhan: VAI_TRO_NHAN[ma] }; }),
    trangThai: Object.keys(TRANG_THAI_NGUOI_DUNG).map(function (k) { return TRANG_THAI_NGUOI_DUNG[k]; }),
    nguoiDung: _docDanhSachNguoiDung_().map(function (x) { return { email: x.email, hoTen: x.hoTen, vaiTro: x.vaiTro, trangThai: x.trangThai }; })
  };
}

/** Thêm mới hoặc cập nhật 1 người dùng (theo email). Không xóa — dùng trạng thái "Khóa". */
function LUU_NGUOI_DUNG_(duLieu) {
  _yeuCauQuyen_(QUYEN.QUAN_TRI);
  const email = _chuanHoaEmail_(duLieu && duLieu.email);
  const vaiTro = String((duLieu && duLieu.vaiTro) || '').trim().toUpperCase();
  const trangThai = (duLieu && duLieu.trangThai) === TRANG_THAI_NGUOI_DUNG.KHOA ? TRANG_THAI_NGUOI_DUNG.KHOA : TRANG_THAI_NGUOI_DUNG.HOAT_DONG;
  const hoTen = String((duLieu && duLieu.hoTen) || '').trim();
  if (!MAU_EMAIL.test(email)) return { success: false, message: '❌ Email không hợp lệ.' };
  if (!QUYEN_THEO_VAI_TRO[vaiTro]) return { success: false, message: '❌ Vai trò không hợp lệ.' };
  if (_laQuanTriCoDinh_(email)) return { success: false, message: '⚠️ Email này là Quản trị cố định (chủ script hoặc khai báo trong mã) - không cần thêm/không thể đổi từ webapp.' };

  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  let cu;
  try {
    const sh = _getNguoiDungSheet_();
    CacheService.getScriptCache().remove(AUTH_CFG.CACHE_KEY_NGUOI_DUNG);
    cu = _docDanhSachNguoiDung_().find(function (x) { return x.email === email; });
    // Chặn chuỗi bắt đầu bằng = + - @ bị Sheets hiểu là công thức.
    const anToan = function (v) { return /^[=+\-@]/.test(v) ? "'" + v : v; };
    const dong = [email, anToan(hoTen), vaiTro, trangThai, new Date(), _emailNguoiThucHien_() || 'N/A'];
    if (cu) sh.getRange(cu.dong, 1, 1, dong.length).setValues([dong]);
    else sh.getRange(sh.getLastRow() + 1, 1, 1, dong.length).setValues([dong]);
    CacheService.getScriptCache().remove(AUTH_CFG.CACHE_KEY_NGUOI_DUNG);
  } finally {
    lock.releaseLock();
  }
  ghiNhatKy_('Phân quyền', '', cu
    ? email + ': vai trò ' + cu.vaiTro + ' → ' + vaiTro + ', trạng thái ' + cu.trangThai + ' → ' + trangThai
    : 'Thêm ' + email + ': vai trò ' + vaiTro + ', trạng thái ' + trangThai);
  return { success: true, message: '✅ Đã lưu người dùng ' + email + ' (' + VAI_TRO_NHAN[vaiTro] + ', ' + trangThai + ').' };
}

function LAY_CAU_HINH_DANG_NHAP_() {
  _yeuCauQuyen_(QUYEN.QUAN_TRI);
  const appUrl = ScriptApp.getService().getUrl() || '';
  return {
    appUrl: appUrl,
    congDangNhapUrl: PropertiesService.getScriptProperties().getProperty(AUTH_CFG.PROP_CONG_DANG_NHAP_URL) || '',
    maNguon: _maNguonCongDangNhap_(appUrl, _laySsoSecret_())
  };
}

function LUU_LINK_CONG_DANG_NHAP_(url) {
  _yeuCauQuyen_(QUYEN.QUAN_TRI);
  const u = String(url || '').trim();
  if (!MAU_URL_CONG_DANG_NHAP.test(u)) {
    return { success: false, message: '❌ Link Cổng đăng nhập phải có dạng https://script.google.com/macros/s/.../exec' };
  }
  PropertiesService.getScriptProperties().setProperty(AUTH_CFG.PROP_CONG_DANG_NHAP_URL, u);
  ghiNhatKy_('Cấu hình đăng nhập', '', 'Đổi link Cổng đăng nhập: ' + u);
  return { success: true, message: '✅ Đã lưu link Cổng đăng nhập.' };
}

/** Đổi mã bí mật (khi nghi bị lộ). Phải dán lại mã nguồn mới vào Cổng đăng nhập. */
function TAO_LAI_MA_BI_MAT_DANG_NHAP_() {
  _yeuCauQuyen_(QUYEN.QUAN_TRI);
  PropertiesService.getScriptProperties().setProperty(AUTH_CFG.PROP_SSO_SECRET, _taoMaNgauNhien_());
  ghiNhatKy_('Cấu hình đăng nhập', '', 'Tạo lại mã bí mật Cổng đăng nhập - cần dán lại mã nguồn Cổng đăng nhập.');
  return { success: true, message: '✅ Đã tạo mã bí mật mới. Hãy dán lại mã nguồn mới vào dự án Cổng đăng nhập và Deploy lại (Manage deployments > Edit > New version).' };
}
