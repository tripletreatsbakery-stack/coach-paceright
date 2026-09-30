export const unavailable = 'Unavailable';
export function time(value) {
  if (value == null || !Number.isFinite(Number(value))) return unavailable;
  const ticks = Math.round(Math.abs(Number(value)) * 10);
  return `${value < 0 ? '−' : ''}${String(Math.floor(ticks / 600)).padStart(2, '0')}:${((ticks % 600) / 10).toFixed(1).padStart(4, '0')}`;
}
export const number = v => v == null ? unavailable : Number(v).toLocaleString('en-US', {maximumFractionDigits: 2});
export const delta = v => v == null ? unavailable : `${v > 0 ? '+' : ''}${Number(v).toFixed(1)} s`;
export function sortRows(rows, key, direction = 1) {
  return [...rows].sort((a, b) => a[key] == null ? (b[key] == null ? 0 : 1) : b[key] == null ? -1 : direction * (typeof a[key] === 'number' ? a[key] - b[key] : String(a[key]).localeCompare(String(b[key]))));
}
export function delimited(columns, rows, separator = ',') {
  const escape = value => { let s = String(value ?? unavailable); if (/^[=+@\-\t\r]/.test(s)) s = "'" + s; return '"' + s.replaceAll('"', '""') + '"'; };
  return [columns.map(c => c.label), ...rows.map(r => columns.map(c => c.format ? c.format(r[c.key]) : r[c.key]))].map(r => r.map(escape).join(separator)).join('\r\n');
}
// Unquoted TSV for pasting into Sheets. Keep signed numeric values numeric;
// neutralize formula-like text, and remove embedded cell/row separators.
export function sheetsTsv(columns, rows) {
  const cell=value=>{
    let text=String(value??'—').replace(/[\t\r\n]+/g,' ');
    if(/^\s*[=+@-]/.test(text)&&!/^[-+]?\d+(\.\d+)?$/.test(text))text="'"+text;
    return text;
  };
  return [columns.map(c=>c.label),...rows.map(r=>columns.map(c=>{
    const format=c.copyFormat||c.format;
    return format?format(r[c.key]):r[c.key];
  }))].map(row=>row.map(cell).join('\t')).join('\r\n');
}
