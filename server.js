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

io.on('connection', (socket) => {
    console.log('Nouvelle connexion d’un ami ! ID:', socket.id);

    // Écouter quand quelqu'un envoie un message
    socket.on('send-message', (data) => {
        console.log('Message reçu:', data);
        // On renvoie le message à TOUT LE MONDE (y compris l'envoyeur)
        io.emit('receive-message', {
            user: data.user,
            text: data.text,
            time: new Date().toLocaleTimeString()
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
