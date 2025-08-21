document.addEventListener('DOMContentLoaded', () => {
    // --- CONSTANTES Y VARIABLES GLOBALES ---
    const PRODUCTION_API_URL = 'https://duende-api-next.vercel.app';
    const DEVELOPMENT_API_URL = 'http://localhost:3000'; // Unificado a localhost
    const API_BASE_URL = window.location.hostname.includes('localhost') || window.location.hostname.includes('127.0.0.1') || window.location.hostname.includes('0.0.0.0')
        ? DEVELOPMENT_API_URL
        : PRODUCTION_API_URL;

    // --- Selectores del DOM (fusionados) ---
    const resultsContainer = document.getElementById('resultsContainer');
    const skeletonContainer = document.getElementById('skeleton-container');
    const statusMessage = document.getElementById('statusMessage');
    const totalEventsSpan = document.getElementById('total-events');
    const searchForm = document.getElementById('search-form');
    const searchInput = document.getElementById('search-input');
    const mainContainer = document.querySelector('main.container');
    const nearbyEventsBtn = document.getElementById('nearby-events-btn');
    const noResultsMessage = document.getElementById('no-results-message');
    const backToTopBtn = document.getElementById('back-to-top-btn');

    // Modales
    const modalOverlay = document.getElementById('gemini-modal-overlay');
    const modalContent = document.getElementById('modal-content');
    const modalCloseBtn = document.getElementById('modal-close-btn');
    const copyPlanBtn = document.getElementById('copy-plan-btn');
    const ambiguityModal = document.getElementById('ambiguity-modal-overlay');
    const ambiguityModalContent = document.getElementById('ambiguity-modal-content');
    const imageModalOverlay = document.getElementById('image-modal-overlay');
    const imageModalContent = document.getElementById('image-modal-content');
    const imageModalCloseBtn = document.querySelector('.image-modal-close-btn');

    // Trip Planner
    const tripPlannerBtn = document.getElementById('trip-planner-btn');
    const tripModalOverlay = document.getElementById('trip-planner-modal-overlay');
    const tripModalCloseBtn = document.getElementById('trip-modal-close-btn');
    const tripPlannerForm = document.getElementById('trip-planner-form');
    const tripPlannerResult = document.getElementById('trip-planner-result');

    // Settings Modal
    const settingsBtn = document.getElementById('settings-btn');
    const settingsModalOverlay = document.getElementById('settings-modal-overlay');
    const settingsModalCloseBtn = document.getElementById('settings-modal-close-btn');
    const themeToggleSwitch = document.getElementById('theme-toggle-switch');
    const notificationsToggleSwitch = document.getElementById('notifications-toggle-switch');
    const infoModalOverlay = document.getElementById('info-modal-overlay');
    const infoModalContent = document.getElementById('info-modal-content');
    const infoModalCloseBtn = document.getElementById('info-modal-close-btn');

    // Estado de la aplicación
    const synth = window.speechSynthesis;
    let isResultsView = false;
    let eventsCache = {};

    // --- FUNCIONES DE AYUDA (HELPERS) ---

    function showSkeletonLoader() {
        skeletonContainer.innerHTML = '';
        resultsContainer.style.display = 'none';
        skeletonContainer.style.display = 'grid';
        statusMessage.textContent = 'Buscando el mejor compás...';
        noResultsMessage.style.display = 'none';
        for (let i = 0; i < 6; i++) {
            const skeletonCard = document.createElement('div');
            skeletonCard.className = 'skeleton-card';
            skeletonCard.innerHTML = `<div class="skeleton title"></div><div class="skeleton text"></div><div class="skeleton text"></div>`;
            skeletonContainer.appendChild(skeletonCard);
        }
    }

    function hideSkeletonLoader() {
        skeletonContainer.style.display = 'none';
        resultsContainer.style.display = 'grid';
    }

    function showNotification(message, type = 'info') {
        const notificationContainer = document.getElementById('notification-container');
        if (!notificationContainer) return;
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;
        notificationContainer.appendChild(notification);
        setTimeout(() => {
            notification.classList.add('hide');
            notification.addEventListener('transitionend', () => notification.remove());
        }, 5000);
    }

    function sanitizeField(value, defaultText = 'No disponible') {
        if (value && typeof value === 'string' && value.trim() !== '' && value.trim().toLowerCase() !== 'n/a') {
            return value.replace(/\s*\[object Object\]/g, '').trim();
        }
        return defaultText;
    }

    function urlBase64ToUint8Array(base64String) {
        const padding = '='.repeat((4 - base64String.length % 4) % 4);
        const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
        const rawData = window.atob(base64);
        const outputArray = new Uint8Array(rawData.length);
        for (let i = 0; i < rawData.length; ++i) {
            outputArray[i] = rawData.charCodeAt(i);
        }
        return outputArray;
    }

    function showModal() { modalOverlay.classList.add('visible'); }
    function hideModal() { modalOverlay.classList.remove('visible'); }

    function setTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('theme', theme);
        themeToggleSwitch.checked = theme === 'dark';
    }

    // --- EVENT LISTENERS Y MANEJADORES ---

    function setupEventListeners() {
        searchForm.addEventListener('submit', (e) => {
            e.preventDefault();
            performSearch({ search: searchInput.value.trim() }, true);
        });

        nearbyEventsBtn.addEventListener('click', () => {
            if (navigator.geolocation) {
                statusMessage.textContent = 'Buscando tu ubicación...';
                navigator.geolocation.getCurrentPosition(geolocationSuccess, geolocationError, { timeout: 5000 });
            } else {
                showNotification("La geolocalización no es soportada por tu navegador.", 'warning');
            }
        });

        resultsContainer.addEventListener('click', handleResultsContainerClick);

        // Modales
        modalCloseBtn.addEventListener('click', hideModal);
        modalOverlay.addEventListener('click', (e) => { if (e.target === modalOverlay) hideModal(); });

        copyPlanBtn.addEventListener('click', () => {
            const planText = modalContent.innerText;
            navigator.clipboard.writeText(planText)
                .then(() => showNotification('¡Plan copiado al portapapeles!', 'success'))
                .catch(err => {
                    console.error('Error al copiar: ', err);
                    showNotification('No se pudo copiar el plan.', 'error');
                });
        });

        imageModalOverlay.addEventListener('click', () => {
            imageModalOverlay.style.display = 'none';
        });

        imageModalCloseBtn.addEventListener('click', () => {
            imageModalOverlay.style.display = 'none';
        });

        tripPlannerBtn.addEventListener('click', () => {
            // 1. Coge el valor actual del campo de búsqueda.
            const searchTerm = searchInput.value.trim();

            // 2. Prepara la URL base de tu página de viajes.
            let url = 'https://afland.es/viajes-y-rutas/';

            // 3. Si el usuario ha escrito algo en el buscador...
            if (searchTerm) {
                // ...se añade a la URL como un parámetro de búsqueda.
                url += `?busqueda=${encodeURIComponent(searchTerm)}`;
            }

            // 4. Redirige al usuario a la URL final (sea la base o la personalizada).
            window.location.href = url;
        });

        // Ajustes
        // --- Lógica para la sección de Ajustes y Modales de Información ---

        // 1. Lógica para el modal principal de Ajustes (el del engranaje)
        settingsBtn.addEventListener('click', () => settingsModalOverlay.classList.add('visible'));
        settingsModalCloseBtn.addEventListener('click', () => settingsModalOverlay.classList.remove('visible'));
        settingsModalOverlay.addEventListener('click', (e) => {
            if (e.target === settingsModalOverlay) settingsModalOverlay.classList.remove('visible');
        });

        // 2. Lógica para los interruptores (toggles) dentro de Ajustes
        themeToggleSwitch.addEventListener('change', () => {
            const newTheme = themeToggleSwitch.checked ? 'dark' : 'light';
            setTheme(newTheme);
        });
        notificationsToggleSwitch.addEventListener('change', handleNotificationToggle);

        // 3. Lógica para los nuevos botones ("Cómo funciona" y "Términos")
        const settingsActionBtns = document.querySelectorAll('.settings-action-btn');

        settingsActionBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                // Coge el ID del contenido del atributo data-* del botón
                const contentId = btn.dataset.modalContentId;
                // Busca el div oculto que tiene ese contenido
                const contentSource = document.getElementById(contentId);

                if (contentSource) {
                    // Pone el contenido en el modal de información y lo muestra
                    infoModalContent.innerHTML = contentSource.innerHTML;
                    infoModalOverlay.classList.add('visible');
                }
            });
        });

        // 4. Lógica para cerrar el nuevo modal de información
        infoModalCloseBtn.addEventListener('click', () => infoModalOverlay.classList.remove('visible'));
        infoModalOverlay.addEventListener('click', e => {
            if (e.target === infoModalOverlay) {
                infoModalOverlay.classList.remove('visible');
            }
        });

        // UI General
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
                window.location.href = e.currentTarget.href;
            });
            const reloadAllBtn = document.getElementById('reload-all-btn');
            if (reloadAllBtn) {
                reloadAllBtn.addEventListener('click', (e) => {
                    e.preventDefault(); // Buena práctica
                    searchInput.value = ''; // Limpiamos el campo de búsqueda
                    performSearch({}); // Llama a la búsqueda sin parámetros para cargar todo
                });
            }

        });
    }

    function handleResultsContainerClick(event) {
        const geminiBtn = event.target.closest('.gemini-btn');
        const shareBtn = event.target.closest('.share-button');
        const image = event.target.closest('.evento-card-img');

        if (geminiBtn) {
            const eventId = geminiBtn.dataset.eventId;
            const eventData = eventsCache[eventId];
            if (eventData) getAndShowNightPlan(eventData);
        }

        if (shareBtn) {
            const eventId = shareBtn.dataset.eventId;
            const eventData = eventsCache[eventId];
            if (eventData && navigator.share) {
                // Construye una URL limpia que solo contiene el eventId
                const shareUrl = new URL(window.location.origin + window.location.pathname);
                shareUrl.searchParams.set('eventId', eventId);

                navigator.share({
                    title: eventData.name || 'Evento de Flamenco',
                    text: `¡Mira este evento flamenco: ${eventData.name}!`,
                    url: shareUrl.href,
                }).catch(err => console.error("Error al compartir:", err));
            } else {
                showNotification('Tu navegador no soporta la función de compartir.', 'warning');
            }
        }

        if (image) {
            imageModalContent.src = image.src;
            imageModalOverlay.style.display = 'flex';
        }
    }

    async function handleTripPlannerSubmit(e) {
        e.preventDefault();
        const destination = document.getElementById('trip-destination').value;
        const startDate = document.getElementById('trip-start-date').value;
        const endDate = document.getElementById('trip-end-date').value;
        tripPlannerResult.innerHTML = `<div class="loader-container"><div class="loader"></div><p>Planeando tu viaje flamenco...</p></div>`;
        try {
            const response = await fetch(`${API_BASE_URL}/api/generate-trip-plan`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ destination, startDate, endDate })
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'Error desconocido');
            tripPlannerResult.innerHTML = window.marked ? marked.parse(data.content) : `<pre>${data.content}</pre>`;
        } catch (error) {
            tripPlannerResult.innerHTML = `<p class="error-message">No se pudo generar el plan de viaje. Inténtalo de nuevo. (${error.message})</p>`;
        }
    }

    // --- NOTIFICACIONES PUSH ---

    async function registerServiceWorkerAndSubscribe() {
        if (!('serviceWorker' in navigator && 'PushManager' in window)) {
            showNotification('Las notificaciones push no son soportadas por tu navegador.', 'warning');
            return;
        }
        try {
            await navigator.serviceWorker.register('/sw.js');
            const registration = await navigator.serviceWorker.ready;
            const permission = await Notification.requestPermission();
            if (permission !== 'granted') throw new Error('Permiso de notificación no concedido.');

            const subscription = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: urlBase64ToUint8Array('BNxZrStD4xo8ZeM4ZZtvsR910WdrxqYb91HKTR-Y2Rl0uSvWU0UqREQpz-AJKoKZaAtck5ad9sRYYd8ogyjpCF8')
            });

            const response = await fetch(`${API_BASE_URL}/api/subscribe`, {
                method: 'POST',
                body: JSON.stringify(subscription),
                headers: { 'Content-Type': 'application/json' }
            });

            if (response.ok) {
                showNotification('¡Te has suscrito a las notificaciones!', 'success');
            } else {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Error al registrar la suscripción.');
            }
        } catch (error) {
            console.error('Error durante la suscripción push:', error);
            showNotification('Error al suscribirse a las notificaciones.', 'error');
            updateNotificationToggleState(); // Revertir el estado del toggle si falla
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
                showNotification('No se pudo cancelar la suscripción.', 'error');
            }
        }
    }

    function updateNotificationToggleState() {
        if (!('Notification' in window)) {
            notificationsToggleSwitch.disabled = true;
            return;
        }
        navigator.serviceWorker.ready.then(reg => {
            reg.pushManager.getSubscription().then(sub => {
                notificationsToggleSwitch.checked = sub !== null;
            });
        });
        notificationsToggleSwitch.disabled = Notification.permission === 'denied';
    }

    function handleNotificationToggle() {
        if (notificationsToggleSwitch.checked) {
            registerServiceWorkerAndSubscribe();
        } else {
            unsubscribeUser();
        }
    }

    // --- LÓGICA PRINCIPAL DE LA APLICACIÓN ---

    async function performSearch(params, isUserSearch = false, filterEventId = null) {
        showSkeletonLoader();
        // ambiguityModal.classList.remove('visible');

        if (isUserSearch && !filterEventId) {
            mainContainer.classList.add('results-active');
            isResultsView = true;
            setTimeout(() => { statusMessage.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 100);
            const queryString = new URLSearchParams(params).toString();
            const newUrl = `${window.location.pathname}?${queryString}`;
            window.history.pushState({ path: newUrl }, '', newUrl);
        } else if (filterEventId) {
            mainContainer.classList.add('results-active');
            isResultsView = true;
        }

        const fetchParams = filterEventId ? {} : params;

        try {
            const response = await fetch(`${API_BASE_URL}/api/events?${new URLSearchParams(fetchParams).toString()}`);
            if (!response.ok) throw new Error(`Error del servidor: ${response.statusText}`);
            const data = await response.json();

            if (data.isAmbiguous) {
                hideSkeletonLoader();
                statusMessage.textContent = `Tu búsqueda "${data.searchTerm}" es ambigua. ¿Quizás quisiste decir: ${data.options.join(', ')}?`;
                return;
            }

            let events = data.events || data;

            // Client-side filtering for a single event (from shared link)
            if (filterEventId) {
                const singleEvent = events.find(event => event._id === filterEventId);
                events = singleEvent ? [singleEvent] : [];
            }
            // Fuzzy search for main search queries
            else if (params.search) {
                const fuseOptions = {
                    keys: ['name', 'artist', 'city', 'venue'],
                    includeScore: true,
                    threshold: 0.4,
                    ignoreLocation: true,
                };
                const fuse = new Fuse(events, fuseOptions);
                const fuseResults = fuse.search(params.search);
                events = fuseResults.filter(r => r.score < 0.4).map(r => r.item);
            }

            displayEvents(events);

            if (isUserSearch) {
                const message = events.length > 0 
                    ? (filterEventId ? `Mostrando el evento compartido.` : `Se encontraron ${events.length} eventos.`)
                    : 'No se encontraron eventos.';
                showNotification(message, events.length > 0 ? 'success' : 'info');
            }

        } catch (error) {
            console.error("Error en la búsqueda:", error);
            hideSkeletonLoader();
            statusMessage.textContent = 'Hubo un error al realizar la búsqueda.';
            showNotification('Error al realizar la búsqueda.', 'error');
        }
    }

    function displayEvents(events) {
        hideSkeletonLoader();
        resultsContainer.innerHTML = '';
        eventsCache = {};

        // --- INICIO DE LA MODIFICACIÓN OG:IMAGE ---
        const urlParamsForOg = new URLSearchParams(window.location.search);
        const eventIdForOg = urlParamsForOg.get('eventId');
        const ogImageTag = document.getElementById('og-image-tag');

        if (eventIdForOg && events.length === 1 && events[0]._id === eventIdForOg && ogImageTag) {
            const eventImageUrl = events[0].imageUrl;
            if (eventImageUrl) {
                ogImageTag.setAttribute('content', eventImageUrl);
            }
        }
        // --- FIN DE LA MODIFICACIÓN OG:IMAGE ---

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

        // Si se muestra un solo evento (desde un enlace compartido), busca más del mismo artista.
        const urlParams = new URLSearchParams(window.location.search);
        const eventId = urlParams.get('eventId');
        if (eventId && events.length === 1 && events[0]._id === eventId) {
            const artist = events[0].artist;
            if (artist && artist.toLowerCase() !== 'artista por confirmar' && artist.toLowerCase() !== 'n/a') {
                fetchAndAppendArtistEvents(artist, eventId);
            }
        }
    }

    async function fetchAndAppendArtistEvents(artistName, currentEventId) {
        const header = document.createElement('h2');
        header.innerHTML = `<i class="fas fa-user-friends"></i> Más de ${artistName}`;
        header.className = 'related-events-header';
        resultsContainer.appendChild(header);

        try {
            // 1. Fetch all events that might be related from the API
            const response = await fetch(`${API_BASE_URL}/api/events?search=${encodeURIComponent(artistName)}`);
            if (!response.ok) throw new Error('La respuesta de la red no fue correcta');
            
            const data = await response.json();
            const events = data.events || data;

            // 2. Use Fuse.js for smart, client-side filtering
            const fuseOptions = {
                keys: ['artist'],
                includeScore: true,
                threshold: 0.4, // Adjust for strictness (0.0 = exact, 1.0 = anything)
                ignoreLocation: true, // Search the entire string
            };
            const fuse = new Fuse(events, fuseOptions);
            const fuseResults = fuse.search(artistName);

            // 3. Filter results based on a relevance score
            const relevantEvents = fuseResults
                .filter(result => result.score < 0.3) // Lower score is a better match
                .map(result => result.item);

            // 4. Exclude the event that is already being displayed
            const otherEvents = relevantEvents.filter(event => event._id !== currentEventId);

            if (otherEvents.length > 0) {
                const fragment = document.createDocumentFragment();
                otherEvents.forEach(event => {
                    if (!eventsCache[event._id]) { 
                        eventsCache[event._id] = event;
                        fragment.appendChild(createEventCard(event));
                    }
                });
                resultsContainer.appendChild(fragment);
                totalEventsSpan.textContent = document.querySelectorAll('.evento-card').length;
            } else {
                const noMoreEvents = document.createElement('p');
                noMoreEvents.textContent = `No hemos encontrado más eventos relevantes para ${artistName}.`;
                noMoreEvents.className = 'no-related-events';
                resultsContainer.appendChild(noMoreEvents);
            }
        } catch (error) {
            console.error('Error al buscar eventos relacionados del artista:', error);
            // Optional: do not show an error to the user to avoid distraction
        }
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
        
        let eventImageUrl = event.imageUrl;
        if (eventImageUrl && !eventImageUrl.startsWith('http')) {
            eventImageUrl = null;
        }

        eventCard.innerHTML = `
            ${eventImageUrl ? `<div class="evento-card-img-container"><img src="${eventImageUrl}" alt="Imagen del evento ${eventName}" class="evento-card-img" onerror="this.remove()"></div>` : ''}
            <div class="card-header">
                <h3 class="titulo-truncado" title="${eventName}">${eventName}</h3>
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

    function displayNightPlan(planData) {
        if (window.marked) {
            modalContent.innerHTML = marked.parse(planData.content);
        } else {
            console.warn("Librería 'marked.js' no encontrada. Mostrando texto plano.");
            modalContent.innerHTML = `<pre style="white-space: pre-wrap;">${planData.content}</pre>`;
        }

        const shopLink = document.createElement('div');
        shopLink.className = 'shop-promo-modal';
        shopLink.innerHTML = `
            <hr>
            <div class="promo-content">
                <h5>¿Buscas el atuendo perfecto?</h5>
                <p>Visita nuestra <a href="https://afland.es/la-tienda-flamenca-afland/" target="_blank" rel="noopener noreferrer">Tienda Flamenca</a> para encontrar moda y accesorios únicos.</p>
            </div>
        `;
        modalContent.appendChild(shopLink);
    }

    async function getAndShowNightPlan(event) {
        showModal();
        modalContent.innerHTML = `<div class="loader-container"><div class="loader"></div><p>Un momento, el duende está afinando la guitarra...</p></div>`;
        try {
            const response = await fetch(`${API_BASE_URL}/api/generate-night-plan?eventId=${event._id}`);
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'No se pudo generar el plan.');
            displayNightPlan(data);
        } catch (error) {
            console.error("Error al generar el Plan Noche:", error);
            modalContent.innerHTML = `<div class="error-message"><h3>¡Vaya! El duende se ha despistado.</h3><p>No se pudo generar el plan. Inténtalo de nuevo más tarde.</p><small>Detalle: ${error.message}</small></div>`;
            showNotification('Error al generar el plan.', 'error');
        }
    }

    // --- GEOLOCALIZACIÓN ---

    function geolocationSuccess(position) {
        const { latitude, longitude } = position.coords;
        performSearch({ lat: latitude, lon: longitude, radius: 120 }, true);
    }

    function geolocationError(error) {
        console.error("Error de geolocalización:", error);
        showNotification('No se pudo obtener tu ubicación. Mostrando eventos generales.', 'error');
        performSearch({});
    }

    // --- INICIALIZACIÓN ---

    function init() {
        // Establecer tema inicial
        const savedTheme = localStorage.getItem('theme') || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
        setTheme(savedTheme);

        setupEventListeners();
        updateNotificationToggleState();

        const urlParams = new URLSearchParams(window.location.search);
        const eventId = urlParams.get('eventId');
        const params = Object.fromEntries(urlParams.entries());

        // Si hay un eventId, se realiza una búsqueda general y luego se filtra
        // en el lado del cliente dentro de performSearch.
        if (eventId) {
            performSearch({}, true, eventId);
        } else if (Object.keys(params).length > 0) {
            searchInput.value = params.search || params.province || params.country || '';
            performSearch(params, true);
        } else {
            performSearch({});
        }
    }

    init();
});