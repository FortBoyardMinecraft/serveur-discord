const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const app = express();
const server = http.createServer(app);

// Configuration CORS pour permettre la connexion depuis ton navigateur
const io = new Server(server, { 
    cors: { 
        origin: "*", 
        methods: ["GET", "POST"] 
    } 
});

// Stockage en mémoire vive (Attention : s'efface au redémarrage du serveur)
let users = {};  
let squads = [];

io.on('connection', (socket) => {
    console.log("🟢 Signal Nexus détecté :", socket.id);

    // --- INSCRIPTION ---
    socket.on('register', (data) => {
        if (users[data.username]) {
            return socket.emit('auth-error', "Ce matricule est déjà attribué.");
        }
        const id = "PLT-" + Math.floor(1000 + Math.random() * 9000);
        users[data.username] = { 
            id, 
            username: data.username, 
            password: data.password, 
            color: "#00f2ff", 
            bio: "Pilote Nexus Standard", 
            logo: "👤", 
            friends: [], 
            socketId: socket.id 
        };
        socket.emit('auth-success', users[data.username]);
        console.log(`✅ Nouveau Pilote : ${data.username} [${id}]`);
    });

    // --- CONNEXION ---
    socket.on('login', (data) => {
        const u = users[data.username];
        if (u && u.password === data.password) {
            u.socketId = socket.id; // Mise à jour du socket actuel
            socket.emit('auth-success', u);
            
            // Envoyer les données (amis et squads)
            sendSyncData(socket, u);
            console.log(`🔑 Connexion établie : ${u.username}`);
        } else {
            socket.emit('auth-error', "Identifiants invalides ou accès refusé.");
        }
    });

    // --- DEMANDE DE SYNCHRONISATION (MANUELLE) ---
    socket.on('get-my-data', (data) => {
        const u = users[data.username];
        if (u) sendSyncData(socket, u);
    });

    // --- MISE À JOUR DU PROFIL ---
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

    // --- SYSTÈME D'AMIS (LOGIQUE BLINDÉE) ---
    socket.on('add-friend', (data) => {
        console.log(`📡 Tentative de liaison : ${data.myId} -> ${data.targetId}`);
        const me = Object.values(users).find(u => u.id === data.myId);
        const target = Object.values(users).find(u => u.id === data.targetId);

        if (target && me && me.id !== target.id) {
            if (!me.friends.includes(target.id)) {
                me.friends.push(target.id);
                target.friends.push(me.id);
                
                // Mettre à jour l'envoyeur
                sendSyncData(socket, me);
                
                // Mettre à jour le destinataire s'il est en ligne
                const targetSocket = io.sockets.sockets.get(target.socketId);
                if (targetSocket) {
                    sendSyncData(targetSocket, target);
                }
                console.log(`🤝 Liaison établie : ${me.username} <-> ${target.username}`);
            }
        } else {
            socket.emit('auth-error', "ID Pilote introuvable ou incorrect.");
        }
    });

    // --- CRÉATION DE SQUAD ---
    socket.on('create-squad', (data) => {
        console.log(`🏗️ Création Squad : ${data.name}`);
        const newSquad = {
            id: "SQD-" + Date.now(),
            name: data.name,
            members: [data.myId],
            channels: [{ id: "c1", name: "général", type: "text" }]
        };
        squads.push(newSquad);
        socket.join(newSquad.id);
        
        const me = Object.values(users).find(u => u.id === data.myId);
        if (me) sendSyncData(socket, me);
    });

    // --- MESSAGERIE ---
    socket.on('join-room', (room) => {
        socket.join(room);
        console.log(`🚪 ${socket.id} a rejoint : ${room}`);
    });
    
    socket.on('send-msg', (data) => {
        const sender = Object.values(users).find(u => u.id === data.senderId);
        if (sender) {
            io.to(data.room).emit('render-msg', { ...data, sender });
        }
    });

    socket.on('disconnect', () => {
        console.log("❌ Signal perdu pour un pilote.");
    });
});

// Fonction utilitaire pour synchroniser les listes
function sendSyncData(targetSocket, userObj) {
    const friendsData = userObj.friends.map(fId => {
        const f = Object.values(users).find(usr => usr.id === fId);
        return f ? { id: f.id, username: f.username, logo: f.logo, color: f.color } : null;
    }).filter(x => x !== null);

    const squadsData = squads.filter(s => s.members.includes(userObj.id));

    targetSocket.emit('sync-data', { 
        friends: friendsData, 
        squads: squadsData 
    });
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log("-----------------------------------------");
    console.log(`🚀 NEXUS V12 ENGINE READY ON PORT ${PORT}`);
    console.log("-----------------------------------------");
});
