# 03 — Báo cáo hiệu năng (Performance Report)

## 1. Phương pháp và giới hạn

- Không có quyền vào project Apps Script / Sheet thật → **không đo được thời gian thực**.
- Thay vào đó đo **số lượt gọi Sheets API** (mỗi `getValues`/`setValues` là 1 vòng mạng tới máy chủ Google — thường 50–300 ms, tăng theo kích thước vùng đọc) và **số ô được đọc**, bằng cách chạy chính mã `.gs` của dự án trong một bộ giả lập Apps Script. Đây là chỉ số quyết định thời gian chạy trên Apps Script; thời gian quy đổi bên dưới là **ước tính** theo giả định đó.
- Giới hạn của Apps Script/Sheets liên quan: **6 phút/lượt chạy**, 100 KB/giá trị ScriptCache, 50.000 ký tự/ô, và giới hạn kích thước dữ liệu trả về qua `google.script.run` (lý do dự án đã phải phân trang một số danh sách).

## 2. Đã tối ưu (số liệu đo được)

### PERF-001 🔴 Đồng bộ thanh toán / làm mới Draft: N+1 → hàng loạt (`8cbf662`)
Trước: với mỗi hợp đồng gọi `CAP_NHAT_DRAFT_MOT_HOP_DONG`, hàm này tự đọc lại **toàn bộ** HD_NCC, HD_RUNG, HD_STK, HD_Picture, HD_GPS. Sau: `capNhatDraftHangLoat_` đọc mỗi sheet 1 lần, gom nhóm trong bộ nhớ, ghi 1 lần.

| Số hợp đồng | Lượt đọc (cũ → mới) | Lượt ghi (cũ → mới) | Số ô đọc (cũ → mới) |
|---:|---|---|---|
| 10 | 60 → **6** | 10 → **2** | 13.580 → **1.658** |
| 50 | 300 → **6** | 50 → **2** | 335.900 → **8.218** |
| 200 | 1.200 → **6** | 200 → **2** | 5.363.600 → **32.818** |

Chi phí cũ tăng **bậc hai** theo số hợp đồng (N lần × đọc cả sheet cỡ N). Ước tính với 100–300 ms/lượt đọc: 200 hợp đồng ≈ 2–6 phút → trigger 30 phút/lần có nguy cơ bị Google cắt ngang ở vài trăm hợp đồng, để lại "Khối lượng thực hiện" cũ mà không báo lỗi. Sau tối ưu: số lượt gọi cố định. Kết quả đầu ra được kiểm chứng **giống hệt** cách cũ (T-PERF-001).

### PERF-005 🟡 Kiểm tra ảnh đã chọn: đọc HD_GPS mỗi ảnh → 1 lần (`f20ae5a`)
`KIEM_TRA_ANH_DA_CHON` tính tọa độ đăng ký cho từng ảnh bằng cách đọc lại **cả sheet HD_GPS** và so khớp lồng O(số lô × số điểm). Đo trên 103 ảnh: **103 lượt đọc HD_GPS → 1**; kết quả so khớp từng bit với bản cũ (giữ nguyên thứ tự cộng dồn nên trung bình không lệch dấu phẩy động).

### Khác
- `ngayToISO_` nhớ đệm kết quả theo thời điểm → các báo cáo nhiều dòng trùng ngày gọi `Utilities.formatDate` 1 lần cho mỗi ngày khác nhau.
- Tải trang báo cáo đã gộp 4 RPC thành 1 (`TAI_TRANG_BAO_CAO_TONG_HOP`, có từ trước).

## 3. Còn tồn tại (xếp theo tác động)

| ID | Mức | Vị trí | Vấn đề | Đề xuất |
|---|---|---|---|---|
| PERF-002 | 🟠 | `docToanBoDraftBaoCao_` → `layCoAnhVaGpsTrucTiep_` (00) | Mỗi lần mở báo cáo đọc thêm toàn bộ HD_RUNG + HD_GPS + HD_Picture để tính lại "có ảnh / đủ GPS" dù Draft đã có sẵn 2 cột này | Tin cột Draft (đã cập nhật ở mọi điểm ghi) hoặc cache kết quả trong ScriptCache 5 phút, xóa ở các điểm ghi ảnh/GPS (cùng danh sách với `xoaCacheBanDo_`) |
| PERF-003 | 🟡 | `DONG_BO_THONG_TIN_MO_RONG` (28) | Ghi từng ô `setValue` trong vòng lặp | Gom thay đổi, ghi theo cột bằng `setValues` (chỉ chạy từ menu bảo trì) |
| PERF-004 | 🟡 | `CHUYEN_DOI_*_SANG_URL` (20) | Đọc/ghi từng dòng | Xử lý theo khối 500 dòng, vẫn giữ cơ chế dừng an toàn |
| SCALE-002 | 🟡 | Xem chi tiết 1 hợp đồng | Đọc toàn bộ HD_RUNG/HD_STK/HD_Picture/HD_GPS rồi lọc | Cache ngắn hạn theo `idHD`, hoặc sheet chỉ mục `idHD → dòng` |
| SCALE-003 | ⚪ | Danh sách hợp đồng (phân trang) | Phân trang ở client; mỗi lần tìm/đổi trang đọc lại cả HD_NCC | Cache HD_NCC 60 giây trong ScriptCache (xóa khi ghi) |
| LOCK-WAIT | ⚪ | Mọi hàm có `waitLock(15000)` | Khi nhiều người nhập cùng lúc, người thứ N chờ tối đa 15 s rồi báo "Hệ thống đang bận" | Chấp nhận được với quy mô hiện tại; theo dõi qua log `WARNING` |

**Ngưỡng cần theo dõi:** HD_GPS và HD_Picture là 2 sheet tăng nhanh nhất (nhiều dòng/lô). Các đường đọc toàn sheet ở bảng trên bắt đầu đáng kể khi HD_GPS vượt ~20.000 dòng.

## 4. Phía trình duyệt (Frontend)

| Hạng mục | Kết quả |
|---|---|
| Kích thước trang | 10–111 KB HTML/trang, không có ảnh nhúng; chỉ tải Leaflet (~150 KB, CDN cache) ở trang bản đồ |
| DOM render | 360 lệnh gán `innerHTML` — dựng chuỗi HTML rồi gán **1 lần** cho mỗi bảng (không gán trong vòng lặp từng dòng) → không có layout thrashing đáng kể. 4 trang có thêm `appendChild` từng dòng cho bảng cây (trang 10) — chấp nhận được ở số dòng hiện tại (phân trang 20) |
| Event listener | 186 `addEventListener`, 0 `removeEventListener` — đa số gắn 1 lần lúc tải trang; một số gắn vào phần tử được tạo lại mỗi lần mở modal (trang 27), phần tử cũ bị xóa cùng listener → không rò rỉ |
| Timer | 0 `setInterval`; 11 `setTimeout` (debounce lưu nháp 700 ms, tìm kiếm) ✅ |
| Debounce | Có cho lưu nháp và tìm kiếm ✅ |
| Bundle / Minify / Code splitting / Worker / Virtual scroll | **N/A** — Apps Script phục vụ HTML trực tiếp, không có bước build; danh sách đã phân trang 20 dòng nên không cần virtual scroll |
| Memory leak | Không phát hiện (không có biến toàn cục tích lũy, không interval) |

## 5. Đo lại sau khi triển khai

1. Apps Script → **Executions**: xem cột Duration của `dongBoThanhToanNeuCoThayDoi_`, `TAI_TRANG_BAO_CAO_TONG_HOP`, `KIEM_TRA_ANH_DA_CHON`.
2. Menu Sheet → **⏱️ Chẩn đoán tốc độ báo cáo** (có sẵn) để đo từng bước.
3. Lọc log `WARNING` / `ERROR` mới (hàm `log_`) trong Executions để phát hiện cache không ghi được.
