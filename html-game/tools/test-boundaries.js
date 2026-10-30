const assert=require('node:assert/strict');
const E=require('../engine.js'),D=require('../data/game.json');
const wired=require('./plan-boundaries.json');
let cases=0;
function setup(plan,seed={},group={}) {
 const g=new E(D);g.click('71:26');
 const stats={Knowledge:20,Energy:100,Stress:20,Fitness:0,Money:500,...seed};
 for(const [k,v]of Object.entries(stats))g.set('home/'+k.toLowerCase(),v);
 g.set('home/week',plan.week);g.set('contactExchanged',/Noah/i.test(plan.name));g.set('w2/metCassy',true);
 for(const name of ['w5/assignmentReleased','w5/allocationPosted','w5/groupWorkUnlocked'])g.set(name,true);
 for(const [name,value]of Object.entries(group))g.set('group/'+name,value);
 const home=D.frames.find(n=>new RegExp('^W'+plan.week+' \\/').test(n.name)&&/Dorm Home/.test(n.name));
 g.frame=home.id;g.click(g.choices().find(n=>n.name==='ACTION / Plan').id);assert.equal(g.frame,plan.frameId);
 const pre=plan.week===1?'':'w'+plan.week+'/';
 for(const [k,v]of Object.entries(stats)){g.set('home/'+k.toLowerCase(),v);g.set(pre+(k==='Fitness'?'fitness':'weekStart'+k),v);}
 return g;
}
function select(g,activities) {
 for(const name of activities){const label={Noah:'Hang out with Noah',Cassy:'Hang out with Cassy',Group:'Group Work'}[name]||name;g.click(g.choices().find(n=>n.name==='ACTIVITY / '+label).id);}
}
for(const plan of wired.planners) {
 for(const flow of wired.flows) {
  const g=setup(plan);select(g,[flow.key,flow.key,flow.key]);g.click(plan.confirmId);
  assert.equal(g.get('special/type'),flow.code);assert(g.get('semester/gameOver'));assert.equal(g.frame,flow.frames[0].id);
  for(let i=0;i<3;i++){g.click(flow.frames[i].actionId);assert.equal(g.frame,flow.frames[i+1].id);}
  g.click(flow.frames[3].actionId);assert.equal(g.frame,D.start);assert(!g.get('semester/gameOver'));cases++;
 }
 const g=setup(plan);select(g,['Study','Rest','Gaming']);g.click(plan.confirmId);assert.equal(g.get('special/type'),0);assert(!g.get('semester/gameOver'));cases++;
 const incomplete=setup(plan);select(incomplete,['Study','Study']);incomplete.click(plan.confirmId);assert.equal(incomplete.frame,plan.frameId);cases++;
 // Compare actual plan execution against the intended base effects, including
 // the unchanged outings (their old stress action was shared with Rest).
 const effects={Study:[-14,12],Rest:[28,-3],Gaming:[-2,-24],Work:[-16,12],Exercise:[-8,-10]};
 if(plan.week>=5&&plan.week<=12)effects.Group=[-16,14];
 if(/Noah/i.test(plan.name))effects.Noah=[12,-10];
 if(plan.week>=3)effects.Cassy=[12,-10];
 for(const [activity,[energy,stress]]of Object.entries(effects)){
  const trial=setup(plan,{Energy:40,Stress:70,Fitness:0});
  select(trial,[activity,'Rest','Gaming']);trial.click(plan.confirmId);
  const pre=plan.week===1?'':'w'+plan.week+'/';
  assert.equal(trial.get(pre+'summaryEnergy'),40+energy+28-2,plan.name+' / '+activity+' Energy');
  assert.equal(trial.get(pre+'summaryStress'),70+stress-3-24,plan.name+' / '+activity+' Stress');
  cases++;
 }
 if(plan.week>=5&&plan.week<=12){
  const pre='w'+plan.week+'/';
  for(const [player,cassy,activities,total]of [
   [40,0,['Group','Group','Rest'],60],
   [40,30,['Group','Rest','Gaming'],80],
   [40,30,['Group','Group','Group'],100],
   [60,30,['Group','Rest','Gaming'],100],
   [65,30,['Group','Rest','Gaming'],100],
  ]){
   const trial=setup(plan,{}, {playerProgress:player,cassyProgress:cassy,totalProgress:player+cassy});
   assert.equal(trial.get(pre+'groupRemaining'),100-player-cassy,plan.name+' actual remaining progress');
   select(trial,activities);trial.click(plan.confirmId);
   assert.notEqual(trial.frame,plan.frameId);assert.equal(trial.get('group/totalProgress'),total);
   assert.equal(trial.get('group/playerProgress'),total-cassy);assert(!trial.get('semester/gameOver'));
   cases++;
  }
  for(const [player,cassy,activities]of [[70,30,['Group','Rest','Gaming']],[60,30,['Group','Group','Rest']]]){
   const trial=setup(plan,{}, {playerProgress:player,cassyProgress:cassy,totalProgress:player+cassy});
   select(trial,activities);trial.click(plan.confirmId);
   assert.equal(trial.frame,plan.frameId);assert(!trial.get(pre+'groupPlanValid'));
   assert.equal(trial.get('group/totalProgress'),player+cassy);assert.equal(trial.get('home/energy'),100);
   cases++;
  }
  for(const closed of ['w5/assignmentReleased','semester/reportSubmitted']){
   const trial=setup(plan);trial.set(closed,closed==='semester/reportSubmitted');
   select(trial,['Group','Rest','Gaming']);trial.click(plan.confirmId);
   assert.equal(trial.frame,plan.frameId);assert.equal(trial.get(pre+'groupRemaining'),0);
   assert.equal(trial.get('group/playerProgress'),0);cases++;
  }
  // Existing saved plans keep their slots; only obsolete capacity/help is refreshed.
  const old=setup(plan,{}, {playerProgress:40,cassyProgress:30,totalProgress:70});
  select(old,['Work','Rest','Group']);
  old.set(pre+'groupRemaining',0);old.set(pre+'groupPlanValid',false);
  old.set(pre+'groupPlanHint','Report 70% · Available +0% · Selected +10%');
  old.set(pre+'planHelp','Only 0% useful Group Work remains. Replace an extra Group Work slot.');
  const restored=new E(D);restored.restore(old.snapshot());
  assert.equal(restored.get(pre+'groupRemaining'),30);assert(restored.get(pre+'groupPlanValid'));
  assert.equal(restored.get(pre+'groupPlanHint'),'Report 70% · Available +30% · Selected +10%');
  assert(!restored.get(pre+'planHelp').startsWith('Only'));assert.equal(restored.get(pre+'slot3Code'),8);
  restored.click(plan.confirmId);assert.equal(restored.get('group/totalProgress'),80);cases++;
 }
}
const plan=wired.planners.find(p=>p.week===9&&!/Noah/.test(p.name));
// Teammates may hand in work after the player has already filled the report.
// Keep their story event, cap the total, and show only the real progress gained.
for(const [week,button,person,amount]of [[8,'282:2867','cassy',30],[11,'282:3849','alex',10]]){
 for(const total of [90,100]){
  const g=new E(D);g.click('71:26');g.set('home/week',week);
  g.set('group/playerProgress',total);g.set('group/totalProgress',total);
  g.set('w'+week+'/settlementApplied',true);g.set('semester/tutorChoice',2);g.set('w10/alexFollowupChoice',1);
  let frame=button;while(g.parents.has(frame))frame=g.parents.get(frame);g.frame=frame;
  g.click(button);assert.equal(g.get('group/totalProgress'),100);
  assert.equal(g.get('group/'+person+'Progress'),amount);
  assert.equal(g.get('feedback/deltaGroup'),100-total);
  assert.equal(g.get('storyDelta/'+person+'File'),total===100?'No status change.':'Group report +10%');cases++;
 }
}
for(const [activity,seed,failure]of [['Study',{Energy:40},3],['Study',{Stress:80},4],['Rest',{Money:11},5]]) {
 const g=setup(plan,seed);select(g,[activity,activity,activity]);g.click(plan.confirmId);assert.equal(g.get('semester/failure'),failure);assert.equal(g.get('special/type'),0);cases++;
}
for(const [K,energy,stress,score,pass]of [[65,80,10,100,true],[60,60,25,88,true],[54,80,10,84,false]]){
 const g=new E(D);g.click('71:26');
 const seed={'home/week':10,'home/knowledge':K,'home/energy':energy,'home/stress':stress,'home/money':100,'w10/summaryKnowledge':K,'w10/summaryEnergy':energy,'w10/summaryStress':stress,'w10/summaryMoney':100,'w10/summaryFitness':0,'w10/settlementApplied':true,'w10/eventComplete':false,'semester/midtermTaken':false};
 for(const [k,v]of Object.entries(seed))g.set(k,v);
 g.click('282:3392');assert.equal(g.get('grades/midScore'),score);g.click('282:3422');assert.equal(g.get('grades/midOutcome'),pass?'PASS':'FAIL');assert.equal(g.get('target/midResult'),`Score: ${score} / 100 · ${pass?'PASS':'FAIL'}`);cases++;
}
// Food uses one order per week, a real resource deduction, and the same return scene.
{
 const g=new E(D);g.click('71:26');g.set('home/week',1);g.set('home/money',100);g.set('home/energy',60);g.set('home/stress',30);
 g.frame=D.frames.find(n=>/^W1 \/.*Dorm Home/.test(n.name)).id;
 const home=g.frame;g.click(g.choices().find(n=>n.name==='ACTION / Takeaway').id);
 const buy=g.choices().find(n=>/Buy hot meal/.test(n.name));g.click(buy.id);assert.equal(g.get('home/money'),88);
 g.click(buy.id);assert.equal(g.get('home/money'),88);assert(g.get('food/bought'));
 g.click(g.choices().find(n=>/Close Takeaway/.test(n.name)).id);assert.equal(g.frame,home);cases++;
}
console.log(JSON.stringify({passed:true,cases,tripleEndingCases:130,includes:['all weekly plan variants','resource failure priority','midterm score and Target','takeaway purchase guard']}));
