# Kiểm thử tự động

Chạy được trên máy bất kỳ có Node ≥ 18 — **không cần tài khoản Google, không đụng dữ liệu thật**.

| File | Nội dung |
|---|---|
| `gasmock.cjs` | Bộ giả lập Apps Script: nạp toàn bộ `.gs` vào một ngữ cảnh, Sheets trong bộ nhớ (ép chuỗi số như Sheets thật, ô `@` giữ chữ, đánh dấu công thức), Cache/Properties/Lock giả, đếm số lệnh đọc. |
| `test_may_chu.cjs` | Test hồi quy phía máy chủ cho các lỗi đã sửa (C-, H-, M-, P-, B2). |
| `kiem_tra_cu_phap.cjs` | Kiểm tra cú pháp mọi `.gs` và khối `<script>` trong `.html`. |
| `ui_khoa_nut.cjs`, `ui_hop_thoai_bo_loc.cjs`, `ui_giao_dien.cjs` | Test giao diện bằng Playwright trên mã `PhanQuyen_JS.html` / `GiaoDien_Chung.html` thật (khóa nút chống bấm đúp, hộp thoại, nhớ bộ lọc, chế độ tối, gắn nhãn / tên nút). |
| `ui_nhung_portal.cjs` | Dựng lại các lớp khung của Apps Script (Portal → trang Google → sandbox → trang HDMB), Portal chỉ là iframe thường: bấm menu đổi trang trong khung, không lồng thêm tầng, Quay lại dùng được; mở trực tiếp / tab mới / webapp khác → như cũ. |
| `chay_tat_ca.cjs` | Chạy tất cả theo thứ tự. |

```bash
cd tests
npm install && npx playwright install chromium   # lần đầu
npm test                                         # hoặc: node chay_tat_ca.cjs
```

- Chromium có sẵn trên máy: đặt `CHROMIUM_PATH=/đường/dẫn/chrome`.
- Chỉ chạy phần máy chủ: `TZ=Asia/Ho_Chi_Minh node test_may_chu.cjs`.
- GitHub Actions (`.github/workflows/kiem-thu.yml`) tự chạy mỗi lần push / pull request.
- Đuôi `.cjs` / `.md` / `.json` trong `tests/` không phải mã Apps Script → công cụ đồng bộ GitHub ↔ Apps Script bỏ qua.

**Khi sửa lỗi mới:** thêm một khối `chay(function () { ... kiem('Mã lỗi mô tả', điều_kiện, chi_tiết) })` vào `test_may_chu.cjs`, chạy thử trên mã CŨ (phải trượt) rồi mã MỚI (phải đạt).
