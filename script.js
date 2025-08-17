document.addEventListener('DOMContentLoaded', () => {
    // CAMBIO 1: La URL de la API ahora es flexible para poder hacer pruebas fácilmente.
    // Define las URLs base para cada entorno
    const PRODUCTION_API_URL = 'https://duende-api.vercel.app'; // URL de producción actualizada
    const DEVELOPMENT_API_URL = 'http://localhost:3000';

    // Decide qué URL usar basándose en el hostname actual del navegador
    const API_BASE_URL = window.location.hostname.includes('localhost') || window.location.hostname.includes('0.0.0.0')
        ? DEVELOPMENT_API_URL
        : PRODUCTION_API_URL;

    const resultsContainer = document.getElementById('resultsContainer');
    const skeletonContainer = document.getElementById('skeleton-container');
    const statusMessage = document.getElementById('statusMessage');
    const totalEventsSpan = document.getElementById('total-events');
    const searchForm = document.getElementById('search-form');
    const searchInput = document.getElementById('search-input');
    const mainContainer = document.querySelector('main.container');
    let isResultsView = false;

    // --- NUEVAS REFERENCIAS PARA GEOLOCALIZACIÓN ---
    const nearbyEventsBtn = document.getElementById('nearby-events-btn');
    const noResultsMessage = document.getElementById('no-results-message');
    // --- FIN DE NUEVAS REFERENCIAS ---

    const ambiguityModal = document.getElementById('ambiguity-modal-overlay');
    const ambiguityModalContent = document.getElementById('ambiguity-modal-content');

    resultsContainer.addEventListener('click', (event) => {
        const button = event.target.closest('.export-button');
        if (button) {
            // Lógica para exportar tarjeta...
        }
    });

    // --- LÓGICA PARA GEOLOCALIZACIÓN ---
    nearbyEventsBtn.addEventListener('click', () => {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(geolocationSuccess, geolocationError);
        } else {
            alert("La geolocalización no es soportada por tu navegador.");
        }
    });

    async function geolocationSuccess(position) {
        const { latitude, longitude } = position.coords;
        const apiUrl = `${API_BASE_URL}/api/events?lat=${latitude}&lon=${longitude}`;

        showSkeletonLoader(); // Muestra el loader mientras se busca
        noResultsMessage.style.display = 'none'; // Oculta el mensaje de no resultados

        try {
            const response = await fetch(apiUrl);
            if (!response.ok) {
                throw new Error(`Error en la petición: ${response.statusText}`);
            }
            const events = await response.json();
            
            if (events.length === 0) {
                resultsContainer.innerHTML = ''; // Limpia resultados anteriores
                noResultsMessage.style.display = 'block'; // Muestra el mensaje
                hideSkeletonLoader();
            } else {
                // La función displayEvents ya se encarga de ocultar el loader y mostrar los eventos
                displayEvents(events); 
            }
        } catch (error) {
            console.error("Error al buscar eventos cercanos:", error);
            statusMessage.textContent = 'No se pudieron buscar los eventos cercanos. Inténtalo de nuevo.';
            hideSkeletonLoader();
        }
    }

    function geolocationError(error) {
        let message = '';
        switch (error.code) {
            case error.PERMISSION_DENIED:
                message = "Has denegado el permiso para acceder a tu ubicación.";
                break;
            case error.POSITION_UNAVAILABLE:
                message = "La información de tu ubicación no está disponible.";
                break;
            case error.TIMEOUT:
                message = "La petición para obtener tu ubicación ha tardado demasiado.";
                break;
            case error.UNKNOWN_ERROR:
                message = "Ha ocurrido un error desconocido al obtener tu ubicación.";
                break;
        }
        alert(message);
    }
    // --- FIN DE LÓGICA PARA GEOLOCALIZACIÓN ---

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

    function linkifyLocations(text, city) {
        const regex = /\ufffd([^\ufffd]+)\ufffd/g;
        if (!text.match(regex)) {
            return text;
        }
        return text.replace(regex, (match, p1) => {
            const placeName = p1.trim();
            const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(placeName + ', ' + city)}`;
            return `<a href="${mapsUrl}" target="_blank" rel="noopener noreferrer">${placeName}</a>`;
        });
    }

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
        noResultsMessage.style.display = 'none'; // Oculta el mensaje al cargar
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
        const MAX_RETRIES = 3;
        const RETRY_DELAY_MS = 2000;

        for (let i = 0; i < MAX_RETRIES; i++) {
            try {
                const response = await fetch(`${API_BASE_URL}/api/events?${queryString}`);
                if (response.ok) {
                    const data = await response.json();
                    if (data.isAmbiguous) {
                        showAmbiguityModal(data.searchTerm, data.options);
                        hideSkeletonLoader();
                        return;
                    }
                    // Asumo que la API devuelve { events: [...] } o solo [...] 
                    const events = data.events || data;
                    displayEvents(events);
                    return;
                } else {
                    throw new Error(`Error del servidor: ${response.statusText}`);
                }
            } catch (error) {
                console.error(`Intento ${i + 1} de búsqueda fallido:`, error);
                if (i === MAX_RETRIES - 1) {
                    statusMessage.textContent = 'Hubo un error al realizar la búsqueda. Por favor, inténtalo de nuevo.';
                    hideSkeletonLoader();
                } else {
                    await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS));
                }
            }
        }
    }

    // Esta es la función que el usuario llamó renderEvents
    function displayEvents(events) {
        hideSkeletonLoader();
        statusMessage.textContent = '';
        noResultsMessage.style.display = 'none'; // Oculta por si estaba visible

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

    function shareEvent(title, text, url) {
        const shareUrl = url || window.location.href;
        if (navigator.share) {
            navigator.share({
                title: title,
                text: text,
                url: shareUrl,
            })
            .then(() => console.log('Contenido compartido con éxito.'))
            .catch((error) => console.error('Error al compartir:', error));
        } else {
            navigator.clipboard.writeText(shareUrl).then(() => {
                alert('¡Enlace del evento copiado al portapapeles!');
            }).catch(err => {
                console.error('Error al copiar al portapapeles:', err);
                alert('No se pudo copiar el enlace.');
            });
        }
    }

    function createEventCard(event) {
        const uniqueCardId = `event-card-${event._id}`;
        const eventCard = document.createElement('article');
        eventCard.className = 'evento-card';
        eventCard.id = uniqueCardId;

        const eventDate = new Date(event.date).toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' });
        const fullLocation = [event.venue, event.city, event.country].filter(Boolean).join(', ');
        const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fullLocation)}`;

        const shareTitle = (event.name || 'Evento sin título').replace(/'/g, "'\'");
        const shareText = ('Mira este evento en Duende Finder: ' + (event.description || '')).replace(/'/g, "'\'").replace(/[\r\n]+/g, ' ');
        const shareUrl = event.sourceURL || window.location.href;

        eventCard.innerHTML = `
        <div class="card-header">
            <div class="header-evento">
                <h3 class="titulo-truncado">${event.name || 'Evento sin título'}</h3>
                <button class="expandir-btn" data-target="titulo">
                    <i class="fa-solid fa-chevron-down"></i>
                </button>
            </div>
        </div>
        <div class="artista"><i class="fas fa-user"></i> <span>${event.artist || 'Artista por confirmar'}</span></div>
        <div class="descripcion-container">
            <p class="descripcion-corta">${event.description || ''}</p>
            <button class="expandir-btn" data-target="descripcion">
                <i class="fa-solid fa-chevron-down"></i>
            </button>
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
                <button class="share-button" onclick="shareEvent('${shareTitle}', '${shareText}', '${shareUrl}')">
                    <i class="fas fa-solid fa-share-nodes"></i> Compartir
                </button>
            </div>
        </div>
        ${event.verified ? `<div class="verificado-badge"><i class="fas fa-check"></i> Verificado</div>` : ''}
        `;

        eventCard.querySelector('.gemini-btn').addEventListener('click', () => {
            getFlamencoPlan(event);
        });

        return eventCard;
    }

    async function loadTotalEventsCount() {
        try {
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
        // Lógica del planificador de viajes...
    });

    function generateCalendarLinks(event) {
        // Lógica para generar enlaces de calendario...
    }

    function showCalendarLinks(event) {
        // Lógica para mostrar enlaces de calendario...
    }

    function handleQuickFilter(event) {
        event.preventDefault();
        const url = new URL(event.currentTarget.href);
        window.location.href = url.toString();
    }

    document.querySelectorAll('.quick-filter-btn').forEach(btn => {
        btn.addEventListener('click', handleQuickFilter);
    });

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
        performSearch(params, Object.keys(params).length > 0 && !!(params.search || params.city || params.country));
    }

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

    searchInput.addEventListener('focus', () => {
        searchForm.classList.add('active');
    });

    searchInput.addEventListener('blur', () => {
        setTimeout(() => {
            searchForm.classList.remove('active');
        }, 150);
    });

    searchForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const searchTerm = searchInput.value.trim();
        performSearch({ search: searchTerm }, true);
    });

    function showAmbiguityModal(searchTerm, options) {
        // Lógica del modal de ambigüedad...
    }

    function hideAmbiguityModal() {
        ambiguityModal.classList.remove('visible');
    }

    window.searchForOption = (searchTerm, preferredOption) => {
        hideAmbiguityModal();
        performSearch({ search: searchTerm, preferredOption: preferredOption }, true);
    };

    ambiguityModal.addEventListener('click', (e) => {
        if (e.target === ambiguityModal) hideAmbiguityModal();
    });

    document.addEventListener('click', (event) => {
        const button = event.target.closest('.expandir-btn');
        if (button) {
            // Lógica para expandir/contraer texto...
        }
    });

    initialize();
});
