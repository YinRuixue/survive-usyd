/* Audio lifecycle checks do not require a speaker, network or browser. */
const assert=require('node:assert/strict');
const Sound=require('../audio.js');
class Track{
  constructor(src){this.src=src;this.paused=true;this.plays=0;this.currentTime=0;}
  addEventListener(){}
  play(){this.paused=false;this.plays++;return Promise.resolve();}
  pause(){this.paused=true;}
}
let hidden=false;
const memory=new Map(),storage=()=>({getItem:k=>memory.get(k),setItem:(k,v)=>memory.set(k,v)});
const options={makeAudio:src=>new Track(src),storage,hidden:()=>hidden};
const settle=()=>new Promise(resolve=>setImmediate(resolve));
(async()=>{
  const audio=new Sound(options);
  assert.equal(audio.music.plays,0,'No autoplay before a user gesture');
  audio.click();await settle();
  assert.equal(audio.music.plays,1);assert.equal(audio.music.loop,true);
  assert.equal(audio.clicks[0].plays,1);
  audio.click();await settle();assert.equal(audio.music.plays,1,'Scene clicks must not restart the loop');
  audio.music.currentTime=17;
  hidden=true;audio.sync();assert(audio.music.paused);
  audio.click();assert.equal(audio.music.plays,1,'Hidden pages must stay silent');
  hidden=false;audio.sync();await settle();
  assert(!audio.music.paused);assert.equal(audio.music.currentTime,17);
  audio.set('musicEnabled',false);assert(audio.music.paused);
  audio.set('soundEnabled',false);const clicks=audio.clicks.reduce((n,s)=>n+s.plays,0);
  audio.click();assert.equal(audio.clicks.reduce((n,s)=>n+s.plays,0),clicks);
  const reloaded=new Sound(options);
  assert.equal(reloaded.settings.musicEnabled,false);assert.equal(reloaded.settings.soundEnabled,false);
  reloaded.unlock();assert.equal(reloaded.music.plays,0,'Muted preference survives reload');
  audio.set('musicVolume',0);audio.set('musicEnabled',true);assert(audio.music.paused);
  audio.set('musicVolume',.3);await settle();assert(!audio.music.paused);
  assert.equal(audio.music.volume,.3);
  audio.set('musicVolume',NaN);assert.equal(audio.settings.musicVolume,.3);
  audio.set('musicVolume',5);assert.equal(audio.settings.musicVolume,1);
  const failing=new Sound({...options,storage:()=>{throw Error('Storage unavailable');}});
  failing.music.play=()=>Promise.reject(Object.assign(Error('Autoplay blocked'),{name:'NotAllowedError'}));
  failing.click();await settle();assert.match(failing.error,/Click a button/);
  failing.set('musicEnabled',false);assert(failing.music.paused);
  let complete;
  const pending=new Sound({...options,storage:()=>({getItem:()=>null,setItem(){}})});
  pending.music.play=()=>{pending.music.paused=false;return new Promise(resolve=>{complete=resolve;});};
  pending.unlock();pending.set('musicEnabled',false);complete();await settle();
  assert(pending.music.paused,'Muting during a pending play must stay muted');
  console.log('PASS: gesture start, loop continuity, background pause/resume, independent mute, volumes, persistence, blocked storage/autoplay, pending-play mute');
})().catch(error=>{console.error(error);process.exitCode=1;});
