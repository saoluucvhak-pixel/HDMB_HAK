/**
 * ============================================================
 *  01_ContractManager.gs
 *  TỔNG HỢP HỢP ĐỒNG: khối lượng, giá trị, diện tích, số rừng,
 *  số tài khoản nhận tiền theo từng ID_HD (quan hệ 1-nhiều).
 * ============================================================
 */

/**
 * Gom toàn bộ HD_RUNG + HD_STK theo ID_KEY_HD / ID_HD và tính:
 *  - Tổng khối lượng dự kiến (m3/tấn tùy đơn vị nhập)
 *  - Tổng giá trị = SUM(DonGia * KhoiLuongDuKien) theo từng lô rừng
 *  - Tổng diện tích ký hợp đồng & diện tích đo GPS thực tế
 *  - Số lô rừng, số tài khoản nhận tiền của hợp đồng
 * Trả về object map: { [ID_HD]: {...} }
 */
/** Wrapper có cache — dùng bản này ở mọi nơi thay vì gọi tongHopHopDong_KhongCache trực tiếp */
function tongHopHopDong(dungDNTT, boBuoc) {
  const tenCache = 'tongHopHopDong_' + (dungDNTT !== false ? 'dntt' : 'nodntt');
  return layHoacTinhBaoCao_(tenCache, function () { return tongHopHopDong_KhongCache(dungDNTT); }, boBuoc).duLieu;
}

function tongHopHopDong_KhongCache(dungDNTT) {
  const rungRows = readData_(SHEET_NAME.HD_RUNG);
  const stkRows  = readData_(SHEET_NAME.HD_STK);
  const map = {};

  rungRows.forEach(function (r) {
    const idHD = (r[RUNG_COL.ID_KEY_HD] || '').toString().trim();
    if (!idHD) return;
    if (!map[idHD]) {
      map[idHD] = {
        idHD: idHD,
        soHD: r[RUNG_COL.SO_HD],
        chuRung: r[RUNG_COL.TEN_CHU_RUNG],
        soLoRung: 0,
        tongDienTichKy: 0,
        tongDienTichGPS: 0,
        tongKhoiLuongDuKien: 0,
        tongGiaTri: 0,
        tongKhoiLuongThucHien: 0,
        tongGiaTriThucHien: 0,
        soTaiKhoan: 0,
        chenhLechDienTich: 0,       // DienTichGPS - DienTichKy (âm = đo thực tế nhỏ hơn hợp đồng)
        chenhLechDienTichPhanTram: 0
      };
    }
    const m = map[idHD];
    const dienTichKy = Number(r[RUNG_COL.DIEN_TICH_M2]) || 0;
    const dienTichGPS = Number(r[RUNG_COL.DIEN_TICH_GPS]) || 0;
    const donGia = Number(r[RUNG_COL.DON_GIA]) || 0;
    const khoiLuong = Number(r[RUNG_COL.KHOI_LUONG_DK]) || 0;
    const khoiLuongThucHien = Number(r[RUNG_COL.KHOI_LUONG_THUC_HIEN]) || 0; // cột mở rộng, mặc định 0 nếu chưa nhập

    m.soLoRung += 1;
    m.tongDienTichKy += dienTichKy;
    m.tongDienTichGPS += dienTichGPS;
    m.tongKhoiLuongDuKien += khoiLuong;
    m.tongGiaTri += donGia * khoiLuong;
    m.tongKhoiLuongThucHien += khoiLuongThucHien;
    m.tongGiaTriThucHien += donGia * khoiLuongThucHien;
  });

  stkRows.forEach(function (r) {
    const idHD = (r[STK_COL.ID_HD] || '').toString().trim();
    if (idHD && map[idHD]) map[idHD].soTaiKhoan += 1;
  });

  Object.keys(map).forEach(function (idHD) {
    const m = map[idHD];
    m.chenhLechDienTich = m.tongDienTichGPS - m.tongDienTichKy;
    m.chenhLechDienTichPhanTram = m.tongDienTichKy
      ? Number((m.chenhLechDienTich / m.tongDienTichKy * 100).toFixed(2))
      : 0;
    m.khoiLuongConLai = m.tongKhoiLuongDuKien - m.tongKhoiLuongThucHien;
    m.giaTriConLai = m.tongGiaTri - m.tongGiaTriThucHien;
    m.nguonDuLieuThucHien = 'HD_RUNG (KhoiLuongThucHien tự nhập)';
  });

  // ⚠️ TẠM NGỪNG tự động đè bằng DNTT_GK_DN_CT — lần trước tự dò cột bị SAI (số liệu
  // ra âm/lệch hàng nghìn lần), gây sai cả báo cáo. Giờ chỉ dùng khi gọi
  // tongHopHopDong(true) tường minh (sau khi đã xem trước và xác nhận cột đúng qua
  // layXemTruocDNTT() — xem 06_CreateUpdate.gs). Mặc định vẫn dùng cột
  // KhoiLuongThucHien tự nhập trong HD_RUNG (an toàn, không tự đoán sai).
  // Đã xác nhận cột đúng qua "Xem trước dữ liệu DNTT" (Số HĐ, Khối lượng, Giá trị) — BẬT MẶC ĐỊNH.
  // Chỉ tắt khi gọi tongHopHopDong(false) tường minh (vd nếu sau này phát hiện lại sai cột).
  if (dungDNTT !== false) {
    const dntt = layDuLieuThucHienTuDNTT_();
    if (dntt.thanhCong) {
      Object.keys(map).forEach(function (idHD) {
        const m = map[idHD];
        const soHDChuan = (m.soHD || '').toString().trim();
        const khop = dntt.theoSoHD[soHDChuan];
        if (khop) {
          m.tongKhoiLuongThucHien = khop.khoiLuong;
          m.tongGiaTriThucHien = khop.giaTri;
          m.khoiLuongConLai = m.tongKhoiLuongDuKien - m.tongKhoiLuongThucHien;
          m.giaTriConLai = m.tongGiaTri - m.tongGiaTriThucHien;
          m.nguonDuLieuThucHien = 'DNTT_GK_DN_CT (thực tế, đã xác nhận cột)';
        }
      });
    }
  }

  return map;
}

/**
 * Xuất bảng tổng hợp ra 1 sheet "TongHop_HopDong" (tạo mới hoặc ghi đè),
 * để người dùng xem tổng khối lượng / giá trị / chênh lệch diện tích GPS
 * theo từng hợp đồng mà không cần cộng tay.
 */
function xuatBaoCaoTongHopHopDong() {
  const map = tongHopHopDong();
  const ss = getSS_();
  const sheetName = 'TongHop_HopDong';
  let sh = ss.getSheetByName(sheetName);
  if (sh) sh.clear(); else sh = ss.insertSheet(sheetName);

  const header = [
    'ID_HD', 'Số HĐ', 'Chủ rừng', 'Số lô rừng', 'Số TK nhận tiền',
    'Tổng DT ký (m2)', 'Tổng DT GPS (m2)', 'Chênh lệch DT (m2)', 'Chênh lệch (%)',
    'Tổng khối lượng dự kiến', 'Tổng giá trị hợp đồng (VNĐ)'
  ];
  const rows = Object.keys(map).map(function (idHD) {
    const m = map[idHD];
    return [
      m.idHD, m.soHD, m.chuRung, m.soLoRung, m.soTaiKhoan,
      m.tongDienTichKy, m.tongDienTichGPS, m.chenhLechDienTich, m.chenhLechDienTichPhanTram,
      m.tongKhoiLuongDuKien, m.tongGiaTri
    ];
  });

  sh.getRange(1, 1, 1, header.length).setValues([header]).setFontWeight('bold').setBackground('#34495e').setFontColor('#ffffff');
  if (rows.length) sh.getRange(2, 1, rows.length, header.length).setValues(rows);
  sh.autoResizeColumns(1, header.length);
  return 'OK - Đã xuất ' + rows.length + ' hợp đồng vào sheet "' + sheetName + '"';
}

/**
 * Bản tóm tắt KPI cho webapp (trang Báo cáo tổng hợp): số hợp đồng, tổng khối
 * lượng, tổng giá trị, kèm danh sách chi tiết để hiển thị bảng.
 */
function layTongHopChoWebapp(boBuoc) {
  const map = tongHopHopDong(true, boBuoc);
  const ngayCan = layNgayCanMinMaxTheoHopDong_();
  const list = Object.keys(map).map(function (k) {
    const m = map[k];
    const soHDChuan = (m.soHD || '').toString().trim();
    const nc = (ngayCan.thanhCong && ngayCan.theoSoHD[soHDChuan]) || null;
    m.thucHienTuNgay = nc && nc.tuNgay ? nc.tuNgay : null;
    m.thucHienDenNgay = nc && nc.denNgay ? nc.denNgay : null;
    return m;
  });
  const tongKhoiLuong = list.reduce(function (s, m) { return s + m.tongKhoiLuongDuKien; }, 0);
  const tongGiaTri = list.reduce(function (s, m) { return s + m.tongGiaTri; }, 0);
  return {
    soHopDong: list.length,
    tongKhoiLuong: tongKhoiLuong,
    tongGiaTri: tongGiaTri,
    chiTiet: list.sort(function (a, b) { return (b.soHD || 0) - (a.soHD || 0); })
  };
}

/**
 * TÌNH HÌNH THỰC HIỆN HỢP ĐỒNG: gộp trạng thái (HD_NCC.TinhTrang), tiến độ đo
 * đạc GPS thực tế, đã có ảnh hiện trường chưa, hồ sơ pháp lý đã đủ chưa —
 * cho từng hợp đồng, kèm số liệu tổng hợp để hiển thị KPI trên webapp.
 */
function layTinhHinhThucHien() {
  const nccRows = readData_(SHEET_NAME.HD_NCC);
  const rungRows = readData_(SHEET_NAME.HD_RUNG);
  const pictureRows = readData_(SHEET_NAME.HD_PICTURE);

  // Nhóm lô rừng theo hợp đồng để tính đã đo GPS đủ chưa + hồ sơ đủ chưa
  const rungByHD = {};
  rungRows.forEach(function (r) {
    const idHD = (r[RUNG_COL.ID_KEY_HD] || '').toString().trim();
    if (!idHD) return;
    if (!rungByHD[idHD]) rungByHD[idHD] = [];
    rungByHD[idHD].push(r);
  });

  // Hợp đồng nào có ít nhất 1 ảnh trong HD_Picture
  const coAnhByHD = {};
  pictureRows.forEach(function (r) {
    const idHD = (r[PICTURE_COL.ID_HD] || '').toString().trim();
    if (!idHD) return;
    for (let c = PICTURE_COL.PICTURE_START; c <= PICTURE_COL.PICTURE_END; c++) {
      if (r[c]) { coAnhByHD[idHD] = true; break; }
    }
  });

  const chiTiet = nccRows.map(function (r) {
    const idHD = (r[NCC_COL.ID_HD] || '').toString().trim();
    const cacLoRung = rungByHD[idHD] || [];
    const tongLo = cacLoRung.length;
    const soLoDaDoGPS = cacLoRung.filter(function (lo) { return Number(lo[RUNG_COL.DIEN_TICH_GPS]) > 0; }).length;
    const soLoDuHoSo = cacLoRung.filter(function (lo) { return kiemTraHoSoMotLoRung_(lo).dat; }).length;

    return {
      idHD: idHD,
      soHD: r[NCC_COL.SO_HD],
      chuRung: r[NCC_COL.TEN_CHU_RUNG],
      tinhTrang: r[NCC_COL.TINH_TRANG] || 'Đang thực hiện',
      tongLoRung: tongLo,
      soLoDaDoGPS: soLoDaDoGPS,
      daDoGPSDuChua: tongLo > 0 && soLoDaDoGPS === tongLo,
      soLoDuHoSo: soLoDuHoSo,
      hoSoDuChua: tongLo > 0 && soLoDuHoSo === tongLo,
      coAnh: !!coAnhByHD[idHD]
    };
  });

  // Đếm theo trạng thái
  const theoTrangThai = {};
  chiTiet.forEach(function (c) {
    theoTrangThai[c.tinhTrang] = (theoTrangThai[c.tinhTrang] || 0) + 1;
  });

  return {
    tongSoHopDong: chiTiet.length,
    theoTrangThai: theoTrangThai,
    soHDDaDoGPSDu: chiTiet.filter(function (c) { return c.daDoGPSDuChua; }).length,
    soHDDuHoSo: chiTiet.filter(function (c) { return c.hoSoDuChua; }).length,
    soHDCoAnh: chiTiet.filter(function (c) { return c.coAnh; }).length,
    chiTiet: chiTiet
  };
}
/**
 * Cảnh báo các hợp đồng có chênh lệch diện tích GPS thực tế so với diện tích
 * ký kết vượt ngưỡng % cho trước (mặc định 15%) — dấu hiệu cần kiểm tra lại đo đạc.
 */
function canhBaoChenhLechDienTich(nguongPhanTram) {
  nguongPhanTram = nguongPhanTram || 15;
  const map = tongHopHopDong();
  return Object.keys(map)
    .map(function (k) { return map[k]; })
    .filter(function (m) { return Math.abs(m.chenhLechDienTichPhanTram) >= nguongPhanTram; })
    .sort(function (a, b) { return Math.abs(b.chenhLechDienTichPhanTram) - Math.abs(a.chenhLechDienTichPhanTram); });
}
