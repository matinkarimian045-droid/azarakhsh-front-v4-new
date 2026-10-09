'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..'),results=[];
function check(file,source){try{new vm.Script(source,{filename:file});results.push({file,ok:true});}catch(error){results.push({file,ok:false,error:error.message});}}
for(const dir of ['src','server','tools','tests'])for(const f of fs.readdirSync(path.join(root,dir)).sort()){
 if(/\.(?:js|cjs)$/.test(f))check(dir+'/'+f,fs.readFileSync(path.join(root,dir,f),'utf8'));
}
check('server.cjs',fs.readFileSync(path.join(root,'server.cjs'),'utf8'));
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');let inline=0;
for(const [,source]of html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/gi))check('index.html inline '+(++inline),source);
if(!inline)results.push({file:'index.html',ok:false,error:'No compiled script found'});
const report={version:'2.5.0-economy-aaa-rework',scope:'JavaScript syntax only, not behavior or transport',passed:results.filter(r=>r.ok).length,failed:results.filter(r=>!r.ok).length,results};
fs.writeFileSync(path.join(root,'tests/syntax-results.json'),JSON.stringify(report,null,2));
console.log(report.passed+' JavaScript syntax checks passed; '+report.failed+' failed');
if(report.failed){console.error(results.filter(r=>!r.ok));process.exitCode=1;}
