import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { B, createMatch, step } from '../shared/engine.mjs';

function arena(){const s=createMatch();s.phase='fight';s.fighters[0].x=280;s.fighters[1].x=320;return s;}

function fight(id, face = 1) {
  const s = createMatch([id, id === 'kite' ? 'rook' : 'kite']);
  s.phase = 'fight';
  s.fighters[0].x = 320;
  s.fighters[1].x = 320 + face * 37;
  s.fighters[0].face = face;
  s.fighters[1].face = -face;
  return s;
}

for (const id of ['kite', 'rook']) for (const face of [1, -1]) {
  test(`${id} completes the six-hit launch/juggle facing ${face}`, () => {
    const s = fight(id, face), sent = new Set(), hits = [];
    let lastEvent = 0;
    for (let tick = 0; tick < 160; tick++) {
      const f = s.fighters[0];
      let mask = 0;
      function once(key, input) {
        if (!sent.has(key)) { sent.add(key); mask = input; }
      }
      if (tick === 0) mask = B.light;
      else if (f.move === 'light' && f.connected) once('light2', B.light);
      else if (f.move === 'light2' && f.connected) once('heavy', B.heavy);
      else if (f.move === 'heavy' && f.connected) once('jump', B.jump);
      else if (f.y > 0 && !f.move) once('airLight', B.light);
      else if (f.move === 'airLight' && f.connected) once('airHeavy', B.heavy);
      else if (f.move === 'airHeavy' && f.connected) once('airSpecial', B.special);
      step(s, [mask, 0]);
      for (const e of s.events) if (e.id > lastEvent) {
        lastEvent = e.id;
        if (e.type === 'hit') hits.push(e);
      }
    }
    assert.deepEqual(hits.map(e => e.combo), [1, 2, 3, 4, 5, 6]);
    assert.equal(hits.at(-1).finisher, true);
    assert.ok(s.fighters[1].hp > 0 && s.fighters[1].hp < 700);
  });
}

for (const id of ['kite', 'rook']) {
  test(`${id} cannot jump-cancel a guarded launcher`, () => {
    const s = fight(id);
    step(s, [B.heavy, B.block]);
    for (let i = 0; i < 40; i++) step(s, [i % 2 ? B.jump : 0, B.block]);
    assert.equal(s.fighters[1].hp, 1000);
    assert.equal(s.events.some(e => e.type === 'jumpCancel'), false);
    assert.equal(s.events.some(e => e.type === 'block'), true);
  });
}

test('directional input steers an air attack but cannot move a stunned fighter', () => {
  const s = fight('kite');
  const f = s.fighters[0];
  f.y = 90; f.vy = 0;
  step(s, [B.light | B.right, 0]);
  assert.ok(f.x > 320);
  const afterRight = f.x;
  step(s, [B.left, 0]);
  assert.ok(f.x < afterRight);
  f.stun = 8; f.vx = 0;
  const beforeStun = f.x;
  step(s, [B.right, 0]);
  assert.equal(f.x, beforeStun);
});

test('Netlify and the server ship the same combat rules', async () => {
  const canonical = await readFile(new URL('../shared/engine.mjs', import.meta.url), 'utf8');
  for (const file of ['../client/shared/engine.mjs', '../engine.mjs']) {
    assert.equal(await readFile(new URL(file, import.meta.url), 'utf8'), canonical);
  }
});
test('holding back guards, cross-ups beat it, and back dash moves away',()=>{let s=arena();for(let i=0;i<30;i++)step(s,[i===0?B.light:0,B.right]);assert.equal(s.fighters[1].hp,1000);assert.ok(s.events.some(e=>e.type==='block'));
  s=arena();s.fighters[0].x=340;for(let i=0;i<30;i++)step(s,[i===0?B.light:0,B.right]);assert.ok(s.fighters[1].hp<1000,'holding the wrong way after a cross-up must not guard');
  s=arena();for(let i=0;i<40;i++)step(s,[0,B.right]);assert.ok(s.fighters[1].x>330,'holding back with no threat walks back');
  s=arena();const x=s.fighters[0].x;step(s,[B.dash|B.left,0]);assert.equal(s.fighters[0].dashDir,-1);for(let i=0;i<8;i++)step(s,[B.left,0]);assert.ok(s.fighters[0].x<x-25);});
test("Kite's special rushes through Rook's pulse",()=>{const s=createMatch(['rook','kite']);s.phase='fight';s.fighters[0].x=60;s.fighters[1].x=320;step(s,[0,B.special]);
  s.projectiles.push({id:999,owner:0,x:300,y:290-39,vx:4.3,life:100,damage:105,stun:24,blockstun:16,kb:3.1});for(let i=0;i<12;i++)step(s,[0,0]);assert.equal(s.fighters[1].hp,1000);});

// ---- Meter, supers, command specials, training ----
function duel(ids=['kite','rook'],gap=40){const s=createMatch(ids);s.phase='fight';s.fighters[0].x=300;s.fighters[1].x=300+gap;return s;}
const run=(s,frames,m0=0,m1=0)=>{for(let i=0;i<frames;i++)step(s,[typeof m0==='function'?m0(i):m0,typeof m1==='function'?m1(i):m1]);};

test('landing hits builds meter; a super needs a full bar, spends it and freezes the screen', () => {
  const s = duel();
  step(s,[B.special|B.heavy,0]);
  assert.notEqual(s.fighters[0].move,'super','no super without meter');
  const t = duel(); t.fighters[0].meter = 100;
  step(t,[B.special|B.heavy,0]);
  assert.equal(t.fighters[0].move,'super');
  assert.equal(t.fighters[0].meter,0);
  assert.ok(t.freeze>0 && t.events.some(e=>e.type==='super'&&e.label==='SKYLINE BREAKER'));
  run(t,80);
  assert.ok(t.fighters[1].hp<=1000-250,'super lands big damage');
  const u = duel(); run(u,30,i=>i===0?B.light:0);
  assert.ok(u.fighters[0].meter>0 && u.fighters[1].meter>0,'both sides gain meter from a hit');
});

test('Light+Special with half a bar is the EX special, even pressed a frame apart', () => {
  const s = duel(); s.fighters[0].meter = 60;
  step(s,[B.light,0]); step(s,[B.light|B.special,0]);
  assert.equal(s.fighters[0].move,'exSpecial');
  assert.equal(s.fighters[0].meter,10);
});

test('down+special and forward+special pick the command specials', () => {
  const s = duel(); step(s,[B.crouch|B.special,0]); assert.equal(s.fighters[0].move,'specialDown');
  const t = duel(); step(t,[B.right|B.special,0]); assert.equal(t.fighters[0].move,'specialFwd');
  const u = duel(['rook','kite']); step(u,[B.crouch|B.special,0]); assert.equal(u.fighters[0].move,'specialDown');
});

test("Kite's uppercut beats a jump-in", () => {
  const s = duel(['kite','rook'],30); const r = s.fighters[1];
  r.y = 30; r.vy = -2; r.state='jump';
  step(s,[0,B.heavy]); // Rook starts an air attack
  step(s,[B.crouch|B.special,0]);
  run(s,12);
  assert.equal(s.fighters[0].hp,1000,'Kite is untouchable by air attacks during the uppercut');
  assert.ok(r.hp<1000,'the uppercut connects');
});

test("Rook's shoulder charge soaks one hit", () => {
  const s = duel(['rook','kite'],60);
  step(s,[B.right|B.special,0]);
  run(s,14,0,i=>i===2?B.light:0);
  assert.ok(s.events.some(e=>e.type==='armor'),'the jab is absorbed');
  assert.equal(s.fighters[0].stun,0);
  assert.ok(s.fighters[0].hp<1000 && s.fighters[0].hp>950);
});

test("Rook's quake must be blocked low; supers chip through a block", () => {
  let s = duel(['rook','kite'],120); step(s,[B.crouch|B.special,0]); run(s,60,0,B.right);
  assert.ok(s.fighters[1].hp<1000,'standing guard does not stop the low wave');
  s = duel(['rook','kite'],120); step(s,[B.crouch|B.special,0]); run(s,60,0,B.right|B.crouch);
  assert.equal(s.fighters[1].hp,1000);
  s = duel(['rook','kite'],120); s.fighters[0].meter=100; step(s,[B.special|B.heavy,0]); run(s,90,0,B.right);
  assert.ok(s.events.some(e=>e.type==='block'&&e.chip>0));
  assert.ok(s.fighters[1].hp<1000 && s.fighters[1].hp>900);
});

test('training mode: no clock or KO, health refills after a combo, meters stay full', () => {
  const s = createMatch(['kite','rook'],{training:true}); s.phase='fight'; s.fighters[0].x=300; s.fighters[1].x=340;
  s.fighters[1].hp = 5;
  run(s,40,i=>i===0?B.light:0);
  assert.equal(s.phase,'fight');
  assert.ok(s.fighters[1].hp>0);
  run(s,150);
  assert.equal(s.fighters[1].hp,1000);
  assert.equal(s.fighters[0].meter,100);
  assert.equal(s.timer,60*60);
});

test("Kite's slide passes under Rook's pulse", () => {
  const s = createMatch(['kite','rook']); s.phase='fight'; s.fighters[0].x=150; s.fighters[1].x=420;
  step(s,[0,B.special]); for(let i=0;i<24;i++)step(s,[0,0]);
  s.fighters[0].x = s.projectiles[0].x-60; step(s,[B.right|B.special,0]);
  for(let i=0;i<14;i++){step(s,[0,0]);assert.equal(s.fighters[0].stun,0);}
});
