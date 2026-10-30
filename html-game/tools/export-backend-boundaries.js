// Capture accepted controls from the existing independent boundary suite.
const fs=require('node:fs'),zlib=require('node:zlib');
const Engine=require('../engine.js'),D=require('../data/game.json');
const required=['player/isMale','home/week','home/knowledge','home/energy','home/stress','home/money','wheel/prizeIndex'];
const requiredIds=new Set(Object.entries(D.variables).filter(([id,v])=>required.includes(v.name)).map(([id])=>id));
const compact=g=>({...g.snapshot(),values:Object.fromEntries(Object.entries(g.values).filter(([id,v])=>requiredIds.has(id)||JSON.stringify(v)!==JSON.stringify(D.variables[id].value)))});
const original=Engine.prototype.click,fixtures=[];
Engine.prototype.click=function(id){
 const allowed=this.choices().some(n=>n.id===id),before=allowed?compact(this):null;
 const result=original.call(this,id);
 if(allowed)fixtures.push({before,id,after:compact(this)});
 return result;
};
require('./test-boundaries.js');
fs.writeFileSync(process.argv[2],zlib.gzipSync(JSON.stringify(fixtures)));
console.log('Captured '+fixtures.length+' valid boundary transitions.');
