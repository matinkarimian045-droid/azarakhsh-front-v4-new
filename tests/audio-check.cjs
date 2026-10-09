const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..');
class FakeAudio {
 constructor(){this.paused=true;this.currentTime=0;this.duration=10;this.readyState=4;this.volume=1;this.playbackRate=1;this.muted=false;this.listeners={};this.plays=0;}
 addEventListener(k,fn){(this.listeners[k]??=[]).push(fn);}
 play(){this.paused=false;this.plays++;return Promise.resolve();}
 pause(){this.paused=true;}
 dispatch(k){for(const f of this.listeners[k]||[])f();}
}
const sandbox={console,performance,Audio:FakeAudio,document:{hidden:false},ATLAS_DATA:{},Uint8Array,Map,Set};vm.createContext(sandbox);
vm.runInContext(['locale.js','config.js','audio.js'].map(n=>fs.readFileSync(path.join(root,'src',n),'utf8')).join('\n')+'\nglobalThis.AudioSystem=AudioSystem;globalThis.SOURCES=ASSET_CONFIG.sounds;',sandbox);
const app={game:{time:0},settings:{master:1,effects:1},renderer:{camera:{x:0,y:0}},speed:1,actualSpeed(){return this.speed;}};
const s=new sandbox.AudioSystem(app),results=[];function check(name,value){results.push({name,ok:!!value});console.log((value?'PASS ':'FAIL ')+name);}
(async()=>{
 s.unlock();await Promise.resolve();await Promise.resolve();
 check('Seven MP3 combat pools plus one embedded click pool are created',Object.keys(s.pools).length===8);
 check('Persian/space-containing names are URI encoded at assignment',s.pools.sam.voices[0].media.src.includes('%20')&&s.pools.aaa.voices[0].media.src.includes('%D8'));
 check('Button click is a short media sample, not a combat synthesizer',sandbox.SOURCES.click.startsWith('data:audio/wav;base64,')&&s.play('click',null,{ui:true,force:true})!==null);
 for(const [event,payload,wanted]of [['MISSILE_LAUNCHED','ballistic','launch'],['INTERCEPTOR_LAUNCHED','sam','sam'],['INTERCEPTOR_LAUNCHED','aaa','aaa'],['MISSILE_INTERCEPTED','fighter','intercept'],['MISSILE_IMPACT','drone','explosion'],['AIRCRAFT_LAUNCHED',null,'takeoff']]){
  s.stopAll();s.last={};s.event({type:event,payloadType:payload,mission:'patrol',x:0,y:0});check(event+'/'+(payload||'patrol')+' maps to '+wanted,s.pools[wanted].voices.some(v=>v.active));
 }
 s.stopAll();app.game.time=10;s.beginStrike({strikeId:'x',startAt:10,x:0,y:0});let v=s.strikes.get('x');check('Strike starts from clip second zero',!!v&&v.offset===0&&v.started===10);
 app.game.time=16.98;s.tick();check('Flyby is at 6.98 seconds just before impact',Math.abs(v.media.currentTime-6.98)<.01);
 app.game.time=17;s.strikeImpact({strikeId:'x'});check('Impact aligns to clip second seven',Math.abs(v.media.currentTime-7)<.01);
 app.speed=0;s.tick();check('Pause freezes the file sound with the game',v.media.paused);app.speed=2;await Promise.resolve();s.tick();check('Fast forward uses simulation playback rate',v.media.playbackRate===2&&!v.media.paused);
 sandbox.document.hidden=true;s.tick();check('Background tab pauses ongoing sound',v.media.paused);sandbox.document.hidden=false;app.speed=1;
 s.event({type:'MISSILE_INTERCEPTED',payloadType:'airstrike',strikeId:'x'});check('Intercepted strike cancels its scheduled explosion file',!v.active&&!s.strikes.has('x'));
 s.stopAll();app.game.time=20;s.beginStrike({strikeId:'y',startAt:20});v=s.strikes.get('y');s.event({type:'AIR_STRIKE_RELEASED',strikeId:'y'});s.event({type:'MISSILE_INTERCEPTED',payloadType:'fighter',strikeId:'y',released:true});check('Fighter loss after release does not cancel its independent missile',v.active);
 s.stopAll();app.game.time=30;let gun=s.play('aaa',null,{force:true});app.game.time=30.46;s.tick();check('One gun shot uses a short file slice instead of a sustained burst',!gun.active);
 s.pools.launch.voices[0].media.dispatch('error');check('Missing MP3 becomes silent unavailable state with no synthesis',s.status('launch')==='missing'&&s.play('launch',null,{force:true})===null);
 s.stopAll();check('Exit stops every audio voice',Object.values(s.pools).every(p=>p.voices.every(v=>!v.active&&v.media.paused)));
 const report={version:'2.2.0-stage1',scope:'Mock HTMLMediaElement routing/time synchronization. Actual MP3 files were not provided; this is not an audible waveform test.',passed:results.filter(r=>r.ok).length,failed:results.filter(r=>!r.ok).length,results};fs.writeFileSync(path.join(__dirname,'audio-results.json'),JSON.stringify(report,null,2));process.exitCode=report.failed?1:0;
})();
