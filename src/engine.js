/* ======================================================================
   REBORN simulation. Pure state, seeded randomness, stable entity IDs.
   No DOM access. Positions and ranges are fictional game units.
   ====================================================================== */
class Simulation {
 constructor(options={},seed=Date.now(),map=atlas){
  this.atlas=map;this.rng=new Random(seed);this.listeners=[];this.options={style:'arcade',difficulty:'normal',intel:true,prep:120,nation:'iran',slots:[{nation:'russia',role:'ally'},{nation:'israel',role:'enemy'},{nation:'china',role:'enemy'}],...options};
  this.time=0;this.nextId=1;this.ended=null;this.started=false;this.factions=[];this.entities=[];this.missiles=[];this.aircraft=[];this.interceptors=[];this.satellites=[];this.boosters=[];this.operations=[];this.news=[];this.lastEvents=[];this.xp=0;this.stats={launched:0,intercepted:0,hits:0,lost:0,built:0};this._index=new Map();this._tick=0;this._warNotified=false;this._incomeTick=0;this._commentAt=0;this.warning='';
  this.options.startMoney=clamp(Math.round(Number(this.options.startMoney)||CONFIG.startingMoney),3000,100000);if(!CONFIG.difficulties[this.options.difficulty])this.options.difficulty='normal';this.options.prep=clamp(Number(this.options.prep)||0,0,600);this.initialize();
 }
 isHuman(owner){return (this.options.humanOwners||[]).includes(owner)}
 record(owner,key=null,xp=0){const f=this.faction(owner);if(!f)return;f.battleStats=f.battleStats||{launched:0,intercepted:0,hits:0,lost:0,built:0};if(key)f.battleStats[key]=(f.battleStats[key]||0)+1;f.commandXP=(f.commandXP||0)+xp;if(owner===this.factions[0]?.id){if(key)this.stats[key]++;this.xp+=xp;}}
 get real(){return this.options.style==='realistic'}
 get player(){return this.factions.find(f=>f.id===this.viewOwner)||this.factions[0]}
 id(prefix){return prefix+(this.nextId++)}
 on(fn){this.listeners.push(fn);return()=>{this.listeners=this.listeners.filter(f=>f!==fn)}}
 emit(type,data={}){const e={...data,payloadType:data.type,type,time:this.time};this.lastEvents.push(e);if(this.lastEvents.length>150)this.lastEvents.shift();for(const fn of this.listeners)fn(e);return e}
 notice(text,tone='info',point=null){this.news.unshift({id:this.id('n'),time:this.time,text,tone,point});this.news.length=Math.min(this.news.length,36);this.emit('NEWS',{text,tone,point})}
 error(key){this.warning=key;return{ok:false,error:key}}
 ok(data={}){this.warning='';return{ok:true,...data}}
 initialize(){
  if(!NATIONS[this.options.nation])this.options.nation='iran';
  const used=new Set([this.options.nation]);const raw=[{nation:this.options.nation,role:'player'}];
  for(const slot of this.options.slots||[]){const duplicateOK=!!this.options.multiplayer;if(NATIONS[slot.nation]&&(duplicateOK||!used.has(slot.nation))&&['ally','enemy'].includes(slot.role)&&raw.length<6){raw.push(slot);used.add(slot.nation)}}
  if(!raw.some(x=>x.role==='enemy')){const n=Object.keys(NATIONS).find(n=>!used.has(n));raw.push({nation:n,role:'enemy'})}
  const anchors=[[0,0],[-1320,-550],[1300,-560],[1250,720],[-1270,750],[0,1260]];
  raw.forEach((slot,i)=>{const [cx,cy]=anchors[i],f={id:'f'+i,nation:slot.nation,role:slot.role,team:slot.role==='enemy'?1:0,cx,cy,res:{money:this.options.startMoney,oil:CONFIG.startingOil,tech:CONFIG.startingTech},stock:Object.fromEntries(Object.keys(WEAPONS).map(k=>[k,0])),done:{},research:null,scientists:0,satisfaction:75,readiness:100,oilPrice:300,marketTimer:12,autoSell:false,sellTimer:8,knowledge:{},truces:{},offers:{},lastHit:-999,lastAttack:-999,lastDefense:-999,lastSuccess:-999,comment:'cCalm',hold:false,eliminated:false,ai:{state:'ECONOMIC_BUILDUP',think:3+i,attack:25+i*4,recon:0,offer:100,support:0,order:null,pressure:0,truceBreakAt:0,lastPressureOffer:-999},income:0,upkeep:0,techRate:0,diplomaticInbox:[],directive:null,commanderName:slot.commanderName||null};this.factions.push(f);
   const nation=NATIONS[f.nation];nation.uv.forEach((uv,j)=>{const p=this.atlas.snap(f,uv[0],uv[1],f.nation==='israel'?18:22);this.addEntity(f.id,'city',p,{name:nation.cities[j],ready:true})});
  });this.started=true;this.notice(tr('beginHint'),'good',{x:0,y:0});
 }
 faction(id){return this.factions.find(f=>f.id===id)}
 object(id){return this._index.get(id)||this.entities.find(e=>e.id===id)||this.missiles.find(e=>e.id===id)||this.aircraft.find(e=>e.id===id)||this.satellites.find(e=>e.id===id)||null}
 reindex(){this._index.clear();for(const list of [this.entities,this.missiles,this.aircraft,this.satellites])for(const e of list)this._index.set(e.id,e)}
 alive(owner,kind=null){return this.entities.filter(e=>!e.dead&&e.owner===owner&&(!kind||e.kind===kind))}
 operational(owner,kind){return this.alive(owner,kind).filter(e=>e.buildLeft<=0)}
 hostile(a,b){if(a===b)return false;const fa=this.faction(a),fb=this.faction(b);return!!(fa&&fb&&!fa.eliminated&&!fb.eliminated&&fa.team!==fb.team&&(fa.truces[b]||0)<=this.time)}
 countryAt(point){return this.factions.find(f=>!f.eliminated&&this.atlas.contains(f,point))||null}
 efficiency(e){return e.dead||e.buildLeft>0?0:(this.real&&e.damaged?.5:1)*(.75+.25*(this.faction(e.owner)?.readiness??100)/100)}
 range(e){const f=this.faction(e.owner);return (STRUCTURES[e.kind]?.range||0)*(f?.done.defense?(e.kind==='radar'?1.20:1.06):1)*(e.kind==='radar'?this.nationPerk(f,'radarRange',1):1)*(e.damaged?.76:1)}
 canAfford(f,cost){return Object.entries(cost).every(([key,value])=>Number.isFinite(value)&&f.res[key]>=value)}
 pay(f,cost){if(!this.canAfford(f,cost))return false;for(const [k,v]of Object.entries(cost))f.res[k]-=v;return true}
 refund(f,cost){for(const[k,v]of Object.entries(cost))f.res[k]+=v}
 builtCount(owner,kind){return this.alive(owner,kind).reduce((a,e)=>a+e.count+(e.expansion?1:0),0)}
 buildCost(owner,kind){const d=STRUCTURES[kind];if(!d||kind==='city')return null;const f=this.faction(owner),n=this.builtCount(owner,kind);return{money:Math.round(d.cost*(this.real?1.08:1)*(this.real?1+Math.min(.5,n*.024):1)),oil:this.real?d.oil:0}}
 buildTime(owner,kind){const f=this.faction(owner);return STRUCTURES[kind].build*(this.real?1: .16)/(f.done.industry?1.2:1)}
 stackCap(f){return (this.real?CONFIG.stackRealistic:CONFIG.stackArcade)+(f.nation==='israel'?2:0)}
 structureUnlocked(owner,kind){const r=STRUCTURES[kind]?.research;return !!STRUCTURES[kind]&&(!r||!!this.faction(owner)?.done[r]);}
 placement(owner,kind,p){const f=this.faction(owner),d=STRUCTURES[kind];if(!f||!d||kind==='city'||!Number.isFinite(p.x)||!Number.isFinite(p.y))return{valid:false,reason:'invalid'};if(!this.structureUnlocked(owner,kind))return{valid:false,reason:'locked'};const narrow=this.atlas.bounds(f).w<450,spacing=narrow?33:48;
  if(!this.atlas.contains(f,p,narrow?7:12))return{valid:false,reason:'invalid'};
  const objects=this.alive(owner),near=objects.find(e=>e.kind===kind&&distance(e,p)<25&&e.buildLeft<=0);
  if(near&&kind!=='airbase')return{valid:near.count<this.stackCap(f)&&!near.expansion,stack:near,reason:'stackFull'};
  return{valid:objects.every(e=>distance(e,p)>(e.kind==='city'?spacing+8:spacing)),reason:'invalid'};
 }
 addEntity(owner,kind,p,extra={}){const d=STRUCTURES[kind],e={id:this.id('e'),owner,kind,x:p.x,y:p.y,z:0,name:tr(kind),hp:d.hp,maxHP:d.hp,count:1,hits:0,damaged:false,dead:false,buildLeft:extra.ready?0:this.buildTime(owner,kind),buildTotal:extra.ready?0:this.buildTime(owner,kind),expansion:null,cooldowns:[0],queue:[],auto:null,oilProgress:0,ammo:120,reload:0,defCD:0,airCD:0,...extra};this.entities.push(e);this._index.set(e.id,e);return e}
 build(owner,kind,p){const f=this.faction(owner),placement=this.placement(owner,kind,p),cost=this.buildCost(owner,kind);if(!placement.valid)return this.error(placement.reason);if(!cost||!this.pay(f,cost))return this.error('noFunds');let e;
  if(placement.stack){e=placement.stack;e.expansion={left:this.buildTime(owner,kind),total:this.buildTime(owner,kind),cost};}else{e=this.addEntity(owner,kind,p);e.buildCost=cost;}
  this.emit('BUILD_ORDER',{entity:e.id,owner,x:e.x,y:e.y});return this.ok({entity:e.id})}
 cancelConstruction(id,owner=this.player.id){const e=this.object(id);if(!e||e.dead||e.owner!==owner)return this.error('invalid');const f=this.faction(owner);if(e.expansion){this.refund(f,e.expansion.cost);e.expansion=null}else if(e.buildLeft>0){this.refund(f,e.buildCost);e.dead=true;e.hp=0;e.destroyedAt=this.time}else return this.error('invalid');return this.ok()}
 factoryCapacity(e){return Math.pow(e.count,.66)}
 weaponCost(type){const d=WEAPONS[type];return{money:Math.round(d.cost*(this.real?1.14:1)),oil:this.real?d.oil:0}}
 productionTime(owner,type){const f=this.faction(owner),nation=type==='hyper'?this.nationPerk(f,'hyperTime',1):1;return WEAPONS[type].time*(this.real?1.32:1)*nation/(f.done.industry?1.25:1)}
 unlocked(f,type){const r=WEAPONS[type]?.research;return!!WEAPONS[type]&&(!r||!!f.done[r])&&(type!=='asat'||this.options.intel)}
 queueWeapon(owner,type,quantity=1,siteId=null){const f=this.faction(owner);if(!Number.isFinite(quantity))return this.error('invalid');quantity=clamp(Math.floor(quantity),1,20);if(!this.unlocked(f,type))return this.error('locked');const factories=this.operational(owner,'factory').filter(e=>e.queue.length<CONFIG.maxQueue).sort((a,b)=>(a.queue.length/a.count)-(b.queue.length/b.count));let site=siteId?factories.find(e=>e.id===siteId):factories[0];if(!site)return this.error('noFactory');if(site.queue.length+quantity>CONFIG.maxQueue)return this.error('queueFull');const unit=this.weaponCost(type),cost={money:unit.money*quantity,oil:unit.oil*quantity};if(!this.pay(f,cost))return this.error('noFunds');for(let i=0;i<quantity;i++)site.queue.push({type,left:this.productionTime(owner,type),total:this.productionTime(owner,type),cost:{...unit}});return this.ok({site:site.id})}
 cancelQueue(id,owner=this.player.id){const site=this.object(id);if(!site||site.owner!==owner||!site.queue.length)return this.error('invalid');const f=this.faction(owner);for(const item of site.queue)this.refund(f,item.cost);site.queue=[];site.auto=null;return this.ok()}
 setFactoryAuto(owner,id,weapon,enabled){const f=this.faction(owner),e=this.object(id);if(!f||!e||e.owner!==owner||e.kind!=='factory'||!this.unlocked(f,weapon)||typeof enabled!=='boolean')return this.error('invalid');if(enabled&&e.auto&&e.auto!==weapon&&e.queue.length===1&&e.queue[0].type===e.auto){this.refund(f,e.queue[0].cost);e.queue=[];}e.auto=enabled?weapon:null;if(e.auto&&e.queue.length===0){const r=this.queueWeapon(owner,e.auto,1,e.id);if(!r.ok){e.auto=null;return r;}}return this.ok({site:e.id,auto:e.auto})}
 startResearch(owner,key){const f=this.faction(owner),r=RESEARCH[key];if(!r||f.done[key]||r.requires.some(k=>!f.done[k])||(!this.options.intel&&['satellite','asat'].includes(key)))return this.error('locked');if(f.research)return this.error('researchBusy');if(f.res.tech<r.cost)return this.error('noFunds');f.res.tech-=r.cost;const rt=r.time*(this.real?1.1:1)*this.nationPerk(f,'researchTime',1);f.research={key,left:rt,total:rt};this.emit('RESEARCH_STARTED',{owner,key});return this.ok()}
 scienceOffer(f=this.player){return{cost:Math.round(1600*Math.pow(1.25,f.scientists)/25)*25,gain:Math.max(12,22-f.scientists),rate:.025}}
 hire(owner=this.player.id){const f=this.faction(owner),o=this.scienceOffer(f);if(f.scientists>=12)return this.error('stackFull');if(f.res.money<o.cost)return this.error('noFunds');f.res.money-=o.cost;f.res.tech+=o.gain;f.scientists++;this.emit('SCIENTIST_HIRED',{owner});return this.ok()}
 bonus(f){return clamp((f.satisfaction-70)/30,0,1)}
 nationPerk(f,key,fallback=1){if(!this.options.multiplayer||!f)return fallback;const p=NATION_PERKS[f.nation];return p&&p[key]!==undefined?p[key]:fallback}
 oilPrice(f=this.player){return Math.round(f.oilPrice*(f.done.oiltech?1.5:1)*(1+.22*this.bonus(f))*this.nationPerk(f,'oilSale',1))}
 sellOil(owner=this.player.id,amount=50){const f=this.faction(owner);if(!Number.isFinite(amount))return this.error('invalid');amount=Math.min(100,Math.floor(f.res.oil),Math.floor(amount));if(amount<1)return this.error('noFunds');const earned=Math.round(this.oilPrice(f)*amount/50);f.res.oil-=amount;f.res.money+=earned;this.emit('OIL_SOLD',{owner,earned,amount});return this.ok({earned})}
 sellWeapon(type,quantity=1,owner=this.player.id){const f=this.faction(owner);if(!WEAPONS[type]||!Number.isFinite(quantity))return this.error('invalid');const n=Math.min(f.stock[type],Math.max(1,Math.floor(quantity)));if(n<1)return this.error('noAmmo');const earned=Math.floor(this.weaponCost(type).money/2)*n;f.stock[type]-=n;f.res.money+=earned;this.emit('WEAPON_SOLD',{owner,type,n,earned});return this.ok({earned})}
 buyWeapon(owner,type,quantity=1){const f=this.faction(owner);if(!WEAPONS[type]||type==='asat'||!Number.isFinite(quantity))return this.error('invalid');quantity=clamp(Math.floor(quantity),1,20);if(!this.unlocked(f,type))return this.error('locked');const unit=this.weaponCost(type),price=Math.round(unit.money*2),cost={money:price*quantity};if(!this.pay(f,cost))return this.error('noFunds');f.stock[type]+=quantity;this.emit('WEAPON_BOUGHT',{owner,type,n:quantity,spent:cost.money});return this.ok({weapon:type,count:quantity,spent:cost.money})}
 updateEconomy(dt){for(const f of this.factions){if(f.eliminated)continue;const alive=this.operational(f.id,null),units=alive.reduce((s,e)=>s+(e.kind!=='city'?e.count:0),0),maintenance=alive.reduce((s,e)=>s+STRUCTURES[e.kind].upkeep*e.count,0)+(Object.values(f.stock).reduce((a,b)=>a+b,0))*.008,modifier=f.role==='enemy'&&!this.options.multiplayer?CONFIG.difficulties[this.options.difficulty].income:1;
   f.income=CONFIG.baseIncome*(this.real?1:1.15)*(f.done.economy?1.25:1)*modifier;f.upkeep=this.real?maintenance*(f.done.economy?.85:1):maintenance*.16;const available=f.res.money+(f.income-f.upkeep)*dt;f.res.money=Math.max(0,available);if(available<0)f.readiness=clamp(f.readiness-dt*1.2,40,100);else f.readiness=clamp(f.readiness+dt*.14,40,100);
   f.techRate=(CONFIG.baseTech+f.scientists*.025)*(1+.25*this.bonus(f));f.res.tech+=f.techRate*dt;
   f.marketTimer-=dt;if(f.marketTimer<=0){f.marketTimer=18;f.oilPrice=clamp(f.oilPrice+this.rng.range(-16,16),250,375)}
   f.sellTimer-=dt;if(f.sellTimer<=0){f.sellTimer=8;if(f.autoSell&&f.res.oil>50)this.sellOil(f.id,f.res.oil-50);if(f.role!=='player'&&!this.isHuman(f.id)&&(f.res.money<3500||f.res.oil>160)&&f.res.oil>=50)this.sellOil(f.id,Math.min(f.res.oil-30,100))}
   if(f.research){f.research.left-=dt;if(f.research.left<=0){const key=f.research.key;f.done[key]=true;f.research=null;this.record(f.id,null,12);if(f.role==='player'){this.notice(tr(key)+' '+tr('completed'),'good');}this.emit('RESEARCH_COMPLETE',{owner:f.id,key});}}
   if(this.aircraft.some(a=>!a.dead&&a.owner===f.id&&a.mission==='patrol'&&a.phase!=='return'))f.satisfaction=clamp(f.satisfaction+.028*dt,0,100);
   if(this.time<this.options.prep)f.satisfaction=clamp(f.satisfaction+.009*dt,0,100);
  }}
 updateConstruction(dt){for(const e of this.entities){if(e.dead)continue;const f=this.faction(e.owner);if(f.eliminated)continue;
   if(e.buildLeft>0){e.buildLeft=Math.max(0,e.buildLeft-dt);if(!e.buildLeft){this.record(f.id,'built',3);if(f.role==='player'){this.notice(tr(e.kind)+' '+tr('built'),'good',{x:e.x,y:e.y})}this.emit('BUILD_COMPLETE',{owner:e.owner,entity:e.id,x:e.x,y:e.y})}continue;}
   if(e.expansion){e.expansion.left-=dt;if(e.expansion.left<=0){e.expansion=null;e.count++;e.cooldowns.push(0);this.emit('BUILD_COMPLETE',{owner:e.owner,entity:e.id,x:e.x,y:e.y});}}
   const eff=this.efficiency(e);e.cooldowns=e.cooldowns.map(t=>Math.max(0,t-dt*eff));e.defCD=Math.max(0,e.defCD-dt*eff);e.airCD=Math.max(0,e.airCD-dt*eff);
   if(e.kind==='oilrig'){e.oilProgress+=dt*e.count*eff*(f.done.oiltech?1.5:1);const cycle=this.real?21:16;while(e.oilProgress>=cycle){e.oilProgress-=cycle;f.res.oil+=28;this.emit('OIL_PRODUCED',{owner:f.id,entity:e.id,amount:28})}}
   if(e.kind==='factory'){if(e.auto&&e.queue.length<1)this.queueWeapon(e.owner,e.auto,1,e.id);let work=dt*this.factoryCapacity(e)*eff*this.nationPerk(f,'factorySpeed',1);while(e.queue.length&&work>0){const item=e.queue[0],used=Math.min(item.left,work);item.left-=used;work-=used;if(item.left<=.0001){f.stock[item.type]++;e.queue.shift();this.emit('WEAPON_COMPLETE',{owner:e.owner,type:item.type,entity:e.id})}else break;}}
   if(e.kind==='aaa'&&e.ammo<=0){e.reload+=dt;if(e.reload>=9&&this.pay(f,{money:40})){e.ammo=120*e.count;e.reload=0}}
  }}
 tick(dt=CONFIG.step){if(this.ended||!Number.isFinite(dt)||dt<=0)return;this.time+=dt;this._tick++;this.reindex();this.updateEconomy(dt);this.updateConstruction(dt);this.updateOperations(dt);this.updateSatellites(dt);this.updateAircraft(dt);this.updateMissiles(dt);this.updateDefense(dt);this.updateInterceptors(dt);this.updateBoosters(dt);this.updateAI(dt);this.updateDiplomacy(dt);
   if(this.time>=this.options.prep&&!this._warNotified){this._warNotified=true;this.notice(tr('combat'),'warn');this.emit('HOSTILITIES_ACTIVE')}
   if(this.time>=this._commentAt){this._commentAt=this.time+5;for(const f of this.factions)if(f.role==='player'||this.isHuman(f.id))this.updateCitizenVoice(f.id)}
   if(this._tick%30===0){this.cleanup();this.checkEnd()}
 }
 updateCitizenVoice(owner=this.player.id){const f=this.faction(owner),stock=Object.values(f.stock).reduce((a,b)=>a+b,0),pick=list=>{const pool=list.filter(k=>k!==f.comment);return this.rng.pick(pool.length?pool:list)};let pool;if(this.time-f.lastHit<18)pool=['cHit','cHit2','cHit3','cHit4'];else if(this.time-f.lastDefense<20)pool=['cDefense','cDefense2','cDefense3','cDefense4'];else if(this.time-f.lastSuccess<25)pool=['cAttack','cAttack2','cAttack3','cAttack4'];else if(this.aircraft.some(a=>!a.dead&&a.owner===f.id&&a.mission==='patrol'))pool=['cPatrol','cPatrol2','cPatrol3'];else if(f.res.money<700)pool=['cBudget','cBudget2','cBudget3'];else if(this.time<this.options.prep)pool=['cCalm','cCalm2','cCalm3'];else if(stock<2)pool=['cNoAmmo','cNoAmmo2','cNoAmmo3'];else if(this.time-f.lastAttack>55)pool=['cWait','cWait2','cWait3','cWait4'];else pool=['cCalm','cCalm2','cAttack4','cDefense4'];f.comment=pick(pool);this.emit('CITIZEN_VOICE',{owner:f.id,text:tr(f.comment)})}
 cleanup(){this.entities=this.entities.filter(e=>!e.dead||this.time-e.destroyedAt<90);this.missiles=this.missiles.filter(e=>!e.dead);this.aircraft=this.aircraft.filter(e=>!e.dead);this.satellites=this.satellites.filter(e=>!e.dead);this.interceptors=this.interceptors.filter(e=>!e.dead);this.boosters=this.boosters.filter(e=>e.life>0);this.operations=this.operations.filter(e=>!e.done||this.time-e.completedAt<30);this.reindex()}
 checkEnd(){for(const f of this.factions){if(!f.eliminated&&!this.alive(f.id,'city').length){f.eliminated=true;for(const e of this.alive(f.id))this.destroy(e);for(const o of this.operations.filter(o=>o.owner===f.id&&!o.done))this.cancelOperation(o.id);this.notice(tr(f.nation)+' : '+tr('destroyed'),f.role==='enemy'?'good':'bad');}}
  if(this.player.eliminated)this.ended='defeat';else if(!this.factions.some(f=>f.role==='enemy'&&!f.eliminated))this.ended='victory';if(this.ended)this.emit('GAME_OVER',{result:this.ended})}
 /* ---- Intelligence: observations, not access to hidden enemy state ---- */
 observe(owner,target,level=1){const f=this.faction(owner);if(!f||target.dead)return;const previous=f.knowledge[target.id],old=previous&&this.time-previous.time<90?previous:null;f.knowledge[target.id]={id:target.id,owner:target.owner,x:target.x,y:target.y,time:this.time,level:Math.max(level,old&&this.time-old.time<90?old.level:0),kind:level>=2?target.kind:old?.kind,name:level>=2?target.name:old?.name,hp:level>=2?target.hp:old?.hp,maxHP:level>=2?target.maxHP:old?.maxHP,count:level>=2?target.count:old?.count};}
 intelLevel(owner,target){if(!target)return 0;const f=this.faction(owner),of=this.faction(target.owner);if(!this.options.intel||f.team===of?.team||target.kind==='city')return 2;const k=f.knowledge[target.id];return k&&this.time-k.time<180?k.level:0}
 knownTargets(owner,targetOwner=null,exact=false){const f=this.faction(owner);if(!this.options.intel)return this.entities.filter(e=>!e.dead&&this.hostile(owner,e.owner)&&(!targetOwner||e.owner===targetOwner));const out=[];for(const k of Object.values(f.knowledge)){if(this.time-k.time<140&&(!exact||k.level===2)&&this.hostile(owner,k.owner)&&(!targetOwner||k.owner===targetOwner))out.push({...k,kind:k.level===2?k.kind:'unknown'});}return out}
 reconNeeded(owner=this.player.id){const f=this.faction(owner);if(!this.options.intel||!f)return false;return this.entities.some(e=>!e.dead&&e.kind!=='city'&&this.hostile(owner,e.owner)&&this.intelLevel(owner,e)<2)}
 radarTracks(owner,p){return this.operational(owner,'radar').some(r=>distance(r,p)<=this.range(r)&&(p.z||0)<620)}
 setIntel(enabled){this.options.intel=!!enabled;if(!enabled){for(const f of this.factions)if(f.research&&['satellite','asat'].includes(f.research.key)){f.res.tech+=RESEARCH[f.research.key].cost;f.research=null}for(const s of this.satellites)s.dead=true;for(const a of this.aircraft)if(a.mission==='recon')a.phase='return';}this.emit('INTEL_RULE',{enabled:!!enabled});return this.ok()}
 launcher(owner){return this.operational(owner,'launcher').filter(e=>e.cooldowns.some(t=>t<=0)).sort((a,b)=>a.cooldowns.filter(t=>t>0).length-b.cooldowns.filter(t=>t>0).length)[0]||null}
 launchTokens(owner){const f=this.faction(owner),limit=5;if(!f)return 0;let b=f.launchBudget;if(!b){f.launchBudget={tokens:limit,resumeAt:0};return limit}if(b.resumeAt&&this.time>=b.resumeAt){b.tokens=limit;b.resumeAt=0}return clamp(b.tokens??limit,0,limit)}
 takeLaunchToken(owner){const f=this.faction(owner),limit=5,cooldown=3,n=this.launchTokens(owner);if(!f||n<1)return false;const remaining=n-1;f.launchBudget={tokens:remaining,resumeAt:remaining<=0?this.time+cooldown:(f.launchBudget?.resumeAt||0)};return true}
 consumeLauncher(l){const i=l.cooldowns.findIndex(t=>t<=0);if(i<0)return false;l.cooldowns[i]=(this.real?14:8);l.launchAt=this.time;return true}
 validTarget(owner,p){const f=this.countryAt(p);return !!f&&this.hostile(owner,f.id)}
 launch(owner,type,p,reserved=false){
  const f=this.faction(owner);if(!WEAPONS[type]||type==='asat')return this.error('invalid');if(this.time<this.options.prep)return this.error('waitPrep');if(!this.validTarget(owner,p))return this.error('noTarget');if(!this.unlocked(f,type))return this.error('locked');if(!reserved&&f.stock[type]<1)return this.error('noAmmo');
  const l=this.launcher(owner);if(!l)return this.error('noLauncher');if(this.launchTokens(owner)<1)return this.error('launchLogistics');
  let target={x:p.x,y:p.y,id:p.id||null};
  // AF V3 reference accuracy model: realistic mode keeps weapon-specific spread,
  // while a locked/identified object gets a smaller error ellipse.
  if(this.real){const bands={ballistic:[10,27],cruise:[4,14],hyper:[7,20],drone:[5,15],rain:[26,58],heavy:[12,32]},band=bands[type]||[8,20],scale=target.id?.62:1,ang=this.rng.range(0,Math.PI*2),err=this.rng.range(band[0],band[1])*scale;target={...target,x:target.x+Math.cos(ang)*err,y:target.y+Math.sin(ang)*err};}
  this.takeLaunchToken(owner);if(!reserved)f.stock[type]--;this.consumeLauncher(l);
  const m={id:this.id('m'),owner,type,sx:l.x,sy:l.y,sz:0,tx:target.x,ty:target.y,tz:0,x:l.x,y:l.y,z:0,prev:{x:l.x,y:l.y,z:0},age:0,realistic:this.real,ascentArc:['ballistic','hyper','rain','heavy'].includes(type)?this.rng.range(-34,34):0,duration:Trajectory.duration(type,l,target,this.real),seed:this.rng.next(),separated:false,released:false,dead:false,engagements:{},trail:[],source:l.id,group:null};
  m.group=m.id;this.missiles.push(m);this._index.set(m.id,m);f.lastAttack=this.time;f.readiness=clamp(f.readiness-(this.real?.24:0),40,100);if(owner===this.player.id){const targetFaction=this.countryAt(target);if(targetFaction?.role==='enemy'&&!this.isHuman(targetFaction.id))targetFaction.ai.pressure=clamp((targetFaction.ai.pressure||0)+.45,0,20);}this.record(owner,'launched');this.emit('MISSILE_LAUNCHED',{owner,type,missile:m.id,x:m.x,y:m.y});this.notice(tr(f.nation)+' : '+tr(type)+' '+tr('launched'),owner===this.player.id?'info':'warn',{x:m.x,y:m.y});return this.ok({missile:m.id});
 }
 launchSatellite(owner,p){const f=this.faction(owner);if(!this.options.intel||!f.done.satellite)return this.error('noIntel');if(this.time<this.options.prep)return this.error('waitPrep');if(!this.validTarget(owner,p))return this.error('noTarget');const l=this.launcher(owner);if(!l)return this.error('noLauncher');if(!this.pay(f,{money:this.real?2200:1900,oil:12}))return this.error('noFunds');this.consumeLauncher(l);const s={id:this.id('s'),owner,x:l.x,y:l.y,z:0,sx:l.x,sy:l.y,tx:p.x,ty:p.y,tz:300,age:0,phase:'deploy',dead:false,scanTimer:0,coverage:300};this.satellites.push(s);this._index.set(s.id,s);this.emit('SATELLITE_LAUNCHED',{owner,x:l.x,y:l.y});this.notice(tr(f.nation)+' : '+tr('satellite'),owner===this.player.id?'info':'warn',p);return this.ok({satellite:s.id})}
 launchAsat(owner,id){
  const f=this.faction(owner),s=this.object(id);if(!this.options.intel||!f.done.asat)return this.error('locked');
  if(!s||s.dead||!s.coverage||!this.hostile(owner,s.owner)||s.phase!=='orbit')return this.error('noTarget');
  if(f.stock.asat<1)return this.error('noAmmo');const l=this.launcher(owner);if(!l)return this.error('noLauncher');
  const shot=this.spawnInterceptor(l,s,'asat',true,false);if(!shot)return this.error('noTarget');
  f.stock.asat--;this.consumeLauncher(l);return this.ok();
 }
 updateSatellites(dt){for(const s of this.satellites){if(s.dead)continue;s.age+=dt;if(!this.options.intel){s.dead=true;continue;}if(s.phase==='deploy'){const p=clamp(s.age/7,0,1);s.x=mix(s.sx,s.tx,p);s.y=mix(s.sy,s.ty,p);s.z=300*Math.sin(p*Math.PI/2);if(p>=1){s.phase='orbit';this.emit('SATELLITE_ORBIT',{owner:s.owner,satellite:s.id})}}else{s.x=s.tx+Math.sin(s.age*.13)*18;s.y=s.ty+Math.cos(s.age*.13)*12;s.z=300;s.scanTimer-=dt;if(s.scanTimer<=0){s.scanTimer=.8;for(const k of Object.values(this.faction(s.owner).knowledge)){if(distance(k,{x:s.tx,y:s.ty})<=s.coverage){const actual=this.object(k.id);if(!actual||actual.dead)delete this.faction(s.owner).knowledge[k.id];}}for(const e of this.entities){if(!e.dead&&this.hostile(s.owner,e.owner)&&distance(e,{x:s.tx,y:s.ty})<=s.coverage)this.observe(s.owner,e,2)}}}}}
 /* ---- Sequenced operations reserve inventory and refund on cancellation ---- */
 commandLevel(owner=this.player.id){return 1+Math.floor((this.options.multiplayer?(this.faction(owner)?.commandXP||0):this.xp)/55)}
 operationSlots(owner=this.player.id){return Math.min(8,3+Math.floor(this.commandLevel(owner)/2))}
 scheduleOperation(owner,waves){const f=this.faction(owner);if(!Array.isArray(waves)||!waves.length)return this.error('noPlan');if(waves.length>this.operationSlots(owner)&&owner===this.player.id)return this.error('stackFull');if(this.time<this.options.prep)return this.error('waitPrep');const reserve={};let prepared=[];for(const w of waves){if(!['fighter',...Object.keys(WEAPONS).filter(k=>k!=='asat')].includes(w.type))return this.error('invalid');if(w.type!=='fighter'&&!this.unlocked(f,w.type))return this.error('locked');if(!this.validTarget(owner,w))return this.error('noTarget');let count=clamp(Math.floor(w.count)||1,1,8);if(w.type!=='fighter')reserve[w.type]=(reserve[w.type]||0)+count;prepared.push({type:w.type,x:w.x,y:w.y,count,left:count,delay:clamp(Number(w.delay)||0,0,90),next:0});}for(const[k,n]of Object.entries(reserve))if(f.stock[k]<n)return this.error('noAmmo');for(const[k,n]of Object.entries(reserve))f.stock[k]-=n;
  let offset=0;for(const w of prepared){offset+=w.delay;w.next=this.time+offset;offset+=w.count*.7}
  const o={id:this.id('op'),owner,waves:prepared,created:this.time,deadline:this.time+210,done:false,completedAt:0};this.operations.push(o);this.emit('OPERATION_STARTED',{owner,operation:o.id});this.notice(tr('operations')+' '+tr('active'),owner===this.player.id?'good':'warn');return this.ok({operation:o.id})}
 cancelOperation(id){const o=this.operations.find(o=>o.id===id);if(!o||o.done)return this.error('invalid');const f=this.faction(o.owner);for(const w of o.waves){if(w.type!=='fighter')f.stock[w.type]+=w.left;w.left=0;}o.done=true;o.completedAt=this.time;return this.ok()}
 updateOperations(dt){for(const o of this.operations){if(o.done)continue;if(this.time>o.deadline){this.cancelOperation(o.id);continue;}for(const w of o.waves){if(w.left<=0||this.time<w.next)continue;if(!this.validTarget(o.owner,w)){if(w.type!=='fighter')this.faction(o.owner).stock[w.type]+=w.left;w.left=0;continue;}const r=w.type==='fighter'?this.launchAircraft(o.owner,'strike',w):this.launch(o.owner,w.type,w,true);w.next=this.time+(r.ok?.75:1.5);if(r.ok)w.left--;break;}
   if(o.waves.every(w=>w.left<=0)){o.done=true;o.completedAt=this.time;this.emit('OPERATION_COMPLETE',{owner:o.owner,operation:o.id});}}
 }
 /* ---- Air operations with steering, fuel and return-to-base ---- */
 launchAircraft(owner,mission,p=null){
  const f=this.faction(owner);if(this.time<this.options.prep)return this.error('waitPrep');
  if(!['patrol','recon','strike'].includes(mission))return this.error('invalid');
  if(mission==='recon'&&(!this.options.intel||!f.done.satellite))return this.error('noIntel');
  if(mission!=='patrol'&&(!p||!this.validTarget(owner,p)))return this.error('noTarget');
  const b=this.operational(owner,'airbase').find(e=>e.airCD<=0&&!this.aircraft.some(a=>!a.dead&&a.source===e.id));if(!b)return this.error('noAirbase');
  const airDiscount=this.nationPerk(f,'airCost',1),cost={money:Math.round((mission==='patrol'?340:mission==='recon'?420:680)*airDiscount),oil:mission==='strike'?18:12};if(!this.pay(f,cost))return this.error('noFunds');
  b.airCD=12;const a={id:this.id('a'),owner,type:mission==='recon'?'recon':'fighter',mission,phase:'takeoff',flightAge:0,x:b.x,y:b.y,z:0,prev:{x:b.x,y:b.y,z:0},tx:p?.x??f.cx,ty:p?.y??f.cy,heading:p?Math.atan2(p.y-b.y,p.x-b.x):-.7,bank:0,speed:mission==='recon'?110:160,fuel:(mission==='patrol'?115:110)*(f.done.aviation?1.35:1),source:b.id,ammo:mission==='strike'?1:4,fireCD:0,scan:0,patrolAngle:0,dead:false,engagements:{},trail:[],target:null};
  this.aircraft.push(a);this._index.set(a.id,a);this.emit('AIRCRAFT_LAUNCHED',{owner,mission,aircraft:a.id,x:a.x,y:a.y});return this.ok({aircraft:a.id});
 }
 patrolThreat(a){const f=this.faction(a.owner);return [...this.missiles.filter(m=>m.type==='drone'),...this.aircraft.filter(m=>m.type==='recon')].filter(m=>!m.dead&&this.hostile(a.owner,m.owner)&&this.atlas.contains(f,m)&&distance(m,a)<650).sort((x,y)=>distance(x,a)-distance(y,a))[0]||null;}
 steer(a,p,dt){const desired=Math.atan2(p.y-a.y,p.x-a.x),turn=clamp(angleDiff(desired,a.heading),-1.65*dt,1.65*dt);a.heading+=turn;a.bank=mix(a.bank||0,clamp(turn/Math.max(dt,.001),-1,1),Math.min(1,dt*6));a.x+=Math.cos(a.heading)*a.speed*dt;a.y+=Math.sin(a.heading)*a.speed*dt;}
 startAirStrike(a){
  if(!this.validTarget(a.owner,{x:a.tx,y:a.ty})){a.phase='return';return;}
  const len=Math.hypot(a.tx-a.x,a.ty-a.y)||1;a.strikeStart=this.time;a.strikeId=this.id('strike');a.runFrom={x:a.x,y:a.y};a.runTo={x:a.tx+(a.tx-a.x)/len*Math.min(120,len*.1),y:a.ty+(a.ty-a.y)/len*Math.min(120,len*.1)};a.strikeReleased=false;a.phase='attack';a.heading=Math.atan2(a.ty-a.y,a.tx-a.x);
  this.emit('AIR_STRIKE_STARTED',{owner:a.owner,aircraft:a.id,strikeId:a.strikeId,x:a.tx,y:a.ty,startAt:this.time,impactAt:this.time+AIR_CONFIG.strikeDuration});
 }
 updateAircraft(dt){for(const a of this.aircraft){
  if(a.dead)continue;const f=this.faction(a.owner),base=this.object(a.source);a.prev={x:a.x,y:a.y,z:a.z};a.flightAge=(a.flightAge||0)+dt;a.fuel-=dt;a.fireCD=Math.max(0,a.fireCD-dt);
  if(a.fuel<=0||f.eliminated){a.dead=true;this.emit('AIRCRAFT_LOST',{owner:a.owner,aircraft:a.id,strikeId:a.strikeId,released:a.strikeReleased,x:a.x,y:a.y,z:a.z});continue;}
  if((a.fuel<20||!base||base.dead)&&a.phase!=='attack')a.phase='return';
  if(a.phase==='takeoff'){
   const t=clamp(a.flightAge/2.2,0,1);a.x+=Math.cos(a.heading)*a.speed*(.3+.7*t)*dt;a.y+=Math.sin(a.heading)*a.speed*(.3+.7*t)*dt;a.z=42*t*t;if(t>=1)a.phase=a.mission==='patrol'?'patrol':'inbound';
  }else if(a.phase==='return'){
   const home=base&&!base.dead?base:this.operational(a.owner,'airbase')[0];a.z=mix(a.z,home&&distance(a,home)<120?0:46,Math.min(1,dt*2));
   if(!home){a.fuel=Math.min(a.fuel,8);this.steer(a,{x:f.cx,y:f.cy},dt);}else if(distance(a,home)<35){a.dead=true;home.airCD=15;this.emit('AIRCRAFT_LANDED',{owner:a.owner,aircraft:a.id});continue;}else this.steer(a,home,dt);
  }else if(a.mission==='patrol'){
   a.z=mix(a.z,48,Math.min(1,dt*2));const threat=a.ammo>0?this.patrolThreat(a):null;a.target=threat?.id||null;
   if(threat){a.phase='intercept';this.steer(a,threat,dt);if(distance3(a,threat)<230&&a.fireCD<=0){const shot=this.spawnInterceptor(a,threat,'air',this.rng.next()<(.72+(f.done.aviation?.1:0)));if(shot){a.ammo--;a.fireCD=4;}}}
   else{a.phase='patrol';a.patrolAngle+=dt*.14;if(!a.patrolPoint||this.time>=(a.nextPatrolPoint||0)){a.patrolPoint=this.atlas.snap(f,.5+Math.cos(a.patrolAngle)*.22,.5+Math.sin(a.patrolAngle)*.22,0);a.nextPatrolPoint=this.time+1.2;}this.steer(a,a.patrolPoint,dt);}
  }else if(a.phase==='inbound'){
   a.z=mix(a.z,52,Math.min(1,dt*2));this.steer(a,{x:a.tx,y:a.ty},dt);const range=distance(a,{x:a.tx,y:a.ty});if(a.mission==='strike'&&range<860)this.startAirStrike(a);else if(a.mission==='recon'&&range<70)a.phase='scan';
  }else if(a.phase==='scan'){
   a.scan+=dt;a.patrolAngle+=dt*.8;this.steer(a,{x:a.tx+Math.cos(a.patrolAngle)*60,y:a.ty+Math.sin(a.patrolAngle)*60},dt);for(const e of this.entities)if(!e.dead&&this.hostile(a.owner,e.owner)&&distance(a,e)<220)this.observe(a.owner,e,1);if(a.scan>8){a.phase='return';this.emit('RECON_COMPLETE',{owner:a.owner,x:a.tx,y:a.ty});}
  }else if(a.phase==='attack'){
   if(a.strikeStart===undefined)this.startAirStrike(a);const elapsed=this.time-a.strikeStart,t=clamp(elapsed/AIR_CONFIG.strikeDuration,0,1);
   a.x=mix(a.runFrom.x,a.runTo.x,t);a.y=mix(a.runFrom.y,a.runTo.y,t);a.z=52+10*Math.sin(Math.PI*t);a.bank=mix(a.bank||0,0,dt*3);
   if(!a.strikeReleased&&elapsed>=AIR_CONFIG.strikeRelease){
    if(!this.validTarget(a.owner,{x:a.tx,y:a.ty})){this.emit('AIR_STRIKE_CANCELLED',{strikeId:a.strikeId});a.phase='return';continue;}
    const m={id:this.id('m'),owner:a.owner,type:'airstrike',sx:a.x,sy:a.y,sz:a.z,tx:a.tx,ty:a.ty,x:a.x,y:a.y,z:a.z,prev:{x:a.x,y:a.y,z:a.z},duration:Math.max(CONFIG.step,a.strikeStart+AIR_CONFIG.strikeDuration-this.time),age:-dt,damage:220,radius:70,seed:.5,separated:false,dead:false,engagements:{},trail:[],group:a.strikeId,strikeId:a.strikeId,source:a.id};
    this.missiles.push(m);this._index.set(m.id,m);a.strikeReleased=true;a.ammo=0;this.emit('AIR_STRIKE_RELEASED',{owner:a.owner,aircraft:a.id,strikeId:a.strikeId,missile:m.id,x:a.x,y:a.y});
   }
   if(elapsed>=AIR_CONFIG.strikeDuration)a.phase='return';
  }
  a.trail.push({x:a.x,y:a.y,z:a.z,time:this.time});if(a.trail.length>40)a.trail.shift();
 }}

 /* ---- Missiles: multi-part boost, separation, independent rain payload ---- */
 updateMissiles(dt){for(const m of [...this.missiles]){if(m.dead)continue;m.prev={x:m.x,y:m.y,z:m.z};m.age+=dt;const p=clamp(m.age/m.duration,0,1);Object.assign(m,Trajectory.at(m,p));m.trail.push({x:m.x,y:m.y,z:m.z,time:this.time,burning:Trajectory.phase(m)==='boost'||m.type==='cruise'||m.type==='airstrike'});if(m.trail.length>58)m.trail.shift();const sep=WEAPONS[m.type]?.separate?FlightPhysics.split(m):null;
   if(sep&&!m.separated&&p>=sep){m.separated=true;const last=Trajectory.at(m,Math.max(0,p-.012)),next=Trajectory.at(m,Math.min(1,p+.012)),dtime=.024*m.duration;this.boosters.push({id:this.id('b'),owner:m.owner,x:m.x,y:m.y,z:m.z,vx:(next.x-last.x)/dtime*.78,vy:(next.y-last.y)/dtime*.78,vz:(next.z-last.z)/dtime-15,rot:Math.atan2(m.y-last.y,m.x-last.x),spin:this.rng.range(-2,2),life:5,maxLife:5,type:m.type});this.emit('BOOSTER_SEPARATED',{owner:m.owner,x:m.x,y:m.y,z:m.z,missile:m.id});}
   if(m.type==='rain'&&!m.released&&p>=.64){
    m.released=true;m.dead=true;const count=10;
    for(let j=0;j<count;j++){const lane=j-(count-1)/2,fanX=lane*12+this.rng.range(-4,4),fanY=-this.rng.range(10,20)-Math.abs(lane)*1.8,tx=m.tx+lane*15+this.rng.range(-9,9),ty=m.ty+this.rng.range(-20,20),c={id:this.id('m'),owner:m.owner,type:'sub',sx:m.x,sy:m.y,sz:m.z,tx,ty,x:m.x,y:m.y,z:m.z,prev:{x:m.x,y:m.y,z:m.z},age:-j*.07,fanX,fanY,duration:this.rng.range(4.9,6.5),damage:88,radius:60,separated:true,dead:false,engagements:{},trail:[],group:m.group};this.missiles.push(c);this._index.set(c.id,c);}
    this.emit('PAYLOAD_RELEASED',{owner:m.owner,x:m.x,y:m.y,z:m.z,count});continue;
   }
   if(p>=1){m.dead=true;this.impact(m)}
  }}
 updateBoosters(dt){for(const b of this.boosters){b.life-=dt;b.x+=b.vx*dt;b.y+=b.vy*dt;b.z=Math.max(0,b.z+b.vz*dt);b.vx*=Math.exp(-dt*.14);b.vy*=Math.exp(-dt*.14);b.vz-=62*dt;b.rot+=b.spin*dt;if(b.z<=0)b.life=Math.min(b.life,.5)}}
 destroy(e){if(e.dead)return;e.dead=true;e.hp=0;e.destroyedAt=this.time;e.expansion=null;e.queue=[];this.emit('STRUCTURE_DESTROYED',{owner:e.owner,kind:e.kind,x:e.x,y:e.y,entity:e.id});}
 damage(e,amount,source,direct=false,group=null){if(!e||e.dead||amount<=0)return false;if(group&&e.lastDamageGroup===group&&e.kind!=='city')return false;if(group)e.lastDamageGroup=group;
  if(e.kind==='city'){e.hp=Math.max(0,e.hp-amount);if(!e.hp)this.destroy(e);return true;}
  if(this.real&&direct){e.hits++;if(e.hits>=2)this.destroy(e);else{e.damaged=true;e.hp=Math.min(e.hp,e.maxHP*.50);this.emit('OPERATIONAL_DAMAGE',{owner:e.owner,x:e.x,y:e.y,entity:e.id});}}
  else if(!this.real&&direct&&e.count>1)this.destroy(e);
  else {e.hp=Math.max(this.real&&!direct?e.maxHP*.12:0,e.hp-amount);if(e.hp<=0)this.destroy(e)}return true;}
 impact(m){const d=WEAPONS[m.type]||{damage:m.damage||70,radius:m.radius||38},rad=m.radius||d.radius,hitCountry=this.countryAt(m),hits=[],group=m.group||m.id;
  for(const e of this.entities){if(e.dead||!this.hostile(m.owner,e.owner))continue;const dist=distance(e,m);if(dist>rad)continue;const direct=dist<=26,damage=(m.damage||d.damage)*Math.max(.18,1-dist/rad);if(this.damage(e,damage,m.owner,direct,group))hits.push(e);}
  const owners=new Set(hits.map(e=>e.owner));if(hitCountry&&this.hostile(m.owner,hitCountry.id))owners.add(hitCountry.id);
  for(const owner of owners){const f=this.faction(owner);f._impacts=f._impacts||{};if(!f._impacts[group]){f._impacts[group]=this.time;const ownerHits=hits.filter(e=>e.owner===owner),cityHit=ownerHits.some(e=>e.kind==='city');f.satisfaction=clamp(f.satisfaction-(cityHit?3.1:1.8),0,100);f.lastHit=this.time;if(m.owner===this.player.id&&f.role==='enemy'&&!this.isHuman(f.id)){const destroyed=ownerHits.filter(e=>e.dead).length,heavy=m.type==='heavy'?1.2:0;f.ai.pressure=clamp((f.ai.pressure||0)+1+Math.min(2.4,ownerHits.length*.55)+destroyed*.7+heavy,0,20);}if(owner===this.player.id)this.notice(tr('impact')+' '+tr(f.nation),cityHit?'bad':'warn',{x:m.x,y:m.y});}for(const[k,t]of Object.entries(f._impacts))if(this.time-t>40)delete f._impacts[k];}
  if(hits.length){const f=this.faction(m.owner);f.satisfaction=clamp(f.satisfaction+.8,0,100);f.lastSuccess=this.time;this.record(m.owner,'hits',hits.some(e=>e.dead)?10:4);this.emit('SUCCESSFUL_STRIKE',{owner:m.owner,x:m.x,y:m.y})}
  this.emit('MISSILE_IMPACT',{owner:m.owner,type:m.type,x:m.x,y:m.y,radius:rad,hit:hits.length,strikeId:m.strikeId,missile:m.id});}
 /* ---- Defense: AF V3 missile/SAM dynamics, Reborn rendering/AAA retained ---- */
 chance(type,owner,tracked){
  const f=this.faction(owner),samBase={ballistic:.50,hyper:.30,heavy:.40,rain:.30};
  if(Object.prototype.hasOwnProperty.call(samBase,type)){
   let chance=samBase[type]+(f.done.defense?.08:0);if(!tracked)chance*=f.done.defense?.77:.62;return clamp(chance,.05,.94);
  }
  const base=DEFENSE[this.options.style][type]||.45;return clamp((base+(f.done.defense?.08:0))*(tracked||['cruise','drone','sub','recon'].includes(type)?1:(f.done.defense?.77:.62)),.05,.94);
 }
 futurePoint(target,t){
  if(Number.isFinite(target.duration)&&Number.isFinite(target.age)&&Number.isFinite(target.sx)&&Number.isFinite(target.tx))return Trajectory.at(target,clamp((target.age+t)/target.duration,0,1));
  if(target.coverage)return{x:target.tx+Math.sin((target.age+t)*.13)*18,y:target.ty+Math.cos((target.age+t)*.13)*12,z:target.z||300};
  return{x:target.x+Math.cos(target.heading||0)*(target.speed||0)*t,y:target.y+Math.sin(target.heading||0)*(target.speed||0)*t,z:target.z||0};
 }
 projectileDistance(type,t){
  if(type==='aaa')return 390*t;
  const v0=type==='air'?200:85,max=type==='asat'?950:760,acc=type==='asat'?430:380,ramp=(max-v0)/acc;
  return t<=ramp?v0*t+.5*acc*t*t:v0*ramp+.5*acc*ramp*ramp+max*(t-ramp);
 }
 samMissileThreat(m){return !!(m&&!m.dead&&!m.mission&&Number.isFinite(m.duration)&&Number.isFinite(m.tx)&&Number.isFinite(m.ty)&&!['cruise','drone','sub','airstrike','recon','asat'].includes(m.type));}
 defensePressure(side){
  const incoming=this.missiles.filter(m=>this.samMissileThreat(m)&&this.hostile(side,m.owner)&&clamp(m.age/m.duration,0,1)<.9),sams=this.operational(side,'sam'),radars=this.operational(side,'radar');
  const capacity=Math.max(1,sams.reduce((sum,e)=>sum+Math.max(1,e.count)*1.18*this.efficiency(e),0)+radars.reduce((sum,e)=>sum+Math.max(1,e.count)*.34*this.efficiency(e),0)),active=this.interceptors.filter(i=>!i.dead&&i.owner===side&&i.type==='sam').length;
  return{incoming:incoming.length,active,capacity,ratio:(incoming.length+active*.62)/capacity};
 }
 radarSupportCount(owner,target){return this.operational(owner,'radar').reduce((n,r)=>n+(distance(r,target)<=this.range(r)?Math.max(1,r.count):0),0);}
 samRadarTracks(owner,target){return this.operational(owner,'radar').some(r=>distance(r,target)<=this.range(r));}
 offsetInterceptPoint(source,point,error){
  const dx=point.x-source.x,dy=point.y-source.y,len=Math.hypot(dx,dy)||1,nx=-dy/len,ny=dx/len,side=this.rng.next()<.5?-1:1;
  return{x:point.x+nx*error*side+dx/len*this.rng.range(-28,38),y:point.y+ny*error*side+dy/len*this.rng.range(-28,38),z:point.z||0};
 }
 interceptSolution(source,target,type,tracked=true){
  if(type==='sam'&&this.samMissileThreat(target)){
   const prog=clamp(target.age/target.duration,0,1);if(prog<.2||prog>(tracked?.86:.72))return null;
   const lead=tracked?(target.type==='ballistic'?.16:target.type==='hyper'?.09:.12):(target.type==='ballistic'?.20:target.type==='hyper'?.11:.14),cap=tracked?(target.type==='ballistic'?.94:.90):(target.type==='ballistic'?.90:.82),hitP=clamp(prog+lead,.28,cap),point=Trajectory.at(target,hitP),dist=distance(source,point),range=this.range(source),time=(hitP-prog)*target.duration;
   if(dist>range||time<(tracked?.30:.38))return null;return{time,point,hitP,dist};
  }
  const remaining=Number.isFinite(target.duration)?target.duration-target.age-.015:(type==='asat'?15:7),max=Math.min(type==='aaa'?3.8:type==='asat'?15:8,remaining);
  let lo=0,hi=null;for(let t=.04;t<=max+.00001;t+=.04){if(this.projectileDistance(type,t)>=distance3(source,this.futurePoint(target,t))){hi=t;break;}lo=t;}
  if(hi===null)return null;for(let j=0;j<14;j++){const t=(lo+hi)/2;if(this.projectileDistance(type,t)>=distance3(source,this.futurePoint(target,t)))hi=t;else lo=t;}
  const time=(lo+hi)/2;return{time,point:this.futurePoint(target,time)};
 }
 spawnInterceptor(source,target,type,willHit,blind=false){
  const tracked=!blind,solution=this.interceptSolution(source,target,type,tracked);if(!solution)return null;
  const origin={x:source.x,y:source.y,z:source.z||0};let aim={...solution.point},flight=solution.time,mode='track',curve=0,saturation=0,actualHit=!!willHit;
  if(type==='sam'){
   const pressure=this.defensePressure(source.owner);saturation=Math.max(0,pressure.ratio-.68);
   // Exactly one probability roll belongs to this interceptor. A 50% failure is
   // rendered as a believable miss path; there is no hidden second misguide roll.
   mode=willHit?'track':'miss';
   if(mode==='miss'){const wrong=this.offsetInterceptPoint(source,solution.point,this.rng.range(58,118)*(1+saturation*.18));aim={x:wrong.x,y:wrong.y,z:Math.max(1,(solution.point.z||0)+this.rng.range(-12,16))};flight=Math.max(.55,distance(source,aim)/(445+Math.max(1,source.count)*24));actualHit=false;}
   else aim={x:solution.point.x,y:solution.point.y,z:Math.max(1,solution.point.z||0)};
   curve=this.rng.range(-24,24)*(1+Math.min(.8,saturation));source.engagementCount=(source.engagementCount||0)+1;if(mode!=='track')source.misfires=(source.misfires||0)+1;
  }else{
   const angle=this.rng.range(0,Math.PI*2),spread=willHit?0:this.rng.range(blind?60:30,blind?135:65);aim={x:solution.point.x+Math.cos(angle)*spread,y:solution.point.y+Math.sin(angle)*spread,z:Math.max(1,(solution.point.z||0)+(willHit?0:this.rng.range(-16,20)))};
  }
  const len=distance3(origin,aim)||1,dir={x:(aim.x-origin.x)/len,y:(aim.y-origin.y)/len,z:(aim.z-origin.z)/len},plan=type==='sam'?InterceptorPath.plan(origin,aim,curve):null;
  const shot={id:this.id('i'),owner:source.owner,type,target:target.id,source:source.id,...origin,origin,prev:{...origin},direction:dir,aim,flightTime:flight,curve,exitDirection:plan?.exitDirection,age:0,life:flight+(type==='aaa'?this.rng.range(.3,.72):this.rng.range(.7,1.05)),dead:false,willHit:actualHit,requestedHit:!!willHit,blind,mode,saturation,orphan:false,passed:false,resolved:false,trail:[],vx:0,vy:0,vz:0};
  this.interceptors.push(shot);source.lastShot=this.time;source.defHeading=Math.atan2(aim.y-source.y,aim.x-source.x);this.emit('INTERCEPTOR_LAUNCHED',{owner:source.owner,type,source:source.id,target:target.id,interceptor:shot.id,x:source.x,y:source.y,z:source.z||0});return shot;
 }
 defenseNetwork(m,f,tracked){
  m.engagements=m.engagements||{};if(!m.engagements[f.id]){const chance=this.chance(m.type==='airstrike'?'cruise':m.type,f.id,tracked);m.engagements[f.id]={shooters:[],chance,success:this.rng.next()<chance,assigned:false,tracked,shots:0};this.emit('RADAR_DETECTED',{owner:f.id,target:m.id,tracked,x:m.x,y:m.y});}
  return m.engagements[f.id];
 }
 updateDefense(dt){
  const threats=[...this.missiles,...this.aircraft].filter(m=>!m.dead&&m.type!=='asat');
  for(const f of this.factions){if(f.eliminated)continue;
   // AAA is intentionally left on the newer Reborn rapid-fire system.
   for(const e of this.operational(f.id,'aaa')){
    if(e.nextAAAt===undefined)e.nextAAAt=this.time+(Number(e.id.replace(/\D/g,''))%7)*.061;
    if(this.time+1e-7<e.nextAAAt||e.ammo<=0||this.interceptors.length>420)continue;
    const pool=threats.filter(m=>!m.dead&&this.hostile(f.id,m.owner)&&['cruise','drone','sub','airstrike','recon','fighter'].includes(m.type)&&distance3(e,m)<=this.range(e)).sort((a,b)=>distance3(e,a)-distance3(e,b));
    let shot=null;for(const target of pool){const tracked=this.radarTracks(f.id,target),n=this.defenseNetwork(target,f,tracked),winner=n.success&&!n.assigned;shot=this.spawnInterceptor(e,target,'aaa',winner,false);if(!shot)continue;if(winner)n.assigned=true;n.shots++;if(!n.shooters.includes(e.id))n.shooters.push(e.id);break;}
    if(shot){e.ammo--;e.nextAAAt=this.time+AIR_CONFIG.aaaInterval/Math.max(.5,this.efficiency(e));}
   }
   // SAM rule: each physical battery may fire exactly one interceptor at an
   // incoming missile when (1) the missile's destination lies inside that SAM
   // coverage and (2) the missile is currently radar-tracked. Every launched
   // interceptor gets its own independent 50% kill roll.
   for(const e of this.operational(f.id,'sam')){
    e.confusion=Math.max(0,(e.confusion||0)-dt*(.055+this.operational(f.id,'radar').length*.008));if(e.defCD>0||this.interceptors.length>420)continue;
    const pool=threats.filter(m=>this.samMissileThreat(m)&&this.hostile(f.id,m.owner)&&distance(e,{x:m.tx,y:m.ty})<=this.range(e)&&this.samRadarTracks(f.id,m)&&!(m.engagements?.[f.id]?.shooters||[]).includes(e.id)).sort((a,b)=>(b.age/b.duration)-(a.age/a.duration));
    for(const m of pool){
     const solution=this.interceptSolution(e,m,'sam',true);if(!solution)continue;
     m.engagements=m.engagements||{};const first=!m.engagements[f.id],n=m.engagements[f.id]||(m.engagements[f.id]={shooters:[],tracked:true,shots:0});
     if(first)this.emit('RADAR_DETECTED',{owner:f.id,target:m.id,tracked:true,x:m.x,y:m.y});
     const israelBonus=(this.options.multiplayer&&f.nation==='israel'&&m.type!=='rain')?(NATION_PERKS.israel.samBonus||0):0;const hitChance=clamp(samInterceptChance(m.type)+israelBonus,0,.95);const p=this.spawnInterceptor(e,m,'sam',this.rng.next()<hitChance,false);if(!p)continue;
     n.shots++;n.shooters.push(e.id);e.defCD=Math.max(.35,1.75/Math.max(1,e.count));break;
    }
   }
  }
 }
 killThreat(target,p){
  target.dead=true;p.dead=true;const f=this.faction(p.owner);f.satisfaction=clamp(f.satisfaction+.62,0,100);f.lastDefense=this.time;
  this.record(p.owner,'intercepted',5);this.record(target.owner,'lost');
  this.emit('MISSILE_INTERCEPTED',{owner:p.owner,type:target.type||'satellite',target:target.id,interceptor:p.id,strikeId:target.strikeId,released:target.strikeReleased,x:target.x,y:target.y,z:target.z||0});
  if(p.owner===this.player.id||target.owner===this.player.id)this.notice(tr(target.type||'satellite')+' '+tr('intercepted'),p.owner===this.player.id?'good':'bad',{x:target.x,y:target.y});
 }
 updateInterceptors(dt){for(const p of this.interceptors){
  if(p.dead)continue;p.prev={x:p.x,y:p.y,z:p.z};p.age+=dt;p.life-=dt;const target=this.object(p.target);if(!target||target.dead)p.orphan=true;
  if(p.type==='sam'){
   Object.assign(p,InterceptorPath.at(p,p.age));p.vx=(p.x-p.prev.x)/dt;p.vy=(p.y-p.prev.y)/dt;p.vz=(p.z-p.prev.z)/dt;p.speed=Math.hypot(p.vx,p.vy,p.vz);p.passed=p.age>=p.flightTime;
   // Like the source model, the kill decision occurs once at the planned path
   // crossing. No terminal homing, retargeting or second probability roll.
   if(!p.resolved&&p.age+1e-7>=p.flightTime){p.resolved=true;if(!p.orphan&&target&&!target.dead){const threshold=target.type==='hyper'?58:82,near=distance3(p,target)<threshold,prog=Number.isFinite(target.duration)?target.age/target.duration:0;if(p.willHit&&near&&prog<.92){this.killThreat(target,p);continue;}}p.life=Math.min(p.life,.12);}
  }else{
   const traveled=this.projectileDistance(p.type,p.age),before=this.projectileDistance(p.type,Math.max(0,p.age-dt)),velocity=(traveled-before)/dt;p.x=p.origin.x+p.direction.x*traveled;p.y=p.origin.y+p.direction.y*traveled;p.z=p.origin.z+p.direction.z*traveled;p.vx=p.direction.x*velocity;p.vy=p.direction.y*velocity;p.vz=p.direction.z*velocity;p.speed=velocity;p.passed=p.age>=p.flightTime;
   if(!p.orphan&&target&&!target.dead&&p.willHit){const prev=target.prev||target,rx=p.prev.x-prev.x,ry=p.prev.y-prev.y,rz=p.prev.z-(prev.z||0),dx=p.x-target.x-rx,dy=p.y-target.y-ry,dz=p.z-(target.z||0)-rz,t=clamp(-(rx*dx+ry*dy+rz*dz)/(dx*dx+dy*dy+dz*dz||1),0,1),swept=Math.hypot(rx+dx*t,ry+dy*t,rz+dz*t),radius=p.type==='aaa'?11:24;if(swept<radius){this.killThreat(target,p);continue;}}
  }
  p.trail.push({x:p.x,y:p.y,z:p.z,time:this.time,burning:p.type!=='aaa'});if(p.trail.length>35)p.trail.shift();if(p.life<=0||p.z<-.1){p.dead=true;this.emit('SELF_DESTRUCT',{owner:p.owner,x:p.x,y:p.y,z:Math.max(0,p.z),type:p.type,interceptor:p.id});}
 }}

 /* ---- Autonomous opponents use only observations when intel is enabled ---- */
 aiBuild(f,kind){if(!kind||!STRUCTURES[kind])return false;const existing=this.operational(f.id,kind),compact=f.nation==='israel'||this.alive(f.id).length>17;
  let target=compact&&kind!=='airbase'?existing.find(e=>!e.expansion&&e.count<this.stackCap(f)):null;
  let p=target||this.atlas.findSpace(f,this.alive(f.id),this.rng,kind);
  if(!p&&kind!=='airbase')p=existing.find(e=>!e.expansion&&e.count<this.stackCap(f));return!!p&&this.build(f.id,kind,p).ok;}
 aiTarget(f,known){if(!known.length)return null;const order=f.ai.order;if(order&&this.validTarget(f.id,order))return order;
  const bias={radar:1.3,sam:1.15,aaa:1.1,launcher:1.4,factory:1.5,oilrig:1.0,airbase:1.1,unknown:.9,city:.45};const options=known.map(t=>({t,w:(bias[t.kind]||.8)*(1+this.rng.next()*.4)}));let x=this.rng.next()*options.reduce((a,b)=>a+b.w,0);for(const o of options){x-=o.w;if(x<=0)return o.t}return options[0].t;}
 updateAI(dt){for(const f of this.factions){if(f.role==='player'||this.isHuman(f.id)||f.eliminated)continue;const a=f.ai,d=CONFIG.difficulties[this.options.difficulty],nightmare=this.options.difficulty==='nightmare',expertLike=nightmare||this.options.difficulty==='expert';a.think-=dt;a.attack-=dt;a.recon-=dt;a.offer-=dt;a.support=Math.max(0,a.support-dt);if(a.think>0)continue;a.think=d.think+this.rng.range(0,nightmare?0.18:(expertLike?0.45:1));const enemies=this.factions.filter(t=>this.hostile(f.id,t.id));if(!enemies.length){a.state='RECOVERY';continue;}
   const targets=this.knownTargets(f.id,null,false),trackedTargets=targets.filter(t=>t.level===2||!this.options.intel),recentAttack=this.time-f.lastHit<35,count=k=>this.builtCount(f.id,k),inProgress=this.alive(f.id).filter(e=>e.buildLeft>0||e.expansion).length;
   const intelReserve=this.options.intel&&f.done.satellite&&!this.satellites.some(s=>!s.dead&&s.owner===f.id)?(this.real?2550:2250):0;
   const essential=['oilrig','factory','launcher','sam','aaa','radar','airbase'];let next=essential.find(k=>count(k)<1);
   if(!next){const desired=nightmare?{oilrig:6,factory:5,launcher:6,sam:recentAttack?8:6,aaa:recentAttack?7:5,radar:3,airbase:2}:expertLike?{oilrig:5,factory:4,launcher:5,sam:recentAttack?7:5,aaa:recentAttack?6:4,radar:3,airbase:2}:{oilrig:3,factory:2,launcher:3,sam:recentAttack?5:3,aaa:recentAttack?4:2,radar:2,airbase:1};let candidates=Object.keys(desired).filter(k=>count(k)<desired[k]);next=candidates.length?this.rng.pick(candidates):f.res.money>(nightmare?3200:expertLike?4200:6000)?this.rng.pick(['oilrig','factory','launcher','sam','aaa',...(expertLike?['radar']:[])]):null;}
   a.state=f.res.money<900?'RECOVERY':essential.some(k=>count(k)<1)?'ECONOMIC_BUILDUP':recentAttack?'DEFENSIVE':this.options.intel&&!trackedTargets.length?'RECON':a.attack<7?'PREPARING_STRIKE':'OFFENSIVE';
   if(next){const cost=this.buildCost(f.id,next),critical=count(next)<1,maxJobs=nightmare?5:(expertLike?4:2),reserve=nightmare?120:(expertLike?150:Math.max(350,intelReserve));if(expertLike&&critical){f.res.money=Math.max(f.res.money,cost.money+reserve+1);f.res.oil=Math.max(f.res.oil,(cost.oil||0)+10);}if(inProgress<maxJobs&&(f.res.money>cost.money+reserve||count('oilrig')===0))this.aiBuild(f,next);}
   if(!f.research){let research=null;if(this.options.intel&&!f.done.satellite&&count('launcher'))research='satellite';else if(this.options.intel&&this.satellites.some(s=>!s.dead&&this.hostile(f.id,s.owner))&&f.done.satellite&&!f.done.asat)research='asat';else if(!f.done.cruise&&count('factory'))research='cruise';else if(!f.done.defense&&count('sam')>=2)research='defense';else if(!f.done.oiltech&&count('oilrig')>=2)research='oiltech';else research=['industry','hyper','aviation','rain','heavy','economy'].find(k=>!f.done[k]&&RESEARCH[k].requires.every(r=>f.done[r]));if(this.options.intel&&!f.done.satellite&&research!=='satellite')research=null;if(research&&f.res.tech>=RESEARCH[research].cost)this.startResearch(f.id,research);}
   const factories=this.operational(f.id,'factory'),queueLimit=nightmare?6:(expertLike?4:2),stockTarget=nightmare?30:(expertLike?22:12);for(const site of factories){if(site.queue.length>=queueLimit||f.res.money<(nightmare?320:expertLike?420:600)+intelReserve)continue;let types=NATIONS[f.nation].weapons.filter(k=>this.unlocked(f,k)&&f.stock[k]<stockTarget);if(!types.length)types=['ballistic','drone','cruise'].filter(k=>WEAPONS[k]&&f.stock[k]<(nightmare?34:expertLike?28:16));if(types.length)this.queueWeapon(f.id,this.rng.pick(types),nightmare&&site.queue.length<2?2:1,site.id);}
   if(this.options.intel&&f.done.asat){const sat=this.satellites.find(s=>!s.dead&&s.phase==='orbit'&&this.hostile(f.id,s.owner)&&!this.interceptors.some(i=>!i.dead&&i.target===s.id&&i.owner===f.id));if(sat){if(f.stock.asat>0)this.launchAsat(f.id,sat.id);else if(factories.length&&!factories.some(e=>e.queue.some(q=>q.type==='asat'))&&f.res.money>1600)this.queueWeapon(f.id,'asat',1);}}
   if(this.time<this.options.prep)continue;
   if(this.options.intel&&f.done.satellite&&a.recon<=0&&this.reconNeeded(f.id)){const enemy=this.rng.pick(enemies),v=this.rng.range(.30,.72),u=this.rng.range(.30,.70),p=this.atlas.snap(enemy,u,v,8);const covering=this.satellites.filter(s=>!s.dead&&s.owner===f.id).length;if(covering<2&&f.res.money>(this.real?2450:2150))this.launchSatellite(f.id,p);if(f.res.money>1100&&(!intelReserve||f.res.money>intelReserve+650||(!this.aircraft.some(a=>a.owner===f.id&&a.mission==='recon'&&!a.dead)&&f.ai.firstRecon!==true))){const recon=this.launchAircraft(f.id,'recon',p);if(recon.ok)f.ai.firstRecon=true;}a.recon=(nightmare?14:expertLike?20:28)+this.rng.range(0,nightmare?8:(expertLike?10:16));}
   if(recentAttack&&f.res.money>1200&&!this.aircraft.some(a=>!a.dead&&a.owner===f.id&&a.mission==='patrol'))this.launchAircraft(f.id,'patrol');
   if(f.hold)continue;
   if(a.attack<=0){let t=this.aiTarget(f,targets);if(!t&&(!this.options.intel||!this.real)){const enemy=this.rng.pick(enemies);t=this.atlas.snap(enemy,this.rng.range(.2,.8),this.rng.range(.2,.8),4);}if(t&&this.validTarget(f.id,t)){const available=Object.keys(WEAPONS).filter(k=>k!=='asat'&&f.stock[k]>0);if(available.length){let type=this.rng.pick(available),num=Math.min(f.stock[type],f.role==='ally'?2:d.salvo),waves=[{type,count:num,x:t.x,y:t.y,delay:0}];if(nightmare&&f.stock[type]>num){if(this.rng.next()<0.5){for(let i=1;i<Math.min(5,f.stock[type]);i++)waves.push({type,count:1,x:t.x,y:t.y,delay:i*3});}else{let left=f.stock[type]-num,delay=24;while(left>0&&waves.length<4){const burst=Math.min(Math.max(2,Math.ceil(num*.75)),left);waves.push({type,count:burst,x:t.x,y:t.y,delay});left-=burst;delay+=12+this.rng.range(0,10);}}}if(trackedTargets.length>1&&available.length>1){const t2=this.aiTarget(f,trackedTargets),type2=available.find(k=>k!==type);if(t2&&type2)waves.push({type:type2,count:Math.min(nightmare?4:(expertLike?3:2),f.stock[type2]),x:t2.x,y:t2.y,delay:nightmare?6:4});}this.scheduleOperation(f.id,waves);a.attack=d.attack*this.rng.range(.8,1.12);}else a.attack=nightmare?3.5:(expertLike?4.5:5);
    if(f.res.money>1800&&trackedTargets.length&&this.rng.next()<(nightmare?0.62:(expertLike?0.46:0.3)))this.launchAircraft(f.id,'strike',t);
   }else a.attack=nightmare?3.8:(expertLike?4.5:6);}
  }}
 /* ---- Diplomacy: bounded requests and existing-resource support ---- */
 requestTruce(enemyId){const e=this.faction(enemyId),p=this.player;if(!e||e.role!=='enemy'||e.eliminated)return this.error('invalid');if((e.truces[p.id]||0)>this.time)return this.error('invalid');if(e.offers.pending)return this.error('cooldown');e.offers.pending={from:p.id,to:e.id,resolve:this.time+4,expires:this.time+25};return this.ok()}
 setTruce(a,b){const f=this.faction(a),g=this.faction(b);if(!f||!g)return this.error('invalid');f.truces[b]=g.truces[a]=this.time+TRUCE_DURATION;f.truceStarted=f.truceStarted||{};g.truceStarted=g.truceStarted||{};f.truceStarted[b]=g.truceStarted[a]=this.time;f.offers={};g.offers={};for(const side of [f,g]){if(side.ai){side.ai.pressure=0;side.ai.truceBreakAt=this.time+this.rng.range(95,220);}}for(const o of this.operations){if(!o.done&&(o.owner===a||o.owner===b)){for(const w of o.waves){const country=this.countryAt(w);if(country&&(country.id===a||country.id===b)&&w.left>0){if(w.type!=='fighter')this.faction(o.owner).stock[w.type]+=w.left;w.left=0;}}}}
  this.notice(tr(g.nation)+' : '+tr('truce'),'good');this.emit('TRUCE',{a,b,until:this.time+TRUCE_DURATION});return this.ok()}
 breakTruce(a,b,breaker=a){const f=this.faction(a),g=this.faction(b);if(!f||!g||Math.max(f.truces[b]||0,g.truces[a]||0)<=this.time)return this.error('invalid');f.truces[b]=g.truces[a]=this.time;f.truceStarted&&(delete f.truceStarted[b]);g.truceStarted&&(delete g.truceStarted[a]);if(f.ai){f.ai.attack=Math.min(f.ai.attack||6,3);f.ai.truceBreakAt=0;}if(g.ai){g.ai.attack=Math.min(g.ai.attack||6,3);g.ai.truceBreakAt=0;}const who=this.faction(breaker);this.notice((who?tr(who.nation):tr('truce'))+' : '+tr('truceBroken'),'warn');this.emit('TRUCE_BROKEN',{a,b,breaker});return this.ok()}
 respondTruce(enemyId,accept){const e=this.faction(enemyId);if(!e||!e.offers.incoming)return this.error('invalid');e.offers.incoming=null;e.ai.offer=90;e.ai.pressure=Math.max(0,(e.ai.pressure||0)-2);if(accept)this.setTruce(this.player.id,enemyId);return this.ok()}
 support(allyId,type){const a=this.faction(allyId),p=this.player;if(!a||a.role!=='ally'||a.eliminated||a.ai.support>0)return this.error('cooldown');if(type==='money'){if(a.res.money<1800)return this.error('noFunds');a.res.money-=800;p.res.money+=800;}else if(type==='oil'){if(a.res.oil<70)return this.error('noFunds');a.res.oil-=40;p.res.oil+=40;}else{const n=Math.min(3,a.stock.ballistic);if(!n)return this.error('noAmmo');a.stock.ballistic-=n;p.stock.ballistic+=n;}a.ai.support=55;this.notice(tr(a.nation)+' : '+tr('support'),'good');return this.ok()}
 diplomaticRequest(from,to,kind,payload={}){const a=this.faction(from),b=this.faction(to);if(!a||!b||a.id===b.id||a.eliminated||b.eliminated)return this.error('invalid');if(Math.max(a.truces[b.id]||0,b.truces[a.id]||0)<=this.time)return this.error('truceRequired');if(!['money','missile','command'].includes(kind))return this.error('invalid');b.diplomaticInbox=b.diplomaticInbox||[];if(b.diplomaticInbox.filter(x=>x.status==='pending').length>=5)return this.error('cooldown');const req={id:this.id('req'),from:a.id,to:b.id,kind,status:'pending',created:this.time,expires:this.time+45};if(kind==='money'){const amount=clamp(Math.floor(Number(payload.amount)||0),100,50000);req.amount=amount;}else if(kind==='missile'){if(!WEAPONS[payload.weapon]||payload.weapon==='asat')return this.error('invalid');req.weapon=payload.weapon;req.count=clamp(Math.floor(Number(payload.count)||1),1,20);}else{if(!['attack','hold','help'].includes(payload.command))return this.error('invalid');req.command=payload.command;if(payload.command==='attack'){const target=this.faction(payload.target);if(!target||target.id===a.id||target.id===b.id||target.eliminated)return this.error('invalid');req.target=target.id;}}b.diplomaticInbox.push(req);this.emit('DIPLO_REQUEST',{owner:from,to,request:req.id,kind});return this.ok({request:req.id})}
 respondDiplomaticRequest(owner,id,accept){const f=this.faction(owner),req=f?.diplomaticInbox?.find(x=>x.id===id&&x.status==='pending');if(!req||req.expires<=this.time)return this.error('invalid');const from=this.faction(req.from);req.status=accept?'accepted':'rejected';req.responded=this.time;if(!accept){this.emit('DIPLO_RESPONSE',{owner,from:req.from,request:id,accepted:false});return this.ok({accepted:false})}if(!from||Math.max(f.truces[from.id]||0,from.truces[f.id]||0)<=this.time)return this.error('truceRequired');if(req.kind==='money'){if(from.res.money<req.amount){req.status='failed';return this.error('insufficientOnAccept')}from.res.money-=req.amount;f.res.money+=req.amount;}else if(req.kind==='missile'){if((from.stock[req.weapon]||0)<req.count){req.status='failed';return this.error('insufficientOnAccept')}from.stock[req.weapon]-=req.count;f.stock[req.weapon]=(f.stock[req.weapon]||0)+req.count;}else if(req.kind==='command'){f.directive={from:req.from,command:req.command,target:req.target||null,expires:this.time+90};if(!this.isHuman(f.id)&&f.ai){if(req.command==='hold')f.hold=true;else if(req.command==='attack'&&req.target){const t=this.faction(req.target);if(t){f.hold=false;f.ai.order={x:t.cx,y:t.cy};f.ai.attack=0;}}else if(req.command==='help'){f.hold=false;f.ai.support=0;f.ai.attack=0;}}}this.emit('DIPLO_RESPONSE',{owner,from:req.from,request:id,accepted:true,kind:req.kind});return this.ok({accepted:true})}
 updateDiplomacy(dt){for(const x of this.factions){if(x.diplomaticInbox){for(const r of x.diplomaticInbox)if(r.status==='pending'&&r.expires<=this.time)r.status='expired';x.diplomaticInbox=x.diplomaticInbox.filter(r=>r.status==='pending'||this.time-(r.responded||r.expires)<18);}if(x.directive&&x.directive.expires<=this.time)x.directive=null;}for(const f of this.factions){if(f.role!=='enemy'||this.isHuman(f.id)||f.eliminated)continue;f.ai.pressure=Math.max(0,(f.ai.pressure||0)-dt*.025);const truceUntil=f.truces[this.player.id]||0;
   if(truceUntil>this.time){const pending=(f.diplomaticInbox||[]).find(r=>r.status==='pending'&&r.expires>this.time&&r.from===this.player.id&&this.time-r.created>2.5);if(pending){const accept=this.rng.next()<.72;this.respondDiplomaticRequest(f.id,pending.id,accept);this.notice(tr(f.nation)+' : '+tr(accept?'requestAccepted':'requestRejected'),accept?'good':'warn');}if(!f.ai.truceBreakAt)f.ai.truceBreakAt=this.time+this.rng.range(95,220);if(this.time>=f.ai.truceBreakAt){const rebuilt=this.builtCount(f.id,'launcher')>=1&&this.builtCount(f.id,'factory')>=1&&this.builtCount(f.id,'sam')>=1,armed=Object.values(f.stock).reduce((a,b)=>a+b,0)>=4;if(rebuilt&&armed&&f.res.money>1800)this.breakTruce(f.id,this.player.id,f.id);else f.ai.truceBreakAt=this.time+30;}continue;}
   const p=f.offers.pending;if(p&&this.time>=p.resolve){const health=this.alive(f.id,'city').reduce((a,c)=>a+c.hp/c.maxHP,0)/2,chance=clamp(.28+(1-health)*.5+(f.res.money<1200?.15:0),.15,.85);delete f.offers.pending;if(this.rng.next()<chance)this.setTruce(this.player.id,f.id);else this.notice(tr(f.nation)+' : '+tr('rejected'),'warn');}
   if(f.offers.incoming&&this.time>=f.offers.incoming.expires)delete f.offers.incoming;
   const pressureOffer=(f.ai.pressure||0)>=7.5&&this.time>this.options.prep+20&&this.time-(f.ai.lastPressureOffer??-999)>=90;if(!f.offers.incoming&&this.hostile(this.player.id,f.id)&&pressureOffer){f.ai.offer=Math.max(f.ai.offer,90);f.ai.lastPressureOffer=this.time;f.ai.pressure=Math.max(3,f.ai.pressure-3);f.offers.incoming={expires:this.time+45,reason:'pressure'};this.notice(tr(f.nation)+' : '+tr('trucePressure'),'warn');this.emit('TRUCE_OFFER',{owner:f.id,to:this.player.id,reason:'pressure'});continue;}
   if(f.ai.offer<=0&&this.time>this.options.prep+80&&this.hostile(this.player.id,f.id)){f.ai.offer=100;const health=this.alive(f.id,'city').reduce((a,c)=>a+c.hp/c.maxHP,0)/2;if(health<.76||f.res.money<600){f.offers.incoming={expires:this.time+35,reason:'weakness'};this.notice(tr(f.nation)+' : '+tr('offer'),'info');this.emit('TRUCE_OFFER',{owner:f.id,to:this.player.id,reason:'weakness'});}}
  }}
 /* ---- Persistence: explicit schema, no serialized object references ---- */
}
