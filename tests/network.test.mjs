import test from 'node:test';
import assert from 'node:assert/strict';
import {WebSocket} from 'ws';
import {createGameServer} from '../server.mjs';
import {B} from '../shared/engine.mjs';
const wait=ms=>new Promise(r=>setTimeout(r,ms));
async function client(url){const ws=new WebSocket(url);const c={ws,messages:[],seq:0};ws.on('message',raw=>{const m=JSON.parse(raw);c.messages.push(m);if(m.type==='state')c.state=m.state;if(m.type==='joined')c.joined=m;});await new Promise((r,j)=>{ws.on('open',r);ws.on('error',j);});c.send=m=>ws.send(JSON.stringify(m));c.input=mask=>c.send({type:'input',seq:++c.seq,mask});return c;}
test('two actual WebSocket clients complete a first-to-two match, rematch, reject third player and reconnect', {timeout:30000},async()=>{
  const app=createGameServer({autoTick:false,reconnectMs:500});await new Promise(r=>app.server.listen(0,'127.0.0.1',r));const url=`ws://127.0.0.1:${app.server.address().port}/ws`;
  try{
    const a=await client(url),b=await client(url),c=await client(url);a.send({type:'create',fighter:'kite'});await wait(130);const code=a.joined.code;assert.match(code,/^[A-Z2-9]{6}$/);b.send({type:'join',code,fighter:'kite'});await wait(130);c.send({type:'join',code});await wait(25);assert.ok(c.messages.some(m=>m.message==='Room is full.'));a.send({type:'ready'});b.send({type:'ready'});await wait(130);
    async function play(){for(let n=0;n<600;n++){
      const s=a.state;assert.ok(s);if(s.phase==='matchOver')return;
      const f=s.fighters[0],o=s.fighters[1];const axis=f.x<o.x?B.right:B.left;
      a.input(s.phase==='fight'?(Math.abs(f.x-o.x)>47?axis:!f.move?B.heavy:0):0);b.input(0);
      await wait(8);for(let j=0;j<12;j++)app.tick();await wait(8);
    }throw new Error('Match failed to finish');}
    await play();assert.deepEqual(a.state.wins,[2,0]);assert.deepEqual(a.state,b.state);assert.equal(a.state.winner,0);const firstId=a.state.matchId;
    a.send({type:'rematch'});b.send({type:'rematch'});await wait(130);assert.equal(a.state.matchId,firstId+1);assert.deepEqual(a.state.wins,[0,0]);await play();assert.deepEqual(a.state.wins,[2,0]);assert.deepEqual(a.state,b.state);
    await wait(130);a.send({type:'rematch'});b.send({type:'rematch'});await wait(130);const token=b.joined.token;b.ws.terminate();await wait(30);assert.equal(a.messages.filter(m=>m.type==='state').at(-1).paused,true);
    const resumed=await client(url);resumed.send({type:'resume',code,token});await wait(130);assert.equal(resumed.joined.index,1);assert.equal(a.messages.filter(m=>m.type==='state').at(-1).paused,false);
    // Old/out-of-order input must not replace the newest input or inject health.
    a.send({type:'input',seq:a.seq+2,mask:B.right,hp:99999});a.send({type:'input',seq:a.seq+1,mask:B.left});await wait(15);app.tick();const room=app.rooms.get(code);assert.equal(room.players[0].mask,B.right);assert.equal(room.game.fighters[0].hp,1000);
    resumed.ws.terminate();await wait(520);app.tick();assert.equal(room.game.phase,'forfeit');assert.equal(room.game.winner,0);
    assert.equal(a.messages.filter(m=>m.type==='error').length,0);console.log('Verified two full 2–0 matches, identical authoritative snapshots, rematch reset, room capacity, reconnect, stale-input rejection, and disconnect forfeit.');
  }finally{await app.close();}
});
test('real-time server remains synchronized with 80–120 ms input delay and a stalled sender', {timeout:12000},async()=>{
 const app=createGameServer();await new Promise(r=>app.server.listen(0,'127.0.0.1',r));const url=`ws://127.0.0.1:${app.server.address().port}/ws`;
 try{
  const a=await client(url),b=await client(url);a.send({type:'create',fighter:'rook'});await wait(130);b.send({type:'join',code:a.joined.code,fighter:'kite'});await wait(130);a.send({type:'ready'});b.send({type:'ready'});await wait(2200);
  let lastSeq=0;
  for(let n=0;n<50;n++){const seq=++lastSeq;const delayed=n%2?80:120;setTimeout(()=>{a.send({type:'input',seq,mask:n<27?B.right:n%8===0?B.heavy:0});},delayed);b.input(0);await wait(40);}
  await wait(500);const room=app.rooms.get(a.joined.code);const before=room.game.fighters[0].x;await wait(450);assert.equal(room.game.fighters[0].x,before,'stale input must not keep walking');
  const sa=a.messages.filter(m=>m.type==='state'),sb=b.messages.filter(m=>m.type==='state'),map=new Map(sb.map(m=>[m.state.tick,m.state]));const common=sa.filter(m=>map.has(m.state.tick));assert.ok(common.length>80);for(const m of common)assert.deepEqual(m.state,map.get(m.state.tick));assert.ok(room.game.tick>=280);assert.equal(a.ws.readyState,1);assert.equal(b.ws.readyState,1);
  console.log(`Verified ${common.length} matching real-time snapshots with delayed/reordered inputs and stale-input release.`);
 }finally{await app.close();}
});
