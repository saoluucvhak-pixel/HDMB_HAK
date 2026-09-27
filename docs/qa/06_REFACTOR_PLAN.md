# 06 — Kế hoạch tái cấu trúc (Refactor Plan)

Nguyên tắc: mỗi bước là **1 commit riêng**, có **cách kiểm chứng trước khi triển khai** và **cách quay lui**. Không bước nào đổi giao diện hay dữ liệu.

**Quay lui chung:** (1) mã nguồn: `git revert <commit>`; (2) Apps Script: *Deploy → Manage deployments* — luôn triển khai bằng **phiên bản mới**, giữ phiên bản cũ để chọn lại trong 1 phút nếu có sự cố.

## R1 — Dọn mã chết ✅ ĐÃ LÀM (`e5d5680`)
- Xóa `26_Page_QuanLyMeCon.html` (1.393 dòng — route đã chuyển sang 27), `08_Sidebar.html`, `09_Style.html` (hàm `include` được giữ vì R2/R3 dùng).
- Xóa 19 hàm server + 1 hàm client không ai gọi (danh sách ở 04_ARCHITECTURE §9); **giữ** 5 hàm chạy tay (`SETUP_*`, `TEST_KET_NOI_DON_GIAN`, `XOA_TRIGGER_LOI_GEO_DETECT_LOCATION`, `onChangeLamMoiCache`).
- Lợi ích phụ về bảo mật: bớt hàm ghi công khai (vd `THEM_LINK_ANH_HOP_DONG`).
- Kiểm chứng: bộ test server/UI chạy lại; tìm trên project thật (Ctrl+Shift+F) tên từng hàm trước khi xóa — có thể có trigger cài tay trỏ tới.

## R2 — Partial dùng chung cho helper giao diện (rủi ro THẤP) — ✅ phần lớn: widget chatbot → `ChatbotWidget.html` (`64cde28`); còn `thongBao_` (4 bản) và `showMsg` (3 bản) là hàm nhỏ
- Tạo `_Chung_JS.html` chứa: `escHtml`, `urlAnToan`, `thongBao_` (toast), `showMsg`, `formatSo`. Các trang nạp bằng `<?!= include('_Chung_JS') ?>` (các trang webapp và sidebar 07 đều dựng bằng `createTemplateFromFile` nên scriptlet chạy được).
- **Không** dùng cho `13_HuongDan` khi mở từ menu (dùng `createHtmlOutputFromFile` → scriptlet không chạy).
- Giữ tên cũ (`escHtmlKH_`, `escHtmlNL_`…) làm bí danh 1 dòng trỏ vào hàm chung để không phải sửa hàng trăm điểm gọi cùng lúc.
- Kiểm chứng: `ui_tests.js` (tải trang không lỗi + các test escape/toast).

## R3 — Gộp JS chung của 07 (sidebar) và 11 (webapp) ✅ ĐÃ LÀM (`534ac14`, 67 hàm → `NhapLieu_Chung_JS.html`)
- 66 hàm đã giống hệt từng byte (sau đợt này) → chuyển vào `_NhapLieu_JS.html`, include ở cả 2 trang.
- 4 hàm khác biệt có chủ đích → 1 bản duy nhất, rẽ nhánh theo sự tồn tại của phần tử: `if (document.getElementById('nhomKH'))`.
- Kiểm chứng: chạy `dupdiff.js` (phải còn 0 hàm trùng) + `ui_tests.js`; kiểm tra tay 1 vòng tạo/sửa hợp đồng ở cả sidebar và webapp.

## R4 — Xác thực & phân quyền (SEC-002) (rủi ro CAO · cần chọn phương án ở 02_SECURITY_REPORT §3)
Nếu chọn phương án A (đăng nhập trong ứng dụng):
1. `DANG_NHAP(tenDangNhap, matKhau)` → kiểm tra băm (`Utilities.computeDigest` SHA-256 + salt riêng từng người, lưu Script Properties) → cấp `phien` ngẫu nhiên (`Utilities.getUuid()`) lưu ScriptCache 6 giờ kèm vai trò.
2. `yeuCauPhien_(phien, vaiTroToiThieu)` ở **dòng đầu** mọi hàm công khai; hàm chỉ dùng từ menu đổi thành riêng tư.
3. Client: 1 hàm `goi_(ten, args, ok, loi)` bọc `google.script.run`, tự chèn `phien`, xử lý hết phiên → quay về màn đăng nhập. Thay dần các điểm gọi theo từng trang.
4. Kiểm chứng: test server "gọi không có phiên → bị từ chối" cho **từng** hàm công khai (sinh tự động từ danh sách hàm).

## R5 — Kiểm tra cấu trúc Sheet (MAP-001) ✅ ĐÃ LÀM (`38482b9`)
- Chụp tiêu đề hiện tại của HD_NCC/HD_RUNG/HD_STK/HD_GPS/HD_Picture 1 lần → lưu làm "tiêu đề chuẩn".
- `kiemTraCauTrucSheet_()` so tiêu đề thật với chuẩn (cache kết quả 10 phút); lệch → **chặn ghi** và báo rõ cột nào sai, thay vì ghi lệch cột âm thầm.
- Không đổi cách đọc/ghi hiện tại (vẫn theo chỉ số) → không rủi ro dữ liệu.

## R6 — Tách `06_CreateUpdate.gs` — ⏸️ HOÃN: dự án được chép file thủ công sang Apps Script; thêm 5 file mới làm tăng rủi ro quên chép 1 file (hỏng cả project) — lợi ích không tương xứng
- `06a_HopDong.gs`, `06b_LoRung.gs`, `06c_TaiKhoan.gs`, `06d_GpsAnh.gs`, `06e_ThanhLy.gs`. Chỉ di chuyển nguyên hàm, không sửa nội dung (Apps Script dùng chung namespace nên không cần import).
- Kiểm chứng: `analyze.js` (tổng số hàm, không trùng tên) + bộ test server.

## R7 — Khóa còn thiếu (LOCK-004/006/008) (cần xác minh trước)
Trước khi thêm khóa vào lớp cache Draft (được gọi *bên trong* các hàm đã giữ khóa), cần biết `LockService` có tái nhập trong cùng lượt chạy hay không. Chạy thử trong trình soạn thảo:

```javascript
function TEST_LOCK_TAI_NHAP() {
  const a = LockService.getScriptLock(); a.waitLock(5000);
  const b = LockService.getScriptLock(); const t = Date.now();
  try { b.waitLock(3000); Logger.log('Tái nhập được, chờ ' + (Date.now() - t) + ' ms'); }
  catch (e) { Logger.log('KHÔNG tái nhập: ' + e.message); }
  finally { try { b.releaseLock(); } catch (e) {} a.releaseLock(); }
}
```
- Tái nhập được → thêm khóa trực tiếp. Không tái nhập → dùng mẫu đã áp dụng cho `LUU_CHINH_THUC` (khóa ngắn, nhả trước khi gọi hàm khác).

## Thứ tự đề xuất
R4 (quyết định phương án) → R7 → phần còn lại của R2 → R6 (nếu chuyển sang đồng bộ bằng `clasp`).
Đã xong: R1, R3, R5, phần chính của R2.
