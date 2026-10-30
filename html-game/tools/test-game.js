const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const Engine=require('../engine.js');
const D=require('../data/game.json');
const PLANS=[['Study','Exercise','Work'],['Study','Rest','Noah'],['Study','Gaming','Noah'],['Study','Rest','Noah'],['Group','Rest','Gaming'],['Work','Study','Rest'],['Group','Study','Gaming'],['Group','Work','Rest'],['Study','Rest','Gaming'],['Study','Rest','Gaming'],['Group','Group','Rest'],['Group','Rest','Gaming'],['Study','Rest','Gaming']];
const CONFIGS=[
 {key:'female_romance_100',contact:'yes',alex:'ask',expected:100},
 {key:'male_romance_100',male:true,contact:'yes',alex:'ask',expected:100},
 {key:'female_solo',contact:'self',alex:'skip',expected:96.5},
 {key:'male_solo',male:true,contact:'self',alex:'skip',expected:96.5},
 {key:'female_rejected',contact:'yes',outingFree:true,alex:'ask',expected:96.9},
 {key:'male_unconfessed',male:true,contact:'yes',alex:'wait',confess:false,expected:96.8},
 ...Array.from({length:10},(_,prize)=>({key:'balanced_prize_'+prize,prize,contact:'yes',alex:'ask',extraWork:true,foodWeeks:[7,10,12],expected:100}))
];
let renderChecks=0;
function checkRender(g) {
 const male=g.get('player/isMale');
 for(const n of g.descendants(g.frame))if(g.visible(n.id)){
  if(n.type==='TEXT'){
   const t=String(g.value(n.bind?.characters,n.text));
   assert(!new RegExp(male?'\\bNoah\\b':'\\bChloe\\b','i').test(t),`Incorrect partner on ${g.frame}: ${t}`);
  }else for(const p of n.fills||[])if(p.type==='IMAGE'){
   const wrong=male?['fa6401dacec32260dd03ed9826c76f9715d94749','efee1cfc8d7f14f7849268f7849aa9d3337937cc','6f160e6c681ea8fd1c9ae57a1aabd0be77d59a34','7a82c4c8cee4a49cd573fb58ac2b45993b96f033']:['9f29ecadb06faab7d29539d6778c68569af0c56d','4cb77f653958c1a7f2c4b9a5d3453a5a5b7b689d','4a5283a86431cf791bd97499eedb2ff491fa6637','7819704e6e16a89c3a0f64fdcbb02c9c14b910e7'];
   assert(!wrong.includes(p.imageHash),`Incorrect portrait on ${g.frame}: ${n.id}`);
  }
 }
 renderChecks++;
}
const reports=[],backendFixtures=[];
for(const cfg of CONFIGS){
 const g=new Engine(D,{randomIndex:()=>cfg.prize??3}),trace=[],weeks=[],controls=[];
 let fixtureValues=structuredClone(g.values);
 const click=a=>{assert(a,'Missing control at '+g.frame);const id=typeof a==='string'?a:a.id,from=g.frame;g.click(id);trace.push(g.frame);const control={id,from,to:g.frame};controls.push(control);if(process.env.SURVIVE_BACKEND_FIXTURES){control.expected={delta:Object.fromEntries(Object.entries(g.values).filter(([key,value])=>JSON.stringify(value)!==JSON.stringify(fixtureValues[key]))),overlays:[...g.overlays],playerName:g.playerName};fixtureValues=structuredClone(g.values);}if(g.frame!==D.start)checkRender(g);};
 const requested={'65:212':cfg.contact==='self'?'find it myself':'ask someone','65:504':'sure','119:194':'dinner together','188:1503':'skip meal','338:5822':cfg.alex==='skip'?'leave it':'ask alex','282:3606':cfg.alex==='wait'?'trust alex':'contact the tutor','315:5411':cfg.confess===false?'keep it':'tell him'};
 const moveUntil=test=>{
  for(let i=0;i<200;i++){
   const f=D.nodes[g.frame];if(test(f))return;
   assert(!g.get('semester/gameOver'),'Unexpected game over '+g.get('semester/failure'));
   const choices=g.choices().filter(n=>/^(ACTION|BUTTON)\s*\//.test(n.name));
   let a=choices[0];
   if(requested[f.id])a=choices.find(n=>n.name.toLowerCase().includes(requested[f.id]));
   else if(choices.length>1 && /Dinner choice/.test(f.name))a=choices.find(n=>/Skip meal/i.test(n.name));
   else if(choices.length>1 && /What to do about Alex/.test(f.name))a=choices.find(n=>/CONTACT THE TUTOR/i.test(n.name));
   const before=g.frame;click(a);assert.notEqual(g.frame,before,'Story did not advance '+f.name);
  }throw Error('Walk limit');
 };
 click(cfg.male?'442:8423':'442:8421');g.playerName='Test Player';click('71:26');
 assert.equal(g.get('player/isMale'),!!cfg.male);
 moveUntil(f=>f.id==='65:732');assert.equal(g.get('contactExchanged'),cfg.contact==='yes');
 click('167:769');moveUntil(f=>/Dorm Home/i.test(f.name));
 const plans=PLANS.map((p,i)=>p.map(a=>a==='Noah'&&(cfg.contact!=='yes'||cfg.outingFree)?(i===1?'Rest':'Cassy'):a));
 if(cfg.extraWork)plans[4]=['Group','Rest','Work'];
 if(cfg.alex==='skip'||cfg.alex==='wait')plans[11]=['Group','Group','Rest'];
 for(let w=1;w<=13;w++){
  assert.equal(g.get('home/week'),w);assert(/Dorm Home/.test(D.nodes[g.frame].name));
  if(cfg.foodWeeks?.includes(w)){
   click(g.choices().find(n=>n.name==='ACTION / Takeaway'));
   click(g.choices().find(n=>/Buy hot meal/.test(n.name)));
   click(g.choices().find(n=>/Close Takeaway/.test(n.name)));
  }
  click(g.choices().find(n=>n.name==='ACTION / Plan'));
  for(const name of plans[w-1]){
   const label={Noah:'Hang out with Noah',Cassy:'Hang out with Cassy',Group:'Group Work'}[name]||name;
   click(g.choices().find(n=>n.name==='ACTIVITY / '+label));
  }
  const confirm=g.choices().find(n=>/^ACTION \/ Confirm/.test(n.name));click(confirm);
  const stats=()=>JSON.stringify(['knowledge','energy','stress','fitness','money'].map(k=>g.get('home/'+k)));
  const state=stats(),dest=g.frame;g.click(confirm.id);
  assert.equal(stats(),state,'Double confirm changed stats');assert.equal(g.frame,dest);
  moveUntil(f=>/Week.*Summary/.test(f.name));
  weeks.push({week:w,plan:plans[w-1],takeaway:!!cfg.foodWeeks?.includes(w),...Object.fromEntries(['knowledge','energy','stress','money','fitness'].map(k=>[k,g.get('home/'+k)])),group:g.get('group/totalProgress')});
  if(w===5){const roundtrip=new Engine(D);roundtrip.restore(JSON.parse(JSON.stringify(g.snapshot())));assert.deepEqual(roundtrip.values,g.values);assert.equal(roundtrip.frame,g.frame);assert.equal(roundtrip.playerName,'Test Player');}
  click(g.choices().find(n=>/start.*week|final.*exam/i.test(n.name)));if(w<13)moveUntil(f=>/Dorm Home/i.test(f.name));
 }
 click('395:6914');click('395:7008');moveUntil(f=>f.id==='435:7777');click('435:7781');moveUntil(f=>/^ENDING\s*\//.test(f.name));
 const score=g.get('ending/score'),romance=g.get('romance/relationship')===1;
 assert.equal(score,cfg.expected);assert(D.nodes[g.frame].name.includes(romance?'/ Romance':'/ No romance'));
 const academic=g.frame;
 click(g.choices().find(n=>/^BUTTON\s*\//.test(n.name)));
 if(romance){assert.equal(g.frame,'442:8163');moveUntil(f=>f.id==='440:7822');click('442:8416');}
 assert.equal(g.frame,D.start);assert.equal(g.get('grades/midScore'),0);assert(!g.get('contactExchanged'));
 reports.push({route:cfg.key,passed:true,score,romance,academic,clicks:trace.length,weeks:weeks.length,weekly:weeks});
 if(process.env.SURVIVE_BACKEND_FIXTURES)backendFixtures.push({route:cfg.key,prize:cfg.prize??3,controls});
 if(cfg.key==='male_romance_100')fs.writeFileSync(path.join(__dirname,'browser-route.json'),JSON.stringify(controls));
}
const missingTargets=D.actionPool.filter(a=>a[0]==='n'&&!D.nodes[a[1]]);assert.equal(missingTargets.length,0);
for(const image of D.images)assert(fs.existsSync(path.join(__dirname,'../assets',image.hash+'.png')),'Missing art '+image.hash);
const output={passed:true,routes:reports,renderChecks,missingTargets:0,imageAssets:D.images.length};
fs.writeFileSync(path.join(__dirname,'../test-results.json'),JSON.stringify(output,null,2));
console.log(JSON.stringify(output,null,2));
if(process.env.SURVIVE_BACKEND_FIXTURES){
 // Replay only real controls. The checks above also deliberately invoke a stale
 // confirm button, which a server correctly rejects and which resets feedback.
 for(const route of backendFixtures){
  const replay=new Engine(D,{randomIndex:()=>route.prize});let previous=structuredClone(replay.values);
  for(const step of route.controls){
   if(step.id==='71:26')replay.playerName='Test Player';
   replay.click(step.id);
   step.expected={delta:Object.fromEntries(Object.entries(replay.values).filter(([key,value])=>JSON.stringify(value)!==JSON.stringify(previous[key]))),overlays:[...replay.overlays],playerName:replay.playerName};
   previous=structuredClone(replay.values);
  }
 }
 fs.writeFileSync(process.env.SURVIVE_BACKEND_FIXTURES,JSON.stringify(backendFixtures));
}
