// A5: chế độ tối (tự động theo máy / Sáng / Tối, nút 🌓, nhớ sau tải lại) + gắn nhãn vào ô + tên nút chỉ có biểu tượng.
const { moTrinhDuyet, ghiTrangTam, docMa, inKetQua } = require('./ui_chung.cjs');
(async () => {
  const giaLap = `<script>(function(){function taoRunner(){var ok=null;var r=new Proxy({},{get:function(_,k){
    if(k==='withSuccessHandler')return function(f){ok=f;return r}; if(k==='withFailureHandler'||k==='withUserObject')return function(){return r};
    return function(){var ten=k==='api'?arguments[1]:k;setTimeout(function(){if(ok)ok(ten==='thongTinDangNhap'?{daDangNhap:true,email:'a@b.vn',vaiTroNhan:'Quản trị',quyen:['XEM','NHAP_LIEU','QUAN_TRI'],quaPhien:true}:null)},5)}}});return r}
    window.google={script:{run:new Proxy({},{get:function(_,k){return taoRunner()[k]}}),url:{getLocation:function(){}},history:{replace:function(){}}}};})();</script>`;
  const html = `<!doctype html><html><head><meta charset="utf-8">${giaLap}${docMa('GiaoDien_Chung.html')}
<style>body{background:var(--page-bg,#f3f4f6)} .the{background:var(--card-bg,#fff);color:var(--chu-chinh,#1f2937)}</style></head><body>
<div id="hakPhanQuyen" hidden data-phien="${'a'.repeat(64)}" data-trang="tongquan"></div>
${docMa('PhanQuyen_JS.html')}
<div class="the"><div class="field"><label>Số hợp đồng</label><input id="soHD"></div>
<div class="field"><label>Tình trạng</label><select><option>Tất cả</option></select></div>
<label>Ô trong nhãn <input id="trongNhan"></label>
<button id="nutXoa">🗑️</button><button id="nutTieuDe" title="Xem ảnh">👁</button><button id="nutChu">💾 Lưu</button></div>
<div id="vungDong"></div></body></html>`;
  const trang = ghiTrangTam('ui_giao_dien.html', html);
  const b = await moTrinhDuyet();
  const kq = [];
  // 1) Máy để chế độ tối -> tự động tối; máy sáng -> sáng
  let ctx = await b.newContext({ colorScheme: 'dark' }); let p = await ctx.newPage(); const loiJS = []; p.on('pageerror', e => loiJS.push(e.message));
  await p.goto(trang); await p.waitForTimeout(200);
  kq.push(['máy tối -> tự động chế độ tối', await p.evaluate(() => document.documentElement.getAttribute('data-giao-dien') === 'toi' && getComputedStyle(document.querySelector('.the')).backgroundColor === 'rgb(30, 41, 59)')]);
  kq.push(['lang="vi" được đặt', await p.evaluate(() => document.documentElement.lang === 'vi')]);
  // 2) Nút 🌓: Tự động -> Sáng -> Tối, nhớ sau tải lại
  await p.click('#hakChipGiaoDien');
  kq.push(['bấm 🌓 lần 1 -> Sáng (dù máy tối)', await p.evaluate(() => document.documentElement.getAttribute('data-giao-dien') === 'sang' && getComputedStyle(document.querySelector('.the')).backgroundColor === 'rgb(255, 255, 255)')]);
  await p.click('#hakChipGiaoDien');
  kq.push(['bấm 🌓 lần 2 -> Tối', await p.evaluate(() => document.documentElement.getAttribute('data-giao-dien') === 'toi' && /Tối/.test(document.getElementById('hakChipGiaoDien').getAttribute('aria-label')))]);
  await ctx.close();
  ctx = await b.newContext({ colorScheme: 'light' }); p = await ctx.newPage(); p.on('pageerror', e => loiJS.push(e.message));
  await p.goto(trang); await p.waitForTimeout(200);
  kq.push(['máy sáng -> tự động chế độ sáng, màu gốc giữ nguyên', await p.evaluate(() => document.documentElement.getAttribute('data-giao-dien') === 'sang' && getComputedStyle(document.body).backgroundColor === 'rgb(243, 244, 246)' && getComputedStyle(document.querySelector('.the')).color === 'rgb(31, 41, 55)')]);
  await p.click('#hakChipGiaoDien'); await p.click('#hakChipGiaoDien'); // tu_dong -> sang -> toi
  await p.reload(); await p.waitForTimeout(200);
  kq.push(['chọn Tối -> tải lại trang vẫn Tối', await p.evaluate(() => document.documentElement.getAttribute('data-giao-dien') === 'toi')]);
  // 3) Hỗ trợ truy cập
  kq.push(['nhãn gắn đúng ô (có id sẵn + tự tạo id)', await p.evaluate(() => { const l = document.querySelectorAll('.the label'); const s = document.querySelector('.the select'); return l[0].htmlFor === 'soHD' && s.id && l[1].htmlFor === s.id && !l[2].htmlFor; })]);
  await p.click('text=Số hợp đồng');
  kq.push(['bấm chữ nhãn -> con trỏ vào ô', await p.evaluate(() => document.activeElement && document.activeElement.id === 'soHD')]);
  kq.push(['nút chỉ có biểu tượng được đặt tên', await p.evaluate(() => document.getElementById('nutXoa').getAttribute('aria-label') === 'Xóa' && document.getElementById('nutTieuDe').getAttribute('aria-label') === 'Xem ảnh' && !document.getElementById('nutChu').hasAttribute('aria-label'))]);
  await p.evaluate(() => { document.getElementById('vungDong').innerHTML = '<label>Ghi chú</label><textarea id="gc"></textarea><button id="nutDong">✏️</button>'; });
  await p.waitForTimeout(400);
  kq.push(['phần tử thêm sau (innerHTML) cũng được gắn', await p.evaluate(() => document.querySelector('#vungDong label').htmlFor === 'gc' && document.getElementById('nutDong').getAttribute('aria-label') === 'Sửa')]);
  kq.push(['không lỗi JS', loiJS.length === 0 ? true : loiJS.join('|')]);
  inKetQua(kq);
  await b.close();
  process.exitCode = kq.every(x => x[1] === true) ? 0 : 1;
})().catch(e => { console.error(e); process.exit(1); });
