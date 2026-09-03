/**
 * ============================================================
 *  03_ImageForensics.gs
 *  KIỂM TRA ẢNH HIỆN TRƯỜNG:
 *   - Đọc EXIF (GPS, ngày giờ chụp, thiết bị, phần mềm xử lý)
 *   - Đối chiếu GPS trong ảnh với tọa độ rừng đã ghi nhận (HD_GPS)
 *   - Cảnh báo dấu hiệu ảnh đã qua chỉnh sửa / không có GPS / metadata bị xóa
 *
 *  GHI CHÚ: Apps Script không có thư viện EXIF dựng sẵn nên hàm
 *  docExifTuBytes_() tự đọc nhị phân JPEG (marker APP1/TIFF) để lấy tag.
 *  Đây là cách đọc "best-effort": ảnh đã bị nén lại qua Zalo/Messenger/Facebook
 *  thường MẤT TOÀN BỘ EXIF (kể cả ảnh gốc không chỉnh sửa) — nên xem cảnh báo
 *  "không có EXIF" là DẤU HIỆU CẦN HỎI LẠI chứ không phải bằng chứng gian lận.
 * ============================================================
 */

/** Đọc 1 file Drive theo tên (lấy file đầu tiên khớp tên), trả về Blob hoặc null */
function layBlobTheoTen_(duongDan) {
  // Hỗ trợ link Drive đầy đủ (dạng .../file/d/FILE_ID/view hoặc ...?id=FILE_ID) — dữ liệu mới lưu link, không chỉ tên file
  const matchId = duongDan.match(/\/d\/([a-zA-Z0-9_-]{20,})/) || duongDan.match(/[?&]id=([a-zA-Z0-9_-]{20,})/);
  if (matchId) {
    try { return DriveApp.getFileById(matchId[1]).getBlob(); } catch (e) { /* rơi xuống thử tìm theo tên */ }
  }
  const tenFile = duongDan.split('/').pop();
  const it = DriveApp.getFilesByName(tenFile);
  if (!it.hasNext()) return null;
  return it.next().getBlob();
}

/**
 * Parse EXIF cơ bản từ 1 Blob JPEG. Trả về object:
 * { hasExif, gpsLat, gpsLng, dateTimeOriginal, make, model, software }
 * Trả về hasExif=false nếu không tìm thấy marker APP1/EXIF hợp lệ.
 */
function docExifTuBytes_(blob) {
  const bytes = blob.getBytes();
  const result = { hasExif: false, gpsLat: null, gpsLng: null, dateTimeOriginal: null, make: null, model: null, software: null };

  // JPEG phải bắt đầu bằng FFD8
  if (bytes.length < 4 || (bytes[0] & 0xFF) !== 0xFF || (bytes[1] & 0xFF) !== 0xD8) return result;

  let offset = 2;
  let app1Offset = -1, app1Length = 0;
  while (offset < bytes.length - 4) {
    const marker = ((bytes[offset] & 0xFF) << 8) | (bytes[offset + 1] & 0xFF);
    if ((marker & 0xFF00) !== 0xFF00) break; // hết chuỗi marker hợp lệ
    if (marker === 0xFFD8 || marker === 0xFFD9) { offset += 2; continue; }
    const segLen = ((bytes[offset + 2] & 0xFF) << 8) | (bytes[offset + 3] & 0xFF);
    if (marker === 0xFFE1) { // APP1 = EXIF
      app1Offset = offset + 4;
      app1Length = segLen - 2;
      break;
    }
    if (marker === 0xFFDA) break; // bắt đầu dữ liệu ảnh, dừng tìm
    offset += 2 + segLen;
  }
  if (app1Offset === -1) return result; // không có EXIF

  // Kiểm tra header "Exif\0\0"
  const exifHeader = String.fromCharCode(bytes[app1Offset], bytes[app1Offset + 1], bytes[app1Offset + 2], bytes[app1Offset + 3]);
  if (exifHeader !== 'Exif') return result;

  const tiffStart = app1Offset + 6;
  const byteOrder = String.fromCharCode(bytes[tiffStart], bytes[tiffStart + 1]);
  const little = (byteOrder === 'II');

  function readU16(pos) {
    return little ? ((bytes[pos] & 0xFF) | ((bytes[pos + 1] & 0xFF) << 8)) : (((bytes[pos] & 0xFF) << 8) | (bytes[pos + 1] & 0xFF));
  }
  function readU32(pos) {
    return little
      ? ((bytes[pos] & 0xFF) | ((bytes[pos + 1] & 0xFF) << 8) | ((bytes[pos + 2] & 0xFF) << 16) | ((bytes[pos + 3] & 0xFF) << 24)) >>> 0
      : (((bytes[pos] & 0xFF) << 24) | ((bytes[pos + 1] & 0xFF) << 16) | ((bytes[pos + 2] & 0xFF) << 8) | (bytes[pos + 3] & 0xFF)) >>> 0;
  }
  function readString(pos, len) {
    let s = '';
    for (let i = 0; i < len; i++) {
      const c = bytes[pos + i] & 0xFF;
      if (c === 0) break;
      s += String.fromCharCode(c);
    }
    return s;
  }
  function readRational(pos) {
    const num = readU32(pos), den = readU32(pos + 4);
    return den !== 0 ? num / den : 0;
  }

  result.hasExif = true;
  const ifd0Offset = tiffStart + readU32(tiffStart + 4);
  let gpsIfdOffset = -1;

  function docIFD(ifdOffset, tagHandler) {
    const numEntries = readU16(ifdOffset);
    for (let i = 0; i < numEntries; i++) {
      const entryOffset = ifdOffset + 2 + (i * 12);
      const tag = readU16(entryOffset);
      const type = readU16(entryOffset + 2);
      const count = readU32(entryOffset + 4);
      const valueOffset = entryOffset + 8;
      tagHandler(tag, type, count, valueOffset);
    }
    return ifdOffset + 2 + (numEntries * 12);
  }

  docIFD(ifd0Offset, function (tag, type, count, valueOffset) {
    if (tag === 0x010F) result.make = readString(tiffStart + readU32(valueOffset), count); // Make
    if (tag === 0x0110) result.model = readString(tiffStart + readU32(valueOffset), count); // Model
    if (tag === 0x0131) result.software = readString(tiffStart + readU32(valueOffset), count); // Software
    if (tag === 0x8825) gpsIfdOffset = tiffStart + readU32(valueOffset); // GPS IFD pointer
  });

  // Đọc IFD chính thứ 2 (thường chứa DateTimeOriginal trong Exif SubIFD) — best-effort, bỏ qua nếu lỗi
  try {
    let exifSubIfd = -1;
    docIFD(ifd0Offset, function (tag, type, count, valueOffset) {
      if (tag === 0x8769) exifSubIfd = tiffStart + readU32(valueOffset); // Exif SubIFD pointer
    });
    if (exifSubIfd > 0) {
      docIFD(exifSubIfd, function (tag, type, count, valueOffset) {
        if (tag === 0x9003) result.dateTimeOriginal = readString(tiffStart + readU32(valueOffset), count); // DateTimeOriginal
      });
    }
  } catch (e) { /* bỏ qua */ }

  // Đọc GPS IFD nếu có
  if (gpsIfdOffset > 0) {
    try {
      let latRef = 'N', lngRef = 'E', latVals = null, lngVals = null;
      docIFD(gpsIfdOffset, function (tag, type, count, valueOffset) {
        if (tag === 0x0001) latRef = String.fromCharCode(bytes[valueOffset]);
        if (tag === 0x0003) lngRef = String.fromCharCode(bytes[valueOffset]);
        if (tag === 0x0002) { // GPSLatitude (3 rational: deg, min, sec)
          const p = tiffStart + readU32(valueOffset);
          latVals = [readRational(p), readRational(p + 8), readRational(p + 16)];
        }
        if (tag === 0x0004) { // GPSLongitude
          const p = tiffStart + readU32(valueOffset);
          lngVals = [readRational(p), readRational(p + 8), readRational(p + 16)];
        }
      });
      if (latVals) {
        let dd = latVals[0] + latVals[1] / 60 + latVals[2] / 3600;
        if (latRef === 'S') dd *= -1;
        result.gpsLat = dd;
      }
      if (lngVals) {
        let dd = lngVals[0] + lngVals[1] / 60 + lngVals[2] / 3600;
        if (lngRef === 'W') dd *= -1;
        result.gpsLng = dd;
      }
    } catch (e) { /* bỏ qua nếu cấu trúc GPS IFD không chuẩn */ }
  }

  return result;
}

/** Khoảng cách Haversine giữa 2 điểm (mét) */
function khoangCachMet_(lat1, lng1, lat2, lng2) {
  const R = 6378137;
  const toRad = function (d) { return d * Math.PI / 180; };
  const dLat = toRad(lat2 - lat1), dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Kiểm tra TOÀN DIỆN một ảnh so với tọa độ rừng kỳ vọng (latRung, lngRung).
 * Trả về object chẩn đoán, không khẳng định "ảnh giả" một cách tuyệt đối —
 * chỉ liệt kê các dấu hiệu để người phụ trách xem xét thêm.
 */
/**
 * Trích xuất tọa độ GPS từ CHỮ IN SẴN TRÊN ẢNH (không phải EXIF) — rất phổ biến
 * với các app "GPS Map Camera"/"Camera địa lý" hay dùng khi chụp hiện trường rừng:
 * app vẽ chữ tọa độ/địa chỉ/giờ chụp trực tiếp lên ảnh thay vì (hoặc thêm vào) EXIF.
 * Dùng OCR (ocrFile_ ở 04_Reconciliation.gs) đọc chữ trên ảnh rồi dò mẫu tọa độ
 * dạng độ-phút-giây (vd: 15°44'4.872" N 108°4'57.026" E).
 */
/** ⚠️ ĐÃ SỬA: trước đây tự OCR rồi bóc tách bằng regex CHỈ bắt đúng 1 định dạng
 *  độ-phút-giây (°'") — nhiều tem tọa độ của app GPS Map Camera lại in dạng
 *  thập phân thường hoặc bố cục khác, regex không bắt được. Giờ dùng lại
 *  docToaDoTuTemAnhBangGemini_() (đã viết ở 06_CreateUpdate.gs cho luồng "Tải
 *  ảnh mới") — nhờ Gemini đọc trực tiếp, không phụ thuộc đúng 1 định dạng chữ. */
function docToaDoTuChuTrenAnh_(fileId) {
  try {
    const blob = DriveApp.getFileById(fileId).getBlob();
    const kq = docToaDoTuTemAnhBangGemini_(blob);
    return { toaDo: kq ? { lat: kq.lat, lng: kq.lng } : null, diaChi: kq ? kq.diaChi : '', vanBanGoc: '' };
  } catch (e) {
    return { toaDo: null, diaChi: '', vanBanGoc: '', loi: e.message };
  }
}

function kiemTraMotAnh(duongDanFile, latRungKyVong, lngRungKyVong) {
  const blob = layBlobTheoTen_(duongDanFile);
  if (!blob) {
    return { file: duongDanFile, loi: 'Không tìm thấy file trên Drive', dauHieu: ['file_khong_ton_tai'] };
  }

  const exif = docExifTuBytes_(blob);
  const dauHieu = [];
  let khoangCach = null;
  let gpsAnh = exif.hasExif && exif.gpsLat !== null && exif.gpsLng !== null ? { lat: exif.gpsLat, lng: exif.gpsLng } : null;
  let diaChiTrenAnh = '';
  let nguonToaDo = 'EXIF';

  if (!exif.hasExif) {
    dauHieu.push('Không đọc được EXIF (có thể do nén lại qua mạng xã hội/app chat, KHÔNG chắc chắn là ảnh giả)');
  } else {
    if (!gpsAnh) {
      dauHieu.push('Ảnh không có dữ liệu GPS trong EXIF');
    }
    if (exif.software) {
      const sw = exif.software.toLowerCase();
      const nghiVan = PHAN_MEM_CHINH_SUA_NGHI_VAN.some(function (p) { return sw.indexOf(p) !== -1; });
      if (nghiVan) dauHieu.push('Tag Software cho thấy ảnh đã qua xử lý bằng: ' + exif.software);
    }
    if (!exif.make && !exif.model) {
      dauHieu.push('Không có thông tin thiết bị chụp (Make/Model) — có thể đã qua chỉnh sửa/re-save');
    }
  }

  // KHÔNG có GPS từ EXIF -> thử đọc CHỮ IN SẴN TRÊN ẢNH bằng OCR (ảnh chụp từ app GPS Map Camera)
  if (!gpsAnh) {
    try {
      const matchId = duongDanFile.match(/\/d\/([a-zA-Z0-9_-]{20,})/) || duongDanFile.match(/[?&]id=([a-zA-Z0-9_-]{20,})/);
      let fileId = matchId ? matchId[1] : null;
      if (!fileId) {
        const it = DriveApp.getFilesByName(duongDanFile.split('/').pop());
        if (it.hasNext()) fileId = it.next().getId();
      }
      if (fileId) {
        const ocrKq = docToaDoTuChuTrenAnh_(fileId);
        if (ocrKq.toaDo) {
          gpsAnh = ocrKq.toaDo;
          nguonToaDo = 'Chữ in trên ảnh (OCR)';
          diaChiTrenAnh = ocrKq.diaChi;
          // Xóa cảnh báo "không có GPS" vì đã tìm thấy qua OCR
          const idx = dauHieu.indexOf('Ảnh không có dữ liệu GPS trong EXIF');
          if (idx !== -1) dauHieu.splice(idx, 1);
        }
      }
    } catch (e) { /* không đọc được thì thôi, giữ nguyên cảnh báo EXIF ở trên */ }
  }

  if (gpsAnh && latRungKyVong && lngRungKyVong) {
    khoangCach = khoangCachMet_(gpsAnh.lat, gpsAnh.lng, latRungKyVong, lngRungKyVong);
    if (khoangCach > GPS_TOLERANCE_METERS) {
      dauHieu.push('GPS trong ảnh (' + nguonToaDo + ') cách vị trí rừng đã đăng ký khoảng ' + Math.round(khoangCach) + 'm (vượt ngưỡng ' + GPS_TOLERANCE_METERS + 'm)');
    }
  }

  return {
    file: duongDanFile,
    hasExif: exif.hasExif,
    gpsAnh: gpsAnh,
    nguonToaDo: gpsAnh ? nguonToaDo : null,
    diaChiTrenAnh: diaChiTrenAnh,
    ngayChup: exif.dateTimeOriginal,
    thietBi: [exif.make, exif.model].filter(Boolean).join(' '),
    phanMem: exif.software,
    khoangCachDenRungMet: khoangCach !== null ? Math.round(khoangCach) : null,
    dauHieu: dauHieu,
    ketLuan: dauHieu.length === 0 ? 'Bình thường' : 'Cần xem lại'
  };
}

/**
 * QUÉT TOÀN BỘ ảnh trong HD_Picture, đối chiếu GPS ảnh với tọa độ rừng
 * tương ứng lấy từ HD_GPS (join theo ID_HD <-> ID_KEY_GPS), xuất báo cáo.
 */
/** Kiểm tra 1 ảnh ĐÃ CÓ SẴN trên Drive qua link dán tay — không cần upload lại, dùng khi hộp thoại chọn file bị đơ trên máy người dùng */
function KIEM_TRA_ANH_TU_LINK(url) {
  if (!url) return { loi: 'Thiếu link ảnh' };
  return kiemTraMotAnh(url, null, null);
}

function KIEM_TRA_ANH_TOAN_BO() {
  const pictureRows = readData_(SHEET_NAME.HD_PICTURE);
  const gpsRows = readData_(SHEET_NAME.HD_GPS);

  // Map ID rừng -> tọa độ trung bình (nếu 1 rừng có nhiều điểm GPS)
  const gpsByRung = {};
  gpsRows.forEach(function (r) {
    const id = (r[GPS_COL.ID_KEY_GPS] || '').toString().trim();
    if (!id) return;
    const type = r[GPS_COL.HE_TOA_DO];
    const lat = (type === 'DMS') ? convertDmsToDd(r[GPS_COL.LAT]) : parseFloat(r[GPS_COL.LAT]);
    const lng = (type === 'DMS') ? convertDmsToDd(r[GPS_COL.LNG]) : parseFloat(r[GPS_COL.LNG]);
    if (isNaN(lat) || isNaN(lng)) return;
    if (!gpsByRung[id]) gpsByRung[id] = [];
    gpsByRung[id].push({ lat: lat, lng: lng });
  });

  function toaDoTrungBinh(id) {
    const arr = gpsByRung[id];
    if (!arr || !arr.length) return null;
    const lat = arr.reduce(function (s, p) { return s + p.lat; }, 0) / arr.length;
    const lng = arr.reduce(function (s, p) { return s + p.lng; }, 0) / arr.length;
    return { lat: lat, lng: lng };
  }

  const baoCao = [];
  pictureRows.forEach(function (row) {
    const idHD = (row[PICTURE_COL.ID_HD] || '').toString().trim();
    const toaDo = toaDoTrungBinh(idHD);
    for (let c = PICTURE_COL.PICTURE_START; c <= PICTURE_COL.PICTURE_END; c++) {
      const duongDan = row[c];
      if (!duongDan) continue;
      const kq = kiemTraMotAnh(duongDan, toaDo ? toaDo.lat : null, toaDo ? toaDo.lng : null);
      baoCao.push({
        idHD: idHD,
        chuRung: row[PICTURE_COL.TEN_CHU_RUNG],
        file: duongDan,
        url: (resolveDriveLink_(duongDan) || {}).url || '',
        gpsAnh: kq.gpsAnh, nguonToaDo: kq.nguonToaDo, diaChiTrenAnh: kq.diaChiTrenAnh,
        ketLuan: kq.ketLuan,
        dauHieu: kq.dauHieu.join(' | '),
        khoangCachM: kq.khoangCachDenRungMet
      });
    }
  });

  // Xuất báo cáo
  const ss = getSS_();
  const sheetName = 'BaoCao_KiemTraAnh';
  let sh = ss.getSheetByName(sheetName);
  if (sh) sh.clear(); else sh = ss.insertSheet(sheetName);

  const header = ['ID_HD', 'Chủ rừng', 'File ảnh', 'Kết luận', 'Dấu hiệu cần xem lại', 'Khoảng cách đến rừng (m)'];
  sh.getRange(1, 1, 1, header.length).setValues([header]).setFontWeight('bold').setBackground('#34495e').setFontColor('#ffffff');
  const rows = baoCao.map(function (b) {
    return [b.idHD, b.chuRung, b.file, b.ketLuan, b.dauHieu, b.khoangCachM];
  });
  if (rows.length) sh.getRange(2, 1, rows.length, header.length).setValues(rows);
  for (let i = 0; i < rows.length; i++) {
    if (baoCao[i].ketLuan !== 'Bình thường') sh.getRange(i + 2, 1, 1, header.length).setBackground('#fdecea');
  }
  sh.autoResizeColumns(1, header.length);

  const canXemLai = baoCao.filter(function (b) { return b.ketLuan !== 'Bình thường'; }).length;
  return {
    thongBao: 'Đã kiểm tra ' + baoCao.length + ' ảnh — ' + canXemLai + ' ảnh CẦN XEM LẠI. (Đã ghi đầy đủ vào sheet "' + sheetName + '")',
    ketQua: baoCao
  };
}
