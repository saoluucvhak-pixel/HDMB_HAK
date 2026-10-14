# Kiểm thử toàn vẹn dữ liệu — nâng cấp 10/2026

Mọi kết quả dưới đây chạy trên **bộ giả lập Apps Script** (`tests/gasmock.cjs`: Sheets trong bộ nhớ, ép chuỗi số thành số như
Sheets thật, ô định dạng `@` giữ chữ, Cache/Properties/Lock giả). **Chưa chạy trên Apps Script thật** — xem mục 5.

Cách chứng minh một bài test "có răng": chạy trên **mã cũ** (`main` `8d4bd25`) phải TRƯỢT, trên mã mới phải ĐẠT.

**Tổng:** `test_p0_dong_bo.cjs` mã cũ **8 đạt / 17 trượt** (+1 lỗi dừng giữa chừng), mã mới **27/27**; `test_p1_hieu_suat.cjs` mã cũ **11 đạt / 13 trượt** (+2 lỗi), mã mới **25/25** (các mục cũ đạt là mục về tính đúng — vd thấy khách mới ngay — mã cũ vốn đúng nhưng chậm).

```bash
mkdir -p /tmp/cu && git archive 8d4bd25 '*.gs' '*.html' | tar -x -C /tmp/cu
TZ=Asia/Ho_Chi_Minh node tests/test_p0_dong_bo.cjs /tmp/cu     # mã cũ
TZ=Asia/Ho_Chi_Minh node tests/test_p0_dong_bo.cjs             # mã mới
TZ=Asia/Ho_Chi_Minh node tests/so_sanh_dau_ra.cjs /tmp/cu      # so đầu ra cũ / mới trên cùng dữ liệu
```

## 1. Lỗi P0 tìm thấy và đã sửa (đều tái hiện được bằng test trước khi sửa)

| ID | Lỗi trên `main` | Hậu quả | Test | Mã cũ | Mã mới |
|---|---|---|---|---|---|
| P0-A | Đọc DNTT lỗi (đổi tiêu đề cột, file tạm không phản hồi) → kết quả lỗi được **lưu đè cache thanh toán tốt**, Draft của mọi HĐ tính lại, mốc vẫn ghi | Khối lượng thực hiện của **mọi hợp đồng về 0**, không tự sửa cho tới khi DNTT được sửa lần nữa | P0-A1..A7 | 3 trượt + 1 lỗi | 7/7 |
| P0-B | "Đồng bộ thanh toán NGAY" ghi mốc **trước** khi xử lý; lỗi vẫn báo ✅ | Trigger 30 phút không làm lại, người dùng tưởng đã xong | P0-B1, B2 | trượt cả 2 | đạt |
| P0-C | "Làm mới Draft" luôn ghi mốc kể cả khi cập nhật lỗi; bỏ sót dòng nhật ký cùng mili giây với mốc; 2 lượt chạy chồng nhau; luôn báo "Đã cập nhật" | Thay đổi bị **bỏ sót vĩnh viễn** trên báo cáo | P0-C1..C11 | 7/11 trượt | 11/11 |
| P0-D | Chống tạo trùng hợp đồng (`maThaoTac`) chỉ lưu CacheService | Cache bị đẩy ra → gửi lại tạo **hợp đồng thứ 2** | P0-D1, D2 | D1 trượt | đạt |
| P0-E | Nhập liệu mở hợp đồng theo **số dòng** lúc tải danh sách | HĐ phía trên bị xóa → **mở nhầm hợp đồng khác** (dễ sửa nhầm Số TK) | P0-E1..E3 | E1 trượt (mở M2 thay M1) | đạt |
| P0-F | 2 cột CCCD của `Draft_BaoCaoHopDong` để định dạng mặc định | Báo cáo tổng hợp + file Excel hiện CCCD **thiếu số 0 đầu** | P0-F1, F2 | trượt cả 2 | đạt |
| (phát hiện thêm) | Cập nhật Draft hàng loạt ghi đè **cả vùng** bằng bản đọc từ đầu lượt | Dòng HĐ khác vừa được người dùng cập nhật trong lúc đó bị ghi đè bằng dữ liệu cũ | P0-C3, C4 + so_sanh_dau_ra | — | chỉ ghi dòng đổi, xác định lại theo ID_HD |

## 2. Tối ưu không đổi kết quả nghiệp vụ

`tests/so_sanh_dau_ra.cjs` dựng **cùng 1 bộ dữ liệu** (150 HĐ hạt giống cố định: tên trùng, CCCD trống / bị Sheets đổi
thành số / có khoảng trắng, lô rừng, GPS thập phân + DMS, ảnh lưu theo ID_HD hoặc lỡ theo ID_RUNG) trên mã cũ và mã mới rồi
so **110 trường hợp**: danh sách khách hàng (5 từ khóa × 4 trang), hợp đồng theo 61 khách hàng, Tra cứu (10 từ khóa × có/không
lọc ngày) + chi tiết, cờ ảnh/GPS, Tổng quan (2 bộ lọc), bản đồ GPS, Draft sau cập nhật hàng loạt, sau làm mới theo nhật ký,
`Draft_HoSoRung` sau làm mới, Draft sau xây dựng lại toàn bộ.

**Kết quả: 110/110 giống hệt.** Ngoại lệ có chủ đích: 2 cột CCCD của Draft so theo chuỗi 12 số (bản mới giữ số 0 đầu; bản
cũ để Sheets đổi thành số) — đã kiểm tra mọi cột khác trùng khớp.

Không đổi công thức: khối lượng / giá trị dự kiến – thực hiện – còn lại, trạng thái hồ sơ / GPS / ảnh, diện tích GPS, đơn vị
(khối lượng DNTT cột M, tấn). Không đổi tọa độ gốc, thứ tự đỉnh đa giác.

## 3. Đồng bộ thanh toán tăng dần

`tests/test_p1_hieu_suat.cjs` P1-TT1..7: lần đầu tính toàn bộ; sửa khối lượng dòng có sẵn → chỉ tính lại đúng 1 HĐ; file đổi
nhưng số liệu không đổi → 0 HĐ; xóa dòng DNTT → tính lại HĐ đó; ghi Draft lỗi giữa chừng → lượt sau vẫn tính lại; quá 24 giờ
→ toàn bộ; **Draft sau các lượt tăng dần giống hệt xây dựng lại toàn bộ**.

## 4. Tình huống đồng thời (mô phỏng)

Bộ giả lập chạy tuần tự — không có 2 luồng thật. Các tình huống được **mô phỏng bằng cách chèn trạng thái giữa 2 bước**:

| Tình huống | Cách mô phỏng | Test |
|---|---|---|
| 2 lượt làm mới Draft cùng lúc | Đặt sẵn cờ "đang chạy" (vừa bắt đầu / quá 20 phút) | P0-C6..C8 |
| Hợp đồng bị xóa khi đang chờ làm mới | Xóa dòng HD_NCC sau khi ghi nhật ký | P0-C9 |
| Dòng nhật ký ghi đến chậm | Thêm dòng có giờ sớm hơn mốc 3 giây | P0-C5 |
| Gửi lại sau khi cache mất | Xóa toàn bộ CacheService rồi gửi lại cùng mã | P0-D1 |
| Người khác xóa HĐ phía trên | Xóa dòng HD_NCC sau khi tải danh sách | P0-E1 |
| Phản hồi cũ về sau phản hồi mới | Giả lập lượt 1 trả lời sau 400 ms, lượt 2 sau 30 ms | `ui_phan_hoi_cu.cjs` |
| 2 người sửa cùng HĐ / sửa – xóa / phụ lục đồng thời / Duyệt ảnh 2 lần | (đã có từ đợt trước) | `test_may_chu.cjs` C-01..C-03, H-02, H-03, H-05 |

## 5. Phải kiểm tra trên Apps Script thật (bộ giả lập không chứng minh được)

- `LockService` dưới tải thật (2 người bấm cùng lúc thật), thời gian chờ khóa.
- `CacheService.getDocumentCache()` có trả về cache (dự án gắn với file Sheet) — nếu `null` hệ thống tự dùng ScriptCache như cũ.
- Định dạng chữ `@` cho 2 cột CCCD của Draft khi số dòng vượt vùng đã định dạng (tự định dạng thêm 1.000 dòng).
- Trigger 30 phút đồng bộ thanh toán với dữ liệu DNTT thật (khối lượng cột M, số CT cột L).
- Thời gian phản hồi thật, quota UrlFetch / Drive, kích thước phản hồi `google.script.run`.
