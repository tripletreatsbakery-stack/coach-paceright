import test from 'node:test';
import assert from 'node:assert/strict';
import {availableSeasons,comparisonRows,competitionRank,rankText,readAll} from '../src/class-data.js';
import {sheetsTsv} from '../src/format.js';
const rows=Array.from({length:18},(_,i)=>({season:2010+i,graduation_year:2014+i,class_name:'Freshman',top5_avg_seconds:1000+i}));
test('windows include selected season, exclude future, and compare the same grade',()=>{
  const mixed=[...rows,{season:2026,class_name:'Senior'}];
  assert.deepEqual(comparisonRows(mixed,2026,'5','Freshman').map(r=>r.season),[2026,2025,2024,2023,2022]);
  assert.equal(comparisonRows(mixed,2026,'10','Freshman').length,10);
  assert.equal(comparisonRows(mixed,2026,'10','Freshman').at(-1).season,2017);
  assert.equal(comparisonRows(mixed,2026,'all','Freshman').length,17);
  assert.equal(comparisonRows(mixed,2010,'5','Freshman').length,1);
  assert.equal(availableSeasons(mixed)[0],2027);
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
