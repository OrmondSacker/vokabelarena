"use strict";

const Fleet = (() => {
  const size = 10;
  const lengths = [5,4,3,3,2];
  const params = new URLSearchParams(location.hash.slice(1));
  const hostKey = params.get("fleetHost");
  let match, channel, timer, guestTimer;
  let sending = false;
  let lastGuestFrame = "";

  const make = (tag,text) => {
    const element = document.createElement(tag);
    if (text != null) element.textContent = text;
    return element;
  };
  const action = (label,handler) => {
    const button = make("button",label);
    button.type = "button";
    button.onclick = handler;
    return button;
  };
  const area = (row,col,width) => Array.from({length:width*width},(_,i) =>
    (row+Math.floor(i/width))*size+col+i%width);
  function footprint(cell,length,vertical) {
    const row = Math.floor(cell/size), col = cell%size;
    if (row+(vertical ? length : 1)>size || col+(vertical ? 1 : length)>size) return [];
    return Array.from({length},(_,i) => cell+i*(vertical ? size : 1));
  }

  function validFleet(ships) {
    if (!Array.isArray(ships) || ships.length !== lengths.length) return false;
    const occupied = new Set();
    return ships.every((ship,i) => {
      if (!Array.isArray(ship) || ship.length!==lengths[i] ||
          !ship.every(n=>Number.isInteger(n)&&n>=0&&n<size*size&&!occupied.has(n))) return false;
      const fits = [false,true].some(vertical => footprint(ship[0],ship.length,vertical).join()===ship.join());
      for (const cell of ship) occupied.add(cell);
      return fits;
    });
  }
  function randomFleet() {
    const ships = [];
    for (const length of lengths) {
      const free = [];
      for (let cell=0;cell<size*size;cell++) {
        for (const vertical of [false,true]) {
          const ship = footprint(cell,length,vertical);
          if (ship.length && ship.every(n=>!ships.some(other=>other.includes(n)))) free.push(ship);
        }
      }
      if (!free.length) return randomFleet();
      ships.push(free[Math.floor(Math.random()*free.length)]);
    }
    return ships;
  }

  function tighten(board) {
    const previous = board.hint;
    const remaining = board.ships.flat().filter(cell=>!board.shots.has(cell));
    if (!remaining.length || previous?.width===2) return;
    const target = previous?.target ?? remaining[Math.floor(Math.random()*remaining.length)];
    const width = previous ? previous.width-1 : 5;
    const choices = [];
    for (let row=0;row<=size-width;row++) {
      for (let col=0;col<=size-width;col++) {
        if (previous && (row<previous.row || col<previous.col ||
            row+width>previous.row+previous.width || col+width>previous.col+previous.width)) continue;
        if (area(row,col,width).includes(target)) choices.push({row,col,width,target});
      }
    }
    board.hint = choices[Math.floor(Math.random()*choices.length)];
  }

  function boardView(board,privileged) {
    const sunk = board.ships.filter(ship=>ship.every(cell=>board.shots.has(cell)));
    const visible = Object.fromEntries(board.shots);
    for (const ship of sunk) for (const cell of ship) visible[cell] = "sunk";
    if (privileged) {
      for (const cell of board.ships.flat()) if (!visible[cell]) visible[cell] = "ship";
    }
    const hint = board.hint ? area(board.hint.row,board.hint.col,board.hint.width) : [];
    return {visible,hint};
  }
  function boardsView(viewer=-1) {
    return match.boards.map((board,i)=>boardView(board,viewer===i));
  }

  function grid(title,view,onPick,wide=false) {
    const article = make("article"), cells = make("div");
    article.append(make("h3",title),cells);
    cells.className = "fleetGrid";
    const labels = {water:"Wasser",hit:"Treffer",sunk:"Versenkt",ship:"Schiff"};
    const symbols = {water:"·",hit:"×",sunk:"◆",ship:"■"};
    cells.append(make("span"));
    for (let col=0;col<size;col++) cells.append(make("span",col+1));
    for (let row=0;row<size;row++) {
      cells.append(make("span",String.fromCharCode(65+row)));
      for (let col=0;col<size;col++) {
        const n = row*size+col, kind = view.visible[n];
        const block = row<9 && col<9 ? area(row,col,2) : [];
        const pickable = onPick && (wide ? block.some(cell=>!view.visible[cell]) : !kind);
        const cell = pickable ? action(symbols[kind] || "",()=>onPick(n)) : make("span",symbols[kind] || "");
        cell.className = ["sea",kind,view.hint.includes(n) ? "hint" : ""].filter(Boolean).join(" ");
        const label = String.fromCharCode(65+row)+(col+1)+(kind ? " · "+labels[kind] : "");
        cell.title = label;
        cell.setAttribute("aria-label",label);
        cells.append(cell);
      }
    }
    return article;
  }
  function grids(parent,names,boards,active=-1,onPick=null,salvo=false) {
    const list = make("div");
    list.className = "fleetBoards";
    boards.forEach((board,i)=>list.append(grid(names[i],board,i===active ? onPick : null,salvo)));
    parent.append(list);
  }
  function placement(parent,draft,title,send,rerender) {
    const heading = make("p",title), length = lengths[draft.ships.length];
    parent.append(heading);
    if (!length) parent.append(action("Flotte bestätigen",()=>send(draft.ships)));
    else parent.append(make("p","Schiff mit "+length+" Feldern platzieren"),
      action(draft.vertical ? "Senkrecht · drehen" : "Waagerecht · drehen",()=>{draft.vertical=!draft.vertical;rerender()}));
    parent.append(action("Zufällig aufstellen",()=>{draft.ships=randomFleet();rerender()}),
      action("Leeren",()=>{draft.ships=[];rerender()}));
    const visible = Object.fromEntries(draft.ships.flat().map(n=>[n,"ship"]));
    const pick = length ? cell=>{
      const ship = footprint(cell,length,draft.vertical);
      if (!ship.length || ship.some(n=>visible[n])) {
        heading.textContent = "Das Schiff passt dort nicht hin.";
        return;
      }
      draft.ships.push(ship);
      rerender();
    } : null;
    grids(parent,[title],[{visible,hint:[]}],0,pick);
  }

  function snapshot(viewer=-1) {
    const placing = match.phase==="placement";
    return {names:match.names, phase:match.phase, team:state.team, ready:match.boards.map(board=>Boolean(board.ships.length)),
      notice:placing ? "Die Teams stellen ihre Flotten auf." : el("feedback").textContent,
      word:placing ? "" : el("word").textContent, turn:placing ? "" : el("turn").textContent,
      salvo:match.salvos[state.team], revision:match.revision,
      boards:placing ? [] : boardsView(viewer)};
  }
  function render() {
    const scene = el("fleetScene"), controls = el("fleetActions");
    scene.replaceChildren();
    controls.replaceChildren();
    if (match.network === "local") {
      controls.append(action("Beameransicht öffnen",openProjection));
    } else if (match.links) {
      const links = make("div");
      for (const [label,url] of Object.entries(match.links)) {
        const link = make("a",label);
        link.href = url;
        link.target = "_blank";
        link.rel = "noopener";
        links.append(link);
      }
      controls.append(links);
    }
    if (match.networkError) controls.append(make("p",match.networkError));
    if (match.phase==="placement") {
      if (match.network==="lan") {
        scene.append(make("p",match.names.map((name,i)=>name+": "+(match.boards[i].ships.length ? "bereit" : "wartet")).join(" · ")));
      } else if (match.placing) {
        placement(scene,match.draft,"Aufstellung für "+match.names[match.placeTeam],
          ships=>submitPlacement(match.placeTeam,ships),render);
      } else {
        scene.append(make("p","Beameransicht verwenden oder Projektion ausblenden, bevor ein Team seine Flotte aufstellt."),
          action("Aufstellung für "+match.names[match.placeTeam]+" öffnen",()=>{match.placing=true;render()}));
      }
      return;
    }
    const shooting = match.phase==="shot" && match.network==="local" && match.review<0;
    grids(scene,match.names,boardsView(match.review),shooting ? 1-state.team : -1,
      cell=>shoot(state.team,cell,match.wide),match.wide);
    if (shooting && match.salvos[state.team]) {
      controls.append(action(match.wide ? "Einzelschuss wählen" : "2 × 2-Salve wählen",()=>{
        match.wide=!match.wide;
        render();
      }));
    }
    if (match.phase==="shot" && match.network==="lan") {
      controls.append(make("p",match.names[state.team]+" wählt das Ziel am eigenen Gerät."));
    }
    if (match.network==="local") {
      match.names.forEach((name,i)=>controls.append(action(
        match.review===i ? "Flotte wieder verbergen" : "Lehrkraft: Flotte von "+name+" ansehen",()=>{
          match.review=match.review===i ? -1 : i;
          render();
        })));
    }
  }

  function openProjection() {
    window.open(location.pathname+"#fleetView="+encodeURIComponent(match.channelName),"_blank","noopener");
  }
  function sync() {
    if (!match) return;
    match.review = -1;
    if (match.phase==="between" || match.phase==="question") match.phase = state.pending ? "question" : "between";
    render();
    channel?.postMessage({frame:snapshot()});
    if (match.room) match.dirty=true;
  }
  function submitPlacement(team,ships) {
    if (!match || match.phase!=="placement" || match.boards[team].ships.length || !validFleet(ships)) return;
    match.boards[team].ships=ships.map(ship=>[...ship]);
    match.placing=false;
    match.placeTeam=1;
    match.draft={ships:[],vertical:false};
    if (match.boards.every(board=>board.ships.length)) {
      match.phase="between";
      el("editGameVocabulary").hidden=false;
      question();
    } else sync();
  }

  function judge(correct,solution) {
    el("judge").hidden=true;
    if (correct) {
      match.phase="shot";
      match.revision++;
      match.streaks[state.team]++;
      if (match.streaks[state.team]===3) {
        match.salvos[state.team]=true;
        match.streaks[state.team]=0;
      }
      el("feedback").textContent=match.salvos[state.team] ?
        "Richtig. Einzelschuss oder 2 × 2-Salve wählen." : "Richtig. Ein Zielfeld wählen.";
    } else {
      match.streaks[state.team]=0;
      tighten(match.boards[state.team]);
      el("feedback").textContent="Lösung: "+solution+" · Das andere Team erhält einen Suchhinweis.";
      advance();
    }
    sync();
  }

  function advance() {
    match.phase="between";
    state.team=1-state.team;
    match.wide=false;
    el("next").hidden=false;
    el("next").focus();
  }

  function shoot(team,cell,wide) {
    if (match.phase!=="shot" || state.team!==team || !Number.isInteger(cell) || cell<0 || cell>=100) return;
    const row=Math.floor(cell/size), col=cell%size;
    if (wide && (!match.salvos[team] || row>=9 || col>=9)) return;
    const board=match.boards[1-team], occupied=new Set(board.ships.flat());
    const targets=(wide ? area(row,col,2) : [cell]).filter(n=>!board.shots.has(n));
    if (!targets.length) return;
    if (wide) match.salvos[team]=false;
    for (const n of targets) board.shots.set(n,occupied.has(n) ? "hit" : "water");
    if (board.hint && board.shots.has(board.hint.target)) board.hint=null;
    const hits=targets.filter(n=>occupied.has(n)).length;
    el("feedback").textContent=hits ? hits+" Treffer"+" · "+(targets.length-hits)+" Wasser" : "Wasser";
    el("answerKey").hidden=true;
    if ([...occupied].every(n=>board.shots.has(n))) {
      el("word").textContent=match.names[team]+" gewinnt!";
      el("turn").textContent="Spiel beendet";
      el("editGameVocabulary").hidden=true;
      match.phase="finished";
    } else advance();
    sync();
  }

  async function api(path,key,body) {
    const headers={Authorization:"Bearer "+key};
    if (body!==undefined) headers["Content-Type"]="application/json";
    const response=await fetch("/fleet-api/"+path,{headers,cache:"no-store",
      method:body===undefined ? "GET" : "POST",body:body===undefined ? undefined : JSON.stringify(body)});
    if (!response.ok) throw Error("Spielraum nicht erreichbar ("+response.status+").");
    return response.json();
  }

  async function hostTick(active) {
    if (sending || active!==match || el("game").hidden) return;
    sending=true;
    try {
      if (active.dirty) {
        active.dirty=false;
        await api("publish",active.room.host,{frames:[snapshot(),snapshot(0),snapshot(1)]});
      }
      const {commands}=await api("commands",active.room.host);
      if (active!==match) return;
      if (active.networkError) { active.networkError=""; render(); }
      for (const {team,kind,ships,cell,wide,revision} of commands) {
        if (kind==="placement") submitPlacement(team,ships);
        if (kind==="shot" && revision===active.revision) shoot(team,cell,wide);
      }
    } catch (error) {
      if (active===match) {
        active.dirty=true;
        if (active.networkError!==error.message) { active.networkError=error.message; render(); }
      }
    } finally { sending=false; }
  }

  async function start(names,network) {
    const active = match = {names,network,phase:"placement",placeTeam:0,placing:false,review:-1,revision:0,
      wide:false,salvos:[false,false],streaks:[0,0],draft:{ships:[],vertical:false},
      boards:names.map(()=>({ships:[],shots:new Map(),hint:null}))};
    for (const id of ["judge","typedAnswer","next","answerKey","editGameVocabulary"]) el(id).hidden=true;
    el("score").textContent="Schiffe versenken";
    el("word").textContent="";
    el("turn").textContent="";
    el("feedback").textContent="";
    state.pending=false;
    if (network==="local") {
      active.channelName="fleet-"+Date.now()+"-"+Math.random().toString(36).slice(2);
      channel=new BroadcastChannel(active.channelName);
      channel.onmessage=()=>{ if (active===match) channel.postMessage({frame:snapshot()}); };
    } else {
      try {
        const room=await api("open",hostKey,{});
        if (active!==match) return;
        active.room=room;
        active.links=room.links;
        timer=setInterval(()=>hostTick(active),650);
      } catch (error) {
        if (active!==match) return;
        active.networkError=error.message;
      }
    }
    if (active===match) sync();
  }

  function close() {
    if (!match) return;
    channel?.postMessage({closed:true});
    channel?.close();
    channel=null;
    if (timer) clearInterval(timer);
    if (match.room) api("close",match.room.host,{}).catch(()=>{});
    match=null;
  }
  function canStart(network) {
    if (network==="local" && typeof BroadcastChannel==="function" || network==="lan" && hostKey) return true;
    el("error").hidden=false;
    el("error").textContent=network==="lan" ?
      "Öffne den lokalen Vokabelarena-Server über den Moderationslink." : "Dieser Browser unterstützt die Beamerverbindung nicht.";
    return false;
  }

  function openGuest() {
    el("fleetLanHelp").hidden=Boolean(hostKey);
    if (hostKey) el("fleetMode").value="lan";
    const screen=params.get("fleetView"), key=params.get("fleetJoin"), role=params.get("role");
    if (!screen && !key) return;
    const container=el("fleetGuest");
    el("setup").hidden=true;
    el("game").hidden=true;
    container.hidden=false;
    container.textContent="Warte auf die Moderation …";
    const team=role==="0" || role==="1" ? Number(role) : -1;
    if (team>=0) container.dataset.team = String(team);
    const draft={ships:[],vertical:false};
    let current=null, wide=false, waiting=false, sent=false, notice="";
    function show() {
      if (!current) return;
      const frame=current;
      container.replaceChildren(make("h2",team>=0 ? frame.names[team] : "Schiffe versenken · Beamer"));
      if (frame.phase==="placement") {
        if (team>=0 && !frame.ready[team] && !sent) placement(container,draft,"Eigene Flotte",
          ships=>send({kind:"placement",ships}),show);
        else container.append(make("p","Die Teams stellen ihre Flotten auf."));
      } else {
        const canShoot=team>=0 && frame.phase==="shot" && frame.team===team && !waiting;
        container.append(make("p",frame.turn),make("h3",frame.word),make("p",frame.notice));
        if (canShoot && frame.salvo) container.append(action(wide ? "Einzelschuss wählen" : "2 × 2-Salve wählen",()=>{wide=!wide;show()}));
        if (canShoot) container.append(make("p",wide ? "Wähle das obere linke Feld der Salve." : "Wähle ein Zielfeld."));
        grids(container,frame.names.map((name,i)=>i===team ? "Eigene Flotte" : name),frame.boards,
          canShoot ? 1-team : -1,cell=>send({kind:"shot",cell,wide,revision:frame.revision}),wide);
      }
      if (notice) container.append(make("p",notice));
    }
    async function send(command) {
      if (waiting) return;
      waiting=true;
      notice="";
      show();
      try {
        await api("command",key,command);
        if (command.kind==="placement") sent=true;
        else wide=false;
      } catch (error) { notice=error.message; }
      finally { waiting=false; show(); }
    }
    function display(frame) {
      const next=JSON.stringify(frame);
      if (next===lastGuestFrame) return;
      if (frame.revision!==current?.revision) wide=false;
      lastGuestFrame=next;
      current=frame;
      show();
    }
    if (screen) {
      const projection=new BroadcastChannel(screen);
      projection.onmessage=({data})=>{
        if (data.closed) { current=null;container.textContent="Partie beendet."; }
        else if (data.frame) display(data.frame);
      };
      projection.postMessage({ready:true});
    } else {
      const poll=async()=>{
        try {
          const {frame}=await api("read",key);
          if (frame) display(frame);
        } catch (error) {
          container.textContent=error.message;
          lastGuestFrame="";
        }
        guestTimer=setTimeout(poll,700);
      };
      window.addEventListener("pagehide",()=>clearTimeout(guestTimer),{once:true});
      poll();
    }
  }
  function stop() {
    match.phase="finished";
    sync();
  }
  return {canStart,start,close,judge,sync,stop,openGuest};
})();
