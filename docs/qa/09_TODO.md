# 09 — Việc cần làm (TODO)

## A. BẮT BUỘC khi triển khai bản sửa (chủ dự án thực hiện)

- [ ] **T-DEPLOY** Đồng bộ nhánh vào Apps Script → *Deploy → Manage deployments → Edit → Version: New version*. **Giữ phiên bản cũ** để chọn lại nếu có sự cố.
- [ ] **T-TOKEN** *Project Settings → Script Properties*: đặt `ADMIN_TOKEN` (mật khẩu chia sẻ quyền) và `SYNC_TOKEN` (nếu dùng `?action=run`) bằng chuỗi bí mật riêng. Giá trị mẫu trong code (`DOI_MAT_KHAU_NAY_NGAY`, `DAT_TOKEN_CUA_BAN_O_DAY`) **bị từ chối** — nếu chưa đặt, 2 tính năng này sẽ báo "chưa cấu hình".
- [ ] **T-FILES** Nếu chép file thủ công sang Apps Script:
  - **Tạo 2 file HTML mới** `NhapLieu_Chung_JS` và `ChatbotWidget` (thiếu 1 trong 2 → trang 07/11 hoặc 10/27/30 báo lỗi khi mở).
  - **Đợt 4 — tạo thêm 4 file mới:** `33_TraCuuHopDong` (.gs), `34_PhanQuyen` (.gs), `33_Page_TraCuuHopDong` (.html), `PhanQuyen_JS` (.html). Thiếu `34_PhanQuyen` hoặc `PhanQuyen_JS` → **mọi trang** báo lỗi.
  - **Xóa 3 file** `26_Page_QuanLyMeCon`, `08_Sidebar`, `09_Style` (công cụ đồng bộ có thể không tự xóa).
  - **Đợt 5 (28/09/2026) — tạo thêm 2 file HTML mới:** `38_Page_AnhCongKhai`, `DinhDangSo_JS` (thiếu → trang Nhập liệu / Thêm-Sửa hợp đồng / link ảnh trong QR báo lỗi).
  - Chép đè toàn bộ file `.gs`/`.html` đã đổi (xem `08_CHANGELOG.md`).
- [ ] **T-AUTH (BẮT BUỘC — làm ngay sau khi triển khai đợt 4, nếu không người dùng khác không vào được)**
  1. Mở webapp bằng **tài khoản chủ script** (hoặc `saoluucvhak@gmail.com` / `phuthuy.apple@gmail.com` — Quản trị cố định trong `34_PhanQuyen.gs`) → vào được ngay, không cần Cổng.
  2. **⚙️ Thiết lập › 🔐 Cổng đăng nhập Gmail** → bấm *Sao chép mã nguồn Cổng* → mở [script.new](https://script.new) → dán → *Deploy › New deployment › Web app*: **Execute as: User accessing the web app**, **Who has access: Anyone with Google account** → cấp quyền → copy link `…/exec` → dán vào ô *Link Cổng đăng nhập* → *Lưu*. (Cổng của HDMB là dự án riêng, KHÔNG dùng chung Cổng của DNTT.)
  3. **⚙️ Thiết lập › 👥 Người dùng & phân quyền** → thêm email Google của từng người với vai trò Quản trị / Nhập liệu / Chỉ xem.
  4. Người dùng mở link webapp → *Đăng nhập bằng Google* → *Vào hệ thống*.
  5. **Menu trong Google Sheet** và sidebar Nhập liệu cũng yêu cầu email của người bấm có trong danh sách (hoặc là Quản trị cố định).
  6. Nếu nghi lộ mã nguồn Cổng: *Tạo lại mã bí mật* rồi dán lại mã nguồn mới vào dự án Cổng và Deploy lại (New version).
  7. Trigger đã cài từ trước vẫn chạy (được nhận ra qua mã trigger); không cần cài lại.
- [ ] **T-SLDK (đợt 5 — làm ngay sau khi triển khai)** Menu *🚀 HỆ THỐNG HAK › 📦 Điền SL dự kiến / Diện tích / Đơn giá từ lô rừng* (hoặc ⚙️ Thiết lập, Quản trị) → **Xem trước**: kiểm tra có hợp đồng ông Bình và các hợp đồng Z = 0 → **Ghi**. Chạy lại lần 2 phải báo không còn gì để điền. Sau đó bên app Thanh toán (ĐNTT) làm mới dữ liệu và mở tóm lược hợp đồng ông Bình: khối lượng dự kiến phải đúng. Hợp đồng còn "Chờ thực hiện" cần ✅ Duyệt mới hiện bên ĐNTT.
- [ ] **T-COL** Sau khi triển khai, lần đọc/ghi đầu tiên sẽ tự chụp tiêu đề cột hiện tại của 6 sheet dữ liệu làm chuẩn. Từ đó nếu ai chèn/xóa cột giữa bảng, hệ thống **dừng ghi** và báo cột nào lệch. Nếu **cố ý** đổi cấu trúc (và đã sửa hằng số `*_COL` trong mã) → chạy menu *🧱 Xác nhận cấu trúc cột hiện tại*.
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

- [x] ~~**T-SEC-002** Chọn mô hình xác thực~~ → đã chọn mô hình DNTT, đã làm (`c852a6a`). Việc còn lại: T-AUTH ở mục A.
- [ ] **T-REPO-PUBLIC** Repo GitHub `HDMB_HAK` đang **công khai** → ai cũng đọc được mã nguồn, gồm `WEBHOOK_SECRET` (webhook làm mới cache DNTT) trong `Webhook_dntt.gs`. Đề xuất đặt repo về *Private*, hoặc đổi mã bí mật đó ở DNTT.
- [ ] **T-XEM-CHE** Vai trò Chỉ xem hiện chỉ bị che CCCD/SĐT/STK ở trang Tra cứu; các trang Báo cáo/Tổng quan vẫn hiện đầy đủ như trước. Nếu muốn che toàn hệ thống → báo để làm tiếp.
- [ ] **T-FRAME** Webapp có được nhúng vào Google Sites / trang khác không? Nếu không → đổi `ALLOWALL` thành `DEFAULT` (chống clickjacking) — sửa 1 dòng trong `doGet`.
- [ ] **T-PDPD** Rà soát việc gửi số tài khoản tới `tracuubank.com` và ảnh CCCD tới Gemini theo Nghị định 13/2023/NĐ-CP.

## D. KỸ THUẬT (theo `06_REFACTOR_PLAN.md`)

- [x] ~~R4 Xác thực & phân quyền~~ (`c852a6a`) · ~~R1 Xóa mã chết~~ (`e5d5680`) · ~~R3 Gộp JS chung 07/11~~ (`534ac14`) · ~~Widget chatbot dùng chung~~ (`64cde28`) · ~~XSS còn lại~~ (`a72c265`) · ~~R5 / MAP-001 kiểm tra cấu trúc cột~~ (`38482b9`)
- [ ] R2 phần còn lại: gộp `thongBao_` (4 bản) và `showMsg` (3 bản) vào 1 partial — nhỏ, rủi ro thấp.
- [ ] R7 Chạy `TEST_LOCK_TAI_NHAP` trên project thật rồi xử lý LOCK-004/006/008.
- [ ] R6 Tách `06_CreateUpdate.gs` — chỉ nên làm khi chuyển sang đồng bộ bằng `clasp` (tránh quên chép file).
- [ ] PERF-002 (quyết định sản phẩm): giữ đọc trực tiếp để báo cáo luôn đúng với dữ liệu sửa tay, hay thêm cache 2–5 phút cho nhanh hơn.
- [ ] JS-in-attr: nút trong bảng dùng `data-*` + event delegation thay cho `onclick="f('…')"`.
- [ ] Formula injection: thêm `'` trước giá trị văn bản tự do bắt đầu bằng `= + - @`.
- [ ] BUG-11: đo kích thước JSON nháp lớn nhất; nếu gần 50.000 ký tự thì tách nháp ra nhiều ô.
- [ ] Accessibility: gắn `<label for>` (169 nhãn chưa gắn), `aria-label` cho nút chỉ có biểu tượng, kiểm tra tương phản màu.
- [ ] Test tự động cho Tìm kiếm / Lọc / Sắp xếp / Phân trang và Xuất MISA/Excel (cần môi trường có Drive thật).

## E. Rà soát tổng thể 28/09/2026 — xem `11_AUDIT_TONG_THE_28092026.md`

- [x] ✅ (đợt 6b) 🔴 C-01 Tài khoản/phụ lục sửa-xóa theo số dòng → sửa/xóa nhầm tài khoản của hợp đồng khác
- [x] ✅ (đợt 6b) 🔴 C-02 Sửa hợp đồng theo số dòng cũ (trang 27, `LUU_HOP_DONG_DAY_DU_`) → ghi đè hợp đồng khác
- [x] ✅ (đợt 6b) 🔴 C-03 Số HĐ không kiểm tra trùng; ID_RUNG sinh từ Số HĐ; đổi Số HĐ/Ngày ký không lan xuống bảng con
- [x] ✅ (đợt 6b) H-01, H-03, H-04, H-05, M-01, M-06
- [ ] Sau triển khai: chạy *Xây dựng lại Draft báo cáo*; kiểm tra HD_STK thật có TK bị xóa/ghi đè nhầm trước đây
- [ ] 🟠 H-02, H-06, H-07, H-09 … H-13 và 🟡/⚪ còn lại: xem mục 15 của báo cáo
- [—] H-08 (chế độ truy cập webapp): không xử lý theo yêu cầu chủ dự án
