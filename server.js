const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

let users = {};  
let squads = [];

io.on('connection', (socket) => {
    // --- AUTHENTIFICATION ---
    socket.on('register', (data) => {
        if (users[data.username]) return socket.emit('auth-error', "Matricule déjà pris.");
        const id = "PLT-" + Math.floor(1000 + Math.random() * 9000);
        users[data.username] = { 
            id, ...data, color: "#00f2ff", logo: "👤", 
            friends: [], socketId: socket.id, status: "online" 
        };
        socket.emit('auth-success', users[data.username]);
        io.emit('user-status-change');
    });

    socket.on('login', (data) => {
        const u = users[data.username];
        if (u && u.password === data.password) {
            u.socketId = socket.id;
            u.status = "online";
            socket.emit('auth-success', u);
            io.emit('user-status-change');
            sendSyncData(socket, u);
        } else {
            socket.emit('auth-error', "Accès refusé.");
        }
    });

    // --- GESTION DES SQUADS & SALONS ---
    socket.on('create-squad', (data) => {
        const newSquad = {
            id: "SQD-" + Date.now(),
            name: data.name,
            owner: data.myId,
            members: [data.myId],
            channels: [{ id: "ch-1", name: "général" }]
        };
        squads.push(newSquad);
        refreshAll(data.myId);
    });

    socket.on('create-channel', (data) => {
        const squad = squads.find(s => s.id === data.squadId);
        if (squad && squad.owner === data.myId) {
            squad.channels.push({ id: "ch-" + Date.now(), name: data.name });
            refreshAll();
        }
    });

    // --- MESSAGERIE & ACTIONS ---
    socket.on('send-msg', (data) => {
        const msgId = "MSG-" + Date.now();
        io.to(data.room).emit('render-msg', { 
            id: msgId, 
            ...data, 
            sender: users[Object.keys(users).find(k => users[k].id === data.senderId)] 
        });
    });

    socket.on('delete-msg', (data) => {
        io.to(data.room).emit('remove-msg-ui', data.msgId);
    });

    socket.on('typing', (data) => {
        socket.to(data.room).emit('user-typing', { name: data.name, isTyping: data.isTyping });
    });

    socket.on('disconnect', () => {
        for (let u in users) {
            if (users[u].socketId === socket.id) {
                users[u].status = "offline";
                io.emit('user-status-change');
                break;
            }
        }
    });
});

function sendSyncData(targetSocket, userObj) {
    const friendsData = userObj.friends.map(fId => {
        const f = Object.values(users).find(u => u.id === fId);
        return f ? { id: f.id, username: f.username, logo: f.logo, color: f.color, status: f.status } : null;
    }).filter(x => x);

    targetSocket.emit('sync-data', { 
        friends: friendsData, 
        squads: squads.filter(s => s.members.includes(userObj.id)),
        allUsers: Object.values(users).map(u => ({ id: u.id, username: u.username, logo: u.logo, color: u.color, status: u.status }))
    });
}

function refreshAll() {
    io.sockets.sockets.forEach(s => {
        const u = Object.values(users).find(usr => usr.socketId === s.id);
        if(u) sendSyncData(s, u);
    });
}

server.listen(3000, () => console.log("🚀 NEXUS V13 CORE ACTIVE"));
