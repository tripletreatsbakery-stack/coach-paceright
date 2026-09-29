// Run with: node --env-file=.env.local scripts/verify-live.mjs
const url=process.env.VITE_SUPABASE_URL;
const key=process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
if(!url||!key)throw Error('Public environment configuration required');
const r=await fetch(url+'/rest/v1/rpc/coach_dashboard',{method:'POST',headers:{apikey:key,'Content-Type':'application/json'},body:'{}'});
if(r.status!==401&&r.status!==403)throw Error('Anonymous denial failed: HTTP '+r.status);
console.log('Live REST API rejects anonymous coach access: HTTP '+r.status);
const publicResponse=await fetch(url+'/rest/v1/rpc/coach_public_dashboard',{method:'POST',headers:{apikey:key,'Content-Type':'application/json'},body:'{}'});
if(!publicResponse.ok)throw Error('Public dashboard restricted: HTTP '+publicResponse.status);
const data=await publicResponse.json();
console.log(`Public dashboard succeeds anonymously: ${data.roster.length} active athletes, ${data.races.length} career races, ${data.groups.length} neighborhoods`);
