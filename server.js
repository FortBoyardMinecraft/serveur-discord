const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

let users = {}; // { username: { password, id, color, bio, logo, role, friends:[] } }
let squads = [];

io.on('connection', (socket) => {
    // --- AUTHENTIFICATION SÉCURISÉE ---
    socket.on('register', (data) => {
        if (users[data.username]) return socket.emit('auth-error', "Pseudo déjà utilisé.");
        const id = "PLT-" + Math.floor(1000 + Math.random() * 9000);
        users[data.username] = { 
            id, username: data.username, password: data.password, 
            color: "#00f2ff", bio: "Nouveau pilote Nexus", logo: "👤", role: "Pilote", 
            friends: [], socketId: socket.id 
        };
        socket.emit('auth-success', users[data.username]);
    });

    socket.on('login', (data) => {
        const u = users[data.username];
        if (u && u.password === data.password) {
            u.socketId = socket.id;
            socket.emit('auth-success', u);
            socket.emit('sync-data', { 
                friends: u.friends.map(f => users[f]), 
                squads: squads.filter(s => s.members.includes(u.id)) 
            });
        } else { socket.emit('auth-error', "Identifiants incorrects."); }
    });

    // --- MISE À JOUR DU PROFIL ---
    socket.on('update-profile', (data) => {
        const u = users[data.username];
        if (u) {
            u.color = data.color || u.color;
            u.bio = data.bio || u.bio;
            u.logo = data.logo || u.logo;
            socket.emit('auth-success', u); // Renvoie le profil mis à jour
        }
    });

    // --- SQUADS & AMIS (Logique V9 conservée et optimisée) ---
    socket.on('create-squad', (data) => {
        const sq = { id: "SQD-"+Date.now(), name: data.name, members: [data.myId], channels: [{id:"c1", name:"général", type:"text"}] };
        squads.push(sq);
        io.emit('sync-squads', squads);
    });

    socket.on('send-msg', (data) => {
        const sender = Object.values(users).find(u => u.id === data.senderId);
        io.to(data.room).emit('render-msg', { ...data, sender });
    });
});
server.listen(3000);
