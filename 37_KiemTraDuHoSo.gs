/**
 * ============================================================
 *  37_KiemTraDuHoSo.gs
 *  1) ĐIỀU KIỆN CHUYỂN "Đang thực hiện": hợp đồng có đủ số CCCD, MST, tên, địa chỉ chủ rừng, số tài khoản
 *     + ngân hàng (lấy ở HD_STK); mỗi lô rừng có địa chỉ rừng, file hồ sơ pháp lý đính kèm (giấy tờ CCCD nằm trong hồ sơ
 *     pháp lý — không đính kèm CCCD riêng) và tọa độ GPS; hợp đồng có ảnh GPS hoặc ảnh hiện trường (đã duyệt).
 *     Thiếu -> không chuyển, trả danh sách cần bổ sung (trang web hiện cảnh báo).
 *  2) CẢNH BÁO TỌA ĐỘ XA ĐỊA CHỈ RỪNG: lưu điểm GPS cách vị trí của "Địa chỉ rừng" (định vị qua Google Maps)
 *     trên 5 km -> vẫn lưu, kèm cảnh báo để kiểm tra lại.
 * ============================================================
 */

const KHOANG_CACH_CANH_BAO_GPS_M_ = 5000;

/**
 * Dữ liệu 5 sheet nạp sẵn 1 lần cho thao tác nhiều hợp đồng (duyệt hàng loạt) — null = đọc từng hợp đồng như thường.
 * Trước đây duyệt 200 HĐ = ~10 lần đọc Sheet / HĐ (~2.000 lần, dễ quá 6 phút).
 */
let _duLieuDuHoSoNapSan_ = null;

/** Nạp sẵn HD_NCC / HD_STK / HD_RUNG / HD_GPS / HD_Picture (mỗi sheet 1 lần), chỉ mục theo cột khóa như docDongTheoKhoa_. */
function napSanDuLieuDuHoSo_() {
  const chiMuc = function (tenSheet, cot) {
    const o = {};
    readData_(tenSheet).forEach(function (r, i) {
      const k = (r[cot] === null || r[cot] === undefined ? '' : r[cot]).toString().trim();
      if (k) (o[k] = o[k] || []).push({ r: r, i: i });
    });
    return o;
  };
  return {
    ncc: chiMuc(SHEET_NAME.HD_NCC, NCC_COL.ID_HD), stk: chiMuc(SHEET_NAME.HD_STK, STK_COL.ID_HD),
    rung: chiMuc(SHEET_NAME.HD_RUNG, RUNG_COL.ID_KEY_HD), gps: chiMuc(SHEET_NAME.HD_GPS, GPS_COL.ID_KEY_GPS),
    pic: chiMuc(SHEET_NAME.HD_PICTURE, PICTURE_COL.ID_HD)
  };
}

/** Như docDongTheoKhoa_ (đúng thứ tự dòng trên sheet) — lấy từ dữ liệu nạp sẵn nếu có. */
function _docDongDuHoSo_(loai, tenSheet, cot, cacKhoa) {
  const nap = _duLieuDuHoSoNapSan_;
  if (!nap) return docDongTheoKhoa_(tenSheet, cot, cacKhoa);
  const da = {}, kq = [];
  (cacKhoa || []).forEach(function (k) {
    k = (k === null || k === undefined ? '' : k).toString().trim();
    if (!k || da[k]) return;
    da[k] = true;
    (nap[loai][k] || []).forEach(function (x) { kq.push(x); });
  });
  return kq.sort(function (a, b) { return a.i - b.i; }).map(function (x) { return x.r; });
}

/**
 * Hợp đồng đã đủ hồ sơ để chuyển "Đang thực hiện" chưa — đọc trực tiếp sheet gốc (chỉ dòng của hợp đồng này).
 * Trả { du: bool, thieu: [mô tả từng mục còn thiếu],
 *       buoc: { chuRung, taiKhoan, loRung, gps, anh } } — buoc dùng cho thanh tiến độ 5 bước (TIEN_DO_HO_SO_HD_),
 * để thanh tiến độ và điều kiện Duyệt luôn cùng 1 cách tính (trước đây thanh tiến độ ✓ đủ mà bấm Duyệt vẫn bị từ chối).
 */
function kiemTraDuHoSoDeThucHien_(idHD) {
  idHD = (idHD || '').toString().trim();
  const row = _docDongDuHoSo_('ncc', SHEET_NAME.HD_NCC, NCC_COL.ID_HD, [idHD])[0];
  if (!row) return { du: false, khongThay: true, thieu: ['Không tìm thấy hợp đồng ' + idHD + '.'], buoc: { chuRung: false, taiKhoan: false, loRung: false, gps: false, anh: false } };
  const trong = function (v) { return v === null || v === undefined || String(v).trim() === ''; };
  const thieu = [];

  // 1. Thông tin chủ rừng (HD_NCC) + tài khoản nhận tiền (HD_STK)
  const thieuTT = [];
  if (trong(row[NCC_COL.TEN_CHU_RUNG])) thieuTT.push('họ tên');
  if (!laCCCDHopLe_(row[NCC_COL.CCCD_CHU_RUNG])) thieuTT.push('số CCCD (12 số)');
  if (trong(row[NCC_COL.MA_SO_THUE])) thieuTT.push('mã số thuế');
  if (trong(row[NCC_COL.DIA_CHI_TT])) thieuTT.push('địa chỉ');
  const chuRungDu = !thieuTT.length;
  // Số tài khoản + ngân hàng lấy ở HD_STK (bảng tài khoản nhận tiền), không lấy cột Số TK của HD_NCC
  const coTK = _docDongDuHoSo_('stk', SHEET_NAME.HD_STK, STK_COL.ID_HD, [idHD])
    .some(function (r) { return !trong(r[STK_COL.SO_TK]) && !trong(r[STK_COL.NGAN_HANG]); });
  if (!coTK) thieuTT.push('số tài khoản + ngân hàng');
  if (thieuTT.length) thieu.push('Thông tin chủ rừng còn thiếu: ' + thieuTT.join(', '));

  // 2. Lô rừng: địa chỉ rừng + file hồ sơ pháp lý + tọa độ (bỏ lô rỗng tự tạo nếu đã có lô thật)
  const rung = _docDongDuHoSo_('rung', SHEET_NAME.HD_RUNG, RUNG_COL.ID_KEY_HD, [idHD]);
  const loThat = rung.filter(function (r) { return !laLoRong_(r); }); // laLoRong_: 00_Config.gs (dùng chung với xuất MISA)
  const dsLo = loThat.length ? loThat : rung;
  if (!rung.length) thieu.push('Chưa có lô rừng nào');
  const idRungs = dsLo.map(function (r) { return (r[RUNG_COL.ID_RUNG] || '').toString().trim(); });
  const gpsTheoLo = {};
  let coAnhGps = false;
  if (idRungs.length) {
    _docDongDuHoSo_('gps', SHEET_NAME.HD_GPS, GPS_COL.ID_KEY_GPS, idRungs).forEach(function (g) {
      const id = (g[GPS_COL.ID_KEY_GPS] || '').toString().trim();
      // getLatLngFromRow_ (Code.gs): đọc cả điểm cũ lưu dạng độ-phút-giây (HE_TOA_DO = "DMS"), trước đây Number() ra NaN
      // -> lô có GPS vẫn bị báo "thiếu tọa độ GPS", không duyệt được.
      const ll = getLatLngFromRow_(g), lat = Number(ll.lat), lng = Number(ll.lng);
      // Dòng GPS "khung" tạo sẵn khi tạo hợp đồng chưa có tọa độ -> không tính là đã đo
      if (!trong(g[GPS_COL.LAT]) && !trong(g[GPS_COL.LNG]) && isFinite(lat) && isFinite(lng) && (lat !== 0 || lng !== 0)) gpsTheoLo[id] = (gpsTheoLo[id] || 0) + 1;
      if (!trong(g[GPS_COL.HINH_ANH])) coAnhGps = true;
    });
  }
  let loRungDu = rung.length > 0, gpsDu = rung.length > 0;
  dsLo.forEach(function (r, i) {
    const t = [];
    if (trong(r[RUNG_COL.DIA_CHI_RUNG])) { t.push('địa chỉ rừng'); loRungDu = false; }
    if (trong(r[RUNG_COL.DINH_KEM_GIAY_TO])) { t.push('file hồ sơ pháp lý đính kèm'); loRungDu = false; }
    if (!gpsTheoLo[idRungs[i]]) { t.push('tọa độ GPS'); gpsDu = false; }
    if (t.length) thieu.push('Lô ' + (r[RUNG_COL.MA_RUNG] || idRungs[i] || (i + 1)) + ' còn thiếu: ' + t.join(', '));
  });

  // 3. Ảnh GPS hoặc ảnh hiện trường (HD_Picture — đã duyệt)
  let coAnhHT = false;
  _docDongDuHoSo_('pic', SHEET_NAME.HD_PICTURE, PICTURE_COL.ID_HD, [idHD].concat(idRungs)).forEach(function (r) {
    for (let c = PICTURE_COL.PICTURE_START; c <= PICTURE_COL.PICTURE_END; c++) if (!trong(r[c])) { coAnhHT = true; break; }
  });
  if (!coAnhGps && !coAnhHT) thieu.push('Chưa có ảnh GPS hoặc ảnh hiện trường (ảnh tải lên phải được Duyệt)');

  return {
    du: thieu.length === 0, thieu: thieu,
    buoc: { chuRung: chuRungDu, taiKhoan: coTK, loRung: loRungDu, gps: gpsDu, anh: coAnhGps || coAnhHT }
  };
}

/**
 * Sau khi xóa / sửa hồ sơ của hợp đồng ĐANG THỰC HIỆN: còn đủ điều kiện "Đang thực hiện" không. Không chặn thao tác,
 * chỉ trả lời cảnh báo ('' nếu không cần) để trang web báo người dùng bổ sung — theo yêu cầu: xóa vẫn được, có cảnh báo.
 */
function canhBaoHoSoSauKhiSua_(idHD) {
  try {
    const row = docDongTheoKhoa_(SHEET_NAME.HD_NCC, NCC_COL.ID_HD, [idHD])[0];
    if (!row || (row[NCC_COL.TINH_TRANG] || '').toString().trim() !== 'Đang thực hiện') return { canhBaoHoSo: '', thieuHoSo: [] };
    const kt = kiemTraDuHoSoDeThucHien_(idHD);
    if (kt.du) return { canhBaoHoSo: '', thieuHoSo: [] };
    return {
      canhBaoHoSo: 'Hợp đồng đang "Đang thực hiện" nhưng sau thao tác này hồ sơ không còn đủ — vui lòng bổ sung:\n• ' + kt.thieu.join('\n• '),
      thieuHoSo: kt.thieu
    };
  } catch (e) {
    log_('WARNING', 'canhBaoHoSoSauKhiSua_', 'Không kiểm tra được hồ sơ ' + idHD, e);
    return { canhBaoHoSo: '', thieuHoSo: [] };
  }
}

function loiChuaDuHoSo_(thieu) {
  return 'Chưa đủ hồ sơ để chuyển "Đang thực hiện" — vui lòng bổ sung đầy đủ hồ sơ:\n• ' + thieu.join('\n• ');
}

/** Kiểm tra đủ hồ sơ rồi chuyển "Đang thực hiện" (theo đúng bước chuyển của trang Hợp đồng). */
function _thuChuyenDangThucHien_(idHD) {
  // CAP_NHAT_HOP_DONG_WEB_ tự kiểm tra đủ hồ sơ (trả thieuHoSo khi thiếu) — trước đây kiểm tra ở đây rồi kiểm tra lại = đọc Sheet 2 lần
  return CAP_NHAT_HOP_DONG_WEB_(timSoDongTheoGiaTri_(SHEET_NAME.HD_NCC, NCC_COL.ID_HD, idHD), { tinhTrang: 'Đang thực hiện' }, idHD);
}

/** API cho trang web: xem trước hợp đồng còn thiếu gì (không đổi gì). */
function KIEM_TRA_DU_HO_SO_HD_(idHD) {
  _yeuCauQuyen_(QUYEN.XEM);
  return kiemTraDuHoSoDeThucHien_(idHD);
}

/**
 * Vị trí (lat/lng) của "Địa chỉ rừng" qua Google Maps — nhớ 6 giờ theo địa chỉ. null nếu không định vị được
 * hoặc chỉ định vị được ở mức tỉnh/quốc gia (quá thô để so khoảng cách 5 km).
 */
function viTriDiaChiRung_(diaChi) {
  diaChi = (diaChi || '').toString().trim();
  if (!diaChi) return null;
  const coSan = timToaDoTrongDiaChiRung_(diaChi); // địa chỉ có ghi sẵn tọa độ
  if (coSan) return { lat: coSan.lat, lng: coSan.lng };
  const cache = CacheService.getScriptCache();
  const khoa = 'GEO_' + Utilities.base64EncodeWebSafe(diaChi).slice(0, 200);
  try {
    const c = cache.get(khoa);
    if (c) return c === 'null' ? null : JSON.parse(c);
  } catch (e) { /* không có cache thì định vị lại */ }
  let kq = null;
  try {
    const res = Maps.newGeocoder().setRegion('vn').setLanguage('vi').geocode(diaChi);
    const r0 = res && res.status === 'OK' && res.results && res.results[0];
    const loai = (r0 && r0.types) || [];
    const quaTho = loai.indexOf('country') !== -1 || loai.indexOf('administrative_area_level_1') !== -1;
    if (r0 && !quaTho) {
      const loc = r0.geometry.location;
      if (loc.lat >= 8 && loc.lat <= 24 && loc.lng >= 102 && loc.lng <= 110) kq = { lat: loc.lat, lng: loc.lng };
    }
  } catch (e) {
    return null; // lỗi Maps (hết hạn mức...) -> không cảnh báo, không nhớ
  }
  try { cache.put(khoa, kq ? JSON.stringify(kq) : 'null', 21600); } catch (e) { /* bỏ qua */ }
  return kq;
}

/** Cảnh báo nếu điểm GPS cách vị trí "Địa chỉ rừng" trên 5 km; '' nếu gần hoặc không định vị được địa chỉ. */
function canhBaoKhoangCachGps_(diaChiRung, lat, lng) {
  lat = Number(lat); lng = Number(lng);
  if (!isFinite(lat) || !isFinite(lng)) return '';
  const vt = viTriDiaChiRung_(diaChiRung);
  if (!vt) return '';
  const m = khoangCachMet_(lat, lng, vt.lat, vt.lng);
  if (m <= KHOANG_CACH_CANH_BAO_GPS_M_) return '';
  return '⚠️ Tọa độ vừa lưu (' + lat.toFixed(6) + ', ' + lng.toFixed(6) + ') cách địa chỉ rừng "' + String(diaChiRung).trim() +
    '" khoảng ' + (Math.round(m / 100) / 10).toString().replace('.', ',') + ' km (trên 5 km) — kiểm tra lại tọa độ hoặc địa chỉ rừng.';
}
