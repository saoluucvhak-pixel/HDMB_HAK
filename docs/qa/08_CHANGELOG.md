# 08 — Nhật ký thay đổi (Changelog)

Nhánh: `claude/test-code-bug-project-nywz0r`. Mỗi dòng là 1 commit đã đẩy lên GitHub; chi tiết nằm trong nội dung commit.

## 29/09/2026 — Kiểm thử lại `main` (sau đợt 6 + nâng cấp A1–A5)

| Commit | Loại | Thay đổi | File |
|---|---|---|---|
| `a895b2b` | 🐛✅ | **Lưu chính thức hợp đồng MỚI lỗi giữa chừng rồi lưu lại bị kẹt**: bản nháp ghi lại mã HĐ nhưng không ghi Số HĐ tự sinh → lần lưu lại đi đường sửa hợp đồng với Số HĐ trống, bị chặn "Số HĐ không được để trống" (trước kiểm tra đó còn ghi đè Số HĐ thành trống). Nay ghi cả Số HĐ vào tiến độ và giữ khi trình duyệt lưu nháp đè. Thêm 22 kiểm tra vào `tests/test_may_chu.cjs` cho đợt 5: SL dự kiến Z/T/AA từ lô rừng (SL-01…06, bảo trì SL-04), Chi tiết hợp đồng (CT-01), chống tạo trùng (DUP-01/02), ngày ký 00:00 (BUG-12), link ảnh QR (QR-01…03). Mã cũ trượt DUP-02, mã mới 79/79 + giao diện 26/26 đạt | 15_DraftHopDong, tests/test_may_chu.cjs |
| `4548b11` | 🐛 | (thay bằng dòng dưới) Nhúng trong Portal — bản đầu cần dán mã vào Portal | GiaoDien_Chung, 13_HuongDan, tests/ |
| `da3f4c3` | 🐛 | **Nhúng HDMB trong trang khác (Portal): bấm menu bật cả cửa sổ ra khỏi Portal** — chỉ HDMB bị vì mỗi mục menu là 1 trang riêng mở bằng `<base target="_top">` (thay cả cửa sổ); khung Apps Script bị sandbox nên không tự tải lại được trang Google chứa nó. Nay HDMB tự nhận biết đang bị nhúng (khung Google khác nguồn đầu tiên ≠ cửa sổ trên cùng): bấm link về chính HDMB → xin máy chủ HTML trang mới (`trangTrongKhung`, dùng chung `_dungTrangWebapp_` với `doGet`) rồi hiện trong 1 khung con thay trang cũ (không lồng thêm tầng), trang con dùng `google.script` của trang gốc, địa chỉ `?page=` cập nhật qua `google.script.history` (Quay lại dùng được). **Không cần sửa Portal**; bỏ đoạn mã Portal của `4548b11`. Mở trực tiếp / link tab mới / link sang webapp khác → như cũ. Test: `ui_nhung_portal.cjs` 14/14 (mã gốc: cả cửa sổ rời Portal), `NHUNG-01` máy chủ | Code.gs, GiaoDien_Chung, 13_HuongDan, tests/ |
| `f96e13f` | 🐛 | **User khác chủ hệ thống mở HDMB trong Portal bị TRẮNG MÀN HÌNH**: chủ hệ thống được nhận ra ngay qua tài khoản Google (không cần đăng nhập); user khác phải đăng nhập qua Cổng — trong khung thì mở cửa sổ nhỏ, xong gọi `window.location.reload()`: khung HTML của webapp Apps Script do Google đổ nội dung vào, tải lại chỉ còn trang rỗng. Nay `hakTaiLaiTrang_` xin máy chủ HTML của chính trang đang mở (`trangTrongKhung`) rồi hiện lại trong khung. Không đổi chế độ triển khai. Test `ui_nhung_portal.cjs` thêm kịch bản user thường đăng nhập (giả lập đúng hành vi tải lại khung = trang rỗng): mã cũ trượt 2, mã mới 19/19 | PhanQuyen_JS, tests/ |

## 28/09/2026 — Đợt 6: rà soát tổng thể trước phát hành (chỉ báo cáo, chưa sửa mã)

| Commit | Loại | Thay đổi | File |
|---|---|---|---|
| `ce0acfe` | 📄 | Báo cáo `11_AUDIT_TONG_THE_28092026.md`: 3 Critical, 13 High, 18 Medium, 12 Low mới | docs/qa |
| `03dc678` | 🐛🔒 | Sửa C-01, C-02, C-03, H-01, H-03, H-04, H-05, M-01, M-06 — 22/22 test giả lập đạt (mã gốc trượt 14/16) | 00, 01, 06, 14, 15, 34, 12, 27, NhapLieu_Chung_JS |
| `9e92e9d` | 🐛⚡ | Đợt 6c: H-02, H-07, H-11, H-12, H-13, M-02, M-04, M-05, M-07, M-08, M-09, M-11, M-12, M-14, M-16, M-17, L-02/03/04/06 — 29/29 test đạt | 00, 01, 02, 03, 04, 05, 06, 14, 15, 16, 18, 23, 31, 35, 07, 10, 11, 27, NhapLieu_Chung_JS |
| `462b8e1` | 🧹 | Đợt 6d: M-10, M-15, M-18, L-01, L-05, L-09, L-10, L-12 — 33/33 test đạt | 00, 01, 04, 05, 06, 14, 29, 32, 35 + 13 file HTML (`include_`) |
| `04752c0` | ⚡ | Nâng cấp đợt 1: H-12 (P-02, P-05, P-06, P-07a, P-09, P-10) + A1 chống bấm lặp — 37/37 test máy chủ, 7/7 test trình duyệt | 00, 01, 06, 15, 16, 18, 35, PhanQuyen_JS |
| `bb92f22` | ✨⚡ | Nâng cấp đợt 2: A2, A3, A4, P-07b (+ hoàn tất H-13), P-08, P-11 — 45/45 test máy chủ, 15/15 test trình duyệt | 01, 06, 18, 23, 29, 31, 34, PhanQuyen_JS, 10, 12, 24, 27, 30, NhapLieu_Chung_JS |
| `14c52fc` | ✨🧪 | Nâng cấp đợt 3: B2 nhật ký chi tiết cũ → mới + lưu trữ khi xóa & khôi phục (Thiết lập); B3 thư mục `tests/` + GitHub Actions — 57/57 test máy chủ, 15/15 test giao diện | 00, 06, 14, 34, 24, PhanQuyen_JS, tests/, .github/ |
| `8517e17` | ✨♿ | A5: chế độ tối (Tự động / Sáng / Tối, nút 🌓) + gom 305 màu về biến CSS (chế độ sáng giống hệt từng điểm ảnh) + tự gắn nhãn vào ô và đặt tên nút biểu tượng — 57/57 test máy chủ, 26/26 test giao diện | GiaoDien_Chung (mới), PhanQuyen_JS, 14 file HTML, tests/ |
| `4a8d917` | 🎨 | Giao diện mới đợt 1: menu trái dùng chung (`Menu_Chung.html`), lớp giao diện chung, Bản đồ GPS làm lại (vẽ mọi lô trên ảnh vệ tinh, thẻ chi tiết, chỉ đường), mục lục Thiết lập/Hướng dẫn — 57/57 test máy chủ, 42/42 test giao diện | Menu_Chung (mới), GiaoDien_Chung, MapContainer, 05_Menu, Code, 10, 11, 12, 13, 24, 27, 30, 33, 35, tests/ |
| (commit tiếp) | 🎨 | Giao diện mới đợt 2: Tổng quan 4 chỉ số + nút lọc + tiến độ, Tra cứu 2 cột, Nhập liệu thanh tiến độ 5 bước + bảng so khớp OCR, bản đồ điện thoại dạng thẻ trượt — 84/84 test máy chủ, toàn bộ test giao diện đạt | 01, 34, GiaoDien_Chung, MapContainer, 07, 27, 30, 33, tests/ |
| (commit tiếp) | 🎨 | Giao diện mới đợt 3: Báo cáo chỉ số có thanh tiến độ + lọc gọn, Tra cứu hình ảnh lọc theo loại ảnh, Thiết lập mục lục chia nhóm, Hướng dẫn thẻ bước — 85/85 test máy chủ, toàn bộ test giao diện đạt | 01, GiaoDien_Chung, 10, 13, 24, 35, tests/ |
| (commit tiếp) | 🧹 | Bảo trì: tìm & xóa dòng HD_NCC / HD_RUNG nghi trùng + xóa dòng mồ côi (chọn từng dòng, dấu vân tay chống xóa nhầm, lưu trữ khôi phục được) — 97/97 test máy chủ, toàn bộ test giao diện đạt | 28, 34, 24, tests/ |
| (commit tiếp) | ✨🐛 | Tra cứu: nút Sửa hợp đồng (Nhập liệu/Quản trị) mở đúng HĐ ở trang Nhập liệu; Nhập liệu đọc `?idHD=` qua getLocation (trước đây mở ra danh sách trong khung sandbox/Portal) | 33, 27, tests/ |

## 28/09/2026 — Đợt 5 (nhánh `main`): số liệu hợp đồng cho app Thanh toán, ngày tháng theo vùng, chống tạo trùng

| Commit | Loại | Thay đổi | File |
|---|---|---|---|
| `aa14fb3` | 🐛 | **Sửa / lưu hồ sơ rừng thì Chi tiết hợp đồng cập nhật lại**: trang Thêm/Sửa hợp đồng — tab "📊 Chi tiết hợp đồng" trước đây tự cộng lô rừng trên trình duyệt với **đơn giá bình quân tính khác** ct_hopdong/HD_NCC (bình quân theo khối lượng), không hiện số đang ghi trên hợp đồng; tab "🌲 Lô rừng" lưu/xóa lô chỉ tải lại bảng lô. Nay cả 2 lấy từ máy chủ `layChiTietHopDong_` (cùng `tinhTongHopLoRung_` với ct_hopdong) kèm SL dự kiến / Diện tích / Đơn giá trên HD_NCC (số app Thanh toán đọc, ghi rõ khi "Đang thực hiện" đã chốt); tab Lô rừng có ô Chi tiết hợp đồng tự tải lại sau mỗi lần thêm / sửa / xóa lô / đính kèm hồ sơ; xóa lô báo lỗi nếu máy chủ từ chối | 14_CtHopDong_PhuLuc, 34_PhanQuyen, 27_Page_HopDongMeCon, 13_HuongDan |
| `bb2bbb6` | 🐛 Dữ liệu | **Hợp đồng tạo trên app không có KHỐI LƯỢNG DỰ KIẾN bên app Thanh toán (ĐNTT)**: màn hình nhập không gửi SL dự kiến / diện tích / đơn giá cấp hợp đồng nên HD_NCC cột **Z** (có thể cả **T**, **AA**) = 0; số thật chỉ nằm ở từng lô rừng. Nay `dongBoTongHopRungVaoHdNcc_` tính 1 lần (`tinhTongHopLoRung_`, đúng phép tính cũ của ct_hopdong) rồi ghi **ct_hopdong và HD_NCC Z/T/AA** (ghi SỐ, định dạng số chuẩn, nhật ký cũ → mới) ở mọi chỗ đổi lô rừng: thêm / sửa / xóa lô, lưu từ bản nháp, `LUU_HOP_DONG_DAY_DU_`, sửa tay HD_RUNG (bẫy onEdit). "Đang thực hiện" đã chốt: chỉ điền ô trống/0; hợp đồng không có lô rừng giữ nguyên; không xóa số đã có bằng 0. **Bảo trì 📦 Điền SL dự kiến / Diện tích / Đơn giá từ lô rừng** (Quản trị, xem trước → xác nhận → ghi; chạy lại không ghi thêm) cho dữ liệu cũ. Tạo hợp đồng xong **nhắc ✅ Duyệt** sang "Đang thực hiện" để dùng được bên Thanh toán. Không đổi vị trí cột / tên sheet / tiêu đề HD_RUNG mà ĐNTT đọc | 14_CtHopDong_PhuLuc, 06_CreateUpdate, 15_DraftHopDong, 01_ContractManager, 28_BaoTri_DongBo, 34_PhanQuyen, 05_Menu, 24_Page_ThietLap, 27_Page_HopDongMeCon, NhapLieu_Chung_JS, 13_HuongDan |
| `ace4bfa` | 🐛 | **Chống tạo trùng hợp đồng** (vd 20260916001/002 cùng chủ rừng, cùng ngày): mã thao tác cho mỗi lần nhập (máy chủ trả lại hợp đồng đã tạo), giữ khóa nút Lưu sau khi tạo; lưu chính thức từ bản nháp ghi tiến độ từng bước để lưu lại không tạo trùng / không xóa nhầm dòng | 06, 15, 27, NhapLieu_Chung_JS |
| `bb88df3` | ✨ | Ô nhập số (diện tích, đơn giá, khối lượng, định mức) có phân cách hàng nghìn + thập phân kiểu Việt Nam ngay khi gõ, giữ phần lẻ | DinhDangSo_JS (mới), NhapLieu_Chung_JS, 07, 11, 27 |
| `d7cba69` | ✨🔒 | Mã QR báo cáo PDF có **link tải ảnh hiện trường công khai** (chữ ký HMAC, chỉ ảnh hiện trường + ảnh GPS, không hồ sơ pháp lý / CCCD; thu hồi bằng cách xóa `ANH_CONG_KHAI_SECRET`) | 35_TraCuuHinhAnh, 36_BaoCaoHopDong, Code, 38_Page_AnhCongKhai (mới) |
| `daf3bf9` | 🐛 | Lô rừng mới lấy đúng ngày ký + CCCD / tên chủ rừng của hợp đồng (trước: ngày hôm nay, Mã rừng "HAK_2") | 06 |
| `381c037` | 🐛 | **BUG-12**: ngày ký lưu 00:00 (không phải 07:00); lọc Từ/Đến ngày không loại nhầm hợp đồng ký đúng ngày "Từ ngày"; PDF theo vùng xuất | 00_Config, 02, 06, 10, 18, 21, 22, 35, 36 |
| `480cc09` | ✨ | Thẻ **📊 Vùng Định Dạng Báo Cáo Xuất Excel** (độc lập Vùng Lãnh Thổ): webapp luôn kiểu VN, ghi Sheet theo Vùng Lãnh Thổ, file xuất theo vùng xuất | 21, 22, 24, 34, 10 |
| `078c350` | ⚡ | Chuyển tên file ảnh / hồ sơ sang URL: đọc-ghi theo khối 300 dòng (PERF-004) | 20_ChuyenDoiAnhURL |
| `746bbb1` | 🔒 | Vá 5 hàm tra cứu ảnh / hồ sơ thiếu kiểm tra quyền | 35_TraCuuHinhAnh |

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
