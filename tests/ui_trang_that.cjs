// Giao diện mới (29/09): dựng TỪNG TRANG THẬT từ template Apps Script (tests/gas_template.cjs) và kiểm tra:
// menu chung đủ 11 mục, đúng 1 mục sáng theo trang, mục lục Thiết lập/Hướng dẫn, bản đồ vẽ lô + thẻ chi tiết.
const path = require('path');
const { danhGia } = require('./gas_template.cjs');
const { moTrinhDuyet, ghiTrangTam, inKetQua } = require('./ui_chung.cjs');
const giaLap = `<script>(function(){function taoRunner(){var ok=null;var r=new Proxy({},{get:function(_,k){
 if(k==='withSuccessHandler')return function(f){ok=f;return r}; if(k==='withFailureHandler'||k==='withUserObject')return function(){return r};
 return function(){var ten=k==='api'?arguments[1]:k;(window.__goi=window.__goi||[]).push([ten,[].slice.call(arguments,k==='api'?2:0)]);setTimeout(function(){if(!ok)return;var kq=window.__du&&window.__du[ten];
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
const duThietLap = `<script>window.__du={
 TIM_DONG_NGHI_TRUNG:{soNhom:2,hopDong:[{ma:1,lyDo:["Cùng ID_HD","Cùng CCCD chủ rừng + ngày ký"],dong:[
   {bang:"HD_NCC",dong:2,dau:"d2",idHD:"A1",soHD:"A1",tenChuRung:"<b>Chủ A</b>",cccd:"049",ngayKy:"2026-05-10",tinhTrang:"Đang thực hiện",soLo:2,soTK:1,soGps:3,soAnh:1,cheDoXoa:"dong",goiYGiu:true},
   {bang:"HD_NCC",dong:5,dau:"d5",idHD:"A1",soHD:"A1",tenChuRung:"Chủ A",cccd:"049",ngayKy:"2026-05-10",tinhTrang:"Đang thực hiện",soLo:2,soTK:1,soGps:3,soAnh:1,cheDoXoa:"dong",goiYGiu:false},
   {bang:"HD_NCC",dong:3,dau:"d3",idHD:"B1",soHD:"A2",tenChuRung:"Chủ A",cccd:"049",ngayKy:"2026-05-10",tinhTrang:"Chờ thực hiện",soLo:1,soTK:1,soGps:1,soAnh:0,cheDoXoa:"hopdong",goiYGiu:false}]}],
  loRung:[{ma:1,lyDo:["Cùng ID_RUNG"],dong:[{bang:"HD_RUNG",dong:4,dau:"r4",idRung:"L1",maRung:"M1",idHD:"A1",soHD:"A1",tenChuRung:"Chủ A",diaChi:"Thôn 1",dienTich:3000,soGps:2,cheDoXoa:"dong",goiYGiu:true},
   {bang:"HD_RUNG",dong:9,dau:"r9",idRung:"L1",maRung:"M1",idHD:"A1",soHD:"A1",tenChuRung:"Chủ A",diaChi:"Thôn 1",dienTich:3000,soGps:2,cheDoXoa:"dong",goiYGiu:false}]}]},
 XOA_DONG_NGHI_TRUNG:{thanhCong:true,daXoa:3,boQua:[],conLai:0,maDot:["XOA_1"]},
 CHAN_DOAN_MO_COI_TOAN_HE_THONG:{tongSoVanDe:3,ncc_thieuIdHD:[{dong:7,dau:"n7",soHD:"X",tenChuRung:"Y"}],rung_moCoi:[{dong:8,dau:"m8",maRung:"MR",soHD:"Z",idKeyHDSai:"KHONG"}],rung_thieuIdRung:[],stk_moCoi:[{dong:6,dau:"s6",soTK:"555",tenChuRung:"Q",idHDSai:"KHONG2"}],gps_moCoi:[],picture_moCoi:[],o_soLaNgay:[{bang:"HD_RUNG",dong:12,o:"S12",tenCot:"KL thực hiện",giaTri:"30/09/2026 09:34:18",soHD:"20260914003",idRung:"L9"}]},
 LAM_SACH_O_SO_LA_NGAY:{thanhCong:true,soO:1,soHopDong:1},
 XOA_DONG_MO_COI:{thanhCong:true,daXoa:2,daXoaKem:1,boQua:[],maDot:"XOA_2"}};</script>`;
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
    html = html.replace(/<head>/i, '<head>' + giaLap + (trang === 'map' ? duBanDo : trang === 'hinhanh' ? duHinhAnh : trang === 'thietlap' ? duThietLap : ''));
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
    if (trang === 'thietlap') {
      const bamDongY = async () => { await p.waitForFunction(() => [...document.querySelectorAll('[role="dialog"] button')].some(x => x.textContent.trim() === 'Xóa')); await p.evaluate(() => [...document.querySelectorAll('[role="dialog"] button')].find(x => x.textContent.trim() === 'Xóa').click()); };
      await p.evaluate(() => timDongNghiTrung()); await p.waitForTimeout(150);
      const nt = await p.evaluate(() => ({ nhom: document.querySelectorAll('#ketQuaNghiTrung table').length, o: document.querySelectorAll('.ntChon').length, xss: !!document.querySelector('#ketQuaNghiTrung b b'), ca: document.querySelectorAll('.nt-ca').length, giu: document.querySelectorAll('.nt-giu').length, tat: document.getElementById('btnXoaNghiTrung').disabled }));
      kq.push(['Thiết lập nghi trùng: 2 bảng nhóm, 5 ô chọn, nhãn "xóa cả hợp đồng", gợi ý giữ, tên escape, nút Xóa khóa khi chưa chọn', nt.nhom === 2 && nt.o === 5 && !nt.xss && nt.ca === 1 && nt.giu === 2 && nt.tat ? true : JSON.stringify(nt)]);
      await p.evaluate(() => { window.__goi = []; chonTheoGoiYNghiTrung_(); });
      await p.click('#btnXoaNghiTrung'); await bamDongY(); await p.waitForTimeout(150);
      const goi = await p.evaluate(() => (window.__goi.find(g => g[0] === 'XOA_DONG_NGHI_TRUNG') || [])[1]);
      const boc = x => (Array.isArray(x) && x.length === 1 && Array.isArray(x[0]) ? boc(x[0]) : x); // qua api() tham số được bọc thêm 1 lớp mảng
      const ds = boc(goi && goi[0] || []);
      kq.push(['Thiết lập nghi trùng: "Chọn theo gợi ý" gửi đúng 3 dòng không được gợi ý giữ, kèm dấu vân tay', ds.length === 3 && ds.map(x => x.bang + x.dong + x.dau).sort().join(',') === 'HD_NCC3d3,HD_NCC5d5,HD_RUNG9r9' ? true : JSON.stringify(goi)]);
      await p.evaluate(() => chanDoanMoCoi()); await p.waitForTimeout(150);
      const mc = await p.evaluate(() => ({ o: document.querySelectorAll('.mcChon').length, chon: [...document.querySelectorAll('.mcChon:checked')].map(c => c.dataset.loai + c.dataset.dong).join(',') }));
      kq.push(['Thiết lập mồ côi: có ô chọn từng dòng, chọn sẵn dòng mồ côi, KHÔNG chọn sẵn dòng thiếu ID', mc.o === 3 && mc.chon === 'rung_moCoi8,stk_moCoi6' ? true : JSON.stringify(mc)]);
      await p.evaluate(() => { window.__goi = []; }); await p.click('#btnXoaMoCoi'); await bamDongY(); await p.waitForTimeout(150);
      const g2 = await p.evaluate(() => ({ goi: (window.__goi.find(g => g[0] === 'XOA_DONG_MO_COI') || [])[1], msg: document.getElementById('msgBaoTri').textContent }));
      await p.evaluate(() => chanDoanMoCoi()); await p.waitForTimeout(150);
      const on = await p.evaluate(() => ({ nut: !!document.getElementById('btnLamSachONgay'), o: document.getElementById('ketQuaBaoTri').textContent.indexOf('S12') !== -1, chon: document.querySelectorAll('.mcChon').length }));
      await p.evaluate(() => { window.__goi = []; }); await p.click('#btnLamSachONgay');
      await p.waitForFunction(() => [...document.querySelectorAll('[role="dialog"] button')].some(x => x.textContent.trim() === 'Xóa trống'));
      await p.evaluate(() => [...document.querySelectorAll('[role="dialog"] button')].find(x => x.textContent.trim() === 'Xóa trống').click()); await p.waitForTimeout(150);
      const lsn = await p.evaluate(() => ({ goi: window.__goi.some(g => g[0] === 'LAM_SACH_O_SO_LA_NGAY'), msg: document.getElementById('msgBaoTri').textContent }));
      kq.push(['Thiết lập chẩn đoán: liệt kê ô số chứa NGÀY (không có ô tick xóa dòng) + nút xóa trống gọi đúng API', on.nut && on.o && on.chon === 3 && lsn.goi && /Đã xóa trống 1 ô/.test(lsn.msg) ? true : JSON.stringify([on, lsn])]);
      kq.push(['Thiết lập mồ côi: xóa gửi 2 dòng đã chọn + báo mã lưu trữ', g2.goi && boc(g2.goi[0]).length === 2 && /XOA_2/.test(g2.msg) ? true : JSON.stringify(g2)]);
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
