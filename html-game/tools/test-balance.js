// Replay a proven full route with every Gaming choice replaced by Rest.
// Rest must no longer be able to solve both survival resources by itself.
const assert=require('node:assert/strict');
const Engine=require('../engine.js'),data=require('../data/game.json');
const game=new Engine(data,{randomIndex:()=>3});
let replaced=0;
for(const step of require('./browser-route.json')){
  if(step.id==='71:26')game.playerName='Balance check';
  let id=step.id;
  if(data.nodes[id].name==='ACTIVITY / Gaming'){
    id=game.choices().find(n=>n.name==='ACTIVITY / Rest').id;replaced++;
  }
  game.click(id);
  if(game.get('semester/gameOver'))break;
}
assert(replaced>0);
assert.equal(game.get('semester/failure'),4);
assert.equal(game.get('home/week'),10);
assert(game.get('home/energy')>0);
console.log('Balance check passed: replacing entertainment with sleep causes stress failure in Week 10, despite sufficient Energy.');
