"use strict";

const Fleet = (() => {
  const size = 10;
  const models = [
    {name:"Flugzeugträger",length:5},
    {name:"Schlachtschiff",length:4},
    {name:"Kreuzer",length:3},
    {name:"U-Boot",length:3},
    {name:"Patrouillenboot",length:2}
  ];
  const lengths = models.map(model=>model.length);
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

  function neighbors(cell) {
    const row=Math.floor(cell/size), col=cell%size, result=[];
    for (let y=Math.max(0,row-1);y<=Math.min(size-1,row+1);y++) {
      for (let x=Math.max(0,col-1);x<=Math.min(size-1,col+1);x++) result.push(y*size+x);
    }
    return result;
  }
  function blockedBy(ships) {
    return new Set(ships.flat().flatMap(neighbors));
  }

  function validFleet(ships) {
    if (!Array.isArray(ships) || ships.length !== lengths.length) return false;
    const blocked = new Set();
    return ships.every((ship,i) => {
      if (!Array.isArray(ship) || ship.length!==lengths[i] ||
          !ship.every(n=>Number.isInteger(n)&&n>=0&&n<size*size&&!blocked.has(n))) return false;
      const fits = [false,true].some(vertical => footprint(ship[0],ship.length,vertical).join()===ship.join());
      for (const cell of ship.flatMap(neighbors)) blocked.add(cell);
      return fits;
    });
  }
  function randomFleet(prefix=[]) {
    const ships = prefix.map(ship=>[...ship]);
    function addRemaining() {
      if (ships.length===lengths.length) return true;
      const length = lengths[ships.length];
      const used = blockedBy(ships);
      const free = [];
      for (let cell=0;cell<size*size;cell++) {
        for (const vertical of [false,true]) {
          const ship = footprint(cell,length,vertical);
          if (ship.length && ship.every(n=>!used.has(n))) free.push(ship);
        }
      }
      while (free.length) {
        const pick = Math.floor(Math.random()*free.length);
        ships.push(free.splice(pick,1)[0]);
        if (addRemaining()) return true;
        ships.pop();
      }
      return false;
    }
    return addRemaining() ? ships : null;
  }

  const hintCells = hint=>area(hint.row,hint.col,hint.width);
  const intactCells = board=>board.ships.flat().filter(cell=>!board.shots.has(cell));

  function discardEmptyHints(board) {
    const intact = new Set(intactCells(board));
    board.hints=board.hints.filter(hint=>hintCells(hint).some(cell=>intact.has(cell)));
  }

  function tighten(board) {
    discardEmptyHints(board);
    const remaining = intactCells(board);
    const index = board.hints.findIndex(hint=>hint.width>2);
    const previous = board.hints[index];
    const candidates = previous
      ? remaining.filter(cell=>hintCells(previous).includes(cell))
      : remaining.filter(cell=>!board.hints.some(hint=>hintCells(hint).includes(cell)));
    if (!candidates.length) return;
    const target = candidates.includes(previous?.target)
      ? previous.target : candidates[Math.floor(Math.random()*candidates.length)];
    const width = previous ? previous.width-1 : 5;
    const choices = [];
    for (let row=0;row<=size-width;row++) {
      for (let col=0;col<=size-width;col++) {
        if (previous && (row<previous.row || col<previous.col ||
            row+width>previous.row+previous.width || col+width>previous.col+previous.width)) continue;
        if (area(row,col,width).includes(target)) choices.push({row,col,width,target});
      }
    }
    const next = choices[Math.floor(Math.random()*choices.length)];
    if (previous) board.hints[index]=next;
    else board.hints.push(next);
  }

  function boardView(board,privileged) {
    const sunk = board.ships.filter(ship=>ship.every(cell=>board.shots.has(cell)));
    const visible = Object.fromEntries(board.shots);
    for (const ship of sunk) for (const cell of ship) visible[cell] = "sunk";
    if (privileged) {
      for (const cell of board.ships.flat()) if (!visible[cell]) visible[cell] = "ship";
    }
    const hint = [...new Set(board.hints.flatMap(hintCells))];
    const hintFrames = board.hints.map(({row,col,width})=>({row,col,width}));
    const ships = board.ships.flatMap((cells,type)=>{
      const destroyed = sunk.includes(cells);
      return privileged || destroyed ? [{cells,type,destroyed}] : [];
    });
    return {visible,hint,hintFrames,ships};
  }
  function boardsView(viewer=-1) {
    return match.boards.map((board,i)=>boardView(board,viewer===i));
  }

  function shipSprite(type,vertical,destroyed=false) {
    const sprite = make("span");
    sprite.className = "shipSprite shipModel"+type+(vertical ? " vertical" : "")+(destroyed ? " destroyed" : "");
    sprite.style.setProperty("--segments",models[type].length);
    sprite.append(make("i"),make("b"));
    sprite.setAttribute("aria-hidden","true");
    return sprite;
  }

  function grid(title,view,onPick,wide=false,tag="",lastShot=null,confirmShot=false) {
    const article = make("article"), cells = make("div");
    article.append(make("h3",title));
    if (tag) {
      const badge=make("p",tag);
      badge.className="fleetBoardRole";
      article.dataset.boardRole=tag==="Am Zug" ? "turn" : "target";
      article.append(badge);
    }
    article.append(cells);
    cells.className = "fleetGrid";
    const labels = {water:"Wasser",hit:"Treffer",sunk:"Versenkt",ship:"Schiff",clear:"Freies Wasser um versenktes Schiff"};
    const symbols = {water:"·",hit:"×",sunk:"◆",clear:"○"};
    const gridCells=[];
    let selected=null;
    const fire = confirmShot && onPick ? action("Schießen",()=>{
      if (selected!==null) onPick(selected);
    }) : null;
    if (fire) fire.disabled=true;
    const salvoFrame=wide && onPick ? make("span") : null;
    if (salvoFrame) {salvoFrame.className="fleetSalvoFrame";salvoFrame.hidden=true;salvoFrame.setAttribute("aria-hidden","true");}
    const paint=(block,locked=false)=>{
    gridCells.forEach((tile,index)=>{
      if (block.includes(index)) tile.dataset.aimArea=locked ? "locked" : "preview";
      else delete tile.dataset.aimArea;
      if (block[0]===index) tile.dataset.crosshair="";
      else delete tile.dataset.crosshair;
      if (wide && block.includes(index)) tile.dataset.salvoAim=locked ? "locked" : "preview";
      else delete tile.dataset.salvoAim;
    });
    if (salvoFrame) {
      salvoFrame.hidden=!block.length;
      if (block.length) {
        salvoFrame.style.gridRow=(Math.floor(block[0]/size)+2)+" / span 2";
        salvoFrame.style.gridColumn=(block[0]%size+2)+" / span 2";
      }
    }
    };
    cells.append(make("span"));
    for (let col=0;col<size;col++) cells.append(make("span",col+1));
    for (let row=0;row<size;row++) {
      cells.append(make("span",String.fromCharCode(65+row)));
      for (let col=0;col<size;col++) {
        const n = row*size+col, kind = view.visible[n];
        const block = wide ? (row<9 && col<9 ? area(row,col,2) : []) : [n];
        const pickable = onPick && (wide ? block.some(cell=>!view.visible[cell]) : !kind);
        const cell = pickable ? action("",()=>{
          if (selected===n) onPick(n);
          else {
            selected=n;
            paint(block,true);
            if (fire) fire.disabled=false;
            aim.textContent=(wide ? "Salve: " : "Ziel: ")+coords(block)+". Schießen drücken oder dasselbe Feld erneut wählen.";
          }
        }) : make("span");
        gridCells.push(cell);
        if (pickable) {
          const showSelection=()=>selected===null ? [] : area(Math.floor(selected/size),selected%size,wide ? 2 : 1);
          const preview=()=>{
            paint(block,selected===n);
            if (selected===null) aim.textContent=(wide ? "Salve: " : "Ziel: ")+coords(block);
          };
          const restore=()=>{
            paint(showSelection(),true);
            if (selected===null) aim.textContent=aimPrompt;
          };
          cell.onpointerenter=cell.onfocus=preview;
          cell.onpointerleave=cell.onblur=restore;
        }
        cell.dataset.fleetCell = String(n);
        if (lastShot?.cells.includes(n)) {
          cell.dataset.lastShot=lastShot.flash ? "flash" : "marked";
          if (lastShot.cells.length===4) cell.dataset.lastSalvo="";
          if (n===lastShot.cells[0]) cell.dataset.lastCrosshair="";
        }
        if (symbols[kind]) {
          const marker = make("i",symbols[kind]);
          marker.className = "fleetCellMarker";
          marker.setAttribute("aria-hidden","true");
          cell.append(marker);
        }
        cell.className = ["sea",kind,view.hint.includes(n) ? "hint" : ""].filter(Boolean).join(" ");
        const label = String.fromCharCode(65+row)+(col+1)+(kind ? " · "+labels[kind] : "");
        cell.title = label;
        cell.setAttribute("aria-label",label);
        cells.append(cell);
      }
    }
    if (salvoFrame) cells.append(salvoFrame);
    (view.hintFrames ?? []).forEach(({row,col,width},index)=>{
      const frame=make("span");
      frame.className="fleetHintFrame";
      frame.style.gridRow=(row+2)+" / span "+width;
      frame.style.gridColumn=(col+2)+" / span "+width;
      frame.style.setProperty("--hint-color",["#ffe199","#95f6df","#ffc2ef","#c7d5ff"][index%4]);
      frame.setAttribute("aria-hidden","true");
      cells.append(frame);
    });
    for (const {cells:ship,type,destroyed} of view.ships ?? []) {
      const first=ship[0], vertical=ship[1]-first===size;
      const sprite=shipSprite(type,vertical,destroyed);
      const overlay=make("span");
      overlay.className="shipOverlay";
      overlay.style.gridRow=(Math.floor(first/size)+2)+" / span "+(vertical ? ship.length : 1);
      overlay.style.gridColumn=(first%size+2)+" / span "+(vertical ? 1 : ship.length);
      overlay.append(sprite);
      cells.append(overlay);
    }
    const aimPrompt=wide ? "Oberes linkes Feld der Salve wählen." : "Zielfeld wählen.";
    const aim=make("p",aimPrompt);
    if (onPick) {
      aim.className="fleetAim";
      aim.setAttribute("role","status");
      article.append(aim);
      if (fire) article.append(fire);
    }
    if (lastShot) {
      const outcome=make("p",coords(lastShot.cells)+" · "+lastShot.result);
      outcome.className="fleetShotResult";
      article.append(outcome);
    }
    return article;
  }
  function coords(block) {
    return block.map(n=>String.fromCharCode(65+Math.floor(n/size))+(n%size+1)).join(", ");
  }
  function grids(parent,names,boards,active=-1,onPick=null,salvo=false,viewState={}) {
    const list = make("div");
    list.className = "fleetBoards";
    const current= ["question","shot"].includes(viewState.phase) ? viewState.team : -1;
    boards.forEach((board,i)=>{
      const aiming=i===active;
      const tag=current<0 ? "" : i===current ? "Am Zug" : "Zielraster";
      const shot=viewState.lastShot?.board===i ? {...viewState.lastShot,flash:viewState.phase==="between" || viewState.phase==="finished"} : null;
      list.append(grid(names[i],board,aiming ? onPick : null,aiming && salvo,tag,shot,viewState.phase==="shot"));
      if (i===0 && boards.length===2 && current>=0) {
        list.classList.add("fleetBoardsWithTurn");
        renderTurn(list,viewState.names ?? names,viewState.phase,current,viewState.viewer ?? -1);
      }
    });
    parent.append(list);
    if (boards.length === 2) {
      const legend = make("p");
      legend.className = "fleetLegend";
      for (const [kind, mark, text] of [
        ["Water","·","Wasser"],["Hit","×","Treffer"],["Sunk","◆","Versenkt"],["Clear","○","Freies Wasser"],["Hint","▧","Suchhinweis"]
      ]) {
        const entry = make("span",text);
        entry.className = "legend" + kind;
        entry.dataset.mark = mark;
        legend.append(entry);
      }
      parent.append(legend);
    }
  }
  function placement(parent,draft,title,send,rerender) {
    const heading = make("p",title), type=draft.ships.length, model=models[type];
    const options=make("div"), tray=make("div");
    options.className="fleetPlacementOptions";
    tray.className="fleetShipTray";
    parent.append(heading,options,tray);
    if (!model) options.append(action("Flotte bestätigen",()=>send(draft.ships)));
    else options.append(action(draft.vertical ? "Senkrecht · drehen" : "Waagerecht · drehen",()=>{draft.vertical=!draft.vertical;rerender()}));
    const fill=action("Rest zufällig setzen",()=>{
      const complete=randomFleet(draft.ships);
      if (!complete) {
        heading.textContent="Für die restlichen Schiffe ist kein Platz. Entferne zuerst ein Schiff.";
        return;
      }
      draft.ships=complete;
      rerender();
    });
    fill.disabled=!model;
    options.append(fill);
    const undo=action("Letztes Schiff entfernen",()=>{draft.ships.pop();rerender()});
    undo.disabled=!draft.ships.length;
    options.append(undo,action("Leeren",()=>{draft.ships=[];rerender()}));
    const visible = Object.fromEntries(draft.ships.flat().map(n=>[n,"ship"]));
    const ships = draft.ships.map((cells,type)=>({cells,type,destroyed:false}));
    const shipAt = cell=>Number.isInteger(cell) && model ? footprint(cell,model.length,draft.vertical) : [];
    const blocked = blockedBy(draft.ships);
    const fits = ship=>ship.length && ship.every(n=>!blocked.has(n));
    const pick = model ? cell=>{
      const ship = shipAt(cell);
      if (!fits(ship)) {
        heading.textContent = "Das Schiff passt dort nicht hin. Halte auch diagonal ein Feld Abstand."
        return;
      }
      draft.ships.push(ship);
      rerender();
    } : null;
    grids(parent,[title],[{visible,hint:[],ships}],0,pick);
    if (!model) {
      tray.append(make("p","Alle fünf Schiffe liegen bereit."));
      return;
    }
    tray.append(make("p",model.name+" · "+model.length+" Felder"),
      make("small","Schiff ziehen oder das Startfeld anklicken."));
    const source = make("div");
    source.className="fleetDragShip"+(draft.vertical ? " vertical" : "");
    source.style.setProperty("--segments",model.length);
    source.append(shipSprite(type,draft.vertical));
    tray.append(source);
    source.onpointerdown = event=>{
      if (event.button!==0 || !event.isPrimary) return;
      event.preventDefault();
      const pointer=event.pointerId;
      const ghost=source.cloneNode(true);
      ghost.classList.add("fleetDragGhost");
      ghost.setAttribute("aria-hidden","true");
      tray.append(ghost);
      const cells=[...parent.querySelectorAll("[data-fleet-cell]")];
      let marked=[];
      const lookAt = e=>{
        ghost.style.left=e.clientX+"px";
        ghost.style.top=e.clientY+"px";
        const cell=document.elementFromPoint(e.clientX,e.clientY)?.closest("[data-fleet-cell]");
        return cell && parent.contains(cell) ? Number(cell.dataset.fleetCell) : null;
      };
      const clear=()=>{for (const cell of marked) cell.removeAttribute("data-placement");marked=[]};
      const move=e=>{
        if (e.pointerId!==pointer) return;
        clear();
        const cell=lookAt(e), ship=shipAt(cell);
        const color=fits(ship) ? "fit" : "blocked";
        marked=(ship.length ? ship : cell===null ? [] : [cell]).map(n=>cells[n]);
        for (const tile of marked) tile.dataset.placement=color;
      };
      const clean=()=>{
        clear();
        ghost.remove();
        source.onpointermove=source.onpointerup=source.onpointercancel=source.onlostpointercapture=null;
      };
      source.onpointermove=move;
      source.onpointercancel=source.onlostpointercapture=clean;
      source.onpointerup=e=>{
        if (e.pointerId!==pointer) return;
        const cell=lookAt(e);
        clean();
        if (cell!==null) pick(cell);
      };
      source.setPointerCapture(pointer);
      move(event);
    };
  }

  function snapshot(viewer=-1) {
    const placing = match.phase==="placement";
    const reviewed=!placing && match.phase!=="finished" && !state.pending ? match.answerReview : null;
    const secondaryWord=placing ? "" : !el("answerKey").hidden
      ? el("answerKey").textContent : reviewed?.word ?? "";
    return {names:match.names, phase:match.phase, team:state.team, ready:match.boards.map(board=>Boolean(board.ships.length)),
      notice:placing ? "Die Teams stellen ihre Flotten auf." : el("feedback").textContent,
      word:placing ? "" : reviewed?.solution ?? el("word").textContent, secondaryWord, turn:placing ? "" : el("turn").textContent,
      salvo:match.salvos[state.team], streak:match.streaks[state.team], revision:match.revision, lastShot:match.lastShot ?? null, outcome:match.outcome ?? null,
      boards:placing ? [] : boardsView(viewer)};
  }
  function render() {
    const scene = el("fleetScene"), controls = el("fleetActions");
    scene.replaceChildren();
    controls.replaceChildren();
    if (match.network === "local") {
      controls.append(action("Beameransicht öffnen",openProjection));
    } else if (match.links) {
      const links=make("div");
      links.className="fleetLinks";
      for (const [label,url] of Object.entries(match.links)) {
        const link = make("a",label+" öffnen");
        link.href = url;
        link.target = "_blank";
        link.rel = "noopener";
        const role=new URL(url).hash.match(/(?:[#&])role=([01])$/u);
        if (!role) {
          links.append(link);
          continue;
        }
        const team=Number(role[1]), details=make("details");
        const labelText=label.replace(/Team [12]$/u,match.names[team]);
        details.className="fleetJoinCode";
        details.open=match.openCodes.has(url);
        details.append(make("summary","QR-Code · "+labelText),link);
        const showCode=()=>{
          if (!details.open || details.querySelector("canvas")) return;
          try { details.append(teamCode(url,labelText)); }
          catch { details.append(make("p","QR-Code nicht verfügbar. Verwende den Teamlink.")); }
        };
        details.ontoggle=()=>{
          if (!details.isConnected) return;
          if (details.open) match?.openCodes.add(url);
          else match?.openCodes.delete(url);
          showCode();
        };
        showCode();
        links.append(details);
      }
      const connections=make("details");
      connections.className="fleetConnectionLinks";
      connections.open=Boolean(match.linksOpen);
      connections.append(make("summary","Teamlinks und QR-Codes"),links);
      connections.ontoggle=()=>{
        if (connections.isConnected) match.linksOpen=connections.open;
      };
      controls.append(connections);
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
    const shooting = match.phase==="shot" && match.review<0 && !isComputerTurn();
    const active=match, team=state.team, revision=match.revision;
    const fireShot=cell=>{
      if (match===active && match.revision===revision) shoot(team,cell,match.wide);
    };
    grids(scene,match.names,boardsView(match.review),shooting ? 1-state.team : -1,
      fireShot,match.wide,{phase:match.phase,team:state.team,lastShot:match.lastShot});
    controls.append(salvoStatus(match.streaks[state.team],match.salvos[state.team]));
    if (shooting && match.salvos[state.team]) {
      const salvoButton=action(match.wide ? "Einzelschuss wählen" : "2 × 2-Salve wählen",()=>{
        match.wide=!match.wide;
        render();
      });
      salvoButton.className="fleetSalvoToggle";
      salvoButton.setAttribute("aria-pressed",String(match.wide));
      controls.append(salvoButton);
    }
    if (match.phase==="shot" && match.network==="lan") {
      controls.append(make("p","Ziel am Lehrer-PC oder am Teamgerät wählen und schießen."));
    }
    if (match.network==="local") {
      match.names.forEach((name,i)=>controls.append(action(
        match.review===i ? "Flotte wieder verbergen" : "Lehrkraft: Flotte von "+name+" ansehen",()=>{
          match.review=match.review===i ? -1 : i;
          render();
        })));
    }
  }

  function teamCode(url,name) {
    const qr=qrcode(0,"M");
    qr.addData(url);
    qr.make();
    const cells=qr.getModuleCount(), moduleSize=5, margin=4;
    const canvas=make("canvas");
    canvas.width=canvas.height=(cells+margin*2)*moduleSize;
    canvas.setAttribute("role","img");
    canvas.setAttribute("aria-label","Beitritts-QR-Code für "+name);
    const ctx=canvas.getContext("2d");
    ctx.fillStyle="#fff";
    ctx.fillRect(0,0,canvas.width,canvas.height);
    ctx.fillStyle="#000";
    for (let y=0;y<cells;y++) {
      for (let x=0;x<cells;x++) {
        if (qr.isDark(y,x)) ctx.fillRect((x+margin)*moduleSize,(y+margin)*moduleSize,moduleSize,moduleSize);
      }
    }
    return canvas;
  }

  function renderTurn(parent,names,phase,team,viewer=-1) {
    if (!["question","shot"].includes(phase)) return;
    const label = viewer < 0 ? names[team]+" ist dran" : viewer===team ? "Du bist dran" : "Das andere Team ist dran";
    const turn=make("p",label);
    turn.className="fleetTurnBanner";
    turn.dataset.team=String(team);
    parent.append(turn);
  }

  function salvoStatus(streak,ready) {
    const info=make("p",ready ? "2×2-Salve bereit · bei richtiger Antwort einsetzbar." :
      "2×2-Salve: "+streak+"/3 eigene richtige Antworten in Folge.");
    info.className="fleetSalvoStatus";
    info.dataset.ready=String(Boolean(ready));
    const icon=make("span","2×2");
    icon.className="fleetSalvoBadge";
    icon.setAttribute("aria-hidden","true");
    info.prepend(icon);
    return info;
  }

  function openProjection() {
    window.open(location.pathname+"#fleetView="+encodeURIComponent(match.channelName),"_blank","noopener");
  }
  let shownShotEffect = null;
  function showShotEffect(shot) {
    const effect=shot?.effect;
    if (!effect || effect.id===shownShotEffect) return;
    shownShotEffect=effect.id;
    const remaining=effect.until-Date.now();
    if (remaining<=0) return;
    document.getElementById("fleetShotEffect")?.remove();
    const overlay=make("div");
    overlay.id="fleetShotEffect";
    overlay.className="fleetShotEffect "+effect.kind;
    overlay.setAttribute("role","status");
    const title=make("strong",effect.text);
    title.lang=effect.language;
    overlay.append(title);
    document.body.append(overlay);
    setTimeout(()=>overlay.remove(),Math.min(remaining,3200));
  }

  function sync() {
    if (!match) return;
    match.review = -1;
    if (match.phase==="between" || match.phase==="question") match.phase = state.pending ? "question" : "between";
    render();
    showShotEffect(match.lastShot);
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
    match.answerReview={word:state.current.card[state.current.side],solution};
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
    if (isComputerTurn() && match.phase==="shot") {
      const active=match,revision=match.revision;
      scheduleComputerStep(()=>{
        if (match!==active || match.phase!=="shot" || match.revision!==revision) return;
        const wide=match.salvos[1],view=boardView(match.boards[0],false);
        const cell=computerTarget(view,wide);
        if (cell!==null) shoot(1,cell,wide);
      });
    }
  }

  function advance(keepTurn=false) {
    match.phase="between";
    if (!keepTurn) state.team=1-state.team;
    match.wide=false;
    el("next").hidden=false;
    el("next").focus();
    queueComputerQuestion();
  }

  function computerTarget(view,wide) {
    const unknown=cell=>!view.visible[cell];
    const hits=Array.from({length:size*size},(_,cell)=>cell).filter(cell=>view.visible[cell]==="hit");
    const hitSet=new Set(hits);
    const remaining=[...lengths];
    for (const ship of view.ships ?? []) {
      if (!ship.destroyed) continue;
      const index=remaining.indexOf(ship.cells.length);
      if (index>=0) remaining.splice(index,1);
    }
    const density=new Array(size*size).fill(0);
    const pursuit=new Array(size*size).fill(0);
    const connectedHits=new Array(size*size).fill(0);
    // Count legal positions of the remaining ships using only public information.
    for (const length of remaining) {
      for (let start=0;start<size*size;start++) {
        for (const vertical of [false,true]) {
          const cells=footprint(start,length,vertical);
          if (!cells.length || cells.some(cell=>view.visible[cell] && !hitSet.has(cell))) continue;
          const occupied=new Set(cells);
          if (cells.some(cell=>neighbors(cell).some(neighbor=>hitSet.has(neighbor) && !occupied.has(neighbor)))) continue;
          const known=cells.filter(cell=>hitSet.has(cell)).length;
          for (const cell of cells) {
            if (!unknown(cell)) continue;
            density[cell]++;
            if (known && hits.some(hit=>Math.abs(Math.floor(hit/size)-Math.floor(cell/size))+Math.abs(hit%size-cell%size)===1)) {
              pursuit[cell]+=known*known;
              connectedHits[cell]=Math.max(connectedHits[cell],known);
            }
          }
        }
      }
    }
    const hintWeight=new Array(size*size).fill(0);
    for (const frame of view.hintFrames ?? []) {
      const cells=area(frame.row,frame.col,frame.width).filter(unknown);
      for (const cell of cells) hintWeight[cell]+=100/cells.length;
    }
    // Accept older public frames that supplied the hint cells without rectangles.
    for (const cell of view.hint ?? []) {
      if (unknown(cell) && !hintWeight[cell]) hintWeight[cell]=1;
    }
    const targetCells=connectedHits.some(value=>value>0);
    const hintCells=hintWeight.some((value,cell)=>value>0 && density[cell]>0);
    const candidates=[];
    for (let cell=0;cell<size*size;cell++) {
      const row=Math.floor(cell/size),col=cell%size;
      if (wide && (row>=size-1 || col>=size-1)) continue;
      const cells=(wide ? area(row,col,2) : [cell]).filter(unknown);
      if (!cells.length) continue;
      const target=cells.filter(n=>connectedHits[n]>0);
      if (targetCells && !target.length) continue;
      const hinted=cells.filter(n=>hintWeight[n]>0 && density[n]>0);
      if (!targetCells && hintCells && !hinted.length) continue;
      const chain=target.length ? Math.max(...target.map(n=>connectedHits[n])) : 0;
      const priority=target.reduce((total,n)=>total+pursuit[n],0);
      const hints=hinted.reduce((total,n)=>total+hintWeight[n],0);
      const coverage=cells.reduce((total,n)=>total+density[n],0);
      // A longer known hit chain takes precedence over another isolated hit.
      const value=chain*1_000_000+priority*1000+hints*10+coverage;
      candidates.push({cell,value});
    }
    if (!candidates.length) return null;
    const best=Math.max(...candidates.map(candidate=>candidate.value));
    const options=candidates.filter(candidate=>candidate.value===best);
    return options[Math.floor(Math.random()*options.length)].cell;
  }

  function shoot(team,cell,wide) {
    if (match.phase!=="shot" || state.team!==team || !Number.isInteger(cell) || cell<0 || cell>=100) return;
    const row=Math.floor(cell/size), col=cell%size;
    if (wide && (!match.salvos[team] || row>=9 || col>=9)) return;
    const board=match.boards[1-team], occupied=new Set(board.ships.flat());
    const targets=(wide ? area(row,col,2) : [cell]).filter(n=>!board.shots.has(n));
    if (!targets.length) return;
    const firedArea=wide ? area(row,col,2) : [cell];
    if (wide) match.salvos[team]=false;
    for (const n of targets) board.shots.set(n,occupied.has(n) ? "hit" : "water");
    const sunk=board.ships.filter(ship=>ship.some(n=>targets.includes(n)) && ship.every(n=>board.shots.has(n)));
    for (const ship of sunk) {
      for (const n of ship.flatMap(neighbors)) if (!board.shots.has(n)) board.shots.set(n,"clear");
    }
    discardEmptyHints(board);
    const hits=targets.filter(n=>occupied.has(n)).length;
    const report=hits ? hits+" Treffer · "+(targets.length-hits)+" Wasser" : "Wasser";
    const sunkReport=sunk.length ? " · "+sunk.length+(sunk.length===1 ? " Schiff versenkt" : " Schiffe versenkt") : "";
    let effect=null;
    if (hits) {
      const english=(match.hitEffects ?? 0)%2===1;
      match.hitEffects=(match.hitEffects ?? 0)+1;
      const kind=sunk.length ? "sunk" : "hit";
      effect={id:match.channelName+"-"+Date.now()+"-"+match.hitEffects,
        kind,language:english ? "en" : "de",until:Date.now()+3200,
        text:sunk.length ? (english ? "Sunk!" : "Versenkt!") : (english ? "Hit!" : "Treffer!")};
    }
    match.lastShot={board:1-team,cells:firedArea,result:report+sunkReport,effect};
    el("feedback").textContent=report+sunkReport+
      (hits && ![...occupied].every(n=>board.shots.has(n)) ? " · Das Team bleibt dran und bekommt eine neue Frage." : "");
    el("answerKey").hidden=true;
    if ([...occupied].every(n=>board.shots.has(n))) {
      el("word").textContent=match.names[team]+" gewinnt!";
      el("turn").textContent="Spiel beendet";
      el("editGameVocabulary").hidden=true;
      match.phase="finished";
      match.outcome={winner:team,message:match.names[team]+" gewinnt!"};
    } else advance(hits>0);
    sync();
    if (match.outcome) showGameResult(!state.computer || match.outcome.winner===0,match.outcome.message);
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
      wide:false,openCodes:new Set(),salvos:[false,false],streaks:[0,0],draft:{ships:[],vertical:false},
      boards:names.map(()=>({ships:[],shots:new Map(),hints:[]}))};
    for (const id of ["judge","typedAnswer","next","answerKey","editGameVocabulary"]) el(id).hidden=true;
    el("score").textContent="Schiffe versenken";
    el("word").textContent="";
    el("turn").textContent="";
    el("feedback").textContent="";
    state.pending=false;
    if (state.computer) {
      active.boards[1].ships=randomFleet();
      active.placing=true;
    }
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
    cancelComputerStep();
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
    if (hostKey) el("fleetMode").value="lan";
    const updateLanHelp=()=>{
      el("fleetLanHelp").hidden=Boolean(hostKey) || el("fleetMode").value!=="lan";
    };
    el("fleetMode").addEventListener("change",updateLanHelp);
    updateLanHelp();
    const screen=params.get("fleetView"), key=params.get("fleetJoin"), role=params.get("role");
    if (!screen && !key) return;
    const container=el("fleetGuest");
    el("setup").hidden=true;
    el("game").hidden=true;
    container.hidden=false;
    container.textContent="Warte auf die Moderation …";
    const team=role==="0" || role==="1" ? Number(role) : -1;
    if (team>=0) container.dataset.team = String(team);
    else container.dataset.projection="true";
    const draft={ships:[],vertical:false};
    let current=null, wide=false, waiting=false, sent=false, notice="", resultShown=false;
    function show() {
      if (!current) return;
      const frame=current;
      const activeTurn = ["question","shot"].includes(frame.phase);
      const heading = team < 0 ? "Schiffe versenken · Beamer" : activeTurn
        ? (frame.team===team ? "Du bist dran" : "Das andere Team ist dran")
        : (frame.phase==="placement" ? "Deine Flotte aufstellen" : "Schiffe versenken");
      const title=make("h2",heading);
      title.hidden=activeTurn && team>=0;
      container.replaceChildren(title);
      if (frame.phase==="placement") {
        if (team>=0 && !frame.ready[team] && !sent) placement(container,draft,"Eigene Flotte",
          ships=>send({kind:"placement",ships}),show);
        else container.append(make("p","Die Teams stellen ihre Flotten auf."));
      } else {
        const canShoot=team>=0 && frame.phase==="shot" && frame.team===team && !waiting;
        if (!activeTurn) container.append(make("p",frame.turn));
        const word=make("h3",frame.word);
        word.className="fleetQuestionWord";
        container.append(word);
        if (frame.secondaryWord) {
          const original=make("p",frame.secondaryWord);
          original.className="fleetQuestionOriginal";
          container.append(original);
        }
        container.append(make("p",frame.notice));
        container.append(salvoStatus(frame.streak ?? 0,frame.salvo));
        if (canShoot && frame.salvo) {
          const salvoButton=action(wide ? "Einzelschuss wählen" : "2 × 2-Salve wählen",()=>{wide=!wide;show()});
          salvoButton.className="fleetSalvoToggle";
          salvoButton.setAttribute("aria-pressed",String(wide));
          container.append(salvoButton);
        }
        if (canShoot) container.append(make("p",wide ? "Wähle das obere linke Feld der Salve." : "Wähle ein Zielfeld."));
        grids(container,frame.names.map((name,i)=>i===team ? "Eigene Flotte" : name),frame.boards,
          canShoot ? 1-team : -1,cell=>send({kind:"shot",cell,wide,revision:frame.revision}),wide,{...frame,viewer:team});
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
      showShotEffect(frame.lastShot);
      if (frame.outcome && !resultShown) {
        resultShown=true;
        showGameResult(team<0 || team===frame.outcome.winner,frame.outcome.message);
      }
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
