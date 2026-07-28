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
  // Đọc THẲNG từ Draft_BaoCaoHopDong (đã tổng hợp sẵn, cập nhật ngay mỗi khi có
  // thay đổi — xem CAP_NHAT_DRAFT_MOT_HOP_DONG) — không tính lại từ đầu nữa.
  const boBuocThat = !!boBuoc;
  if (boBuocThat) XAY_DUNG_LAI_TOAN_BO_DRAFT(); // chỉ xây lại toàn bộ khi bấm "Làm mới dữ liệu" tường minh
  const list = docToanBoDraftBaoCao_()
    // Chỉ hiện hợp đồng ĐANG THỰC HIỆN / CHỜ THỰC HIỆN — hợp đồng đã thanh lý/hủy
    // không cần theo dõi tiến độ thực hiện nữa.
    .filter(function (m) { return m.tinhTrang === 'Đang thực hiện' || m.tinhTrang === 'Chờ thực hiện'; });
  const tongKhoiLuong = list.reduce(function (s, m) { return s + (Number(m.khoiLuongDuKien) || 0); }, 0);
  const tongGiaTri = list.reduce(function (s, m) { return s + (Number(m.giaTriHopDong) || 0); }, 0);
  return {
    soHopDong: list.length,
    tongKhoiLuong: tongKhoiLuong,
    tongGiaTri: tongGiaTri,
    chiTiet: list.sort(function (a, b) { return (b.soHD || 0) - (a.soHD || 0); }).map(function (m) {
      return {
        idHD: m.idHD, soHD: m.soHD, chuRung: m.tenChuRung,
        tongKhoiLuongDuKien: m.khoiLuongDuKien, tongGiaTri: m.giaTriHopDong,
        tongKhoiLuongThucHien: m.khoiLuongThucHien, tongGiaTriThucHien: m.giaTriThucHien,
        khoiLuongConLai: m.khoiLuongConLai, giaTriConLai: m.giaTriConLai,
        donGiaDuKien: m.donGiaDuKien, donGiaThucHien: m.donGiaThucHien,
        thucHienTuNgay: m.thucHienTuNgay, thucHienDenNgay: m.thucHienDenNgay,
        danhSachSoPhieuCan: m.danhSachSoPhieuCan
      };
    })
  };
}

/**
 * BÁO CÁO HỢP ĐỒNG (đơn giản) — Số HĐ, ngày ký, chủ rừng, địa chỉ thường trú,
 * CCCD, ngày cấp, nơi cấp, người ủy quyền, CCCD ủy quyền, khối lượng dự kiến,
 * đơn giá trung bình, giá trị hợp đồng, tình trạng.
 */
function layBaoCaoHopDongDonGian() {
  return docToanBoDraftBaoCao_().map(function (m) {
    return {
      soHD: m.soHD, ngayKy: m.ngayKy, tenChuRung: m.tenChuRung, diaChiThuongTru: m.diaChiThuongTru,
      cccdChuRung: m.cccdChuRung, ngayCap: m.ngayCap, noiCap: m.noiCap,
      tenUyQuyen: m.tenUyQuyen, cccdUyQuyen: m.cccdUyQuyen,
      khoiLuongDuKien: m.khoiLuongDuKien, donGiaTrungBinh: m.donGiaDuKien, giaTriHopDong: m.giaTriHopDong,
      tinhTrang: m.tinhTrang
    };
  }).sort(function (a, b) { return (b.soHD || 0) - (a.soHD || 0); });
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
/** Báo cáo hồ sơ rừng theo từng lô rừng, kèm tọa độ trung bình để tra bản đồ */
function layBaoCaoHoSoRung() {
  const rungRows = readData_(SHEET_NAME.HD_RUNG);
  const gpsRows = readData_(SHEET_NAME.HD_GPS);
  const gpsByIdRung = {};
  gpsRows.forEach(function (g) {
    const idRung = (g[GPS_COL.ID_KEY_GPS] || '').toString().trim();
    if (!gpsByIdRung[idRung]) gpsByIdRung[idRung] = [];
    gpsByIdRung[idRung].push(g);
  });

  return rungRows.map(function (r) {
    const idRung = (r[RUNG_COL.ID_RUNG] || '').toString().trim();
    const dienTich = Number(r[RUNG_COL.DIEN_TICH_M2]) || 0;
    const donGia = Number(r[RUNG_COL.DON_GIA]) || 0;
    const khoiLuong = Number(r[RUNG_COL.KHOI_LUONG_DK]) || 0;

    let toaDo = null;
    const cacDiem = gpsByIdRung[idRung] || [];
    if (cacDiem.length) {
      let latTong = 0, lngTong = 0, dem = 0;
      cacDiem.forEach(function (g) {
        const type = g[GPS_COL.HE_TOA_DO];
        const lat = (type === 'DMS') ? convertDmsToDd(g[GPS_COL.LAT]) : parseFloat(g[GPS_COL.LAT]);
        const lng = (type === 'DMS') ? convertDmsToDd(g[GPS_COL.LNG]) : parseFloat(g[GPS_COL.LNG]);
        if (!isNaN(lat) && !isNaN(lng)) { latTong += lat; lngTong += lng; dem++; }
      });
      if (dem) toaDo = { lat: latTong / dem, lng: lngTong / dem };
    }

    return {
      idRung: idRung, soHD: r[RUNG_COL.SO_HD], ngayKy: r[RUNG_COL.NGAY_KY], tenChuRung: r[RUNG_COL.TEN_CHU_RUNG],
      hoSoNguonGoc: r[RUNG_COL.HO_SO_NGUON_GOC], soGiayTo: r[RUNG_COL.SO_GIAY_TO], ngayGiayTo: r[RUNG_COL.NGAY_GIAY_TO],
      dienTich: dienTich, khoiLuongDuKien: khoiLuong, donGia: donGia, giaTri: donGia * khoiLuong,
      toaDo: toaDo, soDiemGPS: cacDiem.length
    };
  }).sort(function (a, b) { return (b.soHD || 0) - (a.soHD || 0); });
}

/** Chi tiết đầy đủ 1 lô rừng (tọa độ từng điểm + ảnh) — dùng khi bấm "Xem chi tiết" */
function layChiTietHoSoMotLoRung(idRung) {
  return {
    toaDo: layGPSCuaRung(idRung),
    anh: layDraftAnhChoRung(idRung).filter(function (a) { return a.trangThai === 'Đã duyệt'; })
  };
}

/**
 * Báo cáo tổng hợp thanh toán theo hợp đồng và chủ rừng — gộp theo Số TK nhận
 * tiền từ DNTT_GK_DN_CT: số lần chuyển, tổng tiền, danh sách số phiếu cân.
 */
function layBaoCaoThanhToan() {
  try {
    const ss = SpreadsheetApp.openByUrl(DNTT_URL);
    const sh = ss.getSheetByName(DNTT_SHEET_NAME) || ss.getSheets()[0];
    const data = sh.getDataRange().getValues();
    if (data.length < 2) return { thanhCong: false, loi: 'Sheet DNTT_GK_DN_CT chưa có dữ liệu.', items: [] };

    const COT_NGUOI_NHAN = 6, COT_SO_TK_NHAN = 7, COT_SO_CT = 11, COT_THANH_TIEN = 16, COT_SO_HD = 19;
    const map = {};
    for (let i = 1; i < data.length; i++) {
      const soTK = (data[i][COT_SO_TK_NHAN] || '').toString().trim();
      if (!soTK) continue;
      if (!map[soTK]) {
        map[soTK] = { soTK: soTK, tenNguoiNhan: data[i][COT_NGUOI_NHAN] || '', hopDongSo: {}, soLanChuyen: 0, tongTien: 0, danhSachSoCT: [] };
      }
      map[soTK].soLanChuyen++;
      map[soTK].tongTien += Number(data[i][COT_THANH_TIEN]) || 0;
      const soCT = (data[i][COT_SO_CT] || '').toString().trim();
      if (soCT) map[soTK].danhSachSoCT.push(soCT);
      const soHD = (data[i][COT_SO_HD] || '').toString().trim();
      if (soHD) map[soTK].hopDongSo[soHD] = true;
    }

    const stkRows = readData_(SHEET_NAME.HD_STK);
    const thongTinTheoSoTK = {};
    stkRows.forEach(function (r) {
      const soTK = (r[STK_COL.SO_TK] || '').toString().trim();
      if (soTK) thongTinTheoSoTK[soTK] = { nganHang: r[STK_COL.NGAN_HANG], tenChuRung: r[STK_COL.TEN_CHU_RUNG] };
    });

    const items = Object.keys(map).map(function (k) {
      const m = map[k];
      const th = thongTinTheoSoTK[m.soTK] || {};
      return {
        soTK: m.soTK, tenNguoiNhan: m.tenNguoiNhan, nganHang: th.nganHang || '', tenChuRung: th.tenChuRung || '',
        hopDongSo: Object.keys(m.hopDongSo).join(', '), soLanChuyen: m.soLanChuyen, tongTien: m.tongTien,
        danhSachSoPhieuCan: m.danhSachSoCT.join(', ')
      };
    });

    return { thanhCong: true, items: items };
  } catch (e) {
    return { thanhCong: false, loi: 'Lỗi đọc DNTT_GK_DN_CT: ' + e.message, items: [] };
  }
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

/**
 * ============================================================
 *  CẬP NHẬT SHEET DRAFT BÁO CÁO — GỌI NGAY MỖI KHI HỢP ĐỒNG/RỪNG/TÀI KHOẢN THAY ĐỔI
 * ============================================================
 * Đây là "trigger" theo đúng nghĩa thực tế nhất: thay vì chờ trigger định kỳ
 * (chạy theo giờ/phút, có độ trễ), hàm này được GỌI TRỰC TIẾP ngay sau mỗi
 * thao tác ghi dữ liệu (tạo/sửa/xóa hợp đồng, rừng, tài khoản — xem các hàm
 * TAO_HOP_DONG_MOI, LUU_HOP_DONG_DAY_DU, THEM_LO_RUNG_MOI... ở 06_CreateUpdate.gs),
 * nên Draft LUÔN mới ngay lập tức, không có độ trễ, và các báo cáo không cần
 * tính lại gì cả — chỉ đọc thẳng từ Draft_BaoCaoHopDong (rất nhanh).
 */
function CAP_NHAT_DRAFT_MOT_HOP_DONG(idHD) {
  idHD = (idHD || '').toString().trim();
  if (!idHD) return;
  try {
    const nccRows = readData_(SHEET_NAME.HD_NCC);
    const row = nccRows.find(function (r) { return (r[NCC_COL.ID_HD] || '').toString().trim() === idHD; });
    if (!row) { XOA_DRAFT_MOT_HOP_DONG_(idHD); return; } // hợp đồng đã bị xóa hẳn -> xóa luôn khỏi Draft

    const map = tongHopHopDong(true);
    const m = map[idHD] || {
      tongKhoiLuongDuKien: 0, tongGiaTri: 0, tongKhoiLuongThucHien: 0, tongGiaTriThucHien: 0,
      khoiLuongConLai: 0, giaTriConLai: 0, soLoRung: 0, soTaiKhoan: 0
    };
    const soHDChuan = (row[NCC_COL.SO_HD] || '').toString().trim();
    const ngayCan = layNgayCanMinMaxTheoHopDong_();
    const nc = (ngayCan.thanhCong && ngayCan.theoSoHD[soHDChuan]) || null;

    const rungRows = readData_(SHEET_NAME.HD_RUNG).filter(function (r) { return (r[RUNG_COL.ID_KEY_HD] || '').toString().trim() === idHD; });
    const pictureRows = readData_(SHEET_NAME.HD_PICTURE);
    let coAnh = false;
    pictureRows.forEach(function (r) {
      if ((r[PICTURE_COL.ID_HD] || '').toString().trim() !== idHD) return;
      for (let c = PICTURE_COL.PICTURE_START; c <= PICTURE_COL.PICTURE_END; c++) { if (r[c]) { coAnh = true; break; } }
    });
    const soLo = rungRows.length;
    const soLoDaDoGPS = rungRows.filter(function (r) { return Number(r[RUNG_COL.DIEN_TICH_GPS]) > 0; }).length;
    const soLoDuHoSo = rungRows.filter(function (r) { return kiemTraHoSoMotLoRung_(r).dat; }).length;

    // Chi tiết hồ sơ còn thiếu (dùng cho báo cáo "Kiểm tra hồ sơ") — gộp từ từng lô rừng + hợp đồng
    const thieuChiTiet = [];
    rungRows.forEach(function (r) {
      const kqKt = kiemTraHoSoMotLoRung_(r);
      thieuChiTiet.push.apply(thieuChiTiet, kqKt.thieu.map(function (t) { return r[RUNG_COL.ID_RUNG] + ': ' + t; }));
    });
    thieuChiTiet.push.apply(thieuChiTiet, kiemTraUyQuyenVaTaiKhoan_(row));

    // Tọa độ trung bình của hợp đồng (gộp toàn bộ điểm GPS của các lô rừng)
    const gpsRows = readData_(SHEET_NAME.HD_GPS);
    let latTong = 0, lngTong = 0, demDiem = 0;
    rungRows.forEach(function (r) {
      const idRung = (r[RUNG_COL.ID_RUNG] || '').toString().trim();
      gpsRows.forEach(function (g) {
        if ((g[GPS_COL.ID_KEY_GPS] || '').toString().trim() !== idRung) return;
        const type = g[GPS_COL.HE_TOA_DO];
        const lat = (type === 'DMS') ? convertDmsToDd(g[GPS_COL.LAT]) : parseFloat(g[GPS_COL.LAT]);
        const lng = (type === 'DMS') ? convertDmsToDd(g[GPS_COL.LNG]) : parseFloat(g[GPS_COL.LNG]);
        if (!isNaN(lat) && !isNaN(lng)) { latTong += lat; lngTong += lng; demDiem++; }
      });
    });
    const toaDoTB = demDiem ? (latTong / demDiem).toFixed(6) + ',' + (lngTong / demDiem).toFixed(6) : '';

    const donGiaDuKien = m.tongKhoiLuongDuKien ? Math.round(m.tongGiaTri / m.tongKhoiLuongDuKien) : 0;
    const donGiaThucHien = m.tongKhoiLuongThucHien ? Math.round(m.tongGiaTriThucHien / m.tongKhoiLuongThucHien) : 0;

    const c = DRAFT_BAOCAO_COL;
    const dong = [];
    dong[c.ID_HD] = idHD;
    dong[c.SO_HD] = row[NCC_COL.SO_HD];
    dong[c.NGAY_KY] = row[NCC_COL.NGAY_KY];
    dong[c.TEN_CHU_RUNG] = row[NCC_COL.TEN_CHU_RUNG];
    dong[c.DIA_CHI_THUONG_TRU] = row[NCC_COL.DIA_CHI_TT];
    dong[c.CCCD_CHU_RUNG] = row[NCC_COL.CCCD_CHU_RUNG];
    dong[c.NGAY_CAP] = row[NCC_COL.NGAY_CAP];
    dong[c.NOI_CAP] = row[NCC_COL.NOI_CAP];
    dong[c.TEN_UY_QUYEN] = row[NCC_COL.TEN_UY_QUYEN];
    dong[c.CCCD_UY_QUYEN] = row[NCC_COL.CCCD_UY_QUYEN];
    dong[c.KHOI_LUONG_DU_KIEN] = m.tongKhoiLuongDuKien;
    dong[c.DON_GIA_DU_KIEN] = donGiaDuKien;
    dong[c.GIA_TRI_HOP_DONG] = m.tongGiaTri;
    dong[c.KHOI_LUONG_THUC_HIEN] = m.tongKhoiLuongThucHien;
    dong[c.DON_GIA_THUC_HIEN] = donGiaThucHien;
    dong[c.GIA_TRI_THUC_HIEN] = m.tongGiaTriThucHien;
    dong[c.KHOI_LUONG_CON_LAI] = m.khoiLuongConLai;
    dong[c.GIA_TRI_CON_LAI] = m.giaTriConLai;
    dong[c.THUC_HIEN_TU_NGAY] = nc && nc.tuNgay ? nc.tuNgay : '';
    dong[c.THUC_HIEN_DEN_NGAY] = nc && nc.denNgay ? nc.denNgay : '';
    dong[c.DANH_SACH_SO_PHIEU_CAN] = nc && nc.danhSachSoCT ? nc.danhSachSoCT : '';
    dong[c.TINH_TRANG] = row[NCC_COL.TINH_TRANG] || 'Đang thực hiện';
    dong[c.SO_LO_RUNG] = soLo;
    dong[c.SO_TAI_KHOAN] = m.soTaiKhoan;
    dong[c.CO_ANH] = coAnh;
    dong[c.DA_DO_GPS_DU] = soLo > 0 && soLoDaDoGPS === soLo;
    dong[c.HO_SO_DU] = soLo > 0 && soLoDuHoSo === soLo;
    dong[c.THIEU_HO_SO_CHI_TIET] = thieuChiTiet.join('; ');
    dong[c.TOA_DO_TRUNG_BINH] = toaDoTB;
    dong[c.DIA_CHI_RUNG] = Array.from(new Set(rungRows.map(function (r) { return (r[RUNG_COL.DIA_CHI_RUNG] || '').toString().trim(); }).filter(Boolean))).join(' / ') || row[NCC_COL.DIA_CHI_RUNG] || '';
    dong[c.CAP_NHAT_LUC] = new Date();

    const sh = getOrCreateDraftBaoCaoSheet_();
    const soDong = timDongDraftBaoCao_(sh, idHD);
    if (soDong === -1) {
      sh.appendRow(dong);
    } else {
      sh.getRange(soDong, 1, 1, dong.length).setValues([dong]);
    }
  } catch (e) {
    // Không để lỗi cập nhật Draft làm hỏng thao tác chính (tạo/sửa hợp đồng vẫn phải thành công) — chỉ ghi log
    ghiNhatKy_('LỖI cập nhật Draft báo cáo', idHD, e.message);
  }
}

function XOA_DRAFT_MOT_HOP_DONG_(idHD) {
  try {
    const sh = getOrCreateDraftBaoCaoSheet_();
    const soDong = timDongDraftBaoCao_(sh, idHD);
    if (soDong !== -1) sh.deleteRow(soDong);
  } catch (e) { /* bỏ qua */ }
}

/**
 * XÂY DỰNG LẠI TOÀN BỘ Draft_BaoCaoHopDong từ đầu — chạy 1 LẦN DUY NHẤT lúc mới
 * triển khai hệ thống (khi Draft chưa có dữ liệu), hoặc bất cứ khi nào nghi ngờ
 * Draft bị lệch so với dữ liệu gốc. KHÔNG cần chạy định kỳ vì mỗi thao tác ghi
 * dữ liệu đã tự động gọi CAP_NHAT_DRAFT_MOT_HOP_DONG rồi.
 */
function XAY_DUNG_LAI_TOAN_BO_DRAFT() {
  const sh = getOrCreateDraftBaoCaoSheet_();
  const lastRow = sh.getLastRow();
  if (lastRow >= 2) sh.getRange(2, 1, lastRow - 1, sh.getLastColumn()).clearContent();

  const nccRows = readData_(SHEET_NAME.HD_NCC);
  let dem = 0;
  nccRows.forEach(function (r) {
    const idHD = (r[NCC_COL.ID_HD] || '').toString().trim();
    if (idHD) { CAP_NHAT_DRAFT_MOT_HOP_DONG(idHD); dem++; }
  });
  return 'OK — đã xây dựng lại Draft cho ' + dem + ' hợp đồng.';
}

/**
 * ============================================================
 *  BẪY NHẬT KÝ TỰ ĐỘNG (installable onEdit trigger)
 * ============================================================
 * Bắt MỌI thay đổi trực tiếp trên sheet (không chỉ qua webapp) ở 5 sheet cốt
 * lõi: HD_NCC, HD_RUNG, HD_STK, HD_GPS, HD_Picture — dò ra đúng ID_HD bị ảnh
 * hưởng và CHỈ cập nhật lại Draft cho hợp đồng đó (không tính lại toàn bộ),
 * nên webapp luôn mượt kể cả khi ai đó sửa tay trực tiếp trên Sheet.
 *
 * ⚠️ Dùng INSTALLABLE TRIGGER (không phải hàm onEdit(e) đơn giản) vì cần quyền
 * đọc thêm cả rừng liên quan — phải THIẾT LẬP 1 LẦN qua menu Sheet.
 */
function THIET_LAP_TRIGGER_ONEDIT_DRAFT() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'xuLyOnEditDraft_') ScriptApp.deleteTrigger(t); // xóa trigger cũ tránh tạo trùng
  });
  ScriptApp.newTrigger('xuLyOnEditDraft_').forSpreadsheet(getSS_()).onEdit().create();
  SpreadsheetApp.getUi().alert('✅ Đã thiết lập bẫy nhật ký tự động — mọi sửa đổi trực tiếp trên HD_NCC/HD_RUNG/HD_STK/HD_GPS/HD_Picture sẽ tự cập nhật Draft báo cáo ngay lập tức.');
}

function xuLyOnEditDraft_(e) {
  try {
    if (!e || !e.range) return;
    const sh = e.range.getSheet();
    const ten = sh.getName();
    const hang = e.range.getRow();
    if (hang < 2) return; // dòng tiêu đề, bỏ qua

    let idHD = null;
    if (ten === SHEET_NAME.HD_NCC) {
      idHD = sh.getRange(hang, NCC_COL.ID_HD + 1).getValue();
    } else if (ten === SHEET_NAME.HD_RUNG) {
      idHD = sh.getRange(hang, RUNG_COL.ID_KEY_HD + 1).getValue();
    } else if (ten === SHEET_NAME.HD_STK) {
      idHD = sh.getRange(hang, STK_COL.ID_HD + 1).getValue();
    } else if (ten === SHEET_NAME.HD_GPS) {
      const idRung = (sh.getRange(hang, GPS_COL.ID_KEY_GPS + 1).getValue() || '').toString().trim();
      if (idRung) {
        const rungRows = readData_(SHEET_NAME.HD_RUNG);
        const rung = rungRows.find(function (r) { return (r[RUNG_COL.ID_RUNG] || '').toString().trim() === idRung; });
        idHD = rung ? rung[RUNG_COL.ID_KEY_HD] : null;
      }
    } else if (ten === SHEET_NAME.HD_PICTURE) {
      idHD = sh.getRange(hang, PICTURE_COL.ID_HD + 1).getValue();
    } else {
      return; // sheet không liên quan đến Draft báo cáo -> bỏ qua
    }

    if (idHD) CAP_NHAT_DRAFT_MOT_HOP_DONG(idHD.toString().trim());
  } catch (err) {
    // Không để lỗi trigger làm gián đoạn việc sửa sheet của người dùng — bỏ qua âm thầm
  }
}

/**
 * ============================================================
 *  ĐỒNG BỘ ĐỊNH KỲ PHẦN THANH TOÁN/THỰC HIỆN (sheet ngoài DNTT_GK_DN_CT)
 * ============================================================
 * Sheet DNTT_GK_DN_CT là FILE NGOÀI (không cùng file với HD_NCC), nên KHÔNG
 * bẫy được bằng onEdit trực tiếp. Thay vào đó, dùng trigger ĐỊNH KỲ (chạy mỗi
 * 30 phút) để dò xem có thay đổi mới không (so số dòng dữ liệu hiện tại với
 * lần trước) — nếu có, cập nhật lại phần "đã thực hiện" cho MỌI hợp đồng.
 */
function THIET_LAP_TRIGGER_DONG_BO_THANH_TOAN() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'dongBoThanhToanNeuCoThayDoi_') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('dongBoThanhToanNeuCoThayDoi_').timeBased().everyMinutes(30).create();
  SpreadsheetApp.getUi().alert('✅ Đã thiết lập đồng bộ định kỳ (30 phút/lần) cho phần thanh toán/thực hiện từ DNTT_GK_DN_CT.');
}

function dongBoThanhToanNeuCoThayDoi_() {
  try {
    const ss = SpreadsheetApp.openByUrl(DNTT_URL);
    const sh = ss.getSheetByName(DNTT_SHEET_NAME) || ss.getSheets()[0];
    const soDongHienTai = sh.getLastRow();

    const props = PropertiesService.getScriptProperties();
    const soDongLanTruoc = Number(props.getProperty('DNTT_SO_DONG_LAN_TRUOC') || 0);

    if (soDongHienTai === soDongLanTruoc) return; // không có gì mới, khỏi cập nhật

    props.setProperty('DNTT_SO_DONG_LAN_TRUOC', soDongHienTai.toString());

    // Có thay đổi -> cập nhật lại phần "đã thực hiện" cho TẤT CẢ hợp đồng (vì
    // không biết chính xác dòng mới thuộc hợp đồng nào mà không đọc lại toàn bộ)
    const idsHopDong = readData_(SHEET_NAME.HD_NCC).map(function (r) { return (r[NCC_COL.ID_HD] || '').toString().trim(); }).filter(Boolean);
    idsHopDong.forEach(function (idHD) { CAP_NHAT_DRAFT_MOT_HOP_DONG(idHD); });
  } catch (e) {
    ghiNhatKy_('LỖI đồng bộ thanh toán định kỳ', '', e.message);
  }
}
