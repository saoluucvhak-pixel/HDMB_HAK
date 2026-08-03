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
/**
 * Dọn dẹp 1 LẦN: xóa hẳn sheet "TongHop_HopDong" cũ (nếu trước đây đã từng chạy
 * xuatBaoCaoTongHopHopDong() tạo ra) — báo cáo này đã dư thừa so với Draft_BaoCaoHopDong
 * (Draft đầy đủ hơn và tự động cập nhật, không cần chạy tay nữa).
 */
function XOA_SHEET_TONGHOP_CU() {
  const ss = getSS_();
  const sh = ss.getSheetByName('TongHop_HopDong');
  if (sh) { ss.deleteSheet(sh); return 'Đã xóa sheet "TongHop_HopDong" cũ.'; }
  return 'Không có sheet "TongHop_HopDong" nào để xóa (có thể đã xóa trước đó hoặc chưa từng tạo).';
}

/**
 * Bản tóm tắt KPI cho webapp (trang Báo cáo tổng hợp): số hợp đồng, tổng khối
 * lượng, tổng giá trị, kèm danh sách chi tiết để hiển thị bảng.
 */
function layTongHopChoWebapp(boBuoc) {
  // Đọc THẲNG từ Draft_BaoCaoHopDong (đã tổng hợp sẵn, cập nhật ngay mỗi khi có
  // thay đổi — xem CAP_NHAT_DRAFT_MOT_HOP_DONG) — không tính lại từ đầu nữa.
  const boBuocThat = !!boBuoc;
  if (boBuocThat) LAM_MOI_DRAFT_THEO_THAY_DOI(); // chỉ cập nhật hợp đồng CÓ THAY ĐỔI, không tính lại toàn bộ từ đầu
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
  try {
    // ĐỌC CACHE Draft_BaoCaoHopDong — đã có sẵn coAnh/daDoGPSDu/hoSoDu (tính khi
    // Thêm/Sửa lô rừng, xem tinhDongDraftChoHopDong_) — KHÔNG đọc trực tiếp
    // HD_NCC + HD_RUNG + HD_PICTURE mỗi lần tải trang nữa (nguyên nhân treo/nghẽn
    // khi các sheet đó đã nhiều dòng).
    const list = docToanBoDraftBaoCao_();
    const chiTiet = list.map(function (m) {
      return {
        idHD: m.idHD, soHD: m.soHD, chuRung: m.tenChuRung, tinhTrang: m.tinhTrang || 'Đang thực hiện',
        tongLoRung: m.soLoRung, daDoGPSDuChua: m.daDoGPSDu, hoSoDuChua: m.hoSoDu, coAnh: m.coAnh
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
  } catch (e) {
    ghiLoiBackend_('layTinhHinhThucHien', e);
    throw new Error('layTinhHinhThucHien lỗi: ' + e.message);
  }
}
/** layBaoCaoHoSoRung() ĐÃ CHUYỂN SANG 16_DraftHoSoRung.gs — đọc cache Draft_HoSoRung
 *  thay vì đọc trực tiếp HD_RUNG+HD_GPS+HD_NCC mỗi lần tải (nguyên nhân treo/nghẽn
 *  khi HD_RUNG nhiều dòng). KHÔNG khai báo lại ở đây để tránh xung đột hàm trùng tên. */

/**
 * Chi tiết đầy đủ 1 lô rừng (tọa độ từng điểm + ảnh) — dùng khi bấm "Xem chi tiết".
 *
 * ⚠️ ĐÃ SỬA: trước đây CHỈ lấy ảnh từ Draft_AnhRung (bảng nháp của luồng "Tải ảnh
 * kiểm tra -> Duyệt") — bảng này CHỈ có dữ liệu nếu ảnh đi đúng luồng đó và có
 * gán rõ ID_RUNG. Ảnh thêm bằng "dán link ảnh có sẵn" (THEM_LINK_ANH_HOP_DONG)
 * hoặc ảnh import sẵn từ trước ghi THẲNG vào HD_Picture và KHÔNG hề có mặt
 * trong Draft_AnhRung -> "Xem chi tiết" trước đây luôn trống với các ảnh này.
 * Lưu ý cấu trúc gốc: HD_Picture chỉ lưu theo ID_HD (cả hợp đồng), KHÔNG lưu
 * theo từng lô rừng riêng — nên không thể biết chắc 1 ảnh trong HD_Picture
 * thuộc lô rừng cụ thể nào. Giải pháp: hiện thêm khối "Ảnh chung của hợp đồng"
 * (đọc từ HD_Picture) bên cạnh khối "Ảnh riêng của lô rừng này" (Draft_AnhRung,
 * chính xác theo lô vì có ID_RUNG) — ghi rõ nhãn để không gây hiểu lầm.
 */
function layChiTietHoSoMotLoRung(idRung) {
  idRung = (idRung || '').toString().trim();
  const rungRows = readData_(SHEET_NAME.HD_RUNG);
  const rung = rungRows.find(function (r) { return (r[RUNG_COL.ID_RUNG] || '').toString().trim() === idRung; });
  const idHD = rung ? (rung[RUNG_COL.ID_KEY_HD] || '').toString().trim() : '';
  const rungCungHopDong = idHD ? rungRows.filter(function (r) { return (r[RUNG_COL.ID_KEY_HD] || '').toString().trim() === idHD; }) : [];
  const tongSoLoCuaHopDong = rungCungHopDong.length;

  // ⚠️ ĐÃ SỬA: dữ liệu xác nhận cột "ID_HD" trong HD_Picture có thể lưu ĐÚNG
  // CHỦ ĐỊNH giá trị ID_RUNG (không phải lỗi/nhầm lẫn) để gán ảnh cho MỘT lô
  // rừng cụ thể. Vậy ảnh khớp ID_RUNG của ĐÚNG lô đang xem phải xếp vào
  // "Ảnh riêng của lô rừng này" — KHÔNG phải "ảnh chung chưa gán" như trước.
  // Chỉ ảnh khớp ID_HD thật của hợp đồng, hoặc khớp ID_RUNG của MỘT LÔ KHÁC
  // (không phải lô đang xem), mới thật sự là "ảnh chung/mơ hồ, chưa rõ của lô nào".
  const anhTuHDPictureTheoDungLoNay = layAnhTheoDinhDanhHDPicture_(idRung);
  const anhRiengCuaLo = layDraftAnhChoRung(idRung).filter(function (a) { return a.trangThai === 'Đã duyệt'; }).concat(anhTuHDPictureTheoDungLoNay);

  let anhChungMoHo = idHD ? layAnhTheoDinhDanhHDPicture_(idHD) : [];
  rungCungHopDong.forEach(function (r) {
    const idRungKhac = (r[RUNG_COL.ID_RUNG] || '').toString().trim();
    if (idRungKhac && idRungKhac !== idRung) anhChungMoHo = anhChungMoHo.concat(layAnhTheoDinhDanhHDPicture_(idRungKhac));
  });

  return {
    toaDo: layGPSCuaRung(idRung),
    anh: anhRiengCuaLo,
    anhChungHopDong: anhChungMoHo,
    tongSoLoCuaHopDong: tongSoLoCuaHopDong,
    // ⚠️ BỔ SUNG: TRƯỚC ĐÂY "Xem chi tiết" hoàn toàn không trả về link hồ sơ
    // pháp lý (DinhKemGiayTo — CCCD/GCN QSDĐ/giấy xác nhận nguồn gốc...) của lô
    // rừng, dù dữ liệu này đã có sẵn trong HD_RUNG — nên không có gì để hiện dù
    // đã đính kèm. Dùng lại resolveDriveLink_() đã có sẵn (06_CreateUpdate.gs)
    // để lấy link bấm mở được trực tiếp, giống hệt cách trang "Kiểm tra hồ sơ" làm.
    hoSoPhapLy: rung ? {
      hoSoNguonGoc: rung[RUNG_COL.HO_SO_NGUON_GOC] || '',
      soGiayTo: rung[RUNG_COL.SO_GIAY_TO] || '',
      dinhKem: resolveDriveLink_(rung[RUNG_COL.DINH_KEM_GIAY_TO])
    } : null
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
/**
 * Hàm tính toán THUẦN TÚY cho 1 hợp đồng — KHÔNG tự đọc sheet gì cả, nhận sẵn
 * dữ liệu đã lọc/gộp làm tham số. Dùng chung cho cả CAP_NHAT_DRAFT_MOT_HOP_DONG
 * (1 hợp đồng, tự lọc từ sheet) lẫn XAY_DUNG_LAI_TOAN_BO_DRAFT (hàng loạt, dữ
 * liệu đã group sẵn trong bộ nhớ) — tránh trùng lặp logic VÀ tránh đọc sheet
 * lặp lại nhiều lần khi xử lý hàng loạt.
 */
function tinhDongDraftChoHopDong_(idHD, row, rungRows, stkRows, gpsRows, coAnh, dntt, ngayCan) {
  let tongKhoiLuongDuKien = 0, tongGiaTri = 0, tongKhoiLuongThucHienRung = 0, tongGiaTriThucHienRung = 0;
  rungRows.forEach(function (r) {
    const kl = Number(r[RUNG_COL.KHOI_LUONG_DK]) || 0;
    const dg = Number(r[RUNG_COL.DON_GIA]) || 0;
    const klTH = Number(r[RUNG_COL.KHOI_LUONG_THUC_HIEN]) || 0;
    tongKhoiLuongDuKien += kl; tongGiaTri += dg * kl;
    tongKhoiLuongThucHienRung += klTH; tongGiaTriThucHienRung += dg * klTH;
  });

  const soHDChuan = (row[NCC_COL.SO_HD] || '').toString().trim();
  const khopDNTT = dntt && dntt.thanhCong ? dntt.theoSoHD[soHDChuan] : null;
  const tongKhoiLuongThucHien = khopDNTT ? khopDNTT.khoiLuong : tongKhoiLuongThucHienRung;
  const tongGiaTriThucHien = khopDNTT ? khopDNTT.giaTri : tongGiaTriThucHienRung;
  const nc = (ngayCan && ngayCan.thanhCong && ngayCan.theoSoHD[soHDChuan]) || null;

  const soLo = rungRows.length;
  const soLoDaDoGPS = rungRows.filter(function (r) { return Number(r[RUNG_COL.DIEN_TICH_GPS]) > 0; }).length;
  const soLoDuHoSo = rungRows.filter(function (r) { return kiemTraHoSoMotLoRung_(r, true).dat; }).length;

  const thieuChiTiet = [];
  rungRows.forEach(function (r) {
    const kqKt = kiemTraHoSoMotLoRung_(r, true); // bỏ qua kiểm tra Drive — hàm này chạy tự động ở MỌI lần Lưu, không thể chờ gọi Drive API tuần tự
    thieuChiTiet.push.apply(thieuChiTiet, kqKt.thieu.map(function (t) { return r[RUNG_COL.ID_RUNG] + ': ' + t; }));
  });
  thieuChiTiet.push.apply(thieuChiTiet, kiemTraUyQuyenVaTaiKhoan_(row));

  let latTong = 0, lngTong = 0, demDiem = 0;
  rungRows.forEach(function (r) {
    const idRung = (r[RUNG_COL.ID_RUNG] || '').toString().trim();
    (gpsRows[idRung] || []).forEach(function (g) {
      const type = g[GPS_COL.HE_TOA_DO];
      const lat = (type === 'DMS') ? convertDmsToDd(g[GPS_COL.LAT]) : parseFloat(g[GPS_COL.LAT]);
      const lng = (type === 'DMS') ? convertDmsToDd(g[GPS_COL.LNG]) : parseFloat(g[GPS_COL.LNG]);
      if (!isNaN(lat) && !isNaN(lng)) { latTong += lat; lngTong += lng; demDiem++; }
    });
  });
  const toaDoTB = demDiem ? (latTong / demDiem).toFixed(6) + ',' + (lngTong / demDiem).toFixed(6) : '';

  const donGiaDuKien = tongKhoiLuongDuKien ? Math.round(tongGiaTri / tongKhoiLuongDuKien) : 0;
  const donGiaThucHien = tongKhoiLuongThucHien ? Math.round(tongGiaTriThucHien / tongKhoiLuongThucHien) : 0;

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
  dong[c.KHOI_LUONG_DU_KIEN] = tongKhoiLuongDuKien;
  dong[c.DON_GIA_DU_KIEN] = donGiaDuKien;
  dong[c.GIA_TRI_HOP_DONG] = tongGiaTri;
  dong[c.KHOI_LUONG_THUC_HIEN] = tongKhoiLuongThucHien;
  dong[c.DON_GIA_THUC_HIEN] = donGiaThucHien;
  dong[c.GIA_TRI_THUC_HIEN] = tongGiaTriThucHien;
  dong[c.KHOI_LUONG_CON_LAI] = tongKhoiLuongDuKien - tongKhoiLuongThucHien;
  dong[c.GIA_TRI_CON_LAI] = tongGiaTri - tongGiaTriThucHien;
  dong[c.THUC_HIEN_TU_NGAY] = nc && nc.tuNgay ? nc.tuNgay : '';
  dong[c.THUC_HIEN_DEN_NGAY] = nc && nc.denNgay ? nc.denNgay : '';
  dong[c.DANH_SACH_SO_PHIEU_CAN] = nc && nc.danhSachSoCT ? nc.danhSachSoCT : '';
  dong[c.TINH_TRANG] = row[NCC_COL.TINH_TRANG] || 'Đang thực hiện';
  dong[c.SO_LO_RUNG] = soLo;
  dong[c.SO_TAI_KHOAN] = stkRows.length;
  dong[c.CO_ANH] = coAnh;
  dong[c.DA_DO_GPS_DU] = soLo > 0 && soLoDaDoGPS === soLo;
  dong[c.HO_SO_DU] = soLo > 0 && soLoDuHoSo === soLo;
  dong[c.THIEU_HO_SO_CHI_TIET] = thieuChiTiet.join('; ');
  dong[c.TOA_DO_TRUNG_BINH] = toaDoTB;
  dong[c.DIA_CHI_RUNG] = Array.from(new Set(rungRows.map(function (r) { return (r[RUNG_COL.DIA_CHI_RUNG] || '').toString().trim(); }).filter(Boolean))).join(' / ') || row[NCC_COL.DIA_CHI_RUNG] || '';
  dong[c.CAP_NHAT_LUC] = new Date();
  return dong;
}

function CAP_NHAT_DRAFT_MOT_HOP_DONG(idHD) {
  idHD = (idHD || '').toString().trim();
  if (!idHD) return;
  try {
    const nccRows = readData_(SHEET_NAME.HD_NCC);
    const row = nccRows.find(function (r) { return (r[NCC_COL.ID_HD] || '').toString().trim() === idHD; });
    if (!row) { XOA_DRAFT_MOT_HOP_DONG_(idHD); return; } // hợp đồng đã bị xóa hẳn -> xóa luôn khỏi Draft

    const rungRows = readData_(SHEET_NAME.HD_RUNG).filter(function (r) { return (r[RUNG_COL.ID_KEY_HD] || '').toString().trim() === idHD; });
    const stkRows = readData_(SHEET_NAME.HD_STK).filter(function (r) { return (r[STK_COL.ID_HD] || '').toString().trim() === idHD; });

    const dntt = docCacheBaoCao_ChiDoc_('duLieuThucHienDNTT', layDuLieuThucHienTuDNTT_);
    const ngayCan = docCacheBaoCao_ChiDoc_('ngayCanMinMax', layNgayCanMinMaxTheoHopDong_KhongCache_);

    const pictureRows = readData_(SHEET_NAME.HD_PICTURE);
    let coAnh = false;
    pictureRows.forEach(function (r) {
      if ((r[PICTURE_COL.ID_HD] || '').toString().trim() !== idHD) return;
      for (let c = PICTURE_COL.PICTURE_START; c <= PICTURE_COL.PICTURE_END; c++) { if (r[c]) { coAnh = true; break; } }
    });

    const gpsRowsRaw = readData_(SHEET_NAME.HD_GPS);
    const gpsByIdRung = {};
    gpsRowsRaw.forEach(function (g) {
      const idRung = (g[GPS_COL.ID_KEY_GPS] || '').toString().trim();
      if (!gpsByIdRung[idRung]) gpsByIdRung[idRung] = [];
      gpsByIdRung[idRung].push(g);
    });

    const dong = tinhDongDraftChoHopDong_(idHD, row, rungRows, stkRows, gpsByIdRung, coAnh, dntt, ngayCan);

    const sh = getOrCreateDraftBaoCaoSheet_();
    const soDong = timDongDraftBaoCao_(sh, idHD);
    if (soDong === -1) {
      sh.appendRow(dong);
    } else {
      sh.getRange(soDong, 1, 1, dong.length).setValues([dong]);
    }
    _draftDataCache = null; // xóa bộ nhớ đệm — nếu cùng lượt chạy có đọc lại Draft sau đây, phải thấy đúng dữ liệu vừa ghi
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
/**
 * LÀM MỚI THEO THAY ĐỔI THẬT — dùng cho nút "🔄 Làm mới dữ liệu" trên webapp.
 * KHÔNG tính lại toàn bộ từ đầu (khác hẳn XAY_DUNG_LAI_TOAN_BO_DRAFT, hàm đó chỉ
 * dùng 1 lần lúc cài đặt) — chỉ đọc nhật ký (NhatKy_SuaDoi) kể từ lần làm mới
 * trước, lấy ra đúng danh sách ID_HD đã thay đổi (chống trùng bằng Set), rồi
 * CHỈ cập nhật lại Draft cho ĐÚNG những hợp đồng đó. Nếu không có gì thay đổi
 * kể từ lần trước, không tính toán gì cả — trả về ngay.
 */
function LAM_MOI_DRAFT_THEO_THAY_DOI() {
  const props = PropertiesService.getScriptProperties();
  const moocThoiGianTruoc = props.getProperty('DRAFT_MOOC_LAM_MOI_LAN_TRUOC');
  const tuThoiGian = moocThoiGianTruoc ? new Date(moocThoiGianTruoc) : new Date(0);

  const shNhatKy = getOrCreateNhatKySheet_();
  const lastRow = shNhatKy.getLastRow();
  const moocMoi = new Date(); // ghi lại NGAY BÂY GIỜ làm mốc cho lần làm mới tiếp theo

  if (lastRow < 2) {
    props.setProperty('DRAFT_MOOC_LAM_MOI_LAN_TRUOC', moocMoi.toISOString());
    return { soHopDongCapNhat: 0, ghiChu: 'Chưa có nhật ký thay đổi nào.' };
  }

  const data = shNhatKy.getRange(2, 1, lastRow - 1, 4).getValues(); // Thời gian, Người TH, Hành động, ID_HD
  const idsCanCapNhat = new Set(); // Set() tự chống trùng — 1 hợp đồng đổi 5 lần chỉ cập nhật 1 lần
  data.forEach(function (r) {
    const thoiGian = new Date(r[0]);
    if (thoiGian > tuThoiGian) {
      const idHD = (r[3] || '').toString().trim();
      if (idHD) idsCanCapNhat.add(idHD);
    }
  });

  idsCanCapNhat.forEach(function (idHD) { CAP_NHAT_DRAFT_MOT_HOP_DONG(idHD); CAP_NHAT_DRAFT_HOSORUNG_CHO_HOPDONG_(idHD); });
  props.setProperty('DRAFT_MOOC_LAM_MOI_LAN_TRUOC', moocMoi.toISOString());

  return {
    soHopDongCapNhat: idsCanCapNhat.size,
    ghiChu: idsCanCapNhat.size ? 'Đã cập nhật ' + idsCanCapNhat.size + ' hợp đồng có thay đổi.' : 'Không có thay đổi gì kể từ lần làm mới trước.'
  };
}

/**
 * Xây dựng lại TOÀN BỘ Draft — chạy 1 LẦN lúc mới cài đặt. Đã tối ưu để KHÔNG
 * timeout với số lượng lớn hợp đồng:
 *  1. Đọc HD_NCC/HD_RUNG/HD_STK/HD_GPS/HD_Picture + 2 cache thanh toán CHỈ 1 LẦN
 *     DUY NHẤT (không đọc lại cho từng hợp đồng như trước — đây là nguyên nhân
 *     timeout cũ: N hợp đồng thì đọc lại HD_RUNG N lần).
 *  2. Group tất cả dữ liệu con theo ID_HD/ID_RUNG NGAY TRONG BỘ NHỚ (object tra
 *     cứu O(1)), không lặp lại việc lọc mảng cho từng hợp đồng.
 *  3. Ghi TẤT CẢ kết quả vào sheet Draft bằng 1 lệnh setValues() DUY NHẤT (thay
 *     vì appendRow/setValues riêng lẻ cho từng dòng — nhanh hơn rất nhiều).
 *  4. Nếu gần chạm giới hạn thời gian thực thi (Apps Script tối đa ~6 phút),
 *     TỰ ĐỘNG DỪNG AN TOÀN và lưu lại vị trí đã xử lý — CHẠY LẠI hàm này (bấm
 *     lại đúng menu đó) để tiếp tục từ chỗ dừng, không tính lại từ đầu.
 */
function XAY_DUNG_LAI_TOAN_BO_DRAFT() {
  const GIOI_HAN_THOI_GIAN_MS = 4.5 * 60 * 1000; // dừng an toàn ở phút 4.5 (giới hạn thật ~6 phút)
  const thoiDiemBatDau = new Date().getTime();
  const props = PropertiesService.getScriptProperties();

  const nccRows = readData_(SHEET_NAME.HD_NCC);

  // ---- Đọc 1 LẦN DUY NHẤT, group theo ID_HD/ID_RUNG trong bộ nhớ ----
  const rungByHD = {};
  readData_(SHEET_NAME.HD_RUNG).forEach(function (r) {
    const idHD = (r[RUNG_COL.ID_KEY_HD] || '').toString().trim();
    if (!rungByHD[idHD]) rungByHD[idHD] = [];
    rungByHD[idHD].push(r);
  });
  const stkByHD = {};
  readData_(SHEET_NAME.HD_STK).forEach(function (r) {
    const idHD = (r[STK_COL.ID_HD] || '').toString().trim();
    if (!stkByHD[idHD]) stkByHD[idHD] = [];
    stkByHD[idHD].push(r);
  });
  const gpsByIdRung = {};
  readData_(SHEET_NAME.HD_GPS).forEach(function (g) {
    const idRung = (g[GPS_COL.ID_KEY_GPS] || '').toString().trim();
    if (!gpsByIdRung[idRung]) gpsByIdRung[idRung] = [];
    gpsByIdRung[idRung].push(g);
  });
  const coAnhByHD = {};
  readData_(SHEET_NAME.HD_PICTURE).forEach(function (r) {
    const idHD = (r[PICTURE_COL.ID_HD] || '').toString().trim();
    if (!idHD || coAnhByHD[idHD]) return;
    for (let c = PICTURE_COL.PICTURE_START; c <= PICTURE_COL.PICTURE_END; c++) {
      if (r[c]) { coAnhByHD[idHD] = true; break; }
    }
  });
  const dntt = docCacheBaoCao_ChiDoc_('duLieuThucHienDNTT', layDuLieuThucHienTuDNTT_);
  const ngayCan = docCacheBaoCao_ChiDoc_('ngayCanMinMax', layNgayCanMinMaxTheoHopDong_KhongCache_);

  // ---- Tiếp tục từ vị trí lần trước nếu đang dang dở ----
  let batDauTu = Number(props.getProperty('XAY_DUNG_DRAFT_TIEP_TUC_TU') || 0);
  if (batDauTu === 0) {
    // Bắt đầu mới hoàn toàn -> xóa sạch Draft cũ trước khi ghi lại từ đầu
    const sh = getOrCreateDraftBaoCaoSheet_();
    const lastRow = sh.getLastRow();
    if (lastRow >= 2) sh.getRange(2, 1, lastRow - 1, sh.getLastColumn()).clearContent();
  }

  const tatCaDong = [];
  let i = batDauTu;
  let dungGiuaChung = false;
  for (; i < nccRows.length; i++) {
    if (new Date().getTime() - thoiDiemBatDau > GIOI_HAN_THOI_GIAN_MS) { dungGiuaChung = true; break; }
    const row = nccRows[i];
    const idHD = (row[NCC_COL.ID_HD] || '').toString().trim();
    if (!idHD) continue;
    const dong = tinhDongDraftChoHopDong_(
      idHD, row, rungByHD[idHD] || [], stkByHD[idHD] || [], gpsByIdRung, !!coAnhByHD[idHD], dntt, ngayCan
    );
    tatCaDong.push(dong);
  }

  // ---- Ghi TẤT CẢ kết quả của đợt này bằng 1 lệnh duy nhất (nhanh hơn ghi từng dòng) ----
  if (tatCaDong.length) {
    const sh = getOrCreateDraftBaoCaoSheet_();
    const soCot = Object.keys(DRAFT_BAOCAO_COL).length;
    // Chuẩn hóa mỗi dòng đủ số cột (tránh undefined ở cột không được gán)
    const dongChuanHoa = tatCaDong.map(function (d) {
      const arr = [];
      for (let k = 0; k < soCot; k++) arr[k] = (d[k] === undefined ? '' : d[k]);
      return arr;
    });
    sh.getRange(sh.getLastRow() + 1, 1, dongChuanHoa.length, soCot).setValues(dongChuanHoa);
  }

  if (dungGiuaChung) {
    props.setProperty('XAY_DUNG_DRAFT_TIEP_TUC_TU', i.toString());
    return '⏸️ Đã xử lý ' + i + '/' + nccRows.length + ' hợp đồng (dừng tạm vì gần hết thời gian chạy). ' +
      'BẤM LẠI đúng mục menu này để TIẾP TỤC từ hợp đồng thứ ' + (i + 1) + ' (không tính lại từ đầu).';
  }

  props.deleteProperty('XAY_DUNG_DRAFT_TIEP_TUC_TU'); // xong toàn bộ -> xóa mốc tiếp tục
  return '✅ OK — đã xây dựng xong Draft cho toàn bộ ' + nccRows.length + ' hợp đồng.';
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
      if (idHD) CAP_NHAT_DRAFT_HOSORUNG_CHO_HOPDONG_(idHD.toString().trim()); // Tình trạng HĐ đổi -> ảnh hưởng mọi lô rừng con
    } else if (ten === SHEET_NAME.HD_RUNG) {
      idHD = sh.getRange(hang, RUNG_COL.ID_KEY_HD + 1).getValue();
      const idRungSua = (sh.getRange(hang, RUNG_COL.ID_RUNG + 1).getValue() || '').toString().trim();
      if (idRungSua) CAP_NHAT_DRAFT_HOSORUNG_MOT_DONG_(idRungSua);
    } else if (ten === SHEET_NAME.HD_STK) {
      idHD = sh.getRange(hang, STK_COL.ID_HD + 1).getValue();
    } else if (ten === SHEET_NAME.HD_GPS) {
      const idRung = (sh.getRange(hang, GPS_COL.ID_KEY_GPS + 1).getValue() || '').toString().trim();
      if (idRung) {
        const rungRows = readData_(SHEET_NAME.HD_RUNG);
        const rung = rungRows.find(function (r) { return (r[RUNG_COL.ID_RUNG] || '').toString().trim() === idRung; });
        idHD = rung ? rung[RUNG_COL.ID_KEY_HD] : null;
        CAP_NHAT_DRAFT_HOSORUNG_MOT_DONG_(idRung); // tọa độ đổi -> cập nhật lại tọa độ TB trong cache
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

/**
 * Đồng bộ thanh toán/thực hiện NGAY LẬP TỨC — bỏ qua mọi kiểm tra "có thay đổi
 * hay không" (khác với dongBoThanhToanNeuCoThayDoi_ vốn chỉ chạy trigger 30
 * phút/lần và có thể bỏ lỡ). Dùng để: (1) khắc phục ngay dữ liệu "Khối lượng
 * thực hiện" đang bị cũ/sai do cache chưa từng được làm mới, hoặc (2) chạy thử
 * sau khi vừa sửa DNTT_GK_DN_CT để xác nhận báo cáo đã cập nhật đúng.
 */
function CHAY_DONG_BO_THANH_TOAN_NGAY() {
  const ss = SpreadsheetApp.openByUrl(DNTT_URL);
  const sh = ss.getSheetByName(DNTT_SHEET_NAME) || ss.getSheets()[0];
  const props = PropertiesService.getScriptProperties();
  props.setProperty('DNTT_SO_DONG_LAN_TRUOC', sh.getLastRow().toString());
  try { props.setProperty('DNTT_THOI_GIAN_SUA_LAN_TRUOC', DriveApp.getFileById(ss.getId()).getLastUpdated().getTime().toString()); } catch (e) { /* bỏ qua nếu không lấy được */ }

  luuCacheBaoCao_('duLieuThucHienDNTT', layDuLieuThucHienTuDNTT_());
  luuCacheBaoCao_('ngayCanMinMax', layNgayCanMinMaxTheoHopDong_KhongCache_());

  const idsHopDong = readData_(SHEET_NAME.HD_NCC).map(function (r) { return (r[NCC_COL.ID_HD] || '').toString().trim(); }).filter(Boolean);
  idsHopDong.forEach(function (idHD) { CAP_NHAT_DRAFT_MOT_HOP_DONG(idHD); });

  const thongBao = '✅ Đã đồng bộ lại "Khối lượng/Giá trị thực hiện" cho ' + idsHopDong.length + ' hợp đồng từ DNTT_GK_DN_CT mới nhất.';
  try { SpreadsheetApp.getUi().alert(thongBao); } catch (e) { /* chạy từ editor thì bỏ qua UI */ }
  return thongBao;
}

function dongBoThanhToanNeuCoThayDoi_() {
  try {
    const ss = SpreadsheetApp.openByUrl(DNTT_URL);
    const sh = ss.getSheetByName(DNTT_SHEET_NAME) || ss.getSheets()[0];
    const soDongHienTai = sh.getLastRow();

    // ⚠️ TRƯỚC ĐÂY: chỉ so sánh SỐ DÒNG để phát hiện thay đổi — nếu ai đó SỬA
    // giá trị trong 1 dòng CÓ SẴN của DNTT_GK_DN_CT (không thêm dòng mới), số
    // dòng không đổi -> hệ thống tưởng "không có gì mới" và bỏ qua, khiến
    // "Khối lượng thực hiện" trong báo cáo bị SAI/CŨ so với DNTT thực tế. Giờ
    // kiểm tra THÊM thời điểm sửa đổi gần nhất của file (Drive lastUpdated) —
    // bắt được cả việc sửa tại chỗ, không chỉ thêm/xóa dòng.
    let thoiGianSuaGanNhat = null;
    try { thoiGianSuaGanNhat = DriveApp.getFileById(ss.getId()).getLastUpdated().getTime(); } catch (e) { /* không lấy được thì bỏ qua, vẫn dùng số dòng làm cơ sở */ }

    const props = PropertiesService.getScriptProperties();
    const soDongLanTruoc = Number(props.getProperty('DNTT_SO_DONG_LAN_TRUOC') || 0);
    const thoiGianLanTruoc = Number(props.getProperty('DNTT_THOI_GIAN_SUA_LAN_TRUOC') || 0);

    const coThayDoiSoDong = soDongHienTai !== soDongLanTruoc;
    const coThayDoiNoiDung = thoiGianSuaGanNhat !== null && thoiGianSuaGanNhat !== thoiGianLanTruoc;
    if (!coThayDoiSoDong && !coThayDoiNoiDung) return; // không có gì mới (cả số dòng lẫn thời điểm sửa đều giữ nguyên), khỏi cập nhật

    props.setProperty('DNTT_SO_DONG_LAN_TRUOC', soDongHienTai.toString());
    if (thoiGianSuaGanNhat !== null) props.setProperty('DNTT_THOI_GIAN_SUA_LAN_TRUOC', thoiGianSuaGanNhat.toString());

    // Làm mới 2 cache liên quan đến thanh toán TRƯỚC (tính 1 LẦN DUY NHẤT ở đây,
    // không phải để mỗi hợp đồng tự đọc lại DNTT_GK_DN_CT/PhieuCan_DN riêng lẻ)
    luuCacheBaoCao_('duLieuThucHienDNTT', layDuLieuThucHienTuDNTT_());
    luuCacheBaoCao_('ngayCanMinMax', layNgayCanMinMaxTheoHopDong_KhongCache_());

    // Sau khi cache đã mới, cập nhật lại phần "đã thực hiện" cho TẤT CẢ hợp đồng —
    // lúc này CAP_NHAT_DRAFT_MOT_HOP_DONG chỉ ĐỌC cache vừa làm mới, không đọc lại sheet ngoài
    const idsHopDong = readData_(SHEET_NAME.HD_NCC).map(function (r) { return (r[NCC_COL.ID_HD] || '').toString().trim(); }).filter(Boolean);
    idsHopDong.forEach(function (idHD) { CAP_NHAT_DRAFT_MOT_HOP_DONG(idHD); });
  } catch (e) {
    ghiNhatKy_('LỖI đồng bộ thanh toán định kỳ', '', e.message);
  }
}
