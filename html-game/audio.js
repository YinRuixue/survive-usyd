/* Local audio only. Preferences belong to this browser, not to a game save. */
(function(root){
  'use strict';
  class SurviveAudio {
    static KEY='survive-usyd-audio-v1';
    constructor({makeAudio=src=>new Audio(src),storage=()=>localStorage,hidden=()=>document.hidden,onChange=()=>{}}={}){
      this.storage=storage;this.hidden=hidden;this.onChange=onChange;
      this.settings={musicEnabled:true,soundEnabled:true,musicVolume:.28,soundVolume:.45};
      try{
        const saved=JSON.parse(storage().getItem(SurviveAudio.KEY)||'null');
        for(const key of ['musicEnabled','soundEnabled'])if(typeof saved?.[key]==='boolean')this.settings[key]=saved[key];
        for(const key of ['musicVolume','soundVolume'])if(typeof saved?.[key]==='number'&&Number.isFinite(saved[key]))this.settings[key]=Math.max(0,Math.min(1,saved[key]));
      }catch{} // Audio remains usable when browser storage is unavailable.
      this.unlocked=false;this.pending=null;this.error='';this.nextClick=0;
      this.music=makeAudio('assets/audio/campus-afternoon.wav');
      this.music.loop=true;this.music.preload='none';this.music.volume=this.settings.musicVolume;
      this.clicks=Array.from({length:4},()=>{
        const sound=makeAudio('assets/audio/button-click.wav');sound.preload='auto';return sound;
      });
      this.music.addEventListener('error',()=>{this.error='Music could not load. Check that the assets folder is beside the game.';this.onChange();});
    }
    shouldPlay(){return this.unlocked&&!this.hidden()&&this.settings.musicEnabled&&this.settings.musicVolume>0;}
    unlock(){this.unlocked=true;this.sync();}
    sync(){
      this.music.volume=this.settings.musicVolume;
      if(!this.shouldPlay()){
        this.music.pause();
      }else if(this.music.paused&&!this.pending){
        // Call play synchronously inside the user gesture to satisfy autoplay rules.
        try{
          const playback=this.music.play();
          this.pending=Promise.resolve(playback).then(()=>{
            this.error='';if(!this.shouldPlay())this.music.pause();
          }).catch(error=>{
            if(error?.name==='NotAllowedError')this.error='Click a button to start the music.';
            else if(error?.name!=='AbortError')this.error='Music is unavailable. You can keep playing.';
          }).finally(()=>{this.pending=null;this.onChange();});
        }catch{this.error='Music is unavailable. You can keep playing.';}
      }
      if(this.hidden()||!this.settings.soundEnabled||!this.settings.soundVolume)this.clicks.forEach(sound=>sound.pause());
      this.onChange();
    }
    set(key,value){
      if(!Object.hasOwn(this.settings,key))return;
      if(key.endsWith('Enabled')){if(typeof value!=='boolean')return;}
      else{if(typeof value!=='number'||!Number.isFinite(value))return;value=Math.max(0,Math.min(1,value));}
      this.settings[key]=value;
      try{this.storage().setItem(SurviveAudio.KEY,JSON.stringify(this.settings));}catch{}
      this.sync();
    }
    click(){
      if(this.hidden())return;
      this.unlock();
      if(!this.settings.soundEnabled||this.settings.soundVolume<=0)return;
      const sound=this.clicks[this.nextClick++%this.clicks.length];
      sound.volume=this.settings.soundVolume;
      try{sound.currentTime=0;Promise.resolve(sound.play()).catch(()=>{});}catch{}
    }
  }
  root.SurviveAudio=SurviveAudio;
  if(typeof module!=='undefined')module.exports=SurviveAudio;
})(typeof window!=='undefined'?window:globalThis);
