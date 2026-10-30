/* Remove the old personal/week caps. The report's actual total is the limit. */
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const data=JSON.parse(fs.readFileSync(path.join(root,'data/game.json'),'utf8'));
if(data.groupPlanning)throw Error('Group progress rules have already been updated.');
const ids=Object.fromEntries(Object.entries(data.variables).map(([id,v])=>[v.name,id]));
const names=Object.fromEntries(Object.entries(ids).map(([name,id])=>[id,name]));
const lit=value=>['l',value],v=name=>['v',ids[name]],op=(name,a,b)=>['e',name,b===undefined?[a]:[a,b]];
const remaining=op('SUBTRACTION',lit(100),v('group/totalProgress'));
const personalLimit=op('SUBTRACTION',op('SUBTRACTION',lit(100),v('group/cassyProgress')),v('group/alexProgress'));
const unavailable=op('OR',op('NOT',v('w5/assignmentReleased')),v('semester/reportSubmitted'));
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const stats={capacity:0,clamps:0,conditions:0,validation:0};
function updateText(text){
 return text.replace('Group Work adds 10%. From Week 11, you can cover missing work.',
  'From Week 5, Group Work adds up to 10% until the report reaches 100%.')
  .replace('Group Work can now cover missing sections. Each activity adds 10%.',
  'Keep working on the report. Each activity adds up to 10%, to a total of 100%.')
  .replace(/Available \+(40|70)%/g,'Available +100%')
  .replace('% useful Group Work remains. Replace an extra Group Work slot.',
  '% remains before 100%. Replace an extra Group Work slot.');
}
function rewrite(x,week){
 if(!Array.isArray(x))return typeof x==='string'?updateText(x):x;
 if(x[0]==='e'&&x[1]==='GREATER_THAN'&&same(x[2][0],v('group/playerProgress'))&&[40,70].includes(x[2][1]?.[1])){
  stats.conditions++;
  return ids[week+'/groupPlanned']
   ?op('AND',op('GREATER_THAN',v(week+'/groupPlanned'),lit(0)),op('GREATER_THAN',v('group/playerProgress'),personalLimit))
   :lit(false); // Week 13 has no Group Work and must not reduce earlier contributions.
 }
 if(x[0]==='e'&&x[1]==='LESS_THAN'&&names[x[2][0]?.[1]]?.endsWith('/groupRemaining')&&same(x[2][1],lit(0))){
  return op('OR',x,unavailable);
 }
 return x.map(y=>rewrite(y,week));
}
data.actionPool=data.actionPool.map(a=>{
 const week=JSON.stringify(a).match(/VariableID:[^" ]+/g)?.map(id=>names[id]).find(n=>/^w\d+\//.test(n||''))?.split('/')[0];
 const name=names[a[1]]||'';
 if(a[0]==='s'&&name.endsWith('/groupRemaining')){
  if(same(a[2],lit(40))||same(a[2],lit(70)))a[2]=lit(100);
  else if(a[2][0]==='e'&&same(a[2][2]?.[1],v('group/playerProgress'))){a[2]=remaining;stats.capacity++;}
 }
 if(a[0]==='s'&&name==='group/playerProgress'&&[40,70].includes(a[2]?.[1])){
  a[2]=personalLimit;stats.clamps++;
 }
 if(a[0]==='s'&&name.endsWith('/groupPlanValid')){
  const prefix=name.split('/')[0];
  // A final partial slot is useful, but no slot may start at a full report.
  a[2]=op('OR',op('EQUALS',v(prefix+'/groupPlanned'),lit(0)),
   op('LESS_THAN',op('SUBTRACTION',v(prefix+'/groupPlanned'),lit(10)),v(prefix+'/groupRemaining')));
  stats.validation++;
 }
 return rewrite(a,week);
});
for(const n of Object.values(data.nodes))if(typeof n.text==='string')n.text=updateText(n.text);
for(const x of Object.values(data.variables)){
 if(typeof x.value==='string')x.value=updateText(x.value);
 if(x.name.endsWith('/groupRemaining'))x.value=100;
}
// Reuse declarative actions to refresh cached planner fields in older saves.
data.groupPlanning={};
const add=a=>(data.actionPool.push(a),data.actionPool.length-1);
const set=(name,e)=>add(['s',ids[name],e]);
for(let week=5;week<=12;week++){
 const pre='w'+week,remainingName=pre+'/groupRemaining',planned=pre+'/groupPlanned';
 const actions=[set(remainingName,remaining)];
 actions.push(add(['c',[[op('OR',op('LESS_THAN',v(remainingName),lit(0)),unavailable),[set(remainingName,lit(0))]]]]));
 actions.push(set(planned,lit(0)));
 for(let slot=1;slot<=3;slot++)actions.push(add(['c',[[op('EQUALS',v(pre+'/slot'+slot+'Code'),lit(8)),[set(planned,op('ADDITION',v(planned),lit(10)))]]]]));
 actions.push(set(pre+'/groupPlanValid',op('OR',op('EQUALS',v(planned),lit(0)),op('LESS_THAN',op('SUBTRACTION',v(planned),lit(10)),v(remainingName)))));
 let hint=lit('Report ');
 for(const part of [v('group/totalProgress'),lit('% · Available +'),v(remainingName),lit('% · Selected +'),v(planned),lit('%')])hint=op('ADDITION',hint,part);
 actions.push(set(pre+'/groupPlanHint',hint));
 const invalid=set(pre+'/planHelp',op('ADDITION',op('ADDITION',lit('Only '),v(remainingName)),lit('% remains before 100%. Replace an extra Group Work slot.')));
 const normal=set(pre+'/planHelp',lit(data.variables[ids[pre+'/planHelp']].value));
 data.groupPlanning[week]={frames:data.frames.filter(f=>f.name.startsWith('W'+week+' /')&&f.name.includes('Weekly Plan')).map(f=>f.id),refresh:actions,invalid:[invalid],normal:[normal]};
}
if(stats.capacity<30||stats.clamps!==7||stats.conditions!==9)throw Error('Unexpected rule layout: '+JSON.stringify(stats));
fs.writeFileSync(path.join(root,'data/game.json'),JSON.stringify(data));
fs.writeFileSync(path.join(root,'game-data.js'),'window.SURVIVE_DATA='+JSON.stringify(data)+';\n');
console.log(stats);
