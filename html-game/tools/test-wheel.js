const assert=require('node:assert/strict');
const fs=require('node:fs');
const zlib=require('node:zlib');
const Engine=require('../engine.js'),D=require('../data/game.json');
const W=D.wheel;
const routes=JSON.parse(zlib.gunzipSync(fs.readFileSync(require('node:path').join(__dirname,'../../backend/tests/fixtures/routes.json.gz'))));
const route=routes.find(r=>r.route==='female_solo').controls;
const early=route.slice(0,route.findIndex(s=>/Dorm Home/.test(D.nodes[s.to].name))+1);
const stats=['knowledge','energy','stress','fitness','money'];
const initial={knowledge:20,energy:75,stress:28,fitness:0,money:80};
for(const [index,prize] of W.prizes.entries()){
 let draws=0;
 const g=new Engine(D,{randomIndex:count=>{assert.equal(count,10);draws++;return index;}});
 for(const step of early){
  g.click(step.id);
  if(step.id===W.control){
   assert.equal(g.get('wheel/prizeIndex'),index);
   for(const stat of stats)assert.equal(g.get('home/'+stat),initial[stat]+(stat===prize.stat?prize.amount:0));
   assert.equal(g.get('wheel/delta'),prize.delta);
   const values=structuredClone(g.values);
   assert.throws(()=>g.click(W.control));assert.deepEqual(g.values,values);
   const restored=new Engine(D,{randomIndex:()=>{throw Error('Unexpected redraw');}});
   restored.restore(JSON.parse(JSON.stringify(g.snapshot())));
   assert.deepEqual(restored.values,g.values);
   // Even a navigation back to the wheel cannot claim the same reward twice.
   restored.frame=W.frame;restored.click(W.control);assert.deepEqual(restored.values,g.values);
  }
  if(g.frame==='65:732'){
   const rendered=id=>g.value(D.nodes[id].bind.characters,D.nodes[id].text);
   assert.equal(rendered('167:745'),prize.name+'\n'+prize.delta);
   for(const [node,stat] of [['167:751','knowledge'],['167:755','energy'],['167:763','fitness']])assert.equal(rendered(node),g.get('home/'+stat));
  }
 }
 assert.equal(draws,1);
 for(const stat of stats)assert.equal(g.get('home/'+stat),initial[stat]+(stat===prize.stat?prize.amount:0),'Reward lost entering Week 1: '+stat);
 assert(g.get('wheel/balance').includes(String(g.get('home/money'))));
 g.reset();assert.equal(g.get('wheel/prizeIndex'),-1);assert.equal(g.get('home/money'),80);
}
function legacy(frame){
 const g=new Engine(D);g.frame=frame;const saved=g.snapshot();
 for(const [id,v] of Object.entries(D.variables))if(v.name.startsWith('wheel/'))delete saved.values[id];
 for(const id of W.legacyMoneyVariables)saved.values[id]=92;
 return saved;
}
for(const frame of W.beforeFrames){
 const g=new Engine(D);g.restore(legacy(frame));assert.equal(g.get('home/money'),80);assert.equal(g.get('weekStartMoney'),80);assert.equal(g.get('wheel/prizeIndex'),-1);
}
const old=new Engine(D);old.restore(legacy('65:175'));
assert.equal(old.get('home/money'),92);assert.equal(old.get('wheel/prizeIndex'),3);assert.equal(old.get('wheel/delta'),'Money +AU$12');

// Exercise actual new-game paths, not just calls to the random-number generator.
const toDraw=route.slice(0,route.findIndex(step=>step.id===W.control)+1);
let nextPrize=0,drawCalls=0;
const restarted=new Engine(D,{randomIndex:()=>{drawCalls++;return nextPrize;}});
function freshDraw(){
 for(const step of toDraw)restarted.click(step.id);
 assert.equal(restarted.get('wheel/prizeIndex'),nextPrize);
 assert.equal(restarted.get('wheel/delta'),W.prizes[nextPrize].delta);
 assert.equal(restarted.get('wheel/title'),W.prizes[nextPrize].title);
 nextPrize=(nextPrize+1)%W.prizes.length;
}
for(let i=0;i<20;i++){
 restarted.reset();assert.equal(restarted.get('wheel/prizeIndex'),-1);freshDraw();
}
const endingRestarts=[];
for(const frame of D.frames.filter(frame=>frame.name.startsWith('ENDING /'))){
 const restart=restarted.descendants(frame.id).find(n=>n.name==='BUTTON / Start new game');
 if(!restart)continue;
 restarted.frame=frame.id;restarted.click(restart.id);
 assert.equal(restarted.frame,D.start);
 assert.equal(restarted.get('wheel/prizeIndex'),-1,'Ending must clear the previous prize: '+frame.name);
 freshDraw();endingRestarts.push(frame.name);
}
assert.equal(drawCalls,20+endingRestarts.length,'Every fresh run must draw exactly once');
const newGameCounts=Array(10).fill(0),live=new Engine(D);
for(let i=0;i<100;i++){
 live.reset();for(const step of toDraw)live.click(step.id);
 newGameCounts[live.get('wheel/prizeIndex')]++;
}
assert(newGameCounts.every(count=>count>0),'New games must be able to reach all ten prizes');
const counts=Array(10).fill(0);
for(let i=0;i<1000;i++)counts[Engine.randomIndex(10)]++;
assert(counts.every(n=>n>0),'Every prize is reachable using the production random source');
const output={passed:true,prizes:10,carryToWeek1:true,saveRestore:true,legacyMigration:true,newGameRestarts:20,endingRestarts:endingRestarts.length,fullNewGames:100,newGameCounts,randomDraws:1000,counts};
fs.writeFileSync(require('node:path').join(__dirname,'../wheel-test-results.json'),JSON.stringify(output,null,2));
console.log(JSON.stringify(output,null,2));
