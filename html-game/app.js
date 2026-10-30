/* Buildless, local-first player for the authored Survive USYD scenes. */
(function () {
  'use strict';
  const data=window.SURVIVE_DATA, game=new SurviveEngine(data);
  const stage=document.querySelector('#stage'), viewport=document.querySelector('#viewport');
  const status=document.querySelector('#save-status');
  const saveButton=document.querySelector('#save-game'),loadButton=document.querySelector('#load-game');
  const restart=document.querySelector('#restart'), dialog=document.querySelector('#restart-dialog');
  const audioPanel=document.querySelector('#audio-dialog'),audioButton=document.querySelector('#audio-settings');
  const musicEnabled=document.querySelector('#music-enabled'),soundEnabled=document.querySelector('#sound-enabled');
  const musicVolume=document.querySelector('#music-volume'),soundVolume=document.querySelector('#sound-volume');
  const audio=new SurviveAudio({onChange:refreshAudioControls});
  audio.music.id='background-music';audio.music.hidden=true;
  audio.music.setAttribute('aria-hidden','true');document.body.append(audio.music);
  // Published demos run locally in the browser, even when served over HTTPS.
  // Keep HTTP-based Python play explicit rather than silently falling back on a failed API.
  const browserDemo=document.querySelector('meta[name="survive-runtime"]')?.content==='browser';
  const backend=!browserDemo&&/^https?:$/.test(location.protocol)?new SurviveBackendClient(game):null;
  const store=backend||new SurviveSaveStore(()=>localStorage,game);
  const saveMenu=new SurviveSaveMenu({stage,game,store,onLoad:saved=>{
    game.restore(saved);saveMenu.close(false);persist();render();
  }});
  const svgNodes={'65:130':'imgGameTenSegmentPrizeWheel.svg','64:15':'imgGameTenSegmentPrizeWheel.svg','65:155':'imgGameWoodenPointer.svg'};
  // Scope readable numbers to status readouts; week headings retain their artwork font.
  const summaryStatusNodes=new Set(data.frames.filter(f=>/^W\d+\b.*Summary/i.test(f.name))
    .flatMap(f=>game.descendants(f.id))
    .filter(n=>n.type==='TEXT' && ['Value','Scale','Money value','Opening balance'].includes(n.name))
    .map(n=>n.id));
  // Display the base activity effects consistently, including descriptions from older saves.
  // Fitness recovery bonuses are applied by the game rules when the plan is executed.
  const activityDescriptions=new Map(Object.entries(data.balance?.descriptions||{}));
  const legacyActivityDescriptions=new Map([
    ['Knowledge ↑\nStress ↑ · Energy ↓','Knowledge +8\nStress +10 · Energy −18'],
    ['Energy ↑ · Stress ↓','Energy +20 · Stress −10'],
    ['Stress ↓\nEnergy ↓','Stress −22\nEnergy −4'],
    ['Stress ↓ · Energy ↓','Stress −22 · Energy −4'],
    ['Stress ↓ ','Stress −22 · Energy −4'],
    ['Money ↑\nStress ↑ · Energy ↓','AU$ +45\nStress +8 · Energy −20'],
    ['Fitness +10 · Stress ↓\nEnergy ↓','Fitness +10 · Stress −8\nEnergy −8'],
    ['Fitness ↑ ','Fitness +10 · Stress −8\nEnergy −8'],
    ['Group Report progress ↑\nStress ↑ · Energy ↓','Group report +10%\nEnergy −22 · Stress +12'],
    ['Energy recovery and Stress relief scale with Fitness.','Base values shown. Fitness boosts Energy recovery and Stress relief.']
  ]);
  let previousFrame=null,storageAvailable=true,wheelSpinning=false,networkBusy=false;
  try { store.readAuto(); }
  catch { storageAvailable=false; }

  function refreshAudioControls(){
    const settings=audio.settings;
    musicEnabled.checked=settings.musicEnabled;soundEnabled.checked=settings.soundEnabled;
    musicVolume.value=Math.round(settings.musicVolume*100);soundVolume.value=Math.round(settings.soundVolume*100);
    musicVolume.disabled=!settings.musicEnabled;soundVolume.disabled=!settings.soundEnabled;
    document.querySelector('#music-level').value=musicVolume.value+'%';
    document.querySelector('#sound-level').value=soundVolume.value+'%';
    const muted=(!settings.musicEnabled||!settings.musicVolume)&&(!settings.soundEnabled||!settings.soundVolume);
    audioButton.textContent=muted?'Audio: Off':'Audio';
    audioButton.setAttribute('aria-label',muted?'Audio settings (muted)':'Audio settings');
    document.querySelector('#audio-note').textContent=audio.error||(!audio.unlocked?'Music starts on your first click.':'Audio pauses when you leave this tab. Preferences are saved here.');
  }
  audioButton.addEventListener('click',()=>audioPanel.showModal());
  document.querySelector('#close-audio').addEventListener('click',()=>audioPanel.close());
  musicEnabled.addEventListener('change',()=>audio.set('musicEnabled',musicEnabled.checked));
  soundEnabled.addEventListener('change',()=>{audio.set('soundEnabled',soundEnabled.checked);audio.click();});
  musicVolume.addEventListener('input',()=>audio.set('musicVolume',Number(musicVolume.value)/100));
  soundVolume.addEventListener('input',()=>audio.set('soundVolume',Number(soundVolume.value)/100));
  soundVolume.addEventListener('change',()=>audio.click());
  document.addEventListener('pointerdown',()=>audio.unlock(),{passive:true});
  document.addEventListener('keydown',event=>{
    if(!event.repeat&&!event.metaKey&&!event.ctrlKey&&!event.altKey)audio.unlock();
  });
  // Delegation also covers freshly rendered dialogue, plan, save and load buttons.
  document.addEventListener('click',event=>{
    const button=event.target.closest('button');
    if(button&&!button.disabled&&!button.closest('[inert]'))audio.click();
  },true);
  document.addEventListener('visibilitychange',()=>audio.sync());
  window.addEventListener('pagehide',()=>{audio.music.pause();audio.clicks.forEach(sound=>sound.pause());});
  window.addEventListener('pageshow',()=>audio.sync());
  refreshAudioControls();

  function color(c,opacity=1) {
    if(!c) return 'transparent';
    return `rgba(${Math.round(c.r*255)},${Math.round(c.g*255)},${Math.round(c.b*255)},${(c.a??1)*opacity})`;
  }
  function paintColor(p) { return color(game.value(p.boundVariables?.color,p.color),p.opacity??1); }
  function textFor(n) {
    const savedText=String(game.value(n.bind?.characters,n.text??''));
    const text=activityDescriptions.get(savedText)??legacyActivityDescriptions.get(savedText)??savedText;
    if(text==='NH' && game.get('player/isMale'))return 'CH';
    return text==='ME' && game.playerName ? game.playerName : formatGameText(text);
  }
  function labelFor(n) {
    const text=game.descendants(n.id).filter(c=>c.type==='TEXT' && game.visible(c.id)).map(textFor).join(' ');
    if(text) return text;
    const name=n.name.replace(/^(ACTION|BUTTON|ACTIVITY|CHOICE)\s*\/\s*/,'').replace(/\s*→.*$/,'');
    if(/dialogue|next story|continue|tap/i.test(name)) return 'Continue dialogue';
    return name;
  }
  function addPaint(el,p) {
    if(p.visible===false) return;
    const fill=document.createElement('div');fill.className='paint';
    if(p.type==='SOLID') fill.style.backgroundColor=paintColor(p);
    else if(p.type==='IMAGE') {
      fill.style.opacity=p.opacity??1;
      const img=document.createElement('img');img.src=`assets/${p.imageHash}.png`;img.alt='';img.draggable=false;
      const t=p.imageTransform;
      if(p.scaleMode==='CROP' && t && t[0][0] && t[1][1] && !t[0][1] && !t[1][0]) {
        Object.assign(img.style,{width:`${100/t[0][0]}%`,height:`${100/t[1][1]}%`,left:`${-t[0][2]/t[0][0]*100}%`,top:`${-t[1][2]/t[1][1]*100}%`,objectFit:'fill'});
      } else Object.assign(img.style,{inset:'0',width:'100%',height:'100%',objectFit:p.scaleMode==='FIT'?'contain':'cover'});
      fill.append(img);
    }
    el.append(fill);
  }
  function renderNode(id,root=false) {
    const n=data.nodes[id];
    if(!n || !game.visible(id) || id==='4:833') return null;
    const el=document.createElement('div'); el.className=root?'scene':'node';el.dataset.node=id;
    const w=game.value(n.bind?.width,n.w);let h=game.value(n.bind?.height,n.h),y=n.y;
    if(['4:827','4:828','38:286'].includes(id))h+=48;
    if(['38:288','38:292','38:293'].includes(id))y+=48;
    if(['02 UI / Desk menu / warm hard offset shadow','MENU / pixel wood-frame outer','MENU / matte parchment inset'].includes(n.name))h+=45;
    if(/^MENU \/ (warm inner edge shadow|lower timber grain|pixel notched lower)/.test(n.name))y+=45;
    Object.assign(el.style,{left:(root?0:n.x)+'px',top:(root?0:y)+'px',width:w+'px',height:h+'px',opacity:n.opacity??1});
    if(n.clip) el.style.overflow='hidden';
    if(n.type==='ELLIPSE') el.style.borderRadius='50%';
    else if(n.cornerRadius) el.style.borderRadius=n.cornerRadius+'px';
    if(n.effects?.length) el.style.boxShadow=n.effects.filter(e=>e.visible!==false && e.type==='DROP_SHADOW').map(e=>`${e.offset.x}px ${e.offset.y}px ${e.radius}px ${e.spread||0}px ${color(e.color)}`).join(',');

    if(n.type==='TEXT') {
      el.classList.add('text');
      const p=(n.fills||[]).find(p=>p.visible!==false&&p.type==='SOLID');
      let fontSize=game.value(n.bind?.fontSize,n.fontSize)||16;
      if(n.text==='ME' && game.playerName) fontSize=Math.min(fontSize,Math.max(11,w/(game.playerName.length*.66)));
      Object.assign(el.style,{
        fontFamily:`"${n.font?.family||'Noto Sans SC'}",sans-serif`,fontSize:fontSize+'px',
        fontWeight:n.font?.variationSettings?.wght||(/bold/i.test(n.font?.style)?700:400),
        lineHeight:n.lineHeight?.unit==='PIXELS'?n.lineHeight.value+'px':n.lineHeight?.unit==='PERCENT'?n.lineHeight.value+'%':'normal',
        letterSpacing:(n.letterSpacing?.unit==='PERCENT'?(n.letterSpacing.value/100)+'em':(n.letterSpacing?.value||0)+'px'),
        textAlign:(n.textAlign||'LEFT').toLowerCase(),
        justifyContent:({TOP:'flex-start',CENTER:'center',BOTTOM:'flex-end'})[n.textVAlign]||'flex-start',
        color:p?paintColor(p):'#443931'
      });
      if(n.decoration==='UNDERLINE')el.style.textDecoration='underline';
      const span=document.createElement('span'),text=textFor(n);
      if(summaryStatusNodes.has(id) && n.name==='Opening balance') {
        // The O-Week balance shares a text node with its pixel-art MONEY label.
        const label=text.match(/^MONEY\s+/)?.[0]||'';
        const amount=document.createElement('span');amount.className='summary-status-number';
        amount.textContent=text.slice(label.length);span.append(document.createTextNode(label),amount);
      } else {
        span.textContent=text;
        if(summaryStatusNodes.has(id))span.classList.add('summary-status-number');
      }
      el.append(span);
    } else {
      for(const p of [...(n.fills||[])].reverse())addPaint(el,p);
      if(svgNodes[id]) {
        const img=document.createElement('img');img.src='assets/'+svgNodes[id];img.alt='';img.draggable=false;img.style.cssText='width:100%;height:100%;display:block';el.append(img);
      } else for(const child of n.children||[]) { const childEl=renderNode(child);if(childEl)el.append(childEl); }
    }
    const stroke=(n.strokes||[]).find(p=>p.visible!==false && p.type==='SOLID');
    if(stroke && n.strokeWeight) {
      const border=document.createElement('div');border.className='paint';
      border.style.borderRadius='inherit';
      border.style.boxShadow=`${n.strokeAlign==='INSIDE'?'inset ':''}0 0 0 ${n.strokeAlign==='CENTER'?n.strokeWeight/2:n.strokeWeight}px ${paintColor(stroke)}`;
      if(n.strokeAlign==='CENTER')border.style.outline=`${n.strokeWeight/2}px solid ${paintColor(stroke)}`;
      el.append(border);
    }
    if((data.actions[id]||[]).some(r=>r.trigger?.type==='ON_CLICK')) {
      const button=document.createElement('button');button.type='button';button.className='node hotspot';button.dataset.action=id;
      Object.assign(button.style,{inset:'0',width:'100%',height:'100%'});
      if(/dialogue|continue|next story/i.test(n.name)||h>110&&w>900)button.classList.add('dialogue');
      button.setAttribute('aria-label',labelFor(n));button.addEventListener('click',()=>act(id));el.append(button);
    }
    return el;
  }
  function addNameInput(scene) {
    const input=document.createElement('input');input.className='name-input';input.type='text';input.autocomplete='off';
    input.maxLength=24;input.placeholder='Enter your name...';input.setAttribute('aria-label','Your name');input.value=game.playerName;
    input.required=true;input.setAttribute('aria-describedby','name-error');
    const error=document.createElement('span');error.id='name-error';error.className='name-error';error.setAttribute('role','alert');
    Object.assign(input.style,{left:'453px',top:'423px',width:'375px',height:'32px'});
    input.addEventListener('input',()=>{
      game.playerName=input.value;
      if(input.value.trim()){input.removeAttribute('aria-invalid');error.textContent='';}
    });
    input.addEventListener('keydown',event=>{if(event.key==='Enter'&&!event.isComposing){event.preventDefault();act('71:26');}});
    scene.append(input,error);
    const next=document.createElement('button');next.type='button';next.className='game-menu-button title-continue';
    next.textContent='CONTINUE GAME  ›';next.addEventListener('click',()=>saveMenu.open('load'));scene.append(next);
  }
  function addSaveControls(scene,id) {
    const children=(data.nodes[id].children||[]).map(id=>data.nodes[id]);
    if(!children.some(n=>n.name==='MENU / Desk Menu / dark pixel title'))return;
    // Match the existing two-column Desk Menu, adding one compact row.
    for(const [mode,label,left]of [['save','Save',45],['load','Load',196]]){
      const button=document.createElement('button');button.type='button';button.className='game-menu-button desk-save-button';
      Object.assign(button.style,{left:left+'px',top:'252px'});button.textContent=label;
      button.setAttribute('aria-label',label+' game');
      button.addEventListener('click',()=>saveMenu.open(mode));scene.append(button);
    }
  }
  function resize() {
    const box=document.querySelector('#player');const scale=Math.min(box.clientWidth/1280,box.clientHeight/720);
    viewport.style.width=1280*scale+'px';viewport.style.height=720*scale+'px';stage.style.transform=`scale(${scale})`;
  }
  function persist() {
    if(game.frame===data.start)return;
    try{store.writeAuto(game.snapshot());storageAvailable=true;}catch{storageAvailable=false;}
  }
  function render() {
    const focus=document.activeElement?.dataset?.action;
    stage.replaceChildren();
    for(const id of [...game.overlays,game.frame]) {
      const scene=renderNode(id,true);if(!scene)continue;
      if(id!==game.frame){scene.inert=true;scene.setAttribute('aria-hidden','true');}
      else if(previousFrame!==game.frame)scene.classList.add('enter');
      if(id===data.start)addNameInput(scene);
      else addSaveControls(scene,id);
      stage.append(scene);
    }
    saveButton.hidden=loadButton.hidden=game.frame===data.start;
    restart.hidden=game.frame===data.start;
    status.textContent=game.frame===data.start?'Click dialogue to continue · Space / Enter':storageAvailable?(backend?'Autosaved to this computer · 9 save slots':'Autosaved in this browser · 9 save slots'):'Space / Enter to continue · Saving unavailable';
    document.querySelector('#announcement').textContent=game.descendants(game.frame).filter(n=>n.type==='TEXT'&&game.visible(n.id)&&/body|narration|dialog.*text/i.test(n.name)).map(textFor).join(' ');
    if(focus && previousFrame===game.frame)stage.querySelector(`[data-action="${focus}"]`)?.focus({preventScroll:true});
    previousFrame=game.frame;resize();
  }
  function clearSave() {try{store.clearAuto();}catch{}}
  function act(id) {
    if(saveMenu.isOpen||wheelSpinning||networkBusy||dialog.open)return;
    if(id==='65:174'&&game.frame==='65:103'){spinWheel(id);return;}
    advance(id);
  }
  async function spinWheel(id) {
    const scene=stage.querySelector('.scene:last-child');
    const wheel=scene?.querySelector('[data-node="65:130"]');
    if(!wheel?.animate){advance(id);return;}
    wheelSpinning=true;
    const from=game.frame;
    const controls=[...scene.querySelectorAll('button'),saveButton,loadButton,restart];
    const disabled=controls.map(button=>button.disabled);
    const title=scene.querySelector('[data-node="65:173"] span');
    const announcement=document.querySelector('#announcement');
    controls.forEach(button=>{button.disabled=true;});
    scene.dataset.wheelState='spinning';scene.setAttribute('aria-busy','true');
    if(title)title.textContent='SPINNING...';
    status.textContent='Spinning...';announcement.textContent='The prize wheel is spinning.';
    let animation,earned=false;
    try {
      // Commit the draw first. Reloads and network retries keep this same prize,
      // including while the old wheel scene is still animating on screen.
      if(backend)game.restore(await backend.action(id,game.playerName));
      else game.click(id);
      earned=true;persist();
      const index=game.values[data.wheel.indexVariable],prize=data.wheel.prizes[index];
      const landing=360-(index+.5)*(360/data.wheel.prizes.length);
      const reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      wheel.style.transformOrigin='50% 50%';
      if(reduced)wheel.style.transform=`rotate(${landing}deg)`;
      animation=wheel.animate(reduced?[
        {opacity:.65},{opacity:1}
      ]:[
        {transform:'rotate(0deg)'},{transform:`rotate(${360*6+landing}deg)`}
      ],{duration:reduced?250:4400,easing:'cubic-bezier(.12,.65,.18,1)',fill:'forwards'});
      await animation.finished;
      scene.dataset.wheelState='stopped';scene.removeAttribute('aria-busy');
      scene.querySelector(`[data-node="${prize.card}"]`)?.classList.add('wheel-winner');
      if(title)title.textContent='YOU WON!';
      status.textContent=prize.name+' · '+prize.delta;
      announcement.textContent='You won '+prize.name+'. '+prize.delta+'.';
      // Let the stopped wheel and winning wedge remain visible before the reward page.
      await new Promise(resolve=>setTimeout(resolve,900));
    } catch(error) {
      if(earned)console.warn('Wheel animation unavailable; showing the earned reward.',error);
      else status.textContent=error.message||'Unable to spin. Please try again.';
    } finally {
      if(earned)render();
      animation?.cancel();
      wheelSpinning=false;
      controls.forEach((button,index)=>{button.disabled=disabled[index];});
      scene.removeAttribute('aria-busy');
      if(game.frame===from){
        delete scene.dataset.wheelState;
        scene.querySelector('.wheel-winner')?.classList.remove('wheel-winner');
        if(title)title.textContent='SPIN · FREE';
      }
    }
  }
  function setNetworkBusy(busy){
    networkBusy=busy;
    for(const scene of stage.querySelectorAll('.scene'))scene.inert=busy||scene.dataset.node!==game.frame;
    for(const button of [saveButton,loadButton,restart])button.disabled=busy;
    if(busy)status.textContent='Saving progress...';
  }
  async function advance(id) {
    if(networkBusy)return;
    if(game.frame===data.start&&id==='71:26'&&!game.playerName.trim()){
      const input=stage.querySelector('.name-input');
      stage.querySelector('#name-error').textContent='Please enter your name.';
      input.setAttribute('aria-invalid','true');input.focus();
      return;
    }
    if(backend)setNetworkBusy(true);
    try {
      game.playerName=game.playerName.trim();
      const from=game.frame;
      if(backend)game.restore(await backend.action(id,game.playerName));
      else game.click(id);
      if(game.frame===data.start && from!==data.start){game.playerName='';clearSave();}
      else persist();
      render();
    } catch(error) {
      console.error(error);status.textContent=error.message||'Unable to continue. Your previous save is still available.';
    }finally{
      if(backend)setNetworkBusy(false);
    }
  }
  saveButton.addEventListener('click',()=>saveMenu.open('save'));
  loadButton.addEventListener('click',()=>saveMenu.open('load'));
  restart.addEventListener('click',()=>dialog.showModal());
  dialog.addEventListener('close',async()=>{
    if(dialog.returnValue!=='restart')return;
    if(backend)setNetworkBusy(true);
    try{if(backend)game.restore(await backend.reset());else game.reset();clearSave();render();}
    catch(error){status.textContent=error.message;}
    finally{if(backend)setNetworkBusy(false);}
  });
  document.querySelector('#fullscreen').addEventListener('click',async()=>{
    try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen();}catch{status.textContent='Use your browser’s fullscreen option.';}
  });
  window.addEventListener('resize',resize);
  document.addEventListener('keydown',event=>{
    if(event.repeat||dialog.open||audioPanel.open||saveMenu.isOpen||networkBusy||event.target.closest('input,textarea,button'))return;
    if(event.key===' '||event.key==='Enter') {
      const choices=game.choices().filter(n=>/^(ACTION|BUTTON)\s*\//.test(n.name));
      if(choices.length===1){event.preventDefault();audio.click();act(choices[0].id);}
    }
  });
  async function start(){
    if(!backend){render();return;}
    try{
      networkBusy=true;
      const result=await backend.init();game.restore(result.state);render();
    }catch(error){
      stage.replaceChildren();
      const message=document.createElement('div');message.className='loading connection-message';
      const text=document.createElement('p');text.textContent='The game server is unavailable. Open Start Game.command, then retry.';
      const retry=document.createElement('button');retry.className='save-auto';retry.textContent='Retry connection';retry.onclick=start;
      message.append(text,retry);stage.append(message);status.textContent=error.message;resize();
    }finally{networkBusy=false;}
  }
  start();
})();
