/**
 * ============================================================
 *  19_ChanDoanGPS.gs
 *  Chẩn đoán vì sao "Xem chi tiết" ở tab Hồ sơ rừng KHÔNG hiện tọa độ dù
 *  HD_GPS đã có dòng dữ liệu cho lô rừng đó — tìm CHÍNH XÁC lô rừng nào bị,
 *  cùng dữ liệu THÔ để thấy rõ lý do (kiểu dữ liệu lệch, định dạng lat/lng
 *  không parse được, cột Hệ tọa độ (DD/DMS) ghi sai...).
 * ============================================================
 */
function CHAN_DOAN_GPS_TOAN_BO() {
  const rungRows = readData_(SHEET_NAME.HD_RUNG);
  const gpsRows = readData_(SHEET_NAME.HD_GPS);

  // Gom TẤT CẢ dòng GPS theo ID_KEY_GPS (idRung) — kể cả dòng rỗng/sai định dạng,
  // không lọc gì cả, để so sánh với layGPSCuaRung() (hàm CÓ lọc) bên dưới.
  const rawByIdRung = {};
  gpsRows.forEach(function (g) {
    const idRungRaw = g[GPS_COL.ID_KEY_GPS];
    const idRung = (idRungRaw || '').toString().trim();
    if (!rawByIdRung[idRung]) rawByIdRung[idRung] = [];
    rawByIdRung[idRung].push(g);
  });

  const chiTietLoi = [];
  rungRows.forEach(function (r) {
    const idRungRaw = r[RUNG_COL.ID_RUNG];
    const idRung = (idRungRaw || '').toString().trim();
    if (!idRung) return;
    const raw = rawByIdRung[idRung] || [];
    if (!raw.length) return; // lô này CHƯA CÓ dòng GPS nào trong HD_GPS -> không phải lỗi, đúng là chưa đo
    const daParseDuoc = layGPSCuaRung(idRung);
    if (daParseDuoc.length > 0) return; // parse được bình thường -> không phải lỗi

    // Tới đây: HD_GPS CÓ dòng cho lô này, nhưng layGPSCuaRung() KHÔNG lấy được điểm nào -> ghi lại chi tiết
    chiTietLoi.push({
      idRung: idRung,
      kieuIdRungTrongHDRung: typeof idRungRaw, // 'string' hay 'number' — nếu khác kiểu so với ID_KEY_GPS bên dưới là đầu mối
      soDongGPSTrongSheet: raw.length,
      chiTietTungDong: raw.map(function (g) {
        return {
          idKeyGpsRaw: g[GPS_COL.ID_KEY_GPS],
          kieuIdKeyGps: typeof g[GPS_COL.ID_KEY_GPS],
          lat: g[GPS_COL.LAT], kieuLat: typeof g[GPS_COL.LAT],
          lng: g[GPS_COL.LNG], kieuLng: typeof g[GPS_COL.LNG],
          heToaDo: g[GPS_COL.HE_TOA_DO]
        };
      })
    });
  });

  Logger.log('===== CHẨN ĐOÁN GPS TOÀN BỘ (%s) =====', new Date().toISOString());
  Logger.log('Tổng số lô rừng CÓ dòng trong HD_GPS nhưng KHÔNG hiện được tọa độ: ' + chiTietLoi.length);
  chiTietLoi.forEach(function (x) { Logger.log(JSON.stringify(x, null, 2)); });

  try {
    const soMau = Math.min(3, chiTietLoi.length);
    let thongBao = 'Tổng số lô rừng bị lỗi (có GPS nhưng không hiện): ' + chiTietLoi.length + '\n\n';
    if (soMau === 0) {
      thongBao += 'Không phát hiện lô nào bị lỗi kiểu dữ liệu — nếu vẫn không thấy tọa độ, có thể do đúng lô bạn đang xem thật sự chưa có điểm GPS nào.';
    } else {
      thongBao += 'Xem chi tiết đầy đủ trong Execution log. Ví dụ ' + soMau + ' lô đầu tiên:\n\n';
      for (let i = 0; i < soMau; i++) {
        const x = chiTietLoi[i];
        thongBao += '• ID_RUNG "' + x.idRung + '" (kiểu: ' + x.kieuIdRungTrongHDRung + ') — có ' + x.soDongGPSTrongSheet + ' dòng GPS, dòng đầu: lat=' + JSON.stringify(x.chiTietTungDong[0].lat) + ' (' + x.chiTietTungDong[0].kieuLat + '), lng=' + JSON.stringify(x.chiTietTungDong[0].lng) + ', hệ tọa độ=' + x.chiTietTungDong[0].heToaDo + '\n';
      }
    }
    SpreadsheetApp.getUi().alert(thongBao);
  } catch (e) { /* chạy từ editor thì không có UI, bỏ qua */ }

  return { soLoLoi: chiTietLoi.length, chiTietMauLoi: chiTietLoi.slice(0, 10) };
}

/**
 * Chẩn đoán vì sao 1 số ảnh trong HD_Picture không có link mở được ("Xem ảnh").
 * Quét TOÀN BỘ HD_Picture, với mỗi ô có giá trị, thử resolveDriveLink_() (đúng
 * hàm mà layAnhCuaHopDong() dùng) và ghi lại các ô KHÔNG ra được url — kèm giá
 * trị thô để biết chính xác lý do (ô lưu chỉ tên file mà không tìm thấy file
 * đó trên Drive — có thể do file nằm ở Drive/tài khoản khác, đã bị xóa/đổi
 * tên, hoặc quyền chia sẻ không đủ để script thấy).
 */
function CHAN_DOAN_ANH_TOAN_BO() {
  const rows = readData_(SHEET_NAME.HD_PICTURE);
  const tongOCoDuLieu = [];
  const oKhongCoLink = [];

  rows.forEach(function (r, idx) {
    const idHD = (r[PICTURE_COL.ID_HD] || '').toString().trim();
    for (let c = PICTURE_COL.PICTURE_START; c <= PICTURE_COL.PICTURE_END; c++) {
      const v = (r[c] || '').toString().trim();
      if (!v) continue;
      tongOCoDuLieu.push(v);
      const link = resolveDriveLink_(v);
      if (!link || !link.url) {
        oKhongCoLink.push({
          dongTrongSheet: idx + 2, idHD: idHD, cot: c, giaTriThoLuuTrongO: v,
          laDinhDangUrl: v.indexOf('http') === 0,
          ketQuaResolveDriveLink: link
        });
      }
    }
  });

  Logger.log('===== CHẨN ĐOÁN ẢNH TOÀN BỘ (%s) =====', new Date().toISOString());
  Logger.log('Tổng số ô có dữ liệu ảnh trong HD_Picture: ' + tongOCoDuLieu.length);
  Logger.log('Số ô KHÔNG tra được link Drive thật (bấm không mở được): ' + oKhongCoLink.length);
  oKhongCoLink.forEach(function (x) { Logger.log(JSON.stringify(x)); });

  try {
    const soMau = Math.min(5, oKhongCoLink.length);
    let thongBao = 'Tổng ô có ảnh: ' + tongOCoDuLieu.length + '\nSố ô KHÔNG có link mở được: ' + oKhongCoLink.length + '\n\n';
    if (soMau === 0) {
      thongBao += 'Không có ô nào lỗi — nếu vẫn thấy "không có link", có thể do bạn đang xem đúng lô/hợp đồng chưa từng có ảnh nào.';
    } else {
      thongBao += 'Xem đầy đủ trong Execution log. Ví dụ ' + soMau + ' ô đầu tiên:\n\n';
      for (let i = 0; i < soMau; i++) {
        const x = oKhongCoLink[i];
        thongBao += '• Dòng ' + x.dongTrongSheet + ', ID_HD "' + x.idHD + '": giá trị lưu = "' + x.giaTriThoLuuTrongO + '" (là URL? ' + (x.laDinhDangUrl ? 'có' : 'không — chỉ là tên file') + ')\n';
      }
      if (!oKhongCoLink[0].laDinhDangUrl) {
        thongBao += '\n→ Đa số là "chỉ lưu tên file" — script tìm file đó trên Drive bằng DriveApp.getFilesByName() nhưng KHÔNG thấy. Khả năng: file nằm trong Drive của tài khoản khác (không phải tài khoản chạy script), đã bị xóa/đổi tên, hoặc chưa chia sẻ quyền xem cho tài khoản chạy script.';
      }
    }
    SpreadsheetApp.getUi().alert(thongBao);
  } catch (e) { /* chạy từ editor thì không có UI, bỏ qua */ }

  return { tongOCoDuLieu: tongOCoDuLieu.length, soOLoi: oKhongCoLink.length, chiTietMauLoi: oKhongCoLink.slice(0, 10) };
}

/**
 * Chẩn đoán CHÍNH XÁC cho 1 lô rừng cụ thể: vì sao "Ảnh chung của hợp đồng"
 * báo trống dù HD_Picture có vẻ đã có dòng ảnh liên quan. Kiểm tra xem ID_HD
 * thật của hợp đồng cha (lấy từ HD_RUNG.ID_KEY_HD) có KHỚP với ID_HD lưu trong
 * các dòng HD_Picture có cùng Tên chủ rừng hay không — layAnhCuaHopDong() lọc
 * CHÍNH XÁC theo ID_HD, nên nếu 2 giá trị này lệch nhau (dù cùng 1 chủ rừng),
 * ảnh sẽ không hiện ra dù rõ ràng "thuộc về" hợp đồng đó.
 *
 * Chạy trực tiếp trong Apps Script editor: sửa idRung bên dưới thành đúng ID
 * bạn muốn kiểm tra, hoặc dùng menu (sẽ hỏi qua hộp thoại prompt).
 */
function CHAN_DOAN_ANH_THEO_RUNG_TU_MENU() {
  const ui = SpreadsheetApp.getUi();
  const kq = ui.prompt('Chẩn đoán ảnh theo lô rừng', 'Nhập ID_RUNG cần kiểm tra (vd: HAK2026071600101-ffa):', ui.ButtonSet.OK_CANCEL);
  if (kq.getSelectedButton() !== ui.Button.OK) return;
  const idRung = kq.getResponseText().trim();
  if (!idRung) return;

  const ketQua = CHAN_DOAN_ANH_THEO_RUNG_(idRung);
  ui.alert(ketQua.thongBao);
  Logger.log(JSON.stringify(ketQua, null, 2));
}

function CHAN_DOAN_ANH_THEO_RUNG_(idRung) {
  idRung = (idRung || '').toString().trim();
  const rungRows = readData_(SHEET_NAME.HD_RUNG);
  const rung = rungRows.find(function (r) { return (r[RUNG_COL.ID_RUNG] || '').toString().trim() === idRung; });
  if (!rung) return { thongBao: 'Không tìm thấy lô rừng có ID_RUNG = "' + idRung + '" trong HD_RUNG.' };

  const idHDThat = (rung[RUNG_COL.ID_KEY_HD] || '').toString().trim();
  const tenChuRung = (rung[RUNG_COL.TEN_CHU_RUNG] || '').toString().trim();

  const pictureRows = readData_(SHEET_NAME.HD_PICTURE);
  const khopIdHD = [];      // dòng HD_Picture có ID_HD khớp CHÍNH XÁC -> layAnhCuaHopDong() SẼ thấy
  const khopTenNhungLechId = []; // dòng cùng tên chủ rừng nhưng ID_HD KHÁC -> đây là nguyên nhân nếu có

  pictureRows.forEach(function (r, idx) {
    const idHDTrongDong = (r[PICTURE_COL.ID_HD] || '').toString().trim();
    const tenTrongDong = (r[PICTURE_COL.TEN_CHU_RUNG] || '').toString().trim();
    const coAnh = [];
    for (let c = PICTURE_COL.PICTURE_START; c <= PICTURE_COL.PICTURE_END; c++) { if (r[c]) coAnh.push(r[c]); }
    if (!coAnh.length) return; // dòng trống, bỏ qua

    if (idHDTrongDong === idHDThat) {
      khopIdHD.push({ dong: idx + 2, idHDTrongDong: idHDTrongDong, soAnh: coAnh.length });
    } else if (tenTrongDong && tenTrongDong.toLowerCase() === tenChuRung.toLowerCase()) {
      khopTenNhungLechId.push({ dong: idx + 2, idHDTrongDong: idHDTrongDong, soAnh: coAnh.length, anhMau: coAnh[0] });
    }
  });

  let thongBao = 'ID_RUNG: ' + idRung + '\nID_HD THẬT của hợp đồng cha (từ HD_RUNG): "' + idHDThat + '"\nTên chủ rừng: ' + tenChuRung + '\n\n';
  thongBao += '✅ Số dòng HD_Picture khớp ĐÚNG ID_HD (layAnhCuaHopDong sẽ thấy): ' + khopIdHD.length + '\n';
  thongBao += '⚠️ Số dòng HD_Picture CÙNG TÊN CHỦ RỪNG nhưng ID_HD LỆCH (sẽ KHÔNG hiện): ' + khopTenNhungLechId.length + '\n';

  if (khopTenNhungLechId.length) {
    thongBao += '\n👉 ĐÂY LÀ NGUYÊN NHÂN. Ví dụ:\n' + khopTenNhungLechId.slice(0, 3).map(function (x) {
      return '• Dòng ' + x.dong + ': ID_HD lưu trong đó = "' + x.idHDTrongDong + '" (khác với "' + idHDThat + '" thật) — có ' + x.soAnh + ' ảnh, vd: ' + x.anhMau;
    }).join('\n');
    thongBao += '\n\nCách sửa: sửa lại ô ID_HD (cột A) của (các) dòng này trong HD_Picture thành đúng giá trị "' + idHDThat + '".';
  } else if (!khopIdHD.length) {
    thongBao += '\nKhông tìm thấy dòng ảnh nào (khớp ID hay khớp tên) — có thể hợp đồng này thật sự chưa có ảnh nào trong HD_Picture.';
  }

  return { thongBao: thongBao, idHDThat: idHDThat, khopIdHD: khopIdHD, khopTenNhungLechId: khopTenNhungLechId };
}

/**
 * Chẩn đoán vì sao lọc theo "Số HĐ" ở tab Hồ sơ rừng ra TRỐNG dù lọc theo tên
 * vẫn thấy. So sánh cột SO_HD đang lưu trong cache Draft_HoSoRung với đúng
 * SO_HD gốc trong HD_RUNG (theo cùng ID_RUNG) — nếu 2 giá trị lệch nhau hoặc
 * cache đang trống trong khi gốc có dữ liệu, đó là nguyên nhân (cache cũ,
 * hoặc bị lỗi lúc ghi).
 */
function CHAN_DOAN_SO_HD_HOSORUNG() {
  const rungRows = readData_(SHEET_NAME.HD_RUNG);
  const soHdGocTheoIdRung = {};
  rungRows.forEach(function (r) {
    const idRung = (r[RUNG_COL.ID_RUNG] || '').toString().trim();
    if (idRung) soHdGocTheoIdRung[idRung] = (r[RUNG_COL.SO_HD] || '').toString().trim();
  });

  const sh = getOrCreateDraftHoSoRungSheet_();
  const lastRow = sh.getLastRow();
  if (lastRow < 2) { SpreadsheetApp.getUi().alert('Draft_HoSoRung chưa có dữ liệu — bấm "Tải báo cáo" ở tab Hồ sơ rừng trước, hoặc chạy XAY_DUNG_LAI_DRAFT_HOSORUNG().'); return; }
  const data = sh.getRange(2, 1, lastRow - 1, sh.getLastColumn()).getValues();
  const c = DRAFT_HSR_COL;

  let soTrong = 0, soLech = 0, soKhop = 0;
  const viDuTrong = [], viDuLech = [];
  data.forEach(function (r, idx) {
    const idRung = (r[c.ID_RUNG] || '').toString().trim();
    const soHdTrongCache = (r[c.SO_HD] || '').toString().trim();
    const soHdGoc = soHdGocTheoIdRung[idRung];
    if (!soHdTrongCache) {
      soTrong++;
      if (viDuTrong.length < 5) viDuTrong.push({ dong: idx + 2, idRung: idRung, soHdGoc: soHdGoc });
    } else if (soHdGoc !== undefined && soHdTrongCache !== soHdGoc) {
      soLech++;
      if (viDuLech.length < 5) viDuLech.push({ dong: idx + 2, idRung: idRung, soHdTrongCache: soHdTrongCache, soHdGoc: soHdGoc });
    } else {
      soKhop++;
    }
  });

  let thongBao = 'Tổng số dòng trong Draft_HoSoRung: ' + data.length + '\n';
  thongBao += '✅ Số dòng có Số HĐ khớp đúng với HD_RUNG gốc: ' + soKhop + '\n';
  thongBao += '⚠️ Số dòng có Số HĐ TRỐNG trong cache: ' + soTrong + '\n';
  thongBao += '⚠️ Số dòng có Số HĐ LỆCH so với gốc: ' + soLech + '\n';
  if (viDuTrong.length) thongBao += '\nVí dụ dòng trống:\n' + viDuTrong.map(function (x) { return '• Dòng ' + x.dong + ' (ID_RUNG ' + x.idRung + '): cache trống, gốc HD_RUNG = "' + x.soHdGoc + '"'; }).join('\n');
  if (viDuLech.length) thongBao += '\n\nVí dụ dòng lệch:\n' + viDuLech.map(function (x) { return '• Dòng ' + x.dong + ' (ID_RUNG ' + x.idRung + '): cache = "' + x.soHdTrongCache + '", gốc HD_RUNG = "' + x.soHdGoc + '"'; }).join('\n');
  if (soTrong > 0 || soLech > 0) thongBao += '\n\n👉 Chạy XAY_DUNG_LAI_DRAFT_HOSORUNG() (menu) để tính lại toàn bộ cache từ đầu, sẽ khắc phục các dòng này.';

  SpreadsheetApp.getUi().alert(thongBao);
  Logger.log(thongBao);
}
