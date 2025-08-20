document.addEventListener('DOMContentLoaded', () => {
    // --- MODO EN CONSTRUCCIÓN ---
    const IS_UNDER_CONSTRUCTION = true;

    // --- 1. Crear y Añadir los Elementos del Chatbot al DOM ---
    const chatbotContainer = document.createElement('div');
    chatbotContainer.id = 'chatbot-container';
    chatbotContainer.classList.add('closed'); // Empieza cerrado

    const title = IS_UNDER_CONSTRUCTION ? "Chatbot (Próximamente)" : "El Duende AI";

    chatbotContainer.innerHTML = `
        <div id="chatbot-header">
            <h3>${title}</h3>
            <button id="chatbot-toggle-btn">+</button>
        </div>
        <div id="chatbot-body" style="display: none;">
            <div id="chatbot-messages"></div>
            <form id="chatbot-input-form">
                <input type="text" id="chatbot-input" placeholder="Función no disponible..." autocomplete="off" disabled>
                <button id="chatbot-send-btn" type="submit" disabled>➤</button>
            </form>
        </div>
    `;

    document.body.appendChild(chatbotContainer);

    // --- 2. Obtener Referencias a los Elementos del DOM ---
    const header = document.getElementById('chatbot-header');
    const toggleButton = document.getElementById('chatbot-toggle-btn');
    const chatBody = document.getElementById('chatbot-body');
    const messagesContainer = document.getElementById('chatbot-messages');
    const inputForm = document.getElementById('chatbot-input-form');

    // --- 3. Lógica para Abrir y Cerrar el Chat ---
    const toggleChatbot = () => {
        const isClosed = chatbotContainer.classList.contains('closed');
        if (isClosed) {
            chatbotContainer.classList.remove('closed');
            chatBody.style.display = 'flex';
            chatBody.style.flexDirection = 'column';
            toggleButton.textContent = '_';
            // Añadir mensaje de construcción si no existe ya
            if (IS_UNDER_CONSTRUCTION && messagesContainer.children.length === 0) {
                addMessage('Esta función estará disponible muy pronto. ¡Gracias por tu paciencia!', 'ai');
            }
        } else {
            chatbotContainer.classList.add('closed');
            chatBody.style.display = 'none';
            toggleButton.textContent = '+';
        }
    };

    header.addEventListener('click', toggleChatbot);

    // --- 4. Función para Añadir Mensajes a la UI ---
    const addMessage = (text, sender) => {
        const messageElement = document.createElement('div');
        messageElement.classList.add('chatbot-message', `${sender}-message`);
        messageElement.textContent = text;
        messagesContainer.appendChild(messageElement);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    };

    // --- 5. Deshabilitar formulario si está en construcción ---
    if (IS_UNDER_CONSTRUCTION) {
        inputForm.addEventListener('submit', (e) => e.preventDefault());
    } else {
        // Aquí iría la lógica original del chatbot
    }
});