'use strict';
/* The exact same command gateway runs offline and on the authoritative server.
 * No command accepts health, damage, resources, owner IDs or client outcomes.
 */
const GameCommands={
 finite(v){return typeof v==='number'&&Number.isFinite(v);},
 point(a){return a&&this.finite(a.x)&&this.finite(a.y)&&Math.abs(a.x)<10000&&Math.abs(a.y)<10000;},
 integer(v,min,max){return Number.isSafeInteger(v)&&v>=min&&v<=max;},
 apply(g,owner,type,a={}){
  const f=g.faction(owner);if(!f||f.eliminated||g.ended||!a||typeof a!=='object'||Array.isArray(a))return{ok:false,error:'invalid'};
  const previous=g.viewOwner;g.viewOwner=owner;
  const owned=id=>{const e=typeof id==='string'?g.object(id):null;return e&&e.owner===owner&&!e.dead?e:null;};
  const fail=()=>g.error('invalid');
  try{
   switch(type){
    case'build':if(!Object.hasOwn(STRUCTURES,a.kind)||a.kind==='city'||!this.point(a))return fail();return g.build(owner,a.kind,{x:a.x,y:a.y});
    case'launchMissile':if(!Object.hasOwn(WEAPONS,a.weapon)||!this.point(a))return fail();return g.launch(owner,a.weapon,{x:a.x,y:a.y});
    case'produce':if(!Object.hasOwn(WEAPONS,a.weapon)||!this.integer(a.count,1,20)||(a.site&&!owned(a.site)))return fail();return g.queueWeapon(owner,a.weapon,a.count,a.site||null);
    case'cancelBuild':if(!owned(a.id))return fail();return g.cancelConstruction(a.id,owner);
    case'cancelQueue':if(!owned(a.id))return fail();return g.cancelQueue(a.id,owner);
    case'factoryAuto':return g.setFactoryAuto(owner,a.id,a.weapon,a.enabled);
    case'research':if(!Object.hasOwn(RESEARCH,a.key))return fail();return g.startResearch(owner,a.key);
    case'hireScientists':return g.hire(owner);
    case'sellOil':return g.sellOil(owner,50);
    case'autoSell':if(typeof a.enabled!=='boolean')return fail();f.autoSell=a.enabled;return g.ok();
    case'sellWeapon':if(!Object.hasOwn(WEAPONS,a.weapon)||!this.integer(a.count,1,100000))return fail();return g.sellWeapon(a.weapon,a.count,owner);
    case'buyWeapon':if(!Object.hasOwn(WEAPONS,a.weapon)||!this.integer(a.count,1,20))return fail();return g.buyWeapon(owner,a.weapon,a.count);
    case'aircraft':if(!['patrol','strike','recon'].includes(a.mission)||(a.mission!=='patrol'&&!this.point(a)))return fail();return g.launchAircraft(owner,a.mission,a.mission==='patrol'?null:{x:a.x,y:a.y});
    case'satellite':if(!this.point(a))return fail();return g.launchSatellite(owner,{x:a.x,y:a.y});
    case'asat':if(typeof a.id!=='string')return fail();return g.launchAsat(owner,a.id);
    case'operation':{
     if(!Array.isArray(a.waves)||!a.waves.length||a.waves.length>g.operationSlots(owner))return fail();
     for(const w of a.waves)if(!this.point(w)||!this.integer(w.count,1,8)||!this.finite(w.delay)||w.delay<0||w.delay>90||!['fighter',...Object.keys(WEAPONS).filter(k=>k!=='asat')].includes(w.type))return fail();
     return g.scheduleOperation(owner,a.waves.map(w=>({type:w.type,count:w.count,delay:w.delay,x:w.x,y:w.y})));
    }
    case'cancelOperation':{const o=g.operations.find(o=>o.id===a.id);if(!o||o.owner!==owner)return fail();return g.cancelOperation(o.id);}
    case'intel':return g.error('intelLocked');
    case'truce':if(g.options.multiplayer)return this.requestHumanTruce(g,owner,a.id);return g.requestTruce(a.id);
    case'respondTruce':if(typeof a.accept!=='boolean')return fail();if(g.options.multiplayer)return this.respondHumanTruce(g,owner,a.id,a.accept);return g.respondTruce(a.id,a.accept);
    case'breakTruce':{const other=g.faction(a.id);if(!other||!g.faction(owner))return fail();return g.breakTruce(owner,other.id,owner);}
    case'hold':{const ally=g.faction(a.id);if(!ally||ally.team!==f.team||ally.id===owner||typeof a.enabled!=='boolean'||g.isHuman(ally.id))return fail();ally.hold=a.enabled;if(ally.hold)for(const op of g.operations.filter(o=>o.owner===ally.id&&!o.done))g.cancelOperation(op.id);return g.ok();}
    case'support':if(!['money','oil','ballistic'].includes(a.resource))return fail();return g.support(a.id,a.resource);
    case'allyOrder':{const ally=g.faction(a.id);if(!ally||ally.team!==f.team||ally.id===owner||g.isHuman(ally.id)||!this.point(a)||!g.validTarget(ally.id,a))return fail();ally.ai.order={x:a.x,y:a.y};ally.ai.attack=0;return g.ok();}
    case'diplomaticRequest':if(typeof a.id!=='string'||!['money','missile','command'].includes(a.kind))return fail();return g.diplomaticRequest(owner,a.id,a.kind,a);
    case'respondDiplomatic':if(typeof a.id!=='string'||typeof a.accept!=='boolean')return fail();return g.respondDiplomaticRequest(owner,a.id,a.accept);
    default:return fail();
   }
  }finally{g.viewOwner=previous;}
 },
 requestHumanTruce(g,from,to){
  const a=g.faction(from),b=g.faction(to);if(!a||!b||!g.hostile(from,to)||g.time<(a.nextTruceOffer||0)||b.humanOffer)return g.error('cooldown');
  a.nextTruceOffer=g.time+30;b.humanOffer={from,to,expires:g.time+25};g.emit('TRUCE_OFFER',{owner:from,to});return g.ok();
 },
 respondHumanTruce(g,owner,other,accept){
  const f=g.faction(owner),o=f?.humanOffer;if(!o||o.from!==other||o.expires<=g.time)return g.error('invalid');delete f.humanOffer;
  if(accept)g.setTruce(owner,other);else g.emit('TRUCE_DECLINED',{owner,to:other});return g.ok();
 }
};
