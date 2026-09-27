/**
 * ============================================================
 *  36_BaoCaoHopDong.gs
 *  BÁO CÁO TÌNH HÌNH THỰC HIỆN HỢP ĐỒNG (PDF) — nút "📊 Báo cáo thực hiện (PDF)"
 *  ở trang Tra cứu hình ảnh (và Tra cứu hợp đồng). Đọc 1 file là hình dung được
 *  việc khai thác và mua bán của hợp đồng:
 *   1. Tổng quan: các bên, tài khoản nhận tiền, tiến độ khối lượng / giá trị
 *      (dự kiến – đã thực hiện – còn lại, % hoàn thành), thời gian cân, phiếu cân.
 *   2. Lịch sử thanh toán (đọc file DNTT_GK_DN_CT).
 *   3. Vùng khai thác: mỗi lô rừng 1 bản đồ vệ tinh Google Maps (ranh giới + điểm
 *      GPS đánh số), bảng tọa độ kèm link Google Maps, ảnh GPS, ảnh hiện trường.
 *   4. Hồ sơ pháp lý: bảng danh mục; file gốc được trình duyệt ghép vào cuối
 *      (giống "Xuất PDF" ảnh — chỉ Nhập liệu / Quản trị).
 *  Vai trò "Chỉ xem": CCCD / SĐT / số TK bị che, không có hồ sơ pháp lý.
 * ============================================================
 */
const BC_TOI_DA_DIEM_BAN_DO = 60;  // điểm GPS tối đa vẽ trên 1 bản đồ (giới hạn độ dài URL bản đồ tĩnh)
const BC_TOI_DA_LO_BAN_DO = 15;    // số lô tối đa được vẽ bản đồ trong 1 báo cáo (hạn mức dịch vụ Maps)

/** Điểm GPS theo lô: { idRung: [{ lat, lng, diaChi, anh }] } (bỏ điểm không đọc được tọa độ). */
function _diemGpsTheoLo_(idRungs) {
  const can = {};
  idRungs.forEach(function (id) { can[id] = []; });
  readData_(SHEET_NAME.HD_GPS).forEach(function (g) {
    const id = (g[GPS_COL.ID_KEY_GPS] || '').toString().trim();
    if (!can[id]) return;
    const dms = g[GPS_COL.HE_TOA_DO] === 'DMS';
    const lat = dms ? convertDmsToDd_(g[GPS_COL.LAT]) : parseFloat(g[GPS_COL.LAT]);
    const lng = dms ? convertDmsToDd_(g[GPS_COL.LNG]) : parseFloat(g[GPS_COL.LNG]);
    if (isNaN(lat) || isNaN(lng)) return;
    can[id].push({ lat: Math.round(lat * 1e6) / 1e6, lng: Math.round(lng * 1e6) / 1e6, diaChi: (g[GPS_COL.ADDRESS] || '').toString(), anh: !!(g[GPS_COL.HINH_ANH] || '').toString().trim() });
  });
  return can;
}

/**
 * Bản đồ vệ tinh Google Maps (dịch vụ Maps có sẵn của Apps Script, không cần API key):
 * ranh giới lô (>= 3 điểm) + điểm đánh số 1..9, A..Z. Trả data URL PNG hoặc '' nếu lỗi / không có điểm.
 */
function _banDoTinh_(diem, khongVung) {
  if (!diem || !diem.length) return '';
  try {
    const ds = diem.slice(0, BC_TOI_DA_DIEM_BAN_DO);
    const m = Maps.newStaticMap().setSize(640, 400).setMapType(Maps.StaticMap.Type.HYBRID).setLanguage('vi');
    if (ds.length === 1) m.setCenter(ds[0].lat, ds[0].lng).setZoom(16);
    if (ds.length >= 3 && !khongVung) {
      m.setPathStyle(3, '0xFFD400', '0xFFD40040').beginPath();
      ds.forEach(function (p) { m.addPoint(p.lat, p.lng); });
      m.addPoint(ds[0].lat, ds[0].lng).endPath();
    }
    const nhan = '123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    ds.forEach(function (p, i) {
      m.setMarkerStyle(Maps.StaticMap.MarkerSize.MID, Maps.StaticMap.Color.RED, i < nhan.length ? nhan.charAt(i) : '');
      m.addMarker(p.lat, p.lng);
    });
    const blob = m.getBlob();
    return 'data:' + (blob.getContentType() || 'image/png') + ';base64,' + Utilities.base64Encode(blob.getBytes());
  } catch (e) {
    log_('WARNING', '_banDoTinh_', 'Không tạo được bản đồ Google Maps', e);
    return '';
  }
}

function _linkGoogleMaps_(lat, lng) { return 'https://www.google.com/maps?q=' + lat + ',' + lng; }

/** Các dòng thanh toán (DNTT_GK_DN_CT) của các Số HĐ. Trả { thanhCong, dong: [...] } — lỗi thì thanhCong=false. */
function _lichSuThanhToan_(soHDs) {
  const can = {};
  soHDs.forEach(function (s) { if (s) can[s.toString().trim()] = true; });
  try {
    const ss = SpreadsheetApp.openByUrl(DNTT_URL);
    const sh = ss.getSheetByName(DNTT_SHEET_NAME) || ss.getSheets()[0];
    const data = sh.getDataRange().getValues();
    if (data.length < 2) return { thanhCong: true, dong: [] };
    const bd = function (s) { return (s || '').toString().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd'); };
    const tim = function (tuKhoa, macDinh) {
      const h = data[0].map(bd);
      const i = h.findIndex(function (v) { return tuKhoa.some(function (t) { return v.indexOf(t) !== -1; }); });
      return i !== -1 ? i : macDinh;
    };
    // Vị trí cột mặc định = vị trí đang dùng ở báo cáo Thanh toán / Draft (đã xác nhận với dữ liệu thật)
    const cSoHD = tim(['so hd', 'so hop dong', 'ma hd'], 19), cKL = tim(['khoi luong'], 12), cTien = tim(['thanh tien', 'so tien', 'gia tri'], 16);
    const cCT = tim(['so ct', 'chung tu', 'so chung tu'], 11), cNhan = tim(['nguoi nhan'], 6), cNgay = tim(['ngay'], -1);
    const dong = [];
    for (let i = 1; i < data.length; i++) {
      const soHD = (data[i][cSoHD] || '').toString().trim();
      if (!can[soHD]) continue;
      dong.push({ soHD: soHD, ngay: cNgay >= 0 ? _ngayHienThi_(data[i][cNgay]) : '', soCT: (data[i][cCT] || '').toString(), nguoiNhan: (data[i][cNhan] || '').toString(),
        khoiLuong: Number(data[i][cKL]) || 0, thanhTien: Number(data[i][cTien]) || 0 });
    }
    return { thanhCong: true, dong: dong };
  } catch (e) {
    return { thanhCong: false, loi: e.message, dong: [] };
  }
}

function _soVN_(v, le) {
  const n = Number(v);
  if (v === '' || v === null || v === undefined || isNaN(n)) return '';
  const p = n.toFixed(le || 0).split('.');
  return p[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.') + (p[1] && Number(p[1]) ? ',' + p[1].replace(/0+$/, '') : '');
}

/**
 * CHỨC NĂNG: báo cáo tình hình thực hiện (PDF) cho 1 hợp đồng, hoặc mọi hợp đồng của khách hàng.
 * maChon / tuyChon: như XUAT_PDF_ANH_ (ảnh đã tick; { kemHoSo, khongAnh }).
 * Trả { thanhCong, base64, tenFile, mimeType, soAnh, soBanDo, hoSoKem: [...], canhBao: [...] }.
 */
function BAO_CAO_HOP_DONG_PDF_(idHD, theoKhachHang, maChon, tuyChon) {
  _yeuCauQuyen_(QUYEN.XEM);
  tuyChon = tuyChon || {};
  const duLieu = _thuThapAnh_(idHD, theoKhachHang);
  if (!duLieu) return { thanhCong: false, loi: 'Không tìm thấy hợp đồng.' };
  const duocXemDu = _coQuyen_(QUYEN.NHAP_LIEU);
  if (tuyChon.kemHoSo && !duocXemDu) return { thanhCong: false, loi: 'Chỉ vai trò Nhập liệu / Quản trị được đưa hồ sơ pháp lý vào báo cáo.' };
  const canhBao = [];
  const tz = layMuiGioBangTinh_();
  const nd = _xacDinhNguoiDung_();
  const e = _escPdf_;
  const cccd = function (v) { return duocXemDu ? (v || '').toString() : _cheCccd_(v); };
  const sdt = function (v) { return duocXemDu ? (v || '').toString() : _cheSdt_(v); };
  const stk = function (v) { return duocXemDu ? (v || '').toString() : _cheStk_(v); };

  // ---- dữ liệu gốc ----
  const idHDs = duLieu.hopDong.map(function (h) { return h.idHD; });
  const nccTheoId = {};
  readData_(SHEET_NAME.HD_NCC).forEach(function (r) { const id = (r[NCC_COL.ID_HD] || '').toString().trim(); if (idHDs.indexOf(id) !== -1) nccTheoId[id] = r; });
  const loTheoHD = {}, idRungs = [];
  readData_(SHEET_NAME.HD_RUNG).forEach(function (r) {
    const idH = (r[RUNG_COL.ID_KEY_HD] || '').toString().trim();
    if (idHDs.indexOf(idH) === -1) return;
    const lo = { idRung: (r[RUNG_COL.ID_RUNG] || '').toString().trim(), maRung: (r[RUNG_COL.MA_RUNG] || '').toString(), diaChiRung: (r[RUNG_COL.DIA_CHI_RUNG] || '').toString(),
      dienTichM2: r[RUNG_COL.DIEN_TICH_M2], dienTichGPS: r[RUNG_COL.DIEN_TICH_GPS], klDuKien: r[RUNG_COL.KHOI_LUONG_DK], klThucHien: r[RUNG_COL.KHOI_LUONG_THUC_HIEN],
      donGia: r[RUNG_COL.DON_GIA], namTrong: (r[RUNG_COL.NAM_TRONG] || '').toString(), hoSoNguonGoc: (r[RUNG_COL.HO_SO_NGUON_GOC] || '').toString(), soGiayTo: (r[RUNG_COL.SO_GIAY_TO] || '').toString() };
    (loTheoHD[idH] = loTheoHD[idH] || []).push(lo);
    if (lo.idRung) idRungs.push(lo.idRung);
  });
  const stkTheoHD = {};
  readData_(SHEET_NAME.HD_STK).forEach(function (r) {
    const idH = (r[STK_COL.ID_HD] || '').toString().trim();
    if (idHDs.indexOf(idH) === -1) return;
    (stkTheoHD[idH] = stkTheoHD[idH] || []).push({ soTK: stk(r[STK_COL.SO_TK]), nganHang: (r[STK_COL.NGAN_HANG] || '').toString(), ten: (r[STK_COL.TEN_UY_QUYEN] || '').toString() });
  });
  const diemTheoLo = _diemGpsTheoLo_(idRungs);
  const thanhToan = _lichSuThanhToan_(duLieu.hopDong.map(function (h) { return h.soHD; }));
  if (!thanhToan.thanhCong) canhBao.push('Không đọc được lịch sử thanh toán (DNTT): ' + thanhToan.loi);

  // ---- ảnh đã chọn (như Xuất PDF ảnh) ----
  const chon = {};
  const khongAnh = !!tuyChon.khongAnh;
  const coChon = khongAnh || (Array.isArray(maChon) && maChon.length > 0);
  if (coChon && !khongAnh) maChon.forEach(function (m) { chon[String(m)] = true; });
  let dem = 0, boQua = 0;
  const ids = [];
  duLieu.hopDong.forEach(function (h) {
    h.nhom.forEach(function (n) {
      n.anh = n.anh.filter(function (a) {
        if (coChon && !chon[a.ma]) return false;
        if (dem >= ANH_TC_TOI_DA_PDF) { boQua++; return false; }
        dem++;
        if (ids.indexOf(a.id) === -1) ids.push(a.id);
        return true;
      });
    });
  });
  if (boQua) canhBao.push('Chỉ đưa ' + dem + ' ảnh đầu tiên (bỏ qua ' + boQua + ' ảnh).');
  const duLieuAnh = {};
  for (let i = 0; i < ids.length; i += 20) Object.assign(duLieuAnh, _taiAnhDrive_(ids.slice(i, i + 20), ANH_TC_CO_PDF));

  // ---- HTML ----
  const kh = duLieu.khachHang;
  let soBanDo = 0, soLoDaVe = 0;
  const hoSoKem = [];
  let html = '<html><head><meta charset="UTF-8"><style>' +
    'body{font-family:Arial,sans-serif;font-size:10.5px;color:#1f2937;margin:0}' +
    'h1{font-size:19px;margin:0 0 2px 0;color:#14532d}h2{font-size:14px;margin:16px 0 6px 0;padding:6px 8px;background:#14532d;color:#fff}' +
    'h3{font-size:12.5px;margin:12px 0 4px 0;color:#14532d;border-bottom:1px solid #86efac;padding-bottom:2px}h4{font-size:11px;margin:8px 0 3px 0;color:#374151}' +
    'h2,h3,h4{page-break-after:avoid}tr,img{page-break-inside:avoid}' +
    'table.tt{border-collapse:collapse;width:100%;margin:4px 0}table.tt td,table.tt th{border:1px solid #d1d5db;padding:4px 6px;text-align:left;font-size:10px;vertical-align:top}table.tt th{background:#f0fdf4;width:22%}' +
    'table.bang{border-collapse:collapse;width:100%;margin:4px 0}table.bang td,table.bang th{border:1px solid #d1d5db;padding:3px 5px;font-size:9.5px;text-align:left}table.bang th{background:#f3f4f6}td.so{text-align:right}' +
    'table.kpi{border-collapse:collapse;width:100%;margin:6px 0}table.kpi td{border:1px solid #d1d5db;padding:6px;text-align:center;width:33%}.kpi-so{font-size:15px;font-weight:bold;color:#14532d}.kpi-nhan{font-size:9px;color:#6b7280}' +
    'table.luoi{width:100%;border-collapse:collapse}table.luoi td{width:50%;vertical-align:top;padding:4px;text-align:center}table.luoi img{width:320px;border:1px solid #d1d5db}' +
    '.cap{font-size:9px;color:#374151;margin-top:2px;text-align:left}.phu{color:#6b7280;font-size:9.5px}.canh{color:#b45309;font-size:9.5px}.bando{width:640px;border:1px solid #9ca3af}a{color:#1d4ed8}' +
    '</style></head><body>';
  html += '<h1>BÁO CÁO TÌNH HÌNH THỰC HIỆN HỢP ĐỒNG MUA BÁN GỖ KEO</h1>' +
    '<div class="phu">Hệ thống HAK — Quản lý hợp đồng gỗ keo · Lập lúc ' + e(Utilities.formatDate(new Date(), tz, 'dd/MM/yyyy HH:mm')) + (nd && nd.email ? ' · Người lập: ' + e(nd.email) : '') +
    ' · ' + (duLieu.theoKhachHang ? 'Mọi hợp đồng của khách hàng ' + e(kh.ten) + ' (' + duLieu.hopDong.length + ' hợp đồng)' : 'Hợp đồng số ' + e(duLieu.hopDong[0].soHD)) + '</div>';

  let stt = 0;
  duLieu.hopDong.forEach(function (h, iHD) {
    const r = nccTheoId[h.idHD] || [];
    const th = _tinhHinhThucHienCuaHD_(h.idHD);
    const dsLo = loTheoHD[h.idHD] || [];
    const dsTT = thanhToan.dong.filter(function (x) { return x.soHD === h.soHD; });
    if (iHD > 0) html += '<div style="page-break-before:always"></div>';
    html += '<h2>Hợp đồng số ' + e(h.soHD) + (h.ngayKy ? ' — ký ngày ' + e(h.ngayKy) : '') + (h.tinhTrang ? ' — ' + e(h.tinhTrang) : '') + '</h2>';

    // 1. Các bên
    html += '<h3>1. Bên bán (chủ rừng) và tài khoản nhận tiền</h3><table class="tt">' +
      '<tr><th>Chủ rừng</th><td>' + e(r[NCC_COL.TEN_CHU_RUNG]) + '</td><th>CCCD</th><td>' + e(cccd(r[NCC_COL.CCCD_CHU_RUNG])) + '</td></tr>' +
      '<tr><th>Địa chỉ thường trú</th><td>' + e(r[NCC_COL.DIA_CHI_TT]) + '</td><th>Điện thoại</th><td>' + e(sdt(r[NCC_COL.SDT_CHU_RUNG])) + '</td></tr>' +
      ((r[NCC_COL.TEN_UY_QUYEN] || '').toString().trim() ? '<tr><th>Người được ủy quyền</th><td>' + e(r[NCC_COL.TEN_UY_QUYEN]) + '</td><th>CCCD ủy quyền</th><td>' + e(cccd(r[NCC_COL.CCCD_UY_QUYEN])) + '</td></tr>' : '') +
      '<tr><th>Tài khoản chính</th><td>' + e(stk(r[NCC_COL.SO_TK])) + (r[NCC_COL.NGAN_HANG] ? ' — ' + e(r[NCC_COL.NGAN_HANG]) : '') + '</td><th>Ủy quyền thanh toán</th><td>' + e(r[NCC_COL.UY_QUYEN_TT]) + '</td></tr>';
    (stkTheoHD[h.idHD] || []).forEach(function (t) { html += '<tr><th>Tài khoản khác</th><td colspan="3">' + e(t.soTK) + (t.nganHang ? ' — ' + e(t.nganHang) : '') + (t.ten ? ' — ' + e(t.ten) : '') + '</td></tr>'; });
    html += '<tr><th>Địa chỉ rừng</th><td colspan="3">' + e(r[NCC_COL.DIA_CHI_RUNG]) + ' · ' + dsLo.length + ' lô rừng' + (Number(r[NCC_COL.DIEN_TICH_KY]) ? ' · diện tích ký ' + e(_soVN_(r[NCC_COL.DIEN_TICH_KY])) + ' m²' : '') + '</td></tr></table>';

    // 2. Tiến độ
    const klDK = Number(th.khoiLuongDuKien || r[NCC_COL.SL_DU_KIEN]) || 0, klTH = Number(th.khoiLuongThucHien) || 0;
    const tyLe = klDK > 0 ? Math.min(100, Math.round(klTH / klDK * 1000) / 10) : 0;
    html += '<h3>2. Tình hình thực hiện (khai thác – mua bán)</h3>';
    if (th.khoiLuongDuKien === undefined) html += '<div class="canh">Chưa có số liệu tổng hợp (Draft báo cáo) cho hợp đồng này — số dưới đây lấy từ hợp đồng.</div>';
    html += '<table class="kpi"><tr>' +
      '<td><div class="kpi-so">' + e(_soVN_(klDK, 2)) + '</div><div class="kpi-nhan">KHỐI LƯỢNG DỰ KIẾN (tấn)</div></td>' +
      '<td><div class="kpi-so">' + e(_soVN_(klTH, 2)) + '</div><div class="kpi-nhan">ĐÃ KHAI THÁC / MUA (tấn)</div></td>' +
      '<td><div class="kpi-so">' + e(_soVN_(th.khoiLuongConLai !== undefined ? th.khoiLuongConLai : klDK - klTH, 2)) + '</div><div class="kpi-nhan">CÒN LẠI (tấn)</div></td></tr>' +
      '<tr><td><div class="kpi-so">' + e(_soVN_(th.giaTriHopDong)) + '</div><div class="kpi-nhan">GIÁ TRỊ HỢP ĐỒNG (đ)</div></td>' +
      '<td><div class="kpi-so">' + e(_soVN_(th.giaTriThucHien)) + '</div><div class="kpi-nhan">GIÁ TRỊ ĐÃ THỰC HIỆN (đ)</div></td>' +
      '<td><div class="kpi-so">' + e(_soVN_(th.giaTriConLai)) + '</div><div class="kpi-nhan">GIÁ TRỊ CÒN LẠI (đ)</div></td></tr></table>' +
      '<table style="width:100%;border-collapse:collapse;margin:4px 0"><tr><td style="width:' + Math.max(tyLe, 0.5) + '%;background:#16a34a;height:12px"></td><td style="background:#e5e7eb"></td></tr></table>' +
      '<div class="phu">Hoàn thành <b>' + e(_soVN_(tyLe, 1)) + '%</b> khối lượng dự kiến' + (th.thucHienTuNgay || th.thucHienDenNgay ? ' · Thời gian khai thác (ngày cân): <b>' + e(th.thucHienTuNgay || '?') + ' → ' + e(th.thucHienDenNgay || '?') + '</b>' : '') +
      (th.capNhatLuc ? ' · Số liệu cập nhật ' + e(th.capNhatLuc) : '') + '</div>';
    if (th.danhSachSoPhieuCan) html += '<div class="phu">Phiếu cân: ' + e(th.danhSachSoPhieuCan) + '</div>';

    // 3. Thanh toán
    html += '<h3>3. Thanh toán cho bên bán</h3>';
    if (!thanhToan.thanhCong) html += '<div class="canh">Không đọc được file DNTT — ' + e(thanhToan.loi) + '</div>';
    else if (!dsTT.length) html += '<div class="phu">Chưa có đề nghị thanh toán nào cho hợp đồng này.</div>';
    else {
      let tongKL = 0, tongTien = 0;
      html += '<table class="bang"><tr><th>#</th>' + (dsTT.some(function (x) { return x.ngay; }) ? '<th>Ngày</th>' : '') + '<th>Số chứng từ</th><th>Người nhận</th><th class="so">Khối lượng (tấn)</th><th class="so">Thành tiền (đ)</th></tr>';
      dsTT.forEach(function (x, i) {
        tongKL += x.khoiLuong; tongTien += x.thanhTien;
        html += '<tr><td>' + (i + 1) + '</td>' + (dsTT.some(function (y) { return y.ngay; }) ? '<td>' + e(x.ngay) + '</td>' : '') + '<td>' + e(x.soCT) + '</td><td>' + e(x.nguoiNhan) + '</td><td class="so">' + e(_soVN_(x.khoiLuong, 2)) + '</td><td class="so">' + e(_soVN_(x.thanhTien)) + '</td></tr>';
      });
      html += '<tr><th colspan="' + (dsTT.some(function (x) { return x.ngay; }) ? 4 : 3) + '">Tổng (' + dsTT.length + ' lần)</th><th class="so">' + e(_soVN_(tongKL, 2)) + '</th><th class="so">' + e(_soVN_(tongTien)) + '</th></tr></table>';
    }

    // 4. Vùng khai thác theo lô
    html += '<h3>4. Vùng khai thác (' + dsLo.length + ' lô rừng)</h3>';
    // Tổng quan: mỗi lô 1 ghim ở tâm các điểm GPS (không nối vùng giữa các lô khác nhau)
    const tamLo = [], chuGiai = [];
    dsLo.forEach(function (lo, i) {
      const ds = diemTheoLo[lo.idRung] || [];
      if (!ds.length || tamLo.length >= 35) return;
      const tam = { lat: 0, lng: 0 };
      ds.forEach(function (p) { tam.lat += p.lat; tam.lng += p.lng; });
      tam.lat = Math.round(tam.lat / ds.length * 1e6) / 1e6; tam.lng = Math.round(tam.lng / ds.length * 1e6) / 1e6;
      tamLo.push(tam);
      chuGiai.push('<b>' + '123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ'.charAt(tamLo.length - 1) + '</b> = Lô ' + (i + 1) + ' (' + e(lo.maRung || lo.idRung) + ')');
    });
    if (tamLo.length > 1 && soLoDaVe < BC_TOI_DA_LO_BAN_DO) {
      const tongQuan = _banDoTinh_(tamLo, true);
      if (tongQuan) { soBanDo++; html += '<h4>Bản đồ tổng quan các lô</h4><img class="bando" src="' + tongQuan + '"><div class="phu">Ghim: ' + chuGiai.join(' · ') + '. Chi tiết ranh giới từng lô ở bên dưới.</div>'; }
    }
    if (!dsLo.length) html += '<div class="phu">Hợp đồng chưa có lô rừng.</div>';
    const soHoacGach = function (v, le) { return Number(v) ? _soVN_(v, le) : '—'; };
    dsLo.forEach(function (lo, iLo) {
      const diem = diemTheoLo[lo.idRung] || [];
      const nhom = h.nhom.filter(function (n) { return n.idRung === lo.idRung; })[0];
      html += '<h4>Lô ' + (iLo + 1) + ' · ' + e(lo.maRung || lo.idRung) + (lo.diaChiRung ? ' — ' + e(lo.diaChiRung) : '') + '</h4>' +
        '<table class="tt"><tr><th>Diện tích ký / đo GPS</th><td>' + (Number(lo.dienTichM2) ? e(_soVN_(lo.dienTichM2)) + ' m² (' + e(_soVN_(lo.dienTichM2 / 10000, 2)) + ' ha)' : '—') + ' / ' + (Number(lo.dienTichGPS) ? e(_soVN_(lo.dienTichGPS)) + ' m²' : 'chưa đo') + '</td><th>Năm trồng</th><td>' + e(lo.namTrong) + '</td></tr>' +
        '<tr><th>Khối lượng dự kiến / đã khai thác</th><td>' + e(soHoacGach(lo.klDuKien, 2)) + ' / ' + e(soHoacGach(lo.klThucHien, 2)) + ' tấn</td><th>Hồ sơ nguồn gốc</th><td>' + e(lo.hoSoNguonGoc) + (lo.soGiayTo ? ' số ' + e(lo.soGiayTo) : '') + '</td></tr></table>';
      if (!diem.length) html += '<div class="canh">Lô chưa có tọa độ GPS.</div>';
      else {
        let banDo = '';
        if (soLoDaVe < BC_TOI_DA_LO_BAN_DO) { banDo = _banDoTinh_(diem); soLoDaVe++; }
        if (banDo) { soBanDo++; html += '<img class="bando" src="' + banDo + '"><div class="phu">Ảnh vệ tinh Google Maps — vùng vàng: ranh giới lô theo các điểm GPS; ghim đỏ: điểm đo (số trên ghim = số thứ tự trong bảng).</div>'; }
        else html += '<div class="canh">Không tạo được bản đồ cho lô này — xem tọa độ và link Google Maps trong bảng.</div>';
        html += '<table class="bang"><tr><th>Điểm</th><th>Vĩ độ, kinh độ</th><th>Địa chỉ</th><th>Google Maps</th></tr>';
        diem.forEach(function (p, i) {
          html += '<tr><td>' + (i < 35 ? '123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ'.charAt(i) : i + 1) + (p.anh ? ' (có ảnh)' : '') + '</td><td>' + e(p.lat + ', ' + p.lng) + '</td><td>' + e(p.diaChi) + '</td><td><a href="' + e(_linkGoogleMaps_(p.lat, p.lng)) + '">Mở bản đồ</a></td></tr>';
        });
        html += '</table>';
      }
      if (nhom && nhom.anh.length) {
        html += '<div class="phu" style="margin-top:4px"><b>Hình ảnh lô ' + (iLo + 1) + ' · ' + e(lo.maRung || lo.idRung) + '</b> (' + nhom.anh.length + ' ảnh — ảnh GPS có tọa độ chụp)</div><table class="luoi">';
        for (let i = 0; i < nhom.anh.length; i += 2) {
          html += '<tr>';
          for (let j = i; j < i + 2; j++) {
            const a = nhom.anh[j];
            if (!a) { html += '<td></td>'; continue; }
            stt++;
            const src = duLieuAnh[a.id];
            const toaDo = (a.lat !== null && a.lat !== undefined && a.lng !== null && a.lng !== undefined);
            html += '<td>' + (src ? '<img src="' + src + '">' : '<div class="phu" style="border:1px dashed #d1d5db;padding:40px 6px">Không tải được ảnh</div>') +
              '<div class="cap"><b>Ảnh ' + stt + '</b> · ' + e(a.loai) + (toaDo ? ' · <a href="' + e(_linkGoogleMaps_(a.lat, a.lng)) + '">GPS ' + e(a.lat + ', ' + a.lng) + '</a>' : '') + (a.diaChi ? '<br>' + e(a.diaChi) : '') + '</div></td>';
          }
          html += '</tr>';
        }
        html += '</table>';
      }
    });
    const chung = h.nhom.filter(function (n) { return !n.idRung && n.anh.length; })[0];
    if (chung) {
      html += '<h4>Ảnh chung của hợp đồng (' + chung.anh.length + ')</h4><table class="luoi">';
      for (let i = 0; i < chung.anh.length; i += 2) {
        html += '<tr>';
        for (let j = i; j < i + 2; j++) {
          const a = chung.anh[j];
          if (!a) { html += '<td></td>'; continue; }
          stt++;
          const src = duLieuAnh[a.id];
          html += '<td>' + (src ? '<img src="' + src + '">' : '<div class="phu" style="border:1px dashed #d1d5db;padding:40px 6px">Không tải được ảnh</div>') + '<div class="cap"><b>Ảnh ' + stt + '</b> · ' + e(a.loai) + '</div></td>';
        }
        html += '</tr>';
      }
      html += '</table>';
    }

    // 5. Hồ sơ pháp lý
    html += '<h3>5. Hồ sơ pháp lý</h3>';
    if (!duocXemDu) html += '<div class="phu">Hồ sơ pháp lý chỉ đưa vào báo cáo khi người lập có vai trò Nhập liệu / Quản trị.</div>';
    else if (!(h.hoSo || []).length) html += '<div class="phu">Chưa có file hồ sơ pháp lý đính kèm cho các lô của hợp đồng này.</div>';
    else {
      html += '<table class="bang"><tr><th>#</th><th>Lô rừng</th><th>Hồ sơ nguồn gốc</th><th>Số giấy tờ</th><th>Ngày</th><th>Trong báo cáo</th></tr>';
      h.hoSo.forEach(function (x) {
        if (tuyChon.kemHoSo) hoSoKem.push(Object.assign({ soHD: h.soHD }, x));
        html += '<tr><td>' + (tuyChon.kemHoSo ? hoSoKem.length : '—') + '</td><td>' + e(x.lo) + '</td><td>' + e(x.hoSoNguonGoc) + '</td><td>' + e(x.soGiayTo) + '</td><td>' + e(x.ngayGiayTo) + '</td><td>' + (tuyChon.kemHoSo ? 'Ghép ở cuối file' : 'Không kèm') + '</td></tr>';
      });
      html += '</table>';
    }
  });
  if (hoSoKem.length) html += '<h2>Phụ lục — Hồ sơ pháp lý đính kèm (' + hoSoKem.length + ' file)</h2><div class="phu">Các trang tiếp theo là bản gốc của từng hồ sơ, theo đúng thứ tự số ở mục 5 của từng hợp đồng.</div>';
  if (canhBao.length) html += '<div class="canh" style="margin-top:10px">' + canhBao.map(e).join('<br>') + '</div>';
  html += '</body></html>';

  const pdf = Utilities.newBlob(html, 'text/html', 'baocao.html').getAs('application/pdf');
  const tenGoc = duLieu.theoKhachHang ? 'BaoCao_KH_' + kh.ten : 'BaoCao_HD_' + (duLieu.hopDong[0] ? duLieu.hopDong[0].soHD : duLieu.idHD);
  const tenFile = boDauTiengViet_(tenGoc).replace(/[^A-Za-z0-9_-]+/g, '_').replace(/_+/g, '_').slice(0, 80) + '.pdf';
  ghiNhatKy_('Xuất báo cáo thực hiện PDF', duLieu.idHD, duLieu.hopDong.length + ' hợp đồng, ' + dem + ' ảnh, ' + soBanDo + ' bản đồ' + (hoSoKem.length ? ', ' + hoSoKem.length + ' hồ sơ' : ''));
  return { thanhCong: true, base64: Utilities.base64Encode(pdf.getBytes()), tenFile: tenFile, mimeType: 'application/pdf', soAnh: dem, boQua: boQua, soBanDo: soBanDo, canhBao: canhBao,
    hoSoKem: hoSoKem.map(function (x) { return { id: x.id, soHD: x.soHD, lo: x.lo, hoSoNguonGoc: x.hoSoNguonGoc, soGiayTo: x.soGiayTo }; }) };
}
