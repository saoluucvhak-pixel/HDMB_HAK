// Giao diện mới (29/09): dựng TỪNG TRANG THẬT từ template Apps Script (tests/gas_template.cjs) và kiểm tra:
// menu chung đủ 11 mục, đúng 1 mục sáng theo trang, mục lục Thiết lập/Hướng dẫn, bản đồ vẽ lô + thẻ chi tiết.
const path = require('path');
const { danhGia } = require('./gas_template.cjs');
const { moTrinhDuyet, ghiTrangTam, inKetQua } = require('./ui_chung.cjs');
const giaLap = `<script>(function(){function taoRunner(){var ok=null;var r=new Proxy({},{get:function(_,k){
 if(k==='withSuccessHandler')return function(f){ok=f;return r}; if(k==='withFailureHandler'||k==='withUserObject')return function(){return r};
 return function(){var ten=k==='api'?arguments[1]:k;setTimeout(function(){if(!ok)return;var kq=window.__du&&window.__du[ten];
 ok(ten==='thongTinDangNhap'?{daDangNhap:true,email:'qt@test.vn',vaiTroNhan:'Quản trị',quyen:['XEM','NHAP_LIEU','QUAN_TRI'],quaPhien:true}:(kq!==undefined?kq:null))},5)}}});return r}
 window.google={script:{url:{getLocation:function(f){f({parameter:{},hash:''})}},history:{replace:function(){}},host:{close:function(){}},run:new Proxy({},{get:function(_,k){return taoRunner()[k]}})}};})();</script>`;
const duBanDo = `<script>window.__du={getMapData:{
 "L1":{coords:[{lat:15.48,lng:108.30},{lat:15.481,lng:108.302},{lat:15.479,lng:108.303},{lat:15.478,lng:108.3}],details:{maRung:"L1",ten:"<b>Chủ A</b>",soHD:"HD1",tinhTrang:"Đang thực hiện",dtKyHD:1000,dtGPS:990,idHD:"ID1",diaChi:"Thôn 1"}},
 "L2":{coords:[{lat:15.49,lng:108.31}],details:{maRung:"L2",ten:"Chủ B",soHD:"HD2",tinhTrang:"Đã hủy",idHD:"ID2"}}},layThoiGianCapNhatBanDo:null};</script>`;
const duHinhAnh = `<script>window.__du={LAY_ANH_TRA_CUU:{khachHang:{ten:"Chủ A",cccd:"049092012217"},tongAnh:5,tongHoSo:1,
 hopDong:[{soHD:"HD1",idHD:"X1",ngayKy:"18/09/2026",tinhTrang:"Đang thực hiện",diaChiRung:"Thôn 1",soLo:2,
  nhom:[{tieuDe:"Lô 1",anh:[{id:"a1",loai:"Ảnh hiện trường"},{id:"a2",loai:"Ảnh hiện trường"},{id:"a3",loai:"Ảnh GPS",lat:15.48,lng:108.3}]},
        {tieuDe:"Lô 2",anh:[{id:"a4",loai:"Ảnh hiện trường"},{id:"a5",loai:"Ảnh GPS",lat:15.49,lng:108.31}]}],
  hoSo:[{id:"h1",hoSoNguonGoc:"Giấy chứng nhận QSDĐ",soGiayTo:"CS 1",lo:"Lô 1"}]}]}};</script>`;
const TRANG = [
  ['30_Page_TongQuanHopDong', 'tongquan', '', 'Tổng quan hợp đồng'], ['33_Page_TraCuuHopDong', 'tracuu', '', 'Tra cứu hợp đồng'],
  ['27_Page_HopDongMeCon', 'hopdongmc', '', 'Nhập liệu HĐ / Rừng / TK'], ['11_Page_NhapLieu', 'form', '', 'Nhập liệu HĐ / Rừng / TK'],
  ['10_Page_BaoCao', 'baocao', '', 'Báo cáo tổng hợp'], ['35_Page_TraCuuHinhAnh', 'hinhanh', '', 'Tra cứu hình ảnh'],
  ['MapContainer', 'map', '', 'Bản đồ GPS'], ['12_Page_KiemTra', 'kiemtra', 'ocr', 'Đối chiếu OCR'],
  ['13_HuongDan', 'huongdan', '', 'Hướng dẫn sử dụng'], ['24_Page_ThietLap', 'thietlap', '', 'Thiết lập']
];
(async () => {
  const b = await moTrinhDuyet();
  const kq = [];
  for (const [file, trang, tab, mongDoi] of TRANG) {
    let html;
    try { html = danhGia(file, { currentPage: trang, baseUrl: 'https://script.google.com/macros/s/X/exec', tabTrang: tab, phien: '', loiDangNhap: '' }); }
    catch (e) { kq.push([file + ': dựng template', e.message]); continue; }
    html = html.replace(/<head>/i, '<head>' + giaLap + (trang === 'map' ? duBanDo : trang === 'hinhanh' ? duHinhAnh : ''));
    const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
    await p.route(/^https?:\/\//, r => {
      const u = r.request().url();
      try {
        if (/leaflet(\.min)?\.js$/.test(u)) return r.fulfill({ path: require.resolve('leaflet/dist/leaflet.js'), contentType: 'application/javascript' });
        if (/leaflet(\.min)?\.css$/.test(u)) return r.fulfill({ path: require.resolve('leaflet/dist/leaflet.css'), contentType: 'text/css' });
      } catch (e) { /* chưa cài leaflet */ }
      return r.abort();
    });
    await p.goto(ghiTrangTam('trang_' + file + '.html', html));
    await p.waitForTimeout(500);
    const m = await p.evaluate(() => ({ so: document.querySelectorAll('.hak-menu .nav-item').length, sang: [...document.querySelectorAll('.hak-menu .nav-item.active')].map(a => a.textContent.trim()), link: [...document.querySelectorAll('.hak-menu .nav-item')].every(a => /^https:\/\/script\.google\.com\/macros\/s\/X\/exec\?page=[a-z]+/.test(a.getAttribute('href'))) }));
    kq.push([file + ': menu chung 11 mục, link đúng, sáng đúng "' + mongDoi + '"', m.so === 11 && m.link && m.sang.length === 1 && m.sang[0] === mongDoi ? true : JSON.stringify(m)]);
    if (trang === 'thietlap' || trang === 'huongdan') {
      const ml = await p.evaluate(() => document.querySelectorAll('.hak-muc-luc a').length);
      kq.push([file + ': có mục lục dính bên trái', ml >= 5 ? true : 'số mục ' + ml]);
    }
    if (trang === 'thietlap') {
      await p.fill('.hak-muc-luc input', 'telegram');
      const loc = await p.evaluate(() => ({ hien: [...document.querySelectorAll('.card')].filter(c => c.style.display !== 'none' && c.querySelector(':scope > h3')).length }));
      kq.push(['Thiết lập: ô tìm lọc còn thẻ Telegram', loc.hien >= 1 && loc.hien <= 3 ? true : JSON.stringify(loc)]);
    }
    if (trang === 'thietlap') {
      await p.fill('.hak-muc-luc input', '');
      const nh = await p.evaluate(() => {
        const nhom = [...document.querySelectorAll('.hak-muc-luc .hak-ml-nhom')].map(x => x.textContent.trim());
        const ml = [...document.querySelectorAll('.hak-muc-luc a')].map(a => a.getAttribute('href').slice(1));
        const dom = [...document.querySelectorAll('[id^="hak_ml_"], .card > h3[id]')].map(h => h.id).filter(id => ml.indexOf(id) !== -1);
        return { nhom, dauTien: nhom[0], cungThuTu: JSON.stringify(ml) === JSON.stringify(dom) };
      });
      kq.push(['Thiết lập: mục lục chia nhóm (Truy cập đầu tiên) và thẻ sắp đúng thứ tự mục lục', nh.nhom.length >= 4 && nh.dauTien === 'Truy cập' && nh.cungThuTu ? true : JSON.stringify(nh)]);
    }
    if (trang === 'huongdan') {
      const hd = await p.evaluate(() => ({ phan: document.querySelectorAll('.hd-phan').length, buoc: [...document.querySelectorAll('.hd-buoc .hd-so')].map(x => x.textContent).join(','), tt: document.querySelectorAll('.warn.hd-tt').length, lu: document.querySelectorAll('.warn.hd-lu').length }));
      kq.push(['Hướng dẫn: mỗi phần 1 thẻ, 5 thẻ bước đánh số, hộp lưu ý tô theo loại', hd.phan >= 8 && hd.buoc === '1,2,3,4,5' && hd.tt >= 2 && hd.lu >= 1 ? true : JSON.stringify(hd)]);
    }
    if (trang === 'baocao') {
      const bc = await p.evaluate(() => {
        renderTongHopWebapp({ soHopDong: 7, tongKhoiLuong: 1000, tongGiaTri: 5e8, tongKhoiLuongThucHien: 250, tongGiaTriThucHien: 1e8, chiTiet: [], trang: 1, tongTrang: 1, tongSo: 0 });
        return { kl: document.getElementById('kpiKLDaTH').textContent.trim(), rong: document.getElementById('thanhKLDaTH').style.width, loc: !!document.querySelector('.hak-loc-gon') };
      });
      kq.push(['Báo cáo: ô KPI "Đã thực hiện" + thanh tiến độ 25%, bộ lọc gọn', bc.kl !== '0' && bc.kl !== '—' && bc.rong === '25%' && bc.loc ? true : JSON.stringify(bc)]);
    }
    if (trang === 'hinhanh') {
      await p.evaluate(() => haMoAnh_('X1', false));
      await p.waitForTimeout(300);
      const dem = () => p.evaluate(() => [...document.querySelectorAll('.ha-o')].filter(o => o.style.display !== 'none').length);
      const tatCa = await dem();
      await p.click('#haLocLoai button[data-loai="gps"]');
      const gps = await dem();
      kq.push(['Tra cứu hình ảnh: lọc "Ảnh GPS" chỉ còn 2 ảnh (không mất ảnh khác khi bỏ lọc)', tatCa >= 5 && gps === 2 ? true : JSON.stringify({ tatCa, gps })]);
    }
    if (trang === 'map') {
      const bd = await p.evaluate(() => ({ lo: document.querySelectorAll('#dsLo .lo').length, hinh: typeof lopLo !== 'undefined' ? lopLo.getLayers().length : -1, xss: !!document.querySelector('#dsLo b') }));
      kq.push(['Bản đồ: danh sách 2 lô, vẽ 2 hình, tên được escape', bd.lo === 2 && bd.hinh === 2 && !bd.xss ? true : JSON.stringify(bd)]);
      await p.click('#dsLo .lo');
      await p.waitForTimeout(200);
      const the = await p.evaluate(() => { const t = document.getElementById('theChiTiet'); return { hien: t.classList.contains('hien'), diem: t.querySelectorAll('tr.diem').length, hd: !!t.querySelector('a[href*="page=tracuu&q=HD1"]'), anh: !!t.querySelector('a[href*="page=hinhanh&idhd=ID1"]'), mau: !!t.querySelector('.hak-tt-dang') }; });
      kq.push(['Bản đồ: bấm lô -> thẻ chi tiết 4 góc + link hợp đồng/ảnh + nhãn tình trạng màu', the.hien && the.diem === 4 && the.hd && the.anh && the.mau ? true : JSON.stringify(the)]);
      await p.click('#locGps button[data-loc="thieu"]');
      const thieu = await p.evaluate(() => document.querySelectorAll('#dsLo .lo').length);
      kq.push(['Bản đồ: lọc "Thiếu GPS" còn 1 lô', thieu === 1 ? true : 'còn ' + thieu]);
    }
    await p.close();
  }
  inKetQua(kq);
  await b.close();
  process.exitCode = kq.every(x => x[1] === true) ? 0 : 1;
})().catch(e => { console.error(e); process.exit(1); });
