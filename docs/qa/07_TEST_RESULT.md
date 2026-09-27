# 07 — Kết quả kiểm thử (Test Result)

## 1. Cách kiểm thử

Không có quyền vào project Apps Script / Google Sheet thật, nên xây 3 lớp kiểm thử chạy được và lặp lại được:

| Lớp | Công cụ | Chạy gì |
|---|---|---|
| **Server** | Bộ giả lập Apps Script trong Node (`gasmock.js`): nạp **cả 24 file `.gs` cùng lúc** như Apps Script, giả lập SpreadsheetApp (bảng trong bộ nhớ, **mô phỏng cách Sheets ép kiểu khi ghi**: chuỗi số mất số 0 đầu nếu ô không định dạng TEXT, chuỗi ngày thành ngày lúc 00:00 múi giờ bảng tính), Utilities.formatDate, LockService (ghi nhận khóa lồng), CacheService, PropertiesService, Session. Chạy với `TZ=Asia/Ho_Chi_Minh` | Luồng nghiệp vụ thật: tạo → mở nháp → sửa → lưu chính thức, rồi đọc lại ô trong Sheet |
| **Trình duyệt** | Playwright + Chromium, trang HTML thật, `google.script.run` giả lập trả dữ liệu (kể cả dữ liệu độc hại) | Hiển thị, escape, chống bấm lặp, toast, tải trang không lỗi JS |
| **Tương đương** | Ghi lại toàn bộ hành vi trước/sau khi tái cấu trúc | `doGet` (29 trường hợp), `KIEM_TRA_ANH_DA_CHON` (103 ảnh) |

**Nguyên tắc chấm đạt:** mỗi lỗi được coi là đã sửa khi test của nó **thất bại trên mã cũ** (commit `8cbf662`, trước đợt này) và **đạt trên mã mới**. Các test đạt trên cả hai là test hồi quy cho lỗi đã sửa ở đợt trước (24/09).

## 2. Kết quả

### Server (bộ giả lập Apps Script) — 22/22 đạt (mã cũ trước đợt này: 8/22)

| ID | Kịch bản | Mã mới | Mã cũ (8cbf662) |
|---|---|---|---|
| T-DATE-01 | ngayToISO_: Date ở 00:00 UTC+7 -> đúng ngày lịch | ✅ PASS | FAIL — local midnight: expected "2026-05-10", got "2026-05-09T17:00:00.000Z" |
| T-DATE-02 | ngayToISO_: chuỗi yyyy-mm-dd, dd/mm/yyyy, rỗng, sai | ✅ PASS | FAIL — iso date kept: expected "2026-05-10", got "2026-05-10T00:00:00.000Z" |
| T-DATE-03a | Mở+lưu hợp đồng 3 lần qua form 07/11: Ngày ký/Ngày cấp KHÔNG bị lùi | ✅ PASS | FAIL — Ngày ký sau 3 lần lưu: expected "10/05/2026", got "08/05/2026" |
| T-DATE-03b | Mở+lưu hợp đồng 3 lần qua form 27: Ngày ký/Ngày cấp KHÔNG bị lùi | ✅ PASS | FAIL — Ngày ký sau 3 lần lưu: expected "10/05/2026", got "08/05/2026" |
| T-DRAFT-01 | Luồng nháp 11 (mở -> sửa -> Lưu chính thức) giữ nguyên Nhóm KH, MST và ngày | ✅ PASS | FAIL — Nhóm KH: expected "KH lẻ", got "" |
| T-DRAFT-02 | Nháp CŨ (lưu trước bản vá: thiếu nhomKH/MST, ngày UTC) được tự chuẩn hóa khi mở lại | ✅ PASS | FAIL — legacy ngayKy: expected "2026-05-10", got "2026-05-09T17:00:00.000Z" |
| T-SEC-001 | Chia sẻ/thu hồi quyền bị chặn khi thiếu/sai ADMIN_TOKEN (không gọi tới Drive API) | ✅ PASS | PASS |
| T-LOCK-001 | LUU_PHU_LUC: lần phụ lục tăng dần 1,2,3 và ID không trùng | ✅ PASS | PASS |
| T-STT-01 | THEM_LO_RUNG_MOI sau khi xóa lô ở giữa không sinh STT trùng | ✅ PASS | PASS |
| T-CACHE-001 | Thêm/sửa/xóa lô rừng đều xóa cache Bản đồ GPS | ✅ PASS | PASS |
| T-GPS-01 | CAP_NHAT_GPS_RUNG ghiDe=true thay toàn bộ điểm cũ, lưu tọa độ DD | ✅ PASS | PASS |
| T-PERF-001 | capNhatDraftHangLoat_ cho KẾT QUẢ GIỐNG HỆT gọi CAP_NHAT_DRAFT_MOT_HOP_DONG từng hợp đồng | ✅ PASS | PASS |
| T-FIX-C | Menu "Cài đặt Vùng": thiếu file 23_CaiDatVung.html vẫn không ném lỗi | ✅ PASS | FAIL — [gasmock] HtmlService.createHtmlOutputFromFile not mocked |
| T-THANHLY-01 | Hợp đồng "Đã thanh lý" không cho sửa qua LUU_HOP_DONG_DAY_DU | ✅ PASS | PASS |
| T-TEXT-01 | CCCD/SĐT/MST giữ số 0 đầu khi tạo và khi sửa | ✅ PASS | FAIL — CCCD on create: expected "049012345678", got "49012345678" |
| T-TK-01 | THEM_TAI_KHOAN_MOI trả đúng số dòng vừa ghi và giữ số 0 đầu của Số TK | ✅ PASS | PASS |
| T-DOUBLE-01 | Bấm "Lưu chính thức" 2 lần (request thứ 2 tới khi request 1 đang chạy) chỉ tạo 1 hợp đồng | ✅ PASS | FAIL — number of contracts created: expected 1, got 2 |
| T-DRAFTDEL-01 | Lưu chính thức không xóa NHẦM nháp của người khác khi các dòng nháp bị dịch chuyển | ✅ PASS | FAIL — draft C (another user) was deleted by mistake; remaining: DRAFT_UUID-0CB |
| T-LOG-01 | log_: ERROR/WARNING/INFO ra đúng console.*, DEBUG chỉ khi bật LOG_DEBUG | ✅ PASS | FAIL — P.ctx.log_ is not a function |
| T-LOG-02 | Lỗi tổng hợp ct_hopdong không còn bị nuốt im lặng | ✅ PASS | FAIL — error was not logged |
| T-SEC-006 | Người lạ gọi SETUP_*_TOKEN không ghi đè được token đã cấu hình; token mẫu bị từ chối | ✅ PASS | FAIL — SYNC_TOKEN overwritten: expected "that-su-bi-mat", got "DAT_TOKEN_CUA_BAN_O_DAY" |
| T-SEC-009 | Tải lên: từ chối file html/exe và file > 20MB trước khi ghi vào Drive; ảnh/PDF vẫn qua | ✅ PASS | FAIL — TAI_ANH_GPS_LEN_DRIVE accepted html: {"thanhCong":false,"loi":"[gasmock] DriveApp.getFolde |

### Trình duyệt (Chromium + giả lập google.script.run) — 18/18 đạt (mã cũ: 10/18)

| ID | Kịch bản | Mã mới | Mã cũ (8cbf662) |
|---|---|---|---|
| UI-07-ANH | 07: tab Hình ảnh hiện ảnh chung của HĐ + chặn tên file/link độc hại | ✅ PASS | FAIL — contract-level photos rendered: -1 |
| UI-11-ANH | 11: tab Hình ảnh hiện ảnh chung của HĐ + chặn tên file/link độc hại | ✅ PASS | FAIL — file name was parsed as HTML (<img> injected) |
| UI-07-GPSANH | 07: đọc GPS từ ảnh -> lưu luôn ảnh minh chứng vào điểm nháp | ✅ PASS | FAIL — photo url stored with the point: {"lat":15.73,"lng":108.02} |
| UI-27-QUOTE | 27: giá trị có dấu " không bị cắt cụt trong form sửa + không chèn được thuộc tính | ✅ PASS | FAIL — value truncated to: Thôn  |
| UI-07-DOUBLE | 07: bấm "Lưu chính thức" 2 lần chỉ gửi 1 yêu cầu | ✅ PASS | FAIL — LUU_CHINH_THUC sent 3 times |
| UI-11-DOUBLE | 11: bấm "Lưu chính thức" 2 lần chỉ gửi 1 yêu cầu | ✅ PASS | FAIL — LUU_CHINH_THUC sent 3 times |
| UI-27-DOUBLE | 27: bấm "Lưu" hợp đồng mới 2 lần chỉ gửi 1 TAO_HOP_DONG_MOI | ✅ PASS | FAIL — TAO_HOP_DONG_MOI sent 2 times |
| UI-11-TOAST | 11: lỗi hiện dạng thông báo nổi (không dùng alert chặn màn hình) | ✅ PASS | FAIL — alert() still called |
| UI-LOAD-07 | 07_Form_HopDong.html: tải trang không lỗi JS | ✅ PASS | PASS |
| UI-LOAD-10 | 10_Page_BaoCao.html: tải trang không lỗi JS | ✅ PASS | PASS |
| UI-LOAD-11 | 11_Page_NhapLieu.html: tải trang không lỗi JS | ✅ PASS | PASS |
| UI-LOAD-12 | 12_Page_KiemTra.html: tải trang không lỗi JS | ✅ PASS | PASS |
| UI-LOAD-13 | 13_HuongDan.html: tải trang không lỗi JS | ✅ PASS | PASS |
| UI-LOAD-24 | 24_Page_ThietLap.html: tải trang không lỗi JS | ✅ PASS | PASS |
| UI-LOAD-26 | 26_Page_QuanLyMeCon.html: tải trang không lỗi JS | ✅ PASS | PASS |
| UI-LOAD-27 | 27_Page_HopDongMeCon.html: tải trang không lỗi JS | ✅ PASS | PASS |
| UI-LOAD-30 | 30_Page_TongQuanHopDong.html: tải trang không lỗi JS | ✅ PASS | PASS |
| UI-LOAD-Ma | MapContainer.html: tải trang không lỗi JS | ✅ PASS | PASS |

### Kiểm thử tương đương (tái cấu trúc không đổi hành vi)

| Hạng mục | Kết quả |
|---|---|
| `doGet` — 29 trường hợp (16 giá trị `?page=` gồm cả `constructor`, `__proto__`, `MAP`, trang lạ; 13 tổ hợp `action=run` × trạng thái token) | **25/29 giống hệt từng lệnh gọi**. 4 khác biệt đều là trường hợp token mẫu — cố ý đổi từ "chạy đồng bộ" sang "từ chối" (SEC-006) |
| `KIEM_TRA_ANH_DA_CHON` — 103 ảnh, 25 hợp đồng, điểm DD/DMS/sai định dạng, ID lạ/rỗng | Kết quả và tọa độ truyền vào `kiemTraMotAnh` **giống từng bit**; HD_GPS đọc 103 → 1 lần |
| `capNhatDraftHangLoat_` so với gọi từng hợp đồng | Bảng Draft **giống hệt** (T-PERF-001) |

### Kiểm tra tĩnh
- `node --check` cho cả 24 `.gs` và `<script>` của 12 `.html`: không lỗi cú pháp.
- Không trùng tên hàm/hằng số toàn cục giữa các file `.gs` (lỗi làm hỏng cả project Apps Script).
- Mọi lời gọi `google.script.run` thật đều có `withFailureHandler` (2 trường hợp bộ phân tích nghi ngờ ở trang 10 là dòng chú thích).
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
| Permission / Token | ✅ | ADMIN_TOKEN, SYNC_TOKEN, SETUP_* |
| XSS / Injection | ✅ | Tên file, link `javascript:`, dấu nháy trong thuộc tính |
| Unhandled error / Try-catch | ✅ | Log lỗi thay vì nuốt im lặng; lỗi RPC hiện toast |
| Page load / Console error | ✅ | 10 trang đang dùng, 0 lỗi JS |
| Search / Filter / Sort / Pagination | ⚠️ Tĩnh | Đã đọc code; chưa có test tự động |
| Import / Export / Excel / PDF / Print / Report | ⚠️ Chưa | Cần DriveApp/UrlFetch thật (xuất qua `docs.google.com/.../export`) |
| Trigger | ⚠️ Một phần | Logic của hàm trigger được test (PERF-001); việc cài trigger cần runtime thật |
| Responsive / Mobile / Tablet | ⚠️ Tĩnh | 9 trang có `@media`; viewport được `doGet` thêm. Chưa chụp màn hình từng kích thước |
| Accessibility | ⚠️ Tĩnh | 0 thuộc tính `aria-*`/`role`, 169 `<label>` không gắn `for` → xem 09_TODO |
| Login / Logout / Session | N/A | Ứng dụng chưa có đăng nhập (SEC-002) |
| LocalStorage / IndexedDB | N/A | Không dùng (trừ 1 chỗ ở trang 24) |
| Dark Mode | N/A | Ứng dụng không có chế độ tối |

## 4. Chạy lại bộ test

Bộ test **không** nằm trong repo (repo được đồng bộ vào Apps Script; file `.js` sẽ bị coi là mã server và làm hỏng project). Tải kèm tệp `qa-tests.zip`, giải nén cạnh thư mục mã nguồn rồi:

```bash
TZ=Asia/Ho_Chi_Minh node tests.js                 # server
node ui_tests.js                                  # trình duyệt (cần Playwright + Chromium)
TZ=Asia/Ho_Chi_Minh node tests.js --root <thư mục mã cũ>   # chứng minh test bắt được lỗi trên mã cũ
```
