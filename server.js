const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);

const io = new Server(server,{
    cors:{ origin:"*" }
});

/* ================= STORAGE ================= */

const users = new Map();      // username -> user
const squads = new Map();     // squadId -> squad

/* ================= UTILS ================= */

const genPilotId = () =>
    "PLT-" + Math.floor(1000 + Math.random()*9000);

const genSquadId = () =>
    "SQ-" + Math.floor(Math.random()*100000);

const timeNow = () =>
    new Date().toLocaleTimeString([],{
        hour:"2-digit",
        minute:"2-digit"
    });

function getUserById(id){
    return [...users.values()].find(u=>u.id===id);
}

function getUserBySocket(socketId){
    return [...users.values()].find(u=>u.socketId===socketId);
}

/* ================= SYNC ================= */

function syncUser(socket,user){

    if(!user) return;

    const mySquads = [...squads.values()]
        .filter(s=>s.members.includes(user.id));

    const visibleIds = new Set(user.friends);

    mySquads.forEach(s=>
        s.members.forEach(id=>visibleIds.add(id))
    );

    const visibleUsers = [...users.values()]
        .filter(u=>visibleIds.has(u.id) || u.id===user.id)
        .map(u=>({
            id:u.id,
            username:u.username,
            logo:u.logo,
            color:u.color,
            status:u.status
        }));

    socket.emit("nexus-sync",{
        me:user,
        friends:[...users.values()].filter(u=>user.friends.includes(u.id)),
        squads:mySquads,
        visibleUsers
    });
}

function refreshAll(){
    for(const user of users.values()){
        const sock = io.sockets.sockets.get(user.socketId);
        if(sock) syncUser(sock,user);
    }
}

/* ================= CONNECTION ================= */

io.on("connection", socket=>{

/* ===== REGISTER ===== */

socket.on("register", ({username,password})=>{

    if(users.has(username))
        return socket.emit("error","Nom déjà utilisé.");

    const user={
        id:genPilotId(),
        username,
        password,
        color:"#00f2ff",
        logo:"👤",
        friends:[],
        socketId:socket.id,
        status:"online"
    };

    users.set(username,user);
    syncUser(socket,user);
    refreshAll();
});

/* ===== LOGIN ===== */

socket.on("login", ({username,password})=>{
    const user = users.get(username);

    if(!user || user.password!==password)
        return socket.emit("error","Identifiants invalides.");

    user.socketId = socket.id;
    user.status="online";

    syncUser(socket,user);
    refreshAll();
});

/* ===== FRIEND ===== */

socket.on("add-friend",({myId,targetId})=>{

    const me = getUserById(myId);
    const target = getUserById(targetId);

    if(!me || !target) return;
    if(me.id===target.id) return;
    if(me.friends.includes(target.id)) return;

    me.friends.push(target.id);
    target.friends.push(me.id);

    refreshAll();
});

/* ===== SQUAD ===== */

socket.on("create-squad",({name,myId})=>{

    const id = genSquadId();

    squads.set(id,{
        id,
        name,
        owner:myId,
        members:[myId],
        channels:[{id:"ch-1",name:"général"}]
    });

    refreshAll();
});

socket.on("join-squad",({squadId,myId})=>{
    const squad = squads.get(squadId);
    if(!squad) return;

    if(!squad.members.includes(myId))
        squad.members.push(myId);

    refreshAll();
});

/* ===== CHAT ===== */

socket.on("join-room", room=>{
    socket.join(room);
});

socket.on("send-msg", data=>{

    const sender = getUserById(data.senderId);
    if(!sender) return;

    io.to(data.room).emit("new-msg",{
        id:"M-"+Date.now(),
        room:data.room,
        text:data.text,
        time:timeNow(),
        sender:{
            username:sender.username,
            color:sender.color,
            logo:sender.logo
        }
    });
});

/* ===== DISCONNECT ===== */

socket.on("disconnect",()=>{
    const user = getUserBySocket(socket.id);
    if(!user) return;
    user.status="offline";
    refreshAll();
});

});

/* ================= START ================= */

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log("🚀 NEXUS CORE ONLINE on port", PORT);
});
