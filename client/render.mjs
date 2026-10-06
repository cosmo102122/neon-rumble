import {FLOOR,W,H,FIGHTERS,hurtbox,hitbox} from './shared/engine.mjs';
const palettes={kite:{ink:'#0b1223',dark:'#7b303a',body:'#ed7041',light:'#ffbc73',skin:'#f5b782',skinDark:'#bc6b60',pants:'#263e64',pantsLight:'#536b8e',hair:'#48283b',boot:'#ced8e7'},rook:{ink:'#091523',dark:'#187080',body:'#4bc3c7',light:'#c1f5ed',skin:'#b98f78',skinDark:'#77576a',pants:'#242d4f',pantsLight:'#5b577c',hair:'#d7e1eb',boot:'#9bced7'}};
const clamp01=v=>Math.max(0,Math.min(1,v));
const easeOut=v=>1-Math.pow(1-clamp01(v),3);
const easeInOut=v=>{v=clamp01(v);return v<.5?4*v*v*v:1-Math.pow(-2*v+2,3)/2;};
function movePhase(f,m){
  if(!m)return{p:0,active:false,recovery:false};
  if(f.mf<m.startup)return{p:easeInOut(f.mf/Math.max(1,m.startup)),active:false,recovery:false};
  if(f.mf<m.startup+m.active)return{p:1,active:true,recovery:false};
  return{p:1-easeOut((f.mf-m.startup-m.active)/Math.max(1,m.recovery)),active:false,recovery:true};
}
// Pixel poses are authored in gameplay coordinates, not CSS images.
export function drawFighter(ctx,f,t,{scale=1,alt=false,ghost=false}={}){
  const p={...palettes[f.id]};if(alt){p.body=f.id==='kite'?'#bba4fc':'#cf77a0';p.light='#f0d7ff';p.dark='#665283';}
  ctx.save();ctx.translate(Math.round(f.x),Math.round(FLOOR-f.y));ctx.scale(f.face*scale,scale);ctx.globalAlpha=ghost?.22:1;
  const bob=f.state==='idle'?Math.sin(t/150)*1.5:f.state==='walk'?Math.sin(t/62)*2.2:0;
  const crouch=f.state==='crouch'||f.state==='blockLow'||f.move==='low';
  let hip=[-2,-28],chest=[0,-44],head=[2,-57],backKnee=[-11,-15],backFoot=[-16,-2],frontKnee=[9,-14],frontFoot=[16,-2];
  let backElbow=[-13,-35],backHand=[-8,-44],frontElbow=[15,-36],frontHand=[21,-47];
  if(crouch){hip=[-5,-19];chest=[3,-31];head=[7,-42];backKnee=[-16,-10];backFoot=[-19,-2];frontKnee=[14,-12];frontFoot=[21,-2];backElbow=[-9,-24];backHand=[-4,-34];frontElbow=[19,-27];frontHand=[24,-36];}
  if(f.state==='walk'){const c=Math.sin(t/92),s=Math.sin(t/92+Math.PI/2);hip[1]-=Math.abs(s)*1.2;chest[0]+=c*1.3;head[0]+=c*1.6;backKnee=[-8+c*10,-14-Math.max(0,-c)*2];frontKnee=[8-c*10,-16-Math.max(0,c)*2];backFoot=[-9+c*18,-2-Math.max(0,c)*5];frontFoot=[9-c*18,-2-Math.max(0,-c)*5];backHand=[-8-c*6,-44];frontHand=[21+c*6,-47];}
  if(f.y>0){const rise=Math.max(-1,Math.min(1,f.vy/8));hip=[-4,-30];chest=[1-rise*2,-46];head=[4-rise*3,-59];backKnee=[-16,-22+rise*3];backFoot=[-20,-13+rise*5];frontKnee=[12,-20-rise*2];frontFoot=[19,-15-rise*4];backElbow=[-15,-38];backHand=[-13,-47];frontElbow=[14,-39];frontHand=[20,-49];}
  if(f.state==='dash'){const d=easeOut(1-f.dash/9);hip=[-13+d*3,-24];chest=[4+d*3,-39];head=[14+d*2,-51];backKnee=[-24,-10];backFoot=[-34,-2];frontKnee=[14,-13];frontFoot=[25,-2];backElbow=[-20,-37];backHand=[-30,-39];frontElbow=[16,-37];frontHand=[28,-39];}
  if(f.move){
    const m=FIGHTERS[f.id].moves[f.move],phase=movePhase(f,m),ext=phase.p;
    if(f.move==='light'||f.move==='light2'){
      const snap=phase.active?1:ext;frontHand=[21+25*snap,-46];frontElbow=[15+13*snap,-43];chest[0]+=snap*3;head[0]+=snap*1.5;
      if(f.move==='light2'){backHand=[-8+31*snap,-44];backElbow=[-13+25*snap,-40];frontHand=[10,-47];chest[0]+=2*snap;}
    } else if(f.move==='heavy'){
      const k=phase.active?1:ext;hip[0]-=4*k;chest[0]-=6*k;head[0]-=8*k;frontKnee=[15+16*k,-27];frontFoot=[22+(f.id==='rook'?41:32)*k,-43];backHand=[-18,-43];frontHand=[4,-49];
    } else if(f.move==='low'){
      const k=phase.active?1:ext;hip[1]+=4*k;chest[1]+=4*k;frontKnee=[14+11*k,-9];frontFoot=[23+21*k,-4];frontHand=[17,-31];
    } else if(f.move==='special'){
      const k=phase.active?1:ext;chest[0]+=8*k;head[0]+=10*k;frontHand=[24+25*k,-43];frontElbow=[16+13*k,-40];backHand=f.id==='rook'?[23+23*k,-38]:[-14,-31];backFoot=[-25,-2];
    } else if(f.move==='airLight'){
      const k=phase.active?1:ext;hip[0]+=3*k;chest[0]+=6*k;head[0]+=7*k;frontElbow=[15+10*k,-41];frontHand=[20+28*k,-45];backKnee=[-17,-19];frontKnee=[10,-23];frontFoot=[18,-17];
    } else if(f.move==='airHeavy'){
      const k=phase.active?1:ext;hip[0]-=3*k;chest[0]-=7*k;head[0]-=8*k;frontKnee=[14+16*k,-28];frontFoot=[23+39*k,-42];backHand=[-19,-40];frontHand=[3,-51];
    } else if(f.move==='airSpecial'){
      const k=phase.active?1:ext;hip[1]-=3*k;chest[0]+=5*k;head[0]+=7*k;frontElbow=[17+12*k,-36];frontHand=[24+30*k,-33];frontKnee=[12,-22];frontFoot=[18+16*k,-8];backKnee=[-19,-21];backFoot=[-25,-16];
    }
  }
  if(f.state==='block'||f.state==='blockLow'){frontHand=[18,crouch?-44:-63];frontElbow=[19,crouch?-27:-44];backHand=[11,crouch?-38:-53];backElbow=[6,crouch?-24:-36];}
  if(f.state==='hurt'){const airborne=f.y>0;if(airborne){hip[0]-=5;chest[0]-=11;head[0]-=16;backKnee=[-18,-15];backFoot=[-26,-9];frontKnee=[12,-18];frontFoot=[20,-11];frontHand=[7,-24];backHand=[-22,-34];}else{chest[0]-=7;head[0]-=12;frontHand=[8,-27];backHand=[-20,-36];}}
  if(f.hp<=0){ctx.translate(-8,0);ctx.rotate(-f.face*Math.PI*.4);ctx.scale(1,.82);}
  const rect=(x,y,w,h,col)=>{ctx.fillStyle=col;ctx.fillRect(Math.round(x),Math.round(y+bob),w,h);};
  function limb(a,b,width,color){const dx=b[0]-a[0],dy=b[1]-a[1],n=Math.max(Math.abs(dx),Math.abs(dy))/2;for(let i=0;i<=n;i++){const q=n?i/n:0;rect(a[0]+dx*q-width/2,a[1]+dy*q-width/2,width,width,p.ink);}for(let i=0;i<=n;i++){const q=n?i/n:0;rect(a[0]+dx*q-width/2+2,a[1]+dy*q-width/2+2,width-4,width-4,color);}}
  function leg(knee,foot,front){limb(hip,knee,11,front?p.pantsLight:p.pants);limb(knee,foot,10,p.pants);rect(foot[0]-5,foot[1]-5,13,7,p.ink);rect(foot[0]-4,foot[1]-4,11,4,p.boot);rect(foot[0]-3,foot[1]-5,4,2,p.body);}
  leg(backKnee,backFoot,false);limb([chest[0]-6,chest[1]],backElbow,10,p.dark);limb(backElbow,backHand,8,p.skinDark);rect(backHand[0]-5,backHand[1]-5,10,10,p.ink);rect(backHand[0]-3,backHand[1]-4,7,7,p.dark);
  // Torso: stepped jacket silhouette, rim-lit seams, belt, shirt, and patches.
  limb(hip,chest,f.id==='rook'?24:20,p.body);rect(chest[0]-7,chest[1]-5,10,20,p.dark);rect(chest[0]+3,chest[1]-6,6,17,p.light);rect(chest[0]+4,chest[1]-1,2,14,p.ink);rect(hip[0]-9,hip[1]-3,19,5,p.ink);rect(hip[0]+3,hip[1]-2,4,3,p.light);
  if(f.id==='kite'){rect(chest[0]-8,chest[1]-7,17,5,p.dark);rect(chest[0]-13,chest[1]-2,6,13,p.body);rect(chest[0]-16-Math.sin(t/90)*3,chest[1]+5,9,4,p.light);}else{rect(chest[0]-13,chest[1]-9,12,10,p.dark);rect(chest[0]-11,chest[1]-8,9,4,p.light);rect(chest[0]+7,chest[1]+4,4,3,'#fff2a6');}
  leg(frontKnee,frontFoot,true);
  rect(head[0]-7,head[1]-8,17,20,p.ink);rect(head[0]-5,head[1]-5,13,14,p.skin);rect(head[0]-5,head[1]+3,11,5,p.skinDark);rect(head[0]+7,head[1]-1,4,5,p.skin);rect(head[0]+2,head[1]-2,7,2,p.ink);rect(head[0]+6,head[1]-2,2,2,'#eefbff');
  if(f.id==='kite'){rect(head[0]-8,head[1]-9,17,7,p.hair);rect(head[0]-5,head[1]-12,10,5,p.hair);rect(head[0]+4,head[1]-11,8,5,p.body);rect(head[0]-7,head[1]-6,4,11,p.hair);rect(head[0]-3,head[1]-9,9,2,p.light);}else{rect(head[0]-7,head[1]-10,15,6,p.hair);rect(head[0]-8,head[1]-6,5,9,p.hair);rect(head[0],head[1]-3,11,5,p.ink);rect(head[0]+2,head[1]-2,8,2,p.light);}
  limb([chest[0]+8,chest[1]-2],frontElbow,11,p.body);limb(frontElbow,frontHand,f.id==='rook'?12:9,f.id==='rook'?p.dark:p.skin);rect(frontHand[0]-6,frontHand[1]-6,13,12,p.ink);rect(frontHand[0]-4,frontHand[1]-5,10,9,p.body);rect(frontHand[0]-3,frontHand[1]-5,8,3,p.light);rect(frontHand[0]+4,frontHand[1]-1,3,4,p.dark);
  ctx.restore();
}
export class Renderer{
  constructor(canvas){this.c=canvas;this.ctx=canvas.getContext('2d',{alpha:false});this.ctx.imageSmoothingEnabled=false;this.stage=new Image();this.stage.src='/assets/rooftop.png';this.fx=[];this.lastEvent=0;this.lastMatch=0;this.shake=0;this.reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;}
  events(s,onSound){if(s.matchId!==this.lastMatch){this.lastMatch=s.matchId;this.lastEvent=0;this.fx=[];}for(const e of s.events){if(e.id<=this.lastEvent)continue;this.lastEvent=e.id;if(e.type==='hit'||e.type==='block'||e.type==='jumpCancel'){this.fx.push({...e,age:0});if(e.type==='hit'&&!this.reduced)this.shake=e.finisher?6:e.heavy?3.5:1.5;}onSound?.(e);} }
  draw(s,t,{menu=false,selected='kite',paused=false}={}){
    const c=this.ctx;c.save();if(this.shake>0){c.translate(Math.round(Math.sin(t)*this.shake),0);this.shake*=.7;if(this.shake<.2)this.shake=0;}
    c.fillStyle='#0b1d32';c.fillRect(0,0,W,H);if(this.stage.complete&&this.stage.naturalWidth)c.drawImage(this.stage,0,0,W,H);
    c.fillStyle='#07172c20';c.fillRect(0,0,W,H);
    // Low-key city animation and drifting rooftop dust.
    c.globalAlpha=.3;for(let i=0;i<13;i++){const x=(i*63+t*.007)%W,y=170+(i*23)%120;c.fillStyle=i%2?'#a4c8e0':'#ffbb75';c.fillRect(Math.floor(x),Math.floor(y+Math.sin(t/800+i)*3),1,1);}c.globalAlpha=1;
    const fighters=menu?[{...s.fighters[0],id:selected,x:448,y:0,state:'idle',move:null,face:-1,hp:1000}]:s.fighters;
    fighters.forEach((f,i)=>{c.fillStyle='#030a19a0';c.beginPath();c.ellipse(f.x,FLOOR+2,menu?37:Math.max(12,22-f.y*.025),5,0,0,Math.PI*2);c.fill();
      const trail=f.state==='dash'||['special','airSpecial','airHeavy'].includes(f.move);
      if(trail){drawFighter(c,{...f,x:f.x-f.face*10,y:Math.max(0,f.y-2)},t-24,{ghost:true});if(f.move==='airSpecial')drawFighter(c,{...f,x:f.x-f.face*19,y:Math.max(0,f.y-4)},t-42,{ghost:true});}
      drawFighter(c,f,t,{scale:menu?1.85:1,alt:!menu&&i===1&&s.fighters[0].id===f.id});});
    if(!menu){
      for(const p of s.projectiles){c.fillStyle='#1c728a';c.fillRect(p.x-15,p.y-7,25,14);c.fillStyle='#68eeef';c.fillRect(p.x-8,p.y-6,15,12);c.fillStyle='#eafffa';c.fillRect(p.x-5,p.y-3,11,6);}
      for(const f of this.fx){f.age++;
        if(f.type==='jumpCancel'){const alpha=Math.max(0,1-f.age/14);c.globalAlpha=alpha;c.fillStyle='#d9f7ff';for(let i=0;i<6;i++)c.fillRect(Math.round((f.x??W/2)-18+i*7),Math.round((f.y??FLOOR)-f.age*2-i%2*3),3,7);c.globalAlpha=1;continue;}
        const life=f.finisher?24:18,size=(f.finisher?24:f.heavy?18:12)+f.age*(f.finisher?1.05:.6),alpha=Math.max(0,1-f.age/life);c.globalAlpha=alpha;c.fillStyle=f.type==='block'?'#70e9ff':f.finisher?'#fff0a8':'#ffe5af';for(let i=0;i<(f.finisher?12:8);i++){const a=i*Math.PI/(f.finisher?6:4);c.fillRect(Math.round(f.x+Math.cos(a)*size),Math.round(f.y+Math.sin(a)*size),i%2?3:5,3);}c.fillStyle='#fff';if(f.age<(f.finisher?8:5)){c.fillRect(f.x-2,f.y-(f.finisher?24:16),4,f.finisher?48:32);c.fillRect(f.x-(f.finisher?24:16),f.y-2,f.finisher?48:32,4);}c.globalAlpha=1;}
      this.fx=this.fx.filter(f=>f.age<(f.finisher?24:f.type==='jumpCancel'?14:18));
      s.fighters.forEach((f,i)=>{if(f.combo>1&&f.comboAge>0){c.textAlign=i?'right':'left';c.font='italic bold 21px monospace';c.fillStyle=i?'#72e7e9':'#ffb97b';c.fillText(`${f.combo} HITS`,i?607:33,113);if(f.combo>=4){c.font='bold 9px monospace';c.fillStyle='#f6f0dc';c.fillText(f.combo>=7?'AERIAL MASTER':'JUGGLE',i?607:33,126);}}});
      if(!paused&&s.phase==='intro'){this.title(s.phaseFrames>30?`ROUND ${s.round}`:'FIGHT',s.phaseFrames>30?'FIRST TO TWO':'',s.phaseFrames<=30);}
      if(s.phase==='fight'&&s.events.some(e=>e.type==='fight'&&s.tick-e.tick<24))this.title('FIGHT','',true);
      if(s.phase==='roundOver')this.title(s.roundReason,s.roundWinner<0?'DRAW — RUN IT AGAIN':`${FIGHTERS[s.fighters[s.roundWinner].id].name} TAKES THE ROUND`);
    }c.restore();
  }
  title(main,sub='',orange=false){const c=this.ctx;c.save();c.textAlign='center';c.font='italic 52px Impact, sans-serif';c.lineWidth=7;c.strokeStyle='#0a1428';c.strokeText(main,W/2,173);c.fillStyle=orange?'#ffad64':'#f3f4ee';c.fillText(main,W/2,173);c.font='bold 9px monospace';c.fillStyle='#e7eefb';c.fillText(sub,W/2,193);c.restore();}
}
