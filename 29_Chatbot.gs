/**
 * ============================================================
 *  29_Chatbot.gs
 *  CHATBOT TRA CỨU DỮ LIỆU THẬT — dùng Google Gemini API để hiểu câu hỏi tự
 *  nhiên, nhưng KHÔNG để AI tự bịa số liệu: luôn tự dò trong câu hỏi xem có
 *  nhắc tên/CCCD/số hợp đồng nào khớp dữ liệu thật hay không, LẤY ĐÚNG dữ
 *  liệu đó (qua các hàm đã có sẵn — không viết logic đọc Sheet mới), rồi mới
 *  đưa cho Gemini diễn giải thành câu trả lời tự nhiên DỰA TRÊN đúng dữ liệu
 *  đã lấy — không có dữ liệu thì Gemini phải nói rõ "không tìm thấy", không
 *  được đoán.
 *
 *  YÊU CẦU: nhập API key Gemini ở trang Thiết lập trước khi dùng.
 * ============================================================
 */

// ⚠️ ĐÃ SỬA (nguyên nhân chính gây "hay lỗi"): 'gemini-3.7-flash' dùng trước
// đây KHÔNG có trong danh sách model chính thức của Google — mọi lượt gọi coi
// như luôn nhắm vào 1 model không ổn định/không tồn tại đúng nghĩa. Model thật
// hiện hành (theo tài liệu Google, cập nhật 14/8/2026): Gemini 3.6 Flash,
// Gemini 3.5 Flash, Gemini 3.5 Flash-Lite. Chọn Flash-Lite làm mặc định vì
// đây là hạng nhẹ/rẻ dành riêng cho khối lượng truy vấn cao — ít bị "quá tải"
// hơn các model cao cấp (Pro/frontier) vốn bị dồn tải nhiều hơn.
const GEMINI_MODEL_MAC_DINH_ = 'gemini-3.5-flash-lite';
// ⚠️ MỚI: danh sách model DỰ PHÒNG — nếu model chính bị "quá tải" (high demand),
// thử NGAY các model này (không cần Utilities.sleep, độc lập tải với nhau) trước
// khi mới chịu chuyển sang trả lời bằng luật cứng.
const MODEL_DU_PHONG_ = ['gemini-3.6-flash', 'gemini-3.5-flash'];
// Danh sách model CŨ đã biết bị Google ngừng cấp — nếu Script Property đang lưu 1
// trong các tên này (từ lần cấu hình trước), tự động dùng model mặc định mới thay
// thế, kèm cảnh báo trong kết quả trả về, tránh phải vào Thiết lập sửa tay ngay lập tức.
const MODEL_DA_NGUNG_HO_TRO_ = ['gemini-3.7-flash', 'gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-1.5-pro'];

/** Đọc cấu hình chatbot (API key ẩn 1 phần khi trả về webapp, không lộ toàn bộ) */
function LAY_CAI_DAT_CHATBOT() {
  const p = PropertiesService.getScriptProperties();
  const apiKey = p.getProperty('GEMINI_API_KEY') || '';
  return {
    daCoApiKey: !!apiKey,
    apiKeyRutGon: apiKey ? (apiKey.slice(0, 6) + '••••••••' + apiKey.slice(-4)) : '',
    model: p.getProperty('GEMINI_MODEL') || GEMINI_MODEL_MAC_DINH_
  };
}

/** Lưu API key + model Gemini (Script Properties — không lưu trong code, không ai xem được qua giao diện) */
function LUU_CAI_DAT_CHATBOT(apiKey, model) {
  const p = PropertiesService.getScriptProperties();
  if (apiKey) p.setProperty('GEMINI_API_KEY', apiKey.toString().trim());
  p.setProperty('GEMINI_MODEL', (model || GEMINI_MODEL_MAC_DINH_).toString().trim());
  return { thanhCong: true, thongBao: 'Đã lưu cấu hình chatbot.' };
}

/** ============ HÀM CHÍNH: TRẢ LỜI 1 CÂU HỎI ============ */
function TRA_LOI_CHATBOT(cauHoi, cccdGoiYTuLuotTruoc, lichSuHoiThoai, anh) {
  // ⚠️ MỚI: có ảnh đính kèm (anh = { base64, mimeType }) — đọc ảnh/OCR BẮT BUỘC
  // phải qua Gemini (không có luật cứng nào đọc được nội dung ảnh), nên tách
  // riêng luồng: không cần API key thì báo rõ luôn, không cố tra dữ liệu nữa.
  if (anh && anh.base64) {
    const p0 = PropertiesService.getScriptProperties();
    const apiKey0 = p0.getProperty('GEMINI_API_KEY');
    if (!apiKey0) return { thanhCong: false, loi: 'Đọc ảnh/OCR cần có API key Gemini. Vào trang Thiết lập → mục "🤖 Chatbot" để nhập.' };
    return traLoiCoAnh_(cauHoi, anh, apiKey0, p0);
  }

  let nguCanh;
  try {
    nguCanh = timNguCanhChatbot_(cauHoi, cccdGoiYTuLuotTruoc);
  } catch (e) {
    return { thanhCong: false, loi: 'Lỗi khi tra cứu dữ liệu: ' + e.message };
  }
  const cccdDaKhop = nguCanh._cccdDaKhop || [];

  const p = PropertiesService.getScriptProperties();
  const apiKey = p.getProperty('GEMINI_API_KEY');

  // ⚠️ KHÔNG CÓ API KEY -> vẫn trả lời được bình thường, chỉ là câu trả lời
  // soạn theo luật cứng (đọc thẳng dữ liệu đã tra ra) thay vì Gemini diễn giải
  // tự nhiên hơn. Việc TRA DỮ LIỆU (phần quan trọng nhất, đảm bảo không bịa số
  // liệu) không phụ thuộc API — luôn chạy được.
  if (!apiKey) {
    return { thanhCong: true, traLoi: soanCauTraLoiTheoLuat_(cauHoi, nguCanh), nguCanhDaDung: nguCanh._tomTat, khongDungAI: true, cccdDaKhop: cccdDaKhop };
  }

  let model = p.getProperty('GEMINI_MODEL') || GEMINI_MODEL_MAC_DINH_;
  let daTuDoiModel = false;
  if (MODEL_DA_NGUNG_HO_TRO_.indexOf(model) !== -1) { model = GEMINI_MODEL_MAC_DINH_; daTuDoiModel = true; }

  // ⚠️ MỚI: đưa vài lượt hỏi-đáp GẦN NHẤT vào prompt để Gemini hiểu được câu hỏi
  // nối tiếp kiểu "vậy còn thanh toán thì sao?" (không nhắc lại tên khách hàng) —
  // trước đây mỗi câu hỏi hoàn toàn độc lập, không nhớ gì cả.
  const phanLichSu = (lichSuHoiThoai && lichSuHoiThoai.length)
    ? '\n\nLỊCH SỬ HỎI-ĐÁP GẦN ĐÂY (để hiểu câu hỏi nối tiếp, KHÔNG dùng số liệu trong này để trả lời — số liệu phải lấy từ JSON dữ liệu THẬT ở trên):\n' +
      lichSuHoiThoai.slice(-4).map(function (m) { return (m.vaiTro === 'nguoi' ? 'Người dùng: ' : 'Trợ lý: ') + m.noiDung; }).join('\n')
    : '';

  const promptHeThong =
    'Bạn là trợ lý tra cứu dữ liệu cho hệ thống quản lý hợp đồng thu mua gỗ keo (HAK GROUP). ' +
    'Dưới đây là dữ liệu THẬT đã tra được từ hệ thống (định dạng JSON), liên quan tới câu hỏi của người dùng:\n\n' +
    JSON.stringify(nguCanh, null, 1) +
    phanLichSu +
    '\n\nQUY TẮC BẮT BUỘC:\n' +
    '1. CHỈ trả lời dựa vào ĐÚNG dữ liệu JSON ở trên — không được đoán, không được bịa số liệu.\n' +
    '2. Nếu dữ liệu JSON rỗng hoặc không đủ để trả lời, nói rõ "Không tìm thấy dữ liệu phù hợp trong hệ thống" — không tự suy diễn.\n' +
    '3. Trả lời ngắn gọn, tiếng Việt, số tiền/số lượng viết có dấu phân cách hàng nghìn (vd 1.500.000).\n' +
    '4. Nếu JSON có nhiều khách hàng/hợp đồng khớp, liệt kê rõ ràng từng cái, đừng gộp chung.\n' +
    '5. Nếu câu hỏi hiện tại là câu hỏi NỐI TIẾP (không nhắc lại tên khách hàng/hợp đồng), dùng LỊCH SỬ HỎI-ĐÁP để hiểu đang hỏi về ai/hợp đồng nào, nhưng vẫn CHỈ lấy số liệu từ JSON dữ liệu THẬT — không lấy số liệu từ lịch sử.\n' +
    '6. RIÊNG khi trả lời câu hỏi có "diaDiemTheoToaDo" (tra theo tọa độ): sau khi trả lời đủ dữ liệu THẬT ở trên (lô rừng/chủ rừng/rừng bên cạnh...), CÓ THỂ bổ sung thêm 1 đoạn NGẮN mô tả kiến thức ĐỊA LÝ CHUNG bạn biết về khu vực đó (địa hình, khí hậu, đặc điểm vùng...) — nhưng BẮT BUỘC phải mở đầu đoạn đó bằng "ℹ️ Thông tin tham khảo chung (không phải dữ liệu đã kiểm chứng của hệ thống):" để người đọc phân biệt rõ ràng, không nhầm là dữ liệu thật đã đo đạc. Nếu không chắc/không biết gì về khu vực đó thì bỏ qua, không suy đoán liều.\n';

  const payload = { contents: [{ parts: [{ text: promptHeThong + '\n\nCÂU HỎI CỦA NGƯỜI DÙNG: ' + cauHoi }] }] };
  const options = { method: 'post', contentType: 'application/json', payload: JSON.stringify(payload), muteHttpExceptions: true };

  function goiGemini_(tenModel) {
    const url = 'https://generativelanguage.googleapis.com/v1beta/models/' + tenModel + ':generateContent?key=' + apiKey;
    const resp = UrlFetchApp.fetch(url, options);
    return JSON.parse(resp.getContentText());
  }

  let json;
  try {
    json = goiGemini_(model);
    // ⚠️ PHÒNG VỆ: nếu Google báo model đã ngừng hỗ trợ NHƯNG model đó chưa kịp
    // có trong danh sách MODEL_DA_NGUNG_HO_TRO_ (vd Google vừa ngừng thêm 1
    // model mới mà code chưa cập nhật) — tự thử lại 1 LẦN với model mặc định,
    // không bắt người dùng phải tự vào Thiết lập sửa ngay lập tức.
    if (json.error && /no longer available|deprecated|not found/i.test(json.error.message || '') && model !== GEMINI_MODEL_MAC_DINH_) {
      model = GEMINI_MODEL_MAC_DINH_; daTuDoiModel = true;
      json = goiGemini_(model);
    }
    // ⚠️ MỚI: nếu vẫn lỗi "quá tải" (high demand/overloaded/503) — thử NGAY
    // (không Utilities.sleep, không chờ) các model DỰ PHÒNG khác trước khi chịu
    // chuyển sang trả lời bằng luật. "Quá tải" là vấn đề RIÊNG của từng model,
    // model khác vẫn có thể còn chỗ — đổi model gần như tức thời, không tốn
    // thời gian như chờ-rồi-thử-lại-cùng-1-model kiểu cũ.
    for (let i = 0; json.error && /high demand|overloaded|503|try again later/i.test(json.error.message || '') && i < MODEL_DU_PHONG_.length; i++) {
      if (MODEL_DU_PHONG_[i] === model) continue; // khỏi thử lại đúng model vừa lỗi
      model = MODEL_DU_PHONG_[i]; daTuDoiModel = true;
      json = goiGemini_(model);
    }
    // ⚠️ ĐÃ BỎ cơ chế thử lại có Utilities.sleep() (từng làm chậm thêm tới 4.5
    // giây/lượt khi Gemini quá tải) — giờ đã có soanCauTraLoiTheoLuat_() trả
    // lời dự phòng NGAY LẬP TỨC bên dưới, không cần chờ/thử lại Gemini nữa,
    // ưu tiên TỐC ĐỘ hơn vì dữ liệu vẫn chính xác dù không qua AI.
  } catch (e) {
    return { thanhCong: false, loi: 'Lỗi kết nối tới Gemini API: ' + e.message };
  }
  if (json.error) {
    // Không để lỗi API làm "tắc" hẳn — tự chuyển sang câu trả lời soạn theo luật (đọc thẳng dữ liệu đã tra), kèm ghi chú lý do
    return {
      thanhCong: true,
      traLoi: '⚠️ (Gemini đang lỗi: ' + json.error.message + ' — trả lời tạm bằng dữ liệu thô)\n\n' + soanCauTraLoiTheoLuat_(cauHoi, nguCanh),
      nguCanhDaDung: nguCanh._tomTat, khongDungAI: true, cccdDaKhop: cccdDaKhop
    };
  }
  const traLoi = json.candidates && json.candidates[0] && json.candidates[0].content && json.candidates[0].content.parts && json.candidates[0].content.parts[0] && json.candidates[0].content.parts[0].text;
  if (daTuDoiModel) p.setProperty('GEMINI_MODEL', model); // lưu lại luôn để lần sau không phải tự đổi nữa
  return {
    thanhCong: true,
    traLoi: (daTuDoiModel ? '⚠️ (Đã tự chuyển sang model "' + model + '" — model trước gặp sự cố/quá tải)\n\n' : '') + (traLoi || '(Gemini không trả về nội dung — có thể do bộ lọc an toàn chặn câu hỏi/dữ liệu.)'),
    nguCanhDaDung: nguCanh._tomTat, cccdDaKhop: cccdDaKhop
  };
}

/**
 * Dò trong câu hỏi xem có nhắc tới khách hàng/hợp đồng nào có thật trong hệ
 * thống hay không, rồi LẤY ĐÚNG dữ liệu đó qua các hàm đã có sẵn (không tự
 * đọc Sheet mới, tránh trùng logic + tránh sai lệch với phần còn lại của hệ thống).
 */
/**
 * Soạn câu trả lời KHÔNG CẦN AI — đọc thẳng dữ liệu đã tra ra (nguCanh), dò vài
 * mẫu câu hỏi thường gặp để trả lời đúng trọng tâm; nếu không khớp mẫu nào thì
 * liệt kê đầy đủ thông tin đã tra được (vẫn hữu ích, chỉ là không "văn vẻ" như AI).
 */
/** Gửi ảnh + câu hỏi cho Gemini đọc (OCR/mô tả nội dung ảnh) — dùng lại đúng
 *  danh sách model dự phòng như luồng hỏi thường, không cần dữ liệu hệ thống. */
function traLoiCoAnh_(cauHoi, anh, apiKey, p) {
  let model = p.getProperty('GEMINI_MODEL') || GEMINI_MODEL_MAC_DINH_;
  if (MODEL_DA_NGUNG_HO_TRO_.indexOf(model) !== -1) model = GEMINI_MODEL_MAC_DINH_;

  const promptAnh =
    'Bạn là trợ lý đọc ảnh cho hệ thống quản lý hợp đồng thu mua gỗ keo (HAK GROUP). ' +
    'Người dùng gửi kèm 1 ảnh (có thể là CCCD, giấy tờ, phiếu cân, hồ sơ đất...). ' +
    (cauHoi ? 'Yêu cầu của người dùng: ' + cauHoi : 'Hãy đọc và tóm tắt toàn bộ nội dung/chữ trong ảnh (OCR).') +
    ' Trả lời tiếng Việt, trích đúng nguyên văn số/chữ đọc được trong ảnh, không suy diễn thêm nếu chữ mờ/không đọc rõ thì nói rõ "không đọc rõ".';

  const payload = { contents: [{ parts: [{ text: promptAnh }, { inline_data: { mime_type: anh.mimeType || 'image/jpeg', data: anh.base64 } }] }] };
  const options = { method: 'post', contentType: 'application/json', payload: JSON.stringify(payload), muteHttpExceptions: true };
  function goiGemini_(tenModel) {
    const url = 'https://generativelanguage.googleapis.com/v1beta/models/' + tenModel + ':generateContent?key=' + apiKey;
    return JSON.parse(UrlFetchApp.fetch(url, options).getContentText());
  }

  let json;
  try {
    json = goiGemini_(model);
    for (let i = 0; json.error && /high demand|overloaded|503|try again later/i.test(json.error.message || '') && i < MODEL_DU_PHONG_.length; i++) {
      if (MODEL_DU_PHONG_[i] === model) continue;
      model = MODEL_DU_PHONG_[i];
      json = goiGemini_(model);
    }
  } catch (e) {
    return { thanhCong: false, loi: 'Lỗi kết nối tới Gemini API: ' + e.message };
  }
  if (json.error) return { thanhCong: false, loi: 'Lỗi Gemini API khi đọc ảnh: ' + json.error.message };
  const traLoi = json.candidates && json.candidates[0] && json.candidates[0].content && json.candidates[0].content.parts && json.candidates[0].content.parts[0] && json.candidates[0].content.parts[0].text;
  return { thanhCong: true, traLoi: traLoi || '(Gemini không đọc được nội dung ảnh này — có thể do bộ lọc an toàn hoặc ảnh không rõ.)' };
}

function soanCauTraLoiTheoLuat_(cauHoi, nguCanh) {
  const ch = cauHoi.toString().toLowerCase();
  // ⚠️ Ưu tiên trả lời theo TỌA ĐỘ trước — kể cả khi không khớp khách hàng/hợp
  // đồng nào theo tên, nếu câu hỏi có tọa độ và tìm ra được lô rừng gần đó thì
  // vẫn phải trả lời được (không rơi vào nhánh "không tìm thấy" bên dưới).
  if (nguCanh.diaDiemTheoToaDo) {
    const d = nguCanh.diaDiemTheoToaDo;
    if (d.ghiChu) return '📍 Điểm gần nhất cách ' + Math.round(d.khoangCachMet) + 'm — ' + d.ghiChu;
    var dongRungBenCanh = d.rungBenCanh.length
      ? '\n  - Rừng bên cạnh (trong 2km): ' + d.rungBenCanh.map(function (rb) { return rb.maRung + ' (' + (rb.tenChuRung || '?') + ', cách ' + rb.khoangCachMet + 'm)'; }).join('; ')
      : '\n  - Rừng bên cạnh: không có lô rừng nào khác trong bán kính 2km';
    return '📍 Tọa độ này gần nhất với lô rừng "' + d.maRung + '" (cách ' + Math.round(d.khoangCachMet) + 'm)\n' +
      '  - Địa chỉ: ' + (d.diaChiRung || '(chưa có)') + '\n' +
      '  - Diện tích: ' + (Number(d.dienTichM2) || 0).toLocaleString('vi-VN') + ' m²\n' +
      '  - Chủ rừng: ' + (d.tenChuRung || '(chưa rõ)') + (d.sdtChuRung ? ' — ĐT ' + d.sdtChuRung : '') + '\n' +
      '  - Hợp đồng: ' + (d.soHD || '(chưa rõ)') + ' — trạng thái "' + (d.tinhTrangHopDong || '') + '"\n' +
      '  - Loại hồ sơ nguồn gốc: ' + (d.hoSoNguonGoc || '(chưa nhập)') + '\n' +
      '  - Tuổi rừng: ' + (d.tuoiRungNam !== null ? d.tuoiRungNam + ' năm (trồng năm ' + d.namTrong + ')' : 'chưa nhập năm trồng, không tính được') +
      dongRungBenCanh;
  }
  if (!nguCanh.khachHangKhop.length && !nguCanh.hopDongKhopTheoSoHD.length) {
    return 'Không tìm thấy khách hàng/hợp đồng nào khớp với câu hỏi trong hệ thống.\n\nThống kê chung: ' + nguCanh.thongKeChung.tongSoHopDong + ' hợp đồng, theo trạng thái: ' + JSON.stringify(nguCanh.thongKeChung.theoTrangThai);
  }

  const dong = [];
  nguCanh.khachHangKhop.forEach(function (kh) {
    dong.push('👤 ' + kh.tenChuRung + ' (CCCD ' + kh.cccd + ') — tổng ' + kh.tongSoHopDong + ' hợp đồng:');
    kh.chiTietHopDong.forEach(function (hd) {
      // Hỏi riêng "mấy lô rừng" -> chỉ trả đúng phần đó cho gọn
      if (/mấy lô|bao nhiêu lô|số lô/.test(ch) && !/giá trị|diện tích|khối lượng|tài khoản|địa chỉ|chi tiết/.test(ch)) {
        dong.push('  • HĐ ' + hd.soHD + ': ' + hd.soLuongLoRung + ' lô rừng.');
      } else if (/tọa độ|gps|kinh độ|vĩ độ/.test(ch)) {
        dong.push('  • HĐ ' + hd.soHD + ' — tọa độ GPS từng lô:');
        hd.danhSachLoRung.forEach(function (r) {
          dong.push('      - ' + (r.maRung || '(chưa có mã)') + ': ' + (r.soDiemGPS ? r.toaDoGPS.join(' | ') : 'chưa có điểm GPS nào'));
        });
      } else if (/hình ảnh|ảnh hiện trường|ảnh minh chứng|\bảnh\b/.test(ch)) {
        dong.push('  • HĐ ' + hd.soHD + ' — ảnh hiện trường từng lô:');
        hd.danhSachLoRung.forEach(function (r) {
          dong.push('      - ' + (r.maRung || '(chưa có mã)') + ': ' + r.soLuongAnh + ' ảnh' + (r.soLuongAnh ? ' (' + r.linkAnh.join(', ') + ')' : ''));
        });
      } else if (/lô rừng|địa chỉ rừng|danh sách rừng|chi tiết rừng/.test(ch)) {
        // Hỏi chi tiết TỪNG LÔ (địa chỉ, diện tích, đơn giá riêng từng lô — không chỉ tổng)
        dong.push('  • HĐ ' + hd.soHD + ' — chi tiết ' + hd.soLuongLoRung + ' lô rừng:');
        if (!hd.danhSachLoRung.length) dong.push('      (chưa có lô rừng nào)');
        hd.danhSachLoRung.forEach(function (r) {
          dong.push('      - ' + (r.maRung || '(chưa có mã)') + ': ' + (r.diaChi || '(chưa có địa chỉ)') + ' — DT ' + (Number(r.dienTichM2) || 0).toLocaleString('vi-VN') + ' m², đơn giá ' + Math.round(Number(r.donGia) || 0).toLocaleString('vi-VN') + ' đ, KL dự kiến ' + (Number(r.khoiLuongDuKien) || 0).toLocaleString('vi-VN') + ' Tấn, ' + r.soDiemGPS + ' điểm GPS, ' + r.soLuongAnh + ' ảnh.');
        });
      } else if (/thanh toán|đã thực hiện|còn lại|tiến độ/.test(ch)) {
        var tt = hd.tinhHinhThanhToan;
        var conLaiKL = hd.tongKhoiLuongDuKienTan - tt.khoiLuongDaThucHien;
        var conLaiGT = hd.tongGiaTriHopDong - tt.giaTriDaThucHien;
        dong.push('  • HĐ ' + hd.soHD + ': đã thực hiện ' + tt.khoiLuongDaThucHien.toLocaleString('vi-VN') + ' Tấn (' + Math.round(tt.giaTriDaThucHien).toLocaleString('vi-VN') + ' đ) / dự kiến ' + hd.tongKhoiLuongDuKienTan.toLocaleString('vi-VN') + ' Tấn — còn lại ' + conLaiKL.toLocaleString('vi-VN') + ' Tấn (' + Math.round(conLaiGT).toLocaleString('vi-VN') + ' đ).' + (tt.ghiChu ? ' (' + tt.ghiChu + ')' : ''));
      } else if (/tài khoản|số tk|ngân hàng|người nhận/.test(ch)) {
        const tk = hd.soTaiKhoan.length ? hd.soTaiKhoan.map(function (t) { return t.soTK + ' (' + t.nganHang + ') — người nhận: ' + (t.tenNguoiNhanTien || '(chính chủ rừng)') + (t.uyQuyenTT === 'Có' ? ' [có ủy quyền]' : ''); }).join('; ') : '(chưa có)';
        dong.push('  • HĐ ' + hd.soHD + ': ' + tk);
        dong.push('  • HĐ ' + hd.soHD + ': tổng giá trị ' + Math.round(hd.tongGiaTriHopDong).toLocaleString('vi-VN') + ' đ.');
      } else if (/diện tích/.test(ch)) {
        dong.push('  • HĐ ' + hd.soHD + ': tổng diện tích ' + hd.tongDienTichM2.toLocaleString('vi-VN') + ' m².');
      } else if (/khối lượng/.test(ch)) {
        dong.push('  • HĐ ' + hd.soHD + ': tổng khối lượng dự kiến ' + hd.tongKhoiLuongDuKienTan.toLocaleString('vi-VN') + ' Tấn.');
      } else if (/trạng thái|tình trạng/.test(ch)) {
        dong.push('  • HĐ ' + hd.soHD + ': trạng thái "' + hd.tinhTrang + '".');
      } else {
        // Không khớp mẫu cụ thể nào -> liệt kê đầy đủ
        var soDiemGPSTong = hd.danhSachLoRung.reduce(function (s, r) { return s + r.soDiemGPS; }, 0);
        var soAnhTong = hd.danhSachLoRung.reduce(function (s, r) { return s + r.soLuongAnh; }, 0);
        var nguoiNhan = hd.soTaiKhoan.length ? hd.soTaiKhoan.map(function (t) { return t.tenNguoiNhanTien || '(chính chủ rừng)'; }).join(', ') : '(chưa có số TK)';
        dong.push('  • HĐ ' + hd.soHD + ' (' + hd.tinhTrang + ', ký ' + (hd.ngayKy ? new Date(hd.ngayKy).toLocaleDateString('vi-VN') : '?') + '): ' + hd.soLuongLoRung + ' lô rừng, tổng diện tích ' + hd.tongDienTichM2.toLocaleString('vi-VN') + ' m², tổng khối lượng dự kiến ' + hd.tongKhoiLuongDuKienTan.toLocaleString('vi-VN') + ' Tấn, tổng giá trị ' + Math.round(hd.tongGiaTriHopDong).toLocaleString('vi-VN') + ' đ. Đã thực hiện: ' + hd.tinhHinhThanhToan.khoiLuongDaThucHien.toLocaleString('vi-VN') + ' Tấn (' + Math.round(hd.tinhHinhThanhToan.giaTriDaThucHien).toLocaleString('vi-VN') + ' đ). ' + soDiemGPSTong + ' điểm GPS, ' + soAnhTong + ' ảnh. Người nhận tiền: ' + nguoiNhan + '.');
      }
    });
  });
  nguCanh.hopDongKhopTheoSoHD.forEach(function (hd) {
    dong.push('📋 HĐ ' + hd.soHD + ' — ' + hd.tenChuRung + ', trạng thái "' + hd.tinhTrang + '".');
  });
  return dong.join('\n');
}

/**
 * Dò trong câu hỏi xem có nhắc tới khách hàng/hợp đồng nào có thật trong hệ
 * thống hay không, rồi LẤY ĐÚNG dữ liệu đó qua các hàm đã có sẵn (không tự
 * đọc Sheet mới, tránh trùng logic + tránh sai lệch với phần còn lại của hệ thống).
 */
/** Bỏ dấu tiếng Việt — dùng để khớp tên kiểu mờ (gõ thiếu dấu vẫn ra kết quả) */
function boDauTiengViet_(str) {
  return str.toString().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D');
}

/** Chấm điểm mức độ khớp giữa câu hỏi và 1 tên khách hàng — 1 = khớp nguyên văn
 *  có dấu (chắc chắn nhất), 0.9 = khớp không dấu, 0.5-0.8 = khớp theo từ (đủ
 *  từ trong tên xuất hiện trong câu hỏi, không cần đúng thứ tự/đủ dấu), 0 = không khớp */
function tinhDoKhopTen_(cauHoiThuong, cauHoiKhongDau, tenKH) {
  const tenThuong = tenKH.toString().trim().toLowerCase();
  if (!tenThuong) return 0;
  if (cauHoiThuong.indexOf(tenThuong) !== -1) return 1;
  const tenKhongDau = boDauTiengViet_(tenThuong);
  if (cauHoiKhongDau.indexOf(tenKhongDau) !== -1) return 0.9;
  const tuTen = tenKhongDau.split(/\s+/).filter(function (t) { return t.length > 1; }); // bỏ từ đệm 1 ký tự (vd "a", "b" lót giữa tên) tránh khớp giả
  if (!tuTen.length) return 0;
  const soTuKhop = tuTen.filter(function (tu) { return cauHoiKhongDau.indexOf(tu) !== -1; }).length;
  const tyLe = soTuKhop / tuTen.length;
  return tyLe >= 0.6 ? tyLe * 0.8 : 0; // cần ít nhất 60% số từ trong tên xuất hiện mới tính là khớp
}

/**
 * Tìm điểm GPS đã lưu (HD_GPS) GẦN NHẤT với 1 tọa độ cho trước — dùng công
 * thức Haversine (khoảng cách thực tế trên mặt cầu Trái Đất, đơn vị mét).
 * Trả về kèm đủ thông tin lô rừng/hợp đồng/chủ rừng tại điểm đó để chatbot
 * trả lời được ngay, không cần thêm lượt tra cứu nào nữa.
 */
function timDiemGpsGanNhat_(lat, lng) {
  const gpsRows = readData_(SHEET_NAME.HD_GPS);
  if (!gpsRows.length) return null;
  const R = 6371000; // bán kính Trái Đất (mét)
  function radian_(d) { return d * Math.PI / 180; }
  function khoangCach_(lat1, lng1, lat2, lng2) {
    const dLat = radian_(lat2 - lat1), dLng = radian_(lng2 - lng1);
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(radian_(lat1)) * Math.cos(radian_(lat2)) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  let ganNhat = null, khoangCachNhoNhat = Infinity;
  gpsRows.forEach(function (r) {
    const latR = Number(r[GPS_COL.LAT]), lngR = Number(r[GPS_COL.LNG]);
    if (isNaN(latR) || isNaN(lngR)) return;
    const kc = khoangCach_(lat, lng, latR, lngR);
    if (kc < khoangCachNhoNhat) { khoangCachNhoNhat = kc; ganNhat = r; }
  });
  if (!ganNhat) return null;

  const idRung = (ganNhat[GPS_COL.ID_KEY_GPS] || '').toString().trim();
  const rungRows = readData_(SHEET_NAME.HD_RUNG);
  const rung = rungRows.find(function (r) { return (r[RUNG_COL.ID_RUNG] || '').toString().trim() === idRung; });
  if (!rung) return { khoangCachMet: khoangCachNhoNhat, maRung: idRung, ghiChu: 'Tìm thấy điểm GPS nhưng không tra được lô rừng tương ứng (dữ liệu có thể bị lệch).' };

  const idHD = (rung[RUNG_COL.ID_KEY_HD] || '').toString().trim();
  const nccRows = readData_(SHEET_NAME.HD_NCC);
  const ncc = nccRows.find(function (r) { return (r[NCC_COL.ID_HD] || '').toString().trim() === idHD; });

  const namTrong = rung[RUNG_COL.NAM_TRONG] ? Number(rung[RUNG_COL.NAM_TRONG]) : null;
  const tuoiRungNam = namTrong ? (new Date().getFullYear() - namTrong) : null;

  // ---- Rừng bên cạnh: các lô rừng KHÁC (không phải lô vừa khớp) có điểm GPS
  // trong bán kính 2km — dùng đúng công thức Haversine đã tính ở trên, không
  // viết lại logic tính khoảng cách. Tối đa 5 lô gần nhất, tránh phình ngữ cảnh.
  const R2 = 6371000;
  function radian2_(d) { return d * Math.PI / 180; }
  function khoangCach2_(lat1, lng1, lat2, lng2) {
    const dLat = radian2_(lat2 - lat1), dLng = radian2_(lng2 - lng1);
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(radian2_(lat1)) * Math.cos(radian2_(lat2)) * Math.sin(dLng / 2) ** 2;
    return R2 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }
  const latDiem = Number(ganNhat[GPS_COL.LAT]), lngDiem = Number(ganNhat[GPS_COL.LNG]);
  const rungBenCanh = [];
  gpsRows.forEach(function (g) {
    const idRungKhac = (g[GPS_COL.ID_KEY_GPS] || '').toString().trim();
    if (!idRungKhac || idRungKhac === idRung) return;
    const latK = Number(g[GPS_COL.LAT]), lngK = Number(g[GPS_COL.LNG]);
    if (isNaN(latK) || isNaN(lngK)) return;
    const kc = khoangCach2_(latDiem, lngDiem, latK, lngK);
    if (kc <= 2000 && !rungBenCanh.some(function (x) { return x.idRung === idRungKhac; })) {
      const rungKhac = rungRows.find(function (r) { return (r[RUNG_COL.ID_RUNG] || '').toString().trim() === idRungKhac; });
      if (rungKhac) rungBenCanh.push({ idRung: idRungKhac, maRung: rungKhac[RUNG_COL.MA_RUNG] || idRungKhac, tenChuRung: rungKhac[RUNG_COL.TEN_CHU_RUNG], khoangCachMet: Math.round(kc) });
    }
  });
  rungBenCanh.sort(function (a, b) { return a.khoangCachMet - b.khoangCachMet; });

  return {
    khoangCachMet: khoangCachNhoNhat, maRung: rung[RUNG_COL.MA_RUNG] || idRung, diaChiRung: rung[RUNG_COL.DIA_CHI_RUNG],
    dienTichM2: rung[RUNG_COL.DIEN_TICH_M2], hoSoNguonGoc: rung[RUNG_COL.HO_SO_NGUON_GOC],
    soHD: rung[RUNG_COL.SO_HD], tenChuRung: rung[RUNG_COL.TEN_CHU_RUNG],
    cccdChuRung: ncc ? ncc[NCC_COL.CCCD_CHU_RUNG] : '', sdtChuRung: ncc ? ncc[NCC_COL.SDT_CHU_RUNG] : '',
    tinhTrangHopDong: ncc ? ncc[NCC_COL.TINH_TRANG] : '',
    namTrong: namTrong, tuoiRungNam: tuoiRungNam, // null nếu chưa nhập năm trồng — KHÔNG được đoán/bịa tuổi rừng khi thiếu dữ liệu này
    rungBenCanh: rungBenCanh.slice(0, 5)
  };
}

/**
 * Dò trong câu hỏi xem có nhắc tới khách hàng/hợp đồng nào có thật trong hệ
 * thống hay không, rồi LẤY ĐÚNG dữ liệu đó qua các hàm đã có sẵn (không tự
 * đọc Sheet mới, tránh trùng logic + tránh sai lệch với phần còn lại của hệ thống).
 * @param {string} cauHoi
 * @param {string[]} [cccdGoiYTuLuotTruoc] CCCD đã khớp ở lượt hỏi TRƯỚC (client
 *   gửi lại) — dùng khi câu hỏi hiện tại không tự nhắc tên/CCCD nào (câu hỏi nối
 *   tiếp), để không bắt người dùng lặp lại tên mỗi câu.
 */
function timNguCanhChatbot_(cauHoi, cccdGoiYTuLuotTruoc) {
  const cauHoiThuong = cauHoi.toString().trim().toLowerCase();
  const nguCanh = { thongKeChung: {}, khachHangKhop: [], hopDongKhopTheoSoHD: [], _tomTat: [] };

  // ---- Thống kê chung (luôn có sẵn — phục vụ câu hỏi tổng quát kiểu "có bao nhiêu hợp đồng") ----
  const nccRows = readData_(SHEET_NAME.HD_NCC);
  const demTinhTrang = {};
  nccRows.forEach(function (r) { const tt = (r[NCC_COL.TINH_TRANG] || 'Đang thực hiện').toString().trim(); demTinhTrang[tt] = (demTinhTrang[tt] || 0) + 1; });
  nguCanh.thongKeChung = { tongSoHopDong: nccRows.length, theoTrangThai: demTinhTrang };

  // ---- Dò số hợp đồng được nhắc trực tiếp (dãy số dài, kiểu 2026xxxxxxx) ----
  const khopSoHD = cauHoi.match(/\b\d{8,}\b/);
  if (khopSoHD) {
    const soDong = timSoDongTheoGiaTri_(SHEET_NAME.HD_NCC, NCC_COL.SO_HD, khopSoHD[0]);
    if (soDong !== -1) {
      const chiTiet = layHopDongTheoSoDong_ThucThi_(soDong);
      nguCanh.hopDongKhopTheoSoHD.push(chiTiet);
      nguCanh._tomTat.push('Khớp trực tiếp Số HĐ ' + khopSoHD[0]);
    }
  }

  // ---- MỚI: dò tọa độ GPS trong câu hỏi (vd "rừng nào ở 15.733975, 108.126?")
  // -> tìm điểm GPS đã lưu GẦN NHẤT trong bán kính hợp lý, suy ra đúng lô rừng
  // + hợp đồng + chủ rừng tại đó, không cần người dùng biết trước tên/số HĐ.
  const khopToaDo = cauHoi.match(/(-?\d{1,2}\.\d{3,8})\s*[,;]\s*(-?\d{2,3}\.\d{3,8})/);
  nguCanh.diaDiemTheoToaDo = null;
  if (khopToaDo) {
    const latHoi = Number(khopToaDo[1]), lngHoi = Number(khopToaDo[2]);
    if (latHoi >= 8 && latHoi <= 24 && lngHoi >= 102 && lngHoi <= 110) { // hợp lý trong phạm vi Việt Nam
      const diemGanNhat = timDiemGpsGanNhat_(latHoi, lngHoi);
      if (diemGanNhat && diemGanNhat.khoangCachMet <= 1000) { // chỉ nhận nếu cách không quá 1km, tránh nhận đại điểm xa không liên quan
        nguCanh.diaDiemTheoToaDo = diemGanNhat;
        nguCanh._tomTat.push('Khớp tọa độ (' + latHoi + ', ' + lngHoi + ') gần nhất với lô ' + diemGanNhat.maRung + ', cách ' + Math.round(diemGanNhat.khoangCachMet) + 'm');
      } else {
        nguCanh._tomTat.push('Có tọa độ (' + latHoi + ', ' + lngHoi + ') trong câu hỏi nhưng không có điểm GPS nào đã lưu ở gần đó (trong bán kính 1km)');
      }
    }
  }

  // ---- Dò khách hàng được nhắc theo tên (so khớp chuỗi con, không phân biệt hoa/thường) ----
  // ⚠️ ĐÃ SỬA: trước đây gọi layDanhSachKhachHang(1, 5000, '') — hàm này NHÓM
  // TOÀN BỘ HD_NCC theo CCCD (nặng, chạy lại mỗi lần hỏi rất chậm). Ở đây chỉ
  // cần dò tên/CCCD nên quét thẳng, nhẹ hơn nhiều — không cần gộp nhóm/đếm số
  // hợp đồng như hàm kia làm (phần đó tính riêng bên dưới, chỉ cho khách hàng
  // thật sự khớp câu hỏi, không phải toàn bộ hàng nghìn khách hàng).
  const nccRowsChoDoTen_ = readData_(SHEET_NAME.HD_NCC);
  const theoCccdNhe_ = {};
  nccRowsChoDoTen_.forEach(function (r) {
    const cccd = (r[NCC_COL.CCCD_CHU_RUNG] || '').toString().trim();
    if (!cccd) return;
    if (!theoCccdNhe_[cccd]) {
      theoCccdNhe_[cccd] = {
        tenChuRung: r[NCC_COL.TEN_CHU_RUNG], cccd: cccd, sdt: r[NCC_COL.SDT_CHU_RUNG],
        thuongTru: r[NCC_COL.DIA_CHI_TT], nhomKH: r[NCC_COL.NHOM_KH], soLuongHopDong: 0
      };
    }
    theoCccdNhe_[cccd].soLuongHopDong++; // đếm luôn trong cùng 1 lượt quét, không cần quét lại lần nữa
  });
  const dsKH = Object.values(theoCccdNhe_);
  // ⚠️ ĐÃ NÂNG CẤP: trước đây bắt buộc khớp NGUYÊN VĂN CÓ DẤU tên khách hàng
  // trong câu hỏi — gõ thiếu dấu, viết tắt, đảo thứ tự họ tên đều KHÔNG ra kết
  // quả (đây là lý do chatbot "không smart"). Giờ chấm điểm khớp mờ: khớp
  // nguyên văn > khớp không dấu > khớp đủ số từ trong tên, lấy tối đa 3 người
  // điểm cao nhất thay vì chỉ nhận khớp tuyệt đối.
  const cauHoiKhongDau_ = boDauTiengViet_(cauHoiThuong);
  const ungVienTheoTen_ = dsKH
    .map(function (kh) {
      const ten = (kh.tenChuRung || '').toString().trim();
      if (!ten) return null;
      const diem = tinhDoKhopTen_(cauHoiThuong, cauHoiKhongDau_, ten);
      return diem > 0 ? { kh: kh, diem: diem } : null;
    })
    .filter(Boolean)
    .sort(function (a, b) { return b.diem - a.diem; });
  const khopTen = ungVienTheoTen_.slice(0, 3).map(function (x) { return x.kh; });
  // Dò thêm theo CCCD (dãy đúng 12 số) nếu tìm theo tên chưa ra
  const matchCccd = cauHoi.match(/\b\d{12}\b/);
  let khopCccd = [];
  if (matchCccd && !khopTen.length) khopCccd = dsKH.filter(function (kh) { return kh.cccd === matchCccd[0]; });
  // ⚠️ MỚI: nếu câu hỏi hiện tại KHÔNG nhắc tới khách hàng nào cụ thể (câu hỏi
  // tiếp nối kiểu "còn thanh toán thì sao?", "vậy tổng giá trị bao nhiêu?") —
  // dùng lại CCCD đã khớp ở LƯỢT HỎI TRƯỚC (client gửi kèm) để trả lời đúng
  // ngữ cảnh, không bắt người dùng phải nhắc lại tên mỗi câu.
  if (!khopTen.length && !khopCccd.length && cccdGoiYTuLuotTruoc && cccdGoiYTuLuotTruoc.length) {
    khopCccd = dsKH.filter(function (kh) { return cccdGoiYTuLuotTruoc.indexOf(kh.cccd) !== -1; });
  }

  // ---- Dữ liệu thanh toán/đã thực hiện (từ DNTT_GK_DN_CT) — chỉ đọc 1 LẦN DUY
  // NHẤT nếu thật sự có khách hàng khớp, tránh tốn thời gian mở file ngoài khi
  // câu hỏi không liên quan gì tới hợp đồng cụ thể.
  let duLieuDNTT_ = null;
  function layThanhToanTheoSoHD_(soHD) {
    if (duLieuDNTT_ === null) { try { duLieuDNTT_ = layDuLieuThucHienTuDNTT_(); } catch (e) { duLieuDNTT_ = { thanhCong: false, theoSoHD: {} }; } }
    const dl = duLieuDNTT_.theoSoHD[soHD];
    return dl ? { khoiLuongDaThucHien: dl.khoiLuong, giaTriDaThucHien: dl.giaTri } : { khoiLuongDaThucHien: 0, giaTriDaThucHien: 0, ghiChu: 'Chưa có dữ liệu thanh toán/thực hiện cho hợp đồng này.' };
  }

  const dsCanLay = (khopTen.length ? khopTen : khopCccd).slice(0, 3); // tối đa 3 khách hàng/lượt hỏi, tránh ngữ cảnh quá nặng
  dsCanLay.forEach(function (kh) {
    const hopDongs = layHopDongTheoKhachHang(kh.cccd);
    const chiTietHopDongs = hopDongs.map(function (hd) {
      const dsRung = layDanhSachRung(hd.idHD);
      let tongDT = 0, tongKL = 0, tongGT = 0;
      dsRung.forEach(function (r) {
        const dt = Number(r.dienTichM2) || 0, kl = Number(r.khoiLuongDuKien) || 0, dg = Number(r.donGia) || 0;
        tongDT += dt; tongKL += kl; tongGT += kl * dg;
      });
      const dsTK = layDanhSachTaiKhoan(hd.idHD);
      const thanhToan = layThanhToanTheoSoHD_(hd.soHD);
      const danhSachLoRungDayDu = dsRung.map(function (r) {
        let dsGps = [], dsAnh = [];
        try { dsGps = layGPSCuaRung(r.idRung); } catch (e) { /* bỏ qua nếu lỗi, không chặn cả câu trả lời */ }
        try { dsAnh = (layDraftAnhChoRung(r.idRung) || []).filter(function (a) { return a.trangThai === 'Đã duyệt'; }); } catch (e) { /* bỏ qua nếu lỗi */ }
        return {
          maRung: r.maRung, diaChi: r.diaChiRung, dienTichM2: r.dienTichM2, donGia: r.donGia, khoiLuongDuKien: r.khoiLuongDuKien,
          soDiemGPS: dsGps.length, toaDoGPS: dsGps.map(function (p) { return p.lat.toFixed(6) + ', ' + p.lng.toFixed(6); }),
          soLuongAnh: dsAnh.length, linkAnh: dsAnh.slice(0, 5).map(function (a) { return a.url; }) // tối đa 5 link/lô, tránh ngữ cảnh quá nặng
        };
      });
      return {
        soHD: hd.soHD, ngayKy: hd.ngayKy, tinhTrang: hd.tinhTrang,
        soLuongLoRung: dsRung.length, danhSachLoRung: danhSachLoRungDayDu,
        tongDienTichM2: tongDT, tongKhoiLuongDuKienTan: tongKL, tongGiaTriHopDong: tongGT,
        soTaiKhoan: dsTK.map(function (tk) { return { soTK: tk.soTK, nganHang: tk.nganHang, uyQuyenTT: tk.uyQuyenTT, tenNguoiNhanTien: tk.tenUyQuyen }; }),
        tinhHinhThanhToan: thanhToan // ⚠️ MỚI: khối lượng/giá trị ĐÃ THỰC HIỆN thật (khác với "dự kiến" ở trên) — đọc từ DNTT_GK_DN_CT
      };
    });
    nguCanh.khachHangKhop.push({
      tenChuRung: kh.tenChuRung, cccd: kh.cccd, sdt: kh.sdt, thuongTru: kh.thuongTru, nhomKH: kh.nhomKH,
      tongSoHopDong: kh.soLuongHopDong, chiTietHopDong: chiTietHopDongs
    });
    nguCanh._tomTat.push('Khớp khách hàng "' + kh.tenChuRung + '" (' + hopDongs.length + ' hợp đồng)');
  });

  if (!nguCanh._tomTat.length) nguCanh._tomTat.push('Không khớp khách hàng/hợp đồng cụ thể nào — chỉ có thống kê chung.');
  nguCanh._cccdDaKhop = nguCanh.khachHangKhop.map(function (kh) { return kh.cccd; }); // để client gửi lại làm ngữ cảnh cho câu hỏi tiếp theo
  return nguCanh;
}
