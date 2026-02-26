const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const app = express();
const server = http.createServer(app);

const io = new Server(server, { 
    cors: { origin: "*", methods: ["GET", "POST"] } 
});

let users = {}; 
let squads = [];

io.on('connection', (socket) => {
    console.log("🟢 Signal Nexus détecté :", socket.id);

    // --- INSCRIPTION ---
    socket.on('register', (data) => {
        if (users[data.username]) return socket.emit('auth-error', "Pseudo déjà pris.");
        const id = "PLT-" + Math.floor(1000 + Math.random() * 9000);
        users[data.username] = { 
            id, username: data.username, password: data.password, 
            color: "#00f2ff", bio: "Pilote Nexus", logo: "👤", 
            friends: [], socketId: socket.id 
        };
        socket.emit('auth-success', users[data.username]);
        console.log(`✅ Nouveau Pilote : ${data.username} [${id}]`);
    });

    // --- CONNEXION ---
    socket.on('login', (data) => {
        const u = users[data.username];
        if (u && u.password === data.password) {
            u.socketId = socket.id;
            socket.emit('auth-success', u);
            socket.emit('sync-data', { 
                friends: u.friends.map(fId => Object.values(users).find(usr => usr.id === fId)),
                squads: squads.filter(s => s.members.includes(u.id))
            });
            console.log(`🔑 Connexion : ${u.username}`);
        } else {
            socket.emit('auth-error', "Identifiants invalides.");
        }
    });

    // --- PROFIL ---
    socket.on('update-profile', (data) => {
        const u = users[data.username];
        if (u) {
            u.color = data.color;
            u.bio = data.bio;
            u.logo = data.logo;
            socket.emit('auth-success', u);
            console.log(`🎨 Profil mis à jour : ${u.username}`);
        }
    });

    // --- AMIS ---
    socket.on('add-friend', (data) => {
        const me = Object.values(users).find(u => u.id === data.myId);
        const target = Object.values(users).find(u => u.id === data.targetId);

        if (target && me && me.id !== target.id) {
            if (!me.friends.includes(target.id)) {
                me.friends.push(target.id);
                target.friends.push(me.id);
                
                // Refresh pour 'me'
                socket.emit('sync-data', { 
                    friends: me.friends.map(fId => Object.values(users).find(usr => usr.id === fId)),
                    squads: squads.filter(s => s.members.includes(me.id))
                });
                // Refresh pour 'target'
                io.to(target.socketId).emit('sync-data', { 
                    friends: target.friends.map(fId => Object.values(users).find(usr => usr.id === fId)),
                    squads: squads.filter(s => s.members.includes(target.id))
                });
            }
        } else {
            socket.emit('auth-error', "ID Pilote introuvable.");
        }
    });

    // --- SQUADS ---
    socket.on('create-squad', (data) => {
        const newSquad = {
            id: "SQD-" + Date.now(),
            name: data.name,
            members: [data.myId],
            channels: [{ id: "c1", name: "général", type: "text" }]
        };
        squads.push(newSquad);
        socket.join(newSquad.id);
        
        const me = Object.values(users).find(u => u.id === data.myId);
        socket.emit('sync-data', { 
            friends: me.friends.map(fId => Object.values(users).find(usr => usr.id === fId)),
            squads: squads.filter(s => s.members.includes(me.id))
        });
    });

    // --- MESSAGES ---
    socket.on('join-room', (room) => socket.join(room));
    
    socket.on('send-msg', (data) => {
        const sender = Object.values(users).find(u => u.id === data.senderId);
        io.to(data.room).emit('render-msg', { ...data, sender });
    });

    socket.on('disconnect', () => console.log("❌ Signal perdu"));
});

server.listen(3000, () => {
    console.log("--------------------------------------");
    console.log("🚀 NEXUS V12 ENGINE READY ON PORT 3000");
    console.log("--------------------------------------");
});
