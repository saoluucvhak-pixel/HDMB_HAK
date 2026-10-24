# Rà soát HDMB_HAK — 24/10/2026

Nguồn: main, commit 97917a5e143b9351ec5200c229c4fe41036dd2e6. Rà soát tập trung nhập liệu, tra cứu và phản hồi bất đồng bộ; không phải chứng nhận toàn bộ hệ thống không có lỗi.

## Các lỗi đã sửa

1. Tra cứu: đang tìm mà đổi nhanh khoảng ngày thì yêu cầu mới bị bỏ qua; kết quả cũ vẫn hiện. Thêm số phiên yêu cầu và cho phép bộ lọc mới thay thế kết quả đang đợi. Phản hồi cũ (cả thành công và lỗi) không được sửa giao diện.
2. Chi tiết hợp đồng: lỗi cũ vẫn ghi đè hợp đồng mới; quay lại danh sách hoặc tìm mới chưa vô hiệu hóa chi tiết đang tải. Bổ sung phiên chi tiết, kiểm tra trước cả ghi cache và render, vô hiệu hóa khi đổi ngữ cảnh.
3. Danh sách nhập liệu: chỉ vô hiệu hóa lượt tìm cũ khi hết debounce 300 ms. Nay vô hiệu hóa ngay khi gõ; phân trang trực tiếp cũng hủy timer tìm đang chờ.
4. Modal khách hàng: trước đây mỗi phím gõ quét toàn bộ mảng rồi chỉ hiển thị 30 dòng. Nay chờ 150 ms sau lần gõ cuối, dừng khi đủ 30 kết quả, hủy timer khi đóng modal. Trường hợp không khớp vẫn phải quét hết mảng; chưa thay bằng tìm kiếm máy chủ.
5. Bản xem trước hợp đồng chèn địa chỉ/số giấy tờ/loại hồ sơ vào innerHTML chưa escape. Đã escape nhãn và giá trị trước khi dựng HTML.

## Kiểm thử và giới hạn

- Trước và sau sửa: 170/170 ca máy chủ giả lập Apps Script đạt; 50 khối mã không lỗi cú pháp.
- Kiểm thử hồi quy mới `node tests/chong_phan_hoi_cu.cjs` đạt: đảo thứ tự phản hồi, lỗi đến trễ, quay lại, đổi bộ lọc, xóa tìm kiếm, debounce, timer phân trang và lọc 10.000 khách hàng. Trường hợp mọi tên đều khớp chỉ đọc 30 bản ghi thay vì 10.000 (đếm thao tác, không phải phép đo thời gian trình duyệt).
- Đã chạy bộ UI Playwright với Chromium có sẵn: nhóm khóa nút, hộp thoại/bộ lọc, giao diện tối/hỗ trợ truy cập đạt. Nhóm trang thật timeout tại `#dsLo .lo` của bản đồ. Môi trường chưa có dependency leaflet để phục vụ thư viện ngoại tuyến; cần chạy lại sau khi cài đủ dependency. Không coi toàn bộ UI là đạt.
- Chưa đo độ trễ p50/p95, INP hay độ mượt trên bản Google Apps Script đang triển khai; chưa kiểm tra Google Sheets/Drive thật, mạng di động hoặc bộ gõ trên điện thoại thật. Chưa triển khai production.

## Đo tải giả lập 1.000 hợp đồng

Lệnh: `SO_HD=1000 node tests/do_hieu_suat.cjs` (PowerShell: `$env:SO_HD='1000'`). Số liệu là số lần/ô đọc trong mock, không quy đổi sang giây trên Apps Script.

| Thao tác | Lần đọc | Ô đọc |
| --- | ---: | ---: |
| Tra cứu tên, dựng chỉ mục lần đầu | 4 | 21.000 |
| Tra cứu CCCD sau khi có cache | 0 | 0 |
| Chi tiết một hợp đồng | 10 | 10.164 |
| Danh sách khách hàng | 3 | 8.000 |
| Tổng quan | 4 | 62.000 |
| Tổng quan mở lại/đổi lọc | 1 | 31.000 |
| Tạo hợp đồng | 27 | 30.178 |
| Lưu chính thức nháp đã sửa | 21 | 12.301 |

Kịch bản chuyển sang Đang thực hiện bị từ chối do dữ liệu thử thiếu hồ sơ — đúng kiểm tra nghiệp vụ, không được bỏ chặn này để làm kiểm thử xanh.

## Công việc cần tiếp tục

- Tối ưu lượt đọc Sheet trong ghi chính thức/tổng quan dựa trên profiling; tránh gọi Spreadsheet service trong vòng lặp. Giữ phân quyền, khóa ghi, số 0 đầu và cập nhật cache sau ghi.
- Kiểm tra riêng thứ tự các lần tự lưu nháp: hiện mỗi lần tự lưu gọi LUU_DRAFT độc lập; cần thử callback về sai thứ tự trước khi thiết kế hàng đợi gộp thay đổi và cơ chế chờ trước lưu chính thức/chuyển hợp đồng.
- Tải danh sách khách hàng theo trang từ máy chủ nếu số khách hàng tăng lớn; debounce chỉ giảm số lần lọc, không giảm payload tải ban đầu.
- Đo p95 nhập liệu/tra cứu trên deployment thử với bộ dữ liệu đại diện, điều kiện mạng chậm và cache nóng/lạnh. Chỉ kết luận mức tăng tốc sau phép đo trước/sau cùng điều kiện.

## Prompt dùng tiếp

Rà soát và hoàn thiện webapp Google Apps Script tại https://github.com/saoluucvhak-pixel/HDMB_HAK. Đọc BAO_CAO_RA_SOAT_20261024.md và kiểm tra diff hiện tại trước khi sửa. Giữ nguyên nghiệp vụ, phân quyền, dữ liệu Sheet, CCCD/SĐT/số tài khoản có số 0 đầu. Ưu tiên: (1) hoàn tất kiểm thử UI với đủ Playwright và leaflet; (2) mô phỏng mạng chậm, gõ tiếng Việt/IME, phản hồi sai thứ tự và quay lại danh sách; (3) xác minh thứ tự tự lưu nháp, gộp các bản nháp đang chờ theo từng ID mà không làm mất lần nhập cuối, chờ lưu xong trước thao tác chính thức; (4) giảm lượt đọc Sheet của Tổng quan và lưu chính thức bằng đọc theo lô/chỉ mục, vô hiệu hóa cache đúng khi ghi; (5) đo trước/sau trên 1.000 và 10.000 hợp đồng, báo số RPC, lượt/ô đọc Sheet và p50/p95 trên deployment thử nếu có quyền truy cập. Bổ sung kiểm thử hồi quy có ý nghĩa, báo rõ ca đạt/trượt/chưa chạy. Tạo PR để xem xét, không tự merge hay triển khai production. Không tuyên bố hết giật lag khi chưa đo trên trình duyệt và Apps Script thật.
