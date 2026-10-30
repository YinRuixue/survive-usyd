/* Same-origin client: Python owns rules and durable state; this cache renders save slots. */
(function(root){
  'use strict';
  class SurviveBackendClient {
    constructor(engine){this.engine=engine;this.revision=0;this.slots=Array(9).fill(null);this.autosave=null;this.busy=false;this.remote=true;}
    async fetchJSON(path,body){
      const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),15000);
      try{
        const response=await fetch(path,{method:body?'POST':'GET',credentials:'same-origin',cache:'no-store',signal:controller.signal,
          headers:body?{'Content-Type':'application/json'}:{},body:body?JSON.stringify(body):undefined});
        const result=await response.json();
        if(!response.ok){const error=new Error(result.error||'The game could not be saved. Please try again.');error.httpStatus=response.status;throw error;}
        return result;
      }finally{clearTimeout(timeout);}
    }
    accept(result){
      if(result.revision!==undefined)this.revision=result.revision;
      if(result.slots)this.slots=result.slots;
      if('autosave' in result)this.autosave=result.autosave;
      return result;
    }
    async init(){return this.accept(await this.fetchJSON('/api/session'));}
    async refresh(){this.accept(await this.fetchJSON('/api/saves'));}
    async mutate(operation,body={}){
      if(this.busy)throw Error('Please wait for the current save to finish.');
      this.busy=true;
      const request={...body,revision:this.revision,requestId:crypto.randomUUID()};
      try{
        let result;
        try{result=await this.fetchJSON('/api/'+operation,request);}
        catch(error){
          if(error.httpStatus)throw error;
          // Retry with the same receipt ID: a lost response must never apply effects twice.
          result=await this.fetchJSON('/api/'+operation,request);
        }
        return this.accept(result);
      }catch(error){
        if(!error.httpStatus)throw Error('Cannot reach the game server. Keep the launcher open, then try again.');
        throw error;
      }finally{this.busy=false;}
    }
    async action(id,playerName){return (await this.mutate('action',{action:id,playerName})).state;}
    async reset(){return (await this.mutate('new-game')).state;}
    list(){return this.slots;}
    usable(saved){try{return this.engine.validateSnapshot(saved)&&saved.frame!==this.engine.data.start;}catch{return false;}}
    read(index){return structuredClone(this.slots[index]);}
    readAuto(){return this.autosave;}
    async write(index){await this.mutate('save',{slot:index});return this.read(index);}
    async load(index){return (await this.mutate('load',{slot:index})).state;}
    writeAuto(){} // Every accepted Python action already commits the autosave atomically.
    clearAuto(){}
    async importBackup(backup){return (await this.mutate('import',{backup})).message;}
    exportBackup(){return {version:1,slots:structuredClone(this.slots),autosave:structuredClone(this.autosave)};}
  }
  root.SurviveBackendClient=SurviveBackendClient;
})(window);
