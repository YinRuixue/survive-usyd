/* Native Survive USYD rules. All story effects come from the authored Figma data. */
(function (root) {
  'use strict';
  class SurviveEngine {
    constructor(data, {randomIndex=SurviveEngine.randomIndex}={}) {
      this.data = data;
      this.randomIndex = randomIndex;
      this.byName = new Map(Object.entries(data.variables).map(([id,v]) => [v.name,id]));
      this.parents = new Map();
      for (const n of Object.values(data.nodes)) for (const id of n.children || []) this.parents.set(id,n.id);
      this.reset();
    }
    static randomIndex(count) {
      // Reject the incomplete final bucket so every wedge has exactly equal odds.
      const limit=Math.floor(0x100000000/count)*count, sample=new Uint32Array(1);
      do { globalThis.crypto.getRandomValues(sample); } while(sample[0]>=limit);
      return sample[0]%count;
    }
    reset() {
      this.values = Object.fromEntries(Object.entries(this.data.variables).map(([id,v]) => [id,structuredClone(v.value)]));
      this.frame = this.data.start; this.overlays = []; this.playerName = ''; this.history = [];
    }
    get(name) { return this.values[this.byName.get(name)]; }
    set(name,value) {
      const id=this.byName.get(name); if(!id) throw Error('Unknown variable '+name);
      this.values[id]=value;
    }
    evaluate(expression) {
      if(expression[0]==='l') return expression[1];
      if(expression[0]==='v') return this.values[expression[1]];
      const args=expression[2].map(e=>this.evaluate(e));
      switch(expression[1]) {
        case 'ADDITION': return args[0]+args[1];
        case 'SUBTRACTION': return args[0]-args[1];
        case 'MULTIPLICATION': return args[0]*args[1];
        case 'DIVISION': return args[0]/args[1];
        case 'EQUALS': return args[0]===args[1];
        case 'NOT_EQUAL': return args[0]!==args[1];
        case 'LESS_THAN': return args[0]<args[1];
        case 'LESS_THAN_OR_EQUAL': return args[0]<=args[1];
        case 'GREATER_THAN': return args[0]>args[1];
        case 'GREATER_THAN_OR_EQUAL': return args[0]>=args[1];
        case 'AND': return args[0]&&args[1];
        case 'OR': return args[0]||args[1];
        case 'NOT': return !args[0];
        case 'NEGATE': return -args[0];
        default: throw Error('Unsupported expression '+expression[1]);
      }
    }
    run(ids,depth=0) {
      if(depth>80) throw Error('Circular game rule');
      for(const id of ids) {
        const a=this.data.actionPool[id]; if(!a) throw Error('Missing rule '+id);
        switch(a[0]) {
          case 'r': {
            const index=this.randomIndex(a[2]);
            if(!Number.isInteger(index)||index<0||index>=a[2])throw Error('Invalid random result');
            this.values[a[1]]=index;break;
          }
          case 's': this.values[a[1]]=this.evaluate(a[2]); break;
          case 'c':
            for(const [condition,actions] of a[1]) {
              if(!condition||this.evaluate(condition)){this.run(actions,depth+1);break;}
            } break;
          case 'n':
            if(!this.data.nodes[a[1]]) throw Error('Missing scene '+a[1]);
            if(a[2]==='OVERLAY') this.overlays.push(this.frame);
            else if(a[2]==='NAVIGATE') this.overlays=[];
            this.frame=a[1];break;
          case 'x': this.frame=this.overlays.pop() || this.frame;break;
          case 'b': this.frame=this.history.pop() || this.frame;break;
          default: throw Error('Unsupported action '+a[0]);
        }
      }
    }
    flush() {
      for(let i=0;i<100;i++) {
        const node=this.data.nodes[this.frame];
        if(!node?.name.startsWith('SYSTEM')) return;
        const reactions=(this.data.actions[this.frame] || []).filter(r=>r.trigger?.type==='AFTER_TIMEOUT');
        if(!reactions.length) throw Error('Unfinished automatic transition');
        for(const r of reactions) this.run(r.actions);
      }
      throw Error('Automatic transition loop');
    }
    click(id) {
      if(id===this.data.wheel?.control&&this.frame!==this.data.wheel.frame)throw Error('The wheel is not available in this scene.');
      const reactions=(this.data.actions[id] || []).filter(r=>r.trigger?.type==='ON_CLICK');
      if(!reactions.length) throw Error('Not a game control: '+id);
      const from=this.frame;
      for(const r of reactions) this.run(r.actions);
      this.flush();
      if(from!==this.frame) this.history.push(from);
      if(this.history.length>40) this.history.shift();
      return this.frame;
    }
    trigger(id,type) {
      for(const r of this.data.actions[id] || []) if(r.trigger?.type===type) this.run(r.actions);
      this.flush();
    }
    value(binding,fallback) {
      if(!binding) return fallback;
      if(Array.isArray(binding)) return this.value(binding[0],fallback);
      return binding.type==='VARIABLE_ALIAS' ? this.values[binding.id] : fallback;
    }
    visible(id) {
      let node=this.data.nodes[id];
      while(node) {
        if(this.value(node.bind?.visible,node.visible!==false)===false) return false;
        node=this.data.nodes[this.parents.get(node.id)];
      }
      return true;
    }
    descendants(id) {
      const out=[],visit=id=>{const n=this.data.nodes[id];if(!n)return;out.push(n);for(const c of n.children||[])visit(c);};
      visit(id);return out;
    }
    choices() {
      return this.descendants(this.frame).filter(n=>this.visible(n.id)&&(this.data.actions[n.id]||[]).some(r=>r.trigger?.type==='ON_CLICK')&&!n.name.startsWith('FEEDBACK'));
    }
    snapshot() { return {version:1,source:this.data.source,frame:this.frame,values:structuredClone(this.values),overlays:[...this.overlays],playerName:this.playerName,savedAt:Date.now()}; }
    validateSnapshot(saved) {
      if(saved?.version!==1||saved.source!==this.data.source||!this.data.frames.some(f=>f.id===saved.frame)||this.data.nodes[saved.frame].name.startsWith('SYSTEM')) throw Error('This save is not compatible.');
      if(!saved.values||typeof saved.values!=='object'||Array.isArray(saved.values))throw Error('This save is incomplete.');
      for(const name of ['player/isMale','home/week','home/knowledge','home/energy','home/stress','home/money'])if(!(this.byName.get(name) in saved.values))throw Error('This save is incomplete.');
      for(const [id,value] of Object.entries(saved.values)) {
        const variable=this.data.variables[id];if(!variable)continue;
        const type=variable.type;
        if(type==='FLOAT'&&(!Number.isFinite(value)||typeof value!=='number')||type==='BOOLEAN'&&typeof value!=='boolean'||type==='STRING'&&typeof value!=='string'||type==='COLOR'&&(!value||!['r','g','b'].every(c=>Number.isFinite(value[c]))))throw Error('This save contains invalid values.');
      }
      const wheel=this.data.wheel,index=wheel&&saved.values[wheel.indexVariable];
      if(index!==undefined&&(!Number.isInteger(index)||index< -1||index>=wheel.prizes.length))throw Error('This save contains an invalid prize.');
      if(saved.overlays!==undefined&&(!Array.isArray(saved.overlays)||saved.overlays.some(id=>!this.data.frames.some(f=>f.id===id))))throw Error('This save contains an invalid scene.');
      return true;
    }
    restore(saved) {
      this.validateSnapshot(saved);
      this.values=Object.fromEntries(Object.entries(this.data.variables).map(([id,v])=>[id,structuredClone(saved.values[id]??v.value)]));this.frame=saved.frame;
      this.overlays=(saved.overlays||[]).filter(id=>this.data.nodes[id]);
      this.playerName=String(saved.playerName||'').slice(0,24);this.history=[];this.flush();
      const wheel=this.data.wheel;
      if(wheel&&!(wheel.indexVariable in saved.values)){
        if(wheel.beforeFrames.includes(saved.frame)){
          for(const key of wheel.legacyMoneyVariables)this.values[key]-=12;
        }else{
          // Existing saves already received the prototype's voucher. Never credit it again.
          this.values[wheel.indexVariable]=3;this.run(wheel.prizes[3].displayActions);
        }
      }
      this.refreshGroupPlan();
    }
    refreshGroupPlan() {
      // Old saves may contain the retired 40% / 70% personal-cap hint.
      const week=this.get('home/week'),config=this.data.groupPlanning?.[week],pre='w'+week+'/';
      if(!config||![this.frame,...this.overlays].some(id=>config.frames.includes(id))||this.get(pre+'settlementApplied'))return;
      const wasValid=this.get(pre+'groupPlanValid'),remaining=this.get(pre+'groupRemaining');
      this.run(config.refresh);
      if(remaining!==this.get(pre+'groupRemaining')||wasValid!==this.get(pre+'groupPlanValid')){
        if(!this.get(pre+'groupPlanValid'))this.run(config.invalid);
        else if(!wasValid)this.run(config.normal);
      }
    }
  }
  root.SurviveEngine=SurviveEngine;
  if(typeof module!=='undefined') module.exports=SurviveEngine;
})(typeof window!=='undefined'?window:globalThis);

