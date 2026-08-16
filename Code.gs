/**
 * HỆ THỐNG HAK 2026 - Code.gs (bản đồng bộ với 00_Config.gs)
 * LƯU Ý: file này KHÔNG còn khai báo GPS_COL / RUNG_COL / MAX_RUNTIME_MS /
 * onOpen() nữa — các hằng số đó và menu đã chuyển sang 00_Config.gs / 05_Menu.gs
 * để tránh xung đột "đã khai báo 2 lần" làm hỏng toàn bộ project (kể cả webapp).
 */

// ====== onOpen() ĐÃ CHUYỂN SANG 05_Menu.gs — KHÔNG khai báo lại ở đây ======

function doGet(e) {
  var action = e.parameter.action;
  var page = e.parameter.page; // 'form' -> hiện form nhập liệu ngay trong webapp

  if (action === "run") {
    var SECRET = PropertiesService.getScriptProperties().getProperty('SYNC_TOKEN');
    if (!SECRET) {
      return ContentService.createTextOutput(
        "⚠️ Chưa cấu hình SYNC_TOKEN trong Script Properties. Vào Project Settings > Script Properties để thêm."
      ).setMimeType(ContentService.MimeType.TEXT);
    }
    if (e.parameter.token !== SECRET) {
      return ContentService.createTextOutput("❌ Không có quyền truy cập (token sai hoặc thiếu).")
             .setMimeType(ContentService.MimeType.TEXT);
    }
    try {
      var result = RUN_HAK_SYSTEM_FINAL();
      return ContentService.createTextOutput("⚡ HỆ THỐNG HAK 2026: Cập nhật dữ liệu thành công! Kết quả: " + result)
             .setMimeType(ContentService.MimeType.TEXT);
    } catch (err) {
      return ContentService.createTextOutput("❌ LỖI HỆ THỐNG: " + err.message)
             .setMimeType(ContentService.MimeType.TEXT);
    }
  }

  if (page === "map") {
    var tmplMapRieng = HtmlService.createTemplateFromFile('MapContainer');
    tmplMapRieng.baseUrl = ScriptApp.getService().getUrl();
    tmplMapRieng.currentPage = 'map';
    return tmplMapRieng.evaluate()
      .setTitle('🗺️ Bản đồ GPS HAK')
      .addMetaTag('viewport', 'width=device-width, initial-scale=1')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }

  if (page === "form") {
    var tmplForm = HtmlService.createTemplateFromFile('11_Page_NhapLieu');
    tmplForm.baseUrl = ScriptApp.getService().getUrl();
    tmplForm.currentPage = 'form';
    return tmplForm.evaluate()
      .setTitle('📝 Nhập liệu HAK')
      .addMetaTag('viewport', 'width=device-width, initial-scale=1')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }

  if (page === "baocao") {
    var tmplBaoCao = HtmlService.createTemplateFromFile('10_Page_BaoCao');
    tmplBaoCao.baseUrl = ScriptApp.getService().getUrl();
    tmplBaoCao.currentPage = 'baocao';
    return tmplBaoCao.evaluate()
      .setTitle('📊 Báo cáo tổng hợp HAK')
      .addMetaTag('viewport', 'width=device-width, initial-scale=1')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }

  if (page === "kiemtra") {
    var tmplKiemTra = HtmlService.createTemplateFromFile('12_Page_KiemTra');
    tmplKiemTra.baseUrl = ScriptApp.getService().getUrl();
    tmplKiemTra.currentPage = 'kiemtra';
    return tmplKiemTra.evaluate()
      .setTitle('🔎 Kiểm tra & Đối chiếu HAK')
      .addMetaTag('viewport', 'width=device-width, initial-scale=1')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }

  if (page === "huongdan") {
    var tmplHuongDan = HtmlService.createTemplateFromFile('13_HuongDan');
    tmplHuongDan.baseUrl = ScriptApp.getService().getUrl();
    tmplHuongDan.currentPage = 'huongdan';
    return tmplHuongDan.evaluate()
      .setTitle('📖 Hướng dẫn sử dụng HAK')
      .addMetaTag('viewport', 'width=device-width, initial-scale=1')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }

  if (page === "thietlap") {
    var tmplThietLap = HtmlService.createTemplateFromFile('24_Page_ThietLap');
    tmplThietLap.baseUrl = ScriptApp.getService().getUrl();
    tmplThietLap.currentPage = 'thietlap';
    return tmplThietLap.evaluate()
      .setTitle('⚙️ Thiết lập HAK')
      .addMetaTag('viewport', 'width=device-width, initial-scale=1')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }

  if (page === "meconn") {
    var tmplMeCon = HtmlService.createTemplateFromFile('26_Page_QuanLyMeCon');
    tmplMeCon.baseUrl = ScriptApp.getService().getUrl();
    tmplMeCon.currentPage = 'meconn';
    return tmplMeCon.evaluate()
      .setTitle('🗂️ Quản lý mẹ-con HAK')
      .addMetaTag('viewport', 'width=device-width, initial-scale=1')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }

  if (page === "hopdongmc") {
    var tmplHopDongMC = HtmlService.createTemplateFromFile('27_Page_HopDongMeCon');
    tmplHopDongMC.baseUrl = ScriptApp.getService().getUrl();
    tmplHopDongMC.currentPage = 'hopdongmc';
    return tmplHopDongMC.evaluate()
      .setTitle('📝 Thêm/Sửa hợp đồng HAK')
      .addMetaTag('viewport', 'width=device-width, initial-scale=1')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }

  if (page === "tongquan") {
    var tmplTongQuan = HtmlService.createTemplateFromFile('30_Page_TongQuanHopDong');
    tmplTongQuan.baseUrl = ScriptApp.getService().getUrl();
    tmplTongQuan.currentPage = 'tongquan';
    return tmplTongQuan.evaluate()
      .setTitle('📊 Tổng quan hợp đồng HAK')
      .addMetaTag('viewport', 'width=device-width, initial-scale=1')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }

  // ⚠️ ĐÃ SỬA: trước đây mở webapp KHÔNG kèm tham số ?page= sẽ mặc định vào
  // Nhập liệu HĐ/Rừng/TK — giờ mặc định thẳng vào "Tổng quan hợp đồng" (dashboard),
  // đúng màn hình tổng quan đầu tiên khi vào phần mềm.
  var tmplTongQuanMacDinh = HtmlService.createTemplateFromFile('30_Page_TongQuanHopDong');
  tmplTongQuanMacDinh.baseUrl = ScriptApp.getService().getUrl();
  tmplTongQuanMacDinh.currentPage = 'tongquan';
  return tmplTongQuanMacDinh.evaluate()
    .setTitle('📊 Tổng quan hợp đồng HAK')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function SETUP_SYNC_TOKEN() {
  var token = 'DAT_TOKEN_CUA_BAN_O_DAY';
  PropertiesService.getScriptProperties().setProperty('SYNC_TOKEN', token);
  Logger.log('Đã lưu SYNC_TOKEN: ' + token);
}

// --- HÀM NGUYÊN BẢN (GIỮ NGUYÊN 100%) ---
function convertDmsToDd(input) {
  if (!input) return null;
  let str = input.toString().toUpperCase().trim();
  let direction = str.slice(-1);
  let numericPart = str;
  if (["N", "S", "E", "W"].includes(direction)) {
    numericPart = str.slice(0, -1);
  } else {
    direction = "N";
  }
  let parts = numericPart.split('.');
  if (parts.length < 2) return parseFloat(numericPart);
  let d = parseFloat(parts[0]) || 0;
  let m = parseFloat(parts[1]) || 0;
  let s = 0;
  if (parts.length >= 3) {
    let secondsArray = parts.slice(2);
    s = parseFloat(secondsArray.join('.'));
  }
  let dd = d + (m / 60) + (s / 3600);
  if (direction === 'S' || direction === 'W') dd = dd * -1;
  return dd;
}

/**
 * Lấy lat/lng đã convert từ 1 dòng HD_GPS.
 * ĐÃ CẬP NHẬT: dùng tên cột thống nhất từ 00_Config.gs
 * (GPS_COL.HE_TOA_DO thay cho GPS_COL.TYPE cũ).
 */
function getLatLngFromRow(row) {
  var type = row[GPS_COL.HE_TOA_DO];
  var lat = (type === "DMS") ? convertDmsToDd(row[GPS_COL.LAT]) : parseFloat(row[GPS_COL.LAT]);
  var lng = (type === "DMS") ? convertDmsToDd(row[GPS_COL.LNG]) : parseFloat(row[GPS_COL.LNG]);
  return { lat: lat, lng: lng };
}

function RUN_HAK_SYSTEM_FINAL() {
  const startTime = new Date().getTime();
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const gpsSh = ss.getSheetByName("HD_GPS");
  const rungSh = ss.getSheetByName("HD_RUNG");
  if (!gpsSh || !rungSh) return "Lỗi: Thiếu Sheet HD_GPS hoặc HD_RUNG";

  const gpsRange = gpsSh.getDataRange();
  const gpsData = gpsRange.getValues();
  const forestGroups = {};
  let geocodedCount = 0;
  let stoppedEarly = false;

  for (let i = 1; i < gpsData.length; i++) {
    // ĐÃ CẬP NHẬT: GPS_COL.ID_KEY_GPS thay cho GPS_COL.ID cũ
    let id = gpsData[i][GPS_COL.ID_KEY_GPS] ? gpsData[i][GPS_COL.ID_KEY_GPS].toString().trim() : "";
    let { lat, lng } = getLatLngFromRow(gpsData[i]);

    if (id && !isNaN(lat) && lat !== 0) {
      if (!forestGroups[id]) forestGroups[id] = [];
      forestGroups[id].push({ lat: lat, lng: lng });
      gpsData[i][GPS_COL.LOCATION] = lat.toFixed(6) + ", " + lng.toFixed(6);

      if (!gpsData[i][GPS_COL.ADDRESS]) {
        if (new Date().getTime() - startTime > MAX_RUNTIME_MS) {
          stoppedEarly = true;
          continue;
        }
        try {
          let res = Maps.newGeocoder().reverseGeocode(lat, lng);
          gpsData[i][GPS_COL.ADDRESS] = (res.status === 'OK') ? res.results[0].formatted_address : "";
          geocodedCount++;
        } catch (e) { /* bỏ qua lỗi geocode 1 dòng */ }
      }
    }
  }
  gpsRange.setValues(gpsData);

  const areaMap = {};
  const R = 6378137;
  for (let id in forestGroups) {
    let coords = forestGroups[id];
    if (coords.length >= 3) {
      let a = 0;
      for (let n = 0; n < coords.length; n++) {
        let p1 = coords[n], p2 = coords[(n + 1) % coords.length];
        a += (p2.lng - p1.lng) * Math.PI / 180 * (2 + Math.sin(p1.lat * Math.PI / 180) + Math.sin(p2.lat * Math.PI / 180));
      }
      areaMap[id] = Math.abs(a * R * R / 2).toFixed(2);
    }
  }

  const lastRow = rungSh.getLastRow();
  if (lastRow < 2) return "OK (Sheet Rừng trống)";

  // ĐÃ CẬP NHẬT: đọc đủ 18 cột theo cấu trúc thật của HD_RUNG (00_Config.gs)
  const rungRange = rungSh.getRange(2, 1, lastRow - 1, 18);
  const rungValues = rungRange.getValues();
  for (let j = 0; j < rungValues.length; j++) {
    // ĐÃ CẬP NHẬT: RUNG_COL.ID_RUNG thay cho RUNG_COL.MA_RUNG cũ (đúng cột nối với HD_GPS)
    let idRung = rungValues[j][RUNG_COL.ID_RUNG] ? rungValues[j][RUNG_COL.ID_RUNG].toString().trim() : "";
    if (idRung && areaMap[idRung]) {
      rungValues[j][RUNG_COL.DIEN_TICH_GPS] = areaMap[idRung];
    }
  }
  rungRange.setValues(rungValues);

  SpreadsheetApp.flush();
  PropertiesService.getScriptProperties().setProperty('LAN_CUOI_CHAY_BAN_DO', new Date().toISOString());

  if (stoppedEarly) {
    return "OK (đã geocode " + geocodedCount + " dòng, còn dòng chưa geocode do giới hạn thời gian — chạy lại để tiếp tục)";
  }
  return "OK (đã geocode " + geocodedCount + " dòng)";
}

/** Lấy thời điểm chạy đồng bộ bản đồ (RUN_HAK_SYSTEM_FINAL) gần nhất, để hiển thị "Cập nhật lúc: ..." trên bản đồ */
function layThoiGianCapNhatBanDo() {
  const gia = PropertiesService.getScriptProperties().getProperty('LAN_CUOI_CHAY_BAN_DO');
  return gia || null;
}

/**
 * ⚠️ ĐÃ THÊM CACHE: trước đây đọc lại TOÀN BỘ 3 sheet (HD_RUNG, HD_GPS, HD_NCC)
 * mỗi lần mở trang Bản đồ GPS — không sao khi dữ liệu còn ít, nhưng sẽ chậm
 * dần khi HD_GPS/HD_RUNG nhiều lên. Giờ cache lại 15 phút — mở lại trang trong
 * khoảng đó dùng ngay dữ liệu cũ, không đọc lại sheet. Bấm "⚡ TẢI DỮ LIỆU HỆ
 * THỐNG" vẫn gọi đúng hàm này nên sau 15 phút sẽ tự làm mới, không cần thêm nút
 * "xóa cache" riêng.
 */
function getMapData() {
  const cache = CacheService.getScriptCache();
  const daCache = cache.get('MAP_DATA_CACHE');
  if (daCache) { try { return JSON.parse(daCache); } catch (e) { /* cache hỏng thì tính lại như bình thường */ } }

  const ketQua = getMapData_ThucThi_();
  try {
    const chuoi = JSON.stringify(ketQua);
    if (chuoi.length < 95000) cache.put('MAP_DATA_CACHE', chuoi, 900); // 900s = 15 phút; CacheService giới hạn ~100KB/key nên bỏ qua an toàn nếu dữ liệu vượt ngưỡng, không cache được thì vẫn trả kết quả bình thường, chỉ là lần sau phải tính lại
  } catch (e) { /* không cache được thì thôi, không ảnh hưởng kết quả trả về */ }
  return ketQua;
}

function getMapData_ThucThi_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const rungSh = ss.getSheetByName("HD_RUNG");
  const gpsSh = ss.getSheetByName("HD_GPS");
  const nccSh = ss.getSheetByName("HD_NCC");
  if (!rungSh || !gpsSh) throw new Error("Thiếu Sheet HD_GPS hoặc HD_RUNG, vui lòng kiểm tra lại tên sheet.");

  const rungData = rungSh.getDataRange().getValues();
  const gpsData = gpsSh.getDataRange().getValues();

  // Tra trạng thái hợp đồng theo ID_KEY_HD (HD_NCC.ID_HD) để tô màu marker/đa giác theo trạng thái
  let tinhTrangByIdHD = {};
  if (nccSh) {
    const nccData = nccSh.getDataRange().getValues();
    for (let k = 1; k < nccData.length; k++) {
      const idHD = nccData[k][NCC_COL.ID_HD] ? nccData[k][NCC_COL.ID_HD].toString().trim() : "";
      if (idHD) tinhTrangByIdHD[idHD] = nccData[k][NCC_COL.TINH_TRANG] || "Đang thực hiện";
    }
  }

  let forestInfo = {};
  for (let j = 1; j < rungData.length; j++) {
    let idRung = rungData[j][RUNG_COL.ID_RUNG] ? rungData[j][RUNG_COL.ID_RUNG].toString().trim() : "";
    if (!idRung) continue;
    const idKeyHD = rungData[j][RUNG_COL.ID_KEY_HD] ? rungData[j][RUNG_COL.ID_KEY_HD].toString().trim() : "";
    forestInfo[idRung] = {
      maRung: rungData[j][RUNG_COL.ID_RUNG],
      soHD: rungData[j][RUNG_COL.SO_HD],
      ten: rungData[j][RUNG_COL.TEN_CHU_RUNG],
      dtKyHD: rungData[j][RUNG_COL.DIEN_TICH_M2],
      dtGPS: rungData[j][RUNG_COL.DIEN_TICH_GPS],
      tinhTrang: tinhTrangByIdHD[idKeyHD] || "Đang thực hiện"
    };
  }

  let mapGroups = {};
  for (let i = 1; i < gpsData.length; i++) {
    let idGPS = gpsData[i][GPS_COL.ID_KEY_GPS] ? gpsData[i][GPS_COL.ID_KEY_GPS].toString().trim() : "";
    if (!idGPS) continue;

    let { lat, lng } = getLatLngFromRow(gpsData[i]);
    let address = gpsData[i][GPS_COL.ADDRESS] || "Chưa xác định địa chỉ";

    if (!isNaN(lat) && lat !== 0) {
      if (!mapGroups[idGPS]) {
        mapGroups[idGPS] = { coords: [], details: forestInfo[idGPS] || { maRung: idGPS, soHD: "N/A", ten: "N/A", tinhTrang: "Đang thực hiện" } };
      }
      mapGroups[idGPS].coords.push({ lat: lat, lng: lng, addr: address });
    }
  }
  return mapGroups;
}
