const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 3000;

const io = new Server(server, { cors: { origin: "*" } });

const users = new Map();
const squads = new Map();
const messagesHistory = new Map(); 

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
        if(users.has(username)) return socket.emit("error", "Ce nom est déjà pris");
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
        } else {
            socket.emit("error", "Identifiants incorrects");
        }
    });

    socket.on("update-profile", (data) => {
        const u = [...users.values()].find(usr => usr.id === data.myId);
        if(u) {
            u.avatar = data.avatar;
            u.bio = data.bio;
            u.color = data.color;
            // On refresh tout le monde pour que les changements soient visibles partout
            [...users.values()].forEach(activeUser => {
                const s = io.sockets.sockets.get(activeUser.socketId);
                if(s) sync(activeUser);
            });
        }
    });

    // --- SQUADS LOGIC ---
    socket.on("create-squad", ({ myId, name }) => {
        const squadId = "SQ-" + Math.floor(1000 + Math.random() * 9000);
        const newSquad = { 
            id: squadId, 
            name: name, 
            members: [myId], 
            channels: [{ id: "gen", name: "general" }] 
        };
        squads.set(squadId, newSquad);
        const u = [...users.values()].find(usr => usr.id === myId);
        sync(u);
    });

    socket.on("join-squad", ({ myId, squadId }) => {
        const sq = squads.get(squadId);
        if(sq && !sq.members.includes(myId)) {
            sq.members.push(myId);
            const u = [...users.values()].find(usr => usr.id === myId);
            sync(u);
        } else {
            socket.emit("error", "Squad introuvable");
        }
    });

    // --- FRIENDS LOGIC ---
    socket.on("add-friend", ({ myId, targetId }) => {
        const me = [...users.values()].find(u => u.id === myId);
        const friend = [...users.values()].find(u => u.id === targetId);
        if(me && friend && !me.friends.includes(targetId)) {
            me.friends.push(targetId);
            friend.friends.push(myId);
            sync(me);
            const fSocket = io.sockets.sockets.get(friend.socketId);
            if(fSocket) sync(friend);
        }
    });

    // --- CHAT LOGIC ---
    socket.on("join-room", room => {
        socket.join(room);
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
            sender: { username: u.username, color: u.color, avatar: u.avatar }
        };

        if(!messagesHistory.has(d.room)) messagesHistory.set(d.room, []);
        const roomMsgs = messagesHistory.get(d.room);
        roomMsgs.push(fullMsg);
        if(roomMsgs.length > 50) roomMsgs.shift();

        io.to(d.room).emit("new-msg", fullMsg);
    });

    socket.on("refresh-all", () => {
        const u = [...users.values()].find(usr => usr.socketId === socket.id);
        if(u) sync(u);
    });

    socket.on("disconnect", () => {
        const u = [...users.values()].find(usr => usr.socketId === socket.id);
        if(u) u.status = "offline";
    });
});

server.listen(PORT, () => console.log("🚀 NEXUS SYSTEM ONLINE"));
