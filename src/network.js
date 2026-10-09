'use strict';
/* Optional Socket.IO transport. Offline play does not load any network library.
 * Only the server advances online gameplay. Client extrapolation is rendering.
 */
class NetworkLink{
 constructor(app){this.app=app;this.socket=null;this.room=null;this.playerId=null;this.active=false;this.connected=false;this.paused=false;this.nation='iran';this.name='Commander';this.seq=0;this.revision=-1;this.packetAt=0;this.baseTime=0;this.connecting=null;this.resultShown=false;
  try{this.token=sessionStorage.getItem('af-session-token')||'';this.seq=Number(sessionStorage.getItem('af-command-seq'))||0;this.lastRoom=sessionStorage.getItem('af-room-code')||'';}catch(_){this.token='';}
  if(this.lastRoom&&/^https?:$/.test(location.protocol))setTimeout(()=>this.connect().catch(()=>{}),0);
 }
 store(key,value){try{if(value===null)sessionStorage.removeItem(key);else sessionStorage.setItem(key,String(value));}catch(_){}}
 async script(){if(window.io)return;if(!/^https?:$/.test(location.protocol))throw new Error('networkNeedsServer');if(this.scriptPromise)return this.scriptPromise;
  this.scriptPromise=new Promise((resolve,reject)=>{const s=document.createElement('script');s.src='/socket.io/socket.io.js';s.onload=resolve;s.onerror=()=>{this.scriptPromise=null;reject(new Error('networkNeedsServer'));};document.head.appendChild(s);});return this.scriptPromise;
 }
 async connect(){if(this.connected)return;if(this.connecting)return this.connecting;
  this.connecting=(async()=>{await this.script();if(this.socket)this.socket.disconnect();
   const socket=this.socket=window.io({auth:{resumeToken:this.token},reconnection:true,reconnectionDelay:700,reconnectionDelayMax:4000,timeout:7000});
   socket.on('connect',()=>{this.connected=true;this.status();});
   socket.on('disconnect',()=>{this.connected=false;this.status();if(this.room&&!this.active&&this.app.ui.dialog==='network')this.lobby();});
   socket.on('room:state',room=>{this.room=room;this.paused=!!room.paused;this.store('af-room-code',room.code);if(!this.active&&this.app.ui.dialog==='network')this.lobby();this.status();});
   socket.on('match:started',packet=>this.receive(packet,true));
   socket.on('game:state',packet=>this.receive(packet,false));
   socket.on('game:events',packet=>{if(!this.active)return;for(const e of packet.events||[]){this.app.renderer.effect(e);this.app.audio.event(e);}});
   socket.on('room:closed',data=>{this.reset();this.app.ui.closeDialog();this.app.goMenu();this.app.ui.toast(tr(data.reason),'warn');});
   socket.on('session:error',data=>this.app.ui.toast(tr(data.error),'bad'));
   await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('networkError')),8000);
    socket.on('session:welcome',data=>{clearTimeout(timer);this.token=data.resumeToken;this.playerId=data.playerId;this.store('af-session-token',this.token);if(!data.roomCode&&this.lastRoom){this.store('af-room-code',null);this.lastRoom='';}resolve();});
    socket.once('connect_error',()=>{clearTimeout(timer);reject(new Error('networkError'));});
   });
  })().finally(()=>{this.connecting=null;});return this.connecting;
 }
 send(event,args={},retry=false){if(!this.socket?.connected)return Promise.resolve({ok:false,error:'networkError'});
  const once=()=>new Promise(resolve=>this.socket.timeout(4500).emit(event,args,(err,result)=>resolve(err?{ok:false,error:'networkError'}:(result||{ok:false,error:'serverError'}))));
  return once().then(async r=>retry&&r.error==='networkError'&&this.connected?once():r);
 }
 async command(type,args){if(!this.active||!this.connected||this.paused)return{ok:false,error:'matchPaused'};const packet={id:++this.seq,type,args};this.store('af-command-seq',this.seq);return this.send('game:command',packet,true);}
 async open(){if(this.active){this.lobby();return;}this.app.ui.openDialog('network',tr('onlineStage'),`<div class="empty">${tr('connecting')}</div>`,btn(tr('close'),'closeDialog'));
  try{await this.connect();if(this.room)this.lobby();else this.entry();}catch(err){this.app.ui.openDialog('network',tr('onlineStage'),`<div class="online-missing"><p>${tr(err.message)||tr('networkNeedsServer')}</p><pre>npm install\nnpm start</pre><p class="network-note">http://localhost:3000</p></div>`,btn(tr('close'),'closeDialog'));}
 }
 entry(){const u=this.app.ui;u.openDialog('network',tr('onlineStage'),`<div class="online-form"><label class="field">${tr('yourName')}<input id="netName" value="${escapeHTML(this.name)}" maxlength="24" autocomplete="nickname"></label><div class="nation-select">${Object.keys(NATIONS).map(n=>`<button class="nation-choice ${this.nation===n?'on':''}" data-act="netCountry" data-nation="${n}"><img src="${ATLAS_DATA[n].image}" alt="">${tr(n)}<small class="nation-perk">${tr(NATION_PERKS[n].label)}</small></button>`).join('')}</div><p class="network-note">${tr('sameNationAllowed')}</p>${btn(tr('createRoom'),'netCreate','','primary wide')}<label class="field">${tr('roomCode')}<input id="netCode" placeholder="A1B2C3" maxlength="6" dir="ltr" autocapitalize="characters" autocomplete="off"></label>${btn(tr('joinRoom'),'netJoin','','wide')}</div>`,btn(tr('close'),'closeDialog'));
 }
 lobby(){if(!this.room)return this.entry();const r=this.room,me=r.players.find(p=>p.id===this.playerId),host=!!me?.host,waiting=r.status==='waiting',ready=r.players.length===2&&r.players.every(p=>p.ready&&p.connected),s=r.settings;
  const options=(key,values)=>values.map(([value,label])=>btn(label,'netRule',`data-key="${key}" data-value="${value}"`,s[key]===value?'primary sm':'sm',!host||!waiting)).join('');
  const body=`<div class="network-bar"><span class="pill ${this.connected?'good':'bad'}">${tr(this.connected?'connected':'disconnected')}</span><span>1 vs 1 / ${tr('onlineStage')}</span></div><div class="room-code">${r.code}<small>${tr('roomCode')}</small></div><div class="room-players">${[1,2].map(seat=>{const p=r.players.find(p=>p.seat===seat);return p?`<div class="room-player ${p.id===this.playerId?'self':''}"><small>${tr(seat===1?'firstPlayer':'secondPlayer')}${p.host?' / '+tr('host'):''}</small><b>${escapeHTML(p.name)}${p.id===this.playerId?' / '+tr('you'):''}</b><span class="player-nation"><span>${tr(p.nation)}</span><small>${tr(NATION_PERKS[p.nation]?.label||'countryPerk')}</small></span><small class="room-ready">${tr(!p.connected?'disconnected':p.ready?'readyMatch':'waiting')}</small></div>`:`<div class="room-player"><small>${tr(seat===1?'firstPlayer':'secondPlayer')}</small><b>${tr('waitingPeer')}</b></div>`;}).join('')}</div>
   ${waiting?`<div class="network-rules"><b>${tr('networkRules')}</b><div class="row">${options('style',[['arcade',tr('arcade')],['realistic',tr('realistic')]])}</div><div class="row">${options('intel',[[false,tr('fullIntel')],[true,tr('fogIntel')]])}</div><div class="row"><span>${tr('prep')}</span>${options('prep',[[0,tr('off')],[60,'1:00'],[120,'2:00'],[180,'3:00']])}</div><div class="row"><span>${tr('money')}</span>${options('startMoney',[[10000,fmt(10000)],[14500,fmt(14500)],[25000,fmt(25000)]])}</div><div class="nation-select">${Object.keys(NATIONS).map(n=>`<button class="nation-choice ${me?.nation===n?'on':''}" data-act="netCountry" data-nation="${n}"><img src="${ATLAS_DATA[n].image}" alt="">${tr(n)}<small class="nation-perk">${tr(NATION_PERKS[n].label)}</small></button>`).join('')}</div></div>`:`<p class="network-note">${tr(r.paused?'matchPaused':'onlinePauseHint')}</p>`}`;
  const footer=(waiting?btn(tr(me?.ready?'unready':'readyMatch'),'netReady','','primary',!this.connected)+(host?btn(tr('start'),'netStart','','primary',!ready):''):btn(tr('close'),'closeDialog','','primary'))+btn(tr('leaveRoom'),'netLeave','','danger');
  this.app.ui.openDialog('network',tr('onlineStage'),body,footer,true);
 }
 async action(d){if($('netName'))this.name=$('netName').value;let r;
  switch(d.act){
   case'netCountry':this.nation=d.nation;if(this.room)r=await this.send('room:choose',{nation:d.nation});else this.entry();break;
   case'netCreate':r=await this.send('room:create',{name:this.name,nation:this.nation});if(r.ok){this.playerId=r.playerId;this.room=r.room;this.seq=0;this.store('af-command-seq',0);this.lobby();}break;
   case'netJoin':r=await this.send('room:join',{name:this.name,nation:this.nation,code:$('netCode')?.value||''});if(r.ok){this.playerId=r.playerId;this.room=r.room;this.seq=0;this.store('af-command-seq',0);this.lobby();}break;
   case'netReady':r=await this.send('room:ready',{ready:!this.room.players.find(p=>p.id===this.playerId)?.ready});break;
   case'netStart':r=await this.send('room:start');break;
   case'netRule':{const value=d.key==='intel'?d.value==='true':d.key==='style'?d.value:Number(d.value);r=await this.send('room:settings',{[d.key]:value});break;}
   case'netLeave':await this.leave();this.app.ui.closeDialog();this.app.goMenu();break;
  }
  if(r&&!r.ok)this.app.ui.toast(tr(r.error),'bad');
 }
 async leave(){if(this.room&&this.connected)await this.send('room:leave');this.reset();}
 reset(){this.active=false;this.room=null;this.paused=false;this.revision=-1;this.resultShown=false;this.store('af-room-code',null);this.status();}
 receive(packet,first){if(!packet||(!first&&!this.active)||(this.room&&packet.room!==this.room.code)||(!first&&packet.revision<=this.revision))return;this.revision=packet.revision;this.paused=!!packet.paused;this.packetAt=performance.now();this.baseTime=packet.time;
  const isNew=first&&!this.active;
  let g=isNew?Object.create(Simulation.prototype):this.app.game;
  if(isNew){g.atlas=atlas;g.listeners=[];g.rng=new Random(1);g._index=new Map();g._tick=0;g._warNotified=true;}
  Object.assign(g,packet);g.reindex();this.active=true;
  for(const list of [g.missiles,g.aircraft,g.interceptors,g.boosters,g.satellites])for(const o of list)o._networkBase={x:o.x,y:o.y,z:o.z||0,age:o.age||0,life:o.life};
  if(isNew){this.app.ui.closeDialog();this.app.adopt(g);this.resultShown=false;}else this.app.ui.update();
  if(g.ended&&!this.resultShown){this.resultShown=true;this.app.gameOver(g.ended);}
  this.status();
 }
 renderStep(){if(!this.active)return;const g=this.app.game,dt=this.paused||!this.connected?0:Math.min(.12,(performance.now()-this.packetAt)/1000);g.time=this.baseTime+dt;
  for(const m of g.missiles){const b=m._networkBase;m.prev={x:m.x,y:m.y,z:m.z};m.age=b.age+dt;if(m.remoteTrack){m.x=b.x+(m.vx||0)*dt;m.y=b.y+(m.vy||0)*dt;m.z=Math.max(0,b.z+(m.vz||0)*dt);}else Object.assign(m,Trajectory.at(m,Math.min(1,m.age/m.duration)));}
  for(const p of g.interceptors){const b=p._networkBase;p.prev={x:p.x,y:p.y,z:p.z};p.age=b.age+dt;if(p.remoteTrack){p.x=b.x+(p.vx||0)*dt;p.y=b.y+(p.vy||0)*dt;p.z=Math.max(0,b.z+(p.vz||0)*dt);}else if(p.type==='sam')Object.assign(p,InterceptorPath.at(p,p.age));else{const d=g.projectileDistance(p.type,p.age);p.x=p.origin.x+p.direction.x*d;p.y=p.origin.y+p.direction.y*d;p.z=p.origin.z+p.direction.z*d;}}
  for(const a of g.aircraft){const b=a._networkBase;a.x=b.x+Math.cos(a.heading||0)*(a.speed||0)*dt;a.y=b.y+Math.sin(a.heading||0)*(a.speed||0)*dt;}
 }
 status(){const el=$('networkStatus');if(!el)return;el.classList.toggle('hidden',!this.active);if(this.active){el.classList.toggle('paused',!this.connected||this.paused);el.textContent=!this.connected?tr('reconnectHint'):this.paused?tr('matchPaused'):`${tr('onlineStage')} / ${this.room?.code||''}`;}
  document.querySelectorAll('[data-act="speed"]').forEach(b=>b.disabled=this.active);
 }
}
