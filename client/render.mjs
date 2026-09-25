import {FLOOR,W,H,FIGHTERS,hurtbox,hitbox} from './shared/engine.mjs';
const palettes={kite:{ink:'#0b1223',dark:'#7b303a',body:'#ed7041',light:'#ffbc73',skin:'#f5b782',skinDark:'#bc6b60',pants:'#263e64',pantsLight:'#536b8e',hair:'#48283b',boot:'#ced8e7'},rook:{ink:'#091523',dark:'#187080',body:'#4bc3c7',light:'#c1f5ed',skin:'#b98f78',skinDark:'#77576a',pants:'#242d4f',pantsLight:'#5b577c',hair:'#d7e1eb',boot:'#9bced7'}};
// Pixel poses are authored in gameplay coordinates, not CSS images.
export function drawFighter(ctx,f,t,{scale=1,alt=false,ghost=false}={}){
  const p={...palettes[f.id]};if(alt){p.body=f.id==='kite'?'#bba4fc':'#cf77a0';p.light='#f0d7ff';p.dark='#665283';}
  ctx.save();ctx.translate(Math.round(f.x),Math.round(FLOOR-f.y));ctx.scale(f.face*scale,scale);ctx.globalAlpha=ghost?.22:1;
  const bob=f.state==='idle'?Math.floor(Math.sin(t/140)*1.5):f.state==='walk'?Math.floor(Math.sin(t/48)*2):0;
  const crouch=f.state==='crouch'||f.state==='blockLow'||f.move==='low';
  let hip=[-2,-28],chest=[0,-44],head=[2,-57],backKnee=[-11,-15],backFoot=[-16,-2],frontKnee=[9,-14],frontFoot=[16,-2];
  let backElbow=[-13,-35],backHand=[-8,-44],frontElbow=[15,-36],frontHand=[21,-47];
  if(crouch){hip=[-5,-19];chest=[3,-31];head=[7,-42];backKnee=[-16,-10];backFoot=[-19,-2];frontKnee=[14,-12];frontFoot=[21,-2];backElbow=[-9,-24];backHand=[-4,-34];frontElbow=[19,-27];frontHand=[24,-36];}
  if(f.state==='walk'){const c=Math.sin(t/80);backKnee=[-8+c*9,-14];frontKnee=[8-c*9,-16];backFoot=[-9+c*17,-2-Math.max(0,c)*4];frontFoot=[9-c*17,-2-Math.max(0,-c)*4];}
  if(f.y>0){hip=[-4,-30];chest=[1,-46];head=[4,-59];backKnee=[-16,-22];backFoot=[-20,-13];frontKnee=[12,-20];frontFoot=[19,-15];}
  if(f.state==='dash'){hip=[-11,-24];chest=[2,-38];head=[12,-50];backKnee=[-23,-11];backFoot=[-32,-2];frontKnee=[12,-12];frontFoot=[22,-2];backHand=[-24,-40];frontHand=[24,-39];}
  if(f.move){const m=FIGHTERS[f.id].moves[f.move];const active=f.mf>=m.startup&&f.mf<m.startup+m.active;const recovery=f.mf>=m.startup+m.active;const ext=active?1:recovery?Math.max(0,1-(f.mf-m.startup-m.active)/8):-.25;
    if(f.move==='light'||f.move==='light2'){frontHand=[21+24*ext,-46];frontElbow=[15+12*ext,-43];chest[0]+=ext*3;if(f.move==='light2'){backHand=frontHand;backElbow=frontElbow;frontHand=[10,-47];}}
    else if(f.move==='heavy'||f.move==='air'){frontKnee=[15+14*ext,-28];frontFoot=[22+(f.id==='rook'?38:28)*ext,-42];frontHand=[5,-48];backHand=[-15,-42];chest[0]-=5*ext;head[0]-=7*ext;}
    else if(f.move==='low'){frontKnee=[14+10*ext,-9];frontFoot=[23+18*ext,-4];}
    else if(f.move==='special'){chest[0]+=7*ext;head[0]+=9*ext;frontHand=[24+22*ext,-43];frontElbow=[16+12*ext,-40];backHand=f.id==='rook'?[24+20*ext,-38]:[-13,-32];backFoot=[-24,-2];}
  }
  if(f.state==='block'||f.state==='blockLow'){frontHand=[18,crouch?-44:-63];frontElbow=[19,crouch?-27:-44];backHand=[11,crouch?-38:-53];backElbow=[6,crouch?-24:-36];}
  if(f.state==='hurt'){chest[0]-=7;head[0]-=12;frontHand=[8,-27];backHand=[-20,-36];}
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
  events(s,onSound){if(s.matchId!==this.lastMatch){this.lastMatch=s.matchId;this.lastEvent=0;this.fx=[];}for(const e of s.events){if(e.id<=this.lastEvent)continue;this.lastEvent=e.id;if(e.type==='hit'||e.type==='block'){this.fx.push({...e,age:0});if(e.type==='hit'&&e.heavy&&!this.reduced)this.shake=3;}onSound?.(e);} }
  draw(s,t,{menu=false,selected='kite',paused=false}={}){
    const c=this.ctx;c.save();if(this.shake>0){c.translate(Math.round(Math.sin(t)*this.shake),0);this.shake*=.7;if(this.shake<.2)this.shake=0;}
    c.fillStyle='#0b1d32';c.fillRect(0,0,W,H);if(this.stage.complete&&this.stage.naturalWidth)c.drawImage(this.stage,0,0,W,H);
    c.fillStyle='#07172c20';c.fillRect(0,0,W,H);
    // Low-key city animation and drifting rooftop dust.
    c.globalAlpha=.3;for(let i=0;i<13;i++){const x=(i*63+t*.007)%W,y=170+(i*23)%120;c.fillStyle=i%2?'#a4c8e0':'#ffbb75';c.fillRect(Math.floor(x),Math.floor(y+Math.sin(t/800+i)*3),1,1);}c.globalAlpha=1;
    const fighters=menu?[{...s.fighters[0],id:selected,x:448,y:0,state:'idle',move:null,face:-1,hp:1000}]:s.fighters;
    fighters.forEach((f,i)=>{c.fillStyle='#030a19a0';c.beginPath();c.ellipse(f.x,FLOOR+2,menu?37:22,5,0,0,Math.PI*2);c.fill();if(f.state==='dash'||(f.move==='special'&&f.id==='kite'))drawFighter(c,{...f,x:f.x-f.face*15},t,{ghost:true});drawFighter(c,f,t,{scale:menu?1.85:1,alt:!menu&&i===1&&s.fighters[0].id===f.id});});
    if(!menu){
      for(const p of s.projectiles){c.fillStyle='#1c728a';c.fillRect(p.x-15,p.y-7,25,14);c.fillStyle='#68eeef';c.fillRect(p.x-8,p.y-6,15,12);c.fillStyle='#eafffa';c.fillRect(p.x-5,p.y-3,11,6);}
      for(const f of this.fx){f.age++;const size=(f.heavy?18:12)+f.age*.6;const alpha=Math.max(0,1-f.age/18);c.globalAlpha=alpha;c.fillStyle=f.type==='block'?'#70e9ff':'#ffe5af';for(let i=0;i<8;i++){const a=i*Math.PI/4;c.fillRect(Math.round(f.x+Math.cos(a)*size),Math.round(f.y+Math.sin(a)*size),i%2?3:5,3);}c.fillStyle='#fff';if(f.age<5){c.fillRect(f.x-2,f.y-16,4,32);c.fillRect(f.x-16,f.y-2,32,4);}c.globalAlpha=1;}
      this.fx=this.fx.filter(f=>f.age<18);
      s.fighters.forEach((f,i)=>{if(f.combo>1&&f.comboAge>0){c.textAlign=i?'right':'left';c.font='italic bold 21px monospace';c.fillStyle=i?'#72e7e9':'#ffb97b';c.fillText(`${f.combo} HITS`,i?607:33,113);}});
      if(!paused&&s.phase==='intro'){this.title(s.phaseFrames>30?`ROUND ${s.round}`:'FIGHT',s.phaseFrames>30?'FIRST TO TWO':'',s.phaseFrames<=30);}
      if(s.phase==='fight'&&s.events.some(e=>e.type==='fight'&&s.tick-e.tick<24))this.title('FIGHT','',true);
      if(s.phase==='roundOver')this.title(s.roundReason,s.roundWinner<0?'DRAW — RUN IT AGAIN':`${FIGHTERS[s.fighters[s.roundWinner].id].name} TAKES THE ROUND`);
    }c.restore();
  }
  title(main,sub='',orange=false){const c=this.ctx;c.save();c.textAlign='center';c.font='italic 52px Impact, sans-serif';c.lineWidth=7;c.strokeStyle='#0a1428';c.strokeText(main,W/2,173);c.fillStyle=orange?'#ffad64':'#f3f4ee';c.fillText(main,W/2,173);c.font='bold 9px monospace';c.fillStyle='#e7eefb';c.fillText(sub,W/2,193);c.restore();}
}
