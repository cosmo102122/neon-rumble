import {B,FIGHTERS} from './engine.mjs?v=20261009-02';
export const LEVELS={easy:{reaction:30,decision:20,defense:.23,spacing:36,aggression:.58},normal:{reaction:18,decision:12,defense:.52,spacing:42,aggression:.77},hard:{reaction:10,decision:8,defense:.72,spacing:47,aggression:.89}};
export class OpponentAI{
  constructor(level='normal',index=1,seed=1897){this.level=LEVELS[level]??LEVELS.normal;this.index=index;this.seed=seed;this.history=[];this.next=0;this.mask=0;}
  random(){this.seed=(1664525*this.seed+1013904223)>>>0;return this.seed/4294967296;}
  input(s){
    const l=this.level;
    this.history.push({tick:s.tick,fighters:s.fighters.map(f=>({id:f.id,x:f.x,y:f.y,move:f.move,stun:f.stun,specialCd:f.specialCd,hp:f.hp,connected:f.connected,airChain:f.airChain??0,combo:f.combo??0})),projectiles:s.projectiles.map(p=>({owner:p.owner,x:p.x,vx:p.vx}))});
    if(this.history.length>l.reaction+2)this.history.shift();
    if(s.phase!=='fight'||this.history.length<=l.reaction)return 0;
    // Observe only delayed public game state; never inspect the human's inputs.
    const seen=this.history[0],f=seen.fighters[this.index],o=seen.fighters[1-this.index];
    this.mask&=~(B.light|B.heavy|B.special|B.dash|B.jump);
    if(s.tick<this.next)return this.mask;
    this.next=s.tick+l.decision+Math.floor(this.random()*5);
    let mask=0;const d=Math.abs(o.x-f.x),toward=o.x>f.x?B.right:B.left,away=o.x>f.x?B.left:B.right;
    const danger=(o.move&&d<100)||seen.projectiles.some(p=>p.owner!==this.index&&Math.abs(p.x-f.x)<110);
    if(danger&&this.random()<l.defense){mask=B.block;if(o.move==='low'||(o.y===0&&this.random()<.25))mask|=B.crouch;}
    else if(f.move){
      if(f.connected&&this.random()<l.aggression){
        if(f.move==='light')mask=B.light;
        else if(f.move==='light2'||f.move==='low')mask=B.heavy;
        else if(f.move==='heavy')mask=this.random()<.82?B.jump:(f.specialCd===0?B.special:0);
        else if(f.move==='airLight')mask=B.heavy;
        else if(f.move==='airHeavy')mask=B.special;
      }
    }
    else if(f.y>0){
      if(f.airChain===0)mask=B.light;
      else if(f.airChain===1)mask=B.heavy;
      else if(f.airChain===2)mask=B.special;
      if(d>72)mask|=toward;
    }
    else if(d>160){mask=toward;if(f.id==='rook'&&f.specialCd===0&&this.random()<.6)mask=B.special;else if(this.random()<.16)mask|=B.dash;}
    else if(d>l.spacing+(f.id==='rook'?17:0)){mask=toward;if(this.random()<.08)mask|=B.jump;}
    else if(this.random()<l.aggression){const r=this.random();mask=r<.43?B.light:r<.72?B.heavy:r<.86?B.crouch|B.light:f.specialCd===0?B.special:B.heavy;}
    else mask=this.random()<.55?away:B.block;
    this.mask=mask;return mask;
  }
}
