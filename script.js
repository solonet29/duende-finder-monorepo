document.addEventListener('DOMContentLoaded', () => {
    // =========================================================================
    // 1. CONFIGURACIÓN Y VARIABLES GLOBALES
    // =========================================================================

    const API_BASE_URL = window.location.hostname.includes('localhost')
        ? 'http://localhost:3000'
        : 'https://duende-api-next.vercel.app';

    // Estado de la aplicación
    let eventsCache = {};

    // =========================================================================
    // 2. SELECTORES DEL DOM (ELEMENTOS HTML)
    // =========================================================================

    // --- Contenedores Principales ---
    const resultsContainer = document.getElementById('resultsContainer');
    const skeletonContainer = document.getElementById('skeleton-container');
    const statusMessage = document.getElementById('statusMessage');
    const noResultsMessage = document.getElementById('no-results-message');

    // --- Sliders ---
    const featuredSlider = document.getElementById('featured-events-slider');
    const recentSlider = document.getElementById('recent-events-slider');

    // --- Botones y Controles ---
    const backToTopBtn = document.getElementById('back-to-top-btn');
    const filterBar = document.querySelector('.filter-bar');

    // --- Modales ---
    const modalOverlay = document.getElementById('gemini-modal-overlay');
    const modalContent = document.getElementById('modal-content');
    const modalCloseBtn = document.getElementById('modal-close-btn');
    const copyPlanBtn = document.getElementById('copy-plan-btn');
    const imageModalOverlay = document.getElementById('image-modal-overlay');
    const imageModalContent = document.getElementById('image-modal-content');
    const imageModalCloseBtn = document.querySelector('.image-modal-close-btn');
    // ... (otros selectores de modales si los hubiera)

    // =========================================================================
    // 3. FUNCIONES DE RENDERIZADO (CREACIÓN DE HTML)
    // =========================================================================

    function createSliderCard(event) {
        const eventCard = document.createElement('div');
        eventCard.className = 'event-card';
        eventCard.setAttribute('data-event-id', event._id);
        const artistName = sanitizeField(event.artist, 'Artista por confirmar');
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
        const eventVenue = sanitizeField(event.location?.venue, 'Ubicación no disponible');
        const eventDate = event.date ? new Date(event.date).toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' }) : 'Fecha no disponible';

        const blogUrl = event.blogPostUrl || 'https://afland.es/';
        const blogText = event.blogPostUrl ? 'Leer en el Blog' : 'Explorar Blog';
        const blogIcon = event.blogPostUrl ? 'fa-book-open' : 'fa-blog';
        const blogButtonClass = event.blogPostUrl ? 'blog-link-btn' : 'btn-blog-explorar';

        eventCard.innerHTML = `
            ${event.imageUrl ? `<div class="evento-card-img-container"><img src="${event.imageUrl}" alt="Imagen de ${eventName}" class="evento-card-img" onerror="this.parentElement.style.display='none'"></div>` : ''}
            <div class="card-header">
                <h3 class="titulo-truncado" title="${eventName}">${eventName}</h3>
            </div>
            <div class="artista"><i class="fas fa-user"></i> <span>${artistName}</span></div>
            <div class="descripcion-container">
                <p class="descripcion-corta">${description}</p>
            </div>
            <div class="card-detalles">
                <div class="evento-detalle"><i class="fas fa-calendar-alt"></i><span>${eventDate}</span></div>
                <div class="evento-detalle"><i class="fas fa-clock"></i><span>${eventTime}</span></div>
                <div class="evento-detalle"><i class="fas fa-map-marker-alt"></i><span>${eventVenue}</span></div>
            </div>
            <div class="card-actions">
                <div class="card-actions-primary">
                    <button class="gemini-btn" data-event-id="${event._id}"><i class="fas fa-magic"></i> Planear Noche</button>
                    <a href="${blogUrl}" target="_blank" rel="noopener noreferrer" class="${blogButtonClass}"><i class="fas ${blogIcon}"></i> ${blogText}</a>
                    <button class="share-button" data-event-id="${event._id}"><i class="fas fa-share-nodes"></i> Compartir</button>
                </div>
            </div>
        `;
        return eventCard;
    }

    // =========================================================================
    // 4. LÓGICA DE LA APLICACIÓN (FETCH, BÚSQUEDA, EVENTOS)
    // =========================================================================

    async function performSearch(params) {
        showSkeletonLoader();
        let url = `${API_BASE_URL}/api/events`;
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
                    return 0; // Mantener orden para el resto (p. ej., por fecha)
                });
            }
            displayEvents(eventsToShow, isSliderSearch);
        } catch (error) {
            console.error("Error en la búsqueda:", error);
            hideSkeletonLoader();
            if (statusMessage) statusMessage.textContent = 'Hubo un error al realizar la búsqueda.';
            showNotification('Error al realizar la búsqueda.', 'error');
        }
    }

    function displayEvents(events, shouldScroll = false) {
        hideSkeletonLoader();
        if (!resultsContainer) return;
        resultsContainer.innerHTML = '';
        eventsCache = {};
        if (!events || events.length === 0) {
            if (statusMessage) statusMessage.textContent = '';
            if (noResultsMessage) noResultsMessage.style.display = 'block';
            return;
        }
        if (statusMessage) statusMessage.textContent = '';
        if (noResultsMessage) noResultsMessage.style.display = 'none';

        const fragment = document.createDocumentFragment();
        events.forEach(event => {
            eventsCache[event._id] = event;
            fragment.appendChild(createEventCard(event));
        });
        resultsContainer.appendChild(fragment);

        if (shouldScroll) {
            const resultsSection = document.querySelector('.full-events-section');
            if (resultsSection) {
                resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        }
    }

    async function loadAndDisplaySliders() {
        try {
            const [featuredResponse, recentResponse] = await Promise.all([
                fetch(`${API_BASE_URL}/api/events?featured=true`),
                fetch(`${API_BASE_URL}/api/events?sort=date&order=desc&limit=10`)
            ]);
            if (!featuredResponse.ok || !recentResponse.ok) throw new Error('Fallo al cargar datos para sliders');

            const featuredData = await featuredResponse.json();
            const recentData = await recentResponse.json();

            if (featuredSlider && featuredData.events) {
                featuredSlider.innerHTML = '';
                featuredData.events.forEach(event => featuredSlider.appendChild(createSliderCard(event)));
            }
            if (recentSlider && recentData.events) {
                recentSlider.innerHTML = '';
                recentData.events.forEach(event => recentSlider.appendChild(createSliderCard(event)));
            }
        } catch (error) {
            console.error("Error al cargar los sliders:", error);
            // Opcional: Ocultar secciones de sliders si fallan
            if (featuredSlider) featuredSlider.parentElement.style.display = 'none';
            if (recentSlider) recentSlider.parentElement.style.display = 'none';
        }
    }

    // =========================================================================
    // 5. GESTORES DE EVENTOS (EVENT HANDLERS & LISTENERS)
    // =========================================================================

    function handleResultsContainerClick(event) {
        const geminiBtn = event.target.closest('.gemini-btn');
        const shareBtn = event.target.closest('.share-button');
        const image = event.target.closest('.evento-card-img');
        const clickedCard = event.target.closest('.event-card');

        // --- Acción: Planear Noche ---
        if (geminiBtn) {
            const eventId = geminiBtn.dataset.eventId;
            const eventData = eventsCache[eventId];
            if (eventData) getAndShowNightPlan(eventData);
            return;
        }

        // --- Acción: Compartir ---
        if (shareBtn) {
            // ... (Añadir lógica de compartir si se necesita) ...
            showNotification('Función de compartir próximamente.', 'info');
            return;
        }

        // --- Acción: Ampliar Imagen (solo en la ficha grande) ---
        if (image && !image.closest('.slider-container')) {
            if (imageModalContent) imageModalContent.src = image.src;
            if (imageModalOverlay) imageModalOverlay.style.display = 'flex';
            return;
        }

        // --- Acción: Clic en Tarjeta de Slider ---
        if (clickedCard && clickedCard.parentElement.classList.contains('slider-container')) {
            const eventId = clickedCard.dataset.eventId;
            const artistName = clickedCard.dataset.artistName;
            if (eventId && artistName) {
                performSearch({ artist: artistName, clickedId: eventId });
            }
        }
    }

    function setupEventListeners() {
        // Clics delegados en los contenedores
        if (resultsContainer) resultsContainer.addEventListener('click', handleResultsContainerClick);
        if (featuredSlider) featuredSlider.addEventListener('click', handleResultsContainerClick);
        if (recentSlider) recentSlider.addEventListener('click', handleResultsContainerClick);

        // Barra de filtros
        if (filterBar) {
            filterBar.addEventListener('click', (e) => {
                if (e.target.classList.contains('filter-chip')) {
                    filterBar.querySelectorAll('.filter-chip').forEach(btn => btn.classList.remove('active'));
                    const clickedButton = e.target;
                    clickedButton.classList.add('active');
                    const filterType = clickedButton.dataset.filter;
                    handleFilterClick(filterType);
                }
            });
        }

        // Botón "Volver Arriba"
        if (backToTopBtn) {
            window.addEventListener('scroll', () => {
                backToTopBtn.classList.toggle('visible', window.scrollY > 300);
            });
            backToTopBtn.addEventListener('click', () => {
                window.scrollTo({ top: 0, behavior: 'smooth' });
            });
        }

        // Cierres de Modales
        if (modalCloseBtn) modalCloseBtn.addEventListener('click', hideModal);
        if (modalOverlay) modalOverlay.addEventListener('click', (e) => { if (e.target === modalOverlay) hideModal(); });
        if (imageModalCloseBtn) imageModalCloseBtn.addEventListener('click', () => { if (imageModalOverlay) imageModalOverlay.style.display = 'none'; });
    }

    function handleFilterClick(filterType) {
        switch (filterType) {
            case 'todos':
                performSearch({});
                break;
            case 'cerca':
                geolocationSearch();
                break;
            case 'hoy':
                performSearch({ date: 'today' }); // API debe soportarlo
                break;
            case 'semana':
                performSearch({ dateRange: 'week' }); // API debe soportarlo
                break;
            case 'festivales':
                performSearch({ category: 'festival' }); // API debe soportarlo
                break;
        }
    }

    // =========================================================================
    // 6. FUNCIONES AUXILIARES (GEOLOCALIZACIÓN, MODALES, ETC.)
    // =========================================================================

    function geolocationSearch() {
        if (navigator.geolocation) {
            if (statusMessage) statusMessage.textContent = 'Buscando tu ubicación...';
            navigator.geolocation.getCurrentPosition(
                (position) => { // Success
                    const { latitude, longitude } = position.coords;
                    performSearch({ lat: latitude, lon: longitude, radius: 50 }); // radio de 50km
                },
                (error) => { // Error
                    console.error("Error de geolocalización:", error);
                    showNotification('No se pudo obtener tu ubicación.', 'error');
                }
            );
        } else {
            showNotification("La geolocalización no es soportada por tu navegador.", 'warning');
        }
    }

    function sanitizeField(value, defaultText = 'No disponible') {
        if (value && typeof value === 'string' && value.trim() && value.trim().toLowerCase() !== 'n/a') {
            return value.trim();
        }
        return defaultText;
    }

    async function getAndShowNightPlan(event) { /* ... (Sin cambios, pegar aquí si se necesita) ... */ }
    function showNotification(message, type = 'info') { /* ... (Sin cambios, pegar aquí si se necesita) ... */ }
    function showModal() { if (modalOverlay) modalOverlay.classList.add('visible'); }
    function hideModal() { if (modalOverlay) modalOverlay.classList.remove('visible'); }
    function showSkeletonLoader() { /* ... (Sin cambios, pegar aquí si se necesita) ... */ }
    function hideSkeletonLoader() { /* ... (Sin cambios, pegar aquí si se necesita) ... */ }

    // =========================================================================
    // 7. INICIALIZACIÓN
    // =========================================================================

    function init() {
        setupEventListeners();
        loadAndDisplaySliders();
        performSearch({}); // Carga inicial de todos los eventos
    }

    init();
});
