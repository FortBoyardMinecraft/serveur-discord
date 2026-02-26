const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);

// Configuration de Socket.io pour autoriser les connexions externes
const io = new Server(server, {
    cors: {
        origin: "*", // Permet à ton app Chromium de se connecter
        methods: ["GET", "POST"]
    }
});

// server.js
io.on('connection', (socket) => {
    console.log('Client connecté:', socket.id);

    // Étape 1 : Rejoindre la salle de discussion
    socket.on('join-private-chat', (roomId) => {
        // On quitte les anciennes salles pour ne pas recevoir les messages des autres
        socket.rooms.forEach(room => {
            if (room !== socket.id) socket.leave(room);
        });
        
        socket.join(roomId);
        console.log(`Socket ${socket.id} a rejoint la room : ${roomId}`);
    });

    // Étape 2 : Envoyer le message à la salle
    socket.on('private-message', (data) => {
        console.log(`Message pour la room ${data.room}: ${data.text}`);
        // "io.to(data.room)" envoie à tout le monde dans la salle
        io.to(data.room).emit('receive-private-message', data);
    });
});
    
    socket.on('disconnect', () => {
        console.log('Un ami s’est déconnecté.');
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Serveur prêt sur le port ${PORT}`);
});
