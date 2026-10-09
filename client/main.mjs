import {B,createMatch,step,clone,FIGHTERS} from './shared/engine.mjs?v=20261009-02';
import {OpponentAI} from './shared/ai.mjs?v=20261009-02';
import {Renderer} from './render.mjs?v=20261009-02';
import {Sound} from './audio.mjs';
const $=id=>document.getElementById(id),renderer=new Renderer($('game')),sound=new Sound();
$('game').dataset.version='20261009-02';
const DEFAULTS={left:'KeyA',right:'KeyD',jump:'KeyW',crouch:'KeyS',dash:'ShiftLeft',light:'KeyJ',heavy:'KeyK',special:'KeyL',block:'KeyI'};
const LABELS={left:'Move left',right:'Move right',jump:'Jump',crouch:'Crouch',dash:'Dash',light:'Light',heavy:'Heavy',special:'Special',block:'Block'};
function stored(key,fallback){try{return JSON.parse(localStorage.getItem(key))??fallback;}catch{return fallback;}}
function save(key,value){try{localStorage.setItem(key,JSON.stringify(value));}catch{}}
let bindings={...DEFAULTS,...stored('nr-keys',{})},held=new Set(),tapMask=0,listening=null,selected=stored('nr-fighter','kite');if(!FIGHTERS[selected])selected='kite';
let mode='menu',state=createMatch([selected,'rook']),confirmed=state,ai=null,socket=null,room=null,myIndex=0,seq=0,pending=[],lastServerInputs=[0,0],networkPause=false,reconnecting=false,reconnectDeadline=0,lastSnapshot=0,serverReady=false,lastHud='',lastMatchShown=0,connectionGeneration=0;
let serverBase=stored('nr-server','');const params=new URLSearchParams(location.search);const embedded=window.self!==window.top||params.get('embed')==='1';if(embedded)document.documentElement.classList.add('embedded');const suppliedServer=params.get('server');
if(suppliedServer){try{const u=new URL(suppliedServer);if(u.protocol==='https:'){serverBase=u.origin;save('nr-server',serverBase);}}catch{}}
if(params.get('room'))$('roomInput').value=params.get('room').toUpperCase().replace(/[^A-Z2-9]/g,'').slice(0,6);
let savedSession;try{savedSession=JSON.parse(sessionStorage.getItem('nr-session'));}catch{}
function session(value){savedSession=value;try{value?sessionStorage.setItem('nr-session',JSON.stringify(value)):sessionStorage.removeItem('nr-session');}catch{}}
function show(id,visible){$(id).classList.toggle('hidden',!visible);}
function notice(text){$('notice').textContent=text;show('notice',!!text);}
function label(code){return code.replace(/^Key|^Digit/,'').replace('ShiftLeft','SHIFT').replace('ShiftRight','RSHIFT').replace('Arrow','').replace('Space','SPACE');}
function mask(){let m=tapMask;tapMask=0;for(const [name,code]of Object.entries(bindings))if(held.has(code))m|=B[name];if(held.has('Space'))m|=B.jump;return m;}
function clearInput(){held.clear();tapMask=0;if(socket?.readyState===1&&room)send({type:'input',seq:++seq,mask:0});}
function send(data){if(socket?.readyState===1)socket.send(JSON.stringify(data));}
function unlock(){sound.unlock();}document.addEventListener('pointerdown',unlock,{once:true});
document.addEventListener('keydown',e=>{
  if(listening){e.preventDefault();if(e.code==='Escape'){listening=null;renderBindings();return;}if(['Tab','MetaLeft','MetaRight','ControlLeft','ControlRight','Space'].includes(e.code)){notice('Choose another key. Space is always an extra jump key.');return;}
    const other=Object.keys(bindings).find(k=>bindings[k]===e.code);if(other)bindings[other]=bindings[listening];bindings[listening]=e.code;listening=null;save('nr-keys',bindings);renderBindings();renderControls();notice('');return;}
  if(e.target.matches('input,select,textarea')||document.querySelector('dialog[open]'))return;
  if((mode==='online'||mode==='ai')&&(Object.values(bindings).includes(e.code)||e.code==='Space')){e.preventDefault();sound.unlock();if(!held.has(e.code)){for(const [k,v]of Object.entries(bindings))if(v===e.code)tapMask|=B[k];if(e.code==='Space')tapMask|=B.jump;}held.add(e.code);}
});
document.addEventListener('keyup',e=>held.delete(e.code));window.addEventListener('blur',clearInput);document.addEventListener('visibilitychange',()=>{if(document.hidden)clearInput();});
function choose(id){selected=id;save('nr-fighter',id);document.querySelectorAll('[data-fighter]').forEach(b=>{const yes=b.dataset.fighter===id;b.classList.toggle('selected',yes);b.setAttribute('aria-pressed',yes);});$('fighterCaption').replaceChildren();const strong=document.createElement('strong'),small=document.createElement('small');strong.textContent=FIGHTERS[id].name;small.textContent=FIGHTERS[id].title.toUpperCase();$('fighterCaption').append(strong,small);document.querySelector('.stage-caption-number').textContent=id==='kite'?'01 / 02':'02 / 02';}
document.querySelectorAll('[data-fighter]').forEach(b=>b.onclick=()=>choose(b.dataset.fighter));choose(selected);
function endpoint(){const u=new URL(serverBase||location.origin);u.protocol=u.protocol==='https:'?'wss:':'ws:';u.pathname='/ws';u.search='';return u.href;}
async function checkServer(){
  $('networkStatus').textContent='CHECKING SERVER';
  try{const r=await fetch((serverBase||'')+'/health',{signal:AbortSignal.timeout(6000)});const data=await r.json();serverReady=data.game==='neon-rumble'&&data.ok;}catch{serverReady=false;}
  $('networkStatus').textContent=serverReady?'ONLINE SERVER READY':'AI READY · SERVER NEEDED';
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
function setScreen(){const playing=mode==='ai'||mode==='online';show('menu',mode==='menu');show('lobby',mode==='lobby');show('hud',playing);show('fightFooter',playing);show('pause',playing&&(networkPause||reconnecting));$('screen').classList.toggle('playing',playing);const result=playing&&['matchOver','forfeit'].includes(confirmed.phase);show('result',result);if(result){const w=confirmed.winner;$('resultLabel').textContent=confirmed.phase==='forfeit'?'MATCH ENDED · '+confirmed.roundReason.toUpperCase():'MATCH COMPLETE';$('resultTitle').textContent=w<0?'NO CONTEST':w===myIndex?'YOU WIN':'RIVAL WINS';$('resultScore').textContent=`${FIGHTERS[confirmed.fighters[0].id].name}  ${confirmed.wins[0]} — ${confirmed.wins[1]}  ${FIGHTERS[confirmed.fighters[1].id].name}`;if(lastMatchShown!==confirmed.matchId){lastMatchShown=confirmed.matchId;clearInput();}}$('matchMode').textContent=mode==='ai'?`PRACTICE / ${$('difficulty').value.toUpperCase()}`:`ROOM ${room?.code??''} / YOU ARE P${myIndex+1}`;}
function updateHUD(){const s=confirmed;const key=`${s.matchId}|${s.phase}|${Math.ceil(s.timer/60)}|${s.fighters.map(f=>f.hp)}|${s.wins}|${s.round}|${myIndex}|${s.fighters.map(f=>f.id)}`;if(key===lastHud)return;lastHud=key;for(let i=0;i<2;i++){$('name'+i).textContent=FIGHTERS[s.fighters[i].id].name;$('tag'+i).textContent=i===myIndex?'YOU':mode==='ai'?'CPU':'RIVAL';$('health'+i).style.width=Math.max(0,s.fighters[i].hp/10)+'%';$('health'+i).parentElement.setAttribute('aria-label',`${FIGHTERS[s.fighters[i].id].name} health ${s.fighters[i].hp} of 1000`);$('wins'+i).innerHTML=[0,1].map(n=>`<span class="${n<s.wins[i]?'won':''}"></span>`).join('');}$('timer').textContent=Math.max(0,Math.ceil(s.timer/60)).toString().padStart(2,'0');$('round').textContent='ROUND '+s.round;setScreen();}
async function roomAction(type,code){clearInput();sound.unlock();notice('Connecting to the room server…');$('create').disabled=true;try{await connect();send({type,fighter:selected,...(code?{code}:{})});}catch(e){notice(e.message);$('serverDialog').showModal();$('serverUrl').value=serverBase;}finally{$('create').disabled=false;}}
$('create').onclick=()=>roomAction('create');$('joinForm').onsubmit=e=>{e.preventDefault();roomAction('join',$('roomInput').value.trim().toUpperCase());};$('ready').onclick=()=>send({type:'ready'});
$('copyInvite').onclick=async()=>{const u=new URL(location.href);u.hash='';u.search='';u.searchParams.set('room',room.code);if(serverBase)u.searchParams.set('server',serverBase);try{await navigator.clipboard.writeText(u.href);$('copyInvite').textContent='COPIED — SEND IT TO YOUR RIVAL';}catch{notice('Invite link: '+u.href);}};
function startAI(){clearInput();if(room)leave();mode='ai';myIndex=0;state=createMatch([selected,selected==='kite'?'rook':'kite'],{matchId:Date.now()});confirmed=state;ai=new OpponentAI($('difficulty').value);renderer.lastEvent=0;networkPause=false;lastHud='';$('rematchStatus').textContent='';notice('');sound.unlock();setScreen();updateHUD();$('game').focus();}
$('practice').onclick=startAI;$('tryUpdate').onclick=startAI;
function leave(){send({type:'leave'});session(null);room=null;reconnecting=false;networkPause=false;connectionGeneration++;socket?.close();socket=null;mode='menu';state=createMatch([selected,'rook']);confirmed=state;pending=[];clearInput();notice('');show('result',false);setScreen();checkServer();}
for(const id of ['leaveLobby','leaveResult','leaveMatch'])$(id).onclick=leave;
$('rematch').onclick=()=>{if(mode==='ai')startAI();else{send({type:'rematch'});$('rematchStatus').textContent='Waiting for your rival…';}};
$('sound').onclick=()=>{sound.unlock();sound.enabled=!sound.enabled;$('sound').textContent=sound.enabled?'SOUND ON':'SOUND OFF';$('sound').setAttribute('aria-label',sound.enabled?'Turn sound off':'Turn sound on');};
$('fullscreen').onclick=()=>{if(document.fullscreenElement)document.exitFullscreen?.();else $('screen').requestFullscreen?.().catch(()=>notice('Full screen is unavailable in this browser.'));};
for(const id of ['help','comboHelp'])$(id).onclick=()=>{clearInput();$('helpDialog').showModal();};document.querySelectorAll('.dialog-close,.dialog-done').forEach(b=>b.onclick=()=>{b.closest('dialog').close();listening=null;});
function renderBindings(){$('bindings').replaceChildren();for(const [name,code]of Object.entries(bindings)){const button=document.createElement('button');button.className='binding'+(listening===name?' listening':'');const k=document.createElement('kbd');k.textContent=listening===name?'PRESS KEY':label(code);button.append(document.createTextNode(LABELS[name]),k);button.onclick=()=>{listening=name;renderBindings();};$('bindings').append(button);}}
function renderControls(){const groups=[['left','right'],['jump'],['crouch'],['dash'],['light'],['heavy'],['special'],['block']];const names=['Move','Jump','Crouch','Dash','Light','Heavy','Special','Block'];$('controls').querySelectorAll('div').forEach(d=>d.remove());groups.forEach((g,i)=>{const d=document.createElement('div'),keys=document.createElement('span');keys.className='keys';for(const name of g){const k=document.createElement('kbd');k.textContent=label(bindings[name]);keys.append(k);}d.append(keys,document.createTextNode(names[i]));$('controls').insertBefore(d,$('rebind'));});$('comboKeys').textContent=['light','light','heavy','jump','light','heavy','special'].map(name=>label(bindings[name])).join(' → ');}
$('rebind').onclick=()=>{clearInput();renderBindings();$('keysDialog').showModal();};$('resetKeys').onclick=()=>{bindings={...DEFAULTS};save('nr-keys',bindings);renderBindings();renderControls();};renderControls();
$('serverSettings').onclick=()=>{$('serverUrl').value=serverBase;$('serverDialog').showModal();};
$('saveServer').onclick=async()=>{const value=$('serverUrl').value.trim();if(value){try{const u=new URL(value);if(!['https:','http:'].includes(u.protocol)||u.username||u.password)throw new Error();if(location.protocol==='https:'&&u.protocol!=='https:')throw new Error();serverBase=u.origin;}catch{notice('Enter a valid HTTPS server address.');return;}}else serverBase='';save('nr-server',serverBase);if(room)leave();else{connectionGeneration++;socket?.close();socket=null;session(null);}$('serverDialog').close();await checkServer();notice(serverReady?'Server connected. Create or join a room.':'Server could not be reached. Check its address and make sure it is running.');};
let previousTick=performance.now(),acc=0,frames=0,fpsTime=previousTick,simulationTicks=0,simulationTime=previousTick;
function advance(){
  if(mode==='ai'&&!document.querySelector('dialog[open]')&&!document.hidden){step(state,[mask(),ai.input(state)]);confirmed=state;renderer.events(state,e=>sound.event(e));updateHUD();}
  else if(mode==='online'&&room&&socket?.readyState===1&&!networkPause&&!reconnecting){const m=document.hidden?0:mask();send({type:'input',seq:++seq,mask:m});pending.push({seq,mask:m});if(pending.length>120)pending.shift();if(performance.now()-lastSnapshot<300){const inputs=[...lastServerInputs];inputs[myIndex]=m;step(state,inputs);}}
}
// Networking/simulation is independent of rendering cadence and display refresh rate.
setInterval(()=>{const now=performance.now();acc+=Math.min(100,now-previousTick);previousTick=now;let count=0;while(acc>=1000/60&&count++<6){acc-=1000/60;advance();simulationTicks++;}if(now-simulationTime>2000){$('game').dataset.simFps=Math.round(simulationTicks*1000/(now-simulationTime));simulationTicks=0;simulationTime=now;}},4);
function frame(t){
  const stale=mode==='online'&&lastSnapshot&&performance.now()-lastSnapshot>1800&&!['matchOver','forfeit'].includes(confirmed.phase);if(stale&&!networkPause){$('pause').textContent='Waiting for the server…';show('pause',true);}else if(mode==='online'&&!networkPause&&!reconnecting)show('pause',false);
  const began=performance.now();renderer.draw(state,t,{menu:mode==='menu'||mode==='lobby',selected,paused:networkPause});$('game').dataset.renderMs=(performance.now()-began).toFixed(1);frames++;if(t-fpsTime>2000){$('game').dataset.fps=Math.round(frames*1000/(t-fpsTime));frames=0;fpsTime=t;}requestAnimationFrame(frame);
}requestAnimationFrame(frame);
setInterval(()=>{if(socket?.readyState===1)send({type:'ping',time:performance.now()});},2000);
checkServer().then(async()=>{if(savedSession&&savedSession.server===serverBase){try{await connect();send({type:'resume',code:savedSession.code,token:savedSession.token});}catch{session(null);}}});
// Tools use the same user-facing actions. No test-only damage or state mutation.
if(document.modelContext?.registerTool){try{Promise.resolve(document.modelContext.registerTool({name:'start_practice',description:'Start a practice match against an AI opponent using the current fighter and difficulty. Requires returning to the arcade first if already playing.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:false,untrustedContentHint:false},execute:async(input)=>{if(!input||typeof input!=='object'||Object.keys(input).length)throw new Error('No arguments are accepted.');if(mode!=='menu')throw new Error('Return to the arcade before starting practice.');startAI();return{status:'started',fighter:selected,difficulty:$('difficulty').value};}})).catch(()=>{});}catch{}}
