import {FLOOR,W,H,FIGHTERS,hurtbox,hitbox} from './shared/engine.mjs?v=20261021-01';
const clamp01=v=>Math.max(0,Math.min(1,v));
const easeOut=v=>1-Math.pow(1-clamp01(v),3);
const easeInOut=v=>{v=clamp01(v);return v<.5?4*v*v*v:1-Math.pow(-2*v+2,3)/2;};
function movePhase(f,m){
  if(!m)return{p:0,active:false,recovery:false};
  if(f.mf<m.startup)return{p:easeInOut(f.mf/Math.max(1,m.startup)),active:false,recovery:false};
  if(f.mf<m.startup+m.active)return{p:1,active:true,recovery:false};
  return{p:1-easeOut((f.mf-m.startup-m.active)/Math.max(1,m.recovery)),active:false,recovery:true};
}
const TAU=Math.PI*2;
function streak(ctx,x,y,len,angle,width,color,alpha=1){
  ctx.save();ctx.translate(x,y);ctx.rotate(angle);ctx.globalAlpha=alpha;ctx.fillStyle=color;
  ctx.beginPath();ctx.moveTo(-len*.55,-width*.5);ctx.lineTo(len*.45,-width*.18);ctx.lineTo(len*.55,width*.18);ctx.lineTo(-len*.5,width*.5);ctx.closePath();ctx.fill();ctx.restore();
}
function impactRing(ctx,x,y,r,color,alpha=1,width=2){
  ctx.save();ctx.globalAlpha=alpha;ctx.strokeStyle=color;ctx.lineWidth=width;ctx.beginPath();ctx.arc(x,y,r,0,TAU);ctx.stroke();ctx.restore();
}
// body/dark/light = main outfit; trim = secondary outfit color; accent/glow = bright highlights.
const palettes={
  kite:{ink:'#140a1e',body:'#ff6a2b',dark:'#c2321f',light:'#ffb35c',trim:'#ffd23f',shirt:'#e8367f',skin:'#f7b98a',skinDark:'#d07a5e',pants:'#3b2d86',pantsLight:'#5b49c4',hair:'#6b1d6e',hairLight:'#ff5fb0',glove:'#e8273c',boot:'#f4f6fb',sole:'#2fd6f0',accent:'#2fd6f0',glow:'#fff27a'},
  rook:{ink:'#071423',body:'#25bfc4',dark:'#11697c',light:'#9ffff0',trim:'#ff9f2e',shirt:'#24315e',skin:'#c99474',skinDark:'#8a5f5c',pants:'#1f2a5c',pantsLight:'#34428c',hair:'#eef3ff',hairLight:'#ffffff',glove:'#11697c',boot:'#46607e',sole:'#ff9f2e',accent:'#6dfff2',glow:'#c08cff'}
};
const alts={kite:{body:'#9d6bff',dark:'#5a32b8',light:'#d2b6ff',trim:'#5ff7d2',shirt:'#ffd23f',hair:'#14365e',hairLight:'#5ff7d2',glove:'#2b8cff',pants:'#2a3a3f',pantsLight:'#3e5961'},
  rook:{body:'#e04f8e',dark:'#8c2156',light:'#ffc2dc',trim:'#ffe066',accent:'#ffe066',glow:'#7ff1ff',glove:'#8c2156',pants:'#2c1d48',pantsLight:'#4a3375'}};
const shadeCache=new Map();
// Mix a hex color toward white (amt>0) or black (amt<0) for highlights and shadows.
function shade(hex,amt){const key=hex+amt;if(shadeCache.has(key))return shadeCache.get(key);
  const n=parseInt(hex.slice(1,7),16),c=[n>>16,n>>8&255,n&255].map(v=>Math.round(amt>0?v+(255-v)*amt:v*(1+amt)));
  const out='#'+c.map(v=>v.toString(16).padStart(2,'0')).join('');shadeCache.set(key,out);return out;}
// Bone lengths and rest heights. Rook is taller and broader than Kite.
const RIG={kite:{thigh:15,shin:15,upper:12,fore:13,torso:17,hip:-30,chest:-47,head:-57},rook:{thigh:16,shin:16,upper:13,fore:14,torso:23,hip:-32,chest:-51,head:-62}};
// Two-bone IK: returns [joint, end]. `prefer` picks which of the two bend solutions to use.
function ik(a,b,l1,l2,prefer){
  let dx=b[0]-a[0],dy=b[1]-a[1],d=Math.hypot(dx,dy)||.001;const max=l1+l2-.5;
  if(d>max){b=[a[0]+dx/d*max,a[1]+dy/d*max];dx=b[0]-a[0];dy=b[1]-a[1];d=max;}
  const x=(l1*l1-l2*l2+d*d)/(2*d),h=Math.sqrt(Math.max(0,l1*l1-x*x)),mx=a[0]+dx/d*x,my=a[1]+dy/d*x,nx=-dy/d*h,ny=dx/d*h;
  const j1=[mx+nx,my+ny],j2=[mx-nx,my-ny];return[prefer(j1)>=prefer(j2)?j1:j2,b];
}
const knee=j=>j[0],elbow=j=>j[1]-j[0]*.4;
// Pose targets in local space (facing right, feet at 0, up is negative). Limbs are solved with IK so they never stretch.
function pose(f,t,r){
  const P={hip:[-1,r.hip],chest:[1,r.chest],head:[3,r.head],bf:[-11,-1],ff:[11,-1],bh:[9,r.chest+2],fh:[17,r.chest-3],fx:0};
  const set=(o)=>Object.assign(P,o),shift=(k,dx,dy=0)=>{P[k]=[P[k][0]+dx,P[k][1]+dy];};
  const crouch=f.y===0&&(f.state==='crouch'||f.state==='blockLow'||f.move==='low');
  if(f.state==='idle'&&!f.move){const b=Math.round(Math.sin(t/160)*1.2);for(const k of['hip','chest','head','bh','fh'])shift(k,0,b);}
  if(f.state==='walk'){const c=Math.sin(t/75);P.bf=[-9+c*9,-1-Math.max(0,c)*4];P.ff=[9-c*9,-1-Math.max(0,-c)*4];const b=Math.round(Math.abs(c)*-1.5);for(const k of['hip','chest','head','bh','fh'])shift(k,0,b);}
  if(crouch)set({hip:[-4,r.hip+12],chest:[4,r.chest+15],head:[8,r.head+15],bf:[-14,-1],ff:[15,-1],bh:[12,r.chest+13],fh:[19,r.chest+10]});
  if(f.y>0)set({hip:[-2,r.hip],chest:[1,r.chest+1],head:[3,r.head+1],bf:[-11,-15],ff:[9,-19]});
  if(f.state==='dash'){if((f.dashDir??1)>0)set({hip:[-6,r.hip+3],chest:[5,r.chest+5],head:[10,r.head+6],bf:[-22,-1],ff:[14,-1],bh:[-12,r.chest+6],fh:[20,r.chest+3]});
    else set({hip:[2,r.hip+1],chest:[-4,r.chest+1],head:[-4,r.head+1],bf:[-16,-6],ff:[8,-1],bh:[4,r.chest-2],fh:[10,r.chest-6]});}
  if(f.move){const m=FIGHTERS[f.id].moves[f.move],a=m.startup,b=a+m.active;
    // Wind-up pulls back, active snaps out, recovery eases home over 8 frames.
    const e=f.mf>=a&&f.mf<b?1:f.mf>=b?Math.max(0,1-(f.mf-b)/8):-.3*Math.min(1,f.mf/Math.max(1,a));
    const rook=f.id==='rook';
    if(f.move==='light'){P.fh=[17+19*e,r.chest+1];shift('chest',3*e);shift('head',2*e);}
    else if(f.move==='light2'){P.bh=[17+20*e,r.chest+2];P.fh=[12,r.chest-4];shift('chest',5*e);shift('head',4*e);shift('hip',2*e);}
    else if(f.move==='heavy'&&rook){P.fh=[20+21*e,r.chest+1];P.bh=[4,r.chest+6];shift('chest',7*e);shift('head',6*e);shift('hip',3*e);P.bf=[-19,-1];P.fx=e;}
    else if(f.move==='heavy'){P.ff=[12+24*e,-4-38*e];shift('chest',-4*e,2*e);shift('head',-7*e,2*e);P.bh=[-6,r.chest+4];P.fh=[8,r.chest-4];}
    else if(f.move==='low'){P.ff=[17+19*e,-3];shift('hip',-3*e);shift('chest',-3*e);shift('head',-3*e);P.bh=[-6,r.chest+18];}
    // Air combo: jab -> kick (Kite) / hammer (Rook) -> diving finisher.
    else if(f.move==='airLight'){P.fh=[17+19*e,r.chest+3];shift('chest',4*e);shift('head',3*e);P.bf=[-12,-17];P.ff=[8,-20];}
    else if(f.move==='airHeavy'&&rook){P.fh=[16+10*e,r.chest+4+12*e];P.bh=[12+10*e,r.chest+2+12*e];shift('chest',3*e,2*e);shift('head',4*e,2*e);P.fx=e;}
    else if(f.move==='airHeavy'){P.ff=[12+22*e,-16-14*e];P.bf=[-10,-21];shift('chest',-4*e);shift('head',-6*e);P.fh=[6,r.chest-4];}
    else if(f.move==='airSpecial'&&rook){P.fh=[18+12*e,r.chest+6+14*e];P.bh=[14+8*e,r.chest+10];shift('chest',5*e,3*e);shift('head',6*e,3*e);P.bf=[-14,-18];P.ff=[6,-14];P.fx=e;}
    else if(f.move==='airSpecial'){shift('chest',5*e,2*e);shift('head',7*e,2*e);P.ff=[14+16*e,-6];P.bf=[-15,-19];P.fh=[20+14*e,r.chest+12];P.bh=[-10,r.chest-2];}
    else if(f.move==='special'&&rook){P.fh=[20+12*e,r.chest+2];P.bh=[18+12*e,r.chest+6];shift('chest',4*e);shift('head',3*e);P.bf=[-17,-1];P.fx=e;}
    else if(f.move==='special'){set({hip:[-5,r.hip+3],chest:[4+4*e,r.chest+5],head:[9+4*e,r.head+6],bf:[-21,-1],ff:[15,-1],bh:[-14,r.chest+8]});P.fh=[22+14*e,r.chest+4];P.fx=e;}
  }
  if(f.state==='block'||f.state==='blockLow'){P.fh=[13,(crouch?r.chest+15:r.chest)-8];P.bh=[9,(crouch?r.chest+15:r.chest)-3];shift('chest',-2);shift('head',-2);}
  if(f.state==='hurt'&&f.y>0){shift('chest',-11,3);shift('head',-16,4);shift('hip',-5);P.fh=[-4,r.chest+14];P.bh=[-20,r.chest+4];P.ff=[18,-12];P.bf=[-22,-10];}
  else if(f.state==='hurt'){shift('chest',-7,2);shift('head',-12,3);shift('hip',-2);P.fh=[-2,r.chest+12];P.bh=[-16,r.chest+2];P.ff=[14,-1];}
  // Rook's big gauntlet sits lower in neutral stances so it doesn't hide his face.
  if(f.id==='rook'&&!f.move&&f.state!=='block'&&f.state!=='blockLow'&&f.state!=='hurt')P.fh=[P.fh[0]+1,P.fh[1]+8];
  return{P,crouch};
}
// Pixel poses are authored in gameplay coordinates, not CSS images.
export function drawFighter(ctx,f,t,{scale=1,alt=false,ghost=false}={}){
  const p={...palettes[f.id],...(alt?alts[f.id]:{})},r=RIG[f.id],rook=f.id==='rook',O=2,baseAlpha=ghost?.22:1;
  ctx.save();ctx.translate(Math.round(f.x),Math.round(FLOOR-f.y));ctx.scale(f.face*scale,scale);ctx.globalAlpha=baseAlpha;
  if(f.hp<=0){ctx.translate(-8,0);ctx.rotate(-f.face*Math.PI*.4);ctx.scale(1,.82);}
  const {P}=pose(f,t,r),{hip,chest,head}=P,hurt=f.state==='hurt'||f.hp<=0;
  const rect=(x,y,w,h,col)=>{ctx.fillStyle=col;ctx.fillRect(Math.round(x),Math.round(y),w,h);};
  // Chunky 2px outline: all pieces of a group are outlined first, then filled, so overlapping parts merge into one silhouette.
  function group(parts){for(const[x,y,w,h]of parts)rect(x-O,y-O,w+O*2,h+O*2,p.ink);for(const[x,y,w,h,col]of parts)rect(x,y,w,h,col);}
  // A limb is a chain of thick segments with a rim light on its upper/front edge and a shadow on the other.
  function chain(segs){
    const pts=[];
    for(const[a,b,w,col]of segs){const dx=b[0]-a[0],dy=b[1]-a[1],len=Math.hypot(dx,dy)||1,n=Math.ceil(Math.max(Math.abs(dx),Math.abs(dy)))||1;
      let nx=-dy/len,ny=dx/len;if(-ny*2+nx*.5<0){nx=-nx;ny=-ny;}
      for(let i=0;i<=n;i++){const q=i/n;pts.push([a[0]+dx*q,a[1]+dy*q,w,col,nx,ny]);}}
    for(const[x,y,w]of pts)rect(x-w/2-O,y-w/2-O,w+O*2,w+O*2,p.ink);
    for(const[x,y,w,col]of pts)rect(x-w/2,y-w/2,w,w,col);
    for(const[x,y,w,col,nx,ny]of pts){const o=w/2-1.5;rect(x-nx*o-1,y-ny*o-1,2,2,shade(col,-.32));}
    for(const[x,y,w,col,nx,ny]of pts){const o=w/2-1.5;rect(x+nx*o-1,y+ny*o-1,2,2,shade(col,.38));}
  }
  function leg(target,front){const[k,foot]=ik(hip,target,r.thigh,r.shin,knee),c=front?p.pantsLight:p.pants;
    chain([[hip,k,rook?12:11,c],[k,foot,rook?11:10,c]]);
    if(rook){group([[k[0]-4,k[1]-4,9,7,front?p.body:p.dark]]);rect(k[0]-3,k[1]-3,7,2,p.light);rect(k[0]-1,k[1],3,2,p.accent);}
    else{rect(k[0]-2,k[1]-1,5,2,p.trim);}
    group([[foot[0]-6,foot[1]-6,15,6,p.boot]]);rect(foot[0]-6,foot[1]-2,15,2,p.sole);rect(foot[0]-5,foot[1]-6,5,2,rook?p.dark:p.body);
    rect(foot[0]+2,foot[1]-5,1,2,p.ink);rect(foot[0]+5,foot[1]-5,1,2,p.ink);if(rook)rect(foot[0]+7,foot[1]-5,2,2,p.trim);}
  function arm(shoulder,target,front){const[e,hand]=ik(shoulder,target,r.upper,r.fore,elbow),sleeve=front?p.body:p.dark;
    if(rook){chain([[shoulder,e,11,sleeve],[e,hand,front?11:9,front?p.dark:shade(p.dark,-.2)]]);rect(e[0]-5,e[1]-2,10,3,p.trim);}
    else{chain([[shoulder,e,10,sleeve],[e,hand,8,front?p.skin:p.skinDark]]);rect(e[0]-3,e[1]-3,6,5,front?p.trim:shade(p.trim,-.3));}
    if(rook&&front){group([[hand[0]-7,hand[1]-7,15,14,p.dark]]);rect(hand[0]-7,hand[1]-7,15,3,p.light);rect(hand[0]+4,hand[1]-4,3,9,p.accent);
      rect(hand[0]-4,hand[1]-1,5,5,p.ink);rect(hand[0]-3,hand[1],3,3,p.glow);rect(hand[0]-7,hand[1]+4,10,1,p.ink);
      if(P.fx>.9){ctx.globalAlpha=baseAlpha*.6;rect(hand[0]+9,hand[1]-8,3,16,p.accent);rect(hand[0]+14,hand[1]-5,2,10,p.glow);ctx.globalAlpha=baseAlpha;}}
    else if(rook){group([[hand[0]-5,hand[1]-5,10,10,p.dark]]);rect(hand[0]-5,hand[1]-5,10,2,p.body);rect(hand[0]+2,hand[1]-1,2,2,p.accent);}
    else{const g=front?p.glove:shade(p.glove,-.3);group([[hand[0]-5,hand[1]-5,10,10,g]]);rect(hand[0]-5,hand[1]-5,10,2,shade(g,.4));rect(hand[0]+2,hand[1]-3,2,7,shade(g,-.3));}}
  const neck=[chest[0]-1,chest[1]-3],shF=[chest[0]+3,chest[1]+2],shB=[chest[0]-4,chest[1]+2],tw=r.torso,th=hip[1]-chest[1];
  // Back layer: Kite's striped scarf / Rook's coat tail, then the back leg and arm.
  if(!rook){const lift=f.state==='dash'||f.y>0||f.move==='special'?-3:0,parts=[];
    for(let i=0;i<7;i++){const x=neck[0]-4-i*4.5,y=neck[1]+2+i*1.6+Math.sin(t/110+i*.9)*i*.7+lift*i*.4;parts.push([x-3,y-2,6,5,i%2?p.dark:p.trim]);}
    group(parts);for(const[x,y]of parts)rect(x,y,6,1,'#ffffff40');}
  else{group([[hip[0]-14,hip[1]-5,10,18,p.dark]]);rect(hip[0]-13,hip[1]-4,8,2,p.body);rect(hip[0]-14,hip[1]+10,10,2,p.trim);}
  leg(P.bf,false);arm(shB,P.bh,false);
  // Torso.
  chain([[hip,[chest[0],chest[1]+2],tw,p.body]]);
  if(rook){rect(chest[0]-6,chest[1]+1,14,12,shade(p.body,.22));rect(chest[0]-6,chest[1]+13,14,1,p.ink);rect(chest[0]-6,hip[1]-7,14,1,p.dark);rect(chest[0]-6,hip[1]-11,14,1,p.dark);
    const pulse=.65+.35*Math.sin(t/180);rect(chest[0],chest[1]+4,6,6,p.ink);ctx.globalAlpha=baseAlpha*pulse;rect(chest[0]+1,chest[1]+5,4,4,p.glow);ctx.globalAlpha=baseAlpha;
    rect(chest[0]-10,chest[1]-3,11,3,p.dark);
    group([[chest[0]-2,chest[1]-7,16,9,p.dark]]);rect(chest[0]-2,chest[1]-7,16,2,p.light);rect(chest[0]+1,chest[1]-3,11,2,p.trim);rect(chest[0]+11,chest[1]-6,2,2,p.accent);}
  else{rect(chest[0]+2,chest[1]+1,5,th-4,p.shirt);rect(chest[0]+1,chest[1]+1,1,th-4,p.trim);rect(chest[0]+3,chest[1]+5,3,3,p.glow);rect(chest[0]+4,chest[1]+8,2,2,p.glow);
    rect(chest[0]-8,chest[1]-3,13,3,p.trim);rect(chest[0]-8,chest[1]+3,2,th-7,p.trim);rect(hip[0]-tw/2+1,hip[1]-6,tw-2,2,p.dark);}
  rect(hip[0]-tw/2,hip[1]-3,tw,4,p.ink);rect(hip[0]+2,hip[1]-2,4,2,p.trim);
  leg(P.ff,true);
  // Head: face, hair and gear share one outline.
  const h=head;
  if(rook){group([[h[0]-7,h[1]-8,15,17,p.skin],[h[0]-9,h[1]-11,16,6,p.hair],[h[0]-10,h[1]-7,5,11,p.hair],[h[0]-6,h[1]-2,4,6,p.dark]]);
    rect(h[0]-5,h[1]-10,9,1,p.hairLight);rect(h[0]-7,h[1]+3,12,6,p.skinDark);rect(h[0]-5,h[1],2,2,p.trim);
    rect(h[0]-1,h[1]-4,12,5,p.ink);rect(h[0],h[1]-3,10,3,hurt?p.trim:p.accent);rect(h[0]+1,h[1]-3,3,1,'#ffffff');rect(h[0]+3,h[1]+5,4,1,p.ink);}
  else{group([[h[0]-7,h[1]-8,14,16,p.skin],[h[0]-8,h[1]-11,15,6,p.hair],[h[0]-12,h[1]-14,5,5,p.hair],[h[0]-6,h[1]-16,5,5,p.hair],[h[0],h[1]-14,6,4,p.hair],[h[0]-11,h[1]-7,5,12,p.hair],[h[0]+4,h[1]-10,4,4,p.hair]]);
    rect(h[0]-5,h[1]-10,6,2,p.hairLight);rect(h[0]-11,h[1]-13,2,2,p.hairLight);rect(h[0]-5,h[1]-15,2,2,p.hairLight);
    rect(h[0]-7,h[1]+3,10,5,p.skinDark);rect(h[0]-4,h[1]-1,3,4,p.skinDark);rect(h[0]-8,h[1]-6,15,3,p.accent);rect(h[0]-8,h[1]-6,15,1,shade(p.accent,.5));
    if(hurt){rect(h[0]+2,h[1]-2,4,1,p.ink);}else{rect(h[0]+2,h[1]-3,3,3,'#ffffff');rect(h[0]+4,h[1]-3,1,3,p.ink);}
    rect(h[0]+1,h[1]-5,5,1,p.hair);rect(h[0]+1,h[1]+1,2,1,shade(p.skin,-.15));rect(h[0]+3,h[1]+4,hurt?2:3,hurt?2:1,p.ink);}
  // Front arm last so punches read over the body.
  arm(shF,P.fh,true);
  ctx.restore();
}
export class Renderer{
  constructor(canvas){this.c=canvas;this.ctx=canvas.getContext('2d',{alpha:false});this.ctx.imageSmoothingEnabled=false;this.stage=new Image();this.stage.src='./assets/rooftop.png';this.fx=[];this.lastEvent=0;this.lastMatch=0;this.shake=0;this.flash=0;this.cameraPunch=0;this.reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;}
  events(s,onSound){
    if(s.matchId!==this.lastMatch){this.lastMatch=s.matchId;this.lastEvent=0;this.fx=[];this.flash=0;this.cameraPunch=0;}
    for(const e of s.events){
      if(e.id<=this.lastEvent)continue;this.lastEvent=e.id;
      if(['hit','block','jumpCancel','dash','land','pulse'].includes(e.type))this.fx.push({...e,age:0});
      if(e.type==='hit'&&!this.reduced){this.shake=e.finisher?7:e.heavy?4.2:1.8;this.flash=e.finisher?.9:e.heavy?.42:.2;this.cameraPunch=e.finisher?.075:e.heavy?.045:.02;}
      if(e.type==='block'&&!this.reduced){this.shake=Math.max(this.shake,1.2);this.flash=Math.max(this.flash,.11);}
      onSound?.(e);
    }
  }
  draw(s,t,{menu=false,selected='kite',paused=false}={}){
    const c=this.ctx;c.save();
    const live=menu?[{...s.fighters[0],id:selected,x:448,y:0,state:'idle',move:null,face:-1,hp:1000}]:s.fighters;
    const dist=!menu&&live.length>1?Math.abs(live[0].x-live[1].x):260;
    const airborne=!menu&&live.length>1?Math.max(live[0].y,live[1].y):0;
    const closeZoom=!menu?(1+Math.max(0,150-dist)/150*.035+Math.min(airborne,120)/120*.022):1;
    const zoom=closeZoom+this.cameraPunch;
    const focusX=!menu&&live.length>1?(live[0].x+live[1].x)/2:W/2;
    const focusY=!menu&&live.length>1?FLOOR-44-Math.min(airborne,100)*.23:H/2;
    let sx=0,sy=0;
    if(this.shake>0&&!this.reduced){sx=Math.sin(t*.19)*this.shake;sy=Math.cos(t*.23)*this.shake*.45;this.shake*=.76;if(this.shake<.18)this.shake=0;}
    c.translate(W/2+sx,H/2+sy);c.scale(zoom,zoom);c.translate(-focusX,-focusY);
    c.fillStyle='#0b1d32';c.fillRect(focusX-W,focusY-H,W*2,H*2);if(this.stage.complete&&this.stage.naturalWidth)c.drawImage(this.stage,0,0,W,H);
    c.fillStyle='#07172c20';c.fillRect(0,0,W,H);
    // Low-key city animation and drifting rooftop dust.
    c.globalAlpha=.3;for(let i=0;i<13;i++){const x=(i*63+t*.007)%W,y=170+(i*23)%120;c.fillStyle=i%2?'#a4c8e0':'#ffbb75';c.fillRect(Math.floor(x),Math.floor(y+Math.sin(t/800+i)*3),1,1);}c.globalAlpha=1;
    const fighters=live;
    if(!menu){
      const action=fighters.find(f=>f.state==='dash'||['heavy','special','airHeavy','airSpecial'].includes(f.move));
      if(action&&!this.reduced){
        const activeMove=action.move&&FIGHTERS[action.id].moves[action.move];
        const phase=activeMove?movePhase(action,activeMove):{p:1};
        const strength=action.state==='dash'?.45:Math.max(.25,phase.p);
        c.save();c.globalCompositeOperation='screen';
        for(let i=0;i<12;i++){
          const y=90+i*15+Math.sin(t*.006+i)*7;
          const x=(action.face>0?25:W-25)-action.face*((t*.12+i*41)%90);
          streak(c,x,y,25+i%4*8,action.face>0?0:Math.PI,1+(i%3),action.id==='kite'?'#ff9c61':'#72f5ef',.05+.08*strength);
        }
        c.restore();
      }
    }
    fighters.forEach((f,i)=>{c.fillStyle='#030a19a0';c.beginPath();c.ellipse(f.x,FLOOR+2,menu?37:Math.max(12,22-f.y*.025),5,0,0,Math.PI*2);c.fill();
      const trail=f.state==='dash'||['special','airSpecial','airHeavy'].includes(f.move);
      if(trail){drawFighter(c,{...f,x:f.x-f.face*(f.state==='dash'?f.dashDir??1:1)*10,y:Math.max(0,f.y-2)},t-24,{ghost:true});if(f.move==='airSpecial')drawFighter(c,{...f,x:f.x-f.face*19,y:Math.max(0,f.y-4)},t-42,{ghost:true});}
      drawFighter(c,f,t,{scale:menu?1.85:1,alt:!menu&&i===1&&s.fighters[0].id===f.id});});
    if(!menu){
      for(const p of s.projectiles){
        c.save();c.globalCompositeOperation='screen';
        for(let i=0;i<5;i++)streak(c,p.x-12-i*7*Math.sign(p.vx),p.y+(i-2)*2,24-i*2,p.vx>0?0:Math.PI,5-i*.6,'#69ffff',.15+i*.09);
        impactRing(c,p.x,p.y,13+Math.sin(t*.02)*2,'#8cffff',.55,2);
        c.fillStyle='#1c728a';c.fillRect(p.x-15,p.y-7,25,14);c.fillStyle='#68eeef';c.fillRect(p.x-8,p.y-6,15,12);c.fillStyle='#eafffa';c.fillRect(p.x-5,p.y-3,11,6);c.restore();
      }
      for(const f of this.fx){f.age++;
        if(f.type==='dash'||f.type==='land'){
          const p=s.fighters[f.p]??{x:W/2,y:0};const baseY=FLOOR-p.y;const life=f.type==='dash'?14:18,alpha=Math.max(0,1-f.age/life);
          c.save();c.globalAlpha=alpha*.55;c.fillStyle='#c9d6e6';
          for(let i=0;i<7;i++){const dir=(i-3)*.7;c.fillRect(Math.round(p.x+dir*f.age*1.7),Math.round(baseY-2-Math.abs(dir)*2-f.age*.35),3+i%2,2+i%3);}
          c.restore();continue;
        }
        if(f.type==='pulse'){
          const p=s.fighters[f.p]??{x:W/2,y:0},y=FLOOR-p.y-40,alpha=Math.max(0,1-f.age/18);
          c.save();c.globalCompositeOperation='screen';impactRing(c,p.x,y,10+f.age*2.4,'#75ffff',alpha,3);impactRing(c,p.x,y,4+f.age*1.25,'#ffffff',alpha*.85,1);c.restore();continue;
        }
        if(f.type==='jumpCancel'){
          const p=s.fighters[f.p]??{x:W/2,y:0},alpha=Math.max(0,1-f.age/16);
          c.save();c.globalCompositeOperation='screen';
          for(let i=0;i<9;i++)streak(c,p.x+(i-4)*6,FLOOR-p.y+16+f.age*2,28+i%3*6,-Math.PI/2,2+i%2,'#d9f7ff',alpha*.45);
          c.restore();continue;
        }
        const life=f.finisher?28:20,size=(f.finisher?25:f.heavy?19:13)+f.age*(f.finisher?1.2:.72),alpha=Math.max(0,1-f.age/life);
        c.save();c.globalCompositeOperation='screen';
        const color=f.type==='block'?'#75efff':f.finisher?'#ffe36e':f.heavy?'#ffb35d':'#fff0c4';
        impactRing(c,f.x,f.y,size*.75,color,alpha*.8,f.finisher?4:2);
        if(f.finisher)impactRing(c,f.x,f.y,size*1.08,'#ffffff',alpha*.38,1);
        for(let i=0;i<(f.finisher?18:f.heavy?13:9);i++){
          const a=i*TAU/(f.finisher?18:f.heavy?13:9)+(f.id??0)*.17;
          const radius=size*(.72+(i%3)*.12);
          streak(c,f.x+Math.cos(a)*radius,f.y+Math.sin(a)*radius,f.finisher?27:18,a,f.finisher?4:3,color,alpha*(.35+(i%4)*.12));
        }
        if(f.age<(f.finisher?9:5)){c.globalAlpha=alpha;c.fillStyle='#fff';c.fillRect(f.x-2,f.y-(f.finisher?29:18),4,f.finisher?58:36);c.fillRect(f.x-(f.finisher?29:18),f.y-2,f.finisher?58:36,4);}
        c.restore();}
      this.fx=this.fx.filter(f=>f.age<(f.finisher?28:f.type==='jumpCancel'?16:f.type==='dash'?14:f.type==='land'?18:20));
      s.fighters.forEach((f,i)=>{if(f.combo>1&&f.comboAge>0){
        const x=i?607:33,align=i?'right':'left';c.save();c.textAlign=align;c.globalCompositeOperation='source-over';
        c.font='italic 900 25px Impact, sans-serif';c.lineWidth=5;c.strokeStyle='#07111f';c.strokeText(`${f.combo} HITS`,x,114);c.fillStyle=i?'#72f7ef':'#ffad65';c.fillText(`${f.combo} HITS`,x,114);
        if(f.combo>=4){c.font='bold 9px monospace';c.fillStyle='#fff8df';c.fillText(f.combo>=7?'AERIAL MASTER · MAX IMPACT':'AIR JUGGLE',x,129);}
        if(f.combo>=5){const y=139;c.globalAlpha=.65;c.fillStyle=i?'#52deda':'#ff8a4b';c.fillRect(i?x-72:x,y,72,2);}
        c.restore();
      }});
      if(!paused&&s.phase==='intro'){this.title(s.phaseFrames>30?`ROUND ${s.round}`:'FIGHT',s.phaseFrames>30?'FIRST TO TWO':'',s.phaseFrames<=30);}
      if(s.phase==='fight'&&s.events.some(e=>e.type==='fight'&&s.tick-e.tick<24))this.title('FIGHT','',true);
      if(s.phase==='roundOver'){
        if(s.phaseFrames>118){
          c.save();c.globalAlpha=Math.min(.42,(s.phaseFrames-118)/27*.42);c.fillStyle='#05070c';c.fillRect(-W,-H,W*3,H*3);c.restore();
        }
        this.title(s.roundReason,s.roundWinner<0?'DRAW — RUN IT AGAIN':`${FIGHTERS[s.fighters[s.roundWinner].id].name} TAKES THE ROUND`);
      }
      // Cinematic edge vignette during active combat.
      if(s.phase==='fight'){
        const g=c.createRadialGradient(W/2,H/2,90,W/2,H/2,360);g.addColorStop(0,'#00000000');g.addColorStop(1,'#02060c7a');c.fillStyle=g;c.fillRect(0,0,W,H);
      }
    }
    if(this.flash>0&&!this.reduced){c.restore();c.save();c.globalAlpha=this.flash*.28;c.fillStyle='#fff4dc';c.fillRect(0,0,W,H);this.flash*=.56;this.cameraPunch*=.5;if(this.cameraPunch<.002)this.cameraPunch=0;}
    c.restore();
  }
  title(main,sub='',orange=false){const c=this.ctx;c.save();c.textAlign='center';c.font='italic 52px Impact, sans-serif';c.lineWidth=7;c.strokeStyle='#0a1428';c.strokeText(main,W/2,173);c.fillStyle=orange?'#ffad64':'#f3f4ee';c.fillText(main,W/2,173);c.font='bold 9px monospace';c.fillStyle='#e7eefb';c.fillText(sub,W/2,193);c.restore();}
}
