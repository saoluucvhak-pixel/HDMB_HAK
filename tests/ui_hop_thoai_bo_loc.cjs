const { moTrinhDuyet, ghiTrangTam, docMa, inKetQua } = require('./ui_chung.cjs');
const fs = require('fs');
(async () => {
  const pq = docMa('PhanQuyen_JS.html');
  const html = `<!doctype html><html><body><div id="hakPhanQuyen" data-phien="${'a'.repeat(64)}" data-trang="baocao"></div>
<script>
function taoRunner(){ var ok=null; var r={ withSuccessHandler:function(f){ok=f;return r;}, withFailureHandler:function(){return r;}, withUserObject:function(){return r;},
  api:function(){}, dangXuat:function(){}, thongTinDangNhap:function(){ setTimeout(function(){ ok({daDangNhap:true,email:'a@b',vaiTroNhan:'Q',quyen:['XEM']}); },10); } }; return r; }
window.google = { script: { run: new Proxy({}, { get: function(_, k){ var r = taoRunner(); return r[k]; } }), url:{getLocation:function(){}}, history:{replace:function(){}} } };
</script>${pq}
<input id="bcSoHD"><select id="bcTinhTrang"><option value="">Tất cả</option><option>Đã hủy</option></select>
<script>document.addEventListener('DOMContentLoaded', function(){ hakNhoBoLoc_('baocao', ['bcSoHD','bcTinhTrang']); });</script>
</body></html>`;
  const trang = ghiTrangTam('ui_a3.html', html);
  const b = await moTrinhDuyet();
  const p = await b.newPage(); const loi = []; p.on('pageerror', e => loi.push(e.message));
  await p.goto(trang); await p.waitForTimeout(100);
  const kq = [];
  let pr = p.evaluate(() => hakXacNhan_('Xóa tài khoản này?', { nguyHiem: true }));
  await p.waitForSelector('text=Xóa tài khoản này?'); await p.getByRole('button', { name: 'Đồng ý', exact: true }).click();
  kq.push(['Xác nhận: bấm Đồng ý -> true', await pr === true]);
  pr = p.evaluate(() => hakXacNhan_('Xóa?', { nguyHiem: true }));
  await p.waitForSelector('text=Xóa?'); await p.keyboard.press('Escape');
  kq.push(['Xác nhận: Esc -> false, hộp thoại đóng', (await pr) === false && (await p.$$('text=Xóa?')).length === 0]);
  pr = p.evaluate(() => hakXacNhan_('Tiếp tục?'));
  await p.waitForSelector('text=Tiếp tục?'); await p.keyboard.press('Enter');
  kq.push(['Xác nhận: Enter -> true', await pr === true]);
  pr = p.evaluate(() => hakNhapChu_('Mật khẩu:', { matKhau: true }));
  await p.waitForSelector('input[type=password]'); await p.keyboard.type('bimat123'); await p.keyboard.press('Enter');
  kq.push(['Nhập mật khẩu (ô che ký tự) -> trả đúng chuỗi', await pr === 'bimat123']);
  pr = p.evaluate(() => hakNhapChu_('Tên:'));
  await p.waitForSelector('text=Tên:'); await p.getByRole('button', { name: 'Hủy', exact: true }).click();
  kq.push(['Nhập: Hủy -> null', await pr === null]);
  await p.fill('#bcSoHD', 'HD123'); await p.selectOption('#bcTinhTrang', 'Đã hủy');
  await p.reload(); await p.waitForTimeout(150);
  kq.push(['A4 tải lại trang -> bộ lọc được khôi phục', (await p.inputValue('#bcSoHD')) === 'HD123' && (await p.inputValue('#bcTinhTrang')) === 'Đã hủy']);
  await p.evaluate(() => hakDangXuat_()); await p.reload(); await p.waitForTimeout(150);
  kq.push(['A4 đăng xuất -> xóa bộ lọc đã nhớ', (await p.inputValue('#bcSoHD')) === '']);
  kq.push(['không lỗi JS', loi.length === 0 ? true : loi.join('|')]);
  inKetQua(kq);
  await b.close();
  process.exitCode = kq.every(x => x[1] === true) ? 0 : 1;
})().catch(e => { console.error(e); process.exit(1); });
