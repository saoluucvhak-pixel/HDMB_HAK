# Số đo gốc (baseline) — `main` `8d4bd25`, trước nâng cấp 10/2026

## Phương pháp

- Công cụ: `tests/do_hieu_suat.cjs` trên bộ giả lập Apps Script (`tests/gasmock.cjs`). Dữ liệu dựng bằng chính các hàm tạo của
  hệ thống: N hợp đồng, mỗi HĐ 2 lô rừng, 4 điểm GPS, 1 tài khoản (5.000 HĐ = 10.000 lô, 20.000 điểm GPS).
- Đo **số lượt gọi Sheets** (`getValues`, mỗi lượt là 1 vòng mạng tới Google) và **số ô đọc**, số lượt ghi. Đây là thứ quyết
  định thời gian chạy trên Apps Script; **không quy đổi ra giây** — thời gian trên bộ giả lập không phản ánh Apps Script thật.
- Mã cũ lấy bằng `git archive 8d4bd25`; chạy: `SO_HD=<N> TZ=Asia/Ho_Chi_Minh node tests/do_hieu_suat.cjs <thư mục mã cũ>`.
- "Tìm theo CCCD" / "Tìm tiếp" = 0 vì chỉ mục Tra cứu đã nằm trong cache sau lần tìm trước (đúng như khi dùng thật).
- Bản đồ "mở lại" ở 100 HĐ = 0 vì dữ liệu nhỏ còn vừa giới hạn 95.000 ký tự của cache cũ; từ 1.000 HĐ trở lên không cache được.

## Kết quả

| Nhóm | Thao tác | 100 HĐ: lượt đọc / ô đọc / lượt ghi | 1.000 HĐ: lượt đọc / ô đọc / lượt ghi | 5.000 HĐ: lượt đọc / ô đọc / lượt ghi |
|---|---|---:|---:|---:|
| Tra cứu | Tìm theo tên (Tra cứu HĐ) | 2 / 4.300 / 0 | 2 / 43.000 / 0 | 2 / 215.000 / 0 |
| Tra cứu | Tìm theo CCCD | 0 / 0 / 0 | 0 / 0 / 0 | 0 / 0 / 0 |
| Tra cứu | Xem chi tiết 1 HĐ (Tra cứu) | 10 / 1.164 / 0 | 10 / 10.164 / 0 | 10 / 50.164 / 0 |
| Tra cứu | Danh sách khách hàng (Nhập liệu) | 1 / 3.300 / 0 | 1 / 33.000 / 0 | 1 / 165.000 / 0 |
| Tra cứu | Danh sách khách hàng: trang 2 / tìm | 1 / 3.300 / 0 | 1 / 33.000 / 0 | 1 / 165.000 / 0 |
| Tra cứu | Tìm tiếp theo tên khác | 0 / 0 / 0 | 0 / 0 / 0 | 0 / 0 / 0 |
| Tra cứu | HĐ của 1 khách hàng | 1 / 3.300 / 0 | 1 / 33.000 / 0 | 1 / 165.000 / 0 |
| Tra cứu | Mở 1 HĐ ở Nhập liệu | 6 / 483 / 0 | 6 / 4.083 / 0 | 6 / 20.083 / 0 |
| Tra cứu | Thanh tiến độ 5 bước | 8 / 1.033 / 0 | 8 / 9.133 / 0 | 8 / 45.133 / 0 |
| Tra cứu | Tab Lô rừng | 2 / 240 / 0 | 2 / 2.040 / 0 | 2 / 10.040 / 0 |
| Tra cứu | Tab Số tài khoản | 2 / 110 / 0 | 2 / 1.010 / 0 | 2 / 5.010 / 0 |
| Tra cứu | Tab GPS của 1 lô | 2 / 540 / 0 | 2 / 5.040 / 0 | 2 / 25.040 / 0 |
| Tra cứu | Tab Ảnh của 1 lô | 0 / 0 / 1 | 0 / 0 / 1 | 0 / 0 / 1 |
| Tra cứu | Tổng quan hợp đồng | 3 / 12.100 / 0 | 3 / 121.000 / 0 | 3 / 605.000 / 0 |
| Tra cứu | Tổng quan (mở lại / đổi bộ lọc) | 1 / 3.100 / 0 | 1 / 31.000 / 0 | 1 / 155.000 / 0 |
| Tra cứu | Bản đồ GPS (mở lần đầu) | 3 / 12.363 / 0 | 3 / 123.063 / 0 | 3 / 615.063 / 0 |
| Tra cứu | Bản đồ GPS (mở lại) | 0 / 0 / 0 | 3 / 123.063 / 0 | 3 / 615.063 / 0 |
| Tra cứu | Làm mới Draft (không có thay đổi) | 214 / 57.700 / 2 | 2.014 / 2.377.000 / 2 | 10.014 / 51.885.000 / 2 |
| Ghi | Tạo hợp đồng mới | 27 / 3.178 / 13 | 27 / 30.178 / 13 | 27 / 150.178 / 13 |
| Ghi | Thêm lô rừng | 26 / 2.918 / 12 | 26 / 26.318 / 12 | 26 / 130.318 / 12 |
| Ghi | Thêm tài khoản | 12 / 1.181 / 3 | 12 / 10.181 / 3 | 12 / 50.181 / 3 |
| Ghi | Thêm 1 điểm GPS | 16 / 1.818 / 3 | 16 / 16.218 / 3 | 16 / 80.218 / 3 |
| Sửa | Sửa thông tin HĐ (SĐT) | 16 / 1.328 / 6 | 16 / 11.228 / 6 | 16 / 55.228 / 6 |
| Sửa | Sửa lô rừng (đơn giá) | 23 / 2.316 / 8 | 23 / 20.316 / 8 | 23 / 100.316 / 8 |
| Sửa | Lưu lô không đổi gì | 2 / 222 / 0 | 2 / 2.022 / 0 | 2 / 10.022 / 0 |
| Sửa | Sửa tài khoản | 15 / 1.815 / 3 | 15 / 16.215 / 3 | 15 / 80.215 / 3 |
| Sửa | Duyệt trạng thái | 13 / 1.193 / 0 | 13 / 10.193 / 0 | 13 / 50.193 / 0 |
| Sửa | Sửa qua nháp: mở nháp | 8 / 518 / 3 | 8 / 4.118 / 3 | 8 / 20.118 / 3 |
| Sửa | Sửa qua nháp: lưu nháp | 2 / 2 / 3 | 2 / 2 / 3 | 2 / 2 / 3 |
| Sửa | Sửa qua nháp: lưu chính thức | 21 / 1.501 / 6 | 21 / 12.301 / 6 | 21 / 60.301 / 6 |

## Nhận xét

- **Làm mới Draft** tăng tuyến tính số **lượt gọi** theo số hợp đồng (≈ 2 lượt / HĐ: đọc lại cột HD_RUNG cho từng HĐ) — 5.000 HĐ
  ≈ 10.000 lượt gọi, chắc chắn vượt 6 phút / lượt chạy của Apps Script.
- **Danh sách khách hàng**, **HĐ của 1 khách hàng**, **Tổng quan**, **bản đồ** đọc toàn bộ 33 cột HD_NCC / toàn bộ HD_RUNG, HD_GPS
  mỗi lần; đổi trang danh sách khách hàng đọc lại cả bảng.
- Các thao tác **ghi** (tạo / sửa / lưu chính thức) đã được tối ưu ở đợt 04/10 (chủ yếu đọc 1 cột khóa) — đợt này không đổi.

So sánh với bản nâng cấp: `PERFORMANCE_COMPARISON.md`.
