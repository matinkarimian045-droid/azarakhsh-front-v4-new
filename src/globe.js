/* Decorative orthographic globe: original procedural land texture, no network/library. */
class CommandGlobe {
 constructor(){this.angle=.25;this.frame=0;this.cache=document.createElement('canvas');this.cache.width=this.cache.height=440;this.cc=this.cache.getContext('2d');this.image=this.cc.createImageData(440,440);this.samples=[];this.texture=this.makeTexture();this.stars=[];const r=new Random(8204);for(let i=0;i<110;i++)this.stars.push([r.next(),r.next(),r.range(.08,.40)]);const n=440,tilt=.20;
  for(let y=0;y<n;y++)for(let x=0;x<n;x++){const nx=(x-n/2+.5)/(n/2),ny=(y-n/2+.5)/(n/2),rr=nx*nx+ny*ny;if(rr>1)continue;const nz=Math.sqrt(1-rr),oy=ny*Math.cos(tilt)+nz*Math.sin(tilt),oz=-ny*Math.sin(tilt)+nz*Math.cos(tilt),lat=-Math.asin(oy),lon=Math.atan2(nx,oz);this.samples.push({i:(y*n+x)*4,u:(lon/(2*Math.PI)+.5)*720,v:clamp(Math.floor((.5-lat/Math.PI)*360),0,359),light:clamp(-nx*.47-ny*.52+nz*.73,.075,1),rim:Math.pow(1-nz,5),a:clamp((1-Math.sqrt(rr))*n/2,0,1)*255});}
  this.routes=[[[38,46],[49,13],0],[[31,116],[48,40],2.3],[[52,-5],[22,72],4.1],[[12,30],[52,98],6.4],[[40,-75],[30,-8],1.1]];
 }
 makeTexture(){const c=document.createElement('canvas');c.width=720;c.height=360;const x=c.getContext('2d');x.fillStyle='#0c2633';x.fillRect(0,0,720,360);
  const lands=GLOBE_LAND;
  for(const poly of lands){x.beginPath();poly.forEach(([lon,lat],i)=>{const a=(lon+180)*2,b=(90-lat)*2;i?x.lineTo(a,b):x.moveTo(a,b)});x.closePath();x.fillStyle='#446b58';x.fill();x.strokeStyle='#8c9b70';x.lineWidth=1.1;x.stroke();}
  const data=x.getImageData(0,0,720,360),rand=new Random(80);for(let i=0;i<data.data.length;i+=4){const variation=rand.range(.86,1.11);for(let j=0;j<3;j++)data.data[i+j]*=variation;}return data.data;
 }
 project(lat,lon,cx,cy,r,alt=0){const la=lat*Math.PI/180,lo=lon*Math.PI/180+this.angle,xx=Math.cos(la)*Math.sin(lo),yy=-Math.sin(la),zz=Math.cos(la)*Math.cos(lo),y=yy*Math.cos(.20)-zz*Math.sin(.20),z=yy*Math.sin(.20)+zz*Math.cos(.20);return{x:cx+xx*r*(1+alt),y:cy+y*r*(1+alt),z};}
 paintSphere(){const data=this.image.data,shift=this.angle/(2*Math.PI)*720,tex=this.texture;for(const s of this.samples){let u=Math.floor(s.u-shift);u=((u%720)+720)%720;const i=(s.v*720+u)*4,l=.20+s.light*.91;data[s.i]=tex[i]*l+s.rim*15;data[s.i+1]=tex[i+1]*l+s.rim*39;data[s.i+2]=tex[i+2]*l+s.rim*47;data[s.i+3]=s.a;}this.cc.putImageData(this.image,0,0);}
 path(c,coords,cx,cy,r,opacity){c.strokeStyle=`rgba(118,170,164,${opacity})`;c.lineWidth=.65;c.beginPath();let pen=false;for(const [lat,lon]of coords){const p=this.project(lat,lon,cx,cy,r);if(p.z>.01){if(pen)c.lineTo(p.x,p.y);else c.moveTo(p.x,p.y);pen=true;}else pen=false;}c.stroke();}
 routePoint(route,t,cx,cy,r){const [a,b]=route,lat=mix(a[0],b[0],t),lon=mix(a[1],b[1],t),alt=Math.sin(t*Math.PI)*.19;return this.project(lat,lon,cx,cy,r,alt);}
 draw(c,w,h,time,reduced){const mobile=w<=500;const r=mobile?Math.min(136,w*.35):Math.min(w*.30,h*.365,400),cx=mobile?w*.53:w*.31,cy=mobile?Math.min(h*.215,170):h*.51;this.angle=-.65+(reduced?0:time*.025);this.frame++;if(this.frame%3===0||this.frame===1)this.paintSphere();c.fillStyle='#080f16';c.fillRect(0,0,w,h);
  const wash=c.createRadialGradient(cx,cy,0,cx,cy,r*1.9);wash.addColorStop(0,'#15394099');wash.addColorStop(1,'#080f1600');c.fillStyle=wash;c.fillRect(0,0,w,h);
  for(const [sx,sy,a]of this.stars){c.fillStyle=`rgba(137,164,177,${a})`;c.fillRect(sx*w,sy*h,1,1);}
  c.strokeStyle='#42656a24';c.lineWidth=.6;for(let k=1;k<4;k++){c.beginPath();c.ellipse(cx,cy,r*(1+k*.12),r*(.97+k*.13),-.27,0,Math.PI*2);c.stroke();}
  c.strokeStyle='#6b929145';c.lineWidth=1;c.beginPath();c.arc(cx,cy,r*1.12,-.66,.56);c.stroke();c.beginPath();c.arc(cx,cy,r*1.12,2.52,3.69);c.stroke();
  const glow=c.createRadialGradient(cx,cy,r*.93,cx,cy,r*1.08);glow.addColorStop(0,'#52766a00');glow.addColorStop(.35,'#467b7350');glow.addColorStop(1,'#54868000');c.fillStyle=glow;c.fillRect(cx-r*1.1,cy-r*1.1,r*2.2,r*2.2);c.drawImage(this.cache,cx-r,cy-r,r*2,r*2);
  for(let lat=-60;lat<=60;lat+=30){const line=[];for(let lon=-180;lon<=180;lon+=3)line.push([lat,lon]);this.path(c,line,cx,cy,r,.12);}
  for(let lon=-180;lon<180;lon+=30){const line=[];for(let lat=-90;lat<=90;lat+=3)line.push([lat,lon]);this.path(c,line,cx,cy,r,.12);}
  c.strokeStyle='#77aba24f';c.lineWidth=1;c.beginPath();c.arc(cx,cy,r,0,Math.PI*2);c.stroke();
  for(const rt of this.routes){const age=((reduced?3.5:time)+rt[2])%10,phase=clamp(age/7,0,1),from=this.project(...rt[0],cx,cy,r),to=this.project(...rt[1],cx,cy,r);
   if(from.z>0){c.fillStyle='#a4c3ae';c.beginPath();c.arc(from.x,from.y,2,0,Math.PI*2);c.fill();}
   c.strokeStyle='#ce9b6755';c.lineWidth=1;c.setLineDash([2,6]);c.beginPath();let pen=false;for(let i=0;i<=44*phase;i++){const p=this.routePoint(rt,i/44,cx,cy,r);if(p.z>0){pen?c.lineTo(p.x,p.y):c.moveTo(p.x,p.y);pen=true;}else pen=false;}c.stroke();c.setLineDash([]);
   if(age<7){const p=this.routePoint(rt,phase,cx,cy,r),n=this.routePoint(rt,Math.min(phase+.005,1),cx,cy,r);if(p.z>0){c.save();c.translate(p.x,p.y);c.rotate(Math.atan2(n.y-p.y,n.x-p.x));c.shadowColor='#edb97c';c.shadowBlur=11;c.fillStyle='#f4d0a0';c.beginPath();c.moveTo(6,0);c.lineTo(-3,-1.8);c.lineTo(-1,0);c.lineTo(-3,1.8);c.closePath();c.fill();c.fillStyle='#ea985598';c.beginPath();c.moveTo(-2,-1);c.lineTo(-12-Math.sin(time*29)*3,0);c.lineTo(-2,1);c.fill();c.restore();}}
   else if(age<8.3&&to.z>0){const t=(age-7)/1.3,s=5+18*t;const glow=c.createRadialGradient(to.x,to.y,0,to.x,to.y,s);glow.addColorStop(0,`rgba(255,226,158,${(1-t)*.85})`);glow.addColorStop(.2,`rgba(247,142,67,${(1-t)*.6})`);glow.addColorStop(1,'#e1874100');c.fillStyle=glow;c.fillRect(to.x-s,to.y-s,s*2,s*2);c.strokeStyle=`rgba(222,177,111,${(1-t)*.55})`;c.beginPath();c.arc(to.x,to.y,s,0,Math.PI*2);c.stroke();}
  }
  if(!mobile){c.fillStyle='#799b9877';c.font='9px Arial';c.textAlign='left';c.fillText('ORBITAL VIEW / '+String(Math.floor(time*4)%10000).padStart(4,'0'),cx-r,cy+r*1.2);c.textAlign='right';c.fillText('COMMAND NETWORK ACTIVE',cx+r,cy+r*1.2);}
 }
}
