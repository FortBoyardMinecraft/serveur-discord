const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

let users = {};  
let squads = [];

io.on('connection', (socket) => {

    const syncUser = (u) => {
        if (!u) return;

        // 1. Filtrer les amis
        const friends = Object.values(users).filter(f => u.friends.includes(f.id));
        
        // 2. Filtrer les squads
        const mySquads = squads.filter(s => s.members.includes(u.id));

        // 3. Calculer les personnes visibles (Membres des mêmes squads + Amis)
        let visibleIds = new Set(u.friends);
        mySquads.forEach(s => s.members.forEach(mId => visibleIds.add(mId)));
        
        const visibleUsers = Object.values(users)
            .filter(usr => visibleIds.has(usr.id))
            .map(usr => ({
                id: usr.id, username: usr.username, logo: usr.logo, 
                color: usr.color, status: usr.status
            }));

        socket.emit('nexus-sync', {
            me: u,
            friends: friends.map(f => ({id:f.id, username:f.username, logo:f.logo, color:f.color, status:f.status})),
            squads: mySquads,
            visibleUsers: visibleUsers
        });
    };

    socket.on('register', (data) => {
        const id = "PLT-" + Math.floor(1000 + Math.random() * 9000);
        users[data.username] = { 
            id, ...data, color: "#00f2ff", logo: "👤", 
            friends: [], socketId: socket.id, status: "online" 
        };
        syncUser(users[data.username]);
        io.emit('refresh-all'); 
    });

    socket.on('login', (data) => {
        const u = users[data.username];
        if (u && u.password === data.password) {
            u.socketId = socket.id;
            u.status = "online";
            syncUser(u);
            io.emit('refresh-all');
        } else {
            socket.emit('error', "Accès refusé.");
        }
    });

    socket.on('add-friend', ({myId, targetId}) => {
        const me = Object.values(users).find(u => u.id === myId);
        const target = Object.values(users).find(u => u.id === targetId);
        if(me && target && me.id !== target.id) {
            if(!me.friends.includes(target.id)) {
                me.friends.push(target.id);
                target.friends.push(me.id);
                io.emit('refresh-all');
            }
        }
    });

    socket.on('create-squad', ({name, myId}) => {
        const sId = "SQ-" + Date.now();
        squads.push({
            id: sId, name, owner: myId, members: [myId],
            channels: [{id: 'ch-1', name: 'général'}]
        });
        io.emit('refresh-all');
    });

    socket.on('join-squad', ({squadId, myId}) => {
        const squad = squads.find(s => s.id === squadId);
        if(squad && !squad.members.includes(myId)) {
            squad.members.push(myId);
            io.emit('refresh-all');
        }
    });

    socket.on('send-msg', (data) => {
        const sender = Object.values(users).find(u => u.id === data.senderId);
        if(!sender) return;
        io.to(data.room).emit('new-msg', {
            id: "M-"+Date.now(),
            ...data,
            sender: { username: sender.username, color: sender.color, logo: sender.logo },
            time: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})
        });
    });

    socket.on('join-room', (room) => socket.join(room));

    socket.on('refresh-all', () => {
        Object.values(users).forEach(u => {
            const s = io.sockets.sockets.get(u.socketId);
            if(s) syncUser(u);
        });
    });

    socket.on('disconnect', () => {
        const u = Object.values(users).find(usr => usr.socketId === socket.id);
        if(u) {
            u.status = "offline";
            io.emit('refresh-all');
        }
    });
});

server.listen(3000, () => console.log("🚀 NEXUS V14 CORE (PRIVATE MODE)"));
