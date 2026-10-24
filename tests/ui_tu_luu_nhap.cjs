// Giao diện (rà soát 24/10/2026): THỨ TỰ tự lưu nháp ở trang Nhập liệu (trang thật dựng từ template).
// google.script.run giả lập: LUU_DRAFT / LUU_CHINH_THUC KHÔNG tự trả lời — test tự quyết định lượt nào về trước
// (mô phỏng mạng chậm, phản hồi sai thứ tự). Các lời gọi khác trả lời sau 5 ms.
//  N1 Thay đổi dồn dập: chỉ 1 lượt LUU_DRAFT chạy cùng lúc, các bản đến trong lúc chờ được GỘP, bản cuối cùng gửi sau cùng.
//  N2 Bấm "Lưu chính thức" ngay sau khi gõ (chưa hết 700 ms): phải lưu nháp lần cuối XONG rồi mới gọi LUU_CHINH_THUC.
//  N3 Lưu nháp lần cuối lỗi: KHÔNG gọi LUU_CHINH_THUC, báo lỗi; bấm lại -> gửi lại nháp.
//  N4 Gõ rồi bấm ngay "Hợp đồng" (quay lại danh sách) / mở hợp đồng khác: lần gõ cuối được lưu vào ĐÚNG bản nháp cũ.
//  N5 Không có thay đổi -> không gọi lại máy chủ.
//  N6 Gõ tiếng Việt bằng bộ gõ (composition) rồi lưu chính thức: nháp gửi đi có đủ chữ đã soạn.
//  N7 Đang lưu chính thức mà vẫn gõ: không gửi LUU_DRAFT song song với LUU_CHINH_THUC.
const { danhGia } = require('./gas_template.cjs');
const { moTrinhDuyet, ghiTrangTam, inKetQua } = require('./ui_chung.cjs');
const THU_CONG = ['LUU_DRAFT', 'LUU_CHINH_THUC'];
const giaLap = `<script>(function(){window.__goi=[];window.__cho=[];var THU_CONG=${JSON.stringify(THU_CONG)};
function taoRunner(){var ok=null,loi=null;var r=new Proxy({},{get:function(_,k){
 if(k==='withSuccessHandler')return function(f){ok=f;return r}; if(k==='withFailureHandler')return function(f){loi=f;return r}; if(k==='withUserObject')return function(){return r};
 return function(){var a=[].slice.call(arguments);var ten=k==='api'?a[1]:k;var args=k==='api'?(a[2]||[]):a;
  var muc={ten:ten,args:args,luc:Date.now(),xong:false};window.__goi.push(muc);
  if(THU_CONG.indexOf(ten)!==-1){muc.tra=function(kq){muc.xong=true;if(ok)ok(kq)};muc.loi=function(m){muc.xong=true;if(loi)loi({message:m})};window.__cho.push(muc);return;}
  var du=(window.__du||{})[ten];
  setTimeout(function(){if(!ok)return; ok(ten==='thongTinDangNhap'?{daDangNhap:true,email:'nl@test.vn',vaiTroNhan:'Nhập liệu',quyen:['XEM','NHAP_LIEU'],quaPhien:true}:(typeof du==='function'?du.apply(null,args):(du!==undefined?du:[])))},5)}}});return r}
 window.google={script:{url:{getLocation:function(f){f({parameter:{},hash:''})}},history:{replace:function(){}},host:{close:function(){}},run:new Proxy({},{get:function(_,k){return taoRunner()[k]}})}};})();</script>`;
const DU_LIEU = {
  MO_DRAFT_THEO_SO_DONG: (soDong, idHD) => ({ idDraft: 'D_' + idHD, du: { idHD: idHD, hopDong: { soHD: 'S-' + idHD, tenChuRung: 'Chu ' + idHD, cccdChuRung: '049000000001', ngayKy: '2026-05-10', tinhTrang: 'Chờ thực hiện' }, rung: [], taiKhoan: [], phuLuc: [] }, tinhTrangGoc: 'Chờ thực hiện' }),
  layDanhSachHopDong: { items: [], trang: 1, tongTrang: 1, tongSo: 0 },
  layDanhSachKhachHang: { items: [], trang: 1, tongTrang: 1, tongSo: 0 }
};
(async () => {
  const b = await moTrinhDuyet();
  const kq = [];
  const moTrang = async () => {
    let html = danhGia('11_Page_NhapLieu', { currentPage: 'form', baseUrl: 'https://script.google.com/macros/s/X/exec', tabTrang: '', phien: '', loiDangNhap: '' });
    const duLieu = 'window.__du={' + Object.keys(DU_LIEU).map(k => JSON.stringify(k) + ':' + (typeof DU_LIEU[k] === 'function' ? DU_LIEU[k].toString() : JSON.stringify(DU_LIEU[k]))).join(',') + '};';
    html = html.replace(/<head>/i, '<head>' + giaLap + '<script>' + duLieu + '</script>');
    const p = await b.newPage({ viewport: { width: 1280, height: 900 } });
    const loiJS = []; p.on('pageerror', e => loiJS.push(e.message));
    await p.route(/^https?:\/\//, r => r.abort());
    await p.goto(ghiTrangTam('tuluunhap.html', html));
    await p.waitForTimeout(300);
    await p.evaluate(() => { var d = document.getElementById('hakHopThoaiDangNhap'); if (d) d.remove(); });
    return { p, loiJS };
  };
  const mo = async (p, idHD) => { await p.evaluate(id => moTrangXemHopDong(2, id), idHD); await p.waitForTimeout(80); };
  const luuDraft = p => p.evaluate(() => window.__cho.filter(m => m.ten === 'LUU_DRAFT').map(m => ({ id: m.args[0], ten: JSON.parse(m.args[1]).hopDong.tenChuRung, xong: m.xong })));
  const goiTen = p => p.evaluate(() => window.__goi.filter(m => ['LUU_DRAFT', 'LUU_CHINH_THUC'].indexOf(m.ten) !== -1).map(m => m.ten + (m.ten === 'LUU_DRAFT' ? ':' + JSON.parse(m.args[1]).hopDong.tenChuRung : '')));
  const traLuuDraft = (p, i, loi) => p.evaluate(([i, loi]) => { const m = window.__cho.filter(m => m.ten === 'LUU_DRAFT')[i]; if (!m) return; if (loi) m.loi(loi); else m.tra({ thanhCong: true }); }, [i, loi || '']);
  const go = async (p, giaTri) => { await p.fill('#tenChuRung', giaTri); };

  // N1
  {
    const { p, loiJS } = await moTrang();
    await mo(p, 'HD1');
    await p.evaluate(() => { window.__goi = []; window.__cho = []; });
    for (const t of ['A1', 'A2', 'A3']) { await p.evaluate(t => { setVal('tenChuRung', t); capNhatDuNhapTuFormHopDong_(); luuNhapNgay(); }, t); }
    const lan1 = await luuDraft(p);
    kq.push(['N1 3 thay đổi dồn dập: chỉ 1 lượt lưu nháp đang chạy (không gửi song song)', lan1.length === 1 ? true : JSON.stringify(lan1)]);
    await traLuuDraft(p, 0);
    await p.waitForTimeout(30);
    const lan2 = await luuDraft(p);
    kq.push(['N1 lượt 1 xong -> gửi NGAY bản mới nhất (A3), bỏ bản trung gian A2', lan2.length === 2 && lan2[1].ten === 'A3' ? true : JSON.stringify(lan2)]);
    if (lan2.length >= 2) await traLuuDraft(p, 1);
    await p.waitForTimeout(30);
    const lan3 = await luuDraft(p);
    kq.push(['N1 không còn lượt thừa sau bản cuối', lan3.length === 2 ? true : JSON.stringify(lan3)]);
    // N5
    await p.evaluate(() => { capNhatDuNhapTuFormHopDong_(); luuNhapNgay(); });
    const lan4 = await luuDraft(p);
    kq.push(['N5 nội dung không đổi -> không gọi lại LUU_DRAFT', lan4.length === 2 ? true : JSON.stringify(lan4)]);
    kq.push(['N1 không lỗi JS', loiJS.length ? loiJS.join(' | ') : true]);
    await p.close();
  }
  // N2 + N7
  {
    const { p, loiJS } = await moTrang();
    await mo(p, 'HD2');
    await p.evaluate(() => { window.__goi = []; window.__cho = []; });
    await go(p, 'Ten cuoi cung');
    await p.evaluate(() => luuChinhThuc());
    await p.waitForTimeout(30);
    let g = await goiTen(p);
    kq.push(['N2 bấm Lưu chính thức ngay sau khi gõ: gửi nháp có lần gõ cuối, CHƯA gọi LUU_CHINH_THUC khi nháp chưa lưu xong',
      g.length === 1 && g[0] === 'LUU_DRAFT:Ten cuoi cung' ? true : JSON.stringify(g)]);
    if (g.length && g[0].indexOf('LUU_DRAFT') === 0) await traLuuDraft(p, 0);
    await p.waitForTimeout(30);
    g = await goiTen(p);
    kq.push(['N2 nháp lưu xong -> mới gọi LUU_CHINH_THUC', g[g.length - 1] === 'LUU_CHINH_THUC' && g.indexOf('LUU_CHINH_THUC') === g.length - 1 ? true : JSON.stringify(g)]);
    // N7: đang chờ LUU_CHINH_THUC mà vẫn gõ
    const truoc = (await goiTen(p)).length;
    await go(p, 'Go trong luc luu');
    await p.waitForTimeout(800);
    g = await goiTen(p);
    kq.push(['N7 đang lưu chính thức mà gõ tiếp: không gửi LUU_DRAFT song song', g.length === truoc ? true : JSON.stringify(g.slice(truoc))]);
    await p.evaluate(() => { const m = window.__cho.filter(x => x.ten === 'LUU_CHINH_THUC').pop(); if (m) m.loi('Hết thời gian'); });
    await p.waitForTimeout(30);
    g = await goiTen(p);
    kq.push(['N7 lưu chính thức lỗi -> gửi tiếp phần đã gõ trong lúc chờ', g.slice(truoc).indexOf('LUU_DRAFT:Go trong luc luu') !== -1 ? true : JSON.stringify(g.slice(truoc))]);
    kq.push(['N2 không lỗi JS', loiJS.length ? loiJS.join(' | ') : true]);
    await p.close();
  }
  // N3
  {
    const { p } = await moTrang();
    await mo(p, 'HD3');
    await p.evaluate(() => { window.__goi = []; window.__cho = []; });
    await go(p, 'Ten B');
    await p.evaluate(() => luuChinhThuc());
    await p.waitForTimeout(30);
    let g = await goiTen(p);
    if (g[0] && g[0].indexOf('LUU_DRAFT') === 0) await traLuuDraft(p, 0, 'Mất mạng');
    await p.waitForTimeout(30);
    g = await goiTen(p);
    const msg = await p.evaluate(() => document.getElementById('msgLuuChinhThuc').textContent);
    kq.push(['N3 lưu nháp lần cuối lỗi -> KHÔNG lưu chính thức, có báo lỗi', g.indexOf('LUU_CHINH_THUC') === -1 && /❌/.test(msg) ? true : JSON.stringify({ g, msg })]);
    await p.evaluate(() => luuChinhThuc());
    await p.waitForTimeout(30);
    g = await goiTen(p);
    kq.push(['N3 bấm lại -> gửi lại nháp (không kẹt)', g.filter(x => x === 'LUU_DRAFT:Ten B').length === 2 ? true : JSON.stringify(g)]);
    await p.close();
  }
  // N4
  {
    const { p } = await moTrang();
    await mo(p, 'HD4');
    await p.evaluate(() => { window.__goi = []; window.__cho = []; });
    await go(p, 'Sua HD4');
    await p.evaluate(() => veTrangDanhSach());
    await mo(p, 'HD5');
    await p.waitForTimeout(900);
    const ds = await luuDraft(p);
    const sai = ds.filter(x => x.id === 'D_HD5' && x.ten === 'Sua HD4');
    kq.push(['N4 gõ rồi quay lại danh sách + mở HĐ khác: lần gõ cuối lưu vào đúng nháp cũ', ds.some(x => x.id === 'D_HD4' && x.ten === 'Sua HD4') && !sai.length ? true : JSON.stringify(ds)]);
    await p.close();
  }
  // N6
  {
    const { p } = await moTrang();
    await mo(p, 'HD6');
    await p.evaluate(() => { window.__goi = []; window.__cho = []; });
    const o = await p.$('#tenChuRung');
    await o.click({ clickCount: 3 });
    const cdp = await p.context().newCDPSession(p);
    await cdp.send('Input.imeSetComposition', { text: 'Nguyê', selectionStart: 5, selectionEnd: 5 });
    await cdp.send('Input.imeSetComposition', { text: 'Nguyễn', selectionStart: 6, selectionEnd: 6 });
    await cdp.send('Input.insertText', { text: 'Nguyễn' });
    await p.keyboard.insertText(' Văn Ả');
    await p.evaluate(() => luuChinhThuc());
    await p.waitForTimeout(30);
    const ds = await luuDraft(p);
    kq.push(['N6 gõ bằng bộ gõ rồi lưu chính thức ngay: nháp gửi đi có đủ "Nguyễn Văn Ả"', ds.length && ds[ds.length - 1].ten === 'Nguyễn Văn Ả' ? true : JSON.stringify(ds)]);
    await p.close();
  }
  await b.close();
  inKetQua(kq);
  process.exit(kq.every(x => x[1] === true) ? 0 : 1);
})();
