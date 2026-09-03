/**
 * ============================================================
 *  06_CreateUpdate.gs
 *  TẠO MỚI HỢP ĐỒNG (HD_NCC) + THÊM/CẬP NHẬT RỪNG (HD_RUNG)
 *  + THÊM/CẬP NHẬT TÀI KHOẢN NHẬN TIỀN (HD_STK)
 *
 *  Quy tắc đặt mã (suy ra từ dữ liệu thật trong file của bạn):
 *   - ID_HD (HD_NCC.ID_HD)     = SoHD + "-" + NgayKy(yyyyMMdd)      vd: 293-20251218
 *   - ID_RUNG (HD_RUNG col C)  = "HAK" + SoHD + "_" + STT_rừng      vd: HAK293_1
 *   - MaRung (HD_RUNG col B)   = "HAK" + CCCD_chủ_rừng + "_" + STT  vd: HAK048074003768_1
 *   - ID_KEY_GPS (HD_GPS col A)= trùng với ID_RUNG ở trên (để join)
 *   - ID_GPS (HD_GPS col B)    = SoHD + "-" + NgayKy(yyyyMMdd)      vd: 284-20251218
 *   - ID_STK (HD_STK col B)    = trùng với ID_HD
 * ============================================================
 */

function formatNgay_(date) {
  return Utilities.formatDate(new Date(date), Session.getScriptTimeZone() || 'GMT+7', 'yyyyMMdd');
}

/**
 * Sinh SỐ HỢP ĐỒNG tự động theo công thức: yyyymmdd + STT trong ngày (3 chữ số).
 * Ví dụ hợp đồng thứ 2 ký ngày 25/07/2026 -> "20260725002".
 * Vẫn có thể điền tay số hợp đồng khác (bỏ qua hàm này) khi tạo hợp đồng.
 */
function soHopDongTuDong(ngayKy) {
  const ngay = new Date(ngayKy || new Date());
  const tienTo = Utilities.formatDate(ngay, Session.getScriptTimeZone() || 'GMT+7', 'yyyyMMdd');
  const rows = readData_(SHEET_NAME.HD_NCC);
  let maxStt = 0;
  rows.forEach(function (r) {
    const soHD = (r[NCC_COL.SO_HD] || '').toString();
    if (soHD.indexOf(tienTo) === 0) {
      const stt = parseInt(soHD.substring(tienTo.length), 10);
      if (!isNaN(stt) && stt > maxStt) maxStt = stt;
    }
  });
  const sttMoi = (maxStt + 1).toString().padStart(3, '0');
  return tienTo + sttMoi;
}

/** (Giữ lại để tương thích ngược) Lấy số hợp đồng tiếp theo kiểu số tăng dần đơn giản = MAX(SoHD hiện có) + 1 */
function soHopDongTiepTheo() {
  const rows = readData_(SHEET_NAME.HD_NCC);
  let max = 0;
  rows.forEach(function (r) {
    const so = parseInt(r[NCC_COL.SO_HD], 10);
    if (!isNaN(so) && so > max) max = so;
  });
  return max + 1;
}

/**
 * Đọc ĐƠN GIÁ BÌNH QUÂN THÁNG từ Google Sheet Báo giá ngoài (sheet Baogia_DN_SAVE,
 * xem BAOGIA_URL/BAOGIA_SHEET_NAME ở 00_Config.gs), lấy các dòng có ngày rơi vào
 * CÙNG THÁNG với ngày ký hợp đồng, rồi tính trung bình cộng cột đơn giá.
 *
 * LƯU Ý: vì không có toàn quyền kiểm soát cấu trúc cột của sheet ngoài, hàm này
 * TỰ DÒ cột theo tên tiêu đề (dòng 1) — cột chứa "ngày" (không phân biệt hoa/thường,
 * có dấu/không dấu) coi là cột ngày, cột chứa "giá" coi là cột đơn giá. Nếu sheet
 * ngoài đặt tên cột khác quy ước này, cần chỉnh lại hàm hoặc báo để cập nhật.
 * Trả về { thanhCong, donGiaBinhQuan, soDongDuLieu, loi }
 */
/**
 * Đọc dữ liệu ĐÃ THỰC HIỆN thực tế (khối lượng + giá trị đã mua/nhập gỗ keo) từ
 * sheet ngoài DNTT_GK_DN_CT, gộp theo Số HĐ. Dùng cho báo cáo "Tình hình thực hiện".
 *
 * LƯU Ý: chưa xem được cấu trúc cột thật của sheet này — hàm TỰ DÒ cột theo tên
 * tiêu đề (dòng 1-5), tìm cột chứa "Số HĐ", và cột chứa "khối lượng/số lượng"
 * hoặc "giá trị/thành tiền". Nếu dò sai, trả về tiêu đề cột thực tế để đối chiếu
 * và chỉnh lại từ khóa trong hàm này cho đúng.
 * Trả về { thanhCong, theoSoHD: { [soHD]: {khoiLuong, giaTri} }, loi }
 */
/**
 * XEM TRƯỚC dữ liệu đọc được từ DNTT_GK_DN_CT — hiện rõ đã dò cột nào là
 * Số HĐ/Khối lượng/Giá trị + 10 dòng đầu đã gộp theo Số HĐ, để NGƯỜI DÙNG TỰ
 * KIỂM TRA đúng chưa trước khi bật dùng thật (tránh lặp lại lỗi lấy sai cột
 * làm sai cả báo cáo như lần trước).
 */
function layXemTruocDNTT() {
  try {
    const ss = SpreadsheetApp.openByUrl(DNTT_URL);
    const sh = ss.getSheetByName(DNTT_SHEET_NAME) || ss.getSheets()[0];
    const data = sh.getDataRange().getValues();
    if (data.length < 2) return { thanhCong: false, loi: 'Sheet chưa có dữ liệu.' };

    const boDauTV = function (s) {
      return (s || '').toString().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd');
    };
    const COT_KHOI_LUONG_THANH_TOAN = 12; // cột M — "Khối lượng" (theo xác nhận người dùng, thay cột I trước đây)
    let colKL = -1;
    if (boDauTV(data[0][COT_KHOI_LUONG_THANH_TOAN]).indexOf('khoi luong') !== -1) colKL = COT_KHOI_LUONG_THANH_TOAN;

    let colSoHD = -1, colGiaTri = -1, dongHeader = -1;
    const tuKhoaSoHD = ['so hd', 'sohd', 'so hop dong', 'ma hd', 'ma hop dong'];
    const tuKhoaKL = ['khoi luong', 'so luong', 'san luong'];
    const tuKhoaGiaTri = ['gia tri', 'thanh tien', 'tong tien', 'so tien'];
    for (let d = 0; d < Math.min(5, data.length - 1) && (colSoHD === -1 || (colKL === -1 && colGiaTri === -1)); d++) {
      const h = data[d].map(boDauTV);
      h.forEach(function (v, i) {
        if (colSoHD === -1 && tuKhoaSoHD.some(function (tk) { return v.indexOf(tk) !== -1; })) colSoHD = i;
        if (colKL === -1 && tuKhoaKL.some(function (tk) { return v.indexOf(tk) !== -1; })) colKL = i;
        if (colGiaTri === -1 && tuKhoaGiaTri.some(function (tk) { return v.indexOf(tk) !== -1; })) colGiaTri = i;
      });
      if (colSoHD !== -1 || colKL !== -1 || colGiaTri !== -1) dongHeader = d;
    }
    if (dongHeader === -1) dongHeader = 0;

    const tieuDeCot = data[0].map(function (h, i) { return { cot: i + 1, tieuDe: h }; });
    const mauDong = [];
    for (let i = dongHeader + 1; i < Math.min(data.length, dongHeader + 11); i++) {
      mauDong.push({
        soHD: colSoHD !== -1 ? data[i][colSoHD] : '(chưa dò được)',
        khoiLuong: colKL !== -1 ? data[i][colKL] : '(chưa dò được)',
        giaTri: colGiaTri !== -1 ? data[i][colGiaTri] : '(chưa dò được)'
      });
    }

    return {
      thanhCong: true, tieuDeCot: tieuDeCot,
      cotDaDo: { soHD: colSoHD + 1, khoiLuong: colKL + 1, giaTri: colGiaTri + 1 },
      mauDong: mauDong
    };
  } catch (e) {
    return { thanhCong: false, loi: 'Lỗi: ' + e.message };
  }
}

/**
 * Tính "Thực hiện từ ngày" (ngày cân 1 nhỏ nhất) và "Thực hiện đến ngày" (ngày cân 1 lớn
 * nhất) cho từng hợp đồng, dùng cho báo cáo Thanh lý:
 *  1. Đọc DNTT_GK_DN_CT, lấy danh sách "Số CT" (cột L, index 11) theo từng Số HĐ.
 *  2. Đọc PhieuCan_DN, tra theo cột W (index 22) khớp với "Số CT" đó, lấy "Ngày cân 1" (cột B, index 1).
 *  3. Gộp lại min/max ngày cân theo từng hợp đồng.
 * ⚠️ Cột Số HĐ trong DNTT_GK_DN_CT vẫn tự dò theo từ khóa (chưa được xác nhận cột cụ thể).
 * Trả về { thanhCong, theoSoHD: { [soHD]: {tuNgay, denNgay} }, loi }
 */
/** Wrapper có cache cho layNgayCanMinMaxTheoHopDong_ — hàm gốc phải mở 2 sheet NGOÀI
 *  (DNTT_GK_DN_CT, PhieuCan_DN) nên khá chậm, cache lại tránh mở lại mỗi lần tải báo cáo. */
function layNgayCanMinMaxTheoHopDong_(boBuoc) {
  return layHoacTinhBaoCao_('ngayCanMinMax', layNgayCanMinMaxTheoHopDong_KhongCache_, boBuoc).duLieu;
}

function layNgayCanMinMaxTheoHopDong_KhongCache_() {
  try {
    const boDauTV = function (s) {
      return (s || '').toString().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd');
    };
    const COT_SO_CT = 11; // cột L trong DNTT_GK_DN_CT

    const ssDNTT = SpreadsheetApp.openByUrl(DNTT_URL);
    const shDNTT = ssDNTT.getSheetByName(DNTT_SHEET_NAME) || ssDNTT.getSheets()[0];
    const dataDNTT = shDNTT.getDataRange().getValues();
    if (dataDNTT.length < 2) return { thanhCong: false, loi: 'DNTT_GK_DN_CT chưa có dữ liệu.', theoSoHD: {} };

    let colSoHD = -1, dongHeaderDNTT = 0;
    const tuKhoaSoHD = ['so hd', 'sohd', 'so hop dong', 'ma hd', 'ma hop dong'];
    for (let d = 0; d < Math.min(5, dataDNTT.length - 1) && colSoHD === -1; d++) {
      dataDNTT[d].map(boDauTV).forEach(function (v, i) {
        if (colSoHD === -1 && tuKhoaSoHD.some(function (tk) { return v.indexOf(tk) !== -1; })) colSoHD = i;
      });
      if (colSoHD !== -1) dongHeaderDNTT = d;
    }
    if (colSoHD === -1) return { thanhCong: false, loi: 'Không dò được cột Số HĐ trong DNTT_GK_DN_CT.', theoSoHD: {} };

    // Gom danh sách Số CT theo từng Số HĐ
    const soCTTheoSoHD = {};
    for (let i = dongHeaderDNTT + 1; i < dataDNTT.length; i++) {
      const soHD = (dataDNTT[i][colSoHD] || '').toString().trim();
      const soCT = (dataDNTT[i][COT_SO_CT] || '').toString().trim();
      if (!soHD || !soCT) continue;
      if (!soCTTheoSoHD[soHD]) soCTTheoSoHD[soHD] = [];
      soCTTheoSoHD[soHD].push(soCT);
    }

    // Đọc PhieuCan_DN, tra Ngày cân 1 (cột B) theo Số CT khớp cột W
    const COT_NGAY_CAN_1 = 1;  // cột B
    const COT_SO_CT_PHIEUCAN = 22; // cột W
    const ssPC = SpreadsheetApp.openByUrl(PHIEUCAN_URL);
    const shPC = ssPC.getSheetByName(PHIEUCAN_SHEET_NAME) || ssPC.getSheets()[0];
    const dataPC = shPC.getDataRange().getValues();

    const ngayCanTheoSoCT = {};
    for (let i = 1; i < dataPC.length; i++) {
      const soCT = (dataPC[i][COT_SO_CT_PHIEUCAN] || '').toString().trim();
      const ngay = dataPC[i][COT_NGAY_CAN_1];
      if (!soCT || !ngay) continue;
      const d = new Date(ngay);
      if (isNaN(d.getTime())) continue;
      if (!ngayCanTheoSoCT[soCT]) ngayCanTheoSoCT[soCT] = [];
      ngayCanTheoSoCT[soCT].push(d);
    }

    // Gộp min/max theo từng hợp đồng
    const theoSoHD = {};
    Object.keys(soCTTheoSoHD).forEach(function (soHD) {
      let tu = null, den = null;
      soCTTheoSoHD[soHD].forEach(function (soCT) {
        (ngayCanTheoSoCT[soCT] || []).forEach(function (d) {
          if (!tu || d < tu) tu = d;
          if (!den || d > den) den = d;
        });
      });
      if (tu || den) theoSoHD[soHD] = { tuNgay: tu, denNgay: den, danhSachSoCT: soCTTheoSoHD[soHD].join(', ') };
    });

    return { thanhCong: true, theoSoHD: theoSoHD };
  } catch (e) {
    return { thanhCong: false, loi: 'Lỗi đọc DNTT_GK_DN_CT/PhieuCan_DN: ' + e.message, theoSoHD: {} };
  }
}

function layDuLieuThucHienTuDNTT_() {
  try {
    const ss = SpreadsheetApp.openByUrl(DNTT_URL);
    const sh = ss.getSheetByName(DNTT_SHEET_NAME) || ss.getSheets()[0];
    const data = sh.getDataRange().getValues();
    if (data.length < 2) return { thanhCong: false, loi: 'Sheet DNTT_GK_DN_CT chưa có dữ liệu.', theoSoHD: {} };

    const boDauTV = function (s) {
      return (s || '').toString().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd');
    };

    // Cột "Khối lượng thanh toán (KG)" đã được xác nhận là CỘT I (index 8, 0-indexed) — dùng
    // trực tiếp thay vì tự dò, nhưng vẫn kiểm tra tiêu đề dòng 1 tại cột đó để chắc chắn đúng
    // vị trí; nếu tiêu đề không khớp "khối lượng" thì mới rơi về chế độ tự dò như dự phòng.
    const COT_KHOI_LUONG_THANH_TOAN = 12; // cột M — "Khối lượng"
    let colKL = -1;
    const tieuDeCotI = boDauTV(data[0][COT_KHOI_LUONG_THANH_TOAN]);
    if (tieuDeCotI.indexOf('khoi luong') !== -1) colKL = COT_KHOI_LUONG_THANH_TOAN;

    let colSoHD = -1, colGiaTri = -1, dongHeader = -1;
    const tuKhoaSoHD = ['so hd', 'sohd', 'so hop dong', 'ma hd', 'ma hop dong'];
    const tuKhoaKL = ['khoi luong', 'so luong', 'san luong'];
    const tuKhoaGiaTri = ['gia tri', 'thanh tien', 'tong tien', 'so tien'];

    for (let d = 0; d < Math.min(5, data.length - 1) && (colSoHD === -1 || (colKL === -1 && colGiaTri === -1)); d++) {
      const h = data[d].map(boDauTV);
      h.forEach(function (v, i) {
        if (colSoHD === -1 && tuKhoaSoHD.some(function (tk) { return v.indexOf(tk) !== -1; })) colSoHD = i;
        if (colKL === -1 && tuKhoaKL.some(function (tk) { return v.indexOf(tk) !== -1; })) colKL = i; // dự phòng nếu cột I không khớp
        if (colGiaTri === -1 && tuKhoaGiaTri.some(function (tk) { return v.indexOf(tk) !== -1; })) colGiaTri = i;
      });
      if (colSoHD !== -1 || colKL !== -1 || colGiaTri !== -1) dongHeader = d;
    }
    if (dongHeader === -1) dongHeader = 0;

    if (colSoHD === -1 || (colKL === -1 && colGiaTri === -1)) {
      const tieuDeThucTe = data[0].map(function (h, i) { return (i + 1) + ':"' + h + '"'; }).join(', ');
      return {
        thanhCong: false,
        loi: 'Không tự dò được cột Số HĐ/Khối lượng/Giá trị trong DNTT_GK_DN_CT. Tiêu đề dòng 1 hiện có: ' + tieuDeThucTe,
        theoSoHD: {}
      };
    }

    const theoSoHD = {};
    for (let i = dongHeader + 1; i < data.length; i++) {
      const soHD = (data[i][colSoHD] || '').toString().trim();
      if (!soHD) continue;
      if (!theoSoHD[soHD]) theoSoHD[soHD] = { khoiLuong: 0, giaTri: 0 };
      // ⚠️ ĐÃ SỬA: cột Khối lượng (cột M) trong DNTT_GK_DN_CT ĐÃ LƯU SẴN ĐƠN VỊ TẤN
      // (không phải KG như nhận định trước đây) — người dùng xác nhận trực tiếp.
      // TRƯỚC ĐÂY code chia thêm /1000 khiến khối lượng thực hiện bị nhỏ hơn thực
      // tế 1000 lần. Giờ lấy nguyên giá trị, KHÔNG chia gì thêm.
      if (colKL !== -1) theoSoHD[soHD].khoiLuong += (Number(data[i][colKL]) || 0);
      if (colGiaTri !== -1) theoSoHD[soHD].giaTri += Number(data[i][colGiaTri]) || 0;
    }
    return { thanhCong: true, theoSoHD: theoSoHD };
  } catch (e) {
    return { thanhCong: false, loi: 'Không đọc được sheet DNTT_GK_DN_CT (kiểm tra quyền chia sẻ file): ' + e.message, theoSoHD: {} };
  }
}

/**
 * Kiểm tra nhanh việc đọc sheet DNTT_GK_DN_CT có thành công không, dùng để hiện
 * banner trạng thái trên trang Báo cáo tổng hợp (không phải để lấy dữ liệu).
 */
function kiemTraKetNoiDNTT() {
  const kq = layDuLieuThucHienTuDNTT_();
  return {
    thanhCong: kq.thanhCong,
    loi: kq.loi,
    soHopDongCoDuLieu: kq.thanhCong ? Object.keys(kq.theoSoHD).length : 0
  };
}

function layDonGiaBinhQuanThang(ngayKy) {
  try {
    const ss = SpreadsheetApp.openByUrl(BAOGIA_URL);
    const sh = ss.getSheetByName(BAOGIA_SHEET_NAME);
    if (!sh) return { thanhCong: false, loi: 'Không tìm thấy sheet "' + BAOGIA_SHEET_NAME + '" trong file Báo giá.' };

    const data = sh.getDataRange().getValues();
    if (data.length < 2) return { thanhCong: false, loi: 'Sheet Báo giá chưa có dữ liệu.' };

    const boDauTV = function (s) {
      return (s || '').toString().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd');
    };
    const header = data[0].map(boDauTV);

    // Cấu trúc thật đã xác nhận: mỗi dòng là 1 mức giá có HIỆU LỰC trong 1 khoảng ngày
    // (HIEU_LUC_TU → HIEU_LUC_DEN), KHÔNG phải 1 cột "Ngày" đơn lẻ như đoán ban đầu.
    let colTu = header.findIndex(function (h) { return h.indexOf('hieu_luc_tu') !== -1 || h.indexOf('hieuluctu') !== -1; });
    let colDen = header.findIndex(function (h) { return h.indexOf('hieu_luc_den') !== -1 || h.indexOf('hieulucden') !== -1; });
    let colGia = header.findIndex(function (h) { return h === 'don_gia' || h.indexOf('dongia') !== -1; });
    let colActive = header.findIndex(function (h) { return h.indexOf('is_active') !== -1 || h.indexOf('isactive') !== -1; });

    if (colTu === -1 || colDen === -1 || colGia === -1) {
      const tieuDeThucTe = data[0].map(function (h, i) { return (i + 1) + ':"' + h + '"'; }).join(', ');
      return {
        thanhCong: false,
        loi: 'Không tự dò được cột HIEU_LUC_TU/HIEU_LUC_DEN/DON_GIA trong sheet Báo giá. Tiêu đề dòng 1 hiện có: ' + tieuDeThucTe +
          '. Vui lòng nhập tay đơn giá, và báo lại tên cột thật để mình chỉnh hàm dò cho đúng.'
      };
    }

    const target = new Date(ngayKy || new Date());

    let tong = 0, soDong = 0;
    for (let i = 1; i < data.length; i++) {
      const tu = new Date(data[i][colTu]);
      const den = new Date(data[i][colDen]);
      const gia = Number(data[i][colGia]);
      if (isNaN(tu.getTime()) || isNaN(den.getTime()) || isNaN(gia) || gia <= 0) continue;
      if (colActive !== -1) {
        const active = data[i][colActive];
        if (active === false || active === 'FALSE' || active === 0 || active === 'Không') continue;
      }
      // Ngày ký hợp đồng có nằm trong khoảng hiệu lực [tu, den] của mức giá này không
      if (target >= tu && target <= den) { tong += gia; soDong++; }
    }

    if (soDong === 0) {
      return { thanhCong: false, loi: 'Không có mức giá nào đang hiệu lực vào ngày ' + target.toLocaleDateString('vi-VN') + ' — vui lòng nhập tay đơn giá.' };
    }
    return { thanhCong: true, donGiaBinhQuan: Math.round(tong / soDong), soDongDuLieu: soDong };
  } catch (e) {
    return { thanhCong: false, loi: 'Không đọc được sheet Báo giá (kiểm tra quyền chia sẻ file): ' + e.message };
  }
}
function timSoDongTheoGiaTri_(sheetName, colIndex0based, giaTri) {
  const sh = getSheet_(sheetName);
  const lastRow = sh.getLastRow();
  if (lastRow < 2) return -1;
  const vals = sh.getRange(2, colIndex0based + 1, lastRow - 1, 1).getValues();
  for (let i = 0; i < vals.length; i++) {
    if ((vals[i][0] || '').toString().trim() === giaTri.toString().trim()) return i + 2;
  }
  return -1;
}

/**
 * Tra cứu địa chỉ tham chiếu từ DM_DIACHI theo CCCD/tên chủ rừng đã có sẵn
 * (dùng để gợi ý tự động khi tạo hợp đồng mới cho cùng 1 chủ rừng cũ).
 */
function traCuuDiaChiThamChieu(tenChuRung) {
  const rows = readData_(SHEET_NAME.DM_DIACHI);
  const ten = (tenChuRung || '').toString().trim().toLowerCase();
  const found = rows.find(function (r) {
    return (r[DIACHI_COL.TEN_CHU_RUNG] || '').toString().trim().toLowerCase() === ten;
  });
  if (!found) return null;
  return {
    diaChiThuongTru: found[DIACHI_COL.DIA_CHI_TT],
    diaChiUyQuyen: found[DIACHI_COL.DIA_CHI_UQ],
    diaChiRung: found[DIACHI_COL.DIA_CHI_RUNG],
    nganHang: found[DIACHI_COL.NGAN_HANG]
  };
}

/**
 * ĐỒNG BỘ DM_DIACHI (bảng tham chiếu địa chỉ) — DM_DIACHI được coi là bảng con của
 * HD_NCC/HD_RUNG: mỗi khi hợp đồng hoặc lô rừng được THÊM/SỬA, hàm này chạy để
 * cập nhật lại dòng tham chiếu tương ứng (upsert theo ID_HD). KHÔNG cần hiển thị
 * DM_DIACHI cho người dùng xem — chỉ dùng ngầm làm nguồn gợi ý địa chỉ (autocomplete).
 */
function dongBoDiaChiTuRung_(idHD, thongTin) {
  if (!idHD) return;
  const sh = getSheet_(SHEET_NAME.DM_DIACHI);
  const lastRow = sh.getLastRow();
  let soDongDaCo = -1;
  if (lastRow >= 2) {
    const data = sh.getRange(2, 1, lastRow - 1, sh.getLastColumn()).getValues();
    for (let i = 0; i < data.length; i++) {
      if ((data[i][DIACHI_COL.ID_HD] || '').toString().trim() === idHD.toString().trim()) { soDongDaCo = i + 2; break; }
    }
  }
  const gia = {
    tenChuRung: thongTin.tenChuRung, diaChiThuongTru: thongTin.diaChiThuongTru,
    diaChiUyQuyen: thongTin.diaChiUyQuyen, diaChiRung: thongTin.diaChiRung, nganHang: thongTin.nganHang
  };
  if (soDongDaCo > 0) {
    if (gia.tenChuRung !== undefined) sh.getRange(soDongDaCo, DIACHI_COL.TEN_CHU_RUNG + 1).setValue(gia.tenChuRung || '');
    if (gia.diaChiThuongTru !== undefined) sh.getRange(soDongDaCo, DIACHI_COL.DIA_CHI_TT + 1).setValue(gia.diaChiThuongTru || '');
    if (gia.diaChiUyQuyen !== undefined) sh.getRange(soDongDaCo, DIACHI_COL.DIA_CHI_UQ + 1).setValue(gia.diaChiUyQuyen || '');
    if (gia.diaChiRung !== undefined) sh.getRange(soDongDaCo, DIACHI_COL.DIA_CHI_RUNG + 1).setValue(gia.diaChiRung || '');
    if (gia.nganHang !== undefined) sh.getRange(soDongDaCo, DIACHI_COL.NGAN_HANG + 1).setValue(gia.nganHang || '');
  } else {
    sh.appendRow([
      idHD, idHD, new Date(), gia.tenChuRung || '', gia.diaChiThuongTru || '',
      gia.diaChiUyQuyen || '', gia.diaChiRung || '', gia.nganHang || ''
    ]);
  }
}

/**
 * Lấy danh sách địa chỉ gợi ý (không trùng lặp) từ DM_DIACHI, dùng để nạp vào
 * <datalist> cho ô "Địa chỉ thường trú" / "Địa chỉ rừng" gõ tới đâu gợi ý tới đó.
 */
function layGoiYDiaChi() {
  const rows = readData_(SHEET_NAME.DM_DIACHI);
  const set = {};
  rows.forEach(function (r) {
    const tt = (r[DIACHI_COL.DIA_CHI_TT] || '').toString().trim();
    const rg = (r[DIACHI_COL.DIA_CHI_RUNG] || '').toString().trim();
    if (tt) set[tt] = true;
    if (rg) set[rg] = true;
  });
  return Object.keys(set);
}

/** Gợi ý "Nơi cấp CCCD" — gõ kiểu gợi nhớ, lấy từ các giá trị đã từng nhập trong HD_NCC */
function layGoiYNoiCap() {
  const rows = readData_(SHEET_NAME.HD_NCC);
  const set = {};
  rows.forEach(function (r) {
    const nc = (r[NCC_COL.NOI_CAP] || '').toString().trim();
    const ncUq = (r[NCC_COL.NOI_CAP_UQ] || '').toString().trim();
    if (nc) set[nc] = true;
    if (ncUq) set[ncUq] = true;
  });
  return Object.keys(set);
}

/**
 * Danh sách "Nhóm KH" gợi ý (không trùng lặp) cho ô nhập liệu có datalist —
 * gọi bởi 26/27_Page_...MeCon.html khi mở form thêm/sửa hợp đồng mẹ-con.
 * Cùng kiểu "gợi nhớ theo giá trị đã từng nhập" như layGoiYNoiCap() ở trên
 * (không có bảng danh mục riêng — Nhóm KH lưu tự do ngay trên HD_NCC).
 */
function layDanhSachNhomKH() {
  const rows = readData_(SHEET_NAME.HD_NCC);
  const set = {};
  rows.forEach(function (r) {
    const nk = (r[NCC_COL.NHOM_KH] || '').toString().trim();
    if (nk) set[nk] = true;
  });
  return Object.keys(set);
}

/**
 * TẠO HỢP ĐỒNG MỚI (ghi 1 dòng vào HD_NCC).
 * `d` là object chứa các trường người dùng nhập, ví dụ:
 * {
 *   ngayKy: '2026-07-25', tenChuRung, diaChiThuongTru, cccdChuRung, ngayCap, noiCap,
 *   sdtChuRung, tenUyQuyen, cccdUyQuyen, noiCapUQ, diaChiUyQuyen, sdtUQ,
 *   soTK, nganHang, emailUQ, diaChiRung, dienTichKy, hoSoNguonGoc, soGiayTo,
 *   uyQuyenTT, slDuKien, donGia, nhomKH, chiNhanhNH
 * }
 * Trả về { thanhCong, idHD, soHD, loi }
 */
function TAO_HOP_DONG_MOI(d) {
  // ---- Kiểm tra tối thiểu trước khi ghi ----
  const thieu = [];
  if (!d.tenChuRung) thieu.push('Họ tên chủ rừng');
  if (!laCCCDHopLe_(d.cccdChuRung)) thieu.push('Số CCCD chủ rừng (phải đủ 12 số)');
  if (!d.ngayKy) thieu.push('Ngày ký hợp đồng');
  if (thieu.length) return { thanhCong: false, loi: 'Thiếu thông tin bắt buộc: ' + thieu.join(', ') };

  // Cảnh báo trùng CCCD đang còn hiệu lực (không chặn, chỉ cảnh báo trong kết quả trả về)
  const nccRows = readData_(SHEET_NAME.HD_NCC);
  const trungCCCD = nccRows.some(function (r) {
    return (r[NCC_COL.CCCD_CHU_RUNG] || '').toString().trim() === d.cccdChuRung.toString().trim()
      && (r[NCC_COL.TINH_TRANG] || '').toString().trim().toLowerCase() !== 'đã thanh lý';
  });

  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000);
  } catch (e) {
    return { thanhCong: false, loi: 'Hệ thống đang bận (người khác đang tạo hợp đồng), vui lòng thử lại sau vài giây.' };
  }

  let idHD, soHD, ngayKyDate;
  try {
    ngayKyDate = new Date(d.ngayKy);
    soHD = d.soHD || soHopDongTuDong(ngayKyDate);
    idHD = soHD + '-' + formatNgay_(ngayKyDate);

    const row = [];
    row[NCC_COL.TIMESTAMP] = new Date();
    row[NCC_COL.EMAIL] = Session.getActiveUser().getEmail();
    row[NCC_COL.SO_HD] = soHD;
    row[NCC_COL.NGAY_KY] = ngayKyDate;
    row[NCC_COL.TEN_CHU_RUNG] = d.tenChuRung;
    row[NCC_COL.DIA_CHI_TT] = d.diaChiThuongTru || '';
    row[NCC_COL.CCCD_CHU_RUNG] = d.cccdChuRung;
    row[NCC_COL.NGAY_CAP] = d.ngayCap || '';
    row[NCC_COL.NOI_CAP] = d.noiCap || '';
    row[NCC_COL.SDT_CHU_RUNG] = d.sdtChuRung || '';
    row[NCC_COL.TEN_UY_QUYEN] = d.tenUyQuyen || '';
    row[NCC_COL.CCCD_UY_QUYEN] = d.cccdUyQuyen || '';
    row[NCC_COL.NOI_CAP_UQ] = d.noiCapUyQuyen || '';
    row[NCC_COL.DIA_CHI_UQ] = d.diaChiUyQuyen || '';
    row[NCC_COL.SDT_UQ] = d.sdtUyQuyen || '';
    row[NCC_COL.NGAY_CAP_UQ] = d.ngayCapUyQuyen || '';
    row[NCC_COL.SO_TK] = d.soTK || '';
    row[NCC_COL.NGAN_HANG] = d.nganHang || '';
    row[NCC_COL.EMAIL_UQ] = d.emailUQ || '';
    row[NCC_COL.DIA_CHI_RUNG] = d.diaChiRung || '';
    row[NCC_COL.DIEN_TICH_KY] = Number(d.dienTichKy) || 0;
    row[NCC_COL.LOCATION] = '';
    row[NCC_COL.HO_SO_NGUON_GOC] = d.hoSoNguonGoc || '';
    row[NCC_COL.SO_GIAY_TO] = d.soGiayTo || '';
    row[NCC_COL.DIEN_TICH_GPS] = '';
    row[NCC_COL.UY_QUYEN_TT] = d.uyQuyenTT || 'Không';
    row[NCC_COL.SL_DU_KIEN] = Number(d.slDuKien) || 0;
    row[NCC_COL.DON_GIA] = Number(d.donGia) || 0;
    row[NCC_COL.NHOM_KH] = d.nhomKH || '';
    row[NCC_COL.MA_SO_THUE] = d.maSoThue || '';
    row[NCC_COL.CHI_NHANH_NH] = d.chiNhanhNH || '';
    row[NCC_COL.ID_HD] = idHD;
    row[NCC_COL.TINH_TRANG] = d.tinhTrang || 'Chờ thực hiện'; // ⚠️ ĐÃ SỬA: trước đây ghi cứng "Đang thực hiện" ngay khi tạo — giờ LUÔN mặc định "Chờ thực hiện", chỉ chuyển sang "Đang thực hiện" sau khi ai đó duyệt tay (qua nút "✅ Duyệt" ở trang Thêm/Sửa hợp đồng)

    // ⚠️ MỚI: định dạng TEXT các cột định danh (CCCD/SĐT/Số TK/MST) TRƯỚC KHI
    // GHI giá trị — Google Sheets tự động cắt mất số 0 đầu ngay lúc ghi nếu ô
    // đang ở định dạng mặc định (Automatic), định dạng SAU khi ghi không cứu
    // lại được số đã mất. Đổi appendRow() -> getLastRow()+1 + setValues() để
    // định dạng được TRƯỚC khi ghi (appendRow không cho làm việc này).
    const shNCC = getSheet_(SHEET_NAME.HD_NCC);
    const soDongMoiNCC = shNCC.getLastRow() + 1;
    [NCC_COL.CCCD_CHU_RUNG, NCC_COL.SDT_CHU_RUNG, NCC_COL.CCCD_UY_QUYEN, NCC_COL.SDT_UQ, NCC_COL.SO_TK, NCC_COL.MA_SO_THUE]
      .forEach(function (c) { shNCC.getRange(soDongMoiNCC, c + 1).setNumberFormat('@'); });
    shNCC.getRange(soDongMoiNCC, 1, 1, row.length).setValues([row]);
  } finally {
    lock.releaseLock();
  }

  // Đồng thời tạo dòng đầu tiên trong HD_RUNG và HD_STK để hợp đồng có ngay 1 lô rừng + 1 STK
  THEM_LO_RUNG_MOI({
    idHD: idHD, soHD: soHD, ngayKy: ngayKyDate, tenChuRung: d.tenChuRung, cccd: d.cccdChuRung,
    thuongTru: d.diaChiThuongTru, diaChiRung: d.diaChiRung, dienTichM2: d.dienTichKy,
    donGia: d.donGia, khoiLuongDuKien: d.slDuKien, hoSoNguonGoc: d.hoSoNguonGoc, soGiayTo: d.soGiayTo
  });
  THEM_TAI_KHOAN_MOI({
    idHD: idHD, soHD: soHD, tenChuRung: d.tenChuRung, cccd: d.cccdChuRung,
    tenUyQuyen: d.tenUyQuyen, soTK: d.soTK, nganHang: d.nganHang, uyQuyenTT: d.uyQuyenTT
  });

  // Đồng bộ DM_DIACHI (bảng tham chiếu địa chỉ, coi như con của hợp đồng/rừng)
  dongBoDiaChiTuRung_(idHD, {
    tenChuRung: d.tenChuRung, diaChiThuongTru: d.diaChiThuongTru,
    diaChiUyQuyen: d.diaChiUyQuyen, diaChiRung: d.diaChiRung, nganHang: d.nganHang
  });

  return {
    thanhCong: true,
    idHD: idHD,
    soHD: soHD,
    canhBao: trungCCCD ? 'CCCD này đã có hợp đồng khác đang hoạt động — vui lòng kiểm tra trùng lặp chủ rừng.' : null
  };
}

/**
 * THÊM 1 LÔ RỪNG MỚI vào HD_RUNG cho 1 hợp đồng đã có (hợp đồng có thể có nhiều rừng).
 * `d` cần có idHD (bắt buộc), các trường còn lại tùy chọn.
 * STT lô rừng tự động tính = số lô rừng hiện có của hợp đồng đó + 1.
 */
/**
 * ⚠️ MỚI: 2 cột mở rộng của HD_RUNG (KHOI_LUONG_THUC_HIEN cột S, NAM_TRONG cột
 * T) trước giờ chỉ được GHI GIÁ TRỊ, chưa từng có ai ghi TIÊU ĐỀ dòng 1 — mở
 * Sheet trực tiếp sẽ thấy 2 cột này trống tiêu đề, dễ nhầm. Hàm này tự kiểm
 * tra và điền tiêu đề nếu còn thiếu — gọi 1 lần đầu THEM_LO_RUNG_MOI (rẻ, chỉ
 * đọc 2 ô rồi bỏ qua nếu đã có sẵn).
 */
function damBaoTieuDeCotMoRongRung_() {
  const sh = getSheet_(SHEET_NAME.HD_RUNG);
  const oS1 = sh.getRange(1, RUNG_COL.KHOI_LUONG_THUC_HIEN + 1);
  const oT1 = sh.getRange(1, RUNG_COL.NAM_TRONG + 1);
  if (!oS1.getValue()) oS1.setValue('Khối lượng thực hiện').setFontWeight('bold');
  if (!oT1.getValue()) oT1.setValue('Năm trồng').setFontWeight('bold');
}

function THEM_LO_RUNG_MOI(d) {
  damBaoTieuDeCotMoRongRung_();
  if (!d.idHD) return { thanhCong: false, loi: 'Thiếu ID_HD' };

  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000); // chờ tối đa 15s nếu có người khác đang ghi cùng lúc
  } catch (e) {
    return { thanhCong: false, loi: 'Hệ thống đang bận (người khác đang nhập liệu), vui lòng thử lại sau vài giây.' };
  }

  try {
    const rungRows = readData_(SHEET_NAME.HD_RUNG);
    const rungCuaHD = rungRows.filter(function (r) {
      return (r[RUNG_COL.ID_KEY_HD] || '').toString().trim() === d.idHD.toString().trim();
    });
    // ⚠️ ĐÃ SỬA: trước đây STT = SỐ LƯỢNG lô rừng hiện có + 1 — nếu 1 lô ở giữa đã bị xóa
    // (XOA_LO_RUNG), số lượng còn lại giảm nên STT mới tính ra bị TRÙNG với STT của 1 lô
    // vẫn đang tồn tại (vd còn lô 1,3 sau khi xóa lô 2 -> STT mới = 2+1 = 3, trùng lô 3),
    // sinh ra ID_RUNG/MaRung trùng lặp. Giờ lấy MAX STT đã từng dùng (đọc từ ID_RUNG hiện
    // có) rồi +1, luôn ra STT chưa từng dùng dù có lô đã bị xóa ở giữa.
    let maxStt = 0;
    rungCuaHD.forEach(function (r) {
      const phan = (r[RUNG_COL.ID_RUNG] || '').toString().split('_');
      const n = parseInt(phan[phan.length - 1], 10);
      if (!isNaN(n) && n > maxStt) maxStt = n;
    });
    const stt = maxStt + 1;

    const soHD = d.soHD || d.idHD.toString().split('-')[0];
    const cccd = (d.cccd || '').toString().trim();
    const maRung = 'HAK' + cccd + '_' + stt;
    const idRung = 'HAK' + soHD + '_' + stt;

    const row = [];
    row[RUNG_COL.ID_KEY_HD] = d.idHD;
    row[RUNG_COL.MA_RUNG] = maRung;
    row[RUNG_COL.ID_RUNG] = idRung;
    row[RUNG_COL.SO_HD] = soHD;
    row[RUNG_COL.NGAY_KY] = d.ngayKy || new Date();
    row[RUNG_COL.TEN_CHU_RUNG] = d.tenChuRung || '';
    row[RUNG_COL.CCCD] = cccd;
    row[RUNG_COL.THUONG_TRU] = d.thuongTru || '';
    row[RUNG_COL.DIA_CHI_RUNG] = d.diaChiRung || '';
    row[RUNG_COL.DIEN_TICH_M2] = Number(d.dienTichM2) || 0;
    row[RUNG_COL.DON_GIA] = Number(d.donGia) || 0;
    row[RUNG_COL.KHOI_LUONG_DK] = Number(d.khoiLuongDuKien) || 0;
    row[RUNG_COL.DIEN_TICH_GPS] = '';
    row[RUNG_COL.HO_SO_NGUON_GOC] = d.hoSoNguonGoc || '';
    row[RUNG_COL.SO_GIAY_TO] = d.soGiayTo || '';
    row[RUNG_COL.NGAY_GIAY_TO] = d.ngayGiayTo || '';
    row[RUNG_COL.DINH_KEM_GIAY_TO] = d.dinhKemGiayTo || '';
    row[RUNG_COL.TIMESTAMP] = new Date();
    row[RUNG_COL.NAM_TRONG] = d.namTrong ? Number(d.namTrong) : '';

    getSheet_(SHEET_NAME.HD_RUNG).appendRow(row);

    // Tạo sẵn 1 dòng khung trong HD_GPS để người dùng điền tọa độ cho lô rừng này
    getSheet_(SHEET_NAME.HD_GPS).appendRow([
      idRung, soHD + '-' + formatNgay_(d.ngayKy || new Date()), '', '', '', '', d.tenChuRung || '', '', false, 'DD'
    ]);

    // Đồng bộ DM_DIACHI theo địa chỉ của lô rừng mới thêm
    if (d.diaChiRung) dongBoDiaChiTuRung_(d.idHD, { diaChiRung: d.diaChiRung });

    CAP_NHAT_DRAFT_MOT_HOP_DONG(d.idHD);
    CAP_NHAT_CT_HOPDONG_(d.idHD); // tổng hợp lại "ct_hopdong" (xem 14_CtHopDong_PhuLuc.gs)
    CAP_NHAT_DRAFT_HOSORUNG_MOT_DONG_(idRung); // cập nhật cache báo cáo "Hồ sơ rừng" (xem 16_DraftHoSoRung.gs)
    return { thanhCong: true, idRung: idRung, maRung: maRung, stt: stt };
  } finally {
    lock.releaseLock();
  }
}

/**
 * THÊM 1 SỐ TÀI KHOẢN MỚI vào HD_STK cho 1 hợp đồng đã có
 * (hợp đồng có thể có nhiều số tài khoản nhận tiền).
 */
function THEM_TAI_KHOAN_MOI(d) {
  if (!d.idHD) return { thanhCong: false, loi: 'Thiếu ID_HD' };
  if (!d.soTK) return { thanhCong: false, loi: 'Thiếu số tài khoản' };

  const row = [];
  row[STK_COL.ID_HD] = d.idHD;
  row[STK_COL.ID_STK] = d.idHD; // theo đúng quy tắc đã quan sát trong dữ liệu gốc
  row[STK_COL.TEN_CHU_RUNG] = d.tenChuRung || '';
  row[STK_COL.CCCD] = d.cccd || '';
  row[STK_COL.TEN_UY_QUYEN] = d.tenUyQuyen || '';
  row[STK_COL.SO_TK] = d.soTK;
  row[STK_COL.NGAN_HANG] = d.nganHang || '';
  row[STK_COL.UY_QUYEN_TT] = d.uyQuyenTT || 'Không';
  row[STK_COL.SO_HD] = d.soHD || d.idHD.toString().split('-')[0];
  row[STK_COL.TIMESTAMP] = new Date();

  const shTK = getSheet_(SHEET_NAME.HD_STK);
  // ⚠️ MỚI: định dạng TEXT TRƯỚC khi ghi (xem giải thích ở TAO_HOP_DONG_MOI) — tránh mất số 0 đầu ở Số TK/CCCD
  const soDongMoiSTK = shTK.getLastRow() + 1;
  [STK_COL.SO_TK, STK_COL.CCCD].forEach(function (c) { shTK.getRange(soDongMoiSTK, c + 1).setNumberFormat('@'); });
  shTK.getRange(soDongMoiSTK, 1, 1, row.length).setValues([row]);
  CAP_NHAT_DRAFT_MOT_HOP_DONG(d.idHD);
  return { thanhCong: true, soDong: shTK.getLastRow() };
}

/**
 * CẬP NHẬT thông tin 1 lô rừng đã có, xác định theo ID_RUNG (cột C của HD_RUNG).
 * `patch` chỉ cần chứa các trường muốn sửa, ví dụ: { dienTichM2: 35000, donGia: 1600000 }
 */
function CAP_NHAT_LO_RUNG(idRung, patch) {
  const soDong = timSoDongTheoGiaTri_(SHEET_NAME.HD_RUNG, RUNG_COL.ID_RUNG, idRung);
  if (soDong === -1) return { thanhCong: false, loi: 'Không tìm thấy lô rừng có ID_RUNG = ' + idRung };

  const sh = getSheet_(SHEET_NAME.HD_RUNG);
  const map = {
    dienTichM2: RUNG_COL.DIEN_TICH_M2, donGia: RUNG_COL.DON_GIA, khoiLuongDuKien: RUNG_COL.KHOI_LUONG_DK,
    hoSoNguonGoc: RUNG_COL.HO_SO_NGUON_GOC, soGiayTo: RUNG_COL.SO_GIAY_TO, ngayGiayTo: RUNG_COL.NGAY_GIAY_TO,
    dinhKemGiayTo: RUNG_COL.DINH_KEM_GIAY_TO, diaChiRung: RUNG_COL.DIA_CHI_RUNG, thuongTru: RUNG_COL.THUONG_TRU,
    namTrong: RUNG_COL.NAM_TRONG
  };
  Object.keys(patch).forEach(function (key) {
    if (map.hasOwnProperty(key)) sh.getRange(soDong, map[key] + 1).setValue(patch[key]);
  });

  // Nếu có sửa địa chỉ rừng, đồng bộ luôn vào DM_DIACHI
  const idHDCuaRung = sh.getRange(soDong, RUNG_COL.ID_KEY_HD + 1).getValue();
  if (patch.diaChiRung) {
    dongBoDiaChiTuRung_(idHDCuaRung, { diaChiRung: patch.diaChiRung });
  }
  CAP_NHAT_DRAFT_MOT_HOP_DONG(idHDCuaRung);
  CAP_NHAT_CT_HOPDONG_(idHDCuaRung); // tổng hợp lại "ct_hopdong" (xem 14_CtHopDong_PhuLuc.gs)
  CAP_NHAT_DRAFT_HOSORUNG_MOT_DONG_(idRung); // cập nhật cache báo cáo "Hồ sơ rừng" (xem 16_DraftHoSoRung.gs)

  return { thanhCong: true, dong: soDong };
}

/**
 * CẬP NHẬT toạ độ GPS của 1 lô rừng — nếu 1 rừng có nhiều điểm (đa giác),
 * gọi hàm này nhiều lần với cùng idRung để thêm từng điểm, hoặc set ghiDe=true
 * để xóa hết điểm cũ và ghi lại từ đầu.
 */
/**
 * Nhận diện và quy đổi 1 giá trị tọa độ (Lat HOẶC Lng) VỀ DECIMAL DEGREES (DD),
 * bất kể người dùng nhập theo định dạng nào:
 *   - Decimal thường:        15.733975  hoặc  15,733975 (dấu phẩy thập phân kiểu VN)
 *   - DMS có ký hiệu độ:      15°44'02.3"N   hoặc  108°01'26.2"E
 *   - DMS cách nhau khoảng trắng: 15 44 02.3 N
 *   - DMS cách nhau dấu chấm (kiểu cũ hệ thống): 15.44.02.3N (xem convertDmsToDd gốc)
 * Trả về { gia_tri: number|null, dinh_dang_nhan_dien: string } để có thể hiện
 * cho người dùng biết hệ thống đã hiểu đúng định dạng nào chưa.
 */
function chuanHoaToaDo_(input) {
  if (input === null || input === undefined || input === '') return { gia_tri: null, dinh_dang_nhan_dien: 'rỗng' };
  let s = input.toString().trim();

  // 1) DMS có ký hiệu độ/phút/giây (°'") kèm hướng N/S/E/W — định dạng phổ biến nhất khi copy từ Google Maps/app đo GPS
  let m = s.match(/(-?\d+)[°\s]+(\d+)['\s]+([\d.]+)["\s]*([NSEW]?)/i);
  if (m) {
    const d = parseFloat(m[1]), mi = parseFloat(m[2]), se = parseFloat(m[3]);
    let dd = Math.abs(d) + mi / 60 + se / 3600;
    const huong = (m[4] || '').toUpperCase();
    if (huong === 'S' || huong === 'W' || d < 0) dd = -dd;
    return { gia_tri: dd, dinh_dang_nhan_dien: 'DMS (độ-phút-giây)' };
  }

  // 2) Decimal thuần, cho phép dấu phẩy thập phân kiểu Việt Nam (15,733975 -> 15.733975)
  //    Phân biệt với DMS-cách-nhau-dấu-chấm cũ (15.44.02.3) bằng cách đếm số dấu chấm:
  //    nếu chỉ có 0-1 dấu chấm/phẩy -> chắc chắn là decimal thường.
  const soDauChamPhay = (s.match(/[.,]/g) || []).length;
  if (soDauChamPhay <= 1) {
    const so = parseFloat(s.replace(',', '.'));
    if (!isNaN(so)) return { gia_tri: so, dinh_dang_nhan_dien: 'Decimal (thập phân thường)' };
  }

  // 3) Dự phòng cuối: định dạng DMS kiểu cũ của hệ thống (vd "15.44.02.3N", xem convertDmsToDd() gốc)
  const dd2 = convertDmsToDd(s);
  if (dd2 !== null && !isNaN(dd2)) return { gia_tri: dd2, dinh_dang_nhan_dien: 'DMS (kiểu cũ, cách nhau dấu chấm)' };

  return { gia_tri: null, dinh_dang_nhan_dien: 'KHÔNG nhận diện được — vui lòng kiểm tra lại định dạng nhập' };
}

function CAP_NHAT_GPS_RUNG(idRung, diemGPS, ghiDe) {
  // diemGPS: { lat, lng, heToaDo (tùy chọn, không còn bắt buộc — hệ thống tự nhận diện),
  //            diaChi (tùy chọn), anhUrl (tùy chọn — link Drive ảnh minh chứng cho điểm này) }
  // Luôn CHUẨN HÓA lat/lng về decimal (DD) NGAY TẠI ĐÂY trước khi lưu — dù người dùng
  // nhập định dạng gì (decimal, DMS có ký hiệu, DMS cách khoảng trắng...), dữ liệu lưu
  // vào sheet LUÔN LÀ 1 HỆ DUY NHẤT (decimal), tránh lẫn lộn nhiều hệ tọa độ về sau.
  const latChuan = chuanHoaToaDo_(diemGPS.lat);
  const lngChuan = chuanHoaToaDo_(diemGPS.lng);
  if (latChuan.gia_tri === null || lngChuan.gia_tri === null) {
    return { thanhCong: false, loi: 'Không nhận diện được định dạng tọa độ. Lat: "' + diemGPS.lat + '" (' + latChuan.dinh_dang_nhan_dien + '), Lng: "' + diemGPS.lng + '" (' + lngChuan.dinh_dang_nhan_dien + '). Vui lòng nhập lại (vd: 15.733975 hoặc 15°44\'02.3"N).' };
  }

  const sh = getSheet_(SHEET_NAME.HD_GPS);
  if (ghiDe) {
    const data = sh.getDataRange().getValues();
    for (let i = data.length - 1; i >= 1; i--) {
      if ((data[i][GPS_COL.ID_KEY_GPS] || '').toString().trim() === idRung.toString().trim()) {
        sh.deleteRow(i + 1);
      }
    }
  }
  const rungRows = readData_(SHEET_NAME.HD_RUNG);
  const rung = rungRows.find(function (r) { return (r[RUNG_COL.ID_RUNG] || '').toString().trim() === idRung.toString().trim(); });
  const idGPS = rung ? rung[RUNG_COL.SO_HD] + '-' + formatNgay_(rung[RUNG_COL.NGAY_KY]) : idRung;

  sh.appendRow([
    idRung, idGPS, latChuan.gia_tri, lngChuan.gia_tri, latChuan.gia_tri + ', ' + lngChuan.gia_tri,
    diemGPS.diaChi || '', rung ? rung[RUNG_COL.TEN_CHU_RUNG] : '', diemGPS.anhUrl || '', false, 'DD' // luôn lưu 'DD' vì đã chuẩn hóa xong ở trên
  ]);
  if (rung) CAP_NHAT_DRAFT_MOT_HOP_DONG(rung[RUNG_COL.ID_KEY_HD]);
  CAP_NHAT_DRAFT_HOSORUNG_MOT_DONG_(idRung); // cập nhật lại tọa độ trung bình trong cache "Hồ sơ rừng" (xem 16_DraftHoSoRung.gs)
  try { CacheService.getScriptCache().remove('MAP_DATA_CACHE'); } catch (e) { /* không ảnh hưởng thao tác chính nếu lỗi */ } // xóa cache Bản đồ GPS để thấy điểm mới ngay, không phải chờ hết 15 phút cache
  return { thanhCong: true, dinhDangDaNhanDien: { lat: latChuan.dinh_dang_nhan_dien, lng: lngChuan.dinh_dang_nhan_dien } };
}

/**
 * CẬP NHẬT thông tin 1 tài khoản nhận tiền đã có, xác định theo số dòng
 * (vì ID_STK trùng ID_HD nên không phải khóa duy nhất — cần truyền rowIndex
 * lấy được từ hàm layDanhSachTaiKhoan(idHD) bên dưới).
 */
function CAP_NHAT_TAI_KHOAN(soDong, patch) {
  const sh = getSheet_(SHEET_NAME.HD_STK);
  if (soDong < 2 || soDong > sh.getLastRow()) return { thanhCong: false, loi: 'Số dòng không hợp lệ' };
  const map = {
    soTK: STK_COL.SO_TK, nganHang: STK_COL.NGAN_HANG, uyQuyenTT: STK_COL.UY_QUYEN_TT, tenUyQuyen: STK_COL.TEN_UY_QUYEN
  };
  Object.keys(patch).forEach(function (key) {
    if (!map.hasOwnProperty(key)) return;
    const oCell = sh.getRange(soDong, map[key] + 1);
    if (map[key] === STK_COL.SO_TK) oCell.setNumberFormat('@'); // ⚠️ MỚI: tránh mất số 0 đầu (xem giải thích ở TAO_HOP_DONG_MOI)
    oCell.setValue(patch[key]);
  });
  const idHDCuaTK = sh.getRange(soDong, STK_COL.ID_HD + 1).getValue();
  CAP_NHAT_DRAFT_MOT_HOP_DONG(idHDCuaTK);
  return { thanhCong: true };
}

/** Lấy danh sách tài khoản của 1 hợp đồng kèm số dòng thật (để dùng cho CAP_NHAT_TAI_KHOAN) */
function layDanhSachTaiKhoan(idHD) {
  const sh = getSheet_(SHEET_NAME.HD_STK);
  const lastRow = sh.getLastRow();
  if (lastRow < 2) return [];
  const data = sh.getRange(2, 1, lastRow - 1, sh.getLastColumn()).getValues();
  const ketQua = [];
  data.forEach(function (r, i) {
    if ((r[STK_COL.ID_HD] || '').toString().trim() === idHD.toString().trim()) {
      ketQua.push({ soDong: i + 2, soTK: r[STK_COL.SO_TK], nganHang: r[STK_COL.NGAN_HANG], uyQuyenTT: r[STK_COL.UY_QUYEN_TT], tenUyQuyen: r[STK_COL.TEN_UY_QUYEN] });
    }
  });
  return ketQua;
}

/** Lấy danh sách các lô rừng của 1 hợp đồng (để hiển thị lên form cập nhật) */
/**
 * Lấy TOÀN BỘ dữ liệu con (lô rừng, tài khoản, ảnh, hồ sơ) của 1 hợp đồng theo idHD.
 * Dùng SAU KHI đã có đầy đủ thông tin chính của hợp đồng (lấy thẳng từ danh sách,
 * xem layDanhSachHopDong) — hàm này CHỈ lấy phần dữ liệu CON, dùng filter đơn giản
 * qua idHD (không phải tìm kiếm 1 dòng đơn lẻ như timHopDongTheoId), nên không có
 * rủi ro "không tìm thấy".
 */
function layDuLieuConCuaHopDong(idHD) {
  return {
    danhSachRung: layDanhSachRung(idHD),
    danhSachTaiKhoan: layDanhSachTaiKhoan(idHD),
    anh: layAnhCuaHopDong(idHD),
    hoSo: layHoSoCuaHopDong(idHD)
  };
}

/** Danh sách Số tài khoản của 1 hợp đồng — dùng cho trang Quản lý mẹ-con */
function layDanhSachSTK(idHD) {
  idHD = (idHD || '').toString().trim();
  if (!idHD) return [];
  const rows = readData_(SHEET_NAME.HD_STK);
  return rows
    .filter(function (r) { return (r[STK_COL.ID_HD] || '').toString().trim() === idHD; })
    .map(function (r, i) {
      return {
        idStk: r[STK_COL.ID_STK] || (idHD + '_stk_' + i),
        soTK: r[STK_COL.SO_TK], nganHang: r[STK_COL.NGAN_HANG],
        uyQuyenTT: r[STK_COL.UY_QUYEN_TT], tenUyQuyen: r[STK_COL.TEN_UY_QUYEN]
      };
    });
}

/**
 * ============================================================
 *  KHÁCH HÀNG (nhóm theo CCCD) — 1 khách hàng có thể có NHIỀU hợp đồng.
 *  ⚠️ KHÔNG tạo bảng mới, KHÔNG di chuyển dữ liệu — vì HD_NCC hiện lưu thông
 *  tin cá nhân (CCCD/tên/địa chỉ/SĐT) LẶP LẠI trên mỗi dòng hợp đồng (không
 *  chuẩn hóa), việc tách bảng thật sự đòi hỏi sửa hàng chục hàm đang đọc trực
 *  tiếp NCC_COL — rủi ro cao cho hệ thống đang chạy thật. Giải pháp an toàn:
 *  NHÓM ảo theo CCCD ngay lúc đọc, dùng CCCD làm "mã khách hàng" tự nhiên (mỗi
 *  người chỉ có 1 CCCD) — không đổi gì ở tầng lưu trữ, chỉ thêm 1 lớp hiển thị.
 * ============================================================
 */
function layDanhSachKhachHang(trang, kichThuoc, tuKhoa) {
  trang = trang || 1;
  kichThuoc = kichThuoc || 20;
  const rows = readData_(SHEET_NAME.HD_NCC);
  const tk = (tuKhoa || '').toString().trim().toLowerCase();

  const theoCccd = {};
  rows.forEach(function (r) {
    const cccd = (r[NCC_COL.CCCD_CHU_RUNG] || '').toString().trim();
    if (!cccd) return; // không có CCCD -> không nhóm được, bỏ qua (hợp đồng đó vẫn xem được bình thường qua tab "Hợp đồng" trực tiếp)
    if (!theoCccd[cccd]) {
      theoCccd[cccd] = {
        cccd: cccd, tenChuRung: r[NCC_COL.TEN_CHU_RUNG], sdt: r[NCC_COL.SDT_CHU_RUNG],
        thuongTru: r[NCC_COL.DIA_CHI_TT], ngayCap: r[NCC_COL.NGAY_CAP] ? new Date(r[NCC_COL.NGAY_CAP]).toISOString() : '',
        noiCap: r[NCC_COL.NOI_CAP], nhomKH: r[NCC_COL.NHOM_KH], maSoThue: r[NCC_COL.MA_SO_THUE], soLuongHopDong: 0
      };
    }
    theoCccd[cccd].soLuongHopDong++;
  });

  let ds = Object.values(theoCccd);
  if (tk) {
    ds = ds.filter(function (kh) {
      return (kh.tenChuRung || '').toLowerCase().indexOf(tk) !== -1 || (kh.cccd || '').toLowerCase().indexOf(tk) !== -1;
    });
  }
  ds.sort(function (a, b) { return (a.tenChuRung || '').localeCompare(b.tenChuRung || '', 'vi'); });

  const tongSo = ds.length;
  const tongTrang = Math.max(1, Math.ceil(tongSo / kichThuoc));
  trang = Math.min(Math.max(1, trang), tongTrang);
  const batDau = (trang - 1) * kichThuoc;

  return { items: ds.slice(batDau, batDau + kichThuoc), trang: trang, tongTrang: tongTrang, tongSo: tongSo };
}

/** Danh sách hợp đồng của ĐÚNG 1 khách hàng (lọc theo CCCD) — dùng khi đào sâu từ Khách hàng xuống Hợp đồng */
function layHopDongTheoKhachHang(cccd) {
  cccd = (cccd || '').toString().trim();
  if (!cccd) return [];
  const rows = readData_(SHEET_NAME.HD_NCC);
  return rows
    .map(function (r, idx) { return { r: r, soDong: idx + 2 }; }) // lấy soDong TRƯỚC khi lọc, để không bị lệch chỉ số
    .filter(function (x) { return (x.r[NCC_COL.CCCD_CHU_RUNG] || '').toString().trim() === cccd; })
    .map(function (x) {
      const r = x.r;
      return {
        idHD: r[NCC_COL.ID_HD], soHD: r[NCC_COL.SO_HD], soDong: x.soDong,
        ngayKy: r[NCC_COL.NGAY_KY] ? new Date(r[NCC_COL.NGAY_KY]).toISOString() : '',
        tenChuRung: r[NCC_COL.TEN_CHU_RUNG], tinhTrang: (r[NCC_COL.TINH_TRANG] || 'Đang thực hiện').toString().trim()
      };
    })
    .sort(function (a, b) { return new Date(b.ngayKy || 0) - new Date(a.ngayKy || 0); });
}

function layDanhSachRung(idHD) {
  const rows = readData_(SHEET_NAME.HD_RUNG);
  return rows
    .filter(function (r) { return (r[RUNG_COL.ID_KEY_HD] || '').toString().trim() === idHD.toString().trim(); })
    .map(function (r) {
      return {
        idRung: r[RUNG_COL.ID_RUNG], maRung: r[RUNG_COL.MA_RUNG], diaChiRung: r[RUNG_COL.DIA_CHI_RUNG],
        dienTichM2: r[RUNG_COL.DIEN_TICH_M2], donGia: r[RUNG_COL.DON_GIA], khoiLuongDuKien: r[RUNG_COL.KHOI_LUONG_DK],
        dienTichGPS: r[RUNG_COL.DIEN_TICH_GPS], hoSoNguonGoc: r[RUNG_COL.HO_SO_NGUON_GOC],
        soGiayTo: r[RUNG_COL.SO_GIAY_TO],
        ngayGiayTo: r[RUNG_COL.NGAY_GIAY_TO] ? Utilities.formatDate(new Date(r[RUNG_COL.NGAY_GIAY_TO]), Session.getScriptTimeZone() || 'GMT+7', 'yyyy-MM-dd') : '',
        namTrong: r[RUNG_COL.NAM_TRONG] || '',
        dinhKem: resolveDriveLink_(r[RUNG_COL.DINH_KEM_GIAY_TO])
      };
    });
}

/**
 * ============================================================
 *  XEM / SỬA / HỦY / XÓA HỢP ĐỒNG
 * ============================================================
 */

/**
 * Tìm 1 hợp đồng theo ID_HD hoặc theo Số HĐ, trả về đầy đủ thông tin
 * (thông tin chính từ HD_NCC + danh sách rừng + danh sách tài khoản) để hiển thị lên form Xem/Sửa.
 * Trả về null nếu không tìm thấy.
 *
 * Dùng TextFinder (công cụ tìm kiếm gốc của Google Sheets, khớp CHÍNH XÁC toàn bộ ô)
 * thay vì tự so sánh chuỗi bằng JS — đáng tin cậy hơn, tránh các lỗi lệch định dạng/kiểu
 * dữ liệu ẩn giữa giá trị đọc qua getValues() và giá trị hiển thị thật trong ô.
 */
function timHopDongTheoId(idHoacSoHD) {
  const key = (idHoacSoHD || '').toString().trim();
  if (!key) return null;

  const sh = getSheet_(SHEET_NAME.HD_NCC);
  const lastRow = sh.getLastRow();
  if (lastRow < 2) return null;

  let soDongTimThay = -1;

  // Tầng 1: TextFinder khớp toàn bộ ô (nhanh, đúng với dữ liệu bình thường)
  const timID = sh.getRange(2, NCC_COL.ID_HD + 1, lastRow - 1, 1)
    .createTextFinder(key).matchEntireCell(true).matchCase(false).findNext();
  if (timID) soDongTimThay = timID.getRow();

  if (soDongTimThay === -1) {
    const timSoHD = sh.getRange(2, NCC_COL.SO_HD + 1, lastRow - 1, 1)
      .createTextFinder(key).matchEntireCell(true).matchCase(false).findNext();
    if (timSoHD) soDongTimThay = timSoHD.getRow();
  }

  // Tầng 2 (dự phòng): nếu TextFinder không thấy — có thể do dấu gạch ngang trong ô
  // là một biến thể Unicode khác (– — ‑ ...) trông giống hệt "-" thường nhưng là ký tự
  // khác, hoặc có khoảng trắng ẩn. Chuẩn hóa BỎ HẾT ký tự không phải chữ/số rồi so lại.
  const chuanHoaManh = function (s) {
    return (s || '').toString().toLowerCase().replace(/[^a-z0-9\u00C0-\u1EF9]/g, '');
  };
  const keyChuan = chuanHoaManh(key);

  if (soDongTimThay === -1) {
    const data = sh.getRange(2, 1, lastRow - 1, sh.getLastColumn()).getValues();
    for (let i = 0; i < data.length; i++) {
      const idHDChuan = chuanHoaManh(data[i][NCC_COL.ID_HD]);
      const soHDChuan = chuanHoaManh(data[i][NCC_COL.SO_HD]);
      if (idHDChuan === keyChuan || soHDChuan === keyChuan) { soDongTimThay = i + 2; break; }
    }
  }

  // Tầng 3 (dự phòng cuối cùng): so theo GIÁ TRỊ HIỂN THỊ (getDisplayValues) — có thể
  // khác giá trị thô nếu ô có định dạng số/ngày đặc biệt khiến getValues() trả về kiểu
  // dữ liệu khác (Date, Number...) thay vì chuỗi y hệt như người dùng nhìn thấy trên sheet.
  if (soDongTimThay === -1) {
    const displayData = sh.getRange(2, 1, lastRow - 1, sh.getLastColumn()).getDisplayValues();
    for (let i = 0; i < displayData.length; i++) {
      const idHDChuan = chuanHoaManh(displayData[i][NCC_COL.ID_HD]);
      const soHDChuan = chuanHoaManh(displayData[i][NCC_COL.SO_HD]);
      if (idHDChuan === keyChuan || soHDChuan === keyChuan) { soDongTimThay = i + 2; break; }
    }
  }

  if (soDongTimThay === -1) {
    // Không tìm thấy dù đã qua 4 tầng dự phòng (kể cả so theo giá trị hiển thị) — trả về thông tin chẩn đoán để
    // xác định chính xác nguyên nhân (thay vì chỉ báo "không tìm thấy" chung chung)
    const soDongDuLieu = lastRow - 1;
    const mauIdHD = sh.getRange(2, NCC_COL.ID_HD + 1, Math.min(5, soDongDuLieu), 1).getValues().map(function (r) { return r[0]; });
    return {
      khongTimThay: true,
      idHD: null,
      chanDoan: 'Đã tìm "' + key + '" trong ' + soDongDuLieu + ' dòng dữ liệu HD_NCC (cả cột ID_HD và Số HĐ, kể cả chuẩn hóa ký tự) nhưng không khớp. ' +
        'Mẫu 5 giá trị ID_HD đầu tiên trong sheet: [' + mauIdHD.join(', ') + ']. ' +
        'Nếu ID_HD bạn tìm không nằm trong mẫu này nhưng đúng là có trong sheet, có thể do sheet có nhiều dòng ẩn/filter hoặc dữ liệu vừa được sửa ở nơi khác (thử tải lại danh sách và chọn lại).'
    };
  }

  const r = sh.getRange(soDongTimThay, 1, 1, sh.getLastColumn()).getValues()[0];
  const idHD = (r[NCC_COL.ID_HD] || '').toString().trim();

  return {
    soDong: soDongTimThay, // số dòng thật trong HD_NCC, dùng để CAP_NHAT_HOP_DONG/XOA
    idHD: idHD,
    soHD: r[NCC_COL.SO_HD],
    ngayKy: r[NCC_COL.NGAY_KY],
    tenChuRung: r[NCC_COL.TEN_CHU_RUNG],
    diaChiThuongTru: r[NCC_COL.DIA_CHI_TT],
    cccdChuRung: r[NCC_COL.CCCD_CHU_RUNG],
    ngayCap: r[NCC_COL.NGAY_CAP],
    noiCap: r[NCC_COL.NOI_CAP],
    sdtChuRung: r[NCC_COL.SDT_CHU_RUNG],
    tenUyQuyen: r[NCC_COL.TEN_UY_QUYEN],
    cccdUyQuyen: r[NCC_COL.CCCD_UY_QUYEN],
    noiCapUyQuyen: r[NCC_COL.NOI_CAP_UQ],
    diaChiUyQuyen: r[NCC_COL.DIA_CHI_UQ],
    sdtUyQuyen: r[NCC_COL.SDT_UQ],
    ngayCapUyQuyen: r[NCC_COL.NGAY_CAP_UQ], // cột mở rộng — xem ghi chú ở 00_Config.gs
    diaChiRung: r[NCC_COL.DIA_CHI_RUNG],
    dienTichKy: r[NCC_COL.DIEN_TICH_KY],
    hoSoNguonGoc: r[NCC_COL.HO_SO_NGUON_GOC],
    soGiayTo: r[NCC_COL.SO_GIAY_TO],
    uyQuyenTT: r[NCC_COL.UY_QUYEN_TT],
    slDuKien: r[NCC_COL.SL_DU_KIEN],
    donGia: r[NCC_COL.DON_GIA],
    soTK: r[NCC_COL.SO_TK],
    nganHang: r[NCC_COL.NGAN_HANG],
    tinhTrang: r[NCC_COL.TINH_TRANG],
    danhSachRung: layDanhSachRung(idHD),
    danhSachTaiKhoan: layDanhSachTaiKhoan(idHD),
    anh: layAnhCuaHopDong(idHD),
    hoSo: layHoSoCuaHopDong(idHD)
  };
}

/**
 * CẬP NHẬT thông tin chính của 1 hợp đồng (cấp HD_NCC) — tên chủ rừng, CCCD,
 * địa chỉ, đơn giá, khối lượng dự kiến, tình trạng... `patch` chỉ cần chứa
 * field muốn sửa. Dùng `soDong` lấy từ timHopDongTheoId() để xác định đúng dòng.
 */
function CAP_NHAT_HOP_DONG(soDong, patch) {
  const sh = getSheet_(SHEET_NAME.HD_NCC);
  if (soDong < 2 || soDong > sh.getLastRow()) return { thanhCong: false, loi: 'Số dòng không hợp lệ' };

  const map = {
    tenChuRung: NCC_COL.TEN_CHU_RUNG, diaChiThuongTru: NCC_COL.DIA_CHI_TT, cccdChuRung: NCC_COL.CCCD_CHU_RUNG,
    ngayCap: NCC_COL.NGAY_CAP, noiCap: NCC_COL.NOI_CAP, sdtChuRung: NCC_COL.SDT_CHU_RUNG,
    tenUyQuyen: NCC_COL.TEN_UY_QUYEN, cccdUyQuyen: NCC_COL.CCCD_UY_QUYEN, diaChiRung: NCC_COL.DIA_CHI_RUNG,
    noiCapUyQuyen: NCC_COL.NOI_CAP_UQ, diaChiUyQuyen: NCC_COL.DIA_CHI_UQ, sdtUyQuyen: NCC_COL.SDT_UQ,
    ngayCapUyQuyen: NCC_COL.NGAY_CAP_UQ,
    dienTichKy: NCC_COL.DIEN_TICH_KY, hoSoNguonGoc: NCC_COL.HO_SO_NGUON_GOC, soGiayTo: NCC_COL.SO_GIAY_TO,
    uyQuyenTT: NCC_COL.UY_QUYEN_TT, slDuKien: NCC_COL.SL_DU_KIEN, donGia: NCC_COL.DON_GIA,
    soTK: NCC_COL.SO_TK, nganHang: NCC_COL.NGAN_HANG, tinhTrang: NCC_COL.TINH_TRANG, nhomKH: NCC_COL.NHOM_KH, maSoThue: NCC_COL.MA_SO_THUE,
    ngayKy: NCC_COL.NGAY_KY, soHD: NCC_COL.SO_HD // ⚠️ BỔ SUNG: trước đây thiếu — sửa Ngày ký/Số HĐ ở trang mẹ-con bị âm thầm bỏ qua, không ghi vào Sheet
  };
  const truong_so = ['dienTichKy', 'slDuKien', 'donGia'];
  // ⚠️ MỚI: các cột định danh cần định dạng TEXT TRƯỚC khi setValue (xem giải thích ở TAO_HOP_DONG_MOI) — tránh mất số 0 đầu khi SỬA giá trị
  const cotCanDinhDangText_ = [NCC_COL.CCCD_CHU_RUNG, NCC_COL.SDT_CHU_RUNG, NCC_COL.CCCD_UY_QUYEN, NCC_COL.SDT_UQ, NCC_COL.SO_TK, NCC_COL.MA_SO_THUE];
  Object.keys(patch).forEach(function (key) {
    if (map.hasOwnProperty(key)) {
      const value = truong_so.indexOf(key) !== -1 ? Number(patch[key]) : patch[key];
      const oCell = sh.getRange(soDong, map[key] + 1);
      if (cotCanDinhDangText_.indexOf(map[key]) !== -1) oCell.setNumberFormat('@');
      oCell.setValue(value);
    }
  });

  // Đồng bộ DM_DIACHI nếu có sửa tên/địa chỉ/ngân hàng
  const idHD = sh.getRange(soDong, NCC_COL.ID_HD + 1).getValue();
  const canDongBo = ['tenChuRung', 'diaChiThuongTru', 'diaChiRung', 'nganHang'].some(function (k) { return patch.hasOwnProperty(k); });
  if (canDongBo) {
    dongBoDiaChiTuRung_(idHD, {
      tenChuRung: patch.tenChuRung, diaChiThuongTru: patch.diaChiThuongTru,
      diaChiRung: patch.diaChiRung, nganHang: patch.nganHang
    });
  }

  return { thanhCong: true };
}

/**
 * HỦY hợp đồng (soft — an toàn, KHÔNG xóa dữ liệu): chỉ đổi cột Tình trạng
 * thành "Đã hủy". Dùng khi hợp đồng không còn hiệu lực nhưng vẫn muốn giữ
 * lại hồ sơ để tra cứu/đối chiếu về sau.
 */
function HUY_HOP_DONG(idHD) {
  const kq = timHopDongTheoId(idHD);
  if (!kq || kq.khongTimThay) return { thanhCong: false, loi: 'Không tìm thấy hợp đồng: ' + idHD + (kq && kq.chanDoan ? ' — ' + kq.chanDoan : '') };
  const ketQua = CAP_NHAT_HOP_DONG(kq.soDong, { tinhTrang: 'Đã hủy' });
  if (ketQua.thanhCong) { ghiNhatKy_('Hủy hợp đồng', idHD, 'Chủ rừng: ' + kq.tenChuRung); CAP_NHAT_DRAFT_MOT_HOP_DONG(idHD); }
  return ketQua;
}

/**
 * XÓA VĨNH VIỄN 1 hợp đồng khỏi TẤT CẢ các sheet liên quan
 * (HD_NCC, HD_RUNG, HD_STK, HD_GPS, HD_Picture, DM_DIACHI).
 * ⚠️ KHÔNG THỂ HOÀN TÁC. Bắt buộc truyền xacNhan=true, nếu không sẽ từ chối chạy
 * để tránh xóa nhầm do gọi thiếu cẩn thận (vd gọi thử trong Apps Script editor).
 */
function XOA_VINH_VIEN_HOP_DONG(idHD, xacNhan) {
  if (xacNhan !== true) {
    return { thanhCong: false, loi: 'Chưa xác nhận xóa — truyền xacNhan=true để thực hiện. Hành động này KHÔNG THỂ HOÀN TÁC.' };
  }
  idHD = (idHD || '').toString().trim();
  if (!idHD) return { thanhCong: false, loi: 'Thiếu ID_HD' };

  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000);
  } catch (e) {
    return { thanhCong: false, loi: 'Hệ thống đang bận, vui lòng thử lại sau vài giây.' };
  }

  try {
    let soDongDaXoa = 0;

    // Lấy danh sách ID_RUNG thuộc hợp đồng này trước khi xóa HD_RUNG (để còn dùng xóa HD_GPS/HD_Picture theo ID_RUNG nếu cần)
    const danhSachRung = layDanhSachRung(idHD);

    // Xóa các dòng khớp ID_HD/ID_KEY_HD ở từng sheet, xóa từ dưới lên để không lệch số dòng
    function xoaTheoCot(sheetName, colIndex0, giaTri) {
      const sh = getSheet_(sheetName);
      const data = sh.getDataRange().getValues();
      for (let i = data.length - 1; i >= 1; i--) {
        if ((data[i][colIndex0] || '').toString().trim() === giaTri.toString().trim()) {
          sh.deleteRow(i + 1);
          soDongDaXoa++;
        }
      }
    }

    xoaTheoCot(SHEET_NAME.HD_NCC, NCC_COL.ID_HD, idHD);
    xoaTheoCot(SHEET_NAME.HD_RUNG, RUNG_COL.ID_KEY_HD, idHD);
    xoaTheoCot(SHEET_NAME.HD_STK, STK_COL.ID_HD, idHD);
    xoaTheoCot(SHEET_NAME.HD_GPS, GPS_COL.ID_KEY_GPS, idHD); // trường hợp GPS gán trực tiếp theo ID_HD (dòng khung mới tạo)
    xoaTheoCot(SHEET_NAME.HD_PICTURE, PICTURE_COL.ID_HD, idHD);
    xoaTheoCot(SHEET_NAME.DM_DIACHI, DIACHI_COL.ID_HD, idHD);

    // Xóa GPS/ảnh gắn theo từng ID_RUNG con (trường hợp GPS lưu theo ID_RUNG thay vì ID_HD)
    danhSachRung.forEach(function (r) {
      if (r.idRung) xoaTheoCot(SHEET_NAME.HD_GPS, GPS_COL.ID_KEY_GPS, r.idRung);
    });

    // Dọn luôn ảnh nháp (Draft_AnhRung) còn sót lại của hợp đồng này — cả theo ID_HD lẫn theo từng ID_RUNG con
    // (sheet này chỉ tự tạo khi có ảnh đầu tiên được tải lên, nên phải kiểm tra tồn tại trước khi xóa để tránh lỗi)
    if (getSS_().getSheetByName(SHEET_NAME.DRAFT_ANH)) {
      xoaTheoCot(SHEET_NAME.DRAFT_ANH, DRAFT_ANH_COL.ID_HD, idHD);
      danhSachRung.forEach(function (r) {
        if (r.idRung) xoaTheoCot(SHEET_NAME.DRAFT_ANH, DRAFT_ANH_COL.ID_RUNG, r.idRung);
      });
    }

    ghiNhatKy_('XÓA VĨNH VIỄN', idHD, 'Đã xóa ' + soDongDaXoa + ' dòng dữ liệu liên quan khỏi các sheet.');
    XOA_DRAFT_MOT_HOP_DONG_(idHD);
    return { thanhCong: true, soDongDaXoa: soDongDaXoa };
  } finally {
    lock.releaseLock();
  }
}

/**
 * ============================================================
 *  GPS & ẢNH — CON CỦA RỪNG (HD_GPS, HD_Picture)
 * ============================================================
 */

/** Lấy danh sách điểm GPS đã có của 1 lô rừng (theo ID_RUNG), toạ độ đã convert DD */
function layGPSCuaRung(idRung) {
  const rows = readData_(SHEET_NAME.HD_GPS);
  return rows
    .filter(function (r) { return (r[GPS_COL.ID_KEY_GPS] || '').toString().trim() === idRung.toString().trim(); })
    .map(function (r) {
      const type = r[GPS_COL.HE_TOA_DO];
      const lat = (type === 'DMS') ? convertDmsToDd(r[GPS_COL.LAT]) : parseFloat(r[GPS_COL.LAT]);
      const lng = (type === 'DMS') ? convertDmsToDd(r[GPS_COL.LNG]) : parseFloat(r[GPS_COL.LNG]);
      return { lat: isNaN(lat) ? null : lat, lng: isNaN(lng) ? null : lng, diaChi: r[GPS_COL.ADDRESS], hinhAnh: r[GPS_COL.HINH_ANH] || '' };
    })
    // ⚠️ SỬA: trước lọc bằng `p.lat && p.lng` nên vô tình loại luôn điểm có tọa độ
    // hợp lệ đúng bằng 0 (0 là falsy) — giờ chỉ loại khi thật sự không parse được (null).
    .filter(function (p) { return p.lat !== null && p.lng !== null; });
}

/** Tải 1 ảnh minh chứng lên Drive để gắn vào 1 điểm GPS cụ thể (cột HINH_ANH của HD_GPS) */
function TAI_ANH_GPS_LEN_DRIVE(base64Data, mimeType, tenFileGoc) {
  if (!base64Data) return { thanhCong: false, loi: 'Không có dữ liệu ảnh' };
  try {
    // ⚠️ ĐÃ SỬA: trước đây dùng CHUNG thư mục với ảnh hiện trường
    // (layHoacTaoThuMucAnh_) — giờ tách thư mục RIÊNG cho ảnh minh chứng GPS,
    // để cấu hình được độc lập ở trang Thiết lập.
    const folder = layHoacTaoThuMucAnhGPS_();
    const bytes = Utilities.base64Decode(base64Data);
    const ten = tenFileGoc || ('gps_' + new Date().getTime() + '.jpg');
    const blob = Utilities.newBlob(bytes, mimeType || 'image/jpeg', ten);
    const file = folder.createFile(blob);
    return { thanhCong: true, url: file.getUrl(), ten: file.getName() };
  } catch (e) {
    return { thanhCong: false, loi: e.message };
  }
}

/** Lấy (hoặc tạo mới) thư mục Drive RIÊNG lưu ảnh minh chứng cho từng điểm GPS
 *  (khác thư mục ảnh hiện trường HD_Picture) — ưu tiên thư mục đã cấu hình qua
 *  trang Thiết lập (Script Property GPS_ANH_FOLDER_ID). */
function layHoacTaoThuMucAnhGPS_() {
  const idDaCauHinh = PropertiesService.getScriptProperties().getProperty('GPS_ANH_FOLDER_ID');
  if (idDaCauHinh) {
    try { return DriveApp.getFolderById(idDaCauHinh); } catch (e) { /* ID đã lưu không mở được nữa -> rơi về tìm/tạo theo tên bên dưới */ }
  }
  const ten = 'HD_GPS_Images';
  const it = DriveApp.getFoldersByName(ten);
  if (it.hasNext()) return it.next();
  return DriveApp.createFolder(ten);
}

/** Thêm 1 link ảnh CÓ SẴN (đã có trên Drive, dán trực tiếp) vào HD_Picture của 1 hợp đồng — không qua luồng nháp/EXIF vì đây là link có sẵn, không phải file mới tải lên. */
function THEM_LINK_ANH_HOP_DONG(idHD, url) {
  idHD = (idHD || '').toString().trim();
  url = (url || '').toString().trim();
  if (!idHD || !url) return { thanhCong: false, loi: 'Thiếu ID_HD hoặc link ảnh' };
  const nccRows = readData_(SHEET_NAME.HD_NCC);
  const row = nccRows.find(function (r) { return (r[NCC_COL.ID_HD] || '').toString().trim() === idHD; });
  ghiAnhVaoHDPicture_(idHD, row ? row[NCC_COL.TEN_CHU_RUNG] : '', url);
  ghiNhatKy_('Thêm link ảnh', idHD, url);
  // ⚠️ TRƯỚC ĐÂY THIẾU: không gọi cập nhật Draft sau khi ghi ảnh -> cờ "Có ảnh"
  // trong Draft_BaoCaoHopDong bị CŨ (vẫn hiện "chưa có ảnh" dù ảnh đã lưu vào
  // HD_Picture) cho tới khi có 1 thao tác KHÁC (sửa hợp đồng/rừng) vô tình kích
  // hoạt cập nhật Draft. Giờ gọi ngay tại đây để Draft luôn đúng ngay lập tức.
  CAP_NHAT_DRAFT_MOT_HOP_DONG(idHD);
  return { thanhCong: true };
}

/** Lấy (hoặc tạo mới) thư mục Drive lưu hồ sơ pháp lý (CCCD/GCN QSDĐ/giấy xác nhận/ủy quyền...) */
function layHoacTaoThuMucHoSo_() {
  // Ưu tiên thư mục đã cấu hình qua trang Thiết lập (Script Property) — giống
  // cơ chế của layHoacTaoThuMucAnh_(), cho phép trỏ sang thư mục khác mà không
  // cần sửa code.
  const idDaCauHinh = PropertiesService.getScriptProperties().getProperty('HOSO_FOLDER_ID');
  if (idDaCauHinh) {
    try { return DriveApp.getFolderById(idDaCauHinh); } catch (e) { /* ID đã lưu không mở được nữa -> rơi về tìm/tạo theo tên bên dưới */ }
  }
  const ten = 'HD_RUNG_Files_';
  const it = DriveApp.getFoldersByName(ten);
  if (it.hasNext()) return it.next();
  return DriveApp.createFolder(ten);
}

/**
 * TẢI LÊN 1 file hồ sơ pháp lý (PDF hoặc ảnh scan) và gắn thẳng vào cột
 * DinhKemGiayTo của 1 lô rừng cụ thể — dùng khi phát hiện thiếu hồ sơ ngay tại
 * màn hình Đối chiếu OCR / Kiểm tra hồ sơ, để bổ sung tại chỗ thay vì phải mở
 * lại form nhập liệu rồi test lại từ đầu.
 */
function TAI_LEN_HO_SO_RUNG(idRung, tenFileGoc, base64Data, mimeType) {
  idRung = (idRung || '').toString().trim();
  if (!idRung || !base64Data) return { thanhCong: false, loi: 'Thiếu ID_RUNG hoặc dữ liệu file' };
  try {
    const folder = layHoacTaoThuMucHoSo_();
    const bytes = Utilities.base64Decode(base64Data);
    const blob = Utilities.newBlob(bytes, mimeType || 'application/pdf', tenFileGoc || ('hoso_' + new Date().getTime()));
    const file = folder.createFile(blob);
    const url = file.getUrl();
    const kq = CAP_NHAT_LO_RUNG(idRung, { dinhKemGiayTo: url });
    if (!kq.thanhCong) return kq;
    ghiNhatKy_('Tải hồ sơ pháp lý mới', idRung, url);
    return { thanhCong: true, url: url, tenFile: file.getName() };
  } catch (e) {
    return { thanhCong: false, loi: 'Lỗi tải file: ' + e.message };
  }
}

function layHoacTaoThuMucAnh_() {
  // Ưu tiên thư mục đã cấu hình qua trang Thiết lập (Script Properties) — cho
  // phép trỏ sang thư mục Drive khác (vd dùng lại hệ thống này cho dữ liệu/dự
  // án khác) mà không cần sửa code.
  const idDaCauHinh = PropertiesService.getScriptProperties().getProperty('ANH_FOLDER_ID');
  if (idDaCauHinh) {
    try { return DriveApp.getFolderById(idDaCauHinh); } catch (e) { /* ID đã lưu không mở được nữa -> rơi về tìm/tạo theo tên bên dưới */ }
  }
  const ten = 'HD_Picture_Images';
  const it = DriveApp.getFoldersByName(ten);
  if (it.hasNext()) return it.next();
  return DriveApp.createFolder(ten);
}

/**
 * Ghi 1 tên file ảnh vào sheet HD_Picture cho đúng ID_HD — tìm dòng đã có của
 * hợp đồng đó và đặt vào ô Picture trống đầu tiên; nếu dòng đã đầy đủ 10 ảnh
 * hoặc chưa có dòng nào, tạo dòng mới.
 */
function ghiAnhVaoHDPicture_(idHD, tenChuRung, tenFile) {
  const sh = getSheet_(SHEET_NAME.HD_PICTURE);
  const lastRow = sh.getLastRow();
  const data = lastRow >= 2 ? sh.getRange(2, 1, lastRow - 1, sh.getLastColumn()).getValues() : [];

  for (let i = 0; i < data.length; i++) {
    if ((data[i][PICTURE_COL.ID_HD] || '').toString().trim() === idHD.toString().trim()) {
      for (let c = PICTURE_COL.PICTURE_START; c <= PICTURE_COL.PICTURE_END; c++) {
        if (!data[i][c]) {
          sh.getRange(i + 2, c + 1).setValue(tenFile);
          return;
        }
      }
      // dòng này đã đủ 10 ảnh -> tạo thêm 1 dòng mới bên dưới cho hợp đồng này
      break;
    }
  }
  const row = [];
  row[PICTURE_COL.ID_HD] = idHD;
  row[PICTURE_COL.ID_PICTURE] = idHD;
  row[PICTURE_COL.TEN_CHU_RUNG] = tenChuRung || '';
  row[PICTURE_COL.PICTURE_START] = tenFile;
  sh.appendRow(row);
}

/**
 * TẢI ẢNH LÊN KIỂM TRA — GHI VÀO SHEET NHÁP (Draft_AnhRung) TRƯỚC, KHÔNG ghi
 * thẳng vào HD_GPS/HD_Picture. Hỗ trợ 2 trường hợp:
 *  a) Đã biết rõ ảnh thuộc lô rừng nào -> truyền idHD + idRung
 *  b) TẢI LÊN KIỂM TRA ĐỘC LẬP (chưa rõ gán vào hợp đồng/rừng nào) -> để trống
 *     idHD/idRung, sau này dùng GAN_ANH_VAO_RUNG() để gán + duyệt cùng lúc.
 *
 * Các bước: lưu ảnh vào Drive (thư mục HD_Picture_Images) -> đọc EXIF (nếu có GPS
 * thì lưu kèm, CHƯA ghi vào HD_GPS) -> ghi 1 dòng vào Draft_AnhRung, TrangThai = "Chờ duyệt".
 *
 * params = { idHD, idRung, diaChiRung, ghiChu, tenFileGoc, base64Data, mimeType }
 * Trả về { thanhCong, tenFile, gpsDaThem: {lat,lng} | null, soDongDraft, loi }
 */
/**
 * Đọc tem tọa độ GPS hiển thị NGAY TRÊN ảnh (dạng app "GPS Map Camera" phổ
 * biến khi đi thực địa — thường in vĩ độ/kinh độ, địa chỉ, ngày giờ ở góc/dưới
 * ảnh) bằng Gemini — dùng khi ảnh KHÔNG có tọa độ trong EXIF. Dùng chung cấu
 * hình API key/model đã cấu hình ở Thiết lập → 🤖 Chatbot.
 * @return {{lat:number,lng:number}|null} null nếu không đọc được/không có tem
 */
/** Bản gọi được từ webapp (nhận base64 trực tiếp, dùng ở form "Thêm điểm GPS"
 *  để tự đọc tọa độ từ ảnh minh chứng vừa chọn — không cần đã lưu vào Drive trước). */
function DOC_TOA_DO_TU_ANH_WEBAPP(base64Data, mimeType) {
  if (!base64Data) return { thanhCong: false, loi: 'Không có dữ liệu ảnh' };
  try {
    const bytes = Utilities.base64Decode(base64Data);
    const blob = Utilities.newBlob(bytes, mimeType || 'image/jpeg', 'tam.jpg');
    const toaDo = docToaDoTuTemAnhBangGemini_(blob);
    if (!toaDo) return { thanhCong: false, loi: 'Không tìm thấy tem tọa độ trên ảnh này (hoặc chưa cấu hình API key Gemini ở Thiết lập).' };
    return { thanhCong: true, lat: toaDo.lat, lng: toaDo.lng, diaChi: toaDo.diaChi || '' };
  } catch (e) {
    return { thanhCong: false, loi: 'Lỗi đọc tọa độ: ' + e.message };
  }
}

function docToaDoTuTemAnhBangGemini_(blob) {
  const p = PropertiesService.getScriptProperties();
  const apiKey = p.getProperty('GEMINI_API_KEY');
  if (!apiKey) return null; // chưa cấu hình API key -> im lặng bỏ qua, không chặn việc lưu ảnh
  let model = p.getProperty('GEMINI_MODEL') || 'gemini-3.5-flash-lite';
  if (['gemini-3.7-flash', 'gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-1.5-pro'].indexOf(model) !== -1) model = 'gemini-3.5-flash-lite';

  const base64 = Utilities.base64Encode(blob.getBytes());
  const prompt =
    'Ảnh này có thể có TEM TỌA ĐỘ GPS in sẵn trên ảnh (kiểu ứng dụng "GPS Map Camera" — thường ở góc dưới ảnh, gồm vĩ độ/kinh độ dạng số, có thể kèm địa chỉ/ngày giờ). ' +
    'Nếu tìm thấy, CHỈ trả về đúng 1 dòng JSON dạng {"lat": <số thập phân>, "lng": <số thập phân>, "diaChi": "<địa chỉ ghi trên tem nếu có, để chuỗi rỗng nếu không có>"} — lat/lng là số thập phân thường (không phải độ-phút-giây), không kèm chữ giải thích gì khác. ' +
    'Nếu KHÔNG tìm thấy tem tọa độ nào trên ảnh, trả về đúng {"lat": null, "lng": null, "diaChi": ""}.';
  const payload = { contents: [{ parts: [{ text: prompt }, { inline_data: { mime_type: blob.getContentType(), data: base64 } }] }] };
  const options = { method: 'post', contentType: 'application/json', payload: JSON.stringify(payload), muteHttpExceptions: true };
  function goiGeminiToaDo_(tenModel) {
    const url = 'https://generativelanguage.googleapis.com/v1beta/models/' + tenModel + ':generateContent?key=' + apiKey;
    return JSON.parse(UrlFetchApp.fetch(url, options).getContentText());
  }
  // ⚠️ ĐỒNG BỘ với OCR_TU_BAN_SCAN: thử ngay model dự phòng nếu model chính báo
  // quá tải, tránh âm thầm bỏ qua chỉ vì đúng lúc 1 model bị quá tải.
  const MODEL_DU_PHONG_TOADO_ = ['gemini-3.6-flash', 'gemini-3.5-flash'];
  let json = goiGeminiToaDo_(model);
  for (let i = 0; json.error && /high demand|overloaded|503|try again later/i.test(json.error.message || '') && i < MODEL_DU_PHONG_TOADO_.length; i++) {
    if (MODEL_DU_PHONG_TOADO_[i] === model) continue;
    model = MODEL_DU_PHONG_TOADO_[i];
    json = goiGeminiToaDo_(model);
  }
  if (json.error) return null; // lỗi Gemini (quá tải, model sai...) -> im lặng bỏ qua, không chặn việc lưu ảnh
  const text = json.candidates && json.candidates[0] && json.candidates[0].content && json.candidates[0].content.parts && json.candidates[0].content.parts[0] && json.candidates[0].content.parts[0].text;
  if (!text) return null;
  // Gemini đôi khi bọc JSON trong ```json ... ``` -> tách phần {...} ra trước khi parse
  const khop = text.match(/\{[^{}]*\}/);
  if (!khop) return null;
  let obj;
  try { obj = JSON.parse(khop[0]); } catch (e) { return null; }
  if (obj.lat === null || obj.lat === undefined || obj.lng === null || obj.lng === undefined) return null;
  const lat = Number(obj.lat), lng = Number(obj.lng);
  if (isNaN(lat) || isNaN(lng)) return null;
  // Kiểm tra hợp lý trong phạm vi Việt Nam (giống điều kiện đã dùng ở nơi khác trong project) — tránh nhận nhầm số không phải tọa độ
  if (lat < 8 || lat > 24 || lng < 102 || lng > 110) return null;
  return { lat: lat, lng: lng, diaChi: obj.diaChi || '' };
}

function THEM_ANH_RUNG(params) {
  if (!params || !params.base64Data) return { thanhCong: false, loi: 'Không có dữ liệu ảnh' };

  try {
    const folder = layHoacTaoThuMucAnh_();
    const bytes = Utilities.base64Decode(params.base64Data);
    const tenGoc = params.tenFileGoc || ('anh_' + new Date().getTime() + '.jpg');
    const blob = Utilities.newBlob(bytes, params.mimeType || 'image/jpeg', tenGoc);
    const file = folder.createFile(blob);
    const tenFileLuu = file.getName();
    const urlFile = file.getUrl();

    // Đọc EXIF (hàm docExifTuBytes_ đã có sẵn trong 03_ImageForensics.gs, dùng chung được vì cùng project)
    let gpsDaThem = null;
    let nguonGps = '';
    try {
      const exif = docExifTuBytes_(blob);
      if (exif.hasExif && exif.gpsLat && exif.gpsLng) {
        gpsDaThem = { lat: exif.gpsLat, lng: exif.gpsLng };
        nguonGps = 'EXIF';
      }
    } catch (e) {
      // Không đọc được EXIF thì bỏ qua, thử cách khác bên dưới
    }
    // ⚠️ MỚI: nhiều ảnh hiện trường KHÔNG có EXIF GPS (do máy tắt định vị, ảnh
    // đã qua chỉnh sửa/nén lại...) nhưng CÓ SẴN tem tọa độ hiển thị ngay trên
    // ảnh (kiểu app "GPS Map Camera" rất phổ biến khi đi thực địa) — dùng
    // Gemini đọc tem đó khi EXIF không có, không cần người dùng gõ tay.
    if (!gpsDaThem) {
      try {
        const toaDoTuTem = docToaDoTuTemAnhBangGemini_(blob);
        if (toaDoTuTem) { gpsDaThem = toaDoTuTem; nguonGps = 'Tem tọa độ trên ảnh (đọc bằng Gemini)'; }
      } catch (e) {
        // Không đọc được (chưa cấu hình API key, ảnh không có tem, Gemini lỗi...) thì bỏ qua, vẫn lưu ảnh bình thường
      }
    }

    const shDraft = getOrCreateDraftAnhSheet_();
    const idDraft = Utilities.getUuid();
    shDraft.appendRow([
      idDraft, params.idHD || '', params.idRung || '', tenFileLuu, file.getId(), urlFile,
      gpsDaThem ? gpsDaThem.lat : '', gpsDaThem ? gpsDaThem.lng : '',
      params.diaChiRung || '', params.ghiChu || '', 'Chờ duyệt', new Date()
    ]);

    return { thanhCong: true, tenFile: tenFileLuu, gpsDaThem: gpsDaThem, nguonGps: nguonGps, soDongDraft: shDraft.getLastRow() };
  } catch (e) {
    return { thanhCong: false, loi: 'Lỗi lưu ảnh: ' + e.message };
  }
}

/** Lấy danh sách ảnh nháp (chờ duyệt / đã xử lý) của 1 lô rừng cụ thể, mới nhất trước */
/**
 * Lấy ảnh của 1 lô rừng để hiện ở tab "🖼️ Ảnh" (chi tiết lô rừng) — GỘP 2 NGUỒN:
 * (1) Draft_AnhRung (ảnh tải qua hệ thống mới, đã duyệt) — có gán đúng idRung.
 * (2) HD_Picture (ảnh cũ/nhập từ nguồn khác, KHÔNG qua Draft_AnhRung) — không
 *     phân biệt theo lô cụ thể, chỉ theo hợp đồng, nên hiện kèm ghi chú rõ.
 * ⚠️ ĐÃ SỬA: trước đây CHỈ đọc Draft_AnhRung — ảnh cũ nằm thẳng trong HD_Picture
 * (đã tồn tại trước khi có luồng upload mới) sẽ KHÔNG hiện ở đây dù ảnh vẫn có
 * thật (thấy được ở tab "Kiểm tra ảnh (đã lưu)" vì tab đó đọc thẳng HD_Picture).
 */
function layDraftAnhChoRung(idRung, idHD) {
  const sh = getOrCreateDraftAnhSheet_();
  const lastRow = sh.getLastRow();
  const ketQua = [];
  if (lastRow >= 2) {
    const data = sh.getRange(2, 1, lastRow - 1, sh.getLastColumn()).getValues();
    data.forEach(function (r, i) {
      if ((r[DRAFT_ANH_COL.ID_RUNG] || '').toString().trim() === idRung.toString().trim()) {
        ketQua.push(Object.assign({ nguon: 'moi' }, chuyenDoiDongDraft_(r, i + 2)));
      }
    });
  }
  // ---- Gộp thêm ảnh cũ nằm thẳng trong HD_Picture (nếu có truyền idHD) ----
  if (idHD) {
    const pictureRows = readData_(SHEET_NAME.HD_PICTURE);
    const idHDChuan = idHD.toString().trim();
    pictureRows.forEach(function (r) {
      const idThoTrongSheet = (r[PICTURE_COL.ID_HD] || '').toString().trim();
      // Đối chiếu kép: khớp đúng ID_HD, HOẶC (dữ liệu cũ lỡ lưu ID_RUNG vào cột này) khớp đúng idRung đang xem
      if (idThoTrongSheet !== idHDChuan && idThoTrongSheet !== idRung.toString().trim()) return;
      for (let c = PICTURE_COL.PICTURE_START; c <= PICTURE_COL.PICTURE_END; c++) {
        const giaTri = r[c];
        if (!giaTri) continue;
        const link = resolveDriveLink_(giaTri);
        ketQua.push({
          nguon: 'cu', trangThai: 'Đã duyệt', // ảnh cũ trong HD_Picture coi như đã ở trạng thái chính thức từ trước
          tenFile: link ? link.ten : giaTri.toString().split('/').pop(),
          url: link ? link.url : (giaTri.toString().indexOf('http') === 0 ? giaTri : ''),
          gpsLat: '', gpsLng: '', diaChiRung: '', ghiChu: 'Ảnh cũ (có sẵn trong hồ sơ trước khi dùng luồng tải ảnh mới) — không phân biệt theo từng lô cụ thể'
        });
      }
    });
  }
  return ketQua.reverse();
}

/** Lấy TOÀN BỘ ảnh nháp (kể cả chưa gán rừng nào) — dùng cho trang "Kiểm tra ảnh" độc lập */
function layTatCaDraftAnh() {
  const sh = getOrCreateDraftAnhSheet_();
  const lastRow = sh.getLastRow();
  if (lastRow < 2) return [];
  const data = sh.getRange(2, 1, lastRow - 1, sh.getLastColumn()).getValues();
  return data.map(function (r, i) { return chuyenDoiDongDraft_(r, i + 2); }).reverse();
}

function chuyenDoiDongDraft_(r, soDong) {
  return {
    soDong: soDong,
    idHD: r[DRAFT_ANH_COL.ID_HD],
    idRung: r[DRAFT_ANH_COL.ID_RUNG],
    tenFile: r[DRAFT_ANH_COL.TEN_FILE],
    url: r[DRAFT_ANH_COL.DRIVE_URL],
    gpsLat: r[DRAFT_ANH_COL.GPS_LAT],
    gpsLng: r[DRAFT_ANH_COL.GPS_LNG],
    diaChiRung: r[DRAFT_ANH_COL.DIA_CHI_RUNG],
    ghiChu: r[DRAFT_ANH_COL.GHI_CHU],
    trangThai: r[DRAFT_ANH_COL.TRANG_THAI]
  };
}

/**
 * GÁN 1 ảnh nháp (đang chưa có idRung, ví dụ tải lên từ trang "Kiểm tra ảnh" độc lập)
 * vào đúng 1 hợp đồng + lô rừng cụ thể. Gọi trước khi DUYỆT nếu ảnh chưa có sẵn ID_RUNG.
 */
function GAN_ANH_VAO_RUNG(soDong, idHD, idRung) {
  const sh = getOrCreateDraftAnhSheet_();
  if (soDong < 2 || soDong > sh.getLastRow()) return { thanhCong: false, loi: 'Số dòng không hợp lệ' };
  sh.getRange(soDong, DRAFT_ANH_COL.ID_HD + 1).setValue(idHD);
  sh.getRange(soDong, DRAFT_ANH_COL.ID_RUNG + 1).setValue(idRung);
  return { thanhCong: true };
}

/**
 * DUYỆT 1 ảnh nháp: copy tọa độ GPS (nếu có) vào HD_GPS của đúng lô rừng,
 * ghi URL ảnh vào HD_Picture theo ID_HD, rồi đánh dấu dòng nháp là "Đã duyệt".
 * Bắt buộc ảnh đã được gán idHD + idRung (dùng GAN_ANH_VAO_RUNG nếu chưa có).
 */
function DUYET_ANH_RUNG(soDong) {
  const sh = getOrCreateDraftAnhSheet_();
  if (soDong < 2 || soDong > sh.getLastRow()) return { thanhCong: false, loi: 'Số dòng không hợp lệ' };
  const row = sh.getRange(soDong, 1, 1, sh.getLastColumn()).getValues()[0];

  const idHD = row[DRAFT_ANH_COL.ID_HD];
  const idRung = row[DRAFT_ANH_COL.ID_RUNG];
  if (!idHD || !idRung) return { thanhCong: false, loi: 'Ảnh chưa được gán vào hợp đồng/lô rừng nào — gán trước khi duyệt.' };

  const url = row[DRAFT_ANH_COL.DRIVE_URL];
  const lat = row[DRAFT_ANH_COL.GPS_LAT];
  const lng = row[DRAFT_ANH_COL.GPS_LNG];

  if (lat && lng) {
    CAP_NHAT_GPS_RUNG(idRung, { lat: Number(lat), lng: Number(lng), heToaDo: 'DD' }, false);
  }

  const rungRows = readData_(SHEET_NAME.HD_RUNG);
  const rung = rungRows.find(function (r) { return (r[RUNG_COL.ID_RUNG] || '').toString().trim() === idRung.toString().trim(); });
  ghiAnhVaoHDPicture_(idHD, rung ? rung[RUNG_COL.TEN_CHU_RUNG] : '', url); // lưu URL đầy đủ (bấm mở được trực tiếp) thay vì chỉ tên file

  sh.getRange(soDong, DRAFT_ANH_COL.TRANG_THAI + 1).setValue('Đã duyệt');
  ghiNhatKy_('Duyệt ảnh', idHD, 'Lô rừng ' + idRung + ' — file: ' + row[DRAFT_ANH_COL.TEN_FILE]);
  // ⚠️ TRƯỚC ĐÂY: chỉ cập nhật Draft GIÁN TIẾP qua CAP_NHAT_GPS_RUNG ở trên (chỉ
  // chạy khi ảnh có tọa độ EXIF). Ảnh KHÔNG có GPS (rất phổ biến — máy ảnh/điện
  // thoại tắt định vị) thì trước đây KHÔNG có lệnh nào cập nhật Draft cả -> cờ
  // "Có ảnh" trong báo cáo vẫn hiện "chưa có ảnh" dù ảnh đã duyệt xong. Giờ luôn
  // gọi lại ở đây (không phụ thuộc có GPS hay không) — nếu GPS đã cập nhật rồi ở
  // trên thì đây chỉ là ghi đè thêm 1 lần với cùng dữ liệu, không sai gì cả.
  CAP_NHAT_DRAFT_MOT_HOP_DONG(idHD);
  CAP_NHAT_DRAFT_HOSORUNG_MOT_DONG_(idRung);
  return { thanhCong: true };
}


/** TỪ CHỐI 1 ảnh nháp: xóa file khỏi Drive luôn (dọn rác), đánh dấu "Đã từ chối" */
function TU_CHOI_ANH_RUNG(soDong) {
  const sh = getOrCreateDraftAnhSheet_();
  if (soDong < 2 || soDong > sh.getLastRow()) return { thanhCong: false, loi: 'Số dòng không hợp lệ' };
  const row = sh.getRange(soDong, 1, 1, sh.getLastColumn()).getValues()[0];
  const fileId = row[DRAFT_ANH_COL.DRIVE_FILE_ID];
  try { if (fileId) DriveApp.getFileById(fileId).setTrashed(true); } catch (e) { /* bỏ qua nếu file đã bị xóa trước đó */ }
  sh.getRange(soDong, DRAFT_ANH_COL.TRANG_THAI + 1).setValue('Đã từ chối');
  return { thanhCong: true };
}

/**
 * Thử suy ra link Drive có thể bấm mở được từ 1 giá trị lưu trong sheet — giá trị
 * có thể đã là URL đầy đủ (ảnh mới thêm qua hệ thống này), hoặc chỉ là tên/đường dẫn
 * file cũ (dữ liệu nhập từ trước) — trường hợp này thử tìm file theo tên trên Drive.
 */
function resolveDriveLink_(value) {
  if (!value) return null;
  const v = value.toString().trim();
  if (!v) return null;
  if (v.indexOf('http') === 0) {
    // ⚠️ ĐÃ SỬA: TRƯỚC ĐÂY lấy tên hiển thị bằng cách tách phần cuối URL (vd
    // "...file/d/ID/view?usp=drivesdk" -> ra chữ "view?usp=drivesdk" rất xấu,
    // không phải tên file thật). Giờ trích File ID rồi HỎI DRIVE tên thật của
    // file (getName()) để hiển thị đúng (vd "CCCD_NguyenVanA.pdf"). Chỉ rơi về
    // cách đoán cũ nếu không lấy được tên thật (file bị xóa/mất quyền xem).
    const khop = v.match(/\/d\/([a-zA-Z0-9_-]+)/) || v.match(/[?&]id=([a-zA-Z0-9_-]+)/);
    if (khop && khop[1]) {
      try { return { ten: DriveApp.getFileById(khop[1]).getName(), url: v }; }
      catch (e) { /* file bị xóa/mất quyền xem -> rơi xuống dùng tạm tên đoán từ URL */ }
    }
    return { ten: v.split('/').pop(), url: v };
  }
  try {
    const tenFile = v.split('/').pop();
    const it = DriveApp.getFilesByName(tenFile);
    if (it.hasNext()) {
      const f = it.next();
      return { ten: f.getName(), url: f.getUrl() };
    }
  } catch (e) { /* bỏ qua lỗi tra cứu Drive */ }
  return { ten: v, url: null }; // không tìm thấy file thật trên Drive, chỉ hiện tên đã lưu
}

/** Lấy toàn bộ ảnh (đã duyệt, nằm trong HD_Picture) của 1 hợp đồng, kèm link bấm mở được */
/**
 * ⚠️ ĐÃ SỬA: phát hiện một số dòng CŨ trong HD_Picture lưu NHẦM giá trị
 * ID_RUNG vào cột ID_HD (thay vì đúng ID_HD của hợp đồng cha) — do 1 lượt
 * ghi/import dữ liệu trước đây dùng nhầm định danh (xác nhận qua đối chiếu
 * trực tiếp: HD_Picture.ID_HD = "HAK2026...-ffa" nhưng ID_HD thật trong
 * HD_RUNG lại là 1 mã hash khác hẳn, còn "HAK2026...-ffa" chính là ID_RUNG).
 * Vì không thể chắc TOÀN BỘ dữ liệu cũ đã bị lỗi này hay chỉ một phần, hàm
 * giờ so khớp theo CẢ HAI khả năng: đúng ID_HD, HOẶC bất kỳ ID_RUNG nào thuộc
 * về hợp đồng này (tra qua HD_RUNG) — không bỏ sót ảnh dù dữ liệu gốc bị lưu
 * nhầm kiểu nào.
 */
/**
 * Lấy ảnh trong HD_Picture khớp ĐÚNG 1 định danh cụ thể (có thể là ID_HD thật
 * HOẶC ID_RUNG — vì dữ liệu xác nhận cột "ID_HD" trong HD_Picture thực chất
 * lưu ID_RUNG cho các dòng gán riêng theo lô rừng, đây là cách lưu ĐÚNG chủ
 * định của dữ liệu, không phải lỗi). Dùng làm khối xây dựng chung cho cả
 * layAnhCuaHopDong() (gộp cả hợp đồng) và layChiTietHoSoMotLoRung() (tách
 * riêng theo từng lô).
 */
function layAnhTheoDinhDanhHDPicture_(dinhDanh) {
  dinhDanh = (dinhDanh || '').toString().trim();
  if (!dinhDanh) return [];
  const rows = readData_(SHEET_NAME.HD_PICTURE);
  const ketQua = [];
  rows.forEach(function (r) {
    if ((r[PICTURE_COL.ID_HD] || '').toString().trim() !== dinhDanh) return;
    for (let c = PICTURE_COL.PICTURE_START; c <= PICTURE_COL.PICTURE_END; c++) {
      const link = resolveDriveLink_(r[c]);
      if (link) ketQua.push(link);
    }
  });
  return ketQua;
}

/** Lấy TẤT CẢ ảnh của 1 hợp đồng (không phân biệt lô rừng nào) — gộp cả ảnh
 *  khớp đúng ID_HD lẫn ảnh khớp ID_RUNG của bất kỳ lô nào thuộc hợp đồng này. */
function layAnhCuaHopDong(idHD) {
  idHD = (idHD || '').toString().trim();
  if (!idHD) return [];

  const dinhDanhCanTra = [idHD];
  readData_(SHEET_NAME.HD_RUNG).forEach(function (r) {
    if ((r[RUNG_COL.ID_KEY_HD] || '').toString().trim() === idHD) {
      const idRung = (r[RUNG_COL.ID_RUNG] || '').toString().trim();
      if (idRung) dinhDanhCanTra.push(idRung);
    }
  });

  let ketQua = [];
  dinhDanhCanTra.forEach(function (dd) { ketQua = ketQua.concat(layAnhTheoDinhDanhHDPicture_(dd)); });
  return ketQua;
}

/** Lấy hồ sơ pháp lý (loại hồ sơ + số giấy tờ + file đính kèm) theo từng lô rừng của 1 hợp đồng */
function layHoSoCuaHopDong(idHD) {
  idHD = (idHD || '').toString().trim();
  if (!idHD) return [];
  const rows = readData_(SHEET_NAME.HD_RUNG);
  return rows
    .filter(function (r) { return (r[RUNG_COL.ID_KEY_HD] || '').toString().trim() === idHD; })
    .map(function (r) {
      let dinhKem = null;
      try { dinhKem = resolveDriveLink_(r[RUNG_COL.DINH_KEM_GIAY_TO]); } catch (e) { /* 1 dòng lỗi không được làm hỏng cả danh sách — bỏ qua link, vẫn trả về hồ sơ nguồn gốc/số giấy tờ */ }
      return {
        idRung: r[RUNG_COL.ID_RUNG],
        hoSoNguonGoc: r[RUNG_COL.HO_SO_NGUON_GOC],
        soGiayTo: r[RUNG_COL.SO_GIAY_TO],
        dinhKem: dinhKem
      };
    });
}

/**
 * ============================================================
 *  DANH SÁCH PHÂN TRANG + TÌM KIẾM (dùng cho danh sách chọn hợp đồng)
 * ============================================================
 */

/**
 * Lấy danh sách hợp đồng có phân trang (mặc định 20 dòng/trang) + tìm kiếm theo
 * tên chủ rừng / số HĐ / ID_HD + lọc theo trạng thái. Dùng để hiển thị bảng chọn
 * hợp đồng thay vì bắt người dùng gõ tay ID_HD.
 */
/** Wrapper bắt lỗi — LUÔN trả về 1 object hợp lệ (kể cả khi lỗi), không bao giờ để client
 *  nhận null/undefined không rõ lý do (đây là nguyên nhân lỗi "Cannot read properties of null"). */
function layDanhSachHopDong(trang, kichThuoc, tuKhoa, tinhTrangLoc) {
  try {
    return layDanhSachHopDong_ThucThi_(trang, kichThuoc, tuKhoa, tinhTrangLoc);
  } catch (e) {
    return { items: [], trang: 1, tongTrang: 1, tongSo: 0, loi: 'LỖI SERVER thực sự: ' + e.message + ' (dòng: ' + (e.lineNumber || 'không rõ') + ')' };
  }
}

function layDanhSachHopDong_ThucThi_(trang, kichThuoc, tuKhoa, tinhTrangLoc) {
  trang = trang || 1;
  kichThuoc = kichThuoc || 20;
  const rows = readData_(SHEET_NAME.HD_NCC);
  const tk = (tuKhoa || '').toString().trim().toLowerCase();
  const tinhTrangLocChuan = (tinhTrangLoc || '').toString().trim();

  // Gắn số dòng thật (soDong) vào TỪNG dòng NGAY TỪ ĐẦU — trước khi filter/slice làm mất
  // tương quan với chỉ số mảng gốc. soDong dùng để CHỌN/SỬA hợp đồng trực tiếp theo đúng
  // dòng, KHÔNG cần tìm kiếm lại theo ID_HD (loại bỏ hoàn toàn khả năng "không tìm thấy").
  const rowsCoSoDong = rows.map(function (r, i) { return { r: r, soDong: i + 2 }; });

  const loc = rowsCoSoDong.filter(function (x) {
    const r = x.r;
    const tinhTrang = (r[NCC_COL.TINH_TRANG] || 'Đang thực hiện').toString().trim();
    if (tinhTrangLocChuan && tinhTrangLocChuan !== 'Tất cả' && tinhTrang !== tinhTrangLocChuan) return false;
    if (!tk) return true;
    const ten = (r[NCC_COL.TEN_CHU_RUNG] || '').toString().toLowerCase();
    const soHD = (r[NCC_COL.SO_HD] || '').toString().toLowerCase();
    const idHD = (r[NCC_COL.ID_HD] || '').toString().toLowerCase();
    return ten.indexOf(tk) !== -1 || soHD.indexOf(tk) !== -1 || idHD.indexOf(tk) !== -1;
  });

  // Sắp xếp NGÀY KÝ mới nhất → cũ nhất (trước khi cắt trang, để đúng thứ tự xuyên suốt các trang)
  loc.sort(function (a, b) { return new Date(b.r[NCC_COL.NGAY_KY] || 0) - new Date(a.r[NCC_COL.NGAY_KY] || 0); });

  const tongSo = loc.length;
  const tongTrang = Math.max(1, Math.ceil(tongSo / kichThuoc));
  trang = Math.min(Math.max(1, trang), tongTrang);
  const batDau = (trang - 1) * kichThuoc;

  const items = loc.slice(batDau, batDau + kichThuoc).map(function (x) {
    const r = x.r;
    // ⚠️ CHỈ trả về vài trường TÓM TẮT cho danh sách — KHÔNG nhồi hết mọi trường vào đây.
    // Lý do: nếu mỗi dòng chứa ĐẦY ĐỦ 20+ trường, tổng dữ liệu 20 dòng/trang có thể vượt
    // giới hạn kích thước phản hồi của google.script.run, khiến client nhận về null dù
    // hàm backend chạy đúng (đã xác minh qua log). Khi bấm Sửa, dùng soDong để lấy chi
    // tiết riêng qua layHopDongTheoSoDong (đọc thẳng 1 dòng, không phải tìm kiếm).
    return {
      soDong: x.soDong,
      idHD: r[NCC_COL.ID_HD], soHD: r[NCC_COL.SO_HD],
      ngayKy: r[NCC_COL.NGAY_KY] ? new Date(r[NCC_COL.NGAY_KY]).toISOString() : '', // chuỗi ISO, KHÔNG truyền Date object thô qua google.script.run
      tenChuRung: r[NCC_COL.TEN_CHU_RUNG],
      diaChiRung: r[NCC_COL.DIA_CHI_RUNG], tinhTrang: (r[NCC_COL.TINH_TRANG] || 'Đang thực hiện').toString().trim()
    };
  });

  return { items: items, trang: trang, tongTrang: tongTrang, tongSo: tongSo };
}

/**
 * Lấy đầy đủ thông tin 1 hợp đồng THEO ĐÚNG SỐ DÒNG trong HD_NCC — đọc trực tiếp,
 * KHÔNG tìm kiếm theo chuỗi (loại bỏ hoàn toàn khả năng "Không tìm thấy hợp đồng").
 * Đây là cách CHỌN/SỬA hợp đồng CHÍNH THỨC dùng cho toàn bộ webapp.
 */
/** Wrapper bắt lỗi — đảm bảo mọi ngoại lệ bên trong đều hiện rõ ra ngoài, không bị nuốt mất */
/** Lấy chi tiết 1 hợp đồng trực tiếp theo ID_HD (thay vì phải tự tìm số dòng
 *  trước rồi mới gọi layHopDongTheoSoDong — gộp lại còn 1 lượt gọi duy nhất) */
function layHopDongTheoIdHD(idHD) {
  const soDong = timSoDongTheoGiaTri_(SHEET_NAME.HD_NCC, NCC_COL.ID_HD, idHD);
  if (soDong === -1) return { khongTimThay: true, chanDoan: 'Không tìm thấy hợp đồng có ID_HD = ' + idHD };
  return layHopDongTheoSoDong_ThucThi_(soDong);
}

function layHopDongTheoSoDong(soDong) {
  try {
    return layHopDongTheoSoDong_ThucThi_(soDong);
  } catch (e) {
    return { khongTimThay: true, chanDoan: 'LỖI SERVER thực sự khi đọc hợp đồng: ' + e.message };
  }
}

function layHopDongTheoSoDong_ThucThi_(soDong) {
  const soDongGoc = soDong; // giữ lại giá trị GỐC (trước khi ép kiểu) để chẩn đoán nếu có bất thường
  soDong = Number(soDong);
  const sh = getSheet_(SHEET_NAME.HD_NCC);
  const lastRow = sh.getLastRow();
  if (!soDong || isNaN(soDong) || soDong < 2 || soDong > lastRow) {
    return {
      khongTimThay: true,
      chanDoan: 'Số dòng không hợp lệ. Giá trị gốc nhận được: ' + JSON.stringify(soDongGoc) + ' (kiểu: ' + typeof soDongGoc + ') → sau ép kiểu Number: ' + soDong +
        '. Sheet HD_NCC hiện có lastRow=' + lastRow + '.'
    };
  }
  const r = sh.getRange(soDong, 1, 1, sh.getLastColumn()).getValues()[0];
  const idHD = (r[NCC_COL.ID_HD] || '').toString().trim();

  // Chuyển an toàn 1 giá trị ngày (có thể là Date object thô từ getValues(), chuỗi rỗng,
  // hoặc chuỗi có sẵn) sang chuỗi ISO — tránh truyền thẳng Date object thô qua
  // google.script.run (nghi ngờ đây là nguyên nhân client nhận về null dù hàm chạy đúng
  // khi gọi trực tiếp trong Apps Script editor).
  const ngayToISO_ = function (v) {
    if (!v) return '';
    try {
      const d = new Date(v);
      return isNaN(d.getTime()) ? '' : d.toISOString();
    } catch (e) { return ''; }
  };

  return {
    soDong: soDong,
    idHD: idHD,
    soHD: r[NCC_COL.SO_HD],
    ngayKy: ngayToISO_(r[NCC_COL.NGAY_KY]),
    tenChuRung: r[NCC_COL.TEN_CHU_RUNG],
    diaChiThuongTru: r[NCC_COL.DIA_CHI_TT],
    cccdChuRung: r[NCC_COL.CCCD_CHU_RUNG],
    ngayCap: ngayToISO_(r[NCC_COL.NGAY_CAP]),
    noiCap: r[NCC_COL.NOI_CAP],
    sdtChuRung: r[NCC_COL.SDT_CHU_RUNG],
    tenUyQuyen: r[NCC_COL.TEN_UY_QUYEN],
    cccdUyQuyen: r[NCC_COL.CCCD_UY_QUYEN],
    noiCapUyQuyen: r[NCC_COL.NOI_CAP_UQ],
    diaChiUyQuyen: r[NCC_COL.DIA_CHI_UQ],
    sdtUyQuyen: r[NCC_COL.SDT_UQ],
    ngayCapUyQuyen: ngayToISO_(r[NCC_COL.NGAY_CAP_UQ]),
    diaChiRung: r[NCC_COL.DIA_CHI_RUNG],
    dienTichKy: r[NCC_COL.DIEN_TICH_KY],
    hoSoNguonGoc: r[NCC_COL.HO_SO_NGUON_GOC],
    soGiayTo: r[NCC_COL.SO_GIAY_TO],
    uyQuyenTT: r[NCC_COL.UY_QUYEN_TT],
    slDuKien: r[NCC_COL.SL_DU_KIEN],
    donGia: r[NCC_COL.DON_GIA],
    soTK: r[NCC_COL.SO_TK],
    nganHang: r[NCC_COL.NGAN_HANG],
    tinhTrang: r[NCC_COL.TINH_TRANG],
    nhomKH: r[NCC_COL.NHOM_KH], // ⚠️ BỔ SUNG: thiếu sót từ trước — khiến ô "Nhóm KH" luôn trống lại khi mở sửa hợp đồng có sẵn
    maSoThue: r[NCC_COL.MA_SO_THUE],
    danhSachRung: layDanhSachRung(idHD).map(function (r) { return Object.assign({}, r, { dinhKem: null }); }), // bỏ resolveDriveLink_ (gọi Drive) khỏi luồng chính -- nghi ngờ nguyên nhân lỗi khi chạy qua web
    danhSachTaiKhoan: layDanhSachTaiKhoan(idHD),
    anh: [],
    hoSo: []
  };
}

/**
 * XÓA 1 LÔ RỪNG cụ thể (không xóa cả hợp đồng) — xóa kèm các điểm GPS con của
 * lô rừng đó trong HD_GPS. Không xóa ảnh trong HD_Picture vì ảnh lưu theo cấp
 * hợp đồng (ID_HD), không tách riêng theo từng lô rừng.
 */
function XOA_LO_RUNG(idRung) {
  const soDong = timSoDongTheoGiaTri_(SHEET_NAME.HD_RUNG, RUNG_COL.ID_RUNG, idRung);
  if (soDong === -1) return { thanhCong: false, loi: 'Không tìm thấy lô rừng có ID_RUNG = ' + idRung };

  const shRung = getSheet_(SHEET_NAME.HD_RUNG);
  const idHDCuaRung = shRung.getRange(soDong, RUNG_COL.ID_KEY_HD + 1).getValue(); // lấy TRƯỚC khi xóa dòng
  shRung.deleteRow(soDong);

  // Xóa các điểm GPS con của lô rừng này
  const shGPS = getSheet_(SHEET_NAME.HD_GPS);
  const data = shGPS.getDataRange().getValues();
  for (let i = data.length - 1; i >= 1; i--) {
    if ((data[i][GPS_COL.ID_KEY_GPS] || '').toString().trim() === idRung.toString().trim()) {
      shGPS.deleteRow(i + 1);
    }
  }
  CAP_NHAT_DRAFT_MOT_HOP_DONG(idHDCuaRung);
  CAP_NHAT_CT_HOPDONG_(idHDCuaRung); // tổng hợp lại "ct_hopdong" (xem 14_CtHopDong_PhuLuc.gs)
  XOA_DRAFT_HOSORUNG_MOT_DONG_(idRung); // xóa khỏi cache báo cáo "Hồ sơ rừng" (xem 16_DraftHoSoRung.gs)
  return { thanhCong: true };
}

/** XÓA 1 TÀI KHOẢN cụ thể theo số dòng thật (lấy từ layDanhSachTaiKhoan) */
function XOA_TAI_KHOAN(soDong) {
  const sh = getSheet_(SHEET_NAME.HD_STK);
  if (soDong < 2 || soDong > sh.getLastRow()) return { thanhCong: false, loi: 'Số dòng không hợp lệ' };
  const idHDCuaTK = sh.getRange(soDong, STK_COL.ID_HD + 1).getValue();
  sh.deleteRow(soDong);
  CAP_NHAT_DRAFT_MOT_HOP_DONG(idHDCuaTK);
  return { thanhCong: true };
}

/**
 * ============================================================
 *  THANH LÝ HỢP ĐỒNG
 * ============================================================
 */

/**
 * Danh sách hợp đồng cho form Thanh lý (chưa "Đã thanh lý"), phân trang 20/trang,
 * kèm số lượng/giá trị hợp đồng, đã thực hiện, còn lại — lấy từ tongHopHopDong().
 */
function layDanhSachThanhLy(trang, kichThuoc, boLoc, boBuoc) {
  try {
    trang = trang || 1;
    kichThuoc = kichThuoc || 20;
    boLoc = boLoc || {};

    if (boBuoc) LAM_MOI_DRAFT_THEO_THAY_DOI(); // chỉ cập nhật hợp đồng CÓ THAY ĐỔI, không tính lại toàn bộ

    const chuaLoc = function (s, tk) { return !tk || (s || '').toString().toLowerCase().indexOf(tk.toLowerCase()) !== -1; };

    const list = docToanBoDraftBaoCao_()
      .filter(function (m) { return m.tinhTrang !== 'Đã thanh lý'; })
      .filter(function (m) {
        if (!chuaLoc(m.soHD, boLoc.soHD)) return false;
        if (!chuaLoc(m.tenChuRung, boLoc.tenChuRung)) return false;
        if (!chuaLoc(m.tenUyQuyen, boLoc.tenUyQuyen)) return false;
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

    const tongSo = list.length;
    const tongTrang = Math.max(1, Math.ceil(tongSo / kichThuoc));
    trang = Math.min(Math.max(1, trang), tongTrang);
    const batDau = (trang - 1) * kichThuoc;

    return { items: list.slice(batDau, batDau + kichThuoc), trang: trang, tongTrang: tongTrang, tongSo: tongSo };
  } catch (e) {
    ghiLoiBackend_('layDanhSachThanhLy', e);
    throw new Error('layDanhSachThanhLy lỗi: ' + e.message);
  }
}

/**
 * THANH LÝ 1 hợp đồng — BẮT BUỘC kiểm tra hồ sơ trước:
 *  - Nếu còn thiếu hồ sơ BẮT BUỘC (CCCD, hồ sơ nguồn gốc đất, giấy ủy quyền nếu có ủy quyền)
 *    -> TỪ CHỐI thanh lý, trả về danh sách thiếu để người dùng bổ sung trước.
 *  - Nếu chỉ thiếu phần PHỤ (ảnh, tọa độ GPS) -> cho phép thanh lý nếu bỏQuaCanhBaoPhu=true,
 *    ngược lại trả về cảnh báo để người dùng xác nhận có muốn bỏ qua không.
 */
function THANH_LY_HOP_DONG(idHD, boQuaCanhBaoPhu) {
  const kqTim = timHopDongTheoId(idHD);
  if (!kqTim || kqTim.khongTimThay) return { thanhCong: false, loi: 'Không tìm thấy hợp đồng: ' + idHD + (kqTim && kqTim.chanDoan ? ' — ' + kqTim.chanDoan : '') };

  const rungRows = readData_(SHEET_NAME.HD_RUNG).filter(function (r) {
    return (r[RUNG_COL.ID_KEY_HD] || '').toString().trim() === idHD.toString().trim();
  });

  const nccRows = readData_(SHEET_NAME.HD_NCC);
  const rowNCC = nccRows.find(function (r) { return (r[NCC_COL.ID_HD] || '').toString().trim() === idHD.toString().trim(); });

  const thieuBatBuoc = [];
  const thieuPhu = [];

  rungRows.forEach(function (r) {
    const kq = kiemTraHoSoMotLoRung_(r);
    thieuBatBuoc.push.apply(thieuBatBuoc, kq.thieu.map(function (t) { return r[RUNG_COL.ID_RUNG] + ': ' + t; }));
    if (!(Number(r[RUNG_COL.DIEN_TICH_GPS]) > 0)) thieuPhu.push(r[RUNG_COL.ID_RUNG] + ': Chưa đo tọa độ GPS');
  });
  if (rowNCC) {
    thieuBatBuoc.push.apply(thieuBatBuoc, kiemTraUyQuyenVaTaiKhoan_(rowNCC));
  }
  const anhCuaHD = layAnhCuaHopDong(idHD);
  if (!anhCuaHD.length) thieuPhu.push('Chưa có ảnh hiện trường nào đã duyệt');

  if ((thieuBatBuoc.length || thieuPhu.length) && !boQuaCanhBaoPhu) {
    const tatCaThieu = thieuBatBuoc.concat(thieuPhu);
    return {
      thanhCong: false, canXacNhan: true,
      loi: 'Hồ sơ thiếu: ' + tatCaThieu.join('; ') + '. Bạn có tiếp tục thanh lý không?',
      thieuBatBuoc: thieuBatBuoc, thieuPhu: thieuPhu
    };
  }

  CAP_NHAT_HOP_DONG(kqTim.soDong, { tinhTrang: 'Đã thanh lý' });
  ghiNhatKy_('Thanh lý hợp đồng', idHD, 'Chủ rừng: ' + kqTim.tenChuRung + ((thieuBatBuoc.length || thieuPhu.length) ? ' (đã bỏ qua cảnh báo thiếu: ' + thieuBatBuoc.concat(thieuPhu).join('; ') + ')' : ''));
  CAP_NHAT_DRAFT_MOT_HOP_DONG(idHD);
  return { thanhCong: true };
}

/**
 * ============================================================
 *  LƯU TOÀN BỘ HỢP ĐỒNG TRONG 1 LẦN GỌI DUY NHẤT
 *  (Hợp đồng + danh sách lô rừng + danh sách tài khoản — dùng cho form gộp)
 * ============================================================
 *
 * payload = {
 *   idHD: string|null (null = tạo hợp đồng mới),
 *   hopDong: { tenChuRung, cccdChuRung, ngayKy, diaChiThuongTru, diaChiRung, dienTichKy,
 *              slDuKien, donGia, hoSoNguonGoc, soGiayTo, uyQuyenTT, tenUyQuyen, cccdUyQuyen,
 *              noiCapUQ, soTK, nganHang, tinhTrang, ... },
 *   rung: [ { idRung: string|null, diaChiRung, dienTichM2, donGia, khoiLuongDuKien,
 *             hoSoNguonGoc, soGiayTo, xoa: true/false } , ... ],
 *   taiKhoan: [ { soDong: number|null, soTK, nganHang, uyQuyenTT, tenUyQuyen, xoa: true/false }, ... ]
 * }
 * - idRung/soDong = null  -> dòng MỚI, sẽ được thêm
 * - idRung/soDong có giá trị + xoa=true -> XÓA dòng đó
 * - idRung/soDong có giá trị + xoa=false -> CẬP NHẬT dòng đó
 */
function LUU_HOP_DONG_DAY_DU(payload) {
  const d = payload.hopDong || {};
  let idHD = payload.idHD;
  let soHD;
  let soDongVuaTao; // số dòng thật của hợp đồng (mới tạo hoặc đang cập nhật) — trả về cho client để tránh phải tìm kiếm lại

  if (!idHD) {
    // ---- Tạo hợp đồng mới ----
    if (!d.tenChuRung || !laCCCDHopLe_(d.cccdChuRung) || !d.ngayKy) {
      return { thanhCong: false, loi: 'Thiếu Họ tên chủ rừng / CCCD hợp lệ / Ngày ký hợp đồng.' };
    }
    const lock = LockService.getScriptLock();
    try {
      lock.waitLock(15000);
    } catch (e) {
      return { thanhCong: false, loi: 'Hệ thống đang bận, vui lòng thử lại sau vài giây.' };
    }
    try {
      const ngayKyDate = new Date(d.ngayKy);
      soHD = d.soHD || soHopDongTuDong(ngayKyDate);
      idHD = soHD + '-' + formatNgay_(ngayKyDate);

      const row = [];
      row[NCC_COL.TIMESTAMP] = new Date();
      row[NCC_COL.EMAIL] = Session.getActiveUser().getEmail();
      row[NCC_COL.SO_HD] = soHD;
      row[NCC_COL.NGAY_KY] = ngayKyDate;
      row[NCC_COL.TEN_CHU_RUNG] = d.tenChuRung;
      row[NCC_COL.DIA_CHI_TT] = d.diaChiThuongTru || '';
      row[NCC_COL.CCCD_CHU_RUNG] = d.cccdChuRung;
      row[NCC_COL.NGAY_CAP] = d.ngayCap || '';
      row[NCC_COL.NOI_CAP] = d.noiCap || '';
      row[NCC_COL.SDT_CHU_RUNG] = d.sdtChuRung || '';
      row[NCC_COL.TEN_UY_QUYEN] = d.tenUyQuyen || '';
      row[NCC_COL.CCCD_UY_QUYEN] = d.cccdUyQuyen || '';
      row[NCC_COL.NOI_CAP_UQ] = d.noiCapUyQuyen || '';
      row[NCC_COL.DIA_CHI_UQ] = d.diaChiUyQuyen || '';
      row[NCC_COL.SDT_UQ] = d.sdtUyQuyen || '';
      row[NCC_COL.NGAY_CAP_UQ] = d.ngayCapUyQuyen || '';
      row[NCC_COL.SO_TK] = d.soTK || '';
      row[NCC_COL.NGAN_HANG] = d.nganHang || '';
      row[NCC_COL.EMAIL_UQ] = d.emailUQ || '';
      row[NCC_COL.DIA_CHI_RUNG] = d.diaChiRung || '';
      row[NCC_COL.DIEN_TICH_KY] = Number(d.dienTichKy) || 0;
      row[NCC_COL.LOCATION] = '';
      row[NCC_COL.HO_SO_NGUON_GOC] = d.hoSoNguonGoc || '';
      row[NCC_COL.SO_GIAY_TO] = d.soGiayTo || '';
      row[NCC_COL.DIEN_TICH_GPS] = '';
      row[NCC_COL.UY_QUYEN_TT] = d.uyQuyenTT || 'Không';
      row[NCC_COL.SL_DU_KIEN] = Number(d.slDuKien) || 0;
      row[NCC_COL.DON_GIA] = Number(d.donGia) || 0;
      row[NCC_COL.NHOM_KH] = d.nhomKH || '';
      row[NCC_COL.MA_SO_THUE] = d.maSoThue || '';
      row[NCC_COL.CHI_NHANH_NH] = d.chiNhanhNH || '';
      row[NCC_COL.ID_HD] = idHD;
      // ⚠️ ĐÃ SỬA: trước đây tự suy ra "Đang thực hiện" nếu ngày ký đã tới/qua — lệch
      // với quy trình chính thức (xem 13_HuongDan.html): mọi hợp đồng LUÔN bắt đầu ở
      // "Chờ thực hiện", chỉ chuyển tiếp khi có người bấm "✅ Duyệt" tay. Đồng bộ với
      // TAO_HOP_DONG_MOI() ở trên — người dùng vẫn có thể ghi đè bằng d.tinhTrang.
      row[NCC_COL.TINH_TRANG] = d.tinhTrang || 'Chờ thực hiện';
      const shTaoMoi = getSheet_(SHEET_NAME.HD_NCC);
      shTaoMoi.appendRow(row);
      soDongVuaTao = shTaoMoi.getLastRow(); // appendRow luôn thêm vào cuối -> đây chính là số dòng thật của hợp đồng vừa tạo
      ghiNhatKy_('Tạo hợp đồng mới', idHD, 'Chủ rừng: ' + d.tenChuRung + ' — Số HĐ: ' + soHD);
    } finally {
      lock.releaseLock();
    }
  } else {
    // ---- Cập nhật hợp đồng đã có ----
    // Dùng soDong (số dòng thật) nếu client đã có sẵn (luôn có, vì lấy từ layDanhSachHopDong/
    // layHopDongTheoSoDong) — đọc TRỰC TIẾP theo dòng, KHÔNG tìm kiếm theo chuỗi nữa.
    // Chỉ rơi về tìm theo idHD nếu vì lý do gì đó chưa có soDong (tương thích ngược).
    let kqTim;
    if (payload.soDong) {
      kqTim = layHopDongTheoSoDong(payload.soDong);
    } else {
      kqTim = timHopDongTheoId(idHD);
    }
    if (!kqTim || kqTim.khongTimThay) return { thanhCong: false, loi: 'Không tìm thấy hợp đồng: ' + idHD + (kqTim && kqTim.chanDoan ? ' — ' + kqTim.chanDoan : '') };
    if (kqTim.tinhTrang === 'Đã thanh lý' && !payload.boQuaKhoaThanhLy) {
      return { thanhCong: false, loi: 'Hợp đồng đã THANH LÝ — chỉ được xem, không thể sửa/thêm rừng/tài khoản.' };
    }
    idHD = kqTim.idHD; // đảm bảo dùng đúng idHD thật đọc từ sheet (không phải giá trị client gửi lên có thể lệch)
    soHD = kqTim.soHD;
    soDongVuaTao = kqTim.soDong;

    // Nếu hợp đồng ĐANG THỰC HIỆN: khối lượng/đơn giá/giá trị Ở CẤP HỢP ĐỒNG giữ nguyên
    // (đã chốt lúc ký), thêm rừng mới chỉ là bổ sung — không tính lại số liệu cấp hợp đồng.
    // Các trạng thái khác (Chờ thực hiện...) thì vẫn cho phép client tự tính lại tổng hợp
    // từ danh sách rừng và ghi đè bình thường (client đã tự làm việc này trước khi gửi lên).
    const dCapNhat = Object.assign({}, d);
    if (kqTim.tinhTrang === 'Đang thực hiện') {
      delete dCapNhat.slDuKien;
      delete dCapNhat.donGia;
    }
    CAP_NHAT_HOP_DONG(kqTim.soDong, dCapNhat);
    ghiNhatKy_('Sửa hợp đồng', idHD, 'Cập nhật thông tin hợp đồng ' + soHD);
  }

  // Đồng bộ DM_DIACHI
  dongBoDiaChiTuRung_(idHD, {
    tenChuRung: d.tenChuRung, diaChiThuongTru: d.diaChiThuongTru,
    diaChiRung: d.diaChiRung, nganHang: d.nganHang
  });

  // ---- Xử lý danh sách lô rừng: thêm mới / cập nhật / xóa ----
  const ketQuaRung = [];
  let soRungThem = 0, soRungXoa = 0, soRungSua = 0;
  (payload.rung || []).forEach(function (r) {
    if (r.idRung && r.xoa) {
      ketQuaRung.push(XOA_LO_RUNG(r.idRung)); soRungXoa++;
    } else if (r.idRung) {
      ketQuaRung.push(CAP_NHAT_LO_RUNG(r.idRung, r)); soRungSua++;
    } else if (!r.xoa) {
      const dataRung = {};
      Object.keys(r).forEach(function (k) { dataRung[k] = r[k]; });
      dataRung.idHD = idHD; dataRung.soHD = soHD; dataRung.tenChuRung = d.tenChuRung;
      dataRung.cccd = d.cccdChuRung; dataRung.thuongTru = d.diaChiThuongTru;
      ketQuaRung.push(THEM_LO_RUNG_MOI(dataRung)); soRungThem++;
    }
  });

  // ---- Xử lý danh sách tài khoản: thêm mới / cập nhật / xóa ----
  const ketQuaTK = [];
  let soTKThem = 0, soTKXoa = 0, soTKSua = 0;
  (payload.taiKhoan || []).forEach(function (t) {
    if (t.soDong && t.xoa) {
      ketQuaTK.push(XOA_TAI_KHOAN(t.soDong)); soTKXoa++;
    } else if (t.soDong) {
      ketQuaTK.push(CAP_NHAT_TAI_KHOAN(t.soDong, t)); soTKSua++;
    } else if (!t.xoa) {
      const dataTK = {};
      Object.keys(t).forEach(function (k) { dataTK[k] = t[k]; });
      dataTK.idHD = idHD; dataTK.soHD = soHD; dataTK.tenChuRung = d.tenChuRung; dataTK.cccd = d.cccdChuRung;
      ketQuaTK.push(THEM_TAI_KHOAN_MOI(dataTK)); soTKThem++;
    }
  });

  if (soRungThem || soRungXoa || soRungSua || soTKThem || soTKXoa || soTKSua) {
    ghiNhatKy_('Cập nhật rừng/tài khoản', idHD,
      'Rừng: +' + soRungThem + ' / sửa ' + soRungSua + ' / -' + soRungXoa +
      ' — Tài khoản: +' + soTKThem + ' / sửa ' + soTKSua + ' / -' + soTKXoa);
  }

  CAP_NHAT_DRAFT_MOT_HOP_DONG(idHD); // cập nhật Draft NGAY sau khi mọi thứ (hợp đồng + rừng + tài khoản) đã ghi xong
  return { thanhCong: true, idHD: idHD, soHD: soHD, soDong: soDongVuaTao, ketQuaRung: ketQuaRung, ketQuaTK: ketQuaTK };
}
