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
 * @param {boolean} boQuaKiemTraDrive - true = KHÔNG gọi DriveApp (nhanh, chỉ kiểm tra có điền
 *   tên file đính kèm hay chưa) — dùng cho các KPI/tổng hợp tự chạy mỗi lần tải trang (nhiều
 *   dòng, không thể chờ gọi Drive API tuần tự cho từng dòng). Khi cần XÁC MINH file có THẬT
 *   SỰ tồn tại trên Drive hay không (đúng/đủ 100%), dùng false — chỉ nên dùng cho hành động
 *   thủ công, chạy ít lần (vd: "Kiểm tra hồ sơ pháp lý" ở menu).
 */
function kiemTraHoSoMotLoRung_(row, boQuaKiemTraDrive) {
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
  } else if (!boQuaKiemTraDrive && !fileTonTaiTrenDrive_(dinhKem)) {
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
  const coLoc = !!(tuNgay || denNgay); // có lọc theo ngày hay không — ảnh hưởng việc dọn dòng cũ

  if (coLoc) {
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

  // ---- Cập nhật TỪNG PHẦN vào sheet (KHÔNG xóa hết mỗi lần chạy) ----
  const ss = getSS_();
  let sh = ss.getSheetByName(SHEET_NAME.BAO_CAO);
  const header = ['ID_HD', 'Số HĐ', 'Mã Rừng', 'Chủ rừng', 'Kết quả', 'Hồ sơ còn thiếu', 'Cảnh báo'];
  if (!sh) {
    sh = ss.insertSheet(SHEET_NAME.BAO_CAO);
    sh.getRange(1, 1, 1, header.length).setValues([header]).setFontWeight('bold').setBackground('#34495e').setFontColor('#ffffff');
  }

  // Đọc danh sách Mã Rừng đã có sẵn trong sheet (cột C) để biết dòng nào cập nhật, dòng nào thêm mới
  const lastRow = sh.getLastRow();
  const maRungTheoDong = {}; // { maRung: soDong }
  if (lastRow >= 2) {
    const cotMaRung = sh.getRange(2, 3, lastRow - 1, 1).getValues();
    cotMaRung.forEach(function (r, i) {
      const mr = (r[0] || '').toString().trim();
      if (mr) maRungTheoDong[mr] = i + 2;
    });
  }

  const maRungDaXuLy = {};
  ketQua.forEach(function (k) {
    const dong = [k.idHD, k.soHD, k.maRung, k.chuRung, k.dat ? '✅ Đầy đủ' : '❌ Thiếu hồ sơ', k.thieu, k.canhBao];
    const mauNen = k.dat ? '#ffffff' : '#fdecea';
    const soDongDaCo = maRungTheoDong[k.maRung];
    if (soDongDaCo) {
      sh.getRange(soDongDaCo, 1, 1, header.length).setValues([dong]).setBackground(mauNen);
    } else {
      sh.appendRow(dong);
      sh.getRange(sh.getLastRow(), 1, 1, header.length).setBackground(mauNen);
    }
    maRungDaXuLy[k.maRung] = true;
  });

  // Dọn dòng của lô rừng ĐÃ BỊ XÓA khỏi HD_RUNG — CHỈ làm việc này khi chạy KHÔNG lọc
  // theo ngày (chạy đầy đủ), vì nếu có lọc thì không biết chắc lô rừng nào thật sự
  // đã bị xóa hay chỉ đang nằm ngoài khoảng lọc.
  let soDaXoa = 0;
  if (!coLoc) {
    const dongCanXoa = Object.keys(maRungTheoDong)
      .filter(function (mr) { return !maRungDaXuLy[mr]; })
      .map(function (mr) { return maRungTheoDong[mr]; })
      .sort(function (a, b) { return b - a; }); // xóa từ dưới lên để không lệch số dòng
    dongCanXoa.forEach(function (soDong) { sh.deleteRow(soDong); soDaXoa++; });
  }

  sh.autoResizeColumns(1, header.length);

  const soThieu = ketQua.filter(function (k) { return !k.dat; }).length;
  return 'Đã kiểm tra ' + ketQua.length + ' lô rừng — ' + soThieu + ' hồ sơ CÒN THIẾU' +
    (soDaXoa ? ' (đã dọn ' + soDaXoa + ' dòng của lô rừng không còn tồn tại)' : '') +
    '. Xem chi tiết ở sheet "' + SHEET_NAME.BAO_CAO + '"';
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
 * Báo cáo hợp đồng cho webapp: đọc TOÀN BỘ chi tiết từ CACHE (rất nhanh, chỉ
 * tính lại nếu có thay đổi dữ liệu mới — xem layHoacTinhBaoCao_), rồi mới lọc
 * + phân trang theo bộ lọc người dùng (lọc trong bộ nhớ, cực nhanh, không đọc
 * lại sheet). Đây là báo cáo TỔNG HỢP hồ sơ + tọa độ của TẤT CẢ hợp đồng, mục
 * đích: nhanh chóng thấy hợp đồng nào thiếu hồ sơ bắt buộc (dòng đỏ)/thiếu
 * ảnh-GPS (dòng vàng) để bổ sung, không cần rà từng hợp đồng thủ công.
 */
function layBaoCaoHopDongPhanTrang(boLoc, trang, kichThuoc, boBuoc) {
  try {
    boLoc = boLoc || {};
    trang = trang || 1;
    kichThuoc = kichThuoc || 20;

    if (boBuoc) LAM_MOI_DRAFT_THEO_THAY_DOI(); // chỉ cập nhật hợp đồng CÓ THAY ĐỔI, không tính lại toàn bộ từ đầu

    const tatCa = docToanBoDraftBaoCao_().map(function (m) {
      const toaDo = m.toaDoTrungBinh ? (function () {
        const p = m.toaDoTrungBinh.split(',');
        return { lat: parseFloat(p[0]), lng: parseFloat(p[1]) };
      })() : null;
      const thieuDo = m.thieuHoSoChiTiet ? m.thieuHoSoChiTiet.split('; ').filter(Boolean) : [];
      const thieuVang = [];
      if (!m.daDoGPSDu) thieuVang.push('Chưa đo đủ tọa độ GPS');
      if (!m.coAnh) thieuVang.push('Chưa có ảnh hiện trường');
      let mucDo = 'binh_thuong';
      if (thieuDo.length) mucDo = 'do'; else if (thieuVang.length) mucDo = 'vang';
      return {
        idHD: m.idHD, soHD: m.soHD, ngayKy: m.ngayKy, tenChuRung: m.tenChuRung,
        cccdChuRung: m.cccdChuRung, tenUyQuyen: m.tenUyQuyen,
        soTaiKhoan: m.soTaiKhoan, soLoRung: m.soLoRung,
        khoiLuongDuKien: m.khoiLuongDuKien, khoiLuongThucHien: m.khoiLuongThucHien,
        giaTriHopDong: m.giaTriHopDong, giaTriThucHien: m.giaTriThucHien,
        thucHienTuNgay: m.thucHienTuNgay, thucHienDenNgay: m.thucHienDenNgay,
        coAnh: m.coAnh, daDoGPSDu: m.daDoGPSDu, hoSoDu: m.hoSoDu,
        diaChiRung: m.diaChiRung, tinhTrang: m.tinhTrang,
        toaDo: toaDo, mucDo: mucDo, thieuDo: thieuDo, thieuVang: thieuVang
      };
    });

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

    return { items: loc.slice(batDau, batDau + kichThuoc), trang: trang, tongTrang: tongTrang, tongSo: tongSo, tuCache: !boBuoc };
  } catch (e) {
    ghiLoiBackend_('layBaoCaoHopDongPhanTrang', e);
    throw new Error('layBaoCaoHopDongPhanTrang lỗi: ' + e.message);
  }
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
    // Bỏ qua kiểm tra Drive (chậm, gọi API cho từng dòng) — bảng này TỰ TẢI mỗi lần
    // mở trang nên cần nhanh. Muốn xác minh chính xác file có tồn tại trên Drive
    // hay không, dùng nút "⚙️ Chạy kiểm tra đầy đủ" (ghi vào sheet BaoCao_KiemTra).
    const kq = kiemTraHoSoMotLoRung_(r, true);
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
