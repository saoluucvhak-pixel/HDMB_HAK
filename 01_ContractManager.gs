/**
 * ============================================================
 *  01_ContractManager.gs
 *  TỔNG HỢP HỢP ĐỒNG: khối lượng, giá trị, diện tích, số rừng,
 *  số tài khoản nhận tiền theo từng ID_HD (quan hệ 1-nhiều).
 * ============================================================
 */

/**
 * Dọn dẹp 1 LẦN: xóa hẳn sheet "TongHop_HopDong" cũ (nếu trước đây đã từng chạy
 * xuatBaoCaoTongHopHopDong() tạo ra) — báo cáo này đã dư thừa so với Draft_BaoCaoHopDong
 * (Draft đầy đủ hơn và tự động cập nhật, không cần chạy tay nữa).
 */
function XOA_SHEET_TONGHOP_CU() {
  _yeuCauQuyen_(QUYEN.QUAN_TRI);
  const ss = getSS_();
  const sh = ss.getSheetByName('TongHop_HopDong');
  if (sh) { ss.deleteSheet(sh); return 'Đã xóa sheet "TongHop_HopDong" cũ.'; }
  return 'Không có sheet "TongHop_HopDong" nào để xóa (có thể đã xóa trước đó hoặc chưa từng tạo).';
}

/**
 * Bản tóm tắt KPI cho webapp (trang Báo cáo tổng hợp): số hợp đồng, tổng khối
 * lượng, tổng giá trị, kèm danh sách chi tiết để hiển thị bảng.
 */
function layTongHopChoWebapp_(boBuoc, boLoc, trang, kichThuoc) {
  _yeuCauQuyen_(QUYEN.XEM);
  // Đọc THẲNG từ Draft_BaoCaoHopDong (đã tổng hợp sẵn, cập nhật ngay mỗi khi có thay đổi).
  if (boBuoc) LAM_MOI_DRAFT_THEO_THAY_DOI_(); // chỉ cập nhật hợp đồng CÓ THAY ĐỔI, không tính lại toàn bộ từ đầu
  return _tongHopWebappTuDraft_(docToanBoDraftBaoCao_(), boLoc, trang, kichThuoc);
}

/**
 * P-07b (rà soát 28/09): KPI (trên TOÀN BỘ hợp đồng đang/chờ thực hiện) + 1 TRANG chi tiết đã lọc theo Số HĐ / tên chủ rừng.
 * Trước đây trả chi tiết của MỌI hợp đồng để trình duyệt tự lọc — phản hồi tăng theo số hợp đồng (10.000 HĐ ≈ vài MB).
 */
function _tongHopWebappTuDraft_(tatCa, boLoc, trang, kichThuoc) {
  boLoc = boLoc || {};
  kichThuoc = Math.min(Math.max(Number(kichThuoc) || 20, 1), 200);
  // Chỉ hiện hợp đồng ĐANG THỰC HIỆN / CHỜ THỰC HIỆN — đã thanh lý/hủy không cần theo dõi tiến độ.
  const list = tatCa.filter(function (m) { return m.tinhTrang === 'Đang thực hiện' || m.tinhTrang === 'Chờ thực hiện'; });
  const tongKhoiLuong = list.reduce(function (s, m) { return s + (Number(m.khoiLuongDuKien) || 0); }, 0);
  const tongGiaTri = list.reduce(function (s, m) { return s + (Number(m.giaTriHopDong) || 0); }, 0);
  // Giao diện mới: ô tổng có thanh tiến độ (đã thực hiện / dự kiến)
  const tongKhoiLuongThucHien = list.reduce(function (s, m) { return s + (Number(m.khoiLuongThucHien) || 0); }, 0);
  const tongGiaTriThucHien = list.reduce(function (s, m) { return s + (Number(m.giaTriThucHien) || 0); }, 0);
  const tkSoHD = (boLoc.soHD || '').toString().trim().toLowerCase();
  const tkTen = (boLoc.tenChuRung || '').toString().trim().toLowerCase();
  const loc = list.filter(function (m) {
    if (tkSoHD && (m.soHD || '').toString().toLowerCase().indexOf(tkSoHD) === -1) return false;
    if (tkTen && (m.tenChuRung || '').toString().toLowerCase().indexOf(tkTen) === -1) return false;
    return true;
  }).sort(function (a, b) { return String(b.soHD || '').localeCompare(String(a.soHD || ''), 'vi', { numeric: true }); });
  const tongTrang = Math.max(1, Math.ceil(loc.length / kichThuoc));
  const trangThat = Math.min(Math.max(1, Number(trang) || 1), tongTrang);
  const batDau = (trangThat - 1) * kichThuoc;
  return {
    soHopDong: list.length, tongKhoiLuong: tongKhoiLuong, tongGiaTri: tongGiaTri,
    tongKhoiLuongThucHien: tongKhoiLuongThucHien, tongGiaTriThucHien: tongGiaTriThucHien,
    trang: trangThat, tongTrang: tongTrang, tongSo: loc.length,
    chiTiet: loc.slice(batDau, batDau + kichThuoc).map(function (m) {
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
 * TÌNH HÌNH THỰC HIỆN HỢP ĐỒNG: gộp trạng thái (HD_NCC.TinhTrang), tiến độ đo
 * đạc GPS thực tế, đã có ảnh hiện trường chưa, hồ sơ pháp lý đã đủ chưa —
 * cho từng hợp đồng, kèm số liệu tổng hợp để hiển thị KPI trên webapp.
 */
/**
 * Dashboard "Tổng quan hợp đồng" — 1 lượt gọi duy nhất trả đủ: thẻ đếm theo
 * trạng thái, tổng giá trị hợp đồng, tổng khối lượng đã thực hiện, VÀ danh
 * sách phân trang — tất cả đã áp dụng ĐÚNG bộ lọc (số HĐ / tên chủ rừng /
 * khoảng ngày ký / trạng thái). Đọc từ cache Draft_BaoCaoHopDong (đã có sẵn
 * giá trị/khối lượng tính trước) — KHÔNG tính lại từ HD_RUNG mỗi lần lọc.
 */
/**
 * Giao diện mới: tiến độ hồ sơ 1 hợp đồng cho thanh 5 bước ở trang Hợp đồng (Chủ rừng → Tài khoản → Lô rừng & hồ sơ →
 * GPS → Ảnh). Dùng ĐÚNG hàm của điều kiện chuyển "Đang thực hiện" (kiemTraDuHoSoDeThucHien_, 37_KiemTraDuHoSo.gs) —
 * trước đây đọc cache Draft (cách tính khác) nên thanh tiến độ ✓ đủ 5 bước mà bấm Duyệt vẫn bị báo "Chưa đủ hồ sơ".
 * Chỉ đọc các dòng của hợp đồng này.
 */
function TIEN_DO_HO_SO_HD_(idHD) {
  _yeuCauQuyen_(QUYEN.XEM);
  idHD = (idHD || '').toString().trim();
  const kt = kiemTraDuHoSoDeThucHien_(idHD);
  if (kt.khongThay) return { coDuLieu: false };
  return { coDuLieu: true, du: kt.du, buoc: kt.buoc, thieu: kt.thieu, thieuHoSoChiTiet: kt.thieu.join(' · ') };
}

function LAY_TONG_QUAN_HOP_DONG_(boLoc) {
  _yeuCauQuyen_(QUYEN.XEM);
  boLoc = boLoc || {};
  const trang = boLoc.trang || 1, kichThuoc = boLoc.kichThuoc || 20;
  const soHDLoc = (boLoc.soHD || '').toString().trim().toLowerCase();
  const tenLoc = (boLoc.tenChuRung || '').toString().trim().toLowerCase();
  const tinhTrangLoc = (boLoc.tinhTrangLoc || '').toString().trim();
  const tuNgay = boLoc.tuNgay ? new Date(boLoc.tuNgay) : null;
  const denNgay = boLoc.denNgay ? new Date(boLoc.denNgay) : null;
  // ⚠️ ĐÃ SỬA: "yyyy-mm-dd" từ ô chọn ngày trên webapp được new Date() hiểu là
  // 00:00 UTC (= 07:00 giờ VN) — nếu không ép về đúng nửa đêm giờ VN, hợp đồng
  // ký ĐÚNG ngày tuNgay (lưu mốc 00:00 giờ VN, tức 17:00 UTC hôm trước) sẽ bị
  // tính là NHỎ HƠN tuNgay và bị loại nhầm khỏi kết quả lọc "từ ngày".
  if (tuNgay) tuNgay.setHours(0, 0, 0, 0);
  if (denNgay) denNgay.setHours(23, 59, 59, 999); // lấy trọn ngày kết thúc

  const list = _dsTongQuanCoCache_(); // không cần cờ ảnh / GPS; nhớ 5 phút theo dấu vân tay Draft (00_Config.gs)
  const locChung = list.filter(function (m) {
    if (soHDLoc && (m.soHD || '').toString().toLowerCase().indexOf(soHDLoc) === -1) return false;
    if (tenLoc && (m.tenChuRung || '').toString().toLowerCase().indexOf(tenLoc) === -1) return false;
    if (tuNgay || denNgay) {
      const ngay = m.ngayKy ? new Date(m.ngayKy) : null;
      if (!ngay) return false;
      if (tuNgay && ngay < tuNgay) return false;
      if (denNgay && ngay > denNgay) return false;
    }
    return true;
  });

  // Đếm theo trạng thái + tổng giá trị/khối lượng -> tính trên TOÀN BỘ tập đã lọc theo
  // số HĐ/tên/ngày (CHƯA áp trạng thái) để 5 thẻ trạng thái luôn phản ánh đúng phần còn
  // lại của mỗi trạng thái trong đúng khoảng đang xem, thẻ nào cũng bấm lọc tiếp được.
  const theoTrangThai = {};
  locChung.forEach(function (m) { const tt = m.tinhTrang || 'Đang thực hiện'; theoTrangThai[tt] = (theoTrangThai[tt] || 0) + 1; });

  const locDuTrangThai = tinhTrangLoc && tinhTrangLoc !== 'Tất cả' ? locChung.filter(function (m) { return (m.tinhTrang || 'Đang thực hiện') === tinhTrangLoc; }) : locChung;

  let tongGiaTriHopDong = 0, tongKhoiLuongThucHien = 0, tongGiaTriThucHien = 0, tongKhoiLuongDuKien = 0;
  locDuTrangThai.forEach(function (m) {
    tongGiaTriHopDong += Number(m.giaTriHopDong) || 0;
    tongKhoiLuongDuKien += Number(m.khoiLuongDuKien) || 0;
    tongKhoiLuongThucHien += Number(m.khoiLuongThucHien) || 0;
    tongGiaTriThucHien += Number(m.giaTriThucHien) || 0;
  });

  const daSapXep = locDuTrangThai.slice().sort(function (a, b) { return new Date(b.ngayKy || 0) - new Date(a.ngayKy || 0); });
  const tongSo = daSapXep.length;
  const tongTrang = Math.max(1, Math.ceil(tongSo / kichThuoc));
  const trangChuan = Math.min(Math.max(1, trang), tongTrang);
  const batDau = (trangChuan - 1) * kichThuoc;
  const items = daSapXep.slice(batDau, batDau + kichThuoc).map(function (m) {
    return { idHD: m.idHD, soHD: m.soHD, tenChuRung: m.tenChuRung, ngayKy: m.ngayKy, tinhTrang: m.tinhTrang,
      // Giao diện mới: bảng Tổng quan có khối lượng / giá trị / tiến độ từng hợp đồng
      khoiLuongDuKien: Number(m.khoiLuongDuKien) || 0, khoiLuongThucHien: Number(m.khoiLuongThucHien) || 0, giaTriHopDong: Number(m.giaTriHopDong) || 0 };
  });

  return {
    tongSoHopDong: locChung.length, theoTrangThai: theoTrangThai,
    tongGiaTriHopDong: tongGiaTriHopDong, tongKhoiLuongThucHien: tongKhoiLuongThucHien, tongGiaTriThucHien: tongGiaTriThucHien,
    tongKhoiLuongDuKien: tongKhoiLuongDuKien,
    items: items, trang: trangChuan, tongTrang: tongTrang, tongSo: tongSo
  };
}

function layTinhHinhThucHien_() {
  _yeuCauQuyen_(QUYEN.XEM);
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
      soHDCoAnh: chiTiet.filter(function (c) { return c.coAnh; }).length
      // P-07a: không trả "chiTiet" — trang Báo cáo chỉ dùng số đếm
    };
  } catch (e) {
    ghiLoiBackend_('layTinhHinhThucHien', e);
    throw new Error('layTinhHinhThucHien lỗi: ' + e.message);
  }
}
/** layBaoCaoHoSoRung_() ĐÃ CHUYỂN SANG 16_DraftHoSoRung.gs — đọc cache Draft_HoSoRung
 *  thay vì đọc trực tiếp HD_RUNG+HD_GPS+HD_NCC mỗi lần tải (nguyên nhân treo/nghẽn
 *  khi HD_RUNG nhiều dòng). KHÔNG khai báo lại ở đây để tránh xung đột hàm trùng tên. */

/**
 * Chi tiết đầy đủ 1 lô rừng (tọa độ từng điểm + ảnh) — dùng khi bấm "Xem chi tiết".
 *
 * ⚠️ ĐÃ SỬA: trước đây CHỈ lấy ảnh từ Draft_AnhRung (bảng nháp của luồng "Tải ảnh
 * kiểm tra -> Duyệt") — bảng này CHỈ có dữ liệu nếu ảnh đi đúng luồng đó và có
 * gán rõ ID_RUNG. Ảnh thêm bằng "dán link ảnh có sẵn" (chức năng cũ, đã gỡ)
 * hoặc ảnh import sẵn từ trước ghi THẲNG vào HD_Picture và KHÔNG hề có mặt
 * trong Draft_AnhRung -> "Xem chi tiết" trước đây luôn trống với các ảnh này.
 * Lưu ý cấu trúc gốc: HD_Picture chỉ lưu theo ID_HD (cả hợp đồng), KHÔNG lưu
 * theo từng lô rừng riêng — nên không thể biết chắc 1 ảnh trong HD_Picture
 * thuộc lô rừng cụ thể nào. Giải pháp: hiện thêm khối "Ảnh chung của hợp đồng"
 * (đọc từ HD_Picture) bên cạnh khối "Ảnh riêng của lô rừng này" (Draft_AnhRung,
 * chính xác theo lô vì có ID_RUNG) — ghi rõ nhãn để không gây hiểu lầm.
 */
function layChiTietHoSoMotLoRung_(idRung) {
  _yeuCauQuyen_(QUYEN.XEM);
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
  const rowsAnh = readData_(SHEET_NAME.HD_PICTURE); // P-05: đọc 1 lần, dùng cho mọi định danh bên dưới
  const anhTuHDPictureTheoDungLoNay = layAnhTheoDinhDanhHDPicture_(idRung, rowsAnh);
  const anhRiengCuaLo = layDraftAnhChoRung_(idRung, idHD).filter(function (a) { return a.trangThai === 'Đã duyệt'; }).concat(anhTuHDPictureTheoDungLoNay);

  let anhChungMoHo = idHD ? layAnhTheoDinhDanhHDPicture_(idHD, rowsAnh) : [];
  rungCungHopDong.forEach(function (r) {
    const idRungKhac = (r[RUNG_COL.ID_RUNG] || '').toString().trim();
    if (idRungKhac && idRungKhac !== idRung) anhChungMoHo = anhChungMoHo.concat(layAnhTheoDinhDanhHDPicture_(idRungKhac, rowsAnh));
  });

  return {
    toaDo: layGPSCuaRung_(idRung),
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
function layBaoCaoThanhToan_() {
  _yeuCauQuyen_(QUYEN.XEM);
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
 * ============================================================
 *  CẬP NHẬT SHEET DRAFT BÁO CÁO — GỌI NGAY MỖI KHI HỢP ĐỒNG/RỪNG/TÀI KHOẢN THAY ĐỔI
 * ============================================================
 * Đây là "trigger" theo đúng nghĩa thực tế nhất: thay vì chờ trigger định kỳ
 * (chạy theo giờ/phút, có độ trễ), hàm này được GỌI TRỰC TIẾP ngay sau mỗi
 * thao tác ghi dữ liệu (tạo/sửa/xóa hợp đồng, rừng, tài khoản — xem các hàm
 * TAO_HOP_DONG_MOI_, LUU_HOP_DONG_DAY_DU_, THEM_LO_RUNG_MOI_... ở 06_CreateUpdate.gs),
 * nên Draft LUÔN mới ngay lập tức, không có độ trễ, và các báo cáo không cần
 * tính lại gì cả — chỉ đọc thẳng từ Draft_BaoCaoHopDong (rất nhanh).
 */
/**
 * Hàm tính toán THUẦN TÚY cho 1 hợp đồng — KHÔNG tự đọc sheet gì cả, nhận sẵn
 * dữ liệu đã lọc/gộp làm tham số. Dùng chung cho cả CAP_NHAT_DRAFT_MOT_HOP_DONG_
 * (1 hợp đồng, tự lọc từ sheet) lẫn XAY_DUNG_LAI_TOAN_BO_DRAFT_ (hàng loạt, dữ
 * liệu đã group sẵn trong bộ nhớ) — tránh trùng lặp logic VÀ tránh đọc sheet
 * lặp lại nhiều lần khi xử lý hàng loạt.
 */
function tinhDongDraftChoHopDong_(idHD, row, rungRows, stkRows, gpsRows, coAnh, dntt, ngayCan) {
  let tongKhoiLuongDuKien = 0, tongGiaTri = 0, tongKhoiLuongThucHienRung = 0, tongGiaTriThucHienRung = 0;
  rungRows.forEach(function (r) {
    const kl = soTuO_(r[RUNG_COL.KHOI_LUONG_DK]);
    const dg = soTuO_(r[RUNG_COL.DON_GIA]);
    const klTH = soTuO_(r[RUNG_COL.KHOI_LUONG_THUC_HIEN]);
    tongKhoiLuongDuKien += kl; tongGiaTri += dg * kl;
    tongKhoiLuongThucHienRung += klTH; tongGiaTriThucHienRung += dg * klTH;
  });

  const soHDChuan = (row[NCC_COL.SO_HD] || '').toString().trim();
  const khopDNTT = dntt && dntt.thanhCong ? dntt.theoSoHD[soHDChuan] : null;
  const tongKhoiLuongThucHien = khopDNTT ? khopDNTT.khoiLuong : tongKhoiLuongThucHienRung;
  const tongGiaTriThucHien = khopDNTT ? khopDNTT.giaTri : tongGiaTriThucHienRung;
  const nc = (ngayCan && ngayCan.thanhCong && ngayCan.theoSoHD[soHDChuan]) || null;

  const soLo = rungRows.length;
  const soLoDaDoGPS = rungRows.filter(function (r) { return soTuO_(r[RUNG_COL.DIEN_TICH_GPS]) > 0; }).length;
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
      const lat = (type === 'DMS') ? convertDmsToDd_(g[GPS_COL.LAT]) : parseFloat(g[GPS_COL.LAT]);
      const lng = (type === 'DMS') ? convertDmsToDd_(g[GPS_COL.LNG]) : parseFloat(g[GPS_COL.LNG]);
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

/**
 * H-12 (rà soát 28/09): GOM cập nhật Draft trong 1 thao tác lớn (Lưu chính thức, tạo/lưu hợp đồng đầy đủ). Trước đây
 * MỖI lần thêm lô / TK / điểm GPS đều gọi CAP_NHAT_DRAFT_MOT_HOP_DONG_ (đọc lại cả 5 sheet + cache) — 1 lần Lưu
 * ≈ 100+ lượt đọc cả sheet, lại nằm trong ScriptLock. Khi đang gom: chỉ ghi nhận ID, cập nhật 1 lần ở ketThucGomDraft_().
 */
let _draftDangGom_ = null; // { hd: Set<idHD>, rung: Set<idRung> } — chỉ trong 1 lượt chạy
function batDauGomDraft_() {
  if (_draftDangGom_) return false; // đã có nơi gom ở ngoài -> nơi đó sẽ xả
  _draftDangGom_ = { hd: new Set(), rung: new Set() };
  return true;
}
function ketThucGomDraft_(laNguoiGom) {
  if (!laNguoiGom || !_draftDangGom_) return true;
  const g = _draftDangGom_;
  _draftDangGom_ = null;
  let ok = true;
  chayVoiBoNhoDoc_(function () { // 2 bước dùng chung dòng đã đọc (00_Config.gs) — chỉ ghi sheet Draft
    if (g.hd.size && !capNhatDraftHangLoat_(Array.from(g.hd))) ok = false;
    if (g.rung.size && capNhatDraftHoSoRungHangLoat_(Array.from(g.rung)) === false) ok = false; // P-10: 1 lần cho mọi lô
  });
  return ok; // false = có phần Draft chưa cập nhật được (đã ghi nhật ký lỗi)
}

/**
 * Cập nhật báo cáo sau khi sửa 1 hợp đồng / 1 lô: Draft_BaoCaoHopDong (idHD) + Draft_HoSoRung (idRung) dùng chung dòng đã
 * đọc. Gọi SAU mọi lệnh ghi vào sheet gốc của thao tác (vd sau dongBoTongHopRungVaoHdNcc_).
 */
function capNhatBaoCaoSauKhiSua_(idHD, idRung) {
  chayVoiBoNhoDoc_(function () {
    if (idHD) CAP_NHAT_DRAFT_MOT_HOP_DONG_(idHD);
    if (idRung) CAP_NHAT_DRAFT_HOSORUNG_MOT_DONG_(idRung);
  });
}

/** Trả true nếu cập nhật xong (hoặc đã đưa vào hàng gom), false nếu lỗi — lỗi chỉ ghi log, không ném ra. */
function CAP_NHAT_DRAFT_MOT_HOP_DONG_(idHD) {
  idHD = (idHD || '').toString().trim();
  if (!idHD) return true;
  xoaCacheTraCuu_(); // dữ liệu HĐ vừa đổi -> chỉ mục Tra cứu dựng lại ở lần tìm sau
  if (_draftDangGom_) { _draftDangGom_.hd.add(idHD); return true; } // H-12: cập nhật 1 lần cuối thao tác
  try {
    // Tốc độ: chỉ đọc đúng các dòng của hợp đồng này (docDongTheoKhoa_) — trước đây đọc TOÀN BỘ 5 sheet sau MỖI lần lưu.
    const row = docDongTheoKhoa_(SHEET_NAME.HD_NCC, NCC_COL.ID_HD, [idHD])[0];
    if (!row) { XOA_DRAFT_MOT_HOP_DONG_(idHD); return true; } // hợp đồng đã bị xóa hẳn -> xóa luôn khỏi Draft

    const rungRows = docDongTheoKhoa_(SHEET_NAME.HD_RUNG, RUNG_COL.ID_KEY_HD, [idHD]);
    const stkRows = docDongTheoKhoa_(SHEET_NAME.HD_STK, STK_COL.ID_HD, [idHD]);

    const dntt = docCacheBaoCao_ChiDoc_('duLieuThucHienDNTT', layDuLieuThucHienTuDNTT_);
    const ngayCan = docCacheBaoCao_ChiDoc_('ngayCanMinMax', layNgayCanMinMaxTheoHopDong_KhongCache_);

    let coAnh = false;
    docDongTheoKhoa_(SHEET_NAME.HD_PICTURE, PICTURE_COL.ID_HD, [idHD]).forEach(function (r) {
      for (let c = PICTURE_COL.PICTURE_START; c <= PICTURE_COL.PICTURE_END; c++) { if (r[c]) { coAnh = true; break; } }
    });

    // Chỉ các điểm GPS của lô thuộc hợp đồng này (tinhDongDraftChoHopDong_ chỉ dùng gpsRows[idRung] của các lô đó)
    const gpsRowsRaw = docDongTheoKhoa_(SHEET_NAME.HD_GPS, GPS_COL.ID_KEY_GPS, rungRows.map(function (r) { return r[RUNG_COL.ID_RUNG]; }));
    const gpsByIdRung = {};
    gpsRowsRaw.forEach(function (g) {
      const idRung = (g[GPS_COL.ID_KEY_GPS] || '').toString().trim();
      if (!gpsByIdRung[idRung]) gpsByIdRung[idRung] = [];
      gpsByIdRung[idRung].push(g);
    });

    const dong = tinhDongDraftChoHopDong_(idHD, row, rungRows, stkRows, gpsByIdRung, coAnh, dntt, ngayCan);

    const sh = getOrCreateDraftBaoCaoSheet_();
    const cacDong = timCacDongDraftBaoCao_(sh, idHD);
    if (!cacDong.length) {
      sh.appendRow(dong);
    } else {
      sh.getRange(cacDong[0], 1, 1, dong.length).setValues([dong]);
      // H-05: 2 lượt cập nhật cùng lúc cho HĐ mới có thể đã append 2 dòng -> tổng Tổng quan/Báo cáo bị cộng đôi. Tự dọn.
      cacDong.slice(1).reverse().forEach(function (d) { sh.deleteRow(d); });
    }
    _draftDataCache = null; // xóa bộ nhớ đệm — nếu cùng lượt chạy có đọc lại Draft sau đây, phải thấy đúng dữ liệu vừa ghi
    return true;
  } catch (e) {
    // Không để lỗi cập nhật Draft làm hỏng thao tác chính (tạo/sửa hợp đồng vẫn phải thành công) — chỉ ghi log
    ghiNhatKy_('LỖI cập nhật Draft báo cáo', idHD, e.message);
    return false;
  }
}

function XOA_DRAFT_MOT_HOP_DONG_(idHD) {
  xoaCacheTraCuu_();
  try {
    const sh = getOrCreateDraftBaoCaoSheet_();
    const soDong = timDongDraftBaoCao_(sh, idHD);
    if (soDong !== -1) sh.deleteRow(soDong);
  } catch (e) { log_('WARNING', 'XOA_DRAFT_MOT_HOP_DONG_', 'Không xóa được dòng Draft báo cáo của ' + idHD + ' — báo cáo có thể còn dòng thừa', e); }
}

/**
 * PHIÊN BẢN HÀNG LOẠT của CAP_NHAT_DRAFT_MOT_HOP_DONG_ — cập nhật Draft cho NHIỀU
 * hợp đồng cùng lúc, đọc HD_NCC/HD_RUNG/HD_STK/HD_GPS/HD_Picture + cache thanh
 * toán CHỈ 1 LẦN DUY NHẤT rồi group trong bộ nhớ (giống XAY_DUNG_LAI_TOAN_BO_DRAFT_),
 * thay vì gọi CAP_NHAT_DRAFT_MOT_HOP_DONG_(idHD) N lần trong vòng lặp — mỗi lần tự
 * đọc lại TOÀN BỘ 5 sheet, là nguyên nhân N+1 khiến LAM_MOI_DRAFT_THEO_THAY_DOI_/
 * dongBoThanhToanNeuCoThayDoi_/CHAY_DONG_BO_THANH_TOAN_NGAY có thể timeout khi số
 * hợp đồng lớn (PERF-001). Chỉ cập nhật/thêm đúng các dòng của idsHopDong, KHÔNG
 * đụng tới dòng của các hợp đồng khác (khác XAY_DUNG_LAI_TOAN_BO_DRAFT_ vốn xóa
 * sạch và ghi lại toàn bộ).
 */
function capNhatDraftHangLoat_(idsHopDong) {
  return capNhatDraftHangLoatChiTiet_(idsHopDong).loi.length === 0;
}

/**
 * Như capNhatDraftHangLoat_ nhưng trả CHI TIẾT { loi: [idHD cập nhật không được], soDongGhi } — LAM_MOI_DRAFT_THEO_THAY_DOI_
 * dùng để giữ lại đúng các HĐ lỗi cho lượt sau (P0.1, nâng cấp 10/2026).
 * Nhiều HĐ: chỉ ghi các dòng THẬT SỰ ĐỔI (so từng ô, bỏ cột "Cập nhật lúc"), gom dòng liền nhau thành 1 lệnh, vị trí dòng
 * được xác định lại theo ID_HD ngay trước khi ghi/xóa. Trước đây ghi đè CẢ vùng Draft bằng bản đọc từ đầu lượt chạy ->
 * dòng của HĐ khác vừa được người dùng cập nhật trong lúc đó bị ghi đè bằng dữ liệu cũ.
 */
function capNhatDraftHangLoatChiTiet_(idsHopDong) {
  idsHopDong = Array.from(new Set((idsHopDong || []).map(function (id) { return (id || '').toString().trim(); }).filter(Boolean)));
  if (!idsHopDong.length) return { loi: [], soDongGhi: 0 };
  xoaCacheTraCuu_();
  // Tốc độ: ít hợp đồng (lưu 1 hợp đồng, tạo mới...) -> từng HĐ đọc đúng dòng & ghi đúng dòng.
  // Trả đúng kết quả (HĐ lỗi): đồng bộ thanh toán / làm mới dựa vào đây để KHÔNG ghi mốc "đã xử lý" khi lỗi (H-04, P0.1).
  if (idsHopDong.length <= 10) {
    const loiIt = idsHopDong.filter(function (id) { return !CAP_NHAT_DRAFT_MOT_HOP_DONG_(id); });
    return { loi: loiIt, soDongGhi: idsHopDong.length - loiIt.length };
  }
  try {
    const nccRows = readData_(SHEET_NAME.HD_NCC);
    const nccTheoId = {};
    nccRows.forEach(function (r) { const id = (r[NCC_COL.ID_HD] || '').toString().trim(); if (id) nccTheoId[id] = r; });

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

    const sh = getOrCreateDraftBaoCaoSheet_();
    const soCot = Object.keys(DRAFT_BAOCAO_COL).length;
    const lastRow = sh.getLastRow();
    const duLieuHienTai = lastRow >= 2 ? sh.getRange(2, 1, lastRow - 1, soCot).getValues() : [];
    const dongCuTheoId = {}; // idHD -> dòng Draft đầu tiên đang có (để so có đổi không)
    duLieuHienTai.forEach(function (r) {
      const id = (r[DRAFT_BAOCAO_COL.ID_HD] || '').toString().trim();
      if (id && !dongCuTheoId.hasOwnProperty(id)) dongCuTheoId[id] = r;
    });

    const canGhi = {};   // idHD -> dòng mới (chỉ HĐ có thay đổi)
    const canXoa = {};   // idHD -> true: HĐ đã bị xóa hẳn
    idsHopDong.forEach(function (idHD) {
      const row = nccTheoId[idHD];
      if (!row) { if (dongCuTheoId.hasOwnProperty(idHD)) canXoa[idHD] = true; return; }
      const dong = tinhDongDraftChoHopDong_(idHD, row, rungByHD[idHD] || [], stkByHD[idHD] || [], gpsByIdRung, !!coAnhByHD[idHD], dntt, ngayCan);
      const arr = [];
      for (let k = 0; k < soCot; k++) arr[k] = (dong[k] === undefined ? '' : dong[k]);
      if (!dongCuTheoId.hasOwnProperty(idHD) || _dongDraftKhacNhau_(dongCuTheoId[idHD], arr)) canGhi[idHD] = arr;
    });
    const soDongGhi = _ghiDraftTheoId_(sh, soCot, canGhi, canXoa, idsHopDong);
    _draftDataCache = null;
    return { loi: [], soDongGhi: soDongGhi };
  } catch (e) {
    ghiNhatKy_('LỖI cập nhật Draft báo cáo hàng loạt', '', idsHopDong.length + ' HĐ: ' + e.message);
    return { loi: idsHopDong, soDongGhi: 0 };
  }
}

/** So 2 dòng Draft (bỏ cột "Cập nhật lúc"): ngày so theo thời điểm, còn lại so chuỗi. */
function _dongDraftKhacNhau_(cu, moi) {
  const chuan = function (v) {
    if (v instanceof Date) return 'D' + v.getTime();
    if (v === null || v === undefined) return '';
    return String(v);
  };
  for (let k = 0; k < moi.length; k++) {
    if (k === DRAFT_BAOCAO_COL.CAP_NHAT_LUC) continue;
    if (chuan(cu[k]) !== chuan(moi[k])) return true;
  }
  return false;
}

/**
 * Ghi các dòng Draft đã tính theo ID_HD: đọc lại cột ID ngay trước khi ghi (dòng có thể đã dịch do người khác thêm/xóa),
 * ghi đè dòng đầu tiên của mỗi HĐ (gom dòng liền nhau 1 lệnh), xóa dòng thừa trùng ID và dòng của HĐ đã xóa hẳn (từ dưới
 * lên), thêm dòng mới ở cuối 1 lệnh. Trả số dòng đã ghi/xóa.
 */
function _ghiDraftTheoId_(sh, soCot, canGhi, canXoa, idsXet) {
  const xet = {};
  idsXet.forEach(function (id) { xet[id] = true; });
  const viTriDau = {}, dongThua = [];
  const last = sh.getLastRow();
  const cotId = last >= 2 ? sh.getRange(2, DRAFT_BAOCAO_COL.ID_HD + 1, last - 1, 1).getValues() : [];
  cotId.forEach(function (r, i) {
    const id = (r[0] || '').toString().trim();
    if (!id || !xet[id]) return;
    if (canXoa[id] || viTriDau.hasOwnProperty(id)) dongThua.push(i + 2); // HĐ đã xóa / dòng trùng ID (H-05)
    else viTriDau[id] = i + 2;
  });
  let soGhi = 0;
  // 1) Ghi đè tại chỗ, gom các dòng liền nhau thành 1 lệnh
  const dsGhi = Object.keys(canGhi).filter(function (id) { return viTriDau.hasOwnProperty(id); })
    .map(function (id) { return { dong: viTriDau[id], v: canGhi[id] }; })
    .sort(function (a, b) { return a.dong - b.dong; });
  for (let i = 0; i < dsGhi.length;) {
    let j = i;
    while (j + 1 < dsGhi.length && dsGhi[j + 1].dong === dsGhi[j].dong + 1) j++;
    sh.getRange(dsGhi[i].dong, 1, j - i + 1, soCot).setValues(dsGhi.slice(i, j + 1).map(function (x) { return x.v; }));
    soGhi += j - i + 1;
    i = j + 1;
  }
  // 2) Xóa dòng thừa từ dưới lên (không làm lệch dòng phía trên)
  dongThua.sort(function (a, b) { return b - a; }).forEach(function (d) { sh.deleteRow(d); soGhi++; });
  // 3) HĐ chưa có dòng -> thêm ở cuối 1 lệnh
  const themMoi = Object.keys(canGhi).filter(function (id) { return !viTriDau.hasOwnProperty(id); }).map(function (id) { return canGhi[id]; });
  if (themMoi.length) { sh.getRange(Math.max(sh.getLastRow(), 1) + 1, 1, themMoi.length, soCot).setValues(themMoi); soGhi += themMoi.length; }
  return soGhi;
}

/**
 * XÂY DỰNG LẠI TOÀN BỘ Draft_BaoCaoHopDong từ đầu — chạy 1 LẦN DUY NHẤT lúc mới
 * triển khai hệ thống (khi Draft chưa có dữ liệu), hoặc bất cứ khi nào nghi ngờ
 * Draft bị lệch so với dữ liệu gốc. KHÔNG cần chạy định kỳ vì mỗi thao tác ghi
 * dữ liệu đã tự động gọi CAP_NHAT_DRAFT_MOT_HOP_DONG_ rồi.
 */
/**
 * LÀM MỚI THEO THAY ĐỔI THẬT — dùng cho nút "🔄 Làm mới dữ liệu" trên webapp.
 * KHÔNG tính lại toàn bộ từ đầu (khác hẳn XAY_DUNG_LAI_TOAN_BO_DRAFT_) — chỉ đọc nhật ký (NhatKy_SuaDoi) kể từ lần làm
 * mới trước, lấy ra đúng danh sách ID_HD đã thay đổi rồi CHỈ cập nhật lại Draft cho những hợp đồng đó.
 *
 * P0.1 (nâng cấp 10/2026) — trước đây mốc "đã làm mới" luôn được ghi kể cả khi cập nhật lỗi -> thay đổi bị bỏ sót vĩnh viễn:
 *  - Chỉ ghi mốc khi mọi HĐ cập nhật xong; HĐ lỗi được giữ lại (Script Properties DRAFT_LAM_MOI_CHO_LAI) và làm lại ở lượt sau.
 *    Không lưu được danh sách chờ -> KHÔNG ghi mốc.
 *  - Mốc theo DÒNG CUỐI đã đọc của nhật ký: chỉ đọc dòng mới, không bỏ sót dòng ghi đến chậm (giờ sớm hơn mốc). Nhật ký bị
 *    xóa / sắp xếp lại -> lọc theo giờ, xét chồng lấn 10 phút trước mốc (cập nhật lại 1 HĐ nhiều lần cho kết quả như nhau).
 *  - Cờ "đang chạy" (đặt dưới khóa ngắn): 2 lượt làm mới cùng lúc không xử lý chồng nhau; cờ quá 10 phút = lượt cũ bị ngắt.
 *  - Trả { thanhCong, soHopDongCapNhat, soLoi, hopDongLoi, ghiChu } (dangBan: true nếu lượt khác đang chạy).
 */
const DRAFT_LAM_MOI_CHONG_LAN_MS_ = 10 * 60 * 1000; // chỉ dùng khi không còn mốc theo dòng (nhật ký bị xóa / sắp xếp lại)
const DRAFT_LAM_MOI_CO_HET_HAN_MS_ = 10 * 60 * 1000;
const DRAFT_LAM_MOI_CHO_LAI_TOI_DA_ = 400;

function LAM_MOI_DRAFT_THEO_THAY_DOI_() {
  const props = PropertiesService.getScriptProperties();
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) return { thanhCong: false, dangBan: true, soHopDongCapNhat: 0, ghiChu: 'Hệ thống đang bận — dữ liệu sẽ được làm mới ở lần sau.' };
  try {
    const dangChay = Number(props.getProperty('DRAFT_LAM_MOI_DANG_CHAY') || 0);
    if (dangChay && Date.now() - dangChay < DRAFT_LAM_MOI_CO_HET_HAN_MS_) {
      return { thanhCong: false, dangBan: true, soHopDongCapNhat: 0, ghiChu: 'Đang có lượt làm mới khác chạy — thử lại sau ít phút.' };
    }
    props.setProperty('DRAFT_LAM_MOI_DANG_CHAY', String(Date.now()));
  } finally { lock.releaseLock(); }
  try {
    return lamMoiDraftThucThi_(props);
  } finally {
    try { props.deleteProperty('DRAFT_LAM_MOI_DANG_CHAY'); } catch (e) { /* cờ tự hết hạn sau 10 phút */ }
  }
}

function lamMoiDraftThucThi_(props) {
  const moocThoiGianTruoc = props.getProperty('DRAFT_MOOC_LAM_MOI_LAN_TRUOC');
  const tuThoiGian = moocThoiGianTruoc ? new Date(new Date(moocThoiGianTruoc).getTime() - DRAFT_LAM_MOI_CHONG_LAN_MS_) : new Date(0);
  const moocMoi = new Date(); // mốc cho lần sau = lúc BẮT ĐẦU lượt này (thay đổi trong lúc chạy sẽ được lượt sau xét)

  let choLai = [];
  try { choLai = JSON.parse(props.getProperty('DRAFT_LAM_MOI_CHO_LAI') || '[]'); } catch (e) { choLai = []; }
  const idsCanCapNhat = new Set(Array.isArray(choLai) ? choLai : []); // Set() chống trùng — HĐ đổi 5 lần chỉ cập nhật 1 lần
  // Nhật ký chỉ ghi thêm ở cuối -> mốc chính là DÒNG CUỐI đã đọc lần trước (kèm giờ của dòng đó để nhận ra nhật ký bị xóa /
  // sắp xếp lại): chỉ đọc các dòng mới, kể cả dòng có giờ sớm hơn mốc nhưng ghi vào Sheet chậm. Không khớp -> lọc theo giờ
  // với khoảng chồng lấn (như trên).
  const shNK = getOrCreateNhatKySheet_();
  const lastNK = shNK.getLastRow();
  let mocDong = null;
  try { mocDong = JSON.parse(props.getProperty('DRAFT_LAM_MOI_DONG_CUOI') || 'null'); } catch (e) { mocDong = null; }
  if (mocDong && mocDong.dong >= 1 && mocDong.dong <= lastNK && _dauGioNhatKy_(shNK.getRange(mocDong.dong, 1).getValue()) === mocDong.gio) {
    if (lastNK > mocDong.dong) shNK.getRange(mocDong.dong + 1, 4, lastNK - mocDong.dong, 1).getValues()
      .forEach(function (r) { const id = (r[0] || '').toString().trim(); if (id) idsCanCapNhat.add(id); });
  } else {
    _idHopDongTrongNhatKySau_(shNK, tuThoiGian, lastNK).forEach(function (id) { idsCanCapNhat.add(id); });
  }

  const ids = Array.from(idsCanCapNhat);
  const loi = new Set();
  if (ids.length) {
    capNhatDraftHangLoatChiTiet_(ids).loi.forEach(function (id) { loi.add(id); }); // PERF-001: 1 lần đọc-group-ghi
    // Cache "Hồ sơ rừng": lô của MỌI HĐ đổi đọc 1 lần (trước đây đọc cột HD_RUNG lại cho TỪNG hợp đồng — 1.000 HĐ = 2.000 lượt đọc)
    let hsrOk = true;
    try {
      const idRungs = docDongTheoKhoa_(SHEET_NAME.HD_RUNG, RUNG_COL.ID_KEY_HD, ids)
        .map(function (r) { return (r[RUNG_COL.ID_RUNG] || '').toString().trim(); }).filter(Boolean);
      if (idRungs.length) hsrOk = capNhatDraftHoSoRungHangLoat_(idRungs) !== false;
    } catch (e) { hsrOk = false; log_('WARNING', 'LAM_MOI_DRAFT_THEO_THAY_DOI_', 'Không cập nhật được cache Hồ sơ rừng', e); }
    if (!hsrOk) ids.forEach(function (id) { loi.add(id); });
  }

  const hopDongLoi = Array.from(loi);
  let ghiMoc = true;
  try {
    if (!hopDongLoi.length) props.deleteProperty('DRAFT_LAM_MOI_CHO_LAI');
    else if (hopDongLoi.length <= DRAFT_LAM_MOI_CHO_LAI_TOI_DA_) props.setProperty('DRAFT_LAM_MOI_CHO_LAI', JSON.stringify(hopDongLoi));
    else ghiMoc = false; // quá nhiều HĐ lỗi -> không lưu danh sách, giữ mốc cũ để lần sau xét lại từ đầu khoảng thời gian
  } catch (e) { ghiMoc = false; }
  if (ghiMoc) {
    props.setProperty('DRAFT_MOOC_LAM_MOI_LAN_TRUOC', moocMoi.toISOString());
    props.setProperty('DRAFT_LAM_MOI_DONG_CUOI', JSON.stringify({ dong: lastNK, gio: lastNK >= 1 ? _dauGioNhatKy_(shNK.getRange(lastNK, 1).getValue()) : '' }));
  }
  if (hopDongLoi.length) ghiNhatKy_('LỖI làm mới Draft báo cáo', '', hopDongLoi.length + ' HĐ chưa cập nhật được, sẽ làm lại ở lần sau: ' + hopDongLoi.slice(0, 20).join(', '));

  const soXong = ids.length - hopDongLoi.length;
  return {
    thanhCong: hopDongLoi.length === 0,
    soHopDongCapNhat: soXong,
    soLoi: hopDongLoi.length,
    hopDongLoi: hopDongLoi.slice(0, 50),
    ghiChu: hopDongLoi.length ? ('⚠️ ' + hopDongLoi.length + ' hợp đồng chưa cập nhật được (sẽ tự làm lại ở lần làm mới sau)' + (soXong ? '; đã cập nhật ' + soXong + ' hợp đồng.' : '.'))
      : (ids.length ? 'Đã cập nhật ' + ids.length + ' hợp đồng có thay đổi.' : 'Không có thay đổi gì kể từ lần làm mới trước.')
  };
}

/**
 * ID_HD có dòng nhật ký với thời gian > tuThoiGian. Nhật ký chỉ ghi thêm ở cuối nên đọc NGƯỢC từ cuối theo từng khối 2.000
 * dòng (2 cột Thời gian + ID_HD) và dừng khi cả khối đã cũ hơn mốc — trước đây đọc toàn bộ nhật ký (lớn dần mãi) mỗi lần bấm
 * "Làm mới". Nếu thấy thứ tự thời gian bị đảo (ai đó sắp xếp lại sheet) thì đọc tiếp tới hết, không dừng sớm.
 */
function _dauGioNhatKy_(v) { return v instanceof Date ? 'D' + v.getTime() : String(v === null || v === undefined ? '' : v); }

function _idHopDongTrongNhatKySau_(sh, tuThoiGian, denDong) {
  const ids = new Set();
  const last = denDong || sh.getLastRow();
  if (last < 2) return ids;
  const moc = tuThoiGian.getTime();
  const KHOI = 2000;
  let daoThuTu = false, dauKhoiSau = Infinity; // thời gian dòng đầu của khối phía dưới (đã đọc trước)
  for (let cuoi = last; cuoi >= 2;) {
    const dau = Math.max(2, cuoi - KHOI + 1);
    const n = cuoi - dau + 1;
    const tg = sh.getRange(dau, 1, n, 1).getValues();
    const id = sh.getRange(dau, 4, n, 1).getValues();
    let tatCaCu = true, truoc = -Infinity, dauKhoi = Infinity;
    for (let i = 0; i < n; i++) {
      const t = tg[i][0] ? new Date(tg[i][0]).getTime() : NaN;
      if (isNaN(t)) continue;
      if (t < truoc) daoThuTu = true;
      if (dauKhoi === Infinity) dauKhoi = t;
      truoc = t;
      if (t > moc) {
        tatCaCu = false;
        const ma = (id[i][0] || '').toString().trim();
        if (ma) ids.add(ma);
      }
    }
    if (truoc > dauKhoiSau) daoThuTu = true; // dòng cuối khối này mới hơn dòng đầu khối dưới
    if (dauKhoi !== Infinity) dauKhoiSau = dauKhoi;
    if (tatCaCu && !daoThuTu) break;
    cuoi = dau - 1;
  }
  return ids;
}

/** Menu Sheet (webapp gọi XAY_DUNG_LAI_TOAN_BO_DRAFT_ qua api()). */
function XAY_DUNG_LAI_TOAN_BO_DRAFT() {
  _yeuCauQuyen_(QUYEN.QUAN_TRI);
  return XAY_DUNG_LAI_TOAN_BO_DRAFT_();
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
function XAY_DUNG_LAI_TOAN_BO_DRAFT_() {
  _yeuCauQuyen_(QUYEN.QUAN_TRI);
  xoaCacheTraCuu_();
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

  // M-10 (rà soát 28/09): xây vào sheet TẠM, xong hết mới chép sang Draft thật bằng 1 lệnh. Trước đây xóa sạch Draft
  // ngay đầu lượt -> nếu phải chạy nhiều lượt (quá 4,5 phút), GIỮA các lượt mọi báo cáo trống; và tiếp tục theo SỐ THỨ TỰ
  // dòng HD_NCC -> thêm/xóa hợp đồng giữa 2 lượt làm sót/trùng. Giờ tiếp tục theo ID_HD đã có trong sheet tạm.
  props.deleteProperty('XAY_DUNG_DRAFT_TIEP_TUC_TU'); // mốc kiểu cũ (số thứ tự) — không dùng nữa
  const soCot = Object.keys(DRAFT_BAOCAO_COL).length;
  const ssBC = getReportSS_();
  const TEN_TAM = SHEET_NAME.DRAFT_BAOCAO + '_TAM';
  const shTam = ssBC.getSheetByName(TEN_TAM) || ssBC.insertSheet(TEN_TAM);
  const lastTam = shTam.getLastRow();
  const daXong = {};
  if (lastTam >= 1) shTam.getRange(1, DRAFT_BAOCAO_COL.ID_HD + 1, lastTam, 1).getValues().forEach(function (r) { const id = (r[0] || '').toString().trim(); if (id) daXong[id] = true; });

  const tatCaDong = [];
  let dungGiuaChung = false, soDaXong = Object.keys(daXong).length;
  for (let i = 0; i < nccRows.length; i++) {
    const row = nccRows[i];
    const idHD = (row[NCC_COL.ID_HD] || '').toString().trim();
    if (!idHD || daXong[idHD]) continue;
    if (new Date().getTime() - thoiDiemBatDau > GIOI_HAN_THOI_GIAN_MS) { dungGiuaChung = true; break; }
    const dong = tinhDongDraftChoHopDong_(
      idHD, row, rungByHD[idHD] || [], stkByHD[idHD] || [], gpsByIdRung, !!coAnhByHD[idHD], dntt, ngayCan
    );
    const arr = [];
    for (let k = 0; k < soCot; k++) arr[k] = (dong[k] === undefined ? '' : dong[k]);
    tatCaDong.push(arr);
    daXong[idHD] = true;
  }
  if (tatCaDong.length) {
    const dongDau = shTam.getLastRow() + 1;
    // CCCD dạng chữ ở sheet tạm (giữ số 0 đầu khi chép sang Draft thật) — xem _dinhDangChuCccdDraftBC_
    [DRAFT_BAOCAO_COL.CCCD_CHU_RUNG, DRAFT_BAOCAO_COL.CCCD_UY_QUYEN].forEach(function (c) { shTam.getRange(dongDau, c + 1, tatCaDong.length, 1).setNumberFormat('@'); });
    shTam.getRange(dongDau, 1, tatCaDong.length, soCot).setValues(tatCaDong);
  }
  soDaXong += tatCaDong.length;

  if (dungGiuaChung) {
    return '⏸️ Đã xử lý ' + soDaXong + '/' + nccRows.length + ' hợp đồng (dừng tạm vì gần hết thời gian chạy — báo cáo hiện tại vẫn giữ nguyên). ' +
      'BẤM LẠI đúng mục menu này để TIẾP TỤC (không tính lại phần đã xong).';
  }

  // Xong toàn bộ: thay Draft thật bằng dữ liệu mới trong 1 lệnh ghi (đệm dòng trống nếu Draft cũ dài hơn)
  const duLieuMoi = shTam.getLastRow() >= 1 ? shTam.getRange(1, 1, shTam.getLastRow(), soCot).getValues() : [];
  const sh = getOrCreateDraftBaoCaoSheet_();
  const soDongGhi = Math.max(sh.getLastRow() - 1, duLieuMoi.length);
  while (duLieuMoi.length < soDongGhi) duLieuMoi.push(new Array(soCot).fill(''));
  if (soDongGhi) sh.getRange(2, 1, soDongGhi, soCot).setValues(duLieuMoi);
  ssBC.deleteSheet(shTam);
  _draftDataCache = null;
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
function THIET_LAP_TRIGGER_ONEDIT_DRAFT_() {
  _yeuCauQuyen_(QUYEN.QUAN_TRI);
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'xuLyOnEditDraft_') ScriptApp.deleteTrigger(t); // xóa trigger cũ tránh tạo trùng
  });
  ScriptApp.newTrigger('xuLyOnEditDraft_').forSpreadsheet(getSS_()).onEdit().create();
  return { thanhCong: true, thongBao: 'Đã bật bẫy nhật ký tự động — mọi sửa đổi trực tiếp trên HD_NCC/HD_RUNG/HD_STK/HD_GPS/HD_Picture sẽ tự cập nhật Draft báo cáo ngay lập tức.' };
}
/** Gọi từ menu Sheet — hiện popup alert (khác bản trên chỉ trả object cho webapp) */
function THIET_LAP_TRIGGER_ONEDIT_DRAFT_TU_MENU() {
  _yeuCauQuyen_(QUYEN.QUAN_TRI);
  const kq = THIET_LAP_TRIGGER_ONEDIT_DRAFT_();
  SpreadsheetApp.getUi().alert('✅ ' + kq.thongBao);
}
/** Tắt bẫy nhật ký tự động */
function TAT_TRIGGER_ONEDIT_DRAFT_() {
  _yeuCauQuyen_(QUYEN.QUAN_TRI);
  let daXoa = false;
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'xuLyOnEditDraft_') { ScriptApp.deleteTrigger(t); daXoa = true; }
  });
  return { thanhCong: true, thongBao: daXoa ? 'Đã tắt bẫy nhật ký tự động.' : 'Chưa từng bật, không có gì để tắt.' };
}
/** Kiểm tra đã bật hay chưa — dùng để hiện trạng thái trên webapp */
function KIEM_TRA_TRIGGER_ONEDIT_DRAFT_() {
  _yeuCauQuyen_(QUYEN.QUAN_TRI);
  const daBat = ScriptApp.getProjectTriggers().some(function (t) { return t.getHandlerFunction() === 'xuLyOnEditDraft_'; });
  return { daBat: daBat };
}

function xuLyOnEditDraft_(e) {
  try {
    if (!e || !e.range) return;
    const sh = e.range.getSheet();
    const ten = sh.getName();
    const cacTenLienQuan = [SHEET_NAME.HD_NCC, SHEET_NAME.HD_RUNG, SHEET_NAME.HD_STK, SHEET_NAME.HD_GPS, SHEET_NAME.HD_PICTURE];
    if (cacTenLienQuan.indexOf(ten) === -1) return; // sheet không liên quan đến Draft báo cáo -> bỏ qua

    // ⚠️ ĐÃ SỬA: TRƯỚC ĐÂY chỉ đọc e.range.getRow() (dòng đầu tiên) — nếu người
    // dùng dán/sửa NHIỀU dòng cùng lúc (vd dán 1 khối ô từ Excel), các dòng còn
    // lại trong vùng sửa bị bỏ qua hoàn toàn, khiến Draft không cập nhật cho
    // những hợp đồng/lô rừng đó. Giờ duyệt HẾT các dòng nằm trong e.range.
    const hangBatDau = Math.max(2, e.range.getRow()); // bỏ dòng tiêu đề
    const hangKetThuc = e.range.getRow() + e.range.getNumRows() - 1;
    if (hangKetThuc < hangBatDau) return;
    // M-09 (rà soát 28/09): đọc CẢ VÙNG vừa sửa bằng 1 lệnh (trước đây 1–2 lệnh getValue cho MỖI dòng — dán 500
    // dòng là 500–1.000 lệnh) và cập nhật Draft báo cáo 1 lần cho mọi hợp đồng liên quan (capNhatDraftHangLoat_).
    const vung = sh.getRange(hangBatDau, 1, hangKetThuc - hangBatDau + 1, Math.max(sh.getLastColumn(), 1)).getValues();
    let rungRowsCache = null; // chỉ đọc HD_RUNG 1 lần cho cả vùng sửa (nếu đang sửa HD_GPS)
    const idsHD = new Set();
    const idsHDSuaRung = new Set(); // hợp đồng có lô rừng bị sửa tay -> tổng hợp lại ct_hopdong + Z/T/AA
    const idsRung = new Set();      // cache "Hồ sơ rừng" cần cập nhật
    const idsHDHoSoRung = new Set();

    vung.forEach(function (r) {
      let idHD = null;
      if (ten === SHEET_NAME.HD_NCC) {
        idHD = r[NCC_COL.ID_HD];
        if (idHD) idsHDHoSoRung.add(idHD.toString().trim()); // Tình trạng HĐ đổi -> ảnh hưởng mọi lô rừng con
      } else if (ten === SHEET_NAME.HD_RUNG) {
        idHD = r[RUNG_COL.ID_KEY_HD];
        const idRungSua = (r[RUNG_COL.ID_RUNG] || '').toString().trim();
        if (idRungSua) idsRung.add(idRungSua);
        if (idHD) idsHDSuaRung.add(idHD.toString().trim());
      } else if (ten === SHEET_NAME.HD_STK) {
        idHD = r[STK_COL.ID_HD];
      } else if (ten === SHEET_NAME.HD_GPS) {
        const idRung = (r[GPS_COL.ID_KEY_GPS] || '').toString().trim();
        if (idRung) {
          if (!rungRowsCache) rungRowsCache = readData_(SHEET_NAME.HD_RUNG);
          const rung = rungRowsCache.find(function (x) { return (x[RUNG_COL.ID_RUNG] || '').toString().trim() === idRung; });
          idHD = rung ? rung[RUNG_COL.ID_KEY_HD] : null;
          idsRung.add(idRung); // tọa độ đổi -> cập nhật lại tọa độ TB trong cache
        }
      } else if (ten === SHEET_NAME.HD_PICTURE) {
        idHD = r[PICTURE_COL.ID_HD];
      }
      if (idHD) idsHD.add(idHD.toString().trim());
    });

    idsHDSuaRung.forEach(function (idHD) { dongBoTongHopRungVaoHdNcc_(idHD); });
    const gom = batDauGomDraft_(); // P-10: Draft báo cáo + Hồ sơ rừng cập nhật 1 lần cho cả vùng sửa
    try {
      idsHD.forEach(function (idHD) { CAP_NHAT_DRAFT_MOT_HOP_DONG_(idHD); });
      idsHDHoSoRung.forEach(function (idHD) { CAP_NHAT_DRAFT_HOSORUNG_CHO_HOPDONG_(idHD); });
      idsRung.forEach(function (idRung) { CAP_NHAT_DRAFT_HOSORUNG_MOT_DONG_(idRung); });
    } finally { ketThucGomDraft_(gom); }
  } catch (err) {
    // Không để lỗi trigger làm gián đoạn việc sửa sheet của người dùng — nhưng ghi log để còn biết Draft chưa cập nhật
    log_('ERROR', 'xuLyOnEditDraft_', 'Không cập nhật được Draft sau khi sửa tay trên Sheet', err);
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
  _yeuCauQuyen_(QUYEN.QUAN_TRI);
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
  _yeuCauQuyen_(QUYEN.QUAN_TRI);
  const ss = SpreadsheetApp.openByUrl(DNTT_URL);
  const sh = ss.getSheetByName(DNTT_SHEET_NAME) || ss.getSheets()[0];
  const props = PropertiesService.getScriptProperties();
  // P0 (nâng cấp 10/2026): lấy mốc TRƯỚC khi đọc nhưng chỉ GHI mốc sau khi xử lý xong — trước đây ghi mốc ngay đầu hàm,
  // lỗi giữa chừng thì trigger 30 phút tưởng "không có gì mới" và không làm lại.
  const soDong = sh.getLastRow();
  let thoiGianSua = null;
  try { thoiGianSua = DriveApp.getFileById(ss.getId()).getLastUpdated().getTime(); } catch (e) { /* bỏ qua nếu không lấy được */ }

  let thongBao;
  const tt = _lamMoiCacheThanhToan_();
  const idsHopDong = readData_(SHEET_NAME.HD_NCC).map(function (r) { return (r[NCC_COL.ID_HD] || '').toString().trim(); }).filter(Boolean);
  if (!tt.dnttOk) {
    thongBao = '❌ Chưa đồng bộ: ' + tt.loi + ' Số liệu thực hiện cũ được giữ nguyên.';
  } else if (!capNhatDraftHangLoat_(idsHopDong)) { // PERF-001: 1 lần đọc-group-ghi cho toàn bộ
    thongBao = '❌ Đã đọc DNTT nhưng chưa ghi được báo cáo (Draft) — thử lại sau ít phút; trigger 30 phút cũng sẽ tự làm lại.';
  } else {
    luuCacheBaoCao_('dnttDaApDung', _banThanhToanDaApDung_(tt, null));
    props.setProperty('DNTT_TINH_LAI_TOAN_BO_LUC', String(Date.now()));
    props.setProperty('DNTT_SO_DONG_LAN_TRUOC', soDong.toString());
    if (thoiGianSua !== null) props.setProperty('DNTT_THOI_GIAN_SUA_LAN_TRUOC', thoiGianSua.toString());
    thongBao = '✅ Đã đồng bộ lại "Khối lượng/Giá trị thực hiện" cho ' + idsHopDong.length + ' hợp đồng từ DNTT_GK_DN_CT mới nhất.' + (tt.canhBao ? ' ⚠️ ' + tt.canhBao : '');
  }
  if (/^❌/.test(thongBao)) ghiNhatKy_('LỖI đồng bộ thanh toán (chạy ngay)', '', thongBao);
  try { SpreadsheetApp.getUi().alert(thongBao); } catch (e) { /* chạy từ editor thì bỏ qua UI */ }
  return thongBao;
}

/**
 * Đọc lại DNTT_GK_DN_CT + PhieuCan_DN và lưu cache — CHỈ lưu khi đọc thành công (P0, nâng cấp 10/2026). Trước đây kết quả
 * lỗi (vd đổi tiêu đề cột, file tạm không phản hồi) được lưu đè lên cache tốt -> Draft của MỌI hợp đồng tính lại với khối
 * lượng thực hiện sai (lấy theo lô, thường = 0) và mốc vẫn bị ghi -> sai mãi cho tới khi DNTT được sửa lần nữa.
 * Phiếu cân lỗi: giữ cache ngày cân cũ, không chặn cập nhật khối lượng (không liên quan tiền), chỉ cảnh báo.
 * Trả { dnttOk, loi, canhBao }.
 */
function _lamMoiCacheThanhToan_() {
  _bangDNTTTrongLuot_ = null; // đọc DNTT MỚI cho lượt đồng bộ này (2 hàm dưới dùng chung 1 lần đọc)
  try { return _lamMoiCacheThanhToanThucThi_(); } finally { _bangDNTTTrongLuot_ = null; }
}
function _lamMoiCacheThanhToanThucThi_() {
  const dntt = layDuLieuThucHienTuDNTT_();
  if (!dntt || dntt.thanhCong !== true) return { dnttOk: false, loi: 'Không đọc được DNTT_GK_DN_CT — ' + ((dntt && dntt.loi) || 'không rõ lý do') + '.' };
  if (luuCacheBaoCao_('duLieuThucHienDNTT', dntt) === false) return { dnttOk: false, loi: 'Không lưu được cache thanh toán (sheet Cache_BaoCao).' };
  let canhBao = '';
  let ngayCan = layNgayCanMinMaxTheoHopDong_KhongCache_();
  if (ngayCan && ngayCan.thanhCong === true) { if (luuCacheBaoCao_('ngayCanMinMax', ngayCan) === false) canhBao = 'Chưa lưu được ngày cân mới.'; }
  else { canhBao = 'Không đọc được phiếu cân (' + ((ngayCan && ngayCan.loi) || 'không rõ') + ') — giữ ngày thực hiện cũ.'; ngayCan = null; }
  return { dnttOk: true, loi: '', canhBao: canhBao, dntt: dntt, ngayCan: ngayCan };
}

/**
 * P1 (nâng cấp 10/2026) — đồng bộ TĂNG DẦN: trước đây mỗi lần file DNTT có sửa (Drive "lastUpdated" của CẢ file, kể cả sửa
 * tab khác) là tính lại Draft cho MỌI hợp đồng. Nay so tổng hợp theo Số HĐ (khối lượng, giá trị, ngày cân, số CT) với bản ĐÃ
 * ÁP DỤNG THÀNH CÔNG vào Draft lần trước ('dnttDaApDung' trong Cache_BaoCao) -> chỉ tính lại HĐ có Số HĐ đổi (gồm dòng DNTT
 * mới / bị sửa / bị xóa). Không có bản đã áp dụng, hoặc đã quá 24 giờ kể từ lần tính lại toàn bộ -> tính lại toàn bộ.
 * Bản đã áp dụng chỉ được ghi SAU khi cập nhật Draft thành công -> lượt lỗi không làm mất thay đổi.
 */
const DNTT_TINH_LAI_TOAN_BO_SAU_MS_ = 24 * 3600 * 1000;
function _soHDThanhToanDoi_(cu, moi) {
  const doi = {};
  const a = cu || {}, b = moi || {};
  Object.keys(a).concat(Object.keys(b)).forEach(function (k) { if (JSON.stringify(a[k]) !== JSON.stringify(b[k])) doi[k.toString().trim()] = true; });
  return doi;
}
function _banThanhToanDaApDung_(tt, cu) {
  // JSON hóa giống hệt cách lưu cache (Date -> chuỗi ISO) để lần sau so đúng
  return JSON.parse(JSON.stringify({ d: tt.dntt.theoSoHD, n: tt.ngayCan ? tt.ngayCan.theoSoHD : ((cu && cu.n) || {}) }));
}
function _docCacheBaoCaoNeuCo_(tenCache) {
  try {
    const data = getOrCreateCacheSheet_().getDataRange().getValues();
    const dong = data.filter(function (r) { return r[0] === tenCache; });
    return dong.length ? JSON.parse(dong.map(function (r) { return r[2]; }).join('')) : null;
  } catch (e) { return null; }
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

    // H-04 (rà soát 28/09): mốc "đã xử lý" chỉ ghi SAU KHI làm xong (cuối hàm). Trước đây ghi ở đây, lượt chạy
    // lỗi / bị ngắt ở phút 6 thì lần sau tưởng "không có gì mới" -> khối lượng thực hiện cũ mãi.

    // Làm mới 2 cache liên quan đến thanh toán TRƯỚC (tính 1 LẦN DUY NHẤT ở đây, không phải để mỗi hợp đồng tự đọc lại
    // DNTT_GK_DN_CT/PhieuCan_DN riêng lẻ). P0: đọc lỗi -> giữ cache + Draft cũ, KHÔNG ghi mốc (lượt 30 phút sau thử lại).
    const daApDung = _docCacheBaoCaoNeuCo_('dnttDaApDung'); // đọc TRƯỚC khi lưu cache mới
    const tt = _lamMoiCacheThanhToan_();
    if (!tt.dnttOk) throw new Error(tt.loi + ' Giữ nguyên số liệu thực hiện cũ, lượt sau thử lại.');
    if (tt.canhBao) ghiNhatKy_('CẢNH BÁO đồng bộ thanh toán định kỳ', '', tt.canhBao);
    const banMoi = _banThanhToanDaApDung_(tt, daApDung);
    const lanToanBo = Number(props.getProperty('DNTT_TINH_LAI_TOAN_BO_LUC') || 0);
    const tangDan = !!(daApDung && daApDung.d && Date.now() - lanToanBo < DNTT_TINH_LAI_TOAN_BO_SAU_MS_);

    // Sau khi cache đã mới, cập nhật lại phần "đã thực hiện" cho TẤT CẢ hợp đồng —
    // lúc này CAP_NHAT_DRAFT_MOT_HOP_DONG_ chỉ ĐỌC cache vừa làm mới, không đọc lại sheet ngoài
    let idsHopDong;
    if (tangDan) {
      const doi = _soHDThanhToanDoi_(daApDung.d, banMoi.d);
      Object.keys(_soHDThanhToanDoi_(daApDung.n, banMoi.n)).forEach(function (k) { doi[k] = true; });
      idsHopDong = docCacCot_(SHEET_NAME.HD_NCC, [NCC_COL.SO_HD, NCC_COL.ID_HD])
        .filter(function (r) { return doi[(r[NCC_COL.SO_HD] || '').toString().trim()]; })
        .map(function (r) { return (r[NCC_COL.ID_HD] || '').toString().trim(); }).filter(Boolean);
    } else {
      idsHopDong = docCacCot_(SHEET_NAME.HD_NCC, [NCC_COL.ID_HD]).map(function (r) { return (r[NCC_COL.ID_HD] || '').toString().trim(); }).filter(Boolean);
    }
    if (!capNhatDraftHangLoat_(idsHopDong)) throw new Error('Cập nhật Draft báo cáo hàng loạt thất bại — lượt sau sẽ thử lại.'); // PERF-001
    if (luuCacheBaoCao_('dnttDaApDung', banMoi) === false) throw new Error('Không lưu được mốc thanh toán đã áp dụng — lượt sau tính lại.');
    if (!tangDan) props.setProperty('DNTT_TINH_LAI_TOAN_BO_LUC', String(Date.now()));
    props.setProperty('DNTT_SO_DONG_LAN_TRUOC', soDongHienTai.toString());
    if (thoiGianSuaGanNhat !== null) props.setProperty('DNTT_THOI_GIAN_SUA_LAN_TRUOC', thoiGianSuaGanNhat.toString());
  } catch (e) {
    ghiNhatKy_('LỖI đồng bộ thanh toán định kỳ', '', e.message);
  }
}
