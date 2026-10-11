# Việc cần làm về bảo mật (nâng cấp 10/2026)

Nhánh `feature/hdmb-performance-optimization`. Mã nguồn đã sẵn sàng; các bước dưới đây **chủ dự án tự làm** vì đụng tới
khóa / quyền của hệ thống đang chạy. Không bước nào được tự động hóa trong mã.

## S-1. Xoay mã bí mật webhook DNTT (`WEBHOOK_SECRET`) — nên làm sớm

**Hiện trạng:** `Webhook_dntt.gs` ghi cứng mã bí mật mà HDMB gửi kèm khi gọi webapp DNTT
(`?action=lam_moi_cache&secret=...`). Repo GitHub đang **công khai** nên mã này coi như đã lộ: ai có mã đều gọi được
"làm mới cache" của DNTT.

**Mã mới đã hỗ trợ:** HDMB đọc mã từ *Script Properties* `DNTT_WEBHOOK_SECRET`; giá trị ghi cứng chỉ còn là dự phòng để
webhook không ngừng chạy trước khi xoay khóa.

**Các bước (theo đúng thứ tự, tránh gián đoạn):**
1. Tạo mã mới (vd chạy `Utilities.getUuid()` trong editor Apps Script, hoặc một chuỗi ngẫu nhiên ≥ 32 ký tự).
2. **Dự án DNTT** (đầu nhận): sửa chỗ kiểm tra `secret` để **chấp nhận cả mã cũ và mã mới** trong thời gian chuyển đổi
   → *Deploy → Manage deployments → Edit → New version*.
3. **Dự án HDMB** (đầu gửi): *Project Settings → Script Properties* → thêm `DNTT_WEBHOOK_SECRET` = mã mới.
4. Sửa 1 ô trong file có trigger `onChangeLamMoiCache` → kiểm tra DNTT nhận đúng lời gọi bằng mã mới (nhật ký DNTT).
5. Dự án DNTT: bỏ chấp nhận mã cũ → Deploy lại.
6. HDMB: xóa dòng `var WEBHOOK_SECRET = "..."` (để rỗng `""`) ở lần cập nhật mã sau → mã cũ hết hiệu lực hoàn toàn.

**Rollback:** nếu DNTT không nhận lời gọi sau bước 3 → xóa property `DNTT_WEBHOOK_SECRET` ở HDMB (quay về mã cũ).

## S-2. Repo công khai

Repo `saoluucvhak-pixel/HDMB_HAK` công khai: mã nguồn, URL webapp, link file Sheet ngoài (DNTT, Phiếu cân, Báo giá) ai cũng
xem được. Khuyến nghị chuyển *Private* (Settings → General → Danger zone). Lịch sử git vẫn giữ mã cũ — vì vậy S-1 vẫn bắt buộc.

## S-3. Các mục đã kiểm tra trong đợt này (không cần làm gì thêm)

| Mục | Kết quả | Bằng chứng |
|---|---|---|
| Phân quyền ở máy chủ cho mọi chức năng gọi từ trang web | 147 chức năng qua 1 cửa `api()` + bảng quyền; hàm ghi không mở cho Chỉ xem | `tests/test_phan_quyen_tinh.cjs` Q-1 |
| Kiểm tra quyền chặn nhầm trigger / bot / webhook | Không có | Q-2 (bắt được lỗi của `main` `fa95d5e` khi thử lại) |
| Chặn nhầm theo vai trò | Không có | Q-3 |
| Sổ hiệu năng mới | Không ghi tham số / dữ liệu / email; che dãy số ≥ 9 chữ số trong thông báo lỗi | `test_p1_hieu_suat.cjs` P1-GS3 |
| Cache dữ liệu lớn | Chuyển sang DocumentCache — không tranh chỗ với phiên đăng nhập | P1-CA1 |
| Chống tạo trùng hợp đồng | Không còn chỉ dựa vào CacheService | P0-D1 |

## S-4. Còn mở (đã có trong `09_TODO.md`, giữ nguyên theo quyết định chủ dự án)

- H-06, H-09 (vai trò Chỉ xem vẫn thấy đủ CCCD ở danh sách khách hàng / báo cáo), H-10, H-08 — chủ dự án chọn **không xử lý**.
  Đợt này **không thay đổi** hành vi đó; danh sách khách hàng mới vẫn trả đúng các trường như cũ.
- M-13, T-PDPD (gửi số tài khoản tới tracuubank.com, ảnh CCCD tới Gemini).
