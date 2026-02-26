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

io.on('connection', (socket) => {
    console.log('Client connecté:', socket.id);

    // Rejoindre une salle privée
    socket.on('join-private-chat', (roomId) => {
        // On quitte les autres salles (sauf sa propre salle par défaut)
        for (const room of socket.rooms) {
            if (room !== socket.id) socket.leave(room);
        }
        socket.join(roomId);
        console.log(`L'utilisateur ${socket.id} a rejoint : ${roomId}`);
    });

    // Envoyer le message
    socket.on('private-message', (data) => {
        console.log(`Message reçu pour ${data.room}`);
        io.to(data.room).emit('receive-private-message', data);
    });

    socket.on('disconnect', () => {
        console.log('Client déconnecté');
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Serveur prêt sur le port ${PORT}`);
});
