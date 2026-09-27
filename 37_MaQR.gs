/**
 * ============================================================
 * 37_MaQR.gs — TẠO MÃ QR NGAY TRONG APPS SCRIPT (không gọi dịch vụ ngoài)
 * ============================================================
 * Dùng để "đóng dấu" mã QR lên báo cáo PDF: nội dung QR (số HĐ, tên chủ rừng,
 * địa chỉ...) là thông tin cá nhân nên KHÔNG gửi sang website tạo QR bên ngoài.
 *
 * Mã hóa chế độ byte (UTF-8 — có dấu tiếng Việt), mức sửa lỗi M (~15%), tự chọn
 * phiên bản 1–40 vừa đủ độ dài, tự chọn mặt nạ tốt nhất; xuất ảnh PNG đen trắng.
 * Thuật toán theo chuẩn ISO/IEC 18004 (cách làm giống thư viện QR Code generator
 * của Project Nayuki, giấy phép MIT).
 *
 * Hàm dùng chung: maQrPngDataUrl_(noiDung, coDiem) -> 'data:image/png;base64,...'
 */

const QR_SO_KHOI_ECC_M_ = [-1, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5, 5, 8, 9, 9, 10, 10, 11, 13, 14, 16, 17, 17, 18, 20, 21, 23, 25, 26, 28, 29, 31, 33, 35, 37, 38, 40, 43, 45, 47, 49];
const QR_ECC_MOI_KHOI_M_ = [-1, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26, 30, 22, 22, 24, 24, 28, 28, 26, 26, 26, 26, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28];

/** Chuỗi -> mảng byte UTF-8. */
function _qrUtf8_(s) {
  const kq = [];
  const u = unescape(encodeURIComponent(String(s)));
  for (let i = 0; i < u.length; i++) kq.push(u.charCodeAt(i));
  return kq;
}

function _qrSoModuleDuLieuTho_(ver) {
  let kq = (16 * ver + 128) * ver + 64;
  if (ver >= 2) {
    const soCanChinh = Math.floor(ver / 7) + 2;
    kq -= (25 * soCanChinh - 10) * soCanChinh - 55;
    if (ver >= 7) kq -= 36;
  }
  return kq;
}

function _qrSoByteDuLieu_(ver) {
  return Math.floor(_qrSoModuleDuLieuTho_(ver) / 8) - QR_ECC_MOI_KHOI_M_[ver] * QR_SO_KHOI_ECC_M_[ver];
}

function _qrNhanGF_(x, y) {
  let z = 0;
  for (let i = 7; i >= 0; i--) {
    z = (z << 1) ^ ((z >>> 7) * 0x11D);
    z ^= ((y >>> i) & 1) * x;
  }
  return z & 0xFF;
}

function _qrDaThucChia_(bac) {
  const kq = [];
  for (let i = 0; i < bac - 1; i++) kq.push(0);
  kq.push(1);
  let goc = 1;
  for (let i = 0; i < bac; i++) {
    for (let j = 0; j < kq.length; j++) {
      kq[j] = _qrNhanGF_(kq[j], goc);
      if (j + 1 < kq.length) kq[j] ^= kq[j + 1];
    }
    goc = _qrNhanGF_(goc, 0x02);
  }
  return kq;
}

function _qrPhanDu_(duLieu, chia) {
  const kq = chia.map(function () { return 0; });
  duLieu.forEach(function (b) {
    const heSo = b ^ kq.shift();
    kq.push(0);
    chia.forEach(function (c, i) { kq[i] ^= _qrNhanGF_(c, heSo); });
  });
  return kq;
}

/** Tạo ma trận QR (mảng hàng, true = ô đen) cho chuỗi `noiDung`. */
function maQrMaTran_(noiDung) {
  const bytes = _qrUtf8_(noiDung);
  let ver = 1;
  for (; ver <= 40; ver++) {
    const soBitDem = ver <= 9 ? 8 : 16;
    if (4 + soBitDem + bytes.length * 8 <= _qrSoByteDuLieu_(ver) * 8) break;
  }
  if (ver > 40) throw new Error('Nội dung mã QR quá dài (' + bytes.length + ' byte).');

  // ---- Chuỗi bit dữ liệu ----
  const bits = [];
  const them = function (giaTri, soBit) { for (let i = soBit - 1; i >= 0; i--) bits.push((giaTri >>> i) & 1); };
  them(4, 4); // chế độ byte
  them(bytes.length, ver <= 9 ? 8 : 16);
  bytes.forEach(function (b) { them(b, 8); });
  const dungLuong = _qrSoByteDuLieu_(ver) * 8;
  them(0, Math.min(4, dungLuong - bits.length));
  them(0, (8 - bits.length % 8) % 8);
  for (let dem = 0xEC; bits.length < dungLuong; dem ^= 0xEC ^ 0x11) them(dem, 8);
  const duLieu = [];
  for (let i = 0; i < bits.length; i += 8) {
    let b = 0;
    for (let j = 0; j < 8; j++) b = (b << 1) | bits[i + j];
    duLieu.push(b);
  }

  // ---- Thêm mã sửa lỗi Reed-Solomon và đan xen các khối ----
  const soKhoi = QR_SO_KHOI_ECC_M_[ver], eccKhoi = QR_ECC_MOI_KHOI_M_[ver];
  const tongByte = Math.floor(_qrSoModuleDuLieuTho_(ver) / 8);
  const soKhoiNgan = soKhoi - tongByte % soKhoi, doDaiKhoiNgan = Math.floor(tongByte / soKhoi);
  const chia = _qrDaThucChia_(eccKhoi);
  const khoi = [];
  for (let i = 0, k = 0; i < soKhoi; i++) {
    const dat = duLieu.slice(k, k + doDaiKhoiNgan - eccKhoi + (i < soKhoiNgan ? 0 : 1));
    k += dat.length;
    const ecc = _qrPhanDu_(dat, chia);
    if (i < soKhoiNgan) dat.push(0);
    khoi.push(dat.concat(ecc));
  }
  const tu = [];
  for (let i = 0; i < khoi[0].length; i++) {
    khoi.forEach(function (b, j) { if (i !== doDaiKhoiNgan - eccKhoi || j >= soKhoiNgan) tu.push(b[i]); });
  }

  // ---- Vẽ các mẫu cố định ----
  const n = ver * 4 + 17;
  const o = [], coDinh = [];
  for (let y = 0; y < n; y++) { o.push(new Array(n).fill(false)); coDinh.push(new Array(n).fill(false)); }
  const dat_ = function (x, y, den) { o[y][x] = den; coDinh[y][x] = true; };
  for (let i = 0; i < n; i++) { dat_(6, i, i % 2 === 0); dat_(i, 6, i % 2 === 0); }
  const timKiem = function (x, y) {
    for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) {
      const d = Math.max(Math.abs(dx), Math.abs(dy)), xx = x + dx, yy = y + dy;
      if (xx >= 0 && xx < n && yy >= 0 && yy < n) dat_(xx, yy, d !== 2 && d !== 4);
    }
  };
  timKiem(3, 3); timKiem(n - 4, 3); timKiem(3, n - 4);
  if (ver > 1) {
    const soCC = Math.floor(ver / 7) + 2;
    const buoc = ver === 32 ? 26 : Math.ceil((ver * 4 + 4) / (soCC * 2 - 2)) * 2;
    const viTri = [6];
    for (let p = n - 7; viTri.length < soCC; p -= buoc) viTri.splice(1, 0, p);
    viTri.forEach(function (a, i) {
      viTri.forEach(function (b, j) {
        if ((i === 0 && j === 0) || (i === 0 && j === soCC - 1) || (i === soCC - 1 && j === 0)) return;
        for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) dat_(a + dx, b + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
      });
    });
  }
  const veDinhDang = function (mask) {
    const d = (0 << 3) | mask; // mức M = 00
    let r = d;
    for (let i = 0; i < 10; i++) r = (r << 1) ^ ((r >>> 9) * 0x537);
    const b = ((d << 10) | r) ^ 0x5412;
    const bit = function (i) { return ((b >>> i) & 1) !== 0; };
    for (let i = 0; i <= 5; i++) dat_(8, i, bit(i));
    dat_(8, 7, bit(6)); dat_(8, 8, bit(7)); dat_(7, 8, bit(8));
    for (let i = 9; i < 15; i++) dat_(14 - i, 8, bit(i));
    for (let i = 0; i < 8; i++) dat_(n - 1 - i, 8, bit(i));
    for (let i = 8; i < 15; i++) dat_(8, n - 15 + i, bit(i));
    dat_(8, n - 8, true);
  };
  veDinhDang(0);
  if (ver >= 7) {
    let r = ver;
    for (let i = 0; i < 12; i++) r = (r << 1) ^ ((r >>> 11) * 0x1F25);
    const b = (ver << 12) | r;
    for (let i = 0; i < 18; i++) {
      const den = ((b >>> i) & 1) !== 0, a = n - 11 + i % 3, c = Math.floor(i / 3);
      dat_(a, c, den); dat_(c, a, den);
    }
  }

  // ---- Đặt dữ liệu theo đường zigzag ----
  let k = 0;
  for (let phai = n - 1; phai >= 1; phai -= 2) {
    if (phai === 6) phai = 5;
    for (let d = 0; d < n; d++) {
      for (let j = 0; j < 2; j++) {
        const x = phai - j, len = ((phai + 1) & 2) === 0, y = len ? n - 1 - d : d;
        if (!coDinh[y][x] && k < tu.length * 8) { o[y][x] = ((tu[k >>> 3] >>> (7 - (k & 7))) & 1) !== 0; k++; }
      }
    }
  }

  // ---- Chọn mặt nạ có điểm phạt thấp nhất ----
  const apMatNa = function (m) {
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      if (coDinh[y][x]) continue;
      let dao;
      switch (m) {
        case 0: dao = (x + y) % 2 === 0; break;
        case 1: dao = y % 2 === 0; break;
        case 2: dao = x % 3 === 0; break;
        case 3: dao = (x + y) % 3 === 0; break;
        case 4: dao = (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0; break;
        case 5: dao = x * y % 2 + x * y % 3 === 0; break;
        case 6: dao = (x * y % 2 + x * y % 3) % 2 === 0; break;
        default: dao = ((x + y) % 2 + x * y % 3) % 2 === 0;
      }
      if (dao) o[y][x] = !o[y][x];
    }
  };
  const diemPhat = function () {
    let p = 0, den = 0;
    const mau1 = [true, false, true, true, true, false, true, false, false, false, false];
    const mau2 = [false, false, false, false, true, false, true, true, true, false, true];
    const khop = function (lay, i) {
      if (i + 11 > n) return 0;
      let a = true, b = true;
      for (let t = 0; t < 11; t++) { const v = lay(i + t); if (v !== mau1[t]) a = false; if (v !== mau2[t]) b = false; }
      return (a ? 40 : 0) + (b ? 40 : 0);
    };
    for (let y = 0; y < n; y++) {
      let chay = 1, chayCot = 1;
      for (let x = 0; x < n; x++) {
        if (o[y][x]) den++;
        if (x > 0) {
          if (o[y][x] === o[y][x - 1]) chay++; else { if (chay >= 5) p += chay - 2; chay = 1; }
          if (o[x][y] === o[x - 1][y]) chayCot++; else { if (chayCot >= 5) p += chayCot - 2; chayCot = 1; }
        }
        if (x < n - 1 && y < n - 1 && o[y][x] === o[y][x + 1] && o[y][x] === o[y + 1][x] && o[y][x] === o[y + 1][x + 1]) p += 3;
        p += khop(function (i) { return o[y][i]; }, x) + khop(function (i) { return o[i][y]; }, x);
      }
      if (chay >= 5) p += chay - 2;
      if (chayCot >= 5) p += chayCot - 2;
    }
    p += Math.floor(Math.abs(den * 20 - n * n * 10) / (n * n)) * 10;
    return p;
  };
  let tot = 0, nho = Infinity;
  for (let m = 0; m < 8; m++) {
    apMatNa(m); veDinhDang(m);
    const d = diemPhat();
    if (d < nho) { nho = d; tot = m; }
    apMatNa(m); // bỏ mặt nạ (XOR 2 lần)
  }
  apMatNa(tot); veDinhDang(tot);
  return o;
}

/** Ma trận QR -> ảnh PNG đen trắng (1 bit/điểm ảnh), trả mảng byte 0..255. */
function _qrPngBytes_(o, coDiem, vien) {
  const n = o.length, w = (n + vien * 2) * coDiem, bytesHang = Math.ceil(w / 8);
  const tho = [];
  for (let py = 0; py < w; py++) {
    tho.push(0); // bộ lọc "None"
    const y = Math.floor(py / coDiem) - vien;
    for (let bx = 0; bx < bytesHang; bx++) {
      let b = 0;
      for (let t = 0; t < 8; t++) {
        const px = bx * 8 + t, x = Math.floor(px / coDiem) - vien;
        const den = px < w && y >= 0 && y < n && x >= 0 && x < n && o[y][x];
        b = (b << 1) | (den ? 0 : 1); // 1 = trắng
      }
      tho.push(b);
    }
  }
  // zlib: khối "stored" (không nén) — đơn giản, ảnh chỉ vài chục KB
  const z = [0x78, 0x01];
  for (let i = 0; i < tho.length || i === 0; i += 65535) {
    const len = Math.min(65535, tho.length - i), cuoi = i + 65535 >= tho.length ? 1 : 0;
    z.push(cuoi, len & 0xFF, len >>> 8, ~len & 0xFF, (~len >>> 8) & 0xFF);
    for (let j = 0; j < len; j++) z.push(tho[i + j]);
  }
  let a = 1, b2 = 0;
  tho.forEach(function (v) { a = (a + v) % 65521; b2 = (b2 + a) % 65521; });
  z.push((b2 >>> 8) & 0xFF, b2 & 0xFF, (a >>> 8) & 0xFF, a & 0xFF);

  const bangCrc = [];
  for (let i = 0; i < 256; i++) { let c = i; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; bangCrc.push(c >>> 0); }
  const u32 = function (v) { return [(v >>> 24) & 0xFF, (v >>> 16) & 0xFF, (v >>> 8) & 0xFF, v & 0xFF]; };
  const kq = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A];
  const chunk = function (loai, dl) {
    const td = loai.split('').map(function (c) { return c.charCodeAt(0); }).concat(dl);
    let c = 0xFFFFFFFF;
    td.forEach(function (v) { c = bangCrc[(c ^ v) & 0xFF] ^ (c >>> 8); });
    Array.prototype.push.apply(kq, u32(dl.length));
    Array.prototype.push.apply(kq, td);
    Array.prototype.push.apply(kq, u32((c ^ 0xFFFFFFFF) >>> 0));
  };
  chunk('IHDR', u32(w).concat(u32(w), [1, 0, 0, 0, 0])); // 1 bit, xám
  chunk('IDAT', z);
  chunk('IEND', []);
  return kq;
}

/** Ảnh PNG mã QR dạng data URL để chèn vào HTML/PDF. `coDiem` = số điểm ảnh mỗi ô (mặc định 4). */
function maQrPngDataUrl_(noiDung, coDiem) {
  return maQrAnh_(noiDung, coDiem).src;
}

/**
 * Như maQrPngDataUrl_ nhưng trả thêm `canh` = số ô mỗi cạnh (kể cả viền trắng 4 ô) —
 * hiển thị ảnh ở đúng bội số của `canh` (vd canh*2 px) để ô QR không bị co lẻ, nhòe khi quét trên màn hình.
 */
function maQrAnh_(noiDung, coDiem) {
  const mt = maQrMaTran_(noiDung);
  const bytes = _qrPngBytes_(mt, coDiem || 4, 4);
  // Apps Script cần byte có dấu (-128..127)
  return { src: 'data:image/png;base64,' + Utilities.base64Encode(bytes.map(function (v) { return v > 127 ? v - 256 : v; })), canh: mt.length + 8 };
}
