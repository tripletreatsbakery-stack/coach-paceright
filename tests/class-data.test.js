import test from 'node:test';
import assert from 'node:assert/strict';
import {availableSeasons,comparisonRows,competitionRank,rankText,readAll,historicalBest,seasonWindow} from '../src/class-data.js';
import {sheetsTsv} from '../src/format.js';
const rows=Array.from({length:18},(_,i)=>({season:2010+i,graduation_year:2014+i,class_name:'Freshman',top5_avg_seconds:1000+i}));
test('fixed latest-season windows retain same-grade comparisons',()=>{
  const mixed=[...rows,{season:2027,class_name:'Senior',top5_avg_seconds:1}];
  const latest=availableSeasons(mixed)[0];
  assert.equal(latest,2027);
  assert.deepEqual(comparisonRows(mixed,latest,'5','Freshman').map(r=>r.season),[2027,2026,2025,2024,2023]);
  assert.equal(comparisonRows(mixed,latest,'10','Freshman').at(-1).season,2018);
  assert.equal(comparisonRows(mixed,latest,'all','Freshman').length,18);
  assert.equal(historicalBest(comparisonRows(mixed,latest,'5','Freshman'),rows[0]).season,2023);
  assert.equal(competitionRank(rows[0],comparisonRows(mixed,latest,'5','Freshman'),'top5_avg_seconds'),null);
});
test('benchmarks exclude missing values and prefer an eligible self in ties',()=>{
  const history=[{season:2020,top5_avg_seconds:950},{season:2021,top5_avg_seconds:950},{season:2026,top5_avg_seconds:null}];
  assert.equal(historicalBest(seasonWindow(history,2026,'all'),history[1]),history[1]);
  assert.equal(historicalBest(seasonWindow(history,2026,'5'),history[1]),null);
});
test('competition ranks preserve ties, missing values and full precision',()=>{
  const values=[1000.01,1000.02,1000.02,1001,null].map((v,i)=>({season:2020+i,graduation_year:2024+i,class_name:'Junior',value:v}));
  assert.equal(rankText(competitionRank(values[1],values,'value')),'2nd of 4 (tie)');
  assert.equal(rankText(competitionRank(values[3],values,'value')),'4th of 4');
  assert.equal(rankText(competitionRank(values[4],values,'value')),'—');
  assert.equal(rankText(competitionRank(values[0],values,'value',true)),'4th of 4');
  assert.equal(rankText({rank:11,total:17}),'11th of 17');
  assert.equal(rankText({rank:22,total:30}),'22nd of 30');
  assert.equal(competitionRank(values[0],[],'value'),null);
});
test('historical selections rank against later seasons within the fixed window',()=>{
  const metrics=[['top5_avg_seconds',false],['median_season_best_seconds',false],['median_season_improvement_seconds',true]];
  const history=Array.from({length:17},(_,i)=>2010+i).flatMap(season=>['Freshman','Sophomore','Junior','Senior'].map((class_name,index)=>({season,graduation_year:season+4-index,class_name,...Object.fromEntries(metrics.map(([key,higher])=>[key,higher?season-2000:4000-season]))})));
  for(const [season,grade,period,start,total,rank] of [[2023,'Sophomore','all',2010,17,4],[2020,'Senior','5',2022,5,null],[2020,'Senior','10',2017,10,7]]){
    const selected=history.find(r=>r.season===season&&r.class_name===grade),window=comparisonRows(history,2026,period,grade);
    assert.equal(window.length,total);assert.equal(window.at(-1).season,start);
    assert.ok(window.every(r=>r.class_name===grade));
    assert.equal(historicalBest(window,selected).season,2026);
    for(const [metric,higher] of metrics)assert.deepEqual(competitionRank(selected,window,metric,higher),rank==null?null:{rank,total,tied:false});
  }
});
test('pagination respects server caps and reports incomplete results',async()=>{
  const calls=[];const signal=new AbortController().signal;
  const query=()=>({range(from,to){calls.push([from,to]);return{abortSignal:async()=>({data:[1,2,3].slice(from,from+2),count:3,error:null})};}});
  assert.deepEqual(await readAll(query,signal),[1,2,3]);assert.deepEqual(calls,[[0,199],[2,201]]);
  await assert.rejects(readAll(()=>({range(){return{abortSignal:async()=>({data:[],count:2})};}}),signal),/changed while loading/);
});
test('Sheets TSV is plain, retains negative numeric changes and blocks formulas',()=>{
  const text=sheetsTsv([{key:'name',label:'Athlete'},{key:'change',label:'Improvement (s)'}],[{name:'A "Name"',change:-4.5},{name:'=IMPORTXML("bad")',change:null},{name:'Line\tBreak\nName',change:0}]);
  assert.ok(text.startsWith('Athlete\tImprovement (s)\r\nA "Name"\t-4.5'));
  assert.ok(text.includes("'=IMPORTXML"));assert.ok(text.includes('\t—'));assert.ok(text.endsWith('Line Break Name\t0'));
});
