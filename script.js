document.addEventListener('DOMContentLoaded', () => {
    const PRODUCTION_API_URL = 'https://duende-api.vercel.app';
    const DEVELOPMENT_API_URL = 'http://127.0.0.1:3000'; // CAMBIADO DE localhost A 127.0.0.1
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

    // NEW: Settings Modal Elements
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

        setupFilterToggle('province-filters-toggle', 'province-filters-container');
        setupFilterToggle('country-filters-toggle', 'country-filters-container');

        // NEW: Settings Modal Listeners
        settingsBtn.addEventListener('click', () => settingsModalOverlay.classList.add('visible'));
        settingsModalCloseBtn.addEventListener('click', () => settingsModalOverlay.classList.remove('visible'));
        settingsModalOverlay.addEventListener('click', (e) => {
            if (e.target === settingsModalOverlay) settingsModalOverlay.classList.remove('visible');
        });

        // NEW: Listeners for controls inside settings modal
        themeToggleSwitch.addEventListener('change', () => {
            const newTheme = themeToggleSwitch.checked ? 'dark' : 'light';
            setTheme(newTheme);
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
                getFlamencoPlan(eventData);
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
                shareEvent(shareTitle, shareText, shareUrl);
            }
        }
    }

    async function handleTripPlannerSubmit(e) {
        e.preventDefault();
        const destination = document.getElementById('trip-destination').value;
        const startDate = document.getElementById('trip-start-date').value;
        const endDate = document.getElementById('trip-end-date').value;
        getTripPlan(destination, startDate, endDate);
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

                try {
                    const response = await fetch(`${API_BASE_URL}/api/subscribe`, {
                        method: 'POST',
                        body: JSON.stringify(subscription),
                        headers: {
                            'Content-Type': 'application/json'
                        }
                    });

                    if (response.ok) {
                        showNotification('¡Te has suscrito a las notificaciones!', 'success');
                    } else {
                        const errorData = await response.json();
                        throw new Error(errorData.message || 'Error al registrar la suscripción en el servidor.');
                    }
                } catch (error) {
                    console.error('Error al enviar la suscripción al servidor:', error);
                    showNotification('No se pudo completar la suscripción con el servidor. Por favor, inténtalo más tarde.', 'error');
                }

            } catch (error) {
                console.error('Error durante el registro del Service Worker o la suscripción push:', error);
                showNotification('Error al suscribirse a las notificaciones.', 'error');
            }
        } else {
            showNotification('Las notificaciones push no son soportadas por tu navegador.', 'warning');
        }
    }

    // NEW: Unsubscribe logic
    async function unsubscribeUser() {
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();
        if (subscription) {
            try {
                const response = await fetch(`${API_BASE_URL}/api/unsubscribe`, {
                    method: 'POST',
                    body: JSON.stringify({ endpoint: subscription.endpoint }),
                    headers: {
                        'Content-Type': 'application/json'
                    }
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

    // NEW: Update toggle state based on permission
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

    // NEW: Handle the notification toggle switch logic
    function handleNotificationToggle() {
        if (notificationsToggleSwitch.checked) {
            registerServiceWorkerAndSubscribe().catch(err => {
                console.error(err);
                updateNotificationToggleState(); // Revert toggle on failure
            });
        } else {
            unsubscribeUser();
        }
    }

    // --- CORE FUNCTIONS ---
    async function performSearch(params, isUserSearch = false) {
        showSkeletonLoader();
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
                hideSkeletonLoader();
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
            hideSkeletonLoader();
            showNotification('Error al realizar la búsqueda.', 'error');
        }
    }

    function displayEvents(events) {
        hideSkeletonLoader();
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
        const regex = new RegExp("\\ \[([^\\]+)\\]", "g"); // Corrected regex
        if (!text.match(regex)) {
            return text;
        }
        return text.replace(regex, (match, p1) => {
            const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(p1 + ', ' + city)}`;
            return `<a href="${mapsUrl}" target="_blank" rel="noopener noreferrer">${p1}</a>`;
        });
    }

    async function getFlamencoPlan(event) {
        showModal();
        modalContent.innerHTML = `<div class="loader-container"><div class="loader"></div><p>Un momento, el duende está afinando la guitarra...</p></div>`;
        try {
            const response = await fetch(`${API_BASE_URL}/api/generate-night-plan?eventId=${event._id}`);
            if (!response.ok) throw new Error(`Error del servidor: ${response.statusText}`);
            const data = await response.json();
            if (data.isAmbiguous) {
                showAmbiguityModal(data.searchTerm, data.options);
                hideSkeletonLoader();
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
            hideSkeletonLoader();
            showNotification('Error al realizar la búsqueda.', 'error');
        }
    }

    async function getTripPlan(destination, startDate, endDate) {
        tripPlannerResult.innerHTML = `<div class="loader-container"><div class="loader"></div></div>`;
        try {
            const response = await fetch(`${API_BASE_URL}/api/trip-planner`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ destination, startDate, endDate }),
            });
            if (!response.ok) throw new Error(`Error del servidor: ${response.statusText}`);
            const result = await response.json();
            const planContent = result.content || result.text;
            if (planContent) {
                const formattedHtml = marked.parse(planContent);
                tripPlannerResult.innerHTML = `<div class="modal-header"><h2><i class="fas fa-route"></i> Tu Viaje Flamenco</h2></div>${formattedHtml}`;
            } else {
                throw new Error("La IA no devolvió un plan de viaje válido.");
            }
        } catch (error) {
            console.error("Error en getTripPlan:", error);
            tripPlannerResult.innerHTML = `<h3>Error</h3><p>No se pudo generar el plan de viaje. El duende está ocupado en otros quehaceres.</p>`;
        }
    }

    function shareEvent(title, text, url) {
        const shareUrl = url || window.location.href;
        if (navigator.share) {
            navigator.share({ title, text, url: shareUrl })
                .catch((error) => console.error('Error al compartir:', error));
        } else {
            navigator.clipboard.writeText(shareUrl).then(() => {
                showNotification('¡Enlace del evento copiado al portapapeles!', 'success');
            }).catch(err => {
                console.error('Error al copiar al portapapeles:', err);
                showNotification('Error al copiar el enlace.', 'error');
            });
        }
    }

    function generateCalendarLinks(event) {
        const name = encodeURIComponent(event.name);
        const description = encodeURIComponent(event.description || '');
        const location = encodeURIComponent([event.venue, event.city, event.country].filter(Boolean).join(', '));
        const [year, month, day] = new Date(event.date).toISOString().slice(0, 10).split('-');
        const startDate = `${year}${month}${day}`;
        const endDate = startDate;

        // Google Calendar
        const googleLink = `https://www.google.com/calendar/render?action=TEMPLATE&text=${name}&dates=${startDate}/${endDate}&details=${description}&location=${location}`;

        // iCal
        const icalContent = [
            'BEGIN:VCALENDAR',
            'VERSION:2.0',
            'BEGIN:VEVENT',
            `URL:${event.sourceURL || ''}`,
            `DTSTART:${startDate}`,
            `DTEND:${endDate}`,
            `SUMMARY:${event.name}`,
            `DESCRIPTION:${event.description || ''}`,
            `LOCATION:${[event.venue, event.city, event.country].filter(Boolean).join(', ')}`,
            'END:VEVENT',
            'END:VCALENDAR'
        ].join('\n');
        const icalLink = `data:text/calendar;charset=utf-8,${encodeURIComponent(icalContent)}`;

        return { google: googleLink, ical: icalLink };
    }

    // --- GEOLOCATION ---
    // MODIFICADO: Esta función ahora solo maneja el éxito de la geolocalización
    async function geolocationSuccess(position) {
        const { latitude, longitude } = position.coords;
        statusMessage.textContent = '¡Ubicación encontrada! Buscando eventos cerca de ti...';
        await performSearch({ lat: latitude, lon: longitude, radius: 120 }, true);

        // Si no se encuentran eventos, cargar la vista por defecto
        if (resultsContainer.children.length === 0) {
            showNotification('No se encontraron eventos en tu zona, mostrando los eventos de la semana.', 'info');
            await loadDefaultView();
        }
    }

    // MODIFICADO: Esta función ahora maneja el error y carga la vista por defecto
    function geolocationError(error) {
        console.error("Error al obtener la ubicación:", error);
        loadDefaultView();
    }

    // AÑADIDO: Nueva función para cargar la vista por defecto (eventos de la semana)
    async function loadDefaultView() {
        statusMessage.textContent = 'No se pudo obtener la ubicación. Mostrando los eventos de la semana.';
        await performSearch({ timeframe: 'week' });
        loadTotalEventsCount();
    }

    // --- NOTIFICATIONS ---
    function showNotification(message, type = 'info') {
        const notificationContainer = document.getElementById('notification-container');
        if (!notificationContainer) {
            console.error('Notification container not found!');
            return;
        }

        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;

        notificationContainer.appendChild(notification);

        // Automatically remove the notification after a few seconds
        setTimeout(() => {
            notification.classList.add('hide');
            notification.addEventListener('transitionend', () => notification.remove());
        }, 5000); // 5 seconds
    }

    // --- UI & THEME ---
    function showSkeletonLoader() {
        skeletonContainer.innerHTML = '';
        resultsContainer.style.display = 'none';
        skeletonContainer.style.display = 'grid';
        statusMessage.textContent = '';
        noResultsMessage.style.display = 'none';
        for (let i = 0; i < 6; i++) {
            const skeletonCard = document.createElement('div');
            skeletonCard.className = 'skeleton-card';
            skeletonCard.innerHTML = `<div class="skeleton title"></div><div class="skeleton text"></div>`;
            skeletonContainer.appendChild(skeletonCard);
        }
    }

    function hideSkeletonLoader() {
        skeletonContainer.style.display = 'none';
        resultsContainer.style.display = 'grid';
    }

    function setTheme(theme) {
        const root = document.documentElement;
        root.setAttribute('data-theme', theme);
        localStorage.setItem('theme', theme);

        // Update the new toggle switch in the settings modal
        if (themeToggleSwitch) {
            themeToggleSwitch.checked = theme === 'dark';
        }

        document.getElementById('theme-color-meta').setAttribute('content',
            getComputedStyle(root).getPropertyValue(theme === 'dark' ? '--color-fondo-dark' : '--color-fondo-light').trim()
        );
    }

    function showModal() { modalOverlay.classList.add('visible'); }
    function hideModal() {
        if (synth.speaking) synth.cancel();
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

    function showAmbiguityModal(searchTerm, options) {
        ambiguityModal.classList.add('visible');
        let optionsHtml = options.map(opt =>
            `<button onclick="searchForOption('${searchTerm}', '${opt}')">${opt}</button>`
        ).join('');
        ambiguityModalContent.innerHTML = `<h3>'${searchTerm}' es ambiguo.</h3><p>¿A cuál te refieres?</p><div class="options">${optionsHtml}</div>`;
    }

    function hideAmbiguityModal() {
        ambiguityModal.classList.remove('visible');
    }

    window.searchForOption = (searchTerm, preferredOption) => {
        hideAmbiguityModal();
        performSearch({ search: searchTerm, preferredOption: preferredOption }, true);
    };

    // --- INITIALIZATION ---
    function proactiveNotificationPrompt() {
        // No molestar si ya se ha preguntado o si estamos en local
        if (Notification.permission === 'default' && !window.location.hostname.includes('localhost')) {
            console.log('Iniciando petición proactiva de permiso para notificaciones...');
            // Se podría mostrar un banner personalizado aquí antes de llamar a la función principal
            registerServiceWorkerAndSubscribe().catch(err => {
                // Silenciar el error si el usuario cierra el pop-up sin elegir
                if (err.message.includes('Permiso de notificación no concedido')) {
                    console.log('El usuario decidió no conceder permisos de notificación en este momento.');
                } else {
                    console.error('Error en la suscripción proactiva:', err);
                }
            });
        }
    }

    async function performInitialLocationSearch(params) {
        await performSearch(params, true);
        if (resultsContainer.children.length === 0) {
            showNotification('No se encontraron eventos en tu zona, mostrando los eventos de la semana.', 'info');
            await loadDefaultView();
        }
    }

    // MODIFICADO: Se intenta la geolocalización al cargar la página si no hay URL de búsqueda
    function initialize() {
        const savedTheme = localStorage.getItem('theme') || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
        setTheme(savedTheme);

        setupEventListeners();

        const urlParams = new URLSearchParams(window.location.search);
        const params = Object.fromEntries(urlParams.entries());

        if (params.lat && params.lon) {
            performInitialLocationSearch(params);
        } else if (Object.keys(params).length > 0) {
            if (params.search) searchInput.value = params.search;
            performSearch(params, true);
        } else {
            // Intentar geolocalización solo si no hay URL de búsqueda
            if (navigator.geolocation) {
                statusMessage.textContent = 'Buscando tu ubicación para mostrarte los eventos más cercanos...';
                navigator.geolocation.getCurrentPosition(async (position) => {
                    await geolocationSuccess(position);
                }, geolocationError, { timeout: 5000 });
            } else {
                // Si la geolocalización no es compatible, carga la vista por defecto
                loadDefaultView();
            }
        }

        // Iniciar el temporizador para la petición proactiva de notificaciones
        setTimeout(proactiveNotificationPrompt, 20000); // 20 segundos de espera
    }

    async function loadTotalEventsCount() {
        try {
            const response = await fetch(`${API_BASE_URL}/api/events/count`);
            if (!response.ok) return;
            const data = await response.json();
            if (data.total !== undefined) {
                totalEventsSpan.textContent = data.total;
            } else {
                totalEventsSpan.parentElement.style.display = 'none';
            }
        } catch (error) {
            console.warn('No se pudo cargar el contador total de eventos.', error);
            totalEventsSpan.parentElement.style.display = 'none';
        }
    }

    initialize();
});