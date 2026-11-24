"use strict";
const $ = id => document.getElementById(id);
const end = 46;
const fields = {
  0:['start','Start'], 3:['card','Aktionskarte'], 6:['boost','+3',3], 8:['shop','Werkstatt'],
  10:['card','Aktionskarte'], 12:['skip','Panne'], 14:['shortcut','↗ 19',19], 16:['back','−2',-2],
  19:['card','Aktionskarte'], 21:['boost','+2',2], 23:['skip','Panne'], 25:['card','Aktionskarte'],
  27:['shop','Werkstatt'], 29:['back','−3',-3], 31:['card','Aktionskarte'], 33:['shortcut','↗ 38',38],
  35:['skip','Panne'], 38:['card','Aktionskarte'], 40:['shop','Werkstatt'], 42:['boost','+2',2],
  44:['card','Aktionskarte'], 46:['finish','Ziel']
};
const shops = Object.keys(fields).map(Number).filter(pos=>fields[pos][0]==='shop');
const upgrades = {
  motor:['Sportmotor','+1 auf deine Würfelbewegung.'],
  double:['Doppelzündung','Zwei Würfel, der höhere zählt.'],
  cruise:['Tempomat','Alternativ zum Würfeln vier Felder fahren.'],
  oil:['Ölspender','Nach deinem Zug eine Ölfalle am Ausgangsfeld legen.'],
  alarm:['Überholalarm','Einmal je Rennen einen überholenden Wagen aussetzen lassen.'],
  bumper:['Abstandshalter','Andere Wagen dürfen nicht auf deinem Feld landen.'],
  bag:['Extratasche','Drei statt zwei Aktionskarten halten.']
};
const cards = {
  turbo:['Turbo','Nach dem Würfeln zwei Felder zusätzlich fahren.'],
  extra:['Extrawürfel','Nach dem Wurf einen zusätzlichen W6 addieren.'],
  gas:['Vollgas','Nach dem Wurf Bewegung verdoppeln.'],
  skip:['Zwangspause','Ein Gegner deiner Wahl setzt aus.'],
  shell:['Roter Schildkrötenpanzer','Alle auf dem nächsten besetzten Feld vor dir setzen aus.'],
  teleport:['Teleport','Zug ersetzen und zu einem anderen Wagen springen.'],
  drift:['Drift','Zug ersetzen und mit einem Wagen auf dem nächsten besetzten Feld vor dir tauschen.'],
  pit:['Boxenstopp','Zug ersetzen und direkt zur nächsten ungenutzten Werkstatt vorfahren.'],
  wrench:['Schraubenschlüssel','Ein Upgrade eines Gegners dauerhaft entfernen.'],
  grab:['Greifarm','Einem Gegner zufällig eine Aktionskarte klauen.'],
  armor:['Panzerung','Einen negativen Effekt abwehren.'],
  chain:['Reifenkette','Einen Ölfleck ignorieren.'],
  spill:['Ölfleck','Nach der Fahrt einen Ölfleck bis zu drei Felder hinter dir legen.'],
  desperate:['Verzweiflungstat','Wenn du hinten liegst, Wurf verdreifachen und danach aussetzen.'],
  failure:['Kolbenfresser','Sofort drei Felder zurück.']
};
const vehicles=['Badewanne','Werkzeugwagen','Wurstwagen','Kofferflitzer','Postkutsche','Kaffeekanne'];
const colors=['#31b8ad','#e55255','#f6be4d','#ae8bea','#78b854','#639bea'];
const specialNames={card:'Kartenfeld',shop:'Werkstatt',skip:'Panne',back:'Zurück',boost:'Vorwärts',shortcut:'Abkürzung',start:'Start',finish:'Ziel'};
const before=['skip','shell','teleport','drift','pit','wrench','grab'];
const after=['turbo','extra','gas','desperate'];
let players, current, oil, deck, phase, spent, roll, source, generation=0;
const active=()=>players[current];
const d6=()=>1+Math.floor(Math.random()*6);
const track=$('track');
// Tile centers measured on the 1536 × 1024 artwork, in racing order.
const roadRows = [
  { y: 274, xs: [245,345,445,545,645,745,845,945,1045,1145,1245], bend: [1350,359] },
  { y: 441, xs: [1245,1145,1045,945,845,745,645,545,445,345,245], bend: [170,525] },
  { y: 608, xs: [245,345,445,545,645,745,845,945,1045,1145,1245], bend: [1363,699] },
  { y: 783, xs: [1245,1141,1036,932,827,723,618,514,409,305,199] }
];
// The stone joints follow the inner and outer edges of the painted road.
const curveJoints=[
  'M 1195 232 L 1246 232 C 1330 232 1398 287 1398 354 C 1398 431 1342 484 1254 484 L 1195 484 L 1195 402 L 1250 402 C 1283 402 1303 383 1303 356 C 1303 333 1283 317 1247 317 L 1195 317 Z M 1339 255 L 1280 324 M 1345 452 L 1281 395',
  'M 294 401 L 250 401 C 173 401 124 450 124 522 C 124 596 179 652 252 652 L 294 652 L 294 568 L 251 568 C 229 568 217 548 217 525 C 217 502 235 483 259 483 L 294 483 Z M 164 438 L 232 495 M 165 616 L 230 557',
  'M 1195 568 L 1254 568 C 1340 568 1415 624 1415 699 C 1415 773 1343 828 1252 828 L 1195 828 L 1195 742 L 1253 742 C 1288 742 1315 725 1315 698 C 1315 672 1288 653 1254 653 L 1195 653 Z M 1351 598 L 1291 661 M 1358 798 L 1293 733'
];
const joints=document.createElement('canvas');
joints.className='curve-joints';
joints.width=1536;
joints.height=1024;
joints.setAttribute('aria-hidden','true');
const jointContext=joints.getContext('2d');
for(const outline of curveJoints){
  const path=new Path2D(outline);
  jointContext.lineJoin='round';
  jointContext.strokeStyle='#ffe3aa9e';
  jointContext.lineWidth=8;
  jointContext.stroke(path);
  jointContext.strokeStyle='#573219d9';
  jointContext.lineWidth=4;
  jointContext.stroke(path);
}
track.append(joints);
const cellNodes=Array.from({length:end+1},(_,pos)=>{
  const e=document.createElement('div');
  const rung=Math.floor(pos/12), step=pos%12;
  const row=roadRows[rung];
  const [x,y]=step===11?row.bend:[row.xs[step],row.y];
  e.style.left=(x/15.36)+'%';
  e.style.top=(y/10.24)+'%';
  e.className='cell';
  const [kind,label]=fields[pos]??['normal',''];
  e.dataset.kind=kind;
  e.dataset.direction=step===11?'down':rung%2?'left':'right';
  if (step===10 && rung<3) e.dataset.corner=rung%2?'outer-tl':'outer-tr';
  if (step===0 && rung>0) e.dataset.corner=rung%2?'outer-br':'outer-bl';
  e.title=[String(pos),specialNames[kind],label].filter(Boolean).join(' · ');
  e.setAttribute('aria-label',e.title);
  track.append(e);
  return e;
});
const sprites=vehicles.map((_,index)=>raceSprite(index,colors[index]));
let robotSprite;
function loadSprite(image,x,y,width,height){
  const canvas=document.createElement('canvas');
  canvas.width=128;
  canvas.height=Math.round(128*height/width);
  const ctx=canvas.getContext('2d');
  ctx.imageSmoothingEnabled=false;
  ctx.drawImage(image,x,y,width,height,0,0,canvas.width,canvas.height);
  const pixels=ctx.getImageData(0,0,canvas.width,canvas.height);
  for(let i=3;i<pixels.data.length;i+=4)if(pixels.data[i]<96)pixels.data[i]=0;
  ctx.putImageData(pixels,0,0);
  return canvas.toDataURL();
}
const atlas=new Image();
atlas.onload=()=>{
  const cellWidth=atlas.naturalWidth/3;
  const cellHeight=atlas.naturalHeight/2;
  // Keep the full vehicle inside its atlas cell and crop the empty margins.
  const bounds=[[26,79,453,375],[43,75,442,379],[20,44,469,413],
    [24,97,452,357],[2,105,491,349],[8,48,477,405]];
  bounds.forEach(([x,y,w,h],index)=>{
    if(index===1&&robotSprite)return;
    sprites[index]=loadSprite(atlas,(index%3+x/512)*cellWidth,(Math.floor(index/3)+y/512)*cellHeight,
      w*cellWidth/512,h*cellHeight/512);
  });
  if(!$('race').hidden)render($('status').textContent);
};
atlas.src='race-vehicles.png';
const robot=new Image();
robot.onload=()=>{
  const margin=Math.round(robot.naturalWidth*.085);
  robotSprite=loadSprite(robot,margin,0,robot.naturalWidth-margin*2,robot.naturalHeight);
  sprites[1]=robotSprite;
  if(!$('race').hidden)render($('status').textContent);
};
robot.src='race-robot.png';
function names(){
  const values=[...$('names').querySelectorAll('input')].map(e=>e.value);
  $('names').replaceChildren(...vehicles.slice(0,Number($('count').value)).map((name,i)=>{
    const label=document.createElement('label');label.textContent='Wagen '+(i+1);
    const input=document.createElement('input');input.value=values[i]??name;input.maxLength=24;
    label.append(input);return label;
  }));
}
$('count').onchange=names;names();
function start(){
  generation++;
  players=[...$('names').querySelectorAll('input')].map((input,i)=>({
    id:i,name:input.value.trim()||vehicles[i],pos:0,hand:[],mods:new Set(),shops:new Set(),skip:false,alarm:false
  }));
  current=0;oil=new Map();deck=[];$('setup').hidden=true;$('race').hidden=false;$('restart').hidden=false;
  begin();
}
$('setup').onsubmit=e=>{e.preventDefault();start()};
$('restart').onclick=()=>{
  if(phase!=='finish'&&!confirm('Das laufende Rennen beenden?'))return;
  generation++;$('race').hidden=true;$('setup').hidden=false;$('restart').hidden=true;
};
function draw(){
  if(!deck.length){
    deck=[...Object.keys(cards),...Object.keys(cards).filter(k=>k!=='failure'),...Object.keys(upgrades).map(k=>'upgrade:'+k)];
    for(let i=deck.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[deck[i],deck[j]]=[deck[j],deck[i]]}
  }
  return deck.pop();
}
function render(message){
  $('status').textContent=message;
  $('turn').textContent=phase==='finish'?active().name+' gewinnt!':active().name+' ist dran';
  $('standings').replaceChildren(...[...players].sort((a,b)=>b.pos-a.pos||a.id-b.id).map(player=>{
    const li=document.createElement('li');li.textContent=player.name+' · '+player.pos+'/'+end+(player.skip?' · Panne':'');
    const info=document.createElement('small');info.textContent=player.hand.length+'/'+limit(player)+' Karten'+([...player.mods].map(m=>upgrades[m][0]).length?' · '+[...player.mods].map(m=>upgrades[m][0]).join(', '):'');
    const portrait=new Image();
    portrait.src=sprites[player.id];portrait.alt='';
    li.prepend(portrait);
    li.classList.toggle('leading-turn',player===active());
    li.append(info);return li;
  }));
  for(let pos=0;pos<=end;pos++){
    const el=cellNodes[pos], group=document.createElement('span');
    const present=players.filter(p=>p.pos===pos);
    el.classList.toggle('active',active().pos===pos);
    group.className='wagons'+(present.length>1?' many':'');
    const [,label]=fields[pos]??['normal',''];
    const number=document.createElement('span');
    number.className='field-number';number.textContent=pos;
    const sign=document.createElement('span');
    sign.className='field-sign';
    const kind=el.dataset.kind;
    if(fieldMotifs[kind]){
      const icon=document.createElement('span');
      icon.className='field-motif';
      icon.style.backgroundImage='url('+motifImage(fieldMotifs[kind])+')';
      sign.append(icon);
    }
    if(['boost','back','shortcut'].includes(kind))sign.append(label);
    sign.setAttribute('aria-hidden','true');
    const slick=document.createElement('span');
    slick.className='slick';slick.hidden=!oil.has(pos);
    slick.title='Ölfleck';
    el.replaceChildren(number,sign,slick);
    for(const player of present){
      const img=new Image();img.className='wagon';img.src=sprites[player.id];img.alt=player.id===1?player.name+' mit Roboter am Steuer':player.name;img.title=img.alt;img.classList.toggle('driver-turn',player===active());group.append(img);
    }
    el.append(group);
  }
}
const cardArt={
  turbo:['rocket','boost'],extra:['dice','workshop'],gas:['flame','boost'],
  skip:['stop','hazard'],shell:['shell','hazard'],teleport:['portal','warp'],drift:['swap','warp'],
  pit:['wrench','workshop'],wrench:['wrench','workshop'],grab:['claw','warp'],
  armor:['shield','guard'],chain:['chain','guard'],spill:['oil','hazard'],desperate:['flame','hazard'],
  failure:['stop','hazard'],'upgrade:motor':['rocket','workshop'],'upgrade:double':['dice','workshop'],
  'upgrade:cruise':['arrow','workshop'],'upgrade:oil':['oil','workshop'],'upgrade:alarm':['stop','workshop'],
  'upgrade:bumper':['shield','workshop'],'upgrade:bag':['deck','workshop']
};
// Eight-pixel silhouettes share an outline and two highlight shades.
const motifs={
  rocket:['.....11.','....1331','...13331','..13321.','.13321..','11321...','.1211...','21......'],
  dice:['.111111.','13333331','13233321','13333331','13323331','13233321','12222221','.111111.'],
  flame:['...1....','..131.1.','..133131','.1333331','13322331','13222231','.122221.','..1111..'],
  stop:['..1111..','.133331.','13322331','13322331','13322331','13333331','.132231.','..1111..'],
  shell:['...11...','..1331..','.132231.','13322331','13222231','12322321','.133331.','..1111..'],
  portal:['..1111..','.133331.','13211231','13133131','13123131','13211331','.133231.','..1111..'],
  swap:['....1...','.11131..','1333331.','.11131..','..13111.','.1333331','..13111.','...1....'],
  wrench:['.1....1.','131..131','13311331','.133331.','..1331..','..1331..','..1221..','...11...'],
  claw:['...11...','..1331..','..1331..','.132231.','131..131','13....31','131..131','.11..11.'],
  shield:['.111111.','13323331','13323331','13323331','13222331','.132231.','..1331..','...11...'],
  chain:['..111...','.13331..','1321131.','1311331.','.1331131','.1311231','..13331.','...111..'],
  oil:['..111...','.13321..','132221..','.122221.','13222221','12222221','.122221.','..1111..'],
  arrow:['....1...','....31..','.111331.','13333331','12222221','.111221.','....21..','....1...'],
  deck:['..1111..','.133331.','.132331.','1133331.','1313331.','1311111.','.13331..','..111...']
};
const motifImages={};
function motifImage(id){
  if(motifImages[id])return motifImages[id];
  const tile=document.createElement('canvas');
  tile.width=tile.height=8;
  const ctx=tile.getContext('2d'),ink=['','#2c2339','#d48d56','#fff0b1'];
  motifs[id].forEach((row,y)=>Array.from(row).forEach((pixel,x)=>{
    if(pixel==='.')return;
    ctx.fillStyle=ink[Number(pixel)];
    ctx.fillRect(x,y,1,1);
  }));
  return motifImages[id]=tile.toDataURL();
}
const fieldMotifs={card:'deck',shop:'wrench',skip:'stop',boost:'arrow',back:'arrow',shortcut:'swap',start:'arrow'};
const revealLabels={draw:'Karte gezogen',play:'Karte ausgespielt',guard:'Abwehrkarte ausgespielt',receive:'Karte erhalten'};
// Each card pairs its own colors with a foreground object and a smaller effect or tool.
const cardScenes={
  turbo:['#164746','#60dcb1','flame'],extra:['#27486a','#a3e4ff','dice'],
  gas:['#632b25','#ff9d50','arrow'],skip:['#593649','#ff88a0','shield'],
  shell:['#69242e','#ff6956','arrow'],teleport:['#34205e','#cf9bff','portal'],
  drift:['#27365f','#83b6ff','arrow'],pit:['#704021','#ffd68a','deck'],
  wrench:['#443648','#f4ad91','stop'],grab:['#28465a','#a4e4de','deck'],
  armor:['#233d70','#b9dcff','shield'],chain:['#374558','#9baccb','oil'],
  spill:['#3a273e','#d5a3e5','oil'],desperate:['#5e223f','#ff9d80','rocket'],
  failure:['#462329','#ffb16c','flame'],
  'upgrade:motor':['#20594b','#f3c66c','wrench'],'upgrade:double':['#1d4750','#8ae2bd','dice'],
  'upgrade:cruise':['#245345','#c9ea8f','shield'],'upgrade:oil':['#214841','#b5d393','deck'],
  'upgrade:alarm':['#27534c','#ffa866','arrow'],'upgrade:bumper':['#215c56','#d0ece3','wrench'],
  'upgrade:bag':['#314e3d','#f6cc8b','deck']
};
const sceneImages={};
function cardScene(id,symbol){
  if(sceneImages[id])return sceneImages[id];
  const [base,highlight,detail]=cardScenes[id];
  const canvas=document.createElement('canvas');
  canvas.width=48;canvas.height=30;
  const ctx=canvas.getContext('2d');
  const block=(color,x,y,w,h)=>{ctx.fillStyle=color;ctx.fillRect(x,y,w,h)};
  block(base,0,0,48,30);
  block('#171729',0,23,48,7);
  for(let inset=0;inset<5;inset++){
    block('#ffffff0a',5+inset*2,2+inset,38-inset*4,24-inset*2);
  }
  for(const [x,y] of [[5,5],[36,4],[40,13],[9,17],[31,24],[4,25]]){
    block(highlight,x,y,3,1);block(highlight,x+1,y-1,1,3);
  }
  block('#151324',13,25,24,2);
  function paint(key,left,top,scale){
    const ink=['','#161527',highlight,'#fff0c4'];
    motifs[key].forEach((row,y)=>Array.from(row).forEach((pixel,x)=>{
      if(pixel!=='.')block(ink[Number(pixel)],left+x*scale,top+y*scale,scale,scale);
    }));
  }
  paint(detail,33,18,1);
  paint(symbol,12,2,3);
  return sceneImages[id]=canvas.toDataURL();
}
function cardIllustration(id){
  const [symbol,theme]=cardArt[id];
  const illustration=document.createElement('span');
  illustration.className='card-art';
  illustration.dataset.theme=theme;
  illustration.style.backgroundImage='url('+cardScene(id,symbol)+')';
  illustration.setAttribute('aria-hidden','true');
  return illustration;
}
function revealCard(id,mode,caption,buttonLabel='Weiter'){
  const dialog=$('card-reveal');
  const [label,description]=id.startsWith('upgrade:')?upgrades[id.slice(8)]:cards[id];
  render(caption);
  $('reveal-caption').textContent=caption;
  $('reveal-mode').textContent=revealLabels[mode];
  dialog.dataset.mode=mode;
  $('reveal-kind').textContent=cardKind(id);
  $('reveal-kind').parentElement.dataset.kind=cardKind(id);
  $('reveal-name').textContent=label;
  $('reveal-description').textContent=description;
  $('reveal-icon').replaceChildren(cardIllustration(id));
  $('reveal-continue').textContent=buttonLabel;
  return new Promise(resolve=>{
    dialog.addEventListener('close',resolve,{once:true});
    dialog.showModal();
  });
}
function cardKind(id){
  if(id.startsWith('upgrade:'))return 'Dauerupgrade';
  if(id==='failure')return 'Soforteffekt';
  if(id==='armor'||id==='chain')return 'Abwehrkarte';
  return 'Aktionskarte';
}
function control(parent,label,fn,description='',primary=false,cardId){
  const b=document.createElement('button');b.type='button';b.textContent=label;
  if(primary)b.className='primary';
  if(cardId){
    b.classList.add('race-card');
    b.dataset.kind=cardKind(cardId);
    const kind=document.createElement('span');
    kind.className='card-kind';kind.textContent=b.dataset.kind;
    b.prepend(kind,cardIllustration(cardId));
  }
  if(label==='Würfeln')b.classList.add('roll-button');
  if(description){const small=document.createElement('small');small.textContent=description;b.append(small)}
  if(fn)b.onclick=fn;else b.disabled=true;
  $(parent).append(b);
}
const parkedActions=['skip','shell','wrench','grab','spill'];
function cardAvailability(id){
  if(id==='armor')return 'Reaktion auf einen negativen Effekt';
  if(id==='chain')return 'Reaktion auf einen Ölfleck';
  if(spent)return 'In diesem Zug wurde schon eine Aktion gespielt';
  if(phase==='rolled'&&after.includes(id)){
    if(id==='desperate'&&players.some(p=>p.pos<active().pos))return 'Nur auf dem letzten Platz';
    return '';
  }
  if((phase==='before'&&before.includes(id))||(phase==='parked'&&parkedActions.includes(id))){
    return targets(id).length?'':'Kein gültiges Ziel';
  }
  if(after.includes(id))return phase==='before'?'Nach dem Würfeln spielbar':'Beim nächsten Wurf spielbar';
  if(id==='spill')return 'Nach deiner Fahrt spielbar';
  if(['teleport','drift','pit'].includes(id))return 'Vor der Fahrt · ersetzt den Zug';
  return 'Vor oder nach deiner Fahrt spielbar';
}
function screen(message,choices){
  render(message);
  $('choices').replaceChildren();
  $('hand').replaceChildren();
  $('dice-actions').replaceChildren();
  for(const [label,fn,description,primary,cardId] of choices){
    const diceAction=fn===throwDice||(phase==='rolled'&&primary);
    control(diceAction?'dice-actions':'choices',label,fn,description,primary,cardId);
  }
  active().hand.forEach((id,i)=>{
    const reason=cardAvailability(id);
    const allowed=reason==='';
    control('hand',cards[id][0],allowed?()=>play(id,i):null,cards[id][1],false,id);
    const card=$('hand').lastElementChild;
    const state=document.createElement('span');
    state.className='hand-state';
    state.textContent=allowed?'Jetzt ausspielen':reason;
    card.append(state);
  });
}
function choose(message,options){
  phase='prompt';
  const token=generation;
  return new Promise(resolve=>screen(message,options.map(([key,label,description,cardId])=>[label,()=>{
    if(token!==generation||phase!=='prompt')return;
    phase='busy';$('dice-actions').replaceChildren();$('choices').replaceChildren();resolve(key);
  },description,false,cardId])));
}
function begin(){
  spent=false;roll=0;source=active().pos;
  $('dice-tray').classList.remove('is-rolling');
  $('dice-tray').hidden=true;
  $('dice-result').textContent='';
  $('dice-tray').replaceChildren();
  if(active().skip){
    active().skip=false;phase='skip';
    screen('Dieser Wagen setzt einen Zug aus.',[['Weiter',next,'',true]]);
  }else beginBefore();
  cellNodes[active().pos].querySelector('.driver-turn')?.classList.add('turn-pulse');
}
const pipLayouts=[[],[5],[1,9],[1,5,9],[1,3,7,9],[1,3,5,7,9],[1,3,4,6,7,9]];
function showDice(faces){
  const tray=$('dice-tray');
  tray.hidden=false;
  tray.replaceChildren(...faces.map(face=>{
    const die=document.createElement('span');
    die.className='race-die';
    die.setAttribute('aria-hidden','true');
    for(const index of pipLayouts[face]){
      const pip=document.createElement('i');
      pip.style.gridArea=Math.ceil(index/3)+' / '+((index-1)%3+1);
      die.append(pip);
    }
    return die;
  }));
}
async function animateDice(values){
  phase='rolling';
  $('dice-actions').replaceChildren();
  $('dice-result').textContent='Würfelt …';
  $('choices').replaceChildren();$('hand').replaceChildren();
  const token=generation,tray=$('dice-tray');
  if(!matchMedia('(prefers-reduced-motion: reduce)').matches){
    tray.classList.add('is-rolling');
    for(let frame=0;frame<7;frame++){
      showDice(values.map((value,index)=>(value+frame*2+index)%6+1));
      await new Promise(resolve=>setTimeout(resolve,55+frame*6));
      if(token!==generation)return false;
    }
  }
  tray.classList.remove('is-rolling');
  showDice(values);
  $('dice-result').textContent=values.length===1?'Augenzahl: '+values[0]:'Höherer Würfel: '+Math.max(...values);
  return true;
}
async function throwDice(){
  if(phase!=='before')return;
  const values=[d6()];
  if(active().mods.has('double'))values.push(d6());
  if(!(await animateDice(values)))return;
  const bonus=Number(active().mods.has('motor'));
  roll=Math.max(...values)+bonus;
  if(bonus)$('dice-result').textContent+=' · Sportmotor +1';
  phase='rolled';
  screen('Gewürfelt: '+values.join(' / ')+(bonus?' · Sportmotor +1':'')+' → '+roll+' Felder',[['Fahren · '+roll,()=>drive(roll),'',true]]);
}
function next(){current=(current+1)%players.length;begin()}
const limit=p=>p.mods.has('bag')?3:2;
async function trim(p){
  while(p.hand.length>limit(p)){
    const i=await choose(p.name+' wirft eine Karte ab.',p.hand.map((k,i)=>[i,cards[k][0],cards[k][1],k]));
    p.hand.splice(i,1);
  }
}
async function shield(p,message,kind){
  const options=p.hand.flatMap((id,i)=>id==='armor'||(kind==='oil'&&id==='chain')?[[i,cards[id][0],cards[id][1],id]]:[]);
  if(!options.length)return false;
  const answer=await choose(p.name+': '+message,[...options,[-1,'Hinnehmen']]);
  if(answer<0)return false;
  const [id]=p.hand.splice(answer,1);
  await revealCard(id,'guard',p.name+' wehrt den Effekt ab.');return true;
}
async function pause(p,message){
  if(!p.skip&&!(await shield(p,message)))p.skip=true;
}
function nearest(){
  const position=Math.min(...players.filter(p=>p.pos>active().pos).map(p=>p.pos));
  return players.filter(p=>p.pos===position);
}
function targets(id){
  const p=active(), rivals=players.filter(q=>q!==p);
  if(id==='shell')return nearest();
  if(id==='drift')return nearest().filter(q=>!q.mods.has('bumper'));
  if(id==='teleport')return rivals.filter(q=>q.pos!==p.pos&&!players.some(r=>r.pos===q.pos&&r.mods.has('bumper')));
  if(id==='wrench')return rivals.flatMap(q=>[...q.mods].map(mod=>({q,mod})));
  if(id==='grab')return rivals.filter(q=>q.hand.length);
  if(id==='pit')return shops.filter(pos=>pos>p.pos&&!p.shops.has(pos)&&!players.some(q=>q.pos===pos&&q.mods.has('bumper'))).slice(0,1);
  if(id==='spill')return [1,2,3].map(n=>p.pos-n).filter(pos=>pos>0&&!oil.has(pos)&&!players.some(q=>q.pos===pos));
  return rivals;
}
function putOil(p,pos){for(const [key,owner] of oil)if(owner===p.id)oil.delete(key);oil.set(pos,p.id)}
async function play(id,i){
  const token=generation,p=active(),oldPhase=phase;
  const options=targets(id);
  let target;
  if(['skip','wrench','grab','teleport','drift','spill'].includes(id)){
    target=await choose('Ziel für '+cards[id][0]+' wählen.',[...options.map((q,index)=>[
      index,typeof q==='number'?'Feld '+q:q.q?q.q.name+' · '+upgrades[q.mod][0]:q.name]),[-1,'Abbrechen']]);
    if(target===-1){if(oldPhase==='parked')park();else beginBefore();return}
  }
  if(token!==generation)return;
  p.hand.splice(i,1);spent=true;phase='busy';
  $('dice-actions').replaceChildren();
  $('choices').replaceChildren();$('hand').replaceChildren();
  await revealCard(id,'play',p.name+' spielt eine Karte.','Karte ausführen');
  if(token!==generation)return;
  const q=options[target];
  if(id==='turbo')return drive(roll+2);
  if(id==='extra'){
    const bonus=d6();
    if(!(await animateDice([bonus])))return;
    $('dice-result').textContent='Extrawürfel: '+bonus+' · '+(roll+bonus)+' Felder';
    return drive(roll+bonus);
  }
  if(id==='gas')return drive(roll*2);
  if(id==='desperate'){p.skip=true;return drive(roll*3)}
  if(id==='teleport')return driveTo(q.pos,false);
  if(id==='pit')return driveTo(options[0],false);
  if(id==='drift'){
    if(!(await shield(q,'Platztausch durch Drift')))[p.pos,q.pos]=[q.pos,p.pos];
    return park('Drift ausgeführt.');
  }
  if(id==='spill'){putOil(p,q);return park('Ölfleck auf Feld '+q+' gelegt.')}
  if(id==='skip')await pause(q,'Zwangspause');
  if(id==='shell')for(const rival of options)await pause(rival,'Roter Schildkrötenpanzer');
  if(id==='wrench'&&!(await shield(q.q,'Schraubenschlüssel'))){q.q.mods.delete(q.mod);await trim(q.q)}
  if(id==='grab'&&!(await shield(q,'Greifarm'))){
    const stolen=q.hand.splice(Math.floor(Math.random()*q.hand.length),1)[0];
    await revealCard(stolen,'receive',p.name+' übernimmt eine Karte.');
    p.hand.push(stolen);await trim(p);
  }
  if(oldPhase==='parked')return park(cards[id][0]+' gespielt.');
  beginBefore(cards[id][0]+' gespielt.');
}
function beginBefore(message='Würfle oder spiele eine verfügbare Karte.'){
  phase='before';
  const options=[['Würfeln',throwDice,'',true]];
  if(active().mods.has('cruise'))options.push(['Tempomat · 4 Felder',()=>drive(4)]);
  screen(message,options);
}
async function garage(p,pos){
  if(p.shops.has(pos))return;
  p.shops.add(pos);
  const available=Object.entries(upgrades).filter(([id])=>!p.mods.has(id));
  if(!available.length)return;
  const count=Math.min(3,available.length);
  for(let i=0;i<count;i++){
    const pick=i+Math.floor(Math.random()*(available.length-i));
    [available[i],available[pick]]=[available[pick],available[i]];
  }
  const offered=available.slice(0,count);
  p.mods.add(await choose(p.name+' wählt ein Upgrade.',offered.map(([id,[name,desc]])=>[id,name,desc,'upgrade:'+id])));
}
function landing(p,pos,from){
  const direction=Math.sign(pos-from);
  while(pos!==from&&players.some(q=>q!==p&&q.pos===pos&&q.mods.has('bumper')))pos-=direction;
  return pos;
}
async function move(pos,continuous,seen){
  const p=active(),from=p.pos;
  p.pos=landing(p,Math.max(0,Math.min(end,pos)),from);
  if(p.pos===end)return;
  if(continuous&&p.pos>from){
    for(const rival of players.filter(q=>q!==p&&q.pos>=from&&q.pos<p.pos&&q.mods.has('alarm')&&!q.alarm)){
      if(p.skip)break;
      const use=await choose(rival.name+': Überholalarm einsetzen?',[[true,'Auslösen'],[false,'Aufheben']]);
      if(use){rival.alarm=true;await pause(p,'Überholalarm')}
    }
    for(const shop of shops)if(shop>from&&shop<p.pos)await garage(p,shop);
  }
  if(p.pos===from||seen.has(p.pos))return;
  seen.add(p.pos);
  if(oil.has(p.pos)&&oil.get(p.pos)!==p.id){
    oil.delete(p.pos);
    if(!(await shield(p,'Ölfleck: zwei Felder zurück','oil')))return move(p.pos-2,true,seen);
  }
  const [kind,,value]=fields[p.pos]??[];
  if(kind==='skip')await pause(p,'Panne');
  if(kind==='shop')await garage(p,p.pos);
  if(kind==='boost')return move(p.pos+value,true,seen);
  if(kind==='back'&&!(await shield(p,'Rutschfeld')))return move(p.pos+value,true,seen);
  if(kind==='shortcut'&&await choose('Abkürzung zu Feld '+value+' nehmen?',[[true,'Abkürzung'],[false,'Hier bleiben']]))return move(value,false,seen);
  if(kind==='card'){
    const card=draw();
    await revealCard(card,'draw',p.name+' zieht eine Karte.',card==='failure'?'Effekt auflösen':'Weiter');
    if(card==='failure'){
      if(!(await shield(p,'Kolbenfresser: drei Felder zurück')))return move(p.pos-3,true,seen);
    }else if(card.startsWith('upgrade:')){
      const mod=card.slice(8);
      if(!p.mods.has(mod)){
        p.mods.add(mod);
      }else{
        await revealCard('turbo','receive',p.name+' hat das Upgrade schon und erhält einen Turbo.');
        p.hand.push('turbo');await trim(p);
      }
    }else{
      p.hand.push(card);await trim(p);

    }
  }
}
function drive(distance){return driveTo(active().pos+distance,true)}
async function driveTo(pos,continuous){
  phase='busy';$('dice-actions').replaceChildren();$('choices').replaceChildren();$('hand').replaceChildren();
  const token=generation;
  await move(pos,continuous,new Set());
  if(token!==generation)return;
  if(active().pos===end){phase='finish';screen('Ziellinie erreicht.',[['Revanche',start,'',true]]);return}
  park();
}
function park(message='Fahrt beendet.'){
  phase='parked';
  const p=active(),options=[['Zug beenden',next,'',true]];
  if(p.mods.has('oil')&&source>0&&source!==p.pos&&!oil.has(source)&&!players.some(q=>q.pos===source)){
    options.unshift(['Ölspender nutzen',()=>{putOil(p,source);park('Ölfleck auf Feld '+source+' gelegt.')}]);
  }
  screen(message,options);
}
