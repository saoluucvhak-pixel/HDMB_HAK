/**
 * ============================================================
 *  15_DraftHopDong.gs
 *  CƠ CHẾ NHÁP: mọi thao tác Tạo mới / Sửa hợp đồng (kể cả thêm/sửa/xóa Lô rừng,
 *  Tài khoản, Phụ lục, thêm điểm GPS mới) chỉ ghi vào sheet Draft_HopDong (1 dòng
 *  = 1 bản nháp, dữ liệu lưu dạng JSON). CHỈ KHI bấm "✅ Lưu chính thức" thì toàn
 *  bộ nháp mới được ghi thật vào HD_NCC / HD_RUNG / HD_STK / HD_GPS /
 *  PhuLucHopDong / ct_hopdong (tái sử dụng các hàm CRUD đã có ở 06_CreateUpdate.gs
 *  và 14_CtHopDong_PhuLuc.gs — hàm này chỉ ĐIỀU PHỐI, không viết lại logic ghi).
 *
 *  ⚠️ Ảnh hiện trường / Hồ sơ đính kèm (file) GIỮ NGUYÊN luồng "chờ duyệt" cũ
 *  (Draft_AnhRung, THEM_ANH_RUNG_, TAI_LEN_HO_SO_RUNG_) — KHÔNG đi qua Draft_HopDong,
 *  vì file cần ID thật (idHD/idRung) để lưu vào đúng thư mục Drive. Vì vậy 2 chức
 *  năng này chỉ mở khóa sau khi lô rừng đã có idRung THẬT (tức là hợp đồng/lô rừng
 *  đó đã từng được "Lưu chính thức" ít nhất 1 lần).
 * ============================================================
 */

const SHEET_DRAFT_HOPDONG = 'Draft_HopDong';
const DRAFT_HD_COL = { ID_DRAFT: 0, ID_HD_GOC: 1, JSON_DATA: 2, NGUOI_SUA: 3, THOI_GIAN_SUA: 4 };

function getOrCreateDraftHopDongSheet_() {
  const ss = getSS_();
  let sh = ss.getSheetByName(SHEET_DRAFT_HOPDONG);
  if (!sh) {
    sh = ss.insertSheet(SHEET_DRAFT_HOPDONG);
    const header = ['ID_Draft', 'ID_HD_Gốc (rỗng nếu tạo mới)', 'Dữ liệu (JSON)', 'Người sửa gần nhất', 'Thời gian sửa gần nhất'];
    sh.getRange(1, 1, 1, header.length).setValues([header]).setFontWeight('bold').setBackground('#34495e').setFontColor('#ffffff');
    sh.setColumnWidth(3, 500);
  }
  return sh;
}

function timDongDraft_(sh, idDraft) {
  const lastRow = sh.getLastRow();
  if (lastRow < 2) return -1;
  const ids = sh.getRange(2, DRAFT_HD_COL.ID_DRAFT + 1, lastRow - 1, 1).getValues();
  for (let i = 0; i < ids.length; i++) {
    if ((ids[i][0] || '').toString().trim() === idDraft.toString().trim()) return i + 2;
  }
  return -1;
}

/** Tạo 1 bản nháp TRẮNG cho hợp đồng MỚI (chưa có idHD). Trả về idDraft để front-end dùng cho các lần LUU_DRAFT_ tiếp theo. */
function TAO_DRAFT_MOI_() {
  _yeuCauQuyen_(QUYEN.NHAP_LIEU);
  const idDraft = 'DRAFT_' + Utilities.getUuid().slice(0, 8).toUpperCase();
  const rong = { idHD: null, hopDong: {}, rung: [], taiKhoan: [], phuLuc: [] };
  const sh = getOrCreateDraftHopDongSheet_();
  const row = [];
  row[DRAFT_HD_COL.ID_DRAFT] = idDraft; row[DRAFT_HD_COL.ID_HD_GOC] = '';
  row[DRAFT_HD_COL.JSON_DATA] = JSON.stringify(rong);
  row[DRAFT_HD_COL.NGUOI_SUA] = _emailNguoiThucHien_() || '';
  row[DRAFT_HD_COL.THOI_GIAN_SUA] = new Date();
  sh.appendRow(row);
  return { idDraft: idDraft };
}

/** Tiện ích cho front-end: bấm 1 dòng trong danh sách -> mở/tạo nháp luôn trong 1 lượt gọi */
function MO_DRAFT_THEO_SO_DONG_(soDong) {
  _yeuCauQuyen_(QUYEN.NHAP_LIEU);
  const hd = layHopDongTheoSoDong_(soDong);
  if (!hd || hd.khongTimThay) return null;
  const ketQua = LAY_DRAFT_THEO_ID_HD_(hd.idHD);
  if (ketQua) ketQua.tinhTrangGoc = hd.tinhTrang;
  return ketQua;
}

/**
 * Lấy bản nháp đang dở của 1 hợp đồng ĐÃ CÓ SẴN (mở để Sửa). Nếu hợp đồng này
 * chưa có nháp nào đang dở, TỰ TẠO 1 nháp mới bằng cách sao chép dữ liệu hiện
 * tại từ HD_NCC/HD_RUNG/HD_STK/PhuLucHopDong làm điểm bắt đầu (idRung/soDong
 * giữ nguyên = số THẬT, để khi Lưu chính thức biết là CẬP NHẬT chứ không phải
 * TẠO MỚI).
 */
function LAY_DRAFT_THEO_ID_HD_(idHD) {
  const sh = getOrCreateDraftHopDongSheet_();
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000); // chờ tối đa 15s — check-then-insert (kiểm tra đã có nháp chưa rồi mới tạo) không nguyên tử nếu không khóa (LOCK-007)
  } catch (e) {
    return null;
  }
  try {
    const lastRow = sh.getLastRow();
    if (lastRow >= 2) {
      const data = sh.getRange(2, 1, lastRow - 1, sh.getLastColumn()).getValues();
      for (let i = 0; i < data.length; i++) {
        if ((data[i][DRAFT_HD_COL.ID_HD_GOC] || '').toString().trim() === idHD.toString().trim()) {
          const du = JSON.parse(data[i][DRAFT_HD_COL.JSON_DATA]);
          chuanHoaDuNhapCu_(du, idHD);
          return { idDraft: data[i][DRAFT_HD_COL.ID_DRAFT], du: du, moiTao: false };
        }
      }
    }
    return LAY_DRAFT_THEO_ID_HD_TAO_MOI_(idHD, sh);
  } finally {
    lock.releaseLock();
  }
}

/**
 * Sửa tại chỗ 1 bản nháp đã lưu TRƯỚC khi vá 2 lỗi dưới đây (bản nháp có thể còn
 * nằm trong Draft_HopDong rất lâu nếu người dùng chưa Lưu chính thức):
 *  1) Thiếu nhomKH/maSoThue: form 11 hiện ô trống rồi khi Lưu ghi "" ĐÈ LÊN giá trị
 *     thật trong HD_NCC -> lấy lại từ hợp đồng gốc nếu nháp chưa có 2 khóa này.
 *  2) Ngày lưu dạng UTC ISO (2026-05-09T17:00:00Z) làm form hiện lùi 1 ngày ->
 *     đổi về ngày thuần yyyy-MM-dd đúng múi giờ bảng tính (ngayToISO_ giữ nguyên
 *     chuỗi đã là yyyy-MM-dd nên chạy lại nhiều lần không sao).
 */
function chuanHoaDuNhapCu_(du, idHD) {
  const h = du && du.hopDong;
  if (!h) return;
  ['ngayKy', 'ngayCap', 'ngayCapUyQuyen'].forEach(function (k) { if (h[k]) h[k] = ngayToISO_(h[k]); });
  if (!h.hasOwnProperty('nhomKH') || !h.hasOwnProperty('maSoThue')) {
    const goc = layHopDongTheoIdHD_ChoDraft_(idHD);
    if (goc) {
      if (!h.hasOwnProperty('nhomKH')) h.nhomKH = goc.nhomKH || '';
      if (!h.hasOwnProperty('maSoThue')) h.maSoThue = goc.maSoThue || '';
    }
  }
}

/** Khởi tạo 1 bản nháp mới từ dữ liệu chính thức hiện tại — tách riêng khỏi LAY_DRAFT_THEO_ID_HD_() để hàm đó giữ được khối lock gọn quanh toàn bộ thao tác check-then-insert (LOCK-007). */
function LAY_DRAFT_THEO_ID_HD_TAO_MOI_(idHD, sh) {
  const hd = layHopDongTheoIdHD_ChoDraft_(idHD);
  if (!hd) return null;
  const idDraft = 'DRAFT_' + idHD;
  const du = {
    idHD: idHD,
    hopDong: {
      tenChuRung: hd.tenChuRung, cccdChuRung: hd.cccdChuRung, soHD: hd.soHD, ngayKy: hd.ngayKy,
      ngayCap: hd.ngayCap, noiCap: hd.noiCap, sdtChuRung: hd.sdtChuRung, diaChiThuongTru: hd.diaChiThuongTru,
      tinhTrang: hd.tinhTrang, uyQuyenTT: hd.uyQuyenTT, tenUyQuyen: hd.tenUyQuyen, cccdUyQuyen: hd.cccdUyQuyen,
      ngayCapUyQuyen: hd.ngayCapUyQuyen, noiCapUyQuyen: hd.noiCapUyQuyen, sdtUyQuyen: hd.sdtUyQuyen, diaChiUyQuyen: hd.diaChiUyQuyen,
      // ⚠️ ĐÃ SỬA: trước đây KHÔNG sao chép 2 trường này -> form 11 hiện trống rồi khi Lưu ghi "" ĐÈ LÊN Nhóm KH / Mã số thuế thật
      nhomKH: hd.nhomKH || '', maSoThue: hd.maSoThue || ''
    },
    rung: (hd.danhSachRung || []).map(function (r) {
      return { idRung: r.idRung, tempId: null, diaChiRung: r.diaChiRung, dienTichM2: r.dienTichM2, donGia: r.donGia,
        khoiLuongDuKien: r.khoiLuongDuKien, hoSoNguonGoc: r.hoSoNguonGoc, soGiayTo: r.soGiayTo, xoa: false, gpsMoi: [] };
    }),
    taiKhoan: (hd.danhSachTaiKhoan || []).map(function (t) {
      // soTKGoc: Số TK lúc mở nháp — để Lưu chính thức xác minh đúng tài khoản dù số dòng đã dịch (C-01)
      return { soDong: t.soDong, tempId: null, soTK: t.soTK, soTKGoc: String(t.soTK === null || t.soTK === undefined ? '' : t.soTK), nganHang: t.nganHang, uyQuyenTT: t.uyQuyenTT, tenUyQuyen: t.tenUyQuyen, xoa: false };
    }),
    phuLuc: layDanhSachPhuLuc_(idHD).map(function (p) {
      return { soDong: p.soDong, idPhuLuc: p.idPhuLuc, tempId: null, donGia: p.donGia, khoiLuong: p.khoiLuong, ghiChu: p.ghiChu, xoa: false };
    })
  };
  // H-02: ảnh chụp thông tin hợp đồng LÚC MỞ NHÁP — khi Lưu chính thức chỉ ghi các trường người dùng đã đổi so
  // với ảnh chụp này, không ghi đè thay đổi người khác làm trong lúc nháp còn mở (nháp có thể để nhiều ngày).
  du.hopDongGoc = JSON.parse(JSON.stringify(du.hopDong));
  const row = [];
  row[DRAFT_HD_COL.ID_DRAFT] = idDraft; row[DRAFT_HD_COL.ID_HD_GOC] = idHD;
  row[DRAFT_HD_COL.JSON_DATA] = JSON.stringify(du);
  row[DRAFT_HD_COL.NGUOI_SUA] = _emailNguoiThucHien_() || '';
  row[DRAFT_HD_COL.THOI_GIAN_SUA] = new Date();
  sh.appendRow(row);
  return { idDraft: idDraft, du: du, moiTao: true };
}

/** Đọc lại thông tin hợp đồng hiện tại (dùng nội bộ để khởi tạo nháp) — không phụ thuộc UI */
function layHopDongTheoIdHD_ChoDraft_(idHD) {
  // P-09: chỉ đọc cột ID_HD để tìm dòng (trước đây đọc cả 33 cột HD_NCC)
  const soDong = timSoDongTheoGiaTri_(SHEET_NAME.HD_NCC, NCC_COL.ID_HD, idHD);
  return soDong === -1 ? null : layHopDongTheoSoDong_(soDong);
}

/** Ghi đè toàn bộ JSON của 1 bản nháp — gọi sau MỌI thay đổi ở màn hình (đổi field, thêm/sửa/xóa rừng-TK-phụ lục-GPS nháp) */
function LUU_DRAFT_(idDraft, jsonDuLieu) {
  _yeuCauQuyen_(QUYEN.NHAP_LIEU);
  try {
    const sh = getOrCreateDraftHopDongSheet_();
    const soDong = timDongDraft_(sh, idDraft);
    if (soDong === -1) return { thanhCong: false, loi: 'Không tìm thấy bản nháp ' + idDraft + ' (có thể đã bị Lưu chính thức hoặc hủy ở tab khác).' };
    const oJson = sh.getRange(soDong, DRAFT_HD_COL.JSON_DATA + 1);
    try {
      jsonDuLieu = JSON.stringify(_giuTienDoLuuChinhThuc_(JSON.parse(oJson.getValue() || 'null'), JSON.parse(jsonDuLieu)));
    } catch (e) { /* JSON lạ -> ghi nguyên như trước */ }
    oJson.setValue(jsonDuLieu);
    sh.getRange(soDong, DRAFT_HD_COL.NGUOI_SUA + 1).setValue(_emailNguoiThucHien_() || '');
    sh.getRange(soDong, DRAFT_HD_COL.THOI_GIAN_SUA + 1).setValue(new Date());
    return { thanhCong: true };
  } catch (e) {
    return { thanhCong: false, loi: 'Lỗi lưu nháp: ' + e.message };
  }
}

/**
 * Lượt "Lưu chính thức" lỗi giữa chừng để lại dấu tiến độ trong bản nháp (idHD đã tạo, idRung
 * của lô vừa thêm, daTao / daXoaXong / điểm GPS daGhi). Trình duyệt vẫn giữ bản CŨ trong bộ
 * nhớ và tự lưu nháp đè lên -> giữ lại các dấu đó, để lần lưu sau không tạo trùng / xóa nhầm dòng.
 * Khớp mục theo tempId (mục mới) hoặc idRung / số dòng (mục đã có).
 */
function _giuTienDoLuuChinhThuc_(cu, moi) {
  if (!cu || !moi || typeof moi !== 'object') return moi;
  if (!moi.idHD && cu.idHD) moi.idHD = cu.idHD;
  if (!moi.hopDongGoc && cu.hopDongGoc) moi.hopDongGoc = cu.hopDongGoc; // H-02: trình duyệt cũ không gửi lại ảnh chụp gốc
  const theoKhoa = function (ds, khoa) { const m = {}; (ds || []).forEach(function (x) { const k = x && khoa(x); if (k) m[k] = x; }); return m; };
  const khoaGps = function (p) { return p.lat + '|' + p.lng + '|' + (p.anhUrl || ''); };
  const rungCu = theoKhoa(cu.rung, function (x) { return x.tempId || x.idRung; });
  (moi.rung || []).forEach(function (x) {
    const c = x && rungCu[x.tempId || x.idRung];
    if (!c) return;
    if (!x.idRung && c.idRung) x.idRung = c.idRung;
    if (c.daXoaXong) x.daXoaXong = true;
    const daGhi = {};
    (c.gpsMoi || []).forEach(function (p) { if (p && p.daGhi) daGhi[khoaGps(p)] = true; });
    (x.gpsMoi || []).forEach(function (p) { if (p && daGhi[khoaGps(p)]) p.daGhi = true; });
  });
  ['taiKhoan', 'phuLuc'].forEach(function (ten) {
    const khoa = function (x) { return x.tempId || (x.soDong ? 'dong' + x.soDong : ''); };
    const m = theoKhoa(cu[ten], khoa);
    (moi[ten] || []).forEach(function (x) {
      const c = x && m[khoa(x)];
      if (!c) return;
      if (c.daTao) x.daTao = true;
      if (c.daXoaXong) x.daXoaXong = true;
    });
  });
  return moi;
}

/** Hủy bản nháp (bấm "Hủy" hoặc rời trang mà không lưu) — không đụng gì tới bảng gốc */
function HUY_DRAFT_(idDraft) {
  _yeuCauQuyen_(QUYEN.NHAP_LIEU);
  const sh = getOrCreateDraftHopDongSheet_();
  const soDong = timDongDraft_(sh, idDraft);
  if (soDong !== -1) sh.deleteRow(soDong);
  return { thanhCong: true };
}

/**
 * ✅ LƯU CHÍNH THỨC — điểm duy nhất ghi dữ liệu thật vào HD_NCC/HD_RUNG/HD_STK/
 * HD_GPS/PhuLucHopDong. Đọc JSON nháp, rồi lần lượt gọi lại đúng các hàm CRUD đã
 * có sẵn (để không phải viết lại logic tính mã, ghi log, cập nhật ct_hopdong...).
 * Xóa bản nháp sau khi ghi xong thành công.
 */
function LUU_CHINH_THUC_(idDraft) {
  _yeuCauQuyen_(QUYEN.NHAP_LIEU);
  const sh = getOrCreateDraftHopDongSheet_();
  const cache = CacheService.getScriptCache();
  const khoaDangLuu = 'LUU_CHINH_THUC_' + idDraft;
  let du;
  // ⚠️ ĐÃ SỬA (bấm "Lưu chính thức" 2 lần / 2 tab): trước đây 2 lượt chạy song song cùng
  // đọc được bản nháp (nháp chỉ bị xóa ở cuối) -> với hợp đồng MỚI sinh ra 2 HỢP ĐỒNG TRÙNG.
  // Giờ "nhận" bản nháp nguyên tử dưới 1 lock ngắn (đánh dấu trong ScriptCache, tự hết hạn
  // 10 phút nếu lượt chạy chết giữa chừng) rồi NHẢ lock trước khi gọi các hàm ghi bên dưới
  // (các hàm đó tự lấy lock riêng — không lồng lock).
  const lock = LockService.getScriptLock();
  try { lock.waitLock(15000); } catch (e) { return { thanhCong: false, loi: 'Hệ thống đang bận, vui lòng thử lại sau vài giây.' }; }
  try {
    const soDong = timDongDraft_(sh, idDraft);
    if (soDong === -1) return { thanhCong: false, loi: 'Không tìm thấy bản nháp — có thể đã được lưu chính thức ở nơi khác.' };
    if (cache.get(khoaDangLuu)) return { thanhCong: false, loi: 'Bản nháp này đang được lưu chính thức (có thể do bấm "Lưu" 2 lần) — vui lòng chờ kết quả, không bấm lại.' };
    const r = sh.getRange(soDong, 1, 1, sh.getLastColumn()).getValues()[0];
    du = JSON.parse(r[DRAFT_HD_COL.JSON_DATA]);
    if (!du.hopDong || !du.hopDong.tenChuRung || !du.hopDong.cccdChuRung || !du.hopDong.ngayKy) {
      return { thanhCong: false, loi: 'Thiếu Họ tên chủ rừng / CCCD hợp lệ / Ngày ký hợp đồng.' };
    }
    cache.put(khoaDangLuu, '1', 600);
  } finally {
    lock.releaseLock();
  }

  // Ghi tiến độ vào bản nháp sau mỗi bước tạo/xóa: lượt này có lỗi hay bị ngắt (quá 6 phút)
  // giữa chừng thì lần bấm lưu sau chỉ làm NỐT phần còn lại — không tạo trùng hợp đồng/lô
  // rừng/tài khoản, không xóa nhầm dòng khác (xóa theo số dòng, dòng đã dịch sau lần xóa trước).
  const ghiTienDo = function () {
    try {
      const d = timDongDraft_(sh, idDraft);
      if (d !== -1) sh.getRange(d, DRAFT_HD_COL.JSON_DATA + 1).setValue(JSON.stringify(du));
    } catch (e) { log_('WARNING', 'LUU_CHINH_THUC_', 'Không ghi được tiến độ vào bản nháp ' + idDraft, e); }
  };
  try {
    const gom = batDauGomDraft_(); // H-12
    let kq;
    try { kq = luuChinhThucThucThi_(du, 'NHAP_' + idDraft, ghiTienDo); } finally { ketThucGomDraft_(gom); }
    if (kq.thanhCong) {
      // Tìm LẠI dòng nháp theo idDraft ngay trước khi xóa: lượt lưu mất vài giây, trong lúc đó nháp
      // khác phía trên có thể đã bị xóa -> số dòng lấy từ đầu hàm đã lệch và xóa NHẦM nháp của người khác.
      const lockXoa = LockService.getScriptLock();
      lockXoa.waitLock(15000);
      try {
        const soDongHienTai = timDongDraft_(sh, idDraft);
        if (soDongHienTai !== -1) sh.deleteRow(soDongHienTai);
      } finally { lockXoa.releaseLock(); }
    }
    return kq;
  } finally {
    cache.remove(khoaDangLuu);
  }
}

/**
 * H-02 (rà soát 28/09): các trường thông tin hợp đồng cần GHI khi lưu nháp của hợp đồng ĐÃ CÓ = chỉ những trường
 * người dùng đã đổi so với lúc mở nháp (du.hopDongGoc). Trước đây ghi TOÀN BỘ -> nháp mở từ hôm trước ghi đè Số TK /
 * địa chỉ... mà người khác vừa sửa ở trang 27. Trường cả 2 người cùng sửa: giữ giá trị của người đang lưu + cảnh báo.
 * Nháp cũ không có ảnh chụp gốc / hợp đồng mới: ghi toàn bộ như trước.
 */
function _truongHopDongCanGhi_(du, canhBao) {
  const h = du.hopDong || {};
  if (!du.idHD || !du.hopDongGoc) return h;
  const ngay = ['ngayKy', 'ngayCap', 'ngayCapUyQuyen'];
  const chuan = function (k, v) { return ngay.indexOf(k) !== -1 ? ngayToISO_(v) : (v === null || v === undefined ? '' : String(v).trim()); };
  let hienTai = null;
  try { hienTai = _thongTinHopDongHienTai_(du.idHD); } catch (e) { /* không đọc được -> không cảnh báo xung đột */ }
  const ghi = {};
  Object.keys(h).forEach(function (k) {
    if (chuan(k, h[k]) === chuan(k, du.hopDongGoc[k])) return; // người dùng không đổi trường này -> KHÔNG ghi
    ghi[k] = h[k];
    if (hienTai && hienTai.hasOwnProperty(k) && chuan(k, hienTai[k]) !== chuan(k, du.hopDongGoc[k]) && chuan(k, hienTai[k]) !== chuan(k, h[k])) {
      canhBao.push('Trường "' + k + '" đã được người khác sửa thành "' + chuan(k, hienTai[k]) + '" trong lúc nháp còn mở — đã ghi đè bằng giá trị của bạn "' + chuan(k, h[k]) + '".');
    }
  });
  return ghi;
}

/** P-10: chỉ các trường thông tin của 1 hợp đồng (1 dòng HD_NCC) — không kèm lô rừng/tài khoản như layHopDongTheoSoDong_. */
function _thongTinHopDongHienTai_(idHD) {
  const soDong = timSoDongTheoGiaTri_(SHEET_NAME.HD_NCC, NCC_COL.ID_HD, idHD);
  if (soDong === -1) return null;
  const sh = getSheet_(SHEET_NAME.HD_NCC);
  const r = sh.getRange(soDong, 1, 1, Math.max(sh.getLastColumn(), NCC_COL.MA_SO_THUE + 1)).getValues()[0];
  const kq = {};
  const map = { tenChuRung: 'TEN_CHU_RUNG', cccdChuRung: 'CCCD_CHU_RUNG', soHD: 'SO_HD', ngayKy: 'NGAY_KY', ngayCap: 'NGAY_CAP', noiCap: 'NOI_CAP',
    sdtChuRung: 'SDT_CHU_RUNG', diaChiThuongTru: 'DIA_CHI_TT', tinhTrang: 'TINH_TRANG', uyQuyenTT: 'UY_QUYEN_TT', tenUyQuyen: 'TEN_UY_QUYEN',
    cccdUyQuyen: 'CCCD_UY_QUYEN', ngayCapUyQuyen: 'NGAY_CAP_UQ', noiCapUyQuyen: 'NOI_CAP_UQ', sdtUyQuyen: 'SDT_UQ', diaChiUyQuyen: 'DIA_CHI_UQ',
    nhomKH: 'NHOM_KH', maSoThue: 'MA_SO_THUE', diaChiRung: 'DIA_CHI_RUNG', soTK: 'SO_TK', nganHang: 'NGAN_HANG' };
  Object.keys(map).forEach(function (k) { kq[k] = r[NCC_COL[map[k]]]; });
  return kq;
}

/** Ghi dữ liệu của 1 bản nháp vào các bảng chính (không xóa nháp — LUU_CHINH_THUC_ lo việc đó). */
function luuChinhThucThucThi_(du, maThaoTac, ghiTienDo) {
  ghiTienDo = ghiTienDo || function () {};
  // 1) HỢP ĐỒNG (HD_NCC) — tạo mới hoặc cập nhật. maThaoTac: lượt lưu lại của CÙNG bản nháp
  // dùng lại hợp đồng đã tạo thay vì tạo hợp đồng thứ 2 (xem _hdDaTaoTheoMaThaoTac_).
  const loiChiTiet = [];
  const hd = _truongHopDongCanGhi_(du, loiChiTiet);
  // boQuaTongHopRung: cuối hàm này đã tổng hợp lô rừng 1 lần (sau khi ghi xong lô) — không làm 2 lần (P-10)
  const ketQuaHD = LUU_HOP_DONG_DAY_DU_({ idHD: du.idHD, soDong: null, hopDong: hd, rung: [], taiKhoan: [], maThaoTac: maThaoTac, boQuaTongHopRung: true });
  if (!ketQuaHD.thanhCong) return ketQuaHD;
  const idHD = ketQuaHD.idHD, soHD = ketQuaHD.soHD;
  if (!du.idHD) { du.idHD = idHD; ghiTienDo(); }

  // 2) LÔ RỪNG — thêm mới / cập nhật / xóa, rồi ghi các điểm GPS mới thêm ở bản nháp
  (du.rung || []).forEach(function (rg) {
    if (rg.xoa) {
      if (rg.idRung && !rg.daXoaXong) {
        const kq = XOA_LO_RUNG_(rg.idRung);
        if (kq.thanhCong) { rg.daXoaXong = true; ghiTienDo(); } else loiChiTiet.push('Xóa lô rừng ' + rg.idRung + ': ' + kq.loi);
      }
      return;
    }
    const dRung = {
      idHD: idHD, soHD: soHD, tenChuRung: du.hopDong.tenChuRung, cccd: du.hopDong.cccdChuRung,
      diaChiRung: rg.diaChiRung, dienTichM2: rg.dienTichM2, donGia: rg.donGia,
      khoiLuongDuKien: rg.khoiLuongDuKien, hoSoNguonGoc: rg.hoSoNguonGoc, soGiayTo: rg.soGiayTo
    };
    let idRungThat = rg.idRung;
    if (idRungThat) {
      const kq = CAP_NHAT_LO_RUNG_(idRungThat, dRung);
      if (!kq.thanhCong) { loiChiTiet.push('Cập nhật lô rừng ' + idRungThat + ': ' + kq.loi); return; }
    } else {
      const kq = THEM_LO_RUNG_MOI_(dRung);
      if (!kq.thanhCong) { loiChiTiet.push('Thêm lô rừng "' + rg.diaChiRung + '": ' + kq.loi); return; }
      idRungThat = kq.idRung;
      rg.idRung = idRungThat; ghiTienDo(); // lần lưu lại sẽ CẬP NHẬT lô này, không thêm lô thứ 2
    }
    let coGpsMoi = false;
    (rg.gpsMoi || []).forEach(function (p) {
      if (p.daGhi) return;
      const kqGps = CAP_NHAT_GPS_RUNG_(idRungThat, { lat: p.lat, lng: p.lng, anhUrl: p.anhUrl || '' }, false);
      if (kqGps.thanhCong) { p.daGhi = true; coGpsMoi = true; } else loiChiTiet.push('Thêm GPS cho ' + idRungThat + ': ' + kqGps.loi);
    });
    if (coGpsMoi) ghiTienDo();
  });

  // 3) TÀI KHOẢN — C-01 (rà soát 28/09): số dòng trong nháp có thể đã cũ (nháp để nhiều ngày, dòng của hợp
  // đồng khác bị xóa -> dịch lên). Mọi thao tác theo dòng giờ xác minh lại ID_HD + Số TK gốc trước khi ghi,
  // và làm SỬA/THÊM trước, XÓA sau (từ dòng dưới lên) để các lần xóa trong cùng lượt không làm lệch nhau.
  const dsTK = du.taiKhoan || [];
  dsTK.forEach(function (tk) {
    if (tk.xoa || tk.daTao) return;
    const dTK = { idHD: idHD, soHD: soHD, tenChuRung: du.hopDong.tenChuRung, cccd: du.hopDong.cccdChuRung, soTK: tk.soTK, nganHang: tk.nganHang, uyQuyenTT: tk.uyQuyenTT, tenUyQuyen: tk.tenUyQuyen };
    const kq = tk.soDong ? CAP_NHAT_TAI_KHOAN_(tk.soDong, dTK, idHD, tk.soTKGoc) : THEM_TAI_KHOAN_MOI_(dTK);
    if (!kq.thanhCong) loiChiTiet.push('Tài khoản ' + (tk.soTK || '') + ': ' + kq.loi);
    else if (!tk.soDong) { tk.daTao = true; ghiTienDo(); }
  });
  dsTK.filter(function (tk) { return tk.xoa && tk.soDong && !tk.daXoaXong; })
    .sort(function (a, b) { return Number(b.soDong) - Number(a.soDong); })
    .forEach(function (tk) {
      const kq = XOA_TAI_KHOAN_(tk.soDong, idHD, tk.soTKGoc);
      if (kq.thanhCong) { tk.daXoaXong = true; ghiTienDo(); } else loiChiTiet.push('Xóa tài khoản ' + (tk.soTKGoc || tk.soTK || '') + ': ' + kq.loi);
    });

  // 4) PHỤ LỤC HỢP ĐỒNG — cùng nguyên tắc (khóa ID_PHU_LUC + ID_HD)
  const dsPL = du.phuLuc || [];
  dsPL.forEach(function (pl) {
    if (pl.xoa || pl.daTao) return;
    const kq = LUU_PHU_LUC_({ idHD: idHD, soHD: soHD, soDong: pl.soDong, idPhuLuc: pl.idPhuLuc, donGia: pl.donGia, khoiLuong: pl.khoiLuong, ghiChu: pl.ghiChu });
    if (!kq.thanhCong) loiChiTiet.push('Phụ lục: ' + kq.loi);
    else if (!pl.soDong) { pl.daTao = true; ghiTienDo(); }
  });
  dsPL.filter(function (pl) { return pl.xoa && pl.soDong && !pl.daXoaXong; })
    .sort(function (a, b) { return Number(b.soDong) - Number(a.soDong); })
    .forEach(function (pl) {
      const kq = XOA_PHU_LUC_(pl.soDong, idHD, pl.idPhuLuc);
      if (kq.thanhCong) { pl.daXoaXong = true; ghiTienDo(); } else loiChiTiet.push('Xóa phụ lục dòng ' + pl.soDong + ': ' + kq.loi);
    });

  dongBoTongHopRungVaoHdNcc_(idHD); // tổng hợp lô rừng -> ct_hopdong + HD_NCC cột Z/T/AA

  return { thanhCong: true, idHD: idHD, soHD: soHD, canhBao: loiChiTiet.length ? loiChiTiet : null, nhacDuyet: ketQuaHD.nhacDuyet || '' };
}
