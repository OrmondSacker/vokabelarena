const fs=require('fs'),vm=require('vm'),assert=require('assert'),{parseHTML}=require('linkedom');
const dir=require('node:path').resolve(__dirname,'..'),html=fs.readFileSync(dir+'/index.html','utf8');
const {document,window}=parseHTML(html);
const storage=new Map();const noop=()=>{};
function option(text,value){const n=document.createElement('option');n.textContent=text;n.setAttribute('value',value??text);return n;}
Object.defineProperties(window.HTMLSelectElement.prototype,{value:{configurable:true,get(){return this.querySelector('option[selected]')?.getAttribute('value')??this.querySelector('option[selected]')?.textContent??this.querySelector('option')?.getAttribute('value')??this.querySelector('option')?.textContent??''},set(value){let found=false;for(const n of this.querySelectorAll('option')){if(n.getAttribute('value')===String(value)||!n.hasAttribute('value')&&n.textContent===String(value)){n.setAttribute('selected','');found=true}else n.removeAttribute('selected')}if(!found)this.setAttribute('data-empty','true');else this.removeAttribute('data-empty');}},selectedOptions:{get(){return [...this.querySelectorAll('option[selected]')].length?[...this.querySelectorAll('option[selected]')]:[this.querySelector('option')].filter(Boolean)}}});
window.HTMLSelectElement.prototype.add=function(n){this.append(n)};
const ctx2d=new Proxy({measureText:t=>({width:String(t).length*8}),createLinearGradient:()=>({addColorStop:noop}),createRadialGradient:()=>({addColorStop:noop}),getImageData:()=>({data:new Uint8ClampedArray(100)})},{get:(o,k)=>o[k]??noop,set:(o,k,v)=>(o[k]=v,true)});
window.HTMLCanvasElement.prototype.getContext=()=>ctx2d;
window.HTMLElement.prototype.getBoundingClientRect=()=>({x:0,y:0,width:600,height:500,top:0,left:0,bottom:500,right:600});window.HTMLElement.prototype.scrollIntoView=noop;window.HTMLElement.prototype.focus=noop;
const loc={hash:'',pathname:'/',href:'http://localhost/'};
const context={window,document,console,Option:option,localStorage:{getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,v)},location:loc,URL,URLSearchParams,Blob,Event:window.Event,MutationObserver:window.MutationObserver,ResizeObserver:class{observe(){}},requestAnimationFrame:()=>1,cancelAnimationFrame:noop,getComputedStyle:()=>({maxHeight:'400px'}),innerHeight:768,innerWidth:1366,confirm:()=>true,alert:noop,Image:class{},setTimeout:()=>1,clearTimeout:noop,setInterval:()=>1,clearInterval:noop,performance:{now:()=>0},Uint8Array,Uint8ClampedArray,Float32Array,DataView,atob,btoa};
window.matchMedia=()=>({matches:true,addEventListener:noop});window.location=loc;
vm.createContext(context);
let mazeCode=fs.readFileSync(dir+'/maze.js','utf8');mazeCode=mazeCode.replace('return{bind,setup:updateSetup};','return{bind,setup:updateSetup,generate,grammarBank,buildPool,freshLearning,draw,record,wordleScore,start,move,attempt,guessLetter,resolve,continueAfterPuzzle,openPuzzle,hint,skip,heal,mapHint,readSave,resume,render,back,editVocabulary,leaveEdit,inspect:()=>g,setGame:x=>g=x};');
for(const script of document.querySelectorAll('script')){const src=script.getAttribute('src');if(src){const name=src.split('?')[0];if(fs.existsSync(dir+'/'+name))vm.runInContext(name==='maze.js'?mazeCode:fs.readFileSync(dir+'/'+name,'utf8'),context,{filename:name});}else if(script.textContent.trim())vm.runInContext(script.textContent,context,{filename:'index-inline'});}
const run=s=>vm.runInContext(s,context);const api=run('Maze');
assert.equal(run('gameCatalog.length'),7);assert.equal(document.querySelectorAll('.gameTile').length,7);assert(document.getElementById('mazeOptions'));
let maps=0;
for(const size of [5,7,9])for(let seed=0;seed<150;seed++){
 const m=api.generate(size,seed),seen=new Set([0]),q=[0];for(let i=0;i<q.length;i++)for(const id of m.cells[q[i]].edges){assert(m.cells[id].edges.includes(q[i]));assert(Math.abs(id-q[i])===size||Math.floor(id/size)===Math.floor(q[i]/size));if(!seen.has(id)){seen.add(id);q.push(id)}}
 assert.equal(seen.size,size*size);for(const kind of ['vault','hiddenKey','fragment'])assert(m.cells.filter(c=>c.event===kind).length===(kind==='fragment'?3:1));assert.equal(m.cells[m.exit].event,'exit');assert(m.extras.every(e=>!m.cells[e.a].edges.includes(e.b)));maps++;
}
assert.deepEqual(Array.from(api.wordleScore(Array.from('allee'),Array.from('apple'))),[2,1,0,0,2]);
const vocabulary={cards:[['Katze','cat'],['Hund','dog'],['Buch','book'],['Baum','tree'],['Haus','house'],['Freund','friend']],verbs:false,direction:'0',typed:false,selectionKey:'test'};
const cfg={world:'castle',size:5,adventure:true,source:'custom',listTheme:'Natur',banks:['school'],topics:['present','progressive','past','questions','mixed'],classId:''};
api.start(vocabulary,cfg);let g=api.inspect();assert.equal(g.lives,5);assert.equal(g.learning.items.length,6);
// First pass is unique; only missed tasks enter the second pass.
const seen=[];for(let i=0;i<6;i++){const e=api.draw();seen.push(e.id);api.record(e.id,i!==2)}assert.equal(new Set(seen).size,6);assert.equal(api.draw().id,seen[2]);api.record(seen[2],true);assert.equal(api.draw(),null);
// Every puzzle type: successful and failed attempts, plus retry eligibility.
const room=g.cells.find(c=>c.event==='puzzle');g.position=room.id;g.previous=0;
for(const kind of ['letters','hangman','wordle','match','secret']){
 g.learning=api.freshLearning(api.buildPool(vocabulary,cfg));room.done=false;room.riddleKind=kind;api.openPuzzle();assert(g.active);assert.equal(g.active.kind,kind);
 const a=g.active;if(kind==='match'){api.resolve(true)}else api.attempt(a.answer);assert.equal(a.outcome,'correct');assert(room.done);api.continueAfterPuzzle();
}
g.lives=5;g.learning=api.freshLearning(api.buildPool(vocabulary,cfg));room.done=false;room.riddleKind='wordle';g.position=room.id;api.openPuzzle();const a=g.active;
api.attempt('a');assert.equal(a.wrong,0);for(let i=0;i<6;i++)api.attempt('z'.repeat(Array.from(a.answer).length));assert.equal(a.outcome,'wrong');assert.equal(g.lives,4);assert(!room.done);assert(!g.learning.mastered.includes(a.entries[0].id));api.continueAfterPuzzle();assert.equal(g.position,0);
// Paid hints, earned skips and no life penalty for a skip.
g.position=room.id;g.learning=api.freshLearning(api.buildPool(vocabulary,cfg));room.riddleKind='secret';api.openPuzzle();g.inventory.hint=0;g.coins=10;api.hint();assert.equal(g.coins,8);assert.equal(g.stats.hints,1);g.inventory.skip=1;const lives=g.lives;api.skip();assert.equal(g.inventory.skip,0);assert.equal(g.lives,lives);assert.equal(g.active.outcome,'skipped');api.continueAfterPuzzle();
// All three keys can be collected; the exit wins only when all are held.
g.keys=[];g.fragments=0;for(const c of g.cells.filter(c=>['vault','hiddenKey','fragment'].includes(c.event))){g.position=c.id;c.done=false;g.learning=api.freshLearning(api.buildPool(vocabulary,cfg));api.openPuzzle();api.resolve(true);api.continueAfterPuzzle();}assert.equal(g.keys.length,3);assert.equal(g.fragments,3);g.position=g.cells[g.exit].edges[0];g.panel='explore';api.move(g.exit);assert(g.ended&&g.won);
// Save/resume includes an active puzzle and restores its exact attempts.
api.start(vocabulary,{...cfg,adventure:false});g=api.inspect();const puzzle=g.cells.find(c=>c.event==='puzzle');g.position=puzzle.id;puzzle.riddleKind='secret';api.openPuzzle();api.attempt('zzzzzz');assert.equal(g.active.wrong,1);api.resume();g=api.inspect();assert.equal(g.active.wrong,1);assert.equal(g.lives,5);
// Grammar pool covers every approved topic and all four mechanics.
const gb=api.grammarBank(cfg.topics);assert.equal(new Set(gb.map(e=>e.topic)).size,5);assert.equal(new Set(gb.map(e=>e.kind)).size,4);assert(gb.length>=60);for(const e of gb)assert(e.answer&&e.prompt);
for(const source of ['builtin','grammar','mixed'])assert(api.buildPool(vocabulary,{...cfg,source}).length>0);
// Preserve the six old setup routes and starting mechanics.
api.back();for(let i=0;i<6;i++){run(`gameTiles[${i}].click()`);assert(!document.getElementById('gameSettings').hidden);assert.equal(document.getElementById('settingsHeading').textContent,run(`gameCatalog[${i}].title`)+ ' · Einstellungen');run('showGameTiles()');}
// Class rotation stays fixed after one complete cycle.
run("classRecords.push({title:'Testklasse',names:['Ada','Ben','Mia']})");
api.start(vocabulary,{...cfg,adventure:false,classId:'0'});g=api.inspect();const names=[...g.names];
for(let i=0;i<3;i++){g.learning=api.freshLearning(api.buildPool(vocabulary,cfg));g.position=g.cells.find(c=>c.event==='puzzle').id;g.cells[g.position].done=false;api.openPuzzle();api.resolve(true);api.continueAfterPuzzle();}
assert.equal(g.person,0);assert.deepEqual(g.names,names);
// Grammar and phrase adaptations work through the actual puzzle UI functions.
for(const kind of ['gap','order','correct','choice']){api.start(vocabulary,{...cfg,source:'grammar',adventure:false});g=api.inspect();const entry=g.learning.items.find(e=>e.kind===kind);g.learning.remaining=[entry.id];g.position=g.cells.find(c=>c.event==='puzzle').id;api.openPuzzle();assert.equal(g.active.kind,kind);api.attempt(entry.answer);assert.equal(g.active.outcome,'correct');}
api.start({...vocabulary,cards:[['ein Foto machen','take a beautiful photo']]},{...cfg,adventure:false});g=api.inspect();g.position=g.cells.find(c=>c.event==='puzzle').id;g.cells[g.position].riddleKind='wordle';api.openPuzzle();assert.equal(g.active.kind,'letters');assert(g.active.tokens.every(t=>!t.text.includes(' ')));
// Submitted setup reaches the dedicated maze scene, not a legacy game.
api.back();run('gameTiles[6].click()');document.getElementById('config').dispatchEvent(new window.Event('submit',{bubbles:true,cancelable:true}));assert(!document.getElementById('mazeGame').hidden);assert(document.getElementById('game').hidden);
// Optional list topics survive saving, loading and backup merges.
run("el('deckTitle').value='QA Animals';el('deckTheme').value='Animals';el('pairs').value='Katze;cat';el('deckSave').click()");
assert.equal(run("deckRecords.find(r=>r.title==='QA Animals').theme"),'Animals');
assert.equal(run("mergeArenaRecords([], [{title:'QA',text:'Katze;cat',theme:'Animals'}], 'text')[0].theme"),'Animals');
console.log(JSON.stringify({mapsVerified:maps,topics:gb.length,puzzles:5,queue:'unique first pass, missed-only retries, completion',economy:'paid hint and skip passed',save:'active puzzle resumed',keys:'all sources and victory passed',oldGameMenus:6}));
