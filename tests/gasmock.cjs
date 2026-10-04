// Bộ giả lập Apps Script tối thiểu: nạp TẤT CẢ .gs vào 1 context như Apps Script (SpreadsheetApp trong bộ nhớ,
// tự ép chuỗi số -> số trừ ô định dạng '@', đánh dấu công thức '=...', đếm lệnh getValues để đo hiệu năng).
// Đuôi .cjs: không bị công cụ đồng bộ GitHub <-> Apps Script đẩy lên dự án GAS.
const fs = require('fs'), path = require('path'), vm = require('vm'), crypto = require('crypto');

function taoMoiTruong(thuMuc, opts) {
  opts = opts || {};
  const EMAIL = opts.email || 'owner@test.vn';
  let khoaLong = 0, khoaMax = 0;
  const demDoc = { n: 0, o: 0 };
  const demGhiRangeList = { n: 0 };

  class Sheet {
    constructor(ss, name) { this.ss = ss; this.name = name; this.data = []; this.fmt = {}; this.id = Math.floor(Math.random() * 1e9); }
    getName() { return this.name; }
    getSheetId() { return this.id; }
    getLastRow() { for (let r = this.data.length; r >= 1; r--) if ((this.data[r - 1] || []).some(v => v !== '' && v !== null && v !== undefined)) return r; return 0; }
    getLastColumn() { let m = 0; this.data.forEach(row => { for (let c = row.length; c >= 1; c--) if (row[c - 1] !== '' && row[c - 1] !== undefined) { m = Math.max(m, c); break; } }); return m; }
    _get(r, c) { const row = this.data[r - 1]; const v = row ? row[c - 1] : undefined; return v === undefined || v === null ? '' : v; }
    _set(r, c, v) {
      while (this.data.length < r) this.data.push([]);
      const row = this.data[r - 1]; while (row.length < c) row.push('');
      if (v === undefined || v === null) v = '';
      if (typeof v === 'string' && this.fmt[r + ',' + c] !== '@' && /^-?\d+(\.\d+)?$/.test(v.trim()) && v.trim() !== '') v = Number(v); // Sheets tự ép số -> mất số 0 đầu
      if (typeof v === 'string' && v.charAt(0) === "'") v = v.slice(1);
      else if (typeof v === 'string' && /^[=+@]/.test(v)) v = '#CONG_THUC#' + v; // Sheets hiểu là công thức
      row[c - 1] = v instanceof Date ? new Date(v.getTime()) : v;
    }
    getMaxColumns() { return Math.max(this.soCotToiDa || 0, this.getLastColumn()); }
    insertColumnsAfter(sau, n) { this.soCotToiDa = Math.max(this.getMaxColumns(), sau + n); this.daThemCot = (this.daThemCot || 0) + n; return this; }
    getRange(r, c, nr, nc) { return new Range(this, r, c, nr || 1, nc || 1); }
    getDataRange() { return new Range(this, 1, 1, Math.max(1, this.getLastRow()), Math.max(1, this.getLastColumn())); }
    appendRow(arr) { const r = this.getLastRow() + 1; arr.forEach((v, i) => this._set(r, i + 1, v)); return this; }
    deleteRows(r, n) { for (let i = 0; i < n; i++) this.deleteRow(r); return this; }
    deleteRow(r) { this.data.splice(r - 1, 1); const nf = {}; Object.keys(this.fmt).forEach(k => { const [rr, cc] = k.split(',').map(Number); if (rr < r) nf[k] = this.fmt[k]; else if (rr > r) nf[(rr - 1) + ',' + cc] = this.fmt[k]; }); this.fmt = nf; }
    setFrozenRows() { return this; } autoResizeColumns() { return this; } setColumnWidth() { return this; }
    // RangeList (nhiều ô rời nhau, 1 lệnh): nhận "A5", "AD12", "B2:C3"; đếm 1 lượt ghi qua demGhiRangeList
    getRangeList(a1s) {
      const sh = this, cot = (t) => t.split('').reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0);
      const ranges = a1s.map(a => { const [a1, a2] = a.split(':'); const p = s => { const m = /^([A-Z]+)(\d+)$/.exec(s); return [Number(m[2]), cot(m[1])]; };
        const [r1, c1] = p(a1), [r2, c2] = a2 ? p(a2) : [r1, c1]; return new Range(sh, r1, c1, r2 - r1 + 1, c2 - c1 + 1); });
      return { getRanges: () => ranges, setNumberFormat(f) { demGhiRangeList.n++; ranges.forEach(r => { for (let i = 0; i < r.nr; i++) for (let j = 0; j < r.nc; j++) sh.fmt[(r.r + i) + ',' + (r.c + j)] = f; }); return this; } };
    }
  }
  class Range {
    constructor(sh, r, c, nr, nc) { Object.assign(this, { sh, r, c, nr, nc }); }
    getValues() { demDoc.n++; demDoc.o += this.nr * this.nc; demDoc.theo = demDoc.theo || {}; const kk = this.sh.name + (this.nc === 1 ? "(1 cột)" : "(" + this.nc + " cột)"); demDoc.theo[kk] = (demDoc.theo[kk] || 0) + 1; const o = []; for (let i = 0; i < this.nr; i++) { const row = []; for (let j = 0; j < this.nc; j++) { const v = this.sh._get(this.r + i, this.c + j); row.push(v instanceof Date ? new Date(v.getTime()) : v); } o.push(row); } return o; }
    getDisplayValues() { return this.getValues().map(r => r.map(v => String(v))); }
    getValue() { return this.getValues()[0][0]; }
    setValues(v) { if (v.length !== this.nr || v.some(r => r.length !== this.nc)) throw new Error('setValues: kích thước không khớp ' + v.length + 'x' + (v[0] || []).length + ' vs ' + this.nr + 'x' + this.nc); v.forEach((row, i) => row.forEach((x, j) => this.sh._set(this.r + i, this.c + j, x))); return this; }
    setValue(v) { for (let i = 0; i < this.nr; i++) for (let j = 0; j < this.nc; j++) this.sh._set(this.r + i, this.c + j, v); return this; }
    setNumberFormat(f) { for (let i = 0; i < this.nr; i++) for (let j = 0; j < this.nc; j++) this.sh.fmt[(this.r + i) + ',' + (this.c + j)] = f; return this; }
    clearContent() { for (let i = 0; i < this.nr; i++) for (let j = 0; j < this.nc; j++) { const row = this.sh.data[this.r + i - 1]; if (row) row[this.c + j - 1] = ''; } return this; }
    setFontWeight() { return this; } setBackground() { return this; } setBackgrounds() { return this; } setFontColor() { return this; }
    getRow() { return this.r; } getNumRows() { return this.nr; } getSheet() { return this.sh; }
    createTextFinder(t) { const self = this; let ec = false, mc = true; return { matchEntireCell(b) { ec = b; return this; }, matchCase(b) { mc = b; return this; },
      findNext() { const vals = self.getValues(); for (let i = 0; i < vals.length; i++) for (let j = 0; j < vals[i].length; j++) { let a = String(vals[i][j]), b = String(t); if (!mc) { a = a.toLowerCase(); b = b.toLowerCase(); } if (ec ? a === b : a.indexOf(b) !== -1) return new Range(self.sh, self.r + i, self.c + j, 1, 1); } return null; } }; }
  }
  class Spreadsheet {
    constructor(id) { this.id = id; this.sheets = {}; }
    getSheetByName(n) { return this.sheets[n] || null; }
    insertSheet(n) { return (this.sheets[n] = new Sheet(this, n)); }
    getSheets() { return Object.values(this.sheets); }
    getSpreadsheetTimeZone() { return 'Asia/Ho_Chi_Minh'; }
    getId() { return this.id; } getUrl() { return 'https://docs.google.com/spreadsheets/d/' + this.id; } getName() { return this.id; }
    deleteSheet(sh) { delete this.sheets[sh.name]; }
  }
  const ssChinh = new Spreadsheet('MAIN'), ssBaoCao = new Spreadsheet('REPORT');
  const cache = new Map(), props = new Map();
  const fmtDate = (d, tz, f) => {
    const p = new Intl.DateTimeFormat('en-GB', { timeZone: tz === 'GMT+7' ? 'Asia/Ho_Chi_Minh' : tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).formatToParts(new Date(d));
    const g = t => p.find(x => x.type === t).value;
    return f.replace('yyyy', g('year')).replace('MM', g('month')).replace('dd', g('day')).replace('HH', g('hour') === '24' ? '00' : g('hour')).replace('mm', g('minute')).replace('ss', g('second'));
  };
  const lock = () => ({
    waitLock() { khoaLong++; khoaMax = Math.max(khoaMax, khoaLong); }, tryLock() { this.waitLock(); return true; },
    releaseLock() { khoaLong = Math.max(0, khoaLong - 1); }, hasLock() { return khoaLong > 0; }
  });
  const nhatKyLog = [];
  const ctx = {
    console: { log() {}, info() {}, warn() {}, error: (...a) => nhatKyLog.push(a) },
    Logger: { log() {} },
    SpreadsheetApp: {
      getActiveSpreadsheet: () => ssChinh,
      openById: (id) => { if (id === 'REPORT') return ssBaoCao; throw new Error('openById mock: ' + id); },
      openByUrl: (u) => { if (u.indexOf('1G_SUfAY') !== -1) return ssBaoCao; throw new Error('openByUrl mock: không có quyền ' + u); },
      create: (n) => new Spreadsheet(n), flush() {}, getUi: () => { throw new Error('no ui'); }
    },
    CacheService: { getDocumentCache: () => null, getScriptCache: () => ({ get: k => cache.has(k) ? cache.get(k) : null, put: (k, v) => cache.set(k, String(v)), remove: k => cache.delete(k),
      getAll: ks => { const o = {}; ks.forEach(k => { if (cache.has(k)) o[k] = cache.get(k); }); return o; }, putAll: o => Object.keys(o).forEach(k => cache.set(k, o[k])) }) },
    PropertiesService: { getScriptProperties: () => ({ getProperty: k => props.has(k) ? props.get(k) : null, setProperty: (k, v) => props.set(k, String(v)), deleteProperty: k => props.delete(k) }) },
    LockService: { getScriptLock: lock },
    Session: { getActiveUser: () => ({ getEmail: () => EMAIL }), getEffectiveUser: () => ({ getEmail: () => 'owner@test.vn' }), getScriptTimeZone: () => 'Asia/Ho_Chi_Minh' },
    Utilities: {
      formatDate: fmtDate, getUuid: () => crypto.randomUUID(),
      parseDate: (s, tz, f) => new Date(s + 'T00:00:00+07:00'),
      base64Encode: b => Buffer.from(b).toString('base64'), base64Decode: s => [...Buffer.from(s, 'base64')],
      base64EncodeWebSafe: b => Buffer.from(b).toString('base64url'), base64DecodeWebSafe: s => [...Buffer.from(s, 'base64url')],
      computeHmacSha256Signature: (d, k) => [...crypto.createHmac('sha256', k).update(d).digest()],
      newBlob: (b, m, n) => ({ getBytes: () => b, getContentType: () => m, getDataAsString: () => Buffer.from(b).toString() }),
      Charset: { UTF_8: 'utf8' }
    },
    DriveApp: { getFileById: () => { throw new Error('Drive mock'); }, getFilesByName: () => ({ hasNext: () => false }), getFoldersByName: () => ({ hasNext: () => false }), getFolderById: () => { throw new Error('Drive mock'); }, createFolder: () => { throw new Error('Drive mock'); } },
    ScriptApp: { getProjectTriggers: () => [], getService: () => ({ getUrl: () => 'https://script.google.com/macros/s/X/exec' }), getOAuthToken: () => 't' },
    HtmlService: {}, UrlFetchApp: { fetch: () => { throw new Error('net mock'); } }, ContentService: {}, Maps: {}, Drive: {}
  };
  vm.createContext(ctx);
  const files = fs.readdirSync(thuMuc).filter(f => f.endsWith('.gs')).sort();
  const src = files.map(f => fs.readFileSync(path.join(thuMuc, f), 'utf8')).join('\n;\n');
  vm.runInContext(src, ctx, { filename: 'all.gs' });
  return { demDoc, demGhiRangeList, ctx, ssChinh, ssBaoCao, cache, props, lockInfo: () => ({ dangGiu: khoaLong, max: khoaMax }), resetLockMax: () => { khoaMax = 0; } };
}
module.exports = { taoMoiTruong };
