// Máy chủ (rà soát 24/10/2026): danh sách khách hàng GỌN cho Nhập liệu / Thêm-Sửa HĐ + tra chi tiết theo CCCD.
// Chạy: TZ=Asia/Ho_Chi_Minh node tests/test_khach_hang.cjs [thư mục mã nguồn]
const { taoMoiTruong } = require('./gasmock.cjs');
const vm = require('vm');
const path = require('path');
const THU_MUC = process.argv[2] || path.resolve(__dirname, '..');
const J = JSON.stringify;
let dat = 0, truot = 0; const ketQua = [];
function kiem(ten, dk, chiTiet) { if (dk) { dat++; ketQua.push('PASS ' + ten); } else { truot++; ketQua.push('FAIL ' + ten + (chiTiet ? ' — ' + chiTiet : '')); } }
function chay(f) { try { f(); } catch (e) { truot++; ketQua.push('LỖI ' + String(e.message).slice(0, 200)); } }

const m = taoMoiTruong(THU_MUC);
const run = c => vm.runInContext(c, m.ctx);
const td = (ten, n) => { const sh = m.ssChinh.insertSheet(ten); sh.getRange(1, 1, 1, n).setValues([Array.from({ length: n }, (_, i) => ten + '_C' + (i + 1))]); return sh; };
const shNCC = td('HD_NCC', 33); td('HD_RUNG', 20); td('HD_STK', 10); td('HD_GPS', 10); td('HD_Picture', 13); td('DM_DIACHI', 8);
m.props.set('REPORT_SPREADSHEET_ID', 'REPORT');
// 5.200 khách hàng (vượt mốc 5.000 cũ), CCCD dạng chữ có số 0 đầu; khách cuối theo thứ tự tên là "Zz ..."
const C = k => run(k);
const cot = { ten: C('NCC_COL.TEN_CHU_RUNG'), cccd: C('NCC_COL.CCCD_CHU_RUNG'), sdt: C('NCC_COL.SDT_CHU_RUNG'), tt: C('NCC_COL.DIA_CHI_TT'), id: C('NCC_COL.ID_HD'), so: C('NCC_COL.SO_HD') };
const dong = [];
for (let i = 0; i < 5200; i++) {
  const r = Array(33).fill('');
  r[cot.ten] = (i === 5199 ? 'Zz Cuoi Danh Sach' : 'Khach ' + String(i).padStart(5, '0'));
  r[cot.cccd] = '0490' + String(10000000 + i); r[cot.sdt] = '090' + String(1000000 + i); r[cot.tt] = 'Thôn ' + i;
  r[cot.id] = 'HD' + i; r[cot.so] = 'S' + i;
  dong.push(r);
}
shNCC.getRange('A2:AG2').setNumberFormat && shNCC.getRange(2, cot.cccd + 1, 5200, 1).setNumberFormat('@');
shNCC.getRange(2, 1, dong.length, 33).setValues(dong);

chay(function () {
  const cu = run('layDanhSachKhachHang_(1, 5000, "")');
  const gon = run('LAY_DS_KHACH_HANG_GON_()');
  kiem('K1 danh sách gọn có ĐỦ 5.200 khách (cách cũ nạp 1 trang 5.000 -> thiếu 200)', gon.ds.length === 5200 && cu.items.length === 5000, gon.ds.length + ' / ' + cu.items.length);
  const cuoi = gon.ds.find(a => a[1] === 'Zz Cuoi Danh Sach');
  kiem('K1 khách đứng sau mốc 5.000 theo thứ tự tên vẫn có trong danh sách gọn', !!cuoi && !cu.items.some(x => x.tenChuRung === 'Zz Cuoi Danh Sach'), J(cuoi));
  kiem('K2 CCCD giữ dạng chữ, đủ số 0 đầu', gon.ds.every(a => typeof a[0] === 'string' && a[0].length === 12 && a[0][0] === '0'), J(gon.ds[0]));
  const kbCu = Buffer.byteLength(J(cu)) / 1024, kbGon = Buffer.byteLength(J(gon)) / 1024;
  kiem('K4 dữ liệu tải về nhỏ hơn dù đủ khách (' + kbCu.toFixed(0) + ' KB / 5.000 khách -> ' + kbGon.toFixed(0) + ' KB / 5.200 khách)', kbGon < kbCu * 0.7, kbCu + ' -> ' + kbGon);
  const tren = cu.items[123];
  const chiTiet = run('LAY_KHACH_HANG_THEO_CCCD_(' + J(tren.cccd) + ')');
  kiem('K3 chi tiết theo CCCD giống hệt bản ghi của layDanhSachKhachHang_', J(chiTiet) === J(tren), J(chiTiet));
  const ctCuoi = run('LAY_KHACH_HANG_THEO_CCCD_(' + J(cuoi[0]) + ')');
  kiem('K3 lấy được chi tiết cả khách đứng sau mốc 5.000 (SĐT giữ số 0 đầu)', ctCuoi && ctCuoi.tenChuRung === 'Zz Cuoi Danh Sach' && /^090/.test(String(ctCuoi.sdt)), J(ctCuoi));
  kiem('K3 CCCD không có -> null', run('LAY_KHACH_HANG_THEO_CCCD_("000000000000")') === null && run('LAY_KHACH_HANG_THEO_CCCD_("")') === null);
});
chay(function () {
  run('LAY_DS_KHACH_HANG_GON_()'); // đã nhớ
  run('TAO_HOP_DONG_MOI_(' + J({ tenChuRung: 'Moi Tao', cccdChuRung: '049099999999', ngayKy: '2026-05-10', soTK: '0011', nganHang: 'VCB', soHD: 'MOI1', diaChiRung: 'Thôn A', dienTichKy: 10000, slDuKien: 120, donGia: 1000 }) + ')');
  const gon = run('LAY_DS_KHACH_HANG_GON_()');
  kiem('K5 tạo hợp đồng cho khách mới -> danh sách gọn thấy ngay (bản nhớ được xóa)', gon.ds.some(a => a[0] === '049099999999'), String(gon.ds.length));
  const ct = run('LAY_KHACH_HANG_THEO_CCCD_("049099999999")');
  kiem('K5 chi tiết khách mới tạo lấy được ngay', ct && ct.tenChuRung === 'Moi Tao', J(ct));
});

console.log(ketQua.join('\n'));
console.log('\n' + dat + ' đạt, ' + truot + ' trượt');
process.exit(truot ? 1 : 0);
