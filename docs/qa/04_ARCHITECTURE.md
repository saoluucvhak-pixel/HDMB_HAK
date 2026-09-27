# 04 — Kiến trúc hệ thống HDMB_HAK

> Số liệu trong tài liệu này lấy từ bộ phân tích tĩnh chạy trên mã nguồn thật (parser JS có xử lý chuỗi, comment và regex literal; đối chiếu khớp 100% với `grep "^function"`), tại commit `38482b9` (sau đợt 3: dọn mã chết, gộp code trùng).

## 1. Tổng quan

| Hạng mục | Giá trị |
|---|---|
| Nền tảng | Google Apps Script (runtime V8), Web App + menu trong Google Sheet |
| Triển khai (`appsscript.json`) | `executeAs: USER_DEPLOYING`, `access: ANYONE_ANONYMOUS`, múi giờ `Asia/Ho_Chi_Minh`, `exceptionLogging: STACKDRIVER` |
| Dịch vụ nâng cao | Drive API v2 (`Drive.Permissions` — chia sẻ quyền) |
| Thư viện ngoài | Chỉ **Leaflet 1.9.4** (CDN cdnjs) trong `MapContainer.html`. Không bundler, không framework |
| Quy mô | 35 file (24 `.gs`, 11 `.html`), **16.356 dòng** (trước đợt dọn: 19.058) |
| Hàm server | **261** (171 công khai, 90 riêng tư `_`) |
| Hàm client (trong `<script>`) | **296** (trước: 438 — phần lớn là bản sao trùng) |
| Lời gọi `google.script.run` | 146 điểm gọi, tới 114 hàm server khác nhau |

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
| **Phần dùng chung** (nạp bằng `<?!= include('…') ?>`) | `NhapLieu_Chung_JS.html` (67 hàm của form nhập liệu, dùng ở 07 + 11), `ChatbotWidget.html` (widget chatbot, dùng ở 10, 27, 30) | Sửa 1 chỗ áp dụng cho mọi trang dùng |

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

| Thời điểm | Nhóm hàm có thân giống hệt nhau ở nhiều file |
|---|---|
| Đầu đợt rà soát | **79** nhóm (07↔11: 58 hàm giống + 10 hàm đã lệch nhau; 26↔27: 51; widget chatbot ×4 trang; 6 bản hàm escape khác tên…) |
| Hiện tại | **2** nhóm: `thongBao_` (4 bản, 17 dòng) và `showMsg` (3 bản, 6 dòng) |

Cách xử lý: 67 hàm chung của 07/11 → `NhapLieu_Chung_JS.html`; widget chatbot → `ChatbotWidget.html`; trang 26 (bản cũ của 27) đã xóa. Việc gộp được kiểm chứng bằng cách ghép lại phần `include` rồi so từng hàm: tập hàm của mỗi trang giữ nguyên tuyệt đối.

**Vì sao quan trọng:** 3 lỗi thật tìm thấy trong đợt này (lưu ảnh GPS, ảnh chung hợp đồng, mất số 0 đầu khi tạo HĐ) đều là "đã vá ở bản sao này nhưng quên bản sao kia".

## 9. Mã chết (Dead code) — ĐÃ XÓA (`e5d5680`)

- **File:** `26_Page_QuanLyMeCon.html` (1.393 dòng — `?page=meconn` đã chuyển sang 27), `08_Sidebar.html`, `09_Style.html`.
- **19 hàm server** không được gọi từ đâu (trang, menu, trigger, tham chiếu bằng chuỗi), xóa lặp cho tới khi không còn hàm mồ côi mới: `layBaoCaoHopDongDonGian`, `canhBaoChenhLechDienTich`, `ocrFile_`, `chuyenNgayVeISO_`, `timCCCDTrongText_`, `soHopDongTiepTheo`, `layXemTruocDNTT`, `layNgayCanMinMaxTheoHopDong_`, `kiemTraKetNoiDNTT`, `layDuLieuConCuaHopDong`, `layDanhSachSTK`, `THEM_LINK_ANH_HOP_DONG`, `layChiTietHopDong`, `LAY_DRAFT`, rồi dây chuyền `tongHopHopDong` (+`_KhongCache`), `layHoacTinhBaoCao_`, `docCacheBaoCao_`, `layThoiGianThayDoiGanNhat_`.
- **1 hàm client:** `xemToaDoTrenBanDo` (trang 10).
- **Giữ lại có chủ đích** (chạy tay / trigger): `SETUP_ADMIN_TOKEN`, `SETUP_SYNC_TOKEN`, `TEST_KET_NOI_DON_GIAN`, `XOA_TRIGGER_LOI_GEO_DETECT_LOCATION`, `onChangeLamMoiCache`.
- ⚠️ Xóa trên GitHub có thể **không tự xóa** trong project Apps Script — cần xóa tay 3 file trên nếu công cụ đồng bộ không làm.

**CSS thừa:** chưa xóa — bộ phát hiện không phân biệt được class ghép động từ JS (vd `'badge-' + loai`), xóa nhầm sẽ mất định dạng.

## 10. Module nên tách / gộp

| Đề xuất | Trạng thái |
|---|---|
| Gộp JS chung 07 + 11 | ✅ `NhapLieu_Chung_JS.html` |
| Gộp widget chatbot | ✅ `ChatbotWidget.html` |
| Gộp `thongBao_` / `showMsg` / hàm escape vào 1 partial cho mọi trang | Còn lại — nhỏ, rủi ro thấp |
| Kiểm tra cấu trúc cột khi đọc/ghi (MAP-001) | ✅ `kiemTraCauTrucCot_` |
| Tách `06_CreateUpdate.gs` | ⏸️ Hoãn — rủi ro đồng bộ thủ công (06_REFACTOR_PLAN R6) |
| Xóa 26, 08, 09 | ✅ |
