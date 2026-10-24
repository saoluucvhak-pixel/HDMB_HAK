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
