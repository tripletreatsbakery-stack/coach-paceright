import {defineConfig,loadEnv} from 'vite';

export default defineConfig(({mode,command})=>{
  const env={...loadEnv(mode,process.cwd(),'VITE_'),...process.env};
  const key=env.VITE_SUPABASE_PUBLISHABLE_KEY;
  let publicKey=key?.startsWith('sb_publishable_');
  if(key&&!publicKey){try{publicKey=JSON.parse(Buffer.from(key.split('.')[1],'base64url').toString()).role==='anon';}catch{publicKey=false;}}
  if(key&&!publicKey)throw Error('Refusing to bundle a privileged or invalid Supabase key.');
  if(command==='build'&&(!publicKey||!env.VITE_SUPABASE_URL?.startsWith('https://')))throw Error('Production build requires an HTTPS Supabase URL and publishable/anon key.');
  return {base:'/'};
});
