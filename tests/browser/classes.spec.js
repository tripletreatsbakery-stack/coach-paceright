import {test,expect} from '@playwright/test';
const names=['Freshman','Sophomore','Junior','Senior'];
const seasons=[2010,...Array.from({length:11},(_,i)=>2020+i)];
const summaries=seasons.flatMap(season=>names.map((class_name,i)=>({season,graduation_year:season+4-i,class_name,athlete_count:season===2010?2:6,result_count:31,avg_season_best_seconds:1123.45,median_season_best_seconds:1200+(season-2020)*10,top5_avg_seconds:1000+(season-2020)*10,sub_17:1,sub_18:2,sub_19:3,sub_20:4,median_season_improvement_seconds:34.7,median_yoy_improvement_seconds:i?12.5:null,yoy_athlete_count:i?5:0})));
async function fixture(page){
  await page.route('**/rpc/coach_public_dashboard',r=>r.fulfill({json:{season:2099,as_of:'2099-01-01',roster:[],races:[],meets:[],groups:[],physiology:[]}}));
  await page.route('**/rest/v1/v_xc_class_summary?*',r=>r.fulfill({json:summaries,headers:{'access-control-expose-headers':'content-range','content-range':`0-${summaries.length-1}/${summaries.length}`}}));
  await page.route('**/rest/v1/v_xc_class_athlete?*',r=>{
    const query=new URL(r.request().url()).searchParams;
    expect(query.has('status')).toBe(false);expect(query.get('select')).toContain('yoy_improvement_seconds');
    const season=Number(query.get('season').slice(3)),grade=query.get('class_name').slice(3);
    const rows=[{season,class_name:grade,graduation_year:season+4-names.indexOf(grade),athlete_id:'old-runner',full_name:`Historical ${grade} ${season}`,class_sb_rank:1,season_best_seconds:900,first_5k_seconds:950,season_improvement_seconds:50,prior_season_best_seconds:null,yoy_improvement_seconds:null,race_count:4}];
    return r.fulfill({json:rows,headers:{'access-control-expose-headers':'content-range','content-range':'0-0/1'}});
  });
}
test('canonical cards, fixed windows, historical drilldown, plain copy and CSV',async({page},info)=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));await fixture(page);
  await page.addInitScript(()=>{window.copiedText='';Object.defineProperty(navigator,'clipboard',{value:{writeText:async text=>{window.copiedText=text;}}});});
  await page.goto('/#analytics');await page.getByRole('link',{name:'Class Analytics',exact:true}).click();
  await expect(page.getByLabel('XC season')).toHaveValue('2030');await expect(page.locator('.class-card')).toHaveCount(4);
  expect(await page.locator('.class-card').evaluateAll(cards=>cards.map(c=>c.dataset.grade))).toEqual(names);
  const card=page.locator('[data-grade="Sophomore"]');await expect(card.locator('[data-field="top5_avg_seconds"]')).toHaveText('18:20.0');
  await expect(card.locator('[data-rank="top5_avg_seconds"]')).toHaveText('5th of 5');await expect(card.locator('[data-field="median_season_improvement_seconds"]')).toHaveText('+34.7 s');
  await expect(card.locator('[data-benchmark="value"]')).toHaveText('Class of 2029 · 17:40.0');
  await expect(card.locator('[data-benchmark="season"]')).toHaveText('Sophomores · 2026');
  await page.getByRole('button',{name:'10 Years',exact:true}).click();await expect(card.locator('[data-rank="top5_avg_seconds"]')).toHaveText('10th of 10');
  await page.getByRole('button',{name:'All History',exact:true}).click();await expect(card.locator('[data-rank="top5_avg_seconds"]')).toHaveText('12th of 12');
  await expect(card.locator('[data-benchmark="value"]')).toHaveText('Class of 2013 · 15:00.0');
  await card.click();await expect(page.getByRole('cell',{name:'Historical Sophomore 2030',exact:true})).toBeVisible();
  await page.getByLabel('XC season').selectOption('2026');await page.getByRole('button',{name:'5 Years',exact:true}).click();
  await expect(page.locator('.class-window')).toContainText('2026–2030');await expect(card).toContainText('Class of 2029');
  await expect(card.locator('[data-benchmark="season"]')).toHaveText('Sophomores · 2026');
  await expect(page.getByRole('cell',{name:'Historical Sophomore 2026',exact:true})).toBeVisible();
  const trend=page.getByRole('region',{name:'Historical class trend'});await expect(trend.locator('tbody tr')).toHaveCount(5);await expect(trend.locator('tbody tr').first().locator('td').first()).toHaveText('2030');
  await expect(page.getByRole('region',{name:'Selected class athletes'}).getByRole('cell',{name:'—',exact:true})).toHaveCount(2);
  const detail=page.getByRole('region',{name:'Selected class athletes'});await detail.getByRole('button',{name:'Copy for Sheets'}).click();
  const copied=await page.evaluate(()=>window.copiedText);expect(copied.split('\r\n')[0].split('\t')).toHaveLength(8);expect(copied).toContain('Historical Sophomore 2026\t15:00.0\t1\t15:50.0\t50.0\t—\t—\t4');
  const download=page.waitForEvent('download');await detail.getByRole('button',{name:'Export CSV'}).click();expect((await download).suggestedFilename()).toBe('class-2026-sophomore.csv');
  await page.getByLabel('XC season').selectOption('2010');await expect(page.getByRole('cell',{name:'Historical Sophomore 2010',exact:true})).toBeVisible();await expect(card).toContainText('Front average uses 2 available athletes.');
  await expect(card.locator('[data-benchmark="value"]')).toHaveText('Class of 2029 · 17:40.0');
  await expect(card.locator('[data-rank="top5_avg_seconds"]')).toHaveText('Outside comparison window');
  await page.getByRole('button',{name:'All History',exact:true}).click();
  await expect(card.locator('[data-rank="top5_avg_seconds"]')).toHaveText('1st of 12');
  await expect(card.locator('[data-benchmark="value"]')).toHaveText('This class \u00b7 15:00.0');
  await page.getByRole('button',{name:'5 Years',exact:true}).click();
  await page.getByLabel('XC season').selectOption('2030');await expect(card.locator('[data-rank="top5_avg_seconds"]')).toHaveText('5th of 5');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();await page.screenshot({path:info.outputPath('class-analytics.png'),fullPage:true});expect(errors).toEqual([]);
});
test('summary denial and detail denial remain explicit without falling back to other data',async({page})=>{
  await fixture(page);await page.route('**/rest/v1/v_xc_class_summary?*',r=>r.fulfill({status:403,json:{code:'42501',message:'permission denied'}}));
  await page.goto('/#analytics/classes');await expect(page.getByRole('alert')).toContainText('v_xc_class_summary');await expect(page.locator('.class-card')).toHaveCount(0);
  await page.route('**/rest/v1/v_xc_class_summary?*',r=>r.fulfill({json:summaries,headers:{'access-control-expose-headers':'content-range','content-range':`0-${summaries.length-1}/${summaries.length}`}}));
  await page.route('**/rest/v1/v_xc_class_athlete?*',r=>r.fulfill({status:403,json:{code:'42501',message:'permission denied'}}));
  await page.getByRole('button',{name:'Retry class reports'}).click();await expect(page.locator('.class-card')).toHaveCount(4);await expect(page.getByRole('alert')).toContainText('v_xc_class_athlete');await expect(page.getByRole('region',{name:'Historical class trend'}).locator('tbody tr')).toHaveCount(5);
});
test('an absent grade stays unavailable and a missing metric has no invented rank',async({page})=>{
  await fixture(page);const partial=summaries.filter(r=>!(r.season===2030&&r.class_name==='Senior')).map(r=>r.season===2030&&r.class_name==='Freshman'?{...r,top5_avg_seconds:null}:r);
  await page.route('**/rest/v1/v_xc_class_summary?*',r=>r.fulfill({json:partial,headers:{'access-control-expose-headers':'content-range','content-range':`0-${partial.length-1}/${partial.length}`}}));
  await page.goto('/#analytics/classes');await expect(page.locator('[data-grade="Senior"]')).toBeDisabled();await expect(page.locator('[data-grade="Freshman"] [data-rank="top5_avg_seconds"]')).toHaveText('—');
});
