import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { B, createMatch, step } from '../shared/engine.mjs';

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
