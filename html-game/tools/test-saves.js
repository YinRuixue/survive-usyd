const assert=require('node:assert/strict');
const Engine=require('../engine.js'),SaveStore=require('../save-store.js'),data=require('../data/game.json');
class MemoryStorage {
  constructor(){this.values=new Map();this.blockWrites=false;}
  getItem(key){return this.values.get(key)??null;}
  setItem(key,value){if(this.blockWrites)throw Error('QuotaExceededError');this.values.set(key,value);}
  removeItem(key){this.values.delete(key);}
}
const storage=new MemoryStorage(),game=new Engine(data),store=new SaveStore(()=>storage,game);
let checks=0;
const test=(name,run)=>{run();checks++;console.log('PASS '+name);};
game.click('71:26');game.playerName='Lumi';
test('Exactly nine initially empty manual slots',()=>assert.deepEqual(store.list(),Array(9).fill(null)));
test('Snapshot is detached from the running game',()=>{
 const saved=game.snapshot(),energy=saved.values[game.byName.get('home/energy')];game.set('home/energy',energy-1);assert.equal(saved.values[game.byName.get('home/energy')],energy);
});
const snapshots=[];
test('All nine slots persist independent game states',()=>{
 for(let i=0;i<9;i++){
  game.playerName='Player '+(i+1);game.set('home/week',i+1);game.set('home/knowledge',20+i);game.set('player/isMale',i%2===1);game.set('contactExchanged',i%2===0);
  snapshots.push(game.snapshot());store.write(i,snapshots[i]);
 }
 const reloaded=new SaveStore(()=>storage,new Engine(data));
 for(let i=0;i<9;i++)assert.deepEqual(reloaded.read(i),snapshots[i]);
});
test('Loading restores frame, name, gender, stats and every branch variable',()=>{
 for(let i=0;i<9;i++){
  game.restore(store.read(i));assert.equal(game.frame,snapshots[i].frame);assert.equal(game.playerName,snapshots[i].playerName);assert.deepEqual(game.values,snapshots[i].values);
 }
});
test('Saving an open in-game panel preserves its return scene',()=>{
 const panel=structuredClone(snapshots[0]);panel.frame='3:694';panel.overlays=['166:824'];
 game.restore(panel);const copy=game.snapshot();game.reset();game.restore(copy);
 assert.equal(game.frame,'3:694');assert.deepEqual(game.overlays,['166:824']);game.restore(snapshots[8]);
});
test('Overwriting a slot changes only that slot',()=>{
 game.playerName='Replacement';store.write(4,game.snapshot());
 assert.equal(store.read(4).playerName,'Replacement');for(const i of [0,1,2,3,5,6,7,8])assert.deepEqual(store.read(i),snapshots[i]);
});
test('Automatic saves never overwrite manual slots',()=>{
 const before=JSON.stringify(store.list());store.writeAuto(game.snapshot());assert.equal(store.readAuto().playerName,'Replacement');assert.equal(JSON.stringify(store.list()),before);
});
test('New game and clearing autosave retain all manual slots',()=>{
 const before=JSON.stringify(store.list());game.reset();store.clearAuto();assert.equal(store.readAuto(),null);assert.equal(JSON.stringify(store.list()),before);
});
test('Earlier single-save format is still loadable',()=>{
 storage.setItem(SaveStore.AUTO_KEY,JSON.stringify(snapshots[0]));assert.deepEqual(store.readAuto(),snapshots[0]);game.restore(store.readAuto());
});
test('Failed writes preserve existing slots',()=>{
 const before=storage.getItem(SaveStore.SLOT_KEY);storage.blockWrites=true;assert.throws(()=>store.write(0,snapshots[1]));assert.equal(storage.getItem(SaveStore.SLOT_KEY),before);storage.blockWrites=false;
});
test('Invalid save cannot change current game state',()=>{
 const before=structuredClone(game.values),frame=game.frame;
 const bad=structuredClone(snapshots[0]);bad.values[game.byName.get('home/energy')]='broken';
 assert.throws(()=>game.restore(bad));assert.equal(game.frame,frame);assert.deepEqual(game.values,before);
 for(const change of [{source:'different-game'},{frame:'missing'},{values:{}},{overlays:['missing']}])assert.throws(()=>game.restore({...snapshots[0],...change}));
});
test('Unreadable slot data is preserved instead of silently replaced',()=>{
 storage.setItem(SaveStore.SLOT_KEY,'broken record');assert.throws(()=>store.list());assert.throws(()=>store.write(0,snapshots[0]));assert.equal(storage.getItem(SaveStore.SLOT_KEY),'broken record');
});
test('Slot bounds are enforced',()=>{for(const i of [-1,9,1.5])assert.throws(()=>store.write(i,snapshots[0]));});
console.log(JSON.stringify({passed:true,checks,slots:9}));
