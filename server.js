const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

let users = []; // En mémoire (À lier à Supabase pour le permanent)

io.on('connection', (socket) => {
    // --- AUTH ---
    socket.on('register', (data) => {
        const id = Math.random().toString(36).substring(2, 9);
        users.push({ id, ...data, socketId: socket.id });
        socket.emit('auth-success', { id, username: data.username });
    });

    socket.on('login', (data) => {
        const user = users.find(u => u.username === data.username && u.password === data.password);
        if (user) { 
            user.socketId = socket.id;
            socket.emit('auth-success', { id: user.id, username: user.username });
        } else { socket.emit('auth-error', 'Erreur identifiants'); }
    });

    // --- GROUPES & INVITATIONS ---
    socket.on('join-room', (roomId) => { socket.join(roomId); });

    socket.on('invite-to-group', (data) => {
        // data: { groupName, targetId, creatorName }
        const target = users.find(u => u.id === data.targetId);
        if (target) {
            io.to(target.socketId).emit('group-invitation', data);
        }
    });

    // --- MESSAGERIE ---
    socket.on('send-chat-message', (data) => {
        // Envoie à tout le monde dans la room
        io.to(data.room).emit('receive-chat-message', data);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Serveur Gamer prêt sur ${PORT}`));
