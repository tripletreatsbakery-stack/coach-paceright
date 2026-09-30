import React, {useState} from 'react';
import {sortRows, delimited, sheetsTsv, unavailable} from '../format';

export default function Table({rows,columns,initialSort,initialDirection=1,filename,onAthlete,missingValue=unavailable,copyLabel='Copy table',plainCopy=false}) {
  const [sort,setSort] = useState({key:initialSort || columns[0].key,direction:initialDirection});
  const [notice,setNotice] = useState('');
  const sorted = sortRows(rows,sort.key,sort.direction);
  function download() { const url=URL.createObjectURL(new Blob(['\uFEFF'+delimited(columns,sorted)],{type:'text/csv;charset=utf-8'})); const a=document.createElement('a'); a.href=url; a.download=filename+'.csv'; a.click(); setTimeout(()=>URL.revokeObjectURL(url),1000); }
  async function copy() { try {await navigator.clipboard.writeText(plainCopy?sheetsTsv(columns,sorted):delimited(columns,sorted,'\t'));setNotice('Table copied.');} catch {setNotice('Clipboard unavailable. Use CSV export.');} }
  return <section className="table-panel"><div className="table-tools"><span>{rows.length} {rows.length===1?'row':'rows'}</span><div><button onClick={copy}>{copyLabel}</button><button onClick={download}>↓ Export CSV</button></div><span role="status">{notice}</span></div><div className="table-scroll" tabIndex="0" aria-label="Scrollable results table"><table><thead><tr>{columns.map(c=><th key={c.key} aria-sort={sort.key===c.key?(sort.direction===1?'ascending':'descending'):'none'}><button onClick={()=>setSort({key:c.key,direction:sort.key===c.key?-sort.direction:1})}>{c.label} <span>{sort.key===c.key?(sort.direction===1?'↑':'↓'):'↕'}</span></button></th>)}</tr></thead><tbody>{sorted.map((r,i)=><tr key={r.id||r.athlete_id||i}>{columns.map(c=><td key={c.key}>{c.key==='full_name'&&onAthlete?<button className="athlete-link" onClick={()=>onAthlete(r.athlete_id)}>{r.full_name}<span>↗</span></button>:<span className={r[c.key]==null?'muted':c.key.endsWith('_pr')&&r[c.key]===true?'badge':''}>{r[c.key]==null?missingValue:c.format(r[c.key])}</span>}</td>)}</tr>)}</tbody></table>{!rows.length&&<div className="empty">No qualifying results available.</div>}</div></section>;
}
