'use strict';
const {Trajectory,tr}=require('./load-simulation.cjs');
const copy=x=>JSON.parse(JSON.stringify(x));
function visible(g,owner,o){return o.owner===owner||!g.options.intel||o.coverage||g.radarTracks(owner,o)||g.atlas.contains(g.faction(owner),o);}
function moving(g,owner,o){
 if(o.owner!==owner&&g.options.intel){
  const dt=.035,next=o.duration&&Number.isFinite(o.sx)?Trajectory.at(o,Math.min(1,(o.age+dt)/o.duration)):null;
  return {id:o.id,owner:o.owner,type:o.type,x:o.x,y:o.y,z:o.z||0,prev:o.prev||{x:o.x,y:o.y,z:o.z||0},
   vx:next?(next.x-o.x)/dt:(o.vx??Math.cos(o.heading||0)*(o.speed||0)),vy:next?(next.y-o.y)/dt:(o.vy??Math.sin(o.heading||0)*(o.speed||0)),vz:next?(next.z-(o.z||0))/dt:(o.vz||0),
   phase:o.mission?o.phase:Trajectory.phase(o),mission:o.mission,heading:o.heading||0,bank:o.bank||0,speed:o.speed||0,dead:o.dead,separated:o.separated,
   remoteTrack:true,trail:[],direction:o.direction||{x:1,y:0,z:0}};
 }
 const out=copy(o);delete out.engagements;delete out.willHit;delete out.salvo;out.trail=(out.trail||[]).slice(-32);return out;
}
function snapshot(room,owner){
 const g=room.game,f=g.faction(owner),ownStats=f.battleStats||{launched:0,intercepted:0,hits:0,lost:0,built:0};
 return {revision:room.revision,room:room.code,viewOwner:owner,time:g.time,started:true,ended:g.ended?(f.eliminated?'defeat':'victory'):null,paused:room.paused,
  nextId:g.nextId,options:copy(g.options),xp:f.commandXP||0,stats:copy(ownStats),warning:'',
  factions:g.factions.map(x=>{
   if(x.id===owner){const y=copy(x);y.role='player';return y;}
   return {id:x.id,nation:x.nation,commanderName:x.commanderName||null,role:x.team===f.team?'ally':'enemy',team:x.team,cx:x.cx,cy:x.cy,eliminated:x.eliminated,
    res:{money:0,oil:0,tech:0},stock:{},done:{},research:null,scientists:0,satisfaction:75,readiness:100,oilPrice:0,knowledge:{},
    truces:{[owner]:x.truces[owner]||0},offers:{pending:x.humanOffer?.from===owner?{from:owner}:null,incoming:f.humanOffer?.from===x.id?{expires:f.humanOffer.expires}:null},diplomaticInbox:[],directive:x.directive?copy(x.directive):null,ai:{state:'HUMAN',support:0},hold:false};
  }),
  entities:g.entities.filter(e=>e.owner===owner||e.kind==='city'||!g.options.intel).map(e=>{
   if(e.owner===owner)return copy(e);
   const {id,owner:entityOwner,kind,x,y,z,name,hp,maxHP,count,hits,damaged,dead,buildLeft,buildTotal,destroyedAt}=e;
   return {id,owner:entityOwner,kind,x,y,z,name,hp,maxHP,count,hits,damaged,dead,buildLeft,buildTotal,destroyedAt,queue:[],cooldowns:[]};
  }),
  missiles:g.missiles.filter(o=>!o.dead&&visible(g,owner,o)).map(o=>moving(g,owner,o)),
  aircraft:g.aircraft.filter(o=>!o.dead&&visible(g,owner,o)).map(o=>moving(g,owner,o)),
  interceptors:g.interceptors.filter(o=>!o.dead&&visible(g,owner,o)).map(o=>moving(g,owner,o)),
  satellites:g.satellites.filter(o=>!o.dead).map(copy),
  boosters:g.boosters.filter(o=>o.life>0&&visible(g,owner,o)).map(copy),
  operations:g.operations.filter(o=>o.owner===owner).map(copy),news:(room.feeds.get(owner)||[]).slice(0,36),lastEvents:[]};
}
function filteredEvents(room,owner,events){
 const g=room.game,f=g.faction(owner),out=[];
 for(const e of events){
  if(['NEWS','GAME_OVER','CITIZEN_VOICE'].includes(e.type))continue;
  if(['RESEARCH_STARTED','RESEARCH_COMPLETE','SCIENTIST_HIRED','OIL_PRODUCED','OIL_SOLD','WEAPON_COMPLETE','WEAPON_SOLD','WEAPON_BOUGHT','BUILD_ORDER','BUILD_COMPLETE','OPERATION_STARTED'].includes(e.type)&&e.owner!==owner)continue;
  if(g.options.intel&&e.owner&&e.owner!==owner){
   const ent=e.entity?g.object(e.entity):null;
   if(ent&&ent.kind!=='city'&&(f.knowledge[ent.id]?.level||0)<2)continue;
   if(Number.isFinite(e.x)&&Number.isFinite(e.y)&&!g.atlas.contains(f,e)&&!g.radarTracks(owner,{...e,z:e.z||0})&&!['TRUCE','TRUCE_OFFER','TRUCE_DECLINED','TRUCE_BROKEN','DIPLO_REQUEST','DIPLO_RESPONSE'].includes(e.type))continue;
  }
  const safe=copy(e);delete safe.success;delete safe.willHit;out.push(safe);
 }
 return out;
}
function addFeed(room,owner,events){
 const list=room.feeds.get(owner)||[];
 for(const e of events){let text='';
  if(e.type==='BUILD_COMPLETE')text=tr('built');
  if(e.type==='MISSILE_LAUNCHED')text=tr(e.payloadType)+' '+tr('launched');
  if(e.type==='MISSILE_INTERCEPTED')text=tr(e.payloadType)+' '+tr('intercepted');
  if(e.type==='RESEARCH_COMPLETE')text=tr(e.key)+' '+tr('completed');
  if(e.type==='TRUCE')text=tr('truce');
  if(e.type==='TRUCE_BROKEN')text=tr('truceBroken');
  if(text)list.unshift({id:'net-'+room.revision+'-'+list.length,time:e.time,text,tone:e.owner===owner?'good':'warn',point:Number.isFinite(e.x)?{x:e.x,y:e.y}:null});
 }
 room.feeds.set(owner,list.slice(0,36));
}
module.exports={snapshot,filteredEvents,addFeed};
