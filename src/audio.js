/* File media for combat; one bundled original PCM sound for UI buttons only. */
class AudioSystem {
 constructor(app){this.app=app;this.unlocked=false;this.pools={};this.last={};this.strikes=new Map();this.lastRate=1;}
 unlock(){
  if(this.unlocked)return;this.unlocked=true;
  for(const [type,url] of Object.entries(ASSET_CONFIG.sounds)){
   if(!url)continue;const pool=this.pools[type]={url,state:'pending',voices:[]};
   for(let i=0;i<(type==='strike'?5:AUDIO_CONFIG.poolSize);i++){
    const media=new Audio();media.preload='auto';media.src=encodeURI(url);media.preservesPitch=true;
    const v={media,type,active:false,gain:1};
    media.addEventListener('loadeddata',()=>{pool.state='ready';});
    media.addEventListener('error',()=>{pool.state='missing';this.stop(v);});
    media.addEventListener('ended',()=>this.stop(v));pool.voices.push(v);
    // Prime media playback on this user gesture; never fall back to generated sounds.
    media.muted=true;try{const priming=media.play();if(priming?.then)priming.then(()=>{if(!v.active){media.pause();try{media.currentTime=0;}catch(_){}}media.muted=false;}).catch(()=>{media.muted=false;});else media.muted=false;}catch(_){media.muted=false;}
   }
  }
 }
 status(type){return this.pools[type]?.state||'pending';}
 stop(v){if(!v)return;v.active=false;try{v.media.pause();}catch(_){}if(v.strikeId&&this.strikes.get(v.strikeId)===v)this.strikes.delete(v.strikeId);}
 stopAll(){for(const p of Object.values(this.pools))for(const v of p.voices)this.stop(v);this.strikes.clear();}
 pauseAll(){for(const p of Object.values(this.pools))for(const v of p.voices)if(v.active)v.media.pause();}
 retry(){this.stopAll();this.pools={};this.unlocked=false;this.unlock();}
 apply(){for(const p of Object.values(this.pools))for(const v of p.voices){v.media.volume=clamp(this.app.settings.master*this.app.settings.effects*(v.gain||1),0,1);}}
 play(type,point=null,options={}){
  if(!this.unlocked||!ASSET_CONFIG.sounds[type])return null;
  const pool=this.pools[type];if(!pool||pool.state==='missing')return null;
  const now=performance.now(),gap={click:45,explosion:110,intercept:85,aaa:100,sam:140,launch:150,takeoff:250,strike:0}[type]||100;
  if(!options.force&&now-(this.last[type]??-9999)<gap)return null;
  const active=Object.values(this.pools).reduce((n,p)=>n+p.voices.filter(v=>v.active).length,0);if(active>=AUDIO_CONFIG.maxVoices)return null;
  const v=pool.voices.find(v=>!v.active);if(!v)return null;this.last[type]=now;
  let distanceGain=1;if(point&&this.app.renderer){const cam=this.app.renderer.camera;distanceGain=clamp(1-Math.hypot(point.x-cam.x,point.y-cam.y)/3500,.12,1);}
  Object.assign(v,{active:true,started:this.app.game.time,wallStart:now,offset:options.offset||0,ui:!!options.ui,gain:distanceGain*(options.gain??.8),stopAt:options.stopAt??(type==='aaa'?.44:Infinity),strikeId:options.strikeId||null,released:false,needsSeek:true});
  if(v.strikeId)this.strikes.set(v.strikeId,v);this.syncVoice(v);return v;
 }
 syncVoice(v){
  if(!v.active)return;const media=v.media,speed=v.ui?1:this.app.actualSpeed(),expected=(v.ui?(performance.now()-v.wallStart)/1000:this.app.game.time-v.started)+v.offset;
  if(expected>=v.stopAt||(Number.isFinite(media.duration)&&expected>=media.duration)){this.stop(v);return;}
  media.volume=clamp(this.app.settings.master*this.app.settings.effects*v.gain,0,1);
  // Speed changes and pause use simulation time; the attack flash is at clip second 7.
  if(media.readyState>=1&&(v.needsSeek||Math.abs(media.currentTime-expected)>.16)){
   try{media.currentTime=Math.max(0,expected);v.needsSeek=false;}catch(_){}
  }
  if(speed<=0||document.hidden){media.pause();return;}
  try{media.playbackRate=clamp(speed,.25,4);}catch(_){}
  if(media.paused&&!v.pendingPlay){v.pendingPlay=true;try{const promise=media.play();if(promise?.then)promise.then(()=>v.pendingPlay=false).catch(()=>{v.pendingPlay=false;});else v.pendingPlay=false;}catch(_){v.pendingPlay=false;}}
 }
 tick(){for(const p of Object.values(this.pools))for(const v of p.voices)if(v.active)this.syncVoice(v);}
 beginStrike(e){const v=this.play('strike',e,{strikeId:e.strikeId,force:true,gain:.9,stopAt:10});if(v){v.started=e.startAt;this.syncVoice(v);}}
 strikeImpact(e){
  let v=this.strikes.get(e.strikeId);if(!v)v=this.play('strike',e,{strikeId:e.strikeId,force:true,gain:.9,offset:AUDIO_CONFIG.strikeImpactOffset,stopAt:10});
  else{v.started=this.app.game.time-AUDIO_CONFIG.strikeImpactOffset;v.offset=0;v.needsSeek=true;}
  if(v){v.released=true;this.syncVoice(v);}
 }
 event(e){
  switch(e.type){
   case'MISSILE_LAUNCHED':case'SATELLITE_LAUNCHED':this.play('launch',e);break;
   case'INTERCEPTOR_LAUNCHED':this.play(e.payloadType==='aaa'?'aaa':e.payloadType==='asat'?'launch':'sam',e,{gain:e.payloadType==='aaa'?.48:.72});break;
   case'AIRCRAFT_LAUNCHED':if(e.mission!=='recon')this.play('takeoff',e);break;
   case'AIR_STRIKE_STARTED':this.beginStrike(e);break;
   case'AIR_STRIKE_RELEASED':{const v=this.strikes.get(e.strikeId);if(v)v.released=true;break;}
   case'AIR_STRIKE_CANCELLED':this.stop(this.strikes.get(e.strikeId));break;
   case'MISSILE_IMPACT':if(e.strikeId)this.strikeImpact(e);else this.play('explosion',e,{gain:.9});break;
   case'MISSILE_INTERCEPTED':{
    const v=this.strikes.get(e.strikeId);if(e.payloadType==='airstrike'||(e.payloadType==='fighter'&&!e.released))this.stop(v);
    this.play('intercept',e,{gain:.8});break;
   }
   case'AIRCRAFT_LOST':if(!e.released)this.stop(this.strikes.get(e.strikeId));this.play('explosion',e);break;
  }
 }
}
