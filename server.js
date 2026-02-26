const socket = io('https://serveur-discord.onrender.com'); // VERIFIE TON URL
let myId, myUsername, currentRoom, activeTab = 'friend';
let myProfile = { avatar: '', status: 'Active Duty', banner: '#66fcf1' };

// --- 1. AUTHENTIFICATION ---
function auth(type) {
    const u = document.getElementById('user-in').value;
    const p = document.getElementById('pass-in').value;
    if (u && p) {
        socket.emit(type, { username: u, password: p });
    }
}

socket.on('auth-success', d => {
    myId = d.id;
    myUsername = d.username;
    document.getElementById('my-name').innerText = myUsername;
    document.getElementById('my-id').innerText = "PILOT ID: " + myId;
    document.getElementById('auth-screen').style.display = 'none';

    // Charger le profil sauvegardé localement
    const saved = localStorage.getItem('profile_' + myId);
    if (saved) {
        myProfile = JSON.parse(saved);
        document.getElementById('p-avatar').value = myProfile.avatar || "";
        document.getElementById('p-status').value = myProfile.status || "";
        document.getElementById('p-banner').value = myProfile.banner || "#66fcf1";
    }
    
    // Rejoindre automatiquement toutes les salles déjà enregistrées (Amis et Groupes)
    ['friend', 'group'].forEach(type => {
        let items = JSON.parse(localStorage.getItem('nexus_' + type + '_' + myId)) || [];
        items.forEach(item => socket.emit('join-room', item.id));
    });

    renderSidebar();
});

socket.on('auth-error', (msg) => {
    document.getElementById('auth-err').innerText = msg;
});

// --- 2. GESTION DU PROFIL ---
function saveProfile() {
    myProfile = {
        avatar: document.getElementById('p-avatar').value || `https://api.dicebear.com/7.x/bottts/svg?seed=${myUsername}`,
        status: document.getElementById('p-status').value || 'In Mission',
        banner: document.getElementById('p-banner').value
    };
    localStorage.setItem('profile_' + myId, JSON.stringify(myProfile));
    alert("SYSTEM UPDATED");
}

// --- 3. NAVIGATION & UI ---
function switchTab(t) {
    activeTab = t;
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    if (event) event.target.classList.add('active');
    renderSidebar();
}

function openModal(id) { document.getElementById(id).style.display = 'flex'; }
function closeModals() { document.querySelectorAll('.modal').forEach(m => m.style.display = 'none'); }

// --- 4. AMIS & GROUPES ---
function addFriend() {
    const targetId = document.getElementById('friend-id-in').value.trim();
    if (!targetId || targetId === myId) return;

    // L'ID de salle est unique et trié pour être identique chez les deux pilotes
    const roomId = [myId, targetId].sort().join('-');
    
    saveItem('friend', { id: roomId, name: 'Pilot: ' + targetId, unread: false, targetId: targetId });
    socket.emit('join-room', roomId);
    
    closeModals();
    renderSidebar();
}

function createGroup() {
    const name = document.getElementById('group-name-in').value.trim();
    const invite = document.getElementById('invite-id-in').value.trim();
    if (!name) return;

    saveItem('group', { id: name, name: 'Squad: ' + name, unread: false });
    socket.emit('join-room', name);
    
    if (invite) {
        socket.emit('invite-to-group', { groupName: name, targetId: invite, creator: myUsername });
    }
    closeModals();
    renderSidebar();
}

socket.on('group-invitation', d => {
    saveItem('group', { id: d.groupName, name: 'Squad: ' + d.groupName, unread: true });
    socket.emit('join-room', d.groupName);
    renderSidebar();
});

function renderSidebar() {
    const list = document.getElementById('items-list');
    list.innerHTML = "";
    let data = JSON.parse(localStorage.getItem('nexus_' + activeTab + '_' + myId)) || [];
    
    data.forEach(item => {
        const div = document.createElement('div');
        div.className = 'item';
        div.innerHTML = `<span>${item.name}</span> ${item.unread ? '<div class="dot"></div>' : ''}`;
        div.onclick = () => openChat(item);
        list.appendChild(div);
    });
}

// --- 5. CHAT ENGINE ---
function openChat(item) {
    currentRoom = item.id;
    item.unread = false;
    updateItem(activeTab, item);
    
    socket.emit('join-room', currentRoom);
    document.getElementById('messages').innerHTML = "";
    
    // Charger l'historique local
    const history = JSON.parse(localStorage.getItem('hist_' + currentRoom)) || [];
    history.forEach(displayMsg);
    renderSidebar();
}

function sendMessage() {
    const txt = document.getElementById('msg-input').value.trim();
    if (!txt || !currentRoom) return;

    const data = { 
        room: currentRoom, 
        user: myUsername, 
        text: txt, 
        senderId: myId,
        avatar: myProfile.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${myUsername}`, 
        status: myProfile.status, 
        banner: myProfile.banner
    };
    
    socket.emit('send-chat-message', data);
    document.getElementById('msg-input').value = "";
}

// Écouteur pour la touche Entrée sur l'input
document.getElementById('msg-input').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendMessage();
});

socket.on('receive-chat-message', d => {
    // 1. Sauvegarder dans l'historique local
    let hist = JSON.parse(localStorage.getItem('hist_' + d.room)) || [];
    hist.push(d);
    localStorage.setItem('hist_' + d.room, JSON.stringify(hist));

    // 2. Détection automatique pour les nouveaux messages privés (si pas dans la liste)
    if (d.room.includes(myId) && d.senderId !== myId) {
        let friends = JSON.parse(localStorage.getItem('nexus_friend_' + myId)) || [];
        if (!friends.find(f => f.id === d.room)) {
            saveItem('friend', { id: d.room, name: 'Pilot: ' + d.senderId, unread: true, targetId: d.senderId });
            socket.emit('join-room', d.room);
            renderSidebar();
        }
    }

    // 3. Affichage ou point jaune
    if (d.room === currentRoom) {
        displayMsg(d);
    } else {
        markAsUnread(d);
    }
});

function displayMsg(d) {
    const isMe = d.senderId === myId;
    const div = document.createElement('div');
    div.className = 'msg-container ' + (isMe ? 'me' : '');
    div.innerHTML = `
        <img src="${d.avatar}" class="msg-avatar" style="border-color:${d.banner}">
        <div class="msg-bubble">
            <div class="msg-user">${d.user} <span class="msg-status">[${d.status}]</span></div>
            <div class="msg-text">${d.text}</div>
        </div>
    `;
    const msgBox = document.getElementById('messages');
    msgBox.appendChild(div);
    msgBox.scrollTop = msgBox.scrollHeight;
}

// --- 6. HELPERS PERSISTANCE ---
function saveItem(type, obj) {
    let items = JSON.parse(localStorage.getItem('nexus_' + type + '_' + myId)) || [];
    if (!items.find(i => i.id === obj.id)) {
        items.push(obj);
        localStorage.setItem('nexus_' + type + '_' + myId, JSON.stringify(items));
    }
}

function updateItem(type, obj) {
    let items = JSON.parse(localStorage.getItem('nexus_' + type + '_' + myId)) || [];
    items = items.map(i => i.id === obj.id ? obj : i);
    localStorage.setItem('nexus_' + type + '_' + myId, JSON.stringify(items));
}

function markAsUnread(d) {
    ['friend', 'group'].forEach(type => {
        let items = JSON.parse(localStorage.getItem('nexus_' + type + '_' + myId)) || [];
        // On cherche le salon correspondant au message reçu
        let item = items.find(i => i.id === d.room);
        if (item) {
            item.unread = true;
            localStorage.setItem('nexus_' + type + '_' + myId, JSON.stringify(items));
            if (activeTab === type) renderSidebar();
        }
    });
}
