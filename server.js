const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

let users = {}; // Stockage des profils {id: {username, color, role, friends:[]}}
let squads = []; // {id, name, members:[], channels:[]}

io.on('connection', (socket) => {
    // --- AUTH & PERSONNALISATION ---
    socket.on('register', (data) => {
        const id = "PLT-" + Math.floor(1000 + Math.random() * 9000);
        users[id] = { 
            id, 
            username: data.username, 
            color: data.color || "#00f2ff", 
            role: "Pilote", 
            socketId: socket.id,
            friends: [] 
        };
        socket.emit('auth-success', users[id]);
    });

    socket.on('login', (data) => {
        const user = Object.values(users).find(u => u.username === data.username);
        if (user) {
            user.socketId = socket.id;
            socket.emit('auth-success', user);
            socket.emit('sync-data', { 
                friends: user.friends.map(fid => users[fid]),
                squads: squads.filter(s => s.members.includes(user.id))
            });
        }
    });

    // --- SQUADS & SALONS ---
    socket.on('create-squad', (data) => {
        const newSquad = {
            id: "SQD-" + Date.now(),
            name: data.name,
            members: [data.myId],
            channels: [{ id: "c1", name: "général", type: "text" }]
        };
        squads.push(newSquad);
        socket.join(newSquad.id);
        io.emit('refresh-squads', squads);
    });

    socket.on('add-chan', (data) => {
        const squad = squads.find(s => s.id === data.squadId);
        if(squad) {
            squad.channels.push({ id: "c"+Date.now(), name: data.name, type: data.type });
            io.to(squad.id).emit('squad-update', squad);
        }
    });

    socket.on('join-room', (room) => { socket.join(room); });

    // --- MESSAGERIE AVEC RÔLES ---
    socket.on('send-msg', (data) => {
        const sender = users[data.senderId];
        io.to(data.room).emit('render-msg', {
            ...data,
            username: sender.username,
            color: sender.color,
            role: sender.role
        });
    });
});
server.listen(3000, () => console.log("NEXUS CORE V9 ONLINE"));
