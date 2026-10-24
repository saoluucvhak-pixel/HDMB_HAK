# 05 — Tối ưu hóa (Optimization)

Danh sách kỹ thuật tối ưu trong yêu cầu, đối chiếu với **kiến trúc thực tế** (Apps Script + HTML thuần, không bundler). Chỉ áp dụng khi có lợi đo được và không đổi hành vi.

## 1. Đã áp dụng

| Kỹ thuật | Ở đâu | Kết quả |
|---|---|---|
| **Batch Read / Batch Update** | `capNhatDraftHangLoat_` (01) | 200 hợp đồng: 1.200 → 6 lượt đọc, 200 → 2 lượt ghi |
| **Batch Read + Hash Map (Set)** | `KIEM_TRA_ANH_DA_CHON` (02) | 103 ảnh: 103 → 1 lượt đọc HD_GPS; tra lô bằng `Set` thay cho vòng lặp lồng |
| **Memoization** | `ngayToISO_` (theo thời điểm), `toaDoTrungBinhCuaHD` (theo hợp đồng), `layMuiGioBangTinh_` (1 lần/lượt chạy) | |
| **Cache + invalidation đúng chỗ** | `xoaCacheBanDo_()` gọi ở cả 6 điểm ghi HD_GPS/HD_RUNG | Bản đồ không còn hiện dữ liệu cũ 15 phút |
| **Idempotency / chống gửi lặp** | `LUU_CHINH_THUC` (khóa nhận nháp trong ScriptCache) + cờ chặn bấm lặp ở 07/11/27 | Không còn tạo hợp đồng trùng |
| **Lock ngắn, không lồng** | Nhận nháp dưới lock rồi nhả trước khi gọi các hàm ghi | Tránh giữ lock lâu làm người khác chờ |
| **Template reuse / bảng cấu hình** | `TRANG_WEBAPP_` thay 10 khối `if` chép lại trong `doGet` | 135 → 43 dòng, thêm trang mới = thêm 1 dòng |
| **Non-blocking UI** | `thongBao_` thay `alert()` (46 chỗ) | Không còn chặn luồng giao diện |
| **Debounce** | Lưu nháp (700 ms), ô tìm kiếm | Có sẵn — giữ nguyên |
| **Partial dùng chung (`include`)** | `NhapLieu_Chung_JS.html` (67 hàm của 07/11), `ChatbotWidget.html` (widget của 10/27/30) | ~1.900 dòng trùng còn 1 bản; nhóm hàm trùng 79 → 2 |
| **Dead code elimination** | 3 trang + 19 hàm server + 1 hàm client không ai gọi (`e5d5680`) | Toàn dự án 19.058 → 16.356 dòng (gồm cả phần gộp partial); bớt 12 hàm công khai gọi được ẩn danh |
| **Fail-fast kiểm tra cấu trúc (có cache)** | `kiemTraCauTrucCot_` trong `getSheet_` (MAP-001) | Dừng trước khi ghi lệch cột; kiểm tra 1 lần/lượt chạy, nhớ 60 s |

## 2. Đề xuất (chưa làm — có lợi rõ ràng)

| Kỹ thuật | Ở đâu | Lợi ích | Rủi ro |
|---|---|---|---|
| Cache ngắn hạn + xóa khi ghi | `readData_(HD_NCC)` cho danh sách (SCALE-003) | Bớt 1 lượt đọc toàn sheet mỗi lần tìm/đổi trang danh sách (PERF-002 giữ nguyên theo thiết kế của tác giả — xem 03) | Phải liệt kê đủ điểm ghi để xóa cache (bài học CACHE-001) |
| Batch write theo cột | `DONG_BO_THONG_TIN_MO_RONG`, `CHUYEN_DOI_*` | Giảm số lượt ghi từ O(số ô) xuống O(số cột) | Thấp — chỉ chạy từ menu |
| Event Delegation | Nút trong bảng dựng bằng `onclick="f('…')"` (195 chỗ) | Bỏ được lỗi JS-in-attribute (xem 02), code gọn hơn | Trung bình — nhiều chỗ |
| DocumentFragment | Bảng cây ở trang 10 (`appendChild` từng dòng) | Nhỏ ở 20 dòng/trang | Thấp |
| Partial helper nhỏ | `thongBao_` (4 bản), `showMsg` (3 bản) | Bớt vài chục dòng | Thấp — lợi ích nhỏ nên để sau |

## 3. Không áp dụng (N/A) và lý do

| Kỹ thuật | Lý do |
|---|---|
| Lazy Loading / Code Splitting / Bundle / Minify / Compression | Không có bước build; mỗi trang là 1 file HTML do `HtmlService` phục vụ (Google đã nén khi truyền). Tách file JS riêng không giảm được lượt tải vì Apps Script vẫn ghép vào 1 trang |
| Virtual Scroll | Danh sách đã phân trang 20 dòng |
| Web Worker | Không có tác vụ nặng phía trình duyệt; phần nặng nằm ở server |
| Object Pool | Không có cấp phát đối tượng lặp lại đáng kể |
| requestAnimationFrame | Không có animation / cập nhật liên tục |
| IndexedDB | Dữ liệu phải luôn mới từ Sheet (nhiều người cùng sửa); lưu cục bộ dễ gây hiển thị dữ liệu cũ |
| State Management framework | Trạng thái đơn giản (biến `duNhap`, `wz`, `ctxHD` theo trang); thêm framework là thừa |

## Đợt 11/10/2026 (nhánh `feature/hdmb-performance-optimization`)

Số đo: `PERFORMANCE_COMPARISON.md`. Kết quả nghiệp vụ không đổi: `DATA_INTEGRITY_TEST.md` (110/110 trường hợp giống mã cũ).

| Kỹ thuật | Ở đâu | Kết quả (bộ giả lập, 5.000 HĐ) |
|---|---|---|
| **Đọc theo cột** (`docCacCot_`) | Danh sách KH, chỉ mục Tra cứu, cờ ảnh/GPS, bản đồ, phiếu cân | Danh sách KH 165.000 → 40.000 ô; Tổng quan 605.000 → 310.000; bản đồ lần đầu 615.063 → 390.010 |
| **Đọc theo khóa** (cột khóa + dòng khớp) | Hợp đồng của 1 khách hàng | 165.000 → 5.033 ô |
| **Cache có xóa đúng lúc** | Danh sách KH (5 phút), bản đồ (chia mảnh, 15 phút) | Đổi trang / mở lại: 0 ô đọc |
| **Gom N lượt đọc thành 1** | Làm mới Draft: lô rừng của mọi HĐ đổi | 10.014 → 24 lượt đọc |
| **Mốc theo dòng** (nhật ký chỉ ghi thêm) | Làm mới Draft | Chỉ đọc dòng nhật ký mới |
| **Đồng bộ tăng dần theo bản đã áp dụng** | Đồng bộ thanh toán 30 phút | Chỉ tính lại HĐ có thanh toán đổi; 24 giờ tính lại toàn bộ 1 lần |
| **Ghi theo chênh lệch** | Cập nhật Draft hàng loạt | Chỉ ghi dòng đổi, gom dòng liền nhau; không ghi đè dòng HĐ khác |
| **Đọc 1 lần / lượt** | Bảng DNTT | 2 → 1 lần đọc file ngoài mỗi lượt đồng bộ |

**Không làm (đã đánh giá):**
- Phân vùng bản đồ theo khung nhìn: 20.000 điểm GPS là 1 lần đọc 390.010 ô rồi dùng cache — chưa cần, lại đổi giao diện bản đồ.
- Làm tròn tọa độ để thu nhỏ JSON bản đồ: đổi số hiển thị / diện tích tính phía trình duyệt → không làm (yêu cầu không đổi tọa độ).
- Gộp lệnh ghi của các thao tác Tạo / Sửa: đã tối ưu ở đợt 04/10 (chủ yếu chỉ đọc 1 cột khóa) — đo lại không thấy chỗ lợi rõ.
- Lazy-load ảnh: trang Tra cứu hình ảnh đã tải danh sách trước, ảnh thu nhỏ theo nhóm và nhớ ở DocumentCache 6 giờ.
