const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

let users = {}; // Stockage : { username: { password, id, color, bio, logo, friends:[] } }
let squads = []; // Stockage : { id, name, owner, members:[], channels:[] }

io.on('connection', (socket) => {
    console.log("📡 Signal reçu :", socket.id);

    // --- AUTHENTIFICATION ---
    socket.on('register', (data) => {
        if (users[data.username]) return socket.emit('auth-error', "Ce matricule est déjà attribué.");
        const id = "PLT-" + Math.floor(1000 + Math.random() * 9000);
        users[data.username] = { 
            id, username: data.username, password: data.password, 
            color: "#00f2ff", bio: "Un nouveau pilote dans le Nexus.", logo: "👤", 
            friends: [], socketId: socket.id 
        };
        socket.emit('auth-success', users[data.username]);
    });

    socket.on('login', (data) => {
        const u = users[data.username];
        if (u && u.password === data.password) {
            u.socketId = socket.id;
            socket.emit('auth-success', u);
            // Sync auto des squads et amis
            socket.emit('sync-data', { 
                friends: u.friends.map(fId => Object.values(users).find(usr => usr.id === fId)),
                squads: squads.filter(s => s.members.includes(u.id))
            });
        } else { socket.emit('auth-error', "Accès refusé : Identifiants invalides."); }
    });

    // --- PROFIL ---
    socket.on('update-profile', (data) => {
        const u = users[data.username];
        if (u) {
            Object.assign(u, { color: data.color, bio: data.bio, logo: data.logo });
            socket.emit('auth-success', u);
            io.emit('global-user-update', u); // Pour mettre à jour l'affichage chez les autres
        }
    });

    // --- SQUADS & SALONS ---
    socket.on('create-squad', (data) => {
        const newSquad = {
            id: "SQD-" + Date.now(),
            name: data.name,
            owner: data.myId,
            members: [data.myId],
            channels: [{ id: "c1", name: "général", type: "text" }]
        };
        squads.push(newSquad);
        socket.join(newSquad.id);
        io.emit('sync-squads', squads); 
    });

    socket.on('add-chan', (data) => {
        const squad = squads.find(s => s.id === data.squadId);
        if(squad) {
            squad.channels.push({ id: "c"+Date.now(), name: data.name, type: data.type });
            io.to(squad.id).emit('squad-refresh', squad);
        }
    });

    socket.on('join-room', (room) => { socket.join(room); });

    // --- MESSAGERIE ---
    socket.on('send-msg', (data) => {
        const sender = Object.values(users).find(u => u.id === data.senderId);
        io.to(data.room).emit('render-msg', { ...data, sender });
    });

    socket.on('add-friend', (data) => {
        const me = Object.values(users).find(u => u.id === data.myId);
        const target = Object.values(users).find(u => u.id === data.targetId);
        if(target && me && !me.friends.includes(target.id)) {
            me.friends.push(target.id);
            target.friends.push(me.id);
            io.to(me.socketId).emit('sync-friends', me.friends.map(fId => Object.values(users).find(usr => usr.id === fId)));
            io.to(target.socketId).emit('sync-friends', target.friends.map(fId => Object.values(users).find(usr => usr.id === fId)));
        }
    });
});
server.listen(3000);
