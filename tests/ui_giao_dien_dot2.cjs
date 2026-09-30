// Giao diện mới đợt 2: Tổng quan (4 chỉ số, nút lọc, tiến độ), Tra cứu 2 cột, thanh tiến độ 5 bước + bảng so khớp OCR
// ở Nhập liệu, bản đồ điện thoại (thẻ trượt). Dựng TRANG THẬT từ template (gas_template.cjs), dữ liệu giả lập.
const { danhGia } = require('./gas_template.cjs');
const { moTrinhDuyet, ghiTrangTam, inKetQua } = require('./ui_chung.cjs');
const giaLap = du => `<script>window.__du=${JSON.stringify(du)};(function(){function taoRunner(){var ok=null;var r=new Proxy({},{get:function(_,k){
 if(k==='withSuccessHandler')return function(f){ok=f;return r}; if(k==='withFailureHandler'||k==='withUserObject')return function(){return r};
 return function(){var ten=k==='api'?arguments[1]:k;window.__goi=(window.__goi||[]).concat(ten);setTimeout(function(){if(!ok)return;var kq=window.__du[ten];
 ok(ten==='thongTinDangNhap'&&kq===undefined?{daDangNhap:true,email:'qt@test.vn',vaiTroNhan:'Quản trị',quyen:['XEM','NHAP_LIEU','QUAN_TRI'],quaPhien:true}:(kq!==undefined?kq:null))},5)}}});return r}
 window.google={script:{url:{getLocation:function(f){f({parameter:(window.__du&&window.__du.__thamSo)||{},hash:''})}},history:{replace:function(){},push:function(){}},host:{close:function(){}},run:new Proxy({},{get:function(_,k){return taoRunner()[k]}})}};})();</script>`;
async function mo(b, file, trang, du, kichThuoc) {
  let html = danhGia(file, { currentPage: trang, baseUrl: 'https://script.google.com/macros/s/X/exec', tabTrang: '', phien: '', loiDangNhap: '' });
  html = html.replace(/<head>/i, '<head>' + giaLap(du));
  const p = await b.newPage({ viewport: kichThuoc || { width: 1440, height: 900 } });
  await p.route(/^https?:\/\//, r => {
    const u = r.request().url();
    try {
      if (/leaflet(\.min)?\.js$/.test(u)) return r.fulfill({ path: require.resolve('leaflet/dist/leaflet.js'), contentType: 'application/javascript' });
      if (/leaflet(\.min)?\.css$/.test(u)) return r.fulfill({ path: require.resolve('leaflet/dist/leaflet.css'), contentType: 'text/css' });
    } catch (e) { /* chưa cài leaflet */ }
    return r.abort();
  });
  await p.goto(ghiTrangTam('d2_' + file + '_' + (kichThuoc ? kichThuoc.width : 1440) + '.html', html));
  await p.waitForTimeout(500);
  return p;
}
(async () => {
  const b = await moTrinhDuyet();
  const kq = [];
  // 1) Tổng quan
  let p = await mo(b, '30_Page_TongQuanHopDong', 'tongquan', { LAY_TONG_QUAN_HOP_DONG: { tongSoHopDong: 3, theoTrangThai: { 'Chờ thực hiện': 1, 'Đang thực hiện': 2 },
    tongGiaTriHopDong: 1000000, tongKhoiLuongThucHien: 50, tongGiaTriThucHien: 250000, tongKhoiLuongDuKien: 200, tongSo: 3, trang: 1, tongTrang: 1,
    items: [{ idHD: 'A', soHD: 'S1', tenChuRung: '<i>X</i>', ngayKy: '2026-09-01', tinhTrang: 'Đang thực hiện', khoiLuongDuKien: 100, khoiLuongThucHien: 50, giaTriHopDong: 500000 }] } });
  let r = await p.evaluate(() => ({ kpi: document.querySelectorAll('#vungKpiTien .hak-kpi').length, pt: document.querySelector('#vungKpiTien .hak-kpi:nth-child(3) .phu').textContent,
    chip: document.querySelectorAll('#vungTheThongKe button').length, bam: document.querySelector('#vungTheThongKe button[aria-pressed="true"]').textContent.trim(),
    tienDo: document.querySelector('#vungBangHD .hak-tien-do b').textContent, xss: !!document.querySelector('#vungBangHD i'), mau: !!document.querySelector('#vungBangHD .hak-tt-dang') }));
  kq.push(['Tổng quan: 4 chỉ số, % khối lượng 25%, 6 nút lọc, tiến độ dòng 50%, nhãn màu, tên escape',
    r.kpi === 4 && /25%/.test(r.pt) && r.chip === 6 && /^Tất cả/.test(r.bam) && r.tienDo === '50%' && !r.xss && r.mau ? true : JSON.stringify(r)]);
  await p.close();
  // 2) Tra cứu 2 cột
  const ketQua = [{ idHD: 'A', soHD: 'S1', ngayKy: '01/09/2026', tenChuRung: 'Chủ A', tinhTrang: 'Đang thực hiện' }, { idHD: 'B', soHD: 'S2', ngayKy: '02/09/2026', tenChuRung: 'Chủ B', tinhTrang: 'Đã thanh lý' }];
  p = await mo(b, '33_Page_TraCuuHopDong', 'tracuu', { TRA_CUU_HOP_DONG: { tongSo: 2, ketQua: ketQua }, CHI_TIET_TRA_CUU_HOP_DONG: { idHD: 'A', hopDong: { soHD: 'S1', tenChuRung: 'Chủ A' }, thucHien: {}, loRung: [], taiKhoan: [], hoSo: [], anh: [] } });
  await p.fill('#tcTuKhoa', 'Chu'); await p.click('#tcNutTim'); await p.waitForTimeout(400);
  r = await p.evaluate(() => ({ hai: document.getElementById('tcHaiCot').classList.contains('co-chi-tiet'), kq: getComputedStyle(document.getElementById('tcVungKetQua')).display, chon: (document.querySelector('#tcVungKetQua tr.dang-chon') || {}).dataset, ct: document.getElementById('tcVungChiTiet').textContent.indexOf('S1') !== -1, luoi: getComputedStyle(document.getElementById('tcHaiCot')).display }));
  kq.push(['Tra cứu màn rộng: 2 cột, danh sách vẫn hiện, tự mở HĐ đầu tiên và đánh dấu', r.hai && r.kq !== 'none' && r.chon && r.chon.id === 'A' && r.ct && r.luoi === 'grid' ? true : JSON.stringify(r)]);
  await p.close();
  p = await mo(b, '33_Page_TraCuuHopDong', 'tracuu', { TRA_CUU_HOP_DONG: { tongSo: 2, ketQua: ketQua }, CHI_TIET_TRA_CUU_HOP_DONG: { idHD: 'A', hopDong: { soHD: 'S1' }, thucHien: {}, loRung: [], taiKhoan: [], hoSo: [], anh: [] } }, { width: 390, height: 844 });
  await p.fill('#tcTuKhoa', 'Chu'); await p.click('#tcNutTim'); await p.waitForTimeout(400);
  r = await p.evaluate(() => ({ goi: (window.__goi || []).filter(x => x === 'CHI_TIET_TRA_CUU_HOP_DONG').length, hai: document.getElementById('tcHaiCot').classList.contains('co-chi-tiet') }));
  kq.push(['Tra cứu điện thoại: giữ kiểu 1 cột, không tự mở chi tiết', r.goi === 0 && !r.hai ? true : JSON.stringify(r)]);
  await p.close();
  // 2b) Tra cứu: nút Sửa hợp đồng theo quyền + tình trạng
  const ctTC = (tt) => ({ idHD: 'A&1', hopDong: { soHD: 'S1', tenChuRung: 'Chủ A', tinhTrang: tt }, thucHien: {}, loRung: [], taiKhoan: [], hoSo: [], anh: [] });
  const nutSua = async (du) => {
    const pp = await mo(b, '33_Page_TraCuuHopDong', 'tracuu', Object.assign({ TRA_CUU_HOP_DONG: { tongSo: 1, ketQua: ketQua.slice(0, 1) } }, du));
    await pp.waitForTimeout(150); await pp.fill('#tcTuKhoa', 'Chu'); await pp.click('#tcNutTim'); await pp.waitForTimeout(400);
    const x = await pp.evaluate(() => { const a = document.querySelector('#tcVungChiTiet .tc-nut-sua'); return a ? { chu: a.textContent.trim(), href: a.getAttribute('href'), target: a.target } : null; });
    await pp.close(); return x;
  };
  r = await nutSua({ CHI_TIET_TRA_CUU_HOP_DONG: ctTC('Đang thực hiện') });
  kq.push(['Tra cứu: Nhập liệu/Quản trị thấy nút "Sửa hợp đồng" mở đúng HĐ ở trang Nhập liệu', r && r.chu === '✏️ Sửa hợp đồng' && r.href === 'https://script.google.com/macros/s/X/exec?page=hopdongmc&idHD=A%261' && r.target === '_top' ? true : JSON.stringify(r)]);
  r = await nutSua({ CHI_TIET_TRA_CUU_HOP_DONG: ctTC('Đã thanh lý') });
  kq.push(['Tra cứu: HĐ đã chốt -> nút "Mở ở Nhập liệu" (chỉ xem)', r && r.chu === '👁️ Mở ở Nhập liệu' ? true : JSON.stringify(r)]);
  r = await nutSua({ CHI_TIET_TRA_CUU_HOP_DONG: ctTC('Đang thực hiện'), thongTinDangNhap: { daDangNhap: true, email: 'x@test.vn', vaiTroNhan: 'Chỉ xem', quyen: ['XEM'], quaPhien: true } });
  kq.push(['Tra cứu: vai trò Chỉ xem không có nút Sửa', r === null ? true : JSON.stringify(r)]);
  // 2c) Nhập liệu mở đúng hợp đồng từ ?idHD= (đọc qua google.script.url.getLocation — khung sandbox / Portal)
  p = await mo(b, '27_Page_HopDongMeCon', 'hopdongmc', { __thamSo: { page: 'hopdongmc', idHD: 'X9' }, layHopDongTheoIdHD: { idHD: 'X9', soDong: 5, soHD: 'S9', tenChuRung: 'Chủ Chín', tinhTrang: 'Đang thực hiện' } });
  await p.waitForTimeout(600);
  r = await p.evaluate(() => ({ goi: (window.__goi || []).slice(0, 12), chu: document.body.textContent.indexOf('S9') !== -1 }));
  kq.push(['Nhập liệu: link ?idHD= (từ nút Sửa ở Tra cứu) mở thẳng hợp đồng đó', r.chu && r.goi.indexOf('layHopDongTheoIdHD') !== -1 ? true : JSON.stringify(r)]);
  await p.close();
  p = await mo(b, '27_Page_HopDongMeCon', 'hopdongmc', { __thamSo: { page: 'hopdongmc', idHD: 'Z1' } }); // máy chủ trả null
  const loiJs = []; p.on('pageerror', e => loiJs.push(e.message));
  await p.waitForTimeout(600);
  r = await p.evaluate(() => document.getElementById('vungChinh').textContent);
  kq.push(['Nhập liệu: máy chủ trả rỗng -> báo lỗi rõ ràng, không treo "Đang tải"', /trả về rỗng/.test(r) && !loiJs.length ? true : r.slice(0, 120) + ' ' + loiJs.join('|')]);
  await p.close();
  // 2d) Nhập liệu > chi tiết lô: nút Xóa điểm GPS / ảnh (chỉ khi HĐ còn sửa được)
  const moLo = async (tt) => {
    const pp = await mo(b, '27_Page_HopDongMeCon', 'hopdongmc', {
      layGPSCuaRung: [{ lat: 15.1, lng: 108.1, hinhAnh: '', soDong: 3, dau: 'g3' }, { lat: 15.2, lng: 108.2, hinhAnh: '', soDong: 4, dau: 'g4' }],
      layDraftAnhChoRung: [{ nguon: 'moi', trangThai: 'Đã duyệt', tenFile: 'a.jpg', url: 'https://drive.google.com/x', idDraft: 'D1' }, { nguon: 'cu', trangThai: 'Đã duyệt', tenFile: 'b.jpg', url: 'https://drive.google.com/y', soDongPic: 2, cot: 3, giaTriGoc: 'y' }],
      XOA_DIEM_GPS: { thanhCong: true, maDot: 'X' }, XOA_ANH_RUNG: { thanhCong: true } });
    await pp.evaluate((t) => moChiTietRung({ idHD: 'H1', soHD: 'S1', tenChuRung: 'A', cccdChuRung: '0', tinhTrang: t }, 'L1'), tt); await pp.waitForTimeout(300);
    return pp;
  };
  const bamXoa = async (pp, sel) => {
    await pp.evaluate(() => { window.__goi = []; }); await pp.click(sel);
    await pp.waitForFunction(() => [...document.querySelectorAll('[role="dialog"] button')].some(x => x.textContent.trim() === 'Xóa'));
    await pp.evaluate(() => [...document.querySelectorAll('[role="dialog"] button')].find(x => x.textContent.trim() === 'Xóa').click()); await pp.waitForTimeout(200);
    return pp.evaluate(() => window.__goi.slice());
  };
  p = await moLo('Đang thực hiện');
  r = { soNut: await p.evaluate(() => document.querySelectorAll('.lnk-xoa-gps').length), goi: await bamXoa(p, '.lnk-xoa-gps') };
  kq.push(['Nhập liệu lô: mỗi điểm GPS có nút Xóa, xác nhận rồi gọi XOA_DIEM_GPS', r.soNut === 2 && r.goi.indexOf('XOA_DIEM_GPS') !== -1 ? true : JSON.stringify(r)]);
  await p.evaluate(() => chonTabRung('anh')); await p.waitForTimeout(300);
  r = { soNut: await p.evaluate(() => document.querySelectorAll('.lnk-xoa-anh').length), goi: await bamXoa(p, '.lnk-xoa-anh') };
  kq.push(['Nhập liệu lô: mỗi ảnh (mới + cũ) có nút Xóa, gọi XOA_ANH_RUNG', r.soNut === 2 && r.goi.indexOf('XOA_ANH_RUNG') !== -1 ? true : JSON.stringify(r)]);
  await p.close();
  p = await moLo('Đã thanh lý');
  r = await p.evaluate(async () => { const g = document.querySelectorAll('.lnk-xoa-gps').length; chonTabRung('anh'); await new Promise(x => setTimeout(x, 300)); return { g: g, a: document.querySelectorAll('.lnk-xoa-anh').length }; });
  kq.push(['Nhập liệu lô: HĐ đã chốt -> không có nút Xóa GPS / ảnh', r.g === 0 && r.a === 0 ? true : JSON.stringify(r)]);
  await p.close();
  // 3) Nhập liệu: thanh 5 bước + so khớp OCR
  p = await mo(b, '27_Page_HopDongMeCon', 'hopdongmc', { layHopDongTheoIdHD: { idHD: 'X1', soDong: 5, soHD: 'S1', tenChuRung: 'Chủ A', cccdChuRung: '049000000001', tinhTrang: 'Chờ thực hiện' },
    TIEN_DO_HO_SO_HD: { coDuLieu: true, soTaiKhoan: 1, soLoRung: 2, hoSoDu: true, daDoGPSDu: false, coAnh: false, thieuHoSoChiTiet: 'Lô 2 thiếu GPS' } });
  await p.evaluate(() => moChiTietHopDong('X1')); await p.waitForTimeout(400);
  r = await p.evaluate(() => ({ buoc: document.querySelectorAll('#vungTienDoHS li').length, xong: document.querySelectorAll('#vungTienDoHS li.xong').length, thieu: (document.querySelector('#vungTienDoHS .thieu') || {}).textContent }));
  kq.push(['Nhập liệu: thanh 5 bước, 3 bước xong, hiện "Còn thiếu"', r.buoc === 5 && r.xong === 3 && /Lô 2 thiếu GPS/.test(r.thieu || '') ? true : JSON.stringify(r)]);
  await p.click('#vungTienDoHS button[data-tab="stk"]'); await p.waitForTimeout(300);
  r = await p.evaluate(() => ({ tab: (document.querySelector('.tabitem.active') || {}).dataset, goi: (window.__goi || []).filter(x => x === 'TIEN_DO_HO_SO_HD').length }));
  kq.push(['Nhập liệu: bấm bước "Tài khoản" mở thẻ STK, không gọi lại máy chủ lấy tiến độ', r.tab && r.tab.tab === 'stk' && r.goi === 1 ? true : JSON.stringify(r)]);
  await p.evaluate(() => { document.body.insertAdjacentHTML('beforeend', '<div id="oThu"><input id="oTen" value="Nguyễn Văn A"><input id="oCccd" value="04900000000"><input id="oNgay" value=""></div>');
    window.__doi = 0; document.getElementById('oCccd').addEventListener('input', function () { window.__doi++; });
    hakSoKhopOcr_([{ nhan: 'Họ tên', id: 'oTen', gt: 'NGUYỄN VĂN A' }, { nhan: 'CCCD', id: 'oCccd', gt: '049000000001' }, { nhan: 'Ngày cấp', id: 'oNgay', gt: '2021-05-12' }, { nhan: 'Không có ô', id: 'khongCo', gt: 'x' }]).then(n => { window.__n = n; }); });
  await p.waitForTimeout(150);
  r = await p.evaluate(() => ({ dong: document.querySelectorAll('.hak-ocr tbody tr').length, khoa: document.querySelectorAll('.hak-ocr input:disabled').length, chon: document.querySelectorAll('.hak-ocr input:checked:not(:disabled)').length, xss: !!document.querySelector('.hak-ocr i') }));
  kq.push(['OCR: bảng so khớp 3 dòng (bỏ ô không có), tên khớp bị khóa, 2 dòng chọn sẵn', r.dong === 3 && r.khoa === 1 && r.chon === 2 ? true : JSON.stringify(r)]);
  await p.click('.hak-ocr tbody tr:nth-child(3) input'); // bỏ chọn Ngày cấp
  await p.click('.hak-ocr .chinh'); await p.waitForTimeout(100);
  r = await p.evaluate(() => ({ n: window.__n, cccd: document.getElementById('oCccd').value, ngay: document.getElementById('oNgay').value, ten: document.getElementById('oTen').value, doi: window.__doi, con: !!document.querySelector('.hak-ocr') }));
  kq.push(['OCR: chỉ áp dụng trường đã chọn, phát sự kiện input, không đổi ô khớp, đóng hộp', r.n === 1 && r.cccd === '049000000001' && r.ngay === '' && r.ten === 'Nguyễn Văn A' && r.doi === 1 && !r.con ? true : JSON.stringify(r)]);
  await p.evaluate(() => { hakSoKhopOcr_([{ nhan: 'CCCD', id: 'oCccd', gt: '1' }]).then(n => { window.__n2 = n; }); });
  await p.waitForTimeout(100); await p.keyboard.press('Escape'); await p.waitForTimeout(50);
  r = await p.evaluate(() => ({ n: window.__n2, cccd: document.getElementById('oCccd').value }));
  kq.push(['OCR: Esc = bỏ qua, không đổi gì', r.n === 0 && r.cccd === '049000000001' ? true : JSON.stringify(r)]);
  await p.close();
  // 4) Bản đồ điện thoại
  p = await mo(b, 'MapContainer', 'map', { getMapData: { L1: { coords: [{ lat: 15.48, lng: 108.3 }, { lat: 15.481, lng: 108.302 }, { lat: 15.479, lng: 108.303 }], details: { maRung: 'L1', ten: 'Chủ A', soHD: 'S1', tinhTrang: 'Đang thực hiện', idHD: 'I1' } } } }, { width: 390, height: 844 });
  await p.click('#dsLo .lo'); await p.waitForTimeout(200);
  r = await p.evaluate(() => { const t = document.getElementById('theChiTiet').getBoundingClientRect(); return { coThe: document.body.classList.contains('co-the'), day: Math.round(t.bottom), rong: Math.round(t.width) }; });
  kq.push(['Bản đồ điện thoại: bấm lô -> thẻ trượt sát đáy, rộng hết màn, thu gọn danh sách', r.coThe && r.day === 844 && r.rong === 390 ? true : JSON.stringify(r)]);
  await p.click('#dongThe');
  r = await p.evaluate(() => document.body.classList.contains('co-the'));
  kq.push(['Bản đồ điện thoại: đóng thẻ -> hiện lại danh sách', r === false ? true : 'vẫn thu gọn']);
  await p.close();
  inKetQua(kq);
  await b.close();
  process.exitCode = kq.every(x => x[1] === true) ? 0 : 1;
})().catch(e => { console.error(e); process.exit(1); });
