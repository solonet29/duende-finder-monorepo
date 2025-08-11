document.addEventListener('DOMContentLoaded', () => {
    // CAMBIO 1: La URL de la API ahora es flexible para poder hacer pruebas fácilmente.
    const API_BASE_URL = localStorage.getItem('apiUrl') || 'https://duende-api-next.vercel.app';

    const resultsContainer = document.getElementById('resultsContainer');
    const skeletonContainer = document.getElementById('skeleton-container');
    const statusMessage = document.getElementById('statusMessage');
    const totalEventsSpan = document.getElementById('total-events');
    const searchForm = document.getElementById('search-form');
    const searchInput = document.getElementById('search-input');
    const mainContainer = document.querySelector('main.container');
    let isResultsView = false;
    
    // --- NUEVAS REFERENCIAS PARA EL MODAL DE AMBIGÜEDAD ---
    const ambiguityModal = document.getElementById('ambiguity-modal-overlay');
    const ambiguityModalContent = document.getElementById('ambiguity-modal-content');

    function getSessionId() {
        let sessionId = sessionStorage.getItem('duendeSessionId');
        if (!sessionId) {
            sessionId = self.crypto.randomUUID();
            sessionStorage.setItem('duendeSessionId', sessionId);
        }
        return sessionId;
    }

    async function logInteraction(type, eventData) {
        // Analíticas desactivadas temporalmente
    }

    async function logSearch(params, resultsCount) {
        // Analíticas desactivadas temporalmente
    }

    const themeToggle = document.getElementById('theme-toggle');
    const toggleIcon = themeToggle.querySelector('i');
    const themeMeta = document.getElementById('theme-color-meta');
    const root = document.documentElement;
    
    function setTheme(theme) {
        root.setAttribute('data-theme', theme);
        localStorage.setItem('theme', theme);
        if (theme === 'dark') {
            toggleIcon.classList.remove('fa-moon');
            toggleIcon.classList.add('fa-sun');
            themeMeta.setAttribute('content', getComputedStyle(root).getPropertyValue('--color-fondo-dark').trim());
        } else {
            toggleIcon.classList.remove('fa-sun');
            toggleIcon.classList.add('fa-moon');
            themeMeta.setAttribute('content', getComputedStyle(root).getPropertyValue('--color-fondo-light').trim());
        }
    }
    
    const backToTopBtn = document.getElementById('back-to-top-btn');
    const modalOverlay = document.getElementById('gemini-modal-overlay');
    const modalContent = document.getElementById('modal-content');
    const modalCloseBtn = document.getElementById('modal-close-btn');
    const synth = window.speechSynthesis;
    function showModal() { modalOverlay.classList.add('visible'); }
    function hideModal() { 
        if (synth.speaking) {
            synth.cancel();
        }
        modalOverlay.classList.remove('visible'); 
    }
    
    function setupFilterToggle(toggleId, containerId) {
        const toggleButton = document.getElementById(toggleId);
        const container = document.getElementById(containerId);
        if (toggleButton && container) {
            toggleButton.addEventListener('click', () => {
                const isVisible = container.classList.toggle('visible');
                const icon = toggleButton.querySelector('i');
                icon.classList.toggle('fa-chevron-down', !isVisible);
                icon.classList.toggle('fa-chevron-up', isVisible);
            });
        }
    }
    
    // Función para reemplazar nombres de lugares en corchetes con enlaces de Google Maps
    function linkifyLocations(text, city) {
        const regex = /\[([^\]]+)\]/g;
        if (!text.match(regex)) {
            return text;
        }
        return text.replace(regex, (match, p1) => {
            const placeName = p1.trim();
            const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(placeName + ', ' + city)}`;
            return `<a href="${mapsUrl}" target="_blank" rel="noopener noreferrer">${placeName}</a>`;
        });
    }

    // CAMBIO 2: La llamada a la IA ahora apunta al nuevo endpoint /api/generate-night-plan y usa event._id
    async function getFlamencoPlan(event) {
        showModal();
        modalContent.innerHTML = `<div class="loader-container"><div class="loader"></div><p>Un momento, el duende está afinando la guitarra...</p></div>`;
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 20000);
            const response = await fetch(`${API_BASE_URL}/api/generate-night-plan?eventId=${event._id}`, {
                signal: controller.signal
            });
            clearTimeout(timeoutId);
            if (!response.ok) {
                throw new Error(`Error del servidor: ${response.statusText}`);
            }
            const result = await response.json();
            if (result && result.content) {
                const textWithLinks = linkifyLocations(result.content, event.city);
                const formattedHtml = marked.parse(textWithLinks);
                const calendarLinks = generateCalendarLinks(event);
                modalContent.innerHTML = `
                    <div class="modal-header"><h2>✨ Tu Noche Flamenca ✨</h2></div>
                    <div id="plan-text">${formattedHtml}</div>
                    <div class="modal-footer" style="border-top: 1px solid var(--color-borde-light); margin-top: 1.5rem; padding-top: 1.5rem;">
                        <h3 style="margin:0; margin-bottom: 1rem; color: var(--color-texto-principal-light);">Añadir el evento principal al calendario</h3>
                        <div style="display:flex; flex-direction:column; align-items:center; gap:1rem;">
                            <a href="${calendarLinks.google}" target="_blank" rel="noopener noreferrer" class="calendar-link-btn"><i class="fab fa-google" style="color:#4285F4;"></i> Google Calendar</a>
                            <a href="${calendarLinks.ical}" download="${event.name}.ics" class="calendar-link-btn"><i class="fab fa-apple" style="color:#000;"></i> Apple / iCal</a>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <div class="modal-footer-buttons">
                            <button id="listen-plan-btn" class="listen-plan-btn"><i class="fas fa-volume-up"></i> Escuchar Plan</button>
                            <button id="copy-plan-btn" class="copy-plan-btn">Copiar Plan</button>
                        </div>
                        <p class="ai-disclaimer">Contenido generado por IA. La información puede no ser precisa.</p>
                    </div>`;
                document.getElementById('copy-plan-btn').addEventListener('click', (e) => {
                    const planText = document.getElementById('plan-text').innerText;
                    const copyButton = e.currentTarget;
                    navigator.clipboard.writeText(planText).then(() => {
                        copyButton.textContent = '¡Copiado!';
                        setTimeout(() => { copyButton.textContent = 'Copiar Plan'; }, 2000);
                    }).catch(err => { console.error('Error al copiar el texto: ', err); });
                });
                const listenButton = document.getElementById('listen-plan-btn');
                const listenIcon = listenButton.querySelector('i');
                const utterance = new SpeechSynthesisUtterance();
                utterance.lang = 'es-ES';
                utterance.onstart = () => { listenIcon.classList.remove('fa-volume-up'); listenIcon.classList.add('fa-stop'); listenButton.childNodes[1].textContent = ' Detener'; };
                utterance.onend = () => { listenIcon.classList.remove('fa-stop'); listenIcon.classList.add('fa-volume-up'); listenButton.childNodes[1].textContent = ' Escuchar Plan'; };
                listenButton.addEventListener('click', () => {
                    if (synth.speaking) {
                        synth.cancel();
                    } else {
                        utterance.text = document.getElementById('plan-text').innerText;
                        synth.speak(utterance);
                    }
                });
            } else { throw new Error("La IA no devolvió una respuesta válida."); }
        } catch (error) {
            console.error("Error en getFlamencoPlan:", error);
            if (error.name === 'AbortError') { modalContent.innerHTML = `<h3>Error</h3><p>La petición ha tardado demasiado en responder. Por favor, inténtalo de nuevo.</p>`; }
            else { modalContent.innerHTML = `<h3>Error</h3><p>No se pudo generar el plan.</p>`; }
        }
    }
    
    function showSkeletonLoader() {
        skeletonContainer.innerHTML = '';
        resultsContainer.style.display = 'none';
        skeletonContainer.style.display = 'grid';
        statusMessage.textContent = '';
        for (let i = 0; i < 6; i++) {
            const skeletonCard = document.createElement('div');
            skeletonCard.className = 'skeleton-card';
            skeletonCard.innerHTML = `<div class="skeleton title"></div><div class="skeleton text text-short"></div><div class="skeleton text text-long"></div><div class="skeleton text"></div>`;
            skeletonContainer.appendChild(skeletonCard);
        }
    }
    
    function hideSkeletonLoader() {
        skeletonContainer.style.display = 'none';
        resultsContainer.style.display = 'grid';
    }
    
    async function performSearch(params, isUserSearch = false) {
        showSkeletonLoader();
        hideAmbiguityModal();
    
        if (isUserSearch) {
            mainContainer.classList.add('results-active');
            isResultsView = true;
            setTimeout(() => { statusMessage.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 100);
        }
        const queryString = new URLSearchParams(params).toString();
        try {
            // CAMBIO 3: La llamada de búsqueda ahora apunta a /api/events
            const response = await fetch(`${API_BASE_URL}/api/events?${queryString}`);
            if (!response.ok) {
                throw new Error(`Error de red: ${response.statusText}`);
            }
            const data = await response.json();
            
            if (data.isAmbiguous) {
                showAmbiguityModal(data.searchTerm, data.options);
                hideSkeletonLoader();
                return;
            }
            
            const events = data.events;
            displayEvents(events);

        } catch (error) {
            console.error('Error al realizar la búsqueda:', error);
            statusMessage.textContent = 'Hubo un error al realizar la búsqueda. Por favor, inténtalo de nuevo.';
            hideSkeletonLoader();
        }
    }
    
    function displayEvents(events) {
        hideSkeletonLoader();
        statusMessage.textContent = '';
        if (events.length === 0) {
            statusMessage.textContent = 'No se encontraron eventos que coincidan con tu búsqueda.';
            resultsContainer.innerHTML = '';
            return;
        }
        resultsContainer.innerHTML = '';
        const fragment = document.createDocumentFragment();
        events.forEach(event => {
            fragment.appendChild(createEventCard(event));
        });
        resultsContainer.appendChild(fragment);
    }
    
    function createEventCard(event) {
        const eventCard = document.createElement('article');
        eventCard.className = 'evento-card';
        
        const eventDate = new Date(event.date).toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' });
        const fullLocation = [event.venue, event.city, event.country].filter(Boolean).join(', ');
        const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fullLocation)}`;
 
        eventCard.innerHTML = `
            <div class="card-header"><h3>${event.name || 'Evento sin título'}</h3></div>
            <div class="artista"><i class="fas fa-user"></i> <span>${event.artist || 'Artista por confirmar'}</span></div>
            <div class="descripcion-container">
                <p class="descripcion">${event.description || ''}</p>
                ${event.verified ? `<div class="verificado-badge"><i class="fas fa-check"></i> Verificado</div>` : ''}
            </div>
            <div class="card-detalles">
                <div class="evento-detalle"><i class="fas fa-calendar-alt"></i><span><strong>Fecha:</strong> ${eventDate}</span></div>
                <div class="evento-detalle"><i class="fas fa-clock"></i><span><strong>Hora:</strong> ${event.time || 'N/A'}</span></div>
                <div class="evento-detalle"><a href="${mapsUrl}" target="_blank" rel="noopener noreferrer"><i class="fas fa-map-marker-alt"></i><span><strong>Lugar:</strong> ${fullLocation}</span></a></div>
            </div>
            <div class="card-actions">
                ${event.sourceURL ? `<a href="${event.sourceURL}" target="_blank" rel="noopener noreferrer" class="source-link-btn"><i class="fas fa-external-link-alt"></i> Ver Fuente</a>` : ''}
                <div class="card-actions-primary">
                    <button class="gemini-btn">✨ Planear Noche</button>
                    <button class="calendar-btn"><i class="fas fa-calendar-plus"></i> Añadir</button>
                </div>
            </div>
        `;
        
        eventCard.querySelector('.gemini-btn').addEventListener('click', () => {
            getFlamencoPlan(event);
        });
        eventCard.querySelector('.calendar-btn').addEventListener('click', () => {
            showCalendarLinks(event);
        });
        
        return eventCard;
    }
    
    async function loadTotalEventsCount() {
        try {
            // CAMBIO 4: La llamada del contador ahora apunta a /api/events/count
            const response = await fetch(`${API_BASE_URL}/api/events/count`);
            if (!response.ok) return;
            const data = await response.json();
            if (data.total !== undefined) {
                totalEventsSpan.textContent = data.total;
            }
        } catch (error) {
            console.warn('No se pudo cargar el contador total de eventos.');
        }
    }
    
    const tripPlannerBtn = document.getElementById('trip-planner-btn');
    const tripModalOverlay = document.getElementById('trip-planner-modal-overlay');
    const tripModalCloseBtn = document.getElementById('trip-modal-close-btn');
    const tripPlannerForm = document.getElementById('trip-planner-form');
    tripPlannerBtn.addEventListener('click', () => tripModalOverlay.classList.add('visible'));
    tripModalCloseBtn.addEventListener('click', () => tripModalOverlay.classList.remove('visible'));
    tripModalOverlay.addEventListener('click', (e) => {
        if (e.target === tripModalOverlay) tripModalOverlay.classList.remove('visible');
    });
    
    tripPlannerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const destination = document.getElementById('trip-destination').value;
        const startDate = document.getElementById('trip-start-date').value;
        const endDate = document.getElementById('trip-end-date').value;
        const tripPlannerResult = document.getElementById('trip-planner-result');
        tripPlannerResult.innerHTML = `<div class="loader-container"><div class="loader"></div><p>Buscando eventos y creando tu ruta flamenca...</p></div>`;
        try {
            const response = await fetch(`${API_BASE_URL}/api/trip-planner`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ destination, startDate, endDate }),
            });

            if (response.ok) {
                // Asumimos que si la respuesta es OK, será un JSON válido.
                const result = await response.json(); 
                const text = result.text;
                const formattedHtml = marked.parse(text); 
                tripPlannerResult.innerHTML = formattedHtml;
            } else {
                // Si la respuesta no es OK, leemos el error como texto.
                const errorText = await response.text();
                throw new Error(errorText || 'La IA no devolvió un plan válido.');
            }
        } catch (error) {
            console.error("Error en el planificador de viajes:", error);
            // Aseguramos que el error se muestra como texto plano
            tripPlannerResult.innerHTML = `<p style="color: red;">Ha ocurrido un error al generar tu plan: ${error.message}</p>`;
        }
    });
    
    function generateCalendarLinks(event) {
        const startTime = new Date(`${event.date}T${event.time || '00:00:00'}`);
        const endTime = new Date(startTime.getTime() + (2 * 60 * 60 * 1000));
        const formatTime = (date) => date.toISOString().replace(/-|:|\.\d+/g, '');
        const startTimeFormatted = formatTime(startTime);
        const endTimeFormatted = formatTime(endTime);
        const eventDetails = {
            title: encodeURIComponent(event.name),
            details: encodeURIComponent(`Ver a ${event.artist}.\n\n${event.description || ''}`),
            location: encodeURIComponent(event.venue),
            startTime: startTimeFormatted,
            endTime: endTimeFormatted
        };
        const googleLink = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${eventDetails.title}&dates=${eventDetails.startTime}/${eventDetails.endTime}&details=${eventDetails.details}&location=${eventDetails.location}`;
        const icsContent = `BEGIN:VCALENDAR\nVERSION:2.0\nBEGIN:VEVENT\nDTSTART:${startTimeFormatted}\nDTEND:${endTimeFormatted}\nSUMMARY:${event.name}\nDESCRIPTION:Ver a ${event.artist}.\\n\\n${event.description || ''}\nLOCATION:${event.venue}\nEND:VEVENT\nEND:VCALENDAR`;
        const icsLink = `data:text/calendar;charset=utf-8,${encodeURIComponent(icsContent)}`;
        return { google: googleLink, ical: icsLink };
    }
    
    function showCalendarLinks(event) {
        const links = generateCalendarLinks(event);
        modalContent.innerHTML = `
            <div class="modal-header">
                <h2>Añadir "${event.name}" a tu calendario</h2>
            </div>
            <div style="display:flex; flex-direction:column; align-items:center; gap:1rem; margin-top:1.5rem;">
                <a href="${links.google}" target="_blank" rel="noopener noreferrer" class="calendar-link-btn">
                    <i class="fab fa-google" style="color:#4285F4;"></i> Google Calendar
                </a>
                <a href="${links.ical}" download="${event.name}.ics" class="calendar-link-btn">
                    <i class="fab fa-apple" style="color:#000;"></i> Apple / iCal
                </a>
            </div>
        `;
        showModal();
    }
    
    function handleQuickFilter(event) {
        event.preventDefault();
        const url = new URL(event.currentTarget.href);
        window.location.href = url.toString(); // Forzamos recarga con el nuevo filtro
    }
    
    document.querySelectorAll('.quick-filter-btn').forEach(btn => {
        btn.addEventListener('click', handleQuickFilter);
    });
    
    // --- LÓGICA DE INICIALIZACIÓN CON PARÁMETROS DE BÚSQUEDA ---
    function initialize() {
        loadTotalEventsCount();
        const urlParams = new URLSearchParams(window.location.search);
        const params = Object.fromEntries(urlParams.entries());
        if (Object.keys(params).length === 0) {
            params.timeframe = 'week';
        }
        if (params.search) {
            searchInput.value = params.search;
        }
        // Llamamos a performSearch con los parámetros de la URL
        performSearch(params, Object.keys(params).length > 0 && !!(params.search || params.city || params.country));
    }
    // --- FIN DE LA LÓGICA DE INICIALIZACIÓN ---

    themeToggle.addEventListener('click', () => {
        const newTheme = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
        setTheme(newTheme);
    });
    const savedTheme = localStorage.getItem('theme');
    const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    setTheme(savedTheme || (prefersDark ? 'dark' : 'dark'));

    window.addEventListener('scroll', () => {
        backToTopBtn.classList.toggle('visible', window.scrollY > 300);
        if (isResultsView && window.scrollY < 150) {
            mainContainer.classList.remove('results-active');
            isResultsView = false;
        }
    });
    
    modalCloseBtn.addEventListener('click', hideModal);
    modalOverlay.addEventListener('click', (e) => {
        if (e.target === modalOverlay) hideModal();
    });

    setupFilterToggle('province-filters-toggle', 'province-filters-container');
    setupFilterToggle('country-filters-toggle', 'country-filters-container');
    
    searchForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const searchTerm = searchInput.value.trim();
        // Llamamos a performSearch en lugar de recargar la página directamente
        performSearch({ search: searchTerm }, true);
    });

    // --- NUEVAS FUNCIONES PARA EL MODAL DE AMBIGÜEDAD ---
   // ...
// --- NUEVAS FUNCIONES PARA EL MODAL DE AMBIGÜEDAD ---
// --- NUEVAS FUNCIONES PARA EL MODAL DE AMBIGÜEDAD ---
function showAmbiguityModal(searchTerm, options) {
    // Configuramos y mostramos el modal
    ambiguityModal.classList.add('visible');

    // Traducimos las opciones
    const option1Text = options[0] === 'country' ? 'país' : 'artista';
    const option2Text = options[1] === 'country' ? 'país' : 'artista';

    // Usamos marked.parse para dar formato al texto
    const textHtml = marked.parse(`El término **"${searchTerm}"** puede referirse a un **${option1Text}** o un **${option2Text}**. ¿Qué estás buscando?`);
    
    ambiguityModalContent.innerHTML = `
        <div class="modal-header">
            <h2>Búsqueda ambigua</h2>
        </div>
        <div class="modal-body">
            <div style="padding: 1.5rem; text-align: center;">
                ${textHtml}
                <div style="margin-top: 1.5rem; display: flex; flex-direction: column; align-items: center; gap: 1rem;">
                    <button class="option-btn modal-green-btn" onclick="searchForOption('${searchTerm}', '${options[0]}')">
                        Buscar ${option1Text}
                    </button>
                    <button class="option-btn modal-green-btn" onclick="searchForOption('${searchTerm}', '${options[1]}')">
                        Buscar ${option2Text}
                    </button>
                </div>
            </div>
        </div>
        <div class="modal-footer-close">
            <button id="ambiguity-modal-close-btn" onclick="hideAmbiguityModal()">
                <i class="fas fa-times"></i>
            </button>
        </div>
    `;

    // Estilos de los botones
    const styleElement = document.createElement('style');
    styleElement.innerHTML = `
        .modal-body {
            background-color: #fff;
            color: #333;
            border-radius: 8px;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        }
        .modal-green-btn {
            background-color: #00b140;
            color: #fff;
            border: 2px solid #00b140;
            padding: 0.75rem 1.5rem;
            border-radius: 50px;
            font-size: 1rem;
            font-weight: 700;
            cursor: pointer;
            transition: all 0.3s ease;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        }
        .modal-green-btn:hover {
            background-color: #008f33;
            box-shadow: 0 6px 8px rgba(0, 0, 0, 0.15);
            transform: translateY(-2px);
        }
    `;
    ambiguityModalContent.appendChild(styleElement);
}

function hideAmbiguityModal() {
    ambiguityModal.classList.remove('visible');
}// --- NUEVAS FUNCIONES PARA EL MODAL DE AMBIGÜEDAD ---
// --- NUEVAS FUNCIONES PARA EL MODAL DE AMBIGÜEDAD ---
// --- NUEVAS FUNCIONES PARA EL MODAL DE AMBIGÜEDAD ---
function showAmbiguityModal(searchTerm, options) {
    // Configuramos y mostramos el modal
    ambiguityModal.classList.add('visible');
    
    const option1Text = options[0] === 'country' ? 'país' : 'artista';
    const option2Text = options[1] === 'country' ? 'país' : 'artista';

    ambiguityModalContent.innerHTML = `
        <div class="modal-header">
            <h2>Búsqueda ambigua</h2>
        </div>
        <div class="modal-body-ambiguity-transparent">
            <div style="display: flex; flex-direction: column; align-items: center; gap: 1rem;">
                <button class="option-btn modal-green-btn" onclick="searchForOption('${searchTerm}', '${options[0]}')">
                    Buscar ${option1Text}
                </button>
                <button class="option-btn modal-green-btn" onclick="searchForOption('${searchTerm}', '${options[1]}')">
                    Buscar ${option2Text}
                </button>
            </div>
        </div>
        <div class="modal-footer-close">
            <button id="ambiguity-modal-close-btn" onclick="hideAmbiguityModal()">
                <i class="fas fa-times"></i>
            </button>
        </div>
    `;

    // Estilos de los botones
    const styleElement = document.createElement('style');
    styleElement.innerHTML = `
        .modal-body-ambiguity-transparent {
            background-color: transparent;
            box-shadow: none;
            padding: 2rem 1.5rem; /* Aumentamos el padding para que no se pegue al borde */
        }
        .modal-green-btn {
            width: 15rem; /* Un ancho fijo para que se vean más grandes */
            background-color: #00b140;
            color: #fff;
            border: 2px solid #00b140;
            padding: 0.75rem 1.5rem;
            border-radius: 50px;
            font-size: 1rem;
            font-weight: 700;
            cursor: pointer;
            transition: all 0.3s ease;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        }
        .modal-green-btn:hover {
            background-color: #008f33;
            box-shadow: 0 6px 8px rgba(0, 0, 0, 0.15);
            transform: translateY(-2px);
        }
    `;
    ambiguityModalContent.appendChild(styleElement);
}

function hideAmbiguityModal() {
    ambiguityModal.classList.remove('visible');
}

function hideAmbiguityModal() {
    ambiguityModal.classList.remove('visible');
}

// ...

    function hideAmbiguityModal() {
        ambiguityModal.classList.remove('visible');
    }

    // Función global para que se pueda llamar desde el HTML del modal
    window.searchForOption = (searchTerm, preferredOption) => {
        hideAmbiguityModal();
        performSearch({ search: searchTerm, preferredOption: preferredOption }, true);
    };

    // Cerrar el modal de ambigüedad al hacer clic fuera de él
    ambiguityModal.addEventListener('click', (e) => {
        if (e.target === ambiguityModal) hideAmbiguityModal();
    });
    
    initialize();
});