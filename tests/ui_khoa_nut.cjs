const { moTrinhDuyet, ghiTrangTam, docMa, inKetQua } = require('./ui_chung.cjs');
const fs = require('fs');
(async () => {
  const pq = docMa('PhanQuyen_JS.html');
  const html = `<!doctype html><html><body>
<div id="hakPhanQuyen" data-phien="${'a'.repeat(64)}" data-trang="hopdongmc"></div>
<script>
window.__goi = [];
function taoRunner(){ var ok=null, loi=null; var r={
  withSuccessHandler:function(f){ok=f;return r;}, withFailureHandler:function(f){loi=f;return r;}, withUserObject:function(){return r;},
  api:function(ph,ten,ts){ window.__goi.push(ten); setTimeout(function(){ if(ten==='LOI_THU') loi(new Error('x')); else ok({thanhCong:true}); }, 400); },
  thongTinDangNhap:function(){ setTimeout(function(){ ok({daDangNhap:true,email:'a@b',vaiTroNhan:'Q',quyen:['XEM','NHAP_LIEU','QUAN_TRI']}); },10); }
 }; return r; }
window.google = { script: { run: new Proxy({}, { get: function(_, k){ var r = taoRunner(); return r[k]; } }), url:{getLocation:function(){}}, history:{replace:function(){}} } };
</script>
${pq}
<button id="bGhi" onclick="hakRun_().withSuccessHandler(function(){window.__xong=(window.__xong||0)+1;}).XOA_TAI_KHOAN(5,'HD','1')">Xóa</button>
<a class="lnk-huy" id="aGhi" onclick="hakRun_().withSuccessHandler(function(){}).DUYET_ANH_RUNG(2,'D1')">Duyệt</a>
<button id="bDoc" onclick="hakRun_().withSuccessHandler(function(){}).layDanhSachTaiKhoan('HD')">Đọc</button>
<button id="bLoi" onclick="hakRun_().withFailureHandler(function(){window.__loi=1;}).LUU_THU()">Lỗi</button>
</body></html>`;
  const trang = ghiTrangTam('ui_a1.html', html);
  const b = await moTrinhDuyet();
  const p = await b.newPage();
  const loiJS = []; p.on('pageerror', e => loiJS.push(e.message));
  await p.goto(trang);
  await p.waitForTimeout(100);
  const kq = [];
  // bấm nhanh 3 lần nút ghi
  await p.click('#bGhi'); await p.click('#bGhi', { force: true }).catch(()=>{}); await p.evaluate(() => document.getElementById('bGhi').click());
  kq.push(['đang chờ: nút bị khóa', await p.evaluate(() => document.getElementById('bGhi').disabled)]);
  await p.waitForTimeout(600);
  kq.push(['3 lần bấm -> 1 lệnh XOA_TAI_KHOAN', await p.evaluate(() => window.__goi.filter(x => x === 'XOA_TAI_KHOAN').length === 1)]);
  kq.push(['xong -> mở khóa + chạy xử lý trang', await p.evaluate(() => !document.getElementById('bGhi').disabled && window.__xong === 1)]);
  await p.click('#aGhi'); await p.evaluate(() => document.getElementById('aGhi').click());
  await p.waitForTimeout(600);
  kq.push(['link <a> Duyệt bấm 2 lần -> 1 lệnh', await p.evaluate(() => window.__goi.filter(x => x === 'DUYET_ANH_RUNG').length === 1)]);
  await p.click('#bDoc'); await p.click('#bDoc');
  kq.push(['lời gọi ĐỌC không bị khóa', await p.evaluate(() => window.__goi.filter(x => x === 'layDanhSachTaiKhoan').length === 2)]);
  await p.click('#bGhi'); await p.waitForTimeout(600);
  kq.push(['bấm lại sau khi xong -> gửi được lệnh mới', await p.evaluate(() => window.__goi.filter(x => x === 'XOA_TAI_KHOAN').length === 2)]);
  kq.push(['không lỗi JS', loiJS.length === 0 ? true : loiJS.join('|')]);
  inKetQua(kq);
  await b.close();
  process.exitCode = kq.every(x => x[1] === true) ? 0 : 1;
})().catch(e => { console.error(e); process.exit(1); });
