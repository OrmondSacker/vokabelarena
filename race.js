"use strict";
const $ = id => document.getElementById(id);
const end = 34;
const fields = {
  0:['start','Start'],3:['card','🃏'],6:['boost','+3',3],8:['skip','❗'],
  9:['card','🃏'],10:['shop','🔧'],12:['shortcut','↗ 16',16],15:['back','−2',-2],
  17:['card','🃏'],19:['skip','❗'],21:['boost','+2',2],22:['shop','🔧'],
  24:['card','🃏'],26:['shortcut','↗ 30',30],28:['back','−3',-3],
  29:['card','🃏'],31:['skip','❗'],33:['card','🃏'],34:['finish','Ziel']
};
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
  { y: 274, xs: [243, 383, 524, 665, 805, 946, 1086, 1230], bend: [1350, 359] },
  { y: 441, xs: [1230, 1090, 950, 810, 670, 530, 390, 250], bend: [170, 525] },
  { y: 608, xs: [250, 391, 532, 673, 814, 955, 1096, 1240], bend: [1363, 699] },
  { y: 783, xs: [1250, 1100, 950, 800, 650, 500, 350, 198] }
];
const cellNodes=Array.from({length:end+1},(_,pos)=>{
  const e=document.createElement('div');
  const rung=Math.floor(pos/9), step=pos%9;
  const row=roadRows[rung];
  const [x,y]=step===8?row.bend:[row.xs[step],row.y];
  e.style.left=(x/15.36)+'%';
  e.style.top=(y/10.24)+'%';
  e.className='cell';
  const [kind,label]=fields[pos]??['normal',''];
  e.dataset.kind=kind;
  e.dataset.direction=step===8?'down':rung%2?'left':'right';
  if (step===7 && rung<3) e.dataset.corner=rung%2?'outer-tl':'outer-tr';
  if (step===0 && rung>0) e.dataset.corner=rung%2?'outer-br':'outer-bl';
  e.title=[String(pos),specialNames[kind],label].filter(Boolean).join(' · ');
  e.setAttribute('aria-label',e.title);
  track.append(e);
  return e;
});
const sprites=vehicles.map((_,index)=>raceSprite(index,colors[index]));
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
    sign.textContent=['card','shop','skip','start','finish'].includes(el.dataset.kind)?'':label;
    sign.setAttribute('aria-hidden','true');
    const slick=document.createElement('span');
    slick.className='slick';slick.hidden=!oil.has(pos);
    slick.title='Ölfleck';
    el.replaceChildren(number,sign,slick);
    for(const player of present){
      const img=new Image();img.className='wagon';img.src=sprites[player.id];img.alt=player.name;img.title=player.name;img.classList.toggle('driver-turn',player===active());group.append(img);
    }
    el.append(group);
  }
}
function control(parent,label,fn,description='',primary=false){
  const b=document.createElement('button');b.type='button';b.textContent=label;
  if(primary)b.className='primary';
  if(description){const small=document.createElement('small');small.textContent=description;b.append(small)}
  if(fn)b.onclick=fn;else b.disabled=true;
  $(parent).append(b);
}
function screen(message,choices){
  render(message);
  $('choices').replaceChildren();
  $('hand').replaceChildren();
  for(const [label,fn,description,primary] of choices)control('choices',label,fn,description,primary);
  active().hand.forEach((id,i)=>{
    const allowed=!spent&&((phase==='before'&&before.includes(id)&&targets(id).length)||
      (phase==='rolled'&&after.includes(id)&&(id!=='desperate'||players.every(p=>p.pos>=active().pos)))||
      (phase==='parked'&&id==='spill'&&targets(id).length));
    control('hand',cards[id][0],allowed?()=>play(id,i):null,cards[id][1]);
  });
}
function choose(message,options){
  phase='prompt';
  const token=generation;
  return new Promise(resolve=>screen(message,options.map(([key,label,description])=>[label,()=>{
    if(token!==generation||phase!=='prompt')return;
    phase='busy';$('choices').replaceChildren();resolve(key);
  },description])));
}
function begin(){
  spent=false;roll=0;source=active().pos;
  if(active().skip){
    active().skip=false;phase='skip';
    screen('Dieser Wagen setzt einen Zug aus.',[['Weiter',next,'',true]]);return;
  }
  beginBefore();
}
function throwDice(){
  const values=[d6()];
  if(active().mods.has('double'))values.push(d6());
  roll=Math.max(...values)+Number(active().mods.has('motor'));
  phase='rolled';screen('🎲 '+values.join(' / ')+(active().mods.has('motor')?' · Sportmotor +1':'')+' → '+roll+' Felder',[['Fahren · '+roll,()=>drive(roll),'',true]]);
}
function next(){current=(current+1)%players.length;begin()}
const limit=p=>p.mods.has('bag')?3:2;
async function trim(p){
  while(p.hand.length>limit(p)){
    const i=await choose(p.name+' wirft eine Karte ab.',p.hand.map((k,i)=>[i,cards[k][0],cards[k][1]]));
    p.hand.splice(i,1);
  }
}
async function shield(p,message,kind){
  const options=p.hand.flatMap((id,i)=>id==='armor'||(kind==='oil'&&id==='chain')?[[i,cards[id][0],cards[id][1]]]:[]);
  if(!options.length)return false;
  const answer=await choose(p.name+': '+message,[...options,[-1,'Hinnehmen']]);
  if(answer<0)return false;
  p.hand.splice(answer,1);return true;
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
  if(id==='pit')return [10,22].filter(pos=>pos>p.pos&&!p.shops.has(pos)&&!players.some(q=>q.pos===pos&&q.mods.has('bumper'))).slice(0,1);
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
  const q=options[target];
  if(id==='turbo')return drive(roll+2);
  if(id==='extra')return drive(roll+d6());
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
    p.hand.push(stolen);await trim(p);
  }
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
  const offset=pos===10?0:3;
  const offered=[...available.slice(offset),...available.slice(0,offset)].slice(0,3);
  p.mods.add(await choose(p.name+' wählt ein Upgrade.',offered.map(([id,[name,desc]])=>[id,name,desc])));
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
    for(const shop of [10,22])if(shop>from&&shop<p.pos)await garage(p,shop);
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
    if(card==='failure'){
      if(!(await shield(p,'Kolbenfresser: drei Felder zurück')))return move(p.pos-3,true,seen);
    }else if(card.startsWith('upgrade:')){
      const mod=card.slice(8);
      if(!p.mods.has(mod)){
        p.mods.add(mod);await choose(p.name+' erhält '+upgrades[mod][0]+'.',[[true,'Weiter',upgrades[mod][1]]]);
      }else{
        p.hand.push('turbo');await trim(p);
        await choose(p.name+' hat das Upgrade schon und erhält einen Turbo.',[[true,'Weiter']]);
      }
    }else{
      p.hand.push(card);await trim(p);
      await choose(p.name+' zieht '+cards[card][0]+'.',[[true,'Weiter',cards[card][1]]]);
    }
  }
}
function drive(distance){return driveTo(active().pos+distance,true)}
async function driveTo(pos,continuous){
  phase='busy';$('choices').replaceChildren();$('hand').replaceChildren();
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
