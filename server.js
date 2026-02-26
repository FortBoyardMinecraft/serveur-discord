const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

let users = []; 

io.on('connection', (socket) => {
    socket.on('register', (data) => {
        const newUser = { id: Math.random().toString(36).substring(2, 9), username: data.username, password: data.password, socketId: socket.id };
        users.push(newUser);
        socket.emit('auth-success', { id: newUser.id, username: newUser.username });
    });

    socket.on('login', (data) => {
        const user = users.find(u => u.username === data.username && u.password === data.password);
        if (user) { 
            user.socketId = socket.id;
            socket.emit('auth-success', { id: user.id, username: user.username });
        }
    });

    socket.on('join-room', (roomId) => { socket.join(roomId); });

    // --- MESSAGERIE AVANCÉE ---
    socket.on('send-chat-message', (data) => {
        // data contient maintenant : type ('text', 'poll', 'stream'), senderName, room, etc.
        io.to(data.room).emit('receive-chat-message', data);
        
        // Notification globale pour ceux qui ne sont pas dans la room
        socket.broadcast.emit('global-notify', {
            from: data.user,
            room: data.room,
            isGroup: data.isGroup,
            text: data.text
        });
    });

    // --- SYSTÈME DE VOTE ---
    socket.on('cast-vote', (data) => {
        io.to(data.room).emit('update-poll', data);
    });

    socket.on('disconnect', () => { console.log('Déconnexion'); });
});

server.listen(process.env.PORT || 3000, () => console.log("Nexus V3 Online"));
