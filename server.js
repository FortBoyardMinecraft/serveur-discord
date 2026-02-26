const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

let users = []; // {id, username, password, socketId, friends:[]}
let squads = []; // {id, name, owner, members:[], channels:[]}

io.on('connection', (socket) => {
    // --- AUTHENTIFICATION ---
    socket.on('register', (data) => {
        const id = "PLT-" + Math.floor(1000 + Math.random() * 9000);
        const newUser = { id, username: data.username, password: data.password, socketId: socket.id, friends: [] };
        users.push(newUser);
        socket.emit('auth-success', { id, username: data.username });
    });

    socket.on('login', (data) => {
        const user = users.find(u => u.username === data.username && u.password === data.password);
        if (user) {
            user.socketId = socket.id;
            socket.emit('auth-success', { id: user.id, username: user.username });
            // Envoyer ses données au réveil
            socket.emit('sync-data', { 
                friends: users.filter(u => user.friends.includes(u.id)),
                squads: squads.filter(s => s.members.includes(user.id))
            });
        } else { socket.emit('auth-error', "Identifiants invalides"); }
    });

    // --- SYSTÈME D'AMIS ---
    socket.on('add-friend', (data) => {
        const me = users.find(u => u.id === data.myId);
        const target = users.find(u => u.id === data.targetId);
        if (target && me && !me.friends.includes(target.id)) {
            me.friends.push(target.id);
            target.friends.push(me.id);
            socket.emit('update-list', { type: 'friends', data: users.filter(u => me.friends.includes(u.id)) });
            io.to(target.socketId).emit('update-list', { type: 'friends', data: users.filter(u => target.friends.includes(u.id)) });
        }
    });

    // --- SYSTÈME DE SQUAD ---
    socket.on('create-squad', (data) => {
        const newSquad = {
            id: "SQD-" + Date.now(),
            name: data.name,
            owner: data.myId,
            members: [data.myId],
            channels: [{ id: "c1", name: "général", type: "text", messages: [] }]
        };
        squads.push(newSquad);
        socket.join(newSquad.id);
        socket.emit('update-list', { type: 'squads', data: squads.filter(s => s.members.includes(data.myId)) });
    });

    socket.on('invite-to-squad', (data) => {
        const squad = squads.find(s => s.id === data.squadId);
        const target = users.find(u => u.id === data.targetId);
        if (squad && target) {
            squad.members.push(target.id);
            io.to(target.socketId).emit('update-list', { type: 'squads', data: squads.filter(s => s.members.includes(target.id)) });
        }
    });

    // --- CHAT & SALONS ---
    socket.on('join-room', (room) => { socket.join(room); });

    socket.on('send-msg', (data) => {
        io.to(data.room).emit('render-msg', data);
    });

    socket.on('add-chan', (data) => {
        const squad = squads.find(s => s.id === data.squadId);
        if (squad) {
            squad.channels.push({ id: "c"+Date.now(), name: data.name, type: data.type, messages: [] });
            io.to(squad.id).emit('squad-refresh', squad);
        }
    });
});
server.listen(3000);
