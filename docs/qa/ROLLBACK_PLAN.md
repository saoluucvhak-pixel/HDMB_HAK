# Phương án quay lại (rollback) — nâng cấp 10/2026

## Khi nào quay lại

Lỗi chặn công việc (không mở được trang, không lưu được hợp đồng, số liệu báo cáo sai) mà không sửa nhanh được.

## Cách quay lại (≈ 2 phút, không mất dữ liệu)

1. Apps Script → *Deploy → Manage deployments → Edit (cây bút)* → ô **Version** chọn lại **số phiên bản cũ** đã ghi ở
   `DEPLOYMENT_CHECKLIST.md` mục 1 → *Deploy*. URL webapp giữ nguyên, người dùng tải lại trang là dùng bản cũ.
2. Trigger (đồng bộ thanh toán 30 phút, onEdit, Telegram) chạy theo **mã đang lưu trong dự án** (HEAD), không theo phiên bản
   triển khai. Để trigger cũng chạy mã cũ: chép lại 13 file từ `main` (`8d4bd25`) vào dự án — bằng công cụ đồng bộ GitHub
   (Pull nhánh `main`) hoặc chép tay.
3. Không cần xóa gì thêm. Dữ liệu và khóa mà bản mới tạo (xem `DEPLOYMENT_CHECKLIST.md` mục 6) **không ảnh hưởng** bản cũ:
   - Script Properties mới: bản cũ không đọc → bỏ qua. Có thể xóa cho gọn.
   - `DRAFT_MOOC_LAM_MOI_LAN_TRUOC` (dùng chung): bản mới chỉ ghi khi làm mới thành công → giá trị hợp lệ cho bản cũ.
   - Sheet `NhatKy_HieuNang`, dòng `dnttDaApDung` trong `Cache_BaoCao`: bản cũ không dùng → có thể xóa.
   - Cột CCCD của Draft định dạng chữ: bản cũ vẫn đọc/ghi bình thường (chuỗi giữ số 0 đầu, tốt hơn trước).
   - Mã chống tạo trùng trong `HD_TAO_GAN_DAY`: bản cũ chỉ dùng CacheService như trước.

## Sau khi quay lại

- Bấm **🔄 Làm mới** ở Tổng quan/Báo cáo hoặc menu *Xây dựng lại Draft báo cáo* nếu nghi Draft lệch.
- Menu *Đồng bộ thanh toán ngay* để số liệu thực hiện khớp DNTT.
- Gửi lại thông tin lỗi (thời điểm, trang, thông báo, dòng trong `NhatKy_HieuNang` / `NhatKy_SuaDoi`) để xử lý trên nhánh.

## Quay lại từng phần (không cần quay cả bản)

Mỗi thay đổi là 1 commit riêng (xem `08_CHANGELOG.md`) → có thể `git revert <commit>` đúng phần lỗi, chạy lại
`node tests/chay_tat_ca.cjs`, rồi chép các file liên quan.
