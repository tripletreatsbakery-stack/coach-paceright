import React,{useEffect,useState} from 'react';
import {client} from '../client';
import {time} from '../format';
import {availableSeasons,seasonWindow,competitionRank,rankText,historicalBest,readAll} from '../class-data';
import Table from './DataTable';
import '../classes.css';

const fields='season,athlete_count,top5_athlete_count,top5_avg_seconds,top5_athletes';
const columns=[{key:'team_sb_rank',label:'Team SB rank',format:String},{key:'full_name',label:'Athlete',format:String},{key:'season_best_seconds',label:'Season best',format:time}];
export default function TeamAnalytics({refreshToken=0}) {
  const [report,setReport]=useState({status:'loading',rows:[],error:''});
  const [season,setSeason]=useState(null),[period,setPeriod]=useState('5'),[retry,setRetry]=useState(0);
  useEffect(()=>{
    const controller=new AbortController();setReport(r=>({...r,status:'loading'}));
    (async()=>{
      try {
        if(!client)throw Error('Supabase configuration is missing or invalid.');
        const rows=await readAll(()=>client.from('v_xc_team_season').select(fields,{count:'exact'}).order('season',{ascending:false}),controller.signal);
        if(controller.signal.aborted)return;
        setReport({status:'ready',rows,error:''});setSeason(s=>availableSeasons(rows).includes(s)?s:availableSeasons(rows)[0]??null);
      }catch(error){if(!controller.signal.aborted)setReport({status:'error',rows:[],error:`Unable to read v_xc_team_season. ${['42501','PGRST301','PGRST302'].includes(error.code)?'Access is restricted by existing database permissions. ':''}${error.message}`});}
    })();return()=>controller.abort();
  },[refreshToken,retry]);
  if(report.status==='loading')return <section className="panel" role="status">Loading historical team reports…</section>;
  if(report.status==='error')return <section className="panel" role="alert"><p>{report.error}</p><button onClick={()=>setRetry(n=>n+1)}>Retry team reports</button></section>;
  if(!report.rows.length)return <section className="panel empty">No team reporting rows are visible with the current database permissions.</section>;
  const seasons=availableSeasons(report.rows),row=report.rows.find(r=>r.season===season);
  const comparisons=seasonWindow(report.rows,season,period),best=historicalBest(comparisons,row);
  const start=period==='all'?Math.min(...seasons):Math.max(Math.min(...seasons),season-Number(period)+1);
  return <section className="class-analytics" aria-label="Historical Team Analytics">
    <div className="section-head class-intro"><div><h2>Team Analytics</h2><p className="muted">The front five across all classes, compared with previous Noblesville teams.</p></div><span className="history-badge">HISTORICAL ROSTERS INCLUDED</span></div>
    <div className="class-controls"><label>XC season<select value={season??''} onChange={e=>setSeason(Number(e.target.value))}>{seasons.map(s=><option key={s} value={s}>{s}</option>)}</select></label><fieldset><legend>Comparison period</legend>{[['5','5 Years'],['10','10 Years'],['all','All History']].map(([value,label])=><button key={value} aria-pressed={period===value} onClick={()=>setPeriod(value)}>{label}</button>)}</fieldset></div>
    <p className="class-window" role="status">Comparing {start}–{season}. All graduation classes; future seasons excluded.</p>
    {row&&<article className="class-card team-card" aria-label={`${season} team`}>
      <div className="class-heading"><span className="eyebrow">{season} TEAM</span></div>
      <div className="class-top5"><span className="rank-label">TOP-5 SEASON BEST AVERAGE</span><strong className="top5-rank" data-rank="top5_avg_seconds">{rankText(competitionRank(row,comparisons,'top5_avg_seconds'))}</strong><span className="top5-context">{period==='all'?'ALL-TIME':`${period}-YEAR`} WINDOW<small>As of {season}</small></span><span className="top5-time" data-field="top5_avg_seconds">{row.top5_avg_seconds==null?'—':time(row.top5_avg_seconds)}</span></div>
      <div className="historical-best"><span className="rank-label">HISTORICAL BEST</span>{best?<strong data-benchmark="value">{best.season} · {time(best.top5_avg_seconds)}{best.season===season?' · This team':''}</strong>:<small>No eligible five-athlete average in this window.</small>}</div>
      <div className="team-front-five"><h3>The front five · {season}</h3><p className="muted">Each athlete’s fastest recorded XC 5K this season.</p><Table key={season} rows={row.top5_athletes||[]} columns={columns} initialSort="team_sb_rank" filename={`team-front-five-${season}`} missingValue="—" copyLabel="Copy for Sheets" plainCopy/></div>
      {row.top5_athlete_count<5&&<p className="fine">Only {row.top5_athlete_count} athletes have qualifying results. A five-athlete average and historical rank are unavailable.</p>}
    </article>}
    <details className="panel class-methods"><summary>Reporting definitions & data notes</summary><p>The canonical team-season view supplies the average and five unique athletes. Each athlete contributes their fastest positive XC result from a 4.9–5.1 km meet, matching the class reporting distance band. Graduation year and current roster status do not restrict inclusion. These season bests may come from different meets.</p><p>Seasons with fewer than five qualifying athletes have no Top-5 average and are excluded from rank denominators. Lower averages rank first, using database precision before display rounding. Ties share a rank; tied benchmarks show the selected team when eligible, otherwise the earliest tied season. Every comparison ends at the selected season.</p></details>
  </section>;
}
