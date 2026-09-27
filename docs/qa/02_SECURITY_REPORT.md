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

Chuỗi tấn công SEC-006 + SEC-007 trước khi sửa (đã tái hiện trong môi trường giả lập):
```
1. google.script.run.SETUP_SYNC_TOKEN()          // hàm công khai, không cần quyền
2. GET <webapp>?action=run&token=DAT_TOKEN_CUA_BAN_O_DAY   // chuỗi có sẵn trong mã nguồn
   -> RUN_HAK_SYSTEM_FINAL() chạy với quyền chủ sở hữu
```

## 3. 🔴 SEC-002 — CHƯA SỬA, cần quyết định của chủ dự án

**182 hàm server công khai** gọi được ẩn danh. Trong đó **63 hàm không được trang web nào dùng** (chỉ dùng từ menu Sheet / trigger / chạy tay) nhưng vẫn phơi ra Internet, gồm các hàm ghi/xóa:

`XOA_SHEET_TONGHOP_CU` (xóa sheet), `XOA_PHU_LUC`, `LUU_HOP_DONG_DAY_DU`, `LUU_PHU_LUC`, `THEM_LINK_ANH_HOP_DONG`, `THIET_LAP_TRIGGER_DINH_KY` / `…_ONEDIT_DRAFT_TU_MENU` / `…_DONG_BO_THANH_TOAN` (tạo trigger), `XAY_DUNG_LAI` các cache, `CHUYEN_DOI_*`, `DINH_DANG_*`, `DONG_BO_*`, `CHAY_TOAN_BO_BAO_TRI_TU_MENU`, `RUN_HAK_SYSTEM_FINAL`, `XUAT_BAO_CAO_MISA_TU_MENU`…

Và các hàm mà trang web **có** dùng (đọc toàn bộ danh sách hợp đồng, CCCD, số tài khoản; sửa/xóa hợp đồng theo số dòng do client gửi — IDOR) cũng không có kiểm tra nào.

**Không thể vá bằng một chỗ sửa nhỏ** — phải chọn mô hình xác thực:

| Phương án | Mô tả | Ưu | Nhược |
|---|---|---|---|
| **A. Đăng nhập trong ứng dụng** (khuyến nghị nếu phải giữ truy cập không cần tài khoản Google) | Trang đăng nhập; server kiểm tra mật khẩu (băm + salt trong Script Properties), cấp phiên ngẫu nhiên lưu ở CacheService (6 giờ); client giữ phiên trong `sessionStorage` và gửi kèm **mọi** lời gọi; mọi hàm công khai kiểm tra phiên trước tiên; có thể thêm vai trò (xem / nhập liệu / quản trị) | Giữ được cách dùng hiện tại cho nhân viên hiện trường | Sửa 198 điểm gọi + ~120 hàm server; cần kiểm thử kỹ trên môi trường thật |
| **B. Bắt đăng nhập Google** (`access: ANYONE`) | Google chặn người chưa đăng nhập | Sửa 1 dòng cấu hình | Không chặn được *người có tài khoản Google bất kỳ*; với tài khoản gmail thường vẫn không lấy được email để phân quyền |
| **C. Giới hạn miền** (`access: DOMAIN`) | Chỉ tài khoản trong Google Workspace của công ty | Mạnh nhất, ít sửa code | Cần Workspace; nhân viên/cộng tác viên phải có tài khoản công ty |
| **D. Tạm thời** (làm ngay được) | Đổi các hàm chỉ dùng từ menu/trigger thành hàm riêng tư (`_`) + giữ tên cũ làm lớp vỏ gọi từ menu | Giảm ngay bề mặt tấn công ~63 hàm | Phải xác nhận trên project thật rằng menu gọi được đúng tên; không giải quyết phần dữ liệu trang web đang dùng |

## 4. Các điểm còn lại

| ID | Mức | Nội dung | Đề xuất |
|---|---|---|---|
| XSS-rest | 🟡 | ~100 điểm chèn `err.message`, `kq.loi`, nhãn động vào `innerHTML` chưa escape. Phần lớn là văn bản do server sinh ra, nhưng một số lỗi lặp lại giá trị người dùng gửi (vd "Không tìm thấy hợp đồng: " + id) | Chuyển `showMsg`/thông báo sang `textContent`; gom 1 hàm escape dùng chung (06_REFACTOR_PLAN) |
| JS-in-attr | ⚪ | `onclick="f('…' + escape(x) + '…')"` (vd nút Thu hồi quyền ở trang 24): escape HTML không đủ cho ngữ cảnh chuỗi JS | Dùng `data-*` + event delegation |
| CLICKJACK | 🟡 | Mọi trang đặt `XFrameOptionsMode.ALLOWALL` → bất kỳ website nào cũng nhúng được webapp vào iframe | Chuyển `DEFAULT` nếu không nhúng vào Google Sites/trang khác (cần xác nhận) |
| 3RD-PARTY | 🟡 | Số tài khoản ngân hàng gửi tới `tracuubank.com` (dịch vụ bên thứ ba) để tra tên chủ TK; ảnh CCCD/hồ sơ gửi tới Gemini API; dữ liệu hợp đồng gửi qua Telegram | Rà soát điều khoản xử lý dữ liệu cá nhân (NĐ 13/2023), ghi rõ trong quy trình nội bộ |
| SCOPE | ⚪ | Scope `documents` chỉ phục vụ 1 lệnh `DocumentApp` | Gỡ nếu tính năng đó không còn dùng |
| IDS | ⚪ | 4 URL Sheet hard-code trong `00_Config.gs` | Không phải bí mật khi đã ANYONE_ANONYMOUS; chuyển vào Script Properties khi làm SEC-002 |

## 5. Hạng mục trong danh sách kiểm tra — kết quả

| Hạng mục | Kết quả |
|---|---|
| XSS / HTML Injection / Script Injection | Đã sửa nhóm do người dùng tải lên + escape dấu nháy; còn XSS-rest (mục 4) |
| SQL Injection | **N/A** — dự án không dùng SQL |
| Formula Injection | ⚪ LOW — `setValue('=…')` được Google Sheets hiểu là công thức. Người nhập một địa chỉ/ghi chú bắt đầu bằng `=`, `+`, `-`, `@` sẽ tạo công thức trong Sheet (và trong file xuất). Đề xuất: thêm tiền tố `'` cho các trường văn bản tự do trước khi ghi |
| CSRF | Thấp — `google.script.run` do Google xử lý kèm token chống XSRF; `doGet` chỉ có `action=run` có tác dụng phụ và đã yêu cầu token bí mật |
| Token / Session / Cookie | Ứng dụng không có phiên đăng nhập (xem SEC-002); không đặt cookie riêng |
| API Key | Không hard-code; Gemini/Telegram key nằm trong Script Properties ✅ |
| OAuth | Scope rộng (`drive` toàn bộ) là cần thiết cho tính năng hiện tại; xem SCOPE |
| Permission | Không có (SEC-002) |
| File Upload | Đã giới hạn loại + dung lượng (SEC-009) |
| File Download | Xuất MISA/Excel tạo file tạm trong Drive chủ sở hữu rồi dọn; link tải là link Drive thật |
| CORS / CSP | **Do Google quản lý** (HtmlService chạy trong iframe sandbox `*.googleusercontent.com`); dự án không cấu hình được |
| Input Validation | CCCD (12 số), email, ngày (`ngayToISO_` loại ngày không tồn tại), file tải lên ✅; số dòng do client gửi được kiểm tra khoảng nhưng không kiểm tra quyền (IDOR) |
| Output Encode | Xem XSS |
