// Shared-data balance patch. No story choices, survival gates or scoring rules change.
const fs=require('node:fs');
const path=require('node:path');
const CONFIG={
  Study:{energy:-14,stress:12},Rest:{energy:28,stress:-3},
  Gaming:{energy:-2,stress:-24},Work:{energy:-16,stress:12},
  Exercise:{energy:-8,stress:-10},Group:{energy:-16,stress:14}
};
const CODES={1:'Study',2:'Rest',3:'Gaming',4:'Work',5:'Exercise',8:'Group'};
const DESCRIPTIONS={
  'Knowledge ↑\nStress ↑ · Energy ↓':'Knowledge +8\nStress +12 · Energy −14',
  'Knowledge +8\nStress +10 · Energy −18':'Knowledge +8\nStress +12 · Energy −14',
  'Energy ↑ · Stress ↓':'Energy +28 · Stress −3',
  'Energy +20 · Stress −10':'Energy +28 · Stress −3',
  'Stress ↓\nEnergy ↓':'Stress −24\nEnergy −2',
  'Stress ↓ · Energy ↓':'Stress −24 · Energy −2',
  'Stress ↓ ':'Stress −24 · Energy −2',
  'Stress −22\nEnergy −4':'Stress −24\nEnergy −2',
  'Stress −22 · Energy −4':'Stress −24 · Energy −2',
  'Money ↑\nStress ↑ · Energy ↓':'AU$ +45\nStress +12 · Energy −16',
  'AU$ +45\nStress +8 · Energy −20':'AU$ +45\nStress +12 · Energy −16',
  'Fitness +10 · Stress ↓\nEnergy ↓':'Fitness +10 · Stress −10\nEnergy −8',
  'Fitness ↑ ':'Fitness +10 · Stress −10\nEnergy −8',
  'Fitness +10 · Stress −8\nEnergy −8':'Fitness +10 · Stress −10\nEnergy −8',
  'Group Report progress ↑\nStress ↑ · Energy ↓':'Group report +10%\nEnergy −16 · Stress +14',
  'Group report +10%\nEnergy −22 · Stress +12':'Group report +10%\nEnergy −16 · Stress +14',
  'Energy recovery and Stress relief scale with Fitness.':'Base values shown. Fitness boosts Energy recovery and Stress relief.',
  '+20 → +26':'+28 → +36.4',
  '−10 → −13':'−3 → −3.9'
};
function rebalance(data,config=CONFIG){
  const names=Object.fromEntries(Object.entries(data.variables).map(([id,v])=>[id,v.name]));
  const copies=new Map(),counts={};
  function activity(e){
    if(!e||e[0]!=='e')return null;
    if(e[1]==='EQUALS'&&e[2][0][0]==='v'&&/(^|\/)slot[123]Code$/.test(names[e[2][0][1]])&&e[2][1][0]==='l')return CODES[e[2][1][1]]||null;
    for(const child of e[2]){const found=activity(child);if(found)return found;}
    return null;
  }
  // Clone shared effect actions before replacing their references: Rest and outings
  // originally share a stress action, but now need different recovery amounts.
  for(const action of [...data.actionPool])if(action[0]==='c')for(const [condition,ids] of action[1]){
    const kind=activity(condition);if(!kind)continue;
    for(let i=0;i<ids.length;i++){
      const old=data.actionPool[ids[i]];if(old[0]!=='s')continue;
      const stat=names[old[1]].match(/(?:^|\/)(energy|stress)Change$/)?.[1];
      const expression=old[2];
      if(!stat||expression[0]!=='e'||expression[1]!=='ADDITION'||expression[2][0][0]!=='v'||expression[2][0][1]!==old[1])continue;
      const effect=expression[2][1],key=kind+':'+ids[i];
      if(!copies.has(key)){
        const copy=structuredClone(old),replacement=copy[2][2][1];
        if(effect[0]==='l')replacement[1]=config[kind][stat];
        else if(effect[0]==='e'&&effect[1]==='MULTIPLICATION'&&effect[2][0][0]==='l')replacement[2][0][1]=config[kind][stat];
        else throw Error('Unexpected activity effect '+key);
        copies.set(key,data.actionPool.length);data.actionPool.push(copy);
      }
      ids[i]=copies.get(key);counts[kind]=(counts[kind]||0)+1;
    }
  }
  const update=value=>typeof value==='string'?(DESCRIPTIONS[value]??value):value;
  for(const node of Object.values(data.nodes))if(node.text!==undefined)node.text=update(node.text);
  for(const variable of Object.values(data.variables))variable.value=update(variable.value);
  function updateLiterals(expression){
    if(expression?.[0]==='l')expression[1]=update(expression[1]);
    else if(expression?.[0]==='e')expression[2].forEach(updateLiterals);
  }
  for(const action of data.actionPool)if(action[0]==='s')updateLiterals(action[2]);
  data.balance={version:2,activities:config,descriptions:DESCRIPTIONS};
  return counts;
}
module.exports={rebalance,CONFIG};
if(require.main===module){
  const target=path.join(__dirname,'../data/game.json'),data=JSON.parse(fs.readFileSync(target));
  if(data.balance?.version===2)throw Error('Balance version 2 is already installed.');
  console.log(rebalance(data));
  if(process.argv.includes('--write')){
    fs.writeFileSync(target,JSON.stringify(data));
    fs.writeFileSync(path.join(__dirname,'../game-data.js'),'window.SURVIVE_DATA='+JSON.stringify(data)+';\n');
  }
}
