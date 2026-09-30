/**
 * ============================================================
 *  33_TraCuuHopDong.gs
 *  TRA CỨU HỢP ĐỒNG (trang ?page=tracuu) — chỉ đọc, vai trò "Chỉ xem" trở lên.
 *  - Tìm theo Số HĐ / ID_HD / tên chủ rừng / người ủy quyền (có dấu hoặc không dấu)
 *    / CCCD / SĐT / Số tài khoản / địa chỉ rừng, lọc theo khoảng Ngày ký (từ ngày – đến ngày).
 *  - Xem chi tiết: thông tin hợp đồng, tình hình thực hiện, lô rừng (kèm số điểm
 *    GPS), tài khoản nhận tiền, ảnh hiện trường, hồ sơ pháp lý.
 *  - Vai trò "Chỉ xem": CCCD / SĐT / Số TK bị che bớt và không mở được file hồ sơ
 *    pháp lý (bản scan CCCD, GCN QSDĐ...). Nhập liệu / Quản trị xem đầy đủ.
 * ============================================================
 */
const TRA_CUU_GIOI_HAN_KET_QUA = 200;
const MAU_NGAY_ISO_TRA_CUU = /^\d{4}-\d{2}-\d{2}$/;

/** Chuỗi so khớp: chữ thường, bỏ dấu tiếng Việt, gộp khoảng trắng. */
function _chuoiSoKhop_(v) {
  return boDauTiengViet_((v === null || v === undefined) ? '' : v).toLowerCase().replace(/\s+/g, ' ').trim();
}
function _chiLaySo_(v) {
  return ((v === null || v === undefined) ? '' : v).toString().replace(/\D/g, '');
}

/** Che bớt số giấy tờ khi người xem không có quyền Nhập liệu. */
function _cheSo_(v, giuDau, giuCuoi) {
  const s = ((v === null || v === undefined) ? '' : v).toString().trim();
  if (!s) return '';
  if (s.length <= giuDau + giuCuoi) return s.replace(/./g, '*');
  return s.slice(0, giuDau) + s.slice(giuDau, s.length - giuCuoi).replace(/[^\s]/g, '*') + s.slice(s.length - giuCuoi);
}
function _cheCccd_(v) { return _cheSo_(v, 3, 3); }
function _cheSdt_(v) { return _cheSo_(v, 2, 3); }
function _cheStk_(v) { return _cheSo_(v, 0, 4); }

/** Giá trị số của ô (Date lọt vào ô số -> chuỗi ngày: google.script.run không trả được Date lồng trong object). */
function _giaTriO_(v) {
  if (v instanceof Date) return _ngayHienThi_(v);
  return (v === null || v === undefined) ? '' : v;
}

function _ngayHienThi_(v) {
  const iso = ngayToISO_(v);
  return iso ? iso.split('-').reverse().join('/') : '';
}

/**
 * Tìm hợp đồng theo từ khóa (>= 2 ký tự) và/hoặc khoảng NGÀY KÝ [tuNgay, denNgay]
 * ('yyyy-MM-dd', để trống 1 đầu = không giới hạn đầu đó). Chỉ chọn ngày, bỏ trống từ
 * khóa = liệt kê mọi hợp đồng ký trong khoảng đó. Có lọc ngày thì hợp đồng chưa có
 * Ngày ký bị loại. Trả { tuKhoa, tuNgay, denNgay, tongSo, gioiHan, ketQua: [...] }
 * (tối đa TRA_CUU_GIOI_HAN_KET_QUA dòng, mới ký trước).
 */
function TRA_CUU_HOP_DONG_(tuKhoa, tuNgay, denNgay) {
  _yeuCauQuyen_(QUYEN.XEM);
  const tk = _chuoiSoKhop_(tuKhoa);
  tuNgay = (tuNgay || '').toString().trim();
  denNgay = (denNgay || '').toString().trim();
  const traVe = { tuKhoa: tuKhoa || '', tuNgay: tuNgay, denNgay: denNgay, tongSo: 0, gioiHan: TRA_CUU_GIOI_HAN_KET_QUA, ketQua: [] };
  if ((tuNgay && !MAU_NGAY_ISO_TRA_CUU.test(tuNgay)) || (denNgay && !MAU_NGAY_ISO_TRA_CUU.test(denNgay))) return Object.assign(traVe, { loi: 'Ngày không hợp lệ.' });
  if (tuNgay && denNgay && tuNgay > denNgay) return Object.assign(traVe, { loi: '"Từ ngày" phải trước hoặc bằng "Đến ngày".' });
  const locNgay = !!(tuNgay || denNgay);
  if (!locNgay && tk.length < 2) return Object.assign(traVe, { loi: 'Nhập ít nhất 2 ký tự để tìm, hoặc chọn khoảng ngày ký.' });
  if (locNgay && tk.length === 1) return Object.assign(traVe, { loi: 'Từ khóa cần ít nhất 2 ký tự (hoặc để trống để xem mọi hợp đồng trong khoảng ngày).' });
  const coTuKhoa = tk.length >= 2;
  const tkSo = _chiLaySo_(tuKhoa);
  const timTheoSo = tkSo.length >= 4 && tkSo.length === tk.replace(/[\s.\-]/g, '').length; // từ khóa toàn chữ số (CCCD/SĐT/STK)
  const duocXemDu = _coQuyen_(QUYEN.NHAP_LIEU);

  // Số tài khoản nằm ở cả HD_NCC (TK chính) và HD_STK (các TK khác của hợp đồng)
  const idTheoStk = {};
  if (coTuKhoa && timTheoSo) {
    readData_(SHEET_NAME.HD_STK).forEach(function (r) {
      if (_chiLaySo_(r[STK_COL.SO_TK]).indexOf(tkSo) !== -1) idTheoStk[(r[STK_COL.ID_HD] || '').toString().trim()] = true;
    });
  }

  const truongChu = [
    ['Số HĐ', NCC_COL.SO_HD], ['ID', NCC_COL.ID_HD], ['Chủ rừng', NCC_COL.TEN_CHU_RUNG],
    ['Người ủy quyền', NCC_COL.TEN_UY_QUYEN], ['Địa chỉ rừng', NCC_COL.DIA_CHI_RUNG]
  ];
  const truongSo = [
    ['CCCD chủ rừng', NCC_COL.CCCD_CHU_RUNG], ['CCCD ủy quyền', NCC_COL.CCCD_UY_QUYEN],
    ['SĐT chủ rừng', NCC_COL.SDT_CHU_RUNG], ['SĐT ủy quyền', NCC_COL.SDT_UQ], ['Số tài khoản', NCC_COL.SO_TK]
  ];

  const khop = [];
  readData_(SHEET_NAME.HD_NCC).forEach(function (r) {
    const idHD = (r[NCC_COL.ID_HD] || '').toString().trim();
    if (!idHD && !r[NCC_COL.SO_HD]) return;
    const ngayKyIso = ngayToISO_(r[NCC_COL.NGAY_KY]);
    if (locNgay && (!ngayKyIso || (tuNgay && ngayKyIso < tuNgay) || (denNgay && ngayKyIso > denNgay))) return;
    let khopTheo = coTuKhoa ? '' : 'Ngày ký';
    for (let i = 0; i < truongChu.length && !khopTheo; i++) {
      if (_chuoiSoKhop_(r[truongChu[i][1]]).indexOf(tk) !== -1) khopTheo = truongChu[i][0];
    }
    if (!khopTheo && timTheoSo) {
      for (let j = 0; j < truongSo.length && !khopTheo; j++) {
        if (_chiLaySo_(r[truongSo[j][1]]).indexOf(tkSo) !== -1) khopTheo = truongSo[j][0];
      }
      if (!khopTheo && idTheoStk[idHD]) khopTheo = 'Số tài khoản';
    }
    if (!khopTheo) return;
    khop.push({
      idHD: idHD,
      soHD: (r[NCC_COL.SO_HD] || '').toString(),
      ngayKy: ngayKyIso ? ngayKyIso.split('-').reverse().join('/') : '',
      ngayKyIso: ngayKyIso,
      tenChuRung: (r[NCC_COL.TEN_CHU_RUNG] || '').toString(),
      tenUyQuyen: (r[NCC_COL.TEN_UY_QUYEN] || '').toString(),
      cccdChuRung: duocXemDu ? (r[NCC_COL.CCCD_CHU_RUNG] || '').toString() : _cheCccd_(r[NCC_COL.CCCD_CHU_RUNG]),
      diaChiRung: (r[NCC_COL.DIA_CHI_RUNG] || '').toString(),
      tinhTrang: (r[NCC_COL.TINH_TRANG] || '').toString(),
      khopTheo: khopTheo
    });
  });
  khop.sort(function (a, b) { return (b.ngayKyIso || '').localeCompare(a.ngayKyIso || ''); });
  return Object.assign(traVe, {
    tongSo: khop.length,
    ketQua: khop.slice(0, TRA_CUU_GIOI_HAN_KET_QUA).map(function (x) { delete x.ngayKyIso; return x; }),
    daCheSo: !duocXemDu
  });
}

/** Dòng Draft báo cáo (khối lượng/giá trị thực hiện, phiếu cân) của 1 hợp đồng — {} nếu chưa có. */
function _tinhHinhThucHienCuaHD_(idHD) {
  try {
    const sh = getOrCreateDraftBaoCaoSheet_();
    const lastRow = sh.getLastRow();
    if (lastRow < 2) return {};
    const c = DRAFT_BAOCAO_COL;
    const ids = sh.getRange(2, c.ID_HD + 1, lastRow - 1, 1).getValues();
    for (let i = 0; i < ids.length; i++) {
      if ((ids[i][0] || '').toString().trim() !== idHD) continue;
      const r = sh.getRange(i + 2, 1, 1, sh.getLastColumn()).getValues()[0];
      return {
        khoiLuongDuKien: _giaTriO_(r[c.KHOI_LUONG_DU_KIEN]), giaTriHopDong: _giaTriO_(r[c.GIA_TRI_HOP_DONG]),
        khoiLuongThucHien: _giaTriO_(r[c.KHOI_LUONG_THUC_HIEN]), giaTriThucHien: _giaTriO_(r[c.GIA_TRI_THUC_HIEN]),
        khoiLuongConLai: _giaTriO_(r[c.KHOI_LUONG_CON_LAI]), giaTriConLai: _giaTriO_(r[c.GIA_TRI_CON_LAI]),
        thucHienTuNgay: _ngayHienThi_(r[c.THUC_HIEN_TU_NGAY]), thucHienDenNgay: _ngayHienThi_(r[c.THUC_HIEN_DEN_NGAY]),
        danhSachSoPhieuCan: (r[c.DANH_SACH_SO_PHIEU_CAN] || '').toString(),
        toaDoTrungBinh: (r[c.TOA_DO_TRUNG_BINH] || '').toString(),
        thieuHoSoChiTiet: (r[c.THIEU_HO_SO_CHI_TIET] || '').toString(),
        capNhatLuc: r[c.CAP_NHAT_LUC] ? Utilities.formatDate(new Date(r[c.CAP_NHAT_LUC]), layMuiGioBangTinh_(), 'dd/MM/yyyy HH:mm') : ''
      };
    }
  } catch (e) { log_('WARNING', '_tinhHinhThucHienCuaHD_', 'Không đọc được Draft báo cáo cho ' + idHD, e); }
  return {};
}

/** Link http(s) trong 1 ô (bỏ qua tên file cũ chưa chuyển sang URL). */
function _linkTrongO_(v) {
  const s = ((v === null || v === undefined) ? '' : v).toString().trim();
  return /^https?:\/\//i.test(s) ? s : '';
}

/** Chi tiết 1 hợp đồng cho trang tra cứu. */
function CHI_TIET_TRA_CUU_HOP_DONG_(idHD) {
  _yeuCauQuyen_(QUYEN.XEM);
  idHD = (idHD || '').toString().trim();
  if (!idHD) return { khongTimThay: true, loi: 'Thiếu ID hợp đồng.' };
  const duocXemDu = _coQuyen_(QUYEN.NHAP_LIEU);
  const cccd = function (v) { return duocXemDu ? (v || '').toString() : _cheCccd_(v); };
  const sdt = function (v) { return duocXemDu ? (v || '').toString() : _cheSdt_(v); };
  const stk = function (v) { return duocXemDu ? (v || '').toString() : _cheStk_(v); };

  // Tốc độ: chỉ đọc đúng dòng của hợp đồng này (trước đây đọc cả HD_NCC / HD_RUNG / HD_GPS)
  const r = docDongTheoKhoa_(SHEET_NAME.HD_NCC, NCC_COL.ID_HD, [idHD])[0];
  if (!r) return { khongTimThay: true, loi: 'Không tìm thấy hợp đồng ' + idHD + ' (có thể đã bị xóa).' };

  const rungCuaHD = docDongTheoKhoa_(SHEET_NAME.HD_RUNG, RUNG_COL.ID_KEY_HD, [idHD]);
  const gpsTheoRung = {};
  docDongTheoKhoa_(SHEET_NAME.HD_GPS, GPS_COL.ID_KEY_GPS, rungCuaHD.map(function (x) { return x[RUNG_COL.ID_RUNG]; })).forEach(function (g) {
    const id = (g[GPS_COL.ID_KEY_GPS] || '').toString().trim();
    if (id) gpsTheoRung[id] = (gpsTheoRung[id] || 0) + 1;
  });

  const loRung = [];
  const hoSo = [];
  rungCuaHD.forEach(function (x) {
    if ((x[RUNG_COL.ID_KEY_HD] || '').toString().trim() !== idHD) return;
    const idRung = (x[RUNG_COL.ID_RUNG] || '').toString().trim();
    loRung.push({
      idRung: idRung,
      maRung: (x[RUNG_COL.MA_RUNG] || '').toString(),
      diaChiRung: (x[RUNG_COL.DIA_CHI_RUNG] || '').toString(),
      dienTichM2: _giaTriO_(x[RUNG_COL.DIEN_TICH_M2]), dienTichGPS: _giaTriO_(x[RUNG_COL.DIEN_TICH_GPS]),
      khoiLuongDuKien: _giaTriO_(x[RUNG_COL.KHOI_LUONG_DK]), khoiLuongThucHien: _giaTriO_(x[RUNG_COL.KHOI_LUONG_THUC_HIEN]),
      donGia: _giaTriO_(x[RUNG_COL.DON_GIA]), namTrong: (x[RUNG_COL.NAM_TRONG] || '').toString(),
      soDiemGPS: gpsTheoRung[idRung] || 0
    });
    const link = _linkTrongO_(x[RUNG_COL.DINH_KEM_GIAY_TO]);
    hoSo.push({
      idRung: idRung,
      hoSoNguonGoc: (x[RUNG_COL.HO_SO_NGUON_GOC] || '').toString(),
      soGiayTo: (x[RUNG_COL.SO_GIAY_TO] || '').toString(),
      ngayGiayTo: _ngayHienThi_(x[RUNG_COL.NGAY_GIAY_TO]),
      coFile: !!(x[RUNG_COL.DINH_KEM_GIAY_TO] || '').toString().trim(),
      url: duocXemDu ? link : ''
    });
  });

  const dinhDanhAnh = {};
  dinhDanhAnh[idHD] = true;
  loRung.forEach(function (l) { if (l.idRung) dinhDanhAnh[l.idRung] = true; });
  const anh = [];
  docDongTheoKhoa_(SHEET_NAME.HD_PICTURE, PICTURE_COL.ID_HD, Object.keys(dinhDanhAnh)).forEach(function (p) { // chỉ ảnh của HĐ / lô này
    if (!dinhDanhAnh[(p[PICTURE_COL.ID_HD] || '').toString().trim()]) return;
    for (let c = PICTURE_COL.PICTURE_START; c <= PICTURE_COL.PICTURE_END; c++) {
      const link = _linkTrongO_(p[c]);
      if (link) anh.push(link);
    }
  });

  const taiKhoan = [];
  docDongTheoKhoa_(SHEET_NAME.HD_STK, STK_COL.ID_HD, [idHD]).forEach(function (s) { // chỉ TK của HĐ này
    if ((s[STK_COL.ID_HD] || '').toString().trim() !== idHD) return;
    taiKhoan.push({
      soTK: stk(s[STK_COL.SO_TK]), nganHang: (s[STK_COL.NGAN_HANG] || '').toString(),
      tenUyQuyen: (s[STK_COL.TEN_UY_QUYEN] || '').toString(), uyQuyenTT: (s[STK_COL.UY_QUYEN_TT] || '').toString()
    });
  });

  return {
    idHD: idHD,
    daCheSo: !duocXemDu,
    hopDong: {
      soHD: (r[NCC_COL.SO_HD] || '').toString(),
      ngayKy: _ngayHienThi_(r[NCC_COL.NGAY_KY]),
      tinhTrang: (r[NCC_COL.TINH_TRANG] || '').toString(),
      nhomKH: (r[NCC_COL.NHOM_KH] || '').toString(),
      tenChuRung: (r[NCC_COL.TEN_CHU_RUNG] || '').toString(),
      cccdChuRung: cccd(r[NCC_COL.CCCD_CHU_RUNG]),
      ngayCap: _ngayHienThi_(r[NCC_COL.NGAY_CAP]),
      noiCap: (r[NCC_COL.NOI_CAP] || '').toString(),
      sdtChuRung: sdt(r[NCC_COL.SDT_CHU_RUNG]),
      diaChiThuongTru: (r[NCC_COL.DIA_CHI_TT] || '').toString(),
      maSoThue: (r[NCC_COL.MA_SO_THUE] || '').toString(),
      tenUyQuyen: (r[NCC_COL.TEN_UY_QUYEN] || '').toString(),
      cccdUyQuyen: cccd(r[NCC_COL.CCCD_UY_QUYEN]),
      sdtUyQuyen: sdt(r[NCC_COL.SDT_UQ]),
      diaChiUyQuyen: (r[NCC_COL.DIA_CHI_UQ] || '').toString(),
      uyQuyenTT: (r[NCC_COL.UY_QUYEN_TT] || '').toString(),
      diaChiRung: (r[NCC_COL.DIA_CHI_RUNG] || '').toString(),
      dienTichKy: _giaTriO_(r[NCC_COL.DIEN_TICH_KY]),
      slDuKien: _giaTriO_(r[NCC_COL.SL_DU_KIEN]),
      donGia: _giaTriO_(r[NCC_COL.DON_GIA]),
      soTK: stk(r[NCC_COL.SO_TK]),
      nganHang: (r[NCC_COL.NGAN_HANG] || '').toString()
    },
    thucHien: _tinhHinhThucHienCuaHD_(idHD),
    loRung: loRung,
    taiKhoan: taiKhoan,
    anh: anh,
    hoSo: hoSo
  };
}
