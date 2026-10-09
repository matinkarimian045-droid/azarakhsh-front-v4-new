'use strict';
// UI fixture: actual shared simulation / snapshot, no simulated Socket.IO claims.
const {Simulation,atlas,CONFIG}=require('../server/load-simulation.cjs');const {snapshot}=require('../server/snapshot.cjs');
const g=new Simulation({style:'realistic',prep:0,intel:false,multiplayer:true,humanOwners:['f0','f1'],nation:'iran',slots:[{nation:'israel',role:'enemy'}]},5533);
for(const f of g.factions)for(const kind of ['oilrig','factory','radar','aaa','sam','launcher','airbase']){const p=atlas.findSpace(f,g.alive(f.id),g.rng,kind);g.addEntity(f.id,kind,p,{ready:true});}
for(const f of g.factions){f.res={money:19000,oil:300,tech:190};f.done={cruise:true,hyper:true,rain:true,heavy:true,satellite:true,asat:true};for(const k of Object.keys(f.stock))f.stock[k]=3;}
g.updateAI=()=>{};g.updateDiplomacy=()=>{};
const target=g.alive('f1','city')[0];g.launch('f0','heavy',target);g.launchAircraft('f1','patrol');
const duration=g.missiles[0].duration;for(let i=0;i<duration*.86/CONFIG.step;i++)g.tick(CONFIG.step);
const room={game:g,code:'ABC123',revision:101,paused:false,feeds:new Map([['f0',[]],['f1',[]]])};
const publicViews=[snapshot(room,'f0'),snapshot(room,'f1')];
g.options.intel=true;const m=g.missiles.find(x=>!x.dead);if(m){const r=g.operational('f1','radar')[0];r.x=m.x;r.y=m.y;r.damaged=false;m.z=40;}g.observe('f1',g.alive('f0','factory')[0],2);room.revision++;
console.log(JSON.stringify({publicViews,privateView:snapshot(room,'f1'),room:{code:room.code,status:'waiting',paused:false,settings:{style:'realistic',intel:true,prep:120,startMoney:14500},players:[{id:'p1',seat:1,name:'Player 1',nation:'iran',host:true,ready:true,connected:true},{id:'p2',seat:2,name:'Player 2',nation:'israel',host:false,ready:false,connected:true}]}}));
