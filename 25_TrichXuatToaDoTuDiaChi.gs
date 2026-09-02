/**
 * ============================================================
 *  25_TrichXuatToaDoTuDiaChi.gs
 *  TRÍCH XUẤT TỌA ĐỘ GHI DẠNG CHỮ TRONG "ĐỊA CHỈ RỪNG" (HD_RUNG.DIA_CHI_RUNG)
 *  RỒI GHI THẬT VÀO HD_GPS.
 *
 *  Bối cảnh: một số lô rừng cũ được nhập liệu bằng cách dán thẳng tọa độ
 *  GPS vào ô "Địa chỉ rừng" (thay vì dùng đúng chỗ nhập Tọa độ GPS), ví dụ:
 *    "Thôn 3, xã ABC — 15.938322, 108.253317"
 *    "Rừng keo sau nhà, 15°56'18.0"N 108°15'11.9"E"
 *  Các lô này KHÔNG có điểm nào trong HD_GPS nên bản đồ/báo cáo diện tích
 *  GPS coi như "chưa đo tọa độ", dù thực ra tọa độ đã có sẵn dạng chữ.
 *
 *  2 hàm chính:
 *    - XEM_TRUOC_TOA_DO_TU_DIA_CHI_RUNG() : chỉ QUÉT + BÁO CÁO, KHÔNG ghi gì.
 *    - GHI_TOA_DO_TU_DIA_CHI_RUNG_VAO_GPS() : quét rồi GHI THẬT vào HD_GPS
 *      (gọi CAP_NHAT_GPS_RUNG() ở 06_CreateUpdate.gs cho từng lô, y hệt như
 *      nhập tay 1 điểm GPS mới — không đụng tới các điểm GPS đã có).
 *  Cả 2 đều CHỈ xét lô rừng CHƯA có điểm nào trong HD_GPS (idempotent —
 *  chạy lại nhiều lần không tạo trùng điểm, vì lô đã có GPS sẽ tự bị bỏ qua).
 * ============================================================
 */

/**
 * Dò 1 cặp tọa độ (lat, lng) trong 1 chuỗi địa chỉ tự do.
 * Hỗ trợ 2 kiểu hay gặp khi dán trực tiếp từ Google Maps/app đo GPS:
 *   1) DMS có ký hiệu độ/phút/giây kèm hướng N/S/E/W, vd: 15°56'18.0"N 108°15'11.9"E
 *   2) Decimal "lat, lng", vd: 15.938322, 108.253317 (giống quy ước đã dùng ở
 *      29_Chatbot.gs khi dò tọa độ trong câu hỏi chatbot).
 * Trả về { lat, lng, dinhDangNhanDien } hoặc null nếu không tìm thấy.
 */
function timToaDoTrongDiaChiRung_(diaChi) {
  const s = (diaChi || '').toString().trim();
  if (!s) return null;

  // 1) Cặp DMS có ký hiệu + hướng N/S rồi E/W (bắt buộc có chữ hướng để tránh nhận nhầm số nhà/SĐT trong địa chỉ)
  const reDms = /(\d{1,3})[°\s]+(\d{1,2})['\s]+([\d.]+)["\s]*([NS])[,;\s]+(\d{1,3})[°\s]+(\d{1,2})['\s]+([\d.]+)["\s]*([EW])/i;
  let m = s.match(reDms);
  if (m) {
    const lat = chuanHoaToaDo_(m[1] + '°' + m[2] + "'" + m[3] + '"' + m[4]).gia_tri;
    const lng = chuanHoaToaDo_(m[5] + '°' + m[6] + "'" + m[7] + '"' + m[8]).gia_tri;
    if (lat !== null && lng !== null && !isNaN(lat) && !isNaN(lng)) {
      return { lat: lat, lng: lng, dinhDangNhanDien: 'DMS (độ-phút-giây)' };
    }
  }

  // 2) Cặp decimal "lat, lng" — độ chính xác 3-8 số thập phân mới tính là tọa độ (tránh khớp nhầm số điện thoại/số nhà)
  const reDecimal = /(-?\d{1,2}\.\d{3,8})\s*[,;]\s*(-?\d{2,3}\.\d{3,8})/;
  m = s.match(reDecimal);
  if (m) {
    const lat = parseFloat(m[1]), lng = parseFloat(m[2]);
    if (!isNaN(lat) && !isNaN(lng)) {
      return { lat: lat, lng: lng, dinhDangNhanDien: 'Decimal (thập phân thường)' };
    }
  }

  return null;
}

/**
 * Quét toàn bộ HD_RUNG, trả về danh sách lô rừng CHƯA có điểm nào trong
 * HD_GPS nhưng dò được tọa độ hợp lệ (trong phạm vi Việt Nam) từ "Địa chỉ rừng".
 * Dùng chung cho cả bản xem trước lẫn bản ghi thật, đảm bảo 2 bên luôn khớp nhau.
 */
function _quetToaDoTuDiaChiRung_() {
  const rungRows = readData_(SHEET_NAME.HD_RUNG);
  const gpsRows = readData_(SHEET_NAME.HD_GPS);

  const idRungDaCoGps = {};
  gpsRows.forEach(function (r) {
    const id = (r[GPS_COL.ID_KEY_GPS] || '').toString().trim();
    if (id) idRungDaCoGps[id] = true;
  });

  const ketQua = [];
  rungRows.forEach(function (r, idx) {
    const idRung = (r[RUNG_COL.ID_RUNG] || '').toString().trim();
    if (!idRung || idRungDaCoGps[idRung]) return; // đã có GPS thật rồi -> không trích lại (idempotent)

    const diaChi = (r[RUNG_COL.DIA_CHI_RUNG] || '').toString();
    const toaDo = timToaDoTrongDiaChiRung_(diaChi);
    if (!toaDo) return;
    // Phạm vi hợp lý Việt Nam (giống quy ước ở 29_Chatbot.gs) — loại bỏ khớp nhầm
    if (toaDo.lat < 8 || toaDo.lat > 24 || toaDo.lng < 102 || toaDo.lng > 110) return;

    ketQua.push({
      dong: idx + 2, idRung: idRung, maRung: r[RUNG_COL.MA_RUNG], soHD: r[RUNG_COL.SO_HD],
      tenChuRung: r[RUNG_COL.TEN_CHU_RUNG], diaChiGoc: diaChi,
      lat: toaDo.lat, lng: toaDo.lng, dinhDangNhanDien: toaDo.dinhDangNhanDien
    });
  });
  return ketQua;
}

/** Chỉ QUÉT + BÁO CÁO, KHÔNG ghi gì vào HD_GPS — dùng để kiểm tra trước khi ghi thật. */
function XEM_TRUOC_TOA_DO_TU_DIA_CHI_RUNG() {
  const danhSach = _quetToaDoTuDiaChiRung_();
  return { thanhCong: true, tongSoLo: danhSach.length, danhSach: danhSach };
}

/** Chạy từ menu Sheets — hiện popup xem trước, không ghi gì. */
function XEM_TRUOC_TOA_DO_TU_DIA_CHI_RUNG_TU_MENU() {
  const kq = XEM_TRUOC_TOA_DO_TU_DIA_CHI_RUNG();
  if (kq.tongSoLo === 0) {
    SpreadsheetApp.getUi().alert('✅ Không phát hiện lô rừng nào còn ghi tọa độ dạng chữ trong "Địa chỉ rừng" mà chưa có trong HD_GPS.');
    return;
  }
  let tb = '🔎 Phát hiện ' + kq.tongSoLo + ' lô rừng có tọa độ ghi tạm trong "Địa chỉ rừng" (chưa có điểm nào trong HD_GPS):\n\n';
  kq.danhSach.slice(0, 20).forEach(function (d) {
    tb += '- ' + (d.maRung || d.idRung) + ' (' + (d.tenChuRung || '') + '): ' + d.lat.toFixed(6) + ', ' + d.lng.toFixed(6) + ' [' + d.dinhDangNhanDien + ']\n';
  });
  if (kq.danhSach.length > 20) tb += '\n... và ' + (kq.danhSach.length - 20) + ' lô khác (xem đầy đủ trong Log > Executions).\n';
  tb += '\nDùng mục "⚡ Ghi tọa độ từ Địa chỉ rừng vào HD_GPS" để ghi thật các điểm này.';
  Logger.log(JSON.stringify(kq, null, 2));
  SpreadsheetApp.getUi().alert(tb);
}

/**
 * Quét rồi GHI THẬT tọa độ dò được vào HD_GPS (gọi CAP_NHAT_GPS_RUNG() —
 * y hệt như nhập tay 1 điểm GPS mới cho lô rừng đó). KHÔNG xóa/sửa "Địa chỉ
 * rừng" gốc và KHÔNG đụng tới điểm GPS đã có của lô khác.
 * Trả về { thanhCong, soDaGhi, tongSoLo, loi } — đúng hợp đồng mà
 * CHAY_TOAN_BO_BAO_TRI() ở 28_BaoTri_DongBo.gs đang đọc (soDaGhi/tongSoLo).
 */
function GHI_TOA_DO_TU_DIA_CHI_RUNG_VAO_GPS() {
  const danhSach = _quetToaDoTuDiaChiRung_();
  let soDaGhi = 0;
  const loi = [];
  danhSach.forEach(function (d) {
    try {
      const kq = CAP_NHAT_GPS_RUNG(d.idRung, { lat: d.lat, lng: d.lng, diaChi: d.diaChiGoc }, false);
      if (kq.thanhCong) soDaGhi++;
      else loi.push({ idRung: d.idRung, maRung: d.maRung, loi: kq.loi });
    } catch (e) {
      loi.push({ idRung: d.idRung, maRung: d.maRung, loi: e.message });
    }
  });
  return { thanhCong: true, soDaGhi: soDaGhi, tongSoLo: danhSach.length, loi: loi };
}

/** Chạy từ menu Sheets — xác nhận rồi ghi thật, hiện popup kết quả. */
function GHI_TOA_DO_TU_DIA_CHI_RUNG_VAO_GPS_TU_MENU() {
  const ui = SpreadsheetApp.getUi();
  const xemTruoc = XEM_TRUOC_TOA_DO_TU_DIA_CHI_RUNG();
  if (xemTruoc.tongSoLo === 0) {
    ui.alert('✅ Không có lô rừng nào cần trích tọa độ từ "Địa chỉ rừng".');
    return;
  }
  const xacNhan = ui.alert(
    '⚡ Ghi tọa độ từ Địa chỉ rừng vào HD_GPS',
    'Sẽ ghi tọa độ GPS mới cho ' + xemTruoc.tongSoLo + ' lô rừng (dò được từ chữ trong "Địa chỉ rừng", các lô này hiện chưa có điểm nào trong HD_GPS). KHÔNG xóa/sửa dữ liệu nào khác. Tiếp tục?',
    ui.ButtonSet.OK_CANCEL
  );
  if (xacNhan !== ui.Button.OK) return;

  const kq = GHI_TOA_DO_TU_DIA_CHI_RUNG_VAO_GPS();
  let tb = '✅ Đã ghi tọa độ cho ' + kq.soDaGhi + '/' + kq.tongSoLo + ' lô rừng vào HD_GPS.';
  if (kq.loi.length) tb += '\n\n⚠️ ' + kq.loi.length + ' lô bị lỗi khi ghi (xem chi tiết trong Log > Executions).';
  Logger.log(JSON.stringify(kq, null, 2));
  ui.alert(tb);
}
