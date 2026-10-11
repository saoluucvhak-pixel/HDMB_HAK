# Danh sách kiểm tra triển khai — nâng cấp hiệu năng & toàn vẹn dữ liệu (10/2026)

Nhánh `feature/hdmb-performance-optimization` (tách từ `main` `8d4bd25`). **Không tự triển khai lên production** — các bước
dưới đây do chủ dự án làm.

## 1. Trước khi triển khai

- [ ] GitHub Actions của Pull Request xanh (cú pháp, phân quyền tĩnh, máy chủ, P0, P1, giao diện).
- [ ] Ghi lại **số phiên bản đang chạy**: Apps Script → *Deploy → Manage deployments* → ghi số "Version" hiện tại (để quay lại).
- [ ] Sao lưu nhanh: *File → Make a copy* file dữ liệu chính và file báo cáo (hoặc ít nhất ghi nhận thời điểm để dùng
      *Version history* của Google Sheets nếu cần).

## 2. Chép mã (13 file mã nguồn, không có file mới, không có file cần xóa)

`.gs`: `00_Config`, `01_ContractManager`, `06_CreateUpdate`, `15_DraftHopDong`, `16_DraftHoSoRung`, `17_ChanDoanTocDo`,
`33_TraCuuHopDong`, `34_PhanQuyen`, `Code`, `Webhook_dntt`.
`.html`: `10_Page_BaoCao`, `27_Page_HopDongMeCon`, `NhapLieu_Chung_JS`.

(`tests/`, `.github/`, `docs/` không đưa lên Apps Script.) Thiếu 1 file `.gs` trong nhóm trên → có thể báo lỗi "is not
defined" vì các file gọi lẫn nhau (vd `docCacCot_`, `xoaCacheChiaManh_`, `ghiHieuNangNeuCham_`) — chép đủ cả nhóm.

## 3. Triển khai

- [ ] *Deploy → Manage deployments → Edit (cây bút) → Version: New version → Deploy*. Giữ nguyên URL webapp.

## 4. Kiểm tra ngay sau triển khai (10 phút)

- [ ] Mở webapp, đăng nhập, mở **Tổng quan**, **Tra cứu** (tìm 1 tên, 1 CCCD), **Báo cáo tổng hợp**, **Bản đồ GPS**.
- [ ] **Nhập liệu**: danh sách hợp đồng → bấm *Xem* 1 hợp đồng → đúng hợp đồng đã bấm.
- [ ] **Thêm/Sửa HĐ**: danh sách khách hàng, gõ tìm nhanh vài ký tự → bảng hiện đúng kết quả cuối cùng.
- [ ] Báo cáo tổng hợp: cột CCCD hiện đủ số 0 đầu.
- [ ] Bấm **🔄 Làm mới** 2 lần liền → lần 2 báo "Không có thay đổi gì".
- [ ] Menu Sheet *Đồng bộ thanh toán ngay* (Quản trị) → thông báo ✅ và số liệu khối lượng thực hiện đúng với cột M DNTT.
- [ ] *Project Settings → Script Properties*: xuất hiện các khóa mới sau vài thao tác (xem mục 6) — bình thường.

## 5. Theo dõi 1–3 ngày

- [ ] Sheet **NhatKy_HieuNang** (file báo cáo) — chỉ có dòng khi lời gọi chậm > 5 giây hoặc lỗi hệ thống. Nhiều dòng "LỖI"
      cùng 1 chức năng → báo lại để xử lý.
- [ ] `NhatKy_SuaDoi`: không có dòng "LỖI làm mới Draft báo cáo" / "LỖI đồng bộ thanh toán" lặp lại liên tục.
- [ ] Trigger 30 phút đồng bộ thanh toán vẫn chạy (Apps Script → *Executions*).

## 6. Dữ liệu / cấu hình mà bản mới tự tạo (không đổi dữ liệu nghiệp vụ)

| Nơi | Khóa / sheet | Ý nghĩa |
|---|---|---|
| Script Properties | `DRAFT_LAM_MOI_DONG_CUOI`, `DRAFT_LAM_MOI_CHO_LAI`, `DRAFT_LAM_MOI_DANG_CHAY` | Mốc theo dòng nhật ký, HĐ chờ làm lại, cờ đang chạy của "Làm mới" |
| Script Properties | `HD_TAO_GAN_DAY` | Mã chống tạo trùng hợp đồng (60 lượt gần nhất, 6 giờ) |
| Script Properties | `DNTT_TINH_LAI_TOAN_BO_LUC` | Lần tính lại toàn bộ thanh toán gần nhất (24 giờ/lần) |
| Script Properties | `DRAFT_BC_CCCD_CHU_DEN_DONG` | Đã định dạng chữ 2 cột CCCD của Draft tới dòng nào |
| Script Properties (tùy chọn) | `HIEU_NANG_NGUONG_MS`, `DNTT_WEBHOOK_SECRET` | Ngưỡng ghi sổ hiệu năng; mã webhook mới (xem SECURITY_ACTIONS) |
| File báo cáo | sheet `NhatKy_HieuNang` | Sổ lời gọi chậm / lỗi |
| File báo cáo | `Cache_BaoCao`, dòng `dnttDaApDung` | Bản thanh toán đã áp dụng vào Draft (đồng bộ tăng dần) |
| File báo cáo | `Draft_BaoCaoHopDong` cột F, J | Định dạng chữ (giữ số 0 đầu CCCD) — chỉ là định dạng, không đổi giá trị |

Không thêm / xóa / đổi thứ tự cột của bất kỳ sheet nào. Không sửa `HD_NCC`, `HD_RUNG`, `HD_STK`, `HD_GPS`, `HD_Picture`.

## 7. Tùy chọn (không bắt buộc)

- Menu *🔄 Xây dựng lại Draft báo cáo* (Quản trị) 1 lần: ghi lại CCCD dạng chữ cho dòng Draft cũ. Không chạy cũng không sao —
  khi đọc ra hệ thống đã tự trả lại số 0 đầu.
- Thực hiện `SECURITY_ACTIONS.md` mục S-1 (xoay mã webhook).

Quay lại bản cũ: xem `ROLLBACK_PLAN.md`.
