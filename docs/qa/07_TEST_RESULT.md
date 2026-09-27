# 07 — Kết quả kiểm thử (Test Result)

## 1. Cách kiểm thử

Không có quyền vào project Apps Script / Google Sheet thật, nên xây 3 lớp kiểm thử chạy được và lặp lại được:

| Lớp | Công cụ | Chạy gì |
|---|---|---|
| **Server** | Bộ giả lập Apps Script trong Node (`gasmock.js`): nạp **cả 26 file `.gs` cùng lúc** như Apps Script, giả lập SpreadsheetApp (bảng trong bộ nhớ, **mô phỏng cách Sheets ép kiểu khi ghi**: chuỗi số mất số 0 đầu nếu ô không định dạng TEXT, chuỗi ngày thành ngày lúc 00:00 múi giờ bảng tính), Utilities.formatDate, LockService (ghi nhận khóa lồng), CacheService, PropertiesService, Session. Chạy với `TZ=Asia/Ho_Chi_Minh` | Luồng nghiệp vụ thật: tạo → mở nháp → sửa → lưu chính thức, rồi đọc lại ô trong Sheet |
| **Trình duyệt** | Playwright + Chromium, trang HTML thật (đã **ghép các partial** `include(...)` như Apps Script làm), `google.script.run` giả lập trả dữ liệu (kể cả dữ liệu độc hại) | Hiển thị, escape, chống bấm lặp, toast, tải trang không lỗi JS |
| **Tương đương** | Ghi lại toàn bộ hành vi trước/sau khi tái cấu trúc | `doGet` (29 trường hợp), `KIEM_TRA_ANH_DA_CHON` (103 ảnh), tập hàm sau khi ghép partial |

**Nguyên tắc chấm đạt:** mỗi lỗi được coi là đã sửa khi test của nó **thất bại trên mã cũ** và **đạt trên mã mới**. Cột `f064f8a` là mã ngay trước khi thêm đăng nhập/tra cứu (đợt 4); cột `8cbf662` là mã trước khi bắt đầu rà soát. Test đạt trên mọi cột là test hồi quy.

## 2. Kết quả

### Server (bộ giả lập Apps Script) — 45/45 đạt (f064f8a: 24/45 · 8cbf662: 8/45)

| ID | Kịch bản | Mã mới | f064f8a (trước đăng nhập) | 8cbf662 (trước rà soát) |
|---|---|---|---|---|
| T-DATE-01 | ngayToISO_: Date ở 00:00 UTC+7 -> đúng ngày lịch | ✅ PASS | PASS | FAIL — local midnight: expected "2026-05-10", got "2026-05-09T17:00:00.000Z" |
| T-DATE-02 | ngayToISO_: chuỗi yyyy-mm-dd, dd/mm/yyyy, rỗng, sai | ✅ PASS | PASS | FAIL — iso date kept: expected "2026-05-10", got "2026-05-10T00:00:00.000Z" |
| T-DATE-03a | Mở+lưu hợp đồng 3 lần qua form 07/11: Ngày ký/Ngày cấp KHÔNG bị lùi | ✅ PASS | PASS | FAIL — Ngày ký sau 3 lần lưu: expected "10/05/2026", got "08/05/2026" |
| T-DATE-03b | Mở+lưu hợp đồng 3 lần qua form 27: Ngày ký/Ngày cấp KHÔNG bị lùi | ✅ PASS | PASS | FAIL — Ngày ký sau 3 lần lưu: expected "10/05/2026", got "08/05/2026" |
| T-DRAFT-01 | Luồng nháp 11 (mở -> sửa -> Lưu chính thức) giữ nguyên Nhóm KH, MST và ngày | ✅ PASS | PASS | FAIL — Nhóm KH: expected "KH lẻ", got "" |
| T-DRAFT-02 | Nháp CŨ (lưu trước bản vá: thiếu nhomKH/MST, ngày UTC) được tự chuẩn hóa khi mở lại | ✅ PASS | PASS | FAIL — legacy ngayKy: expected "2026-05-10", got "2026-05-09T17:00:00.000Z" |
| T-SEC-001 | Chia sẻ/thu hồi quyền bị chặn khi thiếu/sai ADMIN_TOKEN (không gọi tới Drive API) | ✅ PASS | PASS | PASS |
| T-LOCK-001 | LUU_PHU_LUC: lần phụ lục tăng dần 1,2,3 và ID không trùng | ✅ PASS | PASS | PASS |
| T-STT-01 | THEM_LO_RUNG_MOI sau khi xóa lô ở giữa không sinh STT trùng | ✅ PASS | PASS | PASS |
| T-CACHE-001 | Thêm/sửa/xóa lô rừng đều xóa cache Bản đồ GPS | ✅ PASS | PASS | PASS |
| T-GPS-01 | CAP_NHAT_GPS_RUNG ghiDe=true thay toàn bộ điểm cũ, lưu tọa độ DD | ✅ PASS | PASS | PASS |
| T-PERF-001 | capNhatDraftHangLoat_ cho KẾT QUẢ GIỐNG HỆT gọi CAP_NHAT_DRAFT_MOT_HOP_DONG từng hợp đồng | ✅ PASS | PASS | PASS |
| T-FIX-C | Menu "Cài đặt Vùng": thiếu file 23_CaiDatVung.html vẫn không ném lỗi | ✅ PASS | PASS | FAIL — [gasmock] HtmlService.createHtmlOutputFromFile not mocked |
| T-THANHLY-01 | Hợp đồng "Đã thanh lý" không cho sửa qua LUU_HOP_DONG_DAY_DU | ✅ PASS | PASS | PASS |
| T-TEXT-01 | CCCD/SĐT/MST giữ số 0 đầu khi tạo và khi sửa | ✅ PASS | PASS | FAIL — CCCD on create: expected "049012345678", got "49012345678" |
| T-TK-01 | THEM_TAI_KHOAN_MOI trả đúng số dòng vừa ghi và giữ số 0 đầu của Số TK | ✅ PASS | PASS | PASS |
| T-DOUBLE-01 | Bấm "Lưu chính thức" 2 lần (request thứ 2 tới khi request 1 đang chạy) chỉ tạo 1 hợp đồng | ✅ PASS | PASS | FAIL — number of contracts created: expected 1, got 2 |
| T-DRAFTDEL-01 | Lưu chính thức không xóa NHẦM nháp của người khác khi các dòng nháp bị dịch chuyển | ✅ PASS | PASS | FAIL — draft C (another user) was deleted by mistake; remaining: DRAFT_FE5D98CE |
| T-LOG-01 | log_: ERROR/WARNING/INFO ra đúng console.*, DEBUG chỉ khi bật LOG_DEBUG | ✅ PASS | PASS | FAIL — P.ctx.log_ is not a function |
| T-LOG-02 | Lỗi tổng hợp ct_hopdong không còn bị nuốt im lặng | ✅ PASS | PASS | FAIL — error was not logged |
| T-SEC-006 | Người lạ gọi SETUP_*_TOKEN không ghi đè được token đã cấu hình; token mẫu bị từ chối | ✅ PASS | PASS | FAIL — SYNC_TOKEN overwritten: expected "that-su-bi-mat", got "DAT_TOKEN_CUA_BAN_O_DAY" |
| T-SEC-009 | Tải lên: từ chối file html/exe và file > 20MB trước khi ghi vào Drive; ảnh/PDF vẫn qua | ✅ PASS | PASS | FAIL — TAI_ANH_GPS_LEN_DRIVE accepted html: {"thanhCong":false,"loi":"[gasmock] DriveApp.getFoldersByName n |
| T-COL-01 | Chèn cột tay vào HD_NCC -> hệ thống DỪNG ghi (không ghi lệch cột); đổi tên chỉ cảnh báo; thêm cột cu | ✅ PASS | PASS | FAIL — P.ctx.kiemTraCauTrucCot_ is not a function |
| T-COL-02 | Kiểm tra cấu trúc cột được nhớ 60s: không đọc lại tiêu đề ở mỗi lượt gọi | ✅ PASS | PASS | FAIL — P.ctx.kiemTraCauTrucCot_ is not a function |
| T-AUTH-01 | Mọi hàm công khai (gọi thẳng qua google.script.run) đều chặn người lạ, trừ các hàm đăng nhập/đầu vào | ✅ PASS | FAIL — callable anonymously: layDanhSachLoaiHoSo -> chạy được \| themLoaiHoSoMoi -> chạy được \| LAY_CAU_HI | FAIL — callable anonymously: layDanhSachLoaiHoSo -> chạy được \| themLoaiHoSoMoi -> chạy được \| LAY_CAU_HI |
| T-AUTH-02 | api(): không phiên / phiên sai / tài khoản khóa -> [AUTH]; Chỉ xem gọi chức năng Nhập liệu -> [QUYEN | ✅ PASS | FAIL — P.ctx._getNguoiDungSheet_ is not a function | FAIL — P.ctx._getNguoiDungSheet_ is not a function |
| T-AUTH-03 | Cổng đăng nhập Gmail: đăng nhập -> có phiên; dùng lại link, sửa chữ ký, hết hạn, email chưa cấp quyề | ✅ PASS | FAIL — P.ctx._getNguoiDungSheet_ is not a function | FAIL — P.ctx._getNguoiDungSheet_ is not a function |
| T-AUTH-04 | Bảng quyền: mọi chức năng trang web gọi đều có trong bảng, trỏ tới hàm nội bộ (X_) có thật | ✅ PASS | FAIL — P.ctx._bangQuyenApi_ is not a function | FAIL — P.ctx._bangQuyenApi_ is not a function |
| T-AUTH-05 | Hàm menu/trigger giữ tên cũ: trigger thật của project chạy được, người lạ giả triggerUid bị chặn | ✅ PASS | FAIL — fake trigger uid accepted | FAIL — fake trigger uid accepted |
| T-TC-01 | Tra cứu: tên không dấu, CCCD/SĐT/STK 1 phần, số TK ở HD_STK; kết quả mới ký trước | ✅ PASS | FAIL — P.ctx.TRA_CUU_HOP_DONG_ is not a function | FAIL — P.ctx.TRA_CUU_HOP_DONG_ is not a function |
| T-TC-03 | Tra cứu theo khoảng Ngày ký: chỉ chọn ngày (không từ khóa), ngày + từ khóa, 1 đầu mở, ngày ngược bị  | ✅ PASS | FAIL — P.ctx.TRA_CUU_HOP_DONG_ is not a function | FAIL — P.ctx.TRA_CUU_HOP_DONG_ is not a function |
| T-TC-02 | Tra cứu: vai trò Chỉ xem thấy CCCD/SĐT/STK bị che, không có link hồ sơ pháp lý; Nhập liệu thấy đủ | ✅ PASS | FAIL — P.ctx._getNguoiDungSheet_ is not a function | FAIL — P.ctx._getNguoiDungSheet_ is not a function |
| T-AUDIT-01 | Nhật ký và cột Email người tạo ghi đúng người đăng nhập (trước đây trống khi dùng webapp) | ✅ PASS | FAIL — P.ctx._getNguoiDungSheet_ is not a function | FAIL — P.ctx._getNguoiDungSheet_ is not a function |
| T-HA-01 | Ảnh theo hợp đồng: ảnh chung + ảnh từng lô + ảnh GPS (kèm tọa độ); theo khách hàng gộp mọi HĐ cùng C | ✅ PASS | FAIL — P.ctx.LAY_ANH_TRA_CUU_ is not a function | FAIL — P.ctx.LAY_ANH_TRA_CUU_ is not a function |
| T-HA-02 | Tải ảnh: chỉ trả ảnh thuộc hợp đồng đang xem (không lấy được file Drive khác), dùng ảnh thu nhỏ Driv | ✅ PASS | FAIL — P.ctx.LAY_DU_LIEU_ANH_ is not a function | FAIL — P.ctx.LAY_DU_LIEU_ANH_ is not a function |
| T-HA-03 | Xuất PDF: đúng ảnh đã chọn, chú thích lô/GPS, CCCD che với Chỉ xem, tên khách hàng độc hại bị escape | ✅ PASS | FAIL — P.ctx._getNguoiDungSheet_ is not a function | FAIL — P.ctx._getNguoiDungSheet_ is not a function |
| T-HA-04 | Xuất PDF: quá 60 ảnh thì lấy 60 ảnh đầu và báo số ảnh bỏ qua | ✅ PASS | FAIL — P.ctx.XUAT_PDF_ANH_ is not a function | FAIL — P.ctx.XUAT_PDF_ANH_ is not a function |
| T-HA-05 | Hồ sơ pháp lý: Nhập liệu thấy hồ sơ từng lô (kể cả theo khách hàng) và xem được trang đầu; Chỉ xem c | ✅ PASS | FAIL — P.ctx._getNguoiDungSheet_ is not a function | FAIL — P.ctx._getNguoiDungSheet_ is not a function |
| T-HA-06 | Xuất PDF kèm hồ sơ: Nhập liệu nhận danh mục + danh sách file để ghép, xuất được cả khi bỏ chọn hết ả | ✅ PASS | FAIL — P.ctx._getNguoiDungSheet_ is not a function | FAIL — P.ctx._getNguoiDungSheet_ is not a function |
| T-HA-07 | LAY_FILE_HO_SO: chỉ trả file là hồ sơ của hợp đồng đang xem; Chỉ xem bị chặn; Google Docs chuyển san | ✅ PASS | FAIL — P.ctx._getNguoiDungSheet_ is not a function | FAIL — P.ctx._getNguoiDungSheet_ is not a function |
| T-DRV-01 | Xem file Drive trong hệ thống: ảnh (kể cả ảnh nháp) ai đăng nhập cũng xem được không cần quyền Drive | ✅ PASS | FAIL — P.ctx._getNguoiDungSheet_ is not a function | FAIL — P.ctx._getNguoiDungSheet_ is not a function |
| T-AUTH-06 | Phiên đăng nhập: dùng sau 30 phút thì được cấp mã mới (mã cũ vẫn chạy cho tab khác); quá 7 ngày từ l | ✅ PASS | FAIL — P.ctx._getNguoiDungSheet_ is not a function | FAIL — P.ctx._getNguoiDungSheet_ is not a function |
| T-AUTH-07 | Trình duyệt chặn bộ nhớ: doGet nhận lại phiên qua ?ph=... khi mã còn hiệu lực; mã giả / hết hạn bị b | ✅ PASS | FAIL — P.ctx._getNguoiDungSheet_ is not a function | FAIL — P.ctx._getNguoiDungSheet_ is not a function |
| T-BC-01 | Báo cáo thực hiện PDF: tiến độ, thanh toán (DNTT), bản đồ vệ tinh Google Maps từng lô + link tọa độ, | ✅ PASS | FAIL — P.ctx._getNguoiDungSheet_ is not a function | FAIL — P.ctx._getNguoiDungSheet_ is not a function |
| T-BC-02 | Báo cáo thực hiện: Chỉ xem được lập báo cáo (CCCD/SĐT/STK che, không hồ sơ); theo khách hàng có bản  | ✅ PASS | FAIL — P.ctx._getNguoiDungSheet_ is not a function | FAIL — P.ctx._getNguoiDungSheet_ is not a function |

### Trình duyệt (Chromium + giả lập google.script.run) — 47/47 đạt (f064f8a: 27/44 · 8cbf662: 13/43)

| ID | Kịch bản | Mã mới | f064f8a (trước đăng nhập) | 8cbf662 (trước rà soát) |
|---|---|---|---|---|
| UI-07-ANH | 07: tab Hình ảnh hiện ảnh chung của HĐ + chặn tên file/link độc hại | ✅ PASS | PASS | FAIL — contract-level photos rendered: -1 |
| UI-11-ANH | 11: tab Hình ảnh hiện ảnh chung của HĐ + chặn tên file/link độc hại | ✅ PASS | PASS | FAIL — file name was parsed as HTML (<img> injected) |
| UI-07-GPSANH | 07: đọc GPS từ ảnh -> lưu luôn ảnh minh chứng vào điểm nháp | ✅ PASS | PASS | FAIL — photo url stored with the point: {"lat":15.73,"lng":108.02} |
| UI-27-QUOTE | 27: giá trị có dấu " không bị cắt cụt trong form sửa + không chèn được thuộc tính | ✅ PASS | PASS | FAIL — value truncated to: Thôn  |
| UI-07-DOUBLE | 07: bấm "Lưu chính thức" 2 lần chỉ gửi 1 yêu cầu | ✅ PASS | PASS | FAIL — LUU_CHINH_THUC sent 3 times |
| UI-11-DOUBLE | 11: bấm "Lưu chính thức" 2 lần chỉ gửi 1 yêu cầu | ✅ PASS | PASS | FAIL — LUU_CHINH_THUC sent 3 times |
| UI-27-DOUBLE | 27: bấm "Lưu" hợp đồng mới 2 lần chỉ gửi 1 TAO_HOP_DONG_MOI | ✅ PASS | PASS | FAIL — TAO_HOP_DONG_MOI sent 2 times |
| UI-11-TOAST | 11: lỗi hiện dạng thông báo nổi (không dùng alert chặn màn hình) | ✅ PASS | PASS | FAIL — alert() still called |
| UI-CHAT-10 | 10: chatbot mở được, gửi câu hỏi, hiện trả lời có link bấm được | ✅ PASS | PASS | PASS |
| UI-CHATXSS-10 | 10: link trong trả lời của bot không chèn được thuộc tính | ✅ PASS | PASS | FAIL — onmouseover attribute injected into bot link |
| UI-CHAT-27 | 27: chatbot mở được, gửi câu hỏi, hiện trả lời có link bấm được | ✅ PASS | PASS | PASS |
| UI-CHATXSS-27 | 27: link trong trả lời của bot không chèn được thuộc tính | ✅ PASS | PASS | FAIL — onmouseover attribute injected into bot link |
| UI-CHAT-30 | 30: chatbot mở được, gửi câu hỏi, hiện trả lời có link bấm được | ✅ PASS | PASS | PASS |
| UI-CHATXSS-30 | 30: link trong trả lời của bot không chèn được thuộc tính | ✅ PASS | PASS | FAIL — onmouseover attribute injected into bot link |
| UI-10-XSS-TL | 10: tên chủ rừng / người ủy quyền độc hại trong bảng Thanh lý hiển thị dạng chữ | ✅ PASS | PASS | FAIL — name rendered as HTML (<img> injected) |
| UI-27-XSS-TK | 27: tên chủ TK trả về từ dịch vụ tra cứu bên ngoài hiển thị dạng chữ | ✅ PASS | PASS | FAIL — external bank-lookup name rendered as HTML |
| UI-AUTH-01 | Chưa đăng nhập: hiện màn đăng nhập, nút dẫn tới Cổng đăng nhập kèm đúng trang | ✅ PASS | FAIL — page.evaluate: TypeError: Cannot read properties of null (reading 'setAttribute') | FAIL — page.evaluate: TypeError: Cannot read properties of null (reading 'setAttribute') |
| UI-AUTH-02 | Lỗi [AUTH] từ api (phiên hết hạn) -> tự hiện màn đăng nhập, xóa phiên cũ; mọi lời gọi đi qua api kèm | ✅ PASS | FAIL — page.evaluate: TypeError: Failed to execute 'getComputedStyle' on 'Window': parameter 1 is not of ty | FAIL — page.evaluate: TypeError: Failed to execute 'getComputedStyle' on 'Window': parameter 1 is not of ty |
| UI-AUTH-03 | Vai trò Chỉ xem: ẩn menu Thiết lập / Nhập liệu; vào trang Thiết lập thì báo không đủ quyền | ✅ PASS | FAIL — page.evaluate: TypeError: Cannot read properties of null (reading 'setAttribute') | FAIL — page.evaluate: TypeError: Cannot read properties of null (reading 'setAttribute') |
| UI-AUTH-04 | Lỗi [QUYEN]: trang nhận thông báo đã bỏ tiền tố, KHÔNG bị đăng xuất | ✅ PASS | FAIL — ENOENT: no such file or directory, open 'preauth/33_Page_TraCuuHopDong.html' | FAIL — ENOENT: no such file or directory, open 'prefix2/33_Page_TraCuuHopDong.html' |
| UI-TC-01 | Tra cứu: tìm -> bảng kết quả; bấm HĐ -> chi tiết (lô rừng, TK, ảnh, hồ sơ); dữ liệu độc hại hiện dạn | ✅ PASS | FAIL — ENOENT: no such file or directory, open 'preauth/33_Page_TraCuuHopDong.html' | FAIL — ENOENT: no such file or directory, open 'prefix2/33_Page_TraCuuHopDong.html' |
| UI-TC-02 | Tra cứu: từ khóa 1 ký tự không gọi server; bấm Tra cứu liên tục chỉ gửi 1 yêu cầu | ✅ PASS | FAIL — ENOENT: no such file or directory, open 'preauth/33_Page_TraCuuHopDong.html' | FAIL — ENOENT: no such file or directory, open 'prefix2/33_Page_TraCuuHopDong.html' |
| UI-TC-03 | Tra cứu: lọc Từ ngày–Đến ngày gửi đúng ngày lên server; chọn nhanh "Tháng trước"; ngày ngược bị chặn | ✅ PASS | FAIL — ENOENT: no such file or directory, open 'preauth/33_Page_TraCuuHopDong.html' | FAIL — ENOENT: no such file or directory, open 'prefix2/33_Page_TraCuuHopDong.html' |
| UI-HA-01 | Tra cứu hình ảnh: tìm -> "Ảnh cả khách hàng" -> thư viện theo lô, ảnh thu nhỏ tải theo lô, phóng to  | ✅ PASS | FAIL — ENOENT: no such file or directory, open 'preauth/35_Page_TraCuuHinhAnh.html' | FAIL — ENOENT: no such file or directory, open 'prefix2/35_Page_TraCuuHinhAnh.html' |
| UI-HA-02 | Tra cứu hình ảnh: bỏ chọn ảnh -> xuất PDF chỉ gửi ảnh đang chọn, tải file xuống; bỏ chọn hết thì khô | ✅ PASS | FAIL — ENOENT: no such file or directory, open 'preauth/35_Page_TraCuuHinhAnh.html' | FAIL — ENOENT: no such file or directory, open 'prefix2/35_Page_TraCuuHinhAnh.html' |
| UI-HA-03 | Hồ sơ pháp lý: hiện trang đầu từng hồ sơ (chữ độc hại an toàn), bấm để phóng to + link file gốc; xuấ | ✅ PASS | FAIL — ENOENT: no such file or directory, open 'preauth/35_Page_TraCuuHinhAnh.html' | FAIL — ENOENT: no such file or directory, open 'prefix2/35_Page_TraCuuHinhAnh.html' |
| UI-HA-04 | Hồ sơ pháp lý: bỏ chọn hết ảnh vẫn xuất được hồ sơ (khongAnh); không có công cụ ghép thì vẫn tải fil | ✅ PASS | FAIL — ENOENT: no such file or directory, open 'preauth/35_Page_TraCuuHinhAnh.html' | FAIL — ENOENT: no such file or directory, open 'prefix2/35_Page_TraCuuHinhAnh.html' |
| UI-DRV-01 | Bấm link Drive của ảnh/hồ sơ: mở ngay trong hệ thống (không sang Drive đòi quyền), Tải về lấy file đ | ✅ PASS | FAIL — page.evaluate: TypeError: Cannot read properties of null (reading 'className') | FAIL — page.evaluate: TypeError: Cannot read properties of null (reading 'className') |
| UI-AUTH-05 | Đăng nhập 1 lần dùng cho mọi tab: tab mới dùng lại phiên (không bắt đăng nhập lại), nhận mã gia hạn  | ✅ PASS | FAIL — page.evaluate: TypeError: Failed to execute 'getComputedStyle' on 'Window': parameter 1 is not of ty | FAIL — page.evaluate: TypeError: Failed to execute 'getComputedStyle' on 'Window': parameter 1 is not of ty |
| UI-AUTH-06 | Trình duyệt chặn bộ nhớ (cookie bên thứ ba): link chuyển trang và window.open của hệ thống tự mang t | ✅ PASS | FAIL — page.evaluate: TypeError: Cannot read properties of null (reading 'setAttribute') | FAIL — page.evaluate: TypeError: Cannot read properties of null (reading 'setAttribute') |
| UI-BC-01 | Nút "Báo cáo thực hiện (PDF)": gửi đúng ảnh đã chọn + tùy chọn hồ sơ, ghép hồ sơ, tải file; mở từ Tr | ✅ PASS | FAIL — ENOENT: no such file or directory, open 'preauth/35_Page_TraCuuHinhAnh.html' | FAIL — ENOENT: no such file or directory, open 'prefix2/35_Page_TraCuuHinhAnh.html' |
| UI-BC-02 | Tra cứu hợp đồng: chi tiết có nút "Báo cáo thực hiện (PDF)" dẫn sang trang hình ảnh với đúng hợp đồn | ✅ PASS | FAIL — ENOENT: no such file or directory, open 'preauth/33_Page_TraCuuHopDong.html' | FAIL — ENOENT: no such file or directory, open 'prefix2/33_Page_TraCuuHopDong.html' |
| UI-TL-ND | Thiết lập: danh sách người dùng hiện dạng chữ (email/tên độc hại không chạy), bấm Sửa nạp lại form | ✅ PASS | FAIL — page.click: Timeout 30000ms exceeded. | FAIL — page.click: Timeout 30000ms exceeded. |
| UI-LOAD-07 | 07_Form_HopDong.html: tải trang không lỗi JS | ✅ PASS | PASS | PASS |
| UI-LOAD-10 | 10_Page_BaoCao.html: tải trang không lỗi JS | ✅ PASS | PASS | PASS |
| UI-LOAD-11 | 11_Page_NhapLieu.html: tải trang không lỗi JS | ✅ PASS | PASS | PASS |
| UI-LOAD-12 | 12_Page_KiemTra.html: tải trang không lỗi JS | ✅ PASS | PASS | PASS |
| UI-LOAD-13 | 13_HuongDan.html: tải trang không lỗi JS | ✅ PASS | PASS | PASS |
| UI-LOAD-24 | 24_Page_ThietLap.html: tải trang không lỗi JS | ✅ PASS | PASS | PASS |
| UI-LOAD-27 | 27_Page_HopDongMeCon.html: tải trang không lỗi JS | ✅ PASS | PASS | PASS |
| UI-LOAD-30 | 30_Page_TongQuanHopDong.html: tải trang không lỗi JS | ✅ PASS | PASS | PASS |
| UI-LOAD-33 | 33_Page_TraCuuHopDong.html: tải trang không lỗi JS | ✅ PASS | — (chưa có) | — (chưa có) |
| UI-LOAD-35 | 35_Page_TraCuuHinhAnh.html: tải trang không lỗi JS | ✅ PASS | — (chưa có) | — (chưa có) |
| UI-LOAD-Ch | ChatbotWidget.html: tải trang không lỗi JS | ✅ PASS | PASS | — (chưa có) |
| UI-LOAD-Ma | MapContainer.html: tải trang không lỗi JS | ✅ PASS | PASS | PASS |
| UI-LOAD-Nh | NhapLieu_Chung_JS.html: tải trang không lỗi JS | ✅ PASS | PASS | — (chưa có) |
| UI-LOAD-Ph | PhanQuyen_JS.html: tải trang không lỗi JS | ✅ PASS | — (chưa có) | — (chưa có) |

Test chỉ có ở mã cũ (trang đã xóa vì là mã chết): UI-LOAD-26.

### Kiểm thử tương đương (tái cấu trúc không đổi hành vi)

| Hạng mục | Kết quả |
|---|---|
| `doGet` — 29 trường hợp (16 giá trị `?page=` gồm cả `constructor`, `__proto__`, `MAP`, trang lạ; 13 tổ hợp `action=run` × trạng thái token) | Đợt 2: **25/29 giống hệt từng lệnh gọi** (4 khác biệt là token mẫu — cố ý từ chối, SEC-006). Đợt 4 (thêm đăng nhập): **29/29 giống hệt** `f064f8a` — `?action=run` có token vẫn chạy đồng bộ |
| `KIEM_TRA_ANH_DA_CHON` — 103 ảnh, 25 hợp đồng, điểm DD/DMS/sai định dạng, ID lạ/rỗng | Kết quả và tọa độ truyền vào `kiemTraMotAnh` **giống từng bit**; HD_GPS đọc 103 → 1 lần |
| `capNhatDraftHangLoat_` so với gọi từng hợp đồng | Bảng Draft **giống hệt** (T-PERF-001) |
| Xóa mã chết (`e5d5680`): `doGet` 29 trường hợp chạy lại | **29/29 giống hệt** trước khi xóa — không route nào trỏ tới trang/hàm đã xóa |
| Partial `NhapLieu_Chung_JS` (`534ac14`): tập hàm của trang sau khi ghép | 07: **73/73**, 11: **82/82** hàm giống hệt từng byte so với trước khi tách |
| Partial `ChatbotWidget` (`64cde28`) | CSS/HTML/JS giống hệt ở 3 trang trước khi tách; UI-CHAT-10/27/30 đạt |

### Kiểm tra tĩnh
- `node --check` cho cả 26 `.gs` và `<script>` của 13 `.html` (sau khi ghép partial): không lỗi cú pháp.
- Bộ phân tích tĩnh chạy lại sau khi xóa: **0 hàm server không ai gọi** (ngoài 6 hàm chạy tay/trigger giữ lại có chủ đích), **0 hàm client không ai gọi**.
- Không trùng tên hàm/hằng số toàn cục giữa các file `.gs` (lỗi làm hỏng cả project Apps Script).
- Mọi `google.script.run` đều có `withFailureHandler`.
- Mọi `getElementById` đều trỏ tới id có thật hoặc được dựng động (đã kiểm tra tay các trường hợp bộ phân tích nghi ngờ).

## 3. Hạng mục trong yêu cầu — phạm vi kiểm thử

| Hạng mục | Trạng thái | Ghi chú |
|---|---|---|
| CRUD | ✅ | Tạo/sửa hợp đồng (2 đường), lô rừng, tài khoản, phụ lục, GPS, xóa lô |
| Double click / Double submit | ✅ | Server + 3 trang |
| Date / Timezone | ✅ | Toàn bộ vòng mở–lưu ở 3 form |
| Duplicate data | ✅ | STT lô, lần phụ lục, hợp đồng trùng khi bấm lặp |
| Cache | ✅ | Xóa cache bản đồ ở mọi điểm ghi |
| Data race | ✅ | Mô phỏng yêu cầu thứ 2 đến giữa chừng; nháp bị dịch dòng |
| Upload | ✅ | Loại + dung lượng file |
| Token | ✅ | ADMIN_TOKEN, SYNC_TOKEN, SETUP_* |
| XSS / Injection | ✅ | Tên file, link `javascript:`, dấu nháy trong thuộc tính, bảng thanh lý, dữ liệu tra cứu ngân hàng, link chatbot |
| Cấu trúc Sheet (chèn/xóa cột tay) | ✅ | T-COL-01/02: dừng ghi khi cột bị dịch, đổi tên chỉ cảnh báo |
| Unhandled error / Try-catch | ✅ | Log lỗi thay vì nuốt im lặng; lỗi RPC hiện toast |
| Page load / Console error | ✅ | 10 trang đang dùng + 3 partial, 0 lỗi JS |
| Filter / Sort / Pagination (trang cũ) | ⚠️ Tĩnh | Đã đọc code; chưa có test tự động |
| Import / Export / Excel / PDF / Print / Report | ⚠️ Chưa | Cần DriveApp/UrlFetch thật (xuất qua `docs.google.com/.../export`) |
| Trigger | ⚠️ Một phần | Logic của hàm trigger được test (PERF-001); việc cài trigger cần runtime thật |
| Responsive / Mobile / Tablet | ⚠️ Tĩnh | 9 trang có `@media`; viewport được `doGet` thêm. Chưa chụp màn hình từng kích thước |
| Accessibility | ⚠️ Tĩnh | 0 thuộc tính `aria-*`/`role`, 169 `<label>` không gắn `for` → xem 09_TODO |
| Login / Logout / Session | ✅ | T-AUTH-01..05, UI-AUTH-01..04: đăng nhập qua Cổng, dùng lại link, sửa chữ ký, hết hạn, email chưa cấp quyền, khóa tài khoản khi đang có phiên, đăng xuất, trang nhúng |
| Permission / Role | ✅ | 38 hàm công khai gọi thẳng đều bị chặn; bảng quyền 123 chức năng; Chỉ xem không ghi được, Nhập liệu không quản lý người dùng; menu ẩn theo vai trò |
| Tra cứu hình ảnh / xuất PDF ảnh + hồ sơ pháp lý | ✅ | T-HA-01..07, UI-HA-01..04 (ghép PDF thật bằng pdf-lib 1.17.1: PDF nhiều trang + ảnh scan, báo file không ghép được, dự phòng khi không tải được thư viện; hồ sơ chỉ Nhập liệu/Quản trị): gom ảnh theo lô + GPS, theo khách hàng (cùng CCCD), chặn tải file Drive ngoài hợp đồng, cache ảnh nhỏ, chọn ảnh, giới hạn 60 ảnh, escape, che CCCD. Bộ chuyển HTML→PDF của Google chỉ chạy được trên Apps Script thật |
| Search (Tra cứu hợp đồng) | ✅ | T-TC-01/02/03, UI-TC-01/02/03: lọc Từ ngày–Đến ngày ký, không dấu, số 1 phần, che số theo vai trò, chống bấm lặp, dữ liệu độc hại |
| LocalStorage / IndexedDB | N/A | Không dùng (trừ 1 chỗ ở trang 24) |
| Dark Mode | N/A | Ứng dụng không có chế độ tối |

## 4. Chạy lại bộ test

Bộ test **không** nằm trong repo (repo được đồng bộ vào Apps Script; file `.js` sẽ bị coi là mã server và làm hỏng project). Tải kèm tệp `qa-tests.zip`, giải nén cạnh thư mục mã nguồn rồi:

```bash
TZ=Asia/Ho_Chi_Minh node tests.js                 # server
node ui_tests.js                                  # trình duyệt (cần Playwright + Chromium)
TZ=Asia/Ho_Chi_Minh node tests.js --root <thư mục mã cũ>   # chứng minh test bắt được lỗi trên mã cũ
```
