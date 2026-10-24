// Giao diện (rà soát 24/10/2026): MẠNG CHẬM + PHẢN HỒI SAI THỨ TỰ + QUAY LẠI DANH SÁCH trên trang thật.
// Phản hồi do test điều khiển tay (tests/ui_gia_lap_cham.cjs): lượt gửi trước có thể về sau, có lỗi đến trễ.
//  TC1-TC3 Tra cứu: tìm lại / đổi khoảng ngày khi lượt trước chưa về -> chỉ kết quả lượt mới nhất hiện; lỗi cũ đến trễ không ghi đè.
//  TC4     Tra cứu (điện thoại): đang tải chi tiết có nút "Quay lại"; quay lại rồi chi tiết mới về -> vẫn ở danh sách.
//  TC5     Tra cứu (màn rộng): bấm A rồi B, A về sau -> hiện B.
//  TC6     Tra cứu: gõ từ khóa bằng bộ gõ tiếng Việt rồi Enter -> gửi đủ chữ đã soạn.
//  NL1-NL2 Nhập liệu: mở HĐ A (chậm) -> quay lại -> mở B; A về sau -> vẫn là B; quay lại rồi A mới về -> vẫn ở danh sách.
//  NL3     Nhập liệu: gõ tìm (debounce thật) 2 lượt, lượt 1 về sau -> bảng là kết quả lượt 2.
const { moTrinhDuyet, inKetQua } = require('./ui_chung.cjs');
const { moTrangThuCong, dsCho, traLoi, goBangBoGo } = require('./ui_gia_lap_cham.cjs');
const ketQuaTC = (ten) => ({ tongSo: 1, tuKhoa: ten, ketQua: [{ idHD: 'ID_' + ten, soHD: 'SO_' + ten, ngayKy: '10/05/2026', tenChuRung: 'Chu ' + ten, tenUyQuyen: '', cccdChuRung: '049000000001', diaChiRung: 'X', tinhTrang: 'Chờ thực hiện', khopTheo: 'Tên' }] });
const ketQua2 = { tongSo: 2, tuKhoa: 'xx', ketQua: [ketQuaTC('A').ketQua[0], ketQuaTC('B').ketQua[0]] };
const chiTiet = (ten) => ({ idHD: 'ID_' + ten, hopDong: { soHD: 'SO_' + ten, tenChuRung: 'CHITIET ' + ten }, thucHien: {}, loRung: [], taiKhoan: [], hoSo: [], anh: [] });
(async () => {
  const b = await moTrinhDuyet();
  const kq = [];
  const TC = ['TRA_CUU_HOP_DONG', 'CHI_TIET_TRA_CUU_HOP_DONG'];
  const vungKQ = p => p.evaluate(() => document.getElementById('tcVungKetQua').textContent);
  const vungCT = p => p.evaluate(() => document.getElementById('tcVungChiTiet').textContent);
  const tim = async (p, tk) => { await p.fill('#tcTuKhoa', tk); await p.press('#tcTuKhoa', 'Enter'); await p.waitForTimeout(20); };

  // TC1-TC3 (điện thoại)
  {
    const { p, loiJS } = await moTrangThuCong(b, '33_Page_TraCuuHopDong', 'tracuu', TC, {}, { width: 390, height: 844 });
    await tim(p, 'An'); await tim(p, 'Binh');
    const ds = await dsCho(p, 'TRA_CUU_HOP_DONG');
    kq.push(['TC1 tìm lại khi lượt trước chưa về: lượt mới được gửi ngay (không bị chặn)', ds.length === 2 && ds[1].args[0] === 'Binh' ? true : JSON.stringify(ds.map(x => x.args[0]))]);
    await traLoi(p, 'TRA_CUU_HOP_DONG', 1, ketQuaTC('Binh'));
    await traLoi(p, 'TRA_CUU_HOP_DONG', 0, ketQuaTC('An'));
    let v = await vungKQ(p);
    kq.push(['TC1 lượt cũ (An) về sau lượt mới (Binh): vẫn hiện kết quả Binh', /SO_Binh/.test(v) && !/SO_An/.test(v) ? true : v.slice(0, 100)]);
    await tim(p, 'Cuong'); await tim(p, 'Dung');
    await traLoi(p, 'TRA_CUU_HOP_DONG', 3, ketQuaTC('Dung'));
    await traLoi(p, 'TRA_CUU_HOP_DONG', 2, { __loi: 'Lỗi cũ đến trễ' });
    v = await vungKQ(p);
    kq.push(['TC2 lỗi của lượt cũ đến trễ không ghi đè kết quả mới', /SO_Dung/.test(v) && !/Lỗi cũ/.test(v) ? true : v.slice(0, 100)]);
    await tim(p, 'Em');
    await p.click('.tc-nhanh button[data-kn="thangnay"]'); await p.waitForTimeout(20);
    const ds3 = await dsCho(p, 'TRA_CUU_HOP_DONG');
    await traLoi(p, 'TRA_CUU_HOP_DONG', ds3.length - 1, ketQuaTC('ThangNay'));
    await traLoi(p, 'TRA_CUU_HOP_DONG', ds3.length - 2, ketQuaTC('Em'));
    v = await vungKQ(p);
    kq.push(['TC3 đổi khoảng ngày khi đang tìm: gửi ngay lượt có ngày, lượt cũ về sau không ghi đè', ds3[ds3.length - 1].args[1] && /SO_ThangNay/.test(v) && !/SO_Em/.test(v) ? true : JSON.stringify({ args: ds3[ds3.length - 1].args, v: v.slice(0, 80) })]);
    // TC4: chi tiết đang tải -> Quay lại
    await p.click('#tcVungKetQua a.lnk-hd'); await p.waitForTimeout(20);
    const coNut = await p.evaluate(() => !!document.querySelector('#tcVungChiTiet #tcQuayLai'));
    kq.push(['TC4 điện thoại: đang tải chi tiết (mạng chậm) vẫn có nút "Quay lại kết quả"', coNut ? true : await vungCT(p)]);
    if (coNut) await p.click('#tcQuayLai');
    await traLoi(p, 'CHI_TIET_TRA_CUU_HOP_DONG', 0, chiTiet('ThangNay'));
    await p.waitForTimeout(20);
    const st = await p.evaluate(() => ({ ds: document.getElementById('tcVungKetQua').style.display, ct: document.getElementById('tcVungChiTiet').textContent }));
    kq.push(['TC4 quay lại rồi chi tiết mới về: vẫn ở danh sách, không bật chi tiết', coNut && st.ds !== 'none' && !/CHITIET/.test(st.ct) ? true : JSON.stringify(st)]);
    kq.push(['TC1-4 không lỗi JS', loiJS.length ? loiJS.join(' | ') : true]);
    await p.close();
  }
  // TC5 (màn rộng)
  {
    const { p, loiJS } = await moTrangThuCong(b, '33_Page_TraCuuHopDong', 'tracuu', TC, {});
    await tim(p, 'xx');
    await traLoi(p, 'TRA_CUU_HOP_DONG', 0, ketQua2);
    await p.waitForTimeout(20);
    const links = await p.$$('#tcVungKetQua a.lnk-hd');
    await links[0].click(); await links[1].click(); await p.waitForTimeout(20);
    const ds = await dsCho(p, 'CHI_TIET_TRA_CUU_HOP_DONG');
    const iB = ds.map(x => x.args[0]).lastIndexOf('ID_B'), iA = ds.map(x => x.args[0]).lastIndexOf('ID_A');
    await traLoi(p, 'CHI_TIET_TRA_CUU_HOP_DONG', iB, chiTiet('B'));
    await traLoi(p, 'CHI_TIET_TRA_CUU_HOP_DONG', iA, chiTiet('A'));
    for (let i = 0; i < ds.length; i++) if (i !== iA && i !== iB) await traLoi(p, 'CHI_TIET_TRA_CUU_HOP_DONG', i, chiTiet('A'));
    const v = await vungCT(p);
    kq.push(['TC5 màn rộng: bấm A rồi B, chi tiết A về sau -> vẫn hiện B', /CHITIET B/.test(v) && !/CHITIET A/.test(v) ? true : v.slice(0, 100)]);
    kq.push(['TC5 không lỗi JS', loiJS.length ? loiJS.join(' | ') : true]);
    await p.close();
  }
  // TC6 bộ gõ tiếng Việt
  {
    const { p } = await moTrangThuCong(b, '33_Page_TraCuuHopDong', 'tracuu', TC, {}, { width: 390, height: 844 });
    await goBangBoGo(p, '#tcTuKhoa', 'Nguyễn Văn Ả');
    await p.press('#tcTuKhoa', 'Enter'); await p.waitForTimeout(20);
    const ds = await dsCho(p, 'TRA_CUU_HOP_DONG');
    kq.push(['TC6 gõ bằng bộ gõ tiếng Việt rồi Enter: gửi đủ "Nguyễn Văn Ả"', ds.length && ds[ds.length - 1].args[0] === 'Nguyễn Văn Ả' ? true : JSON.stringify(ds.map(x => x.args[0]))]);
    await p.close();
  }
  // NL1-NL3 Nhập liệu
  {
    const NL = ['MO_DRAFT_THEO_SO_DONG', 'layDanhSachHopDong'];
    const { p, loiJS } = await moTrangThuCong(b, '11_Page_NhapLieu', 'form', NL, {});
    await p.evaluate(() => { var d = document.getElementById('hakHopThoaiDangNhap'); if (d) d.remove(); });
    const nhap = id => ({ idDraft: 'D_' + id, du: { idHD: id, hopDong: { soHD: 'S_' + id, tenChuRung: 'Chu ' + id, cccdChuRung: '049000000001', ngayKy: '2026-05-10' }, rung: [], taiKhoan: [], phuLuc: [] }, tinhTrangGoc: 'Chờ thực hiện' });
    const trangThai = () => p.evaluate(() => ({ ten: document.getElementById('tenChuRung').value, draft: idDraftHienTai, dsHien: document.getElementById('trangDanhSach').style.display !== 'none', hdHien: document.getElementById('trangHopDong').style.display !== 'none', bc: document.getElementById('breadcrumbBar').textContent }));
    const soMo = async () => (await dsCho(p, 'MO_DRAFT_THEO_SO_DONG')).length;
    let n0 = await soMo();
    await p.evaluate(() => { moTrangXemHopDong(2, 'HA'); veTrangDanhSach(); moTrangXemHopDong(3, 'HB'); });
    await traLoi(p, 'MO_DRAFT_THEO_SO_DONG', n0 + 1, nhap('HB'));
    await traLoi(p, 'MO_DRAFT_THEO_SO_DONG', n0, nhap('HA'));
    await p.waitForTimeout(20);
    let s = await trangThai();
    kq.push(['NL1 mở A (chậm) -> quay lại -> mở B; A về sau: form vẫn là B, nháp đang sửa là D_HB', s.ten === 'Chu HB' && s.draft === 'D_HB' ? true : JSON.stringify(s)]);
    n0 = await soMo();
    await p.evaluate(() => { moTrangXemHopDong(4, 'HC'); veTrangDanhSach(); });
    await traLoi(p, 'MO_DRAFT_THEO_SO_DONG', n0, nhap('HC'));
    await p.waitForTimeout(20);
    s = await trangThai();
    kq.push(['NL2 quay lại danh sách rồi HĐ mới về: vẫn ở danh sách, không đổi nháp đang sửa', s.dsHien && !s.hdHien && s.draft !== 'D_HC' && !/Chu HC/.test(s.bc) ? true : JSON.stringify(s)]);
    // NL3: gõ tìm thật (debounce 300 ms)
    const n1 = (await dsCho(p, 'layDanhSachHopDong')).length;
    await p.fill('#tuKhoaHD', 'ng'); await p.waitForTimeout(400);
    await p.fill('#tuKhoaHD', 'nguyen'); await p.waitForTimeout(400);
    const ds = await dsCho(p, 'layDanhSachHopDong');
    const hd = t => ({ items: [{ soDong: 2, idHD: 'I' + t, soHD: 'KQ_' + t, ngayKy: '2026-05-10', tenChuRung: t, diaChiRung: '', tinhTrang: 'Chờ thực hiện' }], trang: 1, tongTrang: 1, tongSo: 1 });
    await traLoi(p, 'layDanhSachHopDong', ds.length - 1, hd('nguyen'));
    await traLoi(p, 'layDanhSachHopDong', ds.length - 2, hd('ng'));
    const bang = await p.evaluate(() => document.querySelector('#tblDSHopDong tbody').textContent);
    kq.push(['NL3 gõ tìm 2 lượt (debounce thật), lượt 1 về sau: bảng là kết quả "nguyen"', ds.length - n1 >= 2 && /KQ_nguyen/.test(bang) && !/KQ_ng\b/.test(bang) ? true : JSON.stringify({ n: ds.length - n1, bang: bang.slice(0, 80) })]);
    kq.push(['NL không lỗi JS', loiJS.length ? loiJS.join(' | ') : true]);
    await p.close();
  }
  await b.close();
  inKetQua(kq);
  process.exit(kq.every(x => x[1] === true) ? 0 : 1);
})();
