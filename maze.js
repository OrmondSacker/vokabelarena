"use strict";
const Maze = (() => {
  const SAVE="vokabelarena.maze.expedition.1", VERSION=1;
  const titles={castle:"Burgruine",jungle:"Dschungeltempel",library:"Magische Bibliothek"};
  const types={letters:"Buchstabenschloss",hangman:"Runentür",wordle:"Codekammer",match:"Wörterbrücke",secret:"Geheimschrift",order:"Satzwerkstatt",gap:"Grammatikschloss",correct:"Fehlerzauber",choice:"Formenprüfung"};
  const palette={castle:{floor:"#384656",tile:"#435266",wall:"#182636",edge:"#6c8096",accent:"#ffc46d",fog:"#0a1322"},jungle:{floor:"#254c42",tile:"#386553",wall:"#10362e",edge:"#68a56e",accent:"#ebd47d",fog:"#071e1b"},library:{floor:"#453957",tile:"#58466f",wall:"#251d3b",edge:"#9f7fbd",accent:"#9fe8ff",fog:"#110d23"}};
  const vocabBanks={
    school:[['die Schule','school'],['das Buch','book'],['lernen','learn'],['die Frage','question'],['die Antwort','answer'],['der Unterricht','lesson'],['der Bleistift','pencil'],['die Bibliothek','library'],['erklären','explain'],['sorgfältig','careful']],
    travel:[['die Reise','journey'],['der Bahnhof','station'],['der Koffer','suitcase'],['die Fahrkarte','ticket'],['der Flughafen','airport'],['ankommen','arrive'],['abfahren','depart'],['die Brücke','bridge'],['der Weg','path'],['die Richtung','direction']],
    everyday:[['der Garten','garden'],['das Fenster','window'],['der Schlüssel','key'],['die Freundschaft','friendship'],['glücklich','happy'],['kochen','cook'],['die Bestellung','order'],['zuverlässig','reliable'],['sich erinnern','remember'],['ein Foto machen','take a photo']]
  };
  const topics={present:"Simple Present",progressive:"Present Progressive",past:"Simple Past",questions:"Fragen und Verneinungen",mixed:"Gemischte Zeiten"};
  function grammarBank(selected) {
    const out=[],add=(topic,kind,prompt,answer,options=[])=>out.push({topic,kind,prompt,answer,options,theme:topics[topic]});
    for(const [name,verb,third,gerund,past] of [['Mia','play','plays','playing','played'],['Ben','work','works','working','worked'],['Sam','read','reads','reading','read'],['Alex','swim','swims','swimming','swam'],['Lina','write','writes','writing','wrote'],['Noah','run','runs','running','ran']]) {
      add('present','gap',`Every day, ${name} ___ for an hour. (${verb})`,third);
      add('present','correct',`Korrigiere den Satz: ${name} ${verb} every day.`,`${name} ${third} every day.`);
      add('progressive','gap',`Look! ${name} ___ right now. (${verb} · ganze Verbform)`,`is ${gerund}`);
      add('progressive','order','Ordne den Satz im Present Progressive.',`${name} is ${gerund} right now.`);
      add('past','gap',`Yesterday, ${name} ___ for an hour. (${verb})`,past);
      add('past','order','Ordne den Satz im Simple Past.',`${name} ${past} yesterday.`);
      add('questions','order','Bilde eine Frage im Simple Present.',`Does ${name} ${verb} every day?`);
      add('questions','correct',`Korrigiere die Verneinung: ${name} does not ${third} every day.`,`${name} does not ${verb} every day.`);
      add('mixed','choice',`Look! ${name} ___ right now.`,`is ${gerund}`,[third,`is ${gerund}`,past]);
      add('mixed','choice',`Yesterday, ${name} ___ for an hour.`,past,[third,`is ${gerund}`,past]);
    }
    add('questions','gap','___ you like music? (Frage im Simple Present)','Do');
    add('questions','gap','___ she visit you yesterday? (Frage im Simple Past)','Did');
    add('questions','order','Bilde eine Verneinung im Simple Past.','They did not visit us yesterday.');
    add('mixed','choice','Listen! The children ___ now.','are singing',['sing','are singing','sang']);
    return out.filter(x=>selected.includes(x.topic));
  }
  const $=id=>document.getElementById(id);
  const mix=a=>{const b=[...a];for(let i=b.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[b[i],b[j]]=[b[j],b[i]];}return b;};
  const norm=s=>String(s).normalize('NFC').toLowerCase().replace(/[’']/gu,'').replace(/\p{P}/gu,' ').replace(/\s+/g,' ').trim();
  const letters=s=>Array.from(String(s).normalize('NFC').toLowerCase().replace(/[^\p{L}]/gu,''));
  const first=s=>String(s).split(/[;/|]/u).map(s=>s.trim()).find(Boolean)||'';
  function matches(input,answer){return typeof answerMatches==='function' ? answerMatches(input,answer) : norm(input)===norm(answer);}
  const node=(tag,text,cls)=>{const n=document.createElement(tag);if(text!=null)n.textContent=text;if(cls)n.className=cls;return n;};
  const button=(text,fn,cls='secondary')=>{const n=node('button',text,cls);n.type='button';n.onclick=fn;return n;};
  let g=null,editing=false,storageWarning='',artFrame=0,themeSelection='';
  let roomArrival = null;
  function sound(kind){window.ArenaAudio?.play(kind);}
  function say(text){if(g)g.notice=text;const n=$('mazeNotice');if(n)n.textContent=text;}
  function seeded(seed){let n=seed>>>0;return()=>{n=(Math.imul(n,1664525)+1013904223)>>>0;return n/4294967296;};}
  function generate(size,seed) {
    const rng=seeded(seed),cells=Array.from({length:size*size},(_,id)=>({id,edges:[],seen:false,visited:false,event:'',done:false}));
    const neighbors=id=>[id-size,id+1,id+size,id-1].filter(n=>n>=0&&n<cells.length&&(Math.abs(n-id)===size||Math.floor(n/size)===Math.floor(id/size)));
    const connect=(a,b)=>{if(!cells[a].edges.includes(b))cells[a].edges.push(b);if(!cells[b].edges.includes(a))cells[b].edges.push(a);};
    const seen=new Set([0]),stack=[0];
    while(stack.length){const at=stack[stack.length-1],opts=neighbors(at).filter(n=>!seen.has(n));if(!opts.length){stack.pop();continue;}const next=opts[Math.floor(rng()*opts.length)];connect(at,next);seen.add(next);stack.push(next);}
    for(const c of cells)for(const n of neighbors(c.id))if(rng()<.06)connect(c.id,n);
    const distance=Array(cells.length).fill(-1),q=[0];distance[0]=0;for(let i=0;i<q.length;i++)for(const n of cells[q[i]].edges)if(distance[n]<0){distance[n]=distance[q[i]]+1;q.push(n);}
    const ranked=cells.map(c=>c.id).filter(id=>id!==0).sort((a,b)=>distance[b]-distance[a]);
    const exit=ranked.shift();cells[exit].event='exit';
    const free=[...ranked];
    for(let i=free.length-1;i>0;i--){const j=Math.floor(rng()*(i+1));[free[i],free[j]]=[free[j],free[i]];}
    const take=event=>{const id=free.shift();cells[id].event=event;return id;};
    // Spread the required rooms along the route from the entry to the farthest room.
    const milestones = [['vault', .48], ['hiddenKey', .76], ['fragment', .24], ['fragment', .55], ['fragment', .88]];
    for (const [event, progress] of milestones) {
      const target = distance[exit] * progress;
      let nearest = 0;
      for (let i = 1; i < free.length; i++) {
        if (Math.abs(distance[free[i]] - target) < Math.abs(distance[free[nearest]] - target)) nearest = i;
      }
      cells[free.splice(nearest, 1)[0]].event = event;
    }
    take('sideKey');const switchCell=take('switch');
    const extras=[];
    for(const kind of ['key','switch','secret']){const options=[];for(const c of cells)for(const n of neighbors(c.id))if(c.id<n&&!c.edges.includes(n)&&!extras.some(e=>e.a===c.id&&e.b===n))options.push({a:c.id,b:n});if(options.length){const edge=options[Math.floor(rng()*options.length)];extras.push({...edge,kind,open:false});}}
    if(!extras.some(e=>e.kind==='switch'))cells[switchCell].event='treasure';
    const cycle=['puzzle','treasure','puzzle','puzzle','puzzle','puzzle','rest'];
    free.forEach((id,i)=>{cells[id].event=cycle[i%cycle.length];});
    const kinds=['letters','hangman','wordle','match','secret'];let index=0;for(const c of cells)if(['puzzle','vault','hiddenKey','fragment'].includes(c.event))c.riddleKind=kinds[index++%kinds.length];
    cells[0].visited=true;return{size,cells,extras,exit};
  }
  function buildPool(vocabulary,config){
    let entries=[];
    const fromCards=(cards,theme,verbs=false)=>cards.flatMap((card,i)=>{
      if(verbs)return[{prompt:'Simple Past von '+card[0],answer:card[1],theme:'Unregelmäßige Verben'},{prompt:'Past Participle von '+card[0],answer:card[2],theme:'Unregelmäßige Verben'}];
      const side=vocabulary.direction==='mix' ? Math.floor(Math.random()*2) : Number(vocabulary.direction)||0;
      return[{prompt:card[side],answer:card[1-side],theme}];
    });
    if(['custom','mixed'].includes(config.source))entries.push(...fromCards(vocabulary.cards,config.listTheme,vocabulary.verbs));
    if(['builtin','mixed'].includes(config.source))for(const key of config.banks)entries.push(...fromCards(vocabBanks[key],{school:'Schule',travel:'Reisen',everyday:'Alltag'}[key]));
    if(['grammar','mixed'].includes(config.source))entries.push(...grammarBank(config.topics));
    const unique=new Map();for(const e of entries)if(e.answer&&e.prompt)unique.set(JSON.stringify([e.prompt,e.answer,e.kind]),e);
    return [...unique.values()].map((e,id)=>({...e,id}));
  }
  function freshLearning(items){return{items,remaining:mix(items.map(e=>e.id)),missed:[],mastered:[],inFlight:[]};}
  function suitable(e,kind){if(!kind)return true;if(['order','gap','correct','choice'].includes(kind))return e.kind===kind;if(e.kind)return false;const word=first(e.answer);return kind==='wordle'?/^\p{L}{3,12}$/u.test(word):kind==='hangman'?letters(word).length>0&&letters(word).length<=18:true;}
  function preferredKind(room){const grammar=g.config.source==='grammar'||g.config.source==='mixed'&&room.id%3===0;return grammar?['gap','order','correct','choice'][room.id%4]:room.riddleKind||'letters';}
  function nextKind(room){const l=g.learning,ids=l.remaining.length?l.remaining:l.missed,preferred=preferredKind(room),entry=l.items[ids.find(id=>suitable(l.items[id],preferred))??ids[0]];if(entry?.kind)return entry.kind;if(preferred==='wordle'&&entry&&!/^\p{L}{3,12}$/u.test(first(entry.answer))||preferred==='hangman'&&entry&&letters(first(entry.answer)).length>18)return'letters';return ['order','gap','correct','choice'].includes(preferred)?'letters':preferred;}
  function draw(preferred){const l=g.learning;if(!l.remaining.length&&l.missed.length){l.remaining=mix(l.missed);l.missed=[];}if(!l.remaining.length)return null;const index=preferred?l.remaining.findIndex(id=>suitable(l.items[id],preferred)):0;const id=l.remaining.splice(Math.max(0,index),1)[0];l.inFlight.push(id);return l.items[id];}
  function record(id,correct){const l=g.learning;l.inFlight=l.inFlight.filter(n=>n!==id);if(correct){if(!l.mastered.includes(id))l.mastered.push(id);}else if(!l.missed.includes(id))l.missed.push(id);}
  function config(){return{world:$('mazeWorld').value,size:Number($('mazeSize').value),adventure:$('mazeDifficulty').value==='adventure',source:$('mazeSource').value,listTheme:$('mazeListTheme').value.trim(),banks:[...document.querySelectorAll('[name=mazeBank]:checked')].map(n=>n.value),topics:[...document.querySelectorAll('[name=mazeTopic]:checked')].map(n=>n.value),classId:$('mazeClass').value};}
  function start(vocabulary,cfg=config()){
    const items=buildPool(vocabulary,cfg);if(!items.length){$('error').textContent='Wähle mindestens eine passende Vokabelsammlung oder ein Grammatikthema aus.';$('error').hidden=false;return;}
    const previous=readSave();if(previous&&!previous.ended&&!confirm('Es gibt eine gespeicherte Expedition. Mit einer neuen Partie wird dieser Spielstand ersetzt. Neue Expedition starten?'))return;
    const names=cfg.classId!=='' ? [...(classRecords[Number(cfg.classId)]?.names||[])] : [];
    g={version:VERSION,config:cfg,vocabulary,seed:Math.floor(Math.random()*4294967296),position:0,previous:0,keys:[],fragments:0,sideKey:false,switchOn:false,lives:5,maxLives:5,coins:cfg.adventure?4:8,inventory:{hint:1,skip:0},streak:0,learning:freshLearning(items),active:null,panel:'explore',notice:'Findet drei Schlüssel und erreicht das Ausgangsportal. Wählt einen angrenzenden Raum.',names:mix(names),person:0,stats:{puzzles:0,failed:0,hints:0,skips:0,coinsEarned:0},difficult:[],ended:false,savedAt:Date.now()};
    Object.assign(g,generate(cfg.size,g.seed));show();reveal();save();render();
  }
  function validSave(s){
    if(!s||s.version!==VERSION||![5,7,9].includes(s.size)||!palette[s.config?.world]||!Array.isArray(s.cells)||s.cells.length!==s.size*s.size||!Array.isArray(s.learning?.items)||!s.learning.items.length||s.learning.items.length>5000)return false;
    const cell=id=>Number.isInteger(id)&&id>=0&&id<s.cells.length,word=id=>Number.isInteger(id)&&id>=0&&id<s.learning.items.length;
    if(!cell(s.position)||!cell(s.previous)||!cell(s.exit)||!s.cells.every((c,id)=>c.id===id&&Array.isArray(c.edges)&&c.edges.every(n=>cell(n)&&(Math.abs(n-id)===s.size||Math.floor(n/s.size)===Math.floor(id/s.size))&&s.cells[n]?.edges?.includes(id))))return false;
    if(!s.learning.items.every((e,id)=>e.id===id&&typeof e.prompt==='string'&&typeof e.answer==='string')||!['remaining','missed','mastered','inFlight'].every(k=>Array.isArray(s.learning[k])&&s.learning[k].every(word)))return false;
    if(!['explore','puzzle','learning','end'].includes(s.panel)||!Array.isArray(s.keys)||s.keys.some(k=>!['vault','hidden','fragments'].includes(k))||!Array.isArray(s.names)||s.names.some(n=>typeof n!=='string')||!Array.isArray(s.extras)||!s.extras.every(e=>cell(e.a)&&cell(e.b)&&['key','switch','secret'].includes(e.kind)))return false;
    if(!Number.isFinite(s.coins)||s.coins<0||s.coins>1000000||!Number.isInteger(s.lives)||s.lives<0||s.lives>5||s.maxLives!==5||!s.stats||!s.inventory||!Array.isArray(s.difficult)||!s.difficult.every(word))return false;
    if(s.panel==='puzzle'&&!s.active)return false;
    if(s.active&&(!types[s.active.kind]||!Array.isArray(s.active.entries)||!s.active.entries.every(e=>word(e.id))||!['used','guessed','guesses','tokens','chosen','revealed','matched'].every(k=>Array.isArray(s.active[k]))))return false;
    return true;
  }
  function readSave(){try{const s=JSON.parse(localStorage.getItem(SAVE));return validSave(s)?s:null;}catch{return null;}}
  function save(){if(!g)return;try{g.savedAt=Date.now();localStorage.setItem(SAVE,JSON.stringify(g));storageWarning='';}catch{storageWarning='Speichern fehlgeschlagen. Bitte Spielstand als Datei sichern.';}if($('mazeSaveStatus'))$('mazeSaveStatus').textContent=storageWarning||'Automatisch in diesem Browser gespeichert.';}
  function resume(){const s=readSave();if(!s){$('mazeResumeStatus').textContent='Kein lesbarer Spielstand vorhanden.';return;}g=s;show();render();say('Expedition fortgesetzt. '+(g.notice||''));}
  function show(){roomArrival=null;window.ArenaAudio?.stop();if(typeof cancelComputerStep==='function')cancelComputerStep();if(typeof Fleet!=='undefined')Fleet.close();if(typeof Golf!=='undefined')Golf.close();$('setup').hidden=true;$('game').hidden=true;$('mazeGame').hidden=false;$('mazeGame').dataset.world=g.config.world;$('mazeTitle').textContent='Wörterlabyrinth · '+titles[g.config.world];}
  function back(){save();$('mazeGame').hidden=true;$('setup').hidden=false;showSetupStep(true);setupMode();updateSetup();}
  function reveal(){g.cells[g.position].visited=true;g.cells[g.position].seen=true;for(const id of g.cells[g.position].edges)g.cells[id].seen=true;for(const e of g.extras)if(e.a===g.position||e.b===g.position)g.cells[e.a===g.position?e.b:e.a].seen=true;}
  function edge(a,b){return g.extras.find(e=>(e.a===a&&e.b===b)||(e.b===a&&e.a===b));}
  function connected(a,b){return g.cells[a].edges.includes(b)||Boolean(edge(a,b)?.open);}
  function move(id){
    if(!g||g.ended||g.panel!=='explore'||!Number.isInteger(id)||!g.cells[id])return;
    const extra=edge(g.position,id);
    let passage='';
    if(extra&&!extra.open){
      if(extra.kind==='key'&&!g.sideKey){say('Diese Abkürzung braucht den blauen Schlüssel. Der reguläre Weg bleibt offen.');return;}
      if(extra.kind==='switch'&&!g.switchOn){say('Diese Abkürzung öffnet sich am Schalter.');return;}
      extra.open=true;sound('portal');passage=extra.kind==='secret'?'Geheimgang entdeckt!':'Abkürzung geöffnet.';
    }
    if(!connected(g.position,id))return;
    g.previous=g.position;g.position=id;reveal();sound('pass');const room=g.cells[id];
    roomArrival={title:'Erkundete Kammer',detail:'Der Weg ist frei.',kind:'explore'};
    if(room.event==='exit'){announceRoom('Ausgangsportal',g.keys.length===3?'Das Portal ist geöffnet.':'Schlüssel: '+g.keys.length+'/3','exit');if(g.keys.length===3){finish(true);return;}}
    else if(!room.done&&room.event==='treasure'){room.done=true;const found=3+(g.seed+id)%4;earn(found);announceRoom('Schatzkammer','+'+found+' Coins gefunden','treasure');sound('bonus');}
    else if(!room.done&&room.event==='rest'){visitRestRoom(room);}
    else if(!room.done&&room.event==='switch'){room.done=true;g.switchOn=true;g.extras.filter(e=>e.kind==='switch').forEach(e=>e.open=true);announceRoom('Schalterkammer','Eine Abkürzung wurde geöffnet','switch');sound('repair');}
    else if(!room.done&&room.event==='sideKey'){room.done=true;g.sideKey=true;announceRoom('Blaue Schlüsseltruhe','Schlüssel für eine Abkürzung gefunden','treasure');sound('bonus');}
    else if(!room.done&&['puzzle','vault','hiddenKey','fragment'].includes(room.event)){openPuzzle();return;}
    if(roomArrival.kind==='explore')announceRoom(id===0?'Eingang':'Erkundete Kammer',passage||'Der Weg ist frei.','explore');
    save();render();
  }
  function visitRestRoom(room){
    const foundHint=!room.restHintTaken;
    if(foundHint){
      room.restHintTaken=true;
      g.inventory.hint++;
    }
    if(g.config.adventure&&g.lives===g.maxLives){
      announceRoom('Rastplatz',foundHint?'+1 Hinweis · Herz bleibt im Raum':'Herz bleibt im Raum · Leben voll','rest');
      if(foundHint)sound('bonus');
      return;
    }
    room.done=true;
    g.lives=Math.min(g.maxLives,g.lives+1);
    const detail=g.config.adventure?(foundHint?'+1 Leben · +1 Hinweis':'+1 Leben'):'+1 Hinweis gefunden';
    announceRoom('Rastplatz',detail,'rest');
    sound('repair');
  }
  function announceRoom(title,detail,kind){
    roomArrival={title,detail,kind};
    say(title+' · '+detail);
  }
  function renderArrival(){
    const banner=$('mazeArrival');
    if(!roomArrival||banner.arrival===roomArrival){banner.hidden=!roomArrival;return;}
    banner.arrival=roomArrival;
    banner.dataset.kind=roomArrival.kind;
    banner.replaceChildren(node('strong',roomArrival.title),node('span',roomArrival.detail));
    banner.hidden=false;
    if(!window.matchMedia('(prefers-reduced-motion: reduce)').matches&&banner.animate){
      banner.getAnimations?.().forEach(animation=>animation.cancel());
      banner.animate([{opacity:0,transform:'translateY(8px)'},{opacity:1,transform:'translateY(0)'}],240);
    }
  }
  function eligible(entry){const word=first(entry.answer),chars=letters(word);if(entry.kind)return entry.kind;if(!chars.length)return'match';const opts=['letters','secret'];if(chars.length<=18)opts.push('hangman');if(/^\p{L}{3,12}$/u.test(word))opts.push('wordle');if(g.learning.remaining.length>=1)opts.push('match');return mix(opts)[0];}
  function openPuzzle(){
    const entry=draw(preferredKind(g.cells[g.position]));if(!entry){g.panel='learning';g.active=null;announceRoom('Rätselkammer','Alle Aufgaben dieses Durchgangs wurden gelöst.','puzzle');render();save();return;}
    const preferred=preferredKind(g.cells[g.position]);let kind=entry.kind||(['order','gap','correct','choice'].includes(preferred)?'letters':preferred);const word=first(entry.answer);
    if(kind==='wordle'&&!/^\p{L}{3,12}$/u.test(word)||kind==='hangman'&&(!letters(word).length||letters(word).length>18))kind='letters';
    const entries=[entry];
    if(kind==='match'){for(let i=0;i<2;i++){const next=draw('match');if(!next)break;if(next.kind){g.learning.inFlight=g.learning.inFlight.filter(id=>id!==next.id);g.learning.remaining.unshift(next.id);break;}entries.push(next);}if(entries.length<2)kind='letters';}
    const answer=first(entry.answer);let tokens=kind==='order'||(/\s/.test(answer)&&letters(answer).length>12) ? answer.split(/\s+/).filter(Boolean) : Array.from(answer);
    tokens=mix(tokens.map((text,id)=>({text,id})));if(tokens.map(t=>t.text).join('')===answer&&tokens.length>1)tokens.push(tokens.shift());
    g.active={kind,entries,answer,tries:kind==='hangman'||kind==='wordle'?6:3,wrong:0,used:[],guessed:[],guesses:[],tokens,chosen:[],revealed:[],matched:[],left:null,feedback:'',finished:false,outcome:null,hints:0};
    if(kind==='secret'){const indexes=Array.from(answer).map((c,i)=>/\p{L}/u.test(c)?i:-1).filter(i=>i>=0);g.active.revealed=mix(indexes).slice(0,Math.max(1,Math.floor(indexes.length*.2)));}
    if(kind==='match')g.active.rightOrder=mix(entries.map(e=>e.id));
    g.panel='puzzle';
    const chamber={vault:'Schlüsselkammer',hiddenKey:'Versiegelte Kammer',fragment:'Fragmentkammer'}[g.cells[g.position].event]||'Rätselkammer';
    announceRoom(chamber,types[kind],'puzzle');
    save();render();focusPuzzle();
  }
  function focusPuzzle(){requestAnimationFrame(()=>{$('mazeAnswer')?.focus({preventScroll:true});});}
  function earn(coins){g.coins+=coins;g.stats.coinsEarned+=coins;}
  function wordleScore(guess,target){const result=guess.map(()=>0),remaining={};for(let i=0;i<target.length;i++)if(guess[i]===target[i])result[i]=2;else remaining[target[i]]=(remaining[target[i]]||0)+1;for(let i=0;i<guess.length;i++)if(result[i]!==2&&remaining[guess[i]]){result[i]=1;remaining[guess[i]]--;}return result;}
  function attempt(value){const a=g?.active;if(!a||a.finished)return;const entry=a.entries[0];
    if(a.kind==='wordle'){
      const guess=letters(value),target=letters(a.answer);if(guess.length!==target.length){a.feedback='Bitte genau '+target.length+' Buchstaben eingeben.';renderPuzzle();focusPuzzle();return;}
      const result=wordleScore(guess,target);a.guesses.push({guess,result});if(result.every(n=>n===2)){resolve(true);return;}
    }else if(a.kind==='hangman'&&letters(value).length===1){guessLetter(letters(value)[0]);return;}
    else if(matches(value,entry.answer)){resolve(true);return;}
    a.wrong++;a.feedback='Noch nicht gelöst. '+Math.max(0,a.tries-a.wrong)+' Versuche übrig.';sound('wrong');
    if(a.wrong>=a.tries)resolve(false);else{save();renderPuzzle();focusPuzzle();}
  }
  function guessLetter(char){const a=g?.active;if(!a||a.finished||a.guessed.includes(char))return;a.guessed.push(char);if(!letters(a.answer).includes(char)){a.wrong++;sound('wrong');}else sound('right');
    if(letters(a.answer).every(c=>a.guessed.includes(c)))resolve(true);else if(a.wrong>=a.tries)resolve(false);else{save();renderPuzzle();}
  }
  function matchPair(id){const a=g.active;if(a.finished||a.left===null||a.matched.includes(id))return;if(id===a.left){a.matched.push(id);a.feedback='Richtig verbunden.';sound('right');if(a.matched.length===a.entries.length){resolve(true);return;}}else{a.wrong++;a.feedback='Diese Verbindung passt noch nicht.';sound('wrong');if(a.wrong>=a.tries){resolve(false);return;}}a.left=null;save();renderPuzzle();}
  function rewardRoom(){const room=g.cells[g.position];room.done=true;
    if(room.event==='vault'&&!g.keys.includes('vault')){g.keys.push('vault');say('Schlüsselkammer geöffnet: erster Ausgangsschlüssel!');}
    else if(room.event==='hiddenKey'&&!g.keys.includes('hidden')){g.keys.push('hidden');say('Hinter dem Rätsel lag ein Ausgangsschlüssel!');}
    else if(room.event==='fragment'){g.fragments++;say('Schlüsselfragment gefunden: '+g.fragments+'/3.');if(g.fragments===3&&!g.keys.includes('fragments')){g.keys.push('fragments');say('Drei Fragmente vereint: ein weiterer Ausgangsschlüssel!');}}
  }
  function resolve(correct,skipped=false){const a=g.active;if(!a||a.finished)return;a.finished=true;a.outcome=correct?'correct':skipped?'skipped':'wrong';g.stats.puzzles++;
    for(const e of a.entries){const mastered=correct&&!skipped||(a.kind==='match'&&a.matched.includes(e.id));record(e.id,mastered);if(!mastered&&!g.difficult.includes(e.id))g.difficult.push(e.id);}
    if(correct){g.streak++;earn(2+(a.wrong===0&&a.hints===0?1:0));rewardRoom();sound('right');if(g.streak%3===0){earn(3);const bonus=Math.random()<.5?'hint':'skip';g.inventory[bonus]++;a.feedback='Serie! +3 Coins und '+(bonus==='hint'?'ein Hinweis':'ein Überspring-Joker')+'.';sound('bonus');}}
    else{g.streak=0;if(skipped){g.stats.skips++;rewardRoom();}else{g.stats.failed++;if(g.config.adventure)g.lives--;sound('wrong');}}
    g.person=g.names.length?(g.person+1)%g.names.length:0;save();render();
  }
  function continueAfterPuzzle(){const a=g.active;if(!a?.finished)return;if(g.config.adventure&&g.lives<=0){finish(false);return;}
    if(a.outcome==='wrong'){g.position=g.previous;reveal();say('Ihr könnt einen anderen Weg wählen oder den Raum mit einer neuen Aufgabe erneut versuchen.');}
    else if(!g.notice)say('Der Weg ist frei. Wohin geht es weiter?');
    g.active=null;g.panel=g.learning.mastered.length===g.learning.items.length?'learning':'explore';save();render();
  }
  function spend(kind,cost){if(g.inventory[kind]>0){g.inventory[kind]--;return true;}if(g.coins>=cost){g.coins-=cost;return true;}say('Dafür fehlen Coins oder ein passender Joker.');return false;}
  function hint(teacher=false){const a=g?.active;if(!a||a.finished)return;if(a.kind==='match'&&a.matched.length===a.entries.length)return;
    const hidden=Array.from(a.answer).map((c,i)=>/\p{L}/u.test(c)&&!a.revealed.includes(i)&&!a.guessed.includes(c.toLowerCase())?i:-1).filter(i=>i>=0);
    if(['hangman','secret','wordle','gap','correct'].includes(a.kind)&&!hidden.length){a.feedback='Alle Buchstabenhilfen sind bereits sichtbar.';renderPuzzle();return;}
    if(a.kind==='choice'&&a.eliminated?.length){a.feedback='Die verfügbare Auswahlhilfe wurde bereits genutzt.';renderPuzzle();return;}
    if(['letters','order'].includes(a.kind)&&a.chosen.length>=a.tokens.length){a.feedback='Prüfe zuerst deinen zusammengesetzten Vorschlag.';renderPuzzle();return;}
    if(!teacher&&!spend('hint',2)){renderHUD();return;}
    g.stats.hints++;a.hints++;
    if(a.kind==='match'){const id=a.entries.find(e=>!a.matched.includes(e.id)).id;a.matched.push(id);a.feedback='Ein Wortpaar wurde verbunden.';if(a.matched.length===a.entries.length){resolve(true);return;}}
    else if(a.kind==='hangman'){if(hidden.length){a.guessed.push(Array.from(a.answer)[hidden[0]].toLowerCase());if(letters(a.answer).every(c=>a.guessed.includes(c))){resolve(true);return;}}a.feedback='Ein Buchstabe wurde aufgedeckt.';}
    else if(a.kind==='letters'||a.kind==='order'){const target=a.kind==='order'||(/\s/.test(a.answer)&&letters(a.answer).length>12)?a.answer.split(/\s+/):Array.from(a.answer);a.hintPrefix=Math.min(target.length,(a.hintPrefix||0)+1);a.chosen=[];for(const text of target.slice(0,a.hintPrefix)){const token=a.tokens.find(t=>t.text===text&&!a.chosen.includes(t.id));if(token)a.chosen.push(token.id);}a.feedback='Ein passender Anfang ist eingesetzt. Setze von hier aus weiter zusammen.';}
    else if(a.kind==='choice'){a.eliminated=a.entries[0].options.filter(v=>!matches(v,a.entries[0].answer)).slice(0,1);a.feedback='Eine falsche Möglichkeit ist entfernt.';}
    else{if(hidden.length)a.revealed.push(hidden[0]);a.feedback='Lösungshilfe: '+Array.from(a.answer).map((c,i)=>a.revealed.includes(i)||!(/\p{L}/u.test(c))?c:'_').join(' ');}
    save();renderHUD();renderPuzzle();
  }
  function skip(teacher=false){if(!g?.active||g.active.finished)return;if(!teacher&&!spend('skip',5)){renderHUD();return;}resolve(false,true);}
  function heal(){if(g.lives>=g.maxLives){say('Alle Leben sind bereits voll.');return;}if(g.coins<4){say('Heilung kostet 4 Coins.');return;}g.coins-=4;g.lives++;sound('repair');save();render();}
  function mapHint(route=false){if(g.coins<3){say('Diese Kartenhilfe kostet 3 Coins.');return;}g.coins-=3;g.stats.hints++;const target=g.cells.find(c=>!c.done&&['vault','fragment','hiddenKey'].includes(c.event))?.id??g.exit;
    if(route){const prev=pathTo(g.position,target);g.trail=prev;say('Der Weg zum nächsten Schlüsselziel ist auf der Karte markiert.');prev.forEach(id=>g.cells[id].seen=true);}else{const unknown=g.cells.filter(c=>!c.seen);unknown.sort((a,b)=>Math.abs(a.id-target)-Math.abs(b.id-target));unknown.slice(0,6).forEach(c=>c.seen=true);say('Ein Kartenausschnitt wurde aufgedeckt.');}save();render();}
  function pathTo(start,target){const q=[start],prev=new Map([[start,null]]);for(let i=0;i<q.length;i++){const id=q[i];if(id===target)break;for(const n of g.cells[id].edges)if(!prev.has(n)){prev.set(n,id);q.push(n);}}const path=[];let at=target;while(at!=null&&prev.has(at)){path.unshift(at);at=prev.get(at);}return path;}
  function finish(won,learning=false){g.ended=true;g.won=won;g.learningEnd=learning;g.panel='end';g.active=null;save();sound(learning?'bonus':won?'win':'lose');render();}
  function renderHUD(){if(!g)return;const hud=$('mazeHUD');hud.replaceChildren(node('span','Schlüssel '+g.keys.length+'/3'),node('span','Fragmente '+g.fragments+'/3'),node('span',(g.config.adventure?'♥ '+g.lives+'/'+g.maxLives:'Entspannt · ohne Lebensverlust')),node('span','◉ '+g.coins+' Coins'),node('span','Hinweise '+g.inventory.hint+' · Überspringen '+g.inventory.skip));$('mazeTurn').textContent=g.names.length ? g.names[g.person]+' ist dran · '+(g.person+1)+'/'+g.names.length : 'Gemeinsam erkunden';$('mazeSaveStatus').textContent=storageWarning||'Automatisch in diesem Browser gespeichert.';}
  function render(){if(!g)return;renderHUD();renderArrival();$('mazeNotice').textContent=g.notice||'';drawMap();const panel=$('mazePanel');panel.replaceChildren();if(g.panel==='puzzle')renderPuzzle();else if(g.panel==='learning')renderLearning();else if(g.panel==='end')renderEnd();else renderExplore();}
  function renderExplore(){const panel=$('mazePanel');panel.append(node('p','EXPEDITION','mazeEyebrow'),node('h3','Wohin geht es weiter?'),node('p','Klicke einen angrenzenden Raum oder nutze Pfeiltasten und Richtungsknöpfe. Rätselarten sind sichtbar; die Schwierigkeit entdeckt ihr unterwegs.'));
    const moves=node('div',null,'mazeMoves');const pos=g.position,size=g.size;for(const [label,id]of [['↑',pos-size],['←',pos%size?pos-1:-1],['↓',pos+size],['→',pos%size<size-1?pos+1:-1]]){const b=button(label,()=>move(id));b.setAttribute('aria-label',{'↑':'Nach Norden','←':'Nach Westen','↓':'Nach Süden','→':'Nach Osten'}[label]);b.disabled=!g.cells[id]||(!g.cells[pos].edges.includes(id)&&!edge(pos,id));moves.append(b);}panel.append(moves);
    for(const id of g.cells[pos].edges){const room=g.cells[id],kind=room.done?'Erkundeter Raum':roomLabel(room);panel.append(button(kind+' betreten',()=>move(id),'mazePath'));}
    for(const e of g.extras.filter(e=>e.a===pos||e.b===pos)){panel.append(button((e.kind==='secret'?'Schimmernde Wand untersuchen':e.kind==='key'?'Blaue Schlüsseltür': 'Schaltertor')+(e.open?' · offen':''),()=>move(e.a===pos?e.b:e.a),'mazePath'));}
    const shop=node('details');shop.append(node('summary','Vorräte und Kartenhilfen'));shop.append(button('Kartenausschnitt · 3 Coins',()=>mapHint()),button('Weg zum Schlüssel · 3 Coins',()=>mapHint(true)));if(g.config.adventure)shop.append(button('Ein Leben heilen · 4 Coins',heal));panel.append(shop);
    const legend=node('p','◆ Schlüsselkammer · ◇ Fragment · ? Rätsel · ▣ Schatz · ↟ Schalter · ◎ Ausgang','mazeLegend');panel.append(legend);
  }
  function roomLabel(room){if(room.id===0)return'Eingang';const kind=types[g?.active&&g.position===room.id&&g.panel==='puzzle'?g.active.kind:nextKind(room)]||'Sprachrätsel';if(room.event==='exit')return'Ausgangsportal';if(room.event==='vault')return'Schlüsselkammer · '+kind;if(room.event==='hiddenKey')return'Versiegelte Kammer · '+kind;if(room.event==='fragment')return'Fragmentkammer · '+kind;if(room.event==='treasure')return'Schatzraum';if(room.event==='rest')return'Rastplatz';if(room.event==='switch')return'Schalterraum';if(room.event==='sideKey')return'Blaue Schlüsseltruhe';return kind;}
  function renderPuzzle(){const a=g.active;if(!a)return;const panel=$('mazePanel');panel.replaceChildren();panel.append(node('p',roomLabel(g.cells[g.position]),'mazeEyebrow'),node('h3',types[a.kind]));
    if(a.finished){if(a.kind==='wordle'&&a.guesses.length)renderWordle(panel,a,false);const label=a.outcome==='correct'?'Gelöst!':a.outcome==='skipped'?'Rätsel übersprungen':'Rätsel nicht geschafft';panel.append(node('h4',label),node('p',a.entries.map(e=>e.prompt+' → '+e.answer).join(' · '),'mazeSolution'));if(a.outcome==='wrong')panel.append(node('p',g.config.adventure?'Ein Leben verloren.':'Ihr könnt ohne Lebensverlust weiterspielen.'));if(a.feedback)panel.append(node('p',a.feedback));panel.append(button(g.lives<=0&&g.config.adventure?'Ergebnis ansehen':'Weiter erkunden',continueAfterPuzzle,'mazePrimary'),node('p','Auch mit Enter oder Klick auf eine freie Fläche.','mazeSmall'));return;}
    const e=a.entries[0],turn=node('p',g.names.length?g.names[g.person]+' löst dieses Rätsel':'Löst das Rätsel gemeinsam.','mazeTurn');panel.append(turn);
    let prompt=e.prompt;if(a.kind==='wordle')prompt=(e.theme?'Thema: '+e.theme:'Kein Thema hinterlegt')+' · '+letters(a.answer).length+' Buchstaben';
    if(a.kind!=='match')panel.append(node('p',prompt,'mazePrompt'));
    panel.append(node('p',`${a.tries-a.wrong} Versuche · Hinweis: 2 Coins oder Joker · Überspringen: 5 Coins oder Joker`,'mazeSmall'));
    if(a.kind==='letters'||a.kind==='order')renderTokens(panel,a);
    else if(a.kind==='hangman')renderHangman(panel,a);
    else if(a.kind==='wordle')renderWordle(panel,a);
    else if(a.kind==='match')renderMatch(panel,a);
    else if(a.kind==='choice'){for(const option of e.options.filter(v=>!a.eliminated?.includes(v)))panel.append(button(option,()=>attempt(option),'mazePath'));}
    else{if(a.kind==='secret')panel.append(node('p',Array.from(a.answer).map((c,i)=>a.revealed.includes(i)||!(/\p{L}/u.test(c))?c:'_').join(' '),'mazeSecret'));answerForm(panel,a.kind==='correct'?'Korrigierten Satz eingeben':'Lösung eingeben');}
    if(a.feedback)panel.append(node('p',a.feedback,'mazeFeedback'));
    const helpers=node('div',null,'mazeHelpers');helpers.append(button('Hinweis',()=>hint()),button('Überspringen',()=>skip()));panel.append(helpers);
    const teacher=node('details');teacher.append(node('summary','Lehrkraft · Eingreifen'));teacher.append(button('Mündliche Lösung bestätigen',()=>resolve(true)),button('Hinweis ohne Kosten',()=>hint(true)),button('Ohne Kosten überspringen',()=>skip(true)));panel.append(teacher);
  }
  function answerForm(panel,label){const f=node('form');const l=node('label',label);l.htmlFor='mazeAnswer';const input=node('input');input.id='mazeAnswer';input.autocomplete='off';input.spellcheck=false;input.required=true;const send=node('button','Prüfen','mazePrimary');send.type='submit';f.append(l,input,send);f.onsubmit=ev=>{ev.preventDefault();attempt(input.value);};panel.append(f);}
  function renderTokens(panel,a){const sentence=a.kind==='order'||(/\s/.test(a.answer)&&letters(a.answer).length>12),sep=sentence?'':'',chosen=node('div',null,'mazeChosen');chosen.setAttribute('aria-label','Zusammengesetzte Lösung');chosen.tabIndex=0;chosen.ondragover=ev=>ev.preventDefault();chosen.ondrop=ev=>{ev.preventDefault();const id=Number(ev.dataTransfer.getData('text/plain'));if(a.tokens.some(t=>t.id===id)&&!a.chosen.includes(id)){a.chosen.push(id);save();renderPuzzle();}};
    for(const id of a.chosen){const token=a.tokens.find(t=>t.id===id);chosen.append(button(token.text===' '?'␣':token.text,()=>{a.chosen=a.chosen.filter(n=>n!==id);save();renderPuzzle();}));}if(!a.chosen.length)chosen.append(node('span','Bausteine hier zusammensetzen'));
    panel.append(chosen);const bank=node('div',null,'mazeTokens');for(const t of a.tokens){const b=button(t.text===' '?'␣':t.text,()=>{a.chosen.push(t.id);save();renderPuzzle();});b.disabled=a.chosen.includes(t.id);b.draggable=!b.disabled;b.ondragstart=ev=>ev.dataTransfer.setData('text/plain',String(t.id));bank.append(b);}panel.append(bank,button('Zurücksetzen',()=>{a.chosen=[];save();renderPuzzle();}),button('Zusammensetzung prüfen',()=>attempt(a.chosen.map(id=>a.tokens.find(t=>t.id===id).text).join(sentence?' ':sep)),'mazePrimary'));}
  function renderHangman(panel,a){const mask=Array.from(a.answer).map(c=>!(/\p{L}/u.test(c))||a.guessed.includes(c.toLowerCase())?c:'_');panel.append(node('p',mask.join(' '),'mazeSecret'),node('p','Runen: '+'◆'.repeat(Math.max(0,a.tries-a.wrong))+'◇'.repeat(a.wrong),'mazeRunes'));const keys=node('div',null,'mazeKeyboard');for(const c of Array.from('abcdefghijklmnopqrstuvwxyzäöüß')){const b=button(c.toUpperCase(),()=>guessLetter(c));b.disabled=a.guessed.includes(c);keys.append(b);}panel.append(keys);answerForm(panel,'Ganzes Wort versuchen');}
  function renderWordle(panel, puzzle, interactive = true) {
    const length = letters(puzzle.answer).length;
    const grid = node('div', null, 'mazeWordle');
    grid.style.setProperty('--word-length', length);
    grid.setAttribute('role', 'group');
    grid.setAttribute('aria-label', 'Wordle-Spielbrett');
    const activeTiles = [];
    for (let turn = 0; turn < puzzle.tries; turn++) {
      const guess = puzzle.guesses[turn];
      const row = node('div', null, 'mazeWordleRow');
      const active = interactive && turn === puzzle.guesses.length;
      row.classList.toggle('active', active);
      const outcomes = ['fehlt', 'falsche Stelle', 'richtige Stelle'];
      row.setAttribute('aria-label', guess
        ? `Versuch ${turn + 1}: ${guess.guess.map((letter, i) => letter + ' ' + outcomes[guess.result[i]]).join(', ')}`
        : `Versuch ${turn + 1}`);
      for (let col = 0; col < length; col++) {
        const tile = node('span', guess?.guess[col]?.toLocaleUpperCase('de') ?? '', 'mazeLetter');
        tile.setAttribute('aria-hidden', 'true');
        if (guess) tile.classList.add('score' + guess.result[col]);
        if (active) activeTiles.push(tile);
        row.append(tile);
      }
      grid.append(row);
    }
    panel.append(grid, node('p', 'Grün = richtige Stelle · Gold = andere Stelle · Grau = nicht enthalten', 'mazeLegend'));
    if (!interactive) return;
    answerForm(panel, 'Wort eingeben');
    const input = $('mazeAnswer');
    input.addEventListener('input', () => {
      const typed = letters(input.value);
      activeTiles.forEach((tile, col) => {
        tile.textContent = typed[col]?.toLocaleUpperCase('de') ?? '';
      });
    });
  }
  function renderMatch(panel,a){panel.append(node('p','Wähle links einen Begriff und rechts seine passende Übersetzung.','mazePrompt'));const grid=node('div',null,'mazeMatch'),left=node('div'),right=node('div');for(const e of a.entries){const b=button(e.prompt,()=>{a.left=e.id;renderPuzzle();},'mazePath');b.disabled=a.matched.includes(e.id);b.setAttribute('aria-pressed',String(a.left===e.id));left.append(b);}for(const id of a.rightOrder){const e=a.entries.find(e=>e.id===id),b=button(e.answer,()=>matchPair(id),'mazePath');b.disabled=a.matched.includes(id);right.append(b);}grid.append(left,right);panel.append(grid);}
  function renderLearning(){const p=$('mazePanel');p.append(node('h3','Alle Aufgaben einmal richtig gelöst!'),node('p','Möchtest du aufhören oder die Auswahl zurücksetzen und im selben Labyrinth weiterspielen?'),button('Zurücksetzen und weiterspielen',()=>{g.learning=freshLearning(g.learning.items);g.panel='explore';save();render();},'mazePrimary'),button('Lerndurchgang beenden',()=>finish(false,true)));}
  function renderEnd(){const p=$('mazePanel'),stars=g.won?Math.max(1,3-Math.floor((g.stats.failed+g.stats.skips+g.stats.hints/3)/4)):0;if(!g.learningEnd){const art=node('div',null,'gameResultArt '+(g.won?'win':'lose'));art.setAttribute('role','img');art.setAttribute('aria-label',g.won?'You Win':'Game Over');p.append(art);}p.append(node('p',g.learningEnd?'LERNDURCHGANG BEENDET':g.won?'YOU WIN':'GAME OVER','mazeEyebrow'),node('h3',g.learningEnd?'Gut geübt!':g.won?'Dem Labyrinth entkommen!':'Die Expedition endet hier.'),node('p','★'.repeat(stars)+'☆'.repeat(3-stars),'mazeStars'),node('p',`${g.stats.puzzles} Rätsel · ${g.stats.failed} gescheitert · ${g.stats.hints} Hilfen · ${g.stats.skips} übersprungen`),node('p',`${g.learning.mastered.length}/${g.learning.items.length} Aufgaben richtig gelöst · ${g.stats.coinsEarned} Coins verdient`));const difficult=node('details');difficult.append(node('summary','Schwierige Wörter und Aufgaben'));for(const id of g.difficult){const e=g.learning.items[id];difficult.append(node('p',e.prompt+' → '+e.answer));}p.append(difficult,button('Mit denselben Einstellungen neu starten',()=>{const vocabulary=g.vocabulary,cfg=g.config;start(vocabulary,cfg);},'mazePrimary'),button('Zur Spielauswahl',back));}
  const mapCell = 64, mapInset = 20;
  const mapArt = {
    castle: {stone:'#364762', light:'#8492a2', face:'#525d75', dark:'#202940', floor:['#343d51','#424d62','#4d596b'], trim:'#a7a5a5', motif:'torch'},
    jungle: {stone:'#34472d', light:'#a0aa65', face:'#667342', dark:'#26372a', floor:['#384938','#455940','#51644a'], trim:'#bdb27a', motif:'vine'},
    library: {stone:'#4a3257', light:'#ad80a4', face:'#795478', dark:'#2e2546', floor:['#473450','#543b58','#614764'], trim:'#dbb0ac', motif:'books'}
  };
  function paintRoom(paint,art,room,x,y) {
    const rect=(color,left,top,width,height)=>paint(color,x+left,y+top,width,height);
    rect('#060a12',4,7,59,55);
    rect(art.stone,1,2,60,57);
    rect(art.dark,5,15,54,40);
    // The floor sits below the masonry. Offset seams and chips break up the tile grid.
    for(let row=0;row<4;row++){
      for(let col=0;col<4;col++){
        const n=room.id*17+row*11+col*13;
        const left=7+col*12, top=17+row*9;
        rect(art.floor[n%3],left,top,11,8);
        rect(art.floor[(n+1)%3],left+1,top,9,1);
        rect('#0002',left+2+n%5,top+3+n%3,2,1);
      }
    }
    // Taller rear walls, side piers and angled shadows give each room depth.
    rect('#0006',5,14,53,8);
    rect(art.light,2,2,58,2);
    rect(art.dark,2,4,58,11);
    for(let row=0;row<2;row++){
      for(let col=0;col<6;col++){
        const left=2+col*10+row*5;
        const width=Math.min(9,60-left);
        if(width<3) continue;
        rect(art.face,left,4+row*5,width,4);
        rect(art.light,left+1,4+row*5,width-1,1);
        if((col+row+room.id)%3===0)rect(art.stone,left+2,6+row*5,Math.min(width-2,3),1);
      }
    }
    rect(art.stone,2,15,5,39);
    rect(art.light,2,15,1,37);
    rect(art.dark,7,20,3,32);
    rect(art.stone,55,15,5,39);
    rect(art.light,55,16,1,37);
    rect(art.face,2,54,58,4);
    rect(art.light,2,54,58,1);
    rect(art.dark,2,58,58,2);

    paintFurnishings(rect,art,room);
  }
  // Layout coordinates are in the 64-pixel room tile. Door centres stay fixed.
  const chamberPlans={
    torch:[
      [[8,9,21,21,'hearth'],[36,40,16,11,'bench']],
      [[9,13,13,32,'rack'],[36,10,17,13,'crate']],
      [[13,11,38,13,'table'],[11,39,11,12,'crate'],[37,39,15,12,'bench']],
      [[9,10,15,16,'relic'],[40,10,13,16,'relic'],[9,43,13,9,'bench']],
      [[8,9,15,42,'wall'],[40,39,13,13,'crate']],
      [[37,9,17,32,'rack'],[9,40,15,12,'table']],
      [[12,11,40,14,'table'],[10,34,13,18,'bench'],[41,34,13,18,'bench']],
      [[10,13,15,18,'crate'],[34,8,20,21,'hearth'],[33,40,17,12,'bench']],
      [[8,12,14,35,'rack'],[39,11,15,36,'wall']]
    ],
    vine:[
      [[9,10,19,28,'water'],[36,39,17,13,'leaves']],
      [[10,10,14,13,'leaves'],[40,10,14,14,'leaves'],[12,38,37,13,'water']],
      [[8,11,18,15,'relic'],[39,12,15,18,'leaves'],[9,38,14,13,'relic']],
      [[10,13,13,36,'leaves'],[24,9,28,12,'wall'],[40,39,14,12,'water']],
      [[10,12,34,16,'water'],[10,31,14,19,'water'],[39,39,15,12,'leaves']],
      [[39,10,15,34,'water'],[10,11,17,15,'relic'],[9,39,14,12,'leaves']],
      [[9,9,14,17,'leaves'],[41,9,13,17,'leaves'],[9,42,14,10,'leaves'],[41,42,13,10,'leaves']],
      [[9,12,17,13,'wall'],[37,14,17,12,'wall'],[17,39,31,13,'relic']],
      [[9,9,16,43,'water'],[39,9,15,43,'leaves']]
    ],
    books:[
      [[9,9,13,31,'rack'],[36,39,16,12,'table']],
      [[9,9,44,13,'rack'],[11,38,14,13,'relic']],
      [[9,10,14,30,'rack'],[40,10,14,30,'rack']],
      [[9,10,18,21,'table'],[37,38,16,14,'table']],
      [[36,9,18,24,'relic'],[9,36,16,16,'bench']],
      [[9,9,29,14,'rack'],[41,10,13,42,'rack'],[11,38,12,13,'table']],
      [[10,11,14,17,'relic'],[39,11,14,17,'relic'],[19,40,25,11,'table']],
      [[9,10,17,15,'bench'],[37,37,17,15,'rack'],[8,36,14,15,'relic']],
      [[9,9,14,43,'rack'],[28,10,26,12,'table'],[40,40,14,12,'bench']]
    ]
  };
  const chamberObjects={
    armor:{colors:['#202635','#475a73','#879cad','#dce5da','#bb9465'],rows:[
      '....111....','...13421...','...14321...','...11121...','..1122211..',
      '.133434221.','13323432221','12223432221','.112343211.','..1233321..',
      '..1115111..','..1321321..','..1321321..','..121.121..','..121.121..',
      '.1331.1331.','11111111111']},
    bookshelf:{colors:['#291c31','#583748','#a76f58','#d7a96d','#aa5d76','#6baaa5','#8b87ba'],rows:[
      '.33333333333.','1344444444431','1311111111131','1355167144131',
      '1354667144131','1355667744131','1333333333331','1311111111131',
      '1377446155131','1377446655131','1373446655131','1333333333331',
      '1311111111131','1344556177131','1344556677131','1343556677131',
      '1333333333331','1222222222221','.11.......11.']},
    chest:{colors:['#231c20','#50342c','#85513a','#b17b4d','#798070','#bbba92','#dbc684'],rows:[
      '...1111111...','..133434341..','.13454435441.',
      '1354544354341','1353335353341','1565555555651',
      '1233327623331','1234327524331','1233322223331',
      '1252333332531','1222322322221','.11111111111.']},
    fern:{colors:['#203628','#3c623e','#6c9a50','#a4bf60','#9d7954'],rows:[
      '.....4.....','....34.....','.3..33..4..','..3333.43..',
      '...233433..','.4..2332.3.','..4333233..','....232....',
      '...15551...','....555....','....111....']},
    flame:{colors:['#2b222b','#8a4a38','#cb6a39','#ffc263','#fff0ae'],rows:[
      '.....4.....','....43.....','....443....','...3443....','..334443...',
      '..3445433..','.334455443.','.344455443.','..3444443..',
      '11111111111','.222222222.','..1111111..']}
  };
  function paintChamberObject(rect,name,x,y,width,height){
    const {colors,rows}=chamberObjects[name];
    const scale=Math.min(width/rows[0].length,height/rows.length);
    const left=x+Math.round((width-rows[0].length*scale)/2);
    const top=y+Math.round(height-rows.length*scale);
    rows.forEach((row,iy)=>Array.from(row).forEach((shade,ix)=>{
      if(shade==='.')return;
      const px=left+Math.round(ix*scale), py=top+Math.round(iy*scale);
      const w=left+Math.round((ix+1)*scale)-px;
      const h=top+Math.round((iy+1)*scale)-py;
      if(w&&h)rect(colors[Number(shade)-1],px,py,w,h);
    }));
  }
  function paintFurnishings(rect,art,room) {
    const index=room.id%9, band=Math.floor(room.id/9);
    const jungle=art.motif==='vine', castle=art.motif==='torch';
    const edge=castle?'#ad7860':jungle?'#9dba70':'#ad8bc3';
    const wood=castle?'#654339':jungle?'#536342':'#624369';
    const gold=jungle?'#e8d58a':'#e9bb83';
    const light=castle?'#ffa65c':jungle?'#c6dc85':'#add8fa';
    const dark='#191825';
    const plan=chamberPlans[art.motif][index];

    // Paving changes direction and width independently of the furniture.
    const lane=9+band*4;
    if(index%2===0){
      rect(wood,lane,16,12,37);
      rect(edge,lane+1,17,1,35);
      rect(edge,lane+10,17,1,35);
    }else{
      rect(wood,8,lane+8,47,9);
      rect(edge,9,lane+9,45,1);
      rect(edge,9,lane+15,45,1);
    }
    for(const [left,top,w,h,feature] of plan){
      const x=band%2===0?left:64-left-w, y=top;
      const object={rack:castle?'armor':'bookshelf',crate:'chest',leaves:'fern',hearth:'flame'}[feature];
      if(object){
        rect('#0007',x+2,y+h-2,w-4,3);
        paintChamberObject(rect,object,x,y,w,h);
        continue;
      }
      rect('#0008',x+2,y+3,w,h);
      rect(dark,x,y,w,h);
      rect(feature==='wall'?art.face:wood,x+1,y+1,w-2,h-3);
      rect(edge,x+2,y+1,w-4,1);
      if(feature==='water'){
        rect('#274e4d',x+2,y+2,w-4,h-4);
        for(let row=4;row<h-3;row+=4)rect('#689994',x+3+row%3,y+row,w-9,1);
      }else if(feature==='relic'){
        rect(dark,x+3,y+4,w-6,h-7);
        rect(light+'55',x+3,y+4,w-6,h-7);
        rect(light,x+Math.floor(w/2)-2,y+4,4,h-8);
        rect(gold,x+Math.floor(w/2)-4,y+h-6,8,2);
      }else{
        rect(gold,x+3,y+3,w-6,1);
        rect(dark,x+3,y+h-5,w-6,1);
      }
    }
    // Landmarks are set into the back wall above the walking area.
    const mark={exit:'gate',treasure:'chest',sideKey:'chest',rest:'fire',switch:'lever',
      vault:'altar',hiddenKey:'altar',fragment:'altar'}[room.event];
    if(!mark)return;
    const x=25,y=6;
    if(mark==='chest'||mark==='fire'){
      paintChamberObject(rect,mark==='chest'?'chest':'flame',22,6,20,18);
      return;
    }
    rect(dark,x,y,14,15);
    rect(art.light,x+1,y,12,2);
    if(mark==='gate'){
      rect(art.face,x,y+2,3,13);
      rect(art.face,x+11,y+2,3,13);
      rect(light,x+4,y+3,6,10);
    }else{
      rect(art.face,x+1,y+10,12,4);
      rect(light,x+5,y+5,5,5);
      rect(gold,x+7,y+3,2,4);
    }
  }
  const mapSprites = {
    key: ['.gg...','gyyg..','gyyg..','.ggyyy','...y.y','......'],
    shard: ['..b...','.bwb..','bwwbb.','bbbbb.','.bbb..','..b...'],
    chest: ['.gggg.','gyyyyg','gggggg','ggrrgg','grrrrg','gggggg'],
    heart: ['.rr.rr.','rrrrrrr','rwrwrrr','.rrrrr.','..rrr..','...r...'],
    switch: ['....ww','....by','...b..','..b...','.bbb..','bbbbbb'],
    puzzle: ['.yyyy.','yy..yy','...yy.','..yy..','......','..yy..'],
    exit: ['.bbbb.','bbwwbb','bw..wb','bw..wb','bw..wb','bbbbbb'],
    done: ['.....b','....bb','b..bb.','bbbb..','.bb...','......'],
    hero: ['..gggg..','.gggggg.','.gwwwwg.','..wwbw..','.rrrrrr.','.brrr.b.','..bbbb..','..g..g..']
  };
  function drawMap() {
    if (!g) return;
    const canvas = $('mazeCanvas'), ctx = canvas.getContext('2d');
    if (!ctx) return;
    const {size, cells, position} = g;
    const world = g.config.world, theme = palette[world], art = mapArt[world];
    canvas.width = canvas.height = size * mapCell + mapInset * 2;
    ctx.imageSmoothingEnabled = false;
    const paint = (color,x,y,w,h) => { ctx.fillStyle = color; ctx.fillRect(x,y,w,h); };
    const xy = id => [mapInset + id % size * mapCell, mapInset + Math.floor(id / size) * mapCell];
    const colors = {g:'#855138', y:'#ffe094', w:'#fff0d2', b:'#82d8db', r:'#ed777d'};
    const sprite = (name,x,y,scale,blue=false) => {
      mapSprites[name].forEach((row,j) => [...row].forEach((pixel,i) => {
        if (pixel !== '.') paint(blue && pixel === 'y' ? colors.b : colors[pixel],x+i*scale,y+j*scale,scale,scale);
      }));
    };
    paint(theme.fog,0,0,canvas.width,canvas.height);
    ctx.strokeStyle = art.stone;
    ctx.lineWidth = 4;
    ctx.strokeRect(7,7,canvas.width-14,canvas.height-14);
    for (const room of cells) {
      const [x,y] = xy(room.id);
      for (let i=0;i<4;i++) paint('#ffffff0d',x+8+(room.id*13+i*19)%48,y+8+(room.id*7+i*23)%48,2,2);
      if (!room.seen) continue;
      paintRoom(paint,art,room,x,y);
    }
    for (const room of cells) {
      if (!room.seen) continue;
      const [x,y] = xy(room.id);
      for (const to of room.edges) {
        if (to <= room.id || !cells[to].seen) continue;
        const across = to === room.id+1;
        const cx=x+(across?54:22), cy=y+(across?23:53);
        paint(art.stone,cx,cy,20,across?18:21);
        paint(art.light,cx,cy,across?20:1,across?1:21);
        paint(art.dark,cx+(across?0:18),cy+(across?16:0),across?20:2,across?2:21);
        paint(art.floor[1],cx+(across?0:3),cy+(across?3:0),across?20:14,across?12:21);
        paint(art.floor[2],cx+(across?8:4),cy+(across?4:9),across?2:12,across?10:2);
      }
      if (!room.visited) paint('#080f1d30',x+8,y+9,47,47);
      if (g.trail?.includes(room.id)) paint('#a7efff',x+29,y+50,6,3);
    }
    for (const gate of g.extras) {
      if (!cells[gate.a].seen || !cells[gate.b].seen) continue;
      const [ax,ay]=xy(gate.a), [bx,by]=xy(gate.b);
      const x=(ax+bx)/2+30, y=(ay+by)/2+30, across=ax!==bx;
      const color={key:'#82d8ff',secret:'#d4a0ff',switch:'#ffcf75'}[gate.kind];
      const blocks=gate.open?5:3, step=gate.open?4:7;
      for(let i=0;i<blocks;i++) paint(color,x+(across?-8+i*step:0),y+(across?0:-8+i*step),4,4);
    }
    const icons={vault:'key',hiddenKey:'key',fragment:'shard',treasure:'chest',rest:'heart',switch:'switch',sideKey:'key',puzzle:'puzzle',exit:'exit'};
    for (const room of cells) {
      if (!room.seen || room.id===position) continue;
      const icon=room.done?'done':icons[room.event];
      if (!icon) continue;
      const [x,y]=xy(room.id);
      paint('#100f22',x+40,y+41,15,14);
      paint(art.light,x+40,y+41,15,1);
      sprite(icon,x+41,y+43,2,room.event==='sideKey');
    }
    const [x,y]=xy(position);
    paint(theme.accent,x+3,y+3,56,2);
    paint('#0008',x+17,y+50,22,4);
    sprite('hero',x+18,y+31,3);
    $('mazeMapDescription').textContent = 'Position: Zeile '+(Math.floor(position/size)+1)+', Spalte '+(position%size+1)+'. '+cells[position].edges.map(id=>roomLabel(cells[id])).join(', ')+'.';
    fitMap();
  }
  function fitMap(){const canvas=$('mazeCanvas');if(!canvas||$('mazeGame').hidden)return;if(!window.matchMedia('(min-height:560px)').matches){canvas.style.width='';canvas.style.height='';return;}const box=canvas.parentElement.getBoundingClientRect(),side=Math.floor(Math.min(box.width-20,box.height-68));if(side>0){canvas.style.width=side+'px';canvas.style.height=side+'px';}}
  function updateSetup(){if(!$('mazeOptions'))return;if($('deckTheme'))$('deckTheme').closest('label').hidden=$('vocabSource').value!=='custom';$('mazeOptions').hidden=$('mode').value!=='maze';const source=$('mazeSource').value;if($('mode').value==='maze'&&['custom','mixed'].includes(source)){const ids=[...document.querySelectorAll('#deckOptions input:checked')].map(n=>Number(n.value)),selection=JSON.stringify([$('vocabSource').value,ids,$('deckTitle').value,$('deckTheme').value]);if(selection!==themeSelection){const themes=$('vocabSource').value==='saved'?ids.map(id=>deckRecords[id]?.theme).filter(t=>typeof t==='string'&&t.trim()):[$('deckTheme').value].filter(Boolean);$('mazeListTheme').value=[...new Set(themes)].join(' / ').slice(0,100);themeSelection=selection;}}if($('mode').value==='maze')$('pairs').required=$('vocabSource').value==='custom'&&!['builtin','grammar'].includes(source);$('mazeBuiltins').hidden=!['builtin','mixed'].includes(source);$('mazeGrammar').hidden=!['grammar','mixed'].includes(source);$('mazeThemeWrap').hidden=!['custom','mixed'].includes(source);const select=$('mazeClass'),old=select.value;select.replaceChildren(new Option('Gemeinsam / Einzelperson',''),...classRecords.map((r,i)=>new Option(r.title,String(i))));select.value=old;$('mazeResume').disabled=!readSave();if($('mode').value==='maze'&&['builtin','grammar'].includes(source)){const count=buildPool({cards:[],direction:$('direction').value},config()).length;$('settingsSummary').textContent=count+' Aufgaben · '+(source==='grammar'?'Grammar':'Eingebaute Sammlungen')+' · '+$('mazeDifficulty').selectedOptions[0].textContent;$('error').hidden=true;}}
  function exportSave(){save();if(!g)return;const link=node('a');const url=URL.createObjectURL(new Blob([JSON.stringify(g)],{type:'application/json'}));link.href=url;link.download='Woerterlabyrinth-Spielstand.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
  function editVocabulary(){editing=true;$('mazeGame').hidden=true;$('setup').hidden=false;showSetupStep(false);$('chooseGame').hidden=true;$('mazeApplyVocabulary').hidden=false;$('mazeCancelVocabulary').hidden=false;}
  function leaveEdit(apply){if(apply){const v=readVocabulary();if(!v)return;if(v.selectionKey===g.vocabulary.selectionKey||['grammar','builtin'].includes(g.config.source)){g.vocabulary=v;editing=false;$('mazeApplyVocabulary').hidden=true;$('mazeCancelVocabulary').hidden=true;show();save();render();return;}const items=buildPool(v,g.config);if(!items.length)return;if(g.active&&!g.active.finished&&!confirm('Beim Ändern der Auswahl wird das aktuelle Rätsel neu begonnen. Übernehmen?'))return;g.vocabulary=v;g.learning=freshLearning(items);g.difficult=[];g.active=null;g.panel='explore';say('Vokabelauswahl angepasst. Der Fortschritt im Labyrinth bleibt erhalten.');}editing=false;$('mazeApplyVocabulary').hidden=true;$('mazeCancelVocabulary').hidden=true;show();save();render();}
  const mazeControls='button, a, input, textarea, select, label, summary, [contenteditable], [role="button"]';
  function canContinueMaze(){
    return g?.panel==='puzzle' && g.active?.finished;
  }
  function continueOnBackgroundClick(event){
    if(!canContinueMaze() || event.defaultPrevented || event.target.closest(mazeControls) || document.getSelection()?.toString())return;
    continueAfterPuzzle();
  }
  function handleMazeKey(event){
    if($('mazeGame')?.hidden!==false || !g || event.defaultPrevented || event.isComposing ||
       event.altKey || event.ctrlKey || event.metaKey || event.target.closest?.(mazeControls))return;
    if(event.key==='Enter' && canContinueMaze()){
      event.preventDefault();
      if(!event.repeat)continueAfterPuzzle();
      return;
    }
    if(g.panel!=='explore')return;
    const delta={ArrowUp:-g.size,ArrowDown:g.size,ArrowLeft:-1,ArrowRight:1}[event.key];
    if(delta==null)return;
    event.preventDefault();
    if(event.key==='ArrowLeft'&&g.position%g.size===0 || event.key==='ArrowRight'&&g.position%g.size===g.size-1)return;
    move(g.position+delta);
  }
  function bind(){
    const options=node('fieldset');options.id='mazeOptions';options.hidden=true;options.innerHTML=`<legend>Wörterlabyrinth</legend>
      <div class="options"><label>Themenwelt <select id="mazeWorld"><option value="castle">Burgruine</option><option value="jungle">Dschungeltempel</option><option value="library">Magische Bibliothek</option></select></label><label>Größe <select id="mazeSize"><option value="5">Klein · 25 Räume</option><option value="7" selected>Mittel · 49 Räume</option><option value="9">Groß · 81 Räume</option></select></label><label>Spielweise <select id="mazeDifficulty"><option value="relaxed">Entspannt · ohne Niederlage</option><option value="adventure">Abenteuer · 5 Leben</option></select></label></div>
      <label>Lerninhalt <select id="mazeSource"><option value="custom">Ausgewählte Vokabeln / Listen</option><option value="builtin">Eingebaute Vokabelsammlungen</option><option value="grammar">Grammar</option><option value="mixed">Gemischt · Auswahl + Sammlungen + Grammar</option></select></label>
      <label id="mazeThemeWrap">Thema der eigenen Liste (optional, für Wordle) <input id="mazeListTheme" maxlength="100" placeholder="z. B. Shopping"><small>Ohne Thema zeigt Wordle nur die Wortlänge.</small></label>
      <fieldset id="mazeBuiltins" hidden><legend>Eingebaute Sammlungen</legend><label><input type="checkbox" name="mazeBank" value="school" checked> Schule</label><label><input type="checkbox" name="mazeBank" value="travel" checked> Reisen</label><label><input type="checkbox" name="mazeBank" value="everyday" checked> Alltag</label></fieldset>
      <fieldset id="mazeGrammar" hidden><legend>Grammatikthemen</legend>${Object.entries(topics).map(([id,title])=>'<label><input type="checkbox" name="mazeTopic" value="'+id+'" checked> '+title+'</label>').join('')}</fieldset>
      <label>Personen aufrufen <select id="mazeClass"><option value="">Gemeinsam / Einzelperson</option></select></label><p>Eine gewählte Klasse wird einmal zufällig geordnet. Danach kommt jede Person der Reihe nach dran; die Reihenfolge bleibt erhalten.</p>
      <button type="button" id="mazeResume" class="secondary">Gespeicherte Expedition fortsetzen</button><label>Spielstanddatei importieren <input type="file" id="mazeImport" accept=".json,application/json"></label><p id="mazeResumeStatus" role="status"></p>
      <details><summary>Spielregeln · Wörterlabyrinth</summary><p>Findet drei Ausgangsschlüssel: in der Schlüsselkammer, aus drei Fragmenten und hinter einem Rätselzugang. Zusätzliche blaue Schlüssel und Schalter öffnen Abkürzungen. Schimmernde Wände können Geheimgänge sein. Bewegung: Räume anklicken, Richtungsknöpfe oder Pfeiltasten. Kein Zeitlimit.</p><p>Fünf Worträtselarten: Buchstaben zusammensetzen, Hangman, Wordle, Zuordnen und Geheimschrift. Grammar verwendet Satzbau, Lücken, Fehlerkorrektur und Formenauswahl. Für lange Ausdrücke werden passende Bausteine verwendet. Wordle erlaubt alle Buchstabenkombinationen passender Länge.</p><p>Ein gescheitertes Rätsel kostet im Abenteuer ein Leben. Einzelne Fehlversuche verbrauchen zunächst nur Rätselversuche. Im entspannten Modus gibt es keinen Lebensverlust. Bei null Leben endet das Abenteuer. Alle Lösungen werden nach Abschluss gezeigt.</p><p>Gelöste Rätsel bringen 2 Coins, fehlerfrei ohne Hilfe 3. Je drei gelöste Rätsel in Folge bringen 3 zusätzliche Coins und einen zufälligen Hinweis- oder Überspring-Joker. Hinweise kosten 2 Coins, Überspringen 5, Heilung 4 und Kartenhilfen 3. Gefundene Joker werden zuerst verbraucht. Die Lehrkraft kann kostenlos eingreifen.</p><p>Richtig gelöste Aufgaben pausieren bis zum nächsten Lerndurchgang. Erst werden alle Aufgaben gefragt, danach nur noch die nicht gelösten. Wenn alles richtig gelöst ist, entscheidet ihr über Beenden oder Zurücksetzen. Eure Expedition wird automatisch in diesem Browser gespeichert; eine Spielstanddatei dient als zusätzliche Sicherung.</p></details>`;
    $('start').before(options);options.addEventListener('change',updateSetup);$('mazeResume').onclick=resume;
    $('mazeImport').onchange=async ev=>{const input=ev.currentTarget,file=input.files?.[0];if(!file)return;try{if(file.size>3000000)throw Error();const snapshot=JSON.parse(await file.text());if(!validSave(snapshot))throw Error();if(readSave()&&!confirm('Den bisherigen Labyrinth-Spielstand durch die importierte Expedition ersetzen?'))return;g=snapshot;save();if(storageWarning)throw Error();show();render();say('Importierte Expedition fortgesetzt.');}catch{$('mazeResumeStatus').textContent='Die Spielstanddatei konnte nicht importiert werden. Bitte eine gültige Wörterlabyrinth-Sicherung wählen.';}finally{input.value='';}};
    const section=node('section');section.id='mazeGame';section.hidden=true;section.innerHTML=`<div class="mazeToolbar"><h2 id="mazeTitle">Wörterlabyrinth</h2><button type="button" id="mazeFullscreen" class="secondary">Vollbild</button><button type="button" id="mazeVocabulary" class="secondary">Vokabelauswahl ändern</button><button type="button" id="mazeSave" class="secondary">Speichern</button><button type="button" id="mazeExport" class="secondary">Spielstand exportieren</button><button type="button" id="mazeBack" class="secondary">Spielauswahl</button></div><div id="mazeHUD" aria-label="Vorräte"></div><p id="mazeTurn" class="mazeTurn"></p><div class="mazeLayout"><div class="mazeMap"><canvas id="mazeCanvas" tabindex="0" aria-label="Labyrinthkarte. Bewegung mit Pfeiltasten." aria-describedby="mazeMapDescription"></canvas><div id="mazeArrival" aria-hidden="true" hidden></div><p id="mazeMapDescription" class="mazeSmall"></p></div><div id="mazePanel" aria-live="polite"></div></div><p id="mazeNotice" role="status"></p><small id="mazeSaveStatus"></small>`;
    $('game').after(section);new ResizeObserver(fitMap).observe($('mazeCanvas').parentElement);$('mazeBack').onclick=back;$('mazeSave').onclick=()=>{save();say(storageWarning||'Expedition gespeichert.');};$('mazeExport').onclick=exportSave;$('mazeVocabulary').onclick=editVocabulary;
    $('mazeFullscreen').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await $('arenaMain').requestFullscreen();}catch{say('Vollbild ist hier nicht verfügbar.');}};
    $('mazeCanvas').onclick=ev=>{if(!g)return;const box=ev.currentTarget.getBoundingClientRect(),x=(ev.clientX-box.left)*ev.currentTarget.width/box.width,y=(ev.clientY-box.top)*ev.currentTarget.height/box.height;const col=Math.floor((x-mapInset)/mapCell),row=Math.floor((y-mapInset)/mapCell);if(col>=0&&col<g.size&&row>=0&&row<g.size)move(row*g.size+col);};
    section.addEventListener('click', continueOnBackgroundClick);
    document.addEventListener('keydown', handleMazeKey);
    const apply=button('Übernehmen und ins Labyrinth zurückkehren',()=>leaveEdit(true));apply.id='mazeApplyVocabulary';apply.hidden=true;const cancel=button('Zurück ins Labyrinth',()=>leaveEdit(false));cancel.id='mazeCancelVocabulary';cancel.hidden=true;$('chooseGame').after(apply,cancel);
    $('config').addEventListener('submit',ev=>{if(editing){ev.preventDefault();ev.stopImmediatePropagation();leaveEdit(true);return;}if($('vocabStep').hidden&&$('mode').value==='maze'&&!$('gameSettings').hidden){ev.preventDefault();ev.stopImmediatePropagation();const cfg=config();const v=['grammar','builtin'].includes(cfg.source)?{cards:[],verbs:false,direction:$('direction').value,typed:false,selectionKey:'maze-'+cfg.source}:readVocabulary();if(v)start(v,cfg);}},true);
    const tile=gameTiles[gameCatalog.findIndex(c=>c.id==='maze')];
    const cover=tile.querySelector('.gameCover');
    cover.className='gameCover mazeCover';
    const scene=node('img',null,'mazeCoverScene');
    scene.alt='';
    scene.width=640;
    scene.height=360;
    scene.src='maze-cover.jpg';
    cover.replaceChildren(scene);
    updateSetup();
  }
  return{bind,setup:updateSetup};
})();
