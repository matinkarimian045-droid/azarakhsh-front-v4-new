'use strict';
/* AF 2.7 missile-dynamics + terminal visual tuning adapter.
 * The non-visual launch timing, ballistic/hypersonic/rain/heavy trajectory
 * progression and SAM ease+bend flight equation mirror the user-supplied AF V3
 * reference. Reborn still owns coordinates, rendering, effects, UI, AAA and netcode.
 * Units remain fictional game units.
 */
const FlightPhysics = Object.freeze({
 smooth(t){t=clamp(t,0,1);return t*t*(3-2*t);},
 split(m){return m.type==='rain'?.44:.46;},
 geometry(m){
  const part=m.type==='rain'?.50:m.type==='heavy'?.48:.53;
  const dist=Math.hypot(m.tx-m.sx,m.ty-m.sy);
  // The old source used an absolute screen apex. Reborn needs the same curve
  // progression in world coordinates, so only the apex *height* is adapted.
  const rise=clamp(dist*.26+200,m.type==='heavy'?510:420,860);
  return {x:mix(m.sx,m.tx,part),y:Math.min(m.sy,m.ty)-rise,groundY:mix(m.sy,m.ty,part),part};
 },
 projected(m,p){
  p=clamp(p,0,1);const a=m.apex||this.geometry(m),split=this.split(m);
  if(p<split){
   const raw=clamp(p/split,0,1),vertical=this.smooth(raw),turn=this.smooth(clamp((raw-.46)/.54,0,1));
   const dx=a.x-m.sx,dy=a.y-m.sy,len=Math.hypot(dx,dy)||1;
   const arc=Math.sin(Math.PI*raw)*(m.ascentArc||0)*turn;
   return {x:mix(m.sx,a.x,turn)-dy/len*arc,y:mix(m.sy,a.y,vertical)+dx/len*arc,groundY:mix(m.sy,a.groundY,turn)};
  }
  const q=(p-split)/(1-split),fall=m.type==='hyper'?Math.pow(q,m.realistic?5.45:4.20):Math.pow(q,m.realistic?1.48:1.33);
  return {x:mix(a.x,m.tx,fall),y:mix(a.y,m.ty,fall),groundY:mix(a.groundY,m.ty,fall)};
 }
});
const Trajectory={
 at(m,p){
  p=clamp(p,0,1);
  if(m.type==='sub'&&Number.isFinite(m.fanX)){
   const startY=m.sy-(m.sz||0)*.72;let x,y,groundY;
   if(p<.30){const q=FlightPhysics.smooth(p/.30),arc=Math.sin(Math.PI*q);x=m.sx+m.fanX*q;y=startY+m.fanY*q-arc*10;groundY=m.sy;}
   else{const q=FlightPhysics.smooth((p-.30)/.70),sx=m.sx+m.fanX,sy=startY+m.fanY;x=mix(sx,m.tx,q)+Math.sin(Math.PI*q)*m.fanX*.12;y=mix(sy,m.ty,Math.pow(q,1.16))-Math.sin(Math.PI*q)*6;groundY=mix(m.sy,m.ty,Math.pow(q,1.16));}
   return{x,y:groundY,z:Math.max(0,(groundY-y)/.72)};
  }
  if(m.type==='sub'||m.type==='airstrike')return{x:mix(m.sx,m.tx,p),y:mix(m.sy,m.ty,p),z:Math.max(0,(m.sz||0)*(1-p*p))};
  if(m.type==='asat')return{x:mix(m.sx,m.tx,p),y:mix(m.sy,m.ty,p),z:mix(m.sz||0,m.tz||300,p)};
  // Cruise/drone stay low and readable in Reborn; the high-arc types below use
  // the supplied reference equation exactly after coordinate adaptation.
  if(m.type==='cruise'||m.type==='drone')return{x:mix(m.sx,m.tx,p),y:mix(m.sy,m.ty,p),z:(m.type==='drone'?26:19)*Math.min(1,p*12,(1-p)*12)};
  const v=FlightPhysics.projected(m,p);return{x:v.x,y:v.groundY,z:Math.max(0,(v.groundY-v.y)/.72)};
 },
 phase(m){if(m.remoteTrack)return m.phase||'terminal';const p=clamp(m.age/m.duration,0,1);if(['cruise','drone','airstrike','sub'].includes(m.type))return p>.88?'terminal':'coast';return p<FlightPhysics.split(m)?'boost':p>.67?'terminal':'coast';},
 duration(type,a,b,realistic=false){
  const base=distance(a,b)/(WEAPONS[type]?.speed||120);
  if(realistic){
   if(type==='drone')return clamp(base,9,26);
   if(type==='hyper')return clamp(base,4.5,14);
   if(type==='cruise')return clamp(base,4.5,15);
   if(type==='ballistic')return clamp(base,4.8,15);
   return clamp(base,5.5,18);
  }
  if(type==='drone')return clamp(base,11,32);
  if(type==='hyper')return clamp(base,6.5,22);
  return clamp(base,7,24);
 }
};
const InterceptorPath={
 plan(origin,aim,lateral=0){
  const dx=aim.x-origin.x,dy=aim.y-origin.y,dz=(aim.z||0)-(origin.z||0),len=Math.hypot(dx,dy,dz)||1;
  return{exitDirection:{x:dx/len,y:dy/len,z:dz/len},curve:lateral};
 },
 at(p,age){
  const duration=Math.max(.001,p.flightTime),t=clamp(age/duration,0,1),q=FlightPhysics.smooth(t),o=p.origin,a=p.aim;
  const dx=a.x-o.x,dy=a.y-o.y,len=Math.hypot(dx,dy)||1,nx=-dy/len,ny=dx/len,bend=Math.sin(Math.PI*t)*(p.curve||0);
  return{x:mix(o.x,a.x,q)+nx*bend,y:mix(o.y,a.y,q)+ny*bend,z:mix(o.z||0,a.z||0,q)+Math.sin(Math.PI*t)*18};
 }
};
