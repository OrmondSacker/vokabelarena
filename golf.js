"use strict";

const Golf = (() => {
  const courses = [
    {name:"Die Bande",par:2,kind:"bank",points:[[120,430],[760,430],[760,170]],checkpoints:[.68,1]},
    {name:"Die Windmühle",par:2,kind:"windmill",points:[[120,430],[480,430],[480,170],[800,170]],checkpoints:[.56,1]},
    {name:"Über das Wasser",par:3,kind:"water",points:[[120,450],[420,450],[420,180],[800,180]],checkpoints:[.42,.78,1]}
  ];
  let game=null, frameId=null;

  function close() {
    if (frameId!==null) cancelAnimationFrame(frameId);
    frameId=null;
    game=null;
  }
  function pointAt(course,progress) {
    const segments=course.points.slice(1).map((point,index)=>Math.hypot(point[0]-course.points[index][0],point[1]-course.points[index][1]));
    const total=segments.reduce((sum,length)=>sum+length,0);
    let distance=Math.max(0,Math.min(1,progress))*total;
    for (let index=0;index<segments.length;index++) {
      if (distance<=segments[index] || index===segments.length-1) {
        const start=course.points[index],end=course.points[index+1];
        const t=Math.min(1,distance/segments[index]);
        return {x:start[0]+(end[0]-start[0])*t,y:start[1]+(end[1]-start[1])*t};
      }
      distance-=segments[index];
    }
  }
  function outcome(course,ball,correct,total,joker,shotNumber) {
    const quality=Math.min(1,(correct+Number(joker==="precision"))/total);
    const target=course.checkpoints.find(progress=>progress>ball.progress+.001) ?? 1;
    const putting=target===1;
    const factor=putting ? "Schlagstärke" : course.kind==="windmill" ? "Timing" : "Richtung";
    const ideal=putting ? .3 : course.kind==="windmill" ? .5 : .7;
    const sign=shotNumber%2===0 ? 1 : -1;
    const needle=Math.max(.04,Math.min(.96,ideal+sign*(1-quality)*.36));
    const water=course.kind==="water" && target>.5 && target<1 && quality<.4;
    const penalty=water && joker!=="safety" ? 1 : 0;
    const holed=putting && quality>=.8;
    let progress=holed ? 1 : putting ? .94 : Math.max(ball.progress+.015,target-(1-quality)*.25);
    if (water) progress=joker==="safety" ? Math.max(ball.progress,.22) : ball.progress;
    if (course.kind==="windmill" && target<1 && quality<.4) progress=ball.progress+.025;
    progress=Math.min(.98,progress);
    if (holed) progress=1;
    const position=pointAt(course,progress);
    if (putting && !holed) {
      const hole=pointAt(course,1);
      const before=pointAt(course,.95);
      const distance=Math.hypot(hole.x-before.x,hole.y-before.y) || 1;
      const error=14+(1-quality)*45;
      position.x=hole.x+(hole.x-before.x)/distance*sign*error;
      position.y=hole.y+(hole.y-before.y)/distance*sign*error;
    } else if (!holed && !water) {
      position.x+=sign*(1-quality)*15;
      position.y+=(1-quality)*12;
    }
    let message=holed ? "Eingelocht!" : quality===1 ? "Perfekter Schlag! Ideale Position für den nächsten Abschnitt." : quality>=.8 ? "Sehr guter Schlag!" : "Der Schlag weicht vom Ideal ab.";
    if (putting && !holed) message=sign>0 ? "Zu kräftig: Der Ball rollt am Loch vorbei." : "Zu sanft: Der Ball bleibt vor dem Loch.";
    if (water) message=penalty ? "Im Wasser! Zurück zur vorherigen Position und ein Strafschlag." : "Sicherheitsball! Der Ball bleibt am Wasserrand.";
    if (course.kind==="windmill" && target<1 && quality<.4) message="Der Flügel wird getroffen. Der Ball prallt zurück.";
    if (penalty) {position.x=ball.x;position.y=ball.y;}
    const collision=water || course.kind==="windmill" && target<1 && quality<.4;
    const impactProgress=course.kind==="windmill" ? .52 : .48;
    return {quality,target,factor,ideal,needle,progress,position,holed,penalty,water,collision,impactProgress,message};
  }
  function start(total) {
    close();
    game={owner:state,total:total===7 ? 7 : 5,hole:0,asked:0,correct:0,answers:[],busy:false,done:false,
      selected:[null,null],jokers:[{precision:true,safety:true},{precision:true,safety:true}],
      scores:[0,0],history:[],balls:[]};
    beginHole();
  }
  function beginHole() {
    game.asked=0;
    game.correct=0;
    game.answers=[];
    game.busy=false;
    game.done=false;
    const course=courses[game.hole],tee=pointAt(course,0);
    game.balls=[0,1].map(()=>({progress:0,x:tee.x,y:tee.y,holed:false,shots:0}));
    state.team=game.hole%2;
    el("golfNextHole").hidden=true;
    el("editGameVocabulary").hidden=false;
    el("golfGaugeLabel").textContent="Beantworte die Serie. Der Zeiger stoppt automatisch.";
    el("golfIdealZone").style.left="50%";
    el("golfNeedle").style.left="50%";
    sync();
    question();
  }
  function turnLabel() {
    if (!game) return "";
    return state.teamNames[state.team]+" · Vokabel "+Math.min(game.total,game.asked+1)+"/"+game.total;
  }
  function sync() {
    if (!game || game.owner!==state) return;
    const course=courses[game.hole];
    el("score").textContent="Bahn "+(game.hole+1)+"/"+courses.length+" · "+course.name+" · Par "+course.par;
    const results=game.answers.map(correct=>correct ? "✓" : "×").join(" ");
    el("golfSeries").textContent=game.correct+"/"+game.total+" richtig · "+game.asked+"/"+game.total+" beantwortet · "+results+
      (game.selected[state.team] ? " · "+(game.selected[state.team]==="precision" ? "Präzisionsschläger aktiv" : "Sicherheitsball aktiv") : "");
    el("golfCanvas").setAttribute("aria-label",course.name+". "+state.teamNames.map((name,index)=>name+": "+game.balls[index].shots+" Schläge").join(". "));
    for (const [type,id] of [["precision","golfPrecision"],["safety","golfSafety"]]) {
      el(id).disabled=game.busy || game.done || game.asked>0 || !game.jokers[state.team][type];
      el(id).setAttribute("aria-pressed",String(game.selected[state.team]===type));
    }
    el("golfJokers").hidden=game.busy || game.done;
    if (!game.busy) draw();
  }
  function chooseJoker(type) {
    if (!game || game.busy || game.done || game.asked || !game.jokers[state.team][type]) return;
    game.selected[state.team]=game.selected[state.team]===type ? null : type;
    sync();
  }
  function judge(correct,solution) {
    if (!game || game.owner!==state || game.busy || game.done) return;
    game.asked++;
    game.correct+=Number(correct);
    game.answers.push(correct);
    el("judge").hidden=true;
    el("feedback").textContent=correct ? "Richtig!" : "Richtige Lösung: "+solution;
    sync();
    if (game.asked<game.total) {
      el("next").hidden=false;
      el("next").focus();
      return;
    }
    swing();
  }
  function swing() {
    const active=game,team=state.team,ball=active.balls[team],course=courses[active.hole],joker=active.selected[team];
    const result=outcome(course,ball,active.correct,active.total,joker,ball.shots);
    if (joker) active.jokers[team][joker]=false;
    active.selected[team]=null;
    active.busy=true;
    el("next").hidden=true;
    el("editGameVocabulary").hidden=true;
    el("answerKey").hidden=true;
    el("word").textContent=active.correct+"/"+active.total+" richtig";
    el("golfJokers").hidden=true;
    el("golfGaugeLabel").textContent=result.factor+" · Grün ist der Idealbereich";
    el("golfIdealZone").style.left=(result.ideal*100)+"%";
    let started=null;
    const animate=now=>{
      if (game!==active || state!==active.owner || el("game").hidden) return;
      started ??= now;
      const elapsed=now-started;
      if (elapsed<1900) {
        const t=elapsed/1900;
        const oscillation=.5+Math.sin(t*Math.PI*7)*.45;
        const settle=Math.max(0,(t-.72)/.28);
        const value=oscillation*(1-settle)+result.needle*settle;
        el("golfNeedle").style.left=(value*100)+"%";
        draw({wind:elapsed/350});
      } else {
        el("golfNeedle").style.left=(result.needle*100)+"%";
        const t=Math.min(1,(elapsed-2200)/1700);
        if (t>=0) {
          const eased=1-Math.pow(1-t,2);
          let p=ball.progress+(result.progress-ball.progress)*eased;
          if (result.collision) {
            p=eased<.6 ? ball.progress+(result.impactProgress-ball.progress)*(eased/.6)
              : result.impactProgress+(result.progress-result.impactProgress)*((eased-.6)/.4);
          }
          const route=pointAt(course,p),routeStart=pointAt(course,ball.progress),routeEnd=pointAt(course,result.progress);
          const x=route.x+(ball.x-routeStart.x)*(1-eased)+(result.position.x-routeEnd.x)*eased;
          const y=route.y+(ball.y-routeStart.y)*(1-eased)+(result.position.y-routeEnd.y)*eased;
          draw({team,x,y,drop:result.holed && t>.88 ? (t-.88)/.12 : 0,wind:elapsed/350});
          el("golfGaugeLabel").textContent=result.factor+" · "+(result.quality===1 ? "Ideal getroffen!" : result.needle<result.ideal ? "Unter dem Ideal" : "Über dem Ideal");
          if (t===1) {finishShot(team,result);return;}
        }
      }
      frameId=requestAnimationFrame(animate);
    };
    frameId=requestAnimationFrame(animate);
  }
  function finishShot(team,result) {
    const ball=game.balls[team];
    Object.assign(ball,result.position,{progress:result.progress,holed:result.holed});
    ball.shots+=1+result.penalty;
    ball.shots=Math.min(8,ball.shots);
    if (ball.shots>=8 && !ball.holed) {ball.holed=true;result.message+=" Nach acht Schlägen wird der Ball aufgenommen.";}
    game.busy=false;
    el("feedback").textContent=result.message;
    if (game.balls.every(item=>item.holed)) {
      game.balls.forEach((item,index)=>game.scores[index]+=item.shots);
      game.history.push(game.balls.map(item=>item.shots));
      game.done=true;
      el("golfJokers").hidden=true;
      el("editGameVocabulary").hidden=true;
      el("word").textContent="Bahn abgeschlossen";
      el("turn").textContent=state.teamNames.map((name,index)=>name+": "+game.balls[index].shots).join(" · ");
      if (game.hole===courses.length-1) {
        const tie=game.scores[0]===game.scores[1],winner=game.scores[0]<game.scores[1] ? 0 : 1;
        const message=tie ? "Unentschieden!" : state.teamNames[winner]+" gewinnt!";
        el("word").textContent=message;
        el("turn").textContent=state.teamNames.map((name,index)=>name+": "+game.scores[index]+" Schläge").join(" · ");
        showGameResult(true,message+" "+el("turn").textContent);
      } else {
        el("golfNextHole").hidden=false;
        el("golfNextHole").focus();
      }
    } else {
      state.team=game.balls[1-team].holed ? team : 1-team;
      game.asked=0;
      game.correct=0;
      game.answers=[];
      el("turn").textContent=state.teamNames[state.team]+" ist als Nächstes dran";
      el("next").hidden=false;
      el("editGameVocabulary").hidden=false;
      el("next").focus();
    }
    sync();
  }
  function draw(animation=null) {
    if (!game) return;
    const ctx=el("golfCanvas").getContext("2d"),course=courses[game.hole];
    ctx.clearRect(0,0,960,600);
    ctx.fillStyle="#153c35";ctx.fillRect(0,0,960,600);
    for (let y=0;y<600;y+=40) {
      ctx.fillStyle=y%80===0 ? "#1c493b" : "#214f3e";
      ctx.fillRect(0,y,960,40);
    }
    for (const [x,y] of [[50,90],[875,90],[890,470],[70,540],[650,540]]) {
      ctx.fillStyle="#102e29";ctx.beginPath();ctx.arc(x+5,y+8,27,0,Math.PI*2);ctx.fill();
      ctx.fillStyle="#398563";ctx.beginPath();ctx.arc(x,y,25,0,Math.PI*2);ctx.fill();
      ctx.fillStyle="#5caa73";ctx.beginPath();ctx.arc(x-6,y-7,13,0,Math.PI*2);ctx.fill();
    }
    if (course.kind==="water") {
      ctx.fillStyle="#237dab";ctx.fillRect(265,240,330,105);
      ctx.strokeStyle="#69d9e6";ctx.lineWidth=2;
      for (let y=260;y<340;y+=18) {ctx.beginPath();ctx.moveTo(280,y);ctx.lineTo(580,y);ctx.stroke();}
    }
    ctx.lineCap="round";ctx.lineJoin="round";
    const lane=color=>{
      ctx.strokeStyle=color;ctx.beginPath();
      course.points.forEach(([x,y],index)=>index ? ctx.lineTo(x,y) : ctx.moveTo(x,y));
      ctx.stroke();
    };
    ctx.lineWidth=150;lane("#092b2a");
    ctx.lineWidth=140;lane("#97603c");
    ctx.lineWidth=124;lane("#dcc38c");
    ctx.lineWidth=116;lane("#5dae6a");
    ctx.lineWidth=98;lane("#73bf79");
    ctx.setLineDash([9,14]);ctx.lineWidth=2;lane("#a1db8a55");ctx.setLineDash([]);
    if (course.kind==="water") {
      ctx.fillStyle="#a77548";ctx.fillRect(355,245,130,95);
      ctx.strokeStyle="#61452f";ctx.lineWidth=3;
      for(let y=250;y<340;y+=12){ctx.beginPath();ctx.moveTo(355,y);ctx.lineTo(485,y);ctx.stroke();}
      ctx.strokeStyle="#f0cc8b";ctx.lineWidth=6;ctx.beginPath();ctx.moveTo(360,245);ctx.lineTo(360,340);ctx.moveTo(480,245);ctx.lineTo(480,340);ctx.stroke();
    }
    if (course.kind==="windmill") {
      const x=480,y=300;
      ctx.fillStyle="#a94b46";ctx.fillRect(x-35,y-65,70,70);
      ctx.fillStyle="#e9bd83";ctx.beginPath();ctx.moveTo(x-47,y-65);ctx.lineTo(x,y-105);ctx.lineTo(x+47,y-65);ctx.closePath();ctx.fill();
      ctx.fillStyle="#233c3b";ctx.fillRect(x-15,y-25,30,30);
      ctx.save();ctx.translate(x,y-55);ctx.rotate(animation?.wind ?? .5);
      for(let i=0;i<4;i++){ctx.rotate(Math.PI/2);ctx.fillStyle="#f4e1b1";ctx.fillRect(0,-7,70,14);ctx.strokeStyle="#8d6245";ctx.lineWidth=2;ctx.strokeRect(0,-7,70,14);}
      ctx.restore();
    }
    const hole=pointAt(course,1);
    ctx.fillStyle="#112c27";ctx.beginPath();ctx.ellipse(hole.x,hole.y,13,9,0,0,Math.PI*2);ctx.fill();
    ctx.strokeStyle="#f2f0cf";ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(hole.x,hole.y);ctx.lineTo(hole.x,hole.y-90);ctx.stroke();
    ctx.fillStyle="#ef6963";ctx.beginPath();ctx.moveTo(hole.x,hole.y-90);ctx.lineTo(hole.x+50,hole.y-76);ctx.lineTo(hole.x,hole.y-61);ctx.closePath();ctx.fill();
    ctx.font="bold 24px sans-serif";ctx.textAlign="center";ctx.fillStyle="#fff5d1";ctx.fillText(String(game.hole+1),hole.x+18,hole.y-72);
    const colors=["#75d9ff","#ffb07b"];
    game.balls.forEach((ball,index)=>{
      if(ball.holed && animation?.team!==index) return;
      const moving=animation?.team===index;
      const x=moving ? animation.x : ball.x,y=moving ? animation.y : ball.y;
      const radius=moving ? 11*(1-(animation.drop ?? 0)) : 11;
      if(radius<=0) return;
      ctx.fillStyle="#12332d88";ctx.beginPath();ctx.ellipse(x+3,y+6,radius+3,radius*.6,0,0,Math.PI*2);ctx.fill();
      ctx.fillStyle=colors[index];ctx.strokeStyle="#14354a";ctx.lineWidth=3;ctx.beginPath();ctx.arc(x+(moving ? 0 : index*5-2),y,radius,0,Math.PI*2);ctx.fill();ctx.stroke();
      ctx.fillStyle="#fff9dc";ctx.beginPath();ctx.arc(x-3,y-4,radius*.3,0,Math.PI*2);ctx.fill();
    });
    ctx.fillStyle="#102b35e8";ctx.fillRect(18,14,924,62);
    ctx.textAlign="left";ctx.fillStyle="#fff1c8";ctx.font="bold 22px sans-serif";ctx.fillText(course.name,34,40);
    ctx.font="17px sans-serif";ctx.fillStyle="#c8e8d7";ctx.fillText("Bahn "+(game.hole+1)+" / 3 · Par "+course.par,34,63);
    ctx.textAlign="right";
    state.teamNames.forEach((name,index)=>{
      const x=index===0 ? 650 : 920;
      ctx.fillStyle=colors[index];ctx.font="bold 17px sans-serif";
      const short=name.length>22 ? name.slice(0,21)+"…" : name;
      ctx.fillText(short,x,38);
      ctx.font="16px sans-serif";ctx.fillText(game.balls[index].shots+" Schläge · gesamt "+game.scores[index],x,61);
    });
  }
  function stop() {
    if (frameId!==null) cancelAnimationFrame(frameId);
    frameId=null;
    if (!game) return;
    game.busy=false;
    game.done=true;
    el("golfJokers").hidden=true;
    el("golfNextHole").hidden=true;
  }
  function nextHole() {
    if (!game || !game.done || game.hole>=courses.length-1) return;
    game.hole++;
    beginHole();
  }
  function bind() {
    el("golfPrecision").onclick=()=>chooseJoker("precision");
    el("golfSafety").onclick=()=>chooseJoker("safety");
    el("golfNextHole").onclick=nextHole;
  }
  return {start,close,sync,judge,turnLabel,bind,stop};
})();
