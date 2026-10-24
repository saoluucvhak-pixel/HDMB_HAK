# So sánh hiệu năng trước / sau — nâng cấp 10/2026

Cùng công cụ, cùng dữ liệu, cùng điều kiện như `PERFORMANCE_BASELINE.md`: mã cũ `main` `8d4bd25` → nhánh
`feature/hdmb-performance-optimization`. Chỉ số: **lượt gọi Sheets** và **ô đọc** trên bộ giả lập. **Không có số đo thời gian
thật**; p50 / p95 thời gian thật sẽ có từ sổ `NhatKy_HieuNang` sau khi triển khai (`LAY_THONG_KE_HIEU_NANG`).

## Tóm tắt (5.000 hợp đồng)

| Chức năng | Trước | Sau | Thay đổi | Ghi chú |
|---|---|---|---|---|
| Làm mới Draft (nút "🔄 Làm mới", lần đầu) | 10.014 lượt / 51.885.000 ô | **24 lượt / 1.870.003 ô** | −99,8% lượt gọi | Lô rừng của mọi HĐ đổi đọc 1 lần; mốc theo dòng nhật ký |
| Bản đồ GPS (mở lại trong 15 phút) | 3 lượt / 615.063 ô | **0** | −100% | Cache chia mảnh (trước: > 95.000 ký tự là không cache) |
| Bản đồ GPS (mở lần đầu) | 615.063 ô | 390.010 ô | −37% | Đọc theo cột |
| Danh sách khách hàng (lần đầu) | 165.000 ô | 40.000 ô | −76% | 8 / 33 cột |
| Danh sách khách hàng (đổi trang / tìm) | 165.000 ô | **0** | −100% | Cache 5 phút, xóa ngay khi dữ liệu đổi |
| Hợp đồng của 1 khách hàng | 165.000 ô | 5.033 ô | −97% | Cột CCCD + dòng khớp |
| Tổng quan (lần đầu) | 605.000 ô | 310.000 ô | −49% | Cờ ảnh / GPS đọc theo cột |
| Tra cứu: dựng chỉ mục | 215.000 ô | 105.000 ô | −51% | 19/33 + 2/10 cột |
| Đồng bộ thanh toán 30 phút | Tính lại Draft **mọi** HĐ mỗi khi file DNTT có sửa | Chỉ HĐ có thanh toán đổi; toàn bộ 24 giờ / lần | — | Đo bằng test P1-TT (đếm HĐ được tính lại), không qua `do_hieu_suat` |
| Tạo / sửa / lưu chính thức | | | 0% | Không đổi (đã tối ưu đợt 04/10) |

Một số thao tác có **số lượt gọi tăng nhẹ** (vd danh sách khách hàng 1 → 3) vì đọc 3 khối cột nhỏ thay cho 1 khối cả bảng:
tổng số ô giảm 76%, và từ lần thứ 2 là 0 lượt. Với dữ liệu nhỏ (100 HĐ) lợi ích không đáng kể — tối ưu nhắm vào 1.000 HĐ trở lên.

Mục tiêu thời gian trong yêu cầu (danh sách khách hàng < 2 s, tra cứu < 2 s, chi tiết < 3 s, lưu < 5 s, báo cáo < 5 s, ảnh < 3 s)
**chưa được kiểm chứng** — cần đo trên Apps Script thật bằng sổ hiệu năng.

## Chi tiết từng quy mô

### 100 hợp đồng

| Nhóm | Thao tác | Lượt đọc cũ → mới | Ô đọc cũ → mới | Giảm ô đọc | Lượt ghi cũ → mới |
|---|---|---:|---:|---:|---:|
| Tra cứu | Tìm theo tên (Tra cứu HĐ) | 2 → 4 | 4.300 → 2.100 | −51% | 0 → 0 |
| Tra cứu | Tìm theo CCCD | 0 → 0 | 0 → 0 | — | 0 → 0 |
| Tra cứu | Xem chi tiết 1 HĐ (Tra cứu) | 10 → 10 | 1.164 → 1.164 | 0% | 0 → 0 |
| Tra cứu | Danh sách khách hàng (Nhập liệu) | 1 → 3 | 3.300 → 800 | −76% | 0 → 0 |
| Tra cứu | Danh sách khách hàng: trang 2 / tìm | 1 → 0 | 3.300 → 0 | −100% | 0 → 0 |
| Tra cứu | Tìm tiếp theo tên khác | 0 → 0 | 0 → 0 | — | 0 → 0 |
| Tra cứu | HĐ của 1 khách hàng | 1 → 2 | 3.300 → 133 | −96% | 0 → 0 |
| Tra cứu | Mở 1 HĐ ở Nhập liệu | 6 → 6 | 483 → 483 | 0% | 0 → 0 |
| Tra cứu | Thanh tiến độ 5 bước | 8 → 8 | 1.033 → 1.033 | 0% | 0 → 0 |
| Tra cứu | Tab Lô rừng | 2 → 2 | 240 → 240 | 0% | 0 → 0 |
| Tra cứu | Tab Số tài khoản | 2 → 2 | 110 → 110 | 0% | 0 → 0 |
| Tra cứu | Tab GPS của 1 lô | 2 → 2 | 540 → 540 | 0% | 0 → 0 |
| Tra cứu | Tab Ảnh của 1 lô | 0 → 0 | 0 → 0 | — | 1 → 1 |
| Tra cứu | Tổng quan hợp đồng | 3 → 4 | 12.100 → 6.200 | −49% | 0 → 0 |
| Tra cứu | Tổng quan (mở lại / đổi bộ lọc) | 1 → 1 | 3.100 → 3.100 | 0% | 0 → 0 |
| Tra cứu | Bản đồ GPS (mở lần đầu) | 3 → 3 | 12.363 → 7.810 | −37% | 0 → 0 |
| Tra cứu | Bản đồ GPS (mở lại) | 0 → 0 | 0 → 0 | — | 0 → 0 |
| Tra cứu | Làm mới Draft (không có thay đổi) | 214 → 20 | 57.700 → 37.403 | −35% | 2 → 1 |
| Ghi | Tạo hợp đồng mới | 27 → 27 | 3.178 → 3.178 | 0% | 13 → 13 |
| Ghi | Thêm lô rừng | 26 → 26 | 2.918 → 2.918 | 0% | 12 → 12 |
| Ghi | Thêm tài khoản | 12 → 12 | 1.181 → 1.181 | 0% | 3 → 3 |
| Ghi | Thêm 1 điểm GPS | 16 → 16 | 1.818 → 1.818 | 0% | 3 → 3 |
| Sửa | Sửa thông tin HĐ (SĐT) | 16 → 16 | 1.328 → 1.328 | 0% | 6 → 6 |
| Sửa | Sửa lô rừng (đơn giá) | 23 → 23 | 2.316 → 2.316 | 0% | 8 → 8 |
| Sửa | Lưu lô không đổi gì | 2 → 2 | 222 → 222 | 0% | 0 → 0 |
| Sửa | Sửa tài khoản | 15 → 15 | 1.815 → 1.815 | 0% | 3 → 3 |
| Sửa | Duyệt trạng thái | 13 → 13 | 1.193 → 1.193 | 0% | 0 → 0 |
| Sửa | Sửa qua nháp: mở nháp | 8 → 8 | 518 → 518 | 0% | 3 → 3 |
| Sửa | Sửa qua nháp: lưu nháp | 2 → 2 | 2 → 2 | 0% | 3 → 3 |
| Sửa | Sửa qua nháp: lưu chính thức | 21 → 21 | 1.501 → 1.501 | 0% | 6 → 6 |

### 1.000 hợp đồng

| Nhóm | Thao tác | Lượt đọc cũ → mới | Ô đọc cũ → mới | Giảm ô đọc | Lượt ghi cũ → mới |
|---|---|---:|---:|---:|---:|
| Tra cứu | Tìm theo tên (Tra cứu HĐ) | 2 → 4 | 43.000 → 21.000 | −51% | 0 → 0 |
| Tra cứu | Tìm theo CCCD | 0 → 0 | 0 → 0 | — | 0 → 0 |
| Tra cứu | Xem chi tiết 1 HĐ (Tra cứu) | 10 → 10 | 10.164 → 10.164 | 0% | 0 → 0 |
| Tra cứu | Danh sách khách hàng (Nhập liệu) | 1 → 3 | 33.000 → 8.000 | −76% | 0 → 0 |
| Tra cứu | Danh sách khách hàng: trang 2 / tìm | 1 → 0 | 33.000 → 0 | −100% | 0 → 0 |
| Tra cứu | Tìm tiếp theo tên khác | 0 → 0 | 0 → 0 | — | 0 → 0 |
| Tra cứu | HĐ của 1 khách hàng | 1 → 2 | 33.000 → 1.033 | −97% | 0 → 0 |
| Tra cứu | Mở 1 HĐ ở Nhập liệu | 6 → 6 | 4.083 → 4.083 | 0% | 0 → 0 |
| Tra cứu | Thanh tiến độ 5 bước | 8 → 8 | 9.133 → 9.133 | 0% | 0 → 0 |
| Tra cứu | Tab Lô rừng | 2 → 2 | 2.040 → 2.040 | 0% | 0 → 0 |
| Tra cứu | Tab Số tài khoản | 2 → 2 | 1.010 → 1.010 | 0% | 0 → 0 |
| Tra cứu | Tab GPS của 1 lô | 2 → 2 | 5.040 → 5.040 | 0% | 0 → 0 |
| Tra cứu | Tab Ảnh của 1 lô | 0 → 0 | 0 → 0 | — | 1 → 1 |
| Tra cứu | Tổng quan hợp đồng | 3 → 4 | 121.000 → 62.000 | −49% | 0 → 0 |
| Tra cứu | Tổng quan (mở lại / đổi bộ lọc) | 1 → 1 | 31.000 → 31.000 | 0% | 0 → 0 |
| Tra cứu | Bản đồ GPS (mở lần đầu) | 3 → 3 | 123.063 → 78.010 | −37% | 0 → 0 |
| Tra cứu | Bản đồ GPS (mở lại) | 3 → 0 | 123.063 → 0 | −100% | 0 → 0 |
| Tra cứu | Làm mới Draft (không có thay đổi) | 2.014 → 20 | 2.377.000 → 374.003 | −84% | 2 → 1 |
| Ghi | Tạo hợp đồng mới | 27 → 27 | 30.178 → 30.178 | 0% | 13 → 13 |
| Ghi | Thêm lô rừng | 26 → 26 | 26.318 → 26.318 | 0% | 12 → 12 |
| Ghi | Thêm tài khoản | 12 → 12 | 10.181 → 10.181 | 0% | 3 → 3 |
| Ghi | Thêm 1 điểm GPS | 16 → 16 | 16.218 → 16.218 | 0% | 3 → 3 |
| Sửa | Sửa thông tin HĐ (SĐT) | 16 → 16 | 11.228 → 11.228 | 0% | 6 → 6 |
| Sửa | Sửa lô rừng (đơn giá) | 23 → 23 | 20.316 → 20.316 | 0% | 8 → 8 |
| Sửa | Lưu lô không đổi gì | 2 → 2 | 2.022 → 2.022 | 0% | 0 → 0 |
| Sửa | Sửa tài khoản | 15 → 15 | 16.215 → 16.215 | 0% | 3 → 3 |
| Sửa | Duyệt trạng thái | 13 → 13 | 10.193 → 10.193 | 0% | 0 → 0 |
| Sửa | Sửa qua nháp: mở nháp | 8 → 8 | 4.118 → 4.118 | 0% | 3 → 3 |
| Sửa | Sửa qua nháp: lưu nháp | 2 → 2 | 2 → 2 | 0% | 3 → 3 |
| Sửa | Sửa qua nháp: lưu chính thức | 21 → 21 | 12.301 → 12.301 | 0% | 6 → 6 |

### 5.000 hợp đồng

| Nhóm | Thao tác | Lượt đọc cũ → mới | Ô đọc cũ → mới | Giảm ô đọc | Lượt ghi cũ → mới |
|---|---|---:|---:|---:|---:|
| Tra cứu | Tìm theo tên (Tra cứu HĐ) | 2 → 4 | 215.000 → 105.000 | −51% | 0 → 0 |
| Tra cứu | Tìm theo CCCD | 0 → 0 | 0 → 0 | — | 0 → 0 |
| Tra cứu | Xem chi tiết 1 HĐ (Tra cứu) | 10 → 10 | 50.164 → 50.164 | 0% | 0 → 0 |
| Tra cứu | Danh sách khách hàng (Nhập liệu) | 1 → 3 | 165.000 → 40.000 | −76% | 0 → 0 |
| Tra cứu | Danh sách khách hàng: trang 2 / tìm | 1 → 0 | 165.000 → 0 | −100% | 0 → 0 |
| Tra cứu | Tìm tiếp theo tên khác | 0 → 0 | 0 → 0 | — | 0 → 0 |
| Tra cứu | HĐ của 1 khách hàng | 1 → 2 | 165.000 → 5.033 | −97% | 0 → 0 |
| Tra cứu | Mở 1 HĐ ở Nhập liệu | 6 → 6 | 20.083 → 20.083 | 0% | 0 → 0 |
| Tra cứu | Thanh tiến độ 5 bước | 8 → 8 | 45.133 → 45.133 | 0% | 0 → 0 |
| Tra cứu | Tab Lô rừng | 2 → 2 | 10.040 → 10.040 | 0% | 0 → 0 |
| Tra cứu | Tab Số tài khoản | 2 → 2 | 5.010 → 5.010 | 0% | 0 → 0 |
| Tra cứu | Tab GPS của 1 lô | 2 → 2 | 25.040 → 25.040 | 0% | 0 → 0 |
| Tra cứu | Tab Ảnh của 1 lô | 0 → 0 | 0 → 0 | — | 1 → 1 |
| Tra cứu | Tổng quan hợp đồng | 3 → 4 | 605.000 → 310.000 | −49% | 0 → 0 |
| Tra cứu | Tổng quan (mở lại / đổi bộ lọc) | 1 → 1 | 155.000 → 155.000 | 0% | 0 → 0 |
| Tra cứu | Bản đồ GPS (mở lần đầu) | 3 → 3 | 615.063 → 390.010 | −37% | 0 → 0 |
| Tra cứu | Bản đồ GPS (mở lại) | 3 → 0 | 615.063 → 0 | −100% | 0 → 0 |
| Tra cứu | Làm mới Draft (không có thay đổi) | 10.014 → 24 | 51.885.000 → 1.870.003 | −96% | 2 → 2 |
| Ghi | Tạo hợp đồng mới | 27 → 27 | 150.178 → 150.178 | 0% | 13 → 13 |
| Ghi | Thêm lô rừng | 26 → 26 | 130.318 → 130.318 | 0% | 12 → 12 |
| Ghi | Thêm tài khoản | 12 → 12 | 50.181 → 50.181 | 0% | 3 → 3 |
| Ghi | Thêm 1 điểm GPS | 16 → 16 | 80.218 → 80.218 | 0% | 3 → 3 |
| Sửa | Sửa thông tin HĐ (SĐT) | 16 → 16 | 55.228 → 55.228 | 0% | 6 → 6 |
| Sửa | Sửa lô rừng (đơn giá) | 23 → 23 | 100.316 → 100.316 | 0% | 8 → 8 |
| Sửa | Lưu lô không đổi gì | 2 → 2 | 10.022 → 10.022 | 0% | 0 → 0 |
| Sửa | Sửa tài khoản | 15 → 15 | 80.215 → 80.215 | 0% | 3 → 3 |
| Sửa | Duyệt trạng thái | 13 → 13 | 50.193 → 50.193 | 0% | 0 → 0 |
| Sửa | Sửa qua nháp: mở nháp | 8 → 8 | 20.118 → 20.118 | 0% | 3 → 3 |
| Sửa | Sửa qua nháp: lưu nháp | 2 → 2 | 2 → 2 | 0% | 3 → 3 |
| Sửa | Sửa qua nháp: lưu chính thức | 21 → 21 | 60.301 → 60.301 | 0% | 6 → 6 |
