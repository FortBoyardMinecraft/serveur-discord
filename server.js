const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

// Simulation de base de données (en mémoire)
let users = []; 

io.on('connection', (socket) => {
    console.log('Nouveau client connecté:', socket.id);

    // --- AUTHENTIFICATION ---
    socket.on('register', (data) => {
        const existing = users.find(u => u.username === data.username);
        if (existing) {
            socket.emit('auth-error', 'Ce pseudo est déjà pris.');
        } else {
            const newUser = { 
                id: Math.random().toString(36).substring(2, 9), 
                username: data.username, 
                password: data.password 
            };
            users.push(newUser);
            socket.emit('auth-success', { id: newUser.id, username: newUser.username });
        }
    });

    socket.on('login', (data) => {
        const user = users.find(u => u.username === data.username && u.password === data.password);
        if (user) {
            socket.emit('auth-success', { id: user.id, username: user.username });
        } else {
            socket.emit('auth-error', 'Identifiants incorrects.');
        }
    });

    // --- GESTION DES SALONS (PRIVÉS ET GROUPES) ---
    socket.on('join-room', (roomId) => {
        socket.join(roomId);
        console.log(`Socket ${socket.id} a rejoint : ${roomId}`);
    });

    // --- ENVOI DE MESSAGE (UNIFIÉ) ---
    socket.on('send-chat-message', (data) => {
        // data contient : { room, user, text, senderId, avatar, banner, status }
        io.to(data.room).emit('receive-chat-message', data);
    });

    socket.on('disconnect', () => {
        console.log('Client déconnecté');
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Serveur démarré sur le port ${PORT}`));
