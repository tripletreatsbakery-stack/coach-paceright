// Read-only browser/database verification. Expected values independently checked by SQL.
// node --env-file=.env.local scripts/validate-team-analytics.mjs [site-url]
import assert from 'node:assert/strict';
import {mkdirSync} from 'node:fs';
import {createClient} from '@supabase/supabase-js';
import {chromium,expect} from '@playwright/test';
import {time} from '../src/format.js';
const site=process.argv[2]||'http://127.0.0.1:4173';
const db=createClient(process.env.VITE_SUPABASE_URL,process.env.VITE_SUPABASE_PUBLISHABLE_KEY,{auth:{persistSession:false}});
const {data:teams,error}=await db.from('v_xc_team_season').select('*').order('season');assert.ifError(error);assert.equal(teams.length,17);
const selected=teams.find(r=>r.season===2026);
assert.equal(selected.top5_avg_seconds,952.98);
assert.deepEqual(selected.top5_athletes.map(a=>[a.full_name,a.season_best_seconds]),[['Banner Barnes',923.2],['Isaiah Vohs',926],['Jack Rush',965.6],['Matt Huseman',971],['Gavin Flynn',979.1]]);
for(const row of teams){
  assert.equal(new Set(row.top5_athletes.map(a=>a.athlete_id)).size,row.top5_athlete_count);
  if(row.top5_athlete_count===5)assert.ok(Math.abs(row.top5_athletes.reduce((sum,a)=>sum+a.season_best_seconds,0)/5-row.top5_avg_seconds)<1e-9);
}
const browser=await chromium.launch();mkdirSync('test-results',{recursive:true});
try{
 const page=await browser.newPage({viewport:{width:1440,height:1100}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(site+'/#analytics/classes');await expect(page.getByLabel('XC season')).toHaveValue('2026');
 const card=page.locator('[data-grade="Sophomore"]');
 const classCases=[['5 Years','2nd of 5','Class of 2025 · 16:30.5','Sophomores · 2022'],['10 Years','3rd of 10','Class of 2021 · 16:29.8','Sophomores · 2018'],['All History','3rd of 17','Class of 2021 · 16:29.8','Sophomores · 2018']];
 for(const [period,rank,best,season] of classCases){
   await page.getByRole('button',{name:period,exact:true}).click();
   await expect(card.locator('[data-rank="top5_avg_seconds"]')).toHaveText(rank);
   await expect(card.locator('[data-field="top5_avg_seconds"]')).toHaveText('16:46.6');
   await expect(card.locator('[data-benchmark="value"]')).toHaveText(best);
   await expect(card.locator('[data-benchmark="season"]')).toHaveText(season);
 }
 await card.screenshot({path:'test-results/live-class-benchmark.png'});
 await page.getByLabel('XC season').selectOption('2022');
 await expect(card.locator('[data-rank="top5_avg_seconds"]')).toHaveText('2nd of 17');
 await page.getByLabel('XC season').selectOption('2020');
 await expect(card.locator('[data-rank="top5_avg_seconds"]')).toHaveText('10th of 17');
 await expect(card.locator('[data-field="top5_avg_seconds"]')).toHaveText('17:24.6');
 await expect(card.locator('[data-benchmark="season"]')).toHaveText('Sophomores · 2018');
 await page.getByRole('button',{name:'5 Years',exact:true}).click();await expect(card.locator('[data-rank="top5_avg_seconds"]')).toHaveText('Outside comparison window');
 const nav=page.getByRole('navigation',{name:'Analytics sections'});
 await expect(nav.getByRole('link')).toHaveText(['Current season','Class Analytics','Team Analytics']);
 await nav.getByRole('link',{name:'Team Analytics',exact:true}).click();await expect(page.getByLabel('XC season')).toHaveValue('2026');
 for(const [period,rank] of [['5 Years','5th of 5'],['10 Years','6th of 10'],['All History','6th of 17']]){
   await page.getByRole('button',{name:period,exact:true}).click();
   await expect(page.locator('[data-rank="top5_avg_seconds"]')).toHaveText(rank);
   await expect(page.locator('[data-field="top5_avg_seconds"]')).toHaveText('15:53.0');
   await expect(page.locator('[data-benchmark="value"]')).toHaveText('2025 · 15:19.8');
 }
 await expect(page.locator('tbody tr')).toHaveCount(5);
 for(const athlete of selected.top5_athletes){
   const tr=page.locator('tbody tr').filter({hasText:athlete.full_name});await expect(tr).toContainText(time(athlete.season_best_seconds));
 }
 for(const width of [1440,1024,390]){
   await page.setViewportSize({width,height:1100});
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
   await expect(nav.getByRole('link',{name:'Team Analytics',exact:true})).toBeVisible();
   await page.screenshot({path:`test-results/live-team-${width}.png`,fullPage:true});
 }
 await page.getByLabel('XC season').selectOption('2020');
 await expect(page.locator('[data-rank="top5_avg_seconds"]')).toHaveText('5th of 17');
 await expect(page.locator('[data-benchmark="value"]')).toHaveText('2025 · 15:19.8');
 await page.getByRole('button',{name:'5 Years',exact:true}).click();
 await expect(page.locator('[data-rank="top5_avg_seconds"]')).toHaveText('Outside comparison window');
 await expect(page.locator('[data-benchmark="value"]')).toHaveText('2025 · 15:19.8');
 assert.deepEqual(errors,[]);
 console.log(JSON.stringify({site,anonymousTeamSeasons:teams.length,classCases,team2026:selected,history2020:'passed',desktopTabletMobile:'passed',browserErrors:errors.length},null,2));
}finally{await browser.close();}
