// Giao diện (nâng cấp 10/2026): phản hồi của lượt tìm/lọc CŨ về SAU lượt mới (gõ nhanh, mạng chậm) không được ghi đè bảng.
// Dựng trang thật từ template; google.script.run giả lập: lượt 1 trả lời sau 400 ms, lượt 2 sau 30 ms.
const { danhGia } = require('./gas_template.cjs');
const { moTrinhDuyet, ghiTrangTam, inKetQua } = require('./ui_chung.cjs');
const giaLap = `<script>(function(){window.__luot={};function taoRunner(){var ok=null,loi=null;var r=new Proxy({},{get:function(_,k){
 if(k==='withSuccessHandler')return function(f){ok=f;return r}; if(k==='withFailureHandler')return function(f){loi=f;return r}; if(k==='withUserObject')return function(){return r};
 return function(){var ten=k==='api'?arguments[1]:k;var i=window.__luot[ten]=(window.__luot[ten]||0)+1;var ds=(window.__du||{})[ten];var kq=Array.isArray(ds)?ds[Math.min(i,ds.length)-1]:ds;
  var tre=Array.isArray(ds)?(i===1?400:30):5;
  setTimeout(function(){if(!ok)return; ok(ten==='thongTinDangNhap'?{daDangNhap:true,email:'qt@test.vn',vaiTroNhan:'Quản trị',quyen:['XEM','NHAP_LIEU','QUAN_TRI'],quaPhien:true}:(kq!==undefined?kq:null))},tre)}}});return r}
 window.google={script:{url:{getLocation:function(f){f({parameter:{},hash:''})}},history:{replace:function(){}},host:{close:function(){}},run:new Proxy({},{get:function(_,k){return taoRunner()[k]}})}};})();</script>`;
const hd = (soHD, ten) => ({ soDong: 2, idHD: soHD + '-X', soHD: soHD, ngayKy: '2026-05-10', tenChuRung: ten, diaChiRung: 'X', tinhTrang: 'Chờ thực hiện' });
const kh = (ten) => ({ cccd: '049000000001', tenChuRung: ten, sdt: '', thuongTru: '', ngayCap: '', noiCap: '', nhomKH: '', maSoThue: '', soLuongHopDong: 1 });
(async () => {
  const b = await moTrinhDuyet();
  const kq = [];
  const moTrang = async (file, trang, du) => {
    let html = danhGia(file, { currentPage: trang, baseUrl: 'https://script.google.com/macros/s/X/exec', tabTrang: '', phien: '', loiDangNhap: '' });
    html = html.replace(/<head>/i, '<head>' + giaLap + '<script>window.__du=' + JSON.stringify(du) + ';</script>');
    const p = await b.newPage({ viewport: { width: 1280, height: 900 } });
    const loiJS = []; p.on('pageerror', e => loiJS.push(e.message));
    await p.route(/^https?:\/\//, r => r.abort());
    await p.goto(ghiTrangTam('phcu_' + file + '.html', html));
    await p.waitForTimeout(600);
    return { p, loiJS };
  };

  // 1) Nhập liệu: danh sách hợp đồng
  {
    const { p, loiJS } = await moTrang('11_Page_NhapLieu', 'form', { layDanhSachHopDong: [
      { items: [hd('CU1', 'Ket qua CU')], trang: 1, tongTrang: 1, tongSo: 1 }, { items: [hd('MOI1', 'Ket qua MOI')], trang: 1, tongTrang: 1, tongSo: 1 },
      { items: [hd('CU1', 'Ket qua CU')], trang: 1, tongTrang: 1, tongSo: 1 }, { items: [hd('MOI1', 'Ket qua MOI')], trang: 1, tongTrang: 1, tongSo: 1 }] });
    await p.evaluate(() => { window.__luot = {}; taiDanhSachHD(1); taiDanhSachHD(1); });
    await p.waitForTimeout(700);
    const bang = await p.evaluate(() => document.querySelector('#tblDSHopDong tbody').textContent);
    kq.push(['Nhập liệu: danh sách HĐ — phản hồi cũ về sau không ghi đè kết quả mới', /Ket qua MOI/.test(bang) && !/Ket qua CU/.test(bang) ? true : bang.slice(0, 120)]);
    // (không xét lỗi JS ở trang này: các lời gọi khác lúc mở trang nhận null từ bộ giả lập)
    await p.close();
  }
  // 2) Thêm/Sửa hợp đồng: danh sách khách hàng
  {
    const { p, loiJS } = await moTrang('27_Page_HopDongMeCon', 'hopdongmc', { layDanhSachKhachHang: [
      { items: [kh('Khach CU')], trang: 1, tongTrang: 1, tongSo: 1 }, { items: [kh('Khach MOI')], trang: 1, tongTrang: 1, tongSo: 1 },
      { items: [kh('Khach CU')], trang: 1, tongTrang: 1, tongSo: 1 }, { items: [kh('Khach MOI')], trang: 1, tongTrang: 1, tongSo: 1 }] });
    await p.evaluate(() => { window.__luot = {}; taiBangKhachHang_(1); taiBangKhachHang_(1); });
    await p.waitForTimeout(700);
    const bang = await p.evaluate(() => (document.getElementById('vungBangKH') || {}).textContent || '');
    kq.push(['Thêm/Sửa HĐ: danh sách khách hàng — phản hồi cũ về sau không ghi đè', /Khach MOI/.test(bang) && !/Khach CU/.test(bang) ? true : bang.slice(0, 120)]);
    kq.push(['Thêm/Sửa HĐ: không lỗi JS', loiJS.length ? loiJS.join(' | ') : true]);
    await p.close();
  }
  // 3) Báo cáo tổng hợp: lọc bảng
  {
    const { p, loiJS } = await moTrang('10_Page_BaoCao', 'baocao', { layTongHopChoWebapp: [{ ma: 'CU' }, { ma: 'MOI' }, { ma: 'CU' }, { ma: 'MOI' }] });
    await p.evaluate(() => { window.__veRa = []; window.renderTongHopWebapp = function (kq) { window.__veRa.push(kq && kq.ma); }; window.__luot = {}; taiTongHop_(1); taiTongHop_(1); });
    await p.waitForTimeout(700);
    const ve = await p.evaluate(() => window.__veRa);
    kq.push(['Báo cáo: lọc bảng — chỉ vẽ kết quả lượt mới', JSON.stringify(ve) === '["MOI"]' ? true : JSON.stringify(ve)]);
    await p.close();
  }
  await b.close();
  inKetQua(kq);
  process.exit(kq.every(x => x[1] === true) ? 0 : 1);
})();
