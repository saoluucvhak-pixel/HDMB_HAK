/**
 * ============================================================
 *  18_BaoCaoTongHop_Gop.gs
 *  GỘP 4 lệnh gọi rời rạc của trang "Báo cáo tổng hợp":
 *    - layBaoCaoHopDongPhanTrang   (tab "Báo cáo hợp đồng")
 *    - layTongHopChoWebapp         (KPI + chi tiết "Tình hình thực hiện")
 *    - layTinhHinhThucHien         (KPI GPS/hồ sơ/ảnh theo trạng thái)
 *    - layDanhSachThanhLy          (tab "Thanh lý hợp đồng")
 *  thành 1 HÀM DUY NHẤT, chạy trong 1 LƯỢT THỰC THI DUY NHẤT.
 *
 *  TẠI SAO CẦN GỘP:
 *  Mỗi lệnh google.script.run là 1 lượt thực thi server RIÊNG BIỆT của Apps
 *  Script. Hai biến bộ nhớ đệm "trong 1 lượt chạy" đã có sẵn:
 *      let _reportSSCache = null;   (00_Config.gs)
 *      let _draftDataCache = null;  (00_Config.gs)
 *  chỉ có tác dụng NẾU CÙNG 1 lượt thực thi gọi lại nhiều lần. Khi 4 hàm trên
 *  được bắn đồng thời từ DOMContentLoaded (như code cũ), mỗi hàm là 1 lượt
 *  thực thi khác nhau -> mỗi hàm tự mở lại file Report ngoài (SpreadsheetApp.
 *  openById — có độ trễ mạng) VÀ tự đọc lại TOÀN BỘ sheet Draft_BaoCaoHopDong
 *  (getRange().getValues() toàn bộ hàng) — cùng 1 dữ liệu bị đọc trùng 4 lần,
 *  cộng thêm khả năng bị xếp hàng chờ do giới hạn số lượt thực thi đồng thời
 *  của Apps Script. Đó là lý do trang "chậm" dù đã đọc từ Draft (nhanh) chứ
 *  không tính lại từ đầu.
 *
 *  HÀM NÀY: mở Report 1 lần, gọi docToanBoDraftBaoCao_() ĐÚNG 1 LẦN, rồi tính
 *  cả 4 khối kết quả từ CÙNG 1 mảng dữ liệu đã đọc trong bộ nhớ — không đọc
 *  sheet thêm lần nào nữa. Cấu trúc dữ liệu trả về cho từng khối được giữ
 *  NGUYÊN VẸN như 4 hàm gốc — chỉ đổi CÁCH GỌI (1 lần thay vì 4 lần), không
 *  đổi cách các hàm render ở frontend (10_Page_BaoCao.html) DÙNG dữ liệu.
 *
 *  LƯU Ý: 4 hàm gốc (layBaoCaoHopDongPhanTrang, layTongHopChoWebapp,
 *  layTinhHinhThucHien, layDanhSachThanhLy) VẪN GIỮ NGUYÊN, không xóa — vẫn
 *  dùng cho các thao tác lẻ sau khi trang đã tải xong (đổi trang, bấm "Lọc",
 *  bấm "Làm mới dữ liệu" của riêng 1 bảng...), vì các thao tác đó vốn dĩ chỉ
 *  bắn 1 lệnh tại 1 thời điểm nên không có vấn đề gọi trùng lặp.
 *
 * @param {Object} boLocBC  Bộ lọc cho tab "Báo cáo hợp đồng" — { tuNgay, denNgay,
 *                          soHD, tenChuRung, tenNguoiUyQuyen, diaChiRung, tinhTrang }
 * @param {Object} boLocTL  Bộ lọc cho tab "Thanh lý hợp đồng" — { soHD, tenChuRung, tenUyQuyen }
 * @param {number} trangBC  Trang hiện tại của bảng "Báo cáo hợp đồng" (mặc định 1)
 * @param {number} trangTL  Trang hiện tại của bảng "Thanh lý hợp đồng" (mặc định 1)
 * @param {boolean} boBuoc  true = chạy LAM_MOI_DRAFT_THEO_THAY_DOI() trước khi đọc
 *                          (chỉ cập nhật hợp đồng CÓ THAY ĐỔI, không tính lại từ đầu)
 * @return {Object} { baoCaoHopDong, tongHopWebapp, tinhHinhThucHien, danhSachThanhLy }
 */
function TAI_TRANG_BAO_CAO_TONG_HOP(boLocBC, boLocTL, trangBC, trangTL, boBuoc) {
  try {
    boLocBC = boLocBC || {};
    boLocTL = boLocTL || {};
    trangBC = trangBC || 1;
    trangTL = trangTL || 1;
    const KICH_THUOC = 20;
    const boBuocThat = !!boBuoc;

    // Chỉ làm mới Draft ĐÚNG 1 LẦN cho cả trang (trước đây có thể bị gọi tới
    // 3 lần nếu cả 3 hàm cùng nhận forceLamMoi=true).
    if (boBuocThat) LAM_MOI_DRAFT_THEO_THAY_DOI();

    // ---- ĐỌC DRAFT ĐÚNG 1 LẦN — dùng chung cho cả 4 khối bên dưới ----
    const tatCa = docToanBoDraftBaoCao_();

    const chuaLoc_ = function (s, tk) { return !tk || (s || '').toString().toLowerCase().indexOf(tk.toLowerCase()) !== -1; };

    // ================================================================
    // 1. BÁO CÁO HỢP ĐỒNG (phân trang + lọc) — GIỐNG HỆT layBaoCaoHopDongPhanTrang
    // ================================================================
    const dsBaoCaoHD = tatCa.map(function (m) {
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

    const tuNgay = boLocBC.tuNgay ? new Date(boLocBC.tuNgay) : null;
    const denNgay = boLocBC.denNgay ? new Date(boLocBC.denNgay) : null;

    const locBC = dsBaoCaoHD.filter(function (r) {
      const ngayKy = new Date(r.ngayKy);
      if (tuNgay && ngayKy < tuNgay) return false;
      if (denNgay && ngayKy > denNgay) return false;
      if (!chuaLoc_(r.soHD, boLocBC.soHD)) return false;
      if (!chuaLoc_(r.tenChuRung, boLocBC.tenChuRung)) return false;
      if (!chuaLoc_(r.tenUyQuyen, boLocBC.tenNguoiUyQuyen)) return false;
      if (!chuaLoc_(r.diaChiRung, boLocBC.diaChiRung)) return false;
      const tinhTrang = (r.tinhTrang || 'Đang thực hiện').toString().trim();
      if (boLocBC.tinhTrang && boLocBC.tinhTrang !== 'Tất cả' && tinhTrang !== boLocBC.tinhTrang) return false;
      return true;
    });
    const tongSoBC = locBC.length;
    const tongTrangBC = Math.max(1, Math.ceil(tongSoBC / KICH_THUOC));
    const trangBCThat = Math.min(Math.max(1, trangBC), tongTrangBC);
    const batDauBC = (trangBCThat - 1) * KICH_THUOC;
    const baoCaoHopDong = {
      items: locBC.slice(batDauBC, batDauBC + KICH_THUOC),
      trang: trangBCThat, tongTrang: tongTrangBC, tongSo: tongSoBC, tuCache: !boBuocThat
    };

    // ================================================================
    // 2. TỔNG HỢP KPI + CHI TIẾT "Tình hình thực hiện" — GIỐNG HỆT layTongHopChoWebapp
    // ================================================================
    const listDangTH = tatCa.filter(function (m) { return m.tinhTrang === 'Đang thực hiện' || m.tinhTrang === 'Chờ thực hiện'; });
    const tongKhoiLuong = listDangTH.reduce(function (s, m) { return s + (Number(m.khoiLuongDuKien) || 0); }, 0);
    const tongGiaTriKPI = listDangTH.reduce(function (s, m) { return s + (Number(m.giaTriHopDong) || 0); }, 0);
    const tongHopWebapp = {
      soHopDong: listDangTH.length,
      tongKhoiLuong: tongKhoiLuong,
      tongGiaTri: tongGiaTriKPI,
      chiTiet: listDangTH.slice().sort(function (a, b) { return (b.soHD || 0) - (a.soHD || 0); }).map(function (m) {
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

    // ================================================================
    // 3. TÌNH HÌNH THỰC HIỆN (KPI GPS/hồ sơ/ảnh + đếm theo trạng thái)
    //    — GIỐNG HỆT layTinhHinhThucHien
    // ================================================================
    const chiTietTH = tatCa.map(function (m) {
      return {
        idHD: m.idHD, soHD: m.soHD, chuRung: m.tenChuRung, tinhTrang: m.tinhTrang || 'Đang thực hiện',
        tongLoRung: m.soLoRung, daDoGPSDuChua: m.daDoGPSDu, hoSoDuChua: m.hoSoDu, coAnh: m.coAnh
      };
    });
    const theoTrangThai = {};
    chiTietTH.forEach(function (c) { theoTrangThai[c.tinhTrang] = (theoTrangThai[c.tinhTrang] || 0) + 1; });
    const tinhHinhThucHien = {
      tongSoHopDong: chiTietTH.length,
      theoTrangThai: theoTrangThai,
      soHDDaDoGPSDu: chiTietTH.filter(function (c) { return c.daDoGPSDuChua; }).length,
      soHDDuHoSo: chiTietTH.filter(function (c) { return c.hoSoDuChua; }).length,
      soHDCoAnh: chiTietTH.filter(function (c) { return c.coAnh; }).length,
      chiTiet: chiTietTH
    };

    // ================================================================
    // 4. DANH SÁCH THANH LÝ (phân trang + lọc) — GIỐNG HỆT layDanhSachThanhLy
    // ================================================================
    const listTL = tatCa
      .filter(function (m) { return m.tinhTrang !== 'Đã thanh lý'; })
      .filter(function (m) {
        if (!chuaLoc_(m.soHD, boLocTL.soHD)) return false;
        if (!chuaLoc_(m.tenChuRung, boLocTL.tenChuRung)) return false;
        if (!chuaLoc_(m.tenUyQuyen, boLocTL.tenUyQuyen)) return false;
        return true;
      })
      .map(function (m) {
        return {
          idHD: m.idHD, soHD: m.soHD, chuRung: m.tenChuRung,
          nguoiUyQuyen: m.tenUyQuyen || '(không ủy quyền)', tinhTrang: m.tinhTrang,
          khoiLuongHopDong: m.khoiLuongDuKien, giaTriHopDong: m.giaTriHopDong,
          khoiLuongThucHien: m.khoiLuongThucHien, giaTriThucHien: m.giaTriThucHien,
          khoiLuongConLai: m.khoiLuongConLai, giaTriConLai: m.giaTriConLai,
          thucHienTuNgay: m.thucHienTuNgay, thucHienDenNgay: m.thucHienDenNgay
        };
      });
    const tongSoTL = listTL.length;
    const tongTrangTL = Math.max(1, Math.ceil(tongSoTL / KICH_THUOC));
    const trangTLThat = Math.min(Math.max(1, trangTL), tongTrangTL);
    const batDauTL = (trangTLThat - 1) * KICH_THUOC;
    const danhSachThanhLy = {
      items: listTL.slice(batDauTL, batDauTL + KICH_THUOC),
      trang: trangTLThat, tongTrang: tongTrangTL, tongSo: tongSoTL
    };

    return {
      baoCaoHopDong: baoCaoHopDong,
      tongHopWebapp: tongHopWebapp,
      tinhHinhThucHien: tinhHinhThucHien,
      danhSachThanhLy: danhSachThanhLy
    };
  } catch (e) {
    ghiLoiBackend_('TAI_TRANG_BAO_CAO_TONG_HOP', e);
    throw new Error('TAI_TRANG_BAO_CAO_TONG_HOP lỗi: ' + e.message);
  }
}
