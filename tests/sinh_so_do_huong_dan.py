# Sinh lại sơ đồ mục 10 của 13_HuongDan.html (SVG + dữ liệu bảng thông tin) từ candidate.json của Archify.
# Chạy: python3 tests/sinh_so_do_huong_dan.py  (sửa mô tả từng ô trong danh sách NUT; vị trí / nhãn mũi tên trong DUONG)
import json, re, html
REPO='/home/user/HDMB_HAK'
cand=json.load(open(REPO+'/.archify/dataflow-hdmb-luong-du-lieu-20261024-081228/candidate.json'))
CN={n['id']:n for n in cand['nodes']}
CF={f['id']:f for f in cand['flows']}
REV=cand['meta']['repository']['revision']
E=lambda x: html.escape(str(x), quote=True)
C=[80,253,427,600]; W=120; H=52
yb=lambda b: 78+100*b
LOAI={'ldl-fe':'Trình duyệt','ldl-ext':'File ngoài','ldl-sec':'Cổng phân quyền','ldl-be':'Xử lý trên máy chủ','ldl-db':'Sheet lưu dữ liệu'}
BANG=['Nguồn dữ liệu','Tiếp nhận','Ghi chính thức','Tổng hợp báo cáo','Đọc & hiển thị']
NUT=[('trinhDuyet','ldl-fe',0,0,'Trình duyệt','Nhập liệu · tự lưu',
  'Trang Nhập liệu trên máy anh/chị. Mỗi thay đổi trên form tự lưu vào bản nháp: mỗi bản nháp chỉ 1 lượt lưu chạy cùng lúc, thay đổi chờ được gộp, lỗi thì tự thử lại. Lưu chính thức gửi kèm bản mới nhất.'),
 ('fileNgoai','ldl-ext',3,0,'DNTT + Phiếu cân','Sheet ngoài',
  'File Google Sheet ngoài do kế toán nhập: DNTT_GK_DN_CT (khối lượng thanh toán cột M, số CT cột L) và PhieuCan_DN (ngày cân). Hệ thống chỉ đọc, không sửa.'),
 ('congApi','ldl-sec',0,1,'Cổng api()','phiên + phân quyền',
  'Mọi lời gọi từ trình duyệt đều đi qua api(): kiểm tra phiên đăng nhập và vai trò (Chỉ xem / Nhập liệu / Quản trị) trước khi chạy, ghi sổ hiệu năng khi chậm hoặc lỗi.'),
 ('draftHopDong','ldl-db',1,1,'Draft_HopDong','bản nháp JSON',
  'Sheet Draft_HopDong — mỗi bản nháp 1 dòng JSON. Bản cũ của cùng tab về muộn bị bỏ qua (số thứ tự từng tab), không bao giờ ghi JSON hỏng. Bảng gốc chưa bị đụng tới.'),
 ('dongBoTT','ldl-be',3,1,'Đồng bộ thanh toán','trigger 30 phút',
  'Trigger 30 phút: chỉ đọc DNTT khi số dòng hoặc giờ sửa file thay đổi; chỉ tính lại hợp đồng có số liệu đổi (24 giờ tính lại toàn bộ 1 lần). Đọc lỗi thì giữ số liệu cũ, không ghi mốc.'),
 ('luuChinhThuc','ldl-be',0,2,'Lưu chính thức','nháp → bảng gốc',
  'Ghi bản nháp mới nhất, rồi ghi HD_NCC / HD_RUNG / HD_STK / HD_GPS. Mỗi lần ghi tìm lại dòng theo ID dưới khóa (không ghi nhầm khi dòng bị dịch). Lỗi giữa chừng: bấm lại chỉ làm nốt phần còn thiếu, không tạo trùng.'),
 ('bangGoc','ldl-db',1,2,'Bảng gốc HD_*','NCC·RUNG·STK·GPS',
  '4 sheet dữ liệu chính trong file chính: hợp đồng, lô rừng, số tài khoản, điểm GPS. CCCD, SĐT, Số TK, MST định dạng chữ để giữ số 0 đầu.'),
 ('cacheBaoCao','ldl-db',3,2,'Cache_BaoCao','KL thực hiện DNTT',
  'Sheet Cache_BaoCao (file báo cáo): khối lượng / giá trị thực hiện theo Số HĐ lấy từ DNTT và bản đã áp dụng (dnttDaApDung). Chỉ lưu khi đọc DNTT thành công.'),
 ('nhatKy','ldl-db',0,3,'NhatKy_SuaDoi','1 dòng / thao tác',
  'Sheet NhatKy_SuaDoi: mỗi thao tác 1 dòng (thời gian, người, hành động, ID_HD). Nút 🔄 Làm mới đọc các dòng mới từ lần xử lý trước để biết hợp đồng nào cần cập nhật báo cáo.'),
 ('capNhatDraft','ldl-be',2,3,'Cập nhật Draft','1 HĐ / hàng loạt',
  'Tính lại dòng báo cáo của hợp đồng (KL / giá trị dự kiến – thực hiện – còn lại, hồ sơ, GPS, ảnh) rồi chỉ ghi các dòng thay đổi, định vị theo ID_HD.'),
 ('draftBaoCao','ldl-db',3,3,'Draft_BaoCao','1 dòng / hợp đồng',
  'Sheet Draft_BaoCaoHopDong (file báo cáo): mỗi hợp đồng 1 dòng đã tổng hợp sẵn — báo cáo mở nhanh vì không phải tính lại. Cột CAP_NHAT_LUC ghi lúc cập nhật.'),
 ('traCuu','ldl-be',0,4,'Tra cứu','chỉ mục nhớ 5 phút',
  'Tìm theo Số HĐ, tên (có / không dấu), CCCD, SĐT, Số TK, địa chỉ rừng. Chỉ mục dựng từ các cột cần của bảng gốc, nhớ 5 phút, tự dựng lại khi có hợp đồng thay đổi.'),
 ('khachHang','ldl-be',1,4,'Khách hàng','danh sách gọn',
  'Danh sách gọn mọi khách hàng (CCCD, tên, số HĐ, địa chỉ) cho gợi ý ở Nhập liệu / Thêm-Sửa HĐ; chọn khách thì lấy đủ thông tin theo CCCD để tự điền.'),
 ('banDo','ldl-be',2,4,'Bản đồ GPS','lô + tọa độ',
  'Lô rừng và điểm GPS vẽ lên bản đồ. Dữ liệu nhớ chia mảnh để mở lại nhanh.'),
 ('tongQuan','ldl-be',3,4,'Tổng quan · Báo cáo','đọc Draft báo cáo',
  'Chỉ số và bảng hợp đồng đọc từ Draft báo cáo; nhớ 5 phút theo dấu vân tay cột CAP_NHAT_LUC — hệ thống ghi Draft là thấy ngay.'),
]
NI={n[0]:n for n in NUT}
# (id flow archify, kiểu nét, path, nhãn (x,y,anchor), chữ nhãn)
DUONG=[
 ('goiApi','bm','M80,104 V150',(88,116,'start'),'google.script.run'),
 ('luuNhap','chinh','M140,178 H191',(166,170,'middle'),'tự lưu'),
 ('goiLuu','chinh','M80,204 V250',(88,216,'start'),'Lưu chính thức'),
 ('docNhap','','M220,204 V230 H110 V250',(180,243,'middle'),'bản nháp'),
 ('ghiBang','chinh','M140,278 H191',(166,270,'middle'),'ghi ID'),
 ('ghiNhatKy','','M80,304 V350',(88,316,'start'),'nhật ký'),
 ('docBang','','M313,278 H427 V350',(372,271,'middle'),'đọc dòng'),
 ('lamMoi','lich','M140,378 H365',(318,371,'middle'),'HĐ vừa đổi'),
 ('docDntt','lich','M600,104 V150',(608,116,'start'),'KL cột M'),
 ('ghiCache','lich','M600,204 V250',(608,216,'start'),'dnttDaApDung'),
 ('klThucHien','','M590,304 V325 H455 V350',(525,319,'middle'),'KL thực hiện'),
 ('ghiDraft','chinh','M487,378 H538',(513,370,'middle'),'ghi dòng'),
 ('docTongQuan','','M600,404 V450',(608,416,'start'),'vân tay'),
 ('docTraCuu','','M225,304 V420 H80 V450',None,''),
 ('docKhach','','M253,304 V450',None,''),
 ('docBanDo','','M281,304 V420 H427 V450',None,''),
]
o=['<svg viewBox="0 0 720 530" role="group" aria-labelledby="ldlTieuDe"><title id="ldlTieuDe">Sơ đồ luồng dữ liệu HDMB — bấm vào 1 ô để xem thông tin</title>',
 '<defs><marker id="ldlMui" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="context-stroke"/></marker></defs>',
 '<rect class="ldl-nen-bam" x="0" y="0" width="720" height="530" fill="transparent"/>']
for b,t in enumerate(BANG):
    top=20+100*b
    o.append(f'<rect class="ldl-cot-nen" x="6" y="{top+2}" width="708" height="96" rx="10"/><text class="ldl-cot-chu" x="704" y="{top+16}" text-anchor="end">{E(t)}</text>')
for i,(fid,cls,d,_,_) in enumerate(DUONG):
    f=CF[fid]; c=(' '+cls) if cls else ''
    if fid in ('docTraCuu','docKhach','docBanDo'):
        x=d.split(',')[0][1:]
        o.append(f'<path class="ldl-cau" d="M{x},370 V386"/>')
    o.append(f'<path class="ldl-l{c}" data-tu="{f["from"]}" data-den="{f["to"]}" d="{d}" marker-end="url(#ldlMui)"/>')
    o.append(f'<path class="ldl-tin{c}" data-tu="{f["from"]}" data-den="{f["to"]}" d="{d}" style="animation-delay:-{((i+1)*0.37)%1.6:.2f}s"/>')
for fid,cls,d,lab,txt in DUONG:
    if not lab: continue
    f=CF[fid]; lx,ly,a=lab
    o.append(f'<text class="ldl-nhan" data-tu="{f["from"]}" data-den="{f["to"]}" x="{lx}" y="{ly}" text-anchor="{a}">{E(txt)}</text>')
o.append('<text class="ldl-nhan" data-tu="bangGoc" data-den="traCuu khachHang banDo" x="345" y="414" text-anchor="middle">đọc đúng cột cần</text>')
for nid,cls,c,b,t,ph,_ in NUT:
    x=C[c]; y=yb(b)
    o.append(f'<g class="ldl-nut {cls}" data-id="{nid}" tabindex="0" role="button" aria-label="{E(t)} — xem thông tin"><rect x="{x-W//2}" y="{y-H//2}" width="{W}" height="{H}" rx="9"/><text class="t" x="{x}" y="{y-4}" text-anchor="middle">{E(t)}</text><text class="p" x="{x}" y="{y+13}" text-anchor="middle">{E(ph)}</text></g>')
o.append('</svg>')
# dữ liệu cho bảng thông tin
du={'rev':REV,'repo':'https://github.com/saoluucvhak-pixel/HDMB_HAK','nut':{},'duong':[]}
for nid,cls,c,b,t,ph,mota in NUT:
    an=CN[nid]
    du['nut'][nid]={'ten':t,'phu':ph,'ma':an['label'],'loai':LOAI[cls],'cls':cls,'gd':BANG[b],'so':b+1,'tag':an.get('tag',''),'mota':mota,
      'nguon':[{'tep':s['path'],'tu':s.get('line'),'den':s.get('end_line'),'nhan':s.get('label','')} for s in an.get('sources',[])]}
for fid,cls,d,lab,txt in DUONG:
    f=CF[fid]; du['duong'].append({'tu':f['from'],'den':f['to'],'nhan':f['label'],'phu':f.get('classification','')})
svg=''.join(o)
p=REPO+'/13_HuongDan.html'; s=open(p).read()
start=s.index('<button type="button" class="ldl-nut-chay"')
end=s.index('</svg></div>',start)+len('</svg></div>')
khoi=('<div class="ldl-cong-cu"><button type="button" class="ldl-nut-chay" id="ldlNutChay" onclick="ldlBatTatTinHieu_(this)">⏸ Dừng tín hiệu</button>'
 '<button type="button" class="ldl-nut-chay" id="ldlNutGiaoDien" onclick="ldlDoiGiaoDien_(this)" aria-pressed="false">🌙 Nền tối</button></div>'
 '<div class="ldl-vung"><div class="ldl-khung" id="ldlKhung">'+svg+'</div>'
 '<aside class="ldl-ho-chieu" id="ldlHoChieu" hidden aria-live="polite"></aside></div>'
 '<script>var LDL_DU_LIEU_='+json.dumps(du,ensure_ascii=False)+';</script>')
s=s[:start]+khoi+s[end:]
open(p,'w').write(s)
print('ok', len(khoi))
