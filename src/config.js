'use strict';
/* All combat values are fictional game units. No real weapon modelling. */
const CONFIG = Object.freeze({version:'Azarakhsh Front V4',step:1/30,maxCatchup:.3,worldWidth:4200,worldHeight:3400,
  maxQueue:60,stackArcade:6,stackRealistic:4,cityHP:1100,startingMoney:14500,startingOil:160,startingTech:75,
  baseIncome:15,baseTech:.30,upkeepRate:.16,quality:{low:{particles:100,trail:16,dpr:1},medium:{particles:280,trail:32,dpr:1.5},high:{particles:650,trail:52,dpr:2}},
  difficulties:{easy:{income:.85,think:5,attack:36,salvo:2},normal:{income:1,think:4,attack:27,salvo:3},hard:{income:1.15,think:3.5,attack:20,salvo:4},expert:{income:2.0,think:.95,attack:8.5,salvo:6},nightmare:{income:2.7,think:.55,attack:4.8,salvo:8}}
});
const STRUCTURES = {
 oilrig:{cost:750,oil:0,build:11,hp:110,range:0,upkeep:.16,icon:'oilrig',role:'economic'},
 factory:{cost:1850,oil:8,build:19,hp:150,range:0,upkeep:.6,icon:'factory',role:'industry'},
 launcher:{cost:1300,oil:5,build:16,hp:120,range:0,upkeep:.35,icon:'launcher',role:'missiles'},
 sam:{cost:1550,oil:6,build:17,hp:120,range:415,upkeep:.42,icon:'sam',role:'defense'},
 aaa:{cost:950,oil:3,build:13,hp:110,range:260,upkeep:.27,icon:'aaa',role:'defense'},
 radar:{cost:900,oil:4,build:14,hp:100,range:480,upkeep:.2,icon:'radar',role:'intel'},
 airbase:{cost:2400,oil:12,build:24,hp:180,range:0,upkeep:.8,icon:'airbase',role:'aviation'},
 city:{cost:0,oil:0,build:0,hp:CONFIG.cityHP,range:0,upkeep:0,icon:'city',role:'city'}
};
const WEAPONS = {
 ballistic:{cost:340,oil:3,time:20,speed:102,damage:260,radius:80,arc:390,separate:.46,color:'#ffc77b',icon:'missile',research:null},
 cruise:{cost:350,oil:3,time:25,speed:126,damage:115,radius:58,arc:20,color:'#81d8ea',icon:'cruise',research:'cruise'},
 hyper:{cost:820,oil:8,time:50,speed:112,damage:165,radius:70,arc:350,separate:.46,color:'#b7adff',icon:'missile',research:'hyper'},
 drone:{cost:200,oil:2,time:17,speed:44,damage:100,radius:44,arc:24,color:'#a1ddad',icon:'drone',research:null},
 rain:{cost:680,oil:6,time:36,speed:96,damage:72,radius:58,arc:370,separate:.44,color:'#ffd98e',icon:'missile',research:'rain'},
 heavy:{cost:2400,oil:20,time:80,speed:78,damage:590,radius:190,arc:470,separate:.46,color:'#ffae80',icon:'missile',research:'heavy'},
 asat:{cost:950,oil:8,time:32,speed:340,damage:0,radius:0,arc:0,color:'#84d5ff',icon:'satellite',research:'asat'}
};
const RESEARCH = {
 cruise:{cost:38,time:24,category:'missiles',requires:[],icon:'cruise',effect:'Cruise unlock'},
 hyper:{cost:65,time:40,category:'missiles',requires:['cruise'],icon:'missile',effect:'Hypersonic unlock'},
 rain:{cost:48,time:32,category:'missiles',requires:[],icon:'missile',effect:'Cluster unlock'},
 heavy:{cost:125,time:65,category:'missiles',requires:['hyper'],icon:'missile',effect:'Heavy unlock'},
 defense:{cost:65,time:36,category:'defense',requires:[],icon:'sam',effect:'Radar +20% / SAM coverage +6%'},
 satellite:{cost:68,time:42,category:'intel',requires:[],icon:'satellite',effect:'Satellite identification / drone contacts'},
 asat:{cost:88,time:45,category:'intel',requires:['satellite'],icon:'satellite',effect:'Anti-satellite missile production'},
 oiltech:{cost:75,time:40,category:'economic',requires:[],icon:'oilrig',effect:'Extraction +50% / sale price +50%'},
 industry:{cost:65,time:36,category:'industry',requires:[],icon:'factory',effect:'Production +25% / construction +20%'},
 aviation:{cost:58,time:32,category:'aviation',requires:[],icon:'airbase',effect:'Patrol endurance +35% / intercept +10%'},
 economy:{cost:55,time:30,category:'economic',requires:[],icon:'money',effect:'Base income +25% / upkeep -15%'}
};
const NATIONS = {
 iran:{cities:['\u062a\u0647\u0631\u0627\u0646','\u0627\u0635\u0641\u0647\u0627\u0646'],weapons:['ballistic','drone','rain'],uv:[[.40,.28],[.59,.60]]},
 russia:{cities:['\u0645\u0633\u06a9\u0648','\u0633\u0646\u062a \u067e\u062a\u0631\u0632\u0628\u0648\u0631\u06af'],weapons:['hyper','ballistic','cruise'],uv:[[.22,.49],[.17,.30]]},
 china:{cities:['\u067e\u06a9\u0646','\u0634\u0627\u0646\u06af\u0647\u0627\u06cc'],weapons:['cruise','ballistic','drone'],uv:[[.76,.40],[.85,.64]]},
 israel:{cities:['\u062a\u0644 \u0622\u0648\u06cc\u0648','\u062d\u06cc\u0641\u0627'],weapons:['cruise','hyper','ballistic'],uv:[[.53,.43],[.59,.25]]},
 usa:{cities:['\u0648\u0627\u0634\u0646\u06af\u062a\u0646','\u0646\u06cc\u0648\u06cc\u0648\u0631\u06a9'],weapons:['cruise','heavy','hyper'],uv:[[.81,.34],[.86,.24]]},
 france:{cities:['\u067e\u0627\u0631\u06cc\u0633','\u0644\u06cc\u0648\u0646'],weapons:['cruise','ballistic','rain'],uv:[[.50,.30],[.66,.59]]},
 uk:{cities:['\u0644\u0646\u062f\u0646','\u0645\u0646\u0686\u0633\u062a\u0631'],weapons:['cruise','drone','ballistic'],uv:[[.72,.76],[.56,.53]]}
};

const NATION_PERKS = Object.freeze({
 iran:{label:'perkIran',oilSale:1.08},
 russia:{label:'perkRussia',hyperTime:.85},
 usa:{label:'perkUsa',airCost:.85},
 china:{label:'perkChina',factorySpeed:1.10},
 israel:{label:'perkIsrael',samBonus:.05},
 uk:{label:'perkUk',radarRange:1.10},
 france:{label:'perkFrance',researchTime:.90}
});

const ASSET_CONFIG = {maps:Object.fromEntries(Object.entries(ATLAS_DATA).map(([k,v])=>[k,v.file])),
  icons:{city:null,launcher:null,sam:null,aaa:null,radar:null,factory:null,oilrig:null,airbase:null},
  sounds:{
    click:'data:audio/wav;base64,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',
    intercept:'music/1629287080_I6zG1.mp3',
    explosion:'music/1629287207_W1hP8.mp3',
    takeoff:'music/airland.mp3',
    strike:'music/Jet_Fighter_Fly.mp3',
    launch:'music/missile launch sound.mp3',
    sam:'music/\u067e\u062f\u0627\u0641\u0646\u062f .mp3',
    aaa:'music/\u0636\u062f \u0647\u0648\u0627\u06cc\u06cc.mp3'
  }};
const SAM_INTERCEPT_CHANCE=.50;
const SAM_INTERCEPT_CHANCE_BY_TYPE=Object.freeze({hyper:.10,rain:.30});
const samInterceptChance=type=>Object.hasOwn(SAM_INTERCEPT_CHANCE_BY_TYPE,type)?SAM_INTERCEPT_CHANCE_BY_TYPE[type]:SAM_INTERCEPT_CHANCE;
const TRUCE_DURATION=300;
const DEFENSE = {arcade:{ballistic:.72,hyper:.20,heavy:.40,rain:.60,cruise:.76,drone:.66,fighter:.45,recon:.48,sub:.36},realistic:{ballistic:.80,hyper:.28,heavy:.40,rain:.68,cruise:.82,drone:.70,fighter:.55,recon:.55,sub:.45}};
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const mix=(a,b,t)=>a+(b-a)*t;
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const distance3=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y,(a.z||0)-(b.z||0));
const angleDiff=(a,b)=>Math.atan2(Math.sin(a-b),Math.cos(a-b));
const fmt=n=>Math.floor(Number.isFinite(n)?n:0).toLocaleString('fa-IR');
const clock=n=>`${String(Math.floor(Math.max(0,n)/60)).padStart(2,'0')}:${String(Math.floor(Math.max(0,n)%60)).padStart(2,'0')}`;
const escapeHTML=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
class Random {constructor(seed=420){this.seed=seed>>>0||1} next(){let x=this.seed;x^=x<<13;x^=x>>>17;x^=x<<5;this.seed=x>>>0;return this.seed/4294967296}range(a,b){return a+(b-a)*this.next()}pick(a){return a[Math.floor(this.next()*a.length)]}}

// One shared binding order for construction cards, the dock and the keyboard.
const BUILD_ORDER=['oilrig','factory','radar','aaa','sam','launcher','airbase'];
const AIR_CONFIG=Object.freeze({strikeDuration:7,strikeRelease:5.65,strikeTail:3,aaaInterval:.12,samInterval:.35});
const AUDIO_CONFIG=Object.freeze({strikeImpactOffset:7,maxVoices:20,poolSize:4});
const UI_FONT='Vazirmatn, Tahoma, Arial, sans-serif';
