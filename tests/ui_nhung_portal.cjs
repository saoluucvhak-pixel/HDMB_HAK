// Bị nhúng trong trang khác (Portal): bấm menu HDMB đổi trang NGAY TRONG KHUNG, không bật cả cửa sổ ra khỏi Portal.
// Portal chỉ là 1 iframe bình thường (KHÔNG cần mã riêng). Dựng lại đúng các lớp khung của Apps Script: trang Google
// (script.google.com/.../exec) -> khung sandbox (*-script.googleusercontent.com) -> khung HTML của trang (cùng nguồn
// với khung sandbox). google.script.* giả lập ở khung HTML như Apps Script thật; trangTrongKhung trả HTML trang
// (không kèm giả lập) để kiểm tra trang con dùng google.script của trang gốc.
const { moTrinhDuyet, docMa, inKetQua } = require('./ui_chung.cjs');
const ID_HDMB = 'AKfycbHDMB_1234567890', ID_PORTAL = 'AKfycbPORTAL_1234567', ID_KHAC = 'AKfycbKHAC_123456789';
const HDMB = 'https://script.google.com/macros/s/' + ID_HDMB + '/exec';
const PORTAL = 'https://script.google.com/macros/s/' + ID_PORTAL + '/exec';
const SANDBOX_HDMB = 'https://n-hdmb-0lu-script.googleusercontent.com';
const SANDBOX_PORTAL = 'https://n-portal-0lu-script.googleusercontent.com';
const vo = (than) => ({ status: 200, contentType: 'text/html; charset=utf-8', body: '<!doctype html><html><head><meta charset="utf-8"></head><body>' + than + '</body></html>' });

function htmlTrang(trang) { // như HtmlService trả về: chỉ mã của trang
  return `<!DOCTYPE html><html><head><base target="_top"><meta charset="utf-8">${docMa('GiaoDien_Chung.html')}</head><body>
<div hidden data-base="${HDMB}"></div>
<h1 id="ten">TRANG:${trang}</h1><span id="g"></span>
<a id="lnk" href="${HDMB}?page=tracuu">Tra cứu</a>
<a id="lnk2" class="btn" href="${HDMB}?page=baocao&amp;idhd=HD5">Báo cáo</a>
<a id="khac" href="https://script.google.com/macros/s/${ID_KHAC}/exec?page=x">Webapp khác</a>
<a id="tabMoi" target="_blank" href="${HDMB}?page=hopdongmc">Tab mới</a>
<script>document.getElementById('g').textContent = typeof google.script.run.trangTrongKhung;</script>
</body></html>`;
}
const TIEU_DE = { tongquan: 'Tổng quan', tracuu: 'Tra cứu', baocao: 'Báo cáo' };
// google.script.* của Apps Script — chỉ có ở khung HTML do Google dựng (trang gốc)
const GIA_LAP = `<script>(function(){
  var TIEU_DE = ${JSON.stringify(TIEU_DE)};
  var TRANG = ${JSON.stringify(Object.fromEntries(Object.keys(TIEU_DE).map(k => [k, htmlTrang(k)]))).replace(/<\//g, '<\\/')};
  window.__lichSu = []; window.__goi = [];
  function runner(){ var ok=null, loi=null; var r = new Proxy({}, { get: function(_, k){
    if (k === 'withSuccessHandler') return function(f){ ok = f; return r; };
    if (k === 'withFailureHandler') return function(f){ loi = f; return r; };
    if (k === 'withUserObject') return function(){ return r; };
    return function(ts){ window.__goi.push([k, JSON.parse(JSON.stringify(ts || null))]); setTimeout(function(){
      if (k === 'trangTrongKhung') { var p = TRANG[ts.page] ? ts.page : 'tongquan'; ok && ok({ html: TRANG[p], tieuDe: TIEU_DE[p] }); }
      else ok && ok(null);
    }, 30); };
  } }); return r; }
  window.google = { script: { run: new Proxy({}, { get: function(_, k){ return runner()[k]; } }),
    url: { getLocation: function(){} },
    history: { push: function(s, p){ window.__lichSu.push(p); }, replace: function(){}, setChangeHandler: function(f){ window.__xuLyLichSu = f; } } } };
})();</script>`;

async function mo(b, vaoThang) {
  const ctx = await b.newContext();
  const loi = [];
  await ctx.route('**/*', (route) => {
    const u = new URL(route.request().url());
    const trang = u.searchParams.get('page') || 'tongquan';
    if (u.href.startsWith(PORTAL)) return route.fulfill(vo(`<iframe style="width:900px;height:700px" src="${SANDBOX_PORTAL}/userCodeAppPanel"></iframe>`));
    if (u.origin === SANDBOX_PORTAL && u.pathname === '/userCodeAppPanel') return route.fulfill(vo('<iframe style="width:880px;height:680px" src="/user"></iframe>'));
    if (u.origin === SANDBOX_PORTAL && u.pathname === '/user') return route.fulfill(vo(`<h1>PORTAL</h1><iframe id="k" style="width:860px;height:600px" src="${HDMB}?page=tongquan"></iframe>`));
    if (u.href.startsWith(HDMB)) return route.fulfill(vo(`<iframe style="width:840px;height:560px" src="${SANDBOX_HDMB}/userCodeAppPanel?page=${trang}"></iframe>`));
    if (u.origin === SANDBOX_HDMB && u.pathname === '/userCodeAppPanel') return route.fulfill(vo(`<iframe id="userHtmlFrame" style="width:820px;height:540px" src="/user?page=${trang}"></iframe>`));
    if (u.origin === SANDBOX_HDMB && u.pathname === '/user') return route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: htmlTrang(trang).replace('<head>', '<head>' + GIA_LAP) });
    if (u.href.startsWith('https://script.google.com/macros/s/' + ID_KHAC)) return route.fulfill(vo('<h1>WEBAPP KHAC</h1>'));
    return route.fulfill({ status: 404, body: '' });
  });
  const p = await ctx.newPage();
  p.on('pageerror', e => loi.push(e.message));
  await p.goto(vaoThang ? HDMB + '?page=tongquan' : PORTAL);
  let goc = null;
  for (let i = 0; i < 50 && !goc; i++) { goc = p.frames().find(x => x.url().startsWith(SANDBOX_HDMB + '/user?')) || null; if (!goc) await p.waitForTimeout(100); }
  await goc.waitForSelector('#ten');
  await p.waitForTimeout(200);
  const con = async (ten) => { // khung con đang hiện trong trang gốc
    for (let i = 0; i < 50; i++) {
      const ds = goc.childFrames();
      for (const f of ds) { try { if ((await f.textContent('#ten', { timeout: 200 })) === ten) return f; } catch (e) { /* đang tải */ } }
      await p.waitForTimeout(100);
    }
    return null;
  };
  return { ctx, p, goc, con, loi };
}

(async () => {
  const b = await moTrinhDuyet();
  const kq = [];

  // 1) Nhúng trong Portal (Portal không có mã gì): bấm menu -> đổi trang trong khung
  let t = await mo(b, false);
  await t.goc.click('#lnk');
  let c1 = await t.con('TRANG:tracuu');
  kq.push(['Nhúng: bấm menu -> cửa sổ vẫn là Portal', t.p.url() === PORTAL]);
  kq.push(['Nhúng: trang Tra cứu hiện ngay trong khung HDMB', !!c1]);
  kq.push(['Nhúng: trang con dùng google.script của trang gốc', !!c1 && (await c1.textContent('#g')) === 'function']);
  kq.push(['Nhúng: trang cũ được bỏ, chỉ còn khung trang mới', await t.goc.evaluate(() => Array.prototype.filter.call(document.body.children, e => e.tagName !== 'SCRIPT').length === 1 && !!document.getElementById('hakKhungTrang') && !document.getElementById('hakManChuyenTrang') && !document.getElementById('ten'))]);
  kq.push(['Nhúng: địa chỉ cập nhật ?page=tracuu (Quay lại dùng được)', await t.goc.evaluate(() => JSON.stringify(window.__lichSu) === JSON.stringify([{ page: 'tracuu' }]))]);
  // 2) Bấm tiếp trong trang con: vẫn trong khung, không lồng thêm tầng, giữ tham số
  await c1.click('#lnk2');
  let c2 = await t.con('TRANG:baocao');
  kq.push(['Nhúng: bấm lần 2 (trong trang con) vẫn trong Portal', !!c2 && t.p.url() === PORTAL]);
  kq.push(['Nhúng: không lồng thêm tầng khung (chỉ 1 khung con)', await t.goc.evaluate(() => document.querySelectorAll('iframe').length === 1) && c2.parentFrame() === t.goc && c2.childFrames().length === 0]);
  kq.push(['Nhúng: tham số link giữ nguyên (idhd)', await t.goc.evaluate(() => { const g = window.__goi.filter(x => x[0] === 'trangTrongKhung'); return JSON.stringify(g[g.length - 1][1]) === JSON.stringify({ page: 'baocao', idhd: 'HD5' }); })]);
  // 3) Quay lại của trình duyệt -> google.script.history báo đổi địa chỉ -> hiện lại trang, không ghi thêm lịch sử
  await t.goc.evaluate(() => window.__xuLyLichSu({ location: { parameter: { page: 'tracuu' } } }));
  kq.push(['Quay lại: hiện lại trang Tra cứu trong khung', !!(await t.con('TRANG:tracuu')) && await t.goc.evaluate(() => window.__lichSu.length === 2)]);
  // 4) Link sang webapp khác -> như cũ
  await (await t.con('TRANG:tracuu')).click('#khac');
  await t.p.waitForTimeout(600);
  kq.push(['Link sang webapp khác: chạy như cũ', t.p.url().indexOf(ID_KHAC) >= 0]);
  kq.push(['không lỗi JS (nhúng)', t.loi.length === 0 ? true : t.loi.join('|')]);
  await t.ctx.close();

  // 5) Link mở tab mới vẫn mở tab mới
  t = await mo(b, false);
  const [tab] = await Promise.all([t.ctx.waitForEvent('page', { timeout: 3000 }).catch(() => null), t.goc.click('#tabMoi')]);
  kq.push(['Link target=_blank vẫn mở tab mới, Portal giữ nguyên', !!tab && t.p.url() === PORTAL]);
  await t.ctx.close();

  // 6) Mở trực tiếp (không nhúng) -> như cũ: cả cửa sổ sang trang mới, không gọi trangTrongKhung
  t = await mo(b, true);
  await t.goc.click('#lnk');
  await t.p.waitForTimeout(600);
  kq.push(['Mở trực tiếp: chuyển trang như cũ (cả cửa sổ)', t.p.url() === HDMB + '?page=tracuu']);
  kq.push(['không lỗi JS (mở trực tiếp)', t.loi.length === 0 ? true : t.loi.join('|')]);
  await t.ctx.close();

  inKetQua(kq);
  await b.close();
  process.exitCode = kq.every(x => x[1] === true) ? 0 : 1;
})().catch(e => { console.error(e); process.exit(1); });
