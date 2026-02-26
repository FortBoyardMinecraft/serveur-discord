const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// Stockage temporaire des utilisateurs (en mémoire)
let users = []; 

io.on('connection', (socket) => {
    console.log('Connexion détectée:', socket.id);

    // --- INSCRIPTION ---
    socket.on('register', (data) => {
        const existing = users.find(u => u.username === data.username);
        if (existing) {
            socket.emit('auth-error', 'Ce pseudo est déjà utilisé.');
        } else {
            const newUser = { 
                id: Math.random().toString(36).substring(2, 9), 
                username: data.username, 
                password: data.password,
                socketId: socket.id 
            };
            users.push(newUser);
            console.log('Nouvel utilisateur créé:', newUser.username);
            socket.emit('auth-success', { id: newUser.id, username: newUser.username });
        }
    });

    // --- CONNEXION ---
    socket.on('login', (data) => {
        const user = users.find(u => u.username === data.username && u.password === data.password);
        if (user) { 
            user.socketId = socket.id; // Mise à jour du socket actuel
            socket.emit('auth-success', { id: user.id, username: user.username });
            console.log(user.username, 's\'est connecté.');
        } else { 
            socket.emit('auth-error', 'Identifiants incorrects.'); 
        }
    });

    // --- GESTION DES SALONS ---
    socket.on('join-room', (roomId) => {
        socket.join(roomId);
        console.log(`Socket ${socket.id} a rejoint la room: ${roomId}`);
    });

    // --- INVITATIONS DE GROUPE ---
    socket.on('invite-to-group', (data) => {
        // data: { groupName, targetId, creator }
        const target = users.find(u => u.id === data.targetId);
        if (target && target.socketId) {
            io.to(target.socketId).emit('group-invitation', data);
            console.log(`Invitation envoyée de ${data.creator} vers ${target.username}`);
        }
    });

    // --- MESSAGERIE ---
    socket.on('send-chat-message', (data) => {
        // data contient: room, user, text, senderId, avatar, status, banner
        io.to(data.room).emit('receive-chat-message', data);
    });

    socket.on('disconnect', () => {
        console.log('Un client s\'est déconnecté');
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`>>> SERVEUR NEXUS LIVE SUR LE PORT ${PORT}`);
});
