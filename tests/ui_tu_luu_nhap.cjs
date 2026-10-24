// Giao diện (rà soát 24/10/2026): BẢO TOÀN DỮ LIỆU khi tự lưu nháp ở trang Nhập liệu (trang thật dựng từ template).
// Phản hồi LUU_DRAFT / LUU_CHINH_THUC do test điều khiển tay (tests/ui_gia_lap_cham.cjs): mạng chậm, về sai thứ tự, lỗi.
//  N1  Thay đổi dồn dập: chỉ 1 lượt LUU_DRAFT chạy; bản đến trong lúc chờ được GỘP, bản cuối gửi sau cùng.   N5 Không đổi -> không gọi.
//  N2  Lưu chính thức NGAY sau khi gõ: 1 lời gọi LUU_CHINH_THUC kèm bản mới nhất (không cần LUU_DRAFT riêng).
//  N2b Đang có LUU_DRAFT chạy: Lưu chính thức CHỜ lượt đó xong rồi mới gửi (kèm bản mới nhất, không gửi song song).
//  N3  LUU_CHINH_THUC lỗi mạng / thanhCong:false: báo lỗi, bấm lại gửi lại bản mới nhất.
//  N4  Gõ rồi quay lại danh sách + mở HĐ khác: lần gõ cuối lưu vào đúng nháp cũ.     N6 Bộ gõ tiếng Việt rồi lưu ngay.
//  N7  Đang lưu chính thức mà gõ tiếp: không gửi LUU_DRAFT song song; lỗi -> gửi tiếp phần đã gõ.
//  N8  Timer tự lưu gắn với bản nháp lúc gõ: đã sang bản nháp khác -> không lưu form vào bản nháp mới.
//  N9  Lỗi mạng khi lưu nháp: tự thử lại (cùng nội dung), xong thì báo "Đã lưu nháp".
//  N10 thanhCong:false tạm thời -> thử lại; "Không tìm thấy bản nháp" -> không thử lại, báo ❌.
//  N11 Không có phản hồi (mất kết nối / hết phiên đăng nhập) -> hết hạn chờ, hàng đợi không kẹt, phản hồi muộn bị bỏ.
//  N12 Nhiều tab: mỗi tab có mã riêng; máy chủ báo tab khác vừa sửa -> nhắc người dùng.
//  N13 Tạo HĐ mới (chậm) rồi mở HĐ khác: phản hồi tạo nháp cũ không ghi đè form đang sửa.
//  N14 Hủy nháp: không gửi lần gõ đang chờ sau khi hủy.
const { moTrinhDuyet, inKetQua } = require('./ui_chung.cjs');
const { moTrangThuCong, traLoi, goBangBoGo } = require('./ui_gia_lap_cham.cjs');
const DU_LIEU = {
  MO_DRAFT_THEO_SO_DONG: (soDong, idHD) => ({ idDraft: 'D_' + idHD, du: { idHD: idHD, hopDong: { soHD: 'S-' + idHD, tenChuRung: 'Chu ' + idHD, cccdChuRung: '049000000001', ngayKy: '2026-05-10', tinhTrang: 'Chờ thực hiện' }, rung: [], taiKhoan: [], phuLuc: [] }, tinhTrangGoc: 'Chờ thực hiện' }),
  TAO_DRAFT_MOI: { idDraft: 'D_MOI' },
  layDanhSachHopDong: { items: [], trang: 1, tongTrang: 1, tongSo: 0 },
  layDanhSachKhachHang: { items: [], trang: 1, tongTrang: 1, tongSo: 0 },
  LAY_DS_KHACH_HANG_GON: { ds: [] },
  HUY_DRAFT: { thanhCong: true }
};
const TC = ['LUU_DRAFT', 'LUU_CHINH_THUC'];
(async () => {
  const b = await moTrinhDuyet();
  const kq = [];
  const moTrang = async (thuCong) => {
    const r = await moTrangThuCong(b, '11_Page_NhapLieu', 'form', thuCong || TC, DU_LIEU);
    await r.p.evaluate(() => { var d = document.getElementById('hakHopThoaiDangNhap'); if (d) d.remove(); });
    return r;
  };
  const mo = async (p, idHD) => { await p.evaluate(id => moTrangXemHopDong(2, id), idHD); await p.waitForTimeout(80); await p.evaluate(() => { window.__goi = []; window.__cho = []; }); };
  const ten = j => { try { return JSON.parse(j).hopDong.tenChuRung; } catch (e) { return '?'; } };
  const goi = p => p.evaluate(() => window.__goi.filter(m => ['LUU_DRAFT', 'LUU_CHINH_THUC', 'HUY_DRAFT'].indexOf(m.ten) !== -1).map(m => ({ ten: m.ten, id: m.args[0], json: m.args[1] || '' })));
  const tomTat = async p => (await goi(p)).map(x => x.ten + (x.json ? ':' + ten(x.json) : ''));
  const trangThai = p => p.evaluate(() => (document.getElementById('trangThaiLuuNhap') || {}).textContent || '');
  const msg = p => p.evaluate(() => document.getElementById('msgLuuChinhThuc').textContent);
  const go = (p, v) => p.fill('#tenChuRung', v);
  const luuNgay = (p, v) => p.evaluate(v => { setVal('tenChuRung', v); capNhatDuNhapTuFormHopDong_(); luuNhapNgay(); }, v);

  // N1 + N5
  {
    const { p, loiJS } = await moTrang();
    await mo(p, 'HD1');
    for (const t of ['A1', 'A2', 'A3']) await luuNgay(p, t);
    let g = await tomTat(p);
    kq.push(['N1 3 thay đổi dồn dập: chỉ 1 lượt lưu nháp đang chạy (không gửi song song)', g.length === 1 ? true : JSON.stringify(g)]);
    await traLoi(p, 'LUU_DRAFT', 0, { thanhCong: true }); await p.waitForTimeout(20);
    g = await tomTat(p);
    kq.push(['N1 lượt 1 xong -> gửi NGAY bản mới nhất (A3), bỏ bản trung gian A2', g.length === 2 && g[1] === 'LUU_DRAFT:A3' ? true : JSON.stringify(g)]);
    await traLoi(p, 'LUU_DRAFT', 1, { thanhCong: true }); await p.waitForTimeout(20);
    await p.evaluate(() => { capNhatDuNhapTuFormHopDong_(); luuNhapNgay(); });
    g = await tomTat(p);
    kq.push(['N5 nội dung không đổi -> không gọi lại LUU_DRAFT', g.length === 2 ? true : JSON.stringify(g)]);
    const tt = await trangThai(p);
    kq.push(['N1 lưu xong: dòng trạng thái "✅ Đã lưu nháp lúc …"', /Đã lưu nháp lúc/.test(tt) ? true : tt]);
    kq.push(['N1 không lỗi JS', loiJS.length ? loiJS.join(' | ') : true]);
    await p.close();
  }
  // N2 + N7 + N3
  {
    const { p, loiJS } = await moTrang();
    await mo(p, 'HD2');
    await go(p, 'Ten cuoi cung');
    await p.evaluate(() => luuChinhThuc()); await p.waitForTimeout(30);
    let g = await tomTat(p);
    kq.push(['N2 Lưu chính thức ngay sau khi gõ: đúng 1 lời gọi LUU_CHINH_THUC kèm lần gõ cuối', g.length === 1 && g[0] === 'LUU_CHINH_THUC:Ten cuoi cung' ? true : JSON.stringify(g)]);
    await go(p, 'Go trong luc luu'); await p.waitForTimeout(800);
    g = await tomTat(p);
    kq.push(['N7 đang lưu chính thức mà gõ tiếp: không gửi LUU_DRAFT song song', g.length === 1 ? true : JSON.stringify(g)]);
    await traLoi(p, 'LUU_CHINH_THUC', 0, { __loi: 'Hết thời gian' }); await p.waitForTimeout(30);
    g = await tomTat(p);
    kq.push(['N7 lưu chính thức lỗi -> gửi tiếp phần đã gõ trong lúc chờ', g.indexOf('LUU_DRAFT:Go trong luc luu') !== -1 ? true : JSON.stringify(g)]);
    const m1 = await msg(p);
    kq.push(['N3 lỗi mạng khi lưu chính thức -> báo ❌, không báo thành công', /❌/.test(m1) ? true : m1]);
    await traLoi(p, 'LUU_DRAFT', 0, { thanhCong: true }); await p.waitForTimeout(20);
    await p.evaluate(() => luuChinhThuc()); await p.waitForTimeout(30);
    g = await goi(p);
    const lan2 = g.filter(x => x.ten === 'LUU_CHINH_THUC');
    kq.push(['N3 bấm lại -> gửi lại LUU_CHINH_THUC kèm bản mới nhất', lan2.length === 2 && ten(lan2[1].json) === 'Go trong luc luu' ? true : JSON.stringify(g.map(x => x.ten + ':' + ten(x.json)))]);
    await traLoi(p, 'LUU_CHINH_THUC', 1, { thanhCong: false, loi: 'Thiếu Họ tên chủ rừng / CCCD hợp lệ / Ngày ký hợp đồng.' }); await p.waitForTimeout(30);
    const m2 = await msg(p);
    kq.push(['N3 thanhCong:false -> báo đúng lỗi của máy chủ', /Thiếu Họ tên/.test(m2) ? true : m2]);
    kq.push(['N2 không lỗi JS', loiJS.length ? loiJS.join(' | ') : true]);
    await p.close();
  }
  // N2b
  {
    const { p } = await moTrang();
    await mo(p, 'HD2B');
    await luuNgay(p, 'B1');
    await go(p, 'B2');
    await p.evaluate(() => luuChinhThuc()); await p.waitForTimeout(30);
    let g = await tomTat(p);
    kq.push(['N2b LUU_DRAFT đang chạy: Lưu chính thức CHỜ (chưa gửi)', g.length === 1 && g[0] === 'LUU_DRAFT:B1' ? true : JSON.stringify(g)]);
    await traLoi(p, 'LUU_DRAFT', 0, { thanhCong: true }); await p.waitForTimeout(30);
    g = await tomTat(p);
    kq.push(['N2b lượt trước xong -> LUU_CHINH_THUC kèm bản mới nhất B2 (không thêm LUU_DRAFT)', g.length === 2 && g[1] === 'LUU_CHINH_THUC:B2' ? true : JSON.stringify(g)]);
    await p.close();
  }
  // N4
  {
    const { p } = await moTrang();
    await mo(p, 'HD4');
    await go(p, 'Sua HD4');
    await p.evaluate(() => veTrangDanhSach());
    await p.evaluate(() => moTrangXemHopDong(3, 'HD5')); await p.waitForTimeout(900);
    const ds = (await goi(p)).filter(x => x.ten === 'LUU_DRAFT');
    kq.push(['N4 gõ rồi quay lại + mở HĐ khác: lần gõ cuối lưu vào đúng nháp cũ', ds.some(x => x.id === 'D_HD4' && ten(x.json) === 'Sua HD4') && !ds.some(x => x.id === 'D_HD5') ? true : JSON.stringify(ds.map(x => x.id + ':' + ten(x.json)))]);
    await p.close();
  }
  // N6
  {
    const { p } = await moTrang();
    await mo(p, 'HD6');
    await goBangBoGo(p, '#tenChuRung', 'Nguyễn');
    await p.keyboard.insertText(' Văn Ả');
    await p.evaluate(() => luuChinhThuc()); await p.waitForTimeout(30);
    const g = await tomTat(p);
    kq.push(['N6 gõ bằng bộ gõ rồi lưu chính thức ngay: gửi đủ "Nguyễn Văn Ả"', g[g.length - 1] === 'LUU_CHINH_THUC:Nguyễn Văn Ả' ? true : JSON.stringify(g)]);
    await p.close();
  }
  // N8
  {
    const { p } = await moTrang();
    await mo(p, 'HD8');
    await go(p, 'Thuoc HD8');
    await p.evaluate(() => { idDraftHienTai = 'D_KHAC'; });
    await p.waitForTimeout(900);
    const ds = (await goi(p)).filter(x => x.ten === 'LUU_DRAFT');
    kq.push(['N8 timer gắn với bản nháp lúc gõ: sang bản nháp khác thì không ghi form vào bản nháp mới', !ds.some(x => x.id === 'D_KHAC') ? true : JSON.stringify(ds.map(x => x.id))]);
    await p.close();
  }
  // N9 + N10
  {
    const { p } = await moTrang();
    await p.evaluate(() => { THU_LAI_LUU_NHAP_MS_ = [150, 150, 150]; });
    await mo(p, 'HD9');
    await luuNgay(p, 'C1');
    await traLoi(p, 'LUU_DRAFT', 0, { __loi: 'Mất mạng' }); await p.waitForTimeout(20);
    const tt1 = await trangThai(p);
    kq.push(['N9 lỗi mạng: báo "Chưa lưu được nháp — đang tự thử lại"', /Chưa lưu được nháp.*tự thử lại/.test(tt1) ? true : tt1]);
    await p.waitForTimeout(250);
    let ds = (await goi(p)).filter(x => x.ten === 'LUU_DRAFT');
    kq.push(['N9 tự thử lại cùng nội dung (cùng số thứ tự)', ds.length === 2 && ds[1].json === ds[0].json ? true : JSON.stringify(ds.map(x => ten(x.json)))]);
    await traLoi(p, 'LUU_DRAFT', 1, { thanhCong: false, loi: 'Lỗi lưu nháp: Service Spreadsheets timed out' }); await p.waitForTimeout(250);
    ds = (await goi(p)).filter(x => x.ten === 'LUU_DRAFT');
    kq.push(['N10 thanhCong:false tạm thời -> tự thử lại', ds.length === 3 ? true : String(ds.length)]);
    await traLoi(p, 'LUU_DRAFT', 2, { thanhCong: true }); await p.waitForTimeout(20);
    const tt2 = await trangThai(p);
    kq.push(['N9 thử lại thành công -> "✅ Đã lưu nháp"', /Đã lưu nháp lúc/.test(tt2) ? true : tt2]);
    await luuNgay(p, 'C2');
    await traLoi(p, 'LUU_DRAFT', 3, { thanhCong: false, loi: 'Không tìm thấy bản nháp D_HD9 (có thể đã bị Lưu chính thức hoặc hủy ở tab khác).' }); await p.waitForTimeout(400);
    ds = (await goi(p)).filter(x => x.ten === 'LUU_DRAFT');
    const tt3 = await trangThai(p);
    kq.push(['N10 "Không tìm thấy bản nháp" -> không tự thử lại, báo ❌', ds.length === 4 && /❌/.test(tt3) ? true : JSON.stringify({ n: ds.length, tt3 })]);
    await p.close();
  }
  // N11
  {
    const { p, loiJS } = await moTrang();
    await p.evaluate(() => { HAN_CHO_LUU_NHAP_MS_ = 200; THU_LAI_LUU_NHAP_MS_ = [100, 100, 100]; });
    await mo(p, 'HD11');
    await luuNgay(p, 'D1');
    await p.waitForTimeout(450);
    const ds = (await goi(p)).filter(x => x.ten === 'LUU_DRAFT');
    kq.push(['N11 không có phản hồi -> hết hạn chờ, tự gửi lại (hàng đợi không kẹt)', ds.length >= 2 ? true : String(ds.length)]);
    for (let i = 0; i < ds.length; i++) await traLoi(p, 'LUU_DRAFT', i, { thanhCong: true }); // phản hồi muộn của các lượt đã hết hạn
    await p.waitForTimeout(30);
    await go(p, 'D2'); await p.evaluate(() => luuChinhThuc()); await p.waitForTimeout(30);
    const g = await tomTat(p);
    kq.push(['N11 sau đó Lưu chính thức vẫn chạy được (không chờ mãi)', g[g.length - 1] === 'LUU_CHINH_THUC:D2' ? true : JSON.stringify(g)]);
    kq.push(['N11 không lỗi JS', loiJS.length ? loiJS.join(' | ') : true]);
    await p.close();
  }
  // N12 nhiều tab
  {
    const t1 = await moTrang(), t2 = await moTrang();
    await mo(t1.p, 'HD12'); await mo(t2.p, 'HD12');
    await luuNgay(t1.p, 'Tab 1'); await luuNgay(t2.p, 'Tab 2');
    const a = (await goi(t1.p))[0], c = (await goi(t2.p))[0];
    const ta = JSON.parse(a.json)._luuNhap.tab, tb = JSON.parse(c.json)._luuNhap.tab;
    kq.push(['N12 2 tab cùng mở 1 HĐ: mỗi tab gửi mã tab riêng', ta && tb && ta !== tb ? true : JSON.stringify([ta, tb])]);
    await traLoi(t2.p, 'LUU_DRAFT', 0, { thanhCong: true, canhBaoTabKhac: true, nguoiSuaKhac: 'nl1@test.vn' }); await t2.p.waitForTimeout(30);
    const toast = await t2.p.evaluate(() => (document.getElementById('hakToastHop') || {}).textContent || '');
    kq.push(['N12 máy chủ báo tab khác vừa sửa -> nhắc người dùng', /tab \/ máy khác/.test(toast) ? true : toast]);
    await t1.p.close(); await t2.p.close();
  }
  // N13
  {
    const { p } = await moTrang(['TAO_DRAFT_MOI', 'MO_DRAFT_THEO_SO_DONG', 'LUU_DRAFT', 'LUU_CHINH_THUC']);
    await p.evaluate(() => { window.__goi = []; window.__cho = []; moTrangTaoHopDong(); moTrangXemHopDong(3, 'HD13'); });
    await traLoi(p, 'MO_DRAFT_THEO_SO_DONG', 0, { idDraft: 'D_HD13', du: { idHD: 'HD13', hopDong: { soHD: 'S13', tenChuRung: 'Chu HD13', cccdChuRung: '049000000001', ngayKy: '2026-05-10' }, rung: [], taiKhoan: [], phuLuc: [] }, tinhTrangGoc: 'Chờ thực hiện' });
    await traLoi(p, 'TAO_DRAFT_MOI', 0, { idDraft: 'D_MOI' }); await p.waitForTimeout(30);
    const s = await p.evaluate(() => ({ draft: idDraftHienTai, ten: document.getElementById('tenChuRung').value }));
    kq.push(['N13 tạo HĐ mới (chậm) rồi mở HĐ khác: phản hồi tạo nháp cũ không ghi đè form', s.draft === 'D_HD13' && s.ten === 'Chu HD13' ? true : JSON.stringify(s)]);
    await p.close();
  }
  // N14
  {
    const { p } = await moTrang();
    await mo(p, 'HD14');
    await p.evaluate(() => { window.hakXacNhan_ = function () { return Promise.resolve(true); }; });
    await go(p, 'Se huy');
    await p.evaluate(() => huyNhapVaThoat()); await p.waitForTimeout(900);
    const g = await tomTat(p);
    kq.push(['N14 hủy nháp: chỉ gọi HUY_DRAFT, không gửi lần gõ đang chờ', g.length === 1 && g[0] === 'HUY_DRAFT' ? true : JSON.stringify(g)]);
    await p.close();
  }
  await b.close();
  inKetQua(kq);
  process.exit(kq.every(x => x[1] === true) ? 0 : 1);
})();
