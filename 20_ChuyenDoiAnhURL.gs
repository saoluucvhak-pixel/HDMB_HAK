/**
 * ============================================================
 *  20_ChuyenDoiAnhURL.gs
 *  Chạy 1 LẦN để khắc phục tận gốc việc "Xem chi tiết" rất chậm khi hiện ảnh.
 *
 *  NGUYÊN NHÂN: resolveDriveLink_() (06_CreateUpdate.gs) — dùng bởi
 *  layAnhCuaHopDong() mỗi khi bấm "Xem chi tiết" — với MỖI ô trong HD_Picture
 *  chỉ lưu TÊN FILE (dữ liệu cũ, từ trước khi code lưu URL đầy đủ), phải gọi
 *  DriveApp.getFilesByName() để tìm URL thật — đây là lệnh Drive API CHẬM
 *  (khoảng vài trăm ms/lần). Chẩn đoán cho thấy MỌI ô đều tìm được file (0 lỗi)
 *  — nghĩa là vấn đề không phải "không có link", mà là phải tra cứu Drive
 *  SỐNG mỗi lần xem báo cáo, với hàng trăm ô thì cộng dồn thành rất chậm/treo.
 *
 *  GIẢI PHÁP: chạy 1 LẦN DUY NHẤT, GHI ĐÈ thẳng URL thật vào ô (thay vì chỉ
 *  tên file) — từ đó về sau, resolveDriveLink_() gặp ô đã là URL sẽ trả về
 *  NGAY LẬP TỨC (nhánh "v.indexOf('http')===0"), không cần gọi Drive nữa.
 *  Chạy TỰ ĐỘNG TIẾP TỤC (giống XAY_DUNG_LAI_TOAN_BO_DRAFT) nếu chạm ngưỡng an
 *  toàn 4.5 phút, để không bị Apps Script ngắt giữa chừng với dữ liệu lớn.
 * ============================================================
 */
function CHUYEN_DOI_TEN_FILE_ANH_SANG_URL() {
  const GIOI_HAN_THOI_GIAN_MS = 4.5 * 60 * 1000;
  const batDau = new Date().getTime();
  const props = PropertiesService.getScriptProperties();

  const sh = getSheet_(SHEET_NAME.HD_PICTURE);
  const lastRow = sh.getLastRow();
  if (lastRow < 2) { SpreadsheetApp.getUi().alert('HD_Picture chưa có dữ liệu.'); return; }

  let dongBatDau = Number(props.getProperty('CHUYEN_DOI_ANH_DONG_TIEP_THEO') || 2);
  let soDaChuyen = Number(props.getProperty('CHUYEN_DOI_ANH_SO_DA_CHUYEN') || 0);
  let soKhongTimThay = Number(props.getProperty('CHUYEN_DOI_ANH_SO_KHONG_THAY') || 0);

  if (dongBatDau > lastRow) {
    // Đã chạy xong hết từ trước — reset để có thể chạy lại từ đầu nếu cần (vd sau khi thêm ảnh mới kiểu tên file)
    props.deleteProperty('CHUYEN_DOI_ANH_DONG_TIEP_THEO');
    props.deleteProperty('CHUYEN_DOI_ANH_SO_DA_CHUYEN');
    props.deleteProperty('CHUYEN_DOI_ANH_SO_KHONG_THAY');
    dongBatDau = 2; soDaChuyen = 0; soKhongTimThay = 0;
  }

  let dongCuoiDaXuLy = dongBatDau - 1;
  for (let dong = dongBatDau; dong <= lastRow; dong++) {
    if (new Date().getTime() - batDau > GIOI_HAN_THOI_GIAN_MS) break; // dừng an toàn, sẽ tự chạy tiếp nếu bấm lại menu

    const hang = sh.getRange(dong, PICTURE_COL.PICTURE_START + 1, 1, PICTURE_COL.PICTURE_END - PICTURE_COL.PICTURE_START + 1).getValues()[0];
    let coDoi = false;
    for (let i = 0; i < hang.length; i++) {
      const v = (hang[i] || '').toString().trim();
      if (!v || v.indexOf('http') === 0) continue; // trống hoặc đã là URL rồi -> bỏ qua, không tốn Drive API
      const link = resolveDriveLink_(v);
      if (link && link.url) { hang[i] = link.url; coDoi = true; soDaChuyen++; }
      else soKhongTimThay++;
    }
    if (coDoi) sh.getRange(dong, PICTURE_COL.PICTURE_START + 1, 1, hang.length).setValues([hang]);
    dongCuoiDaXuLy = dong;
  }

  if (dongCuoiDaXuLy >= lastRow) {
    props.deleteProperty('CHUYEN_DOI_ANH_DONG_TIEP_THEO');
    props.setProperty('CHUYEN_DOI_ANH_SO_DA_CHUYEN', soDaChuyen.toString());
    props.setProperty('CHUYEN_DOI_ANH_SO_KHONG_THAY', soKhongTimThay.toString());
    SpreadsheetApp.getUi().alert('✅ HOÀN TẤT — đã chuyển ' + soDaChuyen + ' ô từ tên file sang URL thật.\n⚠️ Không tìm thấy file trên Drive: ' + soKhongTimThay + ' ô (giữ nguyên, "Xem chi tiết" sẽ hiện "không tìm thấy file").\n\nTừ giờ "Xem chi tiết" sẽ hiện ảnh NGAY, không còn phải chờ tra cứu Drive nữa.');
  } else {
    props.setProperty('CHUYEN_DOI_ANH_DONG_TIEP_THEO', (dongCuoiDaXuLy + 1).toString());
    props.setProperty('CHUYEN_DOI_ANH_SO_DA_CHUYEN', soDaChuyen.toString());
    props.setProperty('CHUYEN_DOI_ANH_SO_KHONG_THAY', soKhongTimThay.toString());
    SpreadsheetApp.getUi().alert('⏸️ Đã xử lý tới dòng ' + dongCuoiDaXuLy + '/' + lastRow + ' (đã chạm ngưỡng an toàn 4.5 phút).\nĐã chuyển: ' + soDaChuyen + ' ô.\n\n👉 BẤM LẠI CHÍNH MENU NÀY để tiếp tục từ dòng ' + (dongCuoiDaXuLy + 1) + ' — không cần làm gì thêm, hệ thống tự nhớ đã xử lý tới đâu.');
  }
}

/**
 * Y HỆT CHUYEN_DOI_TEN_FILE_ANH_SANG_URL() nhưng áp dụng cho cột DinhKemGiayTo
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
function CHUYEN_DOI_HO_SO_PHAP_LY_SANG_URL() {
  const GIOI_HAN_THOI_GIAN_MS = 4.5 * 60 * 1000;
  const batDau = new Date().getTime();
  const props = PropertiesService.getScriptProperties();

  const sh = getSheet_(SHEET_NAME.HD_RUNG);
  const lastRow = sh.getLastRow();
  if (lastRow < 2) { SpreadsheetApp.getUi().alert('HD_RUNG chưa có dữ liệu.'); return; }

  let dongBatDau = Number(props.getProperty('CHUYEN_DOI_HOSO_DONG_TIEP_THEO') || 2);
  let soDaChuyen = Number(props.getProperty('CHUYEN_DOI_HOSO_SO_DA_CHUYEN') || 0);
  let soKhongTimThay = Number(props.getProperty('CHUYEN_DOI_HOSO_SO_KHONG_THAY') || 0);
  const dsKhongTimThay = []; // giữ vài ví dụ để hiện cho người dùng thấy giá trị gốc

  if (dongBatDau > lastRow) {
    props.deleteProperty('CHUYEN_DOI_HOSO_DONG_TIEP_THEO');
    props.deleteProperty('CHUYEN_DOI_HOSO_SO_DA_CHUYEN');
    props.deleteProperty('CHUYEN_DOI_HOSO_SO_KHONG_THAY');
    dongBatDau = 2; soDaChuyen = 0; soKhongTimThay = 0;
  }

  const cotDinhKem = RUNG_COL.DINH_KEM_GIAY_TO + 1; // getRange dùng chỉ số 1-based
  let dongCuoiDaXuLy = dongBatDau - 1;
  for (let dong = dongBatDau; dong <= lastRow; dong++) {
    if (new Date().getTime() - batDau > GIOI_HAN_THOI_GIAN_MS) break;

    const oDinhKem = sh.getRange(dong, cotDinhKem);
    const v = (oDinhKem.getValue() || '').toString().trim();
    dongCuoiDaXuLy = dong;
    if (!v || v.indexOf('http') === 0) continue; // trống hoặc đã là URL rồi -> bỏ qua

    const link = resolveDriveLink_(v);
    if (link && link.url) {
      oDinhKem.setValue(link.url);
      soDaChuyen++;
    } else {
      soKhongTimThay++;
      if (dsKhongTimThay.length < 5) dsKhongTimThay.push({ dong: dong, giaTriGoc: v });
    }
  }

  if (dongCuoiDaXuLy >= lastRow) {
    props.deleteProperty('CHUYEN_DOI_HOSO_DONG_TIEP_THEO');
    let thongBao = '✅ HOÀN TẤT — đã chuyển ' + soDaChuyen + ' ô DinhKemGiayTo từ tên file/đường dẫn sang URL thật.\n⚠️ Không tìm thấy file trên Drive: ' + soKhongTimThay + ' ô (giữ nguyên giá trị cũ).';
    if (dsKhongTimThay.length) {
      thongBao += '\n\nVí dụ vài dòng không tìm thấy:\n' + dsKhongTimThay.map(function (x) { return '• Dòng ' + x.dong + ': "' + x.giaTriGoc + '"'; }).join('\n');
      thongBao += '\n\n👉 Nếu số lượng không tìm thấy nhiều, khả năng cao dữ liệu gốc đã mất liên kết thật tới file (vd từ 1 lượt import cũ) — cần xác nhận lại thay vì lỗi ở hàm này.';
    }
    SpreadsheetApp.getUi().alert(thongBao);
  } else {
    props.setProperty('CHUYEN_DOI_HOSO_DONG_TIEP_THEO', (dongCuoiDaXuLy + 1).toString());
    props.setProperty('CHUYEN_DOI_HOSO_SO_DA_CHUYEN', soDaChuyen.toString());
    props.setProperty('CHUYEN_DOI_HOSO_SO_KHONG_THAY', soKhongTimThay.toString());
    SpreadsheetApp.getUi().alert('⏸️ Đã xử lý tới dòng ' + dongCuoiDaXuLy + '/' + lastRow + ' (đã chạm ngưỡng an toàn 4.5 phút).\nĐã chuyển: ' + soDaChuyen + ' ô.\n\n👉 BẤM LẠI CHÍNH MENU NÀY để tiếp tục.');
  }
}
