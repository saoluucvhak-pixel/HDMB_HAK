// Ô nhập số kiểu VN (DinhDangSo_JS): gõ bằng bộ gõ tiếng Việt / bàn phím điện thoại (cụm đang soạn) không được nhảy số.
// Lỗi cũ: gõ 35000 qua bộ gõ ra "3,500354" (đơn giá/diện tích ở Thêm hồ sơ rừng nhảy loạn).
const { moTrinhDuyet, ghiTrangTam, docMa, inKetQua } = require('./ui_chung.cjs');
(async () => {
  const html = '<!doctype html><html><body><input id="a" type="text"><input id="kl" type="text">' + docMa('DinhDangSo_JS.html') +
    '<script>window.__tinh=0; ganDinhDangSo_("a"); document.getElementById("a").addEventListener("input", function(){ window.__tinh++; document.getElementById("kl").value = docSoVN_(this.value) || ""; });</script></body></html>';
  const trang = ghiTrangTam('ui_dinh_dang_so.html', html);
  const b = await moTrinhDuyet();
  const p = await b.newPage();
  const loiJS = []; p.on('pageerror', e => loiJS.push(e.message));
  await p.goto(trang);
  const c = await p.context().newCDPSession(p);
  const goIME = async (chuoi, giuNguyen) => {
    if (!giuNguyen) await p.fill('#a', '');
    await p.focus('#a');
    let cum = '';
    for (const ch of chuoi) { cum += ch; await c.send('Input.imeSetComposition', { text: cum, selectionStart: cum.length, selectionEnd: cum.length }); }
    await c.send('Input.insertText', { text: cum });
    return p.inputValue('#a');
  };
  const goIMETungSo = async (chuoi) => { // bàn phím điện thoại: mỗi chữ số 1 cụm soạn riêng
    await p.fill('#a', ''); await p.focus('#a');
    for (const ch of chuoi) { await c.send('Input.imeSetComposition', { text: ch, selectionStart: 1, selectionEnd: 1 }); await c.send('Input.insertText', { text: ch }); }
    return p.inputValue('#a');
  };
  const kq = [];
  kq.push(['bộ gõ (cả cụm) 35000 -> 35.000', await goIME('35000') === '35.000']);
  kq.push(['bộ gõ (cả cụm) 1250000 -> 1.250.000', await goIME('1250000') === '1.250.000']);
  kq.push(['ô tự tính phía sau đọc đúng số sau khi soạn xong', await p.inputValue('#kl') === '1250000']);
  kq.push(['bàn phím điện thoại từng chữ số 35000 -> 35.000', await goIMETungSo('35000') === '35.000']);
  kq.push(['soạn tiếp vào ô đã có 35.000 thêm 0 -> 350.000', await goIME('0', true) === '350.000']);
  await p.fill('#a', ''); await p.type('#a', '35000');
  kq.push(['gõ phím thường vẫn đúng 35.000', await p.inputValue('#a') === '35.000']);
  await p.fill('#a', ''); await p.type('#a', '12.5');
  kq.push(['gõ dấu chấm = thập phân 12,5', await p.inputValue('#a') === '12,5']);
  await p.fill('#a', ''); await p.type('#a', '3500');
  await p.evaluate(() => { const e = document.getElementById('a'); e.focus(); e.select(); });
  await c.send('Input.insertText', { text: '1,234.5' });
  kq.push(['bôi đen cả ô rồi dán "1,234.5" -> 1.234,5', await p.inputValue('#a') === '1.234,5', await p.inputValue('#a')]);
  kq.push(['không lỗi JS', loiJS.length === 0 ? true : loiJS.join('|')]);
  inKetQua(kq.map(x => [x[0] + (x[1] === true ? '' : ' (được: ' + x[2] + ')'), x[1]]));
  await b.close();
  process.exitCode = kq.every(x => x[1] === true) ? 0 : 1;
})().catch(e => { console.error(e); process.exit(1); });
