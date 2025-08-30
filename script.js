document.addEventListener('DOMContentLoaded', () => {
    // =========================================================================
    // 1. CONFIGURACIÓN Y VARIABLES GLOBALES
    // =========================================================================
    const API_BASE_URL = window.location.hostname.includes('localhost') ? 'http://localhost:3000' : '';
    let eventsCache = {};

    // =========================================================================
    // 2. SELECTORES DEL DOM
    // =========================================================================
    const resultsContainer = document.getElementById('resultsContainer');
    const skeletonContainer = document.getElementById('skeleton-container');
    const statusMessage = document.getElementById('statusMessage');
    const noResultsMessage = document.getElementById('no-results-message');
    const resultsTitle = document.getElementById('results-title');
    const featuredSlider = document.getElementById('featured-events-slider');
    const recentSlider = document.getElementById('recent-events-slider');
    const filterBar = document.querySelector('.filter-bar');

    // --- Barra de Navegación Inferior ---
    const navHomeBtn = document.getElementById('nav-home-btn');
    const navHowItWorksBtn = document.getElementById('nav-how-it-works-btn');
    const navTermsBtn = document.getElementById('nav-terms-btn');
    const navThemeToggle = document.getElementById('nav-theme-toggle');

    // --- Modales ---
    const howItWorksModal = document.getElementById('how-it-works-modal-overlay');
    const termsModal = document.getElementById('terms-modal-overlay');
    const geminiModalOverlay = document.getElementById('gemini-modal-overlay');
    const modalContent = document.getElementById('modal-content');

    // =========================================================================
    // 3. FUNCIONES DE RENDERIZADO
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
        // --- LÍNEA DE DEPURACIÓN AÑADIDA ---
        // Esto nos mostrará en la consola el contenido exacto de event.location para cada tarjeta.
        if (event.name.includes("Cordobes")) { // Filtramos para ver solo el evento problemático
            console.log("Datos de ubicación para el evento:", event.name, event.location);
        }

        const eventCard = document.createElement('article');
        eventCard.className = 'evento-card';
        eventCard.setAttribute('data-event-id', event._id);

        const eventName = sanitizeField(event.name, 'Evento sin título');
        const artistName = sanitizeField(event.artist, 'Artista por confirmar');
        const description = sanitizeField(event.description, 'Sin descripción disponible.');
        const eventTime = sanitizeField(event.time, 'No disponible');
        const eventDate = event.date ? new Date(event.date).toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' }) : 'Fecha no disponible';

        const venue = sanitizeField(event.venue, '');
        const city = sanitizeField(event.city, '');

        let displayLocation = 'Ubicación no disponible';
        if (venue && city) {
            displayLocation = `${venue}, ${city}`;
        } else if (venue || city) {
            displayLocation = venue || city;
        }

        const mapQuery = [eventName, venue, city, sanitizeField(event.country, '')].filter(Boolean).join(', ');
        const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapQuery)}`;

        const blogUrl = event.blogPostUrl || 'https://afland.es/';
        const blogText = event.blogPostUrl ? 'Leer en el Blog' : 'Explorar Blog';
        const blogIcon = event.blogPostUrl ? 'book-outline' : 'newspaper-outline';
        const blogButtonClass = event.blogPostUrl ? 'blog-link-btn' : 'btn-blog-explorar';

        eventCard.innerHTML = `
        ${event.imageUrl ? `<div class="evento-card-img-container"><img src="${event.imageUrl}" alt="Imagen de ${eventName}" class="evento-card-img" onerror="this.parentElement.style.display='none'"></div>` : ''}
        <div class="card-header">
            <h3 class="titulo-truncado" title="${eventName}">${eventName}</h3>
        </div>
        <div class="artista"><ion-icon name="person-outline"></ion-icon> <span>${artistName}</span></div>
        <div class="descripcion-container">
            <p class="descripcion-corta">${description}</p>
        </div>
        <div class="card-detalles">
            <div class="evento-detalle"><ion-icon name="calendar-outline"></ion-icon><span>${eventDate}</span></div>
            <div class="evento-detalle"><ion-icon name="time-outline"></ion-icon><span>${eventTime}</span></div>
            <div class="evento-detalle">
                <a href="${mapsUrl}" target="_blank" rel="noopener noreferrer">
                    <ion-icon name="location-outline"></ion-icon>
                    <span>${displayLocation}</span>
                </a>
            </div>
        </div>
        <div class="card-actions">
            <div class="card-actions-primary">
                <button class="gemini-btn" data-event-id="${event._id}"><ion-icon name="sparkles-outline"></ion-icon> Planear Noche</button>
                <a href="${blogUrl}" target="_blank" rel="noopener noreferrer" class="${blogButtonClass}"><ion-icon name="${blogIcon}"></ion-icon> ${blogText}</a>
                <button class="share-button" data-event-id="${event._id}"><ion-icon name="share-social-outline"></ion-icon> Compartir</button>
            </div>
        </div>
    `;
        return eventCard;
    }

    // =========================================================================
    // 4. LÓGICA DE LA APLICACIÓN-
    // =========================================================================
    async function performSearch(params) {
        showSkeletonLoader();
        let url = `${API_BASE_URL}/api/events`;
        const shouldScroll = !!params.clickedId || params.source === 'filter';
        const apiParams = { ...params };
        delete apiParams.clickedId;
        delete apiParams.source;
        const queryParams = new URLSearchParams(apiParams).toString();
        if (queryParams) { url += `?${queryParams}`; }
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
            displayEvents(eventsToShow, shouldScroll);
        } catch (error) {
            console.error("Error en la búsqueda:", error);
            hideSkeletonLoader();
            if (statusMessage) statusMessage.textContent = 'Hubo un error al realizar la búsqueda.';
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
            if (featuredSlider) featuredSlider.parentElement.style.display = 'none';
            if (recentSlider) recentSlider.parentElement.style.display = 'none';
        }
    }

    // =========================================================================
    // 5. GESTORES DE EVENTOS Y LISTENERS
    // =========================================================================
    function handleResultsContainerClick(event) {
        const geminiBtn = event.target.closest('.gemini-btn');
        const shareBtn = event.target.closest('.share-button');
        const image = event.target.closest('.evento-card-img');
        const clickedCard = event.target.closest('.event-card');
        if (geminiBtn) {
            const eventId = geminiBtn.dataset.eventId;
            const eventData = eventsCache[eventId];
            if (eventData) getAndShowNightPlan(eventData);
            return;
        }
        if (shareBtn) {
            showNotification('Función de compartir próximamente.', 'info');
            return;
        }
        if (image && !image.closest('.slider-container')) {
            if (imageModalContent) imageModalContent.src = image.src;
            if (imageModalOverlay) imageModalOverlay.style.display = 'flex';
            return;
        }
        if (clickedCard && clickedCard.parentElement.classList.contains('slider-container')) {
            const eventId = clickedCard.dataset.eventId;
            const artistName = clickedCard.dataset.artistName;
            if (eventId && artistName) {
                performSearch({ artist: artistName, clickedId: eventId });
            }
        }
    }

    function setupEventListeners() {
        if (resultsContainer) resultsContainer.addEventListener('click', handleResultsContainerClick);
        if (featuredSlider) featuredSlider.addEventListener('click', handleResultsContainerClick);
        if (recentSlider) recentSlider.addEventListener('click', handleResultsContainerClick);

        if (filterBar) {
            filterBar.addEventListener('click', (e) => {
                if (e.target.classList.contains('filter-chip')) {
                    filterBar.querySelectorAll('.filter-chip').forEach(btn => btn.classList.remove('active'));
                    e.target.classList.add('active');
                    const filterType = e.target.dataset.filter;
                    handleFilterClick(filterType);
                }
            });
        }

        if (navHomeBtn) {
            navHomeBtn.addEventListener('click', () => {
                performSearch({});
                window.scrollTo({ top: 0, behavior: 'smooth' });
                if (filterBar) {
                    filterBar.querySelectorAll('.filter-chip').forEach(btn => btn.classList.remove('active'));
                    const todosFilter = filterBar.querySelector('[data-filter="todos"]');
                    if (todosFilter) todosFilter.classList.add('active');
                }
                if (resultsTitle) resultsTitle.textContent = 'Todos los Eventos';
            });
        }
        if (navThemeToggle) {
            navThemeToggle.addEventListener('click', () => {
                const currentTheme = document.documentElement.getAttribute('data-theme');
                applyTheme(currentTheme === 'dark' ? 'light' : 'dark');
            });
        }
        if (navHowItWorksBtn) {
            navHowItWorksBtn.addEventListener('click', () => howItWorksModal?.classList.add('visible'));
        }
        if (navTermsBtn) {
            navTermsBtn.addEventListener('click', () => termsModal?.classList.add('visible'));
        }

        document.querySelectorAll('.modal-overlay').forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal || e.target.classList.contains('modal-close-btn')) {
                    modal.classList.remove('visible');
                }
            });
        });
    }

    function handleFilterClick(filterType) {
        if (navHomeBtn) {
            navHomeBtn.classList.toggle('active', filterType === 'todos');
        }
        if (!resultsTitle) return;
        switch (filterType) {
            case 'todos':
                resultsTitle.textContent = 'Todos los Eventos';
                performSearch({ source: 'filter' });
                break;
            case 'cerca':
                resultsTitle.textContent = 'Eventos Cerca de Ti 📍';
                geolocationSearch();
                break;
            case 'hoy':
                resultsTitle.textContent = 'Eventos para Hoy 📅';
                performSearch({ date: 'today', source: 'filter' });
                break;
            case 'semana':
                resultsTitle.textContent = 'Eventos de Esta Semana 🗓️';
                performSearch({ dateRange: 'week', source: 'filter' });
                break;
            case 'festivales':
                resultsTitle.textContent = 'Festivales Flamencos 🎪';
                performSearch({ category: 'festival', source: 'filter' });
                break;
        }
    }

    // =========================================================================
    // 6. FUNCIONES AUXILIARES
    // =========================================================================

    function geolocationSearch() {
        if (navigator.geolocation) {
            if (statusMessage) statusMessage.textContent = 'Buscando tu ubicación...';
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    const { latitude, longitude } = position.coords;
                    performSearch({ lat: latitude, lon: longitude, radius: 50 });
                },
                (error) => {
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

    function applyTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('duende-theme', theme);
        if (navThemeToggle) {
            const icon = navThemeToggle.querySelector('ion-icon'); // Buscamos ion-icon
            if (icon) {
                // Cambiamos el atributo 'name' en lugar de la clase
                icon.setAttribute('name', theme === 'dark' ? 'moon-outline' : 'sunny-outline');
            }
        }
    }

    async function getAndShowNightPlan(event) {
        if (!geminiModalOverlay || !modalContent) return;
        geminiModalOverlay.classList.add('visible');
        modalContent.innerHTML = `<div class="loader-container"><div class="loader"></div><p>Un momento, el duende está afinando la guitarra...</p></div>`;
        try {
            const response = await fetch(`${API_BASE_URL}/api/generate-night-plan?eventId=${event._id}`);
            if (!response.ok) throw new Error('La respuesta del servidor no fue OK');
            const data = await response.json();
            if (window.marked) {
                modalContent.innerHTML = marked.parse(data.content);
            } else {
                modalContent.innerHTML = `<pre style="white-space: pre-wrap;">${data.content}</pre>`;
            }
        } catch (error) {
            console.error("Error al generar el Plan Noche:", error);
            modalContent.innerHTML = `<div class="error-message"><h3>¡Vaya! El duende se ha despistado.</h3><p>No se pudo generar el plan. Inténtalo de nuevo más tarde.</p></div>`;
        }
    }

    function showNotification(message, type = 'info') {
        let notificationContainer = document.getElementById('notification-container');
        if (!notificationContainer) {
            notificationContainer = document.createElement('div');
            notificationContainer.id = 'notification-container';
            document.body.appendChild(notificationContainer);
        }
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;
        notificationContainer.appendChild(notification);
        setTimeout(() => {
            notification.classList.add('hide');
            notification.addEventListener('transitionend', () => notification.remove());
        }, 5000);
    }

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

    // =========================================================================
    // 7. INICIALIZACIÓN
    // =========================================================================

    function init() {
        const savedTheme = localStorage.getItem('duende-theme') || 'dark';
        applyTheme(savedTheme);
        setupEventListeners();
        loadAndDisplaySliders();
        performSearch({});
    }

    init();
});