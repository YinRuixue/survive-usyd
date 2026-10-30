(function(root){
  'use strict';
  const element=(tag,cls,text)=>{const el=document.createElement(tag);if(cls)el.className=cls;if(text!==undefined)el.textContent=text;return el;};
  class SurviveSaveMenu {
    constructor({stage,game,store,onLoad}) {
      Object.assign(this,{stage,game,store,onLoad});this.isOpen=false;this.pending=null;this.busy=false;
      this.keyHandler=event=>{
        if(!this.isOpen)return;
        if(event.key==='Escape'){event.preventDefault();event.stopImmediatePropagation();if(this.busy)return;if(this.pending){this.pending=null;this.draw();}else this.close();}
        if(event.key==='Tab') {
          const scope=this.layer.querySelector('.slot-confirm')||this.layer;
          const buttons=[...scope.querySelectorAll('button:not(:disabled)')];
          const first=buttons[0],last=buttons.at(-1);
          if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}
          else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}
        }
      };
      document.addEventListener('keydown',this.keyHandler,true);
    }
    open(mode) {
      if(this.isOpen)return;
      this.mode=mode;this.isOpen=true;this.pending=null;this.notice='';this.opener=document.activeElement;
      for(const scene of this.stage.querySelectorAll('.scene')){scene.dataset.saveInert=String(scene.inert);scene.inert=true;}
      document.querySelector('#controls').inert=true;this.draw();
      if(this.store.refresh)this.refresh();
    }
    async refresh(){
      this.busy=true;this.draw();
      try{await this.store.refresh();}catch(error){this.notice=error.message;}
      finally{this.busy=false;if(this.isOpen)this.draw();}
    }
    close(restoreFocus=true) {
      if(!this.isOpen||this.busy)return;
      this.isOpen=false;this.pending=null;this.layer?.remove();
      for(const scene of this.stage.querySelectorAll('.scene')){scene.inert=scene.dataset.saveInert==='true';delete scene.dataset.saveInert;}
      document.querySelector('#controls').inert=false;
      if(restoreFocus&&this.opener?.isConnected)this.opener.focus({preventScroll:true});
    }
    button(label,cls,handler){const b=element('button',cls,label);b.type='button';b.addEventListener('click',handler);return b;}
    details(saved) {
      const get=name=>saved.values[this.game.byName.get(name)];
      const scene=this.game.data.nodes[saved.frame]?.name||'';
      const chapter=/^ENDING/.test(scene)?'ENDING':/^(FINALS|FINAL)/.test(scene)?'FINALS':get('home/week')===0||/^W0\b/.test(scene)?'O-WEEK':`WEEK ${get('home/week')} / 13`;
      const name=String(saved.playerName||'ME');const character=get('player/isMale')?'Male / Chloe':'Female / Noah';
      const date=Number.isFinite(saved.savedAt)?new Intl.DateTimeFormat(undefined,{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'}).format(saved.savedAt):'Earlier save';
      const location=scene.replace(/^(W\d+|FINALS|ENDING)\s*\/\s*/i,'').replace(/^\d+[A-Z-]*\s*[·/]\s*/i,'').replace(/\s*\/\s*(Noah unlocked|Solo|Romance|No romance).*$/i,'');
      return {name,character,chapter,date,location};
    }
    draw(focusIndex) {
      this.layer?.remove();
      const layer=element('div','save-layer');this.layer=layer;
      layer.setAttribute('role','dialog');layer.setAttribute('aria-modal','true');layer.setAttribute('aria-labelledby','save-heading');
      layer.addEventListener('click',event=>{if(event.target===layer)this.close();});
      const panel=element('section','save-panel');layer.append(panel);
      const header=element('header','save-header'),heading=element('h1',null,this.mode==='save'?'SAVE GAME':'LOAD GAME');heading.id='save-heading';
      const close=this.button('× CLOSE','save-close',()=>this.close());close.setAttribute('aria-label','Close '+(this.mode==='save'?'save':'load')+' menu');header.append(heading,close);panel.append(header);
      panel.append(element('p','save-intro',this.mode==='save'?'Choose a slot to keep this moment.':'Choose a saved game to continue.'));
      const grid=element('div','save-grid');panel.append(grid);
      let slots=Array(9).fill(null),failed=false;
      try{slots=this.store.list();}catch{failed=true;this.notice='Saved slots are unavailable. Your existing saves have not been changed.';}
      slots.forEach((saved,index)=>{
        const usable=this.store.usable(saved),number=String(index+1).padStart(2,'0');
        const card=this.button('',`save-slot ${saved?'occupied':'empty'}`,()=>this.choose(index,saved));
        card.dataset.slot=index;card.setAttribute('aria-label',`${this.mode==='save'?'Save to':'Load'} slot ${number}${usable?' · '+this.details(saved).name+' · '+this.details(saved).chapter:saved?' · Unavailable':' · Empty'}`);
        card.disabled=this.busy||failed||this.mode==='load'&&!usable;
        const top=element('span','slot-top');top.append(element('span','slot-number','SLOT '+number),element('span','slot-chapter',usable?this.details(saved).chapter:''));card.append(top);
        if(usable){const info=this.details(saved);card.append(element('strong','slot-name',info.name),element('span','slot-character',info.character),element('span','slot-location',info.location),element('span','slot-time',info.date));}
        else {card.append(element('strong','slot-name',saved?'Save unavailable':'Empty slot'),element('span','slot-empty-hint',this.mode==='save'?'Click to save here':'No saved game'));}
        grid.append(card);
      });
      const footer=element('footer','save-footer');footer.append(this.button('‹ BACK','save-back',()=>this.close()));
      const notice=element('span','save-notice',this.busy?'Please wait...':this.notice||'9 manual slots · Stored on this device');notice.setAttribute('role','status');footer.append(notice);
      if(this.mode==='load'){
        try{const auto=this.store.readAuto();if(auto){const resume=this.button('RESUME AUTOSAVE ›','save-auto',()=>this.choose(null,auto));resume.title=this.details(auto).name+' · '+this.details(auto).chapter;footer.append(resume);}}catch{}
      }
      panel.append(footer);this.stage.append(layer);
      const backup=element('div','save-backup-tools');
      backup.append(this.button('Export saves','save-backup-button',()=>this.exportBackup()),this.button('Import saves','save-backup-button',()=>this.importBackup()));
      panel.append(backup);
      if(this.pending)this.drawConfirmation(panel);
      else (Number.isInteger(focusIndex)?grid.querySelector(`[data-slot="${focusIndex}"]`):close)?.focus({preventScroll:true});
      if(this.busy)for(const button of layer.querySelectorAll('button'))button.disabled=true;
    }
    choose(index,saved) {
      if(this.busy)return;
      if(this.mode==='save'&&!saved){this.commit(index);return;}
      if(this.mode==='load'&&this.game.frame===this.game.data.start){this.load(index);return;}
      this.pending={index,saved};this.draw();
    }
    drawConfirmation(panel) {
      for(const child of panel.children)child.inert=true;
      const veil=element('div','slot-confirm-veil'),box=element('section','slot-confirm');
      box.setAttribute('role','alertdialog');box.setAttribute('aria-modal','true');box.setAttribute('aria-labelledby','slot-confirm-heading');
      const number=this.pending.index===null?'autosave':`slot ${String(this.pending.index+1).padStart(2,'0')}`;
      const heading=element('h2',null,this.mode==='save'?`Overwrite ${number}?`:`Load ${number}?`);heading.id='slot-confirm-heading';
      box.append(heading,element('p',null,this.mode==='save'?'This replaces the saved game in this slot. Other slots are kept.':'Return to this saved moment? Progress since your last save will be replaced.'));
      const actions=element('div','slot-confirm-actions');const cancel=this.button('Cancel','save-back',()=>{const index=this.pending.index;this.pending=null;this.draw(index);});
      const confirm=this.button(this.mode==='save'?'Overwrite save':'Load game','save-auto',()=>{const index=this.pending.index;this.pending=null;if(this.mode==='save')this.commit(index);else this.load(index);});
      actions.append(cancel,confirm);box.append(actions);veil.append(box);panel.append(veil);cancel.focus({preventScroll:true});
    }
    async commit(index) {
      if(this.busy)return;
      this.busy=true;this.draw(index);
      try{await this.store.write(index,this.game.snapshot());this.notice=`Saved to slot ${String(index+1).padStart(2,'0')}.`;}
      catch(error){this.notice=error.message||'Could not save. Existing saves are unchanged.';}
      finally{this.busy=false;if(this.isOpen)this.draw(index);}
    }
    async load(index) {
      if(this.busy)return;
      this.busy=true;this.draw(index);
      try{const saved=await (this.store.load?this.store.load(index):index===null?this.store.readAuto():this.store.read(index));this.busy=false;this.onLoad(saved);this.close(false);}
      catch(error){this.busy=false;this.notice=error.message||'This save could not be loaded. Your current game is unchanged.';this.draw(index);}
    }
    exportBackup(){
      const url=URL.createObjectURL(new Blob([JSON.stringify(this.store.exportBackup())],{type:'application/json'}));
      const link=document.createElement('a');link.href=url;link.download='Survive-USYD-saves.json';link.click();
      setTimeout(()=>URL.revokeObjectURL(url),1000);
    }
    importBackup(){
      const input=document.createElement('input');input.type='file';input.accept='.json,application/json';
      input.addEventListener('change',async()=>{
        const file=input.files[0];if(!file)return;
        this.busy=true;this.draw();
        try{if(file.size>4_000_000)throw Error('This save backup is too large.');this.notice=await this.store.importBackup(JSON.parse(await file.text()));}
        catch(error){this.notice=error.message||'Could not import this backup.';}
        finally{this.busy=false;if(this.isOpen)this.draw();}
      });input.click();
    }
  }
  root.SurviveSaveMenu=SurviveSaveMenu;
})(window);
