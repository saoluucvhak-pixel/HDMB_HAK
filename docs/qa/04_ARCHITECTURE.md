# 04 — Kiến trúc hệ thống HDMB_HAK

> Số liệu trong tài liệu này lấy từ bộ phân tích tĩnh chạy trên mã nguồn thật (parser JS có xử lý chuỗi, comment và regex literal; đối chiếu khớp 100% với `grep "^function"`), tại commit `07eda6b`.

## 1. Tổng quan

| Hạng mục | Giá trị |
|---|---|
| Nền tảng | Google Apps Script (runtime V8), Web App + menu trong Google Sheet |
| Triển khai (`appsscript.json`) | `executeAs: USER_DEPLOYING`, `access: ANYONE_ANONYMOUS`, múi giờ `Asia/Ho_Chi_Minh`, `exceptionLogging: STACKDRIVER` |
| Dịch vụ nâng cao | Drive API v2 (`Drive.Permissions` — chia sẻ quyền) |
| Thư viện ngoài | Chỉ **Leaflet 1.9.4** (CDN cdnjs) trong `MapContainer.html`. Không bundler, không framework |
| Quy mô | 36 file (24 `.gs`, 12 `.html`), **19.058 dòng** |
| Hàm server | **276** (182 công khai, 94 riêng tư `_`) |
| Hàm client (trong `<script>`) | **438** |
| Lời gọi `google.script.run` | 198 điểm gọi, tới 114 hàm server khác nhau |

## 2. Cấu trúc thư mục (phẳng — ràng buộc của Apps Script)

Apps Script không hỗ trợ thư mục con thật, nên dự án dùng **tiền tố số** để nhóm file:

| Nhóm | File | Vai trò |
|---|---|---|
| Lõi / cấu hình | `00_Config.gs`, `Code.gs`, `05_Menu.gs` | Hằng số cột `*_COL`, tên sheet, `getSS_()/getReportSS_()`, `doGet()` định tuyến webapp, menu Sheet, nhật ký, cache báo cáo, helper ngày, chia sẻ quyền |
| Hợp đồng & báo cáo | `01_ContractManager.gs`, `02_DocumentChecker.gs`, `18_BaoCaoTongHop_Gop.gs`, `15_DraftHopDong.gs`, `16_DraftHoSoRung.gs`, `14_CtHopDong_PhuLuc.gs` | Draft báo cáo (bảng tổng hợp 1 dòng/hợp đồng), nháp hợp đồng, phụ lục, `ct_hopdong` |
| CRUD | `06_CreateUpdate.gs` (2.213 dòng, file lớn nhất) | Tạo/sửa/xóa hợp đồng, lô rừng, tài khoản, GPS, ảnh, hồ sơ, thanh lý |
| Kiểm tra / đối chiếu | `03_ImageForensics.gs`, `04_Reconciliation.gs`, `19_ChanDoanGPS.gs`, `17_ChanDoanTocDo.gs`, `28_BaoTri_DongBo.gs` | EXIF ảnh, OCR (Gemini), chẩn đoán, bảo trì |
| Chuyển đổi / xuất | `20_ChuyenDoiAnhURL.gs`, `21_DinhDangText.gs`, `22_XuatBaoCaoMisa.gs`, `23_XuatBangRaFile.gs`, `25_TrichXuatToaDoTuDiaChi.gs` | Chuẩn hóa dữ liệu, xuất MISA/Excel |
| Tích hợp | `29_Chatbot.gs` (Gemini), `31_TelegramBot.gs`, `32_TraCuuNganHang.gs` (VietQR + tracuubank), `Webhook_dntt.gs` | |
| Giao diện webapp | `30_Page_TongQuanHopDong` (mặc định), `10_Page_BaoCao`, `11_Page_NhapLieu`, `12_Page_KiemTra`, `13_HuongDan`, `24_Page_ThietLap`, `27_Page_HopDongMeCon`, `MapContainer` | |
| Giao diện trong Sheet | `07_Form_HopDong.html` (sidebar), `13_HuongDan.html` (dialog) | |
| **Không còn dùng** | `26_Page_QuanLyMeCon.html`, `08_Sidebar.html`, `09_Style.html` | Xem mục 9 |

## 3. Kho dữ liệu

| Kho | Truy cập | Nội dung |
|---|---|---|
| Sheet chính (bound) | `getSS_()` = `getActiveSpreadsheet()` | `HD_NCC` (hợp đồng), `HD_RUNG` (lô rừng), `HD_STK` (tài khoản), `HD_GPS`, `HD_Picture`, `DM_DIACHI`, `Draft_HopDong` (nháp), `Draft_AnhRung`, `NhatKy_SuaDoi`, `PhuLucHopDong`, `ct_hopdong` |
| Sheet báo cáo riêng | `getReportSS_()` (mở theo ID/URL, cache 1 lần/lượt chạy) | `Draft_BaoCaoHopDong`, `Draft_HoSoRung`, `Cache_BaoCao` |
| Sheet ngoài | `openByUrl(DNTT_URL)` | `DNTT_GK_DN_CT` (thanh toán/thực hiện) |
| Drive | 4 thư mục | Ảnh hiện trường, hồ sơ pháp lý, ảnh GPS, xuất MISA |
| ScriptCache | `CacheService` | `MAP_DATA_CACHE` (15 phút), danh sách ngân hàng (24h), khóa chống lưu trùng nháp |
| Script Properties | `PropertiesService` | Token (`SYNC_TOKEN`, `ADMIN_TOKEN`), ID file, mốc đồng bộ, `LOG_DEBUG` |

Google Sheet là **CSDL giả lập**: không có index, không truy vấn có điều kiện phía server, không khóa ngoại, không transaction — mọi "đọc theo ID" phải đọc cả sheet rồi lọc bằng JS; `LockService` là cơ chế duy nhất chống ghi đồng thời.

## 4. Quan hệ dữ liệu

```
HD_NCC (1 hợp đồng, khóa ID_HD = SoHD-ddMMyyyy)
 ├── HD_RUNG   (N lô rừng, ID_KEY_HD → ID_HD; ID_RUNG = HAK<SoHD>_<STT>)
 │    ├── HD_GPS      (N điểm, ID_KEY_GPS → ID_RUNG)
 │    └── Draft_AnhRung (ảnh chờ duyệt theo ID_RUNG)
 ├── HD_STK    (N tài khoản, ID_HD)
 ├── HD_Picture (ảnh theo ID_HD — dữ liệu cũ đôi khi lưu nhầm ID_RUNG, code tự dò 2 chiều)
 ├── PhuLucHopDong (N phụ lục, ID_PHU_LUC = PL_<ID_HD>_<lần>)
 └── Draft_BaoCaoHopDong / Draft_HoSoRung (bảng tổng hợp dẫn xuất — cache)
```

## 5. Luồng xử lý chính

**Mọi thao tác webapp:** Trình duyệt → `doGet(e)` chọn trang theo `?page=` (bảng `TRANG_WEBAPP_`) → HTML template (`baseUrl`, `currentPage`) → JS trang gọi `google.script.run.<HÀM>(...)` → hàm server đọc/ghi Sheet/Drive (có `LockService` ở các điểm "tính số tiếp theo rồi ghi") → cập nhật Draft báo cáo + xóa cache bản đồ → trả JSON (ngày luôn là chuỗi `yyyy-MM-dd`) → JS render.

**Sửa hợp đồng qua nháp (07 sidebar, 11 webapp):** `MO_DRAFT_THEO_SO_DONG` → `LAY_DRAFT_THEO_ID_HD` (khóa, tạo/đọc nháp, chuẩn hóa nháp cũ) → người dùng sửa, tự lưu nháp (`LUU_DRAFT`, debounce 700ms) → `LUU_CHINH_THUC` (nhận nháp nguyên tử qua ScriptCache, ghi HD_NCC/HD_RUNG/HD_STK/GPS/phụ lục bằng các hàm CRUD sẵn có, tìm lại dòng nháp theo ID rồi xóa).

**Sửa hợp đồng trực tiếp (27):** `layHopDongTheoSoDong` → wizard → `TAO_HOP_DONG_MOI` / `LUU_HOP_DONG_DAY_DU` → `CAP_NHAT_HOP_DONG` (chỉ ghi các khóa có trong patch).

**Nền (trigger):** `dongBoThanhToanNeuCoThayDoi_` mỗi 30 phút (so số dòng + thời điểm sửa file DNTT → làm mới cache thanh toán → `capNhatDraftHangLoat_` cho toàn bộ hợp đồng); `xuLyOnEditDraft_` (installable onEdit — sửa tay trên Sheet cũng cập nhật Draft); chuyển ảnh sang URL mỗi 6 giờ; Telegram báo hằng ngày.

## 6. Dependency

- **Nội bộ:** tất cả `.gs` chung 1 namespace toàn cục. Không có trùng tên hàm / hằng số giữa các file (đã kiểm tra — trùng tên trong Apps Script làm hỏng cả dự án).
- **Google:** SpreadsheetApp, DriveApp, Drive v2, CacheService, LockService, PropertiesService, UrlFetchApp, HtmlService, ScriptApp, ContentService, Utilities, Session. `DocumentApp` chỉ có 1 lần dùng (04_Reconciliation).
- **Bên ngoài:** Gemini API (OCR/Chatbot — gửi dữ liệu hợp đồng/ảnh CCCD sang Google AI), Telegram Bot API, `api.vietqr.io`, `tracuubank.com` (gửi số tài khoản ra dịch vụ bên thứ ba — xem 02_SECURITY_REPORT), ArcGIS tile, cdnjs (Leaflet).
- **Scope OAuth:** `spreadsheets`, `drive` (toàn bộ Drive), `documents`, `script.external_request`, `script.scriptapp`, `userinfo.email`.

## 7. Hàm quan trọng (điểm nghẽn / điểm rủi ro)

| Hàm | File | Vì sao quan trọng |
|---|---|---|
| `doGet` | Code.gs | Cửa vào duy nhất của webapp, không có xác thực |
| `LUU_HOP_DONG_DAY_DU` (153 dòng) | 06 | Tạo/sửa hợp đồng + lô + tài khoản trong 1 lệnh |
| `LUU_CHINH_THUC` / `luuChinhThucThucThi_` | 15 | Điểm ghi duy nhất của luồng nháp |
| `CAP_NHAT_HOP_DONG` | 06 | Ghi patch vào HD_NCC (chỉ khóa có mặt) |
| `THEM_LO_RUNG_MOI`, `LUU_PHU_LUC`, `THEM_TAI_KHOAN_MOI` | 06/14 | Sinh STT/ID — cần khóa |
| `CAP_NHAT_DRAFT_MOT_HOP_DONG`, `capNhatDraftHangLoat_` | 01 | Lớp cache báo cáo trung tâm, gọi sau hầu hết thao tác ghi |
| `ngayToISO_` | 00 | Mọi ngày gửi về client đi qua đây |
| `TAI_TRANG_BAO_CAO_TONG_HOP` (154 dòng) | 18 | Tải toàn bộ trang báo cáo trong 1 RPC |
| `timNguCanhChatbot_` (169 dòng) | 29 | Hàm dài nhất |

## 8. Hàm trùng lặp (Duplicate Code)

79 nhóm hàm có **thân giống hệt nhau** ở nhiều file. Nặng nhất:

| Cặp | Hàm chung | Giống hệt | Khác nhau | Ghi chú |
|---|---|---|---|---|
| `07_Form_HopDong` ↔ `11_Page_NhapLieu` | 70 | 66 (576 dòng) | 4 | Trước đợt này là 58 giống / **10 lệch** — 6 hàm lệch chứa bản vá chỉ có ở 11, đã đồng bộ. 4 hàm còn khác là khác biệt cố ý (07 không có ô Nhóm KH/MST, không chọn khách hàng có sẵn, không có ô ảnh cho từng điểm GPS) |
| `26` ↔ `27` | 62 | 51 (627 dòng) | 11 | 26 đã ngừng dùng |
| Widget chatbot | 4 hàm × 4 trang (10, 26, 27, 30) | | | |
| Helper escape HTML | 6 bản với 6 tên khác nhau (`escHtmlKH_`, `escHtmlNL_`, `escHtmlBT_`, `escHtml_`×2, `escHtmlTQ_`) + `escAT_` | | | Đã sửa cùng lúc cả 6 bản (escape thêm dấu nháy) |
| `showMsg` | 5 trang | | | |

**Rủi ro thực tế của trùng lặp đã được chứng minh trong đợt này:** 3 lỗi thật (lưu ảnh GPS, ảnh chung hợp đồng, mất số 0 đầu khi tạo HĐ qua `LUU_HOP_DONG_DAY_DU`) đều là "đã vá ở bản sao này nhưng quên bản sao kia". Kế hoạch gộp: xem `06_REFACTOR_PLAN.md`.

## 9. Mã chết (Dead code)

**File không còn được tham chiếu:**

| File | Dòng | Bằng chứng |
|---|---|---|
| `26_Page_QuanLyMeCon.html` | 1.393 | `?page=meconn` đã chuyển sang file 27; không còn `createTemplateFromFile('26_…')` nào |
| `08_Sidebar.html` | 41 | Không có tham chiếu |
| `09_Style.html` | 130 | Tham chiếu duy nhất nằm trong comment ví dụ của `include()`; toàn bộ 31 class CSS trong file không được dùng |

**Hàm server không được gọi từ đâu cả (20):** `layBaoCaoHopDongDonGian`, `canhBaoChenhLechDienTich`, `ocrFile_`, `chuyenNgayVeISO_`, `timCCCDTrongText_`, `include`, `soHopDongTiepTheo`, `layXemTruocDNTT`, `layNgayCanMinMaxTheoHopDong_`, `kiemTraKetNoiDNTT`, `layDuLieuConCuaHopDong`, `layDanhSachSTK`, `THEM_LINK_ANH_HOP_DONG`, `layChiTietHopDong`, `LAY_DRAFT` — cùng 5 hàm **chạy tay từ trình soạn thảo có chủ đích** (giữ lại): `SETUP_ADMIN_TOKEN`, `SETUP_SYNC_TOKEN`, `TEST_KET_NOI_DON_GIAN`, `XOA_TRIGGER_LOI_GEO_DETECT_LOCATION`, `onChangeLamMoiCache` (trigger cài tay).

**Hàm client không dùng:** 1 (`xemToaDoTrenBanDo` ở trang 10) — các trang khác không có.

**CSS không dùng** (class định nghĩa nhưng không xuất hiện trong trang, đã loại class sinh động từ JS): 09_Style 31/31, 13_HuongDan 22/33, 26 12/67, 27 11/67, 30 10/43, 24 8/33, 11 4/65, 12 4/35, 10 3/54, 07 0/43.

**Library dư thừa:** không có (chỉ Leaflet, đang dùng). **Scope dư:** `documents` chỉ phục vụ 1 lệnh `DocumentApp` — cần xác nhận còn dùng trước khi gỡ.

> Mã chết **chưa bị xóa** trong đợt này: quy tắc của dự án là không xóa chức năng khi chưa được xác nhận. Danh sách xóa đề xuất nằm trong `09_TODO.md`.

## 10. Module nên tách / gộp

| Đề xuất | Lý do |
|---|---|
| **Gộp** JS chung của 07 + 11 thành 1 partial (`<?!= include('_NhapLieu_JS') ?>`) | 66 hàm giống hệt; nguồn gốc của lỗi "vá 1 bản quên bản kia". Helper `include()` đã có sẵn |
| **Gộp** widget chatbot (4 trang) và helper chung (escape, toast, showMsg, format số) thành partial | 6 bản escape khác tên là ví dụ rõ nhất |
| **Tách** `06_CreateUpdate.gs` (2.213 dòng, 64 hàm) theo thực thể: hợp đồng / lô rừng / tài khoản / GPS-ảnh / thanh lý | File quá dài, khó review |
| **Tách** bảng cột `*_COL` khỏi logic: đọc tiêu đề 1 lần và kiểm tra khớp khi khởi động | Chèn/xóa cột tay trên Sheet làm lệch âm thầm toàn bộ đọc/ghi (MAP-001) |
| **Xóa** 26, 08, 09 | Mã chết (sau khi xác nhận) |
