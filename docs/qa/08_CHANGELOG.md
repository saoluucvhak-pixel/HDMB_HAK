# 08 — Nhật ký thay đổi (Changelog)

Nhánh: `claude/test-code-bug-project-nywz0r`. Mỗi dòng là 1 commit đã đẩy lên GitHub; chi tiết nằm trong nội dung commit.

## 27/09/2026 — Đợt 4: đăng nhập Gmail + phân quyền (theo DNTT) và Tra cứu hợp đồng

| Commit | Loại | Thay đổi | File |
|---|---|---|---|
| `c852a6a` | 🔒✨ Bảo mật + tính năng | **SEC-002**: đăng nhập qua Cổng đăng nhập Gmail, 3 vai trò (Quản trị / Nhập liệu / Chỉ xem) trong `SYS_NguoiDung`, 1 cửa `api()` + bảng quyền 123 chức năng; 133 hàm thành riêng tư; 38 hàm menu/trigger kiểm tra quyền; màn đăng nhập, ẩn menu theo vai trò, Đăng xuất; thẻ Người dùng & Cổng đăng nhập ở Thiết lập; nhật ký ghi email người đăng nhập. **Trang 🔍 Tra cứu hợp đồng** (`?page=tracuu`) | 34_PhanQuyen.gs, 33_TraCuuHopDong.gs, 33_Page_TraCuuHopDong.html, PhanQuyen_JS.html (mới); mọi `.gs`/`.html` có lời gọi server |
| `452e6e6` | 📄 | Cập nhật báo cáo | docs/qa |
| (merge) | 🔀 | Gộp `main` (đồng bộ từ Apps Script; `access` đổi sang `ANYONE` theo chủ dự án) | appsscript.json |
| (commit sau) | 🐛 | Báo cáo PDF mục Thanh toán: **khối lượng lấy nhầm cột** — trước đây dò tiêu đề có chữ "khối lượng" và lấy cột đầu tiên khớp (cột KG đứng trước), thành tiền dò chữ "giá trị" cũng có thể lấy nhầm. Nay dùng cột cố định như báo cáo Thanh toán/Draft: G Người nhận, L Số CT, **M Khối lượng (tấn)**, Q Thành tiền, T Số HĐ. Test gài cột KG và cột "giá trị" làm bẫy | 36_BaoCaoHopDong.gs |
| `0dd558d` | 🐛✨ | Báo cáo PDF: **số canh phải** trong các bảng (quy tắc CSS `table.bang td{text-align:left}` đè lên `td.so`), cột khối lượng giữ đủ chữ số thập phân để dấu phẩy thẳng hàng; mã QR thêm **Ngày ký** hợp đồng | 36_BaoCaoHopDong.gs, 13_HuongDan.html |
| `457c8b6` | ✨ | Báo cáo thực hiện: mục **3. Chi tiết phiếu cân** (từng phiếu từ `PhieuCan_DN` trạng thái OK, nối qua Số CT của DNTT: số phiếu + link ảnh, ngày giờ cân, biển số, cân lần 1/2, KL hàng, đơn giá, thành tiền; tổng và cảnh báo khi lệch tổng thanh toán) và **con dấu mã QR** mỗi hợp đồng (Số HĐ, chủ rừng, địa chỉ, địa chỉ rừng, diện tích) — QR tạo ngay trong script (`37_MaQR.gs`, không gửi dữ liệu ra ngoài), kiểm tra giải mã được 81/81 mẫu độ dài khác nhau và quét được ở mọi độ phóng màn hình | 36_BaoCaoHopDong.gs, 37_MaQR.gs (mới), 13_HuongDan.html |
| `1a9272a` | 🔀🐛 | Gộp `main` (`acba241`, `fa95d5e` — đồng bộ từ Apps Script, thêm kiểm tra quyền trong nhiều hàm nội bộ, ghi hàng loạt ở Bảo trì, chatbot đọc HD_NCC 1 lần). Giữ các kiểm tra quyền đó, **trừ 11 chỗ** gây lỗi: 9 hàm nội bộ nằm trên đường chạy của trigger / bot Telegram / doPost (không có người đăng nhập → bị chặn): `TRA_LOI_CHATBOT_`, `CHAN_DOAN_MO_COI_TOAN_HE_THONG_`, `CHUYEN_DOI_TEN_FILE_ANH_SANG_URL_`, `CHUYEN_DOI_HO_SO_PHAP_LY_SANG_URL_`, `layGPSCuaRung_`, `layHopDongTheoKhachHang_`, `layDraftAnhChoRung_`, `layDanhSachTaiKhoan_`, `layDanhSachRung_`; 2 hàm đọc cài đặt chặn nhầm vai trò Nhập liệu khi xuất MISA / tra tên chủ TK: `LAY_THIET_LAP_MISA_`, `LAY_CAI_DAT_TRA_CUU_NH_` (các hàm này vẫn chỉ gọi được qua `api()` đã kiểm tra quyền). Nút báo cáo trùng ở trang 33/35 (bản trên main) bỏ, giữ 1 nút. Test mới T-AUTH-06 chặn tái phát | 06, 20, 22, 28, 29, 32 (.gs) |
| `d7c5507` + commit sau | ✨ | **📊 Báo cáo thực hiện hợp đồng (PDF)** (trang Tra cứu hình ảnh + nút trong chi tiết Tra cứu hợp đồng): bên bán & tài khoản, khối lượng/giá trị HĐ – đã thực hiện – còn lại (thanh tiến độ, phiếu cân), các lần thanh toán từ DNTT, bản đồ vệ tinh Google Maps từng lô (điểm GPS + vùng), bảng tọa độ có link Google Maps, ảnh hiện trường/ảnh GPS theo lô, danh mục hồ sơ pháp lý và ghép nguyên văn hồ sơ (Nhập liệu / Quản trị) | 36_BaoCaoHopDong.gs (mới), 34_PhanQuyen.gs, 35_Page_TraCuuHinhAnh.html, 33_Page_TraCuuHopDong.html, 13_HuongDan.html |
| `070fd94` | 🐛 | **Không phải đăng nhập lại liên tục**: phiên lưu ở localStorage (dùng chung mọi tab, còn sau khi đóng trình duyệt), tự gia hạn 30 phút/lần khi đang dùng, tối đa 7 ngày; Đăng xuất thoát mọi tab. Trình duyệt chặn bộ nhớ trang nhúng (chặn cookie bên thứ ba) thì mã phiên đi kèm link chuyển trang (`?ph=`, doGet chỉ nhận mã còn hiệu lực, xóa khỏi thanh địa chỉ ngay) | PhanQuyen_JS.html, 34_PhanQuyen.gs, Code.gs, 13_HuongDan.html |
| `ecf15b0` | 🐛✨ | **Mở ảnh / hồ sơ không còn bị Drive đòi cấp quyền**: mọi link Drive của ảnh/hồ sơ trên các trang (và sidebar) mở trong khung xem của hệ thống qua quyền chủ script — xem ảnh / trang đầu PDF, Tải về, Mở trong tab mới, Mở trên Drive. Chỉ file thuộc dữ liệu hợp đồng (HD_Picture, HD_GPS, Draft_AnhRung, HD_RUNG); hồ sơ pháp lý chỉ Nhập liệu / Quản trị; link khác mở Drive như cũ | PhanQuyen_JS.html, 35_TraCuuHinhAnh.gs, 34_PhanQuyen.gs, 13_HuongDan.html |
| `eb63399`, `ee2b6dd` | ✨🔒 | Tra cứu hình ảnh: **hồ sơ pháp lý** từng lô (trang đầu, phóng to, mở file gốc) và ô **Kèm hồ sơ pháp lý** khi xuất PDF — ghép nguyên văn PDF/ảnh scan/Google Docs vào cuối file (pdf-lib trên trình duyệt), bảng danh mục ở trang đầu. Chỉ Nhập liệu / Quản trị; `LAY_FILE_HO_SO` chỉ trả file là hồ sơ của hợp đồng đang xem, tối đa 15 MB/file | 35_TraCuuHinhAnh.gs, 35_Page_TraCuuHinhAnh.html, 34_PhanQuyen.gs, 13_HuongDan.html |
| `823277d` | ✨ | **Tra cứu hình ảnh** (`?page=hinhanh`): chọn hợp đồng hoặc khách hàng → ảnh hiện trường + ảnh GPS theo lô, phóng to, chọn ảnh → **xuất PDF** (trang thông tin + lưới ảnh có chú thích, tối đa 60 ảnh). Ảnh tải qua quyền chủ script, chỉ ảnh thuộc hợp đồng đang xem | 35_TraCuuHinhAnh.gs, 35_Page_TraCuuHinhAnh.html (mới); 34_PhanQuyen.gs, Code.gs, PhanQuyen_JS.html, menu các trang |
| `38b682c` | ✨ | Tra cứu hợp đồng: lọc **Từ ngày – Đến ngày ký** (có thể chỉ chọn ngày, không cần từ khóa), nút chọn nhanh Tháng này / Tháng trước / Quý này / Năm nay; giới hạn hiển thị 50 → 200 hợp đồng | 33_TraCuuHopDong.gs, 33_Page_TraCuuHopDong.html, 13_HuongDan.html |

## 27/09/2026 — Đợt 3: dọn mã chết, gộp mã trùng, XSS còn lại, chặn ghi lệch cột

| Commit | Loại | Thay đổi | File |
|---|---|---|---|
| `d15c9fa` | 🔀 Merge | Gộp nhánh `main` (đổi bảng màu giao diện của chủ dự án). Xung đột giữ bản có `ADMIN_TOKEN` và ghép màu mới với phần escape | 00_Config, 07, 11, 24, … |
| `e5d5680` | 🧹 Mã chết | Xóa `26_Page_QuanLyMeCon.html`, `08_Sidebar.html`, `09_Style.html`; 19 hàm server + 1 hàm client không ai gọi (bớt 12 hàm công khai gọi được ẩn danh, gồm hàm ghi `THEM_LINK_ANH_HOP_DONG`). `doGet` 29/29 trường hợp giống hệt | 01, 02, 03, 04, 06, 14, 15, Code, 10 |
| `534ac14` | ♻️ Gộp mã trùng | 67 hàm giống hệt của sidebar 07 và trang 11 chuyển vào `NhapLieu_Chung_JS.html`; 4 hàm khác nhau có chủ đích giữ ở từng trang | 07, 11, NhapLieu_Chung_JS (mới) |
| `64cde28` | ♻️🔒 Gộp + bảo mật | Widget chatbot của 10/27/30 chuyển vào `ChatbotWidget.html`; sửa chèn thuộc tính qua link trong trả lời chatbot (SEC-011) | 10, 27, 30, ChatbotWidget (mới) |
| `a72c265` | 🔒 Bảo mật | Escape 116 dòng còn lại chèn dữ liệu vào `innerHTML` (dữ liệu Sheet, dữ liệu tra cứu ngân hàng bên ngoài); `href` chỉ nhận http(s) | 10, 11, 12, 24, 27, 30, NhapLieu_Chung_JS |
| `38482b9` | 🛡️ Toàn vẹn dữ liệu | MAP-001: phát hiện cột bị chèn/xóa tay ở 6 sheet dữ liệu → **dừng ghi** và báo rõ cột nào lệch; menu "Xác nhận cấu trúc cột hiện tại" | 00_Config, 05_Menu |
| `f064f8a` | 📄 | Cập nhật 10 báo cáo | docs/qa |

## 27/09/2026 — Đợt 2: rà soát toàn dự án + nâng cấp

| Commit | Loại | Thay đổi | File |
|---|---|---|---|
| `ed12988` | 🐛 Sửa lỗi dữ liệu | Ngày lùi 1 ngày mỗi lần lưu (BUG-01); sửa hợp đồng xóa Nhóm KH/MST (BUG-02); tạo HĐ mất số 0 đầu CCCD/SĐT/Số TK/MST (BUG-03); menu "Cài đặt Vùng" luôn lỗi (BUG-08); thêm menu dọn file tạm MISA (BUG-09) | 00_Config, 05_Menu, 06_CreateUpdate, 15_DraftHopDong, 21_DinhDangText |
| `3efef6c` | 🐛🔒 Sửa lỗi + bảo mật | Giá trị có dấu `"` bị cắt cụt khi sửa (BUG-04); XSS qua tên file / link tải lên (SEC-008); đồng bộ sidebar 07 với trang 11: lưu ảnh GPS, hiện ảnh chung hợp đồng (BUG-07) | 07, 10, 11, 12, 24, 26, 27, 30 (.html) |
| `e5e4ef7` | 🐛 Sửa lỗi | Bấm lưu 2 lần tạo 2 hợp đồng (BUG-05); xóa nhầm nháp người khác (BUG-06) | 15_DraftHopDong, 07, 11, 27 |
| `a1b9f05` | ♻️🔒📝 Tái cấu trúc + log | `doGet` dạng bảng định tuyến (135 → 43 dòng, hành vi giữ nguyên); từ chối token mẫu `SYNC_TOKEN` (SEC-006); hàm `log_` có mức độ ghi Cloud Logging, 5 lỗi hết bị nuốt im lặng (BUG-10); thay toàn bộ `alert()` bằng thông báo nổi | Code, 00_Config, 01, 14, 16, 07, 11, 12, 24, 27 |
| `f20ae5a` | ⚡ Hiệu năng | Kiểm tra ảnh đọc HD_GPS 1 lần thay vì mỗi ảnh (PERF-005) | 02_DocumentChecker |
| `564270e` | 🔒 Bảo mật | `SETUP_*_TOKEN` công khai không còn ghi đè token đã đặt (SEC-007) | 00_Config, Code |
| `07eda6b` | 🔒 Bảo mật | Chỉ nhận ảnh/PDF ≤ 20 MB ở 4 hàm tải lên (SEC-009) | 00_Config, 04_Reconciliation, 06_CreateUpdate |
| `ac6c3d4` | 📄 | Thư mục `docs/qa/` — 10 báo cáo này | docs/qa |

## 24/09/2026 — Đợt 1: sửa theo QA Audit (đã được chủ dự án duyệt)

| Commit | Thay đổi |
|---|---|
| `42ba949` | SEC-001 (ADMIN_TOKEN cho chia sẻ quyền); LOCK-001/002/003/005/007; CACHE-001 |
| `8cbf662` | PERF-001 — đồng bộ thanh toán hàng loạt |

## 08/09/2026

| Commit | Thay đổi |
|---|---|
| `a1f876e` | Tính năng chia sẻ dữ liệu (cấp/xem/thu hồi quyền 2 Sheet + 4 thư mục) |

## Thống kê (a1f876e → nay, không tính tài liệu)
Đợt 1–3: 27 file, +1.856 / −4.059 dòng (phần xóa chủ yếu là mã chết và mã trùng được gộp). Đợt 4: thêm 4 file (đăng nhập, tra cứu), ~+1.700 dòng. Không xóa chức năng nào đang dùng, không đổi tên cột/sheet dữ liệu, không đổi bố cục các trang cũ (thêm: màn đăng nhập, chip người dùng, mục menu "Tra cứu hợp đồng", 2 thẻ ở Thiết lập, 1 mục Hướng dẫn).
