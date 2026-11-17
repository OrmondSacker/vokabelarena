"use strict";
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const {randomBytes} = require("node:crypto");

const port = Number(process.env.FLEET_PORT || 8088);
const secret = () => randomBytes(24).toString("base64url");
const setupKey = secret();
const addresses = Object.values(os.networkInterfaces()).flat()
  .filter(entry => entry.family === "IPv4" && !entry.internal).map(entry => entry.address);
const publicAddress = process.env.FLEET_ADDRESS || addresses[0] || "127.0.0.1";
const rooms = new Map();
const files = new Map([["/","index.html"],["/index.html","index.html"],["/fleet.js","fleet.js"]]);
const idleLimit = 4 * 60 * 60 * 1000;

function json(response,status,data) {
  response.writeHead(status,{"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store"});
  response.end(JSON.stringify(data));
}
async function body(request) {
  let payload = "";
  for await (const chunk of request) {
    payload += chunk;
    if (payload.length > 131072) throw Error("Zu viele Daten");
  }
  return JSON.parse(payload || "{}");
}
function retire(room) {
  for (const key of room.keys) rooms.delete(key);
}

const server = http.createServer(async (request,response) => {
  try {
    const endpoint = new URL(request.url,"http://localhost").pathname;
    if (request.method === "GET" && files.has(endpoint)) {
      const file = files.get(endpoint);
      const data = await fs.promises.readFile(path.join(__dirname,file));
      response.writeHead(200,{"Content-Type":file.endsWith(".js") ? "text/javascript; charset=utf-8" : "text/html; charset=utf-8",
        "Cache-Control":"no-cache","Referrer-Policy":"no-referrer","X-Content-Type-Options":"nosniff"});
      response.end(data);
      return;
    }
    const auth = request.headers.authorization ?? "";
    const key = auth.startsWith("Bearer ") ? auth.slice(7) : "";
    if (endpoint === "/fleet-api/open" && request.method === "POST") {
      if (key !== setupKey) return json(response,403,{});
      for (const old of new Set(rooms.values())) {
        if (Date.now()-old.used>idleLimit) retire(old);
      }
      if (rooms.size>=32) return json(response,429,{});
      const keys = Array.from({length:4},secret);
      const room = {keys,frames:[null,null,null],commands:[],used:Date.now()};
      keys.forEach(token=>rooms.set(token,room));
      const urls = [publicAddress,...addresses.filter(ip=>ip!==publicAddress)];
      const links = {};
      for (const ip of urls) {
        const prefix = urls.length>1 ? ip+" · " : "";
        for (const [i,name] of ["Beamer","Team 1","Team 2"].entries()) {
          links[prefix+name]="http://"+ip+":"+port+"/#fleetJoin="+keys[i+1]+"&role="+(i-1);
        }
      }
      return json(response,200,{host:keys[0],links});
    }
    const room = rooms.get(key);
    if (!room) return json(response,404,{});
    if (Date.now()-room.used>idleLimit) { retire(room); return json(response,404,{}); }
    const role = room.keys.indexOf(key);
    const host = role===0;
    if (host) room.used=Date.now();
    if (endpoint==="/fleet-api/publish" && host && request.method==="POST") {
      const {frames}=await body(request);
      if (!Array.isArray(frames)||frames.length!==3||!frames.every(frame=>frame&&typeof frame==="object")) return json(response,400,{});
      room.frames=frames;
      return json(response,200,{ok:true});
    }
    if (endpoint==="/fleet-api/commands" && host && request.method==="GET") {
      return json(response,200,{commands:room.commands.splice(0)});
    }
    if (endpoint==="/fleet-api/close" && host && request.method==="POST") {
      retire(room);
      return json(response,200,{ok:true});
    }
    if (endpoint==="/fleet-api/read" && role>0 && request.method==="GET") {
      return json(response,200,{frame:room.frames[role-1]});
    }
    if (endpoint==="/fleet-api/command" && role>=2 && request.method==="POST") {
      const command=await body(request);
      if (room.commands.length>=24) return json(response,429,{});
      const frame=room.frames[role-1], team=role-2;
      if (command.kind==="placement" && frame?.phase==="placement" && !frame.ready[team] && Array.isArray(command.ships)) {
        room.commands.push({team,kind:"placement",ships:command.ships});
      } else if (command.kind==="shot" && frame?.phase==="shot" && frame.team===team &&
          command.revision===frame.revision && Number.isInteger(command.cell) && typeof command.wide==="boolean") {
        room.commands.push({team,kind:"shot",cell:command.cell,wide:command.wide,revision:command.revision});
      } else return json(response,409,{});
      return json(response,200,{ok:true});
    }
    return json(response,403,{});
  } catch {
    if (!response.headersSent) json(response,400,{});
    else response.end();
  }
});
server.listen(port,"0.0.0.0",()=>{
  console.log("Moderation: http://127.0.0.1:"+port+"/#fleetHost="+setupKey);
  console.log("WLAN-Adressen: "+addresses.join(", "));
  console.log("Nur den jeweiligen Teamlink weitergeben. Den Moderationslink privat halten.");
});
