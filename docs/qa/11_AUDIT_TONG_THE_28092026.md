# 11 — Rà soát tổng thể trước phát hành (28/09/2026)

> **Phạm vi:** toàn bộ 39 file mã nguồn (26 `.gs`, 13 `.html`, `appsscript.json`) — 21.276 dòng, tại commit `4d3d673`.
> **Cách làm:** đọc mã trực tiếp, lần theo từng luồng dữ liệu Frontend → `google.script.run` → `api()` → Apps Script → Google Sheet → trả về → render. Mỗi lỗi dưới đây có **tình huống tái hiện cụ thể** suy ra từ mã; chưa chạy được trên project Apps Script thật (không có quyền truy cập), nên số liệu hiệu năng ở Phần 8 là **ước tính** theo giới hạn công bố của Google, không phải số đo.
> **Quan hệ với đợt QA trước (`01`–`10`):** các lỗi đã sửa ở đó (BUG-01…14, SEC-001…011, PERF-001/005, MAP-001) **không liệt kê lại**. Báo cáo này chỉ ghi **lỗi mới phát hiện** và các lỗi cũ còn mở nhưng bị đánh giá thấp hơn thực tế.

Mức độ: 🔴 CRITICAL (mất/sai dữ liệu tiền, dữ liệu pháp lý, không tự phục hồi) · 🟠 HIGH · 🟡 MEDIUM · ⚪ LOW

---

## 1. Tổng quan dự án

### 1.1 Kiến trúc hiện tại

```
┌───────────────────────── Trình duyệt ─────────────────────────┐
│ 10 trang webapp (30 Tổng quan, 33 Tra cứu, 35 Hình ảnh,       │
│ MapContainer, 27 Thêm/Sửa HĐ, 11 Nhập liệu, 10 Báo cáo,       │
│ 12 Kiểm tra, 24 Thiết lập, 13 Hướng dẫn) + sidebar 07 trong   │
│ Sheet. Phần dùng chung: PhanQuyen_JS, NhapLieu_Chung_JS,      │
│ ChatbotWidget, DinhDangSo_JS                                   │
└──────────────┬────────────────────────────────────────────────┘
               │ hakRun_().TEN_HAM(...)  =  google.script.run.api(phien,'TEN_HAM',[...])
               ▼
┌──────────── Apps Script (executeAs: chủ script) ──────────────┐
│ doGet (Code.gs) → định tuyến ?page= / ?action=run|anh / ?sso= │
│ api() (34) → kiểm phiên (ScriptCache) → bảng quyền 123 hàm    │
│ Nghiệp vụ: 06 CRUD · 15 Nháp HĐ · 14 Phụ lục/ct_hopdong ·     │
│ 01/16/18 Draft báo cáo · 02/03/04 Kiểm tra/OCR · 22/23 Xuất · │
│ 29/31 Chatbot/Telegram · 33/35/36/37 Tra cứu/Ảnh/PDF/QR       │
└──────┬───────────────┬──────────────┬───────────────┬─────────┘
       ▼               ▼              ▼               ▼
  Sheet chính     Sheet báo cáo   3 Sheet ngoài    Drive (4 thư mục)
  HD_NCC/RUNG/    Draft_BaoCao-   DNTT_GK_DN_CT    + Gemini, Telegram,
  STK/GPS/Picture HopDong,        PhieuCan_DN      VietQR, tracuubank
  Draft_HopDong,  Draft_HoSoRung, Baogia_DN_SAVE
  PhuLuc, NhatKy  Cache_BaoCao
```

### 1.2 Công nghệ
Google Apps Script V8 · HtmlService (template + `include`) · SpreadsheetApp / DriveApp / Drive API v2 · CacheService · LockService · PropertiesService · UrlFetchApp · Leaflet 1.9.4 (CDN). Không bundler, không framework, không test tự động chạy được trên CI.

### 1.3 Module
| Nhóm | File | Ghi chú |
|---|---|---|
| Lõi | `00_Config`, `Code`, `05_Menu`, `34_PhanQuyen` | Hằng số cột theo **vị trí**, `doGet`, `api()`, phân quyền |
| Ghi dữ liệu | `06_CreateUpdate` (2.216 dòng), `15_DraftHopDong`, `14_CtHopDong_PhuLuc` | Mọi đường ghi HD_NCC/RUNG/STK/GPS/PhuLuc |
| Dẫn xuất (cache) | `01_ContractManager`, `16_DraftHoSoRung`, `18_BaoCaoTongHop_Gop` | Draft báo cáo — nguồn dữ liệu của Tổng quan/Báo cáo |
| Kiểm tra | `02`, `03`, `04`, `17`, `19`, `28` | OCR, EXIF, chẩn đoán, bảo trì |
| Xuất | `20`, `21`, `22`, `23`, `25`, `36`, `37` | MISA, Excel/PDF, QR |
| Tích hợp | `29_Chatbot`, `31_TelegramBot`, `32_TraCuuNganHang`, `Webhook_dntt` | Gửi dữ liệu ra ngoài |
| Tra cứu | `33_TraCuuHopDong`, `35_TraCuuHinhAnh` | Có che số cho vai trò Chỉ xem |

---

## 2. Lỗi CRITICAL

### C-01 🔴 Tài khoản ngân hàng / phụ lục được xác định bằng **số dòng** → sửa/xóa nhầm tài khoản của hợp đồng KHÁC
- **File / hàm:** `15_DraftHopDong.gs` `luuChinhThucThucThi_` (dòng 340–368); `06_CreateUpdate.gs` `CAP_NHAT_TAI_KHOAN_` (837), `XOA_TAI_KHOAN_` (1922); `14_CtHopDong_PhuLuc.gs` `LUU_PHU_LUC_` (253–268), `XOA_PHU_LUC_` (301); `27_Page_HopDongMeCon.html` dòng 1004, 1106.
- **Nguyên nhân:** HD_STK và PhuLucHopDong không có khóa duy nhất (`ID_STK = ID_HD`), nên nháp lưu **số dòng** (`soDong`) tại thời điểm mở nháp. Nháp có thể nằm trong `Draft_HopDong` nhiều ngày. Mọi thao tác `deleteRow` ở HD_STK (xóa TK của HĐ khác, xóa vĩnh viễn HĐ) làm các dòng phía dưới **dịch lên**, nhưng nháp vẫn giữ số cũ. Không hàm nào kiểm tra dòng đó còn thuộc `idHD` của nháp không.
- **Tái hiện (không cần đồng thời):**
  1. HĐ A có 2 tài khoản ở dòng 5 và 7 của HD_STK. Người dùng mở nháp, bấm xóa cả 2, Lưu chính thức.
  2. `XOA_TAI_KHOAN_(5)` xóa đúng; dòng 7 cũ giờ là dòng 6. `XOA_TAI_KHOAN_(7)` xóa **dòng 8 cũ = tài khoản của HĐ B**.
  3. Tương tự: xóa TK dòng 5 rồi **sửa** TK dòng 7 → `CAP_NHAT_TAI_KHOAN_(7, dTK)` ghi Số TK / Ngân hàng / Người nhận của HĐ A **đè lên tài khoản nhận tiền của HĐ B**.
- Trang 27: sửa HĐ có Số TK → luôn ghi đè `list[0]` (tài khoản **đầu tiên**) — HĐ có nhiều TK mất TK đầu mà không cảnh báo.
- **Ảnh hưởng:** App Thanh toán (ĐNTT) chuyển tiền theo HD_STK → **chuyển tiền nhầm người**; mất tài khoản của khách khác; không có nhật ký nào ghi lại việc xóa (XOA_TAI_KHOAN_ không gọi `ghiNhatKy_`).
- **Cách sửa (bắt buộc cả 3 bước):**
  1. Thêm cột khóa bất biến `ID_DONG` (UUID) cho HD_STK và PhuLucHopDong (cột mới ở cuối — hợp lệ với MAP-001), điền cho dữ liệu cũ bằng 1 hàm bảo trì.
  2. Nháp/khung sửa lưu `idDong` thay cho `soDong`; mọi hàm sửa/xóa tìm lại dòng theo `idDong` **dưới lock** và kiểm tra `ID_HD` trùng khớp.
  3. Trong thời gian chưa có cột mới: tối thiểu phải kiểm tra chéo trước khi ghi.

```javascript
// 06_CreateUpdate.gs — thay thế tạm thời, an toàn ngay cả khi chưa có cột ID_DONG
function _timDongStkAnToan_(sh, soDongGoi, idHD, soTKGoc) {
  const last = sh.getLastRow();
  if (last < 2) return -1;
  const data = sh.getRange(2, 1, last - 1, STK_COL.TIMESTAMP + 1).getValues();
  const khop = function (r) {
    return String(r[STK_COL.ID_HD]).trim() === String(idHD).trim() &&
           (soTKGoc === undefined || String(r[STK_COL.SO_TK]).trim() === String(soTKGoc).trim());
  };
  if (soDongGoi >= 2 && soDongGoi <= last && khop(data[soDongGoi - 2])) return soDongGoi; // dòng cũ còn đúng
  for (let i = 0; i < data.length; i++) if (khop(data[i])) return i + 2;              // dòng đã dịch -> tìm lại
  return -1;                                                                           // không thấy -> KHÔNG ghi
}

function XOA_TAI_KHOAN_(soDong, idHD, soTKGoc) {
  _yeuCauQuyen_(QUYEN.NHAP_LIEU);
  const lock = LockService.getScriptLock(); lock.waitLock(15000);
  try {
    const sh = getSheet_(SHEET_NAME.HD_STK);
    const dong = _timDongStkAnToan_(sh, Number(soDong), idHD, soTKGoc);
    if (dong === -1) return { thanhCong: false, loi: 'Tài khoản đã thay đổi hoặc không còn — tải lại hợp đồng.' };
    sh.deleteRow(dong);
  } finally { lock.releaseLock(); }
  ghiNhatKy_('Xóa tài khoản', idHD, 'Số TK ' + (soTKGoc || '?'));
  CAP_NHAT_DRAFT_MOT_HOP_DONG_(idHD);
  return { thanhCong: true };
}
```
  Nháp (`LAY_DRAFT_THEO_ID_HD_TAO_MOI_`) phải lưu thêm `soTKGoc` cho mỗi tài khoản; `luuChinhThucThucThi_` truyền `(tk.soDong, idHD, tk.soTKGoc)`. Làm tương tự cho phụ lục (khóa phụ `ID_PHU_LUC` đã có sẵn và là duy nhất → dùng luôn `ID_PHU_LUC` thay cho `soDong`).

### C-02 🔴 Sửa hợp đồng theo **số dòng cũ** → ghi đè toàn bộ thông tin sang hợp đồng khác
- **File / hàm:** `06_CreateUpdate.gs` `CAP_NHAT_HOP_DONG_` (1082), nhánh cập nhật của `LUU_HOP_DONG_DAY_DU_` (2140–2151); `27_Page_HopDongMeCon.html` 460 (duyệt hàng loạt), 911, 1106 (`CAP_NHAT_HOP_DONG(h.soDong, d)`).
- **Nguyên nhân:** trang 27 giữ `soDong` từ lúc tải danh sách; `CAP_NHAT_HOP_DONG_` ghi thẳng vào dòng đó mà không kiểm tra `ID_HD`. `LUU_HOP_DONG_DAY_DU_` còn tệ hơn: đọc hợp đồng theo `payload.soDong` rồi **gán lại `idHD = kqTim.idHD`** — tức là tự chuyển sang hợp đồng đang nằm ở dòng đó.
- **Tái hiện:** Người A mở trang 27, danh sách hiện HĐ X ở dòng 120. Quản trị xóa vĩnh viễn 1 HĐ ở dòng 50 (`XOA_VINH_VIEN_HOP_DONG_` → `deleteRow`). Người A sửa địa chỉ/Số TK HĐ X, bấm Lưu → dữ liệu ghi vào dòng 120 = **HĐ Y** (vốn ở dòng 121). Duyệt hàng loạt 10 HĐ cũng rơi vào 10 HĐ sai.
- **Ảnh hưởng:** tên chủ rừng, CCCD, Số TK, trạng thái của HĐ Y bị thay bằng dữ liệu HĐ X; không có cảnh báo, không có nhật ký (xem H-01).
- **Cách sửa:** mọi API ghi theo dòng phải nhận thêm `idHD` và xác minh:

```javascript
function CAP_NHAT_HOP_DONG_(soDong, patch, idHDMongDoi) {
  _yeuCauQuyen_(QUYEN.NHAP_LIEU);
  const sh = getSheet_(SHEET_NAME.HD_NCC);
  if (idHDMongDoi) {
    const idTaiDong = (soDong >= 2 && soDong <= sh.getLastRow())
      ? String(sh.getRange(soDong, NCC_COL.ID_HD + 1).getValue()).trim() : '';
    if (idTaiDong !== String(idHDMongDoi).trim()) {
      soDong = timSoDongTheoGiaTri_(SHEET_NAME.HD_NCC, NCC_COL.ID_HD, idHDMongDoi); // tìm lại theo khóa
      if (soDong === -1) return { thanhCong: false, loi: 'Hợp đồng đã bị xóa/di chuyển — tải lại trang.' };
    }
  }
  // ... phần ghi như cũ (nên gom thành 1 setValues, xem P-03)
}
```
  Trong `LUU_HOP_DONG_DAY_DU_`: nếu `kqTim.idHD !== payload.idHD` → **từ chối**, không được gán lại `idHD`. Client 27 gửi `(h.soDong, d, h.idHD)`. Về lâu dài bỏ hẳn `soDong` khỏi API công khai.

### C-03 🔴 Số HĐ không duy nhất + đổi Số HĐ/Ngày ký không lan xuống bảng con → trùng ID_RUNG, trộn GPS, sai khối lượng thanh toán
- **File / hàm:** `06_CreateUpdate.gs` 455, 2078 (`soHD = d.soHD || tự sinh` — không kiểm tra trùng), 615–618 (`idRung = 'HAK' + soHD + '_' + stt`, `stt` chỉ tính trong cùng `idHD`), 1096 (`CAP_NHAT_HOP_DONG_` cho sửa `soHD`, `ngayKy`); `01_ContractManager.gs` `tinhDongDraftChoHopDong_` (ghép DNTT theo `SO_HD`).
- **Tái hiện 1 (trùng ID_RUNG):** HĐ số `293` ký 01/2025 và HĐ số `293` ký 01/2026 (đánh số lại mỗi năm, hoặc gõ nhầm) → hai `ID_HD` khác nhau (`293-20250101`, `293-20260101`) nhưng lô đầu tiên của cả hai đều là `HAK293_1`. HD_GPS nối theo `ID_RUNG` → **điểm GPS, diện tích GPS, ảnh của 2 hợp đồng trộn vào nhau**; `XOA_LO_RUNG_('HAK293_1')` xóa lô của hợp đồng tìm thấy đầu tiên + **toàn bộ GPS của cả 2**.
- **Tái hiện 2 (sai thanh toán):** `layDuLieuThucHienTuDNTT_` cộng dồn theo Số HĐ → 2 HĐ trùng số cùng nhận **tổng khối lượng của cả hai**.
- **Tái hiện 3 (đổi Số HĐ/Ngày ký):** sửa Số HĐ trên form 11/27 → HD_NCC.SO_HD đổi, nhưng `ID_HD`, `HD_RUNG.SO_HD`, `ID_RUNG`, `HD_STK.SO_HD`, `ID_GPS`, `Draft_HoSoRung.NGAY_KY` giữ giá trị cũ. Khối lượng thực hiện (ghép DNTT theo SO_HD mới) về 0; hồ sơ rừng hiện ngày ký cũ.
- **Ảnh hưởng:** sai số liệu thanh toán, sai bản đồ, xóa nhầm GPS — không tự phục hồi.
- **Cách sửa:**
  1. Kiểm tra trùng **dưới lock** khi tạo và khi sửa Số HĐ (so với mọi `SO_HD` hiện có, không phân biệt hoa/thường, bỏ khoảng trắng).
  2. `ID_RUNG` sinh từ `ID_HD` (vốn duy nhất) thay cho `soHD`: `'R_' + idHD + '_' + stt`, hoặc UUID ngắn. Chỉ áp dụng cho lô mới — không đổi ID cũ.
  3. Khóa `soHD` và `ngayKy` sau khi HĐ ở trạng thái khác "Chờ thực hiện"; nếu vẫn cho sửa thì viết hàm `DOI_SO_HD_` chạy dưới lock cập nhật đồng loạt HD_NCC/HD_RUNG/HD_STK/HD_GPS/Draft (không đổi `ID_HD` — ID là khóa, không phải dữ liệu hiển thị).
  4. Chạy chẩn đoán 1 lần: liệt kê `SO_HD` trùng và `ID_RUNG` trùng hiện có.

```javascript
function _soHDDaTonTai_(soHD, boQuaIdHD) {
  const chuan = function (s) { return String(s || '').replace(/\s+/g, '').toLowerCase(); };
  const can = chuan(soHD);
  return readData_(SHEET_NAME.HD_NCC).some(function (r) {
    return chuan(r[NCC_COL.SO_HD]) === can && String(r[NCC_COL.ID_HD]).trim() !== String(boQuaIdHD || '').trim();
  });
}
// Trong TAO_HOP_DONG_MOI_ / LUU_HOP_DONG_DAY_DU_ (bên trong lock, trước khi ghi):
if (d.soHD && _soHDDaTonTai_(d.soHD)) return { thanhCong: false, loi: 'Số HĐ ' + d.soHD + ' đã tồn tại.' };
```

---

## 3. Lỗi HIGH

### H-01 🟠 Duyệt / Hủy / Sửa hợp đồng ở trang 27 **không cập nhật Draft báo cáo và không ghi nhật ký**
- **File / hàm:** `06_CreateUpdate.gs` `CAP_NHAT_HOP_DONG_` (1082–1123) — không gọi `CAP_NHAT_DRAFT_MOT_HOP_DONG_`, `CAP_NHAT_DRAFT_HOSORUNG_CHO_HOPDONG_`, `ghiNhatKy_`. Trang 27 gọi thẳng hàm này qua `api` (460, 911, 1106).
- **Nguyên nhân:** chỉ các hàm bao ngoài (`HUY_HOP_DONG_`, `THANH_LY_HOP_DONG_`, `LUU_HOP_DONG_DAY_DU_`) mới cập nhật Draft. Trigger `onEdit` không bắt được thay đổi do script ghi. `LAM_MOI_DRAFT_THEO_THAY_DOI_` dựa vào nhật ký — mà thao tác này không ghi nhật ký.
- **Tái hiện:** trang 27 bấm "✅ Duyệt (→ Đang thực hiện)" → Tra cứu (đọc HD_NCC) hiện "Đang thực hiện", nhưng Tổng quan / Báo cáo / Thanh lý / Telegram (đọc Draft) vẫn "Chờ thực hiện" **vô thời hạn** — kể cả khi bấm "Làm mới".
- **Thêm:** `tinhTrang` là chuỗi tự do từ client → vai trò Nhập liệu đặt được "Đã thanh lý" (bỏ qua kiểm tra hồ sơ của `THANH_LY_HOP_DONG_`) hoặc mở lại HĐ đã thanh lý.
- **Cách sửa:** chuyển cập nhật Draft + nhật ký vào **trong** `CAP_NHAT_HOP_DONG_` (ghi nhật ký dạng "trường: cũ → mới"); tách API đổi trạng thái riêng `DOI_TINH_TRANG_HOP_DONG_(idHD, tinhTrangMoi)` với máy trạng thái hợp lệ:

```javascript
const CHUYEN_TRANG_THAI_HOP_LE_ = {
  'Chờ thực hiện':  ['Đang thực hiện', 'Đã hủy'],
  'Đang thực hiện': ['Đã hủy'],          // "Đã thanh lý" CHỈ qua THANH_LY_HOP_DONG_
  'Đã hủy': [], 'Đã thanh lý': []        // mở lại: chỉ Quản trị, hàm riêng, bắt buộc lý do
};
```
  `CAP_NHAT_HOP_DONG_` loại khóa `tinhTrang` ra khỏi `map` (chỉ hàm đổi trạng thái được ghi cột này). Cân nhắc cho "Duyệt" chỉ vai trò Quản trị (tách biệt người nhập – người duyệt).

### H-02 🟠 Nháp cũ ghi đè dữ liệu mới hơn (lost update) + 2 người dùng chung 1 nháp
- **File:** `15_DraftHopDong.gs` 128 (`idDraft = 'DRAFT_' + idHD` — 1 nháp/HĐ dùng chung), `LUU_DRAFT_` 172, `luuChinhThucThucThi_` 299.
- **Tình huống:** Người A mở sửa HĐ X (nháp chụp lại dữ liệu lúc đó), để đó 2 ngày. Trong lúc đó Người B sửa Số TK của X ở trang 27 (ghi thẳng HD_NCC). A quay lại bấm Lưu → `CAP_NHAT_HOP_DONG_` ghi **toàn bộ** trường của nháp → Số TK trở về giá trị cũ. Hai người cùng mở X ở trang 11 → cùng 1 nháp, tự lưu 700ms đè lẫn nhau.
- **Cách sửa:** lưu `phienBanGoc` (giá trị `TIMESTAMP`/hash các trường HD_NCC lúc tạo nháp) trong nháp; khi Lưu chính thức so với hiện tại — khác thì chỉ ghi các trường **người dùng đã đổi** (diff nháp gốc ↔ nháp hiện tại) hoặc báo xung đột. Hiện "Đang được sửa bởi <email> lúc <giờ>" từ cột `NGUOI_SUA` khi người thứ hai mở cùng HĐ.

### H-03 🟠 Duyệt ảnh không chống lặp và định danh theo số dòng
- **File / hàm:** `06_CreateUpdate.gs` `DUYET_ANH_RUNG_` (1588), `TU_CHOI_ANH_RUNG_` (1625), `GAN_ANH_VAO_RUNG_` (1574).
- **Tái hiện:** bấm "Duyệt" 2 lần (hoặc 2 tab) → không kiểm tra `TRANG_THAI` → **2 điểm GPS + 2 ảnh trùng** trong HD_GPS/HD_Picture. Bấm "Từ chối" một ảnh **đã duyệt** → file bị chuyển vào Thùng rác trong khi HD_Picture vẫn trỏ tới (ảnh chết). `XOA_VINH_VIEN_HOP_DONG_` xóa dòng Draft_AnhRung → mọi `soDong` đang hiện ở trang Kiểm tra lệch → duyệt/gán nhầm ảnh sang hợp đồng khác. `GAN_ANH_VAO_RUNG_` không kiểm tra `idRung` có thuộc `idHD` không.
- **Cách sửa:** dùng `ID_DRAFT` (UUID, đã có) làm khóa thay `soDong`; dưới lock: tìm dòng theo ID, chỉ duyệt khi `TRANG_THAI === 'Chờ duyệt'`, đặt `'Đã duyệt'` **trước** rồi mới ghi GPS/ảnh; từ chối chỉ khi `'Chờ duyệt'`; `ghiAnhVaoHDPicture_` phải trả lỗi khi không lấy được lock (hiện `return` im lặng rồi vẫn đánh dấu "Đã duyệt").

### H-04 🟠 Đồng bộ thanh toán 30 phút đánh dấu "đã xử lý" **trước khi** xử lý; ghi Draft kiểu xóa-rồi-ghi không khóa
- **File / hàm:** `01_ContractManager.gs` `dongBoThanhToanNeuCoThayDoi_` (825–826), `capNhatDraftHangLoat_` (502–503).
- **Nguyên nhân 1:** `DNTT_SO_DONG_LAN_TRUOC` / `DNTT_THOI_GIAN_SUA_LAN_TRUOC` được lưu trước `luuCacheBaoCao_` và `capNhatDraftHangLoat_`. Nếu lượt chạy lỗi hoặc bị Google ngắt ở phút 6 → lần sau thấy "không có gì mới" → **khối lượng thực hiện cũ mãi** cho tới khi DNTT đổi lần nữa. Lỗi chỉ ghi vào nhật ký.
- **Nguyên nhân 2:** `capNhatDraftHangLoat_` đọc toàn bộ Draft → tính → `clearContent()` → `setValues()`, không lock. Trong lúc đó người dùng lưu HĐ (`CAP_NHAT_DRAFT_MOT_HOP_DONG_` ghi 1 dòng) → bị ghi đè bằng dữ liệu cũ; nếu setValues lỗi sau clearContent → **Draft trống, mọi báo cáo trống**.
- **Cách sửa:** lưu mốc **sau** khi xong; bọc cả hàm trong `LockService.getScriptLock().tryLock(...)` (bỏ lượt nếu đang bận); ghi đè vùng bằng `setValues` đủ số dòng (đệm dòng trống) thay vì `clearContent` trước:

```javascript
const soDongCu = lastRow - 1, moi = duLieuCuoiCung;
const dem = Math.max(soDongCu, moi.length);
const vung = moi.concat(Array.from({ length: dem - moi.length }, function () { return new Array(soCot).fill(''); }));
if (dem) sh.getRange(2, 1, dem, soCot).setValues(vung); // 1 lệnh, không có khoảnh khắc "trống"
```

### H-05 🟠 Draft báo cáo có thể có 2 dòng cho 1 hợp đồng → KPI bị cộng đôi
- **File / hàm:** `01_ContractManager.gs` `CAP_NHAT_DRAFT_MOT_HOP_DONG_` (406 `appendRow` khi chưa có dòng), `16_DraftHoSoRung.gs` 81 — không lock.
- **Tái hiện:** HĐ mới vừa tạo; trong cùng giây `THEM_LO_RUNG_MOI_` và `THEM_TAI_KHOAN_MOI_` (hoặc 2 người) đều gọi `CAP_NHAT_DRAFT_MOT_HOP_DONG_` → cả hai `timDongDraftBaoCao_ = -1` → append 2 lần. Từ đó `timDongDraftBaoCao_` chỉ cập nhật dòng đầu, dòng thứ hai là bản cũ. Tổng giá trị/khối lượng ở Tổng quan, Báo cáo, Telegram **cộng cả hai dòng**.
- **Cách sửa:** upsert dưới lock ngắn; `docToanBoDraftBaoCao_` loại trùng theo `ID_HD` (giữ dòng có `CAP_NHAT_LUC` mới nhất) như lớp phòng thủ; thêm vào chẩn đoán mồ côi (28) mục "ID trùng trong Draft".

### H-06 🟠 Đăng nhập từ trang nhúng: kẻ gian lấy được phiên của nạn nhân (phishing bằng mã yêu cầu `yc`)
- **File / hàm:** `34_PhanQuyen.gs` `_trangDangNhapNhung_` (299), `nhanPhienDangNhap` (311, công khai); `PhanQuyen_JS.html` `hakDangNhapCuaSoNho_`.
- **Tái hiện:** kẻ gian tự sinh `yc` (32 hex), gửi cho nhân viên link `<Cổng>?yc=<yc>` ("đăng nhập lại hệ thống HAK"). Nhân viên mở, thấy đúng email mình, bấm "Vào hệ thống" → webapp lưu phiên của nhân viên dưới khóa `dn_yc_<yc>`. Kẻ gian gọi `nhanPhienDangNhap(yc)` (không cần đăng nhập) mỗi 2 giây → nhận **mã phiên hợp lệ 6 giờ, gia hạn tới 7 ngày**, đúng vai trò của nhân viên.
- **Cách sửa (chọn 1):** (a) cửa sổ đăng nhập hiện **mã 6 số**, khung nhúng yêu cầu người dùng gõ lại mã đó trước khi nhận phiên (ghép cặp thiết bị); (b) khung nhúng sinh `bi_mat` ngẫu nhiên, gửi `yc = SHA256(bi_mat)` lên Cổng, `nhanPhienDangNhap(bi_mat)` phải xuất trình `bi_mat` — **và** trang đích hiện rõ "Bạn đang đăng nhập cho một cửa sổ khác, chỉ tiếp tục nếu chính bạn vừa bấm Đăng nhập". Nếu webapp không nhúng ở đâu (xem T-FRAME), tắt hẳn luồng `yc`.

### H-07 🟠 ScriptCache dùng chung cho phiên đăng nhập, khóa chống trùng và **ảnh thu nhỏ 95 KB** → mất phiên, mất chống trùng
- **File:** `35_TraCuuHinhAnh.gs` `_taiAnhDrive_` (230: `cache.putAll(luu, 21600)`), `34_PhanQuyen.gs` (phiên `phien_*`), `06` (`HD_TAO_*`), `15` (`LUU_CHINH_THUC_*`).
- **Nguyên nhân:** CacheService là bộ nhớ đệm **có thể bị đẩy ra bất kỳ lúc nào** khi đầy (Google không cam kết dung lượng). Mỗi lần xem trang Hình ảnh ghi tới hàng chục giá trị gần 100 KB vào cùng ScriptCache.
- **Ảnh hưởng:** người dùng bị đăng xuất ngẫu nhiên; khóa chống bấm Lưu 2 lần (`LUU_CHINH_THUC_*`, `HD_TAO_*`) biến mất → BUG-05 (tạo 2 hợp đồng) có thể quay lại.
- **Cách sửa:** không cache ảnh trong ScriptCache (dùng `Cache-Control` của link thumbnail, hoặc DocumentCache của file báo cáo riêng); chống trùng bằng dấu trong **Sheet/PropertiesService dưới lock** (bền), không phải Cache; phiên đăng nhập nên lưu hash phiên trong 1 sheet ẩn/Properties với TTL tự kiểm.

### H-08 🟠 `appsscript.json` khác tài liệu: `access: "ANYONE"` → webhook Telegram, `?action=run`, link QR ảnh công khai đều đòi đăng nhập Google
- **File:** `appsscript.json` (đổi ở commit `b244645`, 27/09); tài liệu `04_ARCHITECTURE.md` + chú thích mã vẫn ghi `ANYONE_ANONYMOUS`.
- **Ảnh hưởng:** Telegram không đăng nhập Google được → `doPost` không bao giờ chạy (chế độ Webhook hỏng, chỉ Polling hoạt động); cron bên ngoài gọi `?action=run` bị chuyển sang trang đăng nhập; link QR "ảnh hiện trường công khai" in trên PDF (tính năng `d7cba69`, làm **sau** khi đổi manifest) đòi người quét có tài khoản Google.
- **Thêm:** `doPost` không kiểm tra `X-Telegram-Bot-Api-Secret-Token` — nếu quay lại ANONYMOUS, ai cũng POST được tin nhắn giả mạo (đốt quota Gemini, spam nhóm).
- **Cách sửa:** quyết định 1 chế độ và ghi vào tài liệu. Nếu cần ANONYMOUS: đặt `secret_token` khi `setWebhook` và kiểm tra trong `doPost`; nếu giữ ANYONE: gỡ nút "Bật webhook" ở Thiết lập, ghi rõ QR cần đăng nhập Google.

### H-09 🟠 Vai trò "Chỉ xem" vẫn lấy được đầy đủ CCCD / SĐT / Số tài khoản
- **File:** `34_PhanQuyen.gs` 402 (`layDanhSachTaiKhoan: r(..., X)`), 385–430 (các API báo cáo trả `cccdChuRung`, `sdt`...), `29_Chatbot.gs` 433 (`toanBoHopDong` kèm `cccdChuRung` gửi sang Gemini), `31_TelegramBot.gs` (mọi thành viên nhóm Telegram hỏi được).
- **Nguyên nhân:** che số chỉ làm ở `33_TraCuuHopDong.gs`. Người Chỉ xem mở DevTools gọi `hakRun_().layDanhSachTaiKhoan(idHD)`, `layDanhSachKhachHang`, hoặc hỏi chatbot "số tài khoản của ông X" → nhận số đầy đủ.
- **Ảnh hưởng:** vi phạm nguyên tắc tối thiểu quyền; rủi ro theo NĐ 13/2023 (dữ liệu CCCD + tài khoản ngân hàng).
- **Cách sửa:** 1 hàm `_cheDuLieuNhayCam_(obj)` áp dụng **ở cửa `api()`** cho mọi kết quả khi người gọi không có quyền `NHAP_LIEU` (duyệt đệ quy các khóa `cccd*`, `sdt*`, `soTK*`); chatbot chỉ gửi CCCD rút gọn cho Gemini; Telegram không trả CCCD/STK.

### H-10 🟠 "Confused deputy" trên Drive: người Nhập liệu đọc được **file bất kỳ** trong Drive của chủ script
- **File / hàm:** `35_TraCuuHinhAnh.gs` `_danhMucFileDrive_` (521), `XEM_FILE_DRIVE_` (545), `LAY_FILE_HO_SO_` (490).
- **Nguyên nhân:** danh sách file "được phép xem" lấy từ **nội dung ô** HD_Picture/HD_GPS/Draft_AnhRung/HD_RUNG. Người Nhập liệu tự ghi được các ô này (`CAP_NHAT_GPS_RUNG_` nhận `anhUrl` tùy ý, `CAP_NHAT_LO_RUNG_` nhận `dinhKemGiayTo` tùy ý).
- **Tái hiện:** ghi `https://drive.google.com/file/d/<ID file bất kỳ của chủ script>/view` vào `anhUrl` của 1 điểm GPS → `XEM_FILE_DRIVE_(id, 'tai')` trả về nội dung file (Google Sheet/Doc xuất PDF) bằng quyền chủ script. Vai trò Chỉ xem cũng xem được file đó (loại 'anh').
- **Cách sửa:** khi **ghi** link: chỉ nhận file nằm trong 4 thư mục cấu hình (kiểm `file.getParents()`), hoặc chỉ nhận file do chính hệ thống tải lên (lưu `fileId` do server trả về, không nhận URL từ client). Khi **đọc**: kiểm tra lại thư mục cha trước khi trả nội dung.

### H-11 🟠 `getReportSS_` âm thầm tạo file báo cáo MỚI (trống) khi gặp lỗi tạm thời
- **File:** `00_Config.gs` 467–486.
- **Tình huống:** Google trả lỗi tạm (quá tải, hết quota `openById`) ở cả `openById` và `openByUrl` → `SpreadsheetApp.create(...)` và **ghi đè `REPORT_SPREADSHEET_ID`**. Từ đó mọi báo cáo đọc file mới trống; cache/Draft cũ bị bỏ rơi; không ai được báo.
- **Cách sửa:** chỉ tạo file mới khi **chưa từng có** ID (lần cài đặt đầu); ngược lại ném lỗi rõ ràng "Không mở được file báo cáo — thử lại / kiểm tra quyền". Tương tự cho 4 hàm `layHoacTaoThuMuc*_` (hiện rơi về tìm theo tên — có thể lấy nhầm thư mục trùng tên).

### H-12 🟠 Hiệu năng đường ghi: 1 lần "Lưu chính thức" đọc toàn bộ sheet hàng chục đến hàng trăm lần
- **File:** `06` `THEM_LO_RUNG_MOI_`, `THEM_TAI_KHOAN_MOI_`, `CAP_NHAT_LO_RUNG_`, `CAP_NHAT_GPS_RUNG_`, `XOA_*` — mỗi hàm tự gọi `CAP_NHAT_DRAFT_MOT_HOP_DONG_` (đọc đủ HD_NCC, HD_RUNG, HD_STK, HD_Picture, HD_GPS + 2 lần đọc cả sheet `Cache_BaoCao` chứa JSON lớn) và `CAP_NHAT_DRAFT_HOSORUNG_*` (đọc HD_RUNG, HD_NCC, HD_GPS). `LUU_HOP_DONG_DAY_DU_` (nhánh sửa) còn gọi `timHopDongTheoId_` → `layAnhCuaHopDong_` → `resolveDriveLink_` **gọi Drive cho từng ảnh**.
- **Ước tính:** lưu 1 HĐ có 3 lô, 2 TK, 5 điểm GPS ≈ 11 lần `CAP_NHAT_DRAFT_MOT_HOP_DONG_` × 9 lượt đọc + 8 lượt `CAP_NHAT_DRAFT_HOSORUNG` × 3 ≈ **120 lượt đọc toàn bộ sheet**. Với 5.000 HĐ (≈ 5.000×33 ô HD_NCC, 15.000 dòng GPS) mỗi lượt 0,3–1,5 s → **40 s – 3 phút**, dễ chạm giới hạn 6 phút và **giữ ScriptLock** trong `THEM_LO_RUNG_MOI_` suốt thời gian đó (người khác nhận "Hệ thống đang bận").
- **Cách sửa:** "đơn vị công việc" — trong 1 lượt chạy chỉ ghi nhận `idHD/idRung` bẩn vào 1 Set, cuối lượt gọi `capNhatDraftHangLoat_([...])` **1 lần**; không gọi cập nhật Draft bên trong lock; `LUU_HOP_DONG_DAY_DU_` dùng `timSoDongTheoGiaTri_` thay `timHopDongTheoId_` (không cần ảnh). Giảm ≈ **90%** lượt đọc (120 → ~10).

```javascript
let _draftBan_ = null; // Set idHD cần cập nhật trong lượt chạy hiện tại
function danhDauDraftBan_(idHD) { (_draftBan_ = _draftBan_ || new Set()).add(String(idHD).trim()); }
function xaDraftBan_() { if (_draftBan_ && _draftBan_.size) capNhatDraftHangLoat_(Array.from(_draftBan_)); _draftBan_ = null; }
// Các hàm CRUD: thay CAP_NHAT_DRAFT_MOT_HOP_DONG_(id) bằng danhDauDraftBan_(id)
// api(): sau route.fn.apply(...) -> xaDraftBan_() trong finally.
```

### H-13 🟠 `XUAT_BANG_RA_FILE_` ghi **dữ liệu do trình duyệt gửi** vào 1 Google Sheet của chủ script
- **File:** `23_XuatBangRaFile.gs` 19–54 (quyền XEM).
- **Rủi ro:** (1) chuỗi bắt đầu bằng `=` được Sheets hiểu là công thức chạy dưới tài khoản chủ (`=IMPORTXML("https://…")`, `=IMAGE(…)` gọi ra ngoài); (2) không giới hạn kích thước → 1 người Chỉ xem có thể tạo file lớn liên tục (quota Drive/UrlFetch của chủ); (3) file xuất có thể bị sửa số liệu tùy ý mà vẫn mang định dạng "báo cáo hệ thống"; (4) dữ liệu tên/địa chỉ bắt đầu bằng `= + - @` thành công thức khi mở bằng Excel.
- **Cách sửa:** server tự dựng dữ liệu xuất theo tên báo cáo + bộ lọc (client chỉ gửi bộ lọc), hoặc tối thiểu: giới hạn `rows.length ≤ 20.000`, `header.length ≤ 60`, và thêm `'` trước mọi chuỗi bắt đầu bằng `= + - @`, `\t`, `\r`.

---

## 4. Lỗi MEDIUM

| ID | File / hàm (dòng) | Mô tả & tái hiện | Cách sửa |
|---|---|---|---|
| M-01 | `06` `THANH_LY_HOP_DONG_` (1991) | Chú thích nói thiếu hồ sơ **bắt buộc** thì từ chối, nhưng `boQuaCanhBaoPhu=true` bỏ qua **cả** thiếu bắt buộc. Không kiểm tra trạng thái: thanh lý được HĐ "Đã hủy", thanh lý lại HĐ đã thanh lý. `HUY_HOP_DONG_` hủy được HĐ đã thanh lý | Thiếu bắt buộc → luôn từ chối (trừ Quản trị + lý do); dùng máy trạng thái ở H-01 |
| M-02 | `06` `layDonGiaBinhQuanThang_` (235–248) | `new Date('2026-07-31')` = 07:00 giờ VN, còn `HIEU_LUC_DEN` = 00:00 → HĐ ký **đúng ngày cuối hiệu lực** không lấy được giá đó | So ngày thuần: `trongKhoangNgay_(ngayKy, ngayToISO_(tu), ngayToISO_(den))` |
| M-03 | `14` + `01` | Phụ lục (thêm khối lượng / đổi đơn giá) **không đi vào** KL dự kiến, giá trị HĐ, KL còn lại ở Draft báo cáo, cũng không vào cột Z của HD_NCC (app Thanh toán) → báo cáo "vượt khối lượng" sai sau khi ký phụ lục | Xác nhận quy tắc nghiệp vụ; nếu phụ lục cộng thêm → đưa tổng phụ lục vào `tinhDongDraftChoHopDong_` và `tinhTongHopLoRung_` |
| M-04 | `14` `layPhieuCanTheoChuRung_` (376) | So tên 2 chiều `kh.indexOf(ten) \|\| ten.indexOf(kh)` → "Lê Văn A" khớp "Lê Văn Anh", khách tên ngắn khớp hàng loạt; phụ lục lập theo phiếu cân của người khác | Khớp theo CCCD/ID_HD nếu PhieuCan có; nếu chỉ có tên: khớp **toàn bộ** tên đã chuẩn hóa |
| M-05 | `06` 617 | `MA_RUNG = 'HAK' + CCCD + '_' + stt` — cùng chủ rừng 2 HĐ → cùng `HAK<CCCD>_1`. `KIEM_TRA_HO_SO_TOAN_BO_` (02:185–220) dùng MaRung làm khóa → 2 lô ghi chung 1 dòng, 1 lô biến mất khỏi báo cáo kiểm tra | Khóa báo cáo theo `ID_RUNG`; ghi rõ MaRung không duy nhất |
| M-06 | `06` 641 `THEM_LO_RUNG_MOI_` | `appendRow` vào HD_RUNG: cột CCCD, SO_HD mất số 0 đầu nếu vùng chưa được định dạng TEXT (chỉ đúng khi đã chạy menu định dạng và còn trong `SO_DONG_DU_PHONG` dòng) — cùng lớp lỗi BUG-03 | Định dạng `@` rồi `setValues` như `TAO_HOP_DONG_MOI_` |
| M-07 | `06` `XOA_VINH_VIEN_HOP_DONG_` (1145) | Còn sót: PhuLucHopDong, ct_hopdong, Draft_HopDong, Draft_HoSoRung, HD_Picture lưu theo ID_RUNG, file Drive; không có bản lưu để khôi phục; `deleteRow` từng dòng (chậm) | Chuyển các dòng sang sheet `ARCHIVE_*` kèm thời điểm/người xóa rồi xóa bằng ghi lại vùng (1 lệnh/sheet); dọn đủ 6 bảng dẫn xuất |
| M-08 | `31` Polling (75) | Trigger 1 phút không lock: lượt trước chưa xong, lượt sau đọc cùng `offset` → trả lời 2 lần; offset chỉ lưu cuối hàm. Trigger 1 phút × 1.440 lượt/ngày ăn quota **90 phút/ngày** thời gian trigger của tài khoản Gmail thường | `tryLock`, lưu offset sau mỗi tin; ưu tiên webhook (sửa H-08) hoặc giãn 5 phút |
| M-09 | `01` `xuLyOnEditDraft_` (704) | Dán 500 dòng → 500–1.500 lệnh `getValue` + N lần `CAP_NHAT_DRAFT_*`; lỗi bị nuốt hoàn toàn (`catch {}`); **xóa dòng tay không kích hoạt onEdit** → Draft giữ HĐ đã xóa | Đọc cả vùng 1 lần; gom id → `capNhatDraftHangLoat_`; `log_` lỗi; thêm trigger `onChange` cho REMOVE_ROW |
| M-10 | `01` `XAY_DUNG_LAI_TOAN_BO_DRAFT_` (578) | Chạy dở dang: Draft đã bị xóa sạch → báo cáo trống giữa 2 lượt; tiếp tục theo **chỉ số dòng** — thêm/xóa HĐ giữa 2 lượt làm sót/trùng | Xây vào sheet tạm rồi đổi tên/ghi đè 1 lần; tiếp tục theo `ID_HD` đã xử lý |
| M-11 | `00` `luuCacheBaoCao_` (803), `ghiNhatKy_` (699) | Xóa cache bằng `deleteRow` từng dòng, không lock → 2 lượt ghi song song để lại 2 bản → JSON ghép hỏng → tính lại mỗi lần. `NhatKy_SuaDoi` tăng vô hạn; `LAM_MOI_DRAFT_THEO_THAY_DOI_`, `LAY_NHAT_KY_THEO_NGAY_` đọc **toàn bộ** nhật ký | Lock + ghi vùng; tách nhật ký theo tháng/lưu trữ định kỳ; đọc từ cuối lên (dòng mới nhất) |
| M-12 | `06` `resolveDriveLink_` (1658–1664), `02`:121, `03`:25/229, `04`:140 | Giá trị không phải URL → `DriveApp.getFilesByName` tìm **cả Drive** của chủ → chậm, trả nhầm file cùng tên ở thư mục khác (có thể là file không liên quan) | Chỉ tìm trong thư mục cấu hình (`folder.getFilesByName`); chạy menu chuyển sang URL (20) rồi bỏ nhánh này |
| M-13 | `35` link ảnh công khai (276–365) | Không hết hạn, không thu hồi từng HĐ (chỉ thu hồi tất cả bằng đổi khóa); hàm công khai `ANH_CONG_KHAI` gọi Drive/UrlFetch không giới hạn tần suất → đốt quota 20.000 UrlFetch/ngày | Nhúng `exp` vào chữ ký; danh sách thu hồi theo HĐ; giới hạn N lượt/phút/HĐ bằng Cache đếm |
| M-14 | `02` `KIEM_TRA_HO_SO_TOAN_BO_` (197–207) | Mỗi lô 1–3 lệnh ghi (`setValues`+`setBackground` hoặc `appendRow`) → 10.000 lô ≈ 20–30 nghìn lệnh → quá 6 phút | Dựng mảng giá trị + mảng màu, ghi 2 lệnh |
| M-15 | `06` `dongBoDiaChiTuRung_` (296) | Không lock → 2 lượt tạo cùng HĐ append 2 dòng DM_DIACHI; mỗi trường 1 `setValue` | Upsert trong lock, 1 `setValues` |
| M-16 | `05_Menu.gs` `HIEN_HUONG_DAN_SU_DUNG` | `createHtmlOutputFromFile('13_HuongDan')` trên file có 11 scriptlet `<?= … ?>` → hộp thoại trong Sheet hiện nguyên văn `<?= baseUrl ?>`, link hỏng | `createTemplateFromFile(...).evaluate()` và gán `baseUrl`, `currentPage` |
| M-17 | `06` `TAO_HOP_DONG_MOI_` (509–517) | Bỏ qua kết quả `THEM_LO_RUNG_MOI_` / `THEM_TAI_KHOAN_MOI_` → lock bận thì HĐ được tạo **không có lô rừng/TK** mà vẫn báo thành công | Gom lỗi vào `canhBao` trả về client |
| M-18 | Toàn bộ `setValue` văn bản tự do | Formula injection (đã ghi nhận ở 02_SECURITY_REPORT, nay có thêm đường H-13) | Hàm chung `giaTriAnToan_(v)` thêm `'` cho chuỗi bắt đầu `= + - @` — áp dụng trong 1 chỗ ghi chung (xem kiến trúc mới) |

## 5. Lỗi LOW

| ID | File | Mô tả | Cách sửa |
|---|---|---|---|
| L-01 | `05_Menu.gs` 83 | `include(filename)` công khai — ai có URL cũng đọc nguyên văn mọi file HTML (lộ cấu trúc, không lộ dữ liệu) | Đổi tên `include_` và dùng `<?!= include_('x') ?>` |
| L-02 | `01`:43, `18` | Sắp xếp `(b.soHD || 0) - (a.soHD || 0)` — Số HĐ có chữ → `NaN` → thứ tự lộn xộn | `localeCompare(..., {numeric:true})` |
| L-03 | `07`:469–475, `11`:652–660 | Form vẫn dùng `new Date(x).toISOString().split('T')[0]` — đúng chỉ vì server trả `yyyy-MM-dd`; server đổi định dạng là lùi ngày lại | Gán thẳng chuỗi `yyyy-MM-dd` |
| L-04 | `10`:854, 1016 | Tên file xuất theo ngày UTC (BUG-13 còn mở) | Ngày địa phương |
| L-05 | `06`:1415, `29`:118 | Khóa Gemini nằm trong query string (dễ lọt vào log) | Header `x-goog-api-key` |
| L-06 | `06`:954 | `layDanhSachRung_` dùng múi giờ **script**, nơi khác dùng múi giờ **bảng tính** | `ngayToISO_` |
| L-07 | `34` | `dangXuat` không hủy các mã phiên đã gia hạn ở tab khác; "Tạo lại mã bí mật" không vô hiệu phiên đang có | Lưu `phienGoc` chung, hủy theo nhóm |
| L-08 | `PhanQuyen_JS` 216 | Chờ đăng nhập hỏi server 2,5 s/lần tới 10 phút (240 lượt thực thi) | 5 s và dừng khi cửa sổ đóng (`cuaSo.closed`) |
| L-09 | `32`:36–41 | Nhận diện ngân hàng bằng chuỗi con 2 chiều → có thể chọn nhầm ngân hàng → "tên không khớp" sai | Ưu tiên khớp `code`/`bin` chính xác, rồi `shortName` chính xác |
| L-10 | `35`:276 | `_khoaAnhCongKhai_` tạo khóa không lock — 2 lượt đầu tiên song song tạo 2 khóa, link in ra từ lượt thua bị vô hiệu | Tạo trong lock |
| L-11 | `Webhook_dntt.gs` | `WEBHOOK_SECRET` trong repo công khai (đã ghi nhận T-REPO-PUBLIC) | Script Properties |
| L-12 | `06`:27 | `soHopDongTuDong_` đọc cả HD_NCC mỗi lần tạo | Lưu bộ đếm theo ngày trong Properties (dưới lock) |

---

## 6. Danh sách dữ liệu có nguy cơ trùng

| Khóa | Cách sinh | Trùng khi | Mức | Chống trùng đề xuất |
|---|---|---|---|---|
| `HD_NCC.SO_HD` | tay hoặc `yyyyMMdd+STT` | Gõ tay trùng / đánh số lại hằng năm — **không kiểm tra** | 🔴 | Kiểm tra dưới lock (C-03) |
| `ID_HD` = `SoHD-yyyyMMdd` | ghép | 2 HĐ cùng số cùng ngày | 🟠 | Như trên + kiểm tra ID trước khi ghi |
| `ID_RUNG` = `HAK<SoHD>_<stt>` | stt theo từng HĐ | Số HĐ trùng giữa 2 HĐ | 🔴 | Sinh từ `ID_HD` (C-03) |
| `MA_RUNG` = `HAK<CCCD>_<stt>` | stt theo từng HĐ | Cùng chủ rừng ≥ 2 HĐ (**chắc chắn trùng**) | 🟡 | Không dùng làm khóa (M-05) |
| `ID_STK` = `ID_HD` | — | Mọi HĐ nhiều TK (không phải khóa) | 🔴 | Thêm `ID_DONG` (C-01) |
| `ID_GPS` = `SoHD-yyyyMMdd` | — | Mọi điểm của 1 HĐ (không phải khóa) | ⚪ | Không dùng làm khóa |
| `ID_PICTURE` = `ID_HD` | — | Mọi dòng ảnh của 1 HĐ | ⚪ | — |
| `ID_PHU_LUC` = `PL_<ID_HD>_<lần>` | max+1 trong lock | An toàn khi tạo; **sửa/xóa lại theo số dòng** | 🔴 | Dùng `ID_PHU_LUC` làm khóa (C-01) |
| `DRAFT_<ID_HD>` | cố định | 2 người cùng sửa 1 HĐ dùng chung nháp | 🟠 | H-02 |
| `DRAFT_` + 8 ký tự UUID | ngẫu nhiên | Xác suất ~1/4 tỷ mỗi cặp — chấp nhận được | ⚪ | Dùng UUID đủ 32 ký tự |
| Dòng `Draft_BaoCaoHopDong` | append khi chưa có | Ghi đồng thời (H-05) | 🟠 | Upsert trong lock |
| Dòng `Draft_HoSoRung`, `ct_hopdong`, `DM_DIACHI` | append khi chưa có | Ghi đồng thời | 🟡 | Upsert trong lock |
| Điểm GPS / ảnh khi Duyệt ảnh | append | Bấm Duyệt 2 lần (H-03) | 🟠 | Kiểm tra trạng thái trong lock |
| Điểm GPS nhập tay | append | Gửi lại điểm (mạng lỗi, bấm lại) — không có khóa | 🟡 | Bỏ qua điểm trùng `(idRung, lat, lng)` trong 60 s |
| Hợp đồng mới | `maThaoTac` trong **ScriptCache** 6 h | Cache bị đẩy ra (H-07) → mất chống trùng | 🟠 | Ghi `maThaoTac` vào cột ẩn của HD_NCC / Properties |
| Phiếu Telegram trả lời | offset | 2 lượt polling chồng (M-08) | ⚪ | tryLock |
| Nhật ký `NhatKy_SuaDoi` | appendRow | Không trùng nhưng tăng vô hạn | 🟡 | Lưu trữ theo tháng |

**Cơ chế chống trùng tổng quát đề xuất:** (1) mọi khóa nghiệp vụ sinh **trong ScriptLock** và kiểm tra tồn tại ngay trước khi ghi; (2) mọi thao tác ghi từ client mang `maThaoTac` (UUID) và server ghi nhận bền (Sheet/Properties), không chỉ ScriptCache; (3) nút gửi bị khóa tới khi có phản hồi (đã có ở 07/11/27 cho Lưu HĐ — **chưa có** cho Duyệt ảnh, Thêm GPS, Thêm/Xóa TK ở trang 27, Duyệt hàng loạt).

## 7. Danh sách code dư thừa

| Loại | Vị trí | Ghi chú |
|---|---|---|
| Hàm trùng logic "đọc DMS/DD → lat/lng" | `Code.gs getLatLngFromRow_`, `00 layCoAnhVaGpsTrucTiep_`, `01 tinhDongDraftChoHopDong_`, `06 layGPSCuaRung_`, `16 XAY_DUNG_LAI_DRAFT_HOSORUNG_` | 5 bản — gom về `getLatLngFromRow_` |
| `boDauTV` / `boDauTiengViet_` / `boDau_` | `06` ×3, `14`, `29`, `32` | 6 bản — 1 hàm chung ở `00_Config` |
| Dựng dòng HD_NCC mới | `TAO_HOP_DONG_MOI_` (458–502) và `LUU_HOP_DONG_DAY_DU_` (2081–2127) | 2 bản gần giống hệt — đúng loại "vá bản này quên bản kia" đã gây BUG-03. Gom thành `_dungDongHopDongMoi_(d)` |
| Tính "có ảnh" | `CAP_NHAT_DRAFT_MOT_HOP_DONG_` (chỉ ID_HD), `capNhatDraftHangLoat_`, `layCoAnhVaGpsTrucTiep_` (ID_HD **và** ID_RUNG) | Kết quả khác nhau → lớp đọc phải ghi đè (00:525–531). Gom 1 hàm |
| `layTongHopChoWebapp_`, `layTinhHinhThucHien_`, `layDanhSachThanhLy_`, `layBaoCaoHopDongPhanTrang_` | `01`, `06`, `02` | Trùng khối lượng lớn với `TAI_TRANG_BAO_CAO_TONG_HOP_` (18). Kiểm tra trang nào còn gọi, bỏ bản thừa |
| `thongBao_` ×4, `showMsg` ×3 | trang HTML | Đã ghi ở 09_TODO R2 |
| Nhánh tìm file theo tên | `resolveDriveLink_`, `02`, `03`, `04` | Sau khi chạy menu chuyển URL (20) có thể bỏ |
| Nút/hàm Webhook Telegram | `31 BAT_WEBHOOK_*`, `doPost` | Không hoạt động với manifest hiện tại (H-08) |
| Mã tự vá lịch sử | Rất nhiều chú thích "⚠️ ĐÃ SỬA/TRƯỚC ĐÂY" dài 5–15 dòng | Chuyển sang CHANGELOG, giữ mã gọn (2.432/11.805 dòng `.gs` ≈ 21% là dòng chú thích, phần lớn là lịch sử sửa lỗi) |
| CSS không dùng | Chưa xác định chắc (class ghép động) | Giữ nguyên như đánh giá trước |

## 8. Danh sách hàm cần refactor

| Hàm | File | Lý do | Hướng |
|---|---|---|---|
| `LUU_HOP_DONG_DAY_DU_` (166 dòng) | 06 | Tạo + sửa + rừng + TK trong 1 hàm, định danh theo dòng | Tách `taoHopDong_`, `suaHopDong_`, `dongBoLoRung_`, `dongBoTaiKhoan_` |
| `CAP_NHAT_HOP_DONG_` | 06 | Ghi từng ô (tới 26 `setValue` + 6 `setNumberFormat`), không kiểm ID, không nhật ký | 1 `getValues` dòng → sửa mảng → 1 `setValues`; kiểm ID; nhật ký diff |
| `CAP_NHAT_LO_RUNG_`, `CAP_NHAT_TAI_KHOAN_`, `LUU_PHU_LUC_` | 06, 14 | Như trên | Như trên |
| `luuChinhThucThucThi_` | 15 | Điều phối nhiều hàm tự khóa/tự cập nhật Draft | Gom thành 1 "unit of work" (H-12) |
| `timHopDongTheoId_` | 06 | 4 tầng tìm + tải ảnh/hồ sơ qua Drive — dùng cả trong đường ghi | Tách `timSoDongHopDong_(id)` (nhẹ) và `layChiTietHopDong_(id)` (nặng) |
| `xuLyOnEditDraft_` | 01 | Đọc từng ô trong vòng lặp | Đọc cả vùng |
| `timNguCanhChatbot_` (169 dòng) | 29 | Hàm dài nhất, gửi toàn bộ HĐ | Tách + giới hạn ngữ cảnh |
| `TAI_TRANG_BAO_CAO_TONG_HOP_` | 18 | Trả `chiTiet` toàn bộ HĐ (không phân trang) cho 2 tab | Phân trang cả 4 khối |
| `DUYET_ANH_RUNG_` / `TU_CHOI_ANH_RUNG_` | 06 | H-03 | Khóa theo `ID_DRAFT` + trạng thái |
| `getReportSS_`, `layHoacTaoThuMuc*_` | 00, 06, 22 | H-11 | Không tự tạo khi đã cấu hình |
| `KIEM_TRA_HO_SO_TOAN_BO_` | 02 | M-14 | Ghi mảng |

---

## 9. Đề xuất tối ưu hiệu năng (ước lượng lợi ích)

| # | Việc | Hiện tại | Sau tối ưu | Lợi ích ước tính |
|---|---|---|---|---|
| P-01 | Unit of work cho Draft (H-12) | ~120 lượt đọc cả sheet / 1 lần Lưu | ~10 | −90% lượt gọi SpreadsheetApp; lock giữ < 2 s thay vì 30 s–3 phút |
| P-02 | `CAP_NHAT_DRAFT_MOT_HOP_DONG_` đọc `Cache_BaoCao` (2 × `getDataRange` chứa JSON hàng trăm KB) | 2 lượt đọc lớn / lần gọi | Nhớ đệm trong lượt chạy (biến toàn cục) | −2 lượt đọc/lần, giảm ~0,5–2 s mỗi lần lưu |
| P-03 | Ghi theo dòng thay vì theo ô (`CAP_NHAT_HOP_DONG_`, `CAP_NHAT_LO_RUNG_`, `CAP_NHAT_TAI_KHOAN_`, `LUU_PHU_LUC_`, `dongBoDiaChiTuRung_`) | 5–32 lệnh / lần sửa | 2 lệnh | −80–95% lệnh ghi |
| P-04 | Xóa nhiều dòng (`XOA_VINH_VIEN`, `XOA_LO_RUNG_` GPS, `CAP_NHAT_GPS_RUNG_` ghi đè, `luuCacheBaoCao_`) | 1 `deleteRow`/dòng (mỗi lệnh 0,2–1 s và làm Sheets tính lại) | Lọc mảng → ghi lại vùng + `deleteRows` phần thừa ở cuối | Lô có 50 điểm GPS: ~20 s → < 1 s |
| P-05 | `layAnhCuaHopDong_` đọc HD_Picture 1 lần/định danh + gọi Drive từng ảnh | (1+số lô) lượt đọc + N lượt Drive | 1 lượt đọc, không gọi Drive khi ô đã là URL (dùng tên đã lưu) | −90% thời gian mở chi tiết HĐ |
| P-06 | `_danhMucFileDrive_` đọc 4 sheet cho **mỗi** lần bấm xem file | 4 lượt đọc/lần xem | Cache 5 phút (DocumentCache) hoặc kiểm thư mục cha | −4 lượt đọc/lần |
| P-07 | `TAI_TRANG_BAO_CAO_TONG_HOP_` trả toàn bộ `chiTiet` | O(N) dữ liệu qua `google.script.run` | Phân trang mọi khối | 10.000 HĐ: ~6–10 MB → < 100 KB |
| P-08 | Chatbot gửi `toanBoHopDong` | O(N) token Gemini/câu hỏi | Chỉ gửi thống kê + HĐ khớp | −95% token, tránh vượt giới hạn ngữ cảnh ở vài nghìn HĐ |
| P-09 | Đọc theo cột cần dùng | `readData_` luôn đọc `getLastColumn()` (HD_NCC 33 cột) | Đọc đúng dải cột cần (vd chỉ `ID_HD`) | −60–90% ô đọc ở các phép tìm |
| P-10 | Chỉ mục ID trong bộ nhớ lượt chạy | Mỗi hàm tự quét cả sheet để tìm 1 ID | `_chiMuc_(sheet, cot)` nhớ trong lượt chạy, xóa khi có ghi | Hàm gọi nhiều lần trong 1 lượt: O(N²) → O(N) |
| P-11 | Trigger | Telegram polling 1 phút + đồng bộ 30 phút + chuyển URL 6 giờ + onEdit | Webhook (hoặc 5 phút) + đồng bộ có lock | Giảm ~60–80% quota "trigger runtime 90 phút/ngày" |

**LockService:** hiện giữ ScriptLock trong lúc tính Draft (THEM_LO_RUNG_MOI_). Chỉ giữ lock quanh "đọc số tiếp theo → ghi dòng", mọi tính toán dẫn xuất làm **sau** khi nhả lock.
**CacheService:** dành riêng cho dữ liệu tạm có thể mất (bản đồ, danh sách ngân hàng). Không dùng cho phiên, khóa chống trùng, ảnh lớn (H-07).
**`flush()`:** chỉ cần trước khi xuất file (đã đúng ở 23/22); không cần rải trong vòng lặp.

## 10. Kiểm thử tải — ước tính 100 → 500.000 dòng

> Ước tính cho **HD_NCC = N dòng**, HD_RUNG ≈ 1,5N, HD_GPS ≈ 5N, HD_STK ≈ 1,2N. Thời gian `getValues` lấy xấp xỉ 1–3 µs/ô (thực tế Apps Script: 100k ô ≈ 0,1–0,3 s, dao động theo tải máy chủ). **Chưa đo trên project thật.**

| N (HĐ) | Ô HD_NCC (33 cột) | Tổng ô 5 sheet chính | Mở Tổng quan (đọc Draft 31 cột + 3 sheet trực tiếp) | 1 lần Lưu chính thức (hiện tại) | Sau P-01…P-05 | Giới hạn chạm phải |
|---:|---:|---:|---|---|---|---|
| 100 | 3.300 | ~9 nghìn | < 1 s | 3–8 s | < 2 s | — |
| 1.000 | 33.000 | ~90 nghìn | 1–2 s | 10–25 s | 2–4 s | — |
| 10.000 | 330.000 | ~0,9 triệu | 4–10 s | 1,5–5 phút ⚠️ | 5–10 s | Lock chờ 15 s → "Hệ thống bận"; trigger 30 phút sát 6 phút |
| 50.000 | 1,65 triệu | ~4,5 triệu | 20–60 s ⚠️ | **Quá 6 phút** ❌ | 20–40 s | Phản hồi `google.script.run` vài chục MB ❌; bộ nhớ lượt chạy |
| 100.000 | 3,3 triệu | ~9 triệu | **Quá giới hạn** ❌ | ❌ | ❌ | Gần **10 triệu ô/bảng tính** (giới hạn cứng của Google Sheets) |
| 200.000 | 6,6 triệu | ~18 triệu | ❌ | ❌ | ❌ | **Vượt 10 triệu ô** — không lưu được trong 1 file |
| 500.000 | 16,5 triệu | ~45 triệu | ❌ | ❌ | ❌ | Vượt giới hạn ô chỉ riêng HD_NCC |

**Quota tài khoản Gmail thường (chủ script — vì `executeAs: USER_DEPLOYING`, MỌI người dùng tiêu quota của chủ):** 6 phút/lượt chạy · 30 lượt chạy đồng thời · 90 phút/ngày cho trigger · 20.000 lệnh UrlFetch/ngày · CacheService 100 KB/giá trị, 6 giờ tối đa · Properties 500 KB tổng. Với 20 người dùng đồng thời + polling Telegram + trang Hình ảnh (fetchAll), giới hạn **30 lượt đồng thời** và **20.000 UrlFetch/ngày** là điểm nghẽn thực tế trước cả số dòng.

**Kết luận mở rộng:** kiến trúc Google Sheet hiện tại phù hợp tới **~5.000–10.000 hợp đồng** sau khi làm P-01…P-07. Vượt mức đó: (a) tách dữ liệu theo năm (mỗi năm 1 file, HĐ đã thanh lý chuyển sang file lưu trữ); hoặc (b) chuyển lớp dữ liệu sang Cloud SQL / Firestore / BigQuery, giữ Sheet làm giao diện nhập tay & báo cáo.

---

## 11. Luồng dữ liệu, đồng bộ & điểm nghẽn (Phần 3–4)

```
[HTML form] --hakRun_--> [google.script.run.api] --(1)--> [api(): _docPhien_ + _vaiTroCua_]
      (ScriptCache phien_*, cache người dùng 60s)                        |
                                                                        v
        ┌──────────────────── Hàm ghi (06/14/15) ───────────────────────┐
        │  LockService (chỉ ở vài hàm)   (2) ghi từng ô / appendRow      │
        │  → HD_NCC / HD_RUNG / HD_STK / HD_GPS / PhuLuc                 │
        │  (3) CAP_NHAT_DRAFT_* gọi N lần, mỗi lần đọc 5–7 sheet  ⛔ NGHẼN │
        └───────────────┬───────────────────────────────────────────────┘
                        v
   [Sheet báo cáo riêng: Draft_BaoCaoHopDong / Draft_HoSoRung / Cache_BaoCao]
           ^                          ^
           | (4) trigger 30' DNTT     | (5) onEdit (sửa tay)
[DNTT_GK_DN_CT, PhieuCan_DN] (file ngoài)
                        |
                        v
[Tổng quan/Báo cáo/Thanh lý/Telegram đọc Draft]   [Tra cứu/27/Nhập liệu đọc HD_NCC trực tiếp]
                        |  (6) JSON cả danh sách ⛔           |
                        v                                   v
                   [render innerHTML đã escape]      [render]
```
⛔ Điểm nghẽn: (3) cập nhật Draft trong đường ghi (H-12); (6) trả toàn bộ danh sách (P-07); (1) giới hạn 30 lượt chạy đồng thời dưới tài khoản chủ.

**Hai nguồn dữ liệu cho cùng một khái niệm (nguy cơ lệch):**

| Khái niệm | Nguồn A | Nguồn B | Lệch khi |
|---|---|---|---|
| Tình trạng HĐ | HD_NCC (Tra cứu, 27, Nhập liệu) | Draft (Tổng quan, Báo cáo, Telegram, Thanh lý) | Duyệt/Hủy ở 27 (H-01) — **lệch vĩnh viễn** |
| KL dự kiến | Tổng lô rừng (Draft báo cáo) | HD_NCC cột Z (app Thanh toán ĐNTT) | HĐ "Đang thực hiện" sửa lô rừng (Z giữ số cũ theo quy tắc); phụ lục (M-03) |
| KL thực hiện | DNTT theo **Số HĐ** | Cột KHOI_LUONG_THUC_HIEN của HD_RUNG (khi không khớp DNTT) | Số HĐ trùng / bị đổi (C-03) |
| Ngày ký lô rừng | HD_RUNG.NGAY_KY | HD_NCC.NGAY_KY | Sửa ngày ký HĐ (C-03) |
| Có ảnh / GPS | Draft (chỉ ID_HD) | Đọc trực tiếp (ID_HD + ID_RUNG) | Đã có lớp ghi đè lúc đọc — tốn 3 lượt đọc mỗi lần (P) |
| Danh sách người dùng | Sheet SYS_NguoiDung | Cache 60 s | Khóa tài khoản có hiệu lực sau ≤ 60 s — chấp nhận được |

**Race condition đã xác định:** C-01, C-02 (TOCTOU theo dòng), H-02 (lost update nháp), H-04 (trigger ↔ người dùng), H-05 (append Draft), M-08 (polling), M-11 (cache báo cáo), M-15 (DM_DIACHI). **Cache cũ:** bản đồ 15 phút (đã xóa đúng chỗ), danh sách người dùng 60 s, ảnh 6 giờ (ảnh đã thay vẫn hiện bản cũ tới 6 giờ).

## 12. Đề xuất nâng cấp giao diện (Phần 10–11)

- **Trạng thái đang xử lý:** mọi nút gọi server (Duyệt ảnh, Thêm GPS, Thêm/Xóa TK trang 27, Duyệt hàng loạt, Xuất file) phải `disabled` + spinner tới khi có phản hồi — hiện chỉ nút Lưu HĐ có. Một helper chung: `chayVoiNut_(nut, hakRun_().X(...))`.
- **Xung đột dữ liệu:** khi server trả "Hợp đồng đã thay đổi" (sau khi sửa C-02/H-02) → hộp thoại "Tải lại / So sánh", không phải toast đỏ.
- **Hộp thoại xác nhận:** thay 22 `confirm()`/`prompt()` gốc của trình duyệt (bị chặn trong iframe ở một số trình duyệt di động, không tùy biến được) bằng modal thống nhất.
- **Bảng dữ liệu:** header cố định, cột số canh phải (đã có ở PDF), phân trang phía server cho mọi bảng (P-07), lưu bộ lọc/trang/cột sắp xếp vào `localStorage` theo từng trang (per-viewer, không nhạy cảm).
- **Dark mode:** hiện các trang định nghĩa màu trực tiếp; gom về biến CSS `:root` + `@media (prefers-color-scheme: dark)`.
- **Truy cập:** 169 nhãn chưa gắn `for` (đã ghi ở 09_TODO), nút chỉ có biểu tượng thiếu `aria-label`, phần lớn modal thiếu bẫy focus; chỉ 10, 35 và PhanQuyen_JS đóng được bằng Esc.
- **Responsive:** viewport meta đã có; cần kiểm tra thực tế trên iOS Safari (iframe `googleusercontent` chặn cookie/`localStorage` bên thứ ba → đã có đường `?ph=`, nhưng mã phiên nằm trên URL — xem 02_SECURITY). Leaflet trên di động: bật `tap` và cỡ nút ≥ 44px.
- **Trình duyệt:** `Proxy` (PhanQuyen_JS) và `Object.values`, `Array.from`, `closest` — cần Chrome/Edge/Firefox/Safari hiện đại; IE11 không chạy (chấp nhận được, nên ghi rõ yêu cầu tối thiểu).

## 13. Đề xuất nâng cấp bảo mật (Phần 14–15)

| # | Việc | Liên quan |
|---|---|---|
| S-1 | Sửa luồng `yc` (H-06) | Chiếm phiên |
| S-2 | Che dữ liệu nhạy cảm tại cửa `api()` theo vai trò (H-09) | NĐ 13/2023 |
| S-3 | Chỉ nhận link Drive thuộc thư mục hệ thống (H-10) | Đọc file tùy ý |
| S-4 | Xuất file do server dựng + chặn công thức (H-13, M-18) | Formula injection |
| S-5 | Quyết định `access` + `secret_token` Telegram (H-08) | Giả mạo webhook |
| S-6 | Không để khóa bảo mật trong ScriptCache (H-07) | Mất chống trùng |
| S-7 | Tách quyền Duyệt khỏi Nhập liệu; máy trạng thái (H-01) | Tách biệt nhiệm vụ |
| S-8 | `X-Frame-Options: DEFAULT` nếu không nhúng (T-FRAME cũ) | Clickjacking |
| S-9 | Repo về Private, chuyển `WEBHOOK_SECRET` vào Properties (L-11) | Lộ bí mật |
| S-10 | `localStorage` giữ mã phiên: chấp nhận được với phiên 6 giờ nếu không có XSS; đã escape toàn bộ `innerHTML` (đợt trước). **Không** lưu dữ liệu hợp đồng/CCCD/nháp vào `localStorage` (hiện không lưu — giữ nguyên). Có thể lưu: bộ lọc, trang, chủ đề, độ rộng cột | Phần 15 |
| S-11 | Nhật ký thay đổi dạng "trường: cũ → mới" cho **mọi** hàm ghi (hiện chỉ một số hàm, không có diff) | Phần 17 |

**Phần 17 — Log/Audit/Rollback:** hiện `NhatKy_SuaDoi` ghi *ai – hành động – ID_HD – mô tả*, nhưng: thiếu với `CAP_NHAT_HOP_DONG_` trực tiếp (H-01), `XOA_TAI_KHOAN_`, `XOA_LO_RUNG_` qua api, `CAP_NHAT_LO_RUNG_`, `CAP_NHAT_TAI_KHOAN_`, `GAN_ANH_VAO_RUNG_`, `TU_CHOI_ANH_RUNG_`; không lưu giá trị cũ → **không rollback được**. Đề xuất sheet `NhatKy_ChiTiet` (thời gian, email, sheet, khóa dòng, cột, cũ, mới, mã thao tác) ghi từ 1 hàm ghi dùng chung; xóa = chuyển sang `ARCHIVE_*`.

## 14. Đề xuất kiến trúc mới (Phần 1, 19, 20)

1. **Tầng Repository theo sheet** — `Repo('HD_NCC')` đọc tiêu đề 1 lần, ánh xạ **tên cột → chỉ số** (thay `*_COL` theo vị trí; MAP-001 trở thành tự nhiên), có `findByKey`, `upsert`, `updateFields(key, patch, expectedVersion)`, `deleteByKey` → mọi ghi đi qua 1 chỗ: kiểm khóa, định dạng TEXT, chặn công thức, nhật ký diff, đánh dấu Draft bẩn.
2. **Khóa bất biến cho mọi bảng con** (`ID_DONG` UUID) — bỏ hoàn toàn `soDong` khỏi API công khai (C-01, C-02, H-03).
3. **Unit of Work** trong `api()`: gom Draft bẩn, cập nhật 1 lần cuối lượt (H-12); lock chỉ quanh sinh khóa + ghi.
4. **Phiên bản dòng** (`CAP_NHAT_LUC` hoặc số phiên bản) để phát hiện xung đột (H-02).
5. **Máy trạng thái hợp đồng** tập trung (H-01, M-01).
6. **Tách file theo tầng** khi chuyển sang `clasp` (R6 cũ): `repo/`, `service/`, `api/`, `report/`, `integration/` — Apps Script vẫn phẳng nhưng tiền tố tên file thể hiện tầng.
7. **CI:** `clasp` + GitHub Actions chạy ESLint + bộ test giả lập (bộ giả lập của đợt QA trước) cho mọi PR; chặn merge khi test đỏ.
8. **Mở rộng dữ liệu:** tách file theo năm + file lưu trữ HĐ thanh lý; khi > 10.000 HĐ, đánh giá chuyển sang CSDL thật (Phần 10).

**Google Sheet như CSDL (Phần 20):** không index (mỗi tìm kiếm = quét cả sheet → dùng chỉ mục trong lượt chạy P-10), không transaction (ghi nhiều sheet không nguyên tử → ghi tiến độ như `LUU_CHINH_THUC_` đã làm, mở rộng cho mọi thao tác nhiều bước), không khóa ngoại (xóa để lại mồ côi → M-07 + chẩn đoán 28), dữ liệu khách hàng **không chuẩn hóa** (thông tin cá nhân lặp trên mỗi HĐ — chấp nhận, nhưng khi sửa CCCD/tên ở 1 HĐ, các HĐ khác cùng khách không đổi; nếu cần "khách hàng" là thực thể thì tách bảng KH theo CCCD).

---

## 15. Danh sách TODO theo mức ưu tiên

### 🔴 Critical — làm trước khi phát hành
- [ ] C-01 Khóa bất biến cho HD_STK/PhuLuc; tạm thời kiểm tra chéo `ID_HD` + giá trị gốc trước mọi sửa/xóa theo dòng
- [ ] C-02 Mọi API ghi theo dòng xác minh `ID_HD`; `LUU_HOP_DONG_DAY_DU_` không được đổi `idHD`
- [ ] C-03 Kiểm tra trùng Số HĐ; `ID_RUNG` mới sinh từ `ID_HD`; khóa/lan truyền sửa Số HĐ – Ngày ký; chạy chẩn đoán trùng dữ liệu hiện có
- [ ] Kiểm tra dữ liệu thật: HD_STK có tài khoản bị xóa/sửa nhầm chưa (đối chiếu `NhatKy_SuaDoi` "Cập nhật rừng/tài khoản" với dữ liệu ĐNTT)

### 🟠 High
- [ ] H-01 `CAP_NHAT_HOP_DONG_` cập nhật Draft + nhật ký; API đổi trạng thái riêng; chạy "Xây dựng lại Draft" 1 lần sau khi triển khai
- [ ] H-02 Phát hiện xung đột nháp; cảnh báo người đang sửa
- [ ] H-03 Duyệt/Từ chối ảnh theo `ID_DRAFT` + trạng thái
- [ ] H-04 Mốc đồng bộ sau khi xong; lock; ghi Draft không qua `clearContent`
- [ ] H-05 Upsert Draft trong lock; lọc trùng khi đọc
- [ ] H-06 Sửa luồng đăng nhập `yc`
- [ ] H-07 Bỏ ảnh khỏi ScriptCache; chống trùng bền
- [ ] H-08 Thống nhất `access`, `secret_token` Telegram, cập nhật tài liệu
- [ ] H-09 Che dữ liệu tại `api()` theo vai trò; giới hạn dữ liệu chatbot/Telegram
- [ ] H-10 Chỉ nhận/đọc file trong thư mục hệ thống
- [ ] H-11 `getReportSS_` không tự tạo file khi đã cấu hình
- [ ] H-12 Unit of work cho Draft
- [ ] H-13 Xuất file do server dựng; chặn công thức

### 🟡 Medium
- [ ] M-01 … M-18 (bảng mục 4)

### ⚪ Low
- [ ] L-01 … L-12 (bảng mục 5)

---

## 16. Checklist đã kiểm tra

| # | Hạng mục | Trạng thái | Ghi chú |
|---|---|---|---|
| 1 | Kiến trúc – folder/file/module | ⚠️ | Phẳng theo tiền tố; 06 quá lớn; thiếu tầng repository |
| 2 | File thừa / thiếu | ⚠️ | `23_CaiDatVung.html` vẫn không có trong repo (T-23); nút webhook Telegram vô dụng với manifest hiện tại |
| 3 | Dependency / thư viện | ✅ | Chỉ Leaflet từ cdnjs, Drive v2 |
| 4 | Business logic Tạo HĐ | ❌ | C-03 (Số HĐ trùng), M-17 |
| 5 | Business logic Sửa HĐ | ❌ | C-02, H-01, H-02, C-03 (đổi Số HĐ/Ngày ký) |
| 6 | Business logic Xóa | ❌ | C-01 (TK/PL), M-07 (mồ côi) |
| 7 | Business logic Duyệt/Hủy/Thanh lý | ❌ | H-01, M-01 |
| 8 | Business logic Ảnh/GPS | ❌ | H-03 |
| 9 | Import/đồng bộ DNTT | ⚠️ | H-04 |
| 10 | Xuất Excel/PDF/MISA | ⚠️ | H-13 |
| 11 | Luồng dữ liệu HTML→GAS→Sheet→HTML | ⚠️ | Điểm nghẽn mục 11 |
| 12 | Đồng bộ nguồn dữ liệu | ❌ | Bảng "hai nguồn" mục 11 |
| 13 | Race condition | ❌ | 8 điểm |
| 14 | Dữ liệu trùng | ❌ | Mục 6 |
| 15 | Double click / submit lặp | ⚠️ | Lưu HĐ ✅; Duyệt ảnh, GPS, TK trang 27 ❌ |
| 16 | Null / undefined | ✅ | Phần lớn có `|| ''`; không thấy lỗi null mới |
| 17 | Async / callback | ⚠️ | Duyệt hàng loạt gửi N lời gọi song song không giới hạn (27:447) — nên tuần tự hoặc 1 API hàng loạt |
| 18 | Memory / DOM / event leak | ✅ | Listener gắn vào phần tử được thay mới; 2 `setInterval` có kiểm soát |
| 19 | Infinite loop / dead code | ✅ / ⚠️ | Không có vòng lặp vô hạn; code trùng mục 7 |
| 20 | Hiệu năng vòng lặp & Sheet API | ❌ | H-12, P-01…P-11 |
| 21 | LockService | ⚠️ | Có ở chỗ sinh khóa; thiếu ở ghi theo dòng, Draft, trigger |
| 22 | CacheService | ❌ | H-07 |
| 23 | PropertiesService | ⚠️ | Mốc đồng bộ ghi sớm (H-04) |
| 24 | Trigger / quota | ⚠️ | M-08, bảng quota mục 10 |
| 25 | UrlFetchApp / tích hợp ngoài | ⚠️ | H-08, L-05, PDPD |
| 26 | Xác thực | ⚠️ | H-06 |
| 27 | Phân quyền | ❌ | H-01 (trạng thái), H-09 (che số), H-10 |
| 28 | XSS / HTML injection | ✅ | Đã escape (đợt trước); còn JS-in-attr ⚪ |
| 29 | Formula / Sheet injection | ❌ | H-13, M-18 |
| 30 | CSRF | ✅ | Do Google xử lý |
| 31 | Token / Cookie / LocalStorage | ⚠️ | Phiên trong localStorage (chấp nhận), `?ph=` trên URL |
| 32 | Dữ liệu nhạy cảm / mã hóa | ⚠️ | Không mã hóa CCCD/STK trong Sheet (phụ thuộc quyền chia sẻ file); H-09 |
| 33 | Cache trình duyệt / TTL / invalidation | ⚠️ | Ảnh 6 giờ không vô hiệu khi thay ảnh |
| 34 | Log / audit / rollback | ❌ | Mục 13 (Phần 17) |
| 35 | UI loading / toast / dialog | ⚠️ | Mục 12 |
| 36 | Responsive / trình duyệt | ⚠️ | Chưa kiểm tra thiết bị thật |
| 37 | Accessibility | ❌ | 169 nhãn chưa gắn |
| 38 | Test tự động | ⚠️ | Có bộ giả lập (đợt trước) nhưng không chạy trên CI, không có test cho C-01…C-03 |

---

## Phụ lục A — Bộ test case bổ sung (Phần 7)

| ID | Loại | Kịch bản | Kỳ vọng |
|---|---|---|---|
| TC-STK-01 | Negative | Nháp HĐ A xóa 2 TK (dòng 5, 7) | Chỉ 2 TK của A bị xóa; TK của HĐ khác nguyên vẹn |
| TC-STK-02 | Race | Mở nháp A; người khác xóa 1 TK ở phía trên; A sửa TK rồi Lưu | TK của A được sửa; không dòng nào của HĐ khác đổi |
| TC-HD-01 | Race | Trang 27 mở danh sách; Quản trị xóa vĩnh viễn 1 HĐ phía trên; sửa HĐ X | X được sửa hoặc báo "đã thay đổi"; HĐ khác không đổi |
| TC-HD-02 | Negative | Tạo HĐ với Số HĐ đã tồn tại | Từ chối |
| TC-HD-03 | Happy | Đổi Số HĐ của HĐ "Chờ thực hiện" | HD_RUNG/HD_STK/Draft đồng bộ; KL thực hiện ghép đúng |
| TC-TT-01 | Sync | Duyệt HĐ ở trang 27 | Tổng quan/Báo cáo hiện "Đang thực hiện" ngay; nhật ký có dòng |
| TC-TT-02 | Negative | Nhập liệu gọi `CAP_NHAT_HOP_DONG(soDong,{tinhTrang:'Đã thanh lý'})` | Từ chối |
| TC-ANH-01 | Double click | Bấm Duyệt ảnh 2 lần nhanh | 1 điểm GPS, 1 ảnh |
| TC-ANH-02 | Negative | Từ chối ảnh đã duyệt | Từ chối thao tác, file còn nguyên |
| TC-DNTT-01 | Timeout | Làm `capNhatDraftHangLoat_` ném lỗi giữa chừng | Lượt sau vẫn đồng bộ lại |
| TC-DRAFT-01 | Race | 2 lượt `CAP_NHAT_DRAFT_MOT_HOP_DONG_` cho HĐ mới cùng lúc | Draft có đúng 1 dòng |
| TC-AUTH-01 | Security | Gọi `nhanPhienDangNhap(yc)` với `yc` do người khác đăng nhập | Không nhận được phiên (sau S-1) |
| TC-AUTH-02 | Security | Vai trò XEM gọi `layDanhSachTaiKhoan` | Số TK bị che |
| TC-DRIVE-01 | Security | Nhập liệu ghi link file ngoài thư mục vào `anhUrl` | Bị từ chối khi ghi; `XEM_FILE_DRIVE_` từ chối |
| TC-XUAT-01 | Security | `XUAT_BANG_RA_FILE` với ô `=IMPORTXML(...)` | Ô được ghi là văn bản |
| TC-CACHE-01 | Resilience | Xóa sạch ScriptCache giữa 2 lần bấm Lưu HĐ mới cùng `maThaoTac` | Vẫn chỉ 1 HĐ |
| TC-LOAD-01…05 | Large data | Sinh 1k/5k/10k/50k HĐ trong bộ giả lập, đo số lượt đọc/ghi của Lưu chính thức, Tổng quan, trigger DNTT | Lưu ≤ 15 lượt đọc; Tổng quan ≤ 5 lượt; trigger < 4 phút ở 10k |
| TC-NET-01 | Network/Offline | Mất mạng khi đang Lưu chính thức rồi bấm lại | Không tạo trùng; hoàn tất phần còn lại |
| TC-TAB-01 | Multi-tab | 2 tab cùng sửa 1 HĐ | Tab thứ 2 thấy cảnh báo; không mất dữ liệu tab 1 |
| TC-NAV-01 | Refresh/Back/Forward | F5 / Back sau khi Lưu | Không gửi lại yêu cầu ghi; phiên giữ nguyên |

---

## ✅ Cập nhật: đã sửa (đợt 6b, cùng ngày)

| ID | Trạng thái | Thay đổi chính | File |
|---|---|---|---|
| C-01 | ✅ Đã sửa | `CAP_NHAT_TAI_KHOAN_` / `XOA_TAI_KHOAN_` / `LUU_PHU_LUC_` / `XOA_PHU_LUC_` bắt buộc kèm ID_HD, xác minh lại dòng (Số TK gốc / ID_PHU_LUC) **dưới lock**; không xác định chắc thì từ chối. Nháp lưu thêm `soTKGoc`, `idPhuLuc`. Lưu chính thức: sửa/thêm trước, xóa sau từ dòng dưới lên. Trang 27 không còn ghi đè `list[0]`. Xóa TK / phụ lục có ghi nhật ký | 06, 14, 15, 27 |
| C-02 | ✅ Đã sửa | `CAP_NHAT_HOP_DONG_(soDong, patch, idHD)` bắt buộc ID_HD, dòng lệch thì tìm lại theo khóa, dưới lock. `LUU_HOP_DONG_DAY_DU_` luôn tìm theo ID_HD, không còn tự đổi sang hợp đồng ở dòng đó (và không còn tải ảnh qua Drive khi lưu). Trang 27 (sửa, duyệt, duyệt hàng loạt) gửi kèm ID_HD | 06, 27 |
| C-03 | ✅ Đã sửa | Chặn Số HĐ trùng khi tạo và khi sửa; lô mới không bao giờ trùng `ID_RUNG` (giữ định dạng `HAK<SoHD>_<STT>`, bỏ qua STT đã dùng ở mọi hợp đồng); đổi Số HĐ / Ngày ký lan xuống HD_RUNG, HD_STK, PhuLucHopDong, cache Hồ sơ rừng | 06 |
| H-01 | ✅ Đã sửa | API `CAP_NHAT_HOP_DONG` trỏ sang `CAP_NHAT_HOP_DONG_WEB_`: chỉ cho các bước chuyển của trang 27 (Chờ → Đang/Hủy, Đang → Hoàn thành, Hoàn thành → Thanh lý), chỉ sửa thông tin khi Chờ/Đang thực hiện, ghi nhật ký "trường: cũ → mới", cập nhật Draft báo cáo | 06, 34 |
| H-03 | ✅ Đã sửa | Ảnh nháp định danh bằng `ID_DRAFT`; duyệt "nhận" ảnh nguyên tử (Chờ duyệt → Đang duyệt → Đã duyệt, lỗi thì trả về Chờ duyệt); không từ chối ảnh đã duyệt; gán ảnh kiểm tra lô rừng thuộc đúng hợp đồng | 06, 12, 27, NhapLieu_Chung_JS |
| H-04 | ✅ Đã sửa | Mốc đồng bộ DNTT ghi sau khi xong; Draft hàng loạt ghi đè 1 lệnh (không còn `clearContent` trước) | 01 |
| H-05 | ✅ Đã sửa | Đọc Draft bỏ dòng trùng (giữ bản mới nhất); cập nhật 1 hợp đồng tự dọn dòng trùng | 00, 01 |
| M-01 | ✅ Đã sửa | Không hủy HĐ đã hủy/thanh lý; không thanh lý HĐ đã hủy/thanh lý; thiếu hồ sơ **bắt buộc** chỉ Quản trị được bỏ qua | 06 |
| M-06 | ✅ Đã sửa | Lô rừng mới ghi CCCD / Số HĐ / ID dạng văn bản (giữ số 0 đầu) | 06 |

**Kiểm chứng:** bộ giả lập Apps Script (Node, nạp cả 26 file `.gs` như Apps Script, mô phỏng Sheets tự ép chuỗi số thành số) + 22 ca kiểm thử:
mã **đã sửa 22/22 đạt**; mã **gốc (`4d3d673`) trượt 14/16 ca** chạy được — trong đó tái hiện đúng: xóa 2 TK của HĐ A thì **mất TK `2222` của HĐ B**; sửa Số TK của A sau khi dòng dịch thì **Số TK mới ghi vào HĐ B**; Số HĐ trùng được tạo; 2 lô `HAK293_1`; CCCD lô rừng mất số 0; duyệt ảnh 2 lần ghi 2 ảnh + 2 điểm GPS; Draft 2 dòng cho 1 HĐ. Không có ScriptLock lồng nhau.

**Lưu ý triển khai:**
- API đổi tham số: trang đang mở từ trước khi triển khai bấm Sửa/Duyệt/Xóa TK sẽ nhận thông báo "tải lại trang" (không ghi sai) — người dùng chỉ cần F5.
- Nháp tạo trước bản sửa không có `soTKGoc`: vẫn an toàn với hợp đồng khác (bắt buộc dòng thuộc đúng ID_HD, không thì từ chối), nhưng nếu dòng đã dịch thì lưu sẽ báo lỗi ở tài khoản đó → mở lại hợp đồng (Hủy nháp rồi Sửa lại) để tạo nháp mới.
- Sau triển khai chạy 1 lần *Xây dựng lại Draft báo cáo* để sửa các trạng thái đã lệch do H-01 trước đây.
- **Vẫn nên kiểm tra dữ liệu thật** HD_STK: TK nào từng bị xóa/ghi đè nhầm (đối chiếu nhật ký "Cập nhật rừng/tài khoản" với ĐNTT).

**Còn mở:** xem bảng đợt 6c bên dưới.

**Không xử lý (theo yêu cầu chủ dự án):** H-08 — chế độ truy cập webapp (`access` trong `appsscript.json`) giữ nguyên như hiện tại.

---

## ✅ Cập nhật: đợt 6c — sửa tiếp các lỗi không thuộc nhóm bảo mật/truy cập

| ID | Trạng thái | Thay đổi chính | File |
|---|---|---|---|
| H-02 | ✅ | Nháp lưu ảnh chụp thông tin HĐ lúc mở (`hopDongGoc`); Lưu chính thức chỉ ghi **trường người dùng đã đổi** → không ghi đè thay đổi người khác làm trong lúc nháp còn mở. Hai người cùng sửa 1 trường: giữ giá trị người lưu + cảnh báo. Nháp cũ (không có ảnh chụp) ghi toàn bộ như trước | 15, 06 |
| H-07 | ✅ | Ảnh thu nhỏ chuyển sang `DocumentCache` (không còn chung ScriptCache với phiên đăng nhập, khóa chống lưu trùng) | 35 |
| H-11 | ✅ | `getReportSS_` báo lỗi rõ khi file báo cáo đã cấu hình không mở được; chỉ tự tạo file ở lần cài đặt đầu | 00 |
| H-12 | ✅ một phần | Gom cập nhật Draft báo cáo / Hồ sơ rừng trong `LUU_CHINH_THUC_`, `LUU_HOP_DONG_DAY_DU_`, `TAO_HOP_DONG_MOI_` thành 1 lần cuối thao tác, ngoài ScriptLock. Đo trên bộ giả lập (3 lô, 6 điểm GPS, 2 TK): **168 → 78 lệnh đọc (−54%)**. Còn lại: P-02, P-05 … P-10 | 01, 06, 15, 16 |
| H-13 | ✅ một phần | Xuất Excel/PDF: chuỗi bắt đầu `= + @` (và `-` không phải số) được giữ là chữ; tối đa 50.000 dòng × 80 cột. Chưa làm: server tự dựng dữ liệu xuất | 23 |
| M-02 | ✅ | Đơn giá bình quân so theo ngày thuần — lấy được mức giá hiệu lực tới đúng ngày ký | 06 |
| M-04 | ✅ | Phiếu cân khớp nguyên cụm tên theo ranh giới từ, bỏ khớp chiều ngược | 14 |
| M-05 + M-14 | ✅ | Báo cáo kiểm tra hồ sơ khóa theo ID_HD + Mã rừng (không mất dòng khi cùng chủ rừng có 2 HĐ); ghi cả bảng bằng 2 lệnh | 02 |
| M-07 | ✅ | Xóa vĩnh viễn dọn thêm: phụ lục, ct_hopdong, nháp đang dở, ảnh lưu theo ID lô, cache Hồ sơ rừng. Xóa theo **khối dòng liền nhau** (cũng áp dụng cho xóa lô rừng, ghi đè GPS). Chưa làm: lưu bản sao để khôi phục; file Drive vẫn giữ | 06 |
| M-08 | ✅ | Polling Telegram không chạy chồng; lưu offset trước khi trả lời từng tin | 31 |
| M-09 | ✅ | Sửa tay trên Sheet: đọc cả vùng 1 lần, cập nhật Draft 1 lần cho mọi HĐ, ghi log lỗi (trước đây nuốt im lặng) | 01 |
| M-11 | ✅ | Ghi cache báo cáo xóa dòng cũ theo khối | 00 |
| M-12 | ✅ một phần | Tìm file theo tên trong 3 thư mục hệ thống trước; toàn Drive chỉ còn là dự phòng cho dữ liệu cũ | 02, 03, 04, 06 |
| M-16 | ✅ | Hộp thoại Hướng dẫn trong Sheet dựng đúng template | 05 |
| M-17 | ✅ | Tạo HĐ: báo rõ nếu chưa tạo được lô rừng / số TK; trang 27 hiện cảnh báo | 06, 27 |
| L-02, L-03, L-04, L-06 | ✅ | Sắp xếp Số HĐ có chữ; ngày trên form không qua `toISOString`; tên file xuất theo ngày địa phương; ngày giấy tờ cùng múi giờ bảng tính | 01, 18, 07, 11, NhapLieu_Chung_JS, 10, 06 |

**Kiểm chứng:** bộ giả lập — mã mới **29/29 đạt**; bản ngay trước đợt này (`03dc678`) trượt 5 ca mới (H-02a/b, H-11, M-05, M-07), tái hiện: nháp cũ **xóa mất địa chỉ** người khác vừa sửa; báo cáo kiểm tra **mất dòng** của HĐ thứ nhất khi cùng chủ rừng có HĐ thứ hai; xóa vĩnh viễn để lại phụ lục / ct_hopdong / nháp.

**Không xử lý theo yêu cầu chủ dự án:** H-06, H-09, H-10 (bảo mật đăng nhập / che số / đọc file Drive) và H-08 (chế độ truy cập).

**Còn mở:** xem đợt 6d bên dưới.

---

## ✅ Cập nhật: đợt 6d — các mục nhỏ còn lại

| ID | Trạng thái | Thay đổi chính | File |
|---|---|---|---|
| M-10 | ✅ | Xây lại Draft vào sheet tạm `Draft_BaoCaoHopDong_TAM`, xong hết mới thay Draft thật bằng 1 lệnh; tiếp tục theo ID_HD → báo cáo không bị trống giữa các lượt chạy, không sót/trùng khi dữ liệu đổi giữa 2 lượt | 01 |
| M-15 | ✅ | DM_DIACHI: sửa trong bộ nhớ, ghi cả dòng 1 lệnh; gộp dòng trùng cũ | 06 |
| M-18 | ✅ | `giaTriAnToan_` / `dongAnToan_`: chuỗi bắt đầu `= + @` (hoặc `-` không phải số) được lưu nguyên văn ở mọi chỗ ghi chính: tạo/sửa HĐ, lô rừng, tài khoản, GPS, ảnh nháp, phụ lục, DM_DIACHI, nhật ký | 00, 06, 14 |
| L-01 | ✅ | `include` → `include_` (nội bộ): trình duyệt không gọi được để đọc nguyên văn file HTML; 20 scriptlet đã đổi theo | 05 + 13 file HTML |
| L-05 | ✅ | Khóa Gemini gửi qua header `x-goog-api-key` (5 chỗ) | 04, 06, 29 |
| L-09 | ✅ | Nhận diện ngân hàng: khớp chính xác (mã / BIN / tên) trước, khớp một phần sau | 32 |
| L-10 | ✅ | Khóa ký link ảnh QR tạo lần đầu dưới lock | 35 |
| L-12 | ✅ | Sinh Số HĐ tự động chỉ đọc cột Số HĐ | 06 |

**Kiểm chứng:** bộ giả lập — **33/33 đạt**; bản trước đợt này (`9e92e9d`) trượt 3 ca mới (M-18: tên/địa chỉ thành công thức; M-15: DM_DIACHI còn dòng trùng; L-01).

**Giữ nguyên theo yêu cầu chủ dự án:** M-03; H-08; H-06, H-09, H-10; các mục liên quan đăng nhập L-07, L-08; L-11 (mã bí mật webhook). M-13 (link ảnh công khai không hết hạn) thuộc nhóm bảo mật — chưa xử lý.

---

## ✅ Cập nhật: Đợt 1 nâng cấp — H-12 phần còn lại + A1 chống bấm lặp

| ID | Thay đổi | File |
|---|---|---|
| P-02 | Dữ liệu thanh toán trong `Cache_BaoCao` nhớ trong lượt chạy (trước đây đọc lại cả sheet JSON mỗi lần cập nhật Draft) | 00 |
| P-07a | Trang Báo cáo không còn nhận danh sách chi tiết "Tình hình thực hiện" (chỉ dùng số đếm) | 18, 01 |
| P-05 | Ảnh của hợp đồng / lô rừng: đọc sheet ảnh 1 lần cho mọi lô; tên file Drive nhớ trong lượt + DocumentCache 6 giờ | 06, 01 |
| P-06 | Danh mục file được phép xem nhớ 5 phút; file mới chưa có trong bản nhớ thì đọc lại (không chặn nhầm) | 35 |
| P-09 | Mở nháp tìm hợp đồng chỉ đọc cột ID; kiểm tra xung đột nháp chỉ đọc 1 dòng HD_NCC | 15 |
| P-10 | Cache "Hồ sơ rừng" cập nhật theo lô: đọc HD_RUNG / HD_NCC / HD_GPS 1 lần cho mọi lô, ghi 1 lệnh (trước đây 3 lượt đọc cả sheet cho MỖI lô); sửa tay trên Sheet và "Làm mới" cũng gom; Lưu chính thức không tổng hợp lô rừng 2 lần | 16, 01, 06, 15 |
| A1 | Chống bấm lặp cho **mọi** nút gọi hàm ghi (qua `hakRun_`): nút vừa bấm bị khóa + mờ tới khi có kết quả; cú bấm vào nút đang chạy bị bỏ; lời gọi đọc không ảnh hưởng | PhanQuyen_JS |

**Đo trên bộ giả lập** (300 hợp đồng, 600 lô, 1.200 điểm GPS; so với bản ngay trước `462b8e1`):

| Thao tác | Trước | Sau |
|---|---|---|
| Lưu chính thức HĐ mới (3 lô, 6 GPS, 2 TK) | 78 lệnh đọc / 357.016 ô | 64 lệnh / 272.594 ô (−24% ô) |
| Mở nháp, sửa 1 trường, Lưu HĐ có sẵn | 57 / 255.582 | 45 / 177.487 (−31% ô) |
| Sửa tay 40 dòng HD_GPS (onEdit) | 65 / 634.516 | 11 / 115.228 (−82% ô) |
| Duyệt HĐ ở trang 27 | 21 / 137.191 | 15 / 106.135 (−23% ô) |

So với mã gốc trước mọi đợt sửa (`4d3d673`), Lưu chính thức HĐ mới: 168 → 64 lệnh đọc. Thời gian thật phụ thuộc máy chủ Google — chưa đo trên project thật.

**Kiểm chứng:** 37/37 test máy chủ; 7/7 test trình duyệt (Chromium) cho A1: bấm 3 lần → 1 lệnh; nút khóa khi chờ, mở lại khi xong; thẻ `<a>` cũng chặn; lời gọi đọc không bị khóa; không lỗi JS.

**Còn lại của H-12:** đã làm ở Đợt 2 bên dưới.

---

## ✅ Cập nhật: Đợt 2 nâng cấp — A2, A3, A4 + P-07b, P-08, P-11 (chủ dự án đồng ý)

| ID | Thay đổi | File |
|---|---|---|
| A2 | Duyệt / Hủy hàng loạt ở trang 27: **1 lệnh** `DOI_TINH_TRANG_HANG_LOAT` (tối đa 200 HĐ), xử lý tuần tự, cập nhật Draft 1 lần, trả kết quả + lý do lỗi từng HĐ (trước đây N lệnh bắn cùng lúc) | 06, 34, 27 |
| A3 | Hộp thoại dùng chung `hakXacNhan_` / `hakNhapChu_` thay **toàn bộ 22** `confirm()` / `prompt()`: không bị chặn trong khung nhúng trên điện thoại, xuống dòng được, nút nguy hiểm màu đỏ, Esc/Enter/Tab, trả focus; mật khẩu quản trị nhập vào ô **che ký tự** | PhanQuyen_JS, 10, 12, 24, 27, NhapLieu_Chung_JS |
| A4 | Nhớ bộ lọc trang Tổng quan (Số HĐ, tên chủ rừng) và trang Báo cáo (15 ô lọc) trên máy người dùng; **đăng xuất thì xóa**. Trang Tra cứu **không** nhớ (từ khóa có thể là CCCD/SĐT) | PhanQuyen_JS, 30, 10 |
| P-07b | Bảng "Tổng hợp" lọc + chia trang **ở máy chủ** (`layTongHopChoWebapp(boBuoc, boLoc, trang, 20)`); KPI vẫn tính trên toàn bộ. Xuất Excel/PDF (Báo cáo hợp đồng, Hồ sơ rừng) do **máy chủ tự dựng** qua `XUAT_BAO_CAO_FILE(loai, boLoc, dinhDang)` — trình duyệt chỉ gửi bộ lọc; `XUAT_BANG_RA_FILE` (nhận bảng từ trình duyệt) đã **bỏ khỏi bảng quyền** → hoàn tất H-13 | 01, 18, 23, 34, 10 |
| P-08 | Chatbot: máy chủ tính sẵn `thongKeTongHop` (theo tình trạng: số HĐ, khối lượng, giá trị, chưa có ảnh, chưa đủ GPS, thiếu hồ sơ, ký quá 3 tháng, vượt/sắp vượt khối lượng); danh sách gửi Gemini **lọc sẵn** theo điều kiện nhận ra trong câu hỏi (tình trạng, chưa có ảnh, chưa đủ GPS, thiếu hồ sơ, năm ký), **tối đa 300 HĐ, không kèm CCCD**; thêm quy tắc 8 cho AI ưu tiên số liệu tính sẵn | 29 |
| P-11 | Polling Telegram 5 phút/lần (trước 1 phút) | 31, 24 |

**Kiểm chứng:** 45/45 test máy chủ (thêm: duyệt hàng loạt 2 đúng + 1 lỗi có lý do; Tổng hợp trang 1 = 20 / trang 2 = 5 / lọc đúng, KPI trên toàn bộ; file xuất đúng cột, lọc, định dạng ngày; chatbot thống kê đúng, lọc đúng, không có CCCD, "chưa thanh lý" không bị lọc nhầm). 15/15 test trình duyệt (A1 + hộp thoại: Đồng ý / Esc / Enter / mật khẩu / Hủy; bộ lọc khôi phục sau tải lại, xóa khi đăng xuất).

**Lưu ý triển khai:**
- **P-11:** trigger polling đang chạy vẫn là 1 phút cho tới khi vào *Thiết lập › Telegram* bấm **Tắt polling** rồi **Bật polling** lại.
- **A3** dùng `async/await` — cần trình duyệt hiện đại (Chrome/Edge/Firefox/Safari từ 2017 trở lên); mọi trang đã dùng `Proxy` nên yêu cầu không đổi.
- **P-08:** câu hỏi đếm/lọc rất đặc thù (theo địa chỉ, theo tên) trên hệ thống > 300 HĐ khớp — AI chỉ thấy 300 HĐ ký gần nhất + số liệu tổng hợp; đã ghi rõ trong dữ liệu gửi đi để AI không đếm nhầm.

---

## ✅ Cập nhật: Đợt 3 nâng cấp — B2 (nhật ký chi tiết + lưu trữ khi xóa) và B3 (kiểm thử tự động trên CI)

### B2 — "Ai sửa gì, từ gì thành gì" + khôi phục dữ liệu đã xóa

| Nội dung | Chi tiết | File |
|---|---|---|
| Sheet `NhatKy_ChiTiet` (tự tạo) | Mỗi trường bị sửa = 1 dòng: thời gian, người, hành động, sheet, ID_HD, khóa dòng, **trường, giá trị cũ, giá trị mới**. Ghi khi: sửa hợp đồng (`CAP_NHAT_HOP_DONG_` — mọi đường: trang 27, lưu nháp, duyệt/đổi tình trạng), sửa lô rừng, sửa tài khoản, sửa phụ lục. Chỉ ghi trường thực sự đổi; lỗi ghi nhật ký không làm hỏng thao tác chính. `NhatKy_SuaDoi` giữ nguyên | 00, 06, 14 |
| Sheet `LuuTru_DaXoa` (tự tạo) | **Trước** khi xóa, chép nguyên dòng (JSON theo **tên cột**) kèm mã đợt: xóa tài khoản, xóa lô rừng (+ điểm GPS), xóa phụ lục, ghi đè GPS, **xóa vĩnh viễn hợp đồng** (mọi sheet liên quan trong 1 đợt). Lưu trữ lỗi → **không xóa** | 00, 06, 14 |
| Khôi phục (Quản trị) | `KHOI_PHUC_DU_LIEU_DA_XOA(maDot)`: ghi lại đúng cột theo tên tiêu đề, ngày về dạng ngày, ô chữ-số (Số TK, CCCD) giữ dạng chữ + số 0 đầu; **bỏ qua** dòng có khóa (ID_HD / ID_RUNG / ID_PhuLuc) đã tồn tại lại; mỗi đợt chỉ khôi phục 1 lần; xong tự tổng hợp lại lô rừng, Draft báo cáo, Hồ sơ rừng, cache bản đồ | 00 |
| Giao diện | *Thiết lập › 🗂️ Lịch sử thay đổi & khôi phục*: xem lịch sử cũ → mới theo ID_HD; danh sách các đợt xóa + nút ♻️ Khôi phục (hộp thoại xác nhận, chống bấm lặp) | 24, 34, PhanQuyen_JS |

Ghi chú: các sheet cache (Draft báo cáo, Draft Hồ sơ rừng, Draft_HopDong, ct_hopdong) được dựng lại từ dữ liệu gốc nên không cần khôi phục riêng; `Draft_HopDong`/`ct_hopdong` vẫn được lưu trữ khi xóa vĩnh viễn để đủ vết. Hai sheet mới lớn dần — có thể xóa bớt dòng cũ bằng tay khi cần (không ảnh hưởng dữ liệu).

### B3 — Kiểm thử tự động trong repo

- Thư mục `tests/`: bộ giả lập Apps Script (`gasmock.cjs`), **57 test máy chủ** (`test_may_chu.cjs`), kiểm tra cú pháp 46 khối mã `.gs` + `<script>` (`kiem_tra_cu_phap.cjs`), **15 test giao diện** Playwright (`ui_khoa_nut.cjs`, `ui_hop_thoai_bo_loc.cjs`), `chay_tat_ca.cjs`, `README.md`.
- GitHub Actions `.github/workflows/kiem-thu.yml`: chạy mỗi lần push / pull request (Node 20, TZ Asia/Ho_Chi_Minh, Chromium).
- File đuôi `.cjs/.json/.md/.yml` → không lẫn vào dự án Apps Script khi đồng bộ.

**Kiểm chứng:** 57/57 test máy chủ (thêm 12 test B2: ghi cũ → mới khi sửa HĐ và lô rừng; xóa vĩnh viễn → 1 đợt đủ HD_NCC/HD_RUNG/HD_STK/Phụ lục; khôi phục → dữ liệu **y hệt trước khi xóa** kể cả CCCD số 0 đầu, Số TK dạng chữ, ngày; Draft báo cáo có lại HĐ; khôi phục lần 2 bị từ chối; HĐ khác không ảnh hưởng; xóa TK / xóa lô + GPS thành đợt riêng và khôi phục đúng; khóa đã tồn tại lại → bỏ qua). 15/15 test giao diện. Kiểm tra cú pháp phát hiện đúng lỗi cố ý chèn.

---

## ✅ Cập nhật: A5 — Chế độ tối + hỗ trợ truy cập (chủ dự án đồng ý)

| Nội dung | Chi tiết | File |
|---|---|---|
| Gom màu về biến | 305 chỗ màu viết cứng (nền trắng/xám, chữ xám, chữ & nền trạng thái xanh/đỏ/vàng/xanh dương, viền) đổi thành `var(--bien, #mauCu)`. Biến **chỉ khai báo ở chế độ tối** → chế độ sáng dùng đúng màu cũ | 14 file HTML |
| Chế độ tối | File mới `GiaoDien_Chung.html` (nạp trong `<head>` mọi trang + đầu `07_Form_HopDong`): bảng màu tối, ô nhập / bảng / liên kết tối, lớp phủ đăng nhập tối. Mặc định **Tự động theo máy**; nút **🌓** cạnh email đổi Tự động → Sáng → Tối, nhớ trên máy (không bị xóa khi đăng xuất) | GiaoDien_Chung (mới), PhanQuyen_JS, 11 trang |
| Gắn nhãn vào ô | Nhãn chưa gắn được gắn tự động vào ô đi kèm (kể cả ô vẽ thêm sau bằng mã): bấm chữ nhãn là vào ô, trình đọc màn hình đọc đúng tên ô. Đo trên 10 trang: **152/160** nhãn được gắn; 8 nhãn còn lại là tiêu đề nhóm (không ứng với 1 ô) — đúng là không gắn | GiaoDien_Chung |
| Tên nút biểu tượng | Nút chỉ có biểu tượng (🗑️ ✏️ 👁 ✕ ⬇ ♻️ …) được đặt `aria-label` theo `title` hoặc theo biểu tượng: 17/17 nút tìm thấy khi tải trang, cộng các nút vẽ thêm sau | GiaoDien_Chung |
| Khác | `lang="vi"`; viền nổi rõ khi di chuyển bằng phím Tab; giảm hiệu ứng chuyển động nếu máy bật "giảm chuyển động" | GiaoDien_Chung |

**Kiểm chứng:**
- Chế độ sáng: chụp 12 trang (07, 10, 11, 12, 13, 24, 27, 30, 33, 35, 38, Bản đồ) bằng mã cũ và mã mới → **giống hệt từng điểm ảnh**.
- Chế độ tối: soát ảnh chụp các trang + mẫu bảng / thông báo / huy hiệu / ô nhập / nút.
- Test giao diện mới `tests/ui_giao_dien.cjs` (11 ca): máy tối → tự tối, máy sáng → giữ màu gốc; nút 🌓 đổi vòng và nhớ sau tải lại; nhãn gắn đúng ô, bấm nhãn vào ô; nút biểu tượng có tên, kể cả phần tử thêm sau; không lỗi JS. Tổng: 57/57 test máy chủ, **26/26** test giao diện.

**Triển khai:** thêm file mới **`GiaoDien_Chung.html`** lên Apps Script (thiếu file này mọi trang báo lỗi `include_`), chép lại 14 file HTML đã đổi.
**Giới hạn:** màu được đặt bằng mã JavaScript lúc chạy (thông báo nổi, màu trạng thái tính động) giữ màu cũ — đã kiểm tra đều là chữ trắng trên nền đậm, đọc được ở cả hai chế độ. Bản đồ và ảnh / tài liệu giữ nền sáng.

---

## ✅ Cập nhật: Giao diện mới — đợt 1 (menu chung, lớp giao diện chung, Bản đồ GPS, mục lục Thiết lập/Hướng dẫn)

Theo bản mẫu đã duyệt (giữ bộ màu portal cũ). **Không đổi phần xử lý máy chủ** ngoài 2 chỗ nhỏ ghi bên dưới; mọi id/hàm của trang giữ nguyên.

| Nội dung | Chi tiết | File |
|---|---|---|
| Menu trái dùng chung | `Menu_Chung.html` (mới) dựng ở máy chủ bằng `menuChung_(currentPage, baseUrl, tabTrang)`; thay 9 bản sao 45 dòng trong 9 trang. Nhóm Hợp đồng / Hiện trường / Kiểm tra & đối chiếu / Hệ thống, biểu tượng nét thay emoji. "Kiểm tra ảnh" / "Đối chiếu OCR" mở thẳng đúng thẻ (`?page=kiemtra&tab=anh|ocr`) và sáng đúng mục | Menu_Chung (mới), 05_Menu.gs, Code.gs, 10, 11, 12, 13, 24, 27, 30, 33, 35 |
| Lớp giao diện chung | Trong `GiaoDien_Chung.html`: font Be Vietnam Pro, menu, thẻ bo 14px, nút, ô nhập (viền xanh khi gõ), bảng, thẻ thống kê, thông báo; nhãn tình trạng tự tô màu theo chữ (Chờ = vàng, Đang = xanh, Hoàn thành = xanh lá, Thanh lý = xám, Hủy = đỏ); hợp chế độ tối; điện thoại: menu thành thanh ngang | GiaoDien_Chung |
| Bản đồ GPS | Làm lại theo mẫu: menu chung + thanh đầu (đếm lô, lọc tình trạng, thời điểm cập nhật, Tải lại) + danh sách lô dạng thẻ (tìm, lọc Có/Thiếu GPS) + **vẽ tất cả lô** trên ảnh vệ tinh Esri theo màu tình trạng + chú giải + chọn lớp Ảnh vệ tinh/Bản đồ đường + nút vị trí của tôi + thẻ chi tiết nổi (4 góc, bấm để phóng tới điểm; **Mở hợp đồng**, **Xem ảnh**, **Chỉ đường** Google Maps). Tự tải khi mở trang. Tên/địa chỉ được escape (trước đây chèn thẳng HTML) | MapContainer, Code.gs (`getMapData` trả thêm `idHD`, `diaChi`) |
| Mục lục dính | Thiết lập: cột "Mục thiết lập" + ô tìm lọc thẻ; Hướng dẫn: mục lục 8 phần, sáng mục đang đọc | GiaoDien_Chung (`hakTaoMucLuc_`), 13, 24 |
| Tiêu đề trang | Bỏ emoji đầu tiêu đề trang | 27, 30, 33, 35 |

**Kiểm chứng:** 57/57 test máy chủ; test giao diện 42/42 (thêm `tests/ui_trang_that.cjs` 16 ca: dựng **từng trang thật** từ template Apps Script — menu 11 mục, link đúng, đúng 1 mục sáng mỗi trang; mục lục Thiết lập/Hướng dẫn, ô tìm lọc; bản đồ: danh sách + vẽ lô, tên có thẻ HTML không bị chèn, bấm lô ra thẻ chi tiết + link, lọc Thiếu GPS). Soát ảnh chụp sáng/tối các trang.

**Triển khai:** thêm file mới **`Menu_Chung.html`** (thiếu là mọi trang lỗi) + chép `05_Menu.gs`, `Code.gs`, `GiaoDien_Chung.html`, `MapContainer.html` và 9 trang HTML; Deploy phiên bản mới. Dữ liệu bản đồ đang cache: nút "Xem ảnh" hiện sau lần tải dữ liệu mới đầu tiên.

**Chưa làm (đợt sau):** Nhập liệu chia 5 bước + bảng so khớp OCR; Tra cứu dạng 2 cột; Tổng quan thêm hàng 4 chỉ số; bản đồ trên điện thoại dạng thẻ trượt.

---

## ✅ Cập nhật: Giao diện mới — đợt 2 (Tổng quan, Tra cứu 2 cột, Nhập liệu 5 bước + so khớp OCR, bản đồ điện thoại)

| Nội dung | Chi tiết | File |
|---|---|---|
| Tổng quan | Hàng **4 chỉ số** (số HĐ, giá trị HĐ, khối lượng đã thực hiện có % so với dự kiến, giá trị đã thực hiện có %) + thanh tiến độ; 6 **nút lọc tình trạng** kèm số lượng ngay trên bảng; bảng thêm cột KL dự kiến, **tiến độ thực hiện** (thanh + %), giá trị, nhãn tình trạng màu. Lúc tải: làm mờ số cũ thay vì xóa trắng. Máy chủ `LAY_TONG_QUAN_HOP_DONG_` trả thêm `tongKhoiLuongDuKien` và 3 trường mỗi dòng (không đổi trường cũ) | 30, 01_ContractManager.gs, GiaoDien_Chung |
| Tra cứu | Màn rộng (≥ 1200px): **2 cột** — danh sách kết quả bên trái (dính khi cuộn), chi tiết bên phải, tự mở hợp đồng đầu tiên, dòng đang xem được đánh dấu; điện thoại/màn hẹp giữ kiểu cũ có nút Quay lại | 33 |
| Nhập liệu — tiến độ 5 bước | Trong trang hợp đồng: thanh **Chủ rừng & hợp đồng → Tài khoản → Lô rừng & hồ sơ → GPS → Ảnh**, ✓ khi đủ, bấm để mở đúng thẻ, dòng "Còn thiếu: …". Dữ liệu từ cache báo cáo qua API mới `TIEN_DO_HO_SO_HD` (quyền Xem); đổi thẻ không gọi lại máy chủ. Quy trình lưu **không đổi** (vẫn tạo hợp đồng qua hộp thoại 3 bước — thanh bước đổi màu/kiểu theo mẫu) | 27, 01_ContractManager.gs, 34_PhanQuyen.gs |
| Nhập liệu — so khớp OCR | Sau khi đọc scan (CCCD chủ rừng, CCCD / giấy ủy quyền, giấy tờ nguồn gốc rừng; form bên Sheet): **bảng Trường / Đọc từ scan / So khớp (Khớp · Khác · Ô trống)**, ô khớp bị khóa, ô khác/trống chọn sẵn, bấm "Áp dụng N trường" hoặc Bỏ qua/Esc. Trước đây: trang 27 chỉ điền ô trống (lệch thì im lặng bỏ qua), form Sheet ghi đè hết. File giấy tờ vẫn luôn được đính kèm | GiaoDien_Chung (`hakSoKhopOcr_`), 27, 07 |
| Bản đồ điện thoại | Bấm lô: thẻ chi tiết **trượt từ đáy**, rộng hết màn, nút to; danh sách thu gọn để bản đồ rộng; đóng thẻ thì hiện lại | MapContainer |

**Kiểm chứng:** 84/84 test máy chủ (thêm 4: dữ liệu Tổng quan, tiến độ hồ sơ, ID không có, quyền API); test giao diện mới `tests/ui_giao_dien_dot2.cjs` 10 ca (Tổng quan: 4 chỉ số / % / 6 nút / tiến độ dòng / escape tên; Tra cứu 2 cột màn rộng + giữ 1 cột trên điện thoại; thanh 5 bước + bấm bước mở thẻ không gọi lại máy chủ; OCR: khóa ô khớp, chỉ áp dụng trường đã chọn, phát sự kiện input, Esc bỏ qua; bản đồ điện thoại mở/đóng thẻ). Toàn bộ bộ test đạt.

**Triển khai:** chép `01_ContractManager.gs`, `34_PhanQuyen.gs`, `GiaoDien_Chung.html`, `MapContainer.html`, `07_Form_HopDong.html`, `27`, `30`, `33`; Deploy phiên bản mới. Không có file mới.

## ✅ Cập nhật: Giao diện mới — đợt 3 (Báo cáo, Tra cứu hình ảnh, Thiết lập, Hướng dẫn theo mẫu)

| Nội dung | Chi tiết | File |
|---|---|---|
| Báo cáo tổng hợp | Bộ lọc gọn dạng lưới (nút nằm cùng hàng); ô chỉ số theo mẫu: thêm **Đã thực hiện (tấn)** và **Giá trị đã thực hiện** có thanh tiến độ + % so với dự kiến; các ô GPS đủ / Hồ sơ đủ / Có ảnh có thanh tỉ lệ; nhãn tình trạng màu. Máy chủ `_tongHopWebappTuDraft_` trả thêm `tongKhoiLuongThucHien`, `tongGiaTriThucHien` (không đổi trường cũ) | 10, 01_ContractManager.gs, GiaoDien_Chung |
| Tra cứu hình ảnh | Thanh lọc: nút **Ảnh hiện trường / Ảnh GPS / Hồ sơ** kèm số lượng + chọn lô; chỉ ẩn/hiện trên trang, không gọi lại máy chủ; xuất PDF, xem ảnh giữ nguyên | 35 |
| Thiết lập | Mục lục **chia nhóm** (Truy cập · Kết nối · Dữ liệu & bảo trì · Nhật ký & khôi phục · Định dạng & xuất · Khác), các thẻ được sắp theo đúng nhóm; bảng người dùng có chữ viết tắt, nhãn vai trò/trạng thái màu. Chức năng từng thẻ không đổi | 24, GiaoDien_Chung (`hakTaoMucLuc_` thêm tùy chọn `nhom`) |
| Hướng dẫn | Mỗi phần 1 thẻ; "Bước 1…5" của quy trình nhập liệu thành **thẻ bước đánh số**; hộp lưu ý tô màu theo loại (⚠️ cảnh báo đỏ, 🔒 vàng, 💳/✅ xanh). Nội dung chữ giữ nguyên | 13 |

**Kiểm chứng:** 85/85 test máy chủ (thêm: tổng đã thực hiện chỉ cộng HĐ đang/chờ); `tests/ui_trang_that.cjs` thêm 4 ca (Báo cáo KPI + thanh 25% + bộ lọc gọn; lọc Ảnh GPS còn 2 ảnh; Thiết lập nhóm + thứ tự thẻ khớp mục lục; Hướng dẫn thẻ phần/bước/lưu ý). Toàn bộ bộ test đạt.

**Chưa làm (cần đổi luồng lưu):** Nhập liệu 5 bước tuần tự thật sự (đang giữ hộp thoại 3 bước + thanh tiến độ 5 bước).

**Triển khai:** chép `01_ContractManager.gs`, `GiaoDien_Chung.html`, `10_Page_BaoCao.html`, `13_HuongDan.html`, `24_Page_ThietLap.html`, `35_Page_TraCuuHinhAnh.html`; Deploy phiên bản mới. Không có file mới.

## ✅ Cập nhật: Bảo trì — xóa dòng HD_NCC / HD_RUNG nghi trùng và dòng mồ côi (Thiết lập, Quản trị)

Trước đây mục "Bảo trì dữ liệu" chỉ **đếm/liệt kê** dòng mồ côi, không tìm dòng trùng và không cho xóa.

| Nội dung | Chi tiết | File |
|---|---|---|
| Tìm dòng nghi trùng | HD_NCC: **cùng ID_HD**, **cùng Số HĐ**, **cùng CCCD chủ rừng + ngày ký**. HD_RUNG: **cùng ID_RUNG**, **cùng hợp đồng + Mã rừng**, **cùng hợp đồng + địa chỉ + diện tích**. Gom nhóm bắc cầu, mỗi nhóm hiện lý do, số dữ liệu con (lô / TK / GPS / ảnh) và **gợi ý giữ** dòng có nhiều dữ liệu con nhất | 28_BaoTri_DongBo.gs (`TIM_DONG_NGHI_TRUNG_`) |
| Xóa dòng nghi trùng | Tick chọn / "Chọn theo gợi ý". Trùng **cùng ID**: xóa đúng dòng thừa, dữ liệu con giữ nguyên. Trùng **khác ID**: xóa cả hợp đồng / cả lô kèm dữ liệu con (dùng lại `XOA_VINH_VIEN_HOP_DONG_` / `XOA_LO_RUNG_`). Chặn xóa hết nhóm; chặn xóa hết các dòng mang cùng 1 ID | 28 (`XOA_DONG_NGHI_TRUNG_`), 24 |
| Xóa dòng mồ côi | Kết quả chẩn đoán có ô chọn từng dòng: mồ côi chọn sẵn, **thiếu ID không chọn sẵn**. Xóa lô rừng mồ côi kéo theo GPS / ảnh gắn theo lô đó | 28 (`XOA_DONG_MO_COI_`), 24 |
| An toàn | Quét lại lúc xóa; mỗi dòng có **dấu vân tay** — dòng bị sửa/dịch sau khi xem thì bỏ qua. Mọi dòng xóa chép vào `LuuTru_DaXoa` trước (khôi phục được ở Thiết lập). Cập nhật cache báo cáo, Hồ sơ rừng, bản đồ. API chỉ Quản trị | 28, 34_PhanQuyen.gs |

**Kiểm chứng:** 97/97 test máy chủ (thêm BT-01…BT-12: tìm nhóm, gợi ý giữ, chặn xóa hết nhóm, bỏ qua dòng đã đổi, xóa cùng ID giữ dữ liệu con, xóa khác ID kèm dữ liệu con, lưu trữ, xóa mồ côi kéo GPS, khôi phục lại, quyền API); `ui_trang_that.cjs` thêm 4 ca giao diện. Toàn bộ bộ test đạt.

**Triển khai:** chép `28_BaoTri_DongBo.gs`, `34_PhanQuyen.gs`, `24_Page_ThietLap.html`; Deploy phiên bản mới.

## ✅ Cập nhật: Tra cứu hợp đồng — nút Sửa hợp đồng

| Nội dung | Chi tiết | File |
|---|---|---|
| Nút **✏️ Sửa hợp đồng** | Ở đầu phần chi tiết hợp đồng (cả kiểu 2 cột và điện thoại). Chỉ hiện với vai trò **Nhập liệu / Quản trị**; mở đúng hợp đồng đó ở trang Nhập liệu (`?page=hopdongmc&idHD=`). Hợp đồng đã chốt (Đã hoàn thành / Đã thanh lý / Đã hủy) hiện **👁️ Mở ở Nhập liệu** (chỉ xem, như quy tắc sẵn có). Máy chủ vẫn kiểm tra quyền khi lưu | 33 |
| Nhập liệu mở theo `?idHD=` | Trước đây chỉ đọc `window.location.search` — trong khung sandbox của Apps Script / khung Portal thường không có tham số nên mở ra danh sách khách hàng thay vì đúng hợp đồng (ảnh hưởng cả nút "Sửa hợp đồng" ở Tổng quan). Nay đọc thêm qua `google.script.url.getLocation` như trang Tra cứu / Hình ảnh | 27 |

**Kiểm chứng:** `ui_giao_dien_dot2.cjs` thêm 4 ca (Nhập liệu thấy nút Sửa + link đúng; HĐ đã chốt -> nút chỉ xem; vai trò Chỉ xem không có nút; link `?idHD=` mở thẳng hợp đồng qua getLocation — mã cũ trượt). Toàn bộ bộ test đạt.

**Triển khai:** chép `33_Page_TraCuuHopDong.html`, `27_Page_HopDongMeCon.html`; Deploy phiên bản mới.
