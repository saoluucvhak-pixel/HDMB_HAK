/**
 * ============================================================
 *  20_ChuyenDoiAnhURL.gs
 *  Khắc phục tận gốc việc "Xem chi tiết" chậm/treo khi hiện ảnh/hồ sơ pháp lý.
 *
 *  NGUYÊN NHÂN: resolveDriveLink_() (06_CreateUpdate.gs) với MỖI ô trong
 *  HD_Picture/HD_RUNG.DinhKemGiayTo chỉ lưu TÊN FILE (dữ liệu cũ) phải gọi
 *  DriveApp.getFilesByName() để tìm URL thật — lệnh Drive API CHẬM. Giải pháp:
 *  ghi đè thẳng URL thật vào ô — từ đó về sau đọc lại NHANH TỨC THÌ.
 *
 *  ⚠️ ĐÃ SỬA: 2 hàm chính TRƯỚC ĐÂY gọi thẳng SpreadsheetApp.getUi().alert() —
 *  sẽ LỖI nếu gọi từ trigger tự động hoặc từ webapp (không có UI Sheets trong
 *  2 ngữ cảnh đó). Giờ tách: hàm chính chỉ TRẢ VỀ kết quả (an toàn mọi nơi),
 *  còn "_TU_MENU" là bản riêng cho menu Sheets mới hiện popup.
 *
 *  CHẠY ĐỊNH KỲ: vì ảnh/hồ sơ mới có thể vẫn được thêm dạng "chỉ tên file" (vd
 *  nếu có đường ghi dữ liệu nào đó bỏ sót), nên có thể bật TRIGGER TỰ ĐỘNG chạy
 *  định kỳ (mặc định 6 tiếng/lần) — vì hàm chỉ xử lý Ô CHƯA LÀ URL (bỏ qua ô đã
 *  xong), chạy lại nhiều lần rất rẻ (gần như không có gì để làm nếu đã xong hết
 *  từ trước), an toàn để đặt chạy định kỳ dài hạn.
 * ============================================================
 */

// ⚠️ HIỆU NĂNG: đọc/ghi theo KHỐI 300 dòng/lượt thay vì từng dòng riêng lẻ —
// giảm số lượt gọi API Sheets từ O(số dòng) xuống O(số dòng/300). Vẫn kiểm
// tra ngưỡng thời gian an toàn cho TỪNG DÒNG bên trong khối (không phải mỗi
// khối) vì resolveDriveLink_() gọi Drive API — 1 khối 300 dòng có thể vẫn
// mất nhiều phút nếu hầu hết ô đều phải tra Drive, nên phải dừng được giữa
// chừng 1 khối, không chỉ giữa các khối.
const KICH_THUOC_KHOI_URL_ = 300;

function CHUYEN_DOI_TEN_FILE_ANH_SANG_URL_() {
  // Không kiểm tra quyền ở đây: hàm nội bộ (đuôi _) — trang web chỉ gọi được qua api() (đã kiểm tra quyền),
  // còn trigger / bot Telegram gọi thẳng khi KHÔNG có người đăng nhập -> kiểm tra ở đây sẽ chặn nhầm lượt chạy tự động.
  const GIOI_HAN_THOI_GIAN_MS = 4.5 * 60 * 1000;
  const batDau = new Date().getTime();
  const props = PropertiesService.getScriptProperties();

  const sh = getSheet_(SHEET_NAME.HD_PICTURE);
  const lastRow = sh.getLastRow();
  if (lastRow < 2) return { thanhCong: true, xongHet: true, thongBao: 'HD_Picture chưa có dữ liệu.' };

  let dongBatDau = Number(props.getProperty('CHUYEN_DOI_ANH_DONG_TIEP_THEO') || 2);
  let soDaChuyen = Number(props.getProperty('CHUYEN_DOI_ANH_SO_DA_CHUYEN') || 0);
  let soKhongTimThay = Number(props.getProperty('CHUYEN_DOI_ANH_SO_KHONG_THAY') || 0);

  if (dongBatDau > lastRow) {
    props.deleteProperty('CHUYEN_DOI_ANH_DONG_TIEP_THEO');
    props.deleteProperty('CHUYEN_DOI_ANH_SO_DA_CHUYEN');
    props.deleteProperty('CHUYEN_DOI_ANH_SO_KHONG_THAY');
    dongBatDau = 2; soDaChuyen = 0; soKhongTimThay = 0;
  }

  const cotBatDau = PICTURE_COL.PICTURE_START + 1, soCot = PICTURE_COL.PICTURE_END - PICTURE_COL.PICTURE_START + 1;
  let dongCuoiDaXuLy = dongBatDau - 1;
  let dungSom = false;
  for (let dongKhoi = dongBatDau; dongKhoi <= lastRow; dongKhoi += KICH_THUOC_KHOI_URL_) {
    if (dungSom) break;
    const soDongKhoi = Math.min(KICH_THUOC_KHOI_URL_, lastRow - dongKhoi + 1);
    const khoi = sh.getRange(dongKhoi, cotBatDau, soDongKhoi, soCot).getValues();
    let coDoiTrongKhoi = false;

    for (let i = 0; i < soDongKhoi; i++) {
      if (new Date().getTime() - batDau > GIOI_HAN_THOI_GIAN_MS) { dungSom = true; break; }
      const hang = khoi[i];
      for (let j = 0; j < hang.length; j++) {
        const v = (hang[j] || '').toString().trim();
        if (!v || v.indexOf('http') === 0) continue;
        const link = resolveDriveLink_(v);
        if (link && link.url) { hang[j] = link.url; coDoiTrongKhoi = true; soDaChuyen++; }
        else soKhongTimThay++;
      }
      dongCuoiDaXuLy = dongKhoi + i;
    }

    // Ghi lại CẢ KHỐI đã đọc bằng 1 lệnh duy nhất — dòng chưa kịp xử lý (nếu dừng
    // giữa chừng) vẫn còn nguyên giá trị gốc trong `khoi` nên ghi lại không đổi gì.
    if (coDoiTrongKhoi) sh.getRange(dongKhoi, cotBatDau, soDongKhoi, soCot).setValues(khoi);
  }

  const xongHet = dongCuoiDaXuLy >= lastRow;
  if (xongHet) {
    props.deleteProperty('CHUYEN_DOI_ANH_DONG_TIEP_THEO');
    props.setProperty('CHUYEN_DOI_ANH_SO_DA_CHUYEN', soDaChuyen.toString());
    props.setProperty('CHUYEN_DOI_ANH_SO_KHONG_THAY', soKhongTimThay.toString());
    return {
      thanhCong: true, xongHet: true, soDaChuyen: soDaChuyen, soKhongTimThay: soKhongTimThay,
      thongBao: '✅ HOÀN TẤT — đã chuyển ' + soDaChuyen + ' ô từ tên file sang URL thật. ⚠️ Không tìm thấy file trên Drive: ' + soKhongTimThay + ' ô (giữ nguyên).'
    };
  }
  props.setProperty('CHUYEN_DOI_ANH_DONG_TIEP_THEO', (dongCuoiDaXuLy + 1).toString());
  props.setProperty('CHUYEN_DOI_ANH_SO_DA_CHUYEN', soDaChuyen.toString());
  props.setProperty('CHUYEN_DOI_ANH_SO_KHONG_THAY', soKhongTimThay.toString());
  return {
    thanhCong: true, xongHet: false, dongCuoiDaXuLy: dongCuoiDaXuLy, lastRow: lastRow, soDaChuyen: soDaChuyen,
    thongBao: '⏸️ Đã xử lý tới dòng ' + dongCuoiDaXuLy + '/' + lastRow + ' (đã chạm ngưỡng an toàn 4.5 phút). Đã chuyển: ' + soDaChuyen + ' ô. 👉 Chạy lại để tiếp tục từ dòng ' + (dongCuoiDaXuLy + 1) + '.'
  };
}

/** Bản gọi từ menu Google Sheets — hiện popup, KHÔNG dùng được từ trigger/webapp. */
function CHUYEN_DOI_TEN_FILE_ANH_SANG_URL_TU_MENU() {
  _yeuCauQuyen_(QUYEN.QUAN_TRI);
  const kq = CHUYEN_DOI_TEN_FILE_ANH_SANG_URL_();
  SpreadsheetApp.getUi().alert(kq.thongBao + (kq.xongHet ? '\n\nTừ giờ "Xem chi tiết" sẽ hiện ảnh NGAY, không còn phải chờ tra cứu Drive nữa.' : '\n\n👉 BẤM LẠI CHÍNH MENU NÀY để tiếp tục.'));
}

/**
 * Y HỆT CHUYEN_DOI_TEN_FILE_ANH_SANG_URL_() nhưng áp dụng cho cột DinhKemGiayTo
 * trong HD_RUNG (hồ sơ pháp lý — CCCD/GCN QSDĐ/giấy xác nhận nguồn gốc...) —
 * cùng 1 vấn đề: ô lưu tên file/đường dẫn cũ (không phải URL) khiến mỗi lần
 * bấm "Xem chi tiết" phải tra Drive chậm. Ghi đè URL thật 1 lần cho nhanh vĩnh viễn.
 *
 * LƯU Ý: dữ liệu DinhKemGiayTo của bạn có dạng đường dẫn lạ kiểu
 * "HD_RUNG_Files_/HAK293_1.DinhKemGiayTo.0..." — đây CÓ THỂ không khớp với tên
 * file thật nào trên Drive (khả năng cao là dữ liệu từ 1 lượt import cũ, tên
 * file gốc đã KHÔNG được giữ lại đúng). Nếu vậy, hàm này sẽ báo "Không tìm
 * thấy file" cho phần lớn — không phải lỗi của hàm, mà là dữ liệu gốc đã mất
 * liên kết thật tới file trên Drive, cần bạn xác nhận lại người mở nộp hồ sơ
 * gốc.
 */
function CHUYEN_DOI_HO_SO_PHAP_LY_SANG_URL_() {
  // Không kiểm tra quyền ở đây: hàm nội bộ (đuôi _) — trang web chỉ gọi được qua api() (đã kiểm tra quyền),
  // còn trigger / bot Telegram gọi thẳng khi KHÔNG có người đăng nhập -> kiểm tra ở đây sẽ chặn nhầm lượt chạy tự động.
  const GIOI_HAN_THOI_GIAN_MS = 4.5 * 60 * 1000;
  const batDau = new Date().getTime();
  const props = PropertiesService.getScriptProperties();

  const sh = getSheet_(SHEET_NAME.HD_RUNG);
  const lastRow = sh.getLastRow();
  if (lastRow < 2) return { thanhCong: true, xongHet: true, thongBao: 'HD_RUNG chưa có dữ liệu.' };

  let dongBatDau = Number(props.getProperty('CHUYEN_DOI_HOSO_DONG_TIEP_THEO') || 2);
  let soDaChuyen = Number(props.getProperty('CHUYEN_DOI_HOSO_SO_DA_CHUYEN') || 0);
  let soKhongTimThay = Number(props.getProperty('CHUYEN_DOI_HOSO_SO_KHONG_THAY') || 0);
  const dsKhongTimThay = [];

  if (dongBatDau > lastRow) {
    props.deleteProperty('CHUYEN_DOI_HOSO_DONG_TIEP_THEO');
    props.deleteProperty('CHUYEN_DOI_HOSO_SO_DA_CHUYEN');
    props.deleteProperty('CHUYEN_DOI_HOSO_SO_KHONG_THAY');
    dongBatDau = 2; soDaChuyen = 0; soKhongTimThay = 0;
  }

  const cotDinhKem = RUNG_COL.DINH_KEM_GIAY_TO + 1;
  let dongCuoiDaXuLy = dongBatDau - 1;
  let dungSom = false;
  for (let dongKhoi = dongBatDau; dongKhoi <= lastRow; dongKhoi += KICH_THUOC_KHOI_URL_) {
    if (dungSom) break;
    const soDongKhoi = Math.min(KICH_THUOC_KHOI_URL_, lastRow - dongKhoi + 1);
    const khoi = sh.getRange(dongKhoi, cotDinhKem, soDongKhoi, 1).getValues();
    let coDoiTrongKhoi = false;

    for (let i = 0; i < soDongKhoi; i++) {
      if (new Date().getTime() - batDau > GIOI_HAN_THOI_GIAN_MS) { dungSom = true; break; }
      const dong = dongKhoi + i;
      const v = (khoi[i][0] || '').toString().trim();
      dongCuoiDaXuLy = dong;
      if (!v || v.indexOf('http') === 0) continue;

      const link = resolveDriveLink_(v);
      if (link && link.url) {
        khoi[i][0] = link.url;
        coDoiTrongKhoi = true;
        soDaChuyen++;
      } else {
        soKhongTimThay++;
        if (dsKhongTimThay.length < 5) dsKhongTimThay.push({ dong: dong, giaTriGoc: v });
      }
    }

    // Ghi lại CẢ KHỐI bằng 1 lệnh — dòng chưa kịp xử lý (nếu dừng giữa chừng)
    // vẫn còn nguyên giá trị gốc trong `khoi` nên ghi lại không đổi gì.
    if (coDoiTrongKhoi) sh.getRange(dongKhoi, cotDinhKem, soDongKhoi, 1).setValues(khoi);
  }

  const xongHet = dongCuoiDaXuLy >= lastRow;
  if (xongHet) {
    props.deleteProperty('CHUYEN_DOI_HOSO_DONG_TIEP_THEO');
    let thongBao = '✅ HOÀN TẤT — đã chuyển ' + soDaChuyen + ' ô DinhKemGiayTo từ tên file/đường dẫn sang URL thật. ⚠️ Không tìm thấy file trên Drive: ' + soKhongTimThay + ' ô (giữ nguyên giá trị cũ).';
    if (dsKhongTimThay.length) {
      thongBao += ' Ví dụ vài dòng không tìm thấy: ' + dsKhongTimThay.map(function (x) { return 'Dòng ' + x.dong + ': "' + x.giaTriGoc + '"'; }).join('; ') + '.';
    }
    return { thanhCong: true, xongHet: true, soDaChuyen: soDaChuyen, soKhongTimThay: soKhongTimThay, dsKhongTimThay: dsKhongTimThay, thongBao: thongBao };
  }
  props.setProperty('CHUYEN_DOI_HOSO_DONG_TIEP_THEO', (dongCuoiDaXuLy + 1).toString());
  props.setProperty('CHUYEN_DOI_HOSO_SO_DA_CHUYEN', soDaChuyen.toString());
  props.setProperty('CHUYEN_DOI_HOSO_SO_KHONG_THAY', soKhongTimThay.toString());
  return {
    thanhCong: true, xongHet: false, dongCuoiDaXuLy: dongCuoiDaXuLy, lastRow: lastRow, soDaChuyen: soDaChuyen,
    thongBao: '⏸️ Đã xử lý tới dòng ' + dongCuoiDaXuLy + '/' + lastRow + ' (đã chạm ngưỡng an toàn 4.5 phút). Đã chuyển: ' + soDaChuyen + ' ô. 👉 Chạy lại để tiếp tục.'
  };
}

/** Bản gọi từ menu Google Sheets — hiện popup, KHÔNG dùng được từ trigger/webapp. */
function CHUYEN_DOI_HO_SO_PHAP_LY_SANG_URL_TU_MENU() {
  _yeuCauQuyen_(QUYEN.QUAN_TRI);
  const kq = CHUYEN_DOI_HO_SO_PHAP_LY_SANG_URL_();
  SpreadsheetApp.getUi().alert(kq.thongBao + (kq.xongHet ? '' : '\n\n👉 BẤM LẠI CHÍNH MENU NÀY để tiếp tục.'));
}

/**
 * ============ CHẠY ĐỊNH KỲ TỰ ĐỘNG (trigger) ============
 * Gọi CẢ 2 hàm chuyển đổi (ảnh + hồ sơ pháp lý) lần lượt — an toàn chạy định
 * kỳ vì cả 2 hàm chỉ xử lý ô CHƯA LÀ URL, gần như không tốn gì nếu đã xong hết
 * từ lần chạy trước. Không dùng ui.alert() (trigger không có UI) — ghi log qua
 * ghiNhatKy_() đã có sẵn để còn xem lại lịch sử chạy trong NhatKy_SuaDoi.
 */
function chuyenDoiAnhVaHoSoDinhKy_() {
  try {
    const kq1 = CHUYEN_DOI_TEN_FILE_ANH_SANG_URL_();
    const kq2 = CHUYEN_DOI_HO_SO_PHAP_LY_SANG_URL_();
    ghiNhatKy_('Chuyển đổi ảnh/hồ sơ sang URL (định kỳ)', '', 'Ảnh: ' + kq1.thongBao + ' | Hồ sơ: ' + kq2.thongBao);
  } catch (e) {
    ghiNhatKy_('LỖI chuyển đổi ảnh/hồ sơ sang URL (định kỳ)', '', e.message);
  }
}

/** Menu Sheet (webapp gọi THIET_LAP_TRIGGER_CHUYEN_DOI_ANH_URL_ qua api()). */
function THIET_LAP_TRIGGER_CHUYEN_DOI_ANH_URL() {
  _yeuCauQuyen_(QUYEN.QUAN_TRI);
  return THIET_LAP_TRIGGER_CHUYEN_DOI_ANH_URL_();
}

/** Bật chạy định kỳ (mặc định 6 tiếng/lần) — gọi từ menu Sheets hoặc webapp */
function THIET_LAP_TRIGGER_CHUYEN_DOI_ANH_URL_() {
  _yeuCauQuyen_(QUYEN.QUAN_TRI);
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'chuyenDoiAnhVaHoSoDinhKy_') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('chuyenDoiAnhVaHoSoDinhKy_').timeBased().everyHours(6).create();
  return { thanhCong: true, thongBao: 'Đã bật chạy định kỳ (6 tiếng/lần) cho việc chuyển tên file ảnh/hồ sơ pháp lý sang URL thật.' };
}

/** Tắt chạy định kỳ */
function TAT_TRIGGER_CHUYEN_DOI_ANH_URL_() {
  _yeuCauQuyen_(QUYEN.QUAN_TRI);
  let daXoa = false;
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'chuyenDoiAnhVaHoSoDinhKy_') { ScriptApp.deleteTrigger(t); daXoa = true; }
  });
  return { thanhCong: true, thongBao: daXoa ? 'Đã tắt chạy định kỳ.' : 'Chưa từng bật chạy định kỳ, không có gì để tắt.' };
}

/** Kiểm tra đã bật chạy định kỳ hay chưa — dùng để hiện trạng thái trên webapp */
function KIEM_TRA_TRIGGER_CHUYEN_DOI_ANH_URL_() {
  _yeuCauQuyen_(QUYEN.QUAN_TRI);
  const daBat = ScriptApp.getProjectTriggers().some(function (t) { return t.getHandlerFunction() === 'chuyenDoiAnhVaHoSoDinhKy_'; });
  return { daBat: daBat };
}
