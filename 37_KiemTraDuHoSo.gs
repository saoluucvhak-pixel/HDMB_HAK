/**
 * ============================================================
 *  37_KiemTraDuHoSo.gs
 *  1) ĐIỀU KIỆN CHUYỂN "Đang thực hiện": hợp đồng phải đủ hồ sơ — CCCD chủ rừng đã đính kèm, thông tin
 *     chủ rừng / ủy quyền / tài khoản điền đủ, mỗi lô rừng đủ thông tin + hồ sơ rừng (loại, số giấy tờ,
 *     file đính kèm) + tọa độ GPS, và hợp đồng có ảnh GPS hoặc ảnh hiện trường (đã duyệt).
 *     Thiếu -> không chuyển, trả danh sách cần bổ sung (trang web hiện cảnh báo).
 *  2) CẢNH BÁO TỌA ĐỘ XA ĐỊA CHỈ RỪNG: lưu điểm GPS cách vị trí của "Địa chỉ rừng" (định vị qua Google Maps)
 *     trên 5 km -> vẫn lưu, kèm cảnh báo để kiểm tra lại.
 *  3) ĐÍNH KÈM CCCD chủ rừng: cột mở rộng HD_NCC "Đính kèm CCCD" (link file trên Drive).
 * ============================================================
 */

const KHOANG_CACH_CANH_BAO_GPS_M_ = 5000;

/** Cột mở rộng "Đính kèm CCCD" (HD_NCC cột AH): thêm cột nếu sheet chưa đủ rộng + điền tiêu đề nếu trống. */
function damBaoCotDinhKemCCCD_() {
  const sh = getSheet_(SHEET_NAME.HD_NCC);
  const cot = NCC_COL.DINH_KEM_CCCD + 1;
  const toiDa = sh.getMaxColumns();
  if (toiDa < cot) sh.insertColumnsAfter(toiDa, cot - toiDa);
  const o = sh.getRange(1, cot);
  if (!o.getValue()) o.setValue('Đính kèm CCCD').setFontWeight('bold');
}

/**
 * Tải ảnh/scan CCCD chủ rừng lên Drive (thư mục hồ sơ) rồi ghi link vào hợp đồng.
 * Chỉ khi hợp đồng còn "Chờ thực hiện" / "Đang thực hiện" (như các nút Thêm khác).
 */
function DINH_KEM_CCCD_HOP_DONG_(idHD, base64Data, mimeType, tenFileGoc) {
  _yeuCauQuyen_(QUYEN.NHAP_LIEU);
  idHD = (idHD || '').toString().trim();
  if (!idHD) return { thanhCong: false, loi: 'Thiếu ID hợp đồng.' };
  if (!base64Data) return { thanhCong: false, loi: 'Chưa chọn file CCCD.' };
  const loiFile = kiemTraFileTaiLen_(base64Data, mimeType);
  if (loiFile) return { thanhCong: false, loi: loiFile };
  if (!_hopDongConSuaDuoc_(idHD)) return { thanhCong: false, loi: 'Hợp đồng không còn "Chờ thực hiện" / "Đang thực hiện" — không bổ sung CCCD được.' };
  let file;
  try {
    const blob = Utilities.newBlob(Utilities.base64Decode(base64Data), mimeType || 'image/jpeg', 'CCCD_' + idHD + '_' + (tenFileGoc || new Date().getTime()));
    file = layHoacTaoThuMucHoSo_().createFile(blob);
  } catch (e) {
    return { thanhCong: false, loi: 'Không lưu được file lên Drive: ' + e.message };
  }
  return GHI_LINK_CCCD_HOP_DONG_(idHD, file.getUrl());
}

/** Ghi link CCCD đã có sẵn (vd file vừa đọc OCR) vào hợp đồng. */
function GHI_LINK_CCCD_HOP_DONG_(idHD, url) {
  _yeuCauQuyen_(QUYEN.NHAP_LIEU);
  idHD = (idHD || '').toString().trim();
  url = (url || '').toString().trim();
  if (!idHD || !url) return { thanhCong: false, loi: 'Thiếu ID hợp đồng hoặc link file CCCD.' };
  if (!/^https:\/\/(drive|docs)\.google\.com\//.test(url)) return { thanhCong: false, loi: 'Link file CCCD không hợp lệ (phải là link Google Drive).' };
  damBaoCotDinhKemCCCD_();
  const kq = CAP_NHAT_HOP_DONG_(timSoDongTheoGiaTri_(SHEET_NAME.HD_NCC, NCC_COL.ID_HD, idHD), { dinhKemCCCD: url }, idHD);
  if (!kq.thanhCong) return kq;
  ghiNhatKy_('Đính kèm CCCD', idHD, url);
  CAP_NHAT_DRAFT_MOT_HOP_DONG_(idHD);
  return { thanhCong: true, url: url };
}

/**
 * Hợp đồng đã đủ hồ sơ để chuyển "Đang thực hiện" chưa — đọc trực tiếp sheet gốc (chỉ dòng của hợp đồng này).
 * Trả { du: bool, thieu: [mô tả từng mục còn thiếu] }.
 */
function kiemTraDuHoSoDeThucHien_(idHD) {
  idHD = (idHD || '').toString().trim();
  const row = docDongTheoKhoa_(SHEET_NAME.HD_NCC, NCC_COL.ID_HD, [idHD])[0];
  if (!row) return { du: false, thieu: ['Không tìm thấy hợp đồng ' + idHD + '.'] };
  const trong = function (v) { return v === null || v === undefined || String(v).trim() === ''; };
  const thieu = [];

  // 1. Thông tin chủ rừng
  const thieuTT = [];
  if (trong(row[NCC_COL.TEN_CHU_RUNG])) thieuTT.push('họ tên');
  if (!laCCCDHopLe_(row[NCC_COL.CCCD_CHU_RUNG])) thieuTT.push('số CCCD (12 số)');
  if (trong(row[NCC_COL.NGAY_CAP])) thieuTT.push('ngày cấp CCCD');
  if (trong(row[NCC_COL.NOI_CAP])) thieuTT.push('nơi cấp CCCD');
  if (trong(row[NCC_COL.DIA_CHI_TT])) thieuTT.push('địa chỉ thường trú');
  if (trong(row[NCC_COL.SDT_CHU_RUNG])) thieuTT.push('số điện thoại');
  if (trong(row[NCC_COL.NGAY_KY])) thieuTT.push('ngày ký hợp đồng');
  if (thieuTT.length) thieu.push('Thông tin chủ rừng còn thiếu: ' + thieuTT.join(', '));

  // 2. CCCD đính kèm
  if (trong(row[NCC_COL.DINH_KEM_CCCD])) thieu.push('Chưa đính kèm ảnh/scan CCCD chủ rừng');

  // 3. Ủy quyền + tài khoản nhận tiền (tài khoản ở HD_STK cũng tính)
  const coTK = docDongTheoKhoa_(SHEET_NAME.HD_STK, STK_COL.ID_HD, [idHD])
    .some(function (r) { return !trong(r[STK_COL.SO_TK]) && !trong(r[STK_COL.NGAN_HANG]); });
  kiemTraUyQuyenVaTaiKhoan_(row).forEach(function (m) {
    if (coTK && /tài khoản|ngân hàng/i.test(m)) return;
    thieu.push(m);
  });

  // 4. Lô rừng: thông tin + hồ sơ rừng + tọa độ (bỏ lô rỗng tự tạo nếu đã có lô thật)
  const rung = docDongTheoKhoa_(SHEET_NAME.HD_RUNG, RUNG_COL.ID_KEY_HD, [idHD]);
  const laLoRong = function (r) {
    return trong(r[RUNG_COL.DIA_CHI_RUNG]) && !soTuO_(r[RUNG_COL.DIEN_TICH_M2]) && !soTuO_(r[RUNG_COL.KHOI_LUONG_DK]) && !soTuO_(r[RUNG_COL.DON_GIA]);
  };
  const loThat = rung.filter(function (r) { return !laLoRong(r); });
  const dsLo = loThat.length ? loThat : rung;
  if (!rung.length) thieu.push('Chưa có lô rừng nào');
  const idRungs = dsLo.map(function (r) { return (r[RUNG_COL.ID_RUNG] || '').toString().trim(); });
  const gpsTheoLo = {};
  let coAnhGps = false;
  if (idRungs.length) {
    docDongTheoKhoa_(SHEET_NAME.HD_GPS, GPS_COL.ID_KEY_GPS, idRungs).forEach(function (g) {
      const id = (g[GPS_COL.ID_KEY_GPS] || '').toString().trim();
      const lat = Number(g[GPS_COL.LAT]), lng = Number(g[GPS_COL.LNG]);
      // Dòng GPS "khung" tạo sẵn khi tạo hợp đồng chưa có tọa độ -> không tính là đã đo
      if (!trong(g[GPS_COL.LAT]) && !trong(g[GPS_COL.LNG]) && isFinite(lat) && isFinite(lng) && (lat !== 0 || lng !== 0)) gpsTheoLo[id] = (gpsTheoLo[id] || 0) + 1;
      if (!trong(g[GPS_COL.HINH_ANH])) coAnhGps = true;
    });
  }
  dsLo.forEach(function (r, i) {
    const t = [];
    if (trong(r[RUNG_COL.DIA_CHI_RUNG])) t.push('địa chỉ rừng');
    if (!(soTuO_(r[RUNG_COL.DIEN_TICH_M2]) > 0)) t.push('diện tích');
    if (!(soTuO_(r[RUNG_COL.DON_GIA]) > 0)) t.push('đơn giá');
    if (!(soTuO_(r[RUNG_COL.KHOI_LUONG_DK]) > 0)) t.push('khối lượng dự kiến');
    if (trong(r[RUNG_COL.HO_SO_NGUON_GOC])) t.push('loại hồ sơ nguồn gốc');
    if (trong(r[RUNG_COL.SO_GIAY_TO])) t.push('số giấy tờ');
    if (trong(r[RUNG_COL.DINH_KEM_GIAY_TO])) t.push('file hồ sơ rừng đính kèm');
    if (!gpsTheoLo[idRungs[i]]) t.push('tọa độ GPS');
    if (t.length) thieu.push('Lô ' + (r[RUNG_COL.MA_RUNG] || idRungs[i] || (i + 1)) + ' còn thiếu: ' + t.join(', '));
  });

  // 5. Ảnh GPS hoặc ảnh hiện trường (HD_Picture — đã duyệt)
  let coAnhHT = false;
  docDongTheoKhoa_(SHEET_NAME.HD_PICTURE, PICTURE_COL.ID_HD, [idHD].concat(idRungs)).forEach(function (r) {
    for (let c = PICTURE_COL.PICTURE_START; c <= PICTURE_COL.PICTURE_END; c++) if (!trong(r[c])) { coAnhHT = true; break; }
  });
  if (!coAnhGps && !coAnhHT) thieu.push('Chưa có ảnh GPS hoặc ảnh hiện trường (ảnh tải lên phải được Duyệt)');

  return { du: thieu.length === 0, thieu: thieu };
}

function loiChuaDuHoSo_(thieu) {
  return 'Chưa đủ hồ sơ để chuyển "Đang thực hiện" — vui lòng bổ sung đầy đủ hồ sơ:\n• ' + thieu.join('\n• ');
}

/** Kiểm tra đủ hồ sơ rồi chuyển "Đang thực hiện" (theo đúng bước chuyển của trang Hợp đồng). */
function _thuChuyenDangThucHien_(idHD) {
  const k = kiemTraDuHoSoDeThucHien_(idHD);
  if (!k.du) return { thanhCong: false, loi: loiChuaDuHoSo_(k.thieu), thieuHoSo: k.thieu };
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
