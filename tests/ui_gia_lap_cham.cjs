// Dựng trang thật (template Apps Script) với google.script.run giả lập ĐIỀU KHIỂN TAY: các hàm trong danh sách thuCong
// KHÔNG tự trả lời — test gọi window.__cho[i].tra(kq) / .loi('...') theo thứ tự mong muốn (mô phỏng mạng chậm, phản hồi
// về sai thứ tự). Hàm khác trả lời sau 5 ms bằng duLieu[tên] (giá trị, hoặc hàm nhận đúng tham số gọi).
const { danhGia } = require('./gas_template.cjs');
const { ghiTrangTam } = require('./ui_chung.cjs');

function giaLapThuCong(thuCong) {
  return `<script>(function(){window.__goi=[];window.__cho=[];var THU_CONG=${JSON.stringify(thuCong)};
function taoRunner(){var ok=null,loi=null;var r=new Proxy({},{get:function(_,k){
 if(k==='withSuccessHandler')return function(f){ok=f;return r}; if(k==='withFailureHandler')return function(f){loi=f;return r}; if(k==='withUserObject')return function(){return r};
 return function(){var a=[].slice.call(arguments);var ten=k==='api'?a[1]:k;var args=k==='api'?(a[2]||[]):a;
  var muc={ten:ten,args:args,xong:false};window.__goi.push(muc);
  if(THU_CONG.indexOf(ten)!==-1){muc.tra=function(kq){muc.xong=true;if(ok)ok(kq)};muc.loi=function(m){muc.xong=true;if(loi)loi({message:m})};window.__cho.push(muc);return;}
  var du=(window.__du||{})[ten];
  setTimeout(function(){if(!ok)return; ok(ten==='thongTinDangNhap'?{daDangNhap:true,email:'nl@test.vn',vaiTroNhan:'Nhập liệu',quyen:['XEM','NHAP_LIEU'],quaPhien:true}:(typeof du==='function'?du.apply(null,args):(du!==undefined?du:[])))},5)}}});return r}
 window.google={script:{url:{getLocation:function(f){f({parameter:{},hash:''})}},history:{replace:function(){}},host:{close:function(){}},run:new Proxy({},{get:function(_,k){return taoRunner()[k]}})}};})();</script>`;
}

/** duLieu: { tenHam: giá trị | function(...thamSo) } — hàm được chép nguyên văn sang trình duyệt (không dùng biến ngoài). */
async function moTrangThuCong(b, file, trang, thuCong, duLieu, viewport) {
  let html = danhGia(file, { currentPage: trang, baseUrl: 'https://script.google.com/macros/s/X/exec', tabTrang: '', phien: '', loiDangNhap: '' });
  const du = 'window.__du={' + Object.keys(duLieu || {}).map(k => JSON.stringify(k) + ':' + (typeof duLieu[k] === 'function' ? duLieu[k].toString() : JSON.stringify(duLieu[k]))).join(',') + '};';
  html = html.replace(/<head>/i, '<head>' + giaLapThuCong(thuCong) + '<script>' + du + '</script>');
  const p = await b.newPage({ viewport: viewport || { width: 1280, height: 900 } });
  const loiJS = []; p.on('pageerror', e => loiJS.push(e.message));
  await p.route(/^https?:\/\//, r => r.abort());
  await p.goto(ghiTrangTam('cham_' + file + '_' + Date.now() + '.html', html));
  await p.waitForTimeout(300);
  return { p, loiJS };
}

/** Danh sách lời gọi đang chờ của 1 hàm: [{ args, xong }] */
const dsCho = (p, ten) => p.evaluate(t => window.__cho.filter(m => m.ten === t).map(m => ({ args: m.args, xong: m.xong })), ten);
/** Trả lời lượt thứ i (0 = lượt đầu) của hàm ten: kq (thành công) hoặc { loi: '...' } (lỗi) */
const traLoi = (p, ten, i, kq) => p.evaluate(([t, i, kq]) => { const m = window.__cho.filter(x => x.ten === t)[i]; if (!m) return false; if (kq && kq.__loi) m.loi(kq.__loi); else m.tra(kq); return true; }, [ten, i, kq]);
const goBangBoGo = async (p, chon, chu) => {
  await p.click(chon, { clickCount: 3 });
  const cdp = await p.context().newCDPSession(p);
  for (let i = 1; i <= chu.length; i++) await cdp.send('Input.imeSetComposition', { text: chu.slice(0, i), selectionStart: i, selectionEnd: i });
  await cdp.send('Input.insertText', { text: chu });
};
module.exports = { giaLapThuCong, moTrangThuCong, dsCho, traLoi, goBangBoGo };
