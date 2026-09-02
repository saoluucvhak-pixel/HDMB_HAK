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
  NHAT_KY:    'NhatKy_SuaDoi',     // sheet nhật ký ghi lại mọi thay đổi hợp đồng (tự tạo)
  DRAFT_BAOCAO: 'Draft_BaoCaoHopDong' // sheet nháp tổng hợp sẵn 1 dòng/hợp đồng cho MỌI báo cáo — cập nhật ngay khi có thay đổi, không cần tính lại khi xem báo cáo
};

/** Cột của sheet Draft_BaoCaoHopDong — mỗi dòng = 1 hợp đồng, đủ dữ liệu cho tất cả báo cáo, tránh tính lại/trùng lặp logic giữa các báo cáo khác nhau */
const DRAFT_BAOCAO_COL = {
  ID_HD: 0, SO_HD: 1, NGAY_KY: 2, TEN_CHU_RUNG: 3, DIA_CHI_THUONG_TRU: 4, CCCD_CHU_RUNG: 5,
  NGAY_CAP: 6, NOI_CAP: 7, TEN_UY_QUYEN: 8, CCCD_UY_QUYEN: 9,
  KHOI_LUONG_DU_KIEN: 10, DON_GIA_DU_KIEN: 11, GIA_TRI_HOP_DONG: 12,
  KHOI_LUONG_THUC_HIEN: 13, DON_GIA_THUC_HIEN: 14, GIA_TRI_THUC_HIEN: 15,
  KHOI_LUONG_CON_LAI: 16, GIA_TRI_CON_LAI: 17,
  THUC_HIEN_TU_NGAY: 18, THUC_HIEN_DEN_NGAY: 19, DANH_SACH_SO_PHIEU_CAN: 20,
  TINH_TRANG: 21, SO_LO_RUNG: 22, SO_TAI_KHOAN: 23, CO_ANH: 24, DA_DO_GPS_DU: 25, HO_SO_DU: 26,
  THIEU_HO_SO_CHI_TIET: 27, TOA_DO_TRUNG_BINH: 28, DIA_CHI_RUNG: 29,
  CAP_NHAT_LUC: 30
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
  NGAY_CAP_UQ: 31, // CỘT MỞ RỘNG (không có sẵn trong file gốc) — "Ngày cấp CCCD người được ủy quyền"
  MA_SO_THUE: 32 // CỘT MỞ RỘNG — Mã số thuế của khách hàng (nếu là tổ chức/doanh nghiệp; cá nhân thường để trống, dùng CCCD thay thế khi xuất MISA)
};

// ---- HD_RUNG (con 1 - từng lô rừng của hợp đồng) ----
const RUNG_COL = {
  ID_KEY_HD: 0, MA_RUNG: 1, ID_RUNG: 2, SO_HD: 3, NGAY_KY: 4,
  TEN_CHU_RUNG: 5, CCCD: 6, THUONG_TRU: 7, DIA_CHI_RUNG: 8,
  DIEN_TICH_M2: 9, DON_GIA: 10, KHOI_LUONG_DK: 11, DIEN_TICH_GPS: 12,
  HO_SO_NGUON_GOC: 13, SO_GIAY_TO: 14, NGAY_GIAY_TO: 15,
  DINH_KEM_GIAY_TO: 16, TIMESTAMP: 17,
  KHOI_LUONG_THUC_HIEN: 18, // CỘT MỞ RỘNG (không có sẵn trong file gốc) — Apps Script tự thêm cột khi ghi lần đầu.
                           // Dùng để theo dõi khối lượng gỗ đã thực tế thu mua/giao nhận cho lô rừng này,
                           // phục vụ báo cáo "tình hình thực hiện". Nếu chưa nhập, coi như = 0 (chưa thực hiện).
  NAM_TRONG: 19 // CỘT MỞ RỘNG — năm trồng rừng (vd 2018), dùng để chatbot tự tính "tuổi rừng" = năm hiện tại - năm trồng. Để trống nếu chưa rõ.
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

// Giới hạn thời gian chạy an toàn (ms) cho các job xử lý hàng loạt, chạy lâu
// (đối chiếu OCR định kỳ ở 04_Reconciliation.gs, geocode GPS hàng loạt ở
// Code.gs...) — Apps Script tự ngắt job sau 6 phút (360000ms) nếu chạy quá
// lâu, nên các job này phải tự dừng SỚM HƠN mốc đó để kịp lưu phần đã xử lý
// và thoát an toàn, tránh mất dữ liệu/báo cáo dở dang giữa chừng.
const MAX_RUNTIME_MS = 5 * 60 * 1000; // 5 phút — chừa ~1 phút an toàn

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

/** URL file Google Sheet RIÊNG do người dùng chỉ định để lưu Draft/Cache báo cáo */
const REPORT_SPREADSHEET_URL = 'https://docs.google.com/spreadsheets/d/1G_SUfAY4xV8GZkM4JRhQbzeergRP2OO5AL89LuSnz8U/edit?usp=sharing';

/**
 * File Google Sheet RIÊNG dành cho Cache/Draft báo cáo — KHÔNG dùng chung với
 * file dữ liệu chính (HD_NCC, HD_RUNG...), để tránh rủi ro: nếu sheet cache lỡ
 * bị sửa/xóa nhầm, hoặc phình quá to, không ảnh hưởng gì đến dữ liệu gốc.
 * Dùng ĐÚNG file đã chỉ định ở REPORT_SPREADSHEET_URL — chỉ tự tạo file mới nếu
 * vì lý do gì đó không mở được file này (mất quyền truy cập, đã bị xóa...).
 * Lưu ID vào Script Properties để chống trùng (không mở lại theo URL parse mỗi
 * lần, tránh trường hợp URL đổi định dạng gây mở nhầm).
 */
let _reportSSCache = null; // bộ nhớ đệm TRONG 1 LƯỢT CHẠY — tránh mở lại file ngoài nhiều lần cùng 1 request (SpreadsheetApp.openById tốn thời gian mạng mỗi lần gọi)

/**
 * Đọc cấu hình kết nối hiện tại (file Draft báo cáo + thư mục Drive lưu ảnh) —
 * dùng cho trang Thiết lập trên webapp, để có thể XEM và ĐỔI sang dữ liệu/dự án
 * khác mà không cần sửa code.
 */
function LAY_CAU_HINH_KET_NOI() {
  const props = PropertiesService.getScriptProperties();
  const ketQua = {
    draftUrl: '', draftTen: '', draftLoi: '',
    folderUrl: '', folderTen: '', folderLoi: '',
    hoSoFolderUrl: '', hoSoFolderTen: '', hoSoFolderLoi: '',
    gpsFolderUrl: '', gpsFolderTen: '', gpsFolderLoi: '',
    misaFolderUrl: '', misaFolderTen: '', misaFolderLoi: ''
  };

  try {
    const ss = getReportSS_();
    ketQua.draftUrl = ss.getUrl();
    ketQua.draftTen = ss.getName();
  } catch (e) {
    ketQua.draftLoi = e.message;
  }

  try {
    const folder = layHoacTaoThuMucAnh_();
    ketQua.folderUrl = folder.getUrl();
    ketQua.folderTen = folder.getName();
  } catch (e) {
    ketQua.folderLoi = e.message;
  }

  try {
    const folderHoSo = layHoacTaoThuMucHoSo_();
    ketQua.hoSoFolderUrl = folderHoSo.getUrl();
    ketQua.hoSoFolderTen = folderHoSo.getName();
  } catch (e) {
    ketQua.hoSoFolderLoi = e.message;
  }

  try {
    const folderGps = layHoacTaoThuMucAnhGPS_();
    ketQua.gpsFolderUrl = folderGps.getUrl();
    ketQua.gpsFolderTen = folderGps.getName();
  } catch (e) {
    ketQua.gpsFolderLoi = e.message;
  }

  try {
    const folderMisa = layThuMucXuatMisa_();
    ketQua.misaFolderUrl = folderMisa.getUrl();
    ketQua.misaFolderTen = folderMisa.getName();
  } catch (e) {
    ketQua.misaFolderLoi = e.message;
  }

  return ketQua;
}

/**
 * Đổi cấu hình kết nối: file Draft báo cáo (Google Sheet) và/hoặc các thư mục
 * Drive (ảnh hiện trường, hồ sơ pháp lý, ảnh GPS, xuất báo cáo MISA). Truyền
 * URL rỗng để GIỮ NGUYÊN giá trị đang dùng (không đổi). Luôn xác minh mở được
 * TRƯỚC khi lưu — không lưu URL không hợp lệ.
 */
function LUU_CAU_HINH_KET_NOI(draftUrl, folderUrl, misaFolderUrl, hoSoFolderUrl, gpsFolderUrl) {
  const props = PropertiesService.getScriptProperties();
  const ketQua = { thanhCong: true, thongBao: [] };

  function trichIdThuMuc_(url) {
    const khop = url.toString().trim().match(/[-\w]{25,}/); // trích ID thư mục từ URL dạng .../folders/ID...
    return khop ? khop[0] : url.toString().trim();
  }

  if (draftUrl) {
    try {
      const ss = SpreadsheetApp.openByUrl(draftUrl.toString().trim());
      props.setProperty('REPORT_SPREADSHEET_ID', ss.getId());
      _reportSSCache = null; // xóa cache trong bộ nhớ để lần đọc sau lấy đúng file mới
      ketQua.thongBao.push('✅ Đã đổi file Draft báo cáo sang "' + ss.getName() + '".');
    } catch (e) {
      ketQua.thanhCong = false;
      ketQua.thongBao.push('❌ Không mở được URL file Draft báo cáo: ' + e.message);
    }
  }

  if (folderUrl) {
    try {
      const folder = DriveApp.getFolderById(trichIdThuMuc_(folderUrl));
      props.setProperty('ANH_FOLDER_ID', folder.getId());
      ketQua.thongBao.push('✅ Đã đổi thư mục ảnh hiện trường sang "' + folder.getName() + '".');
    } catch (e) {
      ketQua.thanhCong = false;
      ketQua.thongBao.push('❌ Không mở được URL/ID thư mục ảnh hiện trường: ' + e.message);
    }
  }

  if (hoSoFolderUrl) {
    try {
      const folderHoSo = DriveApp.getFolderById(trichIdThuMuc_(hoSoFolderUrl));
      props.setProperty('HOSO_FOLDER_ID', folderHoSo.getId());
      ketQua.thongBao.push('✅ Đã đổi thư mục hồ sơ pháp lý sang "' + folderHoSo.getName() + '".');
    } catch (e) {
      ketQua.thanhCong = false;
      ketQua.thongBao.push('❌ Không mở được URL/ID thư mục hồ sơ pháp lý: ' + e.message);
    }
  }

  if (gpsFolderUrl) {
    try {
      const folderGps = DriveApp.getFolderById(trichIdThuMuc_(gpsFolderUrl));
      props.setProperty('GPS_ANH_FOLDER_ID', folderGps.getId());
      ketQua.thongBao.push('✅ Đã đổi thư mục ảnh GPS sang "' + folderGps.getName() + '".');
    } catch (e) {
      ketQua.thanhCong = false;
      ketQua.thongBao.push('❌ Không mở được URL/ID thư mục ảnh GPS: ' + e.message);
    }
  }

  if (misaFolderUrl) {
    try {
      const folderMisa = DriveApp.getFolderById(trichIdThuMuc_(misaFolderUrl));
      props.setProperty('MISA_FOLDER_ID', folderMisa.getId());
      ketQua.thongBao.push('✅ Đã đổi thư mục xuất báo cáo MISA sang "' + folderMisa.getName() + '".');
    } catch (e) {
      ketQua.thanhCong = false;
      ketQua.thongBao.push('❌ Không mở được URL/ID thư mục MISA: ' + e.message);
    }
  }

  if (!draftUrl && !folderUrl && !misaFolderUrl && !hoSoFolderUrl && !gpsFolderUrl) ketQua.thongBao.push('Không có gì để lưu (các ô đều trống).');
  ketQua.thongBao = ketQua.thongBao.join(' ');
  return ketQua;
}

function getReportSS_() {
  if (_reportSSCache) return _reportSSCache; // đã mở rồi trong lượt chạy này -> dùng lại luôn, không mở lại

  const props = PropertiesService.getScriptProperties();
  let id = props.getProperty('REPORT_SPREADSHEET_ID');
  if (id) {
    try { _reportSSCache = SpreadsheetApp.openById(id); return _reportSSCache; } catch (e) { /* ID cũ không mở được -> thử lại từ URL chỉ định bên dưới */ }
  }
  try {
    const ss = SpreadsheetApp.openByUrl(REPORT_SPREADSHEET_URL);
    props.setProperty('REPORT_SPREADSHEET_ID', ss.getId()); // lưu lại ID để lần sau mở nhanh, chống tạo trùng
    _reportSSCache = ss;
    return ss;
  } catch (e) {
    // Không mở được file chỉ định (hiếm khi xảy ra) -> tự tạo 1 file mới để hệ thống vẫn hoạt động được
    const ssMoi = SpreadsheetApp.create('HAK_BaoCao_Cache (tự động - không xóa)');
    props.setProperty('REPORT_SPREADSHEET_ID', ssMoi.getId());
    _reportSSCache = ssMoi;
    return ssMoi;
  }
}

function getSheet_(name) {
  const sh = getSS_().getSheetByName(name);
  if (!sh) throw new Error('Không tìm thấy sheet: ' + name);
  return sh;
}

/**
 * Chuyển an toàn 1 giá trị ngày (có thể là Date object thô đọc từ getValues(),
 * chuỗi rỗng, hoặc chuỗi có sẵn) sang chuỗi ISO — BẮT BUỘC dùng trước khi đưa
 * bất kỳ trường ngày/tháng nào vào object trả về qua google.script.run.
 * LÝ DO: Date object thô nằm LỒNG BÊN TRONG object/mảng (không phải giá trị
 * trả về top-level) khi truyền qua kênh web của Apps Script có thể khiến
 * TOÀN BỘ response về client bị null — dù hàm chạy đúng khi gọi trực tiếp
 * trong Apps Script editor (xem ngayToISO_ cục bộ từng dùng ở 06_CreateUpdate.gs
 * để vá đúng lỗi này — giờ tách thành hàm DÙNG CHUNG để mọi hàm khác trong dự
 * án đều gọi được, tránh quên convert ở chỗ mới thêm sau này).
 */
function ngayToISO_(v) {
  if (!v) return '';
  try {
    const d = new Date(v);
    return isNaN(d.getTime()) ? '' : d.toISOString();
  } catch (e) { return ''; }
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

/** Đọc Nhật ký hệ thống (NhatKy_SuaDoi), lọc theo khoảng ngày [tuNgay, denNgay] —
 *  để trống 1 trong 2 nghĩa là không giới hạn phía đó. Mới nhất hiện trước. */
function LAY_NHAT_KY_THEO_NGAY(tuNgay, denNgay) {
  const sh = getOrCreateNhatKySheet_();
  const lastRow = sh.getLastRow();
  if (lastRow < 2) return [];
  const rows = sh.getRange(2, 1, lastRow - 1, 5).getValues();
  const tuNgayDate = tuNgay ? new Date(tuNgay) : null;
  const denNgayDate = denNgay ? new Date(denNgay) : null;
  if (denNgayDate) denNgayDate.setHours(23, 59, 59, 999); // lấy trọn ngày kết thúc, không cắt mất log trong ngày đó
  return rows
    .filter(function (r) {
      const ngay = new Date(r[0]);
      if (tuNgayDate && ngay < tuNgayDate) return false;
      if (denNgayDate && ngay > denNgayDate) return false;
      return true;
    })
    .map(function (r) { return { ngay: r[0] ? new Date(r[0]).toISOString() : '', email: r[1], hanhDong: r[2], idHD: r[3], chiTiet: r[4] }; })
    .sort(function (a, b) { return new Date(b.ngay || 0) - new Date(a.ngay || 0); })
    .slice(0, 500); // giới hạn 500 dòng gần nhất trong khoảng lọc, tránh trả về quá nặng nếu log rất dài
}

/**
 * ⚠️ BỔ SUNG HÀM ĐANG THIẾU: được gọi ở 4 chỗ trong dự án (layTinhHinhThucHien,
 * layBaoCaoHopDongPhanTrang, layDanhSachThanhLy, TAI_TRANG_BAO_CAO_TONG_HOP)
 * nhưng CHƯA TỪNG được định nghĩa ở đâu — nghĩa là mỗi khi 1 trong các hàm đó
 * gặp lỗi thật, gọi hàm không tồn tại này sẽ ném ra 1 lỗi MỚI ("ghiLoiBackend_
 * is not defined"), CHE MẤT lỗi gốc thật sự đã xảy ra, khiến rất khó chẩn đoán.
 * Ghi lại lỗi vào NhatKy_SuaDoi (dùng chung ghiNhatKy_ đã có sẵn) + Logger.log
 * để còn xem lại trong Execution log.
 */
function ghiLoiBackend_(tenHam, err) {
  try {
    const noiDung = (err && err.message) ? err.message : String(err);
    Logger.log('[LỖI BACKEND — ' + tenHam + '] ' + noiDung + (err && err.stack ? '\n' + err.stack : ''));
    ghiNhatKy_('LỖI backend: ' + tenHam, '', noiDung);
  } catch (e2) { /* không để lỗi ghi log làm hỏng luồng chính */ }
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
  const ss = getReportSS_(); // đổi sang file RIÊNG cho báo cáo/cache — không dùng file chính nữa
  let sh = ss.getSheetByName(CACHE_SHEET_NAME);
  if (!sh) {
    sh = ss.insertSheet(CACHE_SHEET_NAME);
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

/**
 * Đọc cache "CHỈ ĐỌC" — khác với docCacheBaoCao_ (kiểm tra hạn theo nhật ký
 * CHUNG của mọi thay đổi hợp đồng/rừng/tài khoản), hàm này đọc thẳng bất kể
 * nhật ký chung có gì mới hay không. Dùng cho dữ liệu mà độ mới của nó do 1
 * trigger RIÊNG quyết định (vd dữ liệu thanh toán DNTT_GK_DN_CT — chỉ nên làm
 * mới bởi trigger đồng bộ thanh toán 30 phút/lần, KHÔNG phải bởi việc sửa 1
 * hợp đồng bất kỳ — nếu không sẽ bị tính lại toàn bộ mỗi lần sửa 1 hợp đồng,
 * gây chậm/timeout). Nếu chưa từng có cache, tính 1 lần đầu tiên rồi lưu lại.
 */
function docCacheBaoCao_ChiDoc_(tenCache, hamTinhNeuChuaCo) {
  try {
    const sh = getOrCreateCacheSheet_();
    const data = sh.getDataRange().getValues();
    const dongCuaCache = data.filter(function (r) { return r[0] === tenCache; });
    if (dongCuaCache.length) {
      const json = dongCuaCache.map(function (r) { return r[2]; }).join('');
      return JSON.parse(json);
    }
  } catch (e) { /* rơi xuống tính mới bên dưới */ }
  const ketQua = hamTinhNeuChuaCo();
  luuCacheBaoCao_(tenCache, ketQua);
  return ketQua;
}


/**
 * ============================================================
 *  SHEET DRAFT BÁO CÁO HỢP ĐỒNG (Draft_BaoCaoHopDong)
 * ============================================================
 * Mỗi hợp đồng = 1 dòng, đã tổng hợp sẵn MỌI số liệu cần cho các báo cáo
 * (khối lượng/giá trị dự kiến-thực hiện-còn lại, ngày thực hiện, số phiếu cân,
 * trạng thái hồ sơ/GPS/ảnh...). Cập nhật NGAY LẬP TỨC mỗi khi hợp đồng/lô rừng/
 * tài khoản có thay đổi (xem các hàm CAP_NHAT_DRAFT_* gọi từ 06_CreateUpdate.gs),
 * nên các trang báo cáo chỉ cần ĐỌC thẳng sheet này — không phải tính toán lại
 * từ đầu mỗi lần mở, và không bị trùng lặp logic tính toán giữa nhiều báo cáo.
 */
function getOrCreateDraftBaoCaoSheet_() {
  const ss = getReportSS_(); // đổi sang file RIÊNG cho báo cáo/cache — không dùng file chính nữa
  let sh = ss.getSheetByName(SHEET_NAME.DRAFT_BAOCAO);
  if (!sh) {
    sh = ss.insertSheet(SHEET_NAME.DRAFT_BAOCAO);
    const header = [
      'ID_HD', 'Số HĐ', 'Ngày ký', 'Tên chủ rừng', 'Địa chỉ thường trú', 'CCCD chủ rừng',
      'Ngày cấp', 'Nơi cấp', 'Tên ủy quyền', 'CCCD ủy quyền',
      'KL dự kiến', 'Đơn giá dự kiến', 'Giá trị HĐ',
      'KL thực hiện', 'Đơn giá thực hiện', 'Giá trị thực hiện',
      'KL còn lại', 'Giá trị còn lại',
      'Thực hiện từ ngày', 'Thực hiện đến ngày', 'Danh sách số phiếu cân',
      'Tình trạng', 'Số lô rừng', 'Số tài khoản', 'Có ảnh', 'Đã đo GPS đủ', 'Hồ sơ đủ',
      'Chi tiết hồ sơ thiếu', 'Tọa độ trung bình (lat,lng)', 'Địa chỉ rừng',
      'Cập nhật lúc'
    ];
    sh.getRange(1, 1, 1, header.length).setValues([header]).setFontWeight('bold').setBackground('#34495e').setFontColor('#ffffff');
  }
  return sh;
}

/** Tìm số dòng thật của 1 hợp đồng trong sheet Draft theo ID_HD, -1 nếu chưa có */
function timDongDraftBaoCao_(sh, idHD) {
  const lastRow = sh.getLastRow();
  if (lastRow < 2) return -1;
  const ids = sh.getRange(2, DRAFT_BAOCAO_COL.ID_HD + 1, lastRow - 1, 1).getValues();
  for (let i = 0; i < ids.length; i++) {
    if ((ids[i][0] || '').toString().trim() === idHD.toString().trim()) return i + 2;
  }
  return -1;
}

/** Đọc toàn bộ dữ liệu Draft đã tổng hợp sẵn, trả về mảng object (dùng cho mọi báo cáo) */
let _draftDataCache = null; // bộ nhớ đệm TRONG 1 LƯỢT CHẠY — nếu cùng 1 request cần đọc Draft nhiều lần, chỉ đọc thật từ file ngoài đúng 1 lần

/**
 * Đọc TRỰC TIẾP HD_RUNG + HD_GPS + HD_Picture (đọc TOÀN BỘ sheet đúng 1 LẦN,
 * không đọc theo từng dòng) để tính "Có ảnh" / "Đã đo GPS đủ" / "Tọa độ trung
 * bình" THẬT — dùng làm lớp GHI ĐÈ lên Draft trong docToanBoDraftBaoCao_() và
 * layBaoCaoHoSoRung().
 *
 * LÝ DO CẦN LỚP NÀY: Draft chỉ đúng NẾU đúng hàm CAP_NHAT_DRAFT_MOT_HOP_DONG /
 * CAP_NHAT_DRAFT_HOSORUNG_MOT_DONG_ được gọi mỗi khi ảnh/GPS thay đổi. Nếu dữ
 * liệu GPS/ảnh được NHẬP THẲNG vào sheet HD_GPS/HD_Picture bằng tay (không qua
 * webapp), hoặc lỡ sót 1 hàm ghi nào đó quên gọi cập nhật Draft, Draft sẽ hiện
 * SAI (thiếu ảnh/tọa độ) dù dữ liệu gốc đã có đầy đủ. Việc đọc thẳng ở đây
 * đảm bảo báo cáo LUÔN khớp với dữ liệu THẬT trong HD_GPS/HD_Picture tại thời
 * điểm xem báo cáo — không phụ thuộc Draft có được đồng bộ đúng lúc hay không.
 * Chi phí: chỉ 3 lượt đọc TOÀN BỘ sheet (không phải đọc theo từng hợp đồng),
 * nên vẫn nhanh dù có hàng trăm/nghìn dòng.
 *
 * @return {Object} { theoIdHD: { [idHD]: {coAnh, daDoGPSDu, toaDoTrungBinh} },
 *                     theoIdRung: { [idRung]: {toaDo: {lat,lng}|null, soDiemGPS} } }
 */
function layCoAnhVaGpsTrucTiep_() {
  const rungRows = readData_(SHEET_NAME.HD_RUNG);
  const gpsRows = readData_(SHEET_NAME.HD_GPS);
  const pictureRows = readData_(SHEET_NAME.HD_PICTURE);

  // ---- Gom tọa độ GPS hợp lệ theo ID_RUNG (đúng 1 lượt đọc HD_GPS) ----
  const gpsByIdRung = {}; // { [idRung]: { latTong, lngTong, dem } }
  gpsRows.forEach(function (g) {
    const idRung = (g[GPS_COL.ID_KEY_GPS] || '').toString().trim();
    if (!idRung) return;
    const type = g[GPS_COL.HE_TOA_DO];
    const lat = (type === 'DMS') ? convertDmsToDd(g[GPS_COL.LAT]) : parseFloat(g[GPS_COL.LAT]);
    const lng = (type === 'DMS') ? convertDmsToDd(g[GPS_COL.LNG]) : parseFloat(g[GPS_COL.LNG]);
    if (isNaN(lat) || isNaN(lng)) return;
    if (!gpsByIdRung[idRung]) gpsByIdRung[idRung] = { latTong: 0, lngTong: 0, dem: 0 };
    gpsByIdRung[idRung].latTong += lat; gpsByIdRung[idRung].lngTong += lng; gpsByIdRung[idRung].dem++;
  });

  // ---- coAnh theo "định danh thô" trong HD_Picture (đúng 1 lượt đọc HD_Picture) ----
  // ⚠️ Không dùng thẳng làm coAnhByIdHD nữa: đã phát hiện một số dòng CŨ trong
  // HD_Picture lưu NHẦM giá trị ID_RUNG vào cột ID_HD (xác nhận qua đối chiếu
  // trực tiếp dữ liệu thật — xem layAnhCuaHopDong() ở 06_CreateUpdate.gs). Nên
  // giữ nguyên "định danh thô" (có thể là ID_HD thật HOẶC lỡ là ID_RUNG) rồi
  // đối chiếu lại theo CẢ HAI khả năng ở bước gộp theo hợp đồng bên dưới.
  const coAnhByDinhDanhTho = {};
  pictureRows.forEach(function (r) {
    const dinhDanh = (r[PICTURE_COL.ID_HD] || '').toString().trim();
    if (!dinhDanh || coAnhByDinhDanhTho[dinhDanh]) return;
    for (let c = PICTURE_COL.PICTURE_START; c <= PICTURE_COL.PICTURE_END; c++) { if (r[c]) { coAnhByDinhDanhTho[dinhDanh] = true; break; } }
  });

  // ---- Gộp theo ID_HD: số lô, số lô đã đo GPS, có ảnh không, tọa độ trung bình toàn hợp đồng ----
  const goptheoIdHD = {};
  rungRows.forEach(function (r) {
    const idHD = (r[RUNG_COL.ID_KEY_HD] || '').toString().trim();
    const idRung = (r[RUNG_COL.ID_RUNG] || '').toString().trim();
    if (!idHD || !idRung) return;
    if (!goptheoIdHD[idHD]) goptheoIdHD[idHD] = { soLo: 0, soLoDaDoGPS: 0, latTong: 0, lngTong: 0, demDiem: 0, coAnh: false };
    const g = goptheoIdHD[idHD];
    g.soLo++;
    // Khớp coAnh theo ID_HD thật HOẶC theo chính ID_RUNG của lô này (phòng dữ
    // liệu cũ lưu nhầm ID_RUNG vào cột ID_HD trong HD_Picture)
    if (coAnhByDinhDanhTho[idHD] || coAnhByDinhDanhTho[idRung]) g.coAnh = true;
    const gpsRung = gpsByIdRung[idRung];
    if (gpsRung && gpsRung.dem > 0) {
      g.soLoDaDoGPS++;
      g.latTong += gpsRung.latTong; g.lngTong += gpsRung.lngTong; g.demDiem += gpsRung.dem;
    }
  });

  const theoIdHD = {};
  Object.keys(goptheoIdHD).forEach(function (idHD) {
    const g = goptheoIdHD[idHD];
    theoIdHD[idHD] = {
      coAnh: g.coAnh,
      daDoGPSDu: g.soLo > 0 && g.soLoDaDoGPS === g.soLo,
      toaDoTrungBinh: g.demDiem ? (g.latTong / g.demDiem).toFixed(6) + ',' + (g.lngTong / g.demDiem).toFixed(6) : ''
    };
  });

  const theoIdRung = {};
  Object.keys(gpsByIdRung).forEach(function (idRung) {
    const p = gpsByIdRung[idRung];
    theoIdRung[idRung] = {
      toaDo: p.dem ? { lat: p.latTong / p.dem, lng: p.lngTong / p.dem } : null,
      soDiemGPS: p.dem
    };
  });

  return { theoIdHD: theoIdHD, theoIdRung: theoIdRung };
}

function docToanBoDraftBaoCao_() {
  if (_draftDataCache) return _draftDataCache; // đã đọc rồi trong lượt chạy này -> dùng lại luôn

  const sh = getOrCreateDraftBaoCaoSheet_();
  const lastRow = sh.getLastRow();
  if (lastRow < 2) { _draftDataCache = []; return _draftDataCache; }
  const data = sh.getRange(2, 1, lastRow - 1, sh.getLastColumn()).getValues();
  const c = DRAFT_BAOCAO_COL;
  _draftDataCache = data.map(function (r) {
    return {
      idHD: r[c.ID_HD], soHD: r[c.SO_HD], ngayKy: ngayToISO_(r[c.NGAY_KY]), tenChuRung: r[c.TEN_CHU_RUNG],
      diaChiThuongTru: r[c.DIA_CHI_THUONG_TRU], cccdChuRung: r[c.CCCD_CHU_RUNG],
      ngayCap: ngayToISO_(r[c.NGAY_CAP]), noiCap: r[c.NOI_CAP], tenUyQuyen: r[c.TEN_UY_QUYEN], cccdUyQuyen: r[c.CCCD_UY_QUYEN],
      khoiLuongDuKien: r[c.KHOI_LUONG_DU_KIEN], donGiaDuKien: r[c.DON_GIA_DU_KIEN], giaTriHopDong: r[c.GIA_TRI_HOP_DONG],
      khoiLuongThucHien: r[c.KHOI_LUONG_THUC_HIEN], donGiaThucHien: r[c.DON_GIA_THUC_HIEN], giaTriThucHien: r[c.GIA_TRI_THUC_HIEN],
      khoiLuongConLai: r[c.KHOI_LUONG_CON_LAI], giaTriConLai: r[c.GIA_TRI_CON_LAI],
      // ⚠️ Đã sửa: TRƯỚC ĐÂY trả về Date object thô (r[...] || null) — Date thô lồng
      // trong mảng object khi trả qua google.script.run có thể khiến CẢ response về
      // client bị null (đây là nguyên nhân trang "Báo cáo tổng hợp" bị kẹt ở
      // "Đang tải báo cáo..." mà không có lỗi rõ ràng). Giờ luôn trả chuỗi ISO
      // ('' nếu trống) — phía frontend đã dùng new Date(...) để hiển thị nên
      // parse chuỗi ISO vẫn ra đúng ngày, không cần sửa gì ở HTML.
      thucHienTuNgay: ngayToISO_(r[c.THUC_HIEN_TU_NGAY]), thucHienDenNgay: ngayToISO_(r[c.THUC_HIEN_DEN_NGAY]),
      danhSachSoPhieuCan: r[c.DANH_SACH_SO_PHIEU_CAN],
      tinhTrang: r[c.TINH_TRANG], soLoRung: r[c.SO_LO_RUNG], soTaiKhoan: r[c.SO_TAI_KHOAN],
      coAnh: !!r[c.CO_ANH], daDoGPSDu: !!r[c.DA_DO_GPS_DU], hoSoDu: !!r[c.HO_SO_DU],
      thieuHoSoChiTiet: r[c.THIEU_HO_SO_CHI_TIET] || '', toaDoTrungBinh: r[c.TOA_DO_TRUNG_BINH] || '',
      diaChiRung: r[c.DIA_CHI_RUNG] || ''
    };
  });

  // ---- GHI ĐÈ coAnh/daDoGPSDu/toaDoTrungBinh bằng dữ liệu đọc THẲNG từ
  // HD_GPS/HD_Picture (xem layCoAnhVaGpsTrucTiep_ ở trên) — đảm bảo báo cáo luôn
  // khớp với dữ liệu THẬT, không phụ thuộc Draft có được đồng bộ đúng lúc hay
  // không (vd dữ liệu GPS/ảnh được nhập thẳng vào sheet bằng tay, hoặc 1 hàm
  // ghi nào đó lỡ quên gọi cập nhật Draft).
  try {
    const truc = layCoAnhVaGpsTrucTiep_();
    _draftDataCache.forEach(function (m) {
      const tt = truc.theoIdHD[(m.idHD || '').toString().trim()];
      if (tt) { m.coAnh = tt.coAnh; m.daDoGPSDu = tt.daDoGPSDu; m.toaDoTrungBinh = tt.toaDoTrungBinh; }
    });
  } catch (e) { /* nếu đọc lỗi thì giữ nguyên giá trị từ Draft, không làm hỏng cả báo cáo */ }

  return _draftDataCache;
}


/** Đọc toàn bộ dữ liệu (trừ header) của 1 sheet, trả về mảng 2 chiều */
function readData_(sheetName) {
  const sh = getSheet_(sheetName);
  const lastRow = sh.getLastRow();
  if (lastRow < 2) return [];
  return sh.getRange(2, 1, lastRow - 1, sh.getLastColumn()).getValues();
}
