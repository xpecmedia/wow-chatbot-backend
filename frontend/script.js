// --- Éléments du DOM ---
const launcher = document.getElementById('chat-launcher');
const chatHeader = document.getElementById('chat-header');
const ctaBubble = document.getElementById('cta-bubble');
const form = document.getElementById('chat-form');
const input = document.getElementById('message-input');
const messages = document.getElementById('message-list');

// --- Logique d'état centralisée ---
function toggleChat(forceState) {
    const isOpen = document.body.classList.contains('chat-open');

    if (forceState === 'open' && !isOpen) {
        document.body.classList.add('chat-open');
    } else if (forceState === 'close' && isOpen) {
        document.body.classList.remove('chat-open');
    } else if (!forceState) {
        document.body.classList.toggle('chat-open');
    }
}

// --- Écouteurs d'événements ---
launcher.addEventListener('click', () => toggleChat());
chatHeader.addEventListener('click', () => toggleChat('close'));

// Animation au chargement de la page
window.addEventListener('load', () => {
    setTimeout(() => {
        if (!document.body.classList.contains('chat-open')) {
            ctaBubble.classList.remove('hidden');
        }
    }, 3000);
});

// --- Logique du Chat (inchangée) ---
const socket = io('https://wow-chatbot-backend.onrender.com');
socket.on('connect', () => console.log('Connecté au serveur backend !'));

function addMessage(content, type) {
    const li = document.createElement('li');
    li.classList.add('message', type);
    li.innerHTML = content;
    messages.appendChild(li);
    messages.scrollTop = messages.scrollHeight;
    return li;
}

addMessage("Bonjour. Bienvenue sur l'espace dédié à votre demande d'audit gratuit. Je suis à votre disposition pour répondre à vos questions et vous accompagner dans votre démarche.", 'bot');

let responseTimeout;

form.addEventListener('submit', function(event) {
    event.preventDefault();
    const messageText = input.value.trim();
    if (messageText === '') return;

    addMessage(messageText, 'user');
    socket.emit('user message', messageText);
    input.value = '';
    showTypingIndicator();

    clearTimeout(responseTimeout);
    responseTimeout = setTimeout(() => {
        if (typingIndicatorElement) {
            hideTypingIndicator();
            addMessage("Le serveur de démonstration est en train de sortir de veille (cela peut prendre jusqu'à 60 secondes). Merci de votre patience !", 'bot');
            showTypingIndicator();
        }
    }, 12000);
});

socket.on('bot message', (msg) => {
    clearTimeout(responseTimeout);
    hideTypingIndicator();
    addMessage(msg, 'bot');
});

let typingIndicatorElement = null;
function showTypingIndicator() {
    if (typingIndicatorElement) return;
    const indicatorHTML = `<div class="typing-indicator"><span></span><span></span><span></span></div>`;
    typingIndicatorElement = addMessage(indicatorHTML, 'bot');
}
function hideTypingIndicator() {
    if (typingIndicatorElement) {
        messages.removeChild(typingIndicatorElement);
        typingIndicatorElement = null;
    }
}
