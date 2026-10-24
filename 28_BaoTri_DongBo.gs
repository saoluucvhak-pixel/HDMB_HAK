/**
 * ============================================================
 *  28_BaoTri_DongBo.gs
 *  CÔNG CỤ BẢO TRÌ DỮ LIỆU — rà soát toàn bộ quan hệ mẹ-con giữa 5 bảng:
 *
 *    HD_NCC (mẹ) ─┬─ HD_RUNG (con 1) ─┬─ HD_GPS (cháu)
 *                 │                   └─ HD_Picture (cháu)
 *                 └─ HD_STK (con 2)
 *
 *  1. CHAN_DOAN_MO_COI_TOAN_HE_THONG_() — tìm ID/Key MỒ CÔI (con trỏ về mẹ
 *     không tồn tại) và ID/Key BỊ SÓT (dòng thiếu chính ID định danh của nó).
 *  2. DONG_BO_THONG_TIN_MO_RONG_() — đồng bộ lại các trường LẶP LẠI (tên chủ
 *     rừng ở HD_GPS/HD_STK...) theo đúng dữ liệu mới nhất từ HD_NCC/HD_RUNG,
 *     và điền "Địa chỉ" cho các điểm HD_GPS đang trống (lấy theo Địa chỉ rừng
 *     của chính lô đó — không có API định vị ngược nên dùng địa chỉ rừng làm
 *     giá trị hợp lý gần đúng nhất hiện có).
 *  3. Gợi ý luôn chạy lại GHI_TOA_DO_TU_DIA_CHI_RUNG_VAO_GPS_() (đã có sẵn ở
 *     25_TrichXuatToaDoTuDiaChi.gs) — bắt các lô rừng vẫn còn ghi tọa độ dạng
 *     chữ trong "Địa chỉ rừng" mà chưa từng chuyển vào HD_GPS.
 *  4. XEM_TRUOC_DIEN_SL_TU_LO_RUNG_() / AP_DUNG_DIEN_SL_TU_LO_RUNG_() — điền cột
 *     Z/T/AA của HD_NCC (SL dự kiến / Diện tích / Đơn giá) đang trống/0 từ tổng lô
 *     rừng, có xem trước và xác nhận.
 *  5. TIM_DONG_NGHI_TRUNG_() / XOA_DONG_NGHI_TRUNG_() — tìm dòng HD_NCC / HD_RUNG nghi trùng
 *     và xóa bớt các dòng người dùng chọn.
 *  6. XOA_DONG_MO_COI_() — xóa các dòng mồ côi / thiếu ID đã chọn từ kết quả chẩn đoán (1).
 *     Mọi lần xóa đều chép dòng vào LuuTru_DaXoa trước (khôi phục được ở Thiết lập).
 * ============================================================
 */

/** ============ 1. CHẨN ĐOÁN MỒ CÔI / SÓT ID TOÀN HỆ THỐNG ============ */
function CHAN_DOAN_MO_COI_TOAN_HE_THONG_() {
  // Không kiểm tra quyền ở đây: hàm nội bộ (đuôi _) — trang web chỉ gọi được qua api() (đã kiểm tra quyền),
  // còn trigger / bot Telegram gọi thẳng khi KHÔNG có người đăng nhập -> kiểm tra ở đây sẽ chặn nhầm lượt chạy tự động.
  const nccRows = readData_(SHEET_NAME.HD_NCC);
  const rungRows = readData_(SHEET_NAME.HD_RUNG);
  const stkRows = readData_(SHEET_NAME.HD_STK);
  const gpsRows = readData_(SHEET_NAME.HD_GPS);
  const pictureRows = readData_(SHEET_NAME.HD_PICTURE);

  const idHDHopLe = {}; nccRows.forEach(function (r) { const id = (r[NCC_COL.ID_HD] || '').toString().trim(); if (id) idHDHopLe[id] = true; });
  const idRungHopLe = {}; rungRows.forEach(function (r) { const id = (r[RUNG_COL.ID_RUNG] || '').toString().trim(); if (id) idRungHopLe[id] = true; });

  const ketQua = {
    ncc_thieuIdHD: [], // HD_NCC bị sót chính ID_HD của nó (rất nghiêm trọng — dòng này gần như "vô hình" với mọi bảng con)
    rung_moCoi: [], // HD_RUNG trỏ về ID_HD không tồn tại trong HD_NCC
    rung_thieuIdRung: [], // HD_RUNG bị sót chính ID_RUNG của nó
    stk_moCoi: [], // HD_STK trỏ về ID_HD không tồn tại trong HD_NCC
    gps_moCoi: [], // HD_GPS trỏ về ID_RUNG (cột ID_KEY_GPS) không tồn tại trong HD_RUNG
    picture_moCoi: [], // HD_Picture không khớp cả ID_HD lẫn bất kỳ ID_RUNG nào (theo đúng cơ chế đối chiếu kép đã dùng ở nơi khác)
    o_soLaNgay: _timOSoLaNgay_(nccRows, rungRows) // ô SỐ (diện tích / đơn giá / khối lượng) đang chứa NGÀY -> trước đây bị tính thành mili-giây
  };

  nccRows.forEach(function (r, idx) {
    const idHD = (r[NCC_COL.ID_HD] || '').toString().trim();
    if (!idHD) ketQua.ncc_thieuIdHD.push({ dong: idx + 2, dau: _dauDongBT_(r), tenChuRung: r[NCC_COL.TEN_CHU_RUNG], soHD: r[NCC_COL.SO_HD] });
  });

  rungRows.forEach(function (r, idx) {
    const idKeyHD = (r[RUNG_COL.ID_KEY_HD] || '').toString().trim();
    const idRung = (r[RUNG_COL.ID_RUNG] || '').toString().trim();
    if (!idRung) ketQua.rung_thieuIdRung.push({ dong: idx + 2, dau: _dauDongBT_(r), maRung: r[RUNG_COL.MA_RUNG], soHD: r[RUNG_COL.SO_HD] });
    if (idKeyHD && !idHDHopLe[idKeyHD]) ketQua.rung_moCoi.push({ dong: idx + 2, dau: _dauDongBT_(r), idRung: idRung, maRung: r[RUNG_COL.MA_RUNG], idKeyHDSai: idKeyHD, soHD: r[RUNG_COL.SO_HD] });
  });

  stkRows.forEach(function (r, idx) {
    const idHD = (r[STK_COL.ID_HD] || '').toString().trim();
    if (idHD && !idHDHopLe[idHD]) ketQua.stk_moCoi.push({ dong: idx + 2, dau: _dauDongBT_(r), soTK: r[STK_COL.SO_TK], idHDSai: idHD, tenChuRung: r[STK_COL.TEN_CHU_RUNG] });
  });

  gpsRows.forEach(function (r, idx) {
    const idKeyGps = (r[GPS_COL.ID_KEY_GPS] || '').toString().trim();
    if (idKeyGps && !idRungHopLe[idKeyGps]) ketQua.gps_moCoi.push({ dong: idx + 2, dau: _dauDongBT_(r), idGps: r[GPS_COL.ID_GPS], idRungSai: idKeyGps, tenChuRung: r[GPS_COL.TEN_CHU_RUNG] });
  });

  pictureRows.forEach(function (r, idx) {
    const idHD = (r[PICTURE_COL.ID_HD] || '').toString().trim();
    // ⚠️ HD_Picture có quirk lịch sử: cột ID_HD đôi khi lưu ID_RUNG thay vì ID_HD thật —
    // đối chiếu kép (giống layAnhCuaHopDong_/layCoAnhVaGpsTrucTiep_ đã dùng), chỉ coi là
    // mồ côi nếu KHÔNG khớp được với CẢ 2 khả năng.
    if (idHD && !idHDHopLe[idHD] && !idRungHopLe[idHD]) ketQua.picture_moCoi.push({ dong: idx + 2, dau: _dauDongBT_(r), idPicture: r[PICTURE_COL.ID_PICTURE], idSai: idHD, tenChuRung: r[PICTURE_COL.TEN_CHU_RUNG] });
  });

  const tongSoVanDe = ketQua.ncc_thieuIdHD.length + ketQua.rung_moCoi.length + ketQua.rung_thieuIdRung.length + ketQua.stk_moCoi.length + ketQua.gps_moCoi.length + ketQua.picture_moCoi.length + ketQua.o_soLaNgay.length;
  return Object.assign({ tongSoVanDe: tongSoVanDe }, ketQua);
}

/** Chạy từ menu Sheets — hiện popup tóm tắt */
function CHAN_DOAN_MO_COI_TOAN_HE_THONG_TU_MENU() {
  _yeuCauQuyen_(QUYEN.QUAN_TRI);
  const kq = CHAN_DOAN_MO_COI_TOAN_HE_THONG_();
  if (kq.tongSoVanDe === 0) { SpreadsheetApp.getUi().alert('✅ Không phát hiện ID/Key mồ côi hay bị sót nào trong toàn bộ hệ thống.'); return; }
  let tb = '⚠️ Phát hiện ' + kq.tongSoVanDe + ' vấn đề:\n\n';
  tb += 'HD_NCC thiếu ID_HD: ' + kq.ncc_thieuIdHD.length + ' dòng\n';
  tb += 'HD_RUNG mồ côi (trỏ hợp đồng không tồn tại): ' + kq.rung_moCoi.length + ' dòng\n';
  tb += 'HD_RUNG thiếu ID_RUNG: ' + kq.rung_thieuIdRung.length + ' dòng\n';
  tb += 'HD_STK mồ côi: ' + kq.stk_moCoi.length + ' dòng\n';
  tb += 'HD_GPS mồ côi: ' + kq.gps_moCoi.length + ' dòng\n';
  tb += 'HD_Picture mồ côi: ' + kq.picture_moCoi.length + ' dòng\n';
  tb += 'Ô số (diện tích / đơn giá / khối lượng) đang chứa NGÀY: ' + kq.o_soLaNgay.length + ' ô\n\n';
  tb += 'Xem chi tiết từng dòng trong Log (Executions) hoặc trang Thiết lập trên webapp.';
  Logger.log(JSON.stringify(kq, null, 2));
  SpreadsheetApp.getUi().alert(tb);
}

/** ============ 2. ĐỒNG BỘ THÔNG TIN LẶP LẠI + ĐIỀN ĐỊA CHỈ GPS CÒN TRỐNG ============ */
function DONG_BO_THONG_TIN_MO_RONG_() {
  damBaoTieuDeCotMoRongRung_(); // ⚠️ MỚI: điền tiêu đề 2 cột mở rộng (Khối lượng thực hiện, Năm trồng) nếu còn thiếu — chạy ngay khi bảo trì, không cần đợi thêm lô rừng mới mới tự điền

  // ⚠️ MỚI: định dạng TEXT cho toàn bộ cột định danh HIỆN CÓ trong HD_NCC/HD_STK
  // (CCCD/SĐT/Số TK/MST) — phòng ngừa MẤT SỐ 0 ĐẦU nếu sau này ai đó SỬA TAY
  // trực tiếp trên Sheet. LƯU Ý: KHÔNG cứu lại được số 0 đã bị mất từ trước
  // (dữ liệu đã bị cắt thật sự, không có cách khôi phục) — chỉ ngăn KHÔNG mất
  // THÊM nữa từ nay về sau.
  try {
    const shNCCĐinhDang = getSheet_(SHEET_NAME.HD_NCC);
    const soDongNCC = shNCCĐinhDang.getLastRow();
    if (soDongNCC >= 2) {
      [NCC_COL.CCCD_CHU_RUNG, NCC_COL.SDT_CHU_RUNG, NCC_COL.CCCD_UY_QUYEN, NCC_COL.SDT_UQ, NCC_COL.SO_TK, NCC_COL.MA_SO_THUE]
        .forEach(function (c) { shNCCĐinhDang.getRange(2, c + 1, soDongNCC - 1, 1).setNumberFormat('@'); });
    }
    const shSTKĐinhDang = getSheet_(SHEET_NAME.HD_STK);
    const soDongSTK = shSTKĐinhDang.getLastRow();
    if (soDongSTK >= 2) {
      [STK_COL.SO_TK, STK_COL.CCCD].forEach(function (c) { shSTKĐinhDang.getRange(2, c + 1, soDongSTK - 1, 1).setNumberFormat('@'); });
    }
  } catch (e) { /* không để lỗi định dạng chặn phần đồng bộ chính bên dưới */ }

  const nccRows = readData_(SHEET_NAME.HD_NCC);
  const rungRows = readData_(SHEET_NAME.HD_RUNG);

  const nccTheoIdHD = {};
  nccRows.forEach(function (r) { const id = (r[NCC_COL.ID_HD] || '').toString().trim(); if (id) nccTheoIdHD[id] = r; });
  const rungTheoIdRung = {};
  rungRows.forEach(function (r) { const id = (r[RUNG_COL.ID_RUNG] || '').toString().trim(); if (id) rungTheoIdRung[id] = r; });

  let soDaSuaGps = 0, soDaDienDiaChiGps = 0, soDaSuaStk = 0;

  // ---- HD_GPS: đồng bộ lại Tên chủ rừng, điền Địa chỉ còn trống theo Địa chỉ rừng ----
  // ⚠️ HIỆU NĂNG: trước đây gọi getRange().setValue() RIÊNG cho TỪNG dòng cần sửa —
  // với sheet nhiều nghìn dòng, mỗi lần bảo trì có thể tốn tới hàng nghìn lượt gọi
  // API Sheets riêng lẻ (rất chậm). Giờ đọc/ghi CẢ CỘT 1 lần duy nhất (setValues),
  // bất kể có bao nhiêu dòng cần sửa — chỉ 1 lệnh ghi/cột thay vì 1 lệnh/dòng.
  const shGps = getSheet_(SHEET_NAME.HD_GPS);
  const gpsRows = readData_(SHEET_NAME.HD_GPS);
  let coSuaCotTenGps = false, coSuaCotDiaChiGps = false;
  const cotTenGpsMoi = [], cotDiaChiGpsMoi = [];
  gpsRows.forEach(function (r) {
    const idRung = (r[GPS_COL.ID_KEY_GPS] || '').toString().trim();
    const rung = rungTheoIdRung[idRung];
    if (!rung) { // mồ côi thật -> không đồng bộ được, để CHAN_DOAN_MO_COI báo riêng — giữ nguyên giá trị cũ
      cotTenGpsMoi.push([r[GPS_COL.TEN_CHU_RUNG] || '']);
      cotDiaChiGpsMoi.push([r[GPS_COL.ADDRESS] || '']);
      return;
    }
    const tenChuRungDung = rung[RUNG_COL.TEN_CHU_RUNG] || '';
    if ((r[GPS_COL.TEN_CHU_RUNG] || '') !== tenChuRungDung) { coSuaCotTenGps = true; soDaSuaGps++; }
    cotTenGpsMoi.push([tenChuRungDung]);
    if (!(r[GPS_COL.ADDRESS] || '').toString().trim() && rung[RUNG_COL.DIA_CHI_RUNG]) {
      coSuaCotDiaChiGps = true; soDaDienDiaChiGps++;
      cotDiaChiGpsMoi.push([rung[RUNG_COL.DIA_CHI_RUNG]]);
    } else {
      cotDiaChiGpsMoi.push([r[GPS_COL.ADDRESS] || '']);
    }
  });
  if (coSuaCotTenGps) shGps.getRange(2, GPS_COL.TEN_CHU_RUNG + 1, gpsRows.length, 1).setValues(cotTenGpsMoi);
  if (coSuaCotDiaChiGps) shGps.getRange(2, GPS_COL.ADDRESS + 1, gpsRows.length, 1).setValues(cotDiaChiGpsMoi);

  // ---- HD_STK: đồng bộ lại Tên chủ rừng/CCCD/Số HĐ theo đúng hợp đồng cha ----
  // (cùng cách tối ưu: gộp thành tối đa 3 lệnh ghi/cột thay vì tới 3 lệnh/dòng)
  const shStk = getSheet_(SHEET_NAME.HD_STK);
  const stkRows = readData_(SHEET_NAME.HD_STK);
  let coSuaCotTenStk = false, coSuaCotCccdStk = false, coSuaCotSoHDStk = false;
  const cotTenStkMoi = [], cotCccdStkMoi = [], cotSoHDStkMoi = [];
  stkRows.forEach(function (r) {
    const idHD = (r[STK_COL.ID_HD] || '').toString().trim();
    const ncc = nccTheoIdHD[idHD];
    if (!ncc) { // mồ côi thật -> không đồng bộ được — giữ nguyên giá trị cũ
      cotTenStkMoi.push([r[STK_COL.TEN_CHU_RUNG] || '']);
      cotCccdStkMoi.push([r[STK_COL.CCCD] || '']);
      cotSoHDStkMoi.push([r[STK_COL.SO_HD] || '']);
      return;
    }
    const giaTriDung = { tenChuRung: ncc[NCC_COL.TEN_CHU_RUNG] || '', cccd: ncc[NCC_COL.CCCD_CHU_RUNG] || '', soHD: ncc[NCC_COL.SO_HD] || '' };
    const tenKhac = (r[STK_COL.TEN_CHU_RUNG] || '') !== giaTriDung.tenChuRung;
    const cccdKhac = (r[STK_COL.CCCD] || '') !== giaTriDung.cccd;
    const soHDKhac = (r[STK_COL.SO_HD] || '') !== giaTriDung.soHD;
    if (tenKhac || cccdKhac || soHDKhac) soDaSuaStk++;
    if (tenKhac) coSuaCotTenStk = true;
    if (cccdKhac) coSuaCotCccdStk = true;
    if (soHDKhac) coSuaCotSoHDStk = true;
    cotTenStkMoi.push([giaTriDung.tenChuRung]);
    cotCccdStkMoi.push([giaTriDung.cccd]);
    cotSoHDStkMoi.push([giaTriDung.soHD]);
  });
  if (coSuaCotTenStk) shStk.getRange(2, STK_COL.TEN_CHU_RUNG + 1, stkRows.length, 1).setValues(cotTenStkMoi);
  if (coSuaCotCccdStk) shStk.getRange(2, STK_COL.CCCD + 1, stkRows.length, 1).setValues(cotCccdStkMoi);
  if (coSuaCotSoHDStk) shStk.getRange(2, STK_COL.SO_HD + 1, stkRows.length, 1).setValues(cotSoHDStkMoi);

  if (soDaSuaGps > 0 || soDaDienDiaChiGps > 0) xoaCacheBanDo_(); // dữ liệu HD_GPS vừa đổi -> cache Bản đồ GPS cũ cần xóa (CACHE-001)

  return {
    thanhCong: true, soDaSuaGps: soDaSuaGps, soDaDienDiaChiGps: soDaDienDiaChiGps, soDaSuaStk: soDaSuaStk,
    thongBao: 'Đã đồng bộ lại tên chủ rừng cho ' + soDaSuaGps + ' điểm GPS, điền Địa chỉ còn trống cho ' + soDaDienDiaChiGps + ' điểm GPS, đồng bộ ' + soDaSuaStk + ' số tài khoản.'
  };
}

/** Chạy từ menu Sheets — hiện popup */
function DONG_BO_THONG_TIN_MO_RONG_TU_MENU() {
  _yeuCauQuyen_(QUYEN.QUAN_TRI);
  const kq = DONG_BO_THONG_TIN_MO_RONG_();
  SpreadsheetApp.getUi().alert('✅ ' + kq.thongBao);
}

/** ============ 3. CHẠY TOÀN BỘ BẢO TRÌ 1 LƯỢT (chẩn đoán + đồng bộ + trích xuất tọa độ còn sót) ============ */
function CHAY_TOAN_BO_BAO_TRI_() {
  _yeuCauQuyen_(QUYEN.QUAN_TRI);
  const chanDoanTruoc = CHAN_DOAN_MO_COI_TOAN_HE_THONG_();
  const dongBo = DONG_BO_THONG_TIN_MO_RONG_();
  let toaDoDaTrichXuat = { thanhCong: true, soDaGhi: 0, tongSoLo: 0, loi: [] };
  try { toaDoDaTrichXuat = GHI_TOA_DO_TU_DIA_CHI_RUNG_VAO_GPS_(); } catch (e) { /* nếu chưa có hàm này (project cũ chưa cập nhật) thì bỏ qua bước này */ }
  // ⚠️ BỔ SUNG: trước đây bảo trì tổng thể thiếu bước chuyển tên file ảnh/hồ sơ
  // pháp lý sang URL thật (nguyên nhân chính khiến "Xem chi tiết" chậm/treo) —
  // giờ chạy luôn trong 1 lượt bảo trì, không cần nhớ chạy riêng.
  let anhDaChuyen = { thanhCong: true, xongHet: true, soDaChuyen: 0 };
  let hoSoDaChuyen = { thanhCong: true, xongHet: true, soDaChuyen: 0 };
  try { anhDaChuyen = CHUYEN_DOI_TEN_FILE_ANH_SANG_URL_(); } catch (e) { /* bỏ qua nếu chưa có hàm này */ }
  try { hoSoDaChuyen = CHUYEN_DOI_HO_SO_PHAP_LY_SANG_URL_(); } catch (e) { /* bỏ qua nếu chưa có hàm này */ }
  const chanDoanSau = CHAN_DOAN_MO_COI_TOAN_HE_THONG_();
  return {
    thanhCong: true,
    soVanDeMoCoiTruoc: chanDoanTruoc.tongSoVanDe, soVanDeMoCoiSau: chanDoanSau.tongSoVanDe,
    dongBo: dongBo, toaDoDaTrichXuat: toaDoDaTrichXuat, anhDaChuyen: anhDaChuyen, hoSoDaChuyen: hoSoDaChuyen,
    chiTietMoCoiConLai: chanDoanSau
  };
}
function CHAY_TOAN_BO_BAO_TRI_TU_MENU() {
  _yeuCauQuyen_(QUYEN.QUAN_TRI);
  const ui = SpreadsheetApp.getUi();
  const xacNhan = ui.alert('🔧 Chạy toàn bộ bảo trì dữ liệu', 'Sẽ: (1) Chẩn đoán mồ côi, (2) Đồng bộ thông tin lặp lại + điền địa chỉ GPS trống, (3) Trích xuất nốt tọa độ còn ghi dạng chữ trong Địa chỉ rừng, (4) Chuyển tên file ảnh/hồ sơ pháp lý sang URL thật. KHÔNG xóa dữ liệu nào. Tiếp tục?', ui.ButtonSet.OK_CANCEL);
  if (xacNhan !== ui.Button.OK) return;
  const kq = CHAY_TOAN_BO_BAO_TRI_();
  ui.alert(
    '✅ Hoàn tất bảo trì.\n\n' +
    'Mồ côi trước: ' + kq.soVanDeMoCoiTruoc + ' → sau: ' + kq.soVanDeMoCoiSau + ' (bảo trì KHÔNG tự sửa mồ côi thật, chỉ đồng bộ dữ liệu — nếu còn mồ côi cần xem tay).\n' +
    kq.dongBo.thongBao + '\n' +
    'Tọa độ trích xuất thêm từ Địa chỉ rừng: ' + kq.toaDoDaTrichXuat.soDaGhi + '/' + kq.toaDoDaTrichXuat.tongSoLo + ' lô.\n' +
    'Ảnh chuyển sang URL: ' + kq.anhDaChuyen.soDaChuyen + (kq.anhDaChuyen.xongHet ? ' (xong hết)' : ' (còn dở dang, chạy lại bảo trì để tiếp tục)') + '.\n' +
    'Hồ sơ pháp lý chuyển sang URL: ' + kq.hoSoDaChuyen.soDaChuyen + (kq.hoSoDaChuyen.xongHet ? ' (xong hết)' : ' (còn dở dang, chạy lại bảo trì để tiếp tục)') + '.'
  );
}

/**
 * ============ 4. ĐIỀN SL DỰ KIẾN / DIỆN TÍCH / ĐƠN GIÁ (HD_NCC cột Z/T/AA) TỪ LÔ RỪNG ============
 * Hợp đồng tạo trên app trước bản sửa 28/09/2026 có cột Z (SL dự kiến) — có thể cả T, AA — bằng 0:
 * màn hình nhập không gửi số cấp hợp đồng, số thật chỉ nằm ở từng lô rừng. App Thanh toán (ĐNTT)
 * và các báo cáo đọc cột Z thấy "không có khối lượng dự kiến".
 * Chỉ ĐIỀN ô đang TRỐNG/0 khi tổng lô rừng > 0 (cùng phép tính với ct_hopdong —
 * tinhTongHopLoRung_), KHÔNG ghi đè số đã có. Xem trước -> người dùng xác nhận -> mới ghi.
 * Chạy lại lần 2 không còn gì để điền.
 */
function _deXuatDienHdNccTuLoRung_() {
  const rungTheoHD = {};
  readData_(SHEET_NAME.HD_RUNG).forEach(function (r) {
    const id = (r[RUNG_COL.ID_KEY_HD] || '').toString().trim();
    if (id) (rungTheoHD[id] = rungTheoHD[id] || []).push(r);
  });
  const ds = [];
  readData_(SHEET_NAME.HD_NCC).forEach(function (r, i) {
    const idHD = (r[NCC_COL.ID_HD] || '').toString().trim();
    if (!idHD || !rungTheoHD[idHD]) return;
    const thayDoi = tinhThayDoiHdNccTuLoRung_(r, tinhTongHopLoRung_(rungTheoHD[idHD]), true);
    if (!thayDoi.length) return;
    ds.push({ soDong: i + 2, idHD: idHD, soHD: (r[NCC_COL.SO_HD] || '').toString(), tenChuRung: (r[NCC_COL.TEN_CHU_RUNG] || '').toString(),
      tinhTrang: (r[NCC_COL.TINH_TRANG] || '').toString(), thayDoi: thayDoi });
  });
  return ds;
}
function _hienThiDeXuatDien_(x) {
  return { idHD: x.idHD, soHD: x.soHD, tenChuRung: x.tenChuRung, tinhTrang: x.tinhTrang,
    thayDoi: x.thayDoi.map(function (t) { return { ten: t.ten, cu: t.cu === '' ? '' : String(t.cu), moi: t.moi }; }) };
}

/** XEM TRƯỚC (không ghi gì): danh sách hợp đồng sẽ được điền + số cũ -> mới. */
function XEM_TRUOC_DIEN_SL_TU_LO_RUNG_() {
  _yeuCauQuyen_(QUYEN.QUAN_TRI);
  const ds = _deXuatDienHdNccTuLoRung_();
  return { thanhCong: true, soHopDong: ds.length, ds: ds.map(_hienThiDeXuatDien_) };
}

/**
 * GHI sau khi người dùng xác nhận bản xem trước. idHDs: danh sách ID_HD đã xem trước — tính
 * lại ngay lúc ghi (dữ liệu có thể vừa đổi), chỉ ghi hợp đồng vẫn còn cần điền và nằm trong
 * danh sách. Kiểm tra lại ID_HD đúng dòng trước khi ghi. Gần hết giờ chạy (4,5 phút) thì
 * dừng, báo số còn lại — chạy lại để làm tiếp.
 */
function AP_DUNG_DIEN_SL_TU_LO_RUNG_(idHDs) {
  _yeuCauQuyen_(QUYEN.QUAN_TRI);
  if (!Array.isArray(idHDs) || !idHDs.length) return { thanhCong: false, loi: 'Chưa có hợp đồng nào được xác nhận — bấm "Xem trước" trước.' };
  const chon = {};
  idHDs.forEach(function (id) { chon[String(id).trim()] = true; });
  const sh = getSheet_(SHEET_NAME.HD_NCC);
  const batDau = Date.now();
  const daSua = [];
  let conLai = 0, boQua = 0;
  _deXuatDienHdNccTuLoRung_().forEach(function (x) {
    if (!chon[x.idHD]) return;
    if (Date.now() - batDau > 4.5 * 60 * 1000) { conLai++; return; }
    if ((sh.getRange(x.soDong, NCC_COL.ID_HD + 1).getValue() || '').toString().trim() !== x.idHD) { boQua++; return; } // dòng vừa bị dịch -> chạy lại
    ghiThayDoiHdNcc_(sh, x.soDong, x.idHD, x.thayDoi, 'Bảo trì: điền SL dự kiến/Diện tích/Đơn giá từ lô rừng');
    daSua.push(_hienThiDeXuatDien_(x));
  });
  return {
    thanhCong: true, soDaSua: daSua.length, conLai: conLai + boQua, ds: daSua,
    thongBao: 'Đã điền số liệu từ lô rừng cho ' + daSua.length + ' hợp đồng.' +
      (conLai + boQua ? ' Còn ' + (conLai + boQua) + ' hợp đồng chưa ghi — bấm Xem trước rồi ghi lại để làm tiếp.' : '')
  };
}

function DIEN_SL_TU_LO_RUNG_TU_MENU() {
  _yeuCauQuyen_(QUYEN.QUAN_TRI);
  const ui = SpreadsheetApp.getUi();
  const xem = XEM_TRUOC_DIEN_SL_TU_LO_RUNG_();
  if (!xem.soHopDong) { ui.alert('✅ Không có hợp đồng nào cần điền SL dự kiến / Diện tích / Đơn giá từ lô rừng.'); return; }
  const dong = xem.ds.slice(0, 30).map(function (x) {
    return '• HĐ ' + x.soHD + ' — ' + x.tenChuRung + ' (' + x.tinhTrang + '): ' +
      x.thayDoi.map(function (t) { return t.ten + ' ' + (t.cu === '' ? '(trống)' : t.cu) + ' → ' + t.moi; }).join(', ');
  });
  const xacNhan = ui.alert('🔧 Điền SL dự kiến / Diện tích / Đơn giá từ lô rừng — XEM TRƯỚC',
    xem.soHopDong + ' hợp đồng sẽ được điền (chỉ ô đang trống/0, không ghi đè số đã có):\n\n' + dong.join('\n') +
    (xem.soHopDong > 30 ? '\n… và ' + (xem.soHopDong - 30) + ' hợp đồng khác.' : '') + '\n\nGhi vào HD_NCC?', ui.ButtonSet.OK_CANCEL);
  if (xacNhan !== ui.Button.OK) return;
  ui.alert('✅ ' + AP_DUNG_DIEN_SL_TU_LO_RUNG_(xem.ds.map(function (x) { return x.idHD; })).thongBao);
}


/**
 * ============ 5 & 6. XÓA DÒNG NGHI TRÙNG / DÒNG MỒ CÔI (Quản trị, có xem trước) ============
 * Nguyên tắc an toàn:
 *  - Trình duyệt chỉ gửi (bảng, số dòng, dấu vân tay dòng) đã xem. Lúc xóa QUÉT LẠI từ đầu: dòng đã bị sửa/dịch
 *    (dấu khác) hoặc không còn nghi trùng / mồ côi -> BỎ QUA, không xóa nhầm.
 *  - Mọi dòng bị xóa được chép vào LuuTru_DaXoa trước (lỗi lưu trữ -> không xóa), khôi phục được ở Thiết lập.
 *  - Trùng CÙNG ID (2 dòng cùng ID_HD / ID_RUNG): chỉ xóa đúng dòng thừa, dữ liệu con giữ nguyên (vẫn gắn theo ID
 *    ở dòng còn lại); bắt buộc giữ ít nhất 1 dòng mang ID đó.
 *  - Trùng KHÁC ID (cùng Số HĐ / cùng CCCD + ngày ký / cùng lô): xóa cả hợp đồng / cả lô kèm dữ liệu con
 *    (dùng lại XOA_VINH_VIEN_HOP_DONG_ / XOA_LO_RUNG_). Mỗi nhóm phải giữ lại ít nhất 1 dòng.
 */
const GIOI_HAN_GIO_BAO_TRI_MS_ = 4.5 * 60 * 1000;

/** Dấu vân tay 1 dòng (đổi bất kỳ ô nào -> dấu khác). */
function _dauDongBT_(r) {
  const s = JSON.stringify((r || []).map(function (v) { return Object.prototype.toString.call(v) === '[object Date]' ? v.getTime() : v; }));
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36) + '_' + s.length;
}
function _chuanChuBT_(v) { return (v === null || v === undefined ? '' : v).toString().trim().toLowerCase().replace(/\s+/g, ' '); }
function _chuanNgayBT_(v) {
  if (Object.prototype.toString.call(v) === '[object Date]') return isNaN(v.getTime()) ? '' : Utilities.formatDate(v, layMuiGioBangTinh_(), 'yyyy-MM-dd');
  return (v === null || v === undefined ? '' : v).toString().trim();
}

/** Gom các dòng có chung ÍT NHẤT 1 khóa thành nhóm (hợp nhất bắc cầu). khoaCua(r) -> [[khóa, lý do], ...]. */
function _gomNhomTrung_(dsDong, khoaCua) {
  const cha = dsDong.map(function (_, i) { return i; });
  const goc = function (i) { while (cha[i] !== i) { cha[i] = cha[cha[i]]; i = cha[i]; } return i; };
  const theoKhoa = {}, lyDo = {};
  dsDong.forEach(function (d, i) {
    khoaCua(d).forEach(function (k) {
      if (!k[0]) return;
      if (theoKhoa[k[0]] === undefined) { theoKhoa[k[0]] = i; return; }
      const a = goc(theoKhoa[k[0]]), b = goc(i);
      if (a !== b) cha[b] = a;
      lyDo[k[0]] = k[1];
    });
  });
  const nhom = {};
  dsDong.forEach(function (d, i) {
    const lds = khoaCua(d).filter(function (k) { return k[0] && lyDo[k[0]]; }).map(function (k) { return k[1]; });
    if (!lds.length) return;
    const g = goc(i);
    (nhom[g] = nhom[g] || { lyDo: [], dong: [] }).dong.push(d);
    lds.forEach(function (x) { if (nhom[g].lyDo.indexOf(x) === -1) nhom[g].lyDo.push(x); });
  });
  return Object.keys(nhom).map(function (k) { return nhom[k]; }).filter(function (n) { return n.dong.length > 1; });
}

/** Đánh dấu dòng GỢI Ý giữ lại trong mỗi nhóm: nhiều dữ liệu con nhất, bằng nhau thì dòng trên cùng (tạo trước). */
function _goiYGiuLai_(nhom, diemCon) {
  nhom.forEach(function (n, i) {
    n.ma = i + 1;
    let tot = n.dong[0];
    n.dong.forEach(function (d) { if (diemCon(d) > diemCon(tot) || (diemCon(d) === diemCon(tot) && d.dong < tot.dong)) tot = d; });
    n.dong.forEach(function (d) { d.goiYGiu = d === tot; });
    n.dong.sort(function (a, b) { return a.dong - b.dong; });
  });
  return nhom;
}

/** QUẢN TRỊ: tìm dòng HD_NCC / HD_RUNG nghi trùng (chỉ đọc). */
function TIM_DONG_NGHI_TRUNG_() {
  const ncc = readData_(SHEET_NAME.HD_NCC), rung = readData_(SHEET_NAME.HD_RUNG);
  const stk = readData_(SHEET_NAME.HD_STK), gps = readData_(SHEET_NAME.HD_GPS), pic = readData_(SHEET_NAME.HD_PICTURE);
  const dem = function (rows, col) { const o = {}; rows.forEach(function (r) { const k = (r[col] || '').toString().trim(); if (k) o[k] = (o[k] || 0) + 1; }); return o; };
  const loTheoHD = dem(rung, RUNG_COL.ID_KEY_HD), tkTheoHD = dem(stk, STK_COL.ID_HD), gpsTheoKey = dem(gps, GPS_COL.ID_KEY_GPS), anhTheoKey = dem(pic, PICTURE_COL.ID_HD);
  const idRungTheoHD = {};
  rung.forEach(function (r) { const h = (r[RUNG_COL.ID_KEY_HD] || '').toString().trim(), id = (r[RUNG_COL.ID_RUNG] || '').toString().trim(); if (h && id) (idRungTheoHD[h] = idRungTheoHD[h] || []).push(id); });
  const idHDDem = dem(ncc, NCC_COL.ID_HD), idRungDem = dem(rung, RUNG_COL.ID_RUNG);

  const dsHD = ncc.map(function (r, i) {
    const id = (r[NCC_COL.ID_HD] || '').toString().trim();
    const cacLo = idRungTheoHD[id] || [];
    return {
      bang: 'HD_NCC', dong: i + 2, dau: _dauDongBT_(r), idHD: id, soHD: (r[NCC_COL.SO_HD] || '').toString(), tenChuRung: (r[NCC_COL.TEN_CHU_RUNG] || '').toString(),
      cccd: (r[NCC_COL.CCCD_CHU_RUNG] || '').toString().replace(/\D/g, ''), ngayKy: _chuanNgayBT_(r[NCC_COL.NGAY_KY]), tinhTrang: (r[NCC_COL.TINH_TRANG] || '').toString(),
      soLo: id ? (loTheoHD[id] || 0) : 0, soTK: id ? (tkTheoHD[id] || 0) : 0,
      soGps: id ? (gpsTheoKey[id] || 0) + cacLo.reduce(function (s, x) { return s + (gpsTheoKey[x] || 0); }, 0) : 0,
      soAnh: id ? (anhTheoKey[id] || 0) + cacLo.reduce(function (s, x) { return s + (anhTheoKey[x] || 0); }, 0) : 0,
      cheDoXoa: !id || idHDDem[id] > 1 ? 'dong' : 'hopdong' // dòng thiếu ID không có dữ liệu con -> xóa đúng dòng
    };
  });
  const khoaHD = function (d) {
    return [
      [d.idHD ? 'ID|' + d.idHD : '', 'Cùng ID_HD'],
      [d.soHD.trim() ? 'SO|' + _chuanChuBT_(d.soHD) : '', 'Cùng Số HĐ'],
      [d.cccd && d.ngayKy ? 'CC|' + d.cccd + '|' + d.ngayKy : '', 'Cùng CCCD chủ rừng + ngày ký']
    ];
  };
  const diemHD = function (d) { return d.soLo + d.soTK + d.soGps + d.soAnh; };
  const nhomHD = _gomNhomTrung_(dsHD, khoaHD);
  // Gợi ý xóa CHỈ trong cụm trùng chắc chắn (cùng ID_HD / cùng Số HĐ). Dòng chỉ trùng "CCCD + ngày ký" có thể là hợp đồng
  // thật thứ 2 (1 chủ rừng ký 2 HĐ cùng ngày, khác lô) -> canXem: vẫn liệt kê, KHÔNG tự chọn ở "Chọn theo gợi ý".
  nhomHD.forEach(function (n) {
    n.dong.forEach(function (d) { d.goiYGiu = false; d.canXem = true; });
    _goiYGiuLai_(_gomNhomTrung_(n.dong, function (d) { return khoaHD(d).slice(0, 2); }), diemHD)
      .forEach(function (cum) { cum.dong.forEach(function (d) { d.canXem = false; }); });
  });
  nhomHD.forEach(function (n, i) { n.ma = i + 1; n.dong.sort(function (a, b) { return a.dong - b.dong; }); });

  const dsLo = rung.map(function (r, i) {
    const id = (r[RUNG_COL.ID_RUNG] || '').toString().trim();
    return {
      bang: 'HD_RUNG', dong: i + 2, dau: _dauDongBT_(r), idRung: id, maRung: (r[RUNG_COL.MA_RUNG] || '').toString(), idHD: (r[RUNG_COL.ID_KEY_HD] || '').toString().trim(),
      soHD: (r[RUNG_COL.SO_HD] || '').toString(), tenChuRung: (r[RUNG_COL.TEN_CHU_RUNG] || '').toString(), diaChi: (r[RUNG_COL.DIA_CHI_RUNG] || '').toString(),
      dienTich: r[RUNG_COL.DIEN_TICH_M2], soGps: id ? (gpsTheoKey[id] || 0) : 0,
      cheDoXoa: !id || idRungDem[id] > 1 ? 'dong' : 'lo'
    };
  });
  const nhomLo = _goiYGiuLai_(_gomNhomTrung_(dsLo, function (d) {
    const dt = Number(d.dienTich) || 0;
    return [
      [d.idRung ? 'ID|' + d.idRung : '', 'Cùng ID_RUNG'],
      [d.idHD && d.maRung.trim() ? 'MA|' + d.idHD + '|' + _chuanChuBT_(d.maRung) : '', 'Cùng hợp đồng + cùng Mã rừng'],
      [d.idHD && d.diaChi.trim() && dt ? 'ND|' + d.idHD + '|' + _chuanChuBT_(d.diaChi) + '|' + dt : '', 'Cùng hợp đồng + cùng địa chỉ + cùng diện tích']
    ];
  }), function (d) { return d.soGps; });

  return { hopDong: nhomHD, loRung: nhomLo, soNhom: nhomHD.length + nhomLo.length };
}

/** Xóa đúng các dòng đã chọn theo số dòng — đọc lại từng dòng, dấu vân tay khác thì bỏ qua. Gọi khi ĐANG giữ khóa. */
function _xoaDongTheoSoDongBT_(tenSheet, cacDong, luuTru, boQua) {
  if (!cacDong.length) return [];
  const sh = getSheet_(tenSheet);
  const soCot = Math.max(sh.getLastColumn(), 1), cuoi = sh.getLastRow();
  const hopLe = [];
  cacDong.slice().sort(function (a, b) { return b.dong - a.dong; }).forEach(function (x) {
    if (x.dong < 2 || x.dong > cuoi) { boQua.push({ bang: tenSheet, dong: x.dong, lyDo: 'Dòng không còn tồn tại' }); return; }
    const r = sh.getRange(x.dong, 1, 1, soCot).getValues()[0];
    if (_dauDongBT_(r) !== x.dau) { boQua.push({ bang: tenSheet, dong: x.dong, lyDo: 'Dòng đã thay đổi sau khi xem — quét lại' }); return; }
    hopLe.push({ dong: x.dong, giaTri: r });
  });
  if (!hopLe.length) return [];
  luuTruDongBiXoa_(luuTru.maDot, luuTru.hanhDong, sh, hopLe.map(function (x) { return x.giaTri; }), luuTru.idHD); // lỗi -> ném, không xóa
  hopLe.forEach(function (x) { sh.deleteRow(x.dong); }); // đã sắp từ dưới lên
  return hopLe.map(function (x) { return x.giaTri; });
}

/** QUẢN TRỊ: xóa các dòng nghi trùng đã chọn. ds = [{ bang: 'HD_NCC'|'HD_RUNG', dong, dau }]. */
function XOA_DONG_NGHI_TRUNG_(ds) {
  _yeuCauQuyen_(QUYEN.QUAN_TRI);
  ds = Array.isArray(ds) ? ds.slice(0, 500) : [];
  if (!ds.length) return { thanhCong: false, loi: 'Chưa chọn dòng nào.' };
  const batDau = Date.now();
  const kq = TIM_DONG_NGHI_TRUNG_();
  const hienTai = {}; // bang|dong -> { d, nhom }
  kq.hopDong.concat(kq.loRung).forEach(function (n) { n.dong.forEach(function (d) { hienTai[d.bang + '|' + d.dong] = { d: d, nhom: n }; }); });
  const boQua = [], chon = [];
  ds.forEach(function (x) {
    const k = hienTai[x.bang + '|' + Number(x.dong)];
    if (!k) { boQua.push({ bang: x.bang, dong: x.dong, lyDo: 'Không còn nằm trong nhóm nghi trùng — quét lại' }); return; }
    if (k.d.dau !== x.dau) { boQua.push({ bang: x.bang, dong: x.dong, lyDo: 'Dòng đã thay đổi sau khi xem — quét lại' }); return; }
    chon.push(k);
  });
  // Mỗi nhóm phải còn ít nhất 1 dòng; trùng cùng ID phải còn ít nhất 1 dòng mang ID đó (dữ liệu con đang gắn theo ID).
  const daChon = {}; chon.forEach(function (k) { daChon[k.d.bang + '|' + k.d.dong] = true; });
  const conLaiSau = function (k, loc) { return k.nhom.dong.some(function (d) { return !daChon[d.bang + '|' + d.dong] && loc(d); }); };
  const hopLe = chon.filter(function (k) {
    if (!conLaiSau(k, function () { return true; })) { boQua.push({ bang: k.d.bang, dong: k.d.dong, lyDo: 'Không được xóa hết cả nhóm ' + k.nhom.ma + ' — phải giữ lại ít nhất 1 dòng' }); return false; }
    const id = k.d.bang === 'HD_NCC' ? k.d.idHD : k.d.idRung;
    if (k.d.cheDoXoa === 'dong' && id) {
      if (!conLaiSau(k, function (d) { return (d.bang === 'HD_NCC' ? d.idHD : d.idRung) === id; })) {
        boQua.push({ bang: k.d.bang, dong: k.d.dong, lyDo: 'Phải giữ lại ít nhất 1 dòng có ID ' + id + ' (dữ liệu con đang gắn theo ID này)' }); return false;
      }
    }
    return true;
  });
  if (!hopLe.length) return { thanhCong: false, loi: 'Không có dòng nào xóa được.', boQua: boQua };

  const maDot = taoMaDotXoa_(), cacDot = [maDot];
  let daXoa = 0, conLai = 0;
  const hdCapNhat = {}, hdTongHop = {};
  // (a) Trùng CÙNG ID: xóa đúng dòng thừa
  const lock = LockService.getScriptLock();
  try { lock.waitLock(15000); } catch (e) { return { thanhCong: false, loi: 'Hệ thống đang bận, vui lòng thử lại sau vài giây.' }; }
  try {
    ['HD_NCC', 'HD_RUNG'].forEach(function (bang) {
      const cacDong = hopLe.filter(function (k) { return k.d.bang === bang && k.d.cheDoXoa === 'dong'; }).map(function (k) { return k.d; });
      if (!cacDong.length) return;
      const ten = bang === 'HD_NCC' ? SHEET_NAME.HD_NCC : SHEET_NAME.HD_RUNG;
      const xoa = _xoaDongTheoSoDongBT_(ten, cacDong, { maDot: maDot, hanhDong: 'Bảo trì: xóa dòng trùng ID ở ' + bang, idHD: '' }, boQua);
      daXoa += xoa.length;
      xoa.forEach(function (r) {
        const idHD = String((bang === 'HD_NCC' ? r[NCC_COL.ID_HD] : r[RUNG_COL.ID_KEY_HD]) || '').trim();
        if (idHD) { hdCapNhat[idHD] = true; if (bang === 'HD_RUNG') hdTongHop[idHD] = true; }
      });
    });
  } finally { lock.releaseLock(); }
  // (b) Lô rừng trùng khác ID: xóa cả lô (kèm GPS) — (c) hợp đồng trùng khác ID: xóa cả hợp đồng (kèm dữ liệu con)
  hopLe.filter(function (k) { return k.d.cheDoXoa !== 'dong'; })
    .sort(function (a, b) { return (a.d.cheDoXoa === 'lo' ? 0 : 1) - (b.d.cheDoXoa === 'lo' ? 0 : 1); })
    .forEach(function (k) {
      if (Date.now() - batDau > GIOI_HAN_GIO_BAO_TRI_MS_) { conLai++; return; }
      const r = k.d.cheDoXoa === 'lo' ? XOA_LO_RUNG_(k.d.idRung) : XOA_VINH_VIEN_HOP_DONG_(k.d.idHD, true);
      if (r && r.thanhCong) daXoa++;
      else boQua.push({ bang: k.d.bang, dong: k.d.dong, lyDo: (r && r.loi) || 'Không xóa được' });
    });
  Object.keys(hdTongHop).forEach(function (id) { try { dongBoTongHopRungVaoHdNcc_(id); } catch (e) { /* hợp đồng có thể đã bị xóa ở (c) */ } });
  // Gom 1 lần (capNhatDraftHangLoat_: > 10 HĐ đọc 5 sheet 1 lần) — trước đây cập nhật từng HĐ, nhiều HĐ dễ quá 6 phút
  try { capNhatDraftHangLoat_(Object.keys(hdCapNhat)); } catch (e) { /* như trên */ }
  xoaCacheBanDo_();
  ghiNhatKy_('Bảo trì: xóa dòng nghi trùng', '', 'Đã xóa ' + daXoa + ' dòng/đối tượng, bỏ qua ' + boQua.length + (conLai ? ', còn ' + conLai + ' (hết giờ — bấm lại)' : '') + ' — dòng trùng cùng ID lưu trữ đợt ' + maDot + '; hợp đồng/lô xóa kèm dữ liệu con có đợt lưu trữ riêng (Thiết lập > Khôi phục).');
  return { thanhCong: true, daXoa: daXoa, boQua: boQua, conLai: conLai, maDot: cacDot };
}

/** Bảng + cột khóa của từng loại vấn đề trong kết quả CHAN_DOAN_MO_COI_TOAN_HE_THONG_. */
const LOAI_MO_COI_BT_ = {
  ncc_thieuIdHD: 'HD_NCC', rung_moCoi: 'HD_RUNG', rung_thieuIdRung: 'HD_RUNG', stk_moCoi: 'HD_STK', gps_moCoi: 'HD_GPS', picture_moCoi: 'HD_PICTURE'
};

/**
 * QUẢN TRỊ: xóa các dòng mồ côi / thiếu ID đã chọn. ds = [{ loai, dong, dau }] (loai = khóa trong kết quả chẩn đoán).
 * Lô rừng mồ côi bị xóa -> xóa luôn điểm GPS / ảnh gắn theo ID_RUNG của lô đó (không còn lô nào mang ID này).
 */
function XOA_DONG_MO_COI_(ds) {
  _yeuCauQuyen_(QUYEN.QUAN_TRI);
  ds = Array.isArray(ds) ? ds.slice(0, 2000) : [];
  if (!ds.length) return { thanhCong: false, loi: 'Chưa chọn dòng nào.' };
  const lock = LockService.getScriptLock();
  try { lock.waitLock(15000); } catch (e) { return { thanhCong: false, loi: 'Hệ thống đang bận, vui lòng thử lại sau vài giây.' }; }
  const boQua = [], maDot = taoMaDotXoa_();
  let daXoa = 0, daXoaKem = 0;
  const idRungDaXoa = [];
  try {
    const kq = CHAN_DOAN_MO_COI_TOAN_HE_THONG_();
    const hienTai = {};
    Object.keys(LOAI_MO_COI_BT_).forEach(function (loai) { (kq[loai] || []).forEach(function (d) { hienTai[loai + '|' + d.dong] = d; }); });
    const theoBang = {};
    ds.forEach(function (x) {
      const bang = LOAI_MO_COI_BT_[x.loai];
      const d = bang && hienTai[x.loai + '|' + Number(x.dong)];
      if (!d) { boQua.push({ bang: bang || x.loai, dong: x.dong, lyDo: 'Không còn là dòng mồ côi — quét lại' }); return; }
      if (d.dau !== x.dau) { boQua.push({ bang: bang, dong: x.dong, lyDo: 'Dòng đã thay đổi sau khi xem — quét lại' }); return; }
      const t = (theoBang[bang] = theoBang[bang] || {});
      if (!t[d.dong]) t[d.dong] = d;
    });
    // Xóa từ bảng con sâu nhất lên (số dòng các bảng độc lập nhau)
    ['HD_GPS', 'HD_PICTURE', 'HD_STK', 'HD_RUNG', 'HD_NCC'].forEach(function (bang) {
      if (!theoBang[bang]) return;
      const cacDong = Object.keys(theoBang[bang]).map(function (k) { return theoBang[bang][k]; });
      const xoa = _xoaDongTheoSoDongBT_(SHEET_NAME[bang], cacDong, { maDot: maDot, hanhDong: 'Bảo trì: xóa dòng mồ côi ở ' + bang, idHD: '' }, boQua);
      daXoa += xoa.length;
      if (bang === 'HD_RUNG') xoa.forEach(function (r) { const id = (r[RUNG_COL.ID_RUNG] || '').toString().trim(); if (id) idRungDaXoa.push(id); });
    });
    // GPS / ảnh gắn theo ID_RUNG của các lô vừa xóa (nếu không còn lô nào khác mang ID đó)
    if (idRungDaXoa.length) {
      const conTon = {};
      readData_(SHEET_NAME.HD_RUNG).forEach(function (r) { conTon[(r[RUNG_COL.ID_RUNG] || '').toString().trim()] = true; });
      const canXoa = idRungDaXoa.filter(function (id) { return !conTon[id]; });
      const lt = { maDot: maDot, hanhDong: 'Bảo trì: xóa GPS/ảnh của lô rừng mồ côi', idHD: '' };
      daXoaKem += _xoaCacDongKhop_(getSheet_(SHEET_NAME.HD_GPS), GPS_COL.ID_KEY_GPS, canXoa, lt);
      daXoaKem += _xoaCacDongKhop_(getSheet_(SHEET_NAME.HD_PICTURE), PICTURE_COL.ID_HD, canXoa, lt);
    }
  } finally { lock.releaseLock(); }
  idRungDaXoa.forEach(function (id) { try { XOA_DRAFT_HOSORUNG_MOT_DONG_(id); } catch (e) { /* cache báo cáo chưa có */ } });
  if (daXoa) xoaCacheBanDo_();
  ghiNhatKy_('Bảo trì: xóa dòng mồ côi', '', 'Đã xóa ' + daXoa + ' dòng' + (daXoaKem ? ' + ' + daXoaKem + ' dòng GPS/ảnh của lô mồ côi' : '') + ', bỏ qua ' + boQua.length + ' — lưu trữ đợt ' + maDot + ' (Thiết lập > Khôi phục).');
  return { thanhCong: daXoa > 0, loi: daXoa ? '' : 'Không có dòng nào xóa được.', daXoa: daXoa, daXoaKem: daXoaKem, boQua: boQua, maDot: maDot };
}


/**
 * ============ 7. Ô SỐ ĐANG CHỨA NGÀY (HD_NCC / HD_RUNG) ============
 * Ô Diện tích / Đơn giá / Khối lượng mà Sheets đang lưu là NGÀY (do app khác ghi, công thức, kéo/dán...) -> trước đây
 * Number(ngày) ra mili-giây (vd KL thực hiện 1.790.735.658.000 tấn). Nay khi tính đã coi là 0 (soTuO_), mục này để
 * TÌM và DỌN các ô đó cho sạch dữ liệu gốc.
 */
const COT_SO_BT_ = {
  HD_NCC: [['DIEN_TICH_KY', 'Diện tích ký'], ['SL_DU_KIEN', 'SL dự kiến'], ['DON_GIA', 'Đơn giá']],
  HD_RUNG: [['DIEN_TICH_M2', 'Diện tích (m²)'], ['DON_GIA', 'Đơn giá'], ['KHOI_LUONG_DK', 'KL dự kiến'], ['DIEN_TICH_GPS', 'Diện tích GPS'], ['KHOI_LUONG_THUC_HIEN', 'KL thực hiện']]
};
function _chuCotBT_(i) { let s = ''; i++; while (i > 0) { const m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = Math.floor((i - 1) / 26); } return s; }
function _laNgayBT_(v) { return Object.prototype.toString.call(v) === '[object Date]'; }

function _timOSoLaNgay_(nccRows, rungRows) {
  const ds = [], tz = layMuiGioBangTinh_();
  const quet = function (bang, rows, map, layId) {
    rows.forEach(function (r, i) {
      COT_SO_BT_[bang].forEach(function (c) {
        const v = r[map[c[0]]];
        if (!_laNgayBT_(v)) return;
        const id = layId(r);
        ds.push({ bang: bang, dong: i + 2, o: _chuCotBT_(map[c[0]]) + (i + 2), tenCot: c[1], giaTri: isNaN(v.getTime()) ? '(ngày lỗi)' : Utilities.formatDate(v, tz, 'dd/MM/yyyy HH:mm:ss'), idHD: id.idHD, idRung: id.idRung || '', soHD: id.soHD });
      });
    });
  };
  quet('HD_NCC', nccRows, NCC_COL, function (r) { return { idHD: (r[NCC_COL.ID_HD] || '').toString().trim(), soHD: (r[NCC_COL.SO_HD] || '').toString() }; });
  quet('HD_RUNG', rungRows, RUNG_COL, function (r) { return { idHD: (r[RUNG_COL.ID_KEY_HD] || '').toString().trim(), idRung: (r[RUNG_COL.ID_RUNG] || '').toString().trim(), soHD: (r[RUNG_COL.SO_HD] || '').toString() }; });
  return ds;
}

/** QUẢN TRỊ: xóa trống các ô số đang chứa NGÀY (ghi nhật ký chi tiết cũ -> mới từng ô), cập nhật lại cache báo cáo. */
function LAM_SACH_O_SO_LA_NGAY_() {
  _yeuCauQuyen_(QUYEN.QUAN_TRI);
  const lock = LockService.getScriptLock();
  try { lock.waitLock(15000); } catch (e) { return { thanhCong: false, loi: 'Hệ thống đang bận, vui lòng thử lại sau vài giây.' }; }
  const hdCapNhat = {}, rungCapNhat = {};
  let soO = 0;
  try {
    [['HD_NCC', NCC_COL, NCC_COL.ID_HD, null], ['HD_RUNG', RUNG_COL, RUNG_COL.ID_KEY_HD, RUNG_COL.ID_RUNG]].forEach(function (b) {
      const sh = getSheet_(SHEET_NAME[b[0]]);
      const cuoi = sh.getLastRow();
      if (cuoi < 2) return;
      const data = sh.getRange(2, 1, cuoi - 1, Math.max(sh.getLastColumn(), 1)).getValues();
      data.forEach(function (r, i) {
        const doi = [];
        COT_SO_BT_[b[0]].forEach(function (c) {
          const col = b[1][c[0]];
          if (!_laNgayBT_(r[col])) return;
          doi.push({ truong: c[1], cu: r[col], moi: '' });
          sh.getRange(i + 2, col + 1).setValue('');
          soO++;
        });
        if (!doi.length) return;
        const idHD = (r[b[2]] || '').toString().trim(), idRung = b[3] === null ? '' : (r[b[3]] || '').toString().trim();
        ghiNhatKyChiTiet_('Bảo trì: xóa ngày sai trong ô số', SHEET_NAME[b[0]], idHD, idRung || idHD, doi);
        if (idHD) hdCapNhat[idHD] = true;
        if (idRung) rungCapNhat[idRung] = true;
      });
    });
  } finally { lock.releaseLock(); }
  try { capNhatDraftHangLoat_(Object.keys(hdCapNhat)); } catch (e) { /* bỏ qua */ } // gom 1 lần, không cập nhật từng HĐ
  Object.keys(rungCapNhat).forEach(function (id) { try { CAP_NHAT_DRAFT_HOSORUNG_MOT_DONG_(id); } catch (e) { /* bỏ qua */ } });
  if (soO) ghiNhatKy_('Bảo trì: xóa ngày sai trong ô số', '', 'Đã xóa trống ' + soO + ' ô, cập nhật lại ' + Object.keys(hdCapNhat).length + ' hợp đồng (xem NhatKy_ChiTiet để biết giá trị cũ).');
  return { thanhCong: true, soO: soO, soHopDong: Object.keys(hdCapNhat).length };
}
