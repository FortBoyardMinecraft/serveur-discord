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
    socket.on('add-friend', (data) => {
        console.log(`📡 Tentative d'ajout d'ami : de ${data.myId} vers ${data.targetId}`);
        const me = Object.values(users).find(u => u.id === data.myId);
        const target = Object.values(users).find(u => u.id === data.targetId);

        if (target && me && me.id !== target.id) {
            if (!me.friends.includes(target.id)) {
                me.friends.push(target.id);
                target.friends.push(me.id);
                
                // On renvoie la liste d'amis mise à jour aux deux
                const myFriends = me.friends.map(fId => Object.values(users).find(usr => usr.id === fId));
                const targetFriends = target.friends.map(fId => Object.values(users).find(usr => usr.id === fId));
                
                io.to(me.socketId).emit('sync-data', { friends: myFriends, squads: squads.filter(s => s.members.includes(me.id)) });
                io.to(target.socketId).emit('sync-data', { friends: targetFriends, squads: squads.filter(s => s.members.includes(target.id)) });
                console.log(`🤝 Ami ajouté ! ${me.username} <-> ${target.username}`);
            }
        } else {
            socket.emit('auth-error', "Pilote introuvable ou ID incorrect.");
        }
    });

    // --- ACTION : CRÉER SQUAD ---
    socket.on('create-squad', (data) => {
        console.log(`🏗️ Création Squad : ${data.name} par ${data.myId}`);
        const newSquad = {
            id: "SQD-" + Date.now(),
            name: data.name,
            members: [data.myId],
            channels: [{ id: "c1", name: "général", type: "text" }]
        };
        squads.push(newSquad);
        socket.join(newSquad.id);
        
        // On renvoie la liste de squads mise à jour au créateur
        const mySquads = squads.filter(s => s.members.includes(data.myId));
        const myFriends = Object.values(users).find(u => u.id === data.myId).friends.map(fId => Object.values(users).find(usr => usr.id === fId));
        
        socket.emit('sync-data', { friends: myFriends, squads: mySquads });
    });
});

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
