class MapAtlas {
 constructor(data){this.data={};for(const [key,d] of Object.entries(data)){const bytes=Uint8Array.from(atob(d.mask),c=>c.charCodeAt(0)),land=new Uint8Array(d.width*d.height),points=[];for(let i=0;i<land.length;i++){land[i]=(bytes[i>>3]>>(7-(i&7)))&1;if(land[i])points.push({u:(i%d.width+.5)/d.width,v:(Math.floor(i/d.width)+.5)/d.height})}this.data[key]={...d,land,points,imageElement:null};}}
 async load(){await Promise.all(Object.entries(this.data).map(async([key,d])=>{d.imageElement=await this.loadImage(d.image);if(typeof Image==='undefined')return;this.loadImage(ASSET_CONFIG.maps[key]).then(im=>{if(im)d.imageElement=im})}));}
 loadImage(src){return new Promise(resolve=>{if(typeof Image==='undefined')return resolve(null);const im=new Image();im.onload=()=>resolve(im);im.onerror=()=>resolve(null);im.src=src})}
 bounds(f){const d=this.data[f.nation],h=920,w=Math.min(1080,h*d.aspect),hh=w/d.aspect;return{x:f.cx-w/2,y:f.cy-hh/2,w,h:hh}}
 uv(f,p){const b=this.bounds(f);return {u:(p.x-b.x)/b.w,v:(p.y-b.y)/b.h}}
 world(f,u,v){const b=this.bounds(f);return{x:b.x+b.w*u,y:b.y+b.h*v}}
 contains(f,p,pad=0){const d=this.data[f.nation],b=this.bounds(f);const raw=(x,y)=>{let u=(x-b.x)/b.w,v=(y-b.y)/b.h;if(u<0||v<0||u>=1||v>=1)return false;return !!d.land[Math.floor(v*d.height)*d.width+Math.floor(u*d.width)]};if(!raw(p.x,p.y))return false;if(!pad)return true;return [[pad,0],[-pad,0],[0,pad],[0,-pad]].every(([x,y])=>raw(p.x+x,p.y+y));}
 snap(f,u,v,pad=14){let best=null,score=Infinity;const wanted=this.world(f,u,v);for(const p of this.data[f.nation].points){const w=this.world(f,p.u,p.v);if(!this.contains(f,w,pad))continue;const s=(w.x-wanted.x)**2+(w.y-wanted.y)**2;if(s<score){score=s;best=w}}if(!best&&pad>0)return this.snap(f,u,v,0);return best||wanted}
 findSpace(f,objects,rng,kind){const narrow=this.bounds(f).w<450,spacing=narrow?33:48,pad=narrow?9:15,d=this.data[f.nation];for(let i=0;i<440;i++){const p=d.points[Math.floor(rng.next()*d.points.length)],w=this.world(f,p.u,p.v);if(!this.contains(f,w,pad))continue;if(objects.every(o=>o.dead||distance(o,w)>(o.kind==='city'?spacing+10:spacing)))return w}return null}
}
const atlas=new MapAtlas(ATLAS_DATA);
