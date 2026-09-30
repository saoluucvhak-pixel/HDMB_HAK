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
    // Giá trị mẫu của SETUP_SYNC_TOKEN() nằm ngay trong mã nguồn -> ai đọc được code cũng biết; coi như chưa cấu hình.
    if (SECRET === 'DAT_TOKEN_CUA_BAN_O_DAY') {
      return ContentService.createTextOutput(
        "⚠️ SYNC_TOKEN vẫn là giá trị mẫu. Đổi thành chuỗi bí mật riêng trong Project Settings > Script Properties."
      ).setMimeType(ContentService.MimeType.TEXT);
    }
    if (e.parameter.token !== SECRET) {
      return ContentService.createTextOutput("❌ Không có quyền truy cập (token sai hoặc thiếu).")
             .setMimeType(ContentService.MimeType.TEXT);
    }
    try {
      var result = RUN_HAK_SYSTEM_FINAL_();
      return ContentService.createTextOutput("⚡ HỆ THỐNG HAK 2026: Cập nhật dữ liệu thành công! Kết quả: " + result)
             .setMimeType(ContentService.MimeType.TEXT);
    } catch (err) {
      return ContentService.createTextOutput("❌ LỖI HỆ THỐNG: " + err.message)
             .setMimeType(ContentService.MimeType.TEXT);
    }
  }

  // Link ảnh công khai trong mã QR của báo cáo PDF — không cần đăng nhập, tự kiểm tra chữ ký (35_TraCuuHinhAnh.gs)
  if (action === 'anh') return trangAnhCongKhai_(e.parameter.hd, e.parameter.k);

  // Đăng nhập (34_PhanQuyen.gs): Cổng đăng nhập chuyển về đây kèm ?sso=... -> cấp phiên cho trình duyệt.
  // Trang luôn hiển thị; dữ liệu chỉ tải được qua api() khi đã có phiên hợp lệ.
  var phien = '', loiDangNhap = '';
  if (e.parameter.sso) {
    var dangNhap = _xuLyDangNhapSso_(e.parameter.sso);
    if (dangNhap.yeuCau) return _trangDangNhapNhung_(dangNhap.yeuCau, dangNhap.phien, dangNhap.loi);
    phien = dangNhap.phien;
    loiDangNhap = dangNhap.loi;
  }
  var trang = _dungTrangWebapp_(page, phien, loiDangNhap, e.parameter.sso ? '' : e.parameter.ph, e.parameter.tab);
  return trang.tmpl.evaluate()
    .setTitle(trang.cauHinh.title)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/** Dựng template 1 trang webapp (?page=...) — dùng chung cho doGet và trangTrongKhung (chuyển trang khi nhúng). */
function _dungTrangWebapp_(page, phien, loiDangNhap, ph, tab) {
  // Mở webapp KHÔNG kèm ?page= (hoặc page lạ) -> mặc định vào "Tổng quan hợp đồng" (dashboard).
  // hasOwnProperty: ?page=constructor / __proto__ không được lọt vào thuộc tính kế thừa của object.
  var tenTrang = Object.prototype.hasOwnProperty.call(TRANG_WEBAPP_, page) ? page : 'tongquan';
  var cauHinh = TRANG_WEBAPP_[tenTrang];
  var tmpl = HtmlService.createTemplateFromFile(cauHinh.file);
  tmpl.baseUrl = ScriptApp.getService().getUrl();
  tmpl.currentPage = cauHinh.currentPage || tenTrang;
  tmpl.tabTrang = /^(hoso|anh|ocr)$/.test(String(tab || '')) ? String(tab) : ''; // thẻ con trang Kiểm tra (menu chung)
  tmpl.phien = phien || '';
  tmpl.loiDangNhap = loiDangNhap || '';
  if (!tmpl.phien && ph && _docPhien_(ph)) {
    // Trình duyệt chặn bộ nhớ của trang nhúng (chặn cookie bên thứ ba): trang trước chuyển mã phiên
    // qua link (?ph=...) để không phải đăng nhập lại mỗi lần chuyển trang. Chỉ nhận mã phiên còn hiệu lực.
    tmpl.phien = ph;
  }
  return { tmpl: tmpl, cauHinh: cauHinh };
}

/**
 * CÔNG KHAI (như doGet — trang không chứa dữ liệu, dữ liệu vẫn đi qua api()): HTML của 1 trang để chuyển trang
 * NGAY TRONG KHUNG khi webapp bị nhúng trong trang khác (GiaoDien_Chung.html). Không nhận ?sso (đăng nhập chỉ qua doGet).
 */
function trangTrongKhung(thamSo) {
  var p = thamSo || {};
  var trang = _dungTrangWebapp_(String(p.page || ''), '', '', p.ph ? String(p.ph) : '', p.tab ? String(p.tab) : '');
  return { html: trang.tmpl.evaluate().getContent(), tieuDe: trang.cauHinh.title };
}

/**
 * Bảng định tuyến ?page=... của webapp: file HTML, tiêu đề tab, và currentPage (mục menu được tô
 * sáng). Thêm trang mới = thêm 1 dòng ở đây (trước đây mỗi trang là 1 khối if dài 9 dòng chép lại).
 */
var TRANG_WEBAPP_ = {
  map:       { file: 'MapContainer',            title: '🗺️ Bản đồ GPS HAK' },
  form:      { file: '11_Page_NhapLieu',        title: '📝 Nhập liệu HAK' },
  baocao:    { file: '10_Page_BaoCao',          title: '📊 Báo cáo tổng hợp HAK' },
  kiemtra:   { file: '12_Page_KiemTra',         title: '🔎 Kiểm tra & Đối chiếu HAK' },
  huongdan:  { file: '13_HuongDan',             title: '📖 Hướng dẫn sử dụng HAK' },
  thietlap:  { file: '24_Page_ThietLap',        title: '⚙️ Thiết lập HAK' },
  hopdongmc: { file: '27_Page_HopDongMeCon',    title: '📝 Thêm/Sửa hợp đồng HAK' },
  // "meconn" từng là trang 26_Page_QuanLyMeCon (bản cũ, đã xóa khỏi dự án). URL cũ có
  // thể còn trong bookmark -> đưa sang cùng trang "hopdongmc" đang được bảo trì.
  meconn:    { file: '27_Page_HopDongMeCon',    title: '📝 Thêm/Sửa hợp đồng HAK', currentPage: 'hopdongmc' },
  tongquan:  { file: '30_Page_TongQuanHopDong', title: '📊 Tổng quan hợp đồng HAK' },
  tracuu:    { file: '33_Page_TraCuuHopDong',   title: '🔍 Tra cứu hợp đồng HAK' },
  hinhanh:   { file: '35_Page_TraCuuHinhAnh',   title: '🖼️ Tra cứu hình ảnh HAK' }
};

function SETUP_SYNC_TOKEN() {
  _yeuCauQuyen_(QUYEN.QUAN_TRI);
  // Hàm công khai -> ai có URL webapp cũng gọi được qua google.script.run: KHÔNG được ghi đè token đã đặt
  // (trước đây gọi hàm này rồi dùng ?action=run&token=<giá trị mẫu> là chạy được đồng bộ).
  var props = PropertiesService.getScriptProperties();
  if (props.getProperty('SYNC_TOKEN')) { Logger.log('SYNC_TOKEN đã có — không ghi đè. Đổi trong Project Settings > Script Properties.'); return; }
  props.setProperty('SYNC_TOKEN', 'DAT_TOKEN_CUA_BAN_O_DAY');
  Logger.log('Đã tạo SYNC_TOKEN mẫu — đổi thành chuỗi bí mật riêng trong Project Settings > Script Properties (giá trị mẫu bị từ chối).');
}

// --- HÀM NGUYÊN BẢN (GIỮ NGUYÊN 100%) ---
function convertDmsToDd_(input) {
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
function getLatLngFromRow_(row) {
  var type = row[GPS_COL.HE_TOA_DO];
  var lat = (type === "DMS") ? convertDmsToDd_(row[GPS_COL.LAT]) : parseFloat(row[GPS_COL.LAT]);
  var lng = (type === "DMS") ? convertDmsToDd_(row[GPS_COL.LNG]) : parseFloat(row[GPS_COL.LNG]);
  return { lat: lat, lng: lng };
}

function RUN_HAK_SYSTEM_FINAL_() {
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
    let { lat, lng } = getLatLngFromRow_(gpsData[i]);

    if (id && !isNaN(lat) && lat !== 0 && !isNaN(lng)) {
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

/** Lấy thời điểm chạy đồng bộ bản đồ (RUN_HAK_SYSTEM_FINAL_) gần nhất, để hiển thị "Cập nhật lúc: ..." trên bản đồ */
function layThoiGianCapNhatBanDo_() {
  _yeuCauQuyen_(QUYEN.XEM);
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
function getMapData_() {
  _yeuCauQuyen_(QUYEN.XEM);
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
      tinhTrang: tinhTrangByIdHD[idKeyHD] || "Đang thực hiện",
      idHD: idKeyHD, // giao diện mới: nút "Xem ảnh" mở thẳng thư viện ảnh của hợp đồng
      diaChi: rungData[j][RUNG_COL.DIA_CHI_RUNG] || ""
    };
  }

  let mapGroups = {};
  for (let i = 1; i < gpsData.length; i++) {
    let idGPS = gpsData[i][GPS_COL.ID_KEY_GPS] ? gpsData[i][GPS_COL.ID_KEY_GPS].toString().trim() : "";
    if (!idGPS) continue;

    let { lat, lng } = getLatLngFromRow_(gpsData[i]);
    let address = gpsData[i][GPS_COL.ADDRESS] || "Chưa xác định địa chỉ";

    if (!isNaN(lat) && lat !== 0 && !isNaN(lng)) {
      if (!mapGroups[idGPS]) {
        mapGroups[idGPS] = { coords: [], details: forestInfo[idGPS] || { maRung: idGPS, soHD: "N/A", ten: "N/A", tinhTrang: "Đang thực hiện" } };
      }
      mapGroups[idGPS].coords.push({ lat: lat, lng: lng, addr: address });
    }
  }
  return mapGroups;
}

/** Menu "🗺️ Mở bản đồ": đồng bộ tọa độ/địa chỉ HD_GPS (ghi dữ liệu) — cần quyền Nhập liệu. ?action=run (có SYNC_TOKEN) gọi thẳng RUN_HAK_SYSTEM_FINAL_. */
function RUN_HAK_SYSTEM_FINAL() {
  _yeuCauQuyen_(QUYEN.NHAP_LIEU);
  return RUN_HAK_SYSTEM_FINAL_();
}
