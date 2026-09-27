# 10 — Tổng kết (Final Summary)

**Dự án:** HDMB_HAK — quản lý hợp đồng mua bán gỗ keo (Google Apps Script) · **Ngày:** 27/09/2026 · **Nhánh:** `claude/test-code-bug-project-nywz0r`

## 1. Kết luận ngắn

- Đợt 2 tìm ra và **sửa 10 lỗi thật + 4 lỗ hổng bảo mật**, trong đó 4 lỗi làm **sai/mất dữ liệu hợp đồng** mà người dùng khó tự phát hiện (ngày lùi dần, mất MST/Nhóm KH, mất số 0 đầu CCCD, tạo hợp đồng trùng). Mỗi bản sửa đều có test tự động **thất bại trên mã cũ, đạt trên mã mới**.
- Đợt 3 **xóa mã chết** (3 trang, 20 hàm), **gộp mã trùng** (79 → 2 nhóm hàm trùng, qua 2 partial), **escape toàn bộ điểm chèn HTML còn lại** và **chặn ghi lệch cột** khi ai đó chèn/xóa cột tay trong Sheet (MAP-001).
- Kiểm thử đợt 3: server 24/24, trình duyệt 27/27 (mã trước khi rà soát `8cbf662`: 8/24 và 13/26).
- Đợt 4 (theo yêu cầu của chủ dự án): **đăng nhập Gmail + phân quyền theo đúng mô hình DNTT** cho toàn bộ webapp — đóng lỗ hổng lớn nhất còn lại (SEC-002: 171 hàm gọi được ẩn danh → 0; 38 hàm menu/trigger còn công khai đều kiểm tra quyền), và **trang 🔍 Tra cứu hợp đồng**. Test: **server 32/32, trình duyệt 36/36**.
- Trước khi dùng thật cần làm **T-AUTH** trong `09_TODO.md` (dựng Cổng đăng nhập + thêm người dùng) — nếu bỏ qua, chỉ tài khoản chủ và 2 Quản trị cố định vào được.

## 2. Đã làm

| Nhóm | Kết quả |
|---|---|
| Phân tích kiến trúc | Bộ phân tích tĩnh: trước 19.058 dòng / 79 nhóm hàm trùng → sau dọn **16.356 dòng / 2 nhóm**; hiện 18.033 dòng, 310 hàm server (47 công khai, đều có kiểm tra quyền hoặc là đầu vào đăng nhập) (`04_ARCHITECTURE.md`) |
| Lỗi dữ liệu (🔴🟠) | BUG-01 ngày lùi 1 ngày/lần lưu (3 màn hình) · BUG-02 mất Nhóm KH/MST · BUG-03 mất số 0 đầu · BUG-04 cắt cụt giá trị có dấu `"` · BUG-05 hợp đồng trùng khi bấm lặp · BUG-06 xóa nhầm nháp người khác |
| Lỗi chức năng (🟡⚪) | Sidebar 07 lệch phiên bản (ảnh GPS, ảnh chung) · menu Cài đặt Vùng hỏng · menu dọn file MISA thiếu · 5 lỗi bị nuốt im lặng |
| Bảo mật | Chuỗi tấn công vượt `?action=run` (SEC-006 + SEC-007) · XSS qua tên file/link (SEC-008) · chèn thuộc tính qua dấu nháy · tải lên file tùy ý vào Drive chủ sở hữu (SEC-009) · link chatbot (SEC-011) · 116 điểm `innerHTML` còn lại (dữ liệu Sheet, dữ liệu tra cứu ngân hàng) · bớt 12 hàm công khai do xóa mã chết |
| Hiệu năng | Đồng bộ thanh toán: 200 hợp đồng 1.200 → 6 lượt đọc Sheet · kiểm tra ảnh: 103 → 1 lượt đọc HD_GPS |
| Chất lượng mã | `doGet` 135 → 43 dòng (hành vi giữ nguyên) · log có mức độ ra Cloud Logging · bỏ `alert()` chặn màn hình · 67 hàm chung của 07/11 → `NhapLieu_Chung_JS.html` · chatbot 10/27/30 → `ChatbotWidget.html` · xóa `26`, `08`, `09` + 19 hàm server không ai gọi |
| Đăng nhập & phân quyền | Cổng đăng nhập Gmail (HMAC, link 5 phút dùng 1 lần) → phiên 6 giờ · 3 vai trò · 1 cửa `api()` + bảng quyền 123 chức năng · 133 hàm thành riêng tư · nhật ký ghi đúng người thao tác (`34_PhanQuyen.gs`, `PhanQuyen_JS.html`) |
| Tra cứu hợp đồng | Trang mới `?page=tracuu`: tìm không dấu / số 1 phần / số TK ở HD_STK; chi tiết hợp đồng, thực hiện, lô rừng + GPS, tài khoản, hồ sơ, ảnh; che số với vai trò Chỉ xem |
| Toàn vẹn dữ liệu | MAP-001: kiểm tra tiêu đề cột 6 sheet trước khi đọc/ghi; cột bị dịch → dừng và báo rõ, thay vì ghi lệch cột âm thầm |
| Kiểm thử | Bộ giả lập Apps Script chạy toàn bộ `.gs` + bộ test trình duyệt Chromium; test tương đương cho mọi tái cấu trúc |

Không xóa chức năng đang dùng (chỉ xóa mã không có đường gọi tới — kiểm chứng bằng bộ phân tích + `doGet` 29/29 giống hệt), không đổi tên cột/sheet, không đổi bố cục giao diện.

## 3. Việc chủ dự án cần làm ngay (chi tiết: `09_TODO.md` mục A–B)

1. Triển khai **phiên bản mới** (giữ phiên bản cũ để quay lui). Nếu chép tay: **tạo 6 file mới** `NhapLieu_Chung_JS`, `ChatbotWidget`, `PhanQuyen_JS`, `33_Page_TraCuuHopDong` (.html), `33_TraCuuHopDong`, `34_PhanQuyen` (.gs) và **xóa 3 file** `26_Page_QuanLyMeCon`, `08_Sidebar`, `09_Style`.
2. Đặt `ADMIN_TOKEN` / `SYNC_TOKEN` thật trong Script Properties.
3. **Kiểm tra dữ liệu cũ**: hợp đồng từng được sửa có thể đã bị lùi ngày; hợp đồng tạo từ trang Nhập liệu/sidebar có thể mất số 0 đầu CCCD/SĐT.
4. Làm **T-AUTH**: dựng Cổng đăng nhập Gmail, thêm người dùng + vai trò (hướng dẫn từng bước trong `09_TODO.md`).
5. Cho biết webapp có nhúng vào trang khác không (chống clickjacking); cân nhắc đặt repo GitHub về Private.

## 4. Giới hạn của đợt rà soát (nói rõ để không hiểu nhầm)

- Không truy cập được project Apps Script / Google Sheet / Drive thật → **không đo thời gian thực**, không chạy trigger thật, không test xuất Excel/PDF/MISA. Hiệu năng được đo bằng **số lượt gọi Sheets API** trong bộ giả lập.
- Bộ giả lập mô phỏng các hành vi của Google Sheets liên quan tới các lỗi đã tìm (ép kiểu số/ngày khi ghi, múi giờ, xóa dòng); các hành vi khác của Google có thể khác nhỏ.
- Nhiều mục trong danh sách yêu cầu **không áp dụng** cho kiến trúc Apps Script thuần (Bundle, Minify, Code splitting, Worker, IndexedDB, Virtual scroll, Dark mode, CORS/CSP tự cấu hình) — được ghi rõ "N/A" kèm lý do thay vì báo cáo phát hiện giả.
- Chưa có test tự động cho Tìm kiếm/Lọc/Sắp xếp/Phân trang và Xuất file.

## 5. Danh mục tài liệu

| File | Nội dung |
|---|---|
| `01_BUG_REPORT.md` | Toàn bộ lỗi: đã sửa (kèm nguyên nhân, ảnh hưởng, test) và còn tồn tại |
| `02_SECURITY_REPORT.md` | Mô hình đe dọa, lỗ hổng đã sửa, đăng nhập & phân quyền (SEC-002) |
| `03_PERFORMANCE_REPORT.md` | Số liệu đo trước/sau, điểm nghẽn còn lại |
| `04_ARCHITECTURE.md` | Kiến trúc, dữ liệu, luồng, trùng lặp, mã chết |
| `05_OPTIMIZATION.md` | Kỹ thuật đã áp dụng / đề xuất / không áp dụng |
| `06_REFACTOR_PLAN.md` | 7 bước tái cấu trúc có kiểm chứng và quay lui |
| `07_TEST_RESULT.md` | Kết quả từng test trên mã mới và mã cũ |
| `08_CHANGELOG.md` | Từng commit |
| `09_TODO.md` | Việc cần làm, xếp theo mức ưu tiên |
