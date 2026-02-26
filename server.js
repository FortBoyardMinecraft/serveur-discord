const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 3000;

const io = new Server(server, {
  cors: { origin: "*" },
  transports: ["websocket", "polling"]
});

const users = new Map();
const squads = new Map();

io.on("connection", socket => {
  const sync = (u) => {
    if (!u) return;
    const mySq = [...squads.values()].filter(s => s.members.includes(u.id));
    const vIds = new Set(u.friends);
    mySq.forEach(s => s.members.forEach(id => vIds.add(id)));
    const vUsr = [...users.values()].filter(usr => vIds.has(usr.id) || usr.id === u.id)
                 .map(usr => ({ id: usr.id, username: usr.username, status: usr.status }));
    socket.emit("nexus-sync", { me: u, friends: [...users.values()].filter(f => u.friends.includes(f.id)), squads: mySq, visibleUsers: vUsr });
  };

  socket.on("register", ({ username, password }) => {
    const user = { id: "PLT-"+Math.floor(1000+Math.random()*9000), username, password, friends: [], socketId: socket.id, status: "online" };
    users.set(username, user);
    sync(user);
  });

  socket.on("login", ({ username, password }) => {
    const user = users.get(username);
    if (user && user.password === password) { user.socketId = socket.id; user.status = "online"; sync(user); }
  });

  socket.on("add-friend", ({ myId, targetId }) => {
    const me = [...users.values()].find(u => u.id === myId);
    const tg = [...users.values()].find(u => u.id === targetId);
    if (me && tg) { me.friends.push(tg.id); tg.friends.push(me.id); }
    [...users.values()].forEach(u => { const s = io.sockets.sockets.get(u.socketId); if(s) sync(u); });
  });

  socket.on("create-squad", ({ myId, name }) => {
    const id = "SQ-"+Math.floor(10000+Math.random()*90000);
    squads.set(id, { id, name, members: [myId], channels: [{id: "gen", name: "général"}] });
    [...users.values()].forEach(u => { const s = io.sockets.sockets.get(u.socketId); if(s) sync(u); });
  });

  socket.on("join-squad", ({ myId, squadId }) => {
    const s = squads.get(squadId);
    if (s && !s.members.includes(myId)) s.members.push(myId);
    [...users.values()].forEach(u => { const s = io.sockets.sockets.get(u.socketId); if(s) sync(u); });
  });

  socket.on("join-room", r => socket.join(r));
  socket.on("send-msg", d => {
    const u = [...users.values()].find(usr => usr.id === d.senderId);
    io.to(d.room).emit("new-msg", { ...d, time: new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}), sender: { username: u.username } });
  });
});

server.listen(PORT, () => console.log("🚀 NEXUS V16 READY"));
