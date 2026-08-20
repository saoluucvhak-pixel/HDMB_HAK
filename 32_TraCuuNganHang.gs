/**
 * ============================================================
 *  32_TraCuuNganHang.gs
 *  TRA CỨU TÊN CHỦ TÀI KHOẢN NGÂN HÀNG — đối chiếu đúng người trước khi lưu
 *  số tài khoản nhận tiền, tránh chuyển nhầm.
 *
 *  2 PHẦN:
 *  1. Danh sách ngân hàng Việt Nam (API CÔNG KHAI của VietQR, KHÔNG cần key)
 *     — dùng để đổi tên ngân hàng gõ tự do -> đúng mã ngân hàng (bank code).
 *  2. Tra cứu tên chủ tài khoản (CẦN đăng ký dịch vụ trung gian trả phí theo
 *     lượt — dịch vụ tra cứu miễn phí của VietQR đã ngừng cung cấp) — URL +
 *     API key cấu hình được ở Thiết lập, không hard-code cứng 1 nhà cung cấp.
 * ============================================================
 */

/** Danh sách ngân hàng VN — API công khai VietQR, cache 24h (danh sách hiếm khi đổi) */
function LAY_DANH_SACH_NGAN_HANG_VIETQR() {
  const cache = CacheService.getScriptCache();
  const daCache = cache.get('DS_NGAN_HANG_VIETQR');
  if (daCache) { try { return JSON.parse(daCache); } catch (e) { /* cache hỏng thì tải lại */ } }

  const resp = UrlFetchApp.fetch('https://api.vietqr.io/v2/banks', { muteHttpExceptions: true });
  const json = JSON.parse(resp.getContentText());
  if (json.code !== '00') throw new Error('Không tải được danh sách ngân hàng: ' + (json.desc || 'lỗi không rõ'));
  const list = (json.data || []).map(function (b) { return { code: b.code, bin: b.bin, ten: b.shortName, tenDayDu: b.name }; });
  try { cache.put('DS_NGAN_HANG_VIETQR', JSON.stringify(list), 86400); } catch (e) { /* danh sách hơi lớn, nếu không cache vừa thì thôi, vẫn trả kết quả bình thường */ }
  return list;
}

/** Đọc cấu hình dịch vụ tra cứu chủ TK */
function LAY_CAI_DAT_TRA_CUU_NH() {
  const p = PropertiesService.getScriptProperties();
  const apiKey = p.getProperty('TRACUU_NH_API_KEY') || '';
  return {
    daCoApiKey: !!apiKey, apiKeyRutGon: apiKey ? (apiKey.slice(0, 6) + '••••••••') : '',
    apiUrl: p.getProperty('TRACUU_NH_API_URL') || 'https://tracuubank.com/api/lookup'
  };
}

/** Lưu cấu hình dịch vụ tra cứu chủ TK */
function LUU_CAI_DAT_TRA_CUU_NH(apiKey, apiUrl) {
  const p = PropertiesService.getScriptProperties();
  if (apiKey) p.setProperty('TRACUU_NH_API_KEY', apiKey.toString().trim());
  p.setProperty('TRACUU_NH_API_URL', (apiUrl || 'https://tracuubank.com/api/lookup').toString().trim());
  return { thanhCong: true, thongBao: 'Đã lưu cấu hình tra cứu ngân hàng.' };
}

/**
 * Tra cứu tên chủ tài khoản thật — đối chiếu với tên chủ rừng đã nhập trong
 * hệ thống để phát hiện sớm nếu chuyển nhầm số tài khoản.
 * @param {string} soTK
 * @param {string} tenNganHangGoTuDo tên ngân hàng đã gõ trong hệ thống (tự do, vd "Vietcombank", "MB Bank chi nhánh X")
 * @param {string} [tenChuRungMongDoi] tên chủ rừng đã có trong hồ sơ, dùng để tự so khớp có đúng người không
 */
function TRA_CUU_TEN_CHU_TK(soTK, tenNganHangGoTuDo, tenChuRungMongDoi) {
  const cd = LAY_CAI_DAT_TRA_CUU_NH();
  if (!cd.daCoApiKey) return { thanhCong: false, loi: 'Chưa cấu hình API key tra cứu ngân hàng. Vào Thiết lập → 🏦 Tra cứu ngân hàng để nhập.' };
  if (!soTK || !soTK.toString().trim()) return { thanhCong: false, loi: 'Thiếu số tài khoản.' };

  // ---- Đổi tên ngân hàng gõ tự do -> đúng mã ngân hàng (bank code) ----
  let dsNganHang;
  try { dsNganHang = LAY_DANH_SACH_NGAN_HANG_VIETQR(); } catch (e) { return { thanhCong: false, loi: e.message }; }
  const tenLoc = (tenNganHangGoTuDo || '').toString().trim().toLowerCase();
  if (!tenLoc) return { thanhCong: false, loi: 'Thiếu tên ngân hàng — nhập/chọn ngân hàng trước khi kiểm tra.' };
  const boDau_ = function (s) { return s.toString().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase(); };
  const tenLocKhongDau = boDau_(tenLoc);
  const ngan = dsNganHang.find(function (b) {
    return b.code.toLowerCase() === tenLoc || boDau_(b.ten).indexOf(tenLocKhongDau) !== -1 || tenLocKhongDau.indexOf(boDau_(b.ten)) !== -1 ||
      boDau_(b.tenDayDu).indexOf(tenLocKhongDau) !== -1;
  });
  if (!ngan) return { thanhCong: false, loi: 'Không nhận diện được ngân hàng "' + tenNganHangGoTuDo + '" — kiểm tra lại tên ngân hàng đã nhập (thử chọn đúng tên trong danh sách gợi ý).' };

  // ---- Gọi dịch vụ tra cứu ----
  const apiKey = PropertiesService.getScriptProperties().getProperty('TRACUU_NH_API_KEY');
  const url = cd.apiUrl + '?bank_code=' + encodeURIComponent(ngan.code) + '&bank_number=' + encodeURIComponent(soTK.toString().trim());
  let json;
  try {
    const resp = UrlFetchApp.fetch(url, { headers: { Authorization: 'Bearer ' + apiKey }, muteHttpExceptions: true });
    json = JSON.parse(resp.getContentText());
  } catch (e) {
    return { thanhCong: false, loi: 'Lỗi gọi dịch vụ tra cứu: ' + e.message };
  }
  if (json.status !== 'success' || !json.data || !json.data.accountName) {
    return { thanhCong: false, loi: 'Không tra được tên chủ tài khoản — có thể số tài khoản sai, hoặc ngân hàng "' + ngan.ten + '" chưa được dịch vụ hỗ trợ. (' + (json.message || json.status || 'không rõ lý do') + ')' };
  }

  const tenChuTKThat = json.data.accountName.toString().trim();
  let khopTen = null;
  if (tenChuRungMongDoi) {
    const boDauKhongDauHoa_ = function (s) { return boDau_(s).replace(/[^a-z\s]/g, '').trim(); };
    khopTen = boDauKhongDauHoa_(tenChuTKThat) === boDauKhongDauHoa_(tenChuRungMongDoi);
  }

  return { thanhCong: true, tenChuTKThat: tenChuTKThat, nganHangDaNhanDien: ngan.ten, khopTen: khopTen };
}
