# 01 — Báo cáo lỗi (Bug Report)

Phạm vi: toàn bộ 24 `.gs` + 12 `.html`, đợt rà soát ngày 27/09/2026 (tiếp nối QA Audit 23/09).
Mỗi lỗi được đánh dấu **ĐÃ SỬA** chỉ khi có test tự động **thất bại trên mã cũ và đạt trên mã mới** (xem `07_TEST_RESULT.md`).

Mức độ: 🔴 CRITICAL · 🟠 HIGH · 🟡 MEDIUM · ⚪ LOW

## A. Lỗi phát hiện và đã sửa trong đợt này

### BUG-01 🔴 Ngày ký / Ngày cấp lùi 1 ngày mỗi lần mở rồi lưu hợp đồng — ĐÃ SỬA (`ed12988`)
- **Vị trí:** `ngayToISO_` (00_Config), bản sao cục bộ trong `layHopDongTheoSoDong_ThucThi_` (06), 3 trường ngày viết `new Date(..).toISOString()` (06); client `napFormTuDuNhap_` (07, 11) và `chuyenNgay_` (27).
- **Nguyên nhân:** server gửi ngày dạng ISO **UTC**. Ô "10/05/2026" ở bảng tính múi giờ UTC+7 là thời điểm `2026-05-09T17:00:00Z`; cả 3 form cắt phần ngày → `2026-05-09` → ô `<input type=date>` hiện 09/05, và khi Lưu thì **ghi đè** giá trị sai vào Sheet.
- **Ảnh hưởng:** ngày pháp lý của hợp đồng (Ngày ký, Ngày cấp CCCD, Ngày cấp CCCD người ủy quyền) trôi dần về quá khứ sau mỗi lần sửa — ở cả 3 màn hình sửa. Tái hiện: 10/05 → 09/05 → 08/05 sau 3 lần lưu. Tạo hợp đồng cho khách cũ ở trang 27 cũng tự điền Ngày cấp sớm 1 ngày.
- **Điều kiện:** múi giờ bảng tính là UTC+7 (gần như chắc chắn — dự án đặt `Asia/Ho_Chi_Minh`).
- **Sửa:** `ngayToISO_` trả chuỗi ngày thuần `yyyy-MM-dd` theo **múi giờ của bảng tính** (có nhớ đệm theo thời điểm), đọc được ô văn bản `dd/mm/yyyy`, loại ngày không tồn tại (31/02). Cả 3 form đúng mà không phải sửa HTML; hiển thị `toLocaleDateString('vi-VN')` không đổi. Nháp cũ lưu ngày UTC được tự chuẩn hóa khi mở lại.
- **Test:** T-DATE-01, 02, 03a, 03b, T-DRAFT-02.
- **Dữ liệu đã bị lệch trước đây không tự sửa lại được** — xem `09_TODO.md` (T-01).

### BUG-02 🟠 Sửa hợp đồng trên trang Nhập liệu xóa mất Nhóm KH và Mã số thuế — ĐÃ SỬA (`ed12988`)
- **Vị trí:** `LAY_DRAFT_THEO_ID_HD_TAO_MOI_` (15).
- **Nguyên nhân:** nháp được tạo bằng danh sách trường cố định, thiếu `nhomKH`, `maSoThue` (dù `layHopDongTheoSoDong` đã trả về — bản vá trước đó chưa trọn). Form 11 hiện 2 ô trống, lưu gửi `""`, `CAP_NHAT_HOP_DONG` ghi `""` đè lên giá trị thật.
- **Sửa:** nháp sao chép cả 2 trường; nháp cũ thiếu khóa được bổ sung từ hợp đồng gốc khi mở lại. Sidebar 07 (không có 2 ô này) vốn không gửi 2 khóa nên an toàn.
- **Test:** T-DRAFT-01, T-DRAFT-02.

### BUG-03 🟠 Tạo hợp đồng từ trang 07/11 làm mất số 0 đầu của CCCD, SĐT, Số TK, MST — ĐÃ SỬA (`ed12988`)
- **Vị trí:** nhánh tạo mới của `LUU_HOP_DONG_DAY_DU` (06), gọi từ `LUU_CHINH_THUC`.
- **Nguyên nhân:** dùng `appendRow` vào ô định dạng Automatic → Sheets đổi `049012345678` thành số `49012345678`. Tác giả đã biết lỗi này và sửa ở `TAO_HOP_DONG_MOI` (định dạng TEXT trước rồi mới ghi), nhưng quên bản sao ở `LUU_HOP_DONG_DAY_DU`.
- **Ảnh hưởng:** CCCD 11 chữ số → không khớp khi tra theo CCCD/gộp khách hàng; MST sai khi xuất MISA.
- **Sửa:** áp dụng cùng cách của `TAO_HOP_DONG_MOI`. **Test:** T-TEXT-01.
- Dữ liệu đã mất số 0 trước đây: xem `09_TODO.md` (T-02).

### BUG-04 🟠 Giá trị có dấu `"` bị cắt cụt trong form sửa của trang 27 rồi lưu đè — ĐÃ SỬA (`3efef6c`)
- **Vị trí:** 6 hàm escape HTML ở 6 trang (chỉ escape `& < >`), dùng trong `value="…"` của `truong_()` (27) — tức **mọi ô** của form sửa hợp đồng/lô rừng/tài khoản.
- **Tái hiện (Chromium):** địa chỉ `Thôn "Đồng Xanh", xã Quế Phong` hiện trong ô là `Thôn `; bấm Lưu → ghi `Thôn ` vào Sheet.
- **Sửa:** cả 6 hàm escape thêm `"` và `'` (hiển thị văn bản không đổi). **Test:** UI-27-QUOTE.

### BUG-05 🔴 Bấm "Lưu chính thức" 2 lần tạo ra 2 hợp đồng trùng — ĐÃ SỬA (`e5e4ef7`)
- **Vị trí:** `LUU_CHINH_THUC` (15); nút Lưu ở 07, 11; nút tạo hợp đồng ở 27 (`TAO_HOP_DONG_MOI`).
- **Nguyên nhân:** không có cơ chế chống gửi lặp. Hai lượt chạy song song cùng đọc được nháp (nháp chỉ bị xóa ở cuối) → với hợp đồng **mới**, mỗi lượt tạo 1 hợp đồng. Lock bên trong chỉ xếp hàng các lệnh ghi, không loại trùng.
- **Sửa:** server "nhận" nháp nguyên tử dưới lock ngắn (khóa ScriptCache, tự hết hạn 10 phút), nhả lock trước khi gọi các hàm ghi (không lồng lock); client chặn bấm lặp khi yêu cầu đang chạy (07, 11, 27).
- **Test:** T-DOUBLE-01 (mã cũ: "expected 1, got 2" hợp đồng), UI-07/11/27-DOUBLE.

### BUG-06 🟠 Lưu chính thức có thể xóa NHẦM bản nháp đang làm dở của người khác — ĐÃ SỬA (`e5e4ef7`)
- **Nguyên nhân:** xóa nháp theo số dòng đọc ở **đầu** hàm; lượt lưu kéo dài vài giây, nếu trong lúc đó một nháp phía trên bị xóa (người khác Lưu/Hủy) thì các dòng dịch lên và lệnh xóa trúng nháp của người khác.
- **Sửa:** tìm lại dòng theo `idDraft` ngay trước khi xóa, dưới lock. **Test:** T-DRAFTDEL-01.

### BUG-07 🟡 Sidebar trong Sheet (07) lệch phiên bản với trang webapp (11) — ĐÃ SỬA (`3efef6c`)
- Đọc GPS từ ảnh **vứt bỏ ảnh** sau khi lấy tọa độ (ảnh minh chứng không được lưu); tab Hình ảnh báo "Chưa có ảnh nào" dù hợp đồng có ảnh chung; danh sách điểm GPS không có link xem ảnh. Bản vá chỉ từng được làm ở 11.
- **Sửa:** chép nguyên 6 hàm của 11 sang 07 (nay giống hệt từng byte) + khung hiển thị còn thiếu. **Test:** UI-07-ANH, UI-07-GPSANH.

### BUG-08 🟡 Mục menu "⚙️ Cài đặt Vùng (Locale)..." luôn báo lỗi — ĐÃ SỬA (`ed12988`)
- Gọi `createHtmlOutputFromFile('23_CaiDatVung')` nhưng file này không có trong mã nguồn (có thể chỉ tồn tại ở project Apps Script thật — cần kiểm tra). Nay nếu thiếu file thì hỏi mã vùng bằng hộp nhập và gọi `DAT_VUNG_HE_THONG`. **Test:** T-FIX-C.

### BUG-09 ⚪ Chức năng "Dọn file tạm MISA" không truy cập được — ĐÃ SỬA (`ed12988`)
- `DON_FILE_TAM_MISA_CON_SOT_TU_MENU` ghi "chạy từ menu" nhưng chưa từng đăng ký trong `onOpen()`. Đã thêm vào menu (chỉ chuyển file `TAM_XUAT_MISA*` vào Thùng rác — khôi phục được).

### BUG-10 🟡 Lỗi bị nuốt im lặng ở 5 điểm quan trọng — ĐÃ SỬA (`a1b9f05`)
- Ghi nhật ký thất bại, ghi cache báo cáo thất bại, không xóa được dòng Draft báo cáo, không tổng hợp được `ct_hopdong`, không cập nhật được cache Hồ sơ rừng: trước đây `catch {}` rỗng → số liệu tổng hợp cũ mà không ai biết. Nay ghi log mức WARNING/ERROR. **Test:** T-LOG-02.

(Lỗi bảo mật SEC-006/007/008 và hiệu năng PERF-005: xem `02_SECURITY_REPORT.md`, `03_PERFORMANCE_REPORT.md`.)

## B. Lỗi từ QA Audit 23/09 đã sửa ở đợt trước (24/09)

| ID | Mức | Nội dung | Commit |
|---|---|---|---|
| SEC-001/DEPLOY-001 | 🔴 | Chia sẻ/thu hồi quyền dữ liệu không cần xác thực → yêu cầu `ADMIN_TOKEN` | `42ba949` |
| LOCK-001 | 🔴 | `LUU_PHU_LUC` trùng "Lần phụ lục" khi lưu đồng thời | `42ba949` |
| LOCK-002/003/005/007 | 🟠/🟡 | Thiếu khóa: thêm tài khoản, ghi ảnh, ghi đè GPS, tạo nháp | `42ba949` |
| CACHE-001 | 🟡 | Bản đồ GPS hiện dữ liệu cũ 15 phút sau thêm/sửa/xóa lô | `42ba949` |
| PERF-001 | 🔴 | Đồng bộ thanh toán 30 phút/lần đọc lại 5 sheet cho MỖI hợp đồng | `8cbf662` |

Tất cả đều có test hồi quy trong bộ test hiện tại (T-LOCK-001, T-CACHE-001, T-PERF-001, T-SEC-001…).

## B2. Đợt 3 (cùng ngày, sau khi chủ dự án yêu cầu "xử lý tiếp, mã chết thì xóa")

| ID | Mức | Nội dung | Commit / Test |
|---|---|---|---|
| MAP-001 | 🟡 | Chèn/xóa/kéo cột tay trên Sheet làm mọi đọc/ghi lệch cột âm thầm → nay **dừng đọc/ghi** sheet đó và báo rõ cột nào đã dịch (mẫu tiêu đề lưu ở Script Properties; đổi tên chỉ cảnh báo; thêm cột cuối hợp lệ; menu "🧱 Xác nhận cấu trúc cột hiện tại") | `38482b9` / T-COL-01, T-COL-02 |
| XSS-rest | 🟡 | 116 dòng chèn dữ liệu vào `innerHTML` chưa escape ở 6 trang — gồm tên chủ rừng/người ủy quyền ở bảng Thanh lý (10) và **tên chủ TK do dịch vụ tra cứu bên ngoài trả về** (27) | `a72c265` / UI-10-XSS-TL, UI-27-XSS-TK |
| SEC-011 | 🟡 | Chatbot: link trong câu trả lời chèn được thuộc tính (`https://a.com/"onmouseover=…`) | `64cde28` / UI-CHATXSS-10/27/30 |
| DRY | — | Gộp 67 hàm trùng của 07/11 vào `NhapLieu_Chung_JS.html`; gộp widget chatbot của 10/27/30 vào `ChatbotWidget.html`; xóa 3 file + 19 hàm mã chết | `534ac14`, `64cde28`, `e5d5680` |

## B3. Đợt 4 (chủ dự án chọn phân quyền theo mô hình DNTT + yêu cầu chức năng Tra cứu hợp đồng)

| ID | Mức | Nội dung | Commit / Test |
|---|---|---|---|
| SEC-002 | 🔴 | 171 hàm server gọi được ẩn danh → nay bắt **đăng nhập Gmail** qua Cổng đăng nhập, 3 vai trò, 1 cửa `api()` + bảng quyền; mọi hàm công khai còn lại đều kiểm tra quyền | `c852a6a` / T-AUTH-01..05, UI-AUTH-01..04 |
| AUDIT-01 | 🟡 | Nhật ký/cột "Email" người tạo hợp đồng/người sửa nháp **trống** khi thao tác qua webapp (`Session.getActiveUser()` không trả email ở chế độ chạy dưới tài khoản chủ) → nay ghi email người đăng nhập | `c852a6a` / T-AUDIT-01 |
| TRIG-01 | ⚪ | Trigger hàng tuần gọi `KIEM_TRA_HO_SO_TOAN_BO(e)` → đối tượng sự kiện bị hiểu nhầm là "từ ngày" (bật chế độ lọc theo ngày ngoài ý muốn) → lớp vỏ mới gọi hàm với tham số rỗng (kiểm tra toàn bộ, đúng mô tả) | `c852a6a` |
| TC-01 | ✨ Tính năng | Trang **🔍 Tra cứu hợp đồng** (`?page=tracuu`) | `c852a6a` / T-TC-01/02, UI-TC-01/02 |

## C. Lỗi còn tồn tại (chưa sửa — cần quyết định hoặc rủi ro cao)

| ID | Mức | Nội dung | Lý do chưa sửa |
|---|---|---|---|
| LOCK-004/006/008 | 🟡 | TOCTOU theo số dòng ở một số hàm sửa/xóa; lớp cache Draft không khóa | Rủi ro lồng lock — cần xác minh `LockService` có tái nhập trong cùng lượt chạy trên runtime thật |
| BUG-11 | 🟡 | Nháp lưu JSON trong 1 ô: > 50.000 ký tự (hợp đồng rất nhiều lô + điểm GPS) sẽ lưu nháp thất bại | Chưa gặp trên dữ liệu thật; cần đo kích thước nháp lớn nhất |
| BUG-12 | ⚪ | Tạo hợp đồng qua `LUU_HOP_DONG_DAY_DU` ghi Ngày ký kèm giờ 07:00 (`new Date('yyyy-mm-dd')` là nửa đêm UTC) | Hiển thị đúng; chỉ ảnh hưởng so sánh chính xác theo thời điểm |
| BUG-13 | ⚪ | Tên file xuất ở trang 10 dùng ngày UTC (từ 0–7 giờ sáng ra ngày hôm trước) | Chỉ là tên file |
| DATA-001 | ⚪ | `HD_Picture` cũ lưu nhầm ID_RUNG vào cột ID_HD | Đã có lớp đối chiếu 2 chiều |
