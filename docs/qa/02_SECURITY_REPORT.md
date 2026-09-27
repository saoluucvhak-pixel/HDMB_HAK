# 02 — Báo cáo bảo mật (Security Report)

## 1. Mô hình triển khai và mối đe dọa

`appsscript.json`: `executeAs: USER_DEPLOYING` + `access: ANYONE_ANONYMOUS`.

Hệ quả nền tảng (quyết định mọi mục dưới đây):
1. **Ai có URL webapp đều vào được**, không cần tài khoản Google, không có đăng nhập.
2. Mọi lệnh chạy bằng **toàn quyền của tài khoản triển khai** (scope `drive` toàn bộ, `spreadsheets`, `script.scriptapp`…).
3. `google.script.run` gọi được **mọi hàm server công khai** (không có đuôi `_`) — không chỉ hàm của trang đang mở. Mở DevTools gõ `google.script.run.TEN_HAM(...)` là đủ.
4. `Session.getActiveUser()` không trả email người dùng ở chế độ này (trừ khi cùng miền Workspace) → **không thể phân quyền theo người dùng** nếu giữ nguyên mô hình.

Dữ liệu được bảo vệ: CCCD, số điện thoại, địa chỉ, **số tài khoản ngân hàng**, hồ sơ pháp lý đất, ảnh CCCD — là **dữ liệu cá nhân** theo Nghị định 13/2023/NĐ-CP.

## 2. Đã sửa (có test chứng minh)

| ID | Mức | Vấn đề | Cách sửa | Commit / Test |
|---|---|---|---|---|
| SEC-001 | 🔴 | Ai cũng tự cấp/thu hồi quyền Editor trên 2 Sheet + 4 thư mục Drive | Bắt buộc `ADMIN_TOKEN` (Script Property); giá trị mẫu bị từ chối; client hỏi 1 lần/lần tải trang, không lưu | `42ba949` / T-SEC-001 |
| SEC-006 | 🔴 | `?action=run` chấp nhận token mẫu `DAT_TOKEN_CUA_BAN_O_DAY` (có trong mã nguồn) | Coi token mẫu là "chưa cấu hình" | `a1b9f05` / trace doGet |
| SEC-007 | 🔴 | `SETUP_SYNC_TOKEN()`/`SETUP_ADMIN_TOKEN()` là hàm công khai → người lạ **đặt lại token về giá trị mẫu rồi dùng nó** = vượt qua hoàn toàn `action=run` | Hai hàm này không còn ghi đè token đã có; kết hợp SEC-006 thì chuỗi tấn công bị cắt ở cả 2 đầu | `564270e` / T-SEC-006 |
| SEC-008 | 🟠 | XSS: tên file tải lên, ghi chú, tên người ủy quyền chèn thẳng vào `innerHTML` ở trang 07, 11, 12 (không có hàm escape); link ảnh/hồ sơ nhận cả `javascript:` | Escape đầy đủ + chỉ nhận link `http(s)` ở các điểm hiển thị file/ảnh/hồ sơ (07, 10, 11, 12) | `3efef6c` / UI-07-ANH, UI-11-ANH |
| SEC-008b | 🟠 | 6 hàm escape không escape dấu nháy → chèn thuộc tính (`" onfocus="…`) trong `value="…"`, `title="…"` | Escape thêm `"` `'` | `3efef6c` / UI-27-QUOTE |
| SEC-009 | 🟡 | 4 hàm tải lên nhận **mọi loại file, mọi dung lượng** từ người ẩn danh và lưu vào Drive chủ sở hữu (có thể lưu trữ HTML/mã độc dưới tài khoản công ty); OCR tiêu tốn quota Gemini với dữ liệu bất kỳ | Chỉ nhận ảnh + PDF, ≤ 20 MB | `07eda6b` / T-SEC-009 |
| SEC-010 | 🟡 | Thông báo lỗi hiển thị bằng `alert()` | Toast chỉ dùng `textContent` (không thể chèn HTML) | `a1b9f05` / UI-11-TOAST |
| SEC-011 | 🟡 | Link trong trả lời chatbot chèn được thuộc tính HTML | Escape dấu nháy, link không được chứa dấu nháy | `64cde28` / UI-CHATXSS-* |
| XSS-rest | 🟡 | 116 dòng còn lại chèn dữ liệu Sheet/server/**dịch vụ tra cứu ngân hàng bên ngoài** vào `innerHTML` | Bọc hàm escape của từng trang; `href` chỉ nhận http(s) | `a72c265` / UI-10-XSS-TL, UI-27-XSS-TK |

Chuỗi tấn công SEC-006 + SEC-007 trước khi sửa (đã tái hiện trong môi trường giả lập):
```
1. google.script.run.SETUP_SYNC_TOKEN()          // hàm công khai, không cần quyền
2. GET <webapp>?action=run&token=DAT_TOKEN_CUA_BAN_O_DAY   // chuỗi có sẵn trong mã nguồn
   -> RUN_HAK_SYSTEM_FINAL() chạy với quyền chủ sở hữu
```

## 3. ✅ SEC-002 — ĐÃ SỬA: đăng nhập Gmail + phân quyền (`c852a6a`)

Chủ dự án chọn **cùng mô hình với HAK_WEBAPP_DNTT_DRAFT (v2026.7)**, áp cho **toàn bộ webapp**:

| Thành phần | Cách làm | Test |
|---|---|---|
| Xác thực | **Cổng đăng nhập**: 1 dự án Apps Script riêng chạy dưới tài khoản *người truy cập* (biết email thật), ký HMAC-SHA256 (email + hạn 5 phút + mã dùng 1 lần) rồi chuyển về webapp `?sso=…`. Webapp kiểm chữ ký (so sánh thời gian hằng), hạn, mã dùng 1 lần → cấp **phiên** ngẫu nhiên 256 bit (ScriptCache, 6 giờ) | T-AUTH-03 (dùng lại link, sửa email trong link, hết hạn, sai mã bí mật, email lạ, trang nhúng) |
| Phân quyền | Sheet `SYS_NguoiDung`: email · vai trò (**Quản trị / Nhập liệu / Chỉ xem**) · trạng thái (Hoạt động/Khóa). Chủ script + `QUAN_TRI_CO_DINH` luôn là Quản trị. Khóa tài khoản có hiệu lực ≤ 60 giây kể cả phiên đang mở | T-AUTH-02 |
| Một cửa vào | Trình duyệt chỉ gọi `api(phien, tên, [tham số])`; bảng `_bangQuyenApi_()` (123 chức năng) quy định quyền từng chức năng; chức năng ngoài bảng bị từ chối (kể cả `constructor`) | T-AUTH-02, T-AUTH-04 |
| Đóng bề mặt ẩn danh | 116 hàm trang web gọi + 17 hàm nội bộ đổi thành hàm riêng tư (`X_`) → `google.script.run` không gọi thẳng được. **38 hàm công khai còn lại** (menu Sheet, chạy tay, trigger) kiểm tra quyền ở dòng đầu; trigger đã cài được nhận ra qua `triggerUid` | **T-AUTH-01**: gọi thẳng cả 38 hàm với người lạ → đều `[AUTH]`, không ghi dữ liệu. 9 hàm công khai được phép: `api`, `thongTinDangNhap`, `nhanPhienDangNhap`, `dangXuat`, `doGet`, `doPost`, `onOpen`, `include`, `onChangeLamMoiCache` |
| Giao diện | Màn đăng nhập, ẩn menu theo vai trò, chip người dùng + Đăng xuất, lỗi `[AUTH]` → về màn đăng nhập, lỗi `[QUYEN]` → chỉ báo lỗi | UI-AUTH-01..04 |
| Truy vết | Nhật ký, cột Email người tạo hợp đồng, người sửa nháp ghi **email thật** của người đăng nhập (trước đây trống khi dùng webapp) | T-AUDIT-01, T-AUTH-03 |

**Chuỗi tấn công cũ nay bị chặn:** mở DevTools gõ `google.script.run.XOA_VINH_VIEN_HOP_DONG_(…)` → "Script function not found" (hàm riêng tư); `google.script.run.api('', 'XOA_VINH_VIEN_HOP_DONG', …)` → `[AUTH] Chưa đăng nhập`; có phiên Nhập liệu → `[QUYEN]` (xóa vĩnh viễn chỉ Quản trị).

**Vì sao vẫn để `access: ANYONE_ANONYMOUS`:** webhook Telegram (`doPost`) và `?action=run` (SYNC_TOKEN) được gọi từ máy chủ ngoài không đăng nhập Google. Bảo vệ nằm ở từng lời gọi, không phụ thuộc cấu hình triển khai. Trang HTML vẫn tải được cho người lạ nhưng không có dữ liệu.

**Hồ sơ pháp lý (CCCD, GCN QSDĐ…) trong Tra cứu hình ảnh:** chỉ Nhập liệu / Quản trị thấy và tải được; máy chủ chỉ trả file thuộc hợp đồng đang xem (không nhận ID Drive tùy ý), Chỉ xem chỉ thấy số lượng bị khóa. Mỗi lần xuất PDF ghi Nhật ký (người xuất, số ảnh, số hồ sơ) — T-HA-05..07.

**Giới hạn còn lại (nói rõ):**
- Vai trò **Chỉ xem** vẫn thấy CCCD/SĐT/số TK đầy đủ ở các trang báo cáo/tổng quan (như trước); chỉ trang Tra cứu che bớt. Muốn che toàn hệ thống cần sửa từng hàm báo cáo.
- Người được chia sẻ **trực tiếp file Google Sheet** vẫn đọc/sửa dữ liệu trên Sheet — phân quyền webapp không thay được quyền chia sẻ của Google Drive.
- `onChangeLamMoiCache` vẫn công khai (chỉ gọi webhook làm mới cache của DNTT, không đọc/ghi dữ liệu HDMB).

## 4. Các điểm còn lại

| ID | Mức | Nội dung | Đề xuất |
|---|---|---|---|
| JS-in-attr | ⚪ | `onclick="f('…' + escape(x) + '…')"` (vd nút Thu hồi quyền ở trang 24): escape HTML không đủ cho ngữ cảnh chuỗi JS | Dùng `data-*` + event delegation |
| CLICKJACK | 🟡 | Mọi trang đặt `XFrameOptionsMode.ALLOWALL` → bất kỳ website nào cũng nhúng được webapp vào iframe | Chuyển `DEFAULT` nếu không nhúng vào Google Sites/trang khác (cần xác nhận) |
| 3RD-PARTY | 🟡 | Số tài khoản ngân hàng gửi tới `tracuubank.com` (dịch vụ bên thứ ba) để tra tên chủ TK; ảnh CCCD/hồ sơ gửi tới Gemini API; dữ liệu hợp đồng gửi qua Telegram | Rà soát điều khoản xử lý dữ liệu cá nhân (NĐ 13/2023), ghi rõ trong quy trình nội bộ |
| SCOPE | ⚪ | Scope `documents` chỉ phục vụ 1 lệnh `DocumentApp` | Gỡ nếu tính năng đó không còn dùng |
| SECRET-PUB | 🟡 | Repo GitHub `HDMB_HAK` đang **công khai**: `WEBHOOK_SECRET` (mã gọi webhook làm mới cache của DNTT) nằm trong `Webhook_dntt.gs`; 4 URL Sheet trong `00_Config.gs` | Hậu quả hiện tại thấp (webhook chỉ làm mới cache DNTT). Nên: đặt repo về Private, hoặc đổi mã bí mật ở DNTT rồi lưu mã mới vào Script Properties của HDMB. Mã bí mật đăng nhập (`SSO_SECRET`) **không** nằm trong mã nguồn |

## 5. Hạng mục trong danh sách kiểm tra — kết quả

| Hạng mục | Kết quả |
|---|---|
| XSS / HTML Injection / Script Injection | Đã xử lý toàn bộ điểm chèn dữ liệu vào HTML đã tìm thấy (tên file, link, dữ liệu Sheet, dữ liệu dịch vụ ngoài, chatbot). Còn lại: đối số chuỗi JS trong `onclick` (JS-in-attr, ⚪) |
| SQL Injection | **N/A** — dự án không dùng SQL |
| Formula Injection | ⚪ LOW — `setValue('=…')` được Google Sheets hiểu là công thức. Người nhập một địa chỉ/ghi chú bắt đầu bằng `=`, `+`, `-`, `@` sẽ tạo công thức trong Sheet (và trong file xuất). Đề xuất: thêm tiền tố `'` cho các trường văn bản tự do trước khi ghi |
| CSRF | Thấp — `google.script.run` do Google xử lý kèm token chống XSRF; `doGet` chỉ có `action=run` có tác dụng phụ và đã yêu cầu token bí mật |
| Token / Session / Cookie | Phiên 256 bit ngẫu nhiên trong ScriptCache (6 giờ), giữ ở `sessionStorage` (mất khi đóng tab); không cookie. Link đăng nhập ký HMAC, 5 phút, dùng 1 lần |
| API Key | Không hard-code; Gemini/Telegram key nằm trong Script Properties ✅ |
| OAuth | Scope rộng (`drive` toàn bộ) là cần thiết cho tính năng hiện tại; xem SCOPE |
| Permission | 3 vai trò, 1 bảng quyền cho 123 chức năng + kiểm tra quyền ở mọi hàm menu/trigger (SEC-002 ✅) |
| File Upload | Đã giới hạn loại + dung lượng (SEC-009) |
| File Download | Xuất MISA/Excel tạo file tạm trong Drive chủ sở hữu rồi dọn; link tải là link Drive thật |
| CORS / CSP | **Do Google quản lý** (HtmlService chạy trong iframe sandbox `*.googleusercontent.com`); dự án không cấu hình được |
| Input Validation | CCCD (12 số), email, ngày (`ngayToISO_` loại ngày không tồn tại), file tải lên ✅; số dòng do client gửi được kiểm tra khoảng nhưng không kiểm tra quyền (IDOR) |
| Output Encode | Xem XSS |
