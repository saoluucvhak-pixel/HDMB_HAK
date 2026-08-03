/**
 * ============================================================
 *  15_DraftHopDong.gs
 *  CƠ CHẾ NHÁP: mọi thao tác Tạo mới / Sửa hợp đồng (kể cả thêm/sửa/xóa Lô rừng,
 *  Tài khoản, Phụ lục, thêm điểm GPS mới) chỉ ghi vào sheet Draft_HopDong (1 dòng
 *  = 1 bản nháp, dữ liệu lưu dạng JSON). CHỈ KHI bấm "✅ Lưu chính thức" thì toàn
 *  bộ nháp mới được ghi thật vào HD_NCC / HD_RUNG / HD_STK / HD_GPS /
 *  PhuLucHopDong / ct_hopdong (tái sử dụng các hàm CRUD đã có ở 06_CreateUpdate.gs
 *  và 14_CtHopDong_PhuLuc.gs — hàm này chỉ ĐIỀU PHỐI, không viết lại logic ghi).
 *
 *  ⚠️ Ảnh hiện trường / Hồ sơ đính kèm (file) GIỮ NGUYÊN luồng "chờ duyệt" cũ
 *  (Draft_AnhRung, THEM_ANH_RUNG, TAI_LEN_HO_SO_RUNG) — KHÔNG đi qua Draft_HopDong,
 *  vì file cần ID thật (idHD/idRung) để lưu vào đúng thư mục Drive. Vì vậy 2 chức
 *  năng này chỉ mở khóa sau khi lô rừng đã có idRung THẬT (tức là hợp đồng/lô rừng
 *  đó đã từng được "Lưu chính thức" ít nhất 1 lần).
 * ============================================================
 */

const SHEET_DRAFT_HOPDONG = 'Draft_HopDong';
const DRAFT_HD_COL = { ID_DRAFT: 0, ID_HD_GOC: 1, JSON_DATA: 2, NGUOI_SUA: 3, THOI_GIAN_SUA: 4 };

function getOrCreateDraftHopDongSheet_() {
  const ss = getSS_();
  let sh = ss.getSheetByName(SHEET_DRAFT_HOPDONG);
  if (!sh) {
    sh = ss.insertSheet(SHEET_DRAFT_HOPDONG);
    const header = ['ID_Draft', 'ID_HD_Gốc (rỗng nếu tạo mới)', 'Dữ liệu (JSON)', 'Người sửa gần nhất', 'Thời gian sửa gần nhất'];
    sh.getRange(1, 1, 1, header.length).setValues([header]).setFontWeight('bold').setBackground('#34495e').setFontColor('#ffffff');
    sh.setColumnWidth(3, 500);
  }
  return sh;
}

function timDongDraft_(sh, idDraft) {
  const lastRow = sh.getLastRow();
  if (lastRow < 2) return -1;
  const ids = sh.getRange(2, DRAFT_HD_COL.ID_DRAFT + 1, lastRow - 1, 1).getValues();
  for (let i = 0; i < ids.length; i++) {
    if ((ids[i][0] || '').toString().trim() === idDraft.toString().trim()) return i + 2;
  }
  return -1;
}

/** Tạo 1 bản nháp TRẮNG cho hợp đồng MỚI (chưa có idHD). Trả về idDraft để front-end dùng cho các lần LUU_DRAFT tiếp theo. */
function TAO_DRAFT_MOI() {
  const idDraft = 'DRAFT_' + Utilities.getUuid().slice(0, 8).toUpperCase();
  const rong = { idHD: null, hopDong: {}, rung: [], taiKhoan: [], phuLuc: [] };
  const sh = getOrCreateDraftHopDongSheet_();
  const row = [];
  row[DRAFT_HD_COL.ID_DRAFT] = idDraft; row[DRAFT_HD_COL.ID_HD_GOC] = '';
  row[DRAFT_HD_COL.JSON_DATA] = JSON.stringify(rong);
  row[DRAFT_HD_COL.NGUOI_SUA] = Session.getActiveUser().getEmail() || '';
  row[DRAFT_HD_COL.THOI_GIAN_SUA] = new Date();
  sh.appendRow(row);
  return { idDraft: idDraft };
}

/** Tiện ích cho front-end: bấm 1 dòng trong danh sách -> mở/tạo nháp luôn trong 1 lượt gọi */
function MO_DRAFT_THEO_SO_DONG(soDong) {
  const hd = layHopDongTheoSoDong(soDong);
  if (!hd || hd.khongTimThay) return null;
  const ketQua = LAY_DRAFT_THEO_ID_HD(hd.idHD);
  if (ketQua) ketQua.tinhTrangGoc = hd.tinhTrang;
  return ketQua;
}

/**
 * Lấy bản nháp đang dở của 1 hợp đồng ĐÃ CÓ SẴN (mở để Sửa). Nếu hợp đồng này
 * chưa có nháp nào đang dở, TỰ TẠO 1 nháp mới bằng cách sao chép dữ liệu hiện
 * tại từ HD_NCC/HD_RUNG/HD_STK/PhuLucHopDong làm điểm bắt đầu (idRung/soDong
 * giữ nguyên = số THẬT, để khi Lưu chính thức biết là CẬP NHẬT chứ không phải
 * TẠO MỚI).
 */
function LAY_DRAFT_THEO_ID_HD(idHD) {
  const sh = getOrCreateDraftHopDongSheet_();
  const lastRow = sh.getLastRow();
  if (lastRow >= 2) {
    const data = sh.getRange(2, 1, lastRow - 1, sh.getLastColumn()).getValues();
    for (let i = 0; i < data.length; i++) {
      if ((data[i][DRAFT_HD_COL.ID_HD_GOC] || '').toString().trim() === idHD.toString().trim()) {
        return { idDraft: data[i][DRAFT_HD_COL.ID_DRAFT], du: JSON.parse(data[i][DRAFT_HD_COL.JSON_DATA]), moiTao: false };
      }
    }
  }
  // Chưa có nháp -> khởi tạo từ dữ liệu chính thức hiện tại
  const hd = layHopDongTheoIdHD_ChoDraft_(idHD);
  if (!hd) return null;
  const idDraft = 'DRAFT_' + idHD;
  const du = {
    idHD: idHD,
    hopDong: {
      tenChuRung: hd.tenChuRung, cccdChuRung: hd.cccdChuRung, soHD: hd.soHD, ngayKy: hd.ngayKy,
      ngayCap: hd.ngayCap, noiCap: hd.noiCap, sdtChuRung: hd.sdtChuRung, diaChiThuongTru: hd.diaChiThuongTru,
      tinhTrang: hd.tinhTrang, uyQuyenTT: hd.uyQuyenTT, tenUyQuyen: hd.tenUyQuyen, cccdUyQuyen: hd.cccdUyQuyen,
      ngayCapUyQuyen: hd.ngayCapUyQuyen, noiCapUyQuyen: hd.noiCapUyQuyen, sdtUyQuyen: hd.sdtUyQuyen, diaChiUyQuyen: hd.diaChiUyQuyen
    },
    rung: (hd.danhSachRung || []).map(function (r) {
      return { idRung: r.idRung, tempId: null, diaChiRung: r.diaChiRung, dienTichM2: r.dienTichM2, donGia: r.donGia,
        khoiLuongDuKien: r.khoiLuongDuKien, hoSoNguonGoc: r.hoSoNguonGoc, soGiayTo: r.soGiayTo, xoa: false, gpsMoi: [] };
    }),
    taiKhoan: (hd.danhSachTaiKhoan || []).map(function (t) {
      return { soDong: t.soDong, tempId: null, soTK: t.soTK, nganHang: t.nganHang, uyQuyenTT: t.uyQuyenTT, tenUyQuyen: t.tenUyQuyen, xoa: false };
    }),
    phuLuc: layDanhSachPhuLuc(idHD).map(function (p) {
      return { soDong: p.soDong, tempId: null, donGia: p.donGia, khoiLuong: p.khoiLuong, ghiChu: p.ghiChu, xoa: false };
    })
  };
  const row = [];
  row[DRAFT_HD_COL.ID_DRAFT] = idDraft; row[DRAFT_HD_COL.ID_HD_GOC] = idHD;
  row[DRAFT_HD_COL.JSON_DATA] = JSON.stringify(du);
  row[DRAFT_HD_COL.NGUOI_SUA] = Session.getActiveUser().getEmail() || '';
  row[DRAFT_HD_COL.THOI_GIAN_SUA] = new Date();
  sh.appendRow(row);
  return { idDraft: idDraft, du: du, moiTao: true };
}

/** Đọc lại thông tin hợp đồng hiện tại (dùng nội bộ để khởi tạo nháp) — không phụ thuộc UI */
function layHopDongTheoIdHD_ChoDraft_(idHD) {
  const nccRows = readData_(SHEET_NAME.HD_NCC);
  for (let i = 0; i < nccRows.length; i++) {
    if ((nccRows[i][NCC_COL.ID_HD] || '').toString().trim() === idHD.toString().trim()) {
      const soDong = i + 2;
      return layHopDongTheoSoDong(soDong);
    }
  }
  return null;
}

/** Ghi đè toàn bộ JSON của 1 bản nháp — gọi sau MỌI thay đổi ở màn hình (đổi field, thêm/sửa/xóa rừng-TK-phụ lục-GPS nháp) */
function LUU_DRAFT(idDraft, jsonDuLieu) {
  try {
    const sh = getOrCreateDraftHopDongSheet_();
    const soDong = timDongDraft_(sh, idDraft);
    if (soDong === -1) return { thanhCong: false, loi: 'Không tìm thấy bản nháp ' + idDraft + ' (có thể đã bị Lưu chính thức hoặc hủy ở tab khác).' };
    sh.getRange(soDong, DRAFT_HD_COL.JSON_DATA + 1).setValue(jsonDuLieu);
    sh.getRange(soDong, DRAFT_HD_COL.NGUOI_SUA + 1).setValue(Session.getActiveUser().getEmail() || '');
    sh.getRange(soDong, DRAFT_HD_COL.THOI_GIAN_SUA + 1).setValue(new Date());
    return { thanhCong: true };
  } catch (e) {
    return { thanhCong: false, loi: 'Lỗi lưu nháp: ' + e.message };
  }
}

/** Đọc lại 1 bản nháp theo idDraft (dùng khi tải lại trang / mở lại nháp dở) */
function LAY_DRAFT(idDraft) {
  const sh = getOrCreateDraftHopDongSheet_();
  const soDong = timDongDraft_(sh, idDraft);
  if (soDong === -1) return null;
  const r = sh.getRange(soDong, 1, 1, sh.getLastColumn()).getValues()[0];
  return { idDraft: r[DRAFT_HD_COL.ID_DRAFT], idHDGoc: r[DRAFT_HD_COL.ID_HD_GOC] || null, du: JSON.parse(r[DRAFT_HD_COL.JSON_DATA]) };
}

/** Hủy bản nháp (bấm "Hủy" hoặc rời trang mà không lưu) — không đụng gì tới bảng gốc */
function HUY_DRAFT(idDraft) {
  const sh = getOrCreateDraftHopDongSheet_();
  const soDong = timDongDraft_(sh, idDraft);
  if (soDong !== -1) sh.deleteRow(soDong);
  return { thanhCong: true };
}

/**
 * ✅ LƯU CHÍNH THỨC — điểm duy nhất ghi dữ liệu thật vào HD_NCC/HD_RUNG/HD_STK/
 * HD_GPS/PhuLucHopDong. Đọc JSON nháp, rồi lần lượt gọi lại đúng các hàm CRUD đã
 * có sẵn (để không phải viết lại logic tính mã, ghi log, cập nhật ct_hopdong...).
 * Xóa bản nháp sau khi ghi xong thành công.
 */
function LUU_CHINH_THUC(idDraft) {
  const sh = getOrCreateDraftHopDongSheet_();
  const soDong = timDongDraft_(sh, idDraft);
  if (soDong === -1) return { thanhCong: false, loi: 'Không tìm thấy bản nháp — có thể đã được lưu chính thức ở nơi khác.' };
  const r = sh.getRange(soDong, 1, 1, sh.getLastColumn()).getValues()[0];
  const du = JSON.parse(r[DRAFT_HD_COL.JSON_DATA]);

  if (!du.hopDong || !du.hopDong.tenChuRung || !du.hopDong.cccdChuRung || !du.hopDong.ngayKy) {
    return { thanhCong: false, loi: 'Thiếu Họ tên chủ rừng / CCCD hợp lệ / Ngày ký hợp đồng.' };
  }

  // 1) HỢP ĐỒNG (HD_NCC) — tạo mới hoặc cập nhật
  const ketQuaHD = LUU_HOP_DONG_DAY_DU({ idHD: du.idHD, soDong: null, hopDong: du.hopDong, rung: [], taiKhoan: [] });
  if (!ketQuaHD.thanhCong) return ketQuaHD;
  const idHD = ketQuaHD.idHD, soHD = ketQuaHD.soHD;

  const loiChiTiet = [];

  // 2) LÔ RỪNG — thêm mới / cập nhật / xóa, rồi ghi các điểm GPS mới thêm ở bản nháp
  (du.rung || []).forEach(function (rg) {
    if (rg.xoa) {
      if (rg.idRung) { const kq = XOA_LO_RUNG(rg.idRung); if (!kq.thanhCong) loiChiTiet.push('Xóa lô rừng ' + rg.idRung + ': ' + kq.loi); }
      return;
    }
    const dRung = {
      idHD: idHD, soHD: soHD, tenChuRung: du.hopDong.tenChuRung, cccd: du.hopDong.cccdChuRung,
      diaChiRung: rg.diaChiRung, dienTichM2: rg.dienTichM2, donGia: rg.donGia,
      khoiLuongDuKien: rg.khoiLuongDuKien, hoSoNguonGoc: rg.hoSoNguonGoc, soGiayTo: rg.soGiayTo
    };
    let idRungThat = rg.idRung;
    if (idRungThat) {
      const kq = CAP_NHAT_LO_RUNG(idRungThat, dRung);
      if (!kq.thanhCong) { loiChiTiet.push('Cập nhật lô rừng ' + idRungThat + ': ' + kq.loi); return; }
    } else {
      const kq = THEM_LO_RUNG_MOI(dRung);
      if (!kq.thanhCong) { loiChiTiet.push('Thêm lô rừng "' + rg.diaChiRung + '": ' + kq.loi); return; }
      idRungThat = kq.idRung;
    }
    (rg.gpsMoi || []).forEach(function (p) {
      const kqGps = CAP_NHAT_GPS_RUNG(idRungThat, { lat: p.lat, lng: p.lng, anhUrl: p.anhUrl || '' }, false);
      if (!kqGps.thanhCong) loiChiTiet.push('Thêm GPS cho ' + idRungThat + ': ' + kqGps.loi);
    });
  });

  // 3) TÀI KHOẢN — thêm mới / cập nhật / xóa
  (du.taiKhoan || []).forEach(function (tk) {
    if (tk.xoa) {
      if (tk.soDong) { const kq = XOA_TAI_KHOAN(tk.soDong); if (!kq.thanhCong) loiChiTiet.push('Xóa tài khoản dòng ' + tk.soDong + ': ' + kq.loi); }
      return;
    }
    const dTK = { idHD: idHD, soHD: soHD, tenChuRung: du.hopDong.tenChuRung, cccd: du.hopDong.cccdChuRung, soTK: tk.soTK, nganHang: tk.nganHang, uyQuyenTT: tk.uyQuyenTT, tenUyQuyen: tk.tenUyQuyen };
    const kq = tk.soDong ? CAP_NHAT_TAI_KHOAN(tk.soDong, dTK) : THEM_TAI_KHOAN_MOI(dTK);
    if (!kq.thanhCong) loiChiTiet.push('Tài khoản ' + (tk.soTK || '') + ': ' + kq.loi);
  });

  // 4) PHỤ LỤC HỢP ĐỒNG — thêm mới / cập nhật / xóa
  (du.phuLuc || []).forEach(function (pl) {
    if (pl.xoa) {
      if (pl.soDong) { const kq = XOA_PHU_LUC(pl.soDong); if (!kq.thanhCong) loiChiTiet.push('Xóa phụ lục dòng ' + pl.soDong + ': ' + kq.loi); }
      return;
    }
    const kq = LUU_PHU_LUC({ idHD: idHD, soHD: soHD, soDong: pl.soDong, donGia: pl.donGia, khoiLuong: pl.khoiLuong, ghiChu: pl.ghiChu });
    if (!kq.thanhCong) loiChiTiet.push('Phụ lục: ' + kq.loi);
  });

  CAP_NHAT_CT_HOPDONG_(idHD);
  sh.deleteRow(soDong); // xóa nháp sau khi đã ghi chính thức xong

  return { thanhCong: true, idHD: idHD, soHD: soHD, canhBao: loiChiTiet.length ? loiChiTiet : null };
}
