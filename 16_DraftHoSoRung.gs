/**
 * ============================================================
 *  16_DraftHoSoRung.gs
 *  Cache "Hồ sơ rừng" — GIỐNG hệt tinh thần Draft_BaoCaoHopDong (đã có sẵn cho
 *  báo cáo Hợp đồng): tính sẵn 1 dòng/lô rừng, lưu ở FILE BÁO CÁO/CACHE RIÊNG
 *  (getReportSS_(), KHÔNG phải file dữ liệu chính), rồi báo cáo "Hồ sơ rừng"
 *  chỉ đọc cache này — không còn đọc trực tiếp HD_RUNG + HD_GPS + HD_NCC mỗi
 *  lần tải trang (đây là nguyên nhân treo/nghẽn khi HD_RUNG đã nhiều dòng).
 *
 *  Cơ chế cập nhật: TỰ ĐỘNG đúng 1 dòng bị ảnh hưởng, ngay khi Thêm/Sửa/Xóa lô
 *  rừng hoặc thêm điểm GPS (xem các hook đã gắn ở 06_CreateUpdate.gs) — không
 *  bao giờ tính lại toàn bộ, TRỪ hàm XAY_DUNG_LAI_DRAFT_HOSORUNG() dùng 1 lần
 *  lúc mới cài đặt (hoặc khi nghi ngờ cache bị lệch).
 * ============================================================
 */

const SHEET_DRAFT_HOSORUNG = 'Draft_HoSoRung';
const DRAFT_HSR_COL = {
  ID_RUNG: 0, ID_HD: 1, SO_HD: 2, NGAY_KY: 3, TEN_CHU_RUNG: 4, TINH_TRANG: 5,
  HO_SO_NGUON_GOC: 6, SO_GIAY_TO: 7, NGAY_GIAY_TO: 8, DIEN_TICH: 9, KHOI_LUONG_DU_KIEN: 10,
  DON_GIA: 11, GIA_TRI: 12, TOA_DO_LAT: 13, TOA_DO_LNG: 14, SO_DIEM_GPS: 15, CAP_NHAT_LUC: 16
};

function getOrCreateDraftHoSoRungSheet_() {
  const ss = getReportSS_(); // CÙNG FILE với Draft_BaoCaoHopDong — không dùng file chính
  let sh = ss.getSheetByName(SHEET_DRAFT_HOSORUNG);
  if (!sh) {
    sh = ss.insertSheet(SHEET_DRAFT_HOSORUNG);
    const header = ['ID_Rung', 'ID_HD', 'Số HĐ', 'Ngày ký', 'Tên chủ rừng', 'Tình trạng',
      'Loại hồ sơ nguồn gốc', 'Số giấy tờ', 'Ngày giấy tờ', 'Diện tích', 'Khối lượng dự kiến',
      'Đơn giá', 'Giá trị', 'Tọa độ TB - Lat', 'Tọa độ TB - Lng', 'Số điểm GPS', 'Cập nhật lúc'];
    sh.getRange(1, 1, 1, header.length).setValues([header]).setFontWeight('bold').setBackground('#34495e').setFontColor('#ffffff');
  }
  return sh;
}

function timDongDraftHoSoRung_(sh, idRung) {
  const lastRow = sh.getLastRow();
  if (lastRow < 2) return -1;
  const ids = sh.getRange(2, DRAFT_HSR_COL.ID_RUNG + 1, lastRow - 1, 1).getValues();
  for (let i = 0; i < ids.length; i++) {
    if ((ids[i][0] || '').toString().trim() === idRung.toString().trim()) return i + 2;
  }
  return -1;
}

/** Tính lại + ghi đè ĐÚNG 1 dòng cache của 1 lô rừng. Gọi sau Thêm/Sửa lô rừng hoặc thêm GPS. */
function CAP_NHAT_DRAFT_HOSORUNG_MOT_DONG_(idRung) {
  try {
    if (!idRung) return;
    const rungRows = readData_(SHEET_NAME.HD_RUNG);
    const r = rungRows.find(function (x) { return (x[RUNG_COL.ID_RUNG] || '').toString().trim() === idRung.toString().trim(); });
    if (!r) { XOA_DRAFT_HOSORUNG_MOT_DONG_(idRung); return; } // lô rừng đã bị xóa hẳn -> xóa luôn khỏi cache

    const idHD = (r[RUNG_COL.ID_KEY_HD] || '').toString().trim();
    let tinhTrang = 'Đang thực hiện';
    const nccRow = readData_(SHEET_NAME.HD_NCC).find(function (n) { return (n[NCC_COL.ID_HD] || '').toString().trim() === idHD; });
    if (nccRow) tinhTrang = nccRow[NCC_COL.TINH_TRANG] || 'Đang thực hiện';

    const diemGPS = layGPSCuaRung(idRung);
    let latTB = '', lngTB = '';
    if (diemGPS.length) {
      latTB = diemGPS.reduce(function (s, p) { return s + p.lat; }, 0) / diemGPS.length;
      lngTB = diemGPS.reduce(function (s, p) { return s + p.lng; }, 0) / diemGPS.length;
    }

    const dienTich = Number(r[RUNG_COL.DIEN_TICH_M2]) || 0;
    const donGia = Number(r[RUNG_COL.DON_GIA]) || 0;
    const khoiLuong = Number(r[RUNG_COL.KHOI_LUONG_DK]) || 0;

    const c = DRAFT_HSR_COL;
    const dong = [];
    dong[c.ID_RUNG] = idRung; dong[c.ID_HD] = idHD; dong[c.SO_HD] = r[RUNG_COL.SO_HD]; dong[c.NGAY_KY] = r[RUNG_COL.NGAY_KY];
    dong[c.TEN_CHU_RUNG] = r[RUNG_COL.TEN_CHU_RUNG]; dong[c.TINH_TRANG] = tinhTrang;
    dong[c.HO_SO_NGUON_GOC] = r[RUNG_COL.HO_SO_NGUON_GOC]; dong[c.SO_GIAY_TO] = r[RUNG_COL.SO_GIAY_TO]; dong[c.NGAY_GIAY_TO] = r[RUNG_COL.NGAY_GIAY_TO];
    dong[c.DIEN_TICH] = dienTich; dong[c.KHOI_LUONG_DU_KIEN] = khoiLuong; dong[c.DON_GIA] = donGia; dong[c.GIA_TRI] = donGia * khoiLuong;
    dong[c.TOA_DO_LAT] = latTB; dong[c.TOA_DO_LNG] = lngTB; dong[c.SO_DIEM_GPS] = diemGPS.length; dong[c.CAP_NHAT_LUC] = new Date();

    const sh = getOrCreateDraftHoSoRungSheet_();
    const soDong = timDongDraftHoSoRung_(sh, idRung);
    if (soDong === -1) sh.appendRow(dong);
    else sh.getRange(soDong, 1, 1, dong.length).setValues([dong]);
  } catch (e) {
    // Không để lỗi cập nhật cache làm hỏng thao tác chính (Thêm/Sửa lô rừng vẫn phải thành công)
    try { ghiNhatKy_('LỖI cập nhật Draft_HoSoRung', idRung, e.message); } catch (e2) { /* bỏ qua */ }
  }
}

/** Cập nhật cache Draft_HoSoRung cho TẤT CẢ lô rừng thuộc 1 hợp đồng (dùng khi thông
 *  tin hợp đồng — vd Tình trạng — thay đổi, ảnh hưởng tới mọi lô rừng con của nó). */
function CAP_NHAT_DRAFT_HOSORUNG_CHO_HOPDONG_(idHD) {
  try {
    if (!idHD) return;
    readData_(SHEET_NAME.HD_RUNG).forEach(function (r) {
      if ((r[RUNG_COL.ID_KEY_HD] || '').toString().trim() === idHD.toString().trim()) {
        CAP_NHAT_DRAFT_HOSORUNG_MOT_DONG_((r[RUNG_COL.ID_RUNG] || '').toString().trim());
      }
    });
  } catch (e) { /* không để lỗi làm gián đoạn thao tác chính */ }
}

function XOA_DRAFT_HOSORUNG_MOT_DONG_(idRung) {
  try {
    const sh = getOrCreateDraftHoSoRungSheet_();
    const soDong = timDongDraftHoSoRung_(sh, idRung);
    if (soDong !== -1) sh.deleteRow(soDong);
  } catch (e) { /* bỏ qua */ }
}

/**
 * ✅ THAY THẾ layBaoCaoHoSoRung() cũ (từng đọc trực tiếp HD_RUNG+HD_GPS+HD_NCC ở
 * file chính mỗi lần tải trang — chậm dần khi HD_RUNG nhiều dòng). Giờ CHỈ đọc
 * cache Draft_HoSoRung — nhanh, không phụ thuộc kích thước HD_RUNG.
 */
function layBaoCaoHoSoRung() {
  const sh = getOrCreateDraftHoSoRungSheet_();
  const lastRow = sh.getLastRow();
  if (lastRow < 2) return [];
  const data = sh.getRange(2, 1, lastRow - 1, sh.getLastColumn()).getValues();
  const c = DRAFT_HSR_COL;

  // Đọc THẲNG từ HD_GPS (xem layCoAnhVaGpsTrucTiep_ ở 00_Config.gs) để ghi đè
  // tọa độ — đảm bảo đúng ngay cả khi Draft_HoSoRung chưa kịp đồng bộ (vd GPS
  // được nhập thẳng vào sheet bằng tay, hoặc 1 hàm ghi nào đó quên gọi cập
  // nhật cache này).
  let theoIdRung = {};
  try { theoIdRung = layCoAnhVaGpsTrucTiep_().theoIdRung; } catch (e) { /* lỗi thì dùng tạm dữ liệu cache cũ bên dưới */ }

  return data.map(function (r) {
    const idRung = (r[c.ID_RUNG] || '').toString().trim();
    const ttThat = theoIdRung[idRung];
    const laiCoGPS = ttThat ? !!ttThat.toaDo : (r[c.SO_DIEM_GPS] > 0 && r[c.TOA_DO_LAT] !== '');
    return {
      // ⚠️ ngayKy/ngayGiayTo: dùng ngayToISO_() thay vì trả Date object thô —
      // Date thô lồng trong mảng object có thể khiến CẢ response về client bị
      // null qua google.script.run (cùng nguyên nhân đã vá ở docToanBoDraftBaoCao_,
      // xem 00_Config.gs). Frontend vẫn dùng new Date(...) để hiển thị nên
      // parse chuỗi ISO ra đúng ngày, không cần sửa gì ở HTML.
      idRung: r[c.ID_RUNG], idHD: r[c.ID_HD], soHD: r[c.SO_HD], ngayKy: ngayToISO_(r[c.NGAY_KY]), tenChuRung: r[c.TEN_CHU_RUNG],
      tinhTrang: r[c.TINH_TRANG] || 'Đang thực hiện',
      hoSoNguonGoc: r[c.HO_SO_NGUON_GOC], soGiayTo: r[c.SO_GIAY_TO], ngayGiayTo: ngayToISO_(r[c.NGAY_GIAY_TO]),
      dienTich: r[c.DIEN_TICH], khoiLuongDuKien: r[c.KHOI_LUONG_DU_KIEN], donGia: r[c.DON_GIA], giaTri: r[c.GIA_TRI],
      toaDo: ttThat ? ttThat.toaDo : (laiCoGPS ? { lat: r[c.TOA_DO_LAT], lng: r[c.TOA_DO_LNG] } : null),
      soDiemGPS: ttThat ? ttThat.soDiemGPS : (r[c.SO_DIEM_GPS] || 0)
    };
  }).sort(function (a, b) { return new Date(b.ngayKy || 0) - new Date(a.ngayKy || 0); });
}

/**
 * Xây dựng lại TOÀN BỘ Draft_HoSoRung từ đầu — chạy 1 LẦN lúc mới cài đặt tính
 * năng cache này (khi Draft_HoSoRung còn trống hoặc nghi ngờ bị lệch). Đọc
 * HD_RUNG/HD_GPS/HD_NCC CHỈ 1 LẦN (không lặp lại theo từng dòng), group trong
 * bộ nhớ, rồi ghi 1 lượt bằng setValues() — tránh timeout với dữ liệu lớn.
 */
function XAY_DUNG_LAI_DRAFT_HOSORUNG() {
  const rungRows = readData_(SHEET_NAME.HD_RUNG);
  const gpsRows = readData_(SHEET_NAME.HD_GPS);
  const gpsByIdRung = {};
  gpsRows.forEach(function (g) {
    const idRung = (g[GPS_COL.ID_KEY_GPS] || '').toString().trim();
    if (!idRung) return;
    const type = g[GPS_COL.HE_TOA_DO];
    const lat = (type === 'DMS') ? convertDmsToDd(g[GPS_COL.LAT]) : parseFloat(g[GPS_COL.LAT]);
    const lng = (type === 'DMS') ? convertDmsToDd(g[GPS_COL.LNG]) : parseFloat(g[GPS_COL.LNG]);
    if (isNaN(lat) || isNaN(lng)) return;
    if (!gpsByIdRung[idRung]) gpsByIdRung[idRung] = [];
    gpsByIdRung[idRung].push({ lat: lat, lng: lng });
  });

  const tinhTrangByIdHD = {};
  readData_(SHEET_NAME.HD_NCC).forEach(function (n) {
    const idHD = (n[NCC_COL.ID_HD] || '').toString().trim();
    if (idHD) tinhTrangByIdHD[idHD] = n[NCC_COL.TINH_TRANG] || 'Đang thực hiện';
  });

  const c = DRAFT_HSR_COL;
  const ketQua = [];
  rungRows.forEach(function (r) {
    const idRung = (r[RUNG_COL.ID_RUNG] || '').toString().trim();
    if (!idRung) return;
    const idHD = (r[RUNG_COL.ID_KEY_HD] || '').toString().trim();
    const diemGPS = gpsByIdRung[idRung] || [];
    let latTB = '', lngTB = '';
    if (diemGPS.length) {
      latTB = diemGPS.reduce(function (s, p) { return s + p.lat; }, 0) / diemGPS.length;
      lngTB = diemGPS.reduce(function (s, p) { return s + p.lng; }, 0) / diemGPS.length;
    }
    const dienTich = Number(r[RUNG_COL.DIEN_TICH_M2]) || 0;
    const donGia = Number(r[RUNG_COL.DON_GIA]) || 0;
    const khoiLuong = Number(r[RUNG_COL.KHOI_LUONG_DK]) || 0;

    const dong = [];
    dong[c.ID_RUNG] = idRung; dong[c.ID_HD] = idHD; dong[c.SO_HD] = r[RUNG_COL.SO_HD]; dong[c.NGAY_KY] = r[RUNG_COL.NGAY_KY];
    dong[c.TEN_CHU_RUNG] = r[RUNG_COL.TEN_CHU_RUNG]; dong[c.TINH_TRANG] = tinhTrangByIdHD[idHD] || 'Đang thực hiện';
    dong[c.HO_SO_NGUON_GOC] = r[RUNG_COL.HO_SO_NGUON_GOC]; dong[c.SO_GIAY_TO] = r[RUNG_COL.SO_GIAY_TO]; dong[c.NGAY_GIAY_TO] = r[RUNG_COL.NGAY_GIAY_TO];
    dong[c.DIEN_TICH] = dienTich; dong[c.KHOI_LUONG_DU_KIEN] = khoiLuong; dong[c.DON_GIA] = donGia; dong[c.GIA_TRI] = donGia * khoiLuong;
    dong[c.TOA_DO_LAT] = latTB; dong[c.TOA_DO_LNG] = lngTB; dong[c.SO_DIEM_GPS] = diemGPS.length; dong[c.CAP_NHAT_LUC] = new Date();
    ketQua.push(dong);
  });

  const sh = getOrCreateDraftHoSoRungSheet_();
  const lastRow = sh.getLastRow();
  if (lastRow > 1) sh.getRange(2, 1, lastRow - 1, sh.getLastColumn()).clearContent();
  if (ketQua.length) sh.getRange(2, 1, ketQua.length, ketQua[0].length).setValues(ketQua);

  return { soLoRungDaXuLy: ketQua.length };
}

/** Gọi từ menu Sheet — chạy XAY_DUNG_LAI_DRAFT_HOSORUNG() rồi hiện kết quả cho người dùng thấy ngay */
function CHAY_XAY_DUNG_LAI_DRAFT_HOSORUNG() {
  const kq = XAY_DUNG_LAI_DRAFT_HOSORUNG();
  SpreadsheetApp.getUi().alert('✅ Đã xây dựng lại cache Hồ sơ rừng cho ' + kq.soLoRungDaXuLy + ' lô rừng.');
}
