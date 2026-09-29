// Uses the existing Git credential helper; never writes or prints credentials.
import {spawnSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
const credential=spawnSync('git',['credential','fill'],{input:'protocol=https\nhost=github.com\n\n',encoding:'utf8',windowsHide:true});
const fields=Object.fromEntries(credential.stdout.trim().split('\n').map(l=>{const i=l.indexOf('=');return [l.slice(0,i),l.slice(i+1)];}));
if(!fields.password)throw Error('GitHub credential helper unavailable');
const base='https://api.github.com/repos/tripletreatsbakery-stack/coach-paceright';
async function api(path,method='GET',body){const r=await fetch(base+path,{method,headers:{Authorization:'Bearer '+fields.password,Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28'},body:body?JSON.stringify(body):undefined});const result=await r.json().catch(()=>({}));if(!r.ok)throw Error(`${method} ${path}: ${r.status} ${result.message}`);return result;}
const task=process.argv[2];
if(task==='inspect'){const p=await api('/pages');console.log(JSON.stringify({url:p.html_url,cname:p.cname,build_type:p.build_type,status:p.status}));const runs=await api('/actions/runs?per_page=3');console.log(JSON.stringify(runs.workflow_runs.map(r=>({id:r.id,status:r.status,conclusion:r.conclusion,url:r.html_url}))));}
if(task==='configure'){const env=Object.fromEntries(readFileSync('.env.local','utf8').trim().split(/\r?\n/).map(l=>{const i=l.indexOf('=');return [l.slice(0,i),l.slice(i+1)];}));for(const name of ['VITE_SUPABASE_URL','VITE_SUPABASE_PUBLISHABLE_KEY']){try{await api('/actions/variables/'+name,'PATCH',{name,value:env[name]});}catch(e){if(!e.message.includes('404'))throw e;await api('/actions/variables','POST',{name,value:env[name]});}}console.log('Public build variables configured');}
if(task==='jobs'){const jobs=await api('/actions/runs/'+process.argv[3]+'/jobs');console.log(JSON.stringify(jobs.jobs.map(j=>({name:j.name,conclusion:j.conclusion,steps:j.steps.map(s=>({name:s.name,conclusion:s.conclusion}))})),null,2));}
