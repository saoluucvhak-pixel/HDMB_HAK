// Đếm số lời gọi máy chủ (google.script.run) của trình duyệt trên trang thật (dựng từ template). Không chạy trong CI —
// công cụ đo khi cần so sánh trước / sau. Chạy: CHROMIUM_PATH=... node tests/do_rpc.cjs   (đặt file này trong tests/ của
// bản mã cần đo; mã đọc từ thư mục cha của tests/).
//  1. Mở trang Nhập liệu.   2. Mở Tổng quan.   3. Nhập liệu: mở 1 HĐ, sửa 3 ô (cách nhau 1 giây), bấm Lưu chính thức ngay.
//  4. Như 3 nhưng mạng chậm (mỗi lời gọi trả lời sau 1,5 giây): gõ liên tục 3 ô, mỗi ô cách 0,8 giây.
const { danhGia } = require('./gas_template.cjs');
const { moTrinhDuyet, ghiTrangTam } = require('./ui_chung.cjs');
const giaLap = tre => `<script>(function(){window.__goi=[];function taoRunner(){var ok=null;var r=new Proxy({},{get:function(_,k){
 if(k==='withSuccessHandler')return function(f){ok=f;return r}; if(k==='withFailureHandler'||k==='withUserObject')return function(){return r};
 return function(){var a=[].slice.call(arguments);var ten=k==='api'?a[1]:k;var args=k==='api'?(a[2]||[]):a;window.__goi.push(ten);
  var du=(window.__du||{})[ten];
  setTimeout(function(){if(!ok)return;ok(ten==='thongTinDangNhap'?{daDangNhap:true,email:'nl@test.vn',vaiTroNhan:'Nhập liệu',quyen:['XEM','NHAP_LIEU'],quaPhien:true}:(typeof du==='function'?du.apply(null,args):(du!==undefined?du:[])))},ten==='thongTinDangNhap'?5:${tre})}}});return r}
 window.google={script:{url:{getLocation:function(f){f({parameter:{},hash:''})}},history:{replace:function(){}},host:{close:function(){}},run:new Proxy({},{get:function(_,k){return taoRunner()[k]}})}};})();</script>`;
const DU = '{MO_DRAFT_THEO_SO_DONG:function(s,id){return {idDraft:"D_"+id,du:{idHD:id,hopDong:{soHD:"S1",tenChuRung:"Chu",cccdChuRung:"049000000001",ngayKy:"2026-05-10"},rung:[],taiKhoan:[],phuLuc:[]},tinhTrangGoc:"Chờ thực hiện"}},' +
  'LUU_DRAFT:{thanhCong:true},LUU_CHINH_THUC:{thanhCong:true,soHD:"S1"},layDanhSachHopDong:{items:[],trang:1,tongTrang:1,tongSo:0},' +
  'LAY_DS_KHACH_HANG_GON:{ds:[]},layDanhSachKhachHang:{items:[],trang:1,tongTrang:1,tongSo:0},LAY_TONG_QUAN_HOP_DONG:{tongSoHopDong:0,theoTrangThai:{},items:[],trang:1,tongTrang:1,tongSo:0}}';
(async () => {
  const b = await moTrinhDuyet();
  const mo = async (file, trang, tre) => {
    let html = danhGia(file, { currentPage: trang, baseUrl: 'https://script.google.com/macros/s/X/exec', tabTrang: '', phien: '', loiDangNhap: '' });
    html = html.replace(/<head>/i, '<head>' + giaLap(tre || 5) + '<script>window.__du=' + DU + ';</script>');
    const p = await b.newPage({ viewport: { width: 1280, height: 900 } });
    await p.route(/^https?:\/\//, r => r.abort());
    await p.goto(ghiTrangTam('rpc_' + file + '_' + Date.now() + '.html', html));
    await p.waitForTimeout(800);
    await p.evaluate(() => { var d = document.getElementById('hakHopThoaiDangNhap'); if (d) d.remove(); });
    return p;
  };
  const dem = p => p.evaluate(() => { const o = {}; window.__goi.filter(t => t !== 'thongTinDangNhap').forEach(t => { o[t] = (o[t] || 0) + 1; }); return o; });
  const tong = o => Object.values(o).reduce((a, b) => a + b, 0);
  const in_ = (ten, o) => console.log(ten + ' | ' + tong(o) + ' | ' + Object.keys(o).sort().map(k => k + '×' + o[k]).join(', '));
  console.log('Tình huống | Tổng RPC | Chi tiết');
  let p = await mo('11_Page_NhapLieu', 'form'); in_('1. Mở trang Nhập liệu', await dem(p)); await p.close();
  p = await mo('30_Page_TongQuanHopDong', 'tongquan'); in_('2. Mở Tổng quan', await dem(p)); await p.close();
  for (const [ten, tre, cach] of [['3. Mở HĐ, sửa 3 ô (cách 1 s), Lưu chính thức ngay', 5, 1000], ['4. Mạng chậm 1,5 s: sửa 3 ô liên tục (cách 0,8 s), Lưu chính thức ngay', 1500, 800]]) {
    p = await mo('11_Page_NhapLieu', 'form', tre);
    await p.evaluate(() => { window.__goi = []; moTrangXemHopDong(2, 'HD1'); });
    await p.waitForTimeout(tre + 100);
    for (const [id, v] of [['tenChuRung', 'Nguyen Van A'], ['sdtChuRung', '0905111222'], ['diaChiThuongTru', 'Thon 1']]) { await p.fill('#' + id, v); await p.waitForTimeout(cach); }
    await p.evaluate(() => luuChinhThuc());
    await p.waitForTimeout(3 * tre + 500);
    const o = await dem(p); delete o.MO_DRAFT_THEO_SO_DONG; delete o.layDanhSachHopDong;
    in_(ten, o); await p.close();
  }
  await b.close();
})();
