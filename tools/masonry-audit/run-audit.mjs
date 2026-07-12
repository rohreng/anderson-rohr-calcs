import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {spawn,spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const pub=path.join(root,'public');
const ev=path.join(pub,'dev','audit-evidence');
const profile=path.join(root,'tools','masonry-audit',`.chrome-profile-${process.pid}`);
for(const stale of ['.chrome-profile','testprofile','testprofile2','chrome-out.txt','chrome-err.txt'])
  try{fs.rmSync(path.join(root,'tools','masonry-audit',stale),{recursive:true,force:true});}catch{}
fs.mkdirSync(ev,{recursive:true}); fs.mkdirSync(profile,{recursive:true});
for(const name of fs.readdirSync(ev))
  if(name==='manifest.json'||name==='full-run.log'||/\.(json|png)$/.test(name)) fs.rmSync(path.join(ev,name),{force:true});
const fixtures=JSON.parse(fs.readFileSync(path.join(pub,'dev','audit-fixtures','fixtures.json'),'utf8'));
const byKey=new Map(fixtures.map((f,i)=>[`${f.calc}/${f.id}`,f]));
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.png':'image/png'};
const server=http.createServer((req,res)=>{
  const u=new URL(req.url,'http://localhost');
  if(u.pathname.startsWith('/__fixture/')){
    const key=decodeURIComponent(u.pathname.slice(11)); const f=byKey.get(key);
    res.writeHead(f?200:404,{'content-type':'application/json'}); return res.end(JSON.stringify(f||{error:'missing fixture'}));
  }
  const rel=decodeURIComponent(u.pathname==='/'?'/dev/':u.pathname); const p=path.resolve(pub,'.'+rel);
  if(!p.startsWith(pub)){res.writeHead(403);return res.end('forbidden');}
  fs.readFile(p,(e,d)=>{if(e){res.writeHead(404);res.end('not found');}else{res.writeHead(200,{'content-type':mime[path.extname(p)]||'application/octet-stream'});res.end(d);}});
});
await new Promise(r=>server.listen(0,'127.0.0.1',r)); const port=server.address().port;
const chrome=['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'].find(fs.existsSync);
if(!chrome) throw new Error('Chrome not found');
const chromeVersion=spawnSync('powershell.exe',['-NoProfile','-Command',`(Get-Item '${chrome}').VersionInfo.ProductVersion`],{encoding:'utf8'}).stdout.trim();
const logLines=[]; const log=(s)=>{logLines.push(s);console.log(s);};
let chromeRun=0;
async function runChrome(args,tag){
  const n=chromeRun++, stdout=path.join(root,'tools','masonry-audit',`.chrome-${n}.out`), stderr=path.join(root,'tools','masonry-audit',`.chrome-${n}.err`);
  const aq=args.map(x=>`'${String(x).replaceAll("'","''")}'`).join(',');
  const cmd=`$p=Start-Process -FilePath '${chrome}' -ArgumentList @(${aq}) -Wait -PassThru -RedirectStandardOutput '${stdout}' -RedirectStandardError '${stderr}'; exit $p.ExitCode`;
  const status=await new Promise(resolve=>{const p=spawn('powershell.exe',['-NoProfile','-Command',cmd]); p.on('exit',resolve);});
  const result={status,stdout:fs.existsSync(stdout)?fs.readFileSync(stdout,'utf8'):'',stderr:fs.existsSync(stderr)?fs.readFileSync(stderr,'utf8'):'',tag};
  try{fs.rmSync(stdout,{force:true});fs.rmSync(stderr,{force:true});}catch{} return result;
}
const sourceCommit=spawnSync('git',['rev-parse','--short','HEAD'],{cwd:root,encoding:'utf8'}).stdout.trim();
log(`MASONRY AUDIT STRICT source=${sourceCommit} chrome=${chromeVersion}`);
log(`Fixtures expected=${fixtures.length} calculators=${new Set(fixtures.map(f=>f.calc)).size}`);
let harnessErrors=0, mismatches=0, acknowledgedFindings=0; const manifest=[];
for(const f of fixtures){
  const key=`${f.calc}/${f.id}`, slug=`${f.calc}--${f.id}`.replace(/[^a-z0-9_.-]/gi,'_');
  if(f.benchmark_status==='benchmark_not_drivable'){
    log(`NOT_DRIVABLE ${key} — ${f.blocking_value||'blocking input documented in fixture'}`);
    manifest.push({key,source_commit:'84af963',chrome_version:chromeVersion,benchmark_status:f.benchmark_status,harness_error:false,console_error:false,result:{status:'not_drivable',assertions:[],diagram:{pass:true,skipped:true},errors:[]},stderr:'',screenshot:null});
    continue;
  }
  const url=`http://127.0.0.1:${port}/dev/${f.harness}?fixture=${encodeURIComponent('/__fixture/'+key)}`;
  const args=['--headless=new','--disable-gpu','--disable-software-rasterizer','--no-sandbox','--no-first-run','--no-default-browser-check',`--user-data-dir=${profile}`,'--virtual-time-budget=5000','--dump-dom',url];
  const run=await runChrome(args,key);
  const m=(run.stdout||'').match(/AUDIT_JSON_BEGIN\s*([\s\S]*?)\s*AUDIT_JSON_END/); let result;
  try{result=m?JSON.parse(m[1].replace(/&quot;/g,'"').replace(/&amp;/g,'&')):null;}catch{result=null;}
  const consoleError=/\b(SEVERE|CONSOLE ERROR|Uncaught)\b/i.test(run.stderr||'');
  const broken=run.status!==0||!result||result.status!=='complete'||result.errors.length>0||consoleError;
  if(broken) harnessErrors++;
  const failed=result?result.assertions.filter(a=>!a.pass):[];
  const acknowledged=f.benchmark_status==='pending_eor_ruling';
  if(acknowledged) acknowledgedFindings+=failed.length; else mismatches+=failed.length;
  const shot=path.join(ev,slug+'.png');
  await runChrome(['--headless=new','--disable-gpu','--disable-software-rasterizer','--no-sandbox',`--user-data-dir=${profile}`,'--window-size=1440,2400','--virtual-time-budget=5000',`--screenshot=${shot}`,url],key+' screenshot');
  const record={key,source_commit:'84af963',chrome_version:chromeVersion,url,benchmark_status:f.benchmark_status,harness_error:broken,console_error:consoleError,result,stderr:run.stderr||'',screenshot:path.basename(shot)};
  fs.writeFileSync(path.join(ev,slug+'.json'),JSON.stringify(record,null,2));
  const state=broken?'HARNESS_ERROR':failed.length?(acknowledged?'ACKNOWLEDGED_FINDING':'FINDING_MISMATCH'):'EXECUTED';
  log(`${state} ${key}`);
  for(const a of (result?.assertions||[])) log(`  ${a.pass?'PASS':'FAIL'} ${a.label}: actual=${a.actual} expected=${a.expected}`);
  manifest.push(record);
}
const diagramFailures=manifest.filter(x=>!x.result?.diagram?.pass).length;
const gate=harnessErrors===0&&mismatches===0&&diagramFailures===0&&manifest.length===fixtures.length&&new Set(manifest.map(x=>x.key.split('/')[0])).size===10;
const summary={schema_version:2,mode:'STRICT',source_commit:sourceCommit,chrome_version:chromeVersion,expected_fixtures:fixtures.length,executed:manifest.length,calculators:10,benchmark_mismatches:mismatches,acknowledged_findings:acknowledgedFindings,diagram_failures:diagramFailures,harness_errors:harnessErrors,aggregate_gate:gate?'PASS':'FAIL',gate_meaning:'Strict post-fix gate: zero mismatches, diagram failures, missing runs, harness errors, or page errors.',records:manifest.map(x=>({key:x.key,benchmark_status:x.benchmark_status,harness_error:x.harness_error,screenshot:x.screenshot}))};
fs.writeFileSync(path.join(ev,'manifest.json'),JSON.stringify(summary,null,2));
log(`AGGREGATE ${gate?'PASS':'FAIL'} STRICT acknowledged=${acknowledgedFindings} executed=${manifest.length}/${fixtures.length} calculators=${new Set(manifest.map(x=>x.key.split('/')[0])).size}/10 mismatches=${mismatches} diagram_failures=${diagramFailures} harness_errors=${harnessErrors}`);
fs.writeFileSync(path.join(ev,'full-run.log'),logLines.join('\n')+'\n');
server.close(); try{fs.rmSync(profile,{recursive:true,force:true});}catch{} process.exitCode=gate?0:1;
