import {defineConfig} from '@playwright/test';
export default defineConfig({
  testDir:'./tests/browser',use:{headless:true},
  webServer:[
    {command:'npm run dev -- --port 5173 --strictPort',url:'http://127.0.0.1:5173',reuseExistingServer:!process.env.CI,env:{VITE_REQUIRE_COACH_AUTH:'true'}},
    {command:'npm run dev -- --port 5174 --strictPort',url:'http://127.0.0.1:5174',reuseExistingServer:!process.env.CI,env:{VITE_REQUIRE_COACH_AUTH:'false'}}
  ],
  projects:['desktop','mobile'].flatMap(name=>['auth','public'].map(mode=>({
    name:`${name}-${mode}`,testMatch:mode==='auth'?'portal.spec.js':['public.spec.js','classes.spec.js','team.spec.js'],
    use:{baseURL:`http://127.0.0.1:${mode==='auth'?5173:5174}`,viewport:name==='desktop'?{width:1440,height:1000}:{width:390,height:844}}
  }))).concat([{name:'tablet-classes',testMatch:['classes.spec.js','team.spec.js'],use:{baseURL:'http://127.0.0.1:5174',viewport:{width:1024,height:1100}}}])
});
