# Rà soát HDMB_HAK — 24/10/2026

Nguồn: main, commit 97917a5e143b9351ec5200c229c4fe41036dd2e6. Rà soát tập trung nhập liệu, tra cứu và phản hồi bất đồng bộ; không phải chứng nhận toàn bộ hệ thống không có lỗi.

## Các lỗi đã sửa

1. Tra cứu: đang tìm mà đổi nhanh khoảng ngày thì yêu cầu mới bị bỏ qua; kết quả cũ vẫn hiện. Thêm số phiên yêu cầu và cho phép bộ lọc mới thay thế kết quả đang đợi. Phản hồi cũ (cả thành công và lỗi) không được sửa giao diện.
2. Chi tiết hợp đồng: lỗi cũ vẫn ghi đè hợp đồng mới; quay lại danh sách hoặc tìm mới chưa vô hiệu hóa chi tiết đang tải. Bổ sung phiên chi tiết, kiểm tra trước cả ghi cache và render, vô hiệu hóa khi đổi ngữ cảnh.
3. Danh sách nhập liệu: chỉ vô hiệu hóa lượt tìm cũ khi hết debounce 300 ms. Nay vô hiệu hóa ngay khi gõ; phân trang trực tiếp cũng hủy timer tìm đang chờ.
4. Modal khách hàng: trước đây mỗi phím gõ quét toàn bộ mảng rồi chỉ hiển thị 30 dòng. Nay chờ 150 ms sau lần gõ cuối, dừng khi đủ 30 kết quả, hủy timer khi đóng modal. Trường hợp không khớp vẫn phải quét hết mảng; chưa thay bằng tìm kiếm máy chủ.
5. Bản xem trước hợp đồng chèn địa chỉ/số giấy tờ/loại hồ sơ vào innerHTML chưa escape. Đã escape nhãn và giá trị trước khi dựng HTML.

## Kiểm thử và giới hạn

- Trước và sau sửa: 170/170 ca máy chủ giả lập Apps Script đạt; 50 khối mã không lỗi cú pháp.
- Kiểm thử hồi quy mới `node tests/chong_phan_hoi_cu.cjs` đạt: đảo thứ tự phản hồi, lỗi đến trễ, quay lại, đổi bộ lọc, xóa tìm kiếm, debounce, timer phân trang và lọc 10.000 khách hàng. Trường hợp mọi tên đều khớp chỉ đọc 30 bản ghi thay vì 10.000 (đếm thao tác, không phải phép đo thời gian trình duyệt).
- Bộ UI Playwright với Chromium: 5/7 nhóm đạt (khóa nút, hộp thoại/bộ lọc, giao diện tối/hỗ trợ truy cập, nhúng Portal, nhập số/IME). Hai nhóm trang thật và giao diện đợt 2 đều timeout tại `#dsLo .lo` của bản đồ. Môi trường chưa có dependency leaflet để phục vụ thư viện ngoại tuyến; cần chạy lại sau khi cài đủ dependency để xác định nguyên nhân. Không coi toàn bộ UI là đạt.
- Chưa đo độ trễ p50/p95, INP hay độ mượt trên bản Google Apps Script đang triển khai; chưa kiểm tra Google Sheets/Drive thật, mạng di động hoặc bộ gõ trên điện thoại thật. Chưa triển khai production.

## Đo tải giả lập 1.000 hợp đồng

Lệnh: `SO_HD=1000 node tests/do_hieu_suat.cjs` (PowerShell: `$env:SO_HD='1000'`). Số liệu là số lần/ô đọc trong mock, không quy đổi sang giây trên Apps Script.

| Thao tác | Lần đọc | Ô đọc |
| --- | ---: | ---: |
| Tra cứu tên, dựng chỉ mục lần đầu | 4 | 21.000 |
| Tra cứu CCCD sau khi có cache | 0 | 0 |
| Chi tiết một hợp đồng | 10 | 10.164 |
| Danh sách khách hàng | 3 | 8.000 |
| Tổng quan | 4 | 62.000 |
| Tổng quan mở lại/đổi lọc | 1 | 31.000 |
| Tạo hợp đồng | 27 | 30.178 |
| Lưu chính thức nháp đã sửa | 21 | 12.301 |

Kịch bản chuyển sang Đang thực hiện bị từ chối do dữ liệu thử thiếu hồ sơ — đúng kiểm tra nghiệp vụ, không được bỏ chặn này để làm kiểm thử xanh.

## Công việc cần tiếp tục

- Tối ưu lượt đọc Sheet trong ghi chính thức/tổng quan dựa trên profiling; tránh gọi Spreadsheet service trong vòng lặp. Giữ phân quyền, khóa ghi, số 0 đầu và cập nhật cache sau ghi.
- Kiểm tra riêng thứ tự các lần tự lưu nháp: hiện mỗi lần tự lưu gọi LUU_DRAFT độc lập; cần thử callback về sai thứ tự trước khi thiết kế hàng đợi gộp thay đổi và cơ chế chờ trước lưu chính thức/chuyển hợp đồng.
- Tải danh sách khách hàng theo trang từ máy chủ nếu số khách hàng tăng lớn; debounce chỉ giảm số lần lọc, không giảm payload tải ban đầu.
- Đo p95 nhập liệu/tra cứu trên deployment thử với bộ dữ liệu đại diện, điều kiện mạng chậm và cache nóng/lạnh. Chỉ kết luận mức tăng tốc sau phép đo trước/sau cùng điều kiện.

## Prompt dùng tiếp

Rà soát và hoàn thiện webapp Google Apps Script tại https://github.com/saoluucvhak-pixel/HDMB_HAK. Đọc BAO_CAO_RA_SOAT_20261024.md và kiểm tra diff hiện tại trước khi sửa. Giữ nguyên nghiệp vụ, phân quyền, dữ liệu Sheet, CCCD/SĐT/số tài khoản có số 0 đầu. Ưu tiên: (1) hoàn tất kiểm thử UI với đủ Playwright và leaflet; (2) mô phỏng mạng chậm, gõ tiếng Việt/IME, phản hồi sai thứ tự và quay lại danh sách; (3) xác minh thứ tự tự lưu nháp, gộp các bản nháp đang chờ theo từng ID mà không làm mất lần nhập cuối, chờ lưu xong trước thao tác chính thức; (4) giảm lượt đọc Sheet của Tổng quan và lưu chính thức bằng đọc theo lô/chỉ mục, vô hiệu hóa cache đúng khi ghi; (5) đo trước/sau trên 1.000 và 10.000 hợp đồng, báo số RPC, lượt/ô đọc Sheet và p50/p95 trên deployment thử nếu có quyền truy cập. Bổ sung kiểm thử hồi quy có ý nghĩa, báo rõ ca đạt/trượt/chưa chạy. Tạo PR để xem xét, không tự merge hay triển khai production. Không tuyên bố hết giật lag khi chưa đo trên trình duyệt và Apps Script thật.

---

# Đợt 2 — tiếp tục theo "Prompt dùng tiếp" (24/10/2026)

Nhánh `claude/test-code-bug-project-nywz0r`. Gồm: `main` `97917a5` + nhánh `codex/nhap-lieu-tra-cuu-20261024` (5 sửa ở trên) +
bộ kiểm thử / tài liệu của nhánh `feature/hdmb-performance-optimization` (PR #2; phần mã của nhánh đó đã có trong `main`).
Không merge, không triển khai production.

## 1. Kiểm thử UI đủ Playwright + leaflet

Hai nhóm "trang thật" và "giao diện đợt 2" timeout ở `#dsLo .lo` vì môi trường thiếu `tests/node_modules/leaflet`
(test tự phục vụ leaflet ngoại tuyến). Cài đủ (`cd tests && npm install`) thì **cả 2 nhóm đạt** — không phải lỗi mã.

## 2. Lỗi mới tìm thấy và đã sửa (mỗi lỗi có test tái hiện: mã cũ trượt, mã mới đạt)

| ID | Lỗi | Hậu quả | Sửa | Test |
|---|---|---|---|---|
| R-1 | Tra cứu: bản sửa đợt 1 vẫn **khóa nút Tra cứu** khi đang tìm. Trình duyệt không gửi form khi nút submit bị khóa | Mạng chậm: gõ từ khóa mới + Enter **không có tác dụng** tới khi lượt cũ về (test vm đợt 1 gọi thẳng `traCuu_()` nên không thấy) | Không khóa nút; lượt mới thay lượt đang chờ | `ui_mang_cham` TC1, TC2 |
| R-2 | Tra cứu (điện thoại): đang tải chi tiết không có nút Quay lại | Mạng chậm là kẹt ở màn chi tiết | Nút Quay lại hiện ngay khi bắt đầu tải | TC4 |
| R-3 | Nhập liệu: mở HĐ A (chậm) → quay lại → mở B; A về sau | Form + nháp đang sửa **thành A** trong khi người dùng bấm B → gõ tiếp là sửa nhầm A | Số lượt mở HĐ (`luotMoHD_`) cho xem / tạo mới / quay lại | NL1, NL2 |
| R-4 | Ô tìm HĐ ở Nhập liệu dùng `onkeyup` | Dán bằng chuột / gợi ý bàn phím điện thoại không tìm | `oninput` | NL3 |
| R-5 | Tự lưu nháp: mỗi thay đổi 1 lượt `LUU_DRAFT`, **chạy song song** trên máy chủ | Lượt cũ xong sau ghi đè bản mới → mất lần nhập cuối | Hàng đợi theo bản nháp: 1 lượt chạy, thay đổi trong lúc chờ được gộp (giữ bản mới nhất); máy chủ bỏ bản cũ hơn của cùng tab (`_luuNhap {tab, seq}`) | `ui_tu_luu_nhap` N1, `test_luu_nhap` L1 |
| R-6 | Bấm **Lưu chính thức** trong 700 ms sau lần gõ cuối | Máy chủ lưu từ nháp cũ → **mất lần gõ cuối**, báo ✅ | Gửi lần gõ cuối, chờ lưu nháp xong rồi mới gọi `LUU_CHINH_THUC`; lưu nháp lỗi → không lưu chính thức, báo lỗi | N2, N3, N6 (bộ gõ) |
| R-7 | Gõ rồi quay lại danh sách + mở HĐ khác trong 700 ms | Lần gõ cuối của HĐ trước **bị bỏ** | Gửi ngay thay đổi đang chờ khi rời form / mở HĐ / tạo mới / ẩn tab | N4 |
| R-8 | Đang lưu chính thức vẫn gửi `LUU_DRAFT` song song | Ghi nháp chen giữa lúc máy chủ đọc / ghi tiến độ | Giữ thay đổi lại; lỗi thì gửi tiếp; thành công thì báo rõ phần gõ thêm chưa được ghi | N7 |

Kết quả trên mã cũ: `ui_mang_cham` — `main` trượt 9/14, nhánh codex trượt 8/14; `ui_tu_luu_nhap` — trượt 10/14;
`test_luu_nhap` — trượt L1. Mã mới: đạt hết.

## 3. Giảm lượt đọc Sheet

| Thao tác (bộ giả lập) | 1.000 HĐ trước | 1.000 HĐ sau | 10.000 HĐ trước | 10.000 HĐ sau |
|---|---|---|---|---|
| Tổng quan — mở lần đầu | 4 lượt / 62.000 ô | **1 / 31.000** | (xem mục 3a) | (xem mục 3a) |
| Tổng quan — mở lại / đổi lọc | 1 / 31.000 | 1 / 31.000 | | |
| Lưu chính thức (nháp đã sửa) | 21 / 12.301 | 21 / 12.301 (giữ nguyên, xem dưới) | | |
| Mọi thao tác khác | — | không đổi | | |

- Tổng quan không hiển thị cờ ảnh / GPS nhưng trước đây đọc thêm HD_RUNG + HD_GPS + HD_Picture để tính chúng. Nay đọc
  Draft như cũ, không ghi đè cờ. Kết quả trả về **giống hệt** (test TQ-1 + `so_sanh_dau_ra` 110/110). Không thêm cache mới
  → không có rủi ro vô hiệu hóa sai.
- **Lưu chính thức không gộp lượt đọc**: các lượt đọc lặp (cột ID_HD, dòng HD_NCC) là bước xác minh lại DƯỚI KHÓA của từng hàm
  ghi (C-02: dòng dịch do người khác xóa → ghi nhầm hợp đồng). Gộp lại = đổi an toàn lấy tốc độ, ngược thứ tự ưu tiên.
- Số lượt gọi máy chủ (RPC) của tự lưu nháp: 3 thay đổi dồn dập khi lượt đầu chưa về — trước 3 lượt chạy song song, sau
  2 lượt nối tiếp; lưu lại nội dung không đổi — trước 1, sau 0; Lưu chính thức khi còn lần gõ chưa lưu — trước 1 (mất lần gõ),
  sau 2 (`LUU_DRAFT` rồi `LUU_CHINH_THUC`).

## 4. Kết quả kiểm thử

`node tests/chay_tat_ca.cjs` (Chromium, có leaflet): **369 đạt / 0 trượt**, gồm 4 nhóm mới: `test_luu_nhap.cjs` (6),
`ui_tu_luu_nhap.cjs` (14), `ui_mang_cham.cjs` (14), TQ-1 trong `test_may_chu.cjs` (2). Đã đưa vào CI.

**Chưa chạy / không chứng minh được bằng bộ giả lập:** thời gian thật (p50 / p95, INP) trên deployment thử; Google Sheets /
Drive thật; khóa `LockService` dưới tải thật; mạng di động thật; bộ gõ trên điện thoại thật (đã thử bằng sự kiện soạn
chữ của Chromium, không phải Gboard / Laban Key). Không kết luận "hết giật lag".

## 5. Còn lại

- Đo p50 / p95 trên deployment thử: dùng sẵn `LAY_THONG_KE_HIEU_NANG` (sổ `NhatKy_HieuNang`) sau 1–3 ngày chạy thật.
- Danh sách khách hàng ở modal Nhập liệu vẫn tải toàn bộ 1 lần (đợt 1 đã chặn số lần lọc, chưa giảm dữ liệu tải ban đầu).
- Bấm "Tạo hợp đồng mới" rồi quay lại trước khi tạo xong vẫn để lại 1 bản nháp trống trên máy chủ (như trước) — chưa dọn tự
  động. (Mở HĐ có sẵn thì máy chủ dùng lại đúng 1 bản nháp của HĐ đó, không sinh thêm.)
- 2 tab / 2 người cùng sửa nháp của 1 HĐ: như trước, bản đến sau thắng (số thứ tự chỉ chặn bản cũ của CÙNG tab).

## 6. Đưa lên Apps Script (khi đã duyệt PR) và quay lại

- 7 file so với `main` `97917a5`: `.gs` — `00_Config`, `01_ContractManager`, `15_DraftHopDong`; `.html` — `07_Form_HopDong`,
  `11_Page_NhapLieu`, `33_Page_TraCuuHopDong`, `NhapLieu_Chung_JS`. Không file mới, không file cần xóa, không đổi sheet / cột.
- Chép đủ cả 7 (`NhapLieu_Chung_JS` dùng chung cho 07 và 11). Deploy → New version.
- Kiểm tra nhanh: Nhập liệu gõ tên rồi bấm ngay "Lưu chính thức" → mở lại HĐ thấy đúng tên vừa gõ; Tra cứu gõ 2 từ khóa liên
  tiếp + Enter → hiện kết quả từ khóa sau; Tổng quan mở bình thường.
- Quay lại: Manage deployments → chọn lại Version cũ (trình duyệt cũ / mới đều tương thích: máy chủ mới nhận nháp không có
  số thứ tự; máy chủ cũ bỏ qua trường `_luuNhap`).

---

# Đợt 3 — bảo toàn dữ liệu nháp + đo / giảm tải 1.000 / 10.000 HĐ (24/10/2026)

Nhánh `claude/test-code-bug-project-nywz0r`, từ `main` `d7c76f6` (đã gồm PR #4 và đợt 2). Không merge, không triển khai.

## 1. Bảo toàn dữ liệu nháp

| ID | Lỗi / chỗ hở trên `main` | Sửa |
|---|---|---|
| D-1 | Hết phiên đăng nhập khi đang tự lưu: `hakRun_` hiện hộp đăng nhập nhưng **không gọi hàm lỗi** → hàng đợi kẹt "đang gửi" mãi, "Lưu chính thức" chờ mãi | Chờ tối đa 60 s; không có phản hồi coi là lỗi, hàng đợi chạy tiếp; phản hồi muộn bị bỏ |
| D-2 | Lưu nháp lỗi (mạng / `thanhCong:false`) chỉ ghi console, không thử lại, người dùng không biết | Tự thử lại 3 lần (2 s, 5 s, 15 s) cùng nội dung; dòng trạng thái "Đang lưu / Đã lưu lúc … / Chưa lưu được (đang thử lại)"; "Không tìm thấy bản nháp" / lỗi quyền: không thử lại, báo ❌ |
| D-3 | Nhiều tab: máy chủ chỉ so số thứ tự với tab lưu gần nhất → bản cũ của tab A về muộn sau khi tab B lưu vẫn ghi đè | Nhớ số thứ tự lớn nhất của từng tab (20 tab gần nhất); tab khác vừa sửa trong 10 phút → nhắc người dùng |
| D-4 | `LUU_DRAFT_` nhận JSON hỏng → ghi nguyên lên bản nháp (bản nháp hỏng, Lưu chính thức lỗi mãi) | Không bao giờ ghi JSON hỏng; nháp cũ hỏng thì bản mới hợp lệ ghi đè được |
| D-5 | Lưu chính thức = `LUU_DRAFT` rồi `LUU_CHINH_THUC` (2 lời gọi) | 1 lời gọi `LUU_CHINH_THUC(idDraft, bản mới nhất)`: máy chủ ghi bản đó vào nháp trước (cùng quy tắc chống bản cũ), lỗi thì không lưu chính thức. Vẫn chờ lượt LUU_DRAFT đang chạy |
| D-6 | Timer tự lưu đọc form theo bản nháp HIỆN TẠI lúc chạy | Gắn với bản nháp lúc gõ; đã sang bản nháp khác thì bỏ |
| D-7 | Lưu chính thức xong / hủy: ẩn form làm ô đang nhập phát `change` → gửi thêm LUU_DRAFT vào bản nháp đã xóa | Đóng phiên nháp khi kết thúc |

Callback mở / tạo nháp cũ không ghi đè form (đợt 2, R-3) nay có thêm test cho "Tạo mới (chậm) rồi mở HĐ khác" (N13).

## 2. Tìm khách hàng

- `main`: Nhập liệu nạp `layDanhSachKhachHang(1, 5000)` lúc mở trang (9 trường / khách) và dựng sẵn 2 datalist × mọi khách;
  **cắt ở 5.000 khách** → khách thứ 5.001 trở đi (theo tên) không được nhận diện. Trang 27 "Thêm HĐ cho khách đã chọn" với
  khách ngoài 5.000 mở form **thông tin trống**.
- Nay: danh sách GỌN của MỌI khách (`[cccd, tên, số HĐ, địa chỉ]`), gợi ý ≤ 20 dòng theo chữ đang gõ, chi tiết tự điền lấy
  theo CCCD khi chọn (chi tiết về muộn sau khi đã sang HĐ khác thì bỏ; trang 27 bấm A rồi B chỉ dùng B).
- SĐT lỡ bị Sheets đổi thành số (9 chữ số) trả lại dạng chữ có số 0 đầu khi tự điền. CCCD giữ nguyên như cũ (khóa nhóm).

## 3. Tổng quan

Nhớ 5 phút theo dấu vân tay Draft (số dòng + mốc `CAP_NHAT_LUC` lớn nhất + tổng mốc, đọc 1 cột). Mọi lần ghi Draft của hệ
thống đặt lại `CAP_NHAT_LUC` → sửa / thêm / xóa / xây dựng lại Draft thấy ngay (test TQ-3..5). **Giới hạn:** sửa TAY sheet
Draft (không qua hệ thống) thấy sau tối đa 5 phút; 2 lần ghi cùng 1 dòng trong cùng 1 mili-giây không phân biệt được (trên Apps
Script thật mỗi lần ghi mất hàng chục mili-giây).

## 4. Số đo (bộ giả lập; không phải thời gian thật)

`SO_HD=1000 node tests/do_hieu_suat.cjs` và `SO_HD=10000 NHAN_BAN=10 node tests/do_hieu_suat.cjs` (10.000 HĐ: 1.000 qua hàm thật
× 10 nhân bản dòng — dựng qua hàm thật mất hàng giờ trên bộ giả lập). "Trước" = `main` `d7c76f6`.

| Thao tác | 1.000 trước | 1.000 sau | 10.000 trước | 10.000 sau |
|---|---|---|---|---|
| Mở Nhập liệu: nạp khách hàng — dữ liệu tải về | 144,5 KB (1.000 khách) | **38,0 KB** | 730,9 KB (**chỉ 5.000 khách**) | **397,4 KB (đủ 10.000)** |
| Chọn 1 khách để tự điền | 0 RPC (đã nạp sẵn) | 1 RPC, 0 lượt đọc Sheet, 0,1 KB | 0 RPC | 1 RPC, 0 lượt đọc |
| Tổng quan — lần đầu (bản nhớ trống) | 1 lượt / 31.000 ô | 2 / 32.000 | 1 / 310.000 | 2 / 320.000 |
| Tổng quan — mở lại / đổi lọc | 1 / 31.000 | **1 / 1.000** | 1 / 310.000 | **1 / 10.000** |
| Lưu chính thức gồm lần gõ cuối | **2 RPC**, 23 lượt / 12.303 ô, 9 lượt ghi | **1 RPC**, 21 / 12.299, 7 ghi | 2 RPC, 23 / 120.303, 9 ghi | 1 RPC, 21 / 120.299, 7 ghi |
| Tự lưu 1 lần | 2 lượt / 2 ô, 3 lượt ghi | 2 / 4, **1 lượt ghi** | như 1.000 | như 1.000 |
| Thao tác khác | — | không đổi | — | không đổi |

Số lời gọi của trình duyệt (`node tests/do_rpc.cjs`, trang thật):

| Tình huống | `main` | Sau |
|---|---|---|
| Mở trang Nhập liệu | 4 | 4 (khách hàng: danh sách gọn thay bản đầy đủ) |
| Mở Tổng quan | 1 | 1 |
| Mở HĐ, sửa 3 ô cách nhau 1 s, Lưu chính thức ngay | 4 | 4 |
| Mạng chậm 1,5 s: sửa 3 ô liên tục (cách 0,8 s), Lưu chính thức ngay | 5 | **3** |

## 5. Kiểm thử

`node tests/chay_tat_ca.cjs`: **417 đạt / 0 trượt**. Mới / viết lại trong đợt này:
`ui_tu_luu_nhap.cjs` 29 mục (N1–N14: mạng chậm, phản hồi đảo thứ tự, lưu ngay sau nhập, nhiều tab, thử lại sau lỗi,
`thanhCong:false`, mất phản hồi, timer theo phiên, hủy, callback tạo nháp cũ); `test_luu_nhap.cjs` 15 mục; `test_khach_hang.cjs`
9; `ui_khach_hang.cjs` 10; TQ-2..5 trong `test_may_chu.cjs`. Tất cả đã vào CI cùng nhập số / bộ gõ (`ui_dinh_dang_so.cjs`).
Trên mã `main`: `ui_tu_luu_nhap` trượt 18/29 (một phần do đổi thiết kế Lưu chính thức 1 RPC, không phải mục nào cũng là lỗi),
`test_luu_nhap` trượt 5/15, `test_khach_hang` K1 trượt (thiếu khách sau 5.000).

Hai nhóm UI bản đồ: đạt khi có `tests/node_modules/leaflet` (`cd tests && npm install`; CI tự cài). Thiếu thì nay báo rõ và dừng
ngay thay vì chờ 30 s rồi timeout.

**Chưa chạy:** thời gian thật p50 / p95 trên Apps Script; Google Sheets / Drive thật; CacheService thật với ~400 KB khách hàng
và bản nhớ Tổng quan 10.000 HĐ (nếu vượt giới hạn cache thì tự đọc thẳng như cũ — chậm hơn nhưng đúng); bộ gõ trên điện thoại thật.

## 6. Còn lại

- Bản đồ GPS 10.000 HĐ trả về **~4 MB** — lớn nhất hệ thống, chưa xử lý (ngoài phạm vi đợt này).
- Lưu chính thức 10.000 HĐ vẫn đọc ~120.000 ô (chủ yếu cột khóa HD_GPS / HD_RUNG khi cập nhật Draft); các lượt đọc lặp là kiểm tra
  lại dưới khóa, chưa gộp.
- 2 người cùng sửa 1 bản nháp: vẫn là bản lưu sau ghi đè bản trước (nay có nhắc).

## 7. Đưa lên Apps Script và quay lại

8 file so với `main` `d7c76f6`: `.gs` — `00_Config`, `01_ContractManager`, `06_CreateUpdate`, `15_DraftHopDong`, `34_PhanQuyen`;
`.html` — `11_Page_NhapLieu`, `27_Page_HopDongMeCon`, `NhapLieu_Chung_JS`. Chép đủ 8 (34 có 2 chức năng mới mà 11 / 27 gọi).
Không file mới, không đổi sheet. Quay lại: chọn Version cũ — máy chủ mới vẫn nhận lời gọi của trình duyệt cũ (Lưu chính thức
không kèm bản nháp, nạp `layDanhSachKhachHang`); trình duyệt mới cần máy chủ mới (gọi `LAY_DS_KHACH_HANG_GON`).
