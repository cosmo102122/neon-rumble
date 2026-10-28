import {B,createMatch,step,clone,FIGHTERS} from './shared/engine.mjs?v=20261028-05';
import {OpponentAI} from './shared/ai.mjs?v=20261028-05';
import {Renderer} from './render.mjs?v=20261028-05';
import {Sound} from './audio.mjs';
const $=id=>document.getElementById(id),renderer=new Renderer($('game')),sound=new Sound();
$('game').dataset.version='20261028-05';
const DEFAULTS={left:'KeyA',right:'KeyD',jump:'KeyW',crouch:'KeyS',dash:'ShiftLeft',light:'KeyJ',heavy:'KeyK',special:'KeyL',block:'KeyI',super:'KeyU',ex:'KeyO'};
// One-press shortcuts for the two-button meter moves.
const COMBO={super:B.heavy|B.special,ex:B.light|B.special},COMBO_COST={super:100,ex:50};
// The shortcut keys only fire when your bar can pay for the move (otherwise they'd fall back to a plain special).
const canAfford=name=>!COMBO_COST[name]||(confirmed?.fighters?.[myIndex]?.meter??0)>=COMBO_COST[name];
const LABELS={left:'Move left',right:'Move right',jump:'Jump',crouch:'Crouch',dash:'Dash',light:'Light',heavy:'Heavy',special:'Special',block:'Block',super:'Super (full bar)',ex:'EX special (half bar)'};
function stored(key,fallback){try{return JSON.parse(localStorage.getItem(key))??fallback;}catch{return fallback;}}
function save(key,value){try{localStorage.setItem(key,JSON.stringify(value));}catch{}}
let bindings={...DEFAULTS,...stored('nr-keys',{})},held=new Set(),tapMask=0,listening=null,selected=stored('nr-fighter','kite');if(!FIGHTERS[selected])selected='kite';
// Returning players: the new default keys must not collide with bindings saved before they existed.
for(const k of ['super','ex'])if(Object.entries(bindings).some(([n,c])=>n!==k&&c===bindings[k]))bindings[k]='';
const DUMMY_MODES=['STAND','BLOCK','CROUCH BLOCK','JUMP','REPLAY'];let training=false,dummyMode=0,showBoxes=false;
// Training record/replay (inputs stored relative to the dummy's facing) and combo stats.
const REC_MAX=600;let recording=false,recorded=[],replayAt=0,comboDmg=0,comboHits=0,bestDmg=0;
let mode='menu',state=createMatch([selected,menuRival()]),confirmed=state,ai=null,socket=null,room=null,myIndex=0,seq=0,pending=[],lastServerInputs=[0,0],networkPause=false,reconnecting=false,reconnectDeadline=0,lastSnapshot=0,serverReady=false,lastHud='',lastMatchShown=0,connectionGeneration=0;
// Static hosts (neonrumble.top, GitHub Pages, Google Sites embeds) can't run the room server, so they use the hosted one.
// The Node server serves the page itself, so pages it serves (localhost, the server's own domain) talk to their own origin.
const HOSTED_SERVER='https://play.neonrumble.top';
const servesItself=['localhost','127.0.0.1','play.neonrumble.top'].includes(location.hostname)||location.hostname.endsWith('.onrender.com');
let serverBase=stored('nr-server','')||(servesItself?'':HOSTED_SERVER);const params=new URLSearchParams(location.search);const embedded=window.self!==window.top||params.get('embed')==='1';if(embedded)document.documentElement.classList.add('embedded');const suppliedServer=params.get('server');
if(suppliedServer){try{const u=new URL(suppliedServer);if(u.protocol==='https:'){serverBase=u.origin;save('nr-server',serverBase);}}catch{}}
if(params.get('room'))$('roomInput').value=params.get('room').toUpperCase().replace(/[^A-Z2-9]/g,'').slice(0,6);
let savedSession;try{savedSession=JSON.parse(sessionStorage.getItem('nr-session'));}catch{}
function session(value){savedSession=value;try{value?sessionStorage.setItem('nr-session',JSON.stringify(value)):sessionStorage.removeItem('nr-session');}catch{}}
function show(id,visible){$(id).classList.toggle('hidden',!visible);}
function notice(text){$('notice').textContent=text;show('notice',!!text);}
function label(code){return (code||'—').replace(/^Key|^Digit/,'').replace('ShiftLeft','SHIFT').replace('ShiftRight','RSHIFT').replace('Arrow','').replace('Space','SPACE');}
// Always-on alternates alongside the rebindable keys: Space and the arrow keys.
const EXTRA={Space:'jump',ArrowUp:'jump',ArrowDown:'crouch',ArrowLeft:'left',ArrowRight:'right'};
const isGameKey=code=>Object.values(bindings).includes(code)||code in EXTRA;
function mask(){let m=tapMask|padMask();tapMask=0;for(const a of touchHeld)m|=actBits(a);for(const [name,code]of Object.entries(bindings))if(held.has(code))m|=(B[name]??(canAfford(name)?COMBO[name]:0));for(const [code,name]of Object.entries(EXTRA))if(held.has(code))m|=(B[name]??(canAfford(name)?COMBO[name]:0));return m;}
function clearInput(){held.clear();touchHeld.clear();tapMask=0;if(socket?.readyState===1&&room)send({type:'input',seq:++seq,mask:0});}
function send(data){if(socket?.readyState===1)socket.send(JSON.stringify(data));}
function unlock(){sound.unlock();}document.addEventListener('pointerdown',unlock,{once:true});
document.addEventListener('keydown',e=>{
  if(listening){e.preventDefault();if(e.code==='Escape'){listening=null;renderBindings();return;}if(['Tab','MetaLeft','MetaRight','ControlLeft','ControlRight','Space'].includes(e.code)){notice('Choose another key. Space is always an extra jump key.');return;}
    const other=Object.keys(bindings).find(k=>bindings[k]===e.code);if(other)bindings[other]=bindings[listening];bindings[listening]=e.code;listening=null;save('nr-keys',bindings);renderBindings();renderControls();notice('');return;}
  if(e.target.matches('input,select,textarea')||document.querySelector('dialog[open]'))return;
  if(training&&mode==='ai'&&e.code==='KeyR'&&!Object.values(bindings).includes('KeyR')){e.preventDefault();startAI(true);return;}
  if(training&&mode==='ai'&&e.code==='KeyT'&&!e.repeat&&!Object.values(bindings).includes('KeyT')){e.preventDefault();toggleRecord();return;}
  if((mode==='online'||mode==='ai')&&isGameKey(e.code)){e.preventDefault();sound.unlock();if(!held.has(e.code)){for(const [k,v]of Object.entries(bindings))if(v===e.code)tapMask|=(B[k]??(canAfford(k)?COMBO[k]:0));if(EXTRA[e.code])tapMask|=B[EXTRA[e.code]];}held.add(e.code);}
});
document.addEventListener('keyup',e=>held.delete(e.code));window.addEventListener('blur',clearInput);document.addEventListener('visibilitychange',()=>{if(document.hidden)clearInput();});
function choose(id){selected=id;save('nr-fighter',id);document.querySelectorAll('[data-fighter]').forEach(b=>{const yes=b.dataset.fighter===id;b.classList.toggle('selected',yes);b.setAttribute('aria-pressed',yes);});$('fighterCaption').replaceChildren();const strong=document.createElement('strong'),small=document.createElement('small');strong.textContent=FIGHTERS[id].name;small.textContent=FIGHTERS[id].title.toUpperCase();$('fighterCaption').append(strong,small);document.querySelector('.stage-caption-number').textContent=`${String(Object.keys(FIGHTERS).indexOf(id)+1).padStart(2,'0')} / ${String(Object.keys(FIGHTERS).length).padStart(2,'0')}`;}
document.querySelectorAll('[data-fighter]').forEach(b=>b.onclick=()=>choose(b.dataset.fighter));choose(selected);
function endpoint(){const u=new URL(serverBase||location.origin);u.protocol=u.protocol==='https:'?'wss:':'ws:';u.pathname='/ws';u.search='';return u.href;}
async function pingServer(timeout=6000){try{const r=await fetch((serverBase||'')+'/health',{signal:AbortSignal.timeout(timeout),cache:'no-store'});const data=await r.json();return data.game==='neon-rumble'&&!!data.ok;}catch{return false;}}
async function checkServer(){
  $('networkStatus').textContent='CHECKING SERVER';
  serverReady=await pingServer();
  $('networkStatus').textContent=serverReady?'ONLINE SERVER READY':'AI READY · SERVER WAKING';
}
// A free-tier host sleeps when idle and takes up to a minute to wake: keep asking instead of failing.
async function wakeServer(){
  if(serverReady||await pingServer())return serverReady=true;
  const until=Date.now()+75000;let n=0;
  while(Date.now()<until){n++;notice(`Waking up the online server — this can take up to a minute the first time… (${n*5}s)`);$('networkStatus').textContent='WAKING SERVER';
    if(await pingServer(5000)){serverReady=true;$('networkStatus').textContent='ONLINE SERVER READY';notice('');return true;}
    await new Promise(r=>setTimeout(r,1000));}
  $('networkStatus').textContent='AI READY · SERVER OFFLINE';return false;
}
function connect(){
  if(socket?.readyState===1)return Promise.resolve();
  const generation=++connectionGeneration;
  return new Promise((resolve,reject)=>{
    let ws;try{ws=new WebSocket(endpoint());}catch(err){reject(err);return;}socket=ws;
    const timeout=setTimeout(()=>{ws.close();reject(new Error('Connection timed out. Check the server address.'));},6500);
    ws.onopen=()=>{clearTimeout(timeout);seq=0;pending=[];serverReady=true;resolve();};
    ws.onerror=()=>{clearTimeout(timeout);reject(new Error('Could not reach the game server. Open Connection settings to add its address.'));};
    ws.onmessage=e=>{if(generation!==connectionGeneration)return;let m;try{m=JSON.parse(e.data);}catch{return;}onMessage(m);};
    ws.onclose=e=>{clearTimeout(timeout);if(generation!==connectionGeneration)return;if(e.code===4001){session(null);room=null;mode='menu';notice('This player reconnected in another tab.');setScreen();return;}if(savedSession&&room&&!reconnecting){networkPause=true;reconnecting=true;reconnectDeadline=Date.now()+14000;retryReconnect();}};
  });
}
async function retryReconnect(){
  if(!reconnecting)return;if(Date.now()>reconnectDeadline){reconnecting=false;notice('The connection was lost. Return to the arcade and create a new room.');$('pause').textContent='Connection lost. Please leave this match.';show('pause',true);return;}
  $('pause').textContent='Connection interrupted. Reconnecting…';show('pause',true);
  try{await connect();send({type:'resume',code:savedSession.code,token:savedSession.token});}catch{setTimeout(retryReconnect,1000);}
}
function onMessage(m){
  if(m.type==='error'){notice(m.message);if(reconnecting){reconnecting=false;session(null);}return;}
  if(m.type==='joined'){myIndex=m.index;room={code:m.code,players:[]};session({code:m.code,token:m.token,server:serverBase});mode='lobby';reconnecting=false;networkPause=false;notice('');$('roomCode').textContent=m.code;setScreen();}
  if(m.type==='room'){room={...room,...m};renderLobby();if(mode==='online')$('rematchStatus').textContent=m.rematch?.[myIndex]?'Waiting for your rival…':m.rematch?.[1-myIndex]?'Your rival wants a rematch.':'';}
  if(m.type==='state'){
    mode='online';lastSnapshot=performance.now();confirmed=m.state;lastServerInputs=m.inputs;networkPause=m.paused;pending=pending.filter(p=>p.seq>m.ack[myIndex]);state=clone(m.state);
    // Reconcile to authoritative state and replay at most 200 ms of local input.
    for(const p of pending.slice(-12)){const inputs=[...m.inputs];inputs[myIndex]=p.mask;step(state,inputs);}
    if(m.paused)$('pause').textContent=`Opponent disconnected. Match paused (${Math.ceil(m.graceMs/1000)}s grace).`;
    setScreen();renderer.events(confirmed,e=>sound.event(e));updateHUD();
  }
  if(m.type==='notice')notice(m.message);
  if(m.type==='pong'){const ping=Math.round(performance.now()-m.time);$('networkStatus').textContent=`ONLINE · ${ping} MS`;if(ping>220)notice('High network delay. Inputs may feel slower; try a server closer to both players.');}
}
function renderLobby(){if(!room)return;$('players').replaceChildren();for(let i=0;i<2;i++){const p=room.players[i],div=document.createElement('div');div.className='player-slot'+(p?.ready?' is-ready':'');const strong=document.createElement('strong');strong.textContent=p?FIGHTERS[p.fighter].name:'OPEN SLOT';div.append(strong,document.createTextNode(p?(p.ready?'READY':i===myIndex?'YOU':'CONNECTED'):'WAITING…'));$('players').append(div);}$('ready').textContent=room.players[myIndex]?.ready?'READY — WAITING FOR RIVAL':'READY TO FIGHT';}
function setScreen(){const playing=mode==='ai'||mode==='online';show('touchPad',playing&&isTouch);if(!playing){touchHeld.clear();document.querySelectorAll('#touchPad .pressed').forEach(b=>b.classList.remove('pressed'));}show('menu',mode==='menu');show('lobby',mode==='lobby');show('hud',playing);show('fightFooter',playing);show('pause',playing&&(networkPause||reconnecting));$('screen').classList.toggle('playing',playing);const result=playing&&['matchOver','forfeit'].includes(confirmed.phase);show('result',result);if(result){const w=confirmed.winner;$('resultLabel').textContent=confirmed.phase==='forfeit'?'MATCH ENDED · '+confirmed.roundReason.toUpperCase():'MATCH COMPLETE';$('resultTitle').textContent=w<0?'NO CONTEST':w===myIndex?'YOU WIN':'RIVAL WINS';$('resultScore').textContent=`${FIGHTERS[confirmed.fighters[0].id].name}  ${confirmed.wins[0]} — ${confirmed.wins[1]}  ${FIGHTERS[confirmed.fighters[1].id].name}`;if(lastMatchShown!==confirmed.matchId){lastMatchShown=confirmed.matchId;clearInput();}}$('matchMode').textContent=training?'TRAINING':mode==='ai'?`PRACTICE / ${$('difficulty').value.toUpperCase()}`:`ROOM ${room?.code??''} / YOU ARE P${myIndex+1}`;}
function updateHUD(){const s=confirmed;const key=`${s.matchId}|${s.phase}|${Math.ceil(s.timer/60)}|${s.fighters.map(f=>f.hp)}|${s.wins}|${s.round}|${myIndex}|${s.fighters.map(f=>f.id)}|${s.fighters.map(f=>Math.floor(f.meter??0))}|${training}`;if(key===lastHud)return;lastHud=key;for(let i=0;i<2;i++){$('name'+i).textContent=FIGHTERS[s.fighters[i].id].name;$('tag'+i).textContent=i===myIndex?'YOU':training?'DUMMY':mode==='ai'?'CPU':'RIVAL';const mtr=Math.floor(s.fighters[i].meter??0);$('meter'+i).style.width=mtr+'%';$('meterBar'+i).classList.toggle('half',mtr>=50&&mtr<100);$('meterBar'+i).classList.toggle('full',mtr>=100);$('meterLabel'+i).textContent=mtr>=100?'SUPER READY'+(i===myIndex?' · PRESS '+label(bindings.super):''):mtr>=50?'EX READY'+(i===myIndex?' · PRESS '+label(bindings.ex):''):'';$('health'+i).style.width=Math.max(0,s.fighters[i].hp/10)+'%';$('health'+i).parentElement.setAttribute('aria-label',`${FIGHTERS[s.fighters[i].id].name} health ${s.fighters[i].hp} of 1000`);$('wins'+i).innerHTML=[0,1].map(n=>`<span class="${n<s.wins[i]?'won':''}"></span>`).join('');}{const mm=Math.floor(s.fighters[myIndex].meter??0);setGuide(mm>=100?'super':mm>=50?'ex':'combo');document.querySelector('#touchPad [data-act=super]').classList.toggle('locked',mm<100);document.querySelector('#touchPad [data-act=ex]').classList.toggle('locked',mm<50);}$('timer').textContent=s.training?'∞':Math.max(0,Math.ceil(s.timer/60)).toString().padStart(2,'0');$('round').textContent='ROUND '+s.round;setScreen();}
async function roomAction(type,code){clearInput();sound.unlock();notice('Connecting to the room server…');$('create').disabled=true;try{if(!await wakeServer())throw new Error('The online server is not responding. Try again in a minute.');notice('Connecting to the room server…');await connect();send({type,fighter:selected,...(code?{code}:{})});}catch(e){notice(e.message);$('serverDialog').showModal();$('serverUrl').value=serverBase;}finally{$('create').disabled=false;}}
$('create').onclick=()=>roomAction('create');$('joinForm').onsubmit=e=>{e.preventDefault();roomAction('join',$('roomInput').value.trim().toUpperCase());};$('ready').onclick=()=>send({type:'ready'});
$('copyInvite').onclick=async()=>{const u=new URL(location.href);u.hash='';u.search='';u.searchParams.set('room',room.code);if(serverBase&&serverBase!==HOSTED_SERVER)u.searchParams.set('server',serverBase);try{await navigator.clipboard.writeText(u.href);$('copyInvite').textContent='COPIED — SEND IT TO YOUR RIVAL';}catch{notice('Invite link: '+u.href);}};
// Practice faces a random different fighter (the training dummy too); the menu backdrop shows the next rival.
function others(){return Object.keys(FIGHTERS).filter(id=>id!==selected);}
function practiceRival(){const o=others();return o[Math.floor(Math.random()*o.length)];}
function menuRival(){return others()[0];}
function startAI(isTraining=false){training=isTraining===true;clearInput();if(room)leave();mode='ai';myIndex=0;state=createMatch([selected,practiceRival()],{matchId:Date.now(),training,introFrames:training?30:120});confirmed=state;ai=training?null:new OpponentAI($('difficulty').value);show('trainingTools',training);renderer.lastEvent=0;networkPause=false;lastHud='';$('rematchStatus').textContent='';notice('');sound.unlock();setScreen();updateHUD();if(training)notice(`Training: your meter stays full. Press ${label(bindings.super)} for your SUPER, ${label(bindings.ex)} for an EX special, and try Down/Forward + ${label(bindings.special)}.`);$('game').focus();}
$('practice').onclick=()=>startAI(false);$('training').onclick=()=>startAI(true);$('tryUpdate').onclick=()=>startAI(true);
// Training dummy: stands still by default; can guard (high or low) or hop so you can test overheads and anti-airs.
function orient(m,face){if(face>0)return m;const l=m&B.left,r=m&B.right;return(m&~(B.left|B.right))|(l?B.right:0)|(r?B.left:0);}
function dummyMask(s){const d=s.fighters[1],p=s.fighters[0],away=d.x>=p.x?B.right:B.left;
  if(DUMMY_MODES[dummyMode]==='REPLAY'){if(!recorded.length)return 0;const m=orient(recorded[replayAt],d.face);replayAt=(replayAt+1)%recorded.length;return m;}
  return[0,away,away|B.crouch,s.tick%50===0?B.jump:0][dummyMode];}
function setDummyMode(i){dummyMode=i;replayAt=0;$('dummyMode').textContent='DUMMY: '+DUMMY_MODES[dummyMode]+(DUMMY_MODES[dummyMode]==='REPLAY'&&!recorded.length?' (RECORD FIRST)':'');}
function toggleRecord(){
  if(!recording){recording=true;recorded=[];$('recordDummy').textContent='STOP (T)';$('recordDummy').classList.add('recording');notice('Recording: you now control the dummy for up to 10 seconds. Press T (or STOP) when done.');}
  else{recording=false;$('recordDummy').textContent='RECORD (T)';$('recordDummy').classList.remove('recording');
    if(recorded.length){setDummyMode(DUMMY_MODES.indexOf('REPLAY'));notice(`The dummy will loop your ${(recorded.length/60).toFixed(1)}s recording. Switch with the DUMMY button.`);}else notice('');}
  $('game').focus();}
function trackStats(e){if(!training||e.type!=='hit'||e.by!==0)return;if(e.combo===1)comboDmg=0;comboDmg+=e.damage;comboHits=e.combo;bestDmg=Math.max(bestDmg,comboDmg);
  $('trainingStats').textContent=`COMBO ${comboHits} HIT${comboHits>1?'S':''} · ${comboDmg} DMG · BEST ${bestDmg}`;}
$('recordDummy').onclick=toggleRecord;
$('dummyMode').onclick=()=>{setDummyMode((dummyMode+1)%DUMMY_MODES.length);$('game').focus();};
$('boxes').onclick=()=>{showBoxes=!showBoxes;$('boxes').textContent='HITBOXES: '+(showBoxes?'ON':'OFF');$('game').focus();};
$('resetTraining').onclick=()=>{startAI(true);};
function leave(){training=false;if(recording)toggleRecord();show('trainingTools',false);send({type:'leave'});session(null);room=null;reconnecting=false;networkPause=false;connectionGeneration++;socket?.close();socket=null;mode='menu';state=createMatch([selected,menuRival()]);confirmed=state;pending=[];clearInput();notice('');show('result',false);setScreen();checkServer();}
for(const id of ['leaveLobby','leaveResult','leaveMatch'])$(id).onclick=leave;
$('rematch').onclick=()=>{if(mode==='ai')startAI(training);else{send({type:'rematch'});$('rematchStatus').textContent='Waiting for your rival…';}};
$('sound').onclick=()=>{sound.unlock();sound.enabled=!sound.enabled;$('sound').textContent=sound.enabled?'SOUND ON':'SOUND OFF';$('sound').setAttribute('aria-label',sound.enabled?'Turn sound off':'Turn sound on');};
$('fullscreen').onclick=()=>{if(document.fullscreenElement)document.exitFullscreen?.();else $('screen').requestFullscreen?.().catch(()=>notice('Full screen is unavailable in this browser.'));};
for(const id of ['help','comboHelp'])$(id).onclick=()=>{clearInput();$('helpDialog').showModal();};document.querySelectorAll('.dialog-close,.dialog-done').forEach(b=>b.onclick=()=>{b.closest('dialog').close();listening=null;});
function renderBindings(){$('bindings').replaceChildren();for(const [name,code]of Object.entries(bindings)){const button=document.createElement('button');button.className='binding'+(listening===name?' listening':'');const k=document.createElement('kbd');k.textContent=listening===name?'PRESS KEY':label(code);button.append(document.createTextNode(LABELS[name]),k);button.onclick=()=>{listening=name;renderBindings();};$('bindings').append(button);}}
function renderControls(){const groups=[['left','right'],['jump'],['crouch'],['dash'],['light'],['heavy'],['special'],['block'],['super']];const names=['Move','Jump','Crouch','Dash','Light','Heavy','Special','Block','Super'];$('controls').querySelectorAll('div').forEach(d=>d.remove());groups.forEach((g,i)=>{const d=document.createElement('div'),keys=document.createElement('span');keys.className='keys';for(const name of g){const k=document.createElement('kbd');k.textContent=label(bindings[name]);keys.append(k);}d.append(keys,document.createTextNode(names[i]));$('controls').insertBefore(d,$('rebind'));});$('comboKeys').textContent=['light','light','heavy','jump','light','heavy','special'].map(name=>label(bindings[name])).join(' → ');guideMode='';lastHud='';}
// ---- Controllers (Gamepad API, standard mapping) and on-screen touch buttons ----
const actBits=name=>B[name]??(canAfford(name)?COMBO[name]:0);
const PAD={0:'jump',2:'light',3:'heavy',1:'special',5:'dash',4:'block',7:'super',6:'ex',12:'jump',13:'crouch',14:'left',15:'right'};
function padMask(){let m=0;for(const g of navigator.getGamepads?.()??[]){if(!g)continue;g.buttons.forEach((b,i)=>{if(PAD[i]&&(b.pressed||b.value>.5))m|=actBits(PAD[i]);});
  const [x=0,y=0]=g.axes;if(x<-.5)m|=B.left;if(x>.5)m|=B.right;if(y>.6)m|=B.crouch;if(y<-.6)m|=B.jump;}return m;}
// Menus: Start (or A) begins practice from the arcade screen and rematches from the result screen.
let padConfirm=false;
function padMenu(){let pressed=false;for(const g of navigator.getGamepads?.()??[])if(g&&(g.buttons[9]?.pressed||g.buttons[0]?.pressed))pressed=true;
  if(pressed&&!padConfirm){if(mode==='menu')startAI(false);else if(!$('result').classList.contains('hidden'))$('rematch').click();}padConfirm=pressed;}
addEventListener('gamepadconnected',()=>notice('Controller connected · stick/D-pad move · A jump · X light · Y heavy · B special · RB dash · LB block · RT super · LT EX · Start to play'));
const touchHeld=new Set(),isTouch=matchMedia('(pointer:coarse)').matches||'ontouchstart' in window;
document.querySelectorAll('#touchPad [data-act]').forEach(b=>{const act=b.dataset.act;
  const down=e=>{e.preventDefault();sound.unlock();try{b.setPointerCapture(e.pointerId);}catch{}if(!touchHeld.has(act))tapMask|=actBits(act);touchHeld.add(act);b.classList.add('pressed');};
  const up=()=>{touchHeld.delete(act);b.classList.remove('pressed');};
  b.addEventListener('pointerdown',down);for(const ev of ['pointerup','pointercancel','lostpointercapture'])b.addEventListener(ev,up);b.addEventListener('contextmenu',e=>e.preventDefault());});
// The strip under the arena teaches the combo, and switches to the meter moves when your bar is ready.
let guideMode='';function setGuide(m){if(m===guideMode)return;guideMode=m;const g=document.querySelector('.combo-guide strong');
  if(m==='super'){g.textContent='SUPER READY';$('comboKeys').textContent=`Press ${label(bindings.super)}  ·  or ${label(bindings.heavy)} + ${label(bindings.special)} together`;}
  else if(m==='ex'){g.textContent='EX READY';$('comboKeys').textContent=`Press ${label(bindings.ex)} for a powered-up special  ·  fill the bar for a Super`;}
  else{g.textContent='LAUNCH & CHASE';$('comboKeys').textContent=['light','light','heavy','jump','light','heavy','special'].map(name=>label(bindings[name])).join(' → ');}}
$('rebind').onclick=()=>{clearInput();renderBindings();$('keysDialog').showModal();};$('resetKeys').onclick=()=>{bindings={...DEFAULTS};save('nr-keys',bindings);renderBindings();renderControls();};renderControls();
$('serverSettings').onclick=()=>{$('serverUrl').value=serverBase;$('serverDialog').showModal();};
$('saveServer').onclick=async()=>{const value=$('serverUrl').value.trim();if(value){try{const u=new URL(value);if(!['https:','http:'].includes(u.protocol)||u.username||u.password)throw new Error();if(location.protocol==='https:'&&u.protocol!=='https:')throw new Error();serverBase=u.origin;}catch{notice('Enter a valid HTTPS server address.');return;}}else serverBase='';save('nr-server',serverBase);if(room)leave();else{connectionGeneration++;socket?.close();socket=null;session(null);}$('serverDialog').close();await checkServer();notice(serverReady?'Server connected. Create or join a room.':'Server could not be reached. Check its address and make sure it is running.');};
let previousTick=performance.now(),acc=0,frames=0,fpsTime=previousTick,simulationTicks=0,simulationTime=previousTick;
let prevPos=null,prevProj=null;
function rememberPositions(){prevPos=state.fighters.map(f=>({x:f.x,y:f.y}));prevProj=new Map(state.projectiles.map(p=>[p.id,p.x]));}
function advance(){
  rememberPositions();
  if(mode==='ai'&&!document.querySelector('dialog[open]')&&!document.hidden){const m=mask();if(training&&recording){recorded.push(orient(m,state.fighters[1].face));step(state,[0,m]);if(recorded.length>=REC_MAX)toggleRecord();}else step(state,[m,training?dummyMask(state):ai.input(state)]);confirmed=state;renderer.events(state,e=>{sound.event(e);trackStats(e);});updateHUD();}
  else if(mode==='online'&&room&&socket?.readyState===1&&!networkPause&&!reconnecting){const m=document.hidden?0:mask();send({type:'input',seq:++seq,mask:m});pending.push({seq,mask:m});if(pending.length>120)pending.shift();if(performance.now()-lastSnapshot<300){const inputs=[...lastServerInputs];inputs[myIndex]=m;step(state,inputs);}}
}
// The 60 Hz simulation is stepped from the display loop (fixed timestep), so every screen refresh sees an
// even amount of game time; positions are interpolated between ticks for smooth motion at 60/120/144 Hz.
// A slow backup timer keeps online input flowing while the tab is hidden and the display loop is paused.
const TICK=1000/60;let lastFrame=0;
function tick(now){acc+=Math.min(100,now-previousTick);previousTick=now;let count=0;while(acc>=TICK&&count++<6){acc-=TICK;advance();simulationTicks++;}if(count>=6)acc=0;if(now-simulationTime>2000){$('game').dataset.simFps=Math.round(simulationTicks*1000/(now-simulationTime));simulationTicks=0;simulationTime=now;}}
setInterval(()=>{const now=performance.now();if(now-lastFrame>120)tick(now);},50);
const lerp=(a,b,k)=>a+(b-a)*k;
function viewState(){
  if(!prevPos||prevPos.length!==state.fighters.length||mode==='menu'||mode==='lobby')return state;
  const k=Math.min(1,acc/TICK);
  // Skip interpolation across teleports (round resets, rollback corrections).
  const fighters=state.fighters.map((f,i)=>{const p=prevPos[i];return Math.abs(p.x-f.x)>40||Math.abs(p.y-f.y)>40?f:{...f,x:lerp(p.x,f.x,k),y:lerp(p.y,f.y,k)};});
  const projectiles=state.projectiles.map(p=>prevProj.has(p.id)?{...p,x:lerp(prevProj.get(p.id),p.x,k)}:p);
  return{...state,fighters,projectiles};
}
function frame(t){
  if(mode==='menu'||!$('result').classList.contains('hidden'))padMenu();
  lastFrame=performance.now();tick(lastFrame);
  const stale=mode==='online'&&lastSnapshot&&performance.now()-lastSnapshot>1800&&!['matchOver','forfeit'].includes(confirmed.phase);if(stale&&!networkPause){$('pause').textContent='Waiting for the server…';show('pause',true);}else if(mode==='online'&&!networkPause&&!reconnecting)show('pause',false);
  const began=performance.now();renderer.draw(viewState(),t,{menu:mode==='menu'||mode==='lobby',selected,paused:networkPause,boxes:training&&showBoxes});$('game').dataset.renderMs=(performance.now()-began).toFixed(1);frames++;if(t-fpsTime>2000){$('game').dataset.fps=Math.round(frames*1000/(t-fpsTime));frames=0;fpsTime=t;}requestAnimationFrame(frame);
}requestAnimationFrame(frame);
setInterval(()=>{if(socket?.readyState===1)send({type:'ping',time:performance.now()});},2000);
checkServer().then(async()=>{if(savedSession&&savedSession.server===serverBase){try{await connect();send({type:'resume',code:savedSession.code,token:savedSession.token});}catch{session(null);}}});
// Tools use the same user-facing actions. No test-only damage or state mutation.
if(document.modelContext?.registerTool){try{Promise.resolve(document.modelContext.registerTool({name:'start_practice',description:'Start a practice match against an AI opponent using the current fighter and difficulty. Requires returning to the arcade first if already playing.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:false,untrustedContentHint:false},execute:async(input)=>{if(!input||typeof input!=='object'||Object.keys(input).length)throw new Error('No arguments are accepted.');if(mode!=='menu')throw new Error('Return to the arcade before starting practice.');startAI();return{status:'started',fighter:selected,difficulty:$('difficulty').value};}})).catch(()=>{});}catch{}}
