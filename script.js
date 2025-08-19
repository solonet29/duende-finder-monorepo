document.addEventListener('DOMContentLoaded', () => {
    const PRODUCTION_API_URL = 'https://duende-api-next.vercel.app';
    const DEVELOPMENT_API_URL = 'http://127.0.0.1:3000';
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
    const nearbyEventsBtn = document.getElementById('nearby-events-btn');
    const noResultsMessage = document.getElementById('no-results-message');
    const ambiguityModal = document.getElementById('ambiguity-modal-overlay');
    const ambiguityModalContent = document.getElementById('ambiguity-modal-content');
    const modalOverlay = document.getElementById('gemini-modal-overlay');
    const modalContent = document.getElementById('modal-content');
    const modalCloseBtn = document.getElementById('modal-close-btn');
    const tripPlannerBtn = document.getElementById('trip-planner-btn');
    const tripModalOverlay = document.getElementById('trip-planner-modal-overlay');
    const tripModalCloseBtn = document.getElementById('trip-modal-close-btn');
    const tripPlannerForm = document.getElementById('trip-planner-form');
    const tripPlannerResult = document.getElementById('trip-planner-result');
    const backToTopBtn = document.getElementById('back-to-top-btn');
    const synth = window.speechSynthesis;
    let isResultsView = false;
    let eventsCache = {};

    const settingsBtn = document.getElementById('settings-btn');
    const settingsModalOverlay = document.getElementById('settings-modal-overlay');
    const settingsModalCloseBtn = document.getElementById('settings-modal-close-btn');
    const themeToggleSwitch = document.getElementById('theme-toggle-switch');
    const notificationsToggleSwitch = document.getElementById('notifications-toggle-switch');

    // --- Helper Functions ---
    function sanitizeField(value, defaultText = 'No disponible') {
        if (value && typeof value === 'string' && value.trim() !== '' && value.trim().toLowerCase() !== 'n/a') {
            return value.replace(/\ \[object Object\]/g, '').trim();
        }
        return defaultText;
    }

    function urlBase64ToUint8Array(base64String) {
        const padding = '='.repeat((4 - base64String.length % 4) % 4);
        const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/');
        const rawData = window.atob(base64);
        const outputArray = new Uint8Array(rawData.length);
        for (let i = 0; i < rawData.length; ++i) {
            outputArray[i] = rawData.charCodeAt(i);
        }
        return outputArray;
    }

    function showModal() {
        modalOverlay.classList.add('visible');
    }

    function hideModal() {
        modalOverlay.classList.remove('visible');
    }

    // --- EVENT LISTENERS SETUP ---
    function setupEventListeners() {
        searchForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const searchTerm = searchInput.value.trim();
            performSearch({ search: searchTerm }, true);
        });

        nearbyEventsBtn.addEventListener('click', () => {
            if (navigator.geolocation) {
                statusMessage.textContent = 'Buscando tu ubicación para mostrarte los eventos más cercanos...';
                navigator.geolocation.getCurrentPosition(async (position) => {
                    await geolocationSuccess(position);
                }, geolocationError, { timeout: 5000 });
            } else {
                showNotification("La geolocalización no es soportada por tu navegador.", 'warning');
            }
        });

        resultsContainer.addEventListener('click', handleResultsContainerClick);

        tripPlannerBtn.addEventListener('click', () => tripModalOverlay.classList.add('visible'));
        tripModalCloseBtn.addEventListener('click', () => tripModalOverlay.classList.remove('visible'));
        tripModalOverlay.addEventListener('click', (e) => {
            if (e.target === tripModalOverlay) tripModalOverlay.classList.remove('visible');
        });
        tripPlannerForm.addEventListener('submit', handleTripPlannerSubmit);

        modalCloseBtn.addEventListener('click', hideModal);
        modalOverlay.addEventListener('click', (e) => {
            if (e.target === modalOverlay) hideModal();
        });

        window.addEventListener('scroll', () => {
            backToTopBtn.classList.toggle('visible', window.scrollY > 300);
            if (isResultsView && window.scrollY < 150) {
                mainContainer.classList.remove('results-active');
                isResultsView = false;
            }
        });

        document.querySelectorAll('.quick-filter-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                const url = new URL(e.currentTarget.href);
                window.location.href = url.toString();
            });
        });

        // NOTA: Estas funciones no estaban en el código original, deberás crearlas si las necesitas
        // setupFilterToggle('province-filters-toggle', 'province-filters-container');
        // setupFilterToggle('country-filters-toggle', 'country-filters-container');

        settingsBtn.addEventListener('click', () => settingsModalOverlay.classList.add('visible'));
        settingsModalCloseBtn.addEventListener('click', () => settingsModalOverlay.classList.remove('visible'));
        settingsModalOverlay.addEventListener('click', (e) => {
            if (e.target === settingsModalOverlay) settingsModalOverlay.classList.remove('visible');
        });

        themeToggleSwitch.addEventListener('change', () => {
            const newTheme = themeToggleSwitch.checked ? 'dark' : 'light';
            // Debes tener una función setTheme(newTheme)
        });
        notificationsToggleSwitch.addEventListener('change', handleNotificationToggle);
    }

    function handleResultsContainerClick(event) {
        const target = event.target;
        const geminiBtn = target.closest('.gemini-btn');
        const shareBtn = target.closest('.share-button');

        if (geminiBtn) {
            const eventId = geminiBtn.dataset.eventId;
            const eventData = eventsCache[eventId];
            if (eventData) {
                getAndShowNightPlan(eventData);
            }
            return;
        }

        if (shareBtn) {
            const eventId = shareBtn.dataset.eventId;
            const eventData = eventsCache[eventId];
            if (eventData) {
                const shareTitle = eventData.name || 'Evento sin título';
                const shareText = 'Mira este evento en Duende Finder: ' + (eventData.description || '');
                const shareUrl = eventData.sourceURL || window.location.href;
                // Debes tener una función shareEvent(shareTitle, shareText, shareUrl)
            }
        }
    }

    async function handleTripPlannerSubmit(e) {
        e.preventDefault();
        const destination = document.getElementById('trip-destination').value;
        const startDate = document.getElementById('trip-start-date').value;
        const endDate = document.getElementById('trip-end-date').value;
        // Debes tener una función getTripPlan(destination, startDate, endDate)
    }

    // --- PUSH NOTIFICATIONS ---
    async function registerServiceWorkerAndSubscribe() {
        if ('serviceWorker' in navigator && 'PushManager' in window) {
            try {
                await navigator.serviceWorker.register('/sw.js');
                const registration = await navigator.serviceWorker.ready;
                console.log('Service Worker listo y activo:', registration);

                const permission = await Notification.requestPermission();
                if (permission !== 'granted') {
                    throw new Error('Permiso de notificación no concedido.');
                }

                const subscription = await registration.pushManager.subscribe({
                    userVisibleOnly: true,
                    applicationServerKey: urlBase64ToUint8Array('BNxZrStD4xo8ZeM4ZZtvsR910WdrxqYb91HKTR-Y2Rl0uSvWU0UqREQpz-AJKoKZaAtck5ad9sRYYd8ogyjpCF8')
                });

                console.log('Suscripción Push obtenida:', subscription);

                const response = await fetch(`${API_BASE_URL}/api/subscribe`, {
                    method: 'POST',
                    body: JSON.stringify(subscription),
                    headers: { 'Content-Type': 'application/json' }
                });

                if (response.ok) {
                    showNotification('¡Te has suscrito a las notificaciones!', 'success');
                } else {
                    const errorData = await response.json();
                    throw new Error(errorData.message || 'Error al registrar la suscripción en el servidor.');
                }
            } catch (error) {
                console.error('Error durante el registro del Service Worker o la suscripción push:', error);
                showNotification('Error al suscribirse a las notificaciones.', 'error');
            }
        } else {
            showNotification('Las notificaciones push no son soportadas por tu navegador.', 'warning');
        }
    }

    async function unsubscribeUser() {
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();
        if (subscription) {
            try {
                const response = await fetch(`${API_BASE_URL}/api/unsubscribe`, {
                    method: 'POST',
                    body: JSON.stringify({ endpoint: subscription.endpoint }),
                    headers: { 'Content-Type': 'application/json' }
                });
                if (response.ok) {
                    await subscription.unsubscribe();
                    showNotification('Suscripción a notificaciones cancelada.', 'info');
                } else {
                    throw new Error('Error en el servidor al cancelar la suscripción.');
                }
            } catch (error) {
                console.error('Error al cancelar la suscripción:', error);
                showNotification('No se pudo cancelar la suscripción.', 'error');
            }
        }
        updateNotificationToggleState();
    }

    function updateNotificationToggleState() {
        if (!('Notification' in window)) {
            notificationsToggleSwitch.disabled = true;
            return;
        }
        switch (Notification.permission) {
            case 'granted':
                notificationsToggleSwitch.checked = true;
                notificationsToggleSwitch.disabled = false;
                break;
            case 'denied':
                notificationsToggleSwitch.checked = false;
                notificationsToggleSwitch.disabled = true;
                break;
            case 'default':
                notificationsToggleSwitch.checked = false;
                notificationsToggleSwitch.disabled = false;
                break;
        }
    }

    function handleNotificationToggle() {
        if (notificationsToggleSwitch.checked) {
            registerServiceWorkerAndSubscribe().catch(err => {
                console.error(err);
                updateNotificationToggleState();
            });
        } else {
            unsubscribeUser();
        }
    }

    // --- CORE FUNCTIONS ---
    async function performSearch(params, isUserSearch = false) {
        // showSkeletonLoader(); // Debes tener esta función definida
        hideAmbiguityModal();
        if (isUserSearch) {
            mainContainer.classList.add('results-active');
            isResultsView = true;
            setTimeout(() => { statusMessage.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 100);
        }
        const queryString = new URLSearchParams(params).toString();
        if (isUserSearch) {
            const newUrl = `${window.location.pathname}?${queryString}`;
            window.history.pushState({ path: newUrl }, '', newUrl);
        }
        try {
            const response = await fetch(`${API_BASE_URL}/api/events?${queryString}`);
            if (!response.ok) throw new Error(`Error del servidor: ${response.statusText}`);
            const data = await response.json();
            if (data.isAmbiguous) {
                showAmbiguityModal(data.searchTerm, data.options);
                // hideSkeletonLoader(); // Debes tener esta función definida
                return;
            }
            const events = data.events || data;
            displayEvents(events);
            if (events.length > 0) {
                showNotification(`Se encontraron ${events.length} eventos.`, 'success');
            } else {
                showNotification('No se encontraron eventos.', 'info');
            }
        } catch (error) {
            console.error("Error en la búsqueda:", error);
            statusMessage.textContent = 'Hubo un error al realizar la búsqueda. Por favor, inténtalo de nuevo.';
            // hideSkeletonLoader(); // Debes tener esta función definida
            showNotification('Error al realizar la búsqueda.', 'error');
        }
    }

    function displayEvents(events) {
        // hideSkeletonLoader(); // Debes tener esta función definida
        resultsContainer.innerHTML = '';
        eventsCache = {};

        if (!events || events.length === 0) {
            statusMessage.textContent = 'No se encontraron eventos que coincidan con tu búsqueda.';
            noResultsMessage.style.display = 'block';
            totalEventsSpan.parentElement.style.display = 'none';
            return;
        }

        statusMessage.textContent = '';
        noResultsMessage.style.display = 'none';
        totalEventsSpan.parentElement.style.display = 'block';
        totalEventsSpan.textContent = events.length;

        const fragment = document.createDocumentFragment();
        events.forEach(event => {
            eventsCache[event._id] = event;
            fragment.appendChild(createEventCard(event));
        });
        resultsContainer.appendChild(fragment);
    }

    function createEventCard(event) {
        const eventCard = document.createElement('article');
        eventCard.className = 'evento-card';
        const eventName = sanitizeField(event.name, 'Evento sin título');
        const artistName = sanitizeField(event.artist, 'Artista por confirmar');
        const description = sanitizeField(event.description, 'Sin descripción disponible.');
        const eventTime = sanitizeField(event.time, 'No disponible');
        const eventVenue = sanitizeField(event.venue, '');
        const eventCity = sanitizeField(event.city, '');
        const eventCountry = sanitizeField(event.country, '');
        const eventDate = event.date ? new Date(event.date).toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' }) : 'Fecha no disponible';
        const fullLocation = [eventVenue, eventCity, eventCountry].filter(Boolean).join(', ') || 'Ubicación no disponible';
        const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fullLocation)}`;

        eventCard.innerHTML = `
            <div class="card-header">
                <div class="header-evento">
                    <h3 class="titulo-truncado">${eventName}</h3>
                </div>
            </div>
            <div class="artista"><i class="fas fa-user"></i> <span>${artistName}</span></div>
            <div class="descripcion-container">
                <p class="descripcion-corta">${description}</p>
            </div>
            <div class="card-detalles">
                <div class="evento-detalle"><i class="fas fa-calendar-alt"></i><span><strong>Fecha:</strong> ${eventDate}</span></div>
                <div class="evento-detalle"><i class="fas fa-clock"></i><span><strong>Hora:</strong> ${eventTime}</span></div>
                <div class="evento-detalle"><a href="${mapsUrl}" target="_blank" rel="noopener noreferrer"><i class="fas fa-map-marker-alt"></i><span><strong>Lugar:</strong> ${fullLocation}</span></a></div>
            </div>
            <div class="card-actions">
                ${event.sourceURL ? `<a href="${event.sourceURL}" target="_blank" rel="noopener noreferrer" class="source-link-btn"><i class="fas fa-external-link-alt"></i> Ver Fuente</a>` : ''}
                <div class="card-actions-primary">
                    <button class="gemini-btn" data-event-id="${event._id}">✨ Planear Noche</button>
                    <button class="share-button" data-event-id="${event._id}">
                        <i class="fas fa-solid fa-share-nodes"></i> Compartir
                    </button>
                </div>
            </div>
            ${event.verified ? `<div class="verificado-badge"><i class="fas fa-check"></i> Verificado</div>` : ''}
        `;
        return eventCard;
    }

    function linkifyLocations(text, city) {
        const regex = new RegExp("\\[([^\\]]+)\\]", "g");
        if (!text.match(regex)) {
            return text;
        }
        return text.replace(regex, (match, p1) => {
            const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(p1 + ', ' + city)}`;
            return `<a href="${mapsUrl}" target="_blank" rel="noopener noreferrer">${p1}</a>`;
        });
    }

    // --- NUEVA FUNCIÓN Y FUNCIÓN CORREGIDA ---
    function displayNightPlan(planData) {
        if (window.marked) {
            modalContent.innerHTML = marked.parse(planData.content);
        } else {
            console.warn("Librería 'marked.js' no encontrada. Mostrando texto plano.");
            modalContent.innerHTML = `<pre style="white-space: pre-wrap;">${planData.content}</pre>`;
        }
    }

    async function getAndShowNightPlan(event) {
        showModal();
        modalContent.innerHTML = `<div class="loader-container"><div class="loader"></div><p>Un momento, el duende está afinando la guitarra...</p></div>`;

        try {
            const response = await fetch(`${API_BASE_URL}/api/generate-night-plan?eventId=${event._id}`);
            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'No se pudo generar el plan.');
            }

            displayNightPlan(data);

        } catch (error) {
            console.error("Error al generar el Plan Noche:", error);
            modalContent.innerHTML = `<div class="error-message">
                <h3>¡Vaya! El duende se ha despistado.</h3>
                <p>No se pudo generar el plan en este momento. Por favor, inténtalo de nuevo más tarde.</p>
                <small>Detalle: ${error.message}</small>
            </div>`;
            showNotification('Error al generar el plan.', 'error');
        }
    }

    // --- INICIALIZACIÓN ---
    function init() {
        setupEventListeners();
        const urlParams = new URLSearchParams(window.location.search);
        const params = Object.fromEntries(urlParams.entries());
        if (Object.keys(params).length > 0) {
            searchInput.value = params.search || params.province || params.country || '';
            performSearch(params);
        } else {
            performSearch({});
        }
    }

    // NOTA: Asegúrate de tener estas funciones definidas en alguna parte,
    // ya que son llamadas pero no están en el código que me pasaste.
    function showNotification(message, type) { console.log(`[${type.toUpperCase()}] Notification: ${message}`); }
    function hideAmbiguityModal() { ambiguityModal.classList.remove('visible'); }
    function showAmbiguityModal(searchTerm, options) { ambiguityModal.classList.add('visible'); /* ... más lógica ... */ }
    // function showSkeletonLoader() { skeletonContainer.style.display = 'flex'; }
    // function hideSkeletonLoader() { skeletonContainer.style.display = 'none'; }
    async function geolocationSuccess(position) { /* ... */ }
    function geolocationError(error) { /* ... */ }

    init();
});