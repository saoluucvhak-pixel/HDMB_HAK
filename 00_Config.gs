/**
 * ============================================================
 *  00_Config.gs
 *  CẤU HÌNH TRUNG TÂM — HỆ THỐNG QUẢN LÝ HỢP ĐỒNG MUA GỖ KEO
 *  Áp dụng cho Google Sheet cấu trúc:
 *    HD_NCC (cha) -> HD_RUNG (con 1, nhiều rừng/HĐ)
 *                 -> HD_STK  (con 2, nhiều số TK/HĐ)
 *    HD_RUNG -> HD_GPS      (con của rừng, nhiều điểm GPS/rừng)
 *            -> HD_Picture  (nhiều ảnh/rừng, tối đa 10 ảnh/dòng)
 *    DM_DIACHI : bảng phụ địa chỉ tham chiếu khi tạo mới HD_NCC
 *    DM_NG     : danh mục khu vực
 *    DM_KH     : danh mục nhóm khách hàng / đại lý / NV thu mua
 * ============================================================
 */

const SHEET_NAME = {
  HD_NCC:     'HD_NCC',
  HD_RUNG:    'HD_RUNG',
  HD_STK:     'HD_STK',
  HD_GPS:     'HD_GPS',
  HD_PICTURE: 'HD_Picture',
  DM_DIACHI:  'DM_DIACHI',
  DM_NG:      'DM_NG',
  DM_KH:      'DM_KH',
  BAO_CAO:    'BaoCao_KiemTra',    // sheet kết quả kiểm tra sẽ được tạo tự động
  DRAFT_ANH:  'Draft_AnhRung',     // sheet nháp: ảnh + GPS trích xuất chờ duyệt trước khi ghi vào HD_GPS/HD_Picture
  NHAT_KY:    'NhatKy_SuaDoi'      // sheet nhật ký ghi lại mọi thay đổi hợp đồng (tự tạo)
};

/**
 * Cột của sheet nháp Draft_AnhRung — nơi lưu tạm ảnh mới tải lên (dù đã gán sẵn
 * cho 1 lô rừng, hoặc TẢI LÊN KIỂM TRA ĐỘC LẬP chưa gán rừng nào) + tọa độ GPS
 * trích xuất từ EXIF + ghi chú/địa chỉ người kiểm tra nhập tay, CHỜ DUYỆT rồi
 * mới copy qua HD_GPS/HD_Picture (sheet gốc). ID_HD/ID_RUNG có thể để trống lúc
 * tải lên kiểm tra độc lập, gán sau khi quyết định đưa vào hồ sơ hợp đồng nào.
 */
const DRAFT_ANH_COL = {
  ID_DRAFT: 0, ID_HD: 1, ID_RUNG: 2, TEN_FILE: 3, DRIVE_FILE_ID: 4, DRIVE_URL: 5,
  GPS_LAT: 6, GPS_LNG: 7, DIA_CHI_RUNG: 8, GHI_CHU: 9, TRANG_THAI: 10, THOI_GIAN: 11
};

// ---- NhatKy_SuaDoi (sheet nhật ký, tự tạo) ----
const NHATKY_COL = { THOI_GIAN: 0, NGUOI_THUC_HIEN: 1, HANH_DONG: 2, ID_HD: 3, CHI_TIET: 4 };

// ---- HD_NCC (bảng cha - hợp đồng) ----
const NCC_COL = {
  TIMESTAMP: 0, EMAIL: 1, SO_HD: 2, NGAY_KY: 3,
  TEN_CHU_RUNG: 4, DIA_CHI_TT: 5, CCCD_CHU_RUNG: 6, NGAY_CAP: 7, NOI_CAP: 8,
  SDT_CHU_RUNG: 9, TEN_UY_QUYEN: 10, CCCD_UY_QUYEN: 11, NOI_CAP_UQ: 12,
  DIA_CHI_UQ: 13, SDT_UQ: 14, SO_TK: 15, NGAN_HANG: 16, EMAIL_UQ: 17,
  DIA_CHI_RUNG: 18, DIEN_TICH_KY: 19, LOCATION: 20, HO_SO_NGUON_GOC: 21,
  SO_GIAY_TO: 22, DIEN_TICH_GPS: 23, UY_QUYEN_TT: 24, SL_DU_KIEN: 25,
  DON_GIA: 26, NHOM_KH: 27, CHI_NHANH_NH: 28, ID_HD: 29, TINH_TRANG: 30,
  NGAY_CAP_UQ: 31 // CỘT MỞ RỘNG (không có sẵn trong file gốc) — "Ngày cấp CCCD người được ủy quyền"
};

// ---- HD_RUNG (con 1 - từng lô rừng của hợp đồng) ----
const RUNG_COL = {
  ID_KEY_HD: 0, MA_RUNG: 1, ID_RUNG: 2, SO_HD: 3, NGAY_KY: 4,
  TEN_CHU_RUNG: 5, CCCD: 6, THUONG_TRU: 7, DIA_CHI_RUNG: 8,
  DIEN_TICH_M2: 9, DON_GIA: 10, KHOI_LUONG_DK: 11, DIEN_TICH_GPS: 12,
  HO_SO_NGUON_GOC: 13, SO_GIAY_TO: 14, NGAY_GIAY_TO: 15,
  DINH_KEM_GIAY_TO: 16, TIMESTAMP: 17,
  KHOI_LUONG_THUC_HIEN: 18 // CỘT MỞ RỘNG (không có sẵn trong file gốc) — Apps Script tự thêm cột khi ghi lần đầu.
                           // Dùng để theo dõi khối lượng gỗ đã thực tế thu mua/giao nhận cho lô rừng này,
                           // phục vụ báo cáo "tình hình thực hiện". Nếu chưa nhập, coi như = 0 (chưa thực hiện).
};

// ---- HD_STK (con 2 - số tài khoản của hợp đồng) ----
const STK_COL = {
  ID_HD: 0, ID_STK: 1, TEN_CHU_RUNG: 2, CCCD: 3, TEN_UY_QUYEN: 4,
  SO_TK: 5, NGAN_HANG: 6, UY_QUYEN_TT: 7, SO_HD: 8, TIMESTAMP: 9
};

// ---- HD_GPS (con của rừng - tọa độ) ----
const GPS_COL = {
  ID_KEY_GPS: 0, ID_GPS: 1, LAT: 2, LNG: 3, LOCATION: 4,
  ADDRESS: 5, TEN_CHU_RUNG: 6, HINH_ANH: 7, TRANG_THAI: 8, HE_TOA_DO: 9
};

// ---- HD_Picture (ảnh của rừng, tối đa 10 ảnh/dòng) ----
const PICTURE_COL = {
  ID_HD: 0, ID_PICTURE: 1, TEN_CHU_RUNG: 2,
  PICTURE_START: 3, PICTURE_END: 12   // Picture1..Picture10
};

// ---- DM_DIACHI (bảng phụ địa chỉ tham chiếu) ----
const DIACHI_COL = {
  ID_HD: 0, ID_DIACHI: 1, TIMESTAMP: 2, TEN_CHU_RUNG: 3,
  DIA_CHI_TT: 4, DIA_CHI_UQ: 5, DIA_CHI_RUNG: 6, NGAN_HANG: 7
};

/**
 * Danh sách loại "Hồ sơ nguồn gốc" hợp lệ (dùng để đối chiếu chuỗi văn bản
 * người dùng nhập ở cột HoSoNguonGoc). Có thể mở rộng thêm nếu phát sinh loại mới.
 */
const LOAI_HO_SO_HOP_LE = [
  'Giấy chứng nhận QSDĐ',
  'Đơn xác nhận của UBNN Xã/Phường',
  'Giấy xác nhận',
  'Hợp đồng chuyển nhượng',
  'Giấy ủy quyền'
];

/** Lấy danh sách loại hồ sơ đầy đủ = danh mục gốc + các loại người dùng đã tự thêm (lưu ở Script Properties) */
function layDanhSachLoaiHoSo() {
  const themVao = PropertiesService.getScriptProperties().getProperty('LOAI_HO_SO_THEM');
  const dsThem = themVao ? JSON.parse(themVao) : [];
  return LOAI_HO_SO_HOP_LE.concat(dsThem);
}

/** Thêm 1 loại hồ sơ nguồn gốc mới vào danh mục (bấm "+ Loại khác..." trên form) */
function themLoaiHoSoMoi(loaiMoi) {
  loaiMoi = (loaiMoi || '').toString().trim();
  if (!loaiMoi) return { thanhCong: false, loi: 'Tên loại hồ sơ trống' };
  const key = 'LOAI_HO_SO_THEM';
  const props = PropertiesService.getScriptProperties();
  const hienCo = props.getProperty(key);
  const ds = hienCo ? JSON.parse(hienCo) : [];
  if (LOAI_HO_SO_HOP_LE.indexOf(loaiMoi) === -1 && ds.indexOf(loaiMoi) === -1) {
    ds.push(loaiMoi);
    props.setProperty(key, JSON.stringify(ds));
  }
  return { thanhCong: true, danhSach: layDanhSachLoaiHoSo() };
}

// Sai số cho phép (mét) khi đối chiếu tọa độ GPS ảnh với tọa độ rừng đã ghi nhận
const GPS_TOLERANCE_METERS = 800;

// Danh sách các phần mềm chỉnh sửa ảnh phổ biến để nhận diện qua tag EXIF "Software"
const PHAN_MEM_CHINH_SUA_NGHI_VAN = [
  'photoshop', 'gimp', 'snapseed', 'picsart', 'lightroom',
  'facetune', 'meitu', 'pixlr', 'canva', 'remini', 'vsco'
];

/**
 * Cấu hình đọc Báo giá gỗ keo từ Google Sheet ngoài để gợi ý đơn giá trung bình
 * tháng khi tạo/sửa hợp đồng. LƯU Ý: sheet ngoài phải chia sẻ quyền xem/chỉnh sửa
 * cho tài khoản chạy Apps Script này (ít nhất quyền xem) thì mới đọc được.
 */
const BAOGIA_URL = 'https://docs.google.com/spreadsheets/d/1SIhfjP5-6ouRPDj265lAMmI5yWs1XcnedjqpzDwaIC0/edit';
const BAOGIA_SHEET_NAME = 'Baogia_DN_SAVE';

/**
 * Sheet ngoài theo dõi khối lượng/giá trị ĐÃ THỰC HIỆN thực tế (nhập/mua gỗ keo),
 * dùng cho báo cáo "Tình hình thực hiện hợp đồng" thay vì chỉ dựa vào cột
 * KhoiLuongThucHien tự nhập trong HD_RUNG (xem 06_CreateUpdate.gs: layDuLieuThucHienTuDNTT_).
 */
const DNTT_URL = 'https://docs.google.com/spreadsheets/d/1oUm87_gbDbnuPc_We0dyZ_e4kHXBHXs95AQAxp5okYo/edit';
const DNTT_SHEET_NAME = 'DNTT_GK_DN_CT';

/** Sheet phiếu cân, dùng để tra "Ngày cân 1" theo "Số CT" — tính ngày thực hiện từ/đến cho báo cáo Thanh lý */
const PHIEUCAN_URL = 'https://docs.google.com/spreadsheets/d/1vqMVxccBA7zlAMHrGsVBydGFwZJ6QuDZW10zJ74V29g/edit';
const PHIEUCAN_SHEET_NAME = 'PhieuCan_DN';

// Định mức khối lượng dự kiến: 120 tấn/ha. Diện tích lưu ở đơn vị m2 nên chia 10.000 để ra ha.
const DINH_MUC_TAN_TREN_HA = 120;

function getSS_() {
  return SpreadsheetApp.getActiveSpreadsheet();
}

function getSheet_(name) {
  const sh = getSS_().getSheetByName(name);
  if (!sh) throw new Error('Không tìm thấy sheet: ' + name);
  return sh;
}

/**
 * Lấy sheet Draft_AnhRung, TỰ TẠO kèm tiêu đề nếu chưa tồn tại (đây là sheet mới,
 * không có sẵn trong cấu trúc Google Sheet gốc của bạn).
 */
function getOrCreateDraftAnhSheet_() {
  const ss = getSS_();
  let sh = ss.getSheetByName(SHEET_NAME.DRAFT_ANH);
  if (!sh) {
    sh = ss.insertSheet(SHEET_NAME.DRAFT_ANH);
    const header = ['ID_Draft', 'ID_HD', 'ID_RUNG', 'TenFile', 'DriveFileId', 'DriveUrl', 'GPS_Lat', 'GPS_Lng', 'DiaChiRung', 'GhiChu', 'TrangThai', 'ThoiGianTao'];
    sh.getRange(1, 1, 1, header.length).setValues([header]).setFontWeight('bold').setBackground('#34495e').setFontColor('#ffffff');
    sh.autoResizeColumns(1, header.length);
  }
  return sh;
}

/** Lấy sheet NhatKy_SuaDoi, tự tạo kèm tiêu đề nếu chưa có */
function getOrCreateNhatKySheet_() {
  const ss = getSS_();
  let sh = ss.getSheetByName(SHEET_NAME.NHAT_KY);
  if (!sh) {
    sh = ss.insertSheet(SHEET_NAME.NHAT_KY);
    const header = ['Thời gian', 'Người thực hiện', 'Hành động', 'ID_HD', 'Chi tiết'];
    sh.getRange(1, 1, 1, header.length).setValues([header]).setFontWeight('bold').setBackground('#34495e').setFontColor('#ffffff');
    sh.autoResizeColumns(1, header.length);
  }
  return sh;
}

/** Ghi 1 dòng vào nhật ký sửa đổi — gọi mỗi khi tạo/sửa/hủy/xóa/thanh lý hợp đồng */
function ghiNhatKy_(hanhDong, idHD, chiTiet) {
  try {
    const sh = getOrCreateNhatKySheet_();
    let email = '';
    try { email = Session.getActiveUser().getEmail(); } catch (e) { /* có thể không lấy được nếu chạy ẩn danh */ }
    sh.appendRow([new Date(), email, hanhDong, idHD || '', chiTiet || '']);
  } catch (e) { /* không để lỗi ghi log làm hỏng thao tác chính */ }
}

/**
 * ============================================================
 *  CACHE CHO BÁO CÁO NẶNG (Báo cáo hợp đồng / Tình hình thực hiện / Thanh lý)
 * ============================================================
 * Các báo cáo này phải quét + tính toán hàng trăm hợp đồng mỗi lần tải, rất
 * chậm nếu tính lại từ đầu mỗi lần người dùng mở trang. Giải pháp: lưu kết quả
 * đã tính vào 1 sheet ẩn "Cache_BaoCao" kèm thời điểm tính; lần sau chỉ tính
 * lại nếu có dòng MỚI trong nhật ký (NhatKy_SuaDoi) xuất hiện SAU thời điểm đó
 * — nghĩa là dữ liệu đã bị thay đổi kể từ lần tính trước. Nếu không có gì thay
 * đổi, đọc thẳng từ cache (rất nhanh, không cần quét lại sheet gốc).
 */
const CACHE_SHEET_NAME = 'Cache_BaoCao';
const CACHE_CHUNK_SIZE = 45000; // 1 ô Google Sheets chứa được ~50.000 ký tự, để dư an toàn

/** Thời điểm có thay đổi dữ liệu gần nhất, dựa vào dòng cuối cùng của nhật ký */
function layThoiGianThayDoiGanNhat_() {
  const sh = getOrCreateNhatKySheet_();
  const lastRow = sh.getLastRow();
  if (lastRow < 2) return new Date(0); // chưa có thay đổi nào ghi nhận -> luôn coi cache còn mới
  return new Date(sh.getRange(lastRow, 1).getValue());
}

function getOrCreateCacheSheet_() {
  const ss = getSS_();
  let sh = ss.getSheetByName(CACHE_SHEET_NAME);
  if (!sh) {
    sh = ss.insertSheet(CACHE_SHEET_NAME);
    sh.hideSheet();
    sh.getRange(1, 1, 1, 3).setValues([['TenCache', 'ThoiGianTao', 'DuLieuJSON (nhiều dòng nếu dài)']]);
  }
  return sh;
}

/** Lưu kết quả đã tính vào cache (tách thành nhiều dòng nếu JSON quá dài cho 1 ô) */
function luuCacheBaoCao_(tenCache, duLieuObj) {
  try {
    const sh = getOrCreateCacheSheet_();
    const data = sh.getDataRange().getValues();
    // Xóa các dòng cache cũ của tenCache này (nếu có)
    for (let i = data.length - 1; i >= 1; i--) {
      if (data[i][0] === tenCache) sh.deleteRow(i + 1);
    }
    const json = JSON.stringify(duLieuObj);
    const soDong = Math.ceil(json.length / CACHE_CHUNK_SIZE) || 1;
    const rows = [];
    for (let i = 0; i < soDong; i++) {
      rows.push([tenCache, i === 0 ? new Date().toISOString() : '', json.substr(i * CACHE_CHUNK_SIZE, CACHE_CHUNK_SIZE)]);
    }
    sh.getRange(sh.getLastRow() + 1, 1, rows.length, 3).setValues(rows);
  } catch (e) { /* lỗi lưu cache không được làm hỏng kết quả chính — bỏ qua, lần sau tính lại từ đầu */ }
}

/** Đọc cache đã lưu, trả về null nếu chưa có hoặc đã cũ (có thay đổi mới hơn) */
function docCacheBaoCao_(tenCache) {
  try {
    const sh = getOrCreateCacheSheet_();
    const data = sh.getDataRange().getValues();
    const dongCuaCache = data.filter(function (r) { return r[0] === tenCache; });
    if (!dongCuaCache.length) return null;

    const thoiGianTao = new Date(dongCuaCache[0][1]);
    const thoiGianThayDoi = layThoiGianThayDoiGanNhat_();
    if (thoiGianThayDoi > thoiGianTao) return null; // đã có thay đổi mới hơn -> cache cũ, phải tính lại

    const json = dongCuaCache.map(function (r) { return r[2]; }).join('');
    return JSON.parse(json);
  } catch (e) {
    return null; // đọc lỗi (JSON hỏng, sheet lỗi...) -> coi như không có cache, tính lại từ đầu
  }
}

/**
 * Lấy kết quả báo cáo — dùng cache nếu còn mới, tính lại nếu cache cũ/chưa có/bị ép làm mới.
 * hamTinh: function không tham số, trả về dữ liệu cần cache (phải là JSON-serializable).
 * boBuoc: true = luôn tính lại bất kể cache (dùng cho nút "Làm mới cưỡng bức" nếu cần).
 */
function layHoacTinhBaoCao_(tenCache, hamTinh, boBuoc) {
  if (!boBuoc) {
    const cached = docCacheBaoCao_(tenCache);
    if (cached !== null) return { tuCache: true, duLieu: cached };
  }
  const ketQua = hamTinh();
  luuCacheBaoCao_(tenCache, ketQua);
  return { tuCache: false, duLieu: ketQua };
}

/** Đọc toàn bộ dữ liệu (trừ header) của 1 sheet, trả về mảng 2 chiều */
function readData_(sheetName) {
  const sh = getSheet_(sheetName);
  const lastRow = sh.getLastRow();
  if (lastRow < 2) return [];
  return sh.getRange(2, 1, lastRow - 1, sh.getLastColumn()).getValues();
}
