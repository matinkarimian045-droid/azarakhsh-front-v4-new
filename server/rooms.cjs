'use strict';
const crypto=require('node:crypto');
const {performance}=require('node:perf_hooks');
const {Simulation,GameCommands,NATIONS,CONFIG}=require('./load-simulation.cjs');
const {snapshot,filteredEvents,addFeed}=require('./snapshot.cjs');
const ok=(data={})=>({ok:true,...data});
const bad=error=>({ok:false,error});
class RoomService{
 constructor(io,{reconnectMs=45000,idleMs=600000,maxRooms=32}={}){
  this.io=io;this.rooms=new Map();this.sessions=new Map();this.reconnectMs=reconnectMs;this.idleMs=idleMs;this.maxRooms=maxRooms;
  this.timer=setInterval(()=>this.tick(),1000/30);this.timer.unref();io.on('connection',s=>this.connect(s));
 }
 stop(){clearInterval(this.timer);for(const r of this.rooms.values())r.game?.listeners.splice(0);this.rooms.clear();this.sessions.clear();}
 connect(socket){
  const token=socket.handshake.auth?.resumeToken;let session=typeof token==='string'&&/^[a-f0-9]{64}$/.test(token)?this.sessions.get(token):null;
  if(session?.socketId&&this.io.sockets.sockets.has(session.socketId)){socket.emit('session:error',bad('sessionInUse'));socket.disconnect(true);return;}
  if(!session){if(this.sessions.size>500){socket.disconnect(true);return;}session={token:crypto.randomBytes(32).toString('hex'),id:crypto.randomUUID(),room:null,socketId:null,lastSeen:Date.now(),acks:new Map(),commandTokens:25,budgetAt:performance.now()};this.sessions.set(session.token,session);}
  session.socketId=socket.id;session.lastSeen=Date.now();socket.data.session=session;socket.emit('session:welcome',{resumeToken:session.token,playerId:session.id,roomCode:session.room});
  const restored=this.rooms.get(session.room);if(restored){const player=restored.players.find(p=>p.sessionId===session.id);if(player){player.connected=true;player.disconnectAt=null;socket.join(restored.code);restored.paused=restored.status==='running'&&!restored.players.every(p=>p.connected);this.broadcastRoom(restored);if(restored.game)socket.emit('match:started',snapshot(restored,player.factionId));}}
  const bind=(name,fn)=>socket.on(name,(payload,ack)=>{if(typeof payload==='function'){ack=payload;payload={};}let result;
   try{if(!this.allow(session)){result=bad('rateLimited');}else if(payload!==undefined&&(!payload||typeof payload!=='object'||Array.isArray(payload))){result=bad('invalid');}else result=fn(payload||{});}
   catch(err){console.error('[command]',name,err.message);result=bad('serverError');}
   if(typeof ack==='function')ack(result||ok());
  });
  bind('room:create',a=>this.create(socket,a));bind('room:join',a=>this.join(socket,a));
  bind('room:choose',a=>this.choose(socket,a));bind('room:ready',a=>this.ready(socket,a));
  bind('room:settings',a=>this.settings(socket,a));bind('room:start',()=>this.start(socket));
  bind('room:leave',()=>this.leave(socket));bind('room:sync',()=>{const r=this.roomFor(socket);if(!r)return bad('roomMissing');socket.emit('room:state',this.roomView(r));if(r.game){const p=r.players.find(p=>p.sessionId===session.id);socket.emit('match:started',snapshot(r,p.factionId));}return ok();});
  bind('game:command',a=>this.command(socket,a));
  socket.on('disconnect',()=>{if(session.socketId!==socket.id)return;session.socketId=null;session.lastSeen=Date.now();const r=this.rooms.get(session.room);if(!r)return;const p=r.players.find(p=>p.sessionId===session.id);if(p){p.connected=false;p.ready=false;p.disconnectAt=Date.now();if(r.status==='running')r.paused=true;r.lastActive=Date.now();this.broadcastRoom(r);}});
 }
 allow(s){const now=performance.now();s.commandTokens=Math.min(25,s.commandTokens+(now-s.budgetAt)*.016);s.budgetAt=now;if(s.commandTokens<1)return false;s.commandTokens--;return true;}
 roomFor(socket){return this.rooms.get(socket.data.session.room);}
 name(v){return typeof v==='string'?v.replace(/[<>\x00-\x1f\x7f]/g,'').trim().slice(0,24)||'Commander':'Commander';}
 nation(v){return typeof v==='string'&&Object.hasOwn(NATIONS,v);}
 roomView(r){return {code:r.code,status:r.status,paused:r.paused,settings:r.settings,reconnectSeconds:this.reconnectMs/1000,players:r.players.map(p=>({id:p.sessionId,seat:p.seat,name:p.name,nation:p.nation,ready:p.ready,connected:p.connected,host:p.sessionId===r.hostId}))};}
 broadcastRoom(r){this.io.to(r.code).emit('room:state',this.roomView(r));}
 create(socket,a){const s=socket.data.session;if(s.room)return bad('alreadyInRoom');if(this.rooms.size>=this.maxRooms)return bad('serverFull');if(!this.nation(a.nation))return bad('invalid');
  let code;do{code=crypto.randomBytes(4).toString('hex').slice(0,6).toUpperCase();}while(this.rooms.has(code));
  const r={code,hostId:s.id,status:'waiting',paused:false,players:[],settings:{style:'realistic',intel:true,prep:120,startMoney:14500},game:null,events:[],feeds:new Map(),revision:0,last:performance.now(),accumulator:0,lastBroadcast:0,lastActive:Date.now()};
  this.rooms.set(code,r);this.attach(socket,r,a,1);return ok({room:this.roomView(r),playerId:s.id});
 }
 attach(socket,r,a,seat){const s=socket.data.session;r.players.push({sessionId:s.id,seat,name:this.name(a.name),nation:a.nation,ready:false,connected:true,disconnectAt:null,factionId:null});s.room=r.code;s.acks.clear();s.lastCommand=0;socket.join(r.code);r.lastActive=Date.now();this.broadcastRoom(r);}
 join(socket,a){const s=socket.data.session;if(s.room)return bad('alreadyInRoom');const code=typeof a.code==='string'?a.code.trim().toUpperCase():'';if(!/^[A-F0-9]{6}$/.test(code))return bad('roomMissing');const r=this.rooms.get(code);if(!r)return bad('roomMissing');if(r.status!=='waiting')return bad('alreadyStarted');if(r.players.length>=2)return bad('roomFull');if(!this.nation(a.nation))return bad('invalid');
  this.attach(socket,r,a,r.players.some(p=>p.seat===1)?2:1);return ok({room:this.roomView(r),playerId:s.id});
 }
 choose(socket,a){const r=this.roomFor(socket);if(!r||r.status!=='waiting')return bad('roomRuleLocked');const p=r.players.find(p=>p.sessionId===socket.data.session.id);if(!this.nation(a.nation))return bad('invalid');p.nation=a.nation;for(const x of r.players)x.ready=false;this.broadcastRoom(r);return ok();}
 ready(socket,a){const r=this.roomFor(socket);if(!r||r.status!=='waiting'||typeof a.ready!=='boolean')return bad('roomRuleLocked');r.players.find(p=>p.sessionId===socket.data.session.id).ready=a.ready;r.lastActive=Date.now();this.broadcastRoom(r);return ok();}
 settings(socket,a){const r=this.roomFor(socket);if(!r||r.hostId!==socket.data.session.id||r.status!=='waiting')return bad('hostOnly');const s=r.settings;
  if(a.style!==undefined&&!['arcade','realistic'].includes(a.style))return bad('invalid');if(a.intel!==undefined&&typeof a.intel!=='boolean')return bad('invalid');if(a.prep!==undefined&&![0,60,120,180,300].includes(a.prep))return bad('invalid');if(a.startMoney!==undefined&&(!Number.isInteger(a.startMoney)||a.startMoney<3000||a.startMoney>50000))return bad('invalid');
  for(const k of ['style','intel','prep','startMoney'])if(a[k]!==undefined)s[k]=a[k];for(const p of r.players)p.ready=false;r.lastActive=Date.now();this.broadcastRoom(r);return ok();
 }
 start(socket){const r=this.roomFor(socket),sid=socket.data.session.id;if(!r||r.hostId!==sid)return bad('hostOnly');if(r.status!=='waiting')return bad('alreadyStarted');if(r.players.length!==2||r.players.some(p=>!p.ready||!p.connected))return bad('needTwoReady');const players=[...r.players].sort((a,b)=>a.seat-b.seat);r.game=new Simulation({...r.settings,difficulty:'normal',nation:players[0].nation,slots:[{nation:players[1].nation,role:'enemy'}],multiplayer:true,humanOwners:['f0','f1']},crypto.randomInt(1,0x7fffffff));
  players.forEach((p,i)=>{p.factionId='f'+i;r.game.factions[i].commanderName=p.name;r.feeds.set(p.factionId,[]);});r.game.on(e=>{r.events.push({...e});if(r.events.length>500)r.events.shift();});r.status='running';r.paused=false;r.last=performance.now();r.accumulator=0;r.lastActive=Date.now();r.revision++;
  for(const p of r.players){const target=this.socketFor(p);if(target)target.emit('match:started',snapshot(r,p.factionId));}this.broadcastRoom(r);return ok();
 }
 socketFor(p){const s=[...this.sessions.values()].find(s=>s.id===p.sessionId);return s?.socketId?this.io.sockets.sockets.get(s.socketId):null;}
 command(socket,a){const s=socket.data.session,r=this.roomFor(socket);if(!r||r.status!=='running'||r.paused)return bad('matchPaused');if(!Number.isSafeInteger(a.id)||a.id<1||a.id>1e12||typeof a.type!=='string'||a.type.length>40)return bad('invalid');
  if(s.acks.has(a.id))return s.acks.get(a.id);if(s.lastCommand&&a.id<=s.lastCommand)return bad('staleCommand');
  const p=r.players.find(p=>p.sessionId===s.id);if(!p?.connected||!p.factionId)return bad('invalid');
  const result=GameCommands.apply(r.game,p.factionId,a.type,a.args||{});s.lastCommand=a.id;s.acks.set(a.id,result);while(s.acks.size>80)s.acks.delete(s.acks.keys().next().value);r.lastActive=Date.now();return result;
 }
 leave(socket){const s=socket.data.session,r=this.roomFor(socket);if(!r){s.room=null;return ok();}if(r.status!=='waiting'){this.closeRoom(r,'opponentLeft');return ok();}
  r.players=r.players.filter(p=>p.sessionId!==s.id);s.room=null;s.acks.clear();s.lastCommand=0;socket.leave(r.code);
  if(!r.players.length)this.rooms.delete(r.code);else{if(r.hostId===s.id)r.hostId=r.players[0].sessionId;this.broadcastRoom(r);}return ok();
 }
 closeRoom(r,reason){this.io.to(r.code).emit('room:closed',{reason});for(const p of r.players){const s=[...this.sessions.values()].find(s=>s.id===p.sessionId);if(s){s.room=null;s.lastCommand=0;s.acks.clear();if(s.socketId)this.io.sockets.sockets.get(s.socketId)?.leave(r.code);}}r.game?.listeners.splice(0);this.rooms.delete(r.code);}
 tick(){const now=performance.now(),wall=Date.now();
  for(const r of [...this.rooms.values()]){try{
   if(r.players.some(p=>!p.connected&&p.disconnectAt&&wall-p.disconnectAt>this.reconnectMs)){this.closeRoom(r,'reconnectExpired');continue;}
   if((r.status==='waiting'&&wall-r.lastActive>this.idleMs)||(r.status==='finished'&&wall-r.lastActive>120000)){this.closeRoom(r,'roomExpired');continue;}
   const dt=Math.min(.25,Math.max(0,(now-r.last)/1000));r.last=now;if(!r.game||r.status!=='running')continue;
   if(!r.paused){r.accumulator+=dt;let steps=0;while(r.accumulator>=CONFIG.step&&steps++<8){r.game.tick(CONFIG.step);r.accumulator-=CONFIG.step;}}
   if(now-r.lastBroadcast<100)continue;r.lastBroadcast=now;r.revision++;const events=r.events.splice(0);
   for(const f of r.game.factions)if(f.humanOffer&&f.humanOffer.expires<r.game.time)delete f.humanOffer;
   for(const p of r.players){const sock=this.socketFor(p);if(!sock)continue;const filtered=filteredEvents(r,p.factionId,events);addFeed(r,p.factionId,filtered);sock.emit('game:state',snapshot(r,p.factionId));if(filtered.length)sock.emit('game:events',{revision:r.revision,events:filtered});}
   if(r.game.ended){r.status='finished';r.lastActive=wall;this.broadcastRoom(r);}
  }catch(err){console.error('[room-fault]',r.code,err.stack);this.closeRoom(r,'serverError');}}
  for(const [token,s]of this.sessions)if(!s.room&&!s.socketId&&wall-s.lastSeen>this.idleMs)this.sessions.delete(token);
 }
}
module.exports={RoomService};
