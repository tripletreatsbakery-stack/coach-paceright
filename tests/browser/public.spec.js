import {test,expect} from '@playwright/test';
const payload={season:2030,as_of:'2030-09-29',roster:[{athlete_id:'a',full_name:'Public Test Runner',season_best:950,career_pr:940,season_average:950,recent_count:1,races:1}],meets:[{id:'m',name:'Public Test Meet',date:'2030-09-20'}],races:[{id:'r',athlete_id:'a',meet_id:'m',full_name:'Public Test Runner',meet_name:'Public Test Meet',date:'2030-09-20',season:2030,time_seconds:950,mile_pace:305.77,season_pr:true,career_pr:false}],physiology:[{athlete_id:'a',vdot_current:60}],groups:[{athlete_id:'a',faster_1:'Existing Packmate',faster_1_vdot:61,anchor_reason:'Existing model'}]};
test('public landing loads roster without auth and preserves all dashboard sections',async({page},info)=>{
  const forbidden=[];page.on('request',r=>{if(r.url().includes('/auth/v1/')||r.url().endsWith('/rpc/coach_dashboard'))forbidden.push(r.url());});
  await page.route('**/rpc/coach_public_dashboard',r=>r.fulfill({json:payload}));
  await page.goto('/');await expect(page.getByRole('heading',{name:'Roster',exact:true})).toBeVisible();
  await expect(page.getByRole('button',{name:'Public Test Runner'})).toBeVisible();
  await expect(page.getByText('Welcome back',{exact:true})).toHaveCount(0);await expect(page.getByRole('button',{name:'Sign out'})).toHaveCount(0);
  const dl=page.waitForEvent('download');await page.getByRole('button',{name:'Export CSV'}).click();expect((await dl).suggestedFilename()).toBe('roster.csv');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();
  await page.screenshot({path:info.outputPath('public-roster.png'),fullPage:true});
  await page.getByRole('button',{name:'Public Test Runner'}).click();await expect(page.getByRole('heading',{name:'Season progression'})).toBeVisible();
  await page.getByRole('link',{name:'Meet Explorer'}).click();await expect(page.getByLabel('Active-season meet')).toContainText('Public Test Meet');
  await page.getByRole('link',{name:'Analytics'}).click();await expect(page.getByRole('heading',{name:'Physiology',exact:true})).toBeVisible();
  await page.getByRole('link',{name:'Race Groups'}).click();await expect(page.getByRole('cell',{name:'Existing Packmate',exact:true})).toBeVisible();expect(forbidden).toEqual([]);
});
test('permission errors stay in dashboard and report restrictions without login',async({page})=>{
  await page.route('**/rpc/coach_public_dashboard',r=>r.fulfill({status:403,json:{code:'42501',message:'permission denied for table results'}}));
  await page.goto('/');await expect(page.getByRole('alert')).toContainText('permissions may restrict');
  await expect(page.getByRole('alert')).toContainText('results');await expect(page.getByRole('navigation')).toBeVisible();
  await expect(page.getByLabel('Password',{exact:true})).toHaveCount(0);
  await page.route('**/rpc/coach_public_dashboard',r=>r.fulfill({json:payload}));await page.getByRole('button',{name:'Refresh'}).click();await expect(page.getByRole('button',{name:'Public Test Runner'})).toBeVisible();
});
