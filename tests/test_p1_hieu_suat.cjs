// Test P1 (nâng cấp 10/2026): tối ưu đọc Sheet phải giữ đúng dữ liệu + cache được xóa đúng lúc.
// Chạy: TZ=Asia/Ho_Chi_Minh node tests/test_p1_hieu_suat.cjs [thư mục mã nguồn]
// So đầu ra với mã cũ trên cùng dữ liệu: node tests/so_sanh_dau_ra.cjs <thư mục mã cũ> <thư mục mã mới>
const { taoMoiTruong } = require('./gasmock.cjs');
const vm = require('vm');
const path = require('path');
const THU_MUC = process.argv[2] || path.resolve(__dirname, '..');
const J = JSON.stringify;
let dat = 0, truot = 0; const ketQua = [];
function kiem(ten, dk, chiTiet) { if (dk) { dat++; ketQua.push('PASS ' + ten); } else { truot++; ketQua.push('FAIL ' + ten + (chiTiet ? ' — ' + chiTiet : '')); } }
function chay(f) { try { f(); } catch (e) { truot++; ketQua.push('LỖI ' + String(e.stack || e.message).slice(0, 300)); } }

function moi(soHD) {
  const m = taoMoiTruong(THU_MUC);
  const run = (code) => vm.runInContext(code, m.ctx);
  const ss = m.ssChinh;
  const td = (ten, n) => { const sh = ss.insertSheet(ten); sh.getRange(1, 1, 1, n).setValues([Array.from({ length: n }, (_, i) => ten + '_C' + (i + 1))]); };
  td('HD_NCC', 33); td('HD_RUNG', 20); td('HD_STK', 10); td('HD_GPS', 10); td('HD_Picture', 13); td('DM_DIACHI', 8);
  m.props.set('REPORT_SPREADSHEET_ID', 'REPORT');
  const tao = (i, cccd) => run('TAO_HOP_DONG_MOI_(' + J({ tenChuRung: 'Khach ' + i, cccdChuRung: cccd || ('0490' + String(10000000 + i)), ngayKy: '2026-05-10', soTK: '0' + (1000 + i), nganHang: 'VCB', diaChiRung: 'Thon ' + i, dienTichKy: 1, slDuKien: 1, donGia: 1, sdtChuRung: '0905' + (100000 + i) }) + ')');
  for (let i = 0; i < (soHD || 0); i++) tao(i);
  const doDoc = (code) => { m.demDoc.n = 0; m.demDoc.o = 0; const kq = run(code); return { kq, n: m.demDoc.n, o: m.demDoc.o }; };
  return { m, run, ss, tao, doDoc };
}

try {
  chay(function () {
    const t = moi(200);
    const lan1 = t.doDoc('layDanhSachKhachHang_(1, 20, "")');
    kiem('P1-KH1 danh sách khách hàng lần đầu chỉ đọc 8 cột HD_NCC (≤ 8 ô/dòng)', lan1.o <= 200 * 8 && lan1.kq.tongSo === 200, J({ o: lan1.o, n: lan1.n, tong: lan1.kq.tongSo }));
    const lan2 = t.doDoc('layDanhSachKhachHang_(2, 20, "khach 1")');
    kiem('P1-KH2 đổi trang / tìm kiếm trong 5 phút: không đọc lại Sheet', lan2.n === 0 && lan2.kq.items.length > 0, J({ n: lan2.n, so: lan2.kq.tongSo }));
    t.tao(999, '049099999999');
    const lan3 = t.doDoc('layDanhSachKhachHang_(1, 20, "049099999999")');
    kiem('P1-KH3 vừa tạo hợp đồng (khách mới) -> hiện ngay, không chờ hết hạn cache', lan3.kq.tongSo === 1 && lan3.kq.items[0].cccd === '049099999999' && lan3.n > 0, J(lan3.kq));
    const sh = t.ss.getSheetByName('HD_NCC');
    const dong = sh.getDataRange().getValues().findIndex(r => r[t.run('NCC_COL.CCCD_CHU_RUNG')] === '049099999999') + 1;
    const idHD = sh.getRange(dong, t.run('NCC_COL.ID_HD') + 1).getValue();
    t.run('CAP_NHAT_HOP_DONG_WEB_(' + dong + ', {tenChuRung: "Ten Da Sua"}, ' + J(idHD) + ')');
    kiem('P1-KH4 sửa tên qua webapp -> danh sách khách hàng thấy tên mới ngay', t.run('layDanhSachKhachHang_(1, 20, "049099999999")').items[0].tenChuRung === 'Ten Da Sua');
    const hd = t.doDoc('layHopDongTheoKhachHang_("049010000010")');
    kiem('P1-KH5 hợp đồng của 1 khách hàng: chỉ đọc cột CCCD + dòng khớp (không đọc cả bảng)', hd.kq.length === 1 && hd.o <= 201 + 33 * 2, J({ o: hd.o, kq: hd.kq.length }));
  });

  chay(function () {
    const t = moi(200);
    const tc = t.doDoc('TRA_CUU_HOP_DONG_("Khach 15", "", "")');
    kiem('P1-TC1 dựng chỉ mục Tra cứu: đọc ≤ 19 cột HD_NCC + 2 cột HD_STK', tc.o <= 201 * 21 + 400 && tc.kq.tongSo >= 1, J({ o: tc.o, tong: tc.kq.tongSo }));
    const tc2 = t.doDoc('TRA_CUU_HOP_DONG_("0905100015", "", "")');
    kiem('P1-TC2 tìm lần 2 (chỉ mục trong cache) không đọc Sheet; tìm theo SĐT đúng', tc2.n === 0 && tc2.kq.tongSo === 1, J({ n: tc2.n, kq: tc2.kq.tongSo }));
    const tc3 = t.doDoc('TRA_CUU_HOP_DONG_("01015", "", "")');
    kiem('P1-TC3 tìm theo số tài khoản (giữ số 0 đầu) vẫn đúng', tc3.kq.tongSo === 1, J(tc3.kq.ketQua && tc3.kq.ketQua.map(x => x.soHD)));
  });

  chay(function () {
    // docCacCot_: cột vượt quá số cột của sheet -> '' ; cột rời nhau đọc đúng chỗ
    const t = moi(3);
    const r = t.run('docCacCot_(SHEET_NAME.HD_NCC, [NCC_COL.SO_HD, NCC_COL.ID_HD, 40])');
    const g = t.run('readData_(SHEET_NAME.HD_NCC)');
    kiem('P1-DC1 docCacCot_ trả đúng giá trị các cột được chọn như readData_', r.length === 3 && r.every((x, i) => x[t.run('NCC_COL.SO_HD')] === g[i][t.run('NCC_COL.SO_HD')] && x[t.run('NCC_COL.ID_HD')] === g[i][t.run('NCC_COL.ID_HD')] && x[40] === undefined), J(r.map(x => [x[2], x[29]])));
  });
  // ======================= Bản đồ GPS: cache chia mảnh =======================
  chay(function () {
    const t = moi(150);
    const ds = t.run('layDanhSachHopDong_(1, 200, "", "")').items;
    ds.forEach((h, i) => { const lo = t.run('layDanhSachRung_(' + J(h.idHD) + ')')[0]; for (let g = 0; g < 8; g++) t.run('CAP_NHAT_GPS_RUNG_(' + J(lo.idRung) + ', {lat: 15.' + (1000 + i * 8 + g) + ', lng: 108.' + (2000 + g) + ', diaChi: "Thôn số ' + i + ', xã Quế Phong, huyện Quế Sơn"}, false)'); });
    const b1 = t.doDoc('getMapData_()');
    const kichThuoc = JSON.stringify(b1.kq).length;
    const b2 = t.doDoc('getMapData_()');
    kiem('P1-BD1 bản đồ ' + kichThuoc.toLocaleString('vi') + ' ký tự (> 95.000) vẫn được cache: lần mở thứ 2 không đọc Sheet', kichThuoc > 95000 && b2.n === 0 && JSON.stringify(b2.kq) === JSON.stringify(b1.kq), J({ kichThuoc, n2: b2.n }));
    const lo0 = t.run('layDanhSachRung_(' + J(ds[0].idHD) + ')')[0];
    t.run('CAP_NHAT_GPS_RUNG_(' + J(lo0.idRung) + ', {lat: 16.5, lng: 107.5}, false)');
    const b3 = t.run('getMapData_()');
    kiem('P1-BD2 thêm điểm GPS -> bản đồ có ngay điểm mới (cache được xóa)', (b3[lo0.idRung].coords || []).some(c => c.lat === 16.5), J((b3[lo0.idRung] || {}).coords && b3[lo0.idRung].coords.length));
  });

  chay(function () {
    // Dữ liệu lớn (chỉ mục, danh sách KH, bản đồ) nằm ở DocumentCache khi có — ScriptCache chỉ còn phiên đăng nhập / khóa chống trùng
    const t = moi(30);
    const docCache = new Map();
    t.m.ctx.CacheService.getDocumentCache = () => ({ get: k => docCache.has(k) ? docCache.get(k) : null, put: (k, v) => docCache.set(k, String(v)), remove: k => docCache.delete(k),
      getAll: ks => { const o = {}; ks.forEach(k => { if (docCache.has(k)) o[k] = docCache.get(k); }); return o; }, putAll: o => Object.keys(o).forEach(k => docCache.set(k, o[k])) });
    t.m.cache.clear();
    t.run('layDanhSachKhachHang_(1, 20, "")'); t.run('TRA_CUU_HOP_DONG_("Khach 1", "", "")'); t.run('getMapData_()');
    const khoaScript = Array.from(t.m.cache.keys());
    kiem('P1-CA1 cache dữ liệu lớn ghi vào DocumentCache, không ghi vào ScriptCache (giữ chỗ cho phiên đăng nhập)', docCache.size >= 3 && !khoaScript.some(k => /DS_KHACH_HANG|CHI_MUC|MAP_DATA/.test(k)), J({ doc: Array.from(docCache.keys()).slice(0, 6), script: khoaScript }));
    t.tao(500, '049055555555');
    kiem('P1-CA2 tạo hợp đồng -> xóa đúng cache ở DocumentCache (khách mới hiện ngay)', t.run('layDanhSachKhachHang_(1, 20, "049055555555")').tongSo === 1);
  });

  chay(function () {
    // Giám sát hiệu năng ở cửa api(): chỉ ghi lời gọi chậm / lỗi, không ghi tham số người dùng
    const t = moi(5);
    const sheet = () => t.m.ssBaoCao.getSheetByName('NhatKy_HieuNang');
    t.run('api("", "TRA_CUU_HOP_DONG", ["Khach BI_MAT_123", "", ""])');
    kiem('P1-GS1 lời gọi nhanh (dưới ngưỡng 5 giây) -> không ghi sổ', !sheet());
    t.m.props.set('HIEU_NANG_NGUONG_MS', '0'); t.run('_nguongHieuNangMs_ = null');
    t.run('api("", "TRA_CUU_HOP_DONG", ["Khach BI_MAT_123", "", ""])');
    let loi = ''; try { t.run('api("", "CHI_TIET_TRA_CUU_HOP_DONG", [{ toString: function () { throw new Error("Lỗi giả lập CCCD 049012345678"); } }])'); } catch (e) { loi = e.message; }
    const dong = sheet() ? sheet().getDataRange().getValues().slice(1) : [];
    kiem('P1-GS2 vượt ngưỡng -> ghi tên chức năng, thời gian, kết quả; lỗi được ghi "LỖI"', dong.length >= 1 && dong[0][1] === 'TRA_CUU_HOP_DONG' && typeof dong[0][2] === 'number' && dong.some(r => r[3] === 'LỖI'), J(dong));
    kiem('P1-GS3 sổ hiệu năng KHÔNG chứa tham số / dữ liệu người dùng; số CCCD trong thông báo lỗi bị che', !J(dong).includes('BI_MAT_123') && !J(dong).includes('049012345678') && J(dong).includes('Lỗi giả lập'), J(dong));
    let loiQ = ''; try { t.run('api("phien-sai", "TRA_CUU_HOP_DONG", ["x", "", ""])'); } catch (e) { loiQ = e.message; }
    kiem('P1-GS4 lỗi đăng nhập / thiếu quyền không ghi sổ hiệu năng', !!loiQ && sheet().getLastRow() - 1 === dong.length, loiQ);
    const tk = t.run('LAY_THONG_KE_HIEU_NANG_(7)');
    kiem('P1-GS5 thống kê p50/p95 theo chức năng (Quản trị)', tk.chucNang.some(x => x.chucNang === 'TRA_CUU_HOP_DONG' && x.soLan >= 1 && x.p95 >= x.p50) && t.run('_bangQuyenApi_().LAY_THONG_KE_HIEU_NANG.quyen === QUYEN.QUAN_TRI'), J(tk));
  });

  chay(function () {
    // Danh sách ngân hàng VietQR: cache được (thời hạn ≤ 6 giờ), lần 2 không gọi mạng
    const t = moi(0);
    let soLanGoi = 0;
    t.m.ctx.UrlFetchApp = { fetch: () => { soLanGoi++; return { getContentText: () => JSON.stringify({ code: '00', data: [{ code: 'VCB', bin: '970436', shortName: 'Vietcombank', name: 'NH TMCP Ngoại thương' }] }) }; } };
    const a = t.run('LAY_DANH_SACH_NGAN_HANG_VIETQR_()'); const b = t.run('LAY_DANH_SACH_NGAN_HANG_VIETQR_()');
    kiem('P1-NH1 danh sách ngân hàng VietQR được cache (lần 2 không gọi mạng)', soLanGoi === 1 && J(a) === J(b) && a[0].code === 'VCB', 'số lần gọi ' + soLanGoi);
  });

  // ======================= Đồng bộ thanh toán tăng dần =======================
  chay(function () {
    const t = moi(0);
    const SS = t.m.ssChinh.constructor;
    const ssD = new SS('DNTT'), ssP = new SS('PC');
    const shD = ssD.insertSheet('DNTT_GK_DN_CT'); const h = Array(20).fill('x'); h[0] = 'Ngày'; h[6] = 'Người nhận'; h[11] = 'Số CT'; h[12] = 'Khối lượng'; h[16] = 'Thành tiền'; h[19] = 'Số HĐ'; shD.appendRow(h);
    const shP = ssP.insertSheet('PhieuCan_DN'); const hp = Array(28).fill('x'); hp[1] = 'Ngày cân 1'; hp[22] = 'So_CT'; shP.appendRow(hp);
    const tt = { sua: 1 };
    const goc = t.m.ctx.SpreadsheetApp.openByUrl;
    t.m.ctx.SpreadsheetApp.openByUrl = (u) => u.indexOf('1oUm87') !== -1 ? ssD : u.indexOf('1vqMVx') !== -1 ? ssP : goc(u);
    t.m.ctx.DriveApp.getFileById = () => ({ getLastUpdated: () => new Date(tt.sua) });
    const ds = [];
    for (let i = 0; i < 15; i++) ds.push(t.run('TAO_HOP_DONG_MOI_(' + J({ tenChuRung: 'K' + i, cccdChuRung: '0490' + String(20000000 + i), ngayKy: '2026-05-10', soTK: '1', nganHang: 'VCB', soHD: 'T' + i, diaChiRung: 'X', dienTichKy: 1, slDuKien: 100, donGia: 1000 }) + ')'));
    const dong = (soHD, kl, ct, ngay) => { const r = Array(20).fill(''); r[11] = ct; r[12] = kl; r[16] = kl * 1000; r[19] = soHD; shD.appendRow(r); const p = Array(28).fill(''); p[1] = new Date(ngay); p[22] = ct; shP.appendRow(p); };
    dong('T0', 10, 'C0', '2026-06-01T08:00:00+07:00'); dong('T1', 20, 'C1', '2026-06-02T08:00:00+07:00'); dong('T2', 30, 'C2', '2026-06-03T08:00:00+07:00');
    const kl = (i) => { const sh = t.m.ssBaoCao.getSheetByName('Draft_BaoCaoHopDong'); const c = t.run('DRAFT_BAOCAO_COL'); const r = sh.getDataRange().getValues().find(x => x[c.ID_HD] === ds[i].idHD); return r ? r[c.KHOI_LUONG_THUC_HIEN] : null; };
    // Gián điệp: ghi lại danh sách HĐ được tính lại mỗi lượt
    t.run('var __goiDraft = []; var __gocHL = capNhatDraftHangLoat_; capNhatDraftHangLoat_ = function (ids) { __goiDraft.push(ids.slice()); return __gocHL(ids); }');
    const luot = () => { t.run('__goiDraft = []'); t.run('dongBoThanhToanNeuCoThayDoi_()'); return t.run('__goiDraft'); };
    tt.sua = 2; let g = luot();
    kiem('P1-TT1 lần đầu (chưa có bản đã áp dụng) -> tính lại toàn bộ 15 HĐ, KL đúng', g.length === 1 && g[0].length === 15 && kl(0) === 10 && kl(1) === 20 && kl(2) === 30, J({ g: g.map(x => x.length), kl: [kl(0), kl(1), kl(2)] }));
    // Sửa khối lượng 1 dòng có sẵn (số dòng không đổi, chỉ thời điểm sửa file đổi)
    shD.getRange(3, 13).setValue(25); tt.sua = 3; g = luot();
    kiem('P1-TT2 sửa KL dòng có sẵn của T1 -> chỉ tính lại đúng 1 HĐ (T1), KL = 25', g.length === 1 && J(g[0]) === J([ds[1].idHD]) && kl(1) === 25 && kl(0) === 10, J({ g, kl1: kl(1) }));
    // File có sửa nhưng dữ liệu thanh toán không đổi (sửa tab khác)
    tt.sua = 4; g = luot();
    kiem('P1-TT3 file đổi nhưng số liệu thanh toán không đổi -> không tính lại HĐ nào', g.length === 1 && g[0].length === 0, J(g));
    // Xóa dòng DNTT của T2
    shD.deleteRow(4); tt.sua = 5; g = luot();
    kiem('P1-TT4 xóa dòng DNTT của T2 -> tính lại T2, KL về theo lô (0)', J(g[0]) === J([ds[2].idHD]) && kl(2) === 0, J({ g, kl2: kl(2) }));
    // Ghi Draft lỗi giữa chừng -> lượt sau vẫn tính lại HĐ đổi
    dong('T3', 40, 'C3', '2026-06-05T08:00:00+07:00'); tt.sua = 6;
    t.run('var __gocDr = getOrCreateDraftBaoCaoSheet_; getOrCreateDraftBaoCaoSheet_ = function () { throw new Error("Sheets lỗi tạm"); }');
    luot();
    t.run('getOrCreateDraftBaoCaoSheet_ = __gocDr');
    g = luot();
    kiem('P1-TT5 lượt trước ghi Draft lỗi -> lượt sau vẫn tính lại T3 (không mất thay đổi)', g.length === 1 && g[0].indexOf(ds[3].idHD) !== -1 && kl(3) === 40, J({ g, kl3: kl(3) }));
    // Quá 24 giờ kể từ lần tính lại toàn bộ -> toàn bộ
    t.m.props.set('DNTT_TINH_LAI_TOAN_BO_LUC', String(Date.now() - 25 * 3600 * 1000)); tt.sua = 7; g = luot();
    kiem('P1-TT6 quá 24 giờ -> tính lại toàn bộ để tự sửa sai lệch', g.length === 1 && g[0].length === 15, J(g.map(x => x.length)));
    // Kết quả tăng dần khớp hoàn toàn với xây dựng lại toàn bộ
    const chup = () => { const c = t.run('DRAFT_BAOCAO_COL.CAP_NHAT_LUC'); return J(t.m.ssBaoCao.getSheetByName('Draft_BaoCaoHopDong').getDataRange().getValues().slice(1).map(r => r.map((x, i) => i === c ? '' : x instanceof Date ? x.getTime() : x)).sort()); };
    const a = chup(); t.run('XAY_DUNG_LAI_TOAN_BO_DRAFT_()');
    kiem('P1-TT7 Draft sau các lượt tăng dần GIỐNG HỆT xây dựng lại toàn bộ', a === chup());
  });
} catch (e) { truot++; ketQua.push('LỖI ' + e.stack); }

console.log(ketQua.join('\n'));
console.log('\n' + dat + ' đạt, ' + truot + ' trượt');
process.exit(truot ? 1 : 0);
