// Read-only live validation. Run with node --env-file=.env.local scripts/validate-classes.mjs [site-url] [SQL-ranks.json]
import assert from 'node:assert/strict';
import {readFileSync,mkdirSync} from 'node:fs';
import {createClient} from '@supabase/supabase-js';
import {chromium,expect} from '@playwright/test';
import {grades,summaryFields,athleteFields,availableSeasons,comparisonRows,competitionRank,rankText,readAll} from '../src/class-data.js';
import {time,number,delta} from '../src/format.js';
const site=process.argv[2]||'http://127.0.0.1:4173';
const db=createClient(process.env.VITE_SUPABASE_URL,process.env.VITE_SUPABASE_PUBLISHABLE_KEY,{auth:{persistSession:false}});
const summaries=await readAll(()=>db.from('v_xc_class_summary').select(summaryFields,{count:'exact'}).order('season',{ascending:false}).order('graduation_year'));
const seasons=availableSeasons(summaries),latest=seasons[0];
const latestRows=summaries.filter(r=>r.season===latest);assert.equal(latestRows.length,4);
const sqlRanks=process.argv[3]?JSON.parse(readFileSync(process.argv[3],'utf8')):null;
const expected=v=>v==null?'—':v;
const browser=await chromium.launch();mkdirSync('test-results',{recursive:true});
let cardChecks=0,rankChecks=0,athleteChecks=0;
try{
 const page=await browser.newPage({viewport:{width:1440,height:1100}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.context().grantPermissions(['clipboard-read','clipboard-write'],{origin:new URL(site).origin});
 await page.goto(site+'/#analytics/classes');await expect(page.getByLabel('XC season')).toHaveValue(String(latest));
 for(const row of latestRows){
  const card=page.locator(`[data-grade="${row.class_name}"]`);
  for(const field of ['athlete_count','result_count','sub_16','sub_17','sub_18','sub_19']){await expect(card.locator(`[data-field="${field}"]`)).toHaveText(expected(row[field]==null?null:number(row[field])));cardChecks++;}
  for(const field of ['top5_avg_seconds','median_season_best_seconds']){await expect(card.locator(`[data-field="${field}"]`)).toHaveText(expected(row[field]==null?null:time(row[field])));cardChecks++;}
  for(const field of ['median_season_improvement_seconds','median_yoy_improvement_seconds']){await expect(card.locator(`[data-field="${field}"]`)).toHaveText(expected(row[field]==null?null:delta(row[field])));cardChecks++;}
 }
 for(const [period,label] of [['5','5 Years'],['10','10 Years'],['all','All History']]){
  await page.getByRole('button',{name:label,exact:true}).click();
  for(const row of latestRows)for(const [key,sqlKey] of [['top5_avg_seconds','top5'],['median_season_best_seconds','median']]){
   const rank=competitionRank(row,comparisonRows(summaries,latest,period,row.class_name),key);
   if(sqlRanks){const sql=sqlRanks.find(r=>r.label===period&&r.class_name===row.class_name&&r.season===latest);assert.ok(sql);assert.equal(rank.rank,sql[sqlKey+'_rank']);assert.equal(rank.total,sql[sqlKey+'_total']);}
   await expect(page.locator(`[data-grade="${row.class_name}"] [data-rank="${key}"]`)).toHaveText(rankText(rank));rankChecks++;
  }
 }
 for(const grade of grades){
  const canonical=await readAll(()=>db.from('v_xc_class_athlete').select(athleteFields,{count:'exact'}).eq('season',latest).eq('class_name',grade.name).order('class_sb_rank').order('season_best_seconds').order('athlete_id'));
  await page.locator(`[data-grade="${grade.name}"]`).click();const detail=page.getByRole('region',{name:'Selected class athletes'});
  await expect(detail.locator('tbody tr')).toHaveCount(canonical.length);
  for(let i=0;i<Math.min(3,canonical.length);i++){
   const r=canonical[i];const values=[r.full_name,time(r.season_best_seconds),number(r.class_sb_rank),time(r.first_5k_seconds),delta(r.season_improvement_seconds),r.prior_season_best_seconds==null?'—':time(r.prior_season_best_seconds),r.yoy_improvement_seconds==null?'—':delta(r.yoy_improvement_seconds),number(r.race_count)];
   await expect(detail.locator('tbody tr').nth(i).locator('td')).toHaveText(values);athleteChecks++;
  }
 }
 await page.getByRole('button',{name:'5 Years',exact:true}).click();
 await page.screenshot({path:'test-results/live-classes-desktop.png',fullPage:true});
 await page.getByRole('region',{name:'Selected class athletes'}).getByRole('button',{name:'Copy for Sheets'}).click();
 const clipboard=await page.evaluate(()=>navigator.clipboard.readText());assert.equal(clipboard.split('\r\n')[0].split('\t').length,8);assert.ok(!clipboard.startsWith('"'));
 const oldest=seasons.at(-1);await page.getByLabel('XC season').selectOption(String(oldest));await expect(page.locator('.class-window')).toContainText(`${latest-4}–${latest}`);
 const historical=await readAll(()=>db.from('v_xc_class_athlete').select(athleteFields,{count:'exact'}).eq('season',oldest).eq('class_name','Senior').order('class_sb_rank').order('season_best_seconds').order('athlete_id'));
 await expect(page.getByRole('region',{name:'Selected class athletes'}).locator('tbody tr')).toHaveCount(historical.length);
 if(historical.length)await expect(page.getByRole('region',{name:'Selected class athletes'}).locator('tbody tr').first().locator('td').first()).toHaveText(historical[0].full_name);
 for(const width of [1024,390]){
  await page.setViewportSize({width,height:1100});await page.getByLabel('XC season').selectOption(String(latest));await expect(page.locator('[data-grade="Senior"]')).toContainText(`Class of ${latestRows.find(r=>r.class_name==='Senior').graduation_year}`);
  await expect(page.getByRole('region',{name:'Selected class athletes'}).locator('tbody tr')).toHaveCount(latestRows.find(r=>r.class_name==='Senior').athlete_count);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:`test-results/live-classes-${width}.png`,fullPage:true});
 }
 assert.deepEqual(errors,[]);
 console.log(JSON.stringify({site,latest,earliest:oldest,summaryRows:summaries.length,cardChecks,rankChecks,independentSqlRanks:!!sqlRanks,athleteSpotChecks:athleteChecks,historicalAthletes:historical.length,clipboard:'passed',desktopTabletMobile:'passed',browserErrors:errors.length},null,2));
}finally{await browser.close();}
