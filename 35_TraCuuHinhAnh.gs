/**
 * ============================================================
 *  35_TraCuuHinhAnh.gs
 *  TRA CỨU HÌNH ẢNH (trang ?page=hinhanh) — vai trò "Chỉ xem" trở lên.
 *  Chọn 1 hợp đồng (hoặc mọi hợp đồng của cùng khách hàng) -> xem ảnh hiện
 *  trường (HD_Picture) + ảnh minh chứng GPS (HD_GPS) theo từng lô rừng, rồi
 *  xuất 1 file PDF trực quan (trang bìa + lưới ảnh có chú thích lô/tọa độ).
 *  - Ảnh tải qua quyền của chủ script (Drive API) -> người xem KHÔNG cần quyền
 *    Drive; máy chủ chỉ trả ảnh thuộc đúng các hợp đồng đang xem (không nhận
 *    ID Drive tùy ý từ trình duyệt).
 *  - PDF tạo trong bộ nhớ và trả về trình duyệt tải xuống, không lưu vào Drive.
 *  - Hồ sơ pháp lý (cột "Đính kèm giấy tờ" của từng lô: GCN QSDĐ, CCCD, ủy quyền...)
 *    chỉ vai trò Nhập liệu / Quản trị xem được. Khi xuất PDF có chọn "Kèm hồ sơ pháp
 *    lý", trình duyệt tải từng file (LAY_FILE_HO_SO) rồi ghép nguyên văn vào cuối
 *    file PDF ảnh (thư viện pdf-lib) -> 1 file duy nhất.
 * ============================================================
 */
const ANH_TC_CO_NHO = 400;        // cạnh dài ảnh thu nhỏ (px)
const ANH_TC_CO_LON = 1200;       // ảnh phóng to trên màn hình
const ANH_TC_CO_PDF = 900;        // ảnh trong PDF (đủ nét khi in A4, file không quá nặng)
const ANH_TC_TOI_DA_PDF = 60;     // số ảnh tối đa trong 1 file PDF
const ANH_TC_TOI_DA_MOI_LUOT = 30; // số ảnh thu nhỏ tối đa mỗi lần gọi
const ANH_TC_TOI_DA_TIM_TEN = 40; // số ô lưu TÊN file (chưa chuyển sang link) được dò trên Drive mỗi lần xem
const MAU_ID_DRIVE = /^[A-Za-z0-9_-]{15,}$/;
const HO_SO_TC_TOI_DA_BYTE = 15 * 1024 * 1024; // 1 file hồ sơ pháp lý tối đa 15 MB khi ghép vào PDF

/** ID file Drive từ link (…/d/ID/…, ?id=ID). Rỗng nếu không phải link Drive. */
function _idDriveTuLink_(v) {
  const s = ((v === null || v === undefined) ? '' : v).toString().trim();
  const m = s.match(/\/d\/([A-Za-z0-9_-]{15,})/) || s.match(/[?&]id=([A-Za-z0-9_-]{15,})/);
  return m ? m[1] : '';
}

/** Hợp đồng gốc + (nếu theoKhachHang) mọi hợp đồng cùng CCCD chủ rừng (không có CCCD thì cùng tên). */
function _hopDongCanLayAnh_(idHD, theoKhachHang) {
  idHD = (idHD || '').toString().trim();
  const ncc = readData_(SHEET_NAME.HD_NCC);
  const goc = ncc.find(function (r) { return (r[NCC_COL.ID_HD] || '').toString().trim() === idHD; });
  if (!goc) return null;
  let ds = [goc];
  if (theoKhachHang) {
    const cccd = _chiLaySo_(goc[NCC_COL.CCCD_CHU_RUNG]);
    const ten = _chuoiSoKhop_(goc[NCC_COL.TEN_CHU_RUNG]);
    ds = ncc.filter(function (r) {
      if (!(r[NCC_COL.ID_HD] || '').toString().trim()) return false;
      return cccd ? _chiLaySo_(r[NCC_COL.CCCD_CHU_RUNG]) === cccd : (!!ten && _chuoiSoKhop_(r[NCC_COL.TEN_CHU_RUNG]) === ten);
    });
    ds.sort(function (a, b) { return (ngayToISO_(b[NCC_COL.NGAY_KY]) || '').localeCompare(ngayToISO_(a[NCC_COL.NGAY_KY]) || ''); });
  }
  return { goc: goc, ds: ds };
}

/**
 * Danh sách ảnh (chưa kèm dữ liệu ảnh) theo hợp đồng -> nhóm (ảnh chung HĐ / từng lô rừng).
 * Mỗi ảnh: { ma, id, url, loai: 'Ảnh hiện trường'|'Ảnh GPS', lat, lng, diaChi } — ma = khóa ổn định để chọn ảnh.
 */
function _thuThapAnh_(idHD, theoKhachHang) {
  const hd = _hopDongCanLayAnh_(idHD, theoKhachHang);
  if (!hd) return null;
  const idHDs = {};
  hd.ds.forEach(function (r) { idHDs[(r[NCC_COL.ID_HD] || '').toString().trim()] = true; });

  const loTheoId = {}, loTheoHD = {};
  readData_(SHEET_NAME.HD_RUNG).forEach(function (r) {
    const idH = (r[RUNG_COL.ID_KEY_HD] || '').toString().trim();
    const idR = (r[RUNG_COL.ID_RUNG] || '').toString().trim();
    if (!idHDs[idH] || !idR) return;
    const lo = { idRung: idR, idHD: idH, maRung: (r[RUNG_COL.MA_RUNG] || '').toString(), diaChiRung: (r[RUNG_COL.DIA_CHI_RUNG] || '').toString(),
      hoSoNguonGoc: (r[RUNG_COL.HO_SO_NGUON_GOC] || '').toString(), soGiayTo: (r[RUNG_COL.SO_GIAY_TO] || '').toString(),
      ngayGiayTo: _ngayHienThi_(r[RUNG_COL.NGAY_GIAY_TO]), dinhKem: r[RUNG_COL.DINH_KEM_GIAY_TO] };
    loTheoId[idR] = lo;
    (loTheoHD[idH] = loTheoHD[idH] || []).push(lo);
  });

  const anhTheoNhom = {}; // khóa: idHD + '|' + (idRung hoặc '')
  let conDoTen = ANH_TC_TOI_DA_TIM_TEN, chuaCoLink = 0;
  const cacheTen = CacheService.getScriptCache();
  const them = function (khoa, anh) { (anhTheoNhom[khoa] = anhTheoNhom[khoa] || []).push(anh); };
  const giaiLink = function (v) {
    const s = ((v === null || v === undefined) ? '' : v).toString().trim();
    if (!s) return null;
    let id = _idDriveTuLink_(s);
    if (!id && !/^https?:/i.test(s)) {
      // Ô còn lưu TÊN file (chưa chạy "Chuyển tên file ảnh sang URL"): dò Drive theo tên, nhớ kết quả 6 giờ
      const ten = s.split('/').pop();
      const khoaTen = 'anhten_' + Utilities.base64EncodeWebSafe(Utilities.newBlob(ten).getBytes()).slice(0, 200);
      const daNho = cacheTen.get(khoaTen);
      if (daNho !== null) id = daNho === '-' ? '' : daNho;
      else if (conDoTen > 0) {
        conDoTen--;
        try { const it = DriveApp.getFilesByName(ten); if (it.hasNext()) id = it.next().getId(); } catch (e) { /* không dò được */ }
        try { cacheTen.put(khoaTen, id || '-', 21600); } catch (e) { /* bỏ qua */ }
      }
    }
    if (!id) { chuaCoLink++; return null; }
    return { id: id, url: 'https://drive.google.com/file/d/' + id + '/view' };
  };

  readData_(SHEET_NAME.HD_PICTURE).forEach(function (p, dong) {
    const dd = (p[PICTURE_COL.ID_HD] || '').toString().trim();
    const lo = loTheoId[dd];
    const idH = lo ? lo.idHD : (idHDs[dd] ? dd : '');
    if (!idH) return;
    for (let c = PICTURE_COL.PICTURE_START; c <= PICTURE_COL.PICTURE_END; c++) {
      const l = giaiLink(p[c]);
      if (l) them(idH + '|' + (lo ? lo.idRung : ''), { ma: 'P' + (dong + 2) + '_' + c, id: l.id, url: l.url, loai: 'Ảnh hiện trường' });
    }
  });
  readData_(SHEET_NAME.HD_GPS).forEach(function (g, dong) {
    const lo = loTheoId[(g[GPS_COL.ID_KEY_GPS] || '').toString().trim()];
    if (!lo || !(g[GPS_COL.HINH_ANH] || '').toString().trim()) return;
    const l = giaiLink(g[GPS_COL.HINH_ANH]);
    if (!l) return;
    const dms = g[GPS_COL.HE_TOA_DO] === 'DMS';
    const lat = dms ? convertDmsToDd_(g[GPS_COL.LAT]) : parseFloat(g[GPS_COL.LAT]);
    const lng = dms ? convertDmsToDd_(g[GPS_COL.LNG]) : parseFloat(g[GPS_COL.LNG]);
    them(lo.idHD + '|' + lo.idRung, { ma: 'G' + (dong + 2), id: l.id, url: l.url, loai: 'Ảnh GPS',
      lat: isNaN(lat) ? null : Math.round(lat * 1e6) / 1e6, lng: isNaN(lng) ? null : Math.round(lng * 1e6) / 1e6,
      diaChi: (g[GPS_COL.ADDRESS] || '').toString() });
  });

  const duocXemDu = _coQuyen_(QUYEN.NHAP_LIEU);
  let tongAnh = 0, tongHoSo = 0, hoSoBiAn = 0;
  const hopDong = hd.ds.map(function (r) {
    const idH = (r[NCC_COL.ID_HD] || '').toString().trim();
    const nhom = [];
    const chung = anhTheoNhom[idH + '|'] || [];
    if (chung.length) nhom.push({ tieuDe: 'Ảnh chung của hợp đồng', idRung: '', anh: chung });
    (loTheoHD[idH] || []).forEach(function (lo) {
      const a = anhTheoNhom[idH + '|' + lo.idRung] || [];
      if (a.length) nhom.push({ tieuDe: 'Lô ' + (lo.maRung || lo.idRung) + (lo.diaChiRung ? ' — ' + lo.diaChiRung : ''), idRung: lo.idRung, anh: a });
    });
    nhom.forEach(function (n) { tongAnh += n.anh.length; });
    // Hồ sơ pháp lý của từng lô (1 file/lô) — chỉ Nhập liệu / Quản trị
    const hoSo = [];
    (loTheoHD[idH] || []).forEach(function (lo) {
      if (!((lo.dinhKem || '').toString().trim())) return;
      if (!duocXemDu) { hoSoBiAn++; return; }
      const l = giaiLink(lo.dinhKem);
      if (!l) return;
      hoSo.push({ ma: 'H' + lo.idRung, id: l.id, url: l.url, loai: 'Hồ sơ pháp lý', lo: 'Lô ' + (lo.maRung || lo.idRung) + (lo.diaChiRung ? ' — ' + lo.diaChiRung : ''),
        hoSoNguonGoc: lo.hoSoNguonGoc, soGiayTo: lo.soGiayTo, ngayGiayTo: lo.ngayGiayTo });
    });
    tongHoSo += hoSo.length;
    return {
      idHD: idH, soHD: (r[NCC_COL.SO_HD] || '').toString(), ngayKy: _ngayHienThi_(r[NCC_COL.NGAY_KY]),
      tinhTrang: (r[NCC_COL.TINH_TRANG] || '').toString(), diaChiRung: (r[NCC_COL.DIA_CHI_RUNG] || '').toString(),
      soLo: (loTheoHD[idH] || []).length, nhom: nhom, hoSo: hoSo
    };
  });
  return {
    idHD: (hd.goc[NCC_COL.ID_HD] || '').toString().trim(),
    theoKhachHang: !!theoKhachHang,
    khachHang: {
      ten: (hd.goc[NCC_COL.TEN_CHU_RUNG] || '').toString(),
      cccd: duocXemDu ? (hd.goc[NCC_COL.CCCD_CHU_RUNG] || '').toString() : _cheCccd_(hd.goc[NCC_COL.CCCD_CHU_RUNG]),
      diaChi: (hd.goc[NCC_COL.DIA_CHI_TT] || '').toString()
    },
    hopDong: hopDong,
    tongAnh: tongAnh,
    tongHoSo: tongHoSo,
    hoSoBiAn: hoSoBiAn,       // số lô có hồ sơ nhưng vai trò hiện tại không được xem
    chuaCoLink: chuaCoLink
  };
}

/** CHỨC NĂNG: danh sách ảnh của hợp đồng (hoặc của khách hàng). */
function LAY_ANH_TRA_CUU_(idHD, theoKhachHang) {
  _yeuCauQuyen_(QUYEN.XEM);
  const kq = _thuThapAnh_(idHD, theoKhachHang);
  return kq || { khongTimThay: true, loi: 'Không tìm thấy hợp đồng ' + idHD + '.' };
}

/**
 * Tải dữ liệu ảnh từ Drive (quyền chủ script): trả { id: 'data:image/...;base64,...' } ('' nếu lỗi).
 * Dùng ảnh thu nhỏ do Drive tạo sẵn (đổi kích thước theo `co`), song song bằng fetchAll;
 * lỗi thì thử DriveApp. Ảnh nhỏ được nhớ 6 giờ trong ScriptCache.
 */
function _taiAnhDrive_(ids, co) {
  const kq = {};
  if (!ids.length) return kq;
  const cache = CacheService.getScriptCache();
  const khoa = function (id) { return 'anhtc_' + co + '_' + id; };
  const dungCache = co <= ANH_TC_CO_NHO;
  if (dungCache) {
    const daCo = cache.getAll(ids.map(khoa));
    ids.forEach(function (id) { if (daCo[khoa(id)]) kq[id] = daCo[khoa(id)]; });
  }
  const thieu = ids.filter(function (id) { return !kq[id]; });
  if (!thieu.length) return kq;
  const auth = { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() };
  let meta = [];
  try {
    meta = UrlFetchApp.fetchAll(thieu.map(function (id) {
      return { url: 'https://www.googleapis.com/drive/v3/files/' + id + '?fields=thumbnailLink,mimeType&supportsAllDrives=true', headers: auth, muteHttpExceptions: true };
    }));
  } catch (e) { log_('WARNING', '_taiAnhDrive_', 'Không đọc được thông tin ảnh từ Drive', e); }
  const canTai = [];
  thieu.forEach(function (id, i) {
    let link = '';
    try {
      if (meta[i] && meta[i].getResponseCode() === 200) link = (JSON.parse(meta[i].getContentText()).thumbnailLink || '').replace(/=s\d+(-[a-z]+)?$/, '') + '=s' + co;
    } catch (e) { /* bỏ qua */ }
    if (link.indexOf('http') === 0) canTai.push({ id: id, url: link });
  });
  let anh = [];
  try {
    anh = UrlFetchApp.fetchAll(canTai.map(function (x) { return { url: x.url, headers: auth, muteHttpExceptions: true }; }));
  } catch (e) { log_('WARNING', '_taiAnhDrive_', 'Không tải được ảnh thu nhỏ', e); }
  canTai.forEach(function (x, i) {
    const r = anh[i];
    if (!r || r.getResponseCode() !== 200) return;
    const loai = String((r.getHeaders() || {})['Content-Type'] || 'image/jpeg').split(';')[0];
    if (loai.indexOf('image/') !== 0) return;
    kq[x.id] = 'data:' + loai + ';base64,' + Utilities.base64Encode(r.getContent());
  });
  // Dự phòng: Drive không tạo được ảnh thu nhỏ (file quá mới, HEIC...) -> DriveApp
  thieu.forEach(function (id) {
    if (kq[id]) return;
    try {
      const f = DriveApp.getFileById(id);
      const mime = f.getMimeType() || '';
      const blob = (co > ANH_TC_CO_NHO && /^image\/(jpeg|png|gif|webp)$/.test(mime) && f.getSize() < 4 * 1024 * 1024) ? f.getBlob() : f.getThumbnail();
      if (blob) kq[id] = 'data:' + (blob.getContentType() || 'image/jpeg') + ';base64,' + Utilities.base64Encode(blob.getBytes());
    } catch (e) { kq[id] = ''; }
  });
  if (dungCache) {
    const luu = {};
    thieu.forEach(function (id) { if (kq[id] && kq[id].length < 95000) luu[khoa(id)] = kq[id]; });
    try { cache.putAll(luu, 21600); } catch (e) { /* cache đầy -> bỏ qua */ }
  }
  return kq;
}

/** Tập ID ảnh được phép xem cho (hợp đồng / khách hàng) này — chặn tải file Drive tùy ý. */
function _idAnhDuocPhep_(duLieu) {
  const s = {};
  duLieu.hopDong.forEach(function (h) {
    h.nhom.forEach(function (n) { n.anh.forEach(function (a) { s[a.id] = true; }); });
    (h.hoSo || []).forEach(function (x) { s[x.id] = true; }); // chỉ có khi vai trò được xem hồ sơ
  });
  return s;
}

/**
 * CHỨC NĂNG: dữ liệu ảnh cho các ảnh `ids` thuộc (idHD, theoKhachHang).
 * lon=true -> ảnh cỡ lớn để phóng to (tối đa 1 ảnh/lần). Trả { anh: {id: dataUrl} }.
 */
function LAY_DU_LIEU_ANH_(idHD, theoKhachHang, ids, lon) {
  _yeuCauQuyen_(QUYEN.XEM);
  const duLieu = _thuThapAnh_(idHD, theoKhachHang);
  if (!duLieu) return { anh: {}, loi: 'Không tìm thấy hợp đồng.' };
  const choPhep = _idAnhDuocPhep_(duLieu);
  const gioiHan = lon ? 1 : ANH_TC_TOI_DA_MOI_LUOT;
  const hopLe = [];
  (Array.isArray(ids) ? ids : []).forEach(function (id) {
    id = String(id || '');
    if (MAU_ID_DRIVE.test(id) && choPhep[id] && hopLe.indexOf(id) === -1 && hopLe.length < gioiHan) hopLe.push(id);
  });
  return { anh: _taiAnhDrive_(hopLe, lon ? ANH_TC_CO_LON : ANH_TC_CO_NHO) };
}

function _escPdf_(s) {
  return ((s === null || s === undefined) ? '' : String(s)).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/**
 * CHỨC NĂNG: xuất PDF ảnh. maChon: danh sách `ma` ảnh người dùng đã tick (rỗng = tất cả).
 * tuyChon: { kemHoSo: true -> thêm bảng danh mục hồ sơ pháp lý + trả danh sách file để
 * trình duyệt ghép vào cuối (chỉ Nhập liệu / Quản trị), khongAnh: true -> không lấy ảnh nào }.
 * Trả { thanhCong, base64, tenFile, mimeType, soAnh, boQua, loiTai, hoSoKem: [{id, ten, lo, ...}] }.
 */
function XUAT_PDF_ANH_(idHD, theoKhachHang, maChon, tuyChon) {
  _yeuCauQuyen_(QUYEN.XEM);
  tuyChon = tuyChon || {};
  const duLieu = _thuThapAnh_(idHD, theoKhachHang);
  if (!duLieu) return { thanhCong: false, loi: 'Không tìm thấy hợp đồng.' };
  if (tuyChon.kemHoSo && !_coQuyen_(QUYEN.NHAP_LIEU)) return { thanhCong: false, loi: 'Chỉ vai trò Nhập liệu / Quản trị được xuất hồ sơ pháp lý.' };
  const hoSoKem = [];
  if (tuyChon.kemHoSo) {
    duLieu.hopDong.forEach(function (h) {
      (h.hoSo || []).forEach(function (x) { hoSoKem.push(Object.assign({ soHD: h.soHD }, x)); });
    });
  }
  const chon = {};
  const khongAnh = !!tuyChon.khongAnh;
  const coChon = khongAnh || (Array.isArray(maChon) && maChon.length > 0);
  if (coChon && !khongAnh) maChon.forEach(function (m) { chon[String(m)] = true; });

  // Giữ đúng thứ tự hiển thị; cắt ở ANH_TC_TOI_DA_PDF ảnh
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
    h.nhom = h.nhom.filter(function (n) { return n.anh.length; });
  });
  if (!dem && !hoSoKem.length) return { thanhCong: false, loi: tuyChon.kemHoSo ? 'Chưa có ảnh nào được chọn và không có hồ sơ pháp lý để xuất.' : 'Chưa có ảnh nào được chọn để xuất.' };

  const duLieuAnh = {};
  for (let i = 0; i < ids.length; i += 20) Object.assign(duLieuAnh, _taiAnhDrive_(ids.slice(i, i + 20), ANH_TC_CO_PDF));

  const kh = duLieu.khachHang;
  const nd = _xacDinhNguoiDung_();
  const tz = layMuiGioBangTinh_();
  // Ngày trong PDF theo "Vùng Định Dạng Báo Cáo Xuất Excel" (webapp vẫn luôn dd/mm/yyyy)
  const mauNgay = mauNgayXuatFile_();
  const ngx = function (v) { return _ngayXuatFile_(v, mauNgay); };
  let loiTai = 0;
  let html = '<html><head><meta charset="UTF-8"><style>' +
    'body{font-family:Arial,sans-serif;font-size:11px;color:#1f2937;margin:0}' +
    'h1{font-size:20px;margin:0 0 4px 0;color:#14532d}h2{font-size:14px;margin:14px 0 4px 0;padding:6px 8px;background:#dcfce7;color:#14532d}' +
    'h3{font-size:12px;margin:10px 0 4px 0;color:#1f2937;border-bottom:1px solid #d1d5db;padding-bottom:2px}' +
    'table.tt{border-collapse:collapse;width:100%;margin:6px 0}table.tt td,table.tt th{border:1px solid #d1d5db;padding:4px 6px;text-align:left;font-size:10.5px}table.tt th{background:#f3f4f6}' +
    'h2,h3{page-break-after:avoid}table.luoi tr{page-break-inside:avoid}' +
    'table.luoi{width:100%;border-collapse:collapse}table.luoi td{width:50%;vertical-align:top;padding:4px;text-align:center}' +
    'table.luoi img{width:320px;border:1px solid #d1d5db}.cap{font-size:9.5px;color:#374151;margin-top:2px;text-align:left}.phu{color:#6b7280;font-size:10px}' +
    '</style></head><body>';
  html += '<h1>HỒ SƠ HÌNH ẢNH ' + (duLieu.theoKhachHang ? 'KHÁCH HÀNG' : 'HỢP ĐỒNG') + '</h1>' +
    '<div class="phu">Hệ thống HAK — Quản lý hợp đồng gỗ keo · Xuất lúc ' + _escPdf_(ngx(Utilities.formatDate(new Date(), tz, 'dd/MM/yyyy HH:mm'))) +
    (nd && nd.email ? ' · Người xuất: ' + _escPdf_(nd.email) : '') + '</div>' +
    '<table class="tt"><tr><th>Khách hàng (chủ rừng)</th><td>' + _escPdf_(kh.ten) + '</td><th>CCCD</th><td>' + _escPdf_(kh.cccd) + '</td></tr>' +
    '<tr><th>Địa chỉ thường trú</th><td colspan="3">' + _escPdf_(kh.diaChi) + '</td></tr></table>' +
    '<table class="tt"><tr><th>Số HĐ</th><th>Ngày ký</th><th>Tình trạng</th><th>Địa chỉ rừng</th><th>Số lô</th><th>Số ảnh</th></tr>';
  duLieu.hopDong.forEach(function (h) {
    let n = 0; h.nhom.forEach(function (x) { n += x.anh.length; });
    html += '<tr><td>' + _escPdf_(h.soHD) + '</td><td>' + _escPdf_(ngx(h.ngayKy)) + '</td><td>' + _escPdf_(h.tinhTrang) + '</td><td>' + _escPdf_(h.diaChiRung) + '</td><td>' + h.soLo + '</td><td>' + n + '</td></tr>';
  });
  html += '</table>';
  if (boQua) html += '<div class="phu">Lưu ý: chỉ đưa ' + dem + ' ảnh đầu tiên vào file (bỏ qua ' + boQua + ' ảnh) — xuất theo từng hợp đồng hoặc bỏ chọn bớt ảnh để có đủ.</div>';

  let stt = 0;
  duLieu.hopDong.forEach(function (h) {
    if (!h.nhom.length) return;
    html += '<h2>Hợp đồng số ' + _escPdf_(h.soHD) + (h.ngayKy ? ' — ký ngày ' + _escPdf_(ngx(h.ngayKy)) : '') + '</h2>';
    h.nhom.forEach(function (n) {
      html += '<h3>' + _escPdf_(n.tieuDe) + ' (' + n.anh.length + ' ảnh)</h3><table class="luoi">';
      for (let i = 0; i < n.anh.length; i += 2) {
        html += '<tr>';
        for (let j = i; j < i + 2; j++) {
          const a = n.anh[j];
          if (!a) { html += '<td></td>'; continue; }
          stt++;
          const src = duLieuAnh[a.id];
          if (!src) loiTai++;
          const toaDo = (a.lat !== null && a.lat !== undefined && a.lng !== null && a.lng !== undefined) ? ' · GPS ' + a.lat + ', ' + a.lng : '';
          html += '<td>' + (src ? '<img src="' + src + '">' : '<div class="phu" style="border:1px dashed #d1d5db;padding:40px 6px">Không tải được ảnh (file bị xóa hoặc không phải ảnh)</div>') +
            '<div class="cap"><b>Ảnh ' + stt + '</b> · ' + _escPdf_(a.loai) + _escPdf_(toaDo) + (a.diaChi ? '<br>' + _escPdf_(a.diaChi) : '') + '</div></td>';
        }
        html += '</tr>';
      }
      html += '</table>';
    });
  });
  if (hoSoKem.length) {
    html += '<h2>Hồ sơ pháp lý đính kèm (' + hoSoKem.length + ' file)</h2>' +
      '<div class="phu">Các file dưới đây được ghép nguyên văn vào cuối tài liệu này, theo đúng thứ tự trong bảng.</div>' +
      '<table class="tt"><tr><th>#</th><th>Số HĐ</th><th>Lô rừng</th><th>Hồ sơ nguồn gốc</th><th>Số giấy tờ</th><th>Ngày</th></tr>';
    hoSoKem.forEach(function (x, i) {
      html += '<tr><td>' + (i + 1) + '</td><td>' + _escPdf_(x.soHD) + '</td><td>' + _escPdf_(x.lo) + '</td><td>' + _escPdf_(x.hoSoNguonGoc) + '</td><td>' + _escPdf_(x.soGiayTo) + '</td><td>' + _escPdf_(ngx(x.ngayGiayTo)) + '</td></tr>';
    });
    html += '</table>';
  }
  html += '</body></html>';

  const pdf = Utilities.newBlob(html, 'text/html', 'anh.html').getAs('application/pdf');
  const tenGoc = duLieu.theoKhachHang ? 'Anh_KH_' + kh.ten : 'Anh_HD_' + (duLieu.hopDong[0] ? duLieu.hopDong[0].soHD : duLieu.idHD);
  const tenFile = boDauTiengViet_(tenGoc).replace(/[^A-Za-z0-9_-]+/g, '_').replace(/_+/g, '_').slice(0, 80) + '.pdf';
  ghiNhatKy_('Xuất PDF ảnh', duLieu.idHD, dem + ' ảnh' + (hoSoKem.length ? ' + ' + hoSoKem.length + ' hồ sơ pháp lý' : '') + (duLieu.theoKhachHang ? ' (mọi hợp đồng của khách hàng)' : ''));
  return { thanhCong: true, base64: Utilities.base64Encode(pdf.getBytes()), tenFile: tenFile, mimeType: 'application/pdf', soAnh: dem, boQua: boQua, loiTai: loiTai,
    hoSoKem: hoSoKem.map(function (x) { return { id: x.id, soHD: x.soHD, lo: x.lo, hoSoNguonGoc: x.hoSoNguonGoc, soGiayTo: x.soGiayTo }; }) };
}

/**
 * CHỨC NĂNG (Nhập liệu / Quản trị): nội dung 1 file hồ sơ pháp lý để ghép vào PDF.
 * Chỉ nhận file là hồ sơ của các lô thuộc (idHD, theoKhachHang). File Google Docs/Sheets
 * được chuyển sang PDF. Trả { thanhCong, base64, mimeType, ten } hoặc { thanhCong: false, loi }.
 */
function LAY_FILE_HO_SO_(idHD, theoKhachHang, id) {
  _yeuCauQuyen_(QUYEN.NHAP_LIEU);
  const duLieu = _thuThapAnh_(idHD, theoKhachHang);
  if (!duLieu) return { thanhCong: false, loi: 'Không tìm thấy hợp đồng.' };
  id = String(id || '');
  let laHoSo = false;
  duLieu.hopDong.forEach(function (h) { (h.hoSo || []).forEach(function (x) { if (x.id === id) laHoSo = true; }); });
  if (!MAU_ID_DRIVE.test(id) || !laHoSo) return { thanhCong: false, loi: 'File không thuộc hồ sơ pháp lý của hợp đồng đang xem.' };
  try {
    const f = DriveApp.getFileById(id);
    const mime = f.getMimeType() || '';
    const blob = mime.indexOf('application/vnd.google-apps.') === 0 ? f.getAs('application/pdf') : f.getBlob();
    const bytes = blob.getBytes();
    if (bytes.length > HO_SO_TC_TOI_DA_BYTE) return { thanhCong: false, ten: f.getName(), loi: 'File "' + f.getName() + '" lớn hơn 15 MB — mở riêng trên Drive.' };
    return { thanhCong: true, base64: Utilities.base64Encode(bytes), mimeType: blob.getContentType() || mime, ten: f.getName() };
  } catch (e) {
    return { thanhCong: false, loi: 'Không đọc được file hồ sơ (đã bị xóa hoặc không có quyền): ' + e.message };
  }
}

// ============================================================
//  XEM FILE DRIVE NGAY TRONG HỆ THỐNG (mọi nút "xem / Mở file / 📎" ở các trang)
//  Link Drive mở bằng tài khoản Google của NGƯỜI XEM -> Drive đòi quyền nếu tài
//  khoản đó chưa được chia sẻ file (hoặc trình duyệt đang đăng nhập tài khoản
//  khác). Ở đây file được đọc bằng quyền của chủ script, nên người đã đăng nhập
//  hệ thống xem được mà không cần quyền Drive. Chỉ phục vụ file có trong dữ
//  liệu hợp đồng (ảnh HD_Picture / HD_GPS / Draft_AnhRung, hồ sơ HD_RUNG);
//  hồ sơ pháp lý chỉ Nhập liệu / Quản trị.
// ============================================================

/** { idDrive: 'anh' | 'hoso' } — mọi file được phép xem qua hệ thống. */
function _danhMucFileDrive_() {
  const kq = {};
  const them = function (v, loai) {
    const id = _idDriveTuLink_(v);
    if (id && kq[id] !== 'hoso') kq[id] = loai;
  };
  const doc = function (ten, fn) { try { readData_(ten).forEach(fn); } catch (e) { /* sheet chưa có */ } };
  doc(SHEET_NAME.HD_PICTURE, function (r) { for (let c = PICTURE_COL.PICTURE_START; c <= PICTURE_COL.PICTURE_END; c++) them(r[c], 'anh'); });
  doc(SHEET_NAME.HD_GPS, function (r) { them(r[GPS_COL.HINH_ANH], 'anh'); });
  doc(SHEET_NAME.DRAFT_ANH, function (r) {
    them(r[DRAFT_ANH_COL.DRIVE_URL], 'anh');
    const id = (r[DRAFT_ANH_COL.DRIVE_FILE_ID] || '').toString().trim();
    if (MAU_ID_DRIVE.test(id) && !kq[id]) kq[id] = 'anh';
  });
  doc(SHEET_NAME.HD_RUNG, function (r) { them(r[RUNG_COL.DINH_KEM_GIAY_TO], 'hoso'); });
  return kq;
}

/**
 * CHỨC NĂNG: xem 1 file Drive của dữ liệu hợp đồng.
 * cheDo 'xem' -> { ten, mime, loai, anh: dataUrl cỡ lớn (ảnh / trang đầu PDF) };
 * cheDo 'tai' -> { ten, mime, base64 } nội dung đầy đủ (tối đa 15 MB; Google Docs -> PDF).
 * File không thuộc dữ liệu hợp đồng -> { ngoaiDanhMuc: true } (trình duyệt mở link Drive như cũ).
 */
function XEM_FILE_DRIVE_(id, cheDo) {
  _yeuCauQuyen_(QUYEN.XEM);
  id = String(id || '');
  if (!MAU_ID_DRIVE.test(id)) return { thanhCong: false, ngoaiDanhMuc: true, loi: 'Link không hợp lệ.' };
  const loai = _danhMucFileDrive_()[id];
  if (!loai) return { thanhCong: false, ngoaiDanhMuc: true, loi: 'File không thuộc dữ liệu hợp đồng — mở bằng link Drive.' };
  if (loai === 'hoso' && !_coQuyen_(QUYEN.NHAP_LIEU)) return { thanhCong: false, loi: 'Hồ sơ pháp lý chỉ vai trò Nhập liệu / Quản trị xem được.' };
  let f;
  try { f = DriveApp.getFileById(id); } catch (e) { return { thanhCong: false, loi: 'Không tìm thấy file trên Drive (có thể đã bị xóa).' }; }
  const ten = f.getName(), mime = f.getMimeType() || '';
  if (cheDo === 'tai') {
    try {
      const blob = mime.indexOf('application/vnd.google-apps.') === 0 ? f.getAs('application/pdf') : f.getBlob();
      const bytes = blob.getBytes();
      if (bytes.length > HO_SO_TC_TOI_DA_BYTE) return { thanhCong: false, loi: 'File "' + ten + '" lớn hơn 15 MB — mở trên Drive.' };
      return { thanhCong: true, ten: ten + (mime.indexOf('application/vnd.google-apps.') === 0 ? '.pdf' : ''), mime: blob.getContentType() || mime, base64: Utilities.base64Encode(bytes) };
    } catch (e) { return { thanhCong: false, loi: 'Không đọc được file: ' + e.message }; }
  }
  return { thanhCong: true, ten: ten, mime: mime, loai: loai, anh: _taiAnhDrive_([id], ANH_TC_CO_LON)[id] || '' };
}
