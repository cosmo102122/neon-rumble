import http from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {randomBytes} from 'node:crypto';
import {WebSocketServer,WebSocket} from 'ws';
import {createMatch,step,FIGHTERS} from './shared/engine.mjs';

const ROOT=path.dirname(fileURLToPath(import.meta.url));
const TYPES={'.html':'text/html; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.png':'image/png','.svg':'image/svg+xml','.json':'application/json','.webp':'image/webp'};
export function createGameServer({reconnectMs=15000,roomTtlMs=30*60*1000,autoTick=true}={}) {
  const rooms=new Map();
  const server=http.createServer(async(req,res)=>{
    const url=new URL(req.url,'http://local');
    if(url.pathname==='/health'){res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store','Access-Control-Allow-Origin':'*'});return res.end(JSON.stringify({ok:true,game:'neon-rumble'}));}
    try{
      const decoded=decodeURIComponent(url.pathname),base=decoded.startsWith('/shared/')?ROOT:path.join(ROOT,'client');
      const target=path.resolve(base,'.'+(decoded==='/'?'/index.html':decoded));
      if(!target.startsWith(base+path.sep)||decoded.includes('\0'))throw new Error('Invalid path');
      const info=await stat(target);if(!info.isFile())throw new Error('Not file');
      res.writeHead(200,{'Content-Type':TYPES[path.extname(target)]||'application/octet-stream','X-Content-Type-Options':'nosniff','Cache-Control':'no-cache','Referrer-Policy':'no-referrer'});res.end(await readFile(target));
    }catch{res.writeHead(404);res.end('Not found');}
  });
  const wss=new WebSocketServer({noServer:true,maxPayload:2048,perMessageDeflate:false});
  const allowed=(process.env.ALLOWED_ORIGINS||'').split(',').filter(Boolean);
  server.on('upgrade',(req,socket,head)=>{
    if(req.url?.split('?')[0]!=='/ws'||(allowed.length&&req.headers.origin&&!allowed.includes(req.headers.origin))){socket.write('HTTP/1.1 403 Forbidden\r\n\r\n');return socket.destroy();}
    wss.handleUpgrade(req,socket,head,ws=>wss.emit('connection',ws,req));
  });
  const send=(ws,data)=>{if(ws?.readyState===WebSocket.OPEN&&ws.bufferedAmount<150000)ws.send(JSON.stringify(data));};
  const error=(ws,message)=>send(ws,{type:'error',message});
  function roomMessage(r){return{type:'room',code:r.code,players:r.players.map(p=>p?{fighter:p.fighter,ready:p.ready,connected:!!p.ws}:null),rematch:r.players.map(p=>!!p?.rematch)};}
  function broadcast(r,data){r.players.forEach(p=>send(p?.ws,data));}
  function snapshot(r){if(r.game)broadcast(r,{type:'state',state:r.game,ack:r.players.map(p=>p?.ack??-1),inputs:r.players.map(p=>p?.mask??0),paused:r.paused,graceMs:r.paused?Math.max(0,r.pauseUntil-Date.now()):0});}
  function start(r){r.game=createMatch(r.players.map(p=>p.fighter),{matchId:(r.game?.matchId??0)+1});r.paused=false;r.players.forEach(p=>{p.ready=false;p.rematch=false;p.mask=0;p.edges=0;});broadcast(r,roomMessage(r));snapshot(r);}
  function attach(ws,r,index,p){p.ws=ws;p.disconnectedAt=0;ws.room=r;ws.index=index;send(ws,{type:'joined',code:r.code,index,token:p.token});broadcast(r,roomMessage(r));if(r.game){if(r.players.every(p=>p?.ws)){r.paused=false;broadcast(r,{type:'notice',message:'Both players connected. Fight resumes.'});}snapshot(r);}}
  function detach(ws,explicit=false){const r=ws.room;if(!r)return;const p=r.players[ws.index];ws.room=null;if(!p||p.ws!==ws)return;p.ws=null;p.mask=0;p.edges=0;p.ready=false;p.rematch=false;p.disconnectedAt=Date.now();
    if(r.game&&!['matchOver','forfeit'].includes(r.game.phase)){
      if(explicit){r.game.phase='forfeit';r.game.winner=1-ws.index;r.game.roundReason='Opponent left';r.paused=false;}
      else{r.paused=true;r.pauseUntil=Date.now()+reconnectMs;broadcast(r,{type:'notice',message:'Opponent disconnected. Match paused while they reconnect.'});}
    }else if(!r.game){r.players[ws.index]=null;}
    broadcast(r,roomMessage(r));snapshot(r);
  }
  wss.on('connection',ws=>{
    ws.alive=true;ws.rateStart=Date.now();ws.rateCount=0;ws.lastAction=0;
    ws.on('pong',()=>{ws.alive=true;});
    ws.on('message',raw=>{
      const now=Date.now();if(now-ws.rateStart>1000){ws.rateStart=now;ws.rateCount=0;}if(++ws.rateCount>180)return ws.close(1008,'Message limit');
      let m;try{m=JSON.parse(raw.toString());}catch{return error(ws,'Invalid message.');}
      if(!m||typeof m!=='object')return;
      if(m.type==='ping')return send(ws,{type:'pong',time:m.time});
      if(m.type==='input'){
        const p=ws.room?.players[ws.index];if(!p||p.ws!==ws||!Number.isSafeInteger(m.seq)||m.seq<=p.seq||!Number.isInteger(m.mask)||m.mask<0||m.mask>511)return;
        p.seq=m.seq;p.edges|=m.mask&~p.mask;p.mask=m.mask;p.lastInput=now;return;
      }
      if(now-ws.lastAction<100)return error(ws,'Please wait a moment.');ws.lastAction=now;
      if(m.type==='create'){
        if(ws.room)return error(ws,'Leave your current room first.');if(rooms.size>=200)return error(ws,'Server is full. Try again soon.');
        let code;do{code=Array.from(randomBytes(6),v=>'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[v%32]).join('');}while(rooms.has(code));
        const r={code,players:[null,null],game:null,paused:false,created:now,lastActivity:now};rooms.set(code,r);
        const p={token:randomBytes(24).toString('hex'),fighter:FIGHTERS[m.fighter]?m.fighter:'kite',ready:false,mask:0,edges:0,seq:-1,ack:-1,lastInput:now};r.players[0]=p;attach(ws,r,0,p);return;
      }
      if(m.type==='join'||m.type==='resume'){
        if(ws.room)return error(ws,'Already in a room.');const code=String(m.code??'').toUpperCase();const r=rooms.get(code);if(!r)return error(ws,'Room not found. Check the code or create a new room.');
        if(m.type==='resume'){
          const index=r.players.findIndex(p=>p?.token===m.token);if(index<0)return error(ws,'Reconnect session expired. Create a new room.');const p=r.players[index];
          if(p.ws){p.ws.room=null;p.ws.close(4001,'Reconnected elsewhere');}p.mask=0;p.edges=0;p.seq=-1;p.ack=-1;attach(ws,r,index,p);return;
        }
        if(r.game)return error(ws,'This match has already started.');const index=r.players.findIndex(p=>!p);if(index<0)return error(ws,'Room is full.');
        const p={token:randomBytes(24).toString('hex'),fighter:FIGHTERS[m.fighter]?m.fighter:'kite',ready:false,mask:0,edges:0,seq:-1,ack:-1,lastInput:now};r.players[index]=p;attach(ws,r,index,p);return;
      }
      const r=ws.room,p=r?.players[ws.index];if(!p)return error(ws,'Create or join a room first.');r.lastActivity=now;
      if(m.type==='leave'){detach(ws,true);send(ws,{type:'left'});return;}
      if(m.type==='select'&&!r.game&&FIGHTERS[m.fighter]){p.fighter=m.fighter;p.ready=false;broadcast(r,roomMessage(r));}
      if(m.type==='ready'&&!r.game){p.ready=!p.ready;broadcast(r,roomMessage(r));if(r.players.every(p=>p?.ws&&p.ready))start(r);}
      if(m.type==='rematch'&&['matchOver','forfeit'].includes(r.game?.phase)){p.rematch=true;broadcast(r,roomMessage(r));if(r.players.every(p=>p?.ws&&p.rematch))start(r);}
    });
    ws.on('close',()=>detach(ws));ws.on('error',()=>{});
    send(ws,{type:'hello',protocol:1});
  });
  function tick(){
    const now=Date.now();
    for(const [code,r]of rooms){
      if(!r.players.some(p=>p?.ws)&&now-r.lastActivity>roomTtlMs){rooms.delete(code);continue;}
      if(!r.game)continue;
      if(r.paused){if(now>=r.pauseUntil){r.paused=false;r.game.phase='forfeit';r.game.winner=r.players[0]?.ws?0:r.players[1]?.ws?1:-1;r.game.roundReason='Disconnect';snapshot(r);}continue;}
      if(r.players.some(p=>p?.ws))r.lastActivity=now;
      const masks=r.players.map(p=>p&&now-p.lastInput<400?p.mask:0);
      const edges=r.players.map(p=>p?.edges??0);
      r.players.forEach(p=>{if(p){p.edges=0;p.ack=p.seq;}});
      step(r.game,masks,edges);if(r.game.tick%2===0)snapshot(r);
    }
  }
  let last=performance.now(),acc=0;
  const ticker=autoTick?setInterval(()=>{const now=performance.now();acc+=Math.min(100,now-last);last=now;let n=0;while(acc>=1000/60&&n++<6){tick();acc-=1000/60;}},4):null;
  const heartbeat=setInterval(()=>{wss.clients.forEach(ws=>{if(!ws.alive)return ws.terminate();ws.alive=false;ws.ping();});},5000);
  return{server,wss,rooms,tick,async close(){clearInterval(ticker);clearInterval(heartbeat);wss.clients.forEach(ws=>ws.terminate());await new Promise(resolve=>wss.close(resolve));await new Promise(resolve=>server.close(resolve));}};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const app=createGameServer();const portArg=process.argv.indexOf('--port');const port=Number(process.env.PORT||(portArg>=0?process.argv[portArg+1]:3000));
  app.server.listen(port,'0.0.0.0',()=>console.log(`Neon Rumble ready on http://localhost:${port}`));
  for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>app.close().then(()=>process.exit(0)));
}
