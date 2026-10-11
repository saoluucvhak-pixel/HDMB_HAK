// Test P0 (nâng cấp 10/2026): đồng bộ Draft / thanh toán không được ghi mốc "đã xử lý" khi chưa xử lý xong,
// không lưu kết quả lỗi đè lên cache thanh toán tốt, và chống tạo trùng hợp đồng không chỉ dựa vào CacheService.
// Chạy: TZ=Asia/Ho_Chi_Minh node tests/test_p0_dong_bo.cjs [thư mục mã nguồn — mặc định thư mục gốc repo]
// Viết TRƯỚC khi sửa: chạy trên mã cũ phải TRƯỢT ở các mục P0-*, trên mã mới phải ĐẠT.
const { taoMoiTruong } = require('./gasmock.cjs');
const vm = require('vm');
const path = require('path');
const THU_MUC = process.argv[2] || path.resolve(__dirname, '..');
const J = JSON.stringify;
let dat = 0, truot = 0; const ketQua = [];
function kiem(ten, dk, chiTiet) { if (dk) { dat++; ketQua.push('PASS ' + ten); } else { truot++; ketQua.push('FAIL ' + ten + (chiTiet ? ' — ' + chiTiet : '')); } }
function chay(f) { try { f(); } catch (e) { truot++; ketQua.push('LỖI ' + String(e.stack || e.message).slice(0, 300)); } }

const URL_DNTT = '1oUm87_gbDbnuPc_We0dyZ_e4kHXBHXs95AQAxp5okYo';
const URL_PHIEUCAN = '1vqMVxccBA7zlAMHrGsVBydGFwZJ6QuDZW10zJ74V29g';

function moi() {
  const m = taoMoiTruong(THU_MUC);
  const run = (code) => vm.runInContext(code, m.ctx);
  const ss = m.ssChinh;
  const tieuDe = (ten, n) => { const sh = ss.insertSheet(ten); sh.getRange(1, 1, 1, n).setValues([Array.from({ length: n }, (_, i) => ten + '_C' + (i + 1))]); return sh; };
  tieuDe('HD_NCC', 33); tieuDe('HD_RUNG', 20); tieuDe('HD_STK', 10); tieuDe('HD_GPS', 10); tieuDe('HD_Picture', 13); tieuDe('DM_DIACHI', 8);
  m.props.set('REPORT_SPREADSHEET_ID', 'REPORT');
  // File ngoài DNTT_GK_DN_CT + PhieuCan_DN (giả lập), thời điểm sửa file Drive điều khiển được
  const SS = m.ssChinh.constructor;
  const ssDNTT = new SS('DNTT'), ssPC = new SS('PC');
  const shD = ssDNTT.insertSheet('DNTT_GK_DN_CT');
  const hD = Array(20).fill('x'); hD[0] = 'Ngày'; hD[6] = 'Người nhận'; hD[11] = 'Số CT'; hD[12] = 'Khối lượng'; hD[16] = 'Thành tiền'; hD[19] = 'Số HĐ';
  shD.appendRow(hD);
  const shP = ssPC.insertSheet('PhieuCan_DN'); const hP = Array(28).fill('x'); hP[0] = 'Số phiếu'; hP[1] = 'Ngày cân 1'; hP[22] = 'So_CT'; shP.appendRow(hP);
  const goc = m.ctx.SpreadsheetApp.openByUrl;
  const trangThai = { loiMo: false, suaLuc: 1000 };
  m.ctx.SpreadsheetApp.openByUrl = function (u) {
    if (u.indexOf(URL_DNTT) !== -1) { if (trangThai.loiMo) throw new Error('Service Spreadsheets timed out'); return ssDNTT; }
    if (u.indexOf(URL_PHIEUCAN) !== -1) return ssPC;
    return goc(u);
  };
  m.ctx.DriveApp.getFileById = () => ({ getLastUpdated: () => new Date(trangThai.suaLuc) });
  const tao = (ten, cccd, soHD, maThaoTac) => run('TAO_HOP_DONG_MOI_(' + J({ tenChuRung: ten, cccdChuRung: cccd, ngayKy: '2026-05-10', soTK: '1' + cccd.slice(-4), nganHang: 'VCB', soHD: soHD, diaChiRung: 'Thôn A', dienTichKy: 10000, slDuKien: 120, donGia: 1000, maThaoTac: maThaoTac }) + ')');
  const dongDNTT = (soHD, kl, tien, ct) => { const r = Array(20).fill(''); r[0] = new Date('2026-06-01T00:00:00+07:00'); r[6] = 'Người nhận'; r[11] = ct || ('CT-' + soHD); r[12] = kl; r[16] = tien; r[19] = soHD; shD.appendRow(r); };
  const draft = () => { const sh = m.ssBaoCao.getSheetByName('Draft_BaoCaoHopDong'); return sh ? sh.getDataRange().getValues().slice(1) : []; };
  const col = (k) => run('DRAFT_BAOCAO_COL.' + k);
  const draftCua = (idHD) => draft().filter(r => r[col('ID_HD')] === idHD);
  return { m, run, ss, tao, shD, dongDNTT, trangThai, draft, draftCua, col };
}

try {
  // ======================= P0-A: đồng bộ thanh toán gặp lỗi đọc DNTT =======================
  chay(function () {
    const t = moi();
    const A = t.tao('Nguyen A', '049000000001', 'A1');
    t.dongDNTT('A1', 20, 25000000);
    t.trangThai.suaLuc = 2000;
    t.run('dongBoThanhToanNeuCoThayDoi_()');
    const kl1 = t.draftCua(A.idHD).map(r => r[t.col('KHOI_LUONG_THUC_HIEN')]);
    kiem('P0-A1 đồng bộ bình thường: KL thực hiện = 20 (cột M DNTT)', J(kl1) === J([20]), J(kl1));
    const moc1 = t.m.props.get('DNTT_THOI_GIAN_SUA_LAN_TRUOC');

    // DNTT bị đổi tiêu đề (không dò được cột Số HĐ) -> đọc lỗi; file có sửa -> trigger chạy
    t.shD.getRange(1, 20).setValue('Ma khac');
    t.trangThai.suaLuc = 3000;
    t.run('dongBoThanhToanNeuCoThayDoi_()');
    const kl2 = t.draftCua(A.idHD).map(r => r[t.col('KHOI_LUONG_THUC_HIEN')]);
    kiem('P0-A2 đọc DNTT lỗi -> KHÔNG đổi KL thực hiện đang đúng của hợp đồng (giữ 20, không về 0)', J(kl2) === J([20]), J(kl2));
    const cache = t.run('docCacheBaoCao_ChiDocThat_("duLieuThucHienDNTT", function () { return { thanhCong: false, loi: "chưa có" }; })');
    kiem('P0-A3 đọc DNTT lỗi -> cache thanh toán tốt KHÔNG bị ghi đè bằng kết quả lỗi', cache && cache.thanhCong === true && cache.theoSoHD.A1 && cache.theoSoHD.A1.khoiLuong === 20, J(cache).slice(0, 200));
    kiem('P0-A4 đọc DNTT lỗi -> KHÔNG ghi mốc "đã xử lý" (lượt sau thử lại)', t.m.props.get('DNTT_THOI_GIAN_SUA_LAN_TRUOC') === moc1, t.m.props.get('DNTT_THOI_GIAN_SUA_LAN_TRUOC') + ' vs ' + moc1);
    const nk = t.ss.getSheetByName('NhatKy_SuaDoi').getDataRange().getValues().map(r => r[2]).join('|');
    kiem('P0-A5 đọc DNTT lỗi -> có ghi nhật ký lỗi', /LỖI đồng bộ thanh toán/.test(nk), nk.slice(-200));

    // Sửa lại tiêu đề + thêm dòng -> lượt sau xử lý đủ
    t.shD.getRange(1, 20).setValue('Số HĐ');
    t.dongDNTT('A1', 5, 6250000, 'CT-A1-2');
    t.run('dongBoThanhToanNeuCoThayDoi_()');
    const kl3 = t.draftCua(A.idHD).map(r => r[t.col('KHOI_LUONG_THUC_HIEN')]);
    kiem('P0-A6 DNTT đọc lại được -> lượt sau cập nhật KL = 25 và ghi mốc', J(kl3) === J([25]) && t.m.props.get('DNTT_THOI_GIAN_SUA_LAN_TRUOC') === '3000', J(kl3) + ' moc=' + t.m.props.get('DNTT_THOI_GIAN_SUA_LAN_TRUOC'));

    // Mở file DNTT lỗi hẳn (timeout) -> không đổi gì
    t.trangThai.loiMo = true; t.trangThai.suaLuc = 4000;
    t.run('dongBoThanhToanNeuCoThayDoi_()');
    kiem('P0-A7 mở file DNTT lỗi -> giữ nguyên KL và mốc', J(t.draftCua(A.idHD).map(r => r[t.col('KHOI_LUONG_THUC_HIEN')])) === J([25]) && t.m.props.get('DNTT_THOI_GIAN_SUA_LAN_TRUOC') === '3000');
  });

  // ======================= P0-B: đồng bộ thanh toán NGAY (menu) ghi mốc trước khi xử lý =======================
  chay(function () {
    const t = moi();
    const A = t.tao('Tran B', '049000000002', 'B1');
    t.dongDNTT('B1', 7, 8750000);
    t.trangThai.suaLuc = 5000;
    t.run('getOrCreateDraftBaoCaoSheet_ = (function (g) { return function () { throw new Error("Sheet đang bị khóa"); }; })(getOrCreateDraftBaoCaoSheet_)');
    let kq = ''; try { kq = t.run('CHAY_DONG_BO_THANH_TOAN_NGAY()'); } catch (e) { kq = 'NÉM: ' + e.message; }
    kiem('P0-B1 đồng bộ ngay: ghi Draft lỗi -> KHÔNG ghi mốc (trigger 30 phút sẽ làm lại)', !t.m.props.get('DNTT_THOI_GIAN_SUA_LAN_TRUOC') && !t.m.props.get('DNTT_SO_DONG_LAN_TRUOC'), J([t.m.props.get('DNTT_THOI_GIAN_SUA_LAN_TRUOC'), t.m.props.get('DNTT_SO_DONG_LAN_TRUOC')]));
    kiem('P0-B2 đồng bộ ngay: ghi Draft lỗi -> báo rõ là CHƯA đồng bộ xong (không báo ✅)', !/^✅/.test(String(kq)), String(kq));
  });

  // ======================= P0-C: Làm mới Draft theo nhật ký =======================
  chay(function () {
    const t = moi();
    const ds = [];
    for (let i = 0; i < 12; i++) ds.push(t.tao('Khach ' + i, '0490000001' + String(10 + i), 'K' + i));
    t.run('LAM_MOI_DRAFT_THEO_THAY_DOI_()');
    // Sửa tay trực tiếp trên Sheet 12 hợp đồng (trigger onEdit ghi nhật ký) — > 10 HĐ => đi đường cập nhật hàng loạt
    const shN = t.ss.getSheetByName('HD_NCC'); const nccCol = (k) => t.run('NCC_COL.' + k);
    const rows = shN.getDataRange().getValues();
    ds.forEach((h, i) => { const r = rows.findIndex(x => x[nccCol('ID_HD')] === h.idHD) + 1; shN.getRange(r, nccCol('TEN_CHU_RUNG') + 1).setValue('Ten Moi ' + i); t.run('ghiNhatKy_("Sửa tay trên Sheet", ' + J(h.idHD) + ', "")'); });
    // Ghi Draft lỗi tạm thời
    t.run('var __gocDraft = getOrCreateDraftBaoCaoSheet_; getOrCreateDraftBaoCaoSheet_ = function () { throw new Error("Service Spreadsheets failed"); }');
    const kqLoi = t.run('LAM_MOI_DRAFT_THEO_THAY_DOI_()');
    kiem('P0-C1 làm mới khi ghi Draft lỗi -> kết quả báo lỗi (không báo "Đã cập nhật")', kqLoi && (kqLoi.thanhCong === false || (kqLoi.loi && kqLoi.loi.length)), J(kqLoi));
    t.run('getOrCreateDraftBaoCaoSheet_ = __gocDraft');
    const kq2 = t.run('LAM_MOI_DRAFT_THEO_THAY_DOI_()');
    const ten = ds.map(h => (t.draftCua(h.idHD)[0] || [])[t.col('TEN_CHU_RUNG')]);
    kiem('P0-C2 lượt sau khi hết lỗi -> cập nhật đủ 12 HĐ bị lỡ (không mất thay đổi)', ten.every((x, i) => x === 'Ten Moi ' + i), J(ten) + ' ' + J(kq2));
    kiem('P0-C3 không sinh dòng Draft trùng ID_HD khi chạy lại', ds.every(h => t.draftCua(h.idHD).length === 1), J(ds.map(h => t.draftCua(h.idHD).length)));
    // Chạy lại nhiều lần cùng dữ liệu: kết quả giữ nguyên
    const truoc = J(t.draft().map(r => r.slice(0, 20)));
    t.run('LAM_MOI_DRAFT_THEO_THAY_DOI_()'); t.run('LAM_MOI_DRAFT_THEO_THAY_DOI_()');
    kiem('P0-C4 chạy lại nhiều lần -> Draft không đổi, không trùng', J(t.draft().map(r => r.slice(0, 20))) === truoc && t.draft().length === 12);
  });

  chay(function () {
    // Thay đổi ghi nhật ký sát mốc (lệnh ghi đến chậm vài giây so với giờ trên dòng nhật ký) không bị bỏ sót
    const t = moi();
    const A = t.tao('Le C', '049000000003', 'C1');
    t.run('LAM_MOI_DRAFT_THEO_THAY_DOI_()');
    const moc = new Date(t.m.props.get('DRAFT_MOOC_LAM_MOI_LAN_TRUOC')).getTime();
    const shN = t.ss.getSheetByName('HD_NCC'); const r = shN.getDataRange().getValues().findIndex(x => x[t.run('NCC_COL.ID_HD')] === A.idHD) + 1;
    shN.getRange(r, t.run('NCC_COL.TEN_CHU_RUNG') + 1).setValue('Le C sua');
    t.ss.getSheetByName('NhatKy_SuaDoi').appendRow([new Date(moc - 3000), 'x', 'Sửa tay trên Sheet', A.idHD, '']); // giờ nhật ký TRƯỚC mốc 3 giây
    t.run('LAM_MOI_DRAFT_THEO_THAY_DOI_()');
    kiem('P0-C5 nhật ký có giờ sát trước mốc (ghi đến chậm) vẫn được xử lý', (t.draftCua(A.idHD)[0] || [])[t.col('TEN_CHU_RUNG')] === 'Le C sua', J(t.draftCua(A.idHD)[0]));
  });

  chay(function () {
    // Hai lượt làm mới chạy gần như đồng thời: lượt thứ 2 không xử lý chồng, không ghi mốc
    const t = moi();
    const A = t.tao('Pham D', '049000000004', 'D1');
    t.run('LAM_MOI_DRAFT_THEO_THAY_DOI_()');
    const moc = t.m.props.get('DRAFT_MOOC_LAM_MOI_LAN_TRUOC');
    t.m.props.set('DRAFT_LAM_MOI_DANG_CHAY', String(Date.now())); // lượt khác đang chạy (vừa bắt đầu)
    const kq = t.run('LAM_MOI_DRAFT_THEO_THAY_DOI_()');
    kiem('P0-C6 đang có lượt làm mới khác -> trả "đang bận", không đổi mốc', kq && kq.dangBan === true && t.m.props.get('DRAFT_MOOC_LAM_MOI_LAN_TRUOC') === moc, J(kq));
    t.m.props.set('DRAFT_LAM_MOI_DANG_CHAY', String(Date.now() - 20 * 60 * 1000)); // lượt cũ bị ngắt quá 20 phút -> coi như hết hạn
    const kq2 = t.run('LAM_MOI_DRAFT_THEO_THAY_DOI_()');
    kiem('P0-C7 lượt cũ bị ngắt (quá hạn) -> lượt mới vẫn chạy được', kq2 && !kq2.dangBan, J(kq2));
    kiem('P0-C8 chạy xong -> nhả cờ đang chạy', !t.m.props.get('DRAFT_LAM_MOI_DANG_CHAY'), t.m.props.get('DRAFT_LAM_MOI_DANG_CHAY'));
    // HĐ bị xóa hẳn trong lúc chờ làm mới -> dòng Draft bị bỏ, không lỗi
    const shN = t.ss.getSheetByName('HD_NCC'); const r = shN.getDataRange().getValues().findIndex(x => x[t.run('NCC_COL.ID_HD')] === A.idHD) + 1;
    shN.deleteRow(r); t.run('ghiNhatKy_("Xóa tay", ' + J(A.idHD) + ', "")');
    const kq3 = t.run('LAM_MOI_DRAFT_THEO_THAY_DOI_()');
    kiem('P0-C9 HĐ đã bị xóa -> bỏ dòng Draft, lượt làm mới vẫn thành công', t.draftCua(A.idHD).length === 0 && kq3.thanhCong !== false, J(kq3));
  });

  // ======================= P0-D: chống tạo trùng khi gửi lại, cache bị xóa =======================
  chay(function () {
    const t = moi();
    const ma = 'HDtest' + Date.now().toString(36) + 'abcdef';
    const k1 = t.tao('Vo E', '049000000005', '', ma);
    t.m.cache.clear(); // CacheService bị Google loại bỏ trước hạn
    const k2 = t.tao('Vo E', '049000000005', '', ma); // trình duyệt gửi lại cùng mã thao tác (mạng chập chờn)
    const soDong = t.ss.getSheetByName('HD_NCC').getDataRange().getValues().slice(1).filter(r => r[t.run('NCC_COL.TEN_CHU_RUNG')] === 'Vo E').length;
    kiem('P0-D1 gửi lại cùng mã thao tác sau khi cache mất -> KHÔNG tạo hợp đồng thứ 2', soDong === 1 && k2.idHD === k1.idHD, 'số dòng=' + soDong + ' ' + J([k1.idHD, k2.idHD]));
    const k3 = t.tao('Vo E', '049000000005', '', ma + 'x');
    kiem('P0-D2 mã thao tác khác -> vẫn tạo được hợp đồng mới (không chặn nhầm)', k3.thanhCong && k3.idHD !== k1.idHD, J(k3));
  });
  // ======================= P0-E: mở hợp đồng theo số dòng cũ (danh sách tải trước khi HĐ phía trên bị xóa) =======================
  chay(function () {
    const t = moi();
    const X = t.tao('Bi Xoa', '049000000010', 'X1');
    const A = t.tao('Nguyen Mo', '049000000011', 'M1');
    const B = t.tao('Tran Khac', '049000000012', 'M2');
    const ds = t.run('layDanhSachHopDong_(1, 20, "", "")').items;
    const itA = ds.find(x => x.idHD === A.idHD);
    // Người khác xóa hợp đồng X (nằm phía trên) -> dòng của A dịch lên, dòng cũ của A giờ là B
    const shN = t.ss.getSheetByName('HD_NCC'); const r = shN.getDataRange().getValues().findIndex(x => x[t.run('NCC_COL.ID_HD')] === X.idHD) + 1;
    shN.deleteRow(r);
    const mo = t.run('MO_DRAFT_THEO_SO_DONG_(' + itA.soDong + ',' + J(A.idHD) + ')');
    kiem('P0-E1 mở HĐ theo dòng đã dịch + kèm ID_HD -> mở ĐÚNG hợp đồng đã bấm', mo && mo.du && mo.du.idHD === A.idHD, J(mo && mo.du && mo.du.idHD));
    const moCu = t.run('MO_DRAFT_THEO_SO_DONG_(' + itA.soDong + ')');
    kiem('P0-E2 gọi kiểu cũ (không kèm ID) vẫn chạy như trước (tương thích ngược)', moCu && moCu.du && !!moCu.du.idHD);
    shN.deleteRow(shN.getDataRange().getValues().findIndex(x => x[t.run('NCC_COL.ID_HD')] === A.idHD) + 1);
    const moMat = t.run('MO_DRAFT_THEO_SO_DONG_(' + itA.soDong + ',' + J(A.idHD) + ')');
    kiem('P0-E3 HĐ đã bị xóa hẳn -> không mở hợp đồng khác (trả rỗng)', moMat === null, J(moMat && moMat.du && moMat.du.idHD));
  });
} catch (e) { truot++; ketQua.push('LỖI ' + e.stack); }

console.log(ketQua.join('\n'));
console.log('\n' + dat + ' đạt, ' + truot + ' trượt');
process.exit(truot ? 1 : 0);
