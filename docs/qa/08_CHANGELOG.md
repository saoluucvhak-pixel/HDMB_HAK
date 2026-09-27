# 08 — Nhật ký thay đổi (Changelog)

Nhánh: `claude/test-code-bug-project-nywz0r`. Mỗi dòng là 1 commit đã đẩy lên GitHub; chi tiết nằm trong nội dung commit.

## 27/09/2026 — Đợt 3: dọn mã chết, gộp mã trùng, XSS còn lại, chặn ghi lệch cột

| Commit | Loại | Thay đổi | File |
|---|---|---|---|
| `d15c9fa` | 🔀 Merge | Gộp nhánh `main` (đổi bảng màu giao diện của chủ dự án). Xung đột giữ bản có `ADMIN_TOKEN` và ghép màu mới với phần escape | 00_Config, 07, 11, 24, … |
| `e5d5680` | 🧹 Mã chết | Xóa `26_Page_QuanLyMeCon.html`, `08_Sidebar.html`, `09_Style.html`; 19 hàm server + 1 hàm client không ai gọi (bớt 12 hàm công khai gọi được ẩn danh, gồm hàm ghi `THEM_LINK_ANH_HOP_DONG`). `doGet` 29/29 trường hợp giống hệt | 01, 02, 03, 04, 06, 14, 15, Code, 10 |
| `534ac14` | ♻️ Gộp mã trùng | 67 hàm giống hệt của sidebar 07 và trang 11 chuyển vào `NhapLieu_Chung_JS.html`; 4 hàm khác nhau có chủ đích giữ ở từng trang | 07, 11, NhapLieu_Chung_JS (mới) |
| `64cde28` | ♻️🔒 Gộp + bảo mật | Widget chatbot của 10/27/30 chuyển vào `ChatbotWidget.html`; sửa chèn thuộc tính qua link trong trả lời chatbot (SEC-011) | 10, 27, 30, ChatbotWidget (mới) |
| `a72c265` | 🔒 Bảo mật | Escape 116 dòng còn lại chèn dữ liệu vào `innerHTML` (dữ liệu Sheet, dữ liệu tra cứu ngân hàng bên ngoài); `href` chỉ nhận http(s) | 10, 11, 12, 24, 27, 30, NhapLieu_Chung_JS |
| `38482b9` | 🛡️ Toàn vẹn dữ liệu | MAP-001: phát hiện cột bị chèn/xóa tay ở 6 sheet dữ liệu → **dừng ghi** và báo rõ cột nào lệch; menu "Xác nhận cấu trúc cột hiện tại" | 00_Config, 05_Menu |
| (commit tài liệu) | 📄 | Cập nhật 10 báo cáo | docs/qa |

## 27/09/2026 — Đợt 2: rà soát toàn dự án + nâng cấp

| Commit | Loại | Thay đổi | File |
|---|---|---|---|
| `ed12988` | 🐛 Sửa lỗi dữ liệu | Ngày lùi 1 ngày mỗi lần lưu (BUG-01); sửa hợp đồng xóa Nhóm KH/MST (BUG-02); tạo HĐ mất số 0 đầu CCCD/SĐT/Số TK/MST (BUG-03); menu "Cài đặt Vùng" luôn lỗi (BUG-08); thêm menu dọn file tạm MISA (BUG-09) | 00_Config, 05_Menu, 06_CreateUpdate, 15_DraftHopDong, 21_DinhDangText |
| `3efef6c` | 🐛🔒 Sửa lỗi + bảo mật | Giá trị có dấu `"` bị cắt cụt khi sửa (BUG-04); XSS qua tên file / link tải lên (SEC-008); đồng bộ sidebar 07 với trang 11: lưu ảnh GPS, hiện ảnh chung hợp đồng (BUG-07) | 07, 10, 11, 12, 24, 26, 27, 30 (.html) |
| `e5e4ef7` | 🐛 Sửa lỗi | Bấm lưu 2 lần tạo 2 hợp đồng (BUG-05); xóa nhầm nháp người khác (BUG-06) | 15_DraftHopDong, 07, 11, 27 |
| `a1b9f05` | ♻️🔒📝 Tái cấu trúc + log | `doGet` dạng bảng định tuyến (135 → 43 dòng, hành vi giữ nguyên); từ chối token mẫu `SYNC_TOKEN` (SEC-006); hàm `log_` có mức độ ghi Cloud Logging, 5 lỗi hết bị nuốt im lặng (BUG-10); thay toàn bộ `alert()` bằng thông báo nổi | Code, 00_Config, 01, 14, 16, 07, 11, 12, 24, 27 |
| `f20ae5a` | ⚡ Hiệu năng | Kiểm tra ảnh đọc HD_GPS 1 lần thay vì mỗi ảnh (PERF-005) | 02_DocumentChecker |
| `564270e` | 🔒 Bảo mật | `SETUP_*_TOKEN` công khai không còn ghi đè token đã đặt (SEC-007) | 00_Config, Code |
| `07eda6b` | 🔒 Bảo mật | Chỉ nhận ảnh/PDF ≤ 20 MB ở 4 hàm tải lên (SEC-009) | 00_Config, 04_Reconciliation, 06_CreateUpdate |
| `ac6c3d4` | 📄 | Thư mục `docs/qa/` — 10 báo cáo này | docs/qa |

## 24/09/2026 — Đợt 1: sửa theo QA Audit (đã được chủ dự án duyệt)

| Commit | Thay đổi |
|---|---|
| `42ba949` | SEC-001 (ADMIN_TOKEN cho chia sẻ quyền); LOCK-001/002/003/005/007; CACHE-001 |
| `8cbf662` | PERF-001 — đồng bộ thanh toán hàng loạt |

## 08/09/2026

| Commit | Thay đổi |
|---|---|
| `a1f876e` | Tính năng chia sẻ dữ liệu (cấp/xem/thu hồi quyền 2 Sheet + 4 thư mục) |

## Thống kê (a1f876e → nay, không tính tài liệu)
27 file, +1.856 / −4.059 dòng — phần xóa chủ yếu là mã chết (1.393 dòng trang 26) và mã trùng được gộp vào 2 partial. Không xóa chức năng nào đang dùng, không đổi tên cột/sheet, không đổi bố cục giao diện (chỉ thêm khung "Ảnh chung của cả hợp đồng" còn thiếu ở sidebar 07 và thông báo nổi thay cho hộp `alert`).
