const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

// Simulation de base de données (À remplacer par Supabase pour du permanent)
let users = []; 

io.on('connection', (socket) => {
    console.log('Nouveau client:', socket.id);

    // --- INSCRIPTION ---
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

    // --- CONNEXION ---
    socket.on('login', (data) => {
        const user = users.find(u => u.username === data.username && u.password === data.password);
        if (user) {
            socket.emit('auth-success', { id: user.id, username: user.username });
        } else {
            socket.emit('auth-error', 'Identifiants incorrects.');
        }
    });

    // --- MESSAGERIE PRIVÉE ---
    socket.on('join-private-chat', (roomId) => {
        socket.join(roomId);
    });

    socket.on('private-message', (data) => {
        // Envoie à tous ceux dans la room (le sender + le destinataire)
        io.to(data.room).emit('receive-private-message', data);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Serveur sur port ${PORT}`));
