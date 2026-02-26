const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

// --- BASE DE DONNÉES EN MÉMOIRE ---
let db = {
    users: [],    // {id, username, password, socketId}
    squads: [],   // {id, name, owner, members:[], channels:[{id, name, type, messages:[]}], roles:[]}
    privates: []  // {id, messages:[]}
};

io.on('connection', (socket) => {
    console.log('📡 Liaison établie:', socket.id);

    // --- AUTHENTIFICATION ---
    socket.on('register', (data) => {
        const id = "PLT-" + Math.floor(1000 + Math.random() * 9000);
        const newUser = { id, username: data.username, password: data.password, socketId: socket.id };
        db.users.push(newUser);
        socket.emit('auth-success', { id, username: data.username });
    });

    socket.on('login', (data) => {
        const user = db.users.find(u => u.username === data.username && u.password === data.password);
        if (user) {
            user.socketId = socket.id;
            socket.emit('auth-success', { id: user.id, username: user.username });
        } else {
            socket.emit('auth-error', "Accès refusé : Identifiants invalides.");
        }
    });

    // --- GESTION DES SQUADS ---
    socket.on('create-squad', (data) => {
        const newSquad = {
            id: "SQD-" + Date.now(),
            name: data.name,
            owner: data.userId,
            members: [data.userId],
            channels: [
                { id: "chan-1", name: "général", type: "text", messages: [] },
                { id: "voc-1", name: "Salon Vocal 1", type: "voice" }
            ],
            roles: [{ name: "Commandant", color: "#00f2ff", users: [data.userId] }]
        };
        db.squads.push(newSquad);
        socket.join(newSquad.id);
        io.emit('sync-squads', db.squads.filter(s => s.members.includes(data.userId)));
    });

    socket.on('invite-user', (data) => {
        const squad = db.squads.find(s => s.id === data.squadId);
        const user = db.users.find(u => u.id === data.targetId);
        if (squad && user && !squad.members.includes(data.targetId)) {
            squad.members.push(data.targetId);
            // On prévient l'invité s'il est connecté
            io.to(user.socketId).emit('new-invitation', { squadName: squad.name });
            io.emit('sync-squads', db.squads); 
        }
    });

    // --- SALONS & MESSAGES ---
    socket.on('join-room', (roomId) => {
        socket.join(roomId);
        // Envoyer l'historique
        let history = [];
        db.squads.forEach(s => {
            let c = s.channels.find(chan => (s.id + '-' + chan.id) === roomId);
            if(c) history = c.messages;
        });
        socket.emit('chat-history', history);
    });

    socket.on('send-chat-message', (data) => {
        // Sauvegarde dans l'historique du serveur
        db.squads.forEach(s => {
            let c = s.channels.find(chan => (s.id + '-' + chan.id) === data.room);
            if(c) c.messages.push(data);
        });
        io.to(data.room).emit('receive-chat-message', data);
    });

    // --- AJOUT DE SALON ---
    socket.on('add-channel', (data) => {
        const squad = db.squads.find(s => s.id === data.squadId);
        if(squad) {
            const newChan = { id: "chan-" + Date.now(), name: data.name, type: data.type, messages: [] };
            squad.channels.push(newChan);
            io.to(data.squadId).emit('squad-updated', squad);
        }
    });

    socket.on('disconnect', () => {
        console.log('❌ Déconnexion pilote');
    });
});

server.listen(3000, () => {
    console.log(`
    ======================================
    🚀 NEXUS CORE V7 - SYSTÈME ACTIF
    Port: 3000 | Statut: Opérationnel
    ======================================
    `);
});
