const assert=require('node:assert/strict');
const format=require('../display-format.js');
const Engine=require('../engine.js');
const data=require('../data/game.json');

for(const [input,expected] of [
  ['Energy +5.75  ·  Stress −3.4499999999999997','Energy +5.8  ·  Stress −3.5'],
  ['Energy +11.5  ·  Stress −6.8999999999999995','Energy +11.5  ·  Stress −6.9'],
  ['AU$ 68 · Fitness 30 · WEEK 01 / 13','AU$ 68 · Fitness 30 · WEEK 01 / 13'],
  ['Energy 79.99999999999999 / 100 · Stress 0.30000000000000004','Energy 80 / 100 · Stress 0.3'],
  ['Knowledge +8.0000 · Group report 90.00%','Knowledge +8 · Group report 90%'],
  ['Score 97.65 / 100 · Weight 25%','Score 97.7 / 100 · Weight 25%'],
  ['Stress −0.00000001 · Energy -0.04 · Stress +0.04','Stress 0 · Energy 0 · Stress +0'],
  ['Stress −1.4210854715202004e-14 · Energy +1e-7','Stress 0 · Energy +0'],
  ['Energy +5.749 · Stress −3.44','Energy +5.7 · Stress −3.4'],
  [5.75,'5.8'],[100,'100']
])assert.equal(format(input),expected);

// Old saves may already contain long decimals inside prebuilt display strings.
// Formatting every scene's text must not change any saved value or rule result.
const game=new Engine(data);
for(const [id,variable] of Object.entries(data.variables)){
  if(variable.type==='FLOAT')game.values[id]=5.75;
  if(variable.type==='STRING')game.values[id]='Energy +5.75 · Stress −3.4499999999999997';
}
const before=structuredClone(game.values);
let checked=0;
for(const node of Object.values(data.nodes))if(node.type==='TEXT'){
  const displayed=format(game.value(node.bind?.characters,node.text??''));
  assert(!/\d+\.\d{2,}/.test(displayed),node.name+': '+displayed);
  checked++;
}
assert.deepEqual(game.values,before);
console.log(`Display formatting passed: rounding cases and ${checked} text nodes; original values preserved.`);
