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
  let game=null,frameId=null;
  const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
  const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
  const gateOpen=(time,phase)=>Math.abs(Math.sin(2*(phase+time*1.8)))>.72;
  function close() {
    if(frameId!==null) cancelAnimationFrame(frameId);
    frameId=null;
    game=null;
  }
  function simulate(course,ball,angle,speed,options={}) {
    let x=ball.x,y=ball.y,vx=Math.cos(angle)*speed,vy=Math.sin(angle)*speed;
    let bounces=0,water=false,rescued=false,holed=false,crossing=null,time=0,travel=0;
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
      const velocity=Math.hypot(vx,vy);
      if(!water && options.capture && distance({x,y},course.hole)<13 && velocity<145) {
        x=course.hole.x;y=course.hole.y;vx=0;vy=0;holed=true;
      }
      const reduced=Math.max(0,Math.hypot(vx,vy)-friction*step);
      const factor=Math.hypot(vx,vy)>0 ? reduced/Math.hypot(vx,vy) : 0;
      vx*=factor;vy*=factor;
      travel+=distance(previous,{x,y});
      if(options.record) samples.push({x,y,time,speed:reduced,travel});
      if(water || holed || reduced<2) break;
    }
    return {x,y,time,bounces,water,rescued,holed,crossing,samples};
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
  function makeShot(course,ball,correct,total,joker) {
    const effective=Math.min(total,correct+Number(joker==="precision"));
    const quality=effective/total,error=(1-quality)**2,sign=ball.shots%2===0 ? 1 : -1;
    const plan=planShot(course,ball);
    const angle=plan.angle+sign*error*.3;
    const speed=plan.speed*(1+sign*error*.55);
    const phase=plan.phase+(1-quality)*.8;
    const flight=simulate(course,ball,angle,speed,{record:true,capture:plan.putting,phase,safety:joker==="safety"});
    const factor=plan.putting ? "Schlagstärke" : course.kind==="windmill" ? "Timing" : "Richtung";
    const ideal=plan.putting ? .3 : factor==="Timing" ? .5 : .7;
    const needle=clamp(ideal+sign*(1-quality)*.36,.035,.965);
    const penalty=flight.water && !flight.rescued ? 1 : 0;
    const position=penalty ? {x:ball.x,y:ball.y} : {x:flight.x,y:flight.y};
    let stage=ball.stage;
    if(!flight.water && distance(position,plan.target)<65 && !plan.putting) stage++;
    let message=flight.holed ? "Eingelocht!" : quality===1 ? "Ideal getroffen. Der Ball rollt in die geplante Position." : "Der Ball kommt zum Liegen.";
    if(plan.putting && !flight.holed) message=sign>0 ? "Zu kräftig oder seitlich versetzt: Der Ball verfehlt das Loch." : "Zu sanft oder seitlich versetzt: Der Putt bleibt liegen.";
    if(course.kind==="windmill" && !plan.putting && flight.x<course.gate.x && flight.bounces) message="Timing verpasst: Die Windmühle lässt den Ball abprallen.";
    if(penalty) message="Im Wasser. Zurück zur vorherigen Position, plus ein Strafschlag.";
    if(flight.rescued) message="Sicherheitsball ausgelöst: vor dem Wasser gestoppt, kein Strafschlag.";
    return {effective,quality,plan,angle,speed,phase,flight,factor,ideal,needle,penalty,position,stage,message,joker,correct,total};
  }

  function start(total) {
    close();
    game={owner:state,total:total===7 ? 7 : 5,hole:0,asked:0,correct:0,answers:[],busy:false,done:false,
      selected:[null,null],jokers:[{precision:true,safety:true},{precision:true,safety:true}],
      scores:[0,0],history:[],balls:[],animation:null,lastSummary:""};
    beginHole();
  }
  function beginHole() {
    const course=courses[game.hole];
    game.balls=[0,1].map(()=>({...course.tee,stage:0,holed:false,shots:0}));
    state.team=game.hole%2;
    game.done=false;
    el("golfNextHole").hidden=true;
    el("editGameVocabulary").hidden=false;
    prepareBlock();
    sync();
    question();
  }
  function prepareBlock() {
    game.asked=0;game.correct=0;game.answers=[];game.busy=false;game.animation=null;
    const course=courses[game.hole],ball=game.balls[state.team];
    if(isComputerTurn()) {
      if(course.kind==="water" && ball.stage===1 && game.jokers[1].safety) game.selected[1]="safety";
      else if(ball.stage===course.targets.length-1 && game.jokers[1].precision) game.selected[1]="precision";
    }
    game.preview=planShot(course,ball);
    game.previewPath=simulate(course,ball,game.preview.angle,game.preview.speed,{ignoreGate:true,capture:game.preview.putting,record:true}).samples;
    const factor=game.preview.putting ? "Schlagstärke" : course.kind==="windmill" ? "Timing" : "Richtung";
    el("golfGaugeLabel").textContent=factor+" · Zeiger und Schlag folgen nach "+game.total+" Antworten";
    el("golfGauge").dataset.joker=game.selected[state.team] ?? "";
    el("golfNeedle").style.left="50%";
    el("golfIdealZone").style.left=(game.preview.putting ? 30 : factor==="Timing" ? 50 : 70)+"%";
  }
  function turnLabel() {
    return game ? state.teamNames[state.team]+" · Vokabel "+Math.min(game.total,game.asked+1)+"/"+game.total : "";
  }
  function sync() {
    if(!game || game.owner!==state) return;
    const course=courses[game.hole],team=state.team,joker=game.selected[team];
    el("score").textContent="Bahn "+(game.hole+1)+"/3 · "+course.name+" · Par "+course.par;
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
        : game.asked ? "Die Jokerwahl ist für diese Serie abgeschlossen." : "Vor der ersten Antwort optional einen Joker auswählen.";
    }
    el("golfJokers").hidden=game.done;
    el("golfCanvas").setAttribute("aria-label",course.name+". "+state.teamNames.map((name,index)=>name+": "+game.balls[index].shots+" Schläge").join(". "));
    ensureAnimation();
  }
  function chooseJoker(type) {
    if(!game || game.busy || game.done || game.asked || isComputerTurn() || !game.jokers[state.team][type]) return;
    if(type==="safety" && !courses[game.hole].water.length) return;
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
    swing();
  }
  function swing() {
    const team=state.team,ball=game.balls[team],course=courses[game.hole],joker=game.selected[team];
    const shot=makeShot(course,ball,game.correct,game.total,joker);
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
      el("golfGaugeLabel").textContent=shot.factor+" · "+(shot.quality===1 ? "Ideal getroffen" : shot.needle<shot.ideal ? "Unter dem Ideal" : "Über dem Ideal");
      if(elapsed>=2150 && elapsed<2800) stage.club=(elapsed-2150)/650;
      if(elapsed>=2800) {
        const time=(elapsed-2800)/1000,samples=shot.flight.samples;
        const index=Math.min(samples.length-1,Math.floor(time/step));
        const first=samples[index],second=samples[Math.min(index+1,samples.length-1)];
        const mix=clamp((time-first.time)/step,0,1);
        stage.moving={team,x:first.x+(second.x-first.x)*mix,y:first.y+(second.y-first.y)*mix,
          spin:(first.travel+(second.travel-first.travel)*mix)/radius,speed:first.speed,drop:time>shot.flight.time && (shot.flight.holed || shot.penalty) ? clamp((time-shot.flight.time)/.45,0,1) : 0};
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
    if(ball.shots>=8 && !ball.holed){ball.holed=true;shot.message+=" Nach acht Schlägen wird der Ball aufgenommen.";}
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
      if(game.hole===courses.length-1) {
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
    game.busy=false;game.done=true;game.animation=null;
    el("golfJokers").hidden=true;el("golfNextHole").hidden=true;
  }
  function nextHole() {
    if(!game || !game.done || game.hole>=courses.length-1) return;
    game.hole++;beginHole();
  }
  function bind() {
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
    const ctx=el("golfCanvas").getContext("2d"),course=courses[game.hole],clock=stage.clock ?? 0;
    ctx.clearRect(0,0,960,600);
    const background=ctx.createLinearGradient(0,0,960,600);
    background.addColorStop(0,"#173d3e");background.addColorStop(1,"#0e292d");
    ctx.fillStyle=background;ctx.fillRect(0,0,960,600);
    // Stable vegetation texture remains stationary while the ball rolls.
    for(let i=0;i<84;i++) {
      const x=(i*137+31)%960,y=(i*83+47)%600;
      ctx.fillStyle=i%2 ? "#285449" : "#32604c";
      ctx.beginPath();ctx.ellipse(x,y,3+(i%4),2,0,0,Math.PI*2);ctx.fill();
    }
    ctx.fillStyle="#071f2a66";rounded(ctx,63,141,838,396,31,"#071f2a66");
    rounded(ctx,66,131,828,398,26,"#b1875b","#ecd6a3");
    ctx.lineWidth=4;rounded(ctx,73,138,814,384,20,"#78533b","#dfbc83");
    rounded(ctx,80,145,800,370,14,"#75b982");
    ctx.save();ctx.beginPath();ctx.roundRect(80,145,800,370,14);ctx.clip();
    for(let x=80;x<880;x+=44) {
      ctx.fillStyle=(x-80)%88===0 ? "#75b982" : "#6caf7d";
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
    if(!game.busy && !game.done && game.previewPath) {
      ctx.strokeStyle="#fff2a058";ctx.lineWidth=2;ctx.setLineDash([5,9]);ctx.beginPath();
      game.previewPath.forEach((point,index)=>{if(index%8===0){if(index===0)ctx.moveTo(point.x,point.y);else ctx.lineTo(point.x,point.y)}});
      ctx.stroke();ctx.setLineDash([]);
      const target=course.targets[game.balls[state.team].stage];
      ctx.strokeStyle="#fff1b9aa";ctx.beginPath();ctx.arc(target.x,target.y,17,0,Math.PI*2);ctx.stroke();
    }
    for(const wall of course.walls) {
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
    ctx.font="16px sans-serif";ctx.fillStyle="#c1dace";ctx.fillText("Bahn "+(game.hole+1)+" / 3 · Par "+course.par,38,76);
    state.teamNames.forEach((name,index)=>{
      const x=index===0 ? 390 : 665;
      ctx.fillStyle=index===0 ? "#bcecff" : "#ffd1a6";ctx.font="bold 18px sans-serif";ctx.fillText(name,x,46,240);
      ctx.fillStyle="#d5e9de";ctx.font="16px sans-serif";
      ctx.fillText(game.balls[index].shots+" Schläge · gesamt "+(game.scores[index]+(game.done ? 0 : game.balls[index].shots)),x,73,240);
      if(state.team===index && !game.done){ctx.fillStyle="#f6dc91";ctx.beginPath();ctx.arc(x-12,40,4,0,Math.PI*2);ctx.fill();}
    });
    ctx.fillStyle="#c9e2d7";ctx.font="15px sans-serif";ctx.textAlign="center";
    const caption=game.busy ? "Schlagwertung "+game.correct+"/"+game.total+(stage.joker==="precision" ? " + Präzisionsschläger" : "")
      : game.done ? "Bahnwertung abgeschlossen" : game.preview.putting ? "Nächster Schlag: dosierter Putt zum Loch"
      : course.kind==="bank" ? "Nächster Schlag: über die Bande in die freie Position"
      : course.kind==="windmill" ? "Nächster Schlag: im passenden Moment durch die Windmühle"
      : "Nächster Schlag: sicher über die Brücke";
    ctx.fillText(caption,480,570,700);
  }
  return {start,close,sync,judge,turnLabel,bind,stop};
})();
