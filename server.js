const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 3000;

const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] },
  transports: ["websocket", "polling"]
});

app.get("/", (req, res) => res.send("NEXUS CORE ONLINE"));

const users = new Map();  // username -> user
const squads = new Map(); // squadId -> squad

const generatePilotId = () => "PLT-" + Math.floor(1000 + Math.random() * 9000);
const generateSquadId = () => "SQ-" + Math.floor(10000 + Math.random() * 90000);

function syncUser(socket, user) {
  if (!user) return;
  const mySquads = [...squads.values()].filter(s => s.members.includes(user.id));
  const visibleIds = new Set(user.friends);
  mySquads.forEach(s => s.members.forEach(id => visibleIds.add(id)));

  const visibleUsers = [...users.values()]
    .filter(u => visibleIds.has(u.id) || u.id === user.id)
    .map(u => ({ id: u.id, username: u.username, logo: u.logo, color: u.color, status: u.status }));

  socket.emit("nexus-sync", {
    me: user,
    friends: [...users.values()].filter(u => user.friends.includes(u.id)),
    squads: mySquads,
    visibleUsers
  });
}

function refreshAll() {
  for (const user of users.values()) {
    const sock = io.sockets.sockets.get(user.socketId);
    if (sock) syncUser(sock, user);
  }
}

io.on("connection", socket => {
  socket.on("register", ({ username, password }) => {
    if (users.has(username)) return socket.emit("error", "Nom déjà utilisé.");
    const user = { id: generatePilotId(), username, password, color: "#00f2ff", logo: "👤", friends: [], socketId: socket.id, status: "online" };
    users.set(username, user);
    syncUser(socket, user);
    refreshAll();
  });

  socket.on("login", ({ username, password }) => {
    const user = users.get(username);
    if (!user || user.password !== password) return socket.emit("error", "Identifiants invalides.");
    user.socketId = socket.id;
    user.status = "online";
    syncUser(socket, user);
    refreshAll();
  });

  socket.on("add-friend", ({ myId, targetId }) => {
    const me = [...users.values()].find(u => u.id === myId);
    const target = [...users.values()].find(u => u.id === targetId);
    if (me && target && me.id !== target.id && !me.friends.includes(target.id)) {
      me.friends.push(target.id);
      target.friends.push(me.id);
      refreshAll();
    }
  });

  socket.on("create-squad", ({ myId, name }) => {
    const id = generateSquadId();
    squads.set(id, { id, name, owner: myId, members: [myId], channels: [{ id: "general", name: "général" }] });
    refreshAll();
  });

  socket.on("join-squad", ({ myId, squadId }) => {
    const squad = squads.get(squadId);
    if (squad && !squad.members.includes(myId)) {
      squad.members.push(myId);
      refreshAll();
    }
  });

  socket.on("join-room", room => socket.join(room));

  socket.on("send-msg", ({ room, senderId, text }) => {
    const sender = [...users.values()].find(u => u.id === senderId);
    if (!sender) return;
    io.to(room).emit("new-msg", {
      id: "M-" + Date.now(),
      text,
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      sender: { username: sender.username, color: sender.color, logo: sender.logo }
    });
  });

  socket.on("disconnect", () => {
    const user = [...users.values()].find(u => u.socketId === socket.id);
    if (user) { user.status = "offline"; refreshAll(); }
  });
});

server.listen(PORT, () => console.log("🚀 NEXUS ONLINE ON PORT", PORT));
