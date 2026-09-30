import {test,expect} from '@playwright/test';
const rows=[2010,2018,2022,2026,2027].map((season,i)=>({season,athlete_count:9,top5_athlete_count:5,top5_avg_seconds:[900,950,980,1000,800][i],top5_athletes:Array.from({length:5},(_,j)=>({athlete_id:`${season}-${j}`,full_name:`Runner ${season}-${j+1}`,team_sb_rank:j+1,season_best_seconds:[900,950,980,1000,800][i]-2+j}))}));
async function fixture(page){
  await page.route('**/rpc/coach_public_dashboard',r=>r.fulfill({json:{season:2026,roster:[],races:[],meets:[],groups:[],physiology:[]}}));
  await page.route('**/rest/v1/v_xc_team_season?*',r=>r.fulfill({json:rows,headers:{'access-control-expose-headers':'content-range','content-range':`0-4/5`}}));
}
test('top-level team navigation, canonical athletes, window ranks and benchmarks',async({page},info)=>{
  await fixture(page);await page.goto('/#analytics');
  const nav=page.getByRole('navigation',{name:'Analytics sections'});
  await expect(nav.getByRole('link')).toHaveText(['Current season','Class Analytics','Team Analytics']);
  await nav.getByRole('link',{name:'Team Analytics',exact:true}).click();
  await page.getByLabel('XC season').selectOption('2026');
  const rank=page.locator('[data-rank="top5_avg_seconds"]'),best=page.locator('[data-benchmark="value"]');
  await expect(rank).toHaveText('2nd of 2');await expect(best).toHaveText('2027 · 13:20.0');
  await expect(page.locator('[data-field="top5_avg_seconds"]')).toHaveText('16:40.0');
  await expect(page.locator('tbody tr')).toHaveCount(5);
  await expect(page.locator('tbody tr').first()).toHaveText('1Runner 2026-116:38.0');
  await page.getByRole('button',{name:'10 Years',exact:true}).click();await expect(rank).toHaveText('4th of 4');await expect(best).toHaveText('2027 · 13:20.0');
  await page.getByRole('button',{name:'All History',exact:true}).click();await expect(rank).toHaveText('5th of 5');await expect(best).toHaveText('2027 · 13:20.0');
  await page.getByLabel('XC season').selectOption('2018');await expect(rank).toHaveText('3rd of 5');await expect(best).toHaveText('2027 · 13:20.0');
  await page.getByRole('button',{name:'5 Years',exact:true}).click();await expect(rank).toHaveText('Outside comparison window');await expect(best).toHaveText('2027 · 13:20.0');
  await expect(page.getByRole('cell',{name:'Runner 2018-1',exact:true})).toBeVisible();
  await page.reload();await expect(nav.getByRole('link',{name:'Team Analytics'})).toHaveAttribute('aria-current','page');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();
  await page.screenshot({path:info.outputPath('team-analytics.png'),fullPage:true});
});
test('team restriction and insufficient athletes do not invent an average',async({page})=>{
  await fixture(page);await page.route('**/rest/v1/v_xc_team_season?*',r=>r.fulfill({status:403,json:{code:'42501',message:'permission denied'}}));
  await page.goto('/#analytics/team');await expect(page.getByRole('alert')).toContainText('Access is restricted');
  await page.route('**/rest/v1/v_xc_team_season?*',r=>r.fulfill({json:[{...rows[0],top5_athlete_count:3,top5_avg_seconds:null,top5_athletes:rows[0].top5_athletes.slice(0,3)}],headers:{'access-control-expose-headers':'content-range','content-range':'0-0/1'}}));
  await page.getByRole('button',{name:'Retry team reports'}).click();
  await expect(page.locator('[data-rank="top5_avg_seconds"]')).toHaveText('—');
  await expect(page.locator('[data-field="top5_avg_seconds"]')).toHaveText('—');
  await expect(page.locator('.team-card')).toContainText('Only 3 athletes');
});
