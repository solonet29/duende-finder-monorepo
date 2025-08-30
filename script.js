document.addEventListener('DOMContentLoaded', () => {
    // --- CONSTANTES Y VARIABLES GLOBALES ---
    const PRODUCTION_API_URL = 'https://duende-api-next.vercel.app';
    const DEVELOPMENT_API_URL = 'http://localhost:3000';
    const API_BASE_URL = window.location.hostname.includes('localhost') || window.location.hostname.includes('127.0.0.1') || window.location.hostname.includes('0.0.0.0')
        ? DEVELOPMENT_API_URL
        : PRODUCTION_API_URL;

    const BANNER_URL_M2 = 'https://afland.es/wp-content/uploads/2025/08/banner_publicidad_restaurantes.jpg';
    const BANNER_URL_M3 = 'https://afland.es/wp-content/uploads/2025/08/banner_publicidad_hoteles.jpg';

    // --- Selectores del DOM ---
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
    const featuredSlider = document.getElementById('featured-events-slider');
    const recentSlider = document.getElementById('recent-events-slider');

    // Modales
    const modalOverlay = document.getElementById('gemini-modal-overlay');
    const modalContent = document.getElementById('modal-content');
    const modalCloseBtn = document.getElementById('modal-close-btn');
    const copyPlanBtn = document.getElementById('copy-plan-btn');
    const imageModalOverlay = document.getElementById('image-modal-overlay');
    const imageModalContent = document.getElementById('image-modal-content');
    const imageModalCloseBtn = document.querySelector('.image-modal-close-btn');

    // Estado de la aplicación
    let eventsCache = {};

    // --- FUNCIONES DE AYUDA (HELPERS) ---
    function showSkeletonLoader() {
        if (skeletonContainer) {
            skeletonContainer.innerHTML = '';
            resultsContainer.style.display = 'none';
            skeletonContainer.style.display = 'grid';
            for (let i = 0; i < 6; i++) {
                const skeletonCard = document.createElement('div');
                skeletonCard.className = 'skeleton-card';
                skeletonCard.innerHTML = `<div class="skeleton title"></div><div class="skeleton text"></div><div class="skeleton text"></div>`;
                skeletonContainer.appendChild(skeletonCard);
            }
        }
        if (statusMessage) statusMessage.textContent = 'Buscando el mejor compás...';
        if (noResultsMessage) noResultsMessage.style.display = 'none';
    }

    function hideSkeletonLoader() {
        if (skeletonContainer) skeletonContainer.style.display = 'none';
        if (resultsContainer) resultsContainer.style.display = 'grid';
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

    function showModal() { if (modalOverlay) modalOverlay.classList.add('visible'); }
    function hideModal() { if (modalOverlay) modalOverlay.classList.remove('visible'); }

    // --- CREACIÓN DE ELEMENTOS DINÁMICOS ---
    function createSliderCard(event) {
        const eventCard = document.createElement('div');
        eventCard.className = 'event-card';
        eventCard.setAttribute('data-event-id', event._id);
        const artistName = sanitizeField(event.artist, 'Artista por confirmar');

        // --- CAMBIO CLAVE 1 ---
        // Añadimos el nombre del artista como un data-attribute para poder leerlo al hacer clic.
        eventCard.setAttribute('data-artist-name', artistName);

        const placeholderUrl = 'https://placehold.co/280x160/121212/7f8c8d?text=Flamenco';
        const eventImageUrl = event.imageUrl || placeholderUrl;
        eventCard.innerHTML = `
            <img src="${eventImageUrl}" alt="${artistName}" class="card-image" onerror="this.src='${placeholderUrl}'">
            <div class="card-content">
                <h3 class="card-title">${artistName}</h3>
            </div>
        `;
        return eventCard;
    }

    function createEventCard(event) {
        const eventCard = document.createElement('article');
        eventCard.className = 'evento-card';
        eventCard.setAttribute('data-event-id', event._id);
        const eventName = sanitizeField(event.name, 'Evento sin título');
        const artistName = sanitizeField(event.artist, 'Artista por confirmar');
        const description = sanitizeField(event.description, 'Sin descripción disponible.');
        const eventTime = sanitizeField(event.time, 'No disponible');
        const eventVenue = sanitizeField(event.location?.venue, '');
        const eventCity = sanitizeField(event.location?.city, '');
        const eventCountry = sanitizeField(event.location?.country, '');
        const eventDate = event.date ? new Date(event.date).toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' }) : 'Fecha no disponible';
        const fullLocation = [eventVenue, eventCity, eventCountry].filter(Boolean).join(', ') || 'Ubicación no disponible';
        const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fullLocation)}`;
        let eventImageUrl = event.imageUrl;
        if (eventImageUrl && !eventImageUrl.startsWith('http')) {
            eventImageUrl = null;
        }
        const isPublishedWithUrl = event.contentStatus === 'published' && event.blogPostUrl;
        const blogUrl = isPublishedWithUrl ? event.blogPostUrl : 'https://afland.es/';
        const blogText = isPublishedWithUrl ? 'Leer en el Blog' : 'Explorar Blog';
        const blogIcon = isPublishedWithUrl ? 'fa-book-open' : 'fa-blog';
        const blogButtonClass = isPublishedWithUrl ? 'blog-link-btn' : 'btn-blog-explorar';
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
            <hr class="card-actions-separator">
            <div class="card-actions">
                ${event.verified ? `<div class="verificado-badge"><i class="fas fa-check"></i> Verificado</div>` : ''}
                ${event.sourceURL ? `<a href="${event.sourceURL}" target="_blank" rel="noopener noreferrer" class="source-link-btn"><i class="fas fa-external-link-alt"></i> Ver Fuente</a>` : ''}
                <div class="card-actions-primary">
                    <button class="gemini-btn" data-event-id="${event._id}">✨ Planear Noche</button>
                    <a href="${blogUrl}" target="_blank" rel="noopener noreferrer" class="${blogButtonClass}"><i class="fas ${blogIcon}"></i> ${blogText}</a>
                    <button class="share-button" data-event-id="${event._id}">
                        <i class="fas fa-solid fa-share-nodes"></i> Compartir
                    </button>
                </div>
            </div>
        `;
        return eventCard;
    }

    // --- GESTIÓN DE MODALES Y CONTENIDO ---
    function displayNightPlan(planData) { /* ... (Sin cambios) ... */ }
    async function getAndShowNightPlan(event) { /* ... (Sin cambios) ... */ }

    // --- CARGA Y RENDERIZADO DE SLIDERS ---
    async function loadAndDisplaySliders() {
        try {
            const [featuredResponse, recentResponse] = await Promise.all([
                fetch(`${API_BASE_URL}/api/events?featured=true`),
                fetch(`${API_BASE_URL}/api/events?sort=date&order=desc`)
            ]);
            const featuredEvents = await featuredResponse.json();
            const recentEvents = await recentResponse.json();
            if (featuredSlider) {
                featuredSlider.innerHTML = '';
                featuredEvents.events.forEach(event => featuredSlider.appendChild(createSliderCard(event)));
            }
            if (recentSlider) {
                recentSlider.innerHTML = '';
                recentEvents.events.forEach(event => recentSlider.appendChild(createSliderCard(event)));
            }
        } catch (error) {
            console.error("Error al cargar los sliders:", error);
        }
    }

    // --- RENDERIZADO DE EVENTOS Y SCROLL ---
    function displayEvents(events, shouldScroll = false) {
        hideSkeletonLoader();
        if (!resultsContainer) return;
        resultsContainer.innerHTML = '';
        eventsCache = {};
        if (!events || events.length === 0) {
            if (statusMessage) statusMessage.textContent = 'No se encontraron eventos que coincidan con tu búsqueda.';
            if (noResultsMessage) noResultsMessage.style.display = 'block';
            if (totalEventsSpan) totalEventsSpan.parentElement.style.display = 'none';
            return;
        }
        if (statusMessage) statusMessage.textContent = '';
        if (noResultsMessage) noResultsMessage.style.display = 'none';
        if (totalEventsSpan) {
            totalEventsSpan.parentElement.style.display = 'block';
            totalEventsSpan.textContent = events.length;
        }
        const fragment = document.createDocumentFragment();
        events.forEach(event => {
            eventsCache[event._id] = event;
            fragment.appendChild(createEventCard(event));
        });
        resultsContainer.appendChild(fragment);

        // --- CAMBIO CLAVE 2 ---
        // La lógica de scroll ahora depende del parámetro 'shouldScroll'.
        if (shouldScroll) {
            const resultsSection = document.querySelector('.full-events-section');
            if (resultsSection) {
                resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        }
    }

    // --- LÓGICA DE BÚSQUEDA Y MANEJO DE EVENTOS ---
    async function performSearch(params) {
        showSkeletonLoader();
        let url = `${API_BASE_URL}/api/events`;

        // --- CAMBIO CLAVE 3 (Parte A) ---
        // Comprobamos si la búsqueda viene de un slider para avisar a displayEvents.
        const isSliderSearch = !!params.clickedId;

        const apiParams = { ...params };
        delete apiParams.clickedId;
        const queryParams = new URLSearchParams(apiParams).toString();
        if (queryParams) {
            url += `?${queryParams}`;
        }
        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error(`Error del servidor: ${response.statusText}`);
            const data = await response.json();
            let eventsToShow = data.events || [];
            if (params.clickedId && eventsToShow.length > 1) {
                eventsToShow.sort((a, b) => {
                    if (a._id === params.clickedId) return -1;
                    if (b._id === params.clickedId) return 1;
                    return 0;
                });
            }
            // --- CAMBIO CLAVE 3 (Parte B) ---
            // Pasamos el flag 'isSliderSearch' a la función displayEvents.
            displayEvents(eventsToShow, isSliderSearch);
        } catch (error) {
            console.error("Error en la búsqueda:", error);
            hideSkeletonLoader();
            if (statusMessage) statusMessage.textContent = 'Hubo un error al realizar la búsqueda.';
            showNotification('Error al realizar la búsqueda.', 'error');
        }
    }

    function handleResultsContainerClick(event) {
        const geminiBtn = event.target.closest('.gemini-btn');
        const image = event.target.closest('.evento-card-img');
        const clickedCard = event.target.closest('.event-card');
        if (geminiBtn) {
            const eventId = geminiBtn.dataset.eventId;
            const eventData = eventsCache[eventId];
            if (eventData) getAndShowNightPlan(eventData);
            return;
        }
        if (image && !image.closest('.slider-container')) {
            if (imageModalContent) imageModalContent.src = image.src;
            if (imageModalOverlay) imageModalOverlay.style.display = 'flex';
        }

        // --- CAMBIO CLAVE 4 ---
        // Lógica simplificada: no se ocultan los sliders, solo se busca y se hace scroll.
        if (clickedCard && clickedCard.parentElement.classList.contains('slider-container')) {
            const eventId = clickedCard.dataset.eventId;
            const artistName = clickedCard.dataset.artistName;
            if (eventId && artistName) {
                performSearch({ artist: artistName, clickedId: eventId });
            }
        }
    }

    // --- EVENT LISTENERS ---
    function setupEventListeners() {
        if (searchForm) { /* ... (Sin cambios) ... */ }
        if (nearbyEventsBtn) { /* ... (Sin cambios) ... */ }
        if (resultsContainer) {
            resultsContainer.addEventListener('click', handleResultsContainerClick);
        }
        if (featuredSlider) {
            featuredSlider.addEventListener('click', handleResultsContainerClick);
        }
        if (recentSlider) {
            recentSlider.addEventListener('click', handleResultsContainerClick);
        }
        if (modalCloseBtn) { /* ... (Sin cambios) ... */ }
        if (modalOverlay) { /* ... (Sin cambios) ... */ }
        if (copyPlanBtn) { /* ... (Sin cambios) ... */ }
        if (imageModalOverlay) { /* ... (Sin cambios) ... */ }
        if (imageModalCloseBtn) { /* ... (Sin cambios) ... */ }
        const viewAllBtn = document.getElementById('view-all-btn');
        if (viewAllBtn) {
            viewAllBtn.addEventListener('click', () => {
                if (searchInput) searchInput.value = '';
                const slidersSection = document.querySelector('.sliders-section');
                if (slidersSection) slidersSection.style.display = 'block'; // Asegurarse de que los sliders se vean
                performSearch({});
            });
        }
    }

    // --- LÓGICA DE GEOLOCALIZACIÓN ---
    function geolocationSuccess(position) { /* ... (Sin cambios) ... */ }
    function geolocationError(error) { /* ... (Sin cambios) ... */ }

    // --- INICIALIZACIÓN DE LA APLICACIÓN ---
    function init() {
        setupEventListeners();
        loadAndDisplaySliders();
        performSearch({});
    }

    init();
});
