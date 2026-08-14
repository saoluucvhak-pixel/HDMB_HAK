/**
 * ============================================================
 *  28_BaoTri_DongBo.gs
 *  CÔNG CỤ BẢO TRÌ DỮ LIỆU — rà soát toàn bộ quan hệ mẹ-con giữa 5 bảng:
 *
 *    HD_NCC (mẹ) ─┬─ HD_RUNG (con 1) ─┬─ HD_GPS (cháu)
 *                 │                   └─ HD_Picture (cháu)
 *                 └─ HD_STK (con 2)
 *
 *  1. CHAN_DOAN_MO_COI_TOAN_HE_THONG() — tìm ID/Key MỒ CÔI (con trỏ về mẹ
 *     không tồn tại) và ID/Key BỊ SÓT (dòng thiếu chính ID định danh của nó).
 *  2. DONG_BO_THONG_TIN_MO_RONG() — đồng bộ lại các trường LẶP LẠI (tên chủ
 *     rừng ở HD_GPS/HD_STK...) theo đúng dữ liệu mới nhất từ HD_NCC/HD_RUNG,
 *     và điền "Địa chỉ" cho các điểm HD_GPS đang trống (lấy theo Địa chỉ rừng
 *     của chính lô đó — không có API định vị ngược nên dùng địa chỉ rừng làm
 *     giá trị hợp lý gần đúng nhất hiện có).
 *  3. Gợi ý luôn chạy lại GHI_TOA_DO_TU_DIA_CHI_RUNG_VAO_GPS() (đã có sẵn ở
 *     25_TrichXuatToaDoTuDiaChi.gs) — bắt các lô rừng vẫn còn ghi tọa độ dạng
 *     chữ trong "Địa chỉ rừng" mà chưa từng chuyển vào HD_GPS.
 * ============================================================
 */

/** ============ 1. CHẨN ĐOÁN MỒ CÔI / SÓT ID TOÀN HỆ THỐNG ============ */
function CHAN_DOAN_MO_COI_TOAN_HE_THONG() {
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
    picture_moCoi: [] // HD_Picture không khớp cả ID_HD lẫn bất kỳ ID_RUNG nào (theo đúng cơ chế đối chiếu kép đã dùng ở nơi khác)
  };

  nccRows.forEach(function (r, idx) {
    const idHD = (r[NCC_COL.ID_HD] || '').toString().trim();
    if (!idHD) ketQua.ncc_thieuIdHD.push({ dong: idx + 2, tenChuRung: r[NCC_COL.TEN_CHU_RUNG], soHD: r[NCC_COL.SO_HD] });
  });

  rungRows.forEach(function (r, idx) {
    const idKeyHD = (r[RUNG_COL.ID_KEY_HD] || '').toString().trim();
    const idRung = (r[RUNG_COL.ID_RUNG] || '').toString().trim();
    if (!idRung) ketQua.rung_thieuIdRung.push({ dong: idx + 2, maRung: r[RUNG_COL.MA_RUNG], soHD: r[RUNG_COL.SO_HD] });
    if (idKeyHD && !idHDHopLe[idKeyHD]) ketQua.rung_moCoi.push({ dong: idx + 2, maRung: r[RUNG_COL.MA_RUNG], idKeyHDSai: idKeyHD, soHD: r[RUNG_COL.SO_HD] });
  });

  stkRows.forEach(function (r, idx) {
    const idHD = (r[STK_COL.ID_HD] || '').toString().trim();
    if (idHD && !idHDHopLe[idHD]) ketQua.stk_moCoi.push({ dong: idx + 2, soTK: r[STK_COL.SO_TK], idHDSai: idHD, tenChuRung: r[STK_COL.TEN_CHU_RUNG] });
  });

  gpsRows.forEach(function (r, idx) {
    const idKeyGps = (r[GPS_COL.ID_KEY_GPS] || '').toString().trim();
    if (idKeyGps && !idRungHopLe[idKeyGps]) ketQua.gps_moCoi.push({ dong: idx + 2, idGps: r[GPS_COL.ID_GPS], idRungSai: idKeyGps, tenChuRung: r[GPS_COL.TEN_CHU_RUNG] });
  });

  pictureRows.forEach(function (r, idx) {
    const idHD = (r[PICTURE_COL.ID_HD] || '').toString().trim();
    // ⚠️ HD_Picture có quirk lịch sử: cột ID_HD đôi khi lưu ID_RUNG thay vì ID_HD thật —
    // đối chiếu kép (giống layAnhCuaHopDong/layCoAnhVaGpsTrucTiep_ đã dùng), chỉ coi là
    // mồ côi nếu KHÔNG khớp được với CẢ 2 khả năng.
    if (idHD && !idHDHopLe[idHD] && !idRungHopLe[idHD]) ketQua.picture_moCoi.push({ dong: idx + 2, idPicture: r[PICTURE_COL.ID_PICTURE], idSai: idHD, tenChuRung: r[PICTURE_COL.TEN_CHU_RUNG] });
  });

  const tongSoVanDe = ketQua.ncc_thieuIdHD.length + ketQua.rung_moCoi.length + ketQua.rung_thieuIdRung.length + ketQua.stk_moCoi.length + ketQua.gps_moCoi.length + ketQua.picture_moCoi.length;
  return Object.assign({ tongSoVanDe: tongSoVanDe }, ketQua);
}

/** Chạy từ menu Sheets — hiện popup tóm tắt */
function CHAN_DOAN_MO_COI_TOAN_HE_THONG_TU_MENU() {
  const kq = CHAN_DOAN_MO_COI_TOAN_HE_THONG();
  if (kq.tongSoVanDe === 0) { SpreadsheetApp.getUi().alert('✅ Không phát hiện ID/Key mồ côi hay bị sót nào trong toàn bộ hệ thống.'); return; }
  let tb = '⚠️ Phát hiện ' + kq.tongSoVanDe + ' vấn đề:\n\n';
  tb += 'HD_NCC thiếu ID_HD: ' + kq.ncc_thieuIdHD.length + ' dòng\n';
  tb += 'HD_RUNG mồ côi (trỏ hợp đồng không tồn tại): ' + kq.rung_moCoi.length + ' dòng\n';
  tb += 'HD_RUNG thiếu ID_RUNG: ' + kq.rung_thieuIdRung.length + ' dòng\n';
  tb += 'HD_STK mồ côi: ' + kq.stk_moCoi.length + ' dòng\n';
  tb += 'HD_GPS mồ côi: ' + kq.gps_moCoi.length + ' dòng\n';
  tb += 'HD_Picture mồ côi: ' + kq.picture_moCoi.length + ' dòng\n\n';
  tb += 'Xem chi tiết từng dòng trong Log (Executions) hoặc trang Thiết lập trên webapp.';
  Logger.log(JSON.stringify(kq, null, 2));
  SpreadsheetApp.getUi().alert(tb);
}

/** ============ 2. ĐỒNG BỘ THÔNG TIN LẶP LẠI + ĐIỀN ĐỊA CHỈ GPS CÒN TRỐNG ============ */
function DONG_BO_THONG_TIN_MO_RONG() {
  const nccRows = readData_(SHEET_NAME.HD_NCC);
  const rungRows = readData_(SHEET_NAME.HD_RUNG);

  const nccTheoIdHD = {};
  nccRows.forEach(function (r) { const id = (r[NCC_COL.ID_HD] || '').toString().trim(); if (id) nccTheoIdHD[id] = r; });
  const rungTheoIdRung = {};
  rungRows.forEach(function (r) { const id = (r[RUNG_COL.ID_RUNG] || '').toString().trim(); if (id) rungTheoIdRung[id] = r; });

  let soDaSuaGps = 0, soDaDienDiaChiGps = 0, soDaSuaStk = 0;

  // ---- HD_GPS: đồng bộ lại Tên chủ rừng, điền Địa chỉ còn trống theo Địa chỉ rừng ----
  const shGps = getSheet_(SHEET_NAME.HD_GPS);
  const gpsRows = readData_(SHEET_NAME.HD_GPS);
  gpsRows.forEach(function (r, idx) {
    const idRung = (r[GPS_COL.ID_KEY_GPS] || '').toString().trim();
    const rung = rungTheoIdRung[idRung];
    if (!rung) return; // mồ côi thật -> không đồng bộ được, để CHAN_DOAN_MO_COI báo riêng
    const dong = idx + 2;
    const tenChuRungDung = rung[RUNG_COL.TEN_CHU_RUNG] || '';
    if ((r[GPS_COL.TEN_CHU_RUNG] || '') !== tenChuRungDung) {
      shGps.getRange(dong, GPS_COL.TEN_CHU_RUNG + 1).setValue(tenChuRungDung);
      soDaSuaGps++;
    }
    if (!(r[GPS_COL.ADDRESS] || '').toString().trim() && rung[RUNG_COL.DIA_CHI_RUNG]) {
      shGps.getRange(dong, GPS_COL.ADDRESS + 1).setValue(rung[RUNG_COL.DIA_CHI_RUNG]);
      soDaDienDiaChiGps++;
    }
  });

  // ---- HD_STK: đồng bộ lại Tên chủ rừng/CCCD/Số HĐ theo đúng hợp đồng cha ----
  const shStk = getSheet_(SHEET_NAME.HD_STK);
  const stkRows = readData_(SHEET_NAME.HD_STK);
  stkRows.forEach(function (r, idx) {
    const idHD = (r[STK_COL.ID_HD] || '').toString().trim();
    const ncc = nccTheoIdHD[idHD];
    if (!ncc) return;
    const dong = idx + 2;
    const giaTriDung = { tenChuRung: ncc[NCC_COL.TEN_CHU_RUNG] || '', cccd: ncc[NCC_COL.CCCD_CHU_RUNG] || '', soHD: ncc[NCC_COL.SO_HD] || '' };
    let coSua = false;
    if ((r[STK_COL.TEN_CHU_RUNG] || '') !== giaTriDung.tenChuRung) { shStk.getRange(dong, STK_COL.TEN_CHU_RUNG + 1).setValue(giaTriDung.tenChuRung); coSua = true; }
    if ((r[STK_COL.CCCD] || '') !== giaTriDung.cccd) { shStk.getRange(dong, STK_COL.CCCD + 1).setValue(giaTriDung.cccd); coSua = true; }
    if ((r[STK_COL.SO_HD] || '') !== giaTriDung.soHD) { shStk.getRange(dong, STK_COL.SO_HD + 1).setValue(giaTriDung.soHD); coSua = true; }
    if (coSua) soDaSuaStk++;
  });

  return {
    thanhCong: true, soDaSuaGps: soDaSuaGps, soDaDienDiaChiGps: soDaDienDiaChiGps, soDaSuaStk: soDaSuaStk,
    thongBao: 'Đã đồng bộ lại tên chủ rừng cho ' + soDaSuaGps + ' điểm GPS, điền Địa chỉ còn trống cho ' + soDaDienDiaChiGps + ' điểm GPS, đồng bộ ' + soDaSuaStk + ' số tài khoản.'
  };
}

/** Chạy từ menu Sheets — hiện popup */
function DONG_BO_THONG_TIN_MO_RONG_TU_MENU() {
  const kq = DONG_BO_THONG_TIN_MO_RONG();
  SpreadsheetApp.getUi().alert('✅ ' + kq.thongBao);
}

/** ============ 3. CHẠY TOÀN BỘ BẢO TRÌ 1 LƯỢT (chẩn đoán + đồng bộ + trích xuất tọa độ còn sót) ============ */
function CHAY_TOAN_BO_BAO_TRI() {
  const chanDoanTruoc = CHAN_DOAN_MO_COI_TOAN_HE_THONG();
  const dongBo = DONG_BO_THONG_TIN_MO_RONG();
  let toaDoDaTrichXuat = { thanhCong: true, soDaGhi: 0, tongSoLo: 0, loi: [] };
  try { toaDoDaTrichXuat = GHI_TOA_DO_TU_DIA_CHI_RUNG_VAO_GPS(); } catch (e) { /* nếu chưa có hàm này (project cũ chưa cập nhật) thì bỏ qua bước này */ }
  // ⚠️ BỔ SUNG: trước đây bảo trì tổng thể thiếu bước chuyển tên file ảnh/hồ sơ
  // pháp lý sang URL thật (nguyên nhân chính khiến "Xem chi tiết" chậm/treo) —
  // giờ chạy luôn trong 1 lượt bảo trì, không cần nhớ chạy riêng.
  let anhDaChuyen = { thanhCong: true, xongHet: true, soDaChuyen: 0 };
  let hoSoDaChuyen = { thanhCong: true, xongHet: true, soDaChuyen: 0 };
  try { anhDaChuyen = CHUYEN_DOI_TEN_FILE_ANH_SANG_URL(); } catch (e) { /* bỏ qua nếu chưa có hàm này */ }
  try { hoSoDaChuyen = CHUYEN_DOI_HO_SO_PHAP_LY_SANG_URL(); } catch (e) { /* bỏ qua nếu chưa có hàm này */ }
  const chanDoanSau = CHAN_DOAN_MO_COI_TOAN_HE_THONG();
  return {
    thanhCong: true,
    soVanDeMoCoiTruoc: chanDoanTruoc.tongSoVanDe, soVanDeMoCoiSau: chanDoanSau.tongSoVanDe,
    dongBo: dongBo, toaDoDaTrichXuat: toaDoDaTrichXuat, anhDaChuyen: anhDaChuyen, hoSoDaChuyen: hoSoDaChuyen,
    chiTietMoCoiConLai: chanDoanSau
  };
}
function CHAY_TOAN_BO_BAO_TRI_TU_MENU() {
  const ui = SpreadsheetApp.getUi();
  const xacNhan = ui.alert('🔧 Chạy toàn bộ bảo trì dữ liệu', 'Sẽ: (1) Chẩn đoán mồ côi, (2) Đồng bộ thông tin lặp lại + điền địa chỉ GPS trống, (3) Trích xuất nốt tọa độ còn ghi dạng chữ trong Địa chỉ rừng, (4) Chuyển tên file ảnh/hồ sơ pháp lý sang URL thật. KHÔNG xóa dữ liệu nào. Tiếp tục?', ui.ButtonSet.OK_CANCEL);
  if (xacNhan !== ui.Button.OK) return;
  const kq = CHAY_TOAN_BO_BAO_TRI();
  ui.alert(
    '✅ Hoàn tất bảo trì.\n\n' +
    'Mồ côi trước: ' + kq.soVanDeMoCoiTruoc + ' → sau: ' + kq.soVanDeMoCoiSau + ' (bảo trì KHÔNG tự sửa mồ côi thật, chỉ đồng bộ dữ liệu — nếu còn mồ côi cần xem tay).\n' +
    kq.dongBo.thongBao + '\n' +
    'Tọa độ trích xuất thêm từ Địa chỉ rừng: ' + kq.toaDoDaTrichXuat.soDaGhi + '/' + kq.toaDoDaTrichXuat.tongSoLo + ' lô.\n' +
    'Ảnh chuyển sang URL: ' + kq.anhDaChuyen.soDaChuyen + (kq.anhDaChuyen.xongHet ? ' (xong hết)' : ' (còn dở dang, chạy lại bảo trì để tiếp tục)') + '.\n' +
    'Hồ sơ pháp lý chuyển sang URL: ' + kq.hoSoDaChuyen.soDaChuyen + (kq.hoSoDaChuyen.xongHet ? ' (xong hết)' : ' (còn dở dang, chạy lại bảo trì để tiếp tục)') + '.'
  );
}
