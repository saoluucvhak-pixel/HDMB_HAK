// Giao diện (rà soát 24/10/2026): tìm / nhận diện khách hàng có sẵn với 10.000 khách (danh sách GỌN + tra chi tiết theo CCCD).
//  KH-1 Nhập liệu nạp danh sách gọn 1 lần (không còn layDanhSachKhachHang(1, 5000) đầy đủ).
//  KH-2 Gõ tên: datalist gợi ý ≤ 20 dòng khớp (không dựng sẵn 10.000 lựa chọn).
//  KH-3 Gõ đúng tên khách có sẵn (khách thứ 9.999 — trước đây bị cắt ở 5.000) rồi rời ô: lấy chi tiết theo CCCD, tự điền SĐT có số 0 đầu.
//  KH-4 Chi tiết về muộn sau khi đã mở hợp đồng khác: không điền vào form đang sửa.
//  KH-5 Modal "Tạo hợp đồng mới": chọn khách -> tạo nháp + điền đủ thông tin.
//  KH-6 Thêm/Sửa HĐ (trang 27): bấm khách A rồi B, chi tiết A về sau -> bước 2 là B.
const { moTrinhDuyet, inKetQua } = require('./ui_chung.cjs');
const { moTrangThuCong, dsCho, traLoi } = require('./ui_gia_lap_cham.cjs');
const DS = () => ({ ds: Array.from({ length: 10000 }, (_, i) => ['0490' + String(10000000 + i), 'Khach Hang ' + i, 1 + (i % 3), 'Thon ' + i]) });
const chiTiet = (i) => ({ cccd: '0490' + String(10000000 + i), tenChuRung: 'Khach Hang ' + i, sdt: '0905' + String(100000 + i), thuongTru: 'Thon ' + i, ngayCap: '2020-01-02', noiCap: 'CA Quảng Nam', nhomKH: 'A', maSoThue: '0401234567', soLuongHopDong: 2 });
(async () => {
  const b = await moTrinhDuyet();
  const kq = [];
  const TC = ['LAY_KHACH_HANG_THEO_CCCD', 'TAO_DRAFT_MOI', 'MO_DRAFT_THEO_SO_DONG'];
  const DU = { LAY_DS_KHACH_HANG_GON: DS, layDanhSachHopDong: { items: [], trang: 1, tongTrang: 1, tongSo: 0 } };
  {
    const { p, loiJS } = await moTrangThuCong(b, '11_Page_NhapLieu', 'form', TC, DU);
    await p.evaluate(() => { var d = document.getElementById('hakHopThoaiDangNhap'); if (d) d.remove(); });
    await p.waitForTimeout(200);
    const g = await p.evaluate(() => window.__goi.filter(m => /KHACH_HANG|layDanhSachKhachHang/.test(m.ten)).map(m => m.ten + JSON.stringify(m.args)).join(' '));
    kq.push(['KH-1 trang Nhập liệu nạp danh sách gọn 1 lần, không nạp 5.000 bản ghi đầy đủ', /LAY_DS_KHACH_HANG_GON/.test(g) && !/layDanhSachKhachHang/.test(g) ? true : g]);
    // tạo nháp mới
    await p.evaluate(() => moTrangTaoHopDong());
    await traLoi(p, 'TAO_DRAFT_MOI', 0, { idDraft: 'D_MOI' }); await p.waitForTimeout(30);
    await p.fill('#tenChuRung', 'Khach Hang 999'); await p.waitForTimeout(200);
    const soGoiY = await p.evaluate(() => document.querySelectorAll('#dlKhachHangCoSanTheoTen option').length);
    kq.push(['KH-2 gõ tên: datalist ≤ 20 gợi ý khớp (không dựng sẵn 10.000 dòng)', soGoiY > 0 && soGoiY <= 20 ? true : String(soGoiY)]);
    await p.fill('#tenChuRung', 'Khach Hang 9999');
    await p.evaluate(() => document.getElementById('tenChuRung').blur()); await p.waitForTimeout(30);
    const ds = await dsCho(p, 'LAY_KHACH_HANG_THEO_CCCD');
    kq.push(['KH-3 khách thứ 9.999 (sau mốc 5.000 cũ) được nhận diện -> lấy chi tiết theo đúng CCCD', ds.length === 1 && ds[0].args[0] === '049010009999' ? true : JSON.stringify(ds)]);
    await traLoi(p, 'LAY_KHACH_HANG_THEO_CCCD', 0, chiTiet(9999)); await p.waitForTimeout(30);
    const f = await p.evaluate(() => ({ cccd: document.getElementById('cccdChuRung').value, sdt: document.getElementById('sdtChuRung').value, tt: document.getElementById('diaChiThuongTru').value }));
    kq.push(['KH-3 tự điền CCCD + SĐT (giữ số 0 đầu) + địa chỉ', f.cccd === '049010009999' && f.sdt === '0905109999' && f.tt === 'Thon 9999' ? true : JSON.stringify(f)]);
    // KH-4: tạo nháp khác, gõ CCCD khách 42 -> chi tiết chậm -> mở HĐ khác -> chi tiết về
    await p.evaluate(() => moTrangTaoHopDong());
    await traLoi(p, 'TAO_DRAFT_MOI', 1, { idDraft: 'D_MOI2' }); await p.waitForTimeout(30);
    await p.fill('#cccdChuRung', '049010000042');
    await p.evaluate(() => document.getElementById('cccdChuRung').blur()); await p.waitForTimeout(30);
    await p.evaluate(() => moTrangXemHopDong(2, 'HDX'));
    await traLoi(p, 'MO_DRAFT_THEO_SO_DONG', 0, { idDraft: 'D_HDX', du: { idHD: 'HDX', hopDong: { soHD: 'SX', tenChuRung: 'Chu HDX', cccdChuRung: '049000000777', ngayKy: '2026-05-10', sdtChuRung: '' }, rung: [], taiKhoan: [], phuLuc: [] }, tinhTrangGoc: 'Chờ thực hiện' });
    await p.waitForTimeout(30);
    const ds4 = await dsCho(p, 'LAY_KHACH_HANG_THEO_CCCD');
    await traLoi(p, 'LAY_KHACH_HANG_THEO_CCCD', ds4.length - 1, chiTiet(42)); await p.waitForTimeout(30);
    const f4 = await p.evaluate(() => ({ ten: document.getElementById('tenChuRung').value, sdt: document.getElementById('sdtChuRung').value }));
    kq.push(['KH-4 chi tiết khách về muộn sau khi đã mở HĐ khác: không điền vào form đang sửa', f4.ten === 'Chu HDX' && f4.sdt === '' ? true : JSON.stringify(f4)]);
    // KH-5 modal
    await p.evaluate(() => { veTrangDanhSach(); moModalChonKhachHang(); });
    const soDong = await p.evaluate(() => document.querySelectorAll('#dsKhachHangTrongModal .ds-kh-dong').length);
    const coDiaChi = await p.evaluate(() => /Thon 0/.test(document.getElementById('dsKhachHangTrongModal').textContent));
    kq.push(['KH-5 modal hiện 30 khách đầu, kèm địa chỉ để phân biệt người trùng tên', soDong === 30 && coDiaChi ? true : JSON.stringify({ soDong, coDiaChi })]);
    await p.click('#dsKhachHangTrongModal .ds-kh-dong'); await p.waitForTimeout(30);
    const ds5 = await dsCho(p, 'LAY_KHACH_HANG_THEO_CCCD');
    await traLoi(p, 'LAY_KHACH_HANG_THEO_CCCD', ds5.length - 1, chiTiet(0));
    await traLoi(p, 'TAO_DRAFT_MOI', 2, { idDraft: 'D_MOI3' }); await p.waitForTimeout(30);
    const f5 = await p.evaluate(() => ({ ten: document.getElementById('tenChuRung').value, sdt: document.getElementById('sdtChuRung').value, mst: document.getElementById('maSoThue').value, draft: idDraftHienTai }));
    kq.push(['KH-5 chọn khách trong modal -> tạo nháp + điền đủ (SĐT, MST giữ số 0 đầu)', f5.ten === 'Khach Hang 0' && f5.sdt === '0905100000' && f5.mst === '0401234567' && f5.draft === 'D_MOI3' ? true : JSON.stringify(f5)]);
    kq.push(['KH Nhập liệu không lỗi JS', loiJS.length ? loiJS.join(' | ') : true]);
    await p.close();
  }
  {
    const { p, loiJS } = await moTrangThuCong(b, '27_Page_HopDongMeCon', 'hopdongmc', ['LAY_KHACH_HANG_THEO_CCCD'], Object.assign({ layDanhSachKhachHang: { items: [], trang: 1, tongTrang: 1, tongSo: 0 } }, DU));
    await p.evaluate(() => { var d = document.getElementById('hakHopThoaiDangNhap'); if (d) d.remove(); moWizardThemHopDong(); });
    await p.waitForTimeout(150);
    await p.fill('#oTimKH', 'Khach Hang 1234'); await p.waitForTimeout(50);
    await p.click('#dsKhachHangW .ds-kh-dong');
    await p.fill('#oTimKH', 'Khach Hang 7777'); await p.waitForTimeout(50);
    await p.click('#dsKhachHangW .ds-kh-dong'); await p.waitForTimeout(30);
    const ds = await dsCho(p, 'LAY_KHACH_HANG_THEO_CCCD');
    await traLoi(p, 'LAY_KHACH_HANG_THEO_CCCD', 1, chiTiet(7777));
    await traLoi(p, 'LAY_KHACH_HANG_THEO_CCCD', 0, chiTiet(1234)); await p.waitForTimeout(50);
    const w = await p.evaluate(() => { const g = id => (document.getElementById(id) || {}).value; return { ten: g('wTenChuRung'), cccd: g('wCccd'), sdt: g('wSdt') }; });
    kq.push(['KH-6 trang 27: bấm khách A rồi B, chi tiết A về sau -> bước tiếp theo là B (đủ SĐT có số 0 đầu)', ds.length === 2 && w.ten === 'Khach Hang 7777' && w.cccd === '049010007777' && w.sdt === '0905107777' ? true : JSON.stringify({ n: ds.length, w })]);
    kq.push(['KH-6 trang 27 không lỗi JS', loiJS.length ? loiJS.join(' | ') : true]);
    await p.close();
  }
  await b.close();
  inKetQua(kq);
  process.exit(kq.every(x => x[1] === true) ? 0 : 1);
})();
