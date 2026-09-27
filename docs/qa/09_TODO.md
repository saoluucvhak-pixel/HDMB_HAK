# 09 — Việc cần làm (TODO)

## A. BẮT BUỘC khi triển khai bản sửa (chủ dự án thực hiện)

- [ ] **T-DEPLOY** Đồng bộ nhánh vào Apps Script → *Deploy → Manage deployments → Edit → Version: New version*. **Giữ phiên bản cũ** để chọn lại nếu có sự cố.
- [ ] **T-TOKEN** *Project Settings → Script Properties*: đặt `ADMIN_TOKEN` (mật khẩu chia sẻ quyền) và `SYNC_TOKEN` (nếu dùng `?action=run`) bằng chuỗi bí mật riêng. Giá trị mẫu trong code (`DOI_MAT_KHAU_NAY_NGAY`, `DAT_TOKEN_CUA_BAN_O_DAY`) **bị từ chối** — nếu chưa đặt, 2 tính năng này sẽ báo "chưa cấu hình".
- [ ] **T-23** Kiểm tra project thật có file `23_CaiDatVung.html` không (không có trong GitHub). Nếu có → đồng bộ lên GitHub; nếu không → menu "Cài đặt Vùng" đã tự dùng hộp nhập thay thế.
- [ ] **T-CHECK** Sau triển khai: mở 1 hợp đồng có Ngày ký, Nhóm KH, MST và CCCD bắt đầu bằng 0 → kiểm tra hiển thị đúng → sửa 1 trường khác → Lưu → mở lại, kiểm tra không đổi.

## B. KIỂM TRA DỮ LIỆU ĐÃ BỊ ẢNH HƯỞNG (trước khi có bản sửa)

- [ ] **T-01 Ngày bị lùi (BUG-01).** Các hợp đồng đã từng được **sửa** qua trang Nhập liệu, sidebar hoặc trang Thêm/Sửa hợp đồng có thể đã bị lùi Ngày ký / Ngày cấp / Ngày cấp UQ (1 ngày cho mỗi lần lưu). Không thể tự suy ra ngày gốc bằng code. Cách làm: lọc `NhatKy_SuaDoi` theo hành động "Sửa hợp đồng" để lấy danh sách hợp đồng đã sửa → đối chiếu với hợp đồng giấy.
- [ ] **T-02 Mất số 0 đầu (BUG-03).** Hợp đồng tạo từ trang Nhập liệu / sidebar (không phải trang Thêm/Sửa hợp đồng):
  - CCCD 11 chữ số → gần như chắc chắn thiếu số 0 đầu (CCCD luôn 12 số).
  - SĐT 9 chữ số → thiếu số 0.
  - MST: kiểm tra tay (MST có thể không bắt đầu bằng 0).
  Có thể viết hàm sửa hàng loạt cho CCCD/SĐT — **cần chủ dự án đồng ý** vì là thay đổi dữ liệu.
- [ ] **T-02b** Hợp đồng từng bị xóa Nhóm KH / MST khi sửa (BUG-02) — kiểm tra các hợp đồng đã sửa ở trang Nhập liệu.

## C. CẦN QUYẾT ĐỊNH

- [ ] **T-SEC-002 (quan trọng nhất)** Chọn mô hình xác thực — xem `02_SECURITY_REPORT.md` §3 (A: đăng nhập trong ứng dụng / B: bắt đăng nhập Google / C: giới hạn miền Workspace / D: tạm thời ẩn các hàm chỉ dùng từ menu).
- [ ] **T-R1** Đồng ý xóa mã chết: `26_Page_QuanLyMeCon.html`, `08_Sidebar.html`, `09_Style.html` và 15 hàm không dùng (`04_ARCHITECTURE.md` §9).
- [ ] **T-FRAME** Webapp có được nhúng vào Google Sites / trang khác không? Nếu không → đổi `ALLOWALL` thành `DEFAULT` (chống clickjacking) — sửa 1 dòng trong `doGet`.
- [ ] **T-PDPD** Rà soát việc gửi số tài khoản tới `tracuubank.com` và ảnh CCCD tới Gemini theo Nghị định 13/2023/NĐ-CP.

## D. KỸ THUẬT (theo `06_REFACTOR_PLAN.md`)

- [ ] R2 Partial dùng chung (escape, toast, showMsg, format số).
- [ ] R3 Gộp JS chung 07/11.
- [ ] R5 Kiểm tra cấu trúc cột Sheet khi khởi động (MAP-001).
- [ ] R7 Chạy `TEST_LOCK_TAI_NHAP` trên project thật rồi xử lý LOCK-004/006/008.
- [ ] R6 Tách `06_CreateUpdate.gs`.
- [ ] PERF-002 Bỏ lớp đọc lại HD_RUNG/HD_GPS/HD_Picture mỗi lần mở báo cáo.
- [ ] XSS-rest: chuyển thông báo lỗi sang `textContent`; nút trong bảng dùng `data-*` + event delegation.
- [ ] Formula injection: thêm `'` trước giá trị văn bản tự do bắt đầu bằng `= + - @`.
- [ ] BUG-11: đo kích thước JSON nháp lớn nhất; nếu gần 50.000 ký tự thì tách nháp ra nhiều ô.
- [ ] Accessibility: gắn `<label for>` (169 nhãn chưa gắn), `aria-label` cho nút chỉ có biểu tượng, kiểm tra tương phản màu.
- [ ] Test tự động cho Tìm kiếm / Lọc / Sắp xếp / Phân trang và Xuất MISA/Excel (cần môi trường có Drive thật).
