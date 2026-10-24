// Kiểm tra phân quyền TĨNH (đọc mã nguồn, không chạy): chạy được trên mọi máy, không cần dữ liệu.
//  Q-1 Hàm ghi dữ liệu (tên bắt đầu bằng CAP_NHAT_/THEM_/XOA_/LUU_/TAO_/DUYET_/TU_CHOI_/GAN_/HUY_/THANH_LY_/KHOI_PHUC_/DOI_)
//      gọi qua api() phải yêu cầu ít nhất Nhập liệu — không mở cho vai trò Chỉ xem.
//  Q-2 Hàm nội bộ có _yeuCauQuyen_ không nằm trên đường chạy của trigger / doPost / doGet (lúc đó không có người đăng nhập
//      -> bị chặn nhầm: bot Telegram, thông báo hằng ngày, đồng bộ thanh toán... ngừng chạy).
//  Q-3 Chức năng gọi qua api() với quyền thấp không được gọi bên trong 1 hàm đòi quyền cao hơn (báo lỗi quyền nhầm).
// Chạy: node tests/test_phan_quyen_tinh.cjs [thư mục mã nguồn]
const fs = require('fs'), path = require('path');
const THU_MUC = process.argv[2] || path.resolve(__dirname, '..');
let dat = 0, truot = 0; const ketQua = [];
function kiem(ten, dk, chiTiet) { if (dk) { dat++; ketQua.push('PASS ' + ten); } else { truot++; ketQua.push('FAIL ' + ten + (chiTiet ? ' — ' + chiTiet : '')); } }

const boChuThich = x => x.replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ' ')).replace(/(^|[^:'"\\])\/\/[^\n]*/g, '$1');
const fns = {}; let bang = '';
fs.readdirSync(THU_MUC).filter(f => /\.gs$/.test(f)).forEach(f => {
  const s = boChuThich(fs.readFileSync(path.join(THU_MUC, f), 'utf8'));
  if (f === '34_PhanQuyen.gs') bang = s;
  const re = /^function\s+([\w$]+)\s*\(/gm; let m; const pos = [];
  while ((m = re.exec(s))) pos.push([m[1], m.index]);
  pos.forEach((p, i) => { fns[p[0]] = s.slice(p[1], i + 1 < pos.length ? pos[i + 1][1] : s.length); });
});
const MUC = { XEM: 1, NHAP_LIEU: 2, QUAN_TRI: 3 }, VIET_TAT = { X: 1, N: 2, Q: 3 };
const canQuyen = n => { const m = /^\s*_yeuCauQuyen_\(QUYEN\.(\w+)\)/m.exec(fns[n].split('\n').slice(1, 4).join('\n')); return m ? MUC[m[1]] : 0; };
const tenHam = Object.keys(fns);
const goiCache = {};
const goi = n => goiCache[n] || (goiCache[n] = tenHam.filter(k => k !== n && fns[n].indexOf(k) !== -1 && new RegExp('\\b' + k.replace(/\$/g, '\\$') + '\\s*\\(').test(fns[n].replace(/^function[^\n]*\n/, ''))));
const duyet = (goc, cb) => { const da = new Set(); const w = (n, chuoi) => { if (da.has(n)) return; da.add(n); cb(n, chuoi.concat(n)); goi(n).forEach(c => w(c, chuoi.concat(n))); }; w(goc, []); };

const tuyen = []; { const re = /^\s+(\w+): r\((\w+), ([XNQ])\)/gm; let m; while ((m = re.exec(bang))) tuyen.push({ ten: m[1], fn: m[2], q: m[3] }); }
kiem('Q-0 đọc được bảng quyền api() (' + tuyen.length + ' chức năng)', tuyen.length > 50);

// Q-1
const MAU_GHI = /^(CAP_NHAT_|THEM_|XOA_|LUU_|TAO_|DUYET_|TU_CHOI_|GAN_|HUY_|THANH_LY_|KHOI_PHUC_|DOI_)/;
const ghiMoChoXem = tuyen.filter(t => MAU_GHI.test(t.ten) && t.q === 'X' && !/^LUU_CAU_HINH_GIAO_DIEN/.test(t.ten));
kiem('Q-1 hàm ghi dữ liệu qua api() không mở cho vai trò Chỉ xem', !ghiMoChoXem.length, ghiMoChoXem.map(t => t.ten).join(', '));

// Q-2
const tuDong = ['doGet', 'doPost', 'onOpen', 'onChangeLamMoiCache'];
const tatCa = Object.values(fns).join('\n');
tenHam.forEach(n => { if (new RegExp("newTrigger\\('" + n + "'\\)").test(tatCa)) tuDong.push(n); });
const loi2 = [];
tuDong.filter(n => fns[n]).forEach(g => duyet(g, (n, chuoi) => { if (n !== g && canQuyen(n)) loi2.push(chuoi.join(' → ')); }));
kiem('Q-2 trigger / doPost / doGet không đi qua hàm nội bộ có kiểm tra quyền (' + tuDong.length + ' điểm vào)', !loi2.length, loi2.slice(0, 5).join(' | '));

// Q-3
const loi3 = [];
tuyen.forEach(t => { if (fns[t.fn]) duyet(t.fn, (n, chuoi) => { if (canQuyen(n) > VIET_TAT[t.q]) loi3.push(t.ten + ' (' + t.q + '): ' + chuoi.join(' → ')); }); });
kiem('Q-3 không chức năng nào bị chặn nhầm vì gọi hàm nội bộ đòi quyền cao hơn', !loi3.length, loi3.slice(0, 5).join(' | '));

console.log(ketQua.join('\n'));
console.log('\n' + dat + ' đạt, ' + truot + ' trượt');
process.exit(truot ? 1 : 0);
