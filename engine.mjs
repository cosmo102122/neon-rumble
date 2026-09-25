// Pure deterministic simulation. Both the server and prediction client use this file.
export const FPS = 60, W = 640, H = 360, FLOOR = 290, ROUND_FRAMES = 60 * 60;
export const B = { left:1, right:2, jump:4, crouch:8, light:16, heavy:32, special:64, dash:128, block:256 };
export const FIGHTERS = {
  kite: { name:'KITE', title:'The rooftop runner', style:'Fast pressure · close range', speed:2.55, jump:8.2, color:'#ff9548',
    moves:{
      light:{startup:5,active:3,recovery:13,damage:62,stun:19,blockstun:10,range:38,kb:1.6},
      light2:{startup:6,active:3,recovery:15,damage:68,stun:22,blockstun:12,range:44,kb:1.9},
      heavy:{startup:10,active:4,recovery:23,damage:112,stun:28,blockstun:15,range:59,kb:3.1},
      special:{startup:12,active:9,recovery:26,damage:142,stun:29,blockstun:18,range:49,kb:5,lunge:3.8},
      low:{startup:7,active:3,recovery:18,damage:70,stun:21,blockstun:12,range:42,kb:2,low:true},
      air:{startup:7,active:5,recovery:18,damage:80,stun:22,blockstun:12,range:43,kb:2.5,overhead:true}
    }},
  rook: { name:'ROOK',title:'The circuit breaker',style:'Long reach · pulse projectile',speed:2.05,jump:7.8,color:'#54e5e1',
    moves:{
      light:{startup:7,active:4,recovery:15,damage:70,stun:22,blockstun:12,range:48,kb:1.6},
      light2:{startup:8,active:4,recovery:17,damage:76,stun:24,blockstun:14,range:52,kb:2},
      heavy:{startup:13,active:5,recovery:26,damage:130,stun:31,blockstun:18,range:72,kb:3.7},
      special:{startup:20,active:1,recovery:32,damage:110,stun:24,blockstun:16,range:0,kb:3.1,projectile:true},
      low:{startup:9,active:4,recovery:20,damage:78,stun:23,blockstun:13,range:50,kb:2.4,low:true},
      air:{startup:9,active:6,recovery:20,damage:88,stun:25,blockstun:14,range:48,kb:2.8,overhead:true}
    }}
};
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export const clone = s => JSON.parse(JSON.stringify(s));
export function makeFighter(id, index) {
  return {id:FIGHTERS[id]?id:'kite',x:index?450:190,y:0,vx:0,vy:0,face:index?-1:1,hp:1000,
    state:'idle',move:null,mf:0,hit:false,connected:false,stun:0,blockstun:0,dash:0,dashCd:0,specialCd:0,
    input:0,prev:0,buffer:0,bufferAge:0,attackId:0,combo:0,comboAge:0};
}
export function createMatch(ids=['kite','kite'], options={}) {
  return {tick:0,phase:'intro',phaseFrames:options.introFrames??120,round:1,wins:[0,0],fighters:ids.map(makeFighter),
    timer:ROUND_FRAMES,hitstop:0,projectiles:[],events:[],eventId:0,winner:-1,roundWinner:-1,roundReason:'',matchId:options.matchId??1};
}
function emit(s,type,data={}) {s.events.push({id:++s.eventId,tick:s.tick,type,...data});if(s.events.length>36)s.events.shift();}
export function hurtbox(f) {const crouch=f.y===0&&(f.state==='crouch'||f.state==='blockLow'||f.move==='low');return{x:f.x-12,y:FLOOR-f.y-(crouch?39:65),w:24,h:crouch?39:65};}
export function hitbox(f) {
  const m=FIGHTERS[f.id].moves[f.move];
  if(!m||m.projectile||f.mf<m.startup||f.mf>=m.startup+m.active)return null;
  const top=m.low?25:m.overhead?52:58;
  return{x:f.face>0?f.x+7:f.x-7-m.range,y:FLOOR-f.y-top,w:m.range,h:m.low?23:m.overhead?36:30};
}
const intersects=(a,b)=>a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y;
function startMove(s,f,key) {f.move=key;f.mf=0;f.hit=false;f.connected=false;f.attackId++;f.state='attack';f.buffer=0;f.vx=0;if(key==='special')f.specialCd=66;emit(s,'swing',{p:s.fighters.indexOf(f),move:key});}
function moveInput(f,input) {if(input&B.special)return 'special';if(input&B.heavy)return f.y>0?'air':'heavy';if(input&B.light)return f.y>0?'air':(f.input&B.crouch)?'low':'light';return null;}
function updateFighter(s,f,o,mask,pressed) {
  const stats=FIGHTERS[f.id]; f.input=mask;
  if(f.dashCd>0)f.dashCd--;if(f.specialCd>0)f.specialCd--;
  if(f.comboAge>0)f.comboAge--;else f.combo=0;
  if(pressed&(B.light|B.heavy|B.special)){f.buffer=pressed&(B.light|B.heavy|B.special);f.bufferAge=8;}
  else if(f.bufferAge>0)f.bufferAge--;else f.buffer=0;
  const frozen=f.stun>0||f.blockstun>0;
  if(f.stun>0){f.stun--;f.state='hurt';f.move=null;f.dash=0;}
  else if(f.blockstun>0){f.blockstun--;f.state=mask&B.crouch?'blockLow':'block';f.move=null;f.dash=0;}
  else if(f.move){
    const m=stats.moves[f.move];f.mf++;
    // Cancels require a confirmed hit, not a whiff or block. No looping light chains.
    const next=moveInput(f,f.buffer);
    let cancel=null;
    if(f.connected&&f.mf>=m.startup+1&&f.mf<=m.startup+m.active+12&&next){
      if(f.move==='light'&&next==='light')cancel='light2';
      if(['light','light2','low'].includes(f.move)&&next==='heavy')cancel='heavy';
      if(['light','light2','heavy'].includes(f.move)&&next==='special'&&f.specialCd===0)cancel='special';
    }
    if(cancel)startMove(s,f,cancel);
    else if(f.mf>=m.startup+m.active+m.recovery){f.move=null;f.state='idle';}
    else if(m.lunge&&f.mf>=m.startup&&f.mf<m.startup+m.active){f.x+=f.face*m.lunge;}
    if(m.projectile&&f.move==='special'&&f.mf===m.startup){
      s.projectiles.push({id:++s.eventId,owner:s.fighters.indexOf(f),x:f.x+f.face*25,y:FLOOR-f.y-39,vx:f.face*4.9,life:130,damage:m.damage,stun:m.stun,blockstun:m.blockstun,kb:m.kb});
      emit(s,'pulse',{p:s.fighters.indexOf(f)});
    }
  }else if(f.dash>0){f.dash--;f.state='dash';f.x+=f.face*5.5;}
  else {
    if(f.y===0)f.face=o.x>=f.x?1:-1;
    const desired=moveInput(f,f.buffer);
    if(desired&&(!(desired==='special')||f.specialCd===0))startMove(s,f,desired);
    else if((pressed&B.dash)&&f.y===0&&f.dashCd===0){f.dash=9;f.dashCd=30;f.state='dash';emit(s,'dash',{p:s.fighters.indexOf(f)});}
    else if((pressed&B.jump)&&f.y===0){f.vy=stats.jump;f.y=0.01;f.state='jump';emit(s,'jump',{p:s.fighters.indexOf(f)});}
    else if((mask&B.block)&&f.y===0)f.state=mask&B.crouch?'blockLow':'block';
    else if((mask&B.crouch)&&f.y===0)f.state='crouch';
    else {const axis=+(!!(mask&B.right))-+(!!(mask&B.left));f.x+=axis*stats.speed*(f.y>0?0.86:1);f.state=f.y>0?'jump':axis?'walk':'idle';}
  }
  if(f.y>0||f.vy!==0){f.y+=f.vy;f.vy-=0.42;if(f.y<=0){f.y=0;f.vy=0;if(f.state==='jump')f.state='idle';emit(s,'land',{p:s.fighters.indexOf(f)});}}
  if(frozen||f.vx!==0){f.x+=f.vx;f.vx*=0.82;if(Math.abs(f.vx)<0.06)f.vx=0;}
  f.x=clamp(f.x,24,W-24);
}
function applyHit(s,attackerIndex,defenderIndex,m,originX) {
  const a=s.fighters[attackerIndex],d=s.fighters[defenderIndex];
  const facing=(originX-d.x)*d.face>=-4;
  const guarding=d.y===0&&!d.move&&d.stun===0&&d.dash===0&&(d.input&B.block)&&facing;
  const blocked=guarding&&(!m.low||d.input&B.crouch)&&(!m.overhead||!(d.input&B.crouch));
  if(blocked){d.blockstun=m.blockstun;d.vx=(d.x>=originX?1:-1)*m.kb*0.5;d.state=d.input&B.crouch?'blockLow':'block';s.hitstop=Math.max(s.hitstop,3);emit(s,'block',{p:defenderIndex,x:d.x,y:FLOOR-d.y-40});}
  else {
    const combo=d.stun>0?a.combo+1:1;
    const damage=Math.round(m.damage*Math.max(0.55,1-(combo-1)*0.12));
    d.hp=Math.max(0,d.hp-damage);d.stun=m.stun;d.blockstun=0;d.move=null;d.dash=0;d.state='hurt';d.vx=(d.x>=originX?1:-1)*m.kb;
    a.connected=true;a.combo=combo;a.comboAge=65;s.hitstop=Math.max(s.hitstop,m.damage>=100?6:4);
    emit(s,'hit',{p:defenderIndex,by:attackerIndex,damage,combo,x:d.x,y:FLOOR-d.y-40,heavy:m.damage>=100});
  }
}
export function step(s, masks=[0,0], edges) {
  s.tick++;
  const pressed=masks.map((v,i)=>edges?edges[i]:v&~s.fighters[i].prev);
  if(s.phase==='matchOver'||s.phase==='forfeit')return s;
  if(s.phase==='intro'){
    s.phaseFrames--;s.fighters.forEach((f,i)=>{f.prev=masks[i];f.input=masks[i];});
    if(s.phaseFrames<=0){s.phase='fight';emit(s,'fight');}return s;
  }
  if(s.phase==='roundOver'){
    if(--s.phaseFrames<=0){
      if(s.wins.some(v=>v>=2)){s.phase='matchOver';s.winner=s.wins[0]>=2?0:1;emit(s,'match',{winner:s.winner});}
      else{const ids=s.fighters.map(f=>f.id);s.fighters=ids.map(makeFighter);s.round++;s.timer=ROUND_FRAMES;s.phase='intro';s.phaseFrames=100;s.projectiles=[];}
    }return s;
  }
  if(s.hitstop>0){s.hitstop--;s.fighters.forEach((f,i)=>{if(pressed[i]&(B.light|B.heavy|B.special)){f.buffer=pressed[i]&(B.light|B.heavy|B.special);f.bufferAge=8;}f.prev=masks[i];});return s;}
  s.timer--;
  for(let i=0;i<2;i++)updateFighter(s,s.fighters[i],s.fighters[1-i],masks[i],pressed[i]);
  // Pushboxes stop walking through a grounded opponent; jumping can cross over.
  const [a,b]=s.fighters;
  if(Math.abs(a.y-b.y)<48&&Math.abs(a.x-b.x)<26){const dir=b.x>=a.x?1:-1;const push=(26-Math.abs(a.x-b.x))/2;a.x=clamp(a.x-dir*push,24,W-24);b.x=clamp(b.x+dir*push,24,W-24);}
  // Collect contacts first, then resolve: simultaneous hits can trade fairly.
  const contacts=[];
  for(let i=0;i<2;i++){const f=s.fighters[i],box=hitbox(f);if(box&&!f.hit&&intersects(box,hurtbox(s.fighters[1-i]))){f.hit=true;contacts.push([i,1-i,{...FIGHTERS[f.id].moves[f.move]},f.x]);}}
  for(const p of s.projectiles){p.x+=p.vx;p.life--;if(p.life>0&&intersects({x:p.x-8,y:p.y-8,w:16,h:16},hurtbox(s.fighters[1-p.owner]))){contacts.push([p.owner,1-p.owner,p,p.x]);p.life=0;}}
  for(const contact of contacts)applyHit(s,...contact);
  s.projectiles=s.projectiles.filter(p=>p.life>0&&p.x>-20&&p.x<W+20);
  s.fighters.forEach((f,i)=>{f.prev=masks[i];});
  if(a.hp<=0||b.hp<=0||s.timer<=0){
    s.roundWinner=a.hp===b.hp?-1:a.hp>b.hp?0:1;
    s.roundReason=s.timer<=0?'TIME':'K.O.';
    if(s.roundWinner>=0)s.wins[s.roundWinner]++;
    s.phase='roundOver';s.phaseFrames=145;s.projectiles=[];
    emit(s,'round',{winner:s.roundWinner,reason:s.roundReason});
  }
  return s;
}
