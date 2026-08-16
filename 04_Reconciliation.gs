/**
 * ============================================================
 *  04_Reconciliation.gs
 *  ĐỐI CHIẾU ĐỊNH KỲ: OCR file PDF/ảnh minh chứng (CCCD, GCN QSDĐ,
 *  giấy xác nhận, giấy ủy quyền) rồi so khớp số CCCD / số giấy tờ
 *  trích xuất được với dữ liệu đã nhập trong HD_NCC / HD_RUNG.
 *
 *  ⚠️ OCR DÙNG GEMINI (không còn dùng Drive Advanced Service như trước — cách
 *  cũ hay lỗi vì Google đã hạn chế Drive.Files.insert(ocr:true) cho phần lớn
 *  tài khoản). YÊU CẦU: đã cấu hình API key Gemini ở trang Thiết lập →
 *  🤖 Chatbot (dùng CHUNG cấu hình đó, không cần nhập lại API key riêng).
 * ============================================================
 */

/**
 * OCR 1 file (ảnh hoặc PDF) bằng GEMINI (dùng chung API key/model đã cấu hình
 * ở trang Thiết lập → 🤖 Chatbot — KHÔNG cần bật Advanced Drive Service nữa).
 * ⚠️ ĐÃ THAY: cách cũ dùng Drive.Files.insert(ocr:true) bị Google hạn chế cho
 * phần lớn tài khoản (đặc biệt Gmail cá nhân), thường xuyên báo lỗi. Gemini
 * đọc ảnh/PDF trực tiếp, ổn định hơn nhiều và không cần bật thêm dịch vụ nào.
 */
function ocrFile_(fileId) {
  const p = PropertiesService.getScriptProperties();
  const apiKey = p.getProperty('GEMINI_API_KEY');
  if (!apiKey) throw new Error('Chưa cấu hình API key Gemini. Vào trang Thiết lập → mục "🤖 Chatbot" để nhập (OCR giờ dùng chung API key này).');
  let model = p.getProperty('GEMINI_MODEL') || 'gemini-3.5-flash-lite';
  const MODEL_DU_PHONG_OCR_ = ['gemini-3.6-flash', 'gemini-3.5-flash'];
  if (['gemini-3.7-flash', 'gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-1.5-pro'].indexOf(model) !== -1) model = 'gemini-3.5-flash-lite';

  const blob = DriveApp.getFileById(fileId).getBlob();
  const mimeGoc = blob.getContentType();
  // Nếu file GỐC đã bị Google Drive tự động chuyển thành Google Doc/Sheet, đọc
  // thẳng nội dung văn bản có sẵn (đã là text, không cần OCR gì cả)
  if (mimeGoc === MimeType.GOOGLE_DOCS) return DocumentApp.openById(fileId).getBody().getText();
  if (mimeGoc === MimeType.GOOGLE_SHEETS) return SpreadsheetApp.openById(fileId).getDataRange().getValues().map(function (r) { return r.join(' '); }).join('\n');

  const base64 = Utilities.base64Encode(blob.getBytes());
  const promptOCR = 'Đọc và trích xuất TOÀN BỘ chữ/số trong ảnh hoặc file PDF này, giữ nguyên định dạng xuống dòng như trong ảnh, không tóm tắt, không diễn giải thêm — chỉ trả về đúng nguyên văn chữ đọc được.';
  const payload = { contents: [{ parts: [{ text: promptOCR }, { inline_data: { mime_type: mimeGoc, data: base64 } }] }] };
  const options = { method: 'post', contentType: 'application/json', payload: JSON.stringify(payload), muteHttpExceptions: true };

  function goiGemini_(tenModel) {
    const url = 'https://generativelanguage.googleapis.com/v1beta/models/' + tenModel + ':generateContent?key=' + apiKey;
    return JSON.parse(UrlFetchApp.fetch(url, options).getContentText());
  }

  let json = goiGemini_(model);
  for (let i = 0; json.error && /high demand|overloaded|503|try again later/i.test(json.error.message || '') && i < MODEL_DU_PHONG_OCR_.length; i++) {
    if (MODEL_DU_PHONG_OCR_[i] === model) continue;
    model = MODEL_DU_PHONG_OCR_[i];
    json = goiGemini_(model);
  }
  if (json.error) throw new Error('Lỗi Gemini OCR: ' + json.error.message);
  const text = json.candidates && json.candidates[0] && json.candidates[0].content && json.candidates[0].content.parts && json.candidates[0].content.parts[0] && json.candidates[0].content.parts[0].text;
  return text || '';
}

/**
 * ============================================================
 *  ĐỌC BẢN SCAN ĐỂ TỰ ĐỘNG ĐIỀN FORM
 * ============================================================
 * Nhận ảnh/PDF scan (CCCD, hồ sơ nguồn gốc đất, giấy ủy quyền), gửi thẳng cho
 * GEMINI trích xuất trực tiếp ra từng trường dữ liệu — KHÔNG còn dùng regex
 * dò chữ như trước (quá cứng, dễ đọc sai/thiếu khi giấy tờ có nhãn song ngữ
 * hoặc bố cục khác mẫu). Người dùng chọn TRƯỚC loại tài liệu cần lấy để Gemini
 * biết đúng trường cần tìm — NHƯNG 1 file scan có thể gồm NHIỀU giấy tờ gộp
 * chung (vd 1 ảnh chụp cả CCCD lẫn giấy ủy quyền), Gemini vẫn tự lọc đúng
 * phần cần trong file, bỏ qua phần không liên quan.
 *
 * LƯU Ý QUAN TRỌNG: đây là trích xuất tự động, KHÔNG chính xác 100% với mọi
 * loại giấy tờ/mọi chất lượng ảnh scan. Người dùng LUÔN cần xem lại và sửa
 * tay các trường trích xuất sai trước khi lưu — form sẽ hiện rõ từng trường
 * đọc được để xác nhận, không tự động lưu thẳng vào hồ sơ.
 *
 * loaiTaiLieu: 'cccd_chu_rung' | 'cccd_uy_quyen' | 'ho_so_rung' | 'giay_uy_quyen'
 * Trả về { thanhCong, truong: {...}, urlFileGoc, tenFileGoc, loi }
 */
function OCR_TU_BAN_SCAN(loaiTaiLieu, base64Data, mimeType, tenFileGoc) {
  if (!base64Data) return { thanhCong: false, loi: 'Không có dữ liệu file' };
  const p = PropertiesService.getScriptProperties();
  const apiKey = p.getProperty('GEMINI_API_KEY');
  if (!apiKey) return { thanhCong: false, loi: 'Chưa cấu hình API key Gemini. Vào trang Thiết lập → mục "🤖 Chatbot" để nhập.' };
  let model = p.getProperty('GEMINI_MODEL') || 'gemini-3.5-flash-lite';
  const MODEL_DU_PHONG_SCAN_ = ['gemini-3.6-flash', 'gemini-3.5-flash'];
  if (['gemini-3.7-flash', 'gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-1.5-pro'].indexOf(model) !== -1) model = 'gemini-3.5-flash-lite';

  let file = null;
  try {
    const bytes = Utilities.base64Decode(base64Data);
    const ten = tenFileGoc || ('scan_' + new Date().getTime());
    const blob = Utilities.newBlob(bytes, mimeType || 'image/jpeg', ten);
    const folder = layHoacTaoThuMucHoSo_();
    file = folder.createFile(blob);

    const prompt = xayPromptTrichXuatScan_(loaiTaiLieu);
    const payload = { contents: [{ parts: [{ text: prompt }, { inline_data: { mime_type: mimeType || 'image/jpeg', data: base64Data } }] }] };
    const options = { method: 'post', contentType: 'application/json', payload: JSON.stringify(payload), muteHttpExceptions: true };
    function goiGemini_(tenModel) {
      const url = 'https://generativelanguage.googleapis.com/v1beta/models/' + tenModel + ':generateContent?key=' + apiKey;
      return JSON.parse(UrlFetchApp.fetch(url, options).getContentText());
    }
    let json = goiGemini_(model);
    for (let i = 0; json.error && /high demand|overloaded|503|try again later/i.test(json.error.message || '') && i < MODEL_DU_PHONG_SCAN_.length; i++) {
      if (MODEL_DU_PHONG_SCAN_[i] === model) continue;
      model = MODEL_DU_PHONG_SCAN_[i];
      json = goiGemini_(model);
    }
    if (json.error) throw new Error('Lỗi Gemini: ' + json.error.message);
    const text = json.candidates && json.candidates[0] && json.candidates[0].content && json.candidates[0].content.parts && json.candidates[0].content.parts[0] && json.candidates[0].content.parts[0].text;
    if (!text) throw new Error('Gemini không đọc được nội dung file này (có thể do bộ lọc an toàn hoặc ảnh không rõ).');
    const khop = text.match(/\{[\s\S]*\}/); // lấy đúng khối {...} kể cả khi Gemini lỡ bọc thêm ```json...``` hoặc giải thích thừa
    if (!khop) throw new Error('Gemini không trả về đúng định dạng — thử lại hoặc chụp ảnh rõ hơn.');
    let truong;
    try { truong = JSON.parse(khop[0]); } catch (e) { throw new Error('Không đọc được kết quả Gemini trả về.'); }
    // Bỏ các trường Gemini trả về là chuỗi rỗng/"không có"/"không đọc được" — để dienNeuTrongScan_ ở webapp không điền rác vào ô
    Object.keys(truong).forEach(function (k) {
      const v = (truong[k] || '').toString().trim().toLowerCase();
      if (!v || v === 'không có' || v === 'không đọc được' || v === 'n/a' || v === 'không rõ') delete truong[k];
    });

    return { thanhCong: true, truong: truong, urlFileGoc: file.getUrl(), tenFileGoc: file.getName() };
  } catch (e) {
    if (file) { try { file.setTrashed(true); } catch (e2) {} }
    return { thanhCong: false, loi: 'Lỗi đọc bản scan: ' + e.message };
  }
}

/** Soạn prompt đúng bộ trường cần trích xuất theo từng loại tài liệu — luôn
 *  nhắc rõ file có thể gồm NHIỀU giấy tờ gộp chung, chỉ lấy đúng phần cần. */
function xayPromptTrichXuatScan_(loaiTaiLieu) {
  const chung =
    'Bạn đọc ảnh/PDF scan giấy tờ tiếng Việt cho hệ thống quản lý hợp đồng thu mua gỗ keo. ' +
    'LƯU Ý: file này CÓ THỂ chứa NHIỀU giấy tờ gộp chung trong 1 ảnh/nhiều trang (vd vừa có CCCD vừa có giấy ủy quyền) — ' +
    'CHỈ lấy đúng phần dữ liệu được yêu cầu bên dưới, bỏ qua các giấy tờ khác không liên quan trong cùng file. ' +
    'CHỈ trả về đúng 1 khối JSON, không kèm chữ giải thích, không bọc ```json. Trường nào không tìm thấy thì để chuỗi rỗng "".\n\n';

  if (loaiTaiLieu === 'cccd_chu_rung') {
    return chung + 'Tìm THẺ CĂN CƯỚC CÔNG DÂN của CHỦ RỪNG (người bán/chủ sở hữu chính, không phải người được ủy quyền) trong file, trả về JSON:\n' +
      '{"tenChuRung": "họ tên đầy đủ, chữ hoa như trên thẻ", "cccdChuRung": "đúng 12 số CCCD", "diaChiThuongTru": "nơi thường trú đầy đủ", "ngayCap": "yyyy-mm-dd", "noiCap": "nơi cấp"}';
  }
  if (loaiTaiLieu === 'cccd_uy_quyen') {
    return chung + 'Tìm THẺ CĂN CƯỚC CÔNG DÂN của NGƯỜI ĐƯỢC ỦY QUYỀN (không phải chủ rừng) trong file, trả về JSON:\n' +
      '{"tenUyQuyen": "họ tên đầy đủ, chữ hoa như trên thẻ", "cccdUyQuyen": "đúng 12 số CCCD", "diaChiUyQuyen": "nơi thường trú đầy đủ", "ngayCapUyQuyen": "yyyy-mm-dd", "noiCapUyQuyen": "nơi cấp"}';
  }
  if (loaiTaiLieu === 'giay_uy_quyen') {
    return chung + 'Tìm GIẤY ỦY QUYỀN trong file (văn bản chủ rừng ủy quyền cho người khác nhận tiền/thay mặt giao dịch), trả về JSON:\n' +
      '{"tenUyQuyen": "tên người ĐƯỢC ủy quyền (người nhận ủy quyền, không phải người ủy quyền)", "cccdUyQuyen": "CCCD người được ủy quyền nếu có ghi trong giấy", "diaChiUyQuyen": "địa chỉ người được ủy quyền nếu có ghi"}';
  }
  // 'ho_so_rung' — GCN QSDĐ / Hợp đồng mua bán / Giấy xác nhận / Đơn xác nhận
  return chung + 'Tìm giấy tờ chứng minh nguồn gốc đất/rừng (Giấy chứng nhận QSDĐ, Hợp đồng mua bán, Giấy xác nhận, hoặc Đơn xác nhận của UBND xã/phường) trong file, trả về JSON:\n' +
    '{"hoSoNguonGoc": "ĐÚNG 1 trong 4 giá trị: Giấy chứng nhận QSDĐ | Hợp đồng mua bán | Giấy xác nhận | Đơn xác nhận của UBNN Xã/Phường — chọn đúng loại theo tiêu đề văn bản đọc được", ' +
    '"soGiayTo": "số hiệu/số văn bản ghi trên giấy tờ", "dienTichM2": "diện tích, quy đổi ra m² dạng số nguyên không có dấu phẩy/chấm (nếu ghi bằng ha thì nhân 10000), để trống nếu không tìm thấy diện tích"}';
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
/**
 * Đối chiếu 1 lô rừng: đọc file DinhKemGiayTo bằng Gemini (trích xuất trực
 * tiếp ra JSON — đồng bộ cách làm với OCR_TU_BAN_SCAN, không còn dò text thô
 * bằng .indexOf() như trước), rồi so khớp ĐỦ 5 trường với dữ liệu đã nhập
 * trong Sheet: CCCD chủ rừng, Tên chủ rừng, Số giấy tờ, Loại hồ sơ, Diện tích.
 */
function doiChieuMotLoRung_(row) {
  const ketQua = {
    idKeyHD: row[RUNG_COL.ID_KEY_HD], maRung: row[RUNG_COL.MA_RUNG],
    khopCCCD: null, khopTenChuRung: null, khopSoGiayTo: null, khopLoaiHoSo: null, khopDienTich: null,
    loi: null
  };
  const duongDan = (row[RUNG_COL.DINH_KEM_GIAY_TO] || '').toString().trim();
  if (!duongDan) { ketQua.loi = 'Không có file đính kèm để đối chiếu'; return ketQua; }

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
    const truong = trichXuatDoiChieuBangGemini_(fileId);
    if (!truong) { ketQua.loi = 'Gemini không đọc được nội dung file (ảnh mờ, chưa cấu hình API key, hoặc lỗi tạm thời).'; return ketQua; }

    const cccdSheet = (row[RUNG_COL.CCCD] || '').toString().trim();
    ketQua.khopCCCD = cccdSheet ? (truong.cccd && truong.cccd.indexOf(cccdSheet) !== -1) : null;

    const tenSheet = (row[RUNG_COL.TEN_CHU_RUNG] || '').toString().trim().toLowerCase();
    ketQua.khopTenChuRung = tenSheet && truong.tenChuRung ? soSanhTenKhongDauOCR_(truong.tenChuRung, tenSheet) : null;

    const soGiayToSheet = (row[RUNG_COL.SO_GIAY_TO] || '').toString().trim();
    ketQua.khopSoGiayTo = soGiayToSheet ? (truong.soGiayTo && truong.soGiayTo.indexOf(soGiayToSheet) !== -1) : null;

    const loaiHoSoSheet = (row[RUNG_COL.HO_SO_NGUON_GOC] || '').toString().trim();
    ketQua.khopLoaiHoSo = loaiHoSoSheet ? (truong.hoSoNguonGoc === loaiHoSoSheet) : null;

    const dienTichSheet = Number(row[RUNG_COL.DIEN_TICH_M2]) || 0;
    const dienTichOCR = Number(truong.dienTichM2) || 0;
    // Cho phép lệch 5% (đo đạc/làm tròn khác nhau giữa giấy tờ và Sheet là bình thường, không coi là sai lệch)
    ketQua.khopDienTich = (dienTichSheet && dienTichOCR) ? (Math.abs(dienTichOCR - dienTichSheet) / dienTichSheet <= 0.05) : null;
    ketQua.dienTichOCR = dienTichOCR || null;
  } catch (e) {
    ketQua.loi = 'Lỗi đọc/đối chiếu: ' + e.message;
  }
  return ketQua;
}

/** Trích xuất bằng Gemini phục vụ ĐỐI CHIẾU (khác OCR_TU_BAN_SCAN ở chỗ lấy ĐỦ
 *  5 trường trong 1 lượt gọi, không tách theo loaiTaiLieu — file hồ sơ pháp lý
 *  luôn chỉ có 1 loại giấy tờ, không cần lọc nhiều giấy tờ gộp chung như CCCD). */
function trichXuatDoiChieuBangGemini_(fileId) {
  const p = PropertiesService.getScriptProperties();
  const apiKey = p.getProperty('GEMINI_API_KEY');
  if (!apiKey) return null;
  let model = p.getProperty('GEMINI_MODEL') || 'gemini-3.5-flash-lite';
  const MODEL_DU_PHONG_DC_ = ['gemini-3.6-flash', 'gemini-3.5-flash'];
  if (['gemini-3.7-flash', 'gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-1.5-pro'].indexOf(model) !== -1) model = 'gemini-3.5-flash-lite';

  const blob = DriveApp.getFileById(fileId).getBlob();
  const base64 = Utilities.base64Encode(blob.getBytes());
  const prompt =
    'Đọc giấy tờ chứng minh nguồn gốc đất/rừng trong file này (Giấy chứng nhận QSDĐ, Hợp đồng mua bán, Giấy xác nhận, hoặc Đơn xác nhận UBND). ' +
    'CHỈ trả về đúng 1 khối JSON, không kèm chữ giải thích, không bọc ```json:\n' +
    '{"cccd": "toàn bộ số CCCD 12 số xuất hiện trong văn bản, cách nhau dấu phẩy nếu có nhiều số", ' +
    '"tenChuRung": "tên chủ đất/bên bán/bên được cấp giấy, chữ hoa", ' +
    '"soGiayTo": "số hiệu/số văn bản ghi trên giấy tờ", ' +
    '"hoSoNguonGoc": "ĐÚNG 1 trong 4 giá trị: Giấy chứng nhận QSDĐ | Hợp đồng mua bán | Giấy xác nhận | Đơn xác nhận của UBNN Xã/Phường", ' +
    '"dienTichM2": "diện tích quy đổi ra m² dạng số nguyên không dấu phẩy/chấm (ha thì nhân 10000), để trống nếu không có"}. ' +
    'Trường nào không tìm thấy để chuỗi rỗng "".';
  const payload = { contents: [{ parts: [{ text: prompt }, { inline_data: { mime_type: blob.getContentType(), data: base64 } }] }] };
  const options = { method: 'post', contentType: 'application/json', payload: JSON.stringify(payload), muteHttpExceptions: true };
  function goiGemini_(tenModel) {
    const url = 'https://generativelanguage.googleapis.com/v1beta/models/' + tenModel + ':generateContent?key=' + apiKey;
    return JSON.parse(UrlFetchApp.fetch(url, options).getContentText());
  }
  let json = goiGemini_(model);
  for (let i = 0; json.error && /high demand|overloaded|503|try again later/i.test(json.error.message || '') && i < MODEL_DU_PHONG_DC_.length; i++) {
    if (MODEL_DU_PHONG_DC_[i] === model) continue;
    model = MODEL_DU_PHONG_DC_[i];
    json = goiGemini_(model);
  }
  if (json.error) return null;
  const text = json.candidates && json.candidates[0] && json.candidates[0].content && json.candidates[0].content.parts && json.candidates[0].content.parts[0] && json.candidates[0].content.parts[0].text;
  if (!text) return null;
  const khop = text.match(/\{[\s\S]*\}/);
  if (!khop) return null;
  try { return JSON.parse(khop[0]); } catch (e) { return null; }
}

/** So sánh 2 tên (bỏ dấu, không phân biệt hoa/thường) — dùng chung logic bỏ dấu đã có ở 29_Chatbot.gs */
function soSanhTenKhongDauOCR_(ten1, ten2) {
  const boDau = function (s) { return s.toString().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase().trim(); };
  return boDau(ten1) === boDau(ten2);
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

  const header = ['ID_KEY_HD', 'Mã Rừng', 'CCCD khớp OCR?', 'Tên chủ rừng khớp OCR?', 'Số giấy tờ khớp OCR?', 'Loại hồ sơ khớp OCR?', 'Diện tích khớp OCR? (±5%)', 'Diện tích đọc từ OCR (m²)', 'Ghi chú lỗi'];
  sh.getRange(1, 1, 1, header.length).setValues([header]).setFontWeight('bold').setBackground('#34495e').setFontColor('#ffffff');
  const kyHieu = function (v) { return v === null ? 'N/A' : (v ? '✅' : '❌'); };
  const rows = baoCao.map(function (b) {
    return [b.idKeyHD, b.maRung, kyHieu(b.khopCCCD), kyHieu(b.khopTenChuRung), kyHieu(b.khopSoGiayTo), kyHieu(b.khopLoaiHoSo), kyHieu(b.khopDienTich), b.dienTichOCR || '', b.loi || ''];
  });
  if (rows.length) sh.getRange(2, 1, rows.length, header.length).setValues(rows);
  sh.autoResizeColumns(1, header.length);

  const soLech = baoCao.filter(function (b) { return b.khopCCCD === false || b.khopTenChuRung === false || b.khopSoGiayTo === false || b.khopLoaiHoSo === false || b.khopDienTich === false; }).length;
  return 'Đã đối chiếu ' + baoCao.length + ' lô rừng' + (dungSom ? ' (dừng sớm do giới hạn thời gian, chạy lại để tiếp tục)' : '') +
    ' — ' + soLech + ' hồ sơ CÓ SAI LỆCH (ở ít nhất 1 trong 5 trường) giữa Sheet và file gốc. Xem sheet "' + sheetName + '"';
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
