/**
 * ============================================================
 *  04_Reconciliation.gs
 *  ĐỐI CHIẾU ĐỊNH KỲ: OCR file PDF/ảnh minh chứng (CCCD, GCN QSDĐ,
 *  giấy xác nhận, giấy ủy quyền) rồi so khớp số CCCD / số giấy tờ
 *  trích xuất được với dữ liệu đã nhập trong HD_NCC / HD_RUNG.
 *
 *  YÊU CẦU CẤU HÌNH TRƯỚC KHI DÙNG:
 *  Apps Script > Dịch vụ (Services) > bật "Drive API" (Advanced Drive Service)
 *  — dùng để OCR file qua Drive.Files.insert với ocr:true.
 *  Nếu chưa bật, hàm ocrFile_() sẽ trả lỗi rõ ràng để bạn biết cần bật.
 * ============================================================
 */

/**
 * OCR 1 file (ảnh hoặc PDF) bằng Drive Advanced Service, trả về text thuần.
 * Tạo 1 Google Doc tạm trong thư mục gốc rồi xóa ngay sau khi lấy text xong.
 */
function ocrFile_(fileId) {
  if (typeof Drive === 'undefined') {
    throw new Error('Chưa bật Advanced Drive Service. Vào Services (biểu tượng +) > Drive API > Add, rồi thử lại.');
  }

  // Nếu file GỐC đã bị Google Drive tự động chuyển thành Google Doc/Sheet (do cài đặt tài
  // khoản "Convert uploads to Google Docs editor format" đang bật), OCR sẽ báo lỗi vì input
  // KHÔNG PHẢI ảnh/PDF nữa. Trường hợp này, đọc thẳng nội dung văn bản (đã có sẵn dạng text).
  const mimeGoc = DriveApp.getFileById(fileId).getMimeType();
  if (mimeGoc === MimeType.GOOGLE_DOCS) {
    return DocumentApp.openById(fileId).getBody().getText();
  }
  if (mimeGoc === MimeType.GOOGLE_SHEETS) {
    return SpreadsheetApp.openById(fileId).getDataRange().getValues().map(function (r) { return r.join(' '); }).join('\n');
  }

  const resource = { title: 'OCR_TEMP_' + fileId, mimeType: MimeType.GOOGLE_DOCS };
  let file;
  try {
    file = Drive.Files.insert(resource, DriveApp.getFileById(fileId).getBlob(), { ocr: true, ocrLanguage: 'vi' });
  } catch (e) {
    // ⚠️ ĐÃ SỬA: TRƯỚC ĐÂY chỉ đoán 1 nguyên nhân duy nhất (Convert uploads to
    // Google Docs) rồi hiện lời khuyên cố định, CHE MẤT lỗi gốc thật từ Google.
    // Nếu bạn đã bỏ tick cài đặt đó mà vẫn lỗi, nghĩa là nguyên nhân thật có thể
    // KHÁC (vd file quá lớn, định dạng ảnh không được OCR hỗ trợ, quyền
    // OAuth/API bị giới hạn...). Giờ LUÔN hiện đúng câu lỗi gốc từ Google trước,
    // kèm gợi ý CÓ THỂ ĐÚNG (không chắc chắn) ngay sau — để không bị bế tắc nếu
    // đoán sai.
    const loiGoc = (e && e.message) ? e.message : e.toString();
    let goiY = '';
    if (loiGoc.indexOf('OCR is not supported') !== -1) {
      goiY = ' 👉 Gợi ý (chưa chắc đúng, cần xác nhận): có thể do file đã bị Google Drive tự động chuyển sang định dạng Google Docs khi tải lên — kiểm tra cài đặt "Convert uploads to Google Docs" ở ĐÚNG tài khoản đang chạy web app (executeAs), không phải tài khoản bạn đang xem trang.';
    }
    throw new Error('Lỗi OCR gốc từ Google: "' + loiGoc + '".' + goiY);
  }
  const doc = DocumentApp.openById(file.id);
  const text = doc.getBody().getText();
  DriveApp.getFileById(file.id).setTrashed(true); // dọn file tạm
  return text;
}

/**
 * ============================================================
 *  ĐỌC BẢN SCAN ĐỂ TỰ ĐỘNG ĐIỀN FORM
 * ============================================================
 * Nhận ảnh/PDF scan (CCCD, hồ sơ nguồn gốc đất, giấy ủy quyền), chạy OCR, rồi
 * dùng các mẫu regex thông dụng của giấy tờ Việt Nam để tách ra từng trường dữ
 * liệu cụ thể. Người dùng chọn TRƯỚC loại tài liệu (loaiTaiLieu) để áp đúng bộ
 * quy tắc trích xuất — không cố đoán loại tài liệu tự động vì dễ sai.
 *
 * LƯU Ý QUAN TRỌNG: đây là trích xuất "đoán theo mẫu phổ biến", KHÔNG chính xác
 * 100% với mọi loại giấy tờ/mọi chất lượng ảnh scan. Người dùng LUÔN cần xem lại
 * và sửa tay các trường trích xuất sai trước khi lưu — form sẽ hiện rõ từng
 * trường đọc được để xác nhận, không tự động lưu thẳng vào hồ sơ.
 *
 * loaiTaiLieu: 'cccd_chu_rung' | 'cccd_uy_quyen' | 'ho_so_rung' | 'giay_uy_quyen'
 * Trả về { thanhCong, vanBanGoc, truong: {...}, urlFileGoc, tenFileGoc, loi }
 */
function OCR_TU_BAN_SCAN(loaiTaiLieu, base64Data, mimeType, tenFileGoc) {
  if (!base64Data) return { thanhCong: false, loi: 'Không có dữ liệu file' };
  let file = null;
  try {
    const bytes = Utilities.base64Decode(base64Data);
    const ten = tenFileGoc || ('scan_' + new Date().getTime());
    const blob = Utilities.newBlob(bytes, mimeType || 'image/jpeg', ten);
    const folder = layHoacTaoThuMucHoSo_();
    file = folder.createFile(blob);

    const text = ocrFile_(file.getId());
    const truong = trichXuatTheoLoai_(loaiTaiLieu, text);

    return {
      thanhCong: true, vanBanGoc: text, truong: truong,
      urlFileGoc: file.getUrl(), tenFileGoc: file.getName()
    };
  } catch (e) {
    if (file) { try { file.setTrashed(true); } catch (e2) {} }
    return { thanhCong: false, loi: 'Lỗi đọc bản scan: ' + e.message };
  }
}

/** Áp bộ quy tắc regex trích xuất theo từng loại giấy tờ Việt Nam phổ biến */
function trichXuatTheoLoai_(loaiTaiLieu, text) {
  const truong = {};
  const layDong = function (regex) {
    const m = text.match(regex);
    return m ? m[1].replace(/\s+/g, ' ').trim() : '';
  };

  if (loaiTaiLieu === 'cccd_chu_rung' || loaiTaiLieu === 'cccd_uy_quyen') {
    const cccdMatch = text.match(/\b\d{12}\b/);
    const cccd = cccdMatch ? cccdMatch[0] : '';
    const hoTen = layDong(/(?:Họ và tên|Full name|Ho va ten)[\s:\/]*\n?\s*([A-ZÀ-Ỹ][A-ZÀ-Ỹ\s]{4,60})/i);
    const ngaySinh = layDong(/(?:Ngày sinh|Date of birth)[\s:\/]*\n?\s*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4})/i);
    const diaChi = layDong(/(?:Nơi thường trú|Place of residence|Thường trú)[\s:\/]*\n?\s*([^\n]{8,120})/i);
    const ngayCap = layDong(/(?:Ngày cấp|Date of issue)[\s:\/]*\n?\s*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4})/i);
    const noiCap = layDong(/(?:Nơi cấp|Place of issue)[\s:\/]*\n?\s*([^\n]{5,80})/i) || (cccd ? 'Cục Cảnh sát QLHC về TTXH' : '');

    if (loaiTaiLieu === 'cccd_chu_rung') {
      if (cccd) truong.cccdChuRung = cccd;
      if (hoTen) truong.tenChuRung = hoTen;
      if (ngaySinh) truong.ngaySinhChuRung = ngaySinh;
      if (diaChi) truong.diaChiThuongTru = diaChi;
      if (ngayCap) truong.ngayCap = chuyenNgayVeISO_(ngayCap);
      if (noiCap) truong.noiCap = noiCap;
    } else {
      if (cccd) truong.cccdUyQuyen = cccd;
      if (hoTen) truong.tenUyQuyen = hoTen;
      if (diaChi) truong.diaChiUyQuyen = diaChi;
      if (ngayCap) truong.ngayCapUyQuyen = chuyenNgayVeISO_(ngayCap);
      if (noiCap) truong.noiCapUyQuyen = noiCap;
    }
  }

  if (loaiTaiLieu === 'ho_so_rung') {
    const soGiayTo = layDong(/(?:Số|So)[\s:.]*\n?\s*([A-Za-z0-9\/\.\-]{3,25})/i);
    if (soGiayTo) truong.soGiayTo = soGiayTo;

    if (/giấy chứng nhận quyền sử dụng đất|GCNQSDĐ|sổ đỏ/i.test(text)) truong.hoSoNguonGoc = 'Giấy chứng nhận QSDĐ';
    else if (/xác nhận.*ủy ban|UBND.*xác nhận/i.test(text)) truong.hoSoNguonGoc = 'Đơn xác nhận của UBNN Xã/Phường';
    else if (/giấy xác nhận/i.test(text)) truong.hoSoNguonGoc = 'Giấy xác nhận';
    else if (/chuyển nhượng/i.test(text)) truong.hoSoNguonGoc = 'Hợp đồng chuyển nhượng';

    const ngayGiayTo = layDong(/(?:ngày|Ngày)[\s:.]*\n?\s*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4})/);
    if (ngayGiayTo) truong.ngayGiayTo = chuyenNgayVeISO_(ngayGiayTo);

    const dienTichMatch = text.match(/(\d[\d.,]{2,10})\s*(?:m2|m²|ha)/i);
    if (dienTichMatch) truong.dienTichM2 = dienTichMatch[1].replace(/[.,]/g, '');
  }

  if (loaiTaiLieu === 'giay_uy_quyen') {
    const cccdList = text.match(/\b\d{12}\b/g) || [];
    if (cccdList.length >= 1) truong.cccdChuRung = cccdList[0];
    if (cccdList.length >= 2) truong.cccdUyQuyen = cccdList[1];
    const tenNguoiUyQuyen = layDong(/(?:ủy quyền cho|Uỷ quyền cho)[\s:]*\n?\s*(?:Ông|Bà)?\s*([A-ZÀ-Ỹ][A-ZÀ-Ỹ\s]{4,60})/i);
    if (tenNguoiUyQuyen) truong.tenUyQuyen = tenNguoiUyQuyen;
    truong.uyQuyenTT = 'Có';
  }

  return truong;
}

/** Chuyển ngày dạng dd/mm/yyyy (OCR đọc được) về yyyy-mm-dd để đổ thẳng vào input type="date" */
function chuyenNgayVeISO_(ngayStr) {
  const m = ngayStr.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
  if (!m) return '';
  const dd = m[1].padStart(2, '0'), mm = m[2].padStart(2, '0'), yyyy = m[3];
  return yyyy + '-' + mm + '-' + dd;
}

/** Tìm chuỗi 12 chữ số liên tiếp trong text OCR (nghi là số CCCD) */
function timCCCDTrongText_(text) {
  const matches = text.match(/\b\d{12}\b/g);
  return matches ? matches : [];
}

/**
 * Đối chiếu 1 lô rừng: OCR file DinhKemGiayTo, kiểm tra số CCCD chủ rừng
 * và số giấy tờ (SoGiayTo) trong hồ sơ có xuất hiện trong nội dung OCR không.
 */
function doiChieuMotLoRung_(row) {
  const ketQua = {
    idKeyHD: row[RUNG_COL.ID_KEY_HD],
    maRung: row[RUNG_COL.MA_RUNG],
    khopCCCD: null,
    khopSoGiayTo: null,
    loi: null
  };
  const duongDan = (row[RUNG_COL.DINH_KEM_GIAY_TO] || '').toString().trim();
  if (!duongDan) { ketQua.loi = 'Không có file đính kèm để đối chiếu'; return ketQua; }

  // ⚠️ ĐÃ SỬA: TRƯỚC ĐÂY luôn giả định duongDan là TÊN FILE đơn giản, tách phần
  // sau dấu "/" cuối rồi tìm theo tên (DriveApp.getFilesByName). Sau khi dữ
  // liệu DinhKemGiayTo được chuyển sang LINK DRIVE ĐẦY ĐỦ, cách tách cũ lấy
  // nhầm phần cuối URL (vd chữ "view") làm "tên file" -> luôn báo "Không tìm
  // thấy file". Giờ nếu là URL thì trích đúng FILE ID để mở trực tiếp bằng
  // getFileById() — chính xác tuyệt đối; nếu không phải URL (dữ liệu cũ còn
  // sót) thì vẫn tra theo tên file như trước.
  let fileId = null;
  if (duongDan.indexOf('http') === 0) {
    const khop = duongDan.match(/\/d\/([a-zA-Z0-9_-]+)/) || duongDan.match(/[?&]id=([a-zA-Z0-9_-]+)/);
    if (khop && khop[1]) fileId = khop[1];
  } else {
    const tenFile = duongDan.split('/').pop();
    const it = DriveApp.getFilesByName(tenFile);
    if (it.hasNext()) fileId = it.next().getId();
  }
  if (!fileId) { ketQua.loi = 'Không tìm thấy file trên Drive: ' + duongDan; return ketQua; }

  try {
    const text = ocrFile_(fileId);
    const cccdOCR = timCCCDTrongText_(text);
    const cccdSheet = (row[RUNG_COL.CCCD] || '').toString().trim();
    ketQua.khopCCCD = cccdSheet ? cccdOCR.indexOf(cccdSheet) !== -1 : null;

    const soGiayToSheet = (row[RUNG_COL.SO_GIAY_TO] || '').toString().trim();
    ketQua.khopSoGiayTo = soGiayToSheet ? text.indexOf(soGiayToSheet) !== -1 : null;
  } catch (e) {
    ketQua.loi = 'Lỗi OCR: ' + e.message;
  }
  return ketQua;
}

/**
 * CHẠY ĐỐI CHIẾU ĐỊNH KỲ cho toàn bộ hồ sơ (nên đặt Trigger chạy hàng tuần
 * qua menu Extensions > Apps Script > Triggers, vì OCR tốn thời gian).
 * Có giới hạn thời gian chạy để tránh timeout 6 phút của Apps Script.
 */
function DOI_CHIEU_HO_SO_DINH_KY() {
  const startTime = new Date().getTime();
  const rungRows = readData_(SHEET_NAME.HD_RUNG);
  const baoCao = [];
  let dungSom = false;

  for (let i = 0; i < rungRows.length; i++) {
    if (new Date().getTime() - startTime > MAX_RUNTIME_MS) { dungSom = true; break; }
    baoCao.push(doiChieuMotLoRung_(rungRows[i]));
  }

  const ss = getSS_();
  const sheetName = 'BaoCao_DoiChieuOCR';
  let sh = ss.getSheetByName(sheetName);
  if (sh) sh.clear(); else sh = ss.insertSheet(sheetName);

  const header = ['ID_KEY_HD', 'Mã Rừng', 'CCCD khớp OCR?', 'Số giấy tờ khớp OCR?', 'Ghi chú lỗi'];
  sh.getRange(1, 1, 1, header.length).setValues([header]).setFontWeight('bold').setBackground('#34495e').setFontColor('#ffffff');
  const rows = baoCao.map(function (b) {
    return [b.idKeyHD, b.maRung,
      b.khopCCCD === null ? 'N/A' : (b.khopCCCD ? '✅' : '❌'),
      b.khopSoGiayTo === null ? 'N/A' : (b.khopSoGiayTo ? '✅' : '❌'),
      b.loi || ''];
  });
  if (rows.length) sh.getRange(2, 1, rows.length, header.length).setValues(rows);
  sh.autoResizeColumns(1, header.length);

  const soLech = baoCao.filter(function (b) { return b.khopCCCD === false || b.khopSoGiayTo === false; }).length;
  return 'Đã đối chiếu ' + baoCao.length + ' lô rừng' + (dungSom ? ' (dừng sớm do giới hạn thời gian, chạy lại để tiếp tục)' : '') +
    ' — ' + soLech + ' hồ sơ CÓ SAI LỆCH giữa Sheet và file gốc. Xem sheet "' + sheetName + '"';
}

/**
 * Lấy danh sách lô rừng KÈM LINK DRIVE của file DinhKemGiayTo, dùng cho trang
 * webapp "Đối chiếu OCR" (mục riêng, tách khỏi Kiểm tra hồ sơ) — để người dùng
 * bấm xem file gốc trước khi chạy đối chiếu OCR cho từng dòng hoặc chạy tất cả.
 */
function layDuLieuOCRWebapp() {
  const rungRows = readData_(SHEET_NAME.HD_RUNG);
  return rungRows.map(function (r) {
    return {
      idHD: r[RUNG_COL.ID_KEY_HD], idRung: r[RUNG_COL.ID_RUNG], soHD: r[RUNG_COL.SO_HD],
      chuRung: r[RUNG_COL.TEN_CHU_RUNG], cccd: r[RUNG_COL.CCCD], soGiayTo: r[RUNG_COL.SO_GIAY_TO],
      dinhKem: resolveDriveLink_(r[RUNG_COL.DINH_KEM_GIAY_TO])
    };
  });
}

/** Chạy đối chiếu OCR cho MỘT lô rừng cụ thể (dùng khi bấm nút "Đối chiếu" ở từng dòng trong webapp) */
function doiChieuMotLoRungTheoId(idRung) {
  const rungRows = readData_(SHEET_NAME.HD_RUNG);
  const row = rungRows.find(function (r) { return (r[RUNG_COL.ID_RUNG] || '').toString().trim() === idRung.toString().trim(); });
  if (!row) return { loi: 'Không tìm thấy lô rừng: ' + idRung };
  return doiChieuMotLoRung_(row);
}

/**
 * Thiết lập trigger tự động chạy đối chiếu OCR + kiểm tra hồ sơ + kiểm tra ảnh
 * vào 6h sáng thứ Hai hàng tuần. Chạy hàm này 1 lần để đăng ký.
 */
function THIET_LAP_TRIGGER_DINH_KY() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (['DOI_CHIEU_HO_SO_DINH_KY', 'KIEM_TRA_HO_SO_TOAN_BO', 'KIEM_TRA_ANH_TOAN_BO'].indexOf(t.getHandlerFunction()) !== -1) {
      ScriptApp.deleteTrigger(t);
    }
  });
  ScriptApp.newTrigger('KIEM_TRA_HO_SO_TOAN_BO').timeBased().onWeekDay(ScriptApp.WeekDay.MONDAY).atHour(6).create();
  ScriptApp.newTrigger('KIEM_TRA_ANH_TOAN_BO').timeBased().onWeekDay(ScriptApp.WeekDay.MONDAY).atHour(6).create();
  ScriptApp.newTrigger('DOI_CHIEU_HO_SO_DINH_KY').timeBased().onWeekDay(ScriptApp.WeekDay.MONDAY).atHour(6).create();
  return 'Đã thiết lập 3 trigger chạy tự động vào 6h sáng thứ Hai hàng tuần.';
}

/**
 * Thiết lập lịch kiểm tra TÙY CHỌN tần suất (hàng ngày hoặc hàng tuần) + giờ chạy,
 * dùng cho menu "⏰ Lên lịch kiểm tra" trên webapp. Xóa hết trigger cũ của hệ thống
 * trước khi tạo lại, tránh chạy trùng nhiều lần.
 */
function THIET_LAP_TRIGGER_TUY_CHINH(tanSuat, gio, danhSachViec) {
  gio = Number(gio) || 6;
  HUY_TAT_CA_TRIGGER();

  const cacHam = (danhSachViec && danhSachViec.length) ? danhSachViec : ['KIEM_TRA_HO_SO_TOAN_BO', 'KIEM_TRA_ANH_TOAN_BO', 'DOI_CHIEU_HO_SO_DINH_KY'];
  cacHam.forEach(function (ten) {
    let b = ScriptApp.newTrigger(ten).timeBased();
    b = (tanSuat === 'ngay') ? b.everyDays(1) : b.onWeekDay(ScriptApp.WeekDay.MONDAY);
    b.atHour(gio).create();
  });

  return 'Đã thiết lập chạy tự động (' + cacHam.length + ' việc) ' + (tanSuat === 'ngay' ? 'HÀNG NGÀY' : 'HÀNG TUẦN (thứ Hai)') + ' lúc ' + gio + 'h sáng.';
}

/** Hủy toàn bộ trigger tự động của hệ thống (kiểm tra hồ sơ/ảnh/OCR) */
function HUY_TAT_CA_TRIGGER() {
  let soDaXoa = 0;
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (['DOI_CHIEU_HO_SO_DINH_KY', 'KIEM_TRA_HO_SO_TOAN_BO', 'KIEM_TRA_ANH_TOAN_BO'].indexOf(t.getHandlerFunction()) !== -1) {
      ScriptApp.deleteTrigger(t);
      soDaXoa++;
    }
  });
  return { thanhCong: true, soDaXoa: soDaXoa };
}

/** Xem danh sách trigger hiện có của hệ thống (để hiển thị trạng thái lịch đang chạy) */
function layDanhSachTrigger() {
  const tenViet = { KIEM_TRA_HO_SO_TOAN_BO: 'Kiểm tra hồ sơ', KIEM_TRA_ANH_TOAN_BO: 'Kiểm tra ảnh', DOI_CHIEU_HO_SO_DINH_KY: 'Đối chiếu OCR' };
  return ScriptApp.getProjectTriggers()
    .filter(function (t) { return tenViet.hasOwnProperty(t.getHandlerFunction()); })
    .map(function (t) {
      return { ten: tenViet[t.getHandlerFunction()], tanSuat: t.getTriggerSource() === ScriptApp.TriggerSource.CLOCK ? 'Định kỳ' : 'Khác' };
    });
}
