document.addEventListener('DOMContentLoaded', () => {
    // --- CONSTANTES Y VARIABLES GLOBALES ---
    const PRODUCTION_API_URL = 'https://duende-api-next.vercel.app';
    const DEVELOPMENT_API_URL = 'http://localhost:3000'; // Unificado a localhost
    const API_BASE_URL = window.location.hostname.includes('localhost') || window.location.hostname.includes('127.0.0.1') || window.location.hostname.includes('0.0.0.0')
        ? DEVELOPMENT_API_URL
        : PRODUCTION_API_URL;

    // URLs de los banners de monetización (asegúrate de que estas URLs son correctas)
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

    function showModal() { modalOverlay.classList.add('visible'); }
    function hideModal() { modalOverlay.classList.remove('visible'); }

    // --- CREACIÓN DE ELEMENTOS DINÁMICOS ---

    function createSliderCard(event) {
        // Primero, creamos el contenedor principal de la tarjeta
        const eventCard = document.createElement('div');
        eventCard.className = 'event-card';
        eventCard.setAttribute('data-event-id', event._id);

        // Luego, definimos las URLs de las imágenes
        const placeholderUrl = 'https://placehold.co/280x160/121212/7f8c8d?text=Flamenco';
        const eventImageUrl = event.imageUrl || placeholderUrl;

        // Después, preparamos los textos que vamos a mostrar
        const title = sanitizeField(event.title, 'Evento Flamenco');
        const date = event.date ? new Date(event.date).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }) : 'Fecha por confirmar';
        const venue = sanitizeField(event.location?.venue, 'Lugar por confirmar');

        // ===================================================================
        // AQUÍ VA INTEGRADO TU CÓDIGO
        // Esta parte "rellena" la tarjeta con el HTML y los datos
        eventCard.innerHTML = `
        <img src="${eventImageUrl}" alt="${title}" class="card-image" onerror="this.src='${placeholderUrl}'">
        <div class="card-content">
            <h3 class="card-title">${title}</h3>
            <p class="card-date">${date}</p>
            <p class="card-location">${venue}</p>
        </div>
    `;
        // ===================================================================

        // Finalmente, la función devuelve la tarjeta ya creada y lista para usar.
        return eventCard;
    }

    function createEventCard(event) {
        const eventCard = document.createElement('div');
        eventCard.className = 'event-card';
        eventCard.setAttribute('data-event-id', event._id);
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

    function displayNightPlan(planData) {
        if (window.marked) {
            modalContent.innerHTML = marked.parse(planData.content);
        } else {
            console.warn("Librería 'marked.js' no encontrada. Mostrando texto plano.");
            modalContent.innerHTML = `<pre style="white-space: pre-wrap;">${planData.content}</pre>`;
        }

        // Inyectar banners de monetización
        const newBannersHtml = `
            <div class="banner-container" style="text-align: center; margin: 30px 0;">
                <a href="#">
                    <img src="${BANNER_URL_M2}" alt="Publicidad para restaurantes y tablaos flamencos" style="max-width: 100%; height: auto; margin-bottom: 20px;" />
                </a>
                <a href="#">
                    <img src="${BANNER_URL_M3}" alt="Publicidad para hoteles y alojamientos con encanto" style="max-width: 100%; height: auto;" />
                </a>
            </div>
        `;
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = newBannersHtml;
        modalContent.appendChild(tempDiv.firstChild);

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

    // --- CARGA Y RENDERIZADO DE SLIDERS Y EVENTOS PRINCIPALES ---

    async function loadAndDisplaySliders() {
        try {
            const [featuredResponse, recentResponse] = await Promise.all([
                fetch(`${API_BASE_URL}/api/events?featured=true`),
                fetch(`${API_BASE_URL}/api/events?sort=date&order=desc`)
            ]);

            const featuredEvents = await featuredResponse.json();
            const recentEvents = await recentResponse.json();

            featuredSlider.innerHTML = '';
            recentSlider.innerHTML = '';

            featuredEvents.events.forEach(event => featuredSlider.appendChild(createSliderCard(event)));
            recentEvents.events.forEach(event => recentSlider.appendChild(createSliderCard(event)));

        } catch (error) {
            console.error("Error al cargar los sliders:", error);
            // Si los sliders fallan, no detenemos la carga del resto
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

    // --- LÓGICA DE BÚSQUEDA Y MANEJO DE EVENTOS ---

    async function performSearch(params) {
        showSkeletonLoader();
        try {
            const response = await fetch(`${API_BASE_URL}/api/events?${new URLSearchParams(params).toString()}`);
            if (!response.ok) throw new Error(`Error del servidor: ${response.statusText}`);
            const data = await response.json();
            displayEvents(data.events || data);
        } catch (error) {
            console.error("Error en la búsqueda:", error);
            hideSkeletonLoader();
            statusMessage.textContent = 'Hubo un error al realizar la búsqueda.';
            showNotification('Error al realizar la búsqueda.', 'error');
        }
    }

    function handleResultsContainerClick(event) {
        const geminiBtn = event.target.closest('.gemini-btn');
        const shareBtn = event.target.closest('.share-button');
        const image = event.target.closest('.evento-card-img');
        const sliderCard = event.target.closest('.slider-card');

        if (geminiBtn) {
            const eventId = geminiBtn.dataset.eventId;
            const eventData = eventsCache[eventId];
            if (eventData) getAndShowNightPlan(eventData);
        }

        if (shareBtn) {
            const eventId = shareBtn.dataset.eventId;
            const eventData = eventsCache[eventId];
            if (eventData && navigator.share) {
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

        // Nueva lógica para los sliders
        if (sliderCard) {
            const eventId = sliderCard.dataset.eventId;
            const eventData = eventsCache[eventId];
            if (eventData) {
                // Navegar a la sección de eventos principales y mostrar el esqueleto de búsqueda
                mainContainer.classList.add('results-active');
                performSearch({ _id: eventId });
            }
        }
    }

    // --- EVENT LISTENERS ---

    function setupEventListeners() {
        searchForm.addEventListener('submit', (e) => {
            e.preventDefault();
            performSearch({ search: searchInput.value.trim() });
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

        // Agregamos el listener para los nuevos sliders
        featuredSlider.addEventListener('click', handleResultsContainerClick);
        recentSlider.addEventListener('click', handleResultsContainerClick);

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

        imageModalOverlay.addEventListener('click', () => { imageModalOverlay.style.display = 'none'; });
        imageModalCloseBtn.addEventListener('click', () => { imageModalOverlay.style.display = 'none'; });

        document.getElementById('view-all-btn').addEventListener('click', () => {
            searchInput.value = '';
            performSearch({});
        });
    }

    // --- LÓGICA DE GEOLOCALIZACIÓN ---

    function geolocationSuccess(position) {
        const { latitude, longitude } = position.coords;
        performSearch({ lat: latitude, lon: longitude, radius: 60 });
    }

    function geolocationError(error) {
        console.error("Error de geolocalización:", error);
        showNotification('No se pudo obtener tu ubicación. Mostrando eventos generales.', 'error');
        performSearch({});
    }

    // --- INICIALIZACIÓN DE LA APLICACIÓN ---

    function init() {
        setupEventListeners();
        loadAndDisplaySliders();
        performSearch({}); // Carga todos los eventos en la grilla principal por defecto
    }

    init();
});
