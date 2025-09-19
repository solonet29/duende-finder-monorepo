
document.addEventListener('DOMContentLoaded', () => {
    // =========================================================================
    // 1. CONFIGURACIÓN Y ESTADO
    // =========================================================================
    const config = {
        IS_ENABLED: true,
        API_BASE_URL: 'https://api-v2.afland.es/api',
        CHROME_DOWNLOAD_URL: 'https://www.google.com/chrome/',
        defaultLanguage: 'es-ES',
        avatarPlaceholders: {
            female: 'assets/avatar_mujer.png',
            male: 'assets/avatar_hombre.png'
        },
        knowledgeBase: `
        Información sobre Duende Finder:
        - Propósito: Duende Finder es un asistente inteligente para descubrir eventos de flamenco (conciertos, tablaos, festivales) en todo el mundo.
        - Funcionamiento: Usa IA para recopilar y organizar eventos de fuentes públicas.
        - "Cerca de mí": Muestra eventos próximos a la ubicación del usuario (requiere permisos).
        - "Planear Noche": Función premium con IA en la nube (Gemini) para crear una guía de noche (restaurantes, transporte) alrededor de un evento.
        - Costo: El uso de Duende Finder y su chatbot de ayuda es gratuito. La IA del chatbot se ejecuta localmente en el navegador.
        `,
        intentPrompt: `Clasifica la petición del usuario en una de estas categorías: "event_search", "artist_info", "help_question". Extrae entidades relevantes: para "event_search", extrae "query" (el qué) y "location" (el dónde); para "artist_info", extrae "artistName". Responde únicamente con un objeto JSON minificado. Petición: "{userInput}"`,
        helpSystemPrompt: `Eres "El Duende AI", un asistente de ayuda para el sitio web Duende Finder. Tu personalidad es amable, servicial y con un toque poético flamenco. Responde SIEMPRE en el mismo idioma que el usuario. Tu única fuente de conocimiento es la "Información sobre Duende Finder" que se te proporciona. Si no sabes la respuesta, di amablemente que no tienes esa información. Sé conciso. Información: {knowledgeBase}`
    };

    let state = {
        isChatOpen: false,
        isMuted: localStorage.getItem('chatbotMuted') === 'true',
        intentSession: null, helpSession: null,
        currentLanguage: config.defaultLanguage,
        isListening: false,
        aiMode: 'full', // full, basic, none
        voiceGender: localStorage.getItem('chatbotVoiceGender') || 'female',
        avatar: localStorage.getItem('chatbotAvatar') || config.avatarPlaceholders.female,
        availableVoices: { male: null, female: null }
    };

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    let recognition;

    if (!config.IS_ENABLED) return;

    // =========================================================================
    // 2. CREACIÓN DE LA UI
    // =========================================================================
    const chatbotContainer = document.createElement('div');
    chatbotContainer.id = 'chatbot-container';
    chatbotContainer.classList.add('closed');
    chatbotContainer.innerHTML = `
        <div id="chatbot-header">
            <h3>El Duende AI</h3>
            <div id="chatbot-header-buttons">
                <button id="chatbot-settings-btn" title="Ajustes" style="display: none;">⚙️</button>
                <button id="chatbot-tts-btn" title="Activar/Desactivar Voz">🔈</button>
                <button id="chatbot-toggle-btn">+</button>
            </div>
        </div>
        <div id="chatbot-body" style="display: none;">
            <div id="chatbot-settings-panel" style="display: none;">
                <h4>Ajustes de Voz</h4>
                <div id="voice-selection-buttons"></div>
            </div>
            <div id="chatbot-messages"></div>
            <div id="chatbot-tts-disclaimer" style="display: none;">La voz es generada por tu navegador y su calidad puede variar.</div>
            <form id="chatbot-input-form">
                <input type="text" id="chatbot-input" placeholder="Cargando IA..." autocomplete="off" disabled>
                <button type="button" id="chatbot-mic-btn" title="Hablar">🎤</button>
                <button id="chatbot-send-btn" type="submit" disabled>➤</button>
            </form>
        </div>
    `;
    document.body.appendChild(chatbotContainer);

    const dom = {
        settingsButton: document.getElementById('chatbot-settings-btn'),
        settingsPanel: document.getElementById('chatbot-settings-panel'),
        voiceSelectionButtons: document.getElementById('voice-selection-buttons'),
        header: document.getElementById('chatbot-header'),
        toggleButton: document.getElementById('chatbot-toggle-btn'),
        ttsButton: document.getElementById('chatbot-tts-btn'),
        chatBody: document.getElementById('chatbot-body'),
        messagesContainer: document.getElementById('chatbot-messages'),
        inputForm: document.getElementById('chatbot-input-form'),
        inputField: document.getElementById('chatbot-input'),
        micButton: document.getElementById('chatbot-mic-btn'),
        ttsDisclaimer: document.getElementById('chatbot-tts-disclaimer')
    };

    // =========================================================================
    // 3. LÓGICA DE VOZ Y AVATAR
    // =========================================================================
    const loadAndApplyVoices = () => {
        const voices = window.speechSynthesis.getVoices();
        if (voices.length === 0) return;
        const spanishVoices = voices.filter(v => v.lang.startsWith('es'));
        state.availableVoices.female = spanishVoices.find(v => v.name.includes('Female') || v.name.includes('Mujer') || v.name.includes('Helena') || v.name.includes('Laura')) || null;
        state.availableVoices.male = spanishVoices.find(v => v.name.includes('Male') || v.name.includes('Hombre') || v.name.includes('Pablo')) || null;

        let voiceOptionsHtml = '';
        if (state.availableVoices.female) voiceOptionsHtml += `<button class="voice-btn" data-gender="female">Voz Femenina</button>`;
        if (state.availableVoices.male) voiceOptionsHtml += `<button class="voice-btn" data-gender="male">Voz Masculina</button>`;

        if (state.availableVoices.female && state.availableVoices.male) {
            dom.settingsButton.style.display = 'inline-block';
            dom.voiceSelectionButtons.innerHTML = voiceOptionsHtml;
        } else {
            dom.settingsButton.style.display = 'none';
        }
        updateVoiceSelectionUI();
    };

    const setVoiceGender = (gender) => {
        if (!state.availableVoices[gender]) return;
        state.voiceGender = gender;
        state.avatar = config.avatarPlaceholders[gender];
        localStorage.setItem('chatbotVoiceGender', state.voiceGender);
        localStorage.setItem('chatbotAvatar', state.avatar);
        dom.settingsPanel.style.display = 'none';
        updateVoiceSelectionUI();
    };

    const updateVoiceSelectionUI = () => {
        document.querySelectorAll('.voice-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.gender === state.voiceGender);
        });
    };

    const speak = (text, lang) => {
        if (state.isMuted || !text) return;
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = lang || config.defaultLanguage;
        const selectedVoice = state.availableVoices[state.voiceGender];
        if (selectedVoice) utterance.voice = selectedVoice;
        window.speechSynthesis.speak(utterance);
    };

    // =========================================================================
    // 4. LÓGICA PRINCIPAL Y ORQUESTADOR
    // =========================================================================
    const addMessage = (text, sender, isHtml = false) => {
        const messageElement = document.createElement('div');
        messageElement.classList.add('chatbot-message', `${sender}-message`);
        if (sender === 'ai') {
            const avatarImg = document.createElement('img');
            avatarImg.src = state.avatar;
            avatarImg.className = 'chatbot-avatar';
            messageElement.appendChild(avatarImg);
        }
        const contentElement = document.createElement('div');
        contentElement.className = 'message-content';
        if (isHtml) { contentElement.innerHTML = text; } else { contentElement.textContent = text; }
        messageElement.appendChild(contentElement);
        dom.messagesContainer.appendChild(messageElement);
        dom.messagesContainer.scrollTop = dom.messagesContainer.scrollHeight;
        return contentElement;
    };

    const handleFormSubmit = async (e) => {
        if(e) e.preventDefault();
        const userInput = dom.inputField.value.trim();
        if (!userInput) return;

        addMessage(userInput, 'user');
        dom.inputField.value = '';
        showThinkingIndicator(true);

        if (state.aiMode === 'full') {
            try {
                const intentJson = await state.intentSession.prompt(config.intentPrompt.replace('{userInput}', userInput));
                const intent = JSON.parse(intentJson);
                switch (intent.intent) {
                    case 'event_search': await handleEventSearch(intent.details); break;
                    case 'artist_info': await handleArtistSearch(intent.details); break;
                    default: await handleHelpQuestion(userInput);
                }
            } catch (error) {
                await handleEventSearch({ query: userInput });
            }
        } else if (state.aiMode === 'basic') {
            await handleEventSearch({ query: userInput });
        }
        
        showThinkingIndicator(false);
    };

    async function handleEventSearch(details) {
        const { query, location } = details;
        let url = `${config.API_BASE_URL}/events?limit=5`;
        if (query) url += `&q=${encodeURIComponent(query)}`;
        if (location) url += `&city=${encodeURIComponent(location)}`;
        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error('API de eventos no responde');
            const data = await response.json();
            if (!data.events || data.events.length === 0) {
                addMessage(`No encontré eventos para "${query || ''}${location ? ' en ' + location : ''}".`, 'ai');
                return;
            }
            let html = `He encontrado estos eventos:<ul class="results-list">`;
            data.events.forEach(event => {
                const eventDate = new Date(event.date).toLocaleDateString('es-ES', { day: 'numeric', month: 'long' });
                html += `<li><strong>${event.name}</strong><br><small>${event.city} - ${eventDate}</small></li>`;
            });
            html += `</ul>`;
            addMessage(html, 'ai', true);
        } catch (error) {
            addMessage("Lo siento, no pude conectar con la base de datos de eventos.", 'ai');
        }
    }

    async function handleArtistSearch(details) {
        addMessage(`Actualmente no puedo buscar biografías de artistas, pero es una función que llegará pronto. ¡Qué buen compás tienes!`, 'ai');
    }

    async function handleHelpQuestion(userInput) {
        try {
            const stream = await state.helpSession.promptStreaming(userInput);
            const aiMessageElement = addMessage('', 'ai');
            let fullResponse = '';
            for await (const chunk of stream) {
                fullResponse += chunk;
                aiMessageElement.textContent = fullResponse;
                dom.messagesContainer.scrollTop = dom.messagesContainer.scrollHeight;
            }
            if (!state.isMuted) {
                const langMatch = await state.intentSession.prompt(`Detecta el código de idioma IETF BCP-47 para: "${userInput}"`);
                speak(fullResponse, langMatch.trim());
            }
        } catch (error) {
            addMessage("Mi duende no me responde. Inténtalo de nuevo.", 'ai');
        }
    }

    // =========================================================================
    // 5. INICIALIZACIÓN Y FUNCIONES AUXILIARES
    // =========================================================================
    const initAI = async () => {
        const isChrome = /Chrome/.test(navigator.userAgent) && /Google Inc/.test(navigator.vendor);

        if (typeof window.ai === 'undefined') {
            if (isChrome) {
                state.aiMode = 'basic';
                addMessage("Hola, la IA avanzada no está activa en tu dispositivo, pero puedes usarme para búsquedas simples.", 'ai', true);
                dom.inputField.disabled = false;
                dom.inputField.placeholder = "Busca por evento o artista...";
            } else {
                state.aiMode = 'none';
                const compatibilityMsg = `
                    <p>Para una experiencia completa con IA, te recomiendo usar Google Chrome.</p>
                    <div class="compatibility-buttons">
                        <button id="get-chrome-btn" class="compatibility-btn">Obtener Chrome</button>
                        <button id="continue-without-ai-btn" class="compatibility-btn secondary">Continuar sin Asistente</button>
                    </div>
                `;
                addMessage(compatibilityMsg, 'ai', true);
                dom.inputForm.style.display = 'none';
            }
            return;
        }

        try {
            const canCreate = await window.ai.canCreateTextSession();
            if (canCreate !== "readily") { throw new Error('AI not ready'); }
            
            state.aiMode = 'full';
            state.intentSession = await window.ai.createTextSession();
            state.helpSession = await window.ai.createTextSession({ systemPrompt: config.helpSystemPrompt.replace('{knowledgeBase}', config.knowledgeBase) });

            dom.inputField.disabled = false;
            dom.inputField.placeholder = "Escribe o pulsa el micro...";
            addMessage("¡Hola! Soy El Duende AI. ¿Qué buscamos hoy?", 'ai');
        } catch (error) {
            state.aiMode = 'basic';
            addMessage("Hubo un problema al iniciar la IA. Funcionando en modo básico.", 'ai');
            dom.inputField.disabled = false;
            dom.inputField.placeholder = "Busca por palabra clave...";
        }
    };

    const handleMicClick = () => {
        if (state.aiMode === 'none') return;
        if (state.isListening) {
            recognition.stop();
            return;
        }
        if (state.isMuted) { toggleMute(); }

        recognition = new SpeechRecognition();
        recognition.lang = state.currentLanguage;
        recognition.interimResults = false;

        recognition.onstart = () => { state.isListening = true; dom.micButton.classList.add('listening'); };
        recognition.onend = () => { state.isListening = false; dom.micButton.classList.remove('listening'); };
        recognition.onresult = (event) => {
            dom.inputField.value = event.results[0][0].transcript;
            handleFormSubmit();
        };
        recognition.onerror = (event) => { console.error("Error de reconocimiento de voz:", event.error); };
        recognition.start();
    };

    let thinkingIndicator;
    const showThinkingIndicator = (show) => {
        if (show && !thinkingIndicator) {
            thinkingIndicator = addMessage("", 'ai');
            thinkingIndicator.parentElement.classList.add('thinking');
            thinkingIndicator.innerHTML = `<span>.</span><span>.</span><span>.</span>`;
        } else if (!show && thinkingIndicator) {
            thinkingIndicator.parentElement.remove();
            thinkingIndicator = null;
        }
    };

    const toggleChatbot = (e) => {
        if (e && (e.target.id === 'chatbot-tts-btn' || e.target.id === 'chatbot-settings-btn')) { e.stopPropagation(); return; }
        state.isChatOpen = !state.isChatOpen;
        chatbotContainer.classList.toggle('closed', !state.isChatOpen);
        dom.chatBody.style.display = state.isChatOpen ? 'flex' : 'none';
        dom.toggleButton.textContent = state.isChatOpen ? '_' : '+';
        if (state.isChatOpen && dom.messagesContainer.children.length === 0) initAI();
    };

    const toggleMute = () => {
        state.isMuted = !state.isMuted;
        localStorage.setItem('chatbotMuted', state.isMuted);
        dom.ttsButton.textContent = state.isMuted ? '🔈' : '🔊';
        if (!state.isMuted && localStorage.getItem('chatbotTtsDisclaimerShown') !== 'true') {
            dom.ttsDisclaimer.style.display = 'block';
            setTimeout(() => { dom.ttsDisclaimer.style.display = 'none'; }, 4000);
            localStorage.setItem('chatbotTtsDisclaimerShown', 'true');
        }
    };

    // =========================================================================
    // 6. EVENT LISTENERS
    // =========================================================================
    if (!SpeechRecognition) {
        dom.micButton.style.display = 'none';
    }
    if (window.speechSynthesis.onvoiceschanged !== undefined) {
        window.speechSynthesis.onvoiceschanged = loadAndApplyVoices;
    }
    loadAndApplyVoices();

    dom.header.addEventListener('click', toggleChatbot);
    dom.toggleButton.addEventListener('click', toggleChatbot);
    dom.ttsButton.addEventListener('click', toggleMute);
    dom.micButton.addEventListener('click', handleMicClick);
    dom.inputForm.addEventListener('submit', handleFormSubmit);
    dom.settingsButton.addEventListener('click', () => {
        dom.settingsPanel.style.display = dom.settingsPanel.style.display === 'none' ? 'block' : 'none';
    });
    dom.voiceSelectionButtons.addEventListener('click', (e) => {
        if (e.target.classList.contains('voice-btn')) {
            setVoiceGender(e.target.dataset.gender);
        }
    });
    dom.messagesContainer.addEventListener('click', (e) => {
        if (e.target.id === 'get-chrome-btn') {
            window.open(config.CHROME_DOWNLOAD_URL, '_blank');
        }
        if (e.target.id === 'continue-without-ai-btn') {
            toggleChatbot();
        }
    });

    dom.ttsButton.textContent = state.isMuted ? '🔈' : '🔊';
});
