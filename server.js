// ===== NEXUS CORE SERVER (Render Ready) =====

const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);

// ===== PORT RENDER OBLIGATOIRE =====
const PORT = process.env.PORT || 3000;

// ===== SOCKET CONFIG =====
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  },
  transports: ["websocket", "polling"]
});

// ===== TEST ROUTE =====
app.get("/", (req, res) => {
  res.send("NEXUS CORE ONLINE");
});

// ===== STORAGE =====
const users = new Map();     // username -> user
const squads = new Map();    // squadId -> squad

// ===== UTILITIES =====
const generatePilotId = () =>
  "PLT-" + Math.floor(1000 + Math.random() * 9000);

const generateSquadId = () =>
  "SQ-" + Math.floor(10000 + Math.random() * 90000);

const timeNow = () =>
  new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

const getUserById = id =>
  [...users.values()].find(u => u.id === id);

const getUserBySocket = socketId =>
  [...users.values()].find(u => u.socketId === socketId);

// ===== SYNC USER =====
function syncUser(socket, user) {
  if (!user) return;

  const mySquads = [...squads.values()]
    .filter(s => s.members.includes(user.id));

  const visibleIds = new Set(user.friends);

  mySquads.forEach(s =>
    s.members.forEach(id => visibleIds.add(id))
  );

  const visibleUsers = [...users.values()]
    .filter(u => visibleIds.has(u.id) || u.id === user.id)
    .map(u => ({
      id: u.id,
      username: u.username,
      logo: u.logo,
      color: u.color,
      status: u.status
    }));

  socket.emit("nexus-sync", {
    me: user,
    friends: [...users.values()].filter(u =>
      user.friends.includes(u.id)
    ),
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

// ===== CONNECTION =====
io.on("connection", socket => {
  console.log("Client connecté :", socket.id);

  // ===== REGISTER =====
  socket.on("register", ({ username, password }) => {
    if (!username || !password)
      return socket.emit("error", "Champs invalides.");

    if (users.has(username))
      return socket.emit("error", "Nom déjà utilisé.");

    const user = {
      id: generatePilotId(),
      username,
      password,
      color: "#00f2ff",
      logo: "👤",
      friends: [],
      socketId: socket.id,
      status: "online"
    };

    users.set(username, user);

    syncUser(socket, user);
    refreshAll();
  });

  // ===== LOGIN =====
  socket.on("login", ({ username, password }) => {
    const user = users.get(username);

    if (!user || user.password !== password)
      return socket.emit("error", "Identifiants invalides.");

    user.socketId = socket.id;
    user.status = "online";

    syncUser(socket, user);
    refreshAll();
  });

  // ===== FRIEND =====
  socket.on("add-friend", ({ myId, targetId }) => {
    const me = getUserById(myId);
    const target = getUserById(targetId);

    if (!me || !target) return;
    if (me.id === target.id) return;
    if (me.friends.includes(target.id)) return;

    me.friends.push(target.id);
    target.friends.push(me.id);

    refreshAll();
  });

  // ===== CREATE SQUAD =====
  socket.on("create-squad", ({ name, myId }) => {
    if (!name || !myId) return;

    const id = generateSquadId();

    squads.set(id, {
      id,
      name,
      owner: myId,
      members: [myId],
      channels: [{ id: "general", name: "général" }]
    });

    refreshAll();
  });

  // ===== JOIN SQUAD =====
  socket.on("join-squad", ({ squadId, myId }) => {
    const squad = squads.get(squadId);
    if (!squad) return;

    if (!squad.members.includes(myId))
      squad.members.push(myId);

    refreshAll();
  });

  // ===== ROOM =====
  socket.on("join-room", room => {
    socket.join(room);
  });

  // ===== MESSAGE =====
  socket.on("send-msg", ({ room, senderId, text }) => {
    if (!room || !text) return;

    const sender = getUserById(senderId);
    if (!sender) return;

    io.to(room).emit("new-msg", {
      id: "M-" + Date.now(),
      room,
      text,
      time: timeNow(),
      sender: {
        username: sender.username,
        color: sender.color,
        logo: sender.logo
      }
    });
  });

  // ===== DISCONNECT =====
  socket.on("disconnect", () => {
    const user = getUserBySocket(socket.id);
    if (!user) return;

    user.status = "offline";
    refreshAll();
  });
});

// ===== START SERVER =====
server.listen(PORT, () => {
  console.log("🚀 NEXUS CORE ONLINE on port", PORT);
});
