import React, {useEffect,useState} from 'react';
import {client} from '../client';
import {time,number,delta} from '../format';
import {grades,summaryFields,athleteFields,availableSeasons,comparisonRows,competitionRank,rankText,readAll,historicalBest} from '../class-data';
import Table from './DataTable';
import '../classes.css';

const missing='—';
const present=format=>value=>value==null?missing:format(value);
const duration=present(time), count=present(number), improvement=present(delta);
const column=(key,label,format=duration)=>({key,label,format});
const changeColumn=(key,label)=>({...column(key,label,improvement),copyFormat:present(v=>Number(v).toFixed(1))});
const detailColumns=[
  column('full_name','Athlete',String),column('season_best_seconds','Season best'),
  column('class_sb_rank','Class rank',count),column('first_5k_seconds','First 5K'),
  changeColumn('season_improvement_seconds','Season improvement (s)'),column('prior_season_best_seconds','Prior season best'),
  changeColumn('yoy_improvement_seconds','YOY improvement (s)'),column('race_count','Races',count),
];
const trendColumns=[column('season','Season',String),column('graduation_year','Graduation class',String),
  column('athlete_count','Athletes',count),column('result_count','Results',count),column('top5_avg_seconds','Top-5 avg'),
  column('median_season_best_seconds','Median SB'),...['17','18','19','20'].map(n=>column('sub_'+n,'Sub-'+n,count)),
  changeColumn('median_season_improvement_seconds','Median improvement (s)'),
  changeColumn('median_yoy_improvement_seconds','Median YOY (s)'),column('yoy_athlete_count','YOY n',count)];
const tableProps={missingValue:missing,copyLabel:'Copy for Sheets',plainCopy:true};
function reportingError(error,view) {
  return `Unable to read ${view}. ${['42501','PGRST301','PGRST302'].includes(error.code)?'Access is restricted by the existing database permissions. ':''}${error.message||'Please retry.'}`;
}
function ClassCard({row,grade,selected,comparisons,period,windowStart,latestSeason,onSelect}) {
  const outside=row&&!comparisons.some(r=>r.season===row.season);
  const rank=(key,higher=false)=>outside?'Outside comparison window':rankText(competitionRank(row,comparisons,key,higher));
  const best=historicalBest(comparisons,row);
  return <button className={'class-card'+(selected?' selected':'')} aria-pressed={selected} disabled={!row} onClick={onSelect} data-grade={grade.name}>
    <span className="class-heading"><span><span className="eyebrow">{grade.label}</span><strong>{row?`Class of ${row.graduation_year}`:'No reporting row'}</strong></span><span aria-hidden="true">↗</span></span>
    {!row?<span className="muted">No class data for this season.</span>:<>
      <span className="class-top5"><span className="rank-label">TOP-5 AVERAGE</span><strong className={outside?"top5-rank outside-window":"top5-rank"} data-rank="top5_avg_seconds">{rank('top5_avg_seconds')}</strong><span className="top5-context">{period==='all'?'ALL-TIME AT THIS GRADE':`${period}-YEAR WINDOW AT THIS GRADE`}<small>Compared with {period==='all'?'all':'the most recent '+period+' seasons of'} Noblesville {grade.name} classes, {windowStart}–{latestSeason}.</small></span><span className="top5-time" data-field="top5_avg_seconds">{duration(row.top5_avg_seconds)}</span><small>Average of the fastest season bests</small></span>
      <span className="historical-best"><span className="rank-label">HISTORICAL BEST</span>{best?<><strong data-benchmark="value">{best.season===row.season&&best.graduation_year===row.graduation_year?'This class':`Class of ${best.graduation_year}`} · {duration(best.top5_avg_seconds)}</strong><small data-benchmark="season">{grade.label} · {best.season}</small></>:<small>No eligible Top-5 average in this window.</small>}</span>
      <span className="class-count"><span className="rank-label">CLASS DEPTH</span><span className="class-count-value"><span data-field="athlete_count">{count(row.athlete_count)}</span> athletes <span className="muted">· <span data-field="result_count">{count(row.result_count)}</span> results</span></span></span>
      <span className="class-depth">{['17','18','19','20'].map(n=><span key={n}><small>SUB-{n}</small><strong data-field={'sub_'+n}>{count(row['sub_'+n])}</strong><small>athletes</small></span>)}</span>
      <span className="class-support"><span><span className="rank-label">MEDIAN SEASON BEST</span><strong data-field="median_season_best_seconds">{duration(row.median_season_best_seconds)}</strong><small><span data-rank="median_season_best_seconds">{rank('median_season_best_seconds')}</span> at this grade</small></span><span><span className="rank-label">SEASON IMPROVEMENT</span><strong data-field="median_season_improvement_seconds">{improvement(row.median_season_improvement_seconds)}</strong><small>Median · <span data-rank="median_season_improvement_seconds">{rank('median_season_improvement_seconds',true)}</span></small></span></span>
      <span className="class-yoy-line"><span>Median YOY improvement</span><strong data-field="median_yoy_improvement_seconds">{improvement(row.median_yoy_improvement_seconds)}</strong><small data-field="yoy_athlete_count">{count(row.yoy_athlete_count)} athletes with comparison</small></span>
      <span className="class-card-foot">{row.athlete_count<5?`Front average uses ${row.athlete_count} available athletes.`:'Front average uses the fastest five season bests.'}<span>{selected?'Viewing class ↓':'View class →'}</span></span>
    </>}
  </button>;
}
export default function ClassAnalytics({refreshToken=0}) {
  const [summary,setSummary]=useState({status:'loading',rows:[],error:''});
  const [season,setSeason]=useState(null),[period,setPeriod]=useState('5'),[grade,setGrade]=useState('Freshman');
  const [retry,setRetry]=useState(0),[detailRetry,setDetailRetry]=useState(0);
  const [detail,setDetail]=useState({key:'',status:'loading',rows:[],error:''});
  useEffect(()=>{
    const controller=new AbortController();setSummary(s=>({...s,status:'loading',error:''}));
    (async()=>{
      try{
        if(!client)throw Error('Supabase configuration is missing or invalid.');
        const rows=await readAll(()=>client.from('v_xc_class_summary').select(summaryFields,{count:'exact'}).order('season',{ascending:false}).order('graduation_year'),controller.signal);
        if(controller.signal.aborted)return;
        setSummary({status:'ready',rows,error:''});setSeason(s=>availableSeasons(rows).includes(s)?s:availableSeasons(rows)[0]??null);
      }catch(error){if(!controller.signal.aborted)setSummary({status:'error',rows:[],error:reportingError(error,'v_xc_class_summary')});}
    })();return()=>controller.abort();
  },[refreshToken,retry]);
  const selected=summary.rows.find(r=>r.season===season&&r.class_name===grade);
  const selectionKey=`${season}/${grade}/${selected?.graduation_year}`;
  useEffect(()=>{
    if(summary.status!=='ready'||!selected)return;
    const controller=new AbortController();setDetail({key:selectionKey,status:'loading',rows:[],error:''});
    (async()=>{
      try{
        const rows=await readAll(()=>client.from('v_xc_class_athlete').select(athleteFields,{count:'exact'}).eq('season',season).eq('graduation_year',selected.graduation_year).eq('class_name',grade).order('class_sb_rank').order('season_best_seconds').order('athlete_id'),controller.signal);
        if(!controller.signal.aborted)setDetail({key:selectionKey,status:'ready',rows,error:''});
      }catch(error){if(!controller.signal.aborted)setDetail({key:selectionKey,status:'error',rows:[],error:reportingError(error,'v_xc_class_athlete')});}
    })();return()=>controller.abort();
  },[season,grade,selectionKey,summary.status,refreshToken,detailRetry]);
  if(summary.status==='loading')return <section className="panel" role="status">Loading historical class reports…</section>;
  if(summary.status==='error')return <section className="panel" role="alert"><p>{summary.error}</p><button onClick={()=>setRetry(n=>n+1)}>Retry class reports</button></section>;
  if(!summary.rows.length)return <section className="panel empty">No class reporting rows are visible with the current database permissions.</section>;
  const seasons=availableSeasons(summary.rows),latestSeason=seasons[0],trend=comparisonRows(summary.rows,latestSeason,period,grade);
  const availableStart=Math.min(...seasons),windowStart=period==='all'?availableStart:latestSeason-Number(period)+1;
  return <section className="class-analytics" aria-label="Historical Class Analytics">
    <div className="section-head class-intro"><div><h2>Class Analytics</h2><p className="muted">Front-five performance, whole-class performance, depth and development—kept distinct.</p></div><span className="history-badge">HISTORICAL ROSTERS INCLUDED</span></div>
    <div className="class-controls"><label>XC season<select value={season??''} onChange={e=>setSeason(Number(e.target.value))}>{seasons.map(s=><option key={s} value={s}>{s}</option>)}</select></label><fieldset><legend>Comparison period</legend>{[['5','5 Years'],['10','10 Years'],['all','All History']].map(([value,label])=><button key={value} aria-pressed={period===value} onClick={()=>setPeriod(value)}>{label}</button>)}</fieldset></div>
    <p className="class-window" role="status">Comparison window: {windowStart}–{latestSeason}. Each class is compared only with the same grade. Selecting a season changes the class being evaluated, not the comparison window.</p>
    <div className="class-grid">{grades.map(g=>{
      const row=summary.rows.find(r=>r.season===season&&r.class_name===g.name);
      return <ClassCard key={g.name} row={row} grade={g} selected={grade===g.name} comparisons={comparisonRows(summary.rows,latestSeason,period,g.name)} period={period} windowStart={windowStart} latestSeason={latestSeason} onSelect={()=>setGrade(g.name)}/>;
    })}</div>
    <p className="fine">Ranks use the database values before display rounding. Lower times rank first; higher athlete counts, depth counts and positive improvement rank first. Ties share a rank and skip following places. Each metric excludes missing values from its denominator. Small classes remain included.</p>
    <section className="class-detail" aria-label="Selected class athletes"><div className="section-head"><div><span className="eyebrow">CLASS DETAIL · {season}</span><h2>{grades.find(g=>g.name===grade).label}{selected?` · Class of ${selected.graduation_year}`:''}</h2></div><span className="muted">{selected?`${count(selected.athlete_count)} athletes · ${count(selected.result_count)} results`:''}</span></div>
      {!selected?<div className="panel empty">No reporting row for this grade and season.</div>:detail.key!==selectionKey||detail.status==='loading'?<div className="panel" role="status">Loading class athletes…</div>:detail.status==='error'?<div className="panel" role="alert"><p>{detail.error}</p><button onClick={()=>setDetailRetry(n=>n+1)}>Retry class athletes</button></div>:<><Table {...tableProps} key={selectionKey} rows={detail.rows} columns={detailColumns} initialSort="class_sb_rank" filename={`class-${season}-${grade.toLowerCase()}`}/>{detail.rows.length!==selected.athlete_count&&<p role="status" className="fine">The detail view returned {detail.rows.length} rows; the summary reports {selected.athlete_count}. Reporting data or permissions may have changed. Refresh to check.</p>}</>}
      <p className="fine">Positive improvement means faster; negative means slower. — means no recorded comparison, not zero. Class rank comes directly from the athlete view. Graduated and inactive athletes are included.</p>
    </section>
    <section className="class-trend" aria-label="Historical class trend"><div className="section-head"><div><span className="eyebrow">LIKE-FOR-LIKE HISTORY</span><h2>{grades.find(g=>g.name===grade).label} across seasons</h2></div><span className="muted">{trend.length} reported classes · {windowStart}–{latestSeason}</span></div><Table {...tableProps} key={`trend/${grade}`} rows={trend} columns={trendColumns} initialSort="season" initialDirection={-1} filename={`class-history-${grade.toLowerCase()}-${season}-${period}`}/></section>
    <details className="panel class-methods"><summary>Reporting definitions & data notes</summary><p>All athlete counts, race counts, season bests, averages, medians, threshold counts, improvement values and athlete class ranks are supplied by the canonical Supabase reporting views. This page does not recalculate those metrics or apply the active-roster filter.</p><p>The views include recorded XC meets from 4.9 to 5.1 km and normal high-school graduation-year/season combinations. “Top-5” uses up to five available athletes. Each threshold counts athletes whose season best is strictly faster than that time; threshold counts overlap.</p><p>YOY compares with the athlete’s previous recorded season. Freshmen commonly have no prior comparison. An in-progress selected season is compared with recorded historical seasons, which may be complete; race counts show the available sample.</p><p>Historical ranks are a display ordering of the supplied summary values, not a combined class score. “All History” starts at the earliest available reporting season and ends at the latest database season. Five- and ten-year windows also end at the latest database season. Selected classes outside those windows retain their measurements but have no comparative rank. Missing reporting seasons are not filled in.</p></details>
  </section>;
}
