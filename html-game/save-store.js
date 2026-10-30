/* Nine independent manual slots; the existing automatic save stays separate. */
(function(root){
  'use strict';
  class SurviveSaveStore {
    static SLOT_COUNT=9;
    static SLOT_KEY='survive-usyd-slots-v1';
    static AUTO_KEY='survive-usyd-save-v1';
    constructor(storage,engine){this.storage=storage;this.engine=engine;}
    list(){
      const raw=this.storage().getItem(SurviveSaveStore.SLOT_KEY);
      if(!raw)return Array(9).fill(null);
      const record=JSON.parse(raw);
      if(record.version!==1||!Array.isArray(record.slots)||record.slots.length!==9)throw Error('The saved slots could not be read.');
      return record.slots;
    }
    usable(snapshot){try{return this.engine.validateSnapshot(snapshot)&&snapshot.frame!==this.engine.data.start;}catch{return false;}}
    read(index){
      this.checkIndex(index);const saved=this.list()[index];
      if(!this.usable(saved))throw Error('This slot cannot be loaded.');
      return structuredClone(saved);
    }
    write(index,snapshot){
      this.checkIndex(index);
      if(!this.usable(snapshot))throw Error('This scene cannot be saved.');
      const slots=this.list();slots[index]=structuredClone(snapshot);
      this.storage().setItem(SurviveSaveStore.SLOT_KEY,JSON.stringify({version:1,slots}));
      return structuredClone(slots[index]);
    }
    readAuto(){
      const raw=this.storage().getItem(SurviveSaveStore.AUTO_KEY);if(!raw)return null;
      try{const saved=JSON.parse(raw);return this.usable(saved)?saved:null;}catch{return null;}
    }
    writeAuto(snapshot){
      if(!this.usable(snapshot))throw Error('This scene cannot be saved.');
      this.storage().setItem(SurviveSaveStore.AUTO_KEY,JSON.stringify(snapshot));
    }
    clearAuto(){this.storage().removeItem(SurviveSaveStore.AUTO_KEY);}
    exportBackup(){return {version:1,slots:structuredClone(this.list()),autosave:this.readAuto()};}
    importBackup(backup){
      if(backup?.version!==1||!Array.isArray(backup.slots)||backup.slots.length!==9)throw Error('Choose a Survive USYD save backup.');
      for(const saved of [...backup.slots,backup.autosave])if(saved!=null&&!this.usable(saved))throw Error('This backup contains an incompatible save.');
      const slots=this.list();let count=0;
      backup.slots.forEach((saved,index)=>{if(saved&&!slots[index]){slots[index]=saved;count++;}});
      this.storage().setItem(SurviveSaveStore.SLOT_KEY,JSON.stringify({version:1,slots}));
      if(backup.autosave&&!this.readAuto()){this.writeAuto(backup.autosave);count++;}
      return `Imported ${count} saves. Occupied slots were kept.`;
    }
    checkIndex(index){if(!Number.isInteger(index)||index<0||index>=9)throw RangeError('Choose a slot from 1 to 9.');}
  }
  root.SurviveSaveStore=SurviveSaveStore;
  if(typeof module!=='undefined')module.exports=SurviveSaveStore;
})(typeof window!=='undefined'?window:globalThis);
