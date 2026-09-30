// Presentation and query helpers only. All class metrics come from canonical views.
export const grades = [
  {name:'Freshman',label:'Freshmen'}, {name:'Sophomore',label:'Sophomores'},
  {name:'Junior',label:'Juniors'}, {name:'Senior',label:'Seniors'},
];
export const summaryFields = 'season,graduation_year,class_name,athlete_count,result_count,avg_season_best_seconds,median_season_best_seconds,top5_avg_seconds,sub_16,sub_17,sub_18,sub_19,sub_20,median_season_improvement_seconds,median_yoy_improvement_seconds,yoy_athlete_count';
export const athleteFields = 'season,graduation_year,class_name,athlete_id,full_name,season_best_seconds,first_5k_seconds,race_count,prior_season_best_seconds,season_improvement_seconds,yoy_improvement_seconds,class_sb_rank';
export const availableSeasons = rows => [...new Set(rows.map(r=>r.season))].sort((a,b)=>b-a);
export function seasonWindow(rows,latestSeason,period) {
  return rows.filter(r=>r.season<=latestSeason && (period==='all'||r.season>=latestSeason-Number(period)+1)).sort((a,b)=>b.season-a.season);
}
export function comparisonRows(rows,latestSeason,period,grade) {
  return seasonWindow(rows,latestSeason,period).filter(r=>r.class_name===grade);
}
// Input is the exact comparison universe used for the displayed rank.
// Prefer the selected row in a tie, otherwise the earliest tied benchmark.
export function historicalBest(rows,selected,key='top5_avg_seconds') {
  const eligible=rows.filter(r=>r[key]!=null && Number.isFinite(Number(r[key])));
  if(!eligible.length)return null;
  const minimum=Math.min(...eligible.map(r=>Number(r[key])));
  const best=eligible.filter(r=>Number(r[key])===minimum);
  return best.find(r=>r.season===selected?.season && r.graduation_year===selected?.graduation_year) || best.sort((a,b)=>a.season-b.season)[0];
}
export function competitionRank(row,rows,key,higherIsBetter=false) {
  if(row?.[key]==null || !Number.isFinite(Number(row[key])))return null;
  const eligible=rows.filter(r=>r.class_name===row.class_name && r[key]!=null && Number.isFinite(Number(r[key])));
  if(!eligible.some(r=>r.season===row.season&&r.graduation_year===row.graduation_year))return null;
  const value=Number(row[key]);
  const rank=1+eligible.filter(r=>higherIsBetter?Number(r[key])>value:Number(r[key])<value).length;
  return {rank,total:eligible.length,tied:eligible.filter(r=>Number(r[key])===value).length>1};
}
export function rankText(rank) {
  if(!rank)return '—';
  const n=rank.rank, tens=n%100;
  const suffix=tens>=11&&tens<=13?'th':({1:'st',2:'nd',3:'rd'}[n%10]||'th');
  return `${n}${suffix} of ${rank.total}${rank.tied?' (tie)':''}`;
}
// Explicit pagination and exact count avoid silently truncating historical data.
export async function readAll(makeQuery,signal) {
  const rows=[];
  while(true){
    const {data,error,count}=await makeQuery().range(rows.length,rows.length+199).abortSignal(signal);
    if(error)throw error;
    if(!Array.isArray(data))throw Error('Unexpected reporting-view response.');
    rows.push(...data);
    if(count!=null && rows.length>=count)return rows;
    if(!data.length){if(count!=null && rows.length<count)throw Error('Reporting data changed while loading. Please refresh.');return rows;}
  }
}
