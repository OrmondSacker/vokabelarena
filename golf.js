"use strict";
const Golf = (() => {
  const radius=8,friction=145,restitution=.8,step=1/120;
  const bounds={left:88,right:872,top:153,bottom:507};
  const courses=[
    {name:"Die Bande",par:2,kind:"bank",tee:{x:150,y:440},hole:{x:790,y:210},
      targets:[{x:650,y:300},{x:790,y:210}],walls:[{x:430,y:145,w:24,h:215}],water:[]},
    {name:"Die Windmühle",par:2,kind:"windmill",tee:{x:150,y:345},hole:{x:790,y:235},
      targets:[{x:670,y:345},{x:790,y:235}],walls:[{x:470,y:145,w:24,h:150},{x:470,y:395,w:24,h:120}],
      gate:{x:470,y:295,w:24,h:100},water:[]},
    {name:"Über das Wasser",par:3,kind:"water",tee:{x:150,y:350},hole:{x:790,y:235},
      targets:[{x:350,y:350},{x:650,y:350},{x:790,y:235}],walls:[],
      water:[{x:410,y:145,w:150,h:155},{x:410,y:400,w:150,h:115}]}
  ];
  courses.push(
    {name:"Der Felsentunnel",par:2,kind:"shortcut",tee:{x:150,y:330},hole:{x:790,y:330},
      targets:[{x:355,y:455},{x:650,y:455},{x:790,y:330}],walls:[{x:445,y:145,w:65,h:168},{x:445,y:347,w:65,h:72}],water:[],
      description:"Vor der Serie wählen: sicher unten um den Felsen (drei Etappen) oder direkt durch den engen Tunnel. Im Tunnel kostet fehlende Zielkontrolle leicht den ganzen Fortschritt."},
    {name:"Das Sternenportal",par:2,kind:"portal",tee:{x:150,y:410},hole:{x:790,y:235},
      targets:[{x:360,y:390},{x:790,y:235}],walls:[],water:[],portal:{entry:{x:360,y:390},exit:{x:655,y:235}},
      description:"Investiere zwei Punkte in die Portalenergie. Trifft der Ball das violette Portal, erscheint er beim blauen Portal. Die übrigen Punkte steuern den Anflug. Ohne Aktivierung bleibt der Ball vor dem Portal."},
    {name:"Die Förderwerft",par:2,kind:"conveyor",tee:{x:150,y:350},hole:{x:790,y:235},
      targets:[{x:660,y:350},{x:790,y:235}],walls:[],water:[],belt:{x:300,y:310,w:330,h:80},
      description:"Das Band zieht den Ball automatisch nach rechts, sobald er darauf liegt. Sanft: zur Zwischenposition am Bandende, danach folgt ein Putt. Express: stärkeres Band und direkter Versuch aufs Loch. Fehlende Spurkontrolle lässt den Ball seitlich vom Band rollen; fehlende Dosierung verändert die Ausrollstrecke."}
  );
  courses.push({name:"Die Gerade",par:1,kind:"straight",tee:{x:150,y:330},hole:{x:790,y:330},targets:[{x:790,y:330}],walls:[],water:[],description:"Ein freier, gerader Schlag ohne Hindernisse. Alle Antworten richtig (5/5 oder 7/7): garantiert ein Hole-in-one vom Abschlag. Mit Fehlern bleibt ein weiterer Schlag nötig."});
  const themes={straight:["#214b49","#75ba8d","#80c394","#eee0ab"],bank:["#183c33","#4f845b","#71aa71","#a1cf86"],windmill:["#354c63","#6ca186","#83b49a","#d3d8b5"],water:["#0c4052","#5aab9b","#71bba6","#d6bd7c"],shortcut:["#472d35","#b8875b","#c59869","#e9c08b"],portal:["#171a41","#53628d","#6376a1","#afa9ef"],conveyor:["#263e4a","#688d80","#80a493","#c4ae79"]};
  function currentCourse() {
    const base=courses[game.order[game.hole]],ball=game.balls[state.team];
    if(base.kind==="shortcut" && ball?.route==="tunnel") return {...base,targets:[base.hole]};
    if(base.kind==="conveyor") return {...base,targets:ball?.route==="express" ? [base.hole] : base.targets,belt:{...base.belt,direction:1,drive:ball?.route==="express" ? 360 : 200}};
    return base;
  }
  function pointCaps(course,ball,total) {
    const maximum=Math.max(2,Math.ceil((total+1)/2));
    return course.kind==="portal" && ball.stage===0 ? [2,maximum*2-2] : [maximum,maximum];
  }
  function pointBudget(total,correct) {return correct>0 ? correct+Math.max(0,3-total) : 0;}
  function controlLevel(points,maximum) {
    const missing=maximum-points;
    return missing<=0 ? 1 : missing===1 ? .95 : missing===2 ? .65 : missing===3 ? .3 : 0;
  }
  function bestAllocation(course,ball,total,correct) {
    const caps=pointCaps(course,ball,total),budget=pointBudget(total,correct);
    let best=null;
    for(let first=Math.max(0,budget-caps[1]);first<=Math.min(budget,caps[0]);first++) {
      const allocation=[first,budget-first],shot=makeShot(course,ball,correct,total,null,allocation);
      const score=shot.flight.holed ? -100000 : (shot.penalty ? 10000 : 0)+remainingRoute(course,{...shot.position,stage:shot.stage});
      if(!best || score<best.score) best={allocation,score};
    }
    return best.allocation;
  }
  let game=null,frameId=null;
  const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
  const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
  const gateOpen=(time,phase)=>Math.abs(Math.sin(2*(phase+time*1.8)))>.72;
  function close() {
    window.ArenaAudio?.stop();
    if(frameId!==null) cancelAnimationFrame(frameId);
    frameId=null;
    game=null;
  }
  function simulate(course,ball,angle,speed,options={}) {
    let x=ball.x,y=ball.y,vx=Math.cos(angle)*speed,vy=Math.sin(angle)*speed;
    let bounces=0,water=false,rescued=false,holed=false,crossing=null,time=0,travel=0,portalUsed=false;
    const samples=options.record ? [{x,y,time:0,speed,travel:0}] : [];
    function collide(rect) {
      const nearestX=clamp(x,rect.x,rect.x+rect.w),nearestY=clamp(y,rect.y,rect.y+rect.h);
      let dx=x-nearestX,dy=y-nearestY,length=Math.hypot(dx,dy);
      if(length>=radius) return;
      if(length<.0001) {
        const sides=[{depth:x-rect.x,nx:-1,ny:0},{depth:rect.x+rect.w-x,nx:1,ny:0},
          {depth:y-rect.y,nx:0,ny:-1},{depth:rect.y+rect.h-y,nx:0,ny:1}];
        sides.sort((a,b)=>a.depth-b.depth);
        const side=sides[0];
        dx=side.nx;dy=side.ny;length=1;
        x+=dx*(radius+side.depth+.05);
        y+=dy*(radius+side.depth+.05);
      } else {
        x+=dx/length*(radius-length+.05);
        y+=dy/length*(radius-length+.05);
      }
      const nx=dx/length,ny=dy/length,dot=vx*nx+vy*ny;
      if(dot<0) {vx-=(1+restitution)*dot*nx;vy-=(1+restitution)*dot*ny;bounces++;}
    }
    for(let iteration=0;iteration<1200;iteration++) {
      const previous={x,y};
      x+=vx*step;y+=vy*step;time+=step;
      if(x<bounds.left){x=bounds.left;vx=Math.abs(vx)*restitution;bounces++;}
      if(x>bounds.right){x=bounds.right;vx=-Math.abs(vx)*restitution;bounces++;}
      if(y<bounds.top){y=bounds.top;vy=Math.abs(vy)*restitution;bounces++;}
      if(y>bounds.bottom){y=bounds.bottom;vy=-Math.abs(vy)*restitution;bounces++;}
      for(const wall of course.walls) collide(wall);
      if(course.gate) {
        const center=course.gate.x+course.gate.w/2;
        if(crossing===null && (previous.x-center)*(x-center)<=0 && y>=295 && y<=395) crossing=time;
        if(!options.ignoreGate && !gateOpen(time,options.phase ?? 0)) collide(course.gate);
      }
      if(course.water.some(pool=>x>pool.x && x<pool.x+pool.w && y>pool.y && y<pool.y+pool.h)) {
        water=true;
        if(options.safety){x=previous.x;y=previous.y;rescued=true;}
        vx=0;vy=0;
      }
      const onBelt=course.belt && x>course.belt.x && x<course.belt.x+course.belt.w && y>course.belt.y && y<course.belt.y+course.belt.h;
      if(onBelt) vx+=(course.belt.direction ?? 1)*(course.belt.drive ?? 200)*step;
      if(options.portalActive && course.portal && distance({x,y},course.portal.entry)<22 && !portalUsed) {
        x=course.portal.exit.x;y=course.portal.exit.y;vx=0;vy=0;portalUsed=true;
      }
      const velocity=Math.hypot(vx,vy);
      if(!water && options.capture && distance({x,y},course.hole)<13 && velocity<145) {
        x=course.hole.x;y=course.hole.y;vx=0;vy=0;holed=true;
      }
      const reduced=Math.max(0,Math.hypot(vx,vy)-friction*step);
      const factor=Math.hypot(vx,vy)>0 ? reduced/Math.hypot(vx,vy) : 0;
      vx*=factor;vy*=factor;
      travel+=distance(previous,{x,y});
      if(options.record) samples.push({x,y,time,speed:reduced,travel,bounces});
      if(water || holed || portalUsed || (reduced<2 && !onBelt)) break;
    }
    return {x,y,time,bounces,water,rescued,holed,crossing,samples,portalUsed};
  }
  function planShot(course,ball) {
    const target=course.targets[ball.stage],putting=ball.stage===course.targets.length-1;
    const reflected=[target,
      {x:target.x,y:2*bounds.bottom-target.y},
      {x:2*bounds.right-target.x,y:target.y},
      {x:target.x,y:2*bounds.top-target.y},
      {x:2*bounds.left-target.x,y:target.y}];
    let best=null;
    function consider(angle,speed) {
      speed=clamp(speed,25,850);
      const flight=simulate(course,ball,angle,speed,{ignoreGate:true,capture:putting});
      const score=flight.water ? 1e8 : flight.holed ? -1 : distance(flight,target)**2+flight.bounces*.01;
      if(!best || score<best.score) best={angle,speed,flight,score};
    }
    const options=course.kind==="bank" && ball.stage===0 && ball.x<430 ? [reflected[1]] : reflected;
    for(const aim of options) {
      const angle=Math.atan2(aim.y-ball.y,aim.x-ball.x);
      const speed=Math.sqrt(2*friction*distance(ball,aim));
      for(const scale of [.85,1,1.15,1.3]) consider(angle,speed*scale);
    }
    let angleStep=.06,speedStep=55;
    for(let iteration=0;iteration<24;iteration++) {
      const previous=best;
      consider(previous.angle-angleStep,previous.speed);
      consider(previous.angle+angleStep,previous.speed);
      consider(previous.angle,previous.speed-speedStep);
      consider(previous.angle,previous.speed+speedStep);
      if(best===previous){angleStep*=.55;speedStep*=.55;}
      if(best.score<.1) break;
    }
    const phase=Math.PI/4-1.8*(best.flight.crossing ?? 1);
    return {...best,target,putting,phase};
  }
  function remainingRoute(course,ball) {
    // Follow the playable waypoints so a nearby hole behind a wall is not a short putt.
    let remaining=0,previous=ball;
    for(const target of course.targets.slice(ball.stage)) {
      remaining+=distance(previous,target);previous=target;
    }
    return remaining;
  }
  function blockSize(course,ball,maximum) {
    if(ball.shots===0) return maximum;
    const remaining=remainingRoute(course,ball);
    return remaining<=80 ? 1 : remaining<=200 ? 2 : remaining<=350 ? 3 : maximum;
  }
  function makeShot(course,ball,correct,total,joker,allocation=null) {
    const effective=Math.min(total,correct+Number(joker==="precision"));
    const quality=effective/total,error=1-quality,sign=ball.shots%2===0 ? 1 : -1;
    const plan=planShot(course,ball);
    const caps=pointCaps(course,ball,total);
    const guaranteed=course.kind==="straight" && ball.shots===0 && effective===total;
    const first=guaranteed ? 1 : allocation ? controlLevel(allocation[0],caps[0]) : quality;
    const second=guaranteed ? 1 : allocation ? controlLevel(allocation[1],caps[1]) : quality;
    const direction=course.kind==="portal" && ball.stage===0 ? second : course.kind==="windmill" && !plan.putting ? quality : first;
    const angle=plan.angle+sign*(1-direction)*(course.kind==="shortcut" && course.targets.length===1 ? .55 : .3);
    const speed=plan.speed*(1+(plan.putting || course.kind==="water" ? sign : -1)*(1-second)*.55);
    const phase=plan.phase+(1-(course.kind==="windmill" ? first : quality))*.8;
    const portalActive=course.kind==="portal" && ball.stage===0 && allocation?.[0]>=2;
    const flight=effective===0
      ? {x:ball.x,y:ball.y,time:.2,bounces:0,water:false,rescued:false,holed:false,portalUsed:false,crossing:null,
          samples:[{x:ball.x,y:ball.y,time:0,speed:0,travel:0},{x:ball.x,y:ball.y,time:.2,speed:0,travel:0}]}
      : simulate(course,ball,angle,speed,{record:true,capture:plan.putting && !(course.kind==="straight" && ball.shots===0 && effective<total),phase,safety:joker==="safety",portalActive});
    const factor=plan.putting ? "Dosierung" : course.kind==="windmill" ? "Timing" : "Richtung";
    const ideal=plan.putting ? .3 : factor==="Timing" ? .5 : .7;
    const needle=clamp(ideal+sign*(1-quality)*.36,.035,.965);
    const penalty=flight.water && !flight.rescued ? 1 : 0;
    const position=penalty ? {x:ball.x,y:ball.y} : {x:flight.x,y:flight.y};
    let stage=ball.stage;
    if(effective>0 && !flight.water && distance(position,plan.target)<65 && !plan.putting && !(course.kind==="portal" && ball.stage===0)) stage++;
    if(flight.portalUsed) stage=1;
    let message=flight.holed ? "Eingelocht!" : quality===1 ? "Perfekte Vokabelserie. Dein Schwerpunkt bestimmt den Ballweg." : "Der Ball kommt zum Liegen.";
    if(plan.putting && !flight.holed) message=sign>0 ? "Zu kräftig oder seitlich versetzt: Der Ball verfehlt das Loch." : "Zu sanft oder seitlich versetzt: Der Putt bleibt liegen.";
    if(course.kind==="windmill" && !plan.putting && flight.x<course.gate.x && flight.bounces) message="Timing verpasst: Die Windmühle lässt den Ball abprallen.";
    if(flight.portalUsed) message="Portal aktiviert! Der Ball erscheint auf dem Sternengrün.";
    else if(course.kind==="portal" && ball.stage===0) message=portalActive ? "Portal aufgeladen, aber der Anflug verfehlt den Eingang." : "Portal nicht aktiviert. Für den Transport müssen zwei Punkte in Portalenergie investiert werden.";
    if(penalty) message="Im Wasser. Zurück zur vorherigen Position, plus ein Strafschlag.";
    if(flight.rescued) message="Sicherheitsball ausgelöst: vor dem Wasser gestoppt, kein Strafschlag.";
    if(flight.holed && ball.shots===0) message="Hole-in-one! Mit einem Schlag eingelocht.";
    if(effective===0) message="Keine richtige Antwort: Fehlschlag. Der Ball bleibt liegen. Der Versuch zählt als Schlag.";
    return {effective,quality,plan,angle,speed:effective===0 ? 0 : speed,phase,flight,factor,ideal,needle,penalty,position,stage,message,joker,correct,total};
  }

  function start(total,choice=el("golfCourseSelect").value) {
    close();
    game={owner:state,maximum:total===7 ? 7 : 5,total:total===7 ? 7 : 5,hole:0,asked:0,correct:0,answers:[],busy:false,done:false,
      selected:[null,null],jokers:[{precision:true,safety:true},{precision:true,safety:true}],
      scores:[0,0],history:[],balls:[],animation:null,lastSummary:""};
    game.order=choice==="all" ? courses.map((_,i)=>i) : choice==="classic" ? [0,1,2] : [Math.max(0,Math.min(courses.length-1,Number(choice)||0))];
    beginHole();
  }
  function beginHole() {
    const course=courses[game.order[game.hole]];
    game.balls=[0,1].map(()=>({...course.tee,stage:0,holed:false,shots:0,pickedUp:false,route:"safe"}));
    state.team=game.hole%2;
    game.done=false;
    el("golfNextHole").hidden=true;
    el("editGameVocabulary").hidden=false;
    prepareBlock();
    sync();
    question();
  }
  function prepareBlock() {
    game.asked=0;game.correct=0;game.answers=[];game.busy=false;game.animation=null;game.allocating=false;game.allocation=null;
    el("golfAllocation").hidden=true;el("golfGauge").hidden=false;el("golfJokerInfo").hidden=false;
    const course=currentCourse(),ball=game.balls[state.team];
    game.total=blockSize(course,ball,game.maximum);
    game.selected[state.team]=null;
    updateRouteControls();
    game.preview=planShot(course,ball);
    game.previewPath=simulate(course,ball,game.preview.angle,game.preview.speed,{ignoreGate:true,capture:game.preview.putting,record:true}).samples;
    const factor=game.preview.putting ? "Dosierung" : course.kind==="windmill" ? "Timing" : "Richtung";
    el("golfGaugeLabel").textContent=factor+" · "+game.total+" Vokabel"+(game.total===1 ? "" : "n")+" bis zum Schlag · Reststrecke "+Math.round(remainingRoute(course,ball));
    el("golfGauge").dataset.joker=game.selected[state.team] ?? "";
    el("golfNeedle").style.left="50%";
    el("golfIdealZone").style.left=(game.preview.putting ? 30 : factor==="Timing" ? 50 : 70)+"%";
  }
  function turnLabel() {
    return game ? state.teamNames[state.team]+" · Vokabel "+Math.min(game.total,game.asked+1)+"/"+game.total : "";
  }
  function sync() {
    if(!game || game.owner!==state) return;
    const course=currentCourse(),team=state.team,joker=game.selected[team];
    el("score").textContent="Bahn "+(game.hole+1)+"/"+game.order.length+" · "+course.name+" · Par "+course.par;
    el("golfRoute").hidden=game.done;
    for(const id of ["golfRouteA","golfRouteB"]) el(id).disabled=game.busy || game.asked>0 || isComputerTurn();
    el("golfRouteLock").textContent=el("golfRouteButtons").hidden ? "" : game.busy || game.asked>0 ? "Route für diesen Schlag festgelegt." : "Bis zur ersten gewerteten Antwort änderbar.";
    el("golfRouteHeading").textContent=el("golfRouteButtons").hidden ? "Bahnaufgabe" : game.busy || game.asked>0 ? "Deine Route für diesen Schlag" : "1 · Route vor der ersten Antwort wählen";
    el("golfSeries").textContent=game.correct+"/"+game.total+" richtig · "+game.asked+"/"+game.total+" beantwortet · "+game.answers.map(value=>value ? "✓" : "×").join(" ");
    el("golfShotSummary").textContent=game.lastSummary;
    for(const [type,id,stock] of [["precision","golfPrecision","golfPrecisionStock"],["safety","golfSafety","golfSafetyStock"]]) {
      const available=game.jokers[team][type],applicable=type!=="safety" || course.water.length>0;
      el(id).disabled=game.busy || game.done || game.asked>0 || isComputerTurn() || !available || !applicable;
      el(id).setAttribute("aria-pressed",String(joker===type));
      el(stock).textContent=!available ? "Verbraucht" : !applicable ? "Auf dieser Bahn kein Wasser" : joker===type ? "Für diesen Schlag ausgewählt" : "1× verfügbar pro Partie";
    }
    if(!game.busy) {
      el("golfGauge").dataset.joker=joker ?? "";
      el("golfJokerInfo").textContent=joker==="precision" ? "Ausgewählt: +1 richtige Antwort für den nächsten Schlag. Wird erst beim Schlag verbraucht."
        : joker==="safety" ? "Ausgewählt: Der Ball stoppt vor dem Wasser. Kein Strafschlag. Wird beim Schlag verbraucht."
        : "Jede richtige Antwort gibt einen Punkt. Nach der Serie verteilst du die Punkte auf zwei Schlageigenschaften.";
    }
    el("golfJokers").hidden=true;
    el("golfCanvas").setAttribute("aria-label",course.name+". "+state.teamNames.map((name,index)=>name+": "+game.balls[index].shots+" Schläge").join(". "));
    ensureAnimation();
  }
  function chooseJoker(type) {
    return; // Minigolf is played without consumable jokers.
    if(!game || game.busy || game.done || game.asked || isComputerTurn() || !game.jokers[state.team][type]) return;
    if(type==="safety" && !currentCourse().water.length) return;
    game.selected[state.team]=game.selected[state.team]===type ? null : type;
    sync();
  }
  function judge(correct,solution) {
    if(!game || game.owner!==state || game.busy || game.done) return;
    game.asked++;game.correct+=Number(correct);game.answers.push(correct);
    el("judge").hidden=true;
    el("feedback").textContent=correct ? "Richtig!" : "Richtige Lösung: "+solution;
    sync();
    if(game.asked<game.total) {
      el("next").hidden=false;el("next").focus();queueComputerQuestion();return;
    }
    beginAllocation();
  }

  function allocationNames(course,ball) {
    return course.kind==="portal" && ball.stage===0 ? ["Portalenergie (2 zum Aktivieren)","Anflugkontrolle"]
      : course.kind==="shortcut" && course.targets.length===1 ? ["Tunnelgenauigkeit","Bremskontrolle"]
      : course.kind==="conveyor" && ball.stage===0 ? ["Spur auf dem Förderband","Dosierung am Ausgang"]
      : ball.stage===course.targets.length-1 ? ["Zielgenauigkeit","Dosierung"]
      : course.kind==="windmill" ? ["Timing der Durchfahrt","Schwung nach der Mühle"]
      : course.kind==="water" ? ["Spur auf der Brücke","Bremskontrolle"]
      : ["Bandenwinkel","Schwung nach der Bande"];
  }
  function beginAllocation() {
    game.allocating=true;game.busy=true;
    el("golfGauge").hidden=true;el("golfJokerInfo").hidden=true;
    game.allocation=[0,0];
    const caps=pointCaps(currentCourse(),game.balls[state.team],game.total);
    // Start with a balanced, fully spent allocation; every point can be reassigned.
    for(let i=0;i<pointBudget(game.total,game.correct);i++) {
      const slot=game.allocation[0]/caps[0] <= (caps[1] ? game.allocation[1]/caps[1] : 1) && game.allocation[0]<caps[0] ? 0 : 1;
      game.allocation[slot]++;
    }
    el("next").hidden=true;el("editGameVocabulary").hidden=true;
    el("word").textContent="Schlag planen";
    el("answerKey").hidden=true;
    if(isComputerTurn()) game.allocation=bestAllocation(currentCourse(),game.balls[state.team],game.total,game.correct);
    updateAllocation();
    if(isComputerTurn()) swing();
  }
  function updateAllocation() {
    if(!game?.allocating) return;
    const course=currentCourse(),ball=game.balls[state.team],caps=pointCaps(course,ball,game.total);
    const names=allocationNames(course,ball),spent=game.allocation[0]+game.allocation[1];
    el("golfAllocation").hidden=false;
    el("golfPoints").textContent=(pointBudget(game.total,game.correct)-spent)+" von "+pointBudget(game.total,game.correct)+" Punkten frei · "+game.correct+" verdient"+(game.correct>0 && game.total<3 ? " + "+(3-game.total)+" Grundkontrolle" : "");
    names.forEach((name,i)=>{
      el("golfProperty"+i).innerHTML='<strong>'+name+' · '+game.allocation[i]+'/'+caps[i]+'</strong><span class="golfPointSlots" aria-label="'+game.allocation[i]+' von '+caps[i]+' Plätzen belegt">'+Array.from({length:caps[i]},(_,slot)=>'<i class="'+(slot<game.allocation[i] ? 'filled' : '')+'" aria-hidden="true"></i>').join("")+'</span>';
      el("golfMinus"+i).disabled=game.allocation[i]===0;
      el("golfPlus"+i).disabled=spent>=pointBudget(game.total,game.correct) || game.allocation[i]>=caps[i];
      el("golfRow"+i).hidden=caps[i]===0;
    });
    el("golfAllocationHelp").textContent=course.kind==="conveyor" && ball.stage===0
      ? "Spur: mehr Punkte halten den Anflug mittig auf dem Band. Dosierung: mehr Punkte treffen die nötige Ausrollstrecke am Ausgang. "+(ball.route==="express" ? "Express zielt direkt aufs Loch." : "Sanft zielt auf das Bandende.")
      : course.kind==="portal" && ball.stage===0 ? "Portalenergie: genau 2 Punkte schalten den Transport frei. Anflugkontrolle: mehr Punkte treffen den Eingang genauer."
      : "Mehr Punkte in der ersten Eigenschaft verbessern die Richtung bzw. das Timing. Die zweite verbessert die Dosierung.";
    el("golfAllocationHelp").textContent+=" Ein Platz bleibt auch bei perfekter Serie frei. Die letzte fehlende Stufe bedeutet eine kleine Abweichung, weitere Lücken eine deutlichere Schwäche.";
    if(course.kind==="straight" && ball.shots===0) el("golfAllocationHelp").textContent="Gerade Bahn: Bei "+game.total+"/"+game.total+" wird vom Abschlag mit beiden möglichen Schwerpunkten eingelocht. Sonst zeigt die Vorschau den Restweg.";
    const shot=makeShot(course,ball,game.correct,game.total,null,game.allocation);
    game.previewPath=shot.flight.samples;
    game.allocationLanding=shot.flight;
    const consequence=game.correct===0 ? "0 Punkte: Fehlschlag, der Ball bleibt liegen. Der Schlag zählt." : shot.flight.portalUsed ? "Portaltransport zum Sternengrün." : shot.penalty ? "Wasser: Rückkehr und ein Strafschlag."
      : shot.flight.holed ? "Der Ball wird eingelocht."
      : "Voraussichtliche Reststrecke: "+Math.round(remainingRoute(course,{...shot.position,stage:shot.stage}))+".";
    el("golfAllocationEffect").textContent=consequence+" Gelbe Linie: dein Schlag. Orange: Landepunkt.";
    el("golfLaunch").disabled=spent!==pointBudget(game.total,game.correct);
    el("golfLaunch").textContent=game.correct===0 ? "Fehlschlag ausführen (0 Punkte)" : "Schlag mit dieser Verteilung ausführen";
    el("golfGaugeLabel").textContent="Punkte verteilen · erst danach schlagen";
    el("turn").textContent=state.teamNames[state.team]+" plant den Schlag";
    sync();
  }
  function changeAllocation(slot,delta) {
    if(!game?.allocating || isComputerTurn()) return;
    const course=currentCourse(),ball=game.balls[state.team],caps=pointCaps(course,ball,game.total),spent=game.allocation[0]+game.allocation[1];
    if(game.allocation[slot]+delta<0 || game.allocation[slot]+delta>caps[slot] || spent+delta>pointBudget(game.total,game.correct)) return;
    game.allocation[slot]+=delta;updateAllocation();
  }

  function swing() {
    const team=state.team,ball=game.balls[team],course=currentCourse(),joker=game.selected[team];
    const shot=makeShot(course,ball,game.correct,game.total,joker,game.allocation);
    game.allocating=false;el("golfAllocation").hidden=true;el("golfGauge").hidden=false;el("golfJokerInfo").hidden=false;
    if(joker) game.jokers[team][joker]=false;
    game.selected[team]=null;game.busy=true;
    game.animation={team,shot,start:null,ball:{...ball}};
    el("next").hidden=true;
    el("editGameVocabulary").hidden=true;
    el("answerKey").hidden=true;
    el("word").textContent=game.correct+"/"+game.total+" richtig";
    el("golfGauge").dataset.joker=joker ?? "";
    el("golfIdealZone").style.left=(shot.ideal*100)+"%";
    el("golfJokerInfo").textContent=joker==="precision" ? "Präzisionsschläger verbraucht: "+shot.correct+"/"+shot.total+" → "+shot.effective+"/"+shot.total+" Schlagwertung."
      : joker==="safety" ? "Sicherheitsball eingesetzt: Wasser wird für diesen Schlag abgefangen." : "Schlagwertung: "+shot.effective+"/"+shot.total+".";
    sync();
  }
  function ensureAnimation() {
    if(frameId===null && game && !el("game").hidden) frameId=requestAnimationFrame(tick);
  }
  function tick(now) {
    frameId=null;
    if(!game || game.owner!==state || el("game").hidden) return;
    const animation=game.animation;
    if(!animation) {
      draw({clock:now/1000});
      if(!game.done) frameId=requestAnimationFrame(tick);
      return;
    }
    animation.start ??= now;
    const elapsed=now-animation.start,{shot,ball,team}=animation;
    const stage={clock:now/1000,team,clubBall:ball,clubAngle:shot.angle,club:0,joker:shot.joker};
    if(elapsed<1900) {
      const t=elapsed/1900,settle=clamp((t-.72)/.28,0,1);
      const needle=(.5+Math.sin(t*Math.PI*7)*.45)*(1-settle)+shot.needle*settle;
      el("golfNeedle").style.left=(needle*100)+"%";
      el("golfGaugeLabel").textContent=shot.factor+" · "+shot.correct+"/"+shot.total+(shot.joker==="precision" ? " + Präzision = "+shot.effective+"/"+shot.total : "");
    } else {
      el("golfNeedle").style.left=(shot.needle*100)+"%";
      el("golfGaugeLabel").textContent=shot.factor+" · "+(shot.quality===1 ? "Perfekte Serie · Schwerpunkt umgesetzt" : shot.needle<shot.ideal ? "Unter dem Ideal" : "Über dem Ideal");
      if(elapsed>=2150 && elapsed<2800) stage.club=(elapsed-2150)/650;
      if(elapsed>=2800) {
        if(!animation.soundStarted){animation.soundStarted=true;window.ArenaAudio?.play(shot.effective ? "golfClub" : "wrong");}
        const time=(elapsed-2800)/1000,samples=shot.flight.samples;
        const index=Math.min(samples.length-1,Math.floor(time/step));
        const first=samples[index],second=samples[Math.min(index+1,samples.length-1)];
        const mix=clamp((time-first.time)/step,0,1);
        stage.moving={team,x:first.x+(second.x-first.x)*mix,y:first.y+(second.y-first.y)*mix,
          spin:(first.travel+(second.travel-first.travel)*mix)/radius,speed:first.speed,drop:time>shot.flight.time && (shot.flight.holed || shot.penalty) ? clamp((time-shot.flight.time)/.45,0,1) : 0};
        if(!animation.landingSound && time>=shot.flight.time) {animation.landingSound=true;if(shot.flight.holed)window.ArenaAudio?.play("hole");else if(shot.flight.water)window.ArenaAudio?.play("splash");else if(shot.flight.portalUsed)window.ArenaAudio?.play("portal");}
        if((first.bounces ?? 0)>(animation.soundBounces ?? 0)){animation.soundBounces=first.bounces;window.ArenaAudio?.play("bounce");}
        stage.clock=time;stage.phase=shot.phase;
        stage.club=time<.3 ? 1+time : null;
        stage.splash=shot.penalty && time>=shot.flight.time ? clamp((time-shot.flight.time)/.5,0,1) : null;
        stage.rescued=shot.flight.rescued && time>=shot.flight.time;
        if(time>=shot.flight.time+.55) {
          finishShot(team,shot);
          if(game && !game.done && frameId===null) frameId=requestAnimationFrame(tick);
          return;
        }
      }
    }
    draw(stage);
    frameId=requestAnimationFrame(tick);
  }
  function finishShot(team,shot) {
    const ball=game.balls[team];
    Object.assign(ball,shot.position,{stage:shot.stage,holed:shot.flight.holed});
    ball.shots=Math.min(8,ball.shots+1+shot.penalty);
    if(ball.shots>=8 && !ball.holed){ball.holed=true;ball.pickedUp=true;shot.message+=" Schlaglimit erreicht: Ball aufgenommen, nicht eingelocht.";}
    const bonus=shot.joker==="precision" ? " · Präzision "+shot.correct+"→"+shot.effective : shot.joker==="safety" ? " · Sicherheitsball "+(shot.flight.rescued ? "hat geschützt" : "ohne Wasserberührung verbraucht") : "";
    game.lastSummary=state.teamNames[team]+": "+shot.correct+"/"+shot.total+" richtig"+bonus+" · "+shot.flight.bounces+" Abpraller · "+shot.message;
    game.animation=null;game.busy=false;
    el("feedback").textContent=shot.message;
    if(game.balls.every(item=>item.holed)) {
      game.balls.forEach((item,index)=>game.scores[index]+=item.shots);
      game.history.push(game.balls.map(item=>item.shots));game.done=true;
      el("golfJokers").hidden=true;
      el("editGameVocabulary").hidden=true;
      el("word").textContent="Bahn abgeschlossen";
      el("turn").textContent=state.teamNames.map((name,index)=>name+": "+game.balls[index].shots).join(" · ");
      if(game.hole===game.order.length-1) {
        const tie=game.scores[0]===game.scores[1],winner=game.scores[0]<game.scores[1] ? 0 : 1;
        const message=tie ? "Unentschieden!" : state.teamNames[winner]+" gewinnt!";
        el("word").textContent=message;
        el("turn").textContent=state.teamNames.map((name,index)=>name+": "+game.scores[index]+" Schläge").join(" · ");
        showGameResult(tie || !state.computer || winner===0,message+" "+el("turn").textContent);
      } else {el("golfNextHole").hidden=false;el("golfNextHole").focus();}
    } else {
      state.team=game.balls[1-team].holed ? team : 1-team;
      prepareBlock();
      el("turn").textContent=state.teamNames[state.team]+" ist als Nächstes dran";
      el("next").hidden=false;el("editGameVocabulary").hidden=false;el("next").focus();
      queueComputerQuestion();
    }
    sync();
  }
  function stop() {
    if(frameId!==null) cancelAnimationFrame(frameId);
    frameId=null;
    if(!game) return;
    game.busy=false;game.done=true;game.animation=null;game.allocating=false;
    el("golfAllocation").hidden=true;
    el("golfJokers").hidden=true;el("golfNextHole").hidden=true;
  }
  function nextHole() {
    if(!game || !game.done || game.hole>=game.order.length-1) return;
    game.hole++;beginHole();
  }

  function updateRouteControls() {
    const course=currentCourse(),ball=game.balls[state.team];
    el("golfCourseInfo").textContent=course.description ?? (course.kind==="bank" ? "Verteile Punkte auf Bandenwinkel und verbleibenden Schwung." : course.kind==="windmill" ? "Verteile Punkte auf Durchfahrtszeitpunkt und Schwung." : "Halte die Spur über die Brücke und bremse rechtzeitig.");
    const selectable=(course.kind==="shortcut" || course.kind==="conveyor") && ball.stage===0;
    el("golfRouteHeading").textContent=selectable ? "1 · Route vor der ersten Antwort wählen" : "Bahnaufgabe";
    el("golfRouteLock").textContent=selectable ? (game.asked || game.busy ? "Route für diesen Schlag festgelegt." : "Auswahl ist bis zur ersten gewerteten Antwort änderbar.") : "";
    el("golfRouteButtons").hidden=!selectable;
    const tunnel=course.kind==="shortcut";
    const titles=tunnel ? ["Sicher außen herum","Abkürzung durch Tunnel"] : ["Sanft · Zwischenposition","Express · direkt aufs Loch"];
    const descriptions=tunnel
      ? ["Unter dem Felsen entlang. Bei perfekten Schlägen drei Etappen bis ins Loch.","Direkt durch die enge Öffnung. Perfekt: ein Schlag. Fehlender Winkel: Abpraller."]
      : ["Band schiebt sanft nach rechts. Ziel ist das Bandende; ein weiterer Putt bleibt nötig.","Stärkerer Antrieb und Ziel direkt am Loch. Perfekt: ein Schlag. Weniger Kontrolle: seitlich abrollen oder vorbeischießen."];
    ["A","B"].forEach((key,i)=>{
      el("golfRouteTitle"+key).textContent=titles[i];
      el("golfRouteText"+key).textContent=descriptions[i];
      const selected=(i===0)===(ball.route==="safe");
      el("golfRouteBadge"+key).textContent=selected ? "✓ AUSGEWÄHLT" : "AUSWÄHLEN";
    });
    el("golfRouteA").setAttribute("aria-pressed",String(ball.route==="safe"));
    el("golfRouteB").setAttribute("aria-pressed",String(ball.route!=="safe"));
  }
  function chooseRoute(alternate) {
    if(!game || game.busy || game.asked || isComputerTurn()) return;
    const ball=game.balls[state.team],course=currentCourse();
    if(ball.stage!==0 || !["shortcut","conveyor"].includes(course.kind)) return;
    ball.route=alternate ? (course.kind==="shortcut" ? "tunnel" : "express") : "safe";
    prepareBlock();sync();
  }

  function bind() {
    const options=el("golfOptions");
    const picker=document.createElement("label");picker.textContent="Bahnen ";
    const select=document.createElement("select");select.id="golfCourseSelect";
    select.innerHTML='<option value="all">Durchlauf · alle sieben Bahnen</option><option value="classic">Klassiker · bisherige drei Bahnen</option>'+courses.map((c,i)=>'<option value="'+i+'">Einzelbahn · '+c.name+'</option>').join("");
    picker.append(select);options.prepend(picker);
    const route=document.createElement("section");route.id="golfRoute";
    route.innerHTML='<strong id="golfRouteHeading"></strong><div id="golfRouteButtons" hidden>'+["A","B"].map(key=>'<button type="button" id="golfRoute'+key+'"><span id="golfRouteBadge'+key+'"></span><strong id="golfRouteTitle'+key+'"></strong><small id="golfRouteText'+key+'"></small></button>').join("")+'</div><small id="golfRouteLock"></small><details id="golfCourseHelp"><summary>So funktioniert diese Bahn</summary><p id="golfCourseInfo"></p></details>';
    el("turn").before(route);
    el("golfRouteA").onclick=()=>chooseRoute(false);el("golfRouteB").onclick=()=>chooseRoute(true);
    const label=el("golfQuestions").parentElement;
    label.firstChild.textContent="Vokabeln beim ersten Schlag ";
    options.querySelector("details").innerHTML='<summary>Spielregeln</summary><p>Zwei Teams spielen eine ausgewählte Einzelbahn, die bisherigen drei Bahnen oder alle sieben Bahnen im Durchlauf. Der erste Schlag beginnt mit fünf oder sieben Vokabeln. Danach entscheidet die verbleibende spielbare Strecke über die Abfrage: bis 80 Streckeneinheiten eine Vokabel, bis 200 zwei, bis 350 drei, darüber fünf oder sieben. Hindernisse und nötige Umwege zählen mit. Die Anzahl steht vor jeder Serie fest.</p><p>Mehr richtige Antworten verbessern Richtung, Stärke und Timing. Alle Antworten richtig ermöglichen einen sehr guten Schlag mit dem gewählten Schwerpunkt. Ohne richtige Antwort bleibt der Ball liegen; der Versuch zählt trotzdem als Schlag. Ein kurzer Putt mit einer Vokabel gelingt bei richtiger Antwort und verfehlt bei falscher Antwort das Loch. Es gibt keine verbrauchbaren Joker. Jeder Schlag zählt, Wasser kostet einen zusätzlichen Schlag. Nach acht Schlägen wird der Ball aufgenommen. Die niedrigere Gesamtschlagzahl gewinnt.</p>';
    el("golfJokers").style.display="none";
    const panel=document.createElement("section");
    panel.id="golfAllocation";panel.hidden=true;
    panel.innerHTML='<strong id="golfPoints"></strong>'+[0,1].map(i=>'<div id="golfRow'+i+'" class="golfPointRow"><span id="golfProperty'+i+'"></span><button type="button" id="golfMinus'+i+'" aria-label="Punkt entfernen">−</button><button type="button" id="golfPlus'+i+'" aria-label="Punkt hinzufügen">+</button></div>').join("")+'<small id="golfAllocationHelp"></small><small id="golfAllocationEffect"></small><button type="button" id="golfLaunch">Schlagen</button>';
    el("golfJokers").before(panel);
    const style=document.createElement("style");
    style.textContent='#game:not([data-mode=golf]) #golfRoute{display:none!important}#golfRoute{flex:none;font-size:.75rem;line-height:1.3;padding:.35rem .5rem;color:#d5e9de}#golfRoute[hidden],#golfRouteButtons[hidden]{display:none!important}#golfRouteButtons{display:flex;gap:.35rem;margin-top:.3rem}#golfRouteButtons button{flex:1;font-size:.75rem;margin:0;padding:.35rem;min-height:32px}#golfRouteButtons button[aria-pressed=true]{background:#ffdc8c;color:#173d3e}#golfAllocation[hidden]{display:none!important}#golfAllocation{flex:none;padding:.5rem;border:1px solid #8da89b;border-radius:10px;background:#183d3b;color:#fff2cd;display:grid;gap:.3rem;font-size:.8rem}#golfAllocation .golfPointRow{display:flex;align-items:center;gap:.35rem}#golfAllocation .golfPointRow span{flex:1}#golfAllocation button{margin:0;padding:.3rem .65rem;min-height:32px}#golfAllocation small{line-height:1.3}';
    style.textContent+="#golfRouteButtons button[aria-pressed=true] small{color:#243444}";
    style.textContent+="#golfCourseSelect{min-height:48px;border:2px solid #f1cf79;background:#1b3551;font-weight:700}#golfOptions>label:first-child{padding:.65rem;border:1px solid #a68d51;border-radius:10px;background:#1b2d43}#golfRoute{order:-1;display:grid;gap:.4rem;margin:0 0 .45rem;padding:.65rem;border:2px solid #e2bf70;border-radius:12px;background:#1b3043;color:#f5edd5;font-size:.85rem;line-height:1.3;flex:none}#golfRouteHeading{font-size:.95rem;color:#ffe09b}#golfRouteButtons{display:grid;grid-template-columns:1fr 1fr;gap:.4rem}#golfRouteButtons button{display:grid;align-content:start;gap:.25rem;min-height:114px;margin:0;padding:.5rem;text-align:left;border:2px solid #8395b5;background:#273d5c;color:#fff;font-size:.8rem}#golfRouteButtons button strong{font-size:.9rem}#golfRouteButtons button small{line-height:1.3}#golfRouteButtons button span{font-size:.65rem;letter-spacing:.05em;font-weight:800}#golfRouteButtons button[aria-pressed=true]{border-color:#ffe09b;background:#f5d486;color:#182a39;box-shadow:0 0 0 2px #ffe09b33}#golfRouteButtons button:disabled{opacity:.85}#golfRouteLock{font-size:.7rem}#golfCourseHelp{font-size:.75rem}#golfCourseHelp p{margin:.4rem 0;max-height:5rem;overflow:auto}#golfAllocationHelp{color:#cce8e3;max-height:3.8em;overflow:auto}#golfRoute:has(#golfRouteButtons[hidden]){border-color:#577481;padding:.4rem}#golfRouteButtons[hidden],#golfRoute[hidden]{display:none!important}";
    style.textContent+=".golfPointSlots{display:flex;justify-content:center;gap:4px;margin-top:5px}.golfPointSlots i{display:block;inline-size:18px;block-size:12px;border:2px solid #b4c6bb;border-radius:3px;background:#19303a}.golfPointSlots i.filled{background:#f4cf79;border-color:#f4cf79}#golfAllocation .golfPointRow>span{font-size:.77rem}#golfAllocationHelp{max-height:3.8em;overflow:auto}";
    document.head.append(style);
    [0,1].forEach(i=>{el("golfMinus"+i).onclick=()=>changeAllocation(i,-1);el("golfPlus"+i).onclick=()=>changeAllocation(i,1);});
    el("golfLaunch").onclick=()=>{if(game?.allocating && game.allocation[0]+game.allocation[1]===pointBudget(game.total,game.correct)) swing();};
    options.querySelector("details").innerHTML+='<p>Jede richtige Antwort gibt einen Punkt für diesen Schlag. Nach der Serie verteilst du alle Punkte mit Minus und Plus. Die beiden Eigenschaften und ihre Höchstwerte hängen von Bahn und Serienlänge ab. Die Vorschau zeigt den resultierenden Weg und Landepunkt. Erst mit „Schlagen“ startet die Animation. Bei fünf Fragen gibt es drei Plätze pro Eigenschaft, bei sieben vier. Auch bei perfekter Serie bleibt mindestens ein Platz frei. Kurze Serien mit zwei bzw. einer Frage erhalten bei mindestens einer richtigen Antwort einen bzw. zwei Punkte Grundkontrolle. Null richtige Antworten bleiben ein Fehlschlag. Punkte werden bei jedem Schlag neu verdient. Der Computer verteilt seine Punkte automatisch.</p>';

    el("golfPrecision").onclick=()=>chooseJoker("precision");
    el("golfSafety").onclick=()=>chooseJoker("safety");
    el("golfNextHole").onclick=nextHole;
  }

  function rounded(ctx,x,y,w,h,r,fill,stroke=null) {
    ctx.beginPath();ctx.roundRect(x,y,w,h,r);
    if(fill){ctx.fillStyle=fill;ctx.fill();}
    if(stroke){ctx.strokeStyle=stroke;ctx.stroke();}
  }
  function drawBall(ctx,x,y,color,spin=0,drop=0,safety=false) {
    const r=radius*(1-drop);
    if(r<=0) return;
    ctx.fillStyle="#061c254a";ctx.beginPath();ctx.ellipse(x+3,y+6,r+4,r*.55,0,0,Math.PI*2);ctx.fill();
    if(safety) {ctx.strokeStyle="#ffdf83";ctx.lineWidth=3;ctx.beginPath();ctx.arc(x,y,r+5,0,Math.PI*2);ctx.stroke();}
    const shine=ctx.createRadialGradient(x-r*.35,y-r*.4,0,x,y,r);
    shine.addColorStop(0,"#ffffff");shine.addColorStop(.35,color);shine.addColorStop(1,"#244658");
    ctx.fillStyle=shine;ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill();
    ctx.save();ctx.translate(x,y);ctx.rotate(spin);
    ctx.strokeStyle="#ffffff66";ctx.lineWidth=1.5;
    ctx.beginPath();ctx.ellipse(0,0,r*.35,r*.84,.4,0,Math.PI*2);ctx.stroke();
    ctx.restore();
  }
  function drawClub(ctx,ball,angle,phase,precision) {
    const ux=Math.cos(angle),uy=Math.sin(angle),nx=-uy,ny=ux;
    let pull;
    if(phase<=.45) pull=Math.sin(phase/.45*Math.PI/2)*38;
    else pull=38*(1-((Math.min(1,phase)-.45)/.55)**2);
    const follow=Math.max(0,phase-1)*65;
    const x=ball.x-ux*(12+pull-follow),y=ball.y-uy*(12+pull-follow);
    ctx.save();ctx.translate(x,y);ctx.rotate(angle);
    ctx.strokeStyle="#09232666";ctx.lineWidth=6;ctx.beginPath();ctx.moveTo(5,-5);ctx.lineTo(-28,-66);ctx.stroke();
    const metal=ctx.createLinearGradient(-35,-70,4,12);
    metal.addColorStop(0,precision ? "#f5d46b" : "#aab8c1");metal.addColorStop(.5,"#f6ffff");metal.addColorStop(1,precision ? "#c9942d" : "#687f91");
    ctx.strokeStyle=metal;ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(-3,0);ctx.lineTo(-33,-70);ctx.stroke();
    ctx.strokeStyle="#1b2738";ctx.lineWidth=7;ctx.beginPath();ctx.moveTo(-26,-55);ctx.lineTo(-33,-70);ctx.stroke();
    rounded(ctx,-7,-14,11,28,3,metal,"#233e4b");
    ctx.restore();
  }
  function draw(stage={}) {
    if(!game) return;
    const ctx=el("golfCanvas").getContext("2d"),course=currentCourse(),clock=stage.clock ?? 0;
    const palette=themes[course.kind];
    ctx.clearRect(0,0,960,600);
    const background=ctx.createLinearGradient(0,0,960,600);
    background.addColorStop(0,palette[0]);background.addColorStop(1,"#0e292d");
    ctx.fillStyle=background;ctx.fillRect(0,0,960,600);
    // Stable vegetation texture remains stationary while the ball rolls.
    for(let i=0;i<84;i++) {
      const x=(i*137+31)%960,y=(i*83+47)%600;
      ctx.fillStyle=i%2 ? "#285449" : "#32604c";
      ctx.beginPath();ctx.ellipse(x,y,3+(i%4),2,0,0,Math.PI*2);ctx.fill();
    }
    ctx.fillStyle="#071f2a66";rounded(ctx,63,141,838,396,31,"#071f2a66");
    rounded(ctx,66,131,828,398,26,palette[3],"#ecd6a3");
    ctx.lineWidth=4;rounded(ctx,73,138,814,384,20,"#78533b","#dfbc83");
    rounded(ctx,80,145,800,370,14,palette[1]);
    ctx.save();ctx.beginPath();ctx.roundRect(80,145,800,370,14);ctx.clip();
    for(let x=80;x<880;x+=44) {
      ctx.fillStyle=(x-80)%88===0 ? palette[1] : palette[2];
      ctx.fillRect(x,145,44,370);
    }
    for(let i=0;i<230;i++) {
      const x=86+(i*103)%785,y=151+(i*71)%356;
      ctx.fillStyle=i%3 ? "#e1f7bc13" : "#225c3c16";ctx.fillRect(x,y,2,2);
    }
    const shadow=ctx.createLinearGradient(80,145,80,515);
    shadow.addColorStop(0,"#17472a33");shadow.addColorStop(.25,"#ffffff00");shadow.addColorStop(1,"#214e3222");
    ctx.fillStyle=shadow;ctx.fillRect(80,145,800,370);
    if(course.water.length) {
      for(const pool of course.water) {
        const blue=ctx.createLinearGradient(0,pool.y,0,pool.y+pool.h);
        blue.addColorStop(0,"#246d94");blue.addColorStop(.5,"#2b9ebb");blue.addColorStop(1,"#165b80");
        ctx.fillStyle=blue;ctx.fillRect(pool.x,pool.y,pool.w,pool.h);
        ctx.strokeStyle="#a1f3f644";ctx.lineWidth=1.5;
        for(let row=pool.y+12;row<pool.y+pool.h;row+=18) {
          ctx.beginPath();
          for(let x=pool.x+4;x<pool.x+pool.w-4;x+=5) {
            const y=row+Math.sin(x*.07+clock*1.4)*2.5;
            if(x===pool.x+4)ctx.moveTo(x,y);else ctx.lineTo(x,y);
          }
          ctx.stroke();
        }
      }
      rounded(ctx,406,296,158,108,5,"#654b36");
      for(let x=411;x<562;x+=13) {
        const wood=ctx.createLinearGradient(x,300,x+11,400);
        wood.addColorStop(0,"#d3ae70");wood.addColorStop(.45,"#e0bf86");wood.addColorStop(1,"#ad814f");
        rounded(ctx,x,300,11,100,1,wood);
      }
      ctx.fillStyle="#f0d9aa";ctx.fillRect(406,294,158,5);ctx.fillRect(406,401,158,5);
    }

    if(course.kind==="straight") {
      ctx.strokeStyle="#f5ffe77a";ctx.lineWidth=3;ctx.setLineDash([10,12]);ctx.beginPath();ctx.moveTo(175,330);ctx.lineTo(765,330);ctx.stroke();ctx.setLineDash([]);
      rounded(ctx,300,180,360,47,12,"#214b49");ctx.fillStyle="#fff2cd";ctx.textAlign="center";ctx.font="bold 22px sans-serif";ctx.fillText("PAR 1 · HOLE-IN-ONE",480,212);
      ctx.font="16px sans-serif";ctx.fillStyle="#244e40";ctx.fillText("Perfekte Serie = ein Schlag",480,460);
    }
    if(course.kind==="shortcut") {
      ctx.fillStyle="#d7aa7466";
      for(let i=0;i<28;i++){ctx.beginPath();ctx.ellipse(110+i*27,180+(i*61)%300,12,5,.3,0,Math.PI*2);ctx.fill();}
      for(const wall of course.walls){rounded(ctx,wall.x-12,wall.y,wall.w+24,wall.h,16,"#765147","#dbb287");
        for(let y=wall.y+12;y<wall.y+wall.h;y+=30){ctx.strokeStyle="#a47a60";ctx.beginPath();ctx.moveTo(wall.x-6,y);ctx.lineTo(wall.x+wall.w+5,y+8);ctx.stroke();}}
      rounded(ctx,439,313,77,34,6,"#251e2c","#f3c97b");
      ctx.fillStyle="#ffe8b2";ctx.font="bold 12px sans-serif";ctx.textAlign="center";ctx.fillText("TUNNEL",477,335);
    }
    if(course.belt) {
      const b=course.belt;rounded(ctx,b.x-5,b.y-6,b.w+10,b.h+12,12,"#253740","#e1b664");
      rounded(ctx,b.x,b.y,b.w,b.h,8,"#556674");
      ctx.save();ctx.beginPath();ctx.rect(b.x,b.y,b.w,b.h);ctx.clip();
      for(let x=b.x-30;x<b.x+b.w+30;x+=28){const moving=x+(clock*35*(b.direction ?? 1))%28;ctx.strokeStyle="#aec6c6";ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(moving,b.y+4);ctx.lineTo(moving,b.y+b.h-4);ctx.stroke();}
      ctx.fillStyle="#ffe09b";ctx.font="bold 30px sans-serif";ctx.textAlign="center";ctx.fillText((b.direction ?? 1)>0 ? "› › › › ›" : "‹ ‹ ‹ ‹ ‹",b.x+b.w/2,b.y+50);ctx.restore();
    }
    if(course.portal) {
      for(const [point,color,label] of [[course.portal.entry,"#df9cff","EINGANG · 2 PUNKTE"],[course.portal.exit,"#8eeeff","AUSGANG"]]) {
        ctx.fillStyle=color+"22";ctx.beginPath();ctx.ellipse(point.x,point.y,42,30,0,0,Math.PI*2);ctx.fill();
        ctx.strokeStyle=color;ctx.lineWidth=4;ctx.beginPath();ctx.ellipse(point.x,point.y,26,19,0,0,Math.PI*2);ctx.stroke();
        ctx.save();ctx.translate(point.x,point.y);ctx.rotate(clock);ctx.setLineDash([7,6]);ctx.lineWidth=2;ctx.beginPath();ctx.arc(0,0,33,0,Math.PI*2);ctx.stroke();ctx.restore();
        ctx.fillStyle=color;ctx.font="bold 12px sans-serif";ctx.textAlign="center";ctx.fillText(label,point.x,point.y-43);
      }
      for(let i=0;i<35;i++){ctx.fillStyle="#ddd9ff88";ctx.fillRect(110+(i*73)%720,165+(i*53)%320,2,2);}
    }

    if((!game.busy || game.allocating) && !game.done && game.previewPath) {
      ctx.strokeStyle="#fff2a058";ctx.lineWidth=2;ctx.setLineDash([5,9]);ctx.beginPath();
      game.previewPath.forEach((point,index)=>{if(index%8===0){if(index===0)ctx.moveTo(point.x,point.y);else ctx.lineTo(point.x,point.y)}});
      ctx.stroke();ctx.setLineDash([]);
      const target=game.allocating ? game.allocationLanding : course.targets[game.balls[state.team].stage];
      ctx.strokeStyle=game.allocating ? "#ffad54" : "#fff1b9aa";ctx.beginPath();ctx.arc(target.x,target.y,17,0,Math.PI*2);ctx.stroke();
    }
    for(const wall of course.kind==="shortcut" ? [] : course.walls) {
      rounded(ctx,wall.x+5,wall.y+6,wall.w,wall.h,4,"#163b3b55");
      rounded(ctx,wall.x,wall.y,wall.w,wall.h,4,"#a7b4ab","#dbe1bf");
      ctx.fillStyle="#607e78";ctx.fillRect(wall.x+wall.w-5,wall.y+4,5,wall.h-4);
      ctx.strokeStyle="#728d82";ctx.lineWidth=1;
      for(let y=wall.y+19;y<wall.y+wall.h;y+=24){ctx.beginPath();ctx.moveTo(wall.x+2,y);ctx.lineTo(wall.x+wall.w-3,y);ctx.stroke();}
    }
    if(course.kind==="windmill") {
      const x=482,y=263,angle=(stage.phase ?? 0)+clock*1.8,open=gateOpen(clock,stage.phase ?? 0);
      ctx.fillStyle="#173e3d55";ctx.beginPath();ctx.ellipse(x+8,y+17,53,22,0,0,Math.PI*2);ctx.fill();
      rounded(ctx,x-30,y-48,60,53,5,"#bf6654","#f4d69d");
      ctx.fillStyle="#f0cc8b";ctx.beginPath();ctx.moveTo(x-39,y-48);ctx.lineTo(x,y-83);ctx.lineTo(x+39,y-48);ctx.closePath();ctx.fill();
      ctx.save();ctx.translate(x,y);ctx.rotate(angle);
      for(let i=0;i<4;i++){
        ctx.rotate(Math.PI/2);rounded(ctx,8,-7,83,14,3,"#eee1b1","#8b7553");
        ctx.strokeStyle="#ba9b6d";ctx.lineWidth=2;
        for(let rib=20;rib<90;rib+=16){ctx.beginPath();ctx.moveTo(rib,-5);ctx.lineTo(rib,5);ctx.stroke();}
      }
      ctx.restore();
      ctx.fillStyle="#735344";ctx.beginPath();ctx.arc(x,y,11,0,Math.PI*2);ctx.fill();
      ctx.fillStyle=open ? "#b7ff9e" : "#f28a6d";ctx.beginPath();ctx.arc(449,309,6,0,Math.PI*2);ctx.fill();
      ctx.fillStyle=open ? "#b7ff9e30" : "#e88a6b24";ctx.fillRect(470,295,24,100);
    }
    const hole=course.hole;
    ctx.fillStyle="#4a714c";ctx.beginPath();ctx.ellipse(hole.x,hole.y+2,18,11,0,0,Math.PI*2);ctx.fill();
    ctx.fillStyle="#102a2e";ctx.beginPath();ctx.ellipse(hole.x,hole.y,12,8,0,0,Math.PI*2);ctx.fill();
    ctx.strokeStyle="#ecedd3";ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(hole.x,hole.y);ctx.lineTo(hole.x,hole.y-70);ctx.stroke();
    ctx.fillStyle="#e56f5e";ctx.beginPath();ctx.moveTo(hole.x,hole.y-71);ctx.quadraticCurveTo(hole.x+23,hole.y-78+Math.sin(clock*2)*3,hole.x+45,hole.y-58);ctx.lineTo(hole.x,hole.y-48);ctx.closePath();ctx.fill();
    ctx.fillStyle="#fff5cf";ctx.font="bold 16px sans-serif";ctx.textAlign="center";ctx.fillText(String(game.hole+1),hole.x+16,hole.y-57);
    [1-state.team,state.team].forEach(index=>{
      const ball=game.balls[index];
      if(ball.holed) return;
      ctx.globalAlpha=index===state.team ? 1 : .55;
      const moving=stage.moving?.team===index;
      if(moving) drawBall(ctx,stage.moving.x,stage.moving.y,index===0 ? "#bcf1ff" : "#ffd1a9",stage.moving.spin,stage.moving.drop,stage.rescued);
      else drawBall(ctx,ball.x,ball.y,index===0 ? "#bcf1ff" : "#ffd1a9",0,0,game.selected[index]==="safety");
      ctx.globalAlpha=1;
    });
    if(stage.clubBall && stage.club!==null) drawClub(ctx,stage.clubBall,stage.clubAngle,stage.club,stage.joker==="precision");
    else if(!game.busy && !game.done) drawClub(ctx,game.balls[state.team],game.preview.angle,0,game.selected[state.team]==="precision");
    if(stage.splash!==null && stage.splash!==undefined && stage.moving) {
      ctx.strokeStyle="#c0faff";ctx.lineWidth=2;ctx.globalAlpha=1-stage.splash;
      ctx.beginPath();ctx.ellipse(stage.moving.x,stage.moving.y,10+stage.splash*35,5+stage.splash*17,0,0,Math.PI*2);ctx.stroke();
      ctx.globalAlpha=1;
    }
    ctx.restore();
    // Border fasteners and planting provide depth outside the playable green.
    for(let x=100;x<880;x+=54)for(const y of [138,522]){ctx.fillStyle="#e5d0a3";ctx.beginPath();ctx.arc(x,y,2,0,Math.PI*2);ctx.fill();}
    for(const [x,y] of [[33,164],[920,185],[34,432],[927,464],[110,565],[855,565]]) {
      ctx.fillStyle="#091f2b55";ctx.beginPath();ctx.ellipse(x+4,y+8,29,19,0,0,Math.PI*2);ctx.fill();
      const leaves=ctx.createRadialGradient(x-8,y-8,1,x,y,29);leaves.addColorStop(0,"#69a96e");leaves.addColorStop(1,"#205644");
      ctx.fillStyle=leaves;ctx.beginPath();ctx.arc(x,y,25,0,Math.PI*2);ctx.fill();
      for(let p=0;p<5;p++){ctx.fillStyle=p%2 ? "#f5c68e" : "#f3928b";ctx.beginPath();ctx.arc(x+Math.cos(p*2.5)*17,y+Math.sin(p*2.5)*16,3,0,Math.PI*2);ctx.fill();}
    }
    rounded(ctx,20,16,920,81,13,"#102b36f2","#50776e");
    ctx.textAlign="left";ctx.fillStyle="#fff2cd";ctx.font="bold 25px sans-serif";ctx.fillText(course.name,37,47,330);
    ctx.font="16px sans-serif";ctx.fillStyle="#c1dace";ctx.fillText("Bahn "+(game.hole+1)+" / "+game.order.length+" · Par "+course.par,38,76);
    state.teamNames.forEach((name,index)=>{
      const x=index===0 ? 390 : 665;
      ctx.fillStyle=index===0 ? "#bcecff" : "#ffd1a6";ctx.font="bold 18px sans-serif";ctx.fillText(name,x,46,240);
      ctx.fillStyle="#d5e9de";ctx.font="16px sans-serif";
      ctx.fillText(game.balls[index].shots+(game.balls[index].pickedUp ? " · aufgenommen" : " Schläge")+" · gesamt "+(game.scores[index]+(game.done ? 0 : game.balls[index].shots)),x,73,240);
      if(state.team===index && !game.done){ctx.fillStyle="#f6dc91";ctx.beginPath();ctx.arc(x-12,40,4,0,Math.PI*2);ctx.fill();}
    });
    ctx.fillStyle="#c9e2d7";ctx.font="15px sans-serif";ctx.textAlign="center";
    const caption=game.allocating ? "Verteile deine Punkte und vergleiche die Flugbahn" : game.busy ? "Schlagwertung "+game.correct+"/"+game.total+(stage.joker==="precision" ? " + Präzisionsschläger" : "")
      : game.done ? "Bahnwertung abgeschlossen" : course.kind==="straight" ? "Gerade zum Loch · alle Antworten richtig: Hole-in-one" : course.kind==="portal" && game.balls[state.team].stage===0 ? "Portalenergie und Anflugkontrolle getrennt planen" : course.kind==="shortcut" ? "Route: "+(game.balls[state.team].route==="tunnel" ? "enger Tunnel" : "sicherer Außenweg") : course.kind==="conveyor" ? "Förderband und Ausrollweg einplanen" : game.preview.putting ? "Nächster Schlag: dosierter Putt zum Loch"
      : course.kind==="bank" ? "Nächster Schlag: über die Bande in die freie Position"
      : course.kind==="windmill" ? "Nächster Schlag: im passenden Moment durch die Windmühle"
      : "Nächster Schlag: sicher über die Brücke";
    ctx.fillText(caption,480,563,700);
    if(!game.busy && !game.done) {ctx.font="14px sans-serif";ctx.fillText("Reststrecke "+Math.round(remainingRoute(course,game.balls[state.team]))+" · "+game.total+" Vokabel"+(game.total===1 ? "" : "n")+" für diesen Schlag",480,586,740);}
  }
  return {start,close,sync,judge,turnLabel,bind,stop};
})();

