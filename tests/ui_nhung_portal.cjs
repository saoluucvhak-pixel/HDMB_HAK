// Nhúng trong Portal: bấm menu trong khung HDMB đổi trang NGAY TRONG KHUNG, không bật cả cửa sổ ra khỏi Portal.
// Dựng lại đúng các lớp khung của Apps Script: khung Google (script.google.com/.../exec) -> khung sandbox
// (*-script.googleusercontent.com) -> khung HTML của trang. Portal = 1 webapp Apps Script khác nhúng HDMB bằng iframe;
// đoạn mã Portal lấy nguyên văn từ Hướng dẫn mục 9 (13_HuongDan.html).
const { moTrinhDuyet, docMa, inKetQua } = require('./ui_chung.cjs');
const ID_HDMB = 'AKfycbHDMB_1234567890', ID_PORTAL = 'AKfycbPORTAL_1234567', ID_KHAC = 'AKfycbKHAC_123456789';
const HDMB = 'https://script.google.com/macros/s/' + ID_HDMB + '/exec';

function maPortalTuHuongDan() {
  const m = /<pre>(&lt;script&gt;\s*\/\/ HDMB: bấm menu[\s\S]*?)<\/pre>/.exec(docMa('13_HuongDan.html'));
  if (!m) throw new Error('Không thấy đoạn mã Portal trong 13_HuongDan.html');
  return m[1].replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&amp;/g, '&');
}
const MA_PORTAL = maPortalTuHuongDan();
const vo = (than) => ({ status: 200, contentType: 'text/html; charset=utf-8', body: '<!doctype html><html><head><meta charset="utf-8"></head><body>' + than + '</body></html>' });

function trangHdmb(trang) {
  return { status: 200, contentType: 'text/html; charset=utf-8', body: `<!doctype html><html><head><base target="_top"><meta charset="utf-8">${docMa('GiaoDien_Chung.html')}</head><body>
<h1 id="ten">TRANG:${trang}</h1>
<a id="lnk" href="${HDMB}?page=tracuu">Tra cứu</a>
<a id="khac" href="https://script.google.com/macros/s/${ID_KHAC}/exec?page=x">Webapp khác</a>
<a id="tabMoi" target="_blank" href="${HDMB}?page=hopdongmc">Tab mới</a>
</body></html>` };
}

// portal: 'ma' = Portal có đoạn mã | 'khong' = Portal chưa dán mã | 'la' = trang lạ (không phải Apps Script) giả làm Portal
async function dungTinhHuong(b, portal) {
  const ctx = await b.newContext();
  const loi = [];
  const nguonPortal = portal === 'la' ? 'https://ke-gian.example.com' : 'https://n-portal-0lu-script.googleusercontent.com';
  await ctx.route('**/*', (route) => {
    const u = new URL(route.request().url());
    const trang = u.searchParams.get('page') || 'tongquan';
    if (u.href.startsWith('https://script.google.com/macros/s/' + ID_PORTAL + '/exec')) return route.fulfill(vo(`<iframe style="width:900px;height:700px" src="${nguonPortal}/userCodeAppPanel"></iframe>`));
    if (u.origin === nguonPortal && u.pathname === '/userCodeAppPanel') return route.fulfill(vo('<iframe style="width:880px;height:680px" src="/user"></iframe>'));
    if (u.origin === nguonPortal && u.pathname === '/user') return route.fulfill(vo(`<h1>PORTAL</h1><iframe id="k" style="width:860px;height:600px" src="${HDMB}?page=tongquan"></iframe>` + (portal === 'khong' ? '' : MA_PORTAL)));
    if (u.href.startsWith(HDMB)) return route.fulfill(vo(`<iframe style="width:840px;height:560px" src="https://n-hdmb-0lu-script.googleusercontent.com/userCodeAppPanel?page=${trang}"></iframe>`));
    if (u.origin === 'https://n-hdmb-0lu-script.googleusercontent.com' && u.pathname === '/userCodeAppPanel') return route.fulfill(vo(`<iframe style="width:820px;height:540px" src="/user?page=${trang}"></iframe>`));
    if (u.origin === 'https://n-hdmb-0lu-script.googleusercontent.com' && u.pathname === '/user') return route.fulfill(trangHdmb(trang));
    if (u.href.startsWith('https://script.google.com/macros/s/' + ID_KHAC)) return route.fulfill(vo('<h1>WEBAPP KHAC</h1>'));
    return route.fulfill({ status: 404, body: '' });
  });
  const p = await ctx.newPage();
  p.on('pageerror', e => loi.push(e.message));
  await p.goto('https://script.google.com/macros/s/' + ID_PORTAL + '/exec');
  const khungHdmb = async () => {
    for (let i = 0; i < 40; i++) {
      const f = p.frames().find(x => x.url().startsWith('https://n-hdmb-0lu-script.googleusercontent.com/user?'));
      if (f) { try { await f.waitForSelector('#ten', { timeout: 2000 }); return f; } catch (e) { /* khung đang thay */ } }
      await p.waitForTimeout(100);
    }
    throw new Error('Không thấy khung HDMB');
  };
  const f = await khungHdmb();
  await p.waitForTimeout(400); // chờ lời chào / trả lời
  return { ctx, p, f, loi, khungHdmb, nguonPortal };
}

(async () => {
  const b = await moTrinhDuyet();
  const kq = [];
  const urlPortal = 'https://script.google.com/macros/s/' + ID_PORTAL + '/exec';

  // 1) Portal có đoạn mã: bấm menu -> đổi trang trong khung, Portal giữ nguyên
  let t = await dungTinhHuong(b, 'ma');
  await t.f.click('#lnk');
  await t.p.waitForTimeout(600);
  let f2 = await t.khungHdmb();
  kq.push(['Portal có mã: bấm menu -> cửa sổ vẫn là Portal', t.p.url() === urlPortal]);
  kq.push(['Portal có mã: khung HDMB chuyển sang trang Tra cứu', (await f2.textContent('#ten')) === 'TRANG:tracuu']);
  const pf = t.p.frames().find(x => x.url() === t.nguonPortal + '/user');
  kq.push(['Portal có mã: src của iframe Portal đổi sang ?page=tracuu', !!pf && /page=tracuu$/.test(await pf.evaluate(() => document.getElementById('k').src))]);
  // bấm tiếp lần 2 (từ trang mới) vẫn ở trong khung
  await f2.click('#lnk');
  await t.p.waitForTimeout(600);
  kq.push(['Portal có mã: bấm lần 2 vẫn trong khung', t.p.url() === urlPortal && (await (await t.khungHdmb()).textContent('#ten')) === 'TRANG:tracuu']);
  // link sang webapp KHÁC (vd Cổng đăng nhập) -> giữ cách cũ (không nhờ Portal)
  await (await t.khungHdmb()).click('#khac');
  await t.p.waitForTimeout(600);
  kq.push(['Link sang webapp khác: chạy như cũ (rời Portal)', t.p.url().indexOf(ID_KHAC) >= 0]);
  kq.push(['không lỗi JS (Portal có mã)', t.loi.length === 0 ? true : t.loi.join('|')]);
  await t.ctx.close();

  // 2) Link mở tab mới vẫn mở tab mới
  t = await dungTinhHuong(b, 'ma');
  const [tab] = await Promise.all([t.ctx.waitForEvent('page', { timeout: 3000 }).catch(() => null), t.f.click('#tabMoi')]);
  kq.push(['Link target=_blank vẫn mở tab mới, Portal giữ nguyên', !!tab && t.p.url() === urlPortal]);
  await t.ctx.close();

  // 3) Portal chưa dán mã -> như cũ
  t = await dungTinhHuong(b, 'khong');
  await t.f.click('#lnk');
  await t.p.waitForTimeout(600);
  kq.push(['Portal chưa có mã: chạy như cũ (cả cửa sổ sang HDMB)', t.p.url() === HDMB + '?page=tracuu']);
  kq.push(['không lỗi JS (Portal chưa có mã)', t.loi.length === 0 ? true : t.loi.join('|')]);
  await t.ctx.close();

  // 4) Trang lạ (không phải webapp Apps Script) giả làm Portal -> HDMB không tin, không gửi link (kèm mã phiên) cho nó
  t = await dungTinhHuong(b, 'la');
  await t.f.click('#lnk');
  await t.p.waitForTimeout(600);
  kq.push(['Trang lạ giả Portal: HDMB không tin (không nhờ đổi khung)', t.p.url() === HDMB + '?page=tracuu']);
  await t.ctx.close();

  inKetQua(kq);
  await b.close();
  process.exitCode = kq.every(x => x[1] === true) ? 0 : 1;
})().catch(e => { console.error(e); process.exit(1); });
