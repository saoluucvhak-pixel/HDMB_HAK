/**
 * ============================================================
 *  31_TelegramBot.gs
 *  BOT TELEGRAM cho HAK GROUP — dùng CHUNG cho cả nhóm nhân viên qua 1 GROUP
 *  CHAT Telegram duy nhất (đơn giản nhất: mọi người vào chung 1 nhóm, bot trả
 *  lời hỏi-đáp trong đó + gửi thông báo vào đó, không cần đăng ký từng người).
 *
 *  2 CHỨC NĂNG:
 *  1. HỎI-ĐÁP: ai nhắn tin trong nhóm, bot dùng ĐÚNG logic tra cứu dữ liệu của
 *     chatbot webapp (TRA_LOI_CHATBOT ở 29_Chatbot.gs) để trả lời — không viết
 *     logic tra cứu riêng, tránh lệch dữ liệu giữa webapp và Telegram.
 *  2. THÔNG BÁO TỰ ĐỘNG: chạy định kỳ (trigger hàng ngày), báo vào nhóm nếu có
 *     ảnh/hồ sơ chờ duyệt, hoặc phát hiện dữ liệu mồ côi.
 *
 *  CÀI ĐẶT (làm 1 lần, hướng dẫn chi tiết ở trang Thiết lập):
 *  1. Tạo bot qua @BotFather trên Telegram -> lấy BOT TOKEN.
 *  2. Tạo 1 GROUP CHAT, thêm bot vào nhóm, thêm mọi nhân viên cần dùng vào nhóm.
 *  3. Lấy CHAT_ID của nhóm (hướng dẫn ở Thiết lập).
 *  4. Nhập cả 2 vào trang Thiết lập -> Lưu -> Bật Webhook.
 * ============================================================
 */

/**
 * Tự động tìm Chat ID — thay vì bắt người dùng tự mở link/đọc JSON, đọc thẳng
 * getUpdates bằng Bot Token đã lưu, liệt kê các cuộc trò chuyện gần đây bot
 * "nhìn thấy" để người dùng CHỌN đúng nhóm (không phải gõ tay số Chat ID).
 * YÊU CẦU: đã lưu Bot Token trước, và có nhắn ít nhất 1 tin trong nhóm sau khi
 * thêm bot vào (Telegram chỉ trả về tin nhắn MỚI, chưa đọc qua getUpdates).
 */
function TU_DONG_LAY_CHAT_ID_TELEGRAM() {
  const p = PropertiesService.getScriptProperties();
  const token = p.getProperty('TELEGRAM_BOT_TOKEN');
  if (!token) return { thanhCong: false, loi: 'Chưa lưu Bot Token — nhập Bot Token và bấm "Lưu cấu hình" trước.' };

  const url = 'https://api.telegram.org/bot' + token + '/getUpdates';
  const resp = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
  const json = JSON.parse(resp.getContentText());
  if (!json.ok) return { thanhCong: false, loi: 'Lỗi Telegram API: ' + (json.description || JSON.stringify(json)) };

  const daThay = {}; // chatId -> {ten, loai}
  (json.result || []).forEach(function (u) {
    const chat = u.message && u.message.chat;
    if (!chat) return;
    daThay[chat.id] = {
      chatId: chat.id.toString(),
      ten: chat.title || [chat.first_name, chat.last_name].filter(Boolean).join(' ') || '(không rõ tên)',
      loai: chat.type // 'group', 'supergroup', 'private'...
    };
  });
  const list = Object.values(daThay);
  if (!list.length) {
    return { thanhCong: false, loi: 'Chưa thấy cuộc trò chuyện nào. Vào đúng nhóm Telegram đã thêm bot vào, nhắn thử 1 tin bất kỳ (vd "test"), rồi bấm nút này lại.' };
  }
  return { thanhCong: true, list: list };
}

/**
 * ============================================================
 *  ⚠️ CHẾ ĐỘ POLLING — THAY THẾ WEBHOOK
 * ============================================================
 * Webhook (Telegram GỌI VÀO webapp) bị chặn bởi giới hạn CỐ HỮU của Google
 * Apps Script: webapp luôn trả 302 chuyển hướng trước khi chạy code thật —
 * trình duyệt/hầu hết client tự đi theo redirect nên không thấy vấn đề, NHƯNG
 * Telegram webhook KHÔNG đi theo redirect, luôn báo lỗi "Wrong response...302
 * Found" — xảy ra với MỌI webapp Apps Script, không phải do cấu hình sai.
 *
 * Polling giải quyết đúng gốc: đổi chiều lại — Apps Script (không phải
 * Telegram) là bên CHỦ ĐỘNG GỌI RA (qua UrlFetchApp, tự đi theo redirect bình
 * thường), hỏi Telegram "có tin mới không" mỗi phút — không còn vướng gì cả.
 */

/** Kiểm tra tin nhắn mới — gọi bởi trigger mỗi phút. Dùng offset (lưu trong
 *  Script Properties) để chỉ lấy tin CHƯA xử lý, không hỏi lại tin cũ. */
function KIEM_TRA_TIN_NHAN_TELEGRAM_MOI_() {
  const p = PropertiesService.getScriptProperties();
  const token = p.getProperty('TELEGRAM_BOT_TOKEN');
  if (!token) return; // chưa cấu hình thì bỏ qua, không báo lỗi (trigger chạy nền, không có ai xem lỗi)
  const offsetDaLuu = Number(p.getProperty('TELEGRAM_UPDATE_OFFSET') || 0);

  const url = 'https://api.telegram.org/bot' + token + '/getUpdates?offset=' + (offsetDaLuu + 1) + '&timeout=0';
  const resp = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
  const json = JSON.parse(resp.getContentText());
  if (!json.ok || !json.result || !json.result.length) return;

  const chatIdDaCauHinh = (p.getProperty('TELEGRAM_CHAT_ID') || '').toString().trim();
  let offsetMoiNhat = offsetDaLuu;

  json.result.forEach(function (update) {
    offsetMoiNhat = Math.max(offsetMoiNhat, update.update_id);
    const msg = update.message;
    if (!msg || !msg.text) return;
    const chatIdTinNhan = msg.chat.id.toString().trim();
    // ⚠️ ĐÃ SỬA: trước đây khi CHƯA cấu hình Chat ID (chatIdDaCauHinh rỗng), điều
    // kiện luôn đúng ("bỏ qua kiểm tra") -> bot trả lời BẤT KỲ chat nào biết được
    // Bot Token, lộ dữ liệu công ty ngay cả trước khi setup xong. Giờ CHỈ trả lời
    // khi ĐÃ cấu hình Chat ID và khớp đúng nhóm đó.
    if (!chatIdDaCauHinh || chatIdTinNhan !== chatIdDaCauHinh) return;
    const cauHoi = msg.text.trim();
    if (!cauHoi || cauHoi.charAt(0) === '/') return; // bỏ qua lệnh hệ thống kiểu /start

    const tenNguoiHoi = (msg.from && (msg.from.first_name || msg.from.username)) || '';
    let kq;
    try { kq = TRA_LOI_CHATBOT(cauHoi, [], []); } catch (err) { kq = { thanhCong: false, loi: err.message }; }
    const traLoi = kq.thanhCong ? (kq.khongDungAI ? '🔧 ' : '') + kq.traLoi : '❌ ' + kq.loi;
    try { guiTinTelegram_((tenNguoiHoi ? tenNguoiHoi + ' hỏi: ' : '') + '\n\n' + traLoi, chatIdTinNhan); } catch (e) { ghiLoiBackend_('KIEM_TRA_TIN_NHAN_TELEGRAM_MOI_ (gửi trả lời)', e); }
  });

  p.setProperty('TELEGRAM_UPDATE_OFFSET', offsetMoiNhat.toString());
}

/** Bật polling — XÓA webhook trước (2 chế độ không dùng chung được), rồi bật trigger chạy mỗi phút */
function BAT_POLLING_TELEGRAM() {
  const p = PropertiesService.getScriptProperties();
  const token = p.getProperty('TELEGRAM_BOT_TOKEN');
  if (!token) return { thanhCong: false, loi: 'Chưa lưu Bot Token.' };

  // Xóa webhook cũ nếu có — Telegram không cho dùng đồng thời cả 2 chế độ (lỗi "Conflict")
  try { UrlFetchApp.fetch('https://api.telegram.org/bot' + token + '/deleteWebhook', { muteHttpExceptions: true }); } catch (e) { /* bỏ qua nếu lỗi, không chặn bật polling */ }

  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'KIEM_TRA_TIN_NHAN_TELEGRAM_MOI_') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('KIEM_TRA_TIN_NHAN_TELEGRAM_MOI_').timeBased().everyMinutes(1).create();
  return { thanhCong: true, thongBao: 'Đã bật chế độ Polling — bot sẽ kiểm tra tin nhắn mới mỗi phút (có thể chờ tới 1 phút mới thấy trả lời, không phải tức thì như webhook).' };
}
function TAT_POLLING_TELEGRAM() {
  let daXoa = false;
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'KIEM_TRA_TIN_NHAN_TELEGRAM_MOI_') { ScriptApp.deleteTrigger(t); daXoa = true; }
  });
  return { thanhCong: true, thongBao: daXoa ? 'Đã tắt Polling.' : 'Chưa từng bật, không có gì để tắt.' };
}
function KIEM_TRA_TRANG_THAI_POLLING_TELEGRAM() {
  return { daBat: ScriptApp.getProjectTriggers().some(function (t) { return t.getHandlerFunction() === 'KIEM_TRA_TIN_NHAN_TELEGRAM_MOI_'; }) };
}

/** Hỏi thẳng Telegram xem webhook đang ở trạng thái nào — cho biết CHÍNH XÁC
 *  lỗi gì nếu bot không nhận được tin nhắn (vd URL sai, deploy chưa public...) */
function KIEM_TRA_WEBHOOK_TELEGRAM() {
  const p = PropertiesService.getScriptProperties();
  const token = p.getProperty('TELEGRAM_BOT_TOKEN');
  if (!token) return { thanhCong: false, loi: 'Chưa lưu Bot Token.' };
  const url = 'https://api.telegram.org/bot' + token + '/getWebhookInfo';
  const resp = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
  const json = JSON.parse(resp.getContentText());
  if (!json.ok) return { thanhCong: false, loi: 'Lỗi Telegram API: ' + (json.description || JSON.stringify(json)) };
  const info = json.result;
  const urlWebappHienTai = ScriptApp.getService().getUrl();
  return {
    thanhCong: true, urlDaDangKy: info.url || '(chưa đăng ký webhook nào)',
    urlWebappHienTai: urlWebappHienTai,
    khopUrl: info.url === urlWebappHienTai,
    loiGanNhat: info.last_error_message || null,
    thoiDiemLoi: info.last_error_date ? new Date(info.last_error_date * 1000).toLocaleString('vi-VN') : null,
    soTinDangCho: info.pending_update_count || 0
  };
}

/** Đọc cấu hình bot đã lưu (Script Properties) */
function LAY_CAI_DAT_TELEGRAM() {
  const p = PropertiesService.getScriptProperties();
  const token = p.getProperty('TELEGRAM_BOT_TOKEN') || '';
  const chatId = p.getProperty('TELEGRAM_CHAT_ID') || '';
  return {
    daCoToken: !!token, tokenRutGon: token ? (token.slice(0, 8) + '••••••••') : '',
    chatId: chatId
  };
}

/** Lưu Bot Token + Chat ID */
function LUU_CAI_DAT_TELEGRAM(token, chatId) {
  const p = PropertiesService.getScriptProperties();
  if (token) p.setProperty('TELEGRAM_BOT_TOKEN', token.toString().trim());
  if (chatId) p.setProperty('TELEGRAM_CHAT_ID', chatId.toString().trim());
  return { thanhCong: true, thongBao: 'Đã lưu cấu hình Telegram.' };
}

/** Gửi 1 tin nhắn vào đúng group đã cấu hình — dùng chung cho cả trả lời hỏi-đáp lẫn thông báo tự động */
function guiTinTelegram_(text, chatIdRieng) {
  const p = PropertiesService.getScriptProperties();
  const token = p.getProperty('TELEGRAM_BOT_TOKEN');
  const chatId = chatIdRieng || p.getProperty('TELEGRAM_CHAT_ID');
  if (!token || !chatId) throw new Error('Chưa cấu hình Bot Token/Chat ID Telegram.');
  const url = 'https://api.telegram.org/bot' + token + '/sendMessage';
  const payload = { chat_id: chatId, text: text.slice(0, 4000), disable_web_page_preview: true }; // Telegram giới hạn ~4096 ký tự/tin
  const resp = UrlFetchApp.fetch(url, { method: 'post', contentType: 'application/json', payload: JSON.stringify(payload), muteHttpExceptions: true });
  const json = JSON.parse(resp.getContentText());
  if (!json.ok) throw new Error('Lỗi Telegram API: ' + (json.description || JSON.stringify(json)));
  return json;
}

/** Gửi thử 1 tin nhắn — dùng để kiểm tra cấu hình đúng chưa (nút "Gửi thử" ở Thiết lập) */
function GUI_THU_TELEGRAM() {
  try {
    guiTinTelegram_('✅ Kết nối thành công! Bot HAK GROUP đã sẵn sàng — nhắn câu hỏi vào nhóm để tra cứu dữ liệu, vd: "Hợp đồng của Nguyễn Văn A có mấy lô rừng?"');
    return { thanhCong: true, thongBao: 'Đã gửi tin nhắn thử vào nhóm — kiểm tra Telegram xem có nhận được không.' };
  } catch (e) {
    return { thanhCong: false, loi: e.message };
  }
}

/**
 * ĐĂNG KÝ WEBHOOK — báo cho Telegram biết mỗi khi có tin nhắn mới thì gọi tới
 * đúng webapp này (doPost trong Code.gs). Chỉ cần chạy 1 lần sau khi deploy,
 * chạy lại nếu deploy phiên bản mới (URL webapp có thể đổi).
 */
function BAT_WEBHOOK_TELEGRAM() {
  const p = PropertiesService.getScriptProperties();
  const token = p.getProperty('TELEGRAM_BOT_TOKEN');
  if (!token) return { thanhCong: false, loi: 'Chưa nhập Bot Token.' };
  const webappUrl = ScriptApp.getService().getUrl();
  const url = 'https://api.telegram.org/bot' + token + '/setWebhook';
  const resp = UrlFetchApp.fetch(url, { method: 'post', contentType: 'application/json', payload: JSON.stringify({ url: webappUrl }), muteHttpExceptions: true });
  const json = JSON.parse(resp.getContentText());
  if (!json.ok) return { thanhCong: false, loi: 'Lỗi Telegram API: ' + (json.description || JSON.stringify(json)) };
  return { thanhCong: true, thongBao: 'Đã bật webhook, trỏ về: ' + webappUrl };
}

/** Tắt webhook — dùng khi cần tạm dừng bot */
function TAT_WEBHOOK_TELEGRAM() {
  const p = PropertiesService.getScriptProperties();
  const token = p.getProperty('TELEGRAM_BOT_TOKEN');
  if (!token) return { thanhCong: false, loi: 'Chưa nhập Bot Token.' };
  const url = 'https://api.telegram.org/bot' + token + '/deleteWebhook';
  const resp = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
  const json = JSON.parse(resp.getContentText());
  return { thanhCong: !!json.ok, thongBao: json.ok ? 'Đã tắt webhook.' : (json.description || 'Lỗi không rõ') };
}

/**
 * ⚠️ ĐIỂM VÀO CHÍNH khi Telegram gửi tin nhắn tới — Google Apps Script tự gọi
 * hàm này mỗi khi có request POST vào đúng URL webapp (đã đăng ký qua
 * BAT_WEBHOOK_TELEGRAM). KHÔNG cần gọi tay hàm này bao giờ.
 */
function doPost(e) {
  try {
    const update = JSON.parse(e.postData.contents);
    const msg = update.message;
    if (!msg || !msg.text) return ContentService.createTextOutput('ok'); // bỏ qua ảnh/sticker/lệnh hệ thống, chỉ xử lý tin nhắn chữ

    const p = PropertiesService.getScriptProperties();
    const chatIdDaCauHinh = (p.getProperty('TELEGRAM_CHAT_ID') || '').toString().trim();
    const chatIdTinNhan = msg.chat.id.toString().trim();
    // ⚠️ CHỈ trả lời nếu tin nhắn đến từ ĐÚNG nhóm đã cấu hình — chặn người lạ
    // dù vô tình biết được bot token cũng không tra được dữ liệu công ty.
    // ⚠️ ĐÃ SỬA: trước đây khi CHƯA cấu hình Chat ID thì điều kiện luôn đúng
    // (bỏ qua kiểm tra hoàn toàn) — đúng lỗ hổng mà comment trên mô tả. Giờ CHỈ
    // trả lời khi ĐÃ cấu hình Chat ID và khớp đúng nhóm đó.
    if (!chatIdDaCauHinh || chatIdTinNhan !== chatIdDaCauHinh) return ContentService.createTextOutput('ok');

    const cauHoi = msg.text.trim();
    if (cauHoi.charAt(0) === '/') return ContentService.createTextOutput('ok'); // bỏ qua lệnh kiểu /start, /help
    if (!cauHoi) return ContentService.createTextOutput('ok');

    const tenNguoiHoi = (msg.from && (msg.from.first_name || msg.from.username)) || '';
    let kq;
    try {
      kq = TRA_LOI_CHATBOT(cauHoi, [], []); // Telegram nhóm đông người hỏi xen kẽ -> KHÔNG dùng bộ nhớ ngữ cảnh (tránh nhầm câu hỏi của người này sang người khác), mỗi câu hỏi độc lập
    } catch (err) {
      kq = { thanhCong: false, loi: err.message };
    }
    const traLoi = kq.thanhCong ? (kq.khongDungAI ? '🔧 ' : '') + kq.traLoi : '❌ ' + kq.loi;
    guiTinTelegram_((tenNguoiHoi ? tenNguoiHoi + ' hỏi: ' : '') + '\n\n' + traLoi, chatIdTinNhan);
  } catch (err) {
    ghiLoiBackend_('doPost (Telegram)', err);
  }
  return ContentService.createTextOutput('ok');
}

/**
 * THÔNG BÁO TỰ ĐỘNG — chạy định kỳ (gắn trigger hàng ngày), báo vào nhóm nếu
 * có việc cần chú ý: ảnh/hồ sơ chờ duyệt, dữ liệu mồ côi phát hiện được.
 * Chỉ gửi tin khi CÓ việc thật — tránh spam tin "không có gì" mỗi ngày.
 */
function KIEM_TRA_VA_THONG_BAO_TELEGRAM_HANG_NGAY() {
  const dong = [];

  // Ảnh chờ duyệt
  try {
    const draftRows = readData_(SHEET_NAME.DRAFT_ANH);
    const soChoduyet = draftRows.filter(function (r) { return (r[DRAFT_ANH_COL.TRANG_THAI] || '') === 'Chờ duyệt'; }).length;
    if (soChoduyet > 0) dong.push('📷 ' + soChoduyet + ' ảnh đang chờ duyệt (gán vào lô rừng).');
  } catch (e) { /* bỏ qua nếu lỗi đọc, không chặn phần còn lại */ }

  // Dữ liệu mồ côi
  try {
    const kqMoCoi = CHAN_DOAN_MO_COI_TOAN_HE_THONG();
    if (kqMoCoi.tongSoVanDe > 0) dong.push('⚠️ Phát hiện ' + kqMoCoi.tongSoVanDe + ' vấn đề dữ liệu mồ côi/thiếu ID — xem chi tiết ở Thiết lập → Bảo trì dữ liệu.');
  } catch (e) { /* bỏ qua nếu lỗi */ }

  // ⚠️ MỚI: 3 loại cảnh báo theo hợp đồng — đọc từ cache Draft_BaoCaoHopDong (đã
  // có sẵn khối lượng dự kiến/thực hiện, không cần tính lại từ HD_RUNG).
  try {
    const NGUONG_VUOT_TAN_ = 10; // "sắp vượt" = còn lại dưới 10 Tấn nhưng CHƯA vượt hẳn
    const list = docToanBoDraftBaoCao_();
    const baThangTruoc = new Date(); baThangTruoc.setMonth(baThangTruoc.getMonth() - 3);

    const quaHan = [], sapVuot = [], daVuot = [];
    list.forEach(function (m) {
      const tt = m.tinhTrang || 'Đang thực hiện';
      // Chỉ xét hợp đồng CÒN ĐANG THỰC HIỆN — đã hoàn thành/thanh lý/hủy thì không còn ý nghĩa cảnh báo "quá hạn"/"sắp vượt" nữa
      if (tt !== 'Đang thực hiện' && tt !== 'Chờ thực hiện') return;

      // 1. Quá hạn 3 tháng (tính từ Ngày ký, vẫn chưa hoàn thành)
      const ngayKy = m.ngayKy ? new Date(m.ngayKy) : null;
      if (ngayKy && ngayKy < baThangTruoc) {
        const soThangQua = Math.floor((new Date() - ngayKy) / (1000 * 60 * 60 * 24 * 30));
        quaHan.push(m.soHD + ' (' + m.tenChuRung + ') — ký đã ' + soThangQua + ' tháng, vẫn "' + tt + '"');
      }

      // 2 & 3. So khối lượng thực hiện với dự kiến
      const duKien = Number(m.khoiLuongDuKien) || 0;
      const thucHien = Number(m.khoiLuongThucHien) || 0;
      if (duKien > 0) {
        const conLai = duKien - thucHien;
        if (conLai < 0) {
          daVuot.push(m.soHD + ' (' + m.tenChuRung + ') — đã thực hiện ' + thucHien.toLocaleString('vi-VN') + ' Tấn, VƯỢT ' + Math.abs(conLai).toLocaleString('vi-VN') + ' Tấn so với dự kiến ' + duKien.toLocaleString('vi-VN') + ' Tấn');
        } else if (conLai <= NGUONG_VUOT_TAN_) {
          sapVuot.push(m.soHD + ' (' + m.tenChuRung + ') — còn lại ' + conLai.toLocaleString('vi-VN') + ' Tấn là vượt (đã TH ' + thucHien.toLocaleString('vi-VN') + '/' + duKien.toLocaleString('vi-VN') + ' Tấn)');
        }
      }
    });

    if (quaHan.length) dong.push('⏰ ' + quaHan.length + ' hợp đồng quá hạn 3 tháng vẫn chưa hoàn thành:\n' + quaHan.slice(0, 10).map(function (s) { return '  • ' + s; }).join('\n') + (quaHan.length > 10 ? '\n  • ... và ' + (quaHan.length - 10) + ' hợp đồng khác' : ''));
    if (sapVuot.length) dong.push('🟡 ' + sapVuot.length + ' hợp đồng SẮP VƯỢT khối lượng (còn dưới ' + NGUONG_VUOT_TAN_ + ' Tấn):\n' + sapVuot.slice(0, 10).map(function (s) { return '  • ' + s; }).join('\n') + (sapVuot.length > 10 ? '\n  • ... và ' + (sapVuot.length - 10) + ' hợp đồng khác' : ''));
    if (daVuot.length) dong.push('🔴 ' + daVuot.length + ' hợp đồng ĐÃ VƯỢT khối lượng dự kiến:\n' + daVuot.slice(0, 10).map(function (s) { return '  • ' + s; }).join('\n') + (daVuot.length > 10 ? '\n  • ... và ' + (daVuot.length - 10) + ' hợp đồng khác' : ''));
  } catch (e) { /* bỏ qua nếu lỗi đọc cache, không chặn phần còn lại */ }

  if (!dong.length) return { thanhCong: true, daGui: false, thongBao: 'Không có việc gì cần báo hôm nay.' };

  try {
    guiTinTelegram_('🌅 Thông báo hàng ngày — HAK GROUP\n\n' + dong.join('\n'));
    return { thanhCong: true, daGui: true, thongBao: 'Đã gửi thông báo.' };
  } catch (e) {
    return { thanhCong: false, loi: e.message };
  }
}

/** Bật trigger chạy thông báo hàng ngày (8h sáng) */
function BAT_TRIGGER_THONG_BAO_TELEGRAM() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'KIEM_TRA_VA_THONG_BAO_TELEGRAM_HANG_NGAY') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('KIEM_TRA_VA_THONG_BAO_TELEGRAM_HANG_NGAY').timeBased().everyDays(1).atHour(8).create();
  return { thanhCong: true, thongBao: 'Đã bật thông báo tự động hàng ngày lúc 8h sáng.' };
}
function TAT_TRIGGER_THONG_BAO_TELEGRAM() {
  let daXoa = false;
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'KIEM_TRA_VA_THONG_BAO_TELEGRAM_HANG_NGAY') { ScriptApp.deleteTrigger(t); daXoa = true; }
  });
  return { thanhCong: true, thongBao: daXoa ? 'Đã tắt thông báo tự động.' : 'Chưa từng bật, không có gì để tắt.' };
}
function KIEM_TRA_TRIGGER_THONG_BAO_TELEGRAM() {
  return { daBat: ScriptApp.getProjectTriggers().some(function (t) { return t.getHandlerFunction() === 'KIEM_TRA_VA_THONG_BAO_TELEGRAM_HANG_NGAY'; }) };
}
