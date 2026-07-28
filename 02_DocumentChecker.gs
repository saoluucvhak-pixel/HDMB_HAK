/**
 * ============================================================
 *  02_DocumentChecker.gs
 *  KIỂM TRA HỒ SƠ PHÁP LÝ CỦA TỪNG HỢP ĐỒNG
 *  - CCCD chủ rừng (và người được ủy quyền nếu có ủy quyền)
 *  - Giấy chứng nhận QSDĐ / Đơn xác nhận UBND / Giấy xác nhận nguồn gốc
 *  - Giấy ủy quyền (bắt buộc nếu "Ủy quyền thanh toán" = Có)
 *  - File đính kèm minh chứng (DinhKemGiayTo) có tồn tại thật trên Drive không
 * ============================================================
 */

/** Kiểm tra định dạng CCCD Việt Nam: đúng 12 chữ số */
function laCCCDHopLe_(cccd) {
  if (!cccd) return false;
  const s = cccd.toString().trim();
  return /^\d{12}$/.test(s);
}

/**
 * Kiểm tra hồ sơ của MỘT dòng HD_RUNG (một lô rừng cụ thể).
 * Trả về { idKeyHD, maRung, thieu: [...], canhBao: [...], dat: true/false }
 */
function kiemTraHoSoMotLoRung_(row) {
  const thieu = [];
  const canhBao = [];

  // 1. CCCD chủ rừng
  const cccdChuRung = row[RUNG_COL.CCCD];
  if (!laCCCDHopLe_(cccdChuRung)) thieu.push('CCCD chủ rừng không hợp lệ/thiếu (' + cccdChuRung + ')');

  // 2. Loại hồ sơ nguồn gốc đất (GCN QSDĐ / Đơn xác nhận / Giấy xác nhận...)
  const hoSoNguonGoc = (row[RUNG_COL.HO_SO_NGUON_GOC] || '').toString().trim();
  if (!hoSoNguonGoc) {
    thieu.push('Chưa xác định loại hồ sơ nguồn gốc đất (GCN QSDĐ / Đơn xác nhận UBND / Giấy xác nhận...)');
  } else {
    const khopLoai = LOAI_HO_SO_HOP_LE.some(function (loai) {
      return hoSoNguonGoc.toLowerCase().indexOf(loai.toLowerCase()) !== -1;
    });
    if (!khopLoai) canhBao.push('Loại hồ sơ nguồn gốc đất chưa khớp danh mục chuẩn: "' + hoSoNguonGoc + '"');
  }

  // 3. Số giấy tờ (số hiệu văn bản)
  if (!row[RUNG_COL.SO_GIAY_TO]) thieu.push('Thiếu số giấy tờ/số hiệu văn bản nguồn gốc đất');

  // 4. File đính kèm minh chứng
  const dinhKem = (row[RUNG_COL.DINH_KEM_GIAY_TO] || '').toString().trim();
  if (!dinhKem) {
    thieu.push('Chưa đính kèm file scan giấy tờ nguồn gốc (PDF/ảnh)');
  } else if (!fileTonTaiTrenDrive_(dinhKem)) {
    thieu.push('File đính kèm "' + dinhKem + '" không tìm thấy trên Drive (đường dẫn/tên file sai hoặc đã bị xóa)');
  }

  return {
    idKeyHD: row[RUNG_COL.ID_KEY_HD],
    maRung: row[RUNG_COL.MA_RUNG],
    soHD: row[RUNG_COL.SO_HD],
    chuRung: row[RUNG_COL.TEN_CHU_RUNG],
    thieu: thieu,
    canhBao: canhBao,
    dat: thieu.length === 0
  };
}

/**
 * Kiểm tra hồ sơ ỦY QUYỀN + TÀI KHOẢN NHẬN TIỀN ở cấp hợp đồng (HD_NCC),
 * vì "Ủy quyền thanh toán" và CCCD người được ủy quyền nằm ở bảng cha.
 */
function kiemTraUyQuyenVaTaiKhoan_(rowNCC) {
  const thieu = [];
  const uyQuyen = (rowNCC[NCC_COL.UY_QUYEN_TT] || '').toString().trim().toLowerCase();
  const coUyQuyen = uyQuyen === 'có' || uyQuyen === 'co';

  if (coUyQuyen) {
    if (!laCCCDHopLe_(rowNCC[NCC_COL.CCCD_UY_QUYEN])) {
      thieu.push('Ủy quyền thanh toán = Có nhưng CCCD người được ủy quyền không hợp lệ/thiếu');
    }
    if (!rowNCC[NCC_COL.TEN_UY_QUYEN]) {
      thieu.push('Ủy quyền thanh toán = Có nhưng thiếu Họ tên người được ủy quyền (giấy ủy quyền)');
    }
    if (!rowNCC[NCC_COL.NOI_CAP_UQ]) {
      thieu.push('Thiếu nơi cấp CCCD của người được ủy quyền');
    }
  }
  if (!rowNCC[NCC_COL.SO_TK]) thieu.push('Thiếu số tài khoản nhận tiền');
  if (!rowNCC[NCC_COL.NGAN_HANG]) thieu.push('Thiếu tên ngân hàng thụ hưởng');

  return thieu;
}

/**
 * Kiểm tra 1 file (theo tên/đường dẫn lưu trong sheet) có thực sự tồn tại trên Drive.
 * Hỗ trợ 2 cách lưu phổ biến: đường dẫn dạng "Folder/ten_file.jpg" hoặc chỉ tên file.
 */
function fileTonTaiTrenDrive_(duongDan) {
  try {
    const tenFile = duongDan.split('/').pop();
    const it = DriveApp.getFilesByName(tenFile);
    return it.hasNext();
  } catch (e) {
    return false;
  }
}

/**
 * CHẠY KIỂM TRA hợp đồng (tất cả lô rừng + tất cả HD_NCC, hoặc lọc theo khoảng
 * ngày ký nếu truyền tuNgay/denNgay) và xuất kết quả ra sheet "BaoCao_KiemTra".
 */
function KIEM_TRA_HO_SO_TOAN_BO(tuNgay, denNgay) {
  let rungRows = readData_(SHEET_NAME.HD_RUNG);
  const nccRows = readData_(SHEET_NAME.HD_NCC);

  if (tuNgay || denNgay) {
    const tu = tuNgay ? new Date(tuNgay) : null;
    const den = denNgay ? new Date(denNgay) : null;
    rungRows = rungRows.filter(function (r) {
      const ngay = new Date(r[RUNG_COL.NGAY_KY]);
      if (tu && ngay < tu) return false;
      if (den && ngay > den) return false;
      return true;
    });
  }

  const nccById = {};
  nccRows.forEach(function (r) {
    const id = (r[NCC_COL.ID_HD] || '').toString().trim();
    if (id) nccById[id] = r;
  });

  const ketQua = [];
  rungRows.forEach(function (r) {
    const kq = kiemTraHoSoMotLoRung_(r);
    const idHD = kq.idKeyHD;
    const rowNCC = nccById[idHD];
    let thieuUyQuyen = [];
    if (rowNCC) thieuUyQuyen = kiemTraUyQuyenVaTaiKhoan_(rowNCC);
    else kq.canhBao.push('Không tìm thấy hợp đồng gốc tương ứng trong HD_NCC (ID_HD: ' + idHD + ')');

    const tatCaThieu = kq.thieu.concat(thieuUyQuyen);
    ketQua.push({
      idHD: idHD, soHD: kq.soHD, maRung: kq.maRung, chuRung: kq.chuRung,
      dat: tatCaThieu.length === 0,
      thieu: tatCaThieu.join(' | '),
      canhBao: kq.canhBao.join(' | ')
    });
  });

  // Xuất báo cáo
  const ss = getSS_();
  let sh = ss.getSheetByName(SHEET_NAME.BAO_CAO);
  if (sh) sh.clear(); else sh = ss.insertSheet(SHEET_NAME.BAO_CAO);

  const header = ['ID_HD', 'Số HĐ', 'Mã Rừng', 'Chủ rừng', 'Kết quả', 'Hồ sơ còn thiếu', 'Cảnh báo'];
  sh.getRange(1, 1, 1, header.length).setValues([header]).setFontWeight('bold').setBackground('#34495e').setFontColor('#ffffff');

  const rows = ketQua.map(function (k) {
    return [k.idHD, k.soHD, k.maRung, k.chuRung, k.dat ? '✅ Đầy đủ' : '❌ Thiếu hồ sơ', k.thieu, k.canhBao];
  });
  if (rows.length) sh.getRange(2, 1, rows.length, header.length).setValues(rows);

  // Tô màu dòng thiếu hồ sơ
  for (let i = 0; i < rows.length; i++) {
    if (!ketQua[i].dat) {
      sh.getRange(i + 2, 1, 1, header.length).setBackground('#fdecea');
    }
  }
  sh.autoResizeColumns(1, header.length);

  const soThieu = ketQua.filter(function (k) { return !k.dat; }).length;
  return 'Đã kiểm tra ' + ketQua.length + ' lô rừng — ' + soThieu + ' hồ sơ CÒN THIẾU. Xem chi tiết ở sheet "' + SHEET_NAME.BAO_CAO + '"';
}

/**
 * BÁO CÁO HỢP ĐỒNG — có bộ lọc + phân trang 20 dòng/trang + đánh dấu mức độ thiếu hồ sơ:
 *  - "do"   (đỏ)  : thiếu hồ sơ BẮT BUỘC — CCCD, hồ sơ nguồn gốc đất (GCN QSDĐ/xác nhận...),
 *                   giấy ủy quyền (nếu Ủy quyền thanh toán = Có)
 *  - "vang" (vàng): hồ sơ bắt buộc đã đủ, nhưng còn thiếu ảnh hiện trường hoặc tọa độ GPS
 *  - "binh_thuong": đầy đủ cả 2 mức trên
 *
 * boLoc = { tuNgay, denNgay (theo Ngày ký), soHD, tenChuRung, tenNguoiUyQuyen, diaChiRung }
 * (diaChiRung lọc kiểu "chứa chuỗi" vì dữ liệu hiện chỉ có 1 trường địa chỉ tự do,
 * không tách sẵn cột xã/huyện/tỉnh — gõ 1 phần tên xã/huyện/tỉnh để lọc gần đúng)
 */
/**
 * Tính chi tiết ĐẦY ĐỦ (chưa lọc/phân trang) cho TẤT CẢ hợp đồng — đây là phần
 * NẶNG (kiểm tra hồ sơ + tọa độ từng hợp đồng), nên được CACHE lại (xem
 * layHoacTinhBaoCao_ ở 00_Config.gs) và chỉ tính lại khi có thay đổi mới.
 */
function tinhChiTietBaoCaoHopDong_KhongCache_() {
  const nccRows = readData_(SHEET_NAME.HD_NCC);
  const rungRows = readData_(SHEET_NAME.HD_RUNG);
  const gpsRows = readData_(SHEET_NAME.HD_GPS);
  const pictureRows = readData_(SHEET_NAME.HD_PICTURE);

  const rungByHD = {};
  rungRows.forEach(function (r) {
    const idHD = (r[RUNG_COL.ID_KEY_HD] || '').toString().trim();
    if (!rungByHD[idHD]) rungByHD[idHD] = [];
    rungByHD[idHD].push(r);
  });
  const gpsByIdRung = {};
  gpsRows.forEach(function (g) {
    const idRung = (g[GPS_COL.ID_KEY_GPS] || '').toString().trim();
    if (!gpsByIdRung[idRung]) gpsByIdRung[idRung] = [];
    gpsByIdRung[idRung].push(g);
  });

  function toaDoTrungBinhHopDong(idHD) {
    const cacIdRung = (rungByHD[idHD] || []).map(function (r) { return (r[RUNG_COL.ID_RUNG] || '').toString().trim(); });
    let latTong = 0, lngTong = 0, dem = 0;
    cacIdRung.forEach(function (idRung) {
      (gpsByIdRung[idRung] || []).forEach(function (g) {
        const type = g[GPS_COL.HE_TOA_DO];
        const lat = (type === 'DMS') ? convertDmsToDd(g[GPS_COL.LAT]) : parseFloat(g[GPS_COL.LAT]);
        const lng = (type === 'DMS') ? convertDmsToDd(g[GPS_COL.LNG]) : parseFloat(g[GPS_COL.LNG]);
        if (!isNaN(lat) && !isNaN(lng)) { latTong += lat; lngTong += lng; dem++; }
      });
    });
    return dem ? { lat: latTong / dem, lng: lngTong / dem } : null;
  }

  function layAnhTheoIdHD_Cache_(idHD) {
    const ketQua = [];
    pictureRows.forEach(function (r) {
      if ((r[PICTURE_COL.ID_HD] || '').toString().trim() !== idHD.toString().trim()) return;
      for (let c = PICTURE_COL.PICTURE_START; c <= PICTURE_COL.PICTURE_END; c++) {
        const link = resolveDriveLink_(r[c]);
        if (link) ketQua.push(link);
      }
    });
    return ketQua;
  }

  return nccRows.map(function (r) {
    const idHD = (r[NCC_COL.ID_HD] || '').toString().trim();
    const cacLoRung = rungByHD[idHD] || [];
    const thieuDo = [];
    const thieuVang = [];

    cacLoRung.forEach(function (rung) {
      const kq = kiemTraHoSoMotLoRung_(rung);
      thieuDo.push.apply(thieuDo, kq.thieu);
      if (!(Number(rung[RUNG_COL.DIEN_TICH_GPS]) > 0)) thieuVang.push(rung[RUNG_COL.ID_RUNG] + ': chưa đo GPS');
    });
    thieuDo.push.apply(thieuDo, kiemTraUyQuyenVaTaiKhoan_(r));
    if (!layAnhTheoIdHD_Cache_(idHD).length) thieuVang.push('Chưa có ảnh hiện trường');

    let mucDo = 'binh_thuong';
    if (thieuDo.length) mucDo = 'do'; else if (thieuVang.length) mucDo = 'vang';

    return {
      idHD: idHD, soHD: r[NCC_COL.SO_HD], ngayKy: r[NCC_COL.NGAY_KY], tenChuRung: r[NCC_COL.TEN_CHU_RUNG],
      tenUyQuyen: r[NCC_COL.TEN_UY_QUYEN], diaChiRung: r[NCC_COL.DIA_CHI_RUNG], tinhTrang: r[NCC_COL.TINH_TRANG],
      toaDo: toaDoTrungBinhHopDong(idHD),
      mucDo: mucDo, thieuDo: thieuDo, thieuVang: thieuVang
    };
  });
}

/**
 * Báo cáo hợp đồng cho webapp: đọc TOÀN BỘ chi tiết từ CACHE (rất nhanh, chỉ
 * tính lại nếu có thay đổi dữ liệu mới — xem layHoacTinhBaoCao_), rồi mới lọc
 * + phân trang theo bộ lọc người dùng (lọc trong bộ nhớ, cực nhanh, không đọc
 * lại sheet). Đây là báo cáo TỔNG HỢP hồ sơ + tọa độ của TẤT CẢ hợp đồng, mục
 * đích: nhanh chóng thấy hợp đồng nào thiếu hồ sơ bắt buộc (dòng đỏ)/thiếu
 * ảnh-GPS (dòng vàng) để bổ sung, không cần rà từng hợp đồng thủ công.
 */
function layBaoCaoHopDongPhanTrang(boLoc, trang, kichThuoc, boBuoc) {
  boLoc = boLoc || {};
  trang = trang || 1;
  kichThuoc = kichThuoc || 20;

  const ketQuaCache = layHoacTinhBaoCao_('baoCaoHopDong', tinhChiTietBaoCaoHopDong_KhongCache_, boBuoc);
  const tatCa = ketQuaCache.duLieu;

  const tuNgay = boLoc.tuNgay ? new Date(boLoc.tuNgay) : null;
  const denNgay = boLoc.denNgay ? new Date(boLoc.denNgay) : null;
  const chuaLoc = function (s, tk) { return !tk || (s || '').toString().toLowerCase().indexOf(tk.toLowerCase()) !== -1; };

  const loc = tatCa.filter(function (r) {
    const ngayKy = new Date(r.ngayKy);
    if (tuNgay && ngayKy < tuNgay) return false;
    if (denNgay && ngayKy > denNgay) return false;
    if (!chuaLoc(r.soHD, boLoc.soHD)) return false;
    if (!chuaLoc(r.tenChuRung, boLoc.tenChuRung)) return false;
    if (!chuaLoc(r.tenUyQuyen, boLoc.tenNguoiUyQuyen)) return false;
    if (!chuaLoc(r.diaChiRung, boLoc.diaChiRung)) return false;
    const tinhTrang = (r.tinhTrang || 'Đang thực hiện').toString().trim();
    if (boLoc.tinhTrang && boLoc.tinhTrang !== 'Tất cả' && tinhTrang !== boLoc.tinhTrang) return false;
    return true;
  });

  const tongSo = loc.length;
  const tongTrang = Math.max(1, Math.ceil(tongSo / kichThuoc));
  trang = Math.min(Math.max(1, trang), tongTrang);
  const batDau = (trang - 1) * kichThuoc;

  return { items: loc.slice(batDau, batDau + kichThuoc), trang: trang, tongTrang: tongTrang, tongSo: tongSo, tuCache: ketQuaCache.tuCache };
}

/**
 * Lấy danh sách hồ sơ (từng lô rừng) KÈM LINK DRIVE bấm mở được, dùng cho trang
 * webapp "Kiểm tra hồ sơ" — để người dùng bấm xem file DinhKemGiayTo trực tiếp
 * thay vì chỉ xem kết quả tổng hợp trong sheet.
 */
function layDuLieuKiemTraHoSoWebapp() {
  const rungRows = readData_(SHEET_NAME.HD_RUNG);
  const nccRows = readData_(SHEET_NAME.HD_NCC);
  const nccById = {};
  nccRows.forEach(function (r) {
    const id = (r[NCC_COL.ID_HD] || '').toString().trim();
    if (id) nccById[id] = r;
  });

  return rungRows.map(function (r) {
    const kq = kiemTraHoSoMotLoRung_(r);
    const idHD = kq.idKeyHD;
    const rowNCC = nccById[idHD];
    const thieuUyQuyen = rowNCC ? kiemTraUyQuyenVaTaiKhoan_(rowNCC) : [];
    const tatCaThieu = kq.thieu.concat(thieuUyQuyen);
    return {
      idHD: idHD, idRung: kq.maRung, soHD: kq.soHD, chuRung: kq.chuRung,
      cccd: r[RUNG_COL.CCCD], hoSoNguonGoc: r[RUNG_COL.HO_SO_NGUON_GOC], soGiayTo: r[RUNG_COL.SO_GIAY_TO],
      dinhKem: resolveDriveLink_(r[RUNG_COL.DINH_KEM_GIAY_TO]),
      dat: tatCaThieu.length === 0, thieu: tatCaThieu
    };
  });
}

/**
 * Lấy toàn bộ ảnh (Picture1..10) của mọi hợp đồng KÈM LINK DRIVE bấm mở được,
 * dùng cho trang webapp "Kiểm tra ảnh (đã lưu)".
 */
function layDuLieuAnhWebapp() {
  const rows = readData_(SHEET_NAME.HD_PICTURE);
  const nccRows = readData_(SHEET_NAME.HD_NCC);
  const soHDById = {};
  nccRows.forEach(function (r) {
    const id = (r[NCC_COL.ID_HD] || '').toString().trim();
    if (id) soHDById[id] = r[NCC_COL.SO_HD];
  });

  const ketQua = [];
  rows.forEach(function (r) {
    const idHD = (r[PICTURE_COL.ID_HD] || '').toString().trim();
    if (!idHD) return;
    for (let c = PICTURE_COL.PICTURE_START; c <= PICTURE_COL.PICTURE_END; c++) {
      const link = resolveDriveLink_(r[c]);
      if (link) ketQua.push({ idHD: idHD, soHD: soHDById[idHD] || '', chuRung: r[PICTURE_COL.TEN_CHU_RUNG], tenFile: link.ten, url: link.url });
    }
  });
  return ketQua;
}

/**
 * Kiểm tra dấu hiệu chỉnh sửa/lệch GPS cho MỘT DANH SÁCH ảnh CỤ THỂ (đã chọn
 * bằng checkbox trên webapp) — thay vì luôn phải chạy toàn bộ ảnh trong hệ thống.
 * duongDanList = [{ url, idHD }]
 */
function KIEM_TRA_ANH_DA_CHON(duongDanList) {
  const rungRows = readData_(SHEET_NAME.HD_RUNG);
  const rungByHD = {};
  rungRows.forEach(function (r) {
    const idHD = (r[RUNG_COL.ID_KEY_HD] || '').toString().trim();
    if (!rungByHD[idHD]) rungByHD[idHD] = [];
    rungByHD[idHD].push(r);
  });

  function toaDoTrungBinhCuaHD(idHD) {
    const cacRung = rungByHD[idHD] || [];
    const rows = readData_(SHEET_NAME.HD_GPS).filter(function (g) {
      return cacRung.some(function (r) { return (r[RUNG_COL.ID_RUNG] || '').toString().trim() === (g[GPS_COL.ID_KEY_GPS] || '').toString().trim(); });
    });
    if (!rows.length) return null;
    let latTong = 0, lngTong = 0, dem = 0;
    rows.forEach(function (g) {
      const type = g[GPS_COL.HE_TOA_DO];
      const lat = (type === 'DMS') ? convertDmsToDd(g[GPS_COL.LAT]) : parseFloat(g[GPS_COL.LAT]);
      const lng = (type === 'DMS') ? convertDmsToDd(g[GPS_COL.LNG]) : parseFloat(g[GPS_COL.LNG]);
      if (!isNaN(lat) && !isNaN(lng)) { latTong += lat; lngTong += lng; dem++; }
    });
    return dem ? { lat: latTong / dem, lng: lngTong / dem } : null;
  }

  const nccRows = readData_(SHEET_NAME.HD_NCC);
  const nccById = {};
  nccRows.forEach(function (r) {
    const idHD = (r[NCC_COL.ID_HD] || '').toString().trim();
    if (idHD) nccById[idHD] = r;
  });

  return duongDanList.map(function (item) {
    const idHDChuan = (item.idHD || '').toString().trim();
    const toaDo = toaDoTrungBinhCuaHD(idHDChuan);
    const kq = kiemTraMotAnh(item.url, toaDo ? toaDo.lat : null, toaDo ? toaDo.lng : null);
    const rowNCC = nccById[idHDChuan];
    return {
      url: item.url, idHD: item.idHD, tenFile: item.tenFile || item.url.split('/').pop(),
      chuRung: rowNCC ? rowNCC[NCC_COL.TEN_CHU_RUNG] : '', diaChiRung: rowNCC ? rowNCC[NCC_COL.DIA_CHI_RUNG] : '',
      toaDo: toaDo, nguonToaDo: kq.nguonToaDo, diaChiTrenAnh: kq.diaChiTrenAnh, ketLuan: kq.ketLuan, dauHieu: kq.dauHieu.join(' | ')
    };
  });
}
