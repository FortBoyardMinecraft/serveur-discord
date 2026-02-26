const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 3000;

const io = new Server(server, { cors: { origin: "*" } });

const users = new Map();
const squads = new Map();
const messagesHistory = new Map(); // roomID -> [messages]

io.on("connection", socket => {
    
    const sync = (u) => {
        if (!u) return;
        const mySq = [...squads.values()].filter(s => s.members.includes(u.id));
        const vIds = new Set(u.friends);
        mySq.forEach(s => s.members.forEach(id => vIds.add(id)));
        const vUsr = [...users.values()].filter(usr => vIds.has(usr.id) || usr.id === u.id)
                     .map(usr => ({ id: usr.id, username: usr.username, status: usr.status, color: usr.color, avatar: usr.avatar }));
        
        socket.emit("nexus-sync", { 
            me: u, 
            friends: [...users.values()].filter(f => u.friends.includes(f.id)), 
            squads: mySq, 
            visibleUsers: vUsr 
        });
    };

    socket.on("register", ({ username, password }) => {
        const user = { id: "PLT-"+Math.floor(1000+Math.random()*9000), username, password, friends: [], socketId: socket.id, status: "online", color: "#00f2ff", avatar: "", bio: "" };
        users.set(username, user);
        sync(user);
    });

    socket.on("login", ({ username, password }) => {
        const user = users.get(username);
        if (user && user.password === password) { 
            user.socketId = socket.id; 
            user.status = "online"; 
            sync(user); 
        }
    });

    socket.on("update-profile", (data) => {
        const u = [...users.values()].find(usr => usr.id === data.myId);
        if(u) {
            u.avatar = data.avatar;
            u.bio = data.bio;
            u.color = data.color;
            sync(u);
            // On refresh tout le monde pour voir les changements de couleurs/avatars
            [...users.values()].forEach(all => {
                const s = io.sockets.sockets.get(all.socketId);
                if(s) sync(all);
            });
        }
    });

    socket.on("join-room", room => {
        socket.join(room);
        // ENVOI DE L'HISTORIQUE dès qu'on rejoint un salon
        const history = messagesHistory.get(room) || [];
        socket.emit("chat-history", history);
    });

    socket.on("send-msg", d => {
        const u = [...users.values()].find(usr => usr.id === d.senderId);
        if(!u) return;

        const fullMsg = {
            room: d.room,
            text: d.text,
            time: new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}),
            sender: { 
                username: u.username, 
                color: u.color || "#00f2ff", 
                avatar: u.avatar || "" 
            }
        };

        // Sauvegarde dans l'historique
        if(!messagesHistory.has(d.room)) messagesHistory.set(d.room, []);
        const roomMsgs = messagesHistory.get(d.room);
        roomMsgs.push(fullMsg);
        if(roomMsgs.length > 50) roomMsgs.shift(); // Garde les 50 derniers

        io.to(d.room).emit("new-msg", fullMsg);
    });

    socket.on("refresh-all", () => {
        const u = [...users.values()].find(usr => usr.socketId === socket.id);
        sync(u);
    });
});

server.listen(PORT, () => console.log("🚀 NEXUS V17 - HISTORY ENABLED"));
