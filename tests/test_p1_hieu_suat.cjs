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
} catch (e) { truot++; ketQua.push('LỖI ' + e.stack); }

console.log(ketQua.join('\n'));
console.log('\n' + dat + ' đạt, ' + truot + ' trượt');
process.exit(truot ? 1 : 0);
