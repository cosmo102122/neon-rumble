import test from 'node:test';
import assert from 'node:assert/strict';
import {createMatch,step,clone} from '../shared/engine.mjs';
import {OpponentAI,LEVELS} from '../shared/ai.mjs';
test('AI observes delayed state and never changes combat state directly',()=>{for(const level of Object.keys(LEVELS)){const s=createMatch(['kite','rook']);s.phase='fight';const ai=new OpponentAI(level);const original=clone(s);for(let n=0;n<LEVELS[level].reaction;n++)assert.equal(ai.input(s),0);assert.deepEqual(s,original);}});
test('all AI difficulties finish matches under normal combat rules',()=>{for(const level of Object.keys(LEVELS)){const s=createMatch(['kite','rook']),a=new OpponentAI(level,0,17),b=new OpponentAI(level,1,199);let frames=0;while(s.phase!=='matchOver'&&frames<20000){step(s,[a.input(s),b.input(s)]);frames++;}assert.equal(s.phase,'matchOver',level);assert.ok(s.wins.includes(2));assert.ok(s.fighters.every(f=>f.hp>=0&&f.hp<=1000));}});
