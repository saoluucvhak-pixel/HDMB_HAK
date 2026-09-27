# 08 — Nhật ký thay đổi (Changelog)

Nhánh: `claude/test-code-bug-project-nywz0r`. Mỗi dòng là 1 commit đã đẩy lên GitHub; chi tiết nằm trong nội dung commit.

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
| (commit tài liệu) | 📄 | Thư mục `docs/qa/` — 10 báo cáo này | docs/qa |

## 24/09/2026 — Đợt 1: sửa theo QA Audit (đã được chủ dự án duyệt)

| Commit | Thay đổi |
|---|---|
| `42ba949` | SEC-001 (ADMIN_TOKEN cho chia sẻ quyền); LOCK-001/002/003/005/007; CACHE-001 |
| `8cbf662` | PERF-001 — đồng bộ thanh toán hàng loạt |

## 08/09/2026

| Commit | Thay đổi |
|---|---|
| `a1f876e` | Tính năng chia sẻ dữ liệu (cấp/xem/thu hồi quyền 2 Sheet + 4 thư mục) |

## Thống kê (a1f876e → nay)
19 file mã nguồn, +790 / −315 dòng (chưa tính tài liệu). Không xóa chức năng nào, không đổi tên cột/sheet, không đổi bố cục giao diện (chỉ thêm 1 khung "Ảnh chung của cả hợp đồng" còn thiếu ở sidebar 07 và thông báo nổi thay cho hộp `alert`).
