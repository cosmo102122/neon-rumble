// Pure deterministic simulation. Both the server and prediction client use this file.
export const FPS = 60, W = 640, H = 360, FLOOR = 290, ROUND_FRAMES = 60 * 60;
export const B = { left:1, right:2, jump:4, crouch:8, light:16, heavy:32, special:64, dash:128, block:256 };
export const METER_MAX = 100, EX_COST = 50, SUPER_FREEZE = 40;
// Move fields beyond frame data:
//   cd: special cooldown it starts · invuln: 'all' | 'air' | 'proj' during startup+active · armor: absorbs one hit
//   aa: tall anti-air hitbox · projectile: spawns a projectile (speed, pw/ph size, low, kind) · chip: damage dealt through a block
//   label: on-screen name for supers
export const FIGHTERS = {
  kite: { name:'KITE', title:'The rooftop runner', style:'Fast pressure · close range', speed:2.8, jump:8.2, color:'#ff9548', specialCd:66,
    moves:{
      light:{startup:5,active:3,recovery:13,damage:62,stun:19,blockstun:10,range:42,kb:1.6},
      light2:{startup:6,active:3,recovery:15,damage:68,stun:22,blockstun:12,range:46,kb:1.9},
      heavy:{startup:10,active:4,recovery:21,damage:108,stun:30,blockstun:15,range:58,kb:2.7,launchY:6.4},
      // Rush: blasts straight through Rook's pulse so Kite has a real answer to zoning.
      special:{startup:12,active:9,recovery:24,damage:142,stun:31,blockstun:18,range:49,kb:5,lunge:4.2,invuln:'proj'},
      // Rising uppercut: beats jump-ins, very punishable if it whiffs or is blocked.
      specialDown:{startup:4,active:7,recovery:30,damage:118,stun:32,blockstun:16,range:34,kb:1.4,launchY:7.4,aa:true,invuln:'air',cd:45},
      // Sliding sweep: travels in low under pulses' arc and must be blocked crouching.
      specialFwd:{startup:8,active:9,recovery:22,damage:92,stun:26,blockstun:14,range:40,kb:3.4,lunge:4.6,low:true,cd:50},
      exSpecial:{startup:8,active:10,recovery:22,damage:180,stun:36,blockstun:20,range:52,kb:6,lunge:5.4,invuln:'all',launchY:5.5,chip:18},
      super:{startup:6,active:12,recovery:34,damage:300,stun:60,blockstun:24,range:56,kb:7,lunge:6.5,invuln:'all',launchY:8.5,chip:60,label:'SKYLINE BREAKER'},
      low:{startup:7,active:3,recovery:17,damage:68,stun:22,blockstun:12,range:44,kb:1.8,low:true},
      airLight:{startup:5,active:4,recovery:10,damage:58,stun:20,blockstun:10,range:44,kb:1.2,juggleY:1.4,overhead:true},
      airHeavy:{startup:8,active:5,recovery:14,damage:82,stun:25,blockstun:13,range:52,kb:2.0,juggleY:2.4,overhead:true},
      airSpecial:{startup:10,active:5,recovery:18,damage:118,stun:30,blockstun:16,range:57,kb:3.8,juggleY:-3.8,overhead:true,finisher:true}
    }},
  rook: { name:'ROOK',title:'The circuit breaker',style:'Long reach · pulse projectile',speed:2.05,jump:7.8,color:'#54e5e1', specialCd:95,
    moves:{
      light:{startup:7,active:4,recovery:17,damage:70,stun:22,blockstun:12,range:41,kb:1.6},
      light2:{startup:8,active:4,recovery:17,damage:76,stun:24,blockstun:14,range:45,kb:2},
      heavy:{startup:14,active:5,recovery:26,damage:124,stun:33,blockstun:18,range:61,kb:3.0,launchY:6.0},
      special:{startup:22,active:1,recovery:32,damage:105,stun:25,blockstun:16,range:0,kb:3.1,projectile:true,speed:4.3},
      // Quake: a slow wave along the floor. Block it low or jump it.
      specialDown:{startup:18,active:1,recovery:30,damage:84,stun:24,blockstun:14,range:0,kb:2.4,projectile:true,speed:3.4,low:true,pw:24,ph:12,kind:'quake',cd:90},
      // Shoulder charge: soaks one hit on the way in.
      specialFwd:{startup:13,active:10,recovery:26,damage:116,stun:30,blockstun:18,range:40,kb:5.5,lunge:4.4,armor:true,cd:55},
      exSpecial:{startup:14,active:1,recovery:24,damage:150,stun:34,blockstun:20,range:0,kb:4.5,projectile:true,speed:7,pw:22,ph:20,kind:'ex',chip:16},
      super:{startup:10,active:1,recovery:40,damage:290,stun:60,blockstun:26,range:0,kb:6,projectile:true,speed:8.5,pw:48,ph:34,kind:'beam',invuln:'all',chip:55,label:'OVERLOAD CANNON'},
      low:{startup:9,active:4,recovery:19,damage:76,stun:24,blockstun:13,range:50,kb:2.1,low:true},
      airLight:{startup:7,active:5,recovery:11,damage:64,stun:22,blockstun:11,range:51,kb:1.3,juggleY:1.2,overhead:true},
      airHeavy:{startup:10,active:6,recovery:15,damage:92,stun:27,blockstun:14,range:60,kb:2.3,juggleY:2.1,overhead:true},
      airSpecial:{startup:12,active:6,recovery:19,damage:126,stun:31,blockstun:17,range:65,kb:4.1,juggleY:-4.1,overhead:true,finisher:true}
    }}
};
const SPECIALS=['special','specialDown','specialFwd'];
const ATK=B.light|B.heavy|B.special;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export const clone = s => JSON.parse(JSON.stringify(s));
export function makeFighter(id, index) {
  return {id:FIGHTERS[id]?id:'kite',x:index?450:190,y:0,vx:0,vy:0,face:index?-1:1,hp:1000,meter:0,
    state:'idle',move:null,mf:0,hit:false,connected:false,armorUsed:false,stun:0,blockstun:0,dash:0,dashCd:0,specialCd:0,
    input:0,prev:0,buffer:0,bufferAge:0,jumpBufferAge:0,attackId:0,combo:0,comboAge:0,airChain:0,launchCancel:false,dashDir:1};
}
export function createMatch(ids=['kite','kite'], options={}) {
  // training: no clock, no KOs, health refills once a combo ends and both meters stay full.
  return {tick:0,phase:'intro',phaseFrames:options.introFrames??120,round:1,wins:[0,0],fighters:ids.map(makeFighter),training:!!options.training,
    timer:ROUND_FRAMES,hitstop:0,freeze:0,freezeBy:-1,projectiles:[],events:[],eventId:0,winner:-1,roundWinner:-1,roundReason:'',matchId:options.matchId??1};
}
function emit(s,type,data={}) {s.events.push({id:++s.eventId,tick:s.tick,type,...data});if(s.events.length>36)s.events.shift();}
const gain=(f,n)=>{f.meter=Math.min(METER_MAX,f.meter+n);};
export function hurtbox(f) {
  // Kite's slide is low enough to pass under pulses (their box bottoms out 31px above the floor).
  if(f.y===0&&f.id==='kite'&&f.move==='specialFwd')return{x:f.x-14,y:FLOOR-22,w:28,h:22};
  const crouch=f.y===0&&(f.state==='crouch'||f.state==='blockLow'||f.move==='low');return{x:f.x-12,y:FLOOR-f.y-(crouch?39:65),w:24,h:crouch?39:65};}
export function hitbox(f) {
  const m=FIGHTERS[f.id].moves[f.move];
  if(!m||m.projectile||f.mf<m.startup||f.mf>=m.startup+m.active)return null;
  if(m.aa)return{x:f.face>0?f.x+2:f.x-2-m.range,y:FLOOR-f.y-92,w:m.range,h:80};
  const top=m.low?25:m.overhead?52:58;
  return{x:f.face>0?f.x+7:f.x-7-m.range,y:FLOOR-f.y-top,w:m.range,h:m.low?23:m.overhead?36:30};
}
export const projectileBox=p=>({x:p.x-(p.pw??16)/2,y:p.y-(p.ph??16)/2,w:p.pw??16,h:p.ph??16});
const intersects=(a,b)=>a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y;
function startMove(s,f,key) {
  const m=FIGHTERS[f.id].moves[key];
  f.move=key;f.mf=0;f.hit=false;f.connected=false;f.armorUsed=false;f.attackId++;f.state='attack';f.buffer=0;f.vx=0;
  if(SPECIALS.includes(key))f.specialCd=m.cd??FIGHTERS[f.id].specialCd??66;
  if(key==='exSpecial'){f.meter-=EX_COST;emit(s,'ex',{p:s.fighters.indexOf(f)});}
  if(key==='super'){f.meter-=METER_MAX;s.freeze=SUPER_FREEZE;s.freezeBy=s.fighters.indexOf(f);emit(s,'super',{p:s.freezeBy,label:m.label});}
  if(key==='airLight')f.airChain=Math.max(f.airChain,1);if(key==='airHeavy')f.airChain=Math.max(f.airChain,2);if(key==='airSpecial')f.airChain=3;
  emit(s,'swing',{p:s.fighters.indexOf(f),move:key});
}
function moveInput(f,input) {
  if(f.y>0){
    if((input&B.special)&&f.airChain<3)return 'airSpecial';
    if((input&B.heavy)&&f.airChain<2)return 'airHeavy';
    if((input&B.light)&&f.airChain<1)return 'airLight';
    return null;
  }
  if(input&B.special){
    // Heavy+Special spends a full bar on a super; Light+Special spends half on the EX special.
    if((input&B.heavy)&&f.meter>=METER_MAX)return 'super';
    if((input&B.light)&&f.meter>=EX_COST)return 'exSpecial';
    if(f.input&B.crouch)return 'specialDown';
    if(f.input&(f.face>0?B.right:B.left))return 'specialFwd';
    return 'special';
  }
  if(input&B.heavy)return 'heavy';
  if(input&B.light)return (f.input&B.crouch)?'low':'light';
  return null;
}
const ready=(f,key)=>!key||!SPECIALS.includes(key)||f.specialCd===0;
// Is an attack or pulse coming at f? Used so holding back raises guard only when it matters.
function threatened(s,f,o) {
  const me=s.fighters.indexOf(f);
  return (!!o.move&&Math.abs(o.x-f.x)<130)||s.projectiles.some(p=>p.owner!==me&&(f.x-p.x)*p.vx>0&&Math.abs(p.x-f.x)<120);
}
function bufferPress(f,pressed){
  // Presses within two frames of each other combine, so Light+Special / Heavy+Special read as one input.
  if(pressed&ATK){f.buffer=(f.bufferAge>=8?f.buffer:0)|(pressed&ATK);f.bufferAge=10;}
  else if(f.bufferAge>0)f.bufferAge--;else f.buffer=0;
  if(pressed&B.jump)f.jumpBufferAge=10;else if(f.jumpBufferAge>0)f.jumpBufferAge--;
}
function updateFighter(s,f,o,mask,pressed) {
  const stats=FIGHTERS[f.id]; f.input=mask;
  if(f.dashCd>0)f.dashCd--;if(f.specialCd>0)f.specialCd--;
  if(f.comboAge>0)f.comboAge--;else f.combo=0;
  bufferPress(f,pressed);
  const frozen=f.stun>0||f.blockstun>0;
  if(f.stun>0){f.stun--;f.state='hurt';f.move=null;f.dash=0;}
  else if(f.blockstun>0){f.blockstun--;f.state=mask&B.crouch?'blockLow':'block';f.move=null;f.dash=0;}
  else if(f.move){
    const m=stats.moves[f.move];f.mf++;
    const next=moveInput(f,f.buffer);
    let cancel=null;
    // "Pressed together" leniency: a special upgrades to EX/super if Light/Heavy lands in its first frames,
    // and a light/heavy upgrades if Special lands in its first frames.
    if(f.mf<=3){
      let combined=0;
      if(SPECIALS.includes(f.move))combined=B.special|f.buffer;
      else if((f.move==='light'||f.move==='heavy')&&f.mf<=2&&(f.buffer&B.special))combined=f.buffer|(f.move==='light'?B.light:B.heavy);
      if(combined&B.heavy&&combined&B.special&&f.meter>=METER_MAX)cancel='super';
      else if(combined&B.light&&combined&B.special&&f.meter>=EX_COST)cancel='exSpecial';
    }
    // Hit-confirm routes: ground chain -> special/EX/super, launcher -> jump cancel -> three-step air juggle.
    if(!cancel&&f.connected&&f.mf>=m.startup+1&&f.mf<=m.startup+m.active+14){
      if(f.move==='light'&&next==='light')cancel='light2';
      else if(['light','light2','low'].includes(f.move)&&next==='heavy')cancel='heavy';
      else if(['light','light2','low'].includes(f.move)&&next&&(SPECIALS.includes(next)||next==='exSpecial'||next==='super')&&ready(f,next))cancel=next;
      else if([...SPECIALS,'exSpecial','heavy'].includes(f.move)&&next==='super')cancel='super';
      else if(f.move==='airLight'&&next==='airHeavy')cancel='airHeavy';
      else if(['airLight','airHeavy'].includes(f.move)&&next==='airSpecial')cancel='airSpecial';
      if(!cancel&&f.move==='heavy'&&f.y===0&&f.jumpBufferAge>0){
        f.move=null;f.y=.01;f.vy=stats.jump*.92;f.state='jump';f.airChain=0;f.jumpBufferAge=0;f.launchCancel=true;emit(s,'jumpCancel',{p:s.fighters.indexOf(f)});return;
      }
    }
    if(cancel){startMove(s,f,cancel);if(cancel==='super')return;}
    else if(f.mf>=m.startup+m.active+m.recovery){f.move=null;f.state=f.y>0?'jump':'idle';}
    else if(m.lunge&&f.mf>=m.startup&&f.mf<m.startup+m.active){f.x+=f.face*m.lunge;}
    const cur=stats.moves[f.move];
    if(cur?.projectile&&f.mf===cur.startup){
      const low=!!cur.low;
      s.projectiles.push({id:++s.eventId,owner:s.fighters.indexOf(f),x:f.x+f.face*(cur.kind==='beam'?40:25),y:low?FLOOR-7:FLOOR-f.y-39,vx:f.face*(cur.speed??4.9),life:150,
        damage:cur.damage,stun:cur.stun,blockstun:cur.blockstun,kb:cur.kb,low,chip:cur.chip??0,pw:cur.pw??16,ph:cur.ph??16,kind:cur.kind??'pulse',super:f.move==='super',ex:f.move==='exSpecial'});
      emit(s,'pulse',{p:s.fighters.indexOf(f),kind:cur.kind??'pulse'});
    }
  }else if(f.dash>0){f.dash--;f.state='dash';f.x+=f.face*(f.dashDir>0?5.5:-4.6);}
  else {
    if(f.y===0)f.face=o.x>=f.x?1:-1;
    // Classic guard: hold away from the opponent (or the dedicated block key). Holding back with no threat just walks back.
    const back=f.face>0?B.left:B.right,guard=f.y===0&&((mask&B.block)||((mask&back)&&threatened(s,f,o)));
    const desired=moveInput(f,f.buffer);
    if(desired&&ready(f,desired)){startMove(s,f,desired);if(desired==='super')return;}
    else if((pressed&B.dash)&&f.y===0&&f.dashCd===0){f.dashDir=mask&back?-1:1;f.dash=f.dashDir>0?9:8;f.dashCd=30;f.state='dash';emit(s,'dash',{p:s.fighters.indexOf(f)});}
    else if((pressed&B.jump)&&f.y===0){f.vy=stats.jump;f.y=0.01;f.state='jump';f.airChain=0;f.launchCancel=false;emit(s,'jump',{p:s.fighters.indexOf(f)});}
    else if(guard)f.state=mask&B.crouch?'blockLow':'block';
    else if((mask&B.crouch)&&f.y===0)f.state='crouch';
    else {const axis=+(!!(mask&B.right))-+(!!(mask&B.left));f.x+=axis*stats.speed*(f.y>0?0.86:1);f.state=f.y>0?'jump':axis?'walk':'idle';}
  }
  // A jump-cancel carries the attacker forward. Keep air attacks steerable so
  // launcher knockback does not leave the follow-up outside its hitbox.
  if(f.y>0&&f.move&&!frozen){
    const axis=+(!!(mask&B.right))-+(!!(mask&B.left));
    f.x+=(axis||(f.launchCancel?f.face:0))*stats.speed*.78;
  }
  physics(s,f,frozen);
}
function physics(s,f,frozen){
  if(f.y>0||f.vy!==0){f.y+=f.vy;f.vy-=0.42;if(f.y<=0){f.y=0;f.vy=0;f.airChain=0;f.launchCancel=false;if(f.state==='jump'||f.state==='hurt'&&f.hp>0)f.state='idle';emit(s,'land',{p:s.fighters.indexOf(f)});}}
  if(frozen||f.vx!==0){f.x+=f.vx;f.vx*=0.82;if(Math.abs(f.vx)<0.06)f.vx=0;}
  f.x=clamp(f.x,24,W-24);
}
// Which hits a defender's current move is immune to.
function immune(d,attacker,fromProjectile){
  const m=d.move&&FIGHTERS[d.id].moves[d.move];
  if(!m?.invuln||d.mf>=m.startup+m.active)return false;
  return m.invuln==='all'||(m.invuln==='proj'&&fromProjectile)||(m.invuln==='air'&&!fromProjectile&&attacker.y>0);
}
function applyHit(s,attackerIndex,defenderIndex,m,originX) {
  const a=s.fighters[attackerIndex],d=s.fighters[defenderIndex];
  const facing=(originX-d.x)*d.face>=-4;
  // Holding away from the hit's origin guards; a cross-up flips which direction counts as "away".
  const away=originX>=d.x?B.left:B.right;
  const guarding=d.y===0&&!d.move&&d.stun===0&&d.dash===0&&(((d.input&B.block)&&facing)||(d.input&away));
  const blocked=guarding&&(!m.low||d.input&B.crouch)&&(!m.overhead||!(d.input&B.crouch));
  if(blocked){
    d.blockstun=m.blockstun;d.vx=(d.x>=originX?1:-1)*m.kb*0.5;d.state=d.input&B.crouch?'blockLow':'block';s.hitstop=Math.max(s.hitstop,3);
    if(m.chip)d.hp=Math.max(0,d.hp-m.chip);
    gain(a,3);gain(d,4);
    emit(s,'block',{p:defenderIndex,x:d.x,y:FLOOR-d.y-40,chip:m.chip??0});
    return;
  }
  const dm=d.move&&FIGHTERS[d.id].moves[d.move];
  if(dm?.armor&&!d.armorUsed&&d.mf<dm.startup+dm.active){
    // Armor: take reduced damage, keep going.
    const dmg=Math.round(m.damage*.5);d.hp=Math.max(0,d.hp-dmg);d.armorUsed=true;s.hitstop=Math.max(s.hitstop,5);gain(d,6);
    emit(s,'armor',{p:defenderIndex,x:d.x,y:FLOOR-d.y-40,damage:dmg});
    return;
  }
  const combo=(d.stun>0||d.y>0)?a.combo+1:1;
  const damage=Math.round(m.damage*Math.max(0.48,1-(combo-1)*0.105));
  const isSuper=m.super||m.label;
  d.hp=Math.max(0,d.hp-damage);d.stun=m.stun;d.blockstun=0;d.move=null;d.dash=0;d.state='hurt';
  d.vx=(d.x>=originX?1:-1)*m.kb;
  if(m.launchY){d.y=Math.max(d.y,.01);d.vy=Math.max(d.vy,m.launchY);}
  else if(m.juggleY){
    d.y=Math.max(d.y,.01);
    if(m.juggleY>0)d.vy=Math.max(d.vy,m.juggleY);
    else d.vy=Math.min(d.vy,m.juggleY);
  }
  const ko=d.hp<=0&&!s.training;
  if(ko){d.y=Math.max(d.y,.01);d.vy=Math.max(d.vy,5);d.vx*=1.8;}
  // Meter moves never refund meter (m.ex marks an EX projectile that lands after Rook has recovered).
  if(!isSuper&&!m.ex&&a.move!=="exSpecial")gain(a,damage*.08);
  gain(d,damage*.05);
  a.connected=true;a.combo=combo;a.comboAge=80;s.hitstop=Math.max(s.hitstop,isSuper?14:m.finisher?8:m.damage>=100?6:4);
  emit(s,'hit',{p:defenderIndex,by:attackerIndex,damage,combo,x:d.x,y:FLOOR-d.y-40,heavy:m.damage>=100,airborne:d.y>0,finisher:!!m.finisher||!!isSuper,super:!!isSuper,ko});
}
function holdInputs(s,masks,pressed){
  s.fighters.forEach((f,i)=>{if(pressed[i]&ATK){f.buffer=(f.bufferAge>=8?f.buffer:0)|(pressed[i]&ATK);f.bufferAge=10;}if(pressed[i]&B.jump)f.jumpBufferAge=10;f.prev=masks[i];});
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
    // Slow-motion KO: the loser keeps flying at half speed for the first second.
    if(s.roundReason==='K.O.'&&s.phaseFrames>85&&s.tick%2===0)s.fighters.forEach(f=>physics(s,f,f.hp<=0));
    if(--s.phaseFrames<=0){
      if(s.wins.some(v=>v>=2)){s.phase='matchOver';s.winner=s.wins[0]>=2?0:1;emit(s,'match',{winner:s.winner});}
      else{const prev=s.fighters;s.fighters=prev.map((f,i)=>({...makeFighter(f.id,i),meter:f.meter}));s.round++;s.timer=ROUND_FRAMES;s.phase='intro';s.phaseFrames=100;s.projectiles=[];}
    }return s;
  }
  // Super flash: everything pauses while the super's owner poses.
  if(s.freeze>0){s.freeze--;holdInputs(s,masks,pressed);return s;}
  if(s.hitstop>0){s.hitstop--;holdInputs(s,masks,pressed);return s;}
  s.timer--;
  for(let i=0;i<2;i++)updateFighter(s,s.fighters[i],s.fighters[1-i],masks[i],pressed[i]);
  // Pushboxes stop walking through a grounded opponent; jumping can cross over.
  const [a,b]=s.fighters;
  if(Math.abs(a.y-b.y)<48&&Math.abs(a.x-b.x)<26){const dir=b.x>=a.x?1:-1;const push=(26-Math.abs(a.x-b.x))/2;a.x=clamp(a.x-dir*push,24,W-24);b.x=clamp(b.x+dir*push,24,W-24);}
  // Collect contacts first, then resolve: simultaneous hits can trade fairly.
  const contacts=[];
  for(let i=0;i<2;i++){const f=s.fighters[i],d=s.fighters[1-i],box=hitbox(f);if(box&&!f.hit&&!immune(d,f,false)&&intersects(box,hurtbox(d))){f.hit=true;contacts.push([i,1-i,{...FIGHTERS[f.id].moves[f.move]},f.x]);}}
  for(const p of s.projectiles){
    p.x+=p.vx;p.life--;const d=s.fighters[1-p.owner];
    if(p.life>0&&!immune(d,s.fighters[p.owner],true)&&intersects(projectileBox(p),hurtbox(d))){contacts.push([p.owner,1-p.owner,p,p.x]);p.life=0;}
  }
  // Opposing projectiles cancel each other out (a super beam eats a normal one and keeps going).
  for(const p of s.projectiles)for(const q of s.projectiles)if(p!==q&&p.owner!==q.owner&&p.life>0&&q.life>0&&intersects(projectileBox(p),projectileBox(q))){
    if(p.super&&!q.super)q.life=0;else if(q.super&&!p.super)p.life=0;else{p.life=0;q.life=0;}
    emit(s,'clash',{x:(p.x+q.x)/2,y:(p.y+q.y)/2});
  }
  for(const contact of contacts)applyHit(s,...contact);
  s.projectiles=s.projectiles.filter(p=>p.life>0&&p.x>-40&&p.x<W+40);
  s.fighters.forEach((f,i)=>{f.prev=masks[i];});
  if(s.training){
    s.timer=ROUND_FRAMES;
    for(const f of s.fighters){f.meter=METER_MAX;if(f.hp<=0)f.hp=1;if(f.hp<1000&&f.stun===0&&f.y===0&&s.fighters.every(x=>x.comboAge===0))f.hp=1000;}
    return s;
  }
  if(a.hp<=0||b.hp<=0||s.timer<=0){
    s.roundWinner=a.hp===b.hp?-1:a.hp>b.hp?0:1;
    s.roundReason=s.timer<=0?'TIME':'K.O.';
    if(s.roundWinner>=0)s.wins[s.roundWinner]++;
    s.phase='roundOver';s.phaseFrames=145;s.projectiles=[];
    emit(s,'round',{winner:s.roundWinner,reason:s.roundReason});
  }
  return s;
}
