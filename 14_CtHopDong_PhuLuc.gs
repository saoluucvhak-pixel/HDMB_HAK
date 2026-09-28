/**
 * ============================================================
 *  14_CtHopDong_PhuLuc.gs
 *  BẢNG CON MỚI CỦA HD_NCC:
 *   - ct_hopdong      : "Chi tiết hợp đồng" — TỰ ĐỘNG tổng hợp lại từ toàn bộ
 *                        HD_RUNG của hợp đồng mỗi khi có Thêm/Sửa/Xóa lô rừng
 *                        (dongBoTongHopRungVaoHdNcc_ — cùng lúc ghi cột Z/T/AA
 *                        của HD_NCC). KHÔNG nhập tay — chỉ đọc để hiển thị.
 *   - PhuLucHopDong   : các phụ lục hợp đồng (mỗi lần ký/bổ sung đơn giá-khối
 *                        lượng-thành tiền), có đối chiếu tham khảo với Phiếu cân
 *                        (PhieuCan_DN — sheet NGOÀI) theo tên chủ rừng.
 * ============================================================
 */

const SHEET_CT_HOPDONG = 'ct_hopdong';
const SHEET_PHU_LUC = 'PhuLucHopDong';

const CT_HOPDONG_COL = {
  ID_HD: 0, SO_HD: 1, DIEN_TICH_KY: 2, DON_GIA: 3, KHOI_LUONG_DU_KIEN: 4, GIA_TRI_DU_KIEN: 5,
  LOAI_HO_SO_NGUON_GOC: 6, SO_GIAY_TO: 7, DIA_CHI_RUNG: 8, SO_LO_RUNG: 9, CAP_NHAT_LUC: 10
};

const PHU_LUC_COL = {
  ID_PHU_LUC: 0, ID_HD: 1, SO_HD: 2, LAN_PHU_LUC: 3, DON_GIA: 4, KHOI_LUONG: 5, THANH_TIEN: 6,
  GHI_CHU: 7, TIMESTAMP: 8
};

function getOrCreateCtHopDongSheet_() {
  const ss = getSS_();
  let sh = ss.getSheetByName(SHEET_CT_HOPDONG);
  if (!sh) {
    sh = ss.insertSheet(SHEET_CT_HOPDONG);
    const header = ['ID_HD', 'Số HĐ', 'Diện tích ký HĐ (m2)', 'Đơn giá (bình quân)', 'Khối lượng dự kiến',
      'Giá trị dự kiến', 'Loại hồ sơ nguồn gốc', 'Số giấy tờ', 'Địa chỉ rừng', 'Số lô rừng', 'Cập nhật lúc'];
    sh.getRange(1, 1, 1, header.length).setValues([header]).setFontWeight('bold').setBackground('#34495e').setFontColor('#ffffff');
    sh.autoResizeColumns(1, header.length);
  }
  return sh;
}

function getOrCreatePhuLucSheet_() {
  const ss = getSS_();
  let sh = ss.getSheetByName(SHEET_PHU_LUC);
  if (!sh) {
    sh = ss.insertSheet(SHEET_PHU_LUC);
    const header = ['ID_PhuLuc', 'ID_HD', 'Số HĐ', 'Lần phụ lục', 'Đơn giá', 'Khối lượng', 'Thành tiền', 'Ghi chú', 'Thời gian tạo'];
    sh.getRange(1, 1, 1, header.length).setValues([header]).setFontWeight('bold').setBackground('#34495e').setFontColor('#ffffff');
    sh.autoResizeColumns(1, header.length);
  }
  return sh;
}

function timDongCtHopDong_(sh, idHD) {
  const lastRow = sh.getLastRow();
  if (lastRow < 2) return -1;
  const ids = sh.getRange(2, CT_HOPDONG_COL.ID_HD + 1, lastRow - 1, 1).getValues();
  for (let i = 0; i < ids.length; i++) {
    if ((ids[i][0] || '').toString().trim() === idHD.toString().trim()) return i + 2;
  }
  return -1;
}

/**
 * PHÉP TÍNH DUY NHẤT tổng hợp các lô rừng (dòng HD_RUNG) của 1 hợp đồng — dùng chung
 * cho ct_hopdong, cột Z/T/AA của HD_NCC và chức năng bảo trì (28_BaoTri_DongBo.gs):
 *   - Diện tích ký HĐ   = TỔNG diện tích các lô rừng
 *   - Khối lượng dự kiến = TỔNG khối lượng dự kiến các lô rừng
 *   - Giá trị dự kiến    = TỔNG (khối lượng × đơn giá) của TỪNG lô rừng
 *   - Đơn giá            = BÌNH QUÂN đơn giá các lô rừng có đơn giá > 0 (làm tròn đồng)
 *   - Địa chỉ rừng / Số giấy tờ / Loại hồ sơ nguồn gốc = các giá trị KHÁC NHAU
 * Tổng diện tích/khối lượng làm tròn 3 chữ số lẻ để bỏ sai số cộng số thực (0,1 + 0,2).
 */
function tinhTongHopLoRung_(rungRows) {
  let soHD = '';
  let tongDienTich = 0, tongKhoiLuong = 0, tongGiaTri = 0, tongDonGia = 0, soRungCoGia = 0;
  const diaChiSet = [], soGiayToSet = [], hoSoSet = [];
  const them = function (ds, v) { v = (v || '').toString().trim(); if (v && ds.indexOf(v) === -1) ds.push(v); };

  rungRows.forEach(function (r) {
    soHD = r[RUNG_COL.SO_HD] || soHD;
    const dt = Number(r[RUNG_COL.DIEN_TICH_M2]) || 0;
    const kl = Number(r[RUNG_COL.KHOI_LUONG_DK]) || 0;
    const dg = Number(r[RUNG_COL.DON_GIA]) || 0;
    tongDienTich += dt; tongKhoiLuong += kl; tongGiaTri += kl * dg;
    if (dg > 0) { tongDonGia += dg; soRungCoGia++; }
    them(diaChiSet, r[RUNG_COL.DIA_CHI_RUNG]);
    them(soGiayToSet, r[RUNG_COL.SO_GIAY_TO]);
    them(hoSoSet, r[RUNG_COL.HO_SO_NGUON_GOC]);
  });

  const lamTron3 = function (x) { return Math.round(x * 1000) / 1000; };
  return {
    soHD: soHD, soLo: rungRows.length,
    tongDienTich: lamTron3(tongDienTich), tongKhoiLuong: lamTron3(tongKhoiLuong), tongGiaTri: Math.round(tongGiaTri),
    donGiaBQ: soRungCoGia ? Math.round(tongDonGia / soRungCoGia) : 0,
    diaChiRung: diaChiSet.join(', '), soGiayTo: soGiayToSet.join(', '), hoSoNguonGoc: hoSoSet.join(', ')
  };
}

/** Ghi đè dòng ct_hopdong của 1 hợp đồng từ kết quả tinhTongHopLoRung_(). */
function ghiCtHopDong_(idHD, th) {
  const row = [];
  row[CT_HOPDONG_COL.ID_HD] = idHD;
  row[CT_HOPDONG_COL.SO_HD] = th.soHD;
  row[CT_HOPDONG_COL.DIEN_TICH_KY] = th.tongDienTich;
  row[CT_HOPDONG_COL.DON_GIA] = th.donGiaBQ;
  row[CT_HOPDONG_COL.KHOI_LUONG_DU_KIEN] = th.tongKhoiLuong;
  row[CT_HOPDONG_COL.GIA_TRI_DU_KIEN] = th.tongGiaTri;
  row[CT_HOPDONG_COL.LOAI_HO_SO_NGUON_GOC] = th.hoSoNguonGoc;
  row[CT_HOPDONG_COL.SO_GIAY_TO] = th.soGiayTo;
  row[CT_HOPDONG_COL.DIA_CHI_RUNG] = th.diaChiRung;
  row[CT_HOPDONG_COL.SO_LO_RUNG] = th.soLo;
  row[CT_HOPDONG_COL.CAP_NHAT_LUC] = new Date();
  const sh = getOrCreateCtHopDongSheet_();
  const soDong = timDongCtHopDong_(sh, idHD);
  if (soDong === -1) sh.appendRow(row);
  else sh.getRange(soDong, 1, 1, row.length).setValues([row]);
}

/**
 * 3 cột số cấp hợp đồng của HD_NCC lấy từ tổng lô rừng. App Thanh toán (ĐNTT) đọc cột Z
 * (SL dự kiến) khi hợp đồng không có lô rừng — KHÔNG đổi vị trí các cột này.
 * (Hàm, không phải hằng: NCC_COL nằm ở 00_Config.gs, có thể nạp SAU file này.)
 */
function cotHdNccTuLoRung_() {
  return [
    { cot: NCC_COL.SL_DU_KIEN, ten: 'SL dự kiến (Z)', truong: 'tongKhoiLuong' },
    { cot: NCC_COL.DIEN_TICH_KY, ten: 'Diện tích ký (T)', truong: 'tongDienTich' },
    { cot: NCC_COL.DON_GIA, ten: 'Đơn giá (AA)', truong: 'donGiaBQ' }
  ];
}

/**
 * Các ô Z/T/AA của 1 dòng HD_NCC cần đổi theo tổng lô rừng `th`. Quy tắc:
 *   - Hợp đồng không có lô rừng nào -> không đổi (không có gì để suy ra, giữ số đã nhập).
 *   - Tổng lô rừng của ô đó = 0 -> không đổi (không xóa số đã có bằng số 0 do lô thiếu dữ liệu).
 *   - "Đang thực hiện" (khối lượng/đơn giá đã chốt lúc ký) hoặc chiDienTrong=true (bảo trì):
 *     chỉ điền ô đang TRỐNG/0, không ghi đè số > 0.
 *   - Trạng thái khác (Chờ thực hiện...): ghi theo tổng lô rừng.
 * Trả mảng { cot, ten, cu, moi }.
 */
function tinhThayDoiHdNccTuLoRung_(rowNcc, th, chiDienTrong) {
  if (!th || !th.soLo) return [];
  const dangThucHien = (rowNcc[NCC_COL.TINH_TRANG] || '').toString().trim().toLowerCase() === 'đang thực hiện';
  const chiDien = chiDienTrong || dangThucHien;
  const kq = [];
  cotHdNccTuLoRung_().forEach(function (c) {
    const cu = rowNcc[c.cot];
    const soCu = Number(cu) || 0;
    const moi = th[c.truong];
    if (!(moi > 0)) return;
    if (chiDien && soCu > 0) return;
    if (typeof cu === 'number' && soCu === moi) return;
    kq.push({ cot: c.cot, ten: c.ten, cu: cu === null || cu === undefined ? '' : cu, moi: moi });
  });
  return kq;
}

/** Ghi các thay đổi Z/T/AA vào dòng soDong của HD_NCC (ghi SỐ, định dạng số chuẩn) + nhật ký cũ -> mới. */
function ghiThayDoiHdNcc_(sh, soDong, idHD, thayDoi, lyDo) {
  if (!thayDoi.length) return;
  thayDoi.forEach(function (t) {
    sh.getRange(soDong, t.cot + 1).setNumberFormat(MAU_SO_CHUAN_).setValue(t.moi);
  });
  ghiNhatKy_(lyDo, idHD, thayDoi.map(function (t) { return t.ten + ': ' + (t.cu === '' ? '(trống)' : t.cu) + ' → ' + t.moi; }).join('; '));
}

/**
 * ĐỒNG BỘ SỐ LIỆU LÔ RỪNG CỦA 1 HỢP ĐỒNG: tính 1 lần (tinhTongHopLoRung_) rồi ghi vào
 * ct_hopdong VÀ cột Z/T/AA của HD_NCC (theo quy tắc ở tinhThayDoiHdNccTuLoRung_).
 * Gọi ở MỌI chỗ thêm/sửa/xóa lô rừng. Không ném lỗi — lưu lô rừng vẫn phải thành công dù
 * việc tổng hợp có trục trặc (ghi log để kiểm tra). Trả { thayDoi } (mảng rỗng nếu không đổi).
 */
function dongBoTongHopRungVaoHdNcc_(idHD) {
  if (!idHD) return { thayDoi: [] };
  idHD = idHD.toString().trim();
  let th;
  try {
    th = tinhTongHopLoRung_(readData_(SHEET_NAME.HD_RUNG).filter(function (r) {
      return (r[RUNG_COL.ID_KEY_HD] || '').toString().trim() === idHD;
    }));
    ghiCtHopDong_(idHD, th);
  } catch (e) {
    log_('ERROR', 'dongBoTongHopRungVaoHdNcc_', 'Không tổng hợp được ct_hopdong cho ' + idHD + ' — số liệu tổng hợp có thể cũ', e);
    if (!th) return { thayDoi: [] };
  }
  try {
    const sh = getSheet_(SHEET_NAME.HD_NCC);
    const lastRow = sh.getLastRow();
    if (lastRow < 2) return { thayDoi: [] };
    const ids = sh.getRange(2, NCC_COL.ID_HD + 1, lastRow - 1, 1).getValues();
    let soDong = -1;
    for (let i = 0; i < ids.length; i++) { if ((ids[i][0] || '').toString().trim() === idHD) { soDong = i + 2; break; } }
    if (soDong === -1) return { thayDoi: [] };
    const rowNcc = sh.getRange(soDong, 1, 1, Math.max(sh.getLastColumn(), NCC_COL.TINH_TRANG + 1)).getValues()[0];
    const thayDoi = tinhThayDoiHdNccTuLoRung_(rowNcc, th, false);
    ghiThayDoiHdNcc_(sh, soDong, idHD, thayDoi, 'Đồng bộ số liệu hợp đồng từ lô rừng');
    return { thayDoi: thayDoi };
  } catch (e) {
    log_('ERROR', 'dongBoTongHopRungVaoHdNcc_', 'Không ghi được SL dự kiến/Diện tích/Đơn giá vào HD_NCC cho ' + idHD, e);
    return { thayDoi: [] };
  }
}

// ============================================================
//  PHỤ LỤC HỢP ĐỒNG (PhuLucHopDong) — bảng con của HD_NCC
// ============================================================

/** Danh sách phụ lục của 1 hợp đồng, sắp theo "Lần phụ lục" tăng dần */
function layDanhSachPhuLuc_(idHD) {
  const sh = getOrCreatePhuLucSheet_();
  const lastRow = sh.getLastRow();
  if (lastRow < 2) return [];
  const data = sh.getRange(2, 1, lastRow - 1, sh.getLastColumn()).getValues();
  const c = PHU_LUC_COL;
  return data
    .map(function (r, i) { return { r: r, soDong: i + 2 }; })
    .filter(function (x) { return (x.r[c.ID_HD] || '').toString().trim() === idHD.toString().trim(); })
    .map(function (x) {
      const r = x.r;
      return {
        soDong: x.soDong, idPhuLuc: r[c.ID_PHU_LUC], idHD: r[c.ID_HD], soHD: r[c.SO_HD],
        lanPhuLuc: r[c.LAN_PHU_LUC], donGia: r[c.DON_GIA], khoiLuong: r[c.KHOI_LUONG],
        thanhTien: r[c.THANH_TIEN], ghiChu: r[c.GHI_CHU]
      };
    })
    .sort(function (a, b) { return (a.lanPhuLuc || 0) - (b.lanPhuLuc || 0); });
}

/** Thêm mới (không có d.soDong) hoặc cập nhật (có d.soDong) 1 phụ lục hợp đồng.
 *  Thành tiền LUÔN tự tính = Đơn giá × Khối lượng (không cho nhập tay để tránh sai lệch). */
function LUU_PHU_LUC_(d) {
  if (!d.idHD) return { thanhCong: false, loi: 'Thiếu ID_HD' };
  const donGia = Number(d.donGia) || 0;
  const khoiLuong = Number(d.khoiLuong) || 0;
  const thanhTien = donGia * khoiLuong;
  const sh = getOrCreatePhuLucSheet_();
  const c = PHU_LUC_COL;

  if (d.soDong) {
    if (d.soDong < 2 || d.soDong > sh.getLastRow()) return { thanhCong: false, loi: 'Số dòng không hợp lệ' };
    sh.getRange(d.soDong, c.DON_GIA + 1).setValue(donGia);
    sh.getRange(d.soDong, c.KHOI_LUONG + 1).setValue(khoiLuong);
    sh.getRange(d.soDong, c.THANH_TIEN + 1).setValue(thanhTien);
    sh.getRange(d.soDong, c.GHI_CHU + 1).setValue(d.ghiChu || '');
    return { thanhCong: true, soDong: d.soDong, thanhTien: thanhTien };
  }

  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000); // chờ tối đa 15s nếu có người khác đang lưu phụ lục cùng lúc — tránh trùng "Lần phụ lục" (LOCK-001)
  } catch (e) {
    return { thanhCong: false, loi: 'Hệ thống đang bận (người khác đang lưu phụ lục), vui lòng thử lại sau vài giây.' };
  }
  try {
    const lastRow = sh.getLastRow();
    let lanMax = 0;
    if (lastRow > 1) {
      sh.getRange(2, 1, lastRow - 1, sh.getLastColumn()).getValues().forEach(function (r) {
        if ((r[c.ID_HD] || '').toString().trim() === d.idHD.toString().trim()) {
          const lan = Number(r[c.LAN_PHU_LUC]) || 0;
          if (lan > lanMax) lanMax = lan;
        }
      });
    }
    const idPhuLuc = 'PL_' + d.idHD + '_' + (lanMax + 1);

    const row = [];
    row[c.ID_PHU_LUC] = idPhuLuc; row[c.ID_HD] = d.idHD; row[c.SO_HD] = d.soHD || '';
    row[c.LAN_PHU_LUC] = lanMax + 1; row[c.DON_GIA] = donGia; row[c.KHOI_LUONG] = khoiLuong;
    row[c.THANH_TIEN] = thanhTien; row[c.GHI_CHU] = d.ghiChu || ''; row[c.TIMESTAMP] = new Date();
    sh.appendRow(row);
    return { thanhCong: true, soDong: sh.getLastRow(), idPhuLuc: idPhuLuc, thanhTien: thanhTien };
  } finally {
    lock.releaseLock();
  }
}

/** Xóa 1 phụ lục theo số dòng thật (lấy từ layDanhSachPhuLuc_) */
function XOA_PHU_LUC_(soDong) {
  const sh = getOrCreatePhuLucSheet_();
  if (soDong < 2 || soDong > sh.getLastRow()) return { thanhCong: false, loi: 'Số dòng không hợp lệ' };
  sh.deleteRow(soDong);
  return { thanhCong: true };
}

// ============================================================
//  ĐỐI CHIẾU PHIẾU CÂN (PhieuCan_DN — sheet NGOÀI, xem 00_Config.gs)
// ============================================================

/**
 * Đọc Phiếu cân khớp TÊN KHÁCH HÀNG với chủ rừng (so sánh không dấu, không phân
 * biệt hoa/thường), dùng để tham khảo khi lập Phụ lục hợp đồng.
 *
 * Cấu trúc cột THẬT của PhieuCan_DN (đã xác nhận từ file mẫu thực tế — 28 cột):
 *   A Số phiếu | B Ngày cân 1 | C Giờ cân 1 | D Ngày cân 2 | E Giờ cân 2 |
 *   F Biển số 1 | G Biển số 2 | H Cân lần 1 | I Cân lần 2 | J KL hàng (KG) |
 *   K Nguồn gốc | L Khách hàng | M Mã hàng | N ĐL | O NG | P Hình ảnh |
 *   Q Mã ĐG | R Giảm giá | S Timestamp | T ĐG_AD | U Picture | V ID_PC |
 *   W So_CT | X Đơn giá_TC | Y Trạng thái | Z Thành tiền | AA ID_DNTT | AB Chọn TT
 * — Chỉ lấy các phiếu Trạng thái = "OK" (bỏ phiếu hủy/lỗi).
 * — "KL hàng" trong PhieuCan_DN tính bằng KG, hệ thống HAK tính "tấn" nên
 *   CHIA 1000 khi trả về để khớp đơn vị với phần còn lại (Lô rừng, Phụ lục...).
 * — "Đơn giá_TC" (đơn giá thực tế/chốt sau điều chỉnh) được dùng làm "Đơn giá
 *   bổ sung" hiển thị trong modal — đúng với ý nghĩa "giá đã chốt/bổ sung" hơn
 *   là "ĐG_AD" (đơn giá áp dụng ban đầu).
 * — "Thành tiền" LẤY THẲNG từ cột Z có sẵn trong sheet (không tự nhân lại) để
 *   tránh sai lệch làm tròn / đơn vị.
 * Nếu cấu trúc cột của sheet thay đổi sau này (chèn/xóa cột), hàm sẽ TỰ DÒ LẠI
 * theo từ khóa tiêu đề (dòng 1) thay vì dùng vị trí cố định.
 */
function layPhieuCanTheoChuRung_(tenChuRung) {
  _yeuCauQuyen_(QUYEN.XEM);
  try {
    if (!tenChuRung) return { thanhCong: false, loi: 'Thiếu tên chủ rừng', danhSach: [] };
    const boDauTV = function (s) {
      return (s || '').toString().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').trim();
    };
    const ten = boDauTV(tenChuRung);

    const ssPC = SpreadsheetApp.openByUrl(PHIEUCAN_URL);
    const shPC = ssPC.getSheetByName(PHIEUCAN_SHEET_NAME) || ssPC.getSheets()[0];
    const data = shPC.getDataRange().getValues();
    if (data.length < 2) return { thanhCong: true, danhSach: [] };

    // Vị trí cột mặc định (0-based) theo cấu trúc thật đã xác nhận
    const IDX = { soPhieu: 0, ngayCan1: 1, klHangKg: 9, khachHang: 11, donGiaTC: 23, trangThai: 24, thanhTien: 25 };

    const header = data[0].map(boDauTV);
    // Kiểm tra nhanh: nếu cột "Khách hàng" không đúng vị trí kỳ vọng -> cấu trúc sheet đã đổi -> tự dò lại theo từ khóa
    if (!header[IDX.khachHang] || header[IDX.khachHang].indexOf('khach hang') === -1) {
      function timCot(tuKhoaList) {
        for (let i = 0; i < header.length; i++) {
          if (tuKhoaList.some(function (tk) { return header[i].indexOf(tk) !== -1; })) return i;
        }
        return -1;
      }
      IDX.khachHang = timCot(['khach hang']);
      IDX.soPhieu = timCot(['so phieu']);
      IDX.ngayCan1 = timCot(['ngay can 1', 'ngay can']);
      IDX.klHangKg = timCot(['kl hang', 'khoi luong']);
      IDX.donGiaTC = timCot(['don gia_tc', 'don gia tc', 'don gia']);
      IDX.trangThai = timCot(['trang thai']);
      IDX.thanhTien = timCot(['thanh tien']);
    }
    if (IDX.khachHang === -1) {
      return { thanhCong: false, loi: 'Không dò được cột "Khách hàng" trong PhieuCan_DN — kiểm tra lại tiêu đề sheet.', danhSach: [] };
    }

    const ketQua = [];
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const kh = boDauTV(row[IDX.khachHang]);
      if (!kh) continue;
      if (kh.indexOf(ten) === -1 && ten.indexOf(kh) === -1) continue;
      if (IDX.trangThai !== -1) {
        const tt = boDauTV(row[IDX.trangThai]);
        if (tt && tt !== 'ok') continue; // bỏ qua phiếu bị hủy/lỗi
      }
      const khoiLuongKg = IDX.klHangKg !== -1 ? (Number(row[IDX.klHangKg]) || 0) : 0;
      const donGia = IDX.donGiaTC !== -1 ? (Number(row[IDX.donGiaTC]) || 0) : 0;
      const khoiLuongTan = Math.round((khoiLuongKg / 1000) * 1000) / 1000;
      const thanhTien = IDX.thanhTien !== -1 ? (Number(row[IDX.thanhTien]) || 0) : khoiLuongTan * donGia;
      ketQua.push({
        ngay: IDX.ngayCan1 !== -1 ? row[IDX.ngayCan1] : '',
        soPhieu: IDX.soPhieu !== -1 ? row[IDX.soPhieu] : '',
        khoiLuong: khoiLuongTan, donGia: donGia, thanhTien: thanhTien
      });
    }
    ketQua.sort(function (a, b) { return new Date(b.ngay) - new Date(a.ngay); });
    return { thanhCong: true, danhSach: ketQua };
  } catch (e) {
    return { thanhCong: false, loi: 'Lỗi đọc PhieuCan_DN: ' + e.message, danhSach: [] };
  }
}

// ============================================================
//  NHẬP TỌA ĐỘ GPS TRỰC TIẾP TỪ ẢNH (đọc EXIF, không qua hàng chờ duyệt ảnh)
// ============================================================

/** Trích GPS (EXIF) từ 1 ảnh tải lên trực tiếp ở tab "Tọa độ GPS". Dùng chung
 *  hàm đọc EXIF đã có sẵn ở 03_ImageForensics.gs (docExifTuBytes_). Sau khi có
 *  lat/lng, front-end gọi tiếp CAP_NHAT_GPS_RUNG_(idRung, {lat,lng}, false) như
 *  nhập tay bình thường — không cần thêm hàm ghi dữ liệu riêng. */
function TRICH_XUAT_GPS_TU_ANH_(base64Data, mimeType) {
  _yeuCauQuyen_(QUYEN.NHAP_LIEU);
  try {
    const blob = Utilities.newBlob(Utilities.base64Decode(base64Data), mimeType || 'image/jpeg', 'anh_gps.jpg');
    const exif = docExifTuBytes_(blob);
    if (!exif.hasExif || exif.gpsLat === null || exif.gpsLng === null) {
      return { thanhCong: false, loi: 'Ảnh không có dữ liệu GPS (EXIF). Vui lòng nhập tay hoặc chọn ảnh khác (lưu ý: ảnh gửi qua Zalo/Messenger thường bị nén mất EXIF).' };
    }
    return { thanhCong: true, lat: exif.gpsLat, lng: exif.gpsLng };
  } catch (e) {
    return { thanhCong: false, loi: 'Lỗi đọc ảnh: ' + e.message };
  }
}
