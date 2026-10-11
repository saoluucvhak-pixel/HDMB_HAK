// So đầu ra của MÃ CŨ và MÃ MỚI trên cùng bộ dữ liệu giả lập (tạo 150 hợp đồng ngẫu nhiên có hạt giống cố định, gồm tên
// trùng, CCCD trống / bị Sheets đổi thành số / có khoảng trắng): danh sách khách hàng (mọi trang, nhiều từ khóa), hợp đồng
// theo khách hàng, Tra cứu hợp đồng (nhiều từ khóa x có / không lọc ngày), chi tiết tra cứu. Dùng để chứng minh tối ưu không
// đổi kết quả nghiệp vụ.  Chạy: TZ=Asia/Ho_Chi_Minh node tests/so_sanh_dau_ra.cjs <thư mục mã cũ> [thư mục mã mới = repo]
// Lấy mã cũ: mkdir /tmp/cu && git archive <commit> '*.gs' | tar -x -C /tmp/cu
const { taoMoiTruong } = require('./gasmock.cjs');
const vm = require('vm'); const path = require('path'); const J = JSON.stringify;
function dung(thuMuc) {
  const m = taoMoiTruong(thuMuc); const run = c => vm.runInContext(c, m.ctx); const ss = m.ssChinh;
  const td = (ten, n) => { const sh = ss.insertSheet(ten); sh.getRange(1, 1, 1, n).setValues([Array.from({ length: n }, (_, i) => ten + '_C' + (i + 1))]); };
  td('HD_NCC', 33); td('HD_RUNG', 20); td('HD_STK', 10); td('HD_GPS', 10); td('HD_Picture', 13); td('DM_DIACHI', 8);
  m.props.set('REPORT_SPREADSHEET_ID', 'REPORT');
  let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const ten = ['Nguyễn Văn An', 'Trần Thị Bình', 'Lê Văn Cường', 'nguyễn văn an', 'Phạm Đức', 'Võ Thị Lan', 'Đỗ An'];
  for (let i = 0; i < 150; i++) {
    const k = Math.floor(rnd() * 60);
    run('TAO_HOP_DONG_MOI_(' + J({ tenChuRung: ten[k % ten.length] + (k > 30 ? ' ' + k : ''), cccdChuRung: '0490000' + String(10000 + k), ngayKy: '2026-0' + (1 + Math.floor(rnd() * 9)) + '-1' + Math.floor(rnd() * 9), soTK: '1' + i, nganHang: 'VCB', diaChiRung: 'X', dienTichKy: 1, slDuKien: 1, donGia: 1, sdtChuRung: '090' + k, nhomKH: k % 3 ? 'A' : '', maSoThue: k % 4 ? '' : '04' + k }) + ')');
  }
  const sh = ss.getSheetByName('HD_NCC'); sh.getRange(5, 7).setValue(''); sh.getRange(9, 7).setValue(49000010003); sh.getRange(12, 7).setValue(' 049000010005 ');
  const out = {};
  for (const tk of ['', 'an', 'nguyễn', '0490000100', 'xyz']) for (const tr of [1, 2, 3, 9]) out['KH ' + tk + '|' + tr] = run('layDanhSachKhachHang_(' + tr + ', 20, ' + J(tk) + ')');
  for (let k = 0; k < 60; k++) out['HĐ theo KH ' + k] = run('layHopDongTheoKhachHang_(' + J('0490000' + String(10000 + k)) + ')');
  out['HĐ theo KH (số)'] = run('layHopDongTheoKhachHang_("49000010003")');
  for (const tk of ['an', 'Nguyễn', 'nguyen van', '0490000100', '090', '049000010003', '1 2', 'X', '2026', 'Đỗ'])
    for (const ng of [['', ''], ['2026-03-01', '2026-06-30']]) out['TC ' + tk + ng] = run('TRA_CUU_HOP_DONG_(' + J(tk) + ',' + J(ng[0]) + ',' + J(ng[1]) + ')');
  out['TC chi tiết'] = run('CHI_TIET_TRA_CUU_HOP_DONG_(' + J(run('layDanhSachHopDong_(1,5,"","")').items[0].idHD) + ')');
  return out;
}
const cu = dung(process.argv[2]), moi = dung(process.argv[3] || path.resolve(__dirname, '..'));
let khac = 0; Object.keys(cu).forEach(k => { if (J(cu[k]) !== J(moi[k])) { khac++; if (khac < 5) console.log('KHÁC', k, '\n  cũ:', J(cu[k]).slice(0, 300), '\n  mới:', J(moi[k]).slice(0, 300)); } });
console.log(Object.keys(cu).length + ' trường hợp, khác: ' + khac);
process.exit(khac ? 1 : 0);
