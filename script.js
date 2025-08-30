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
        const eventCard = document.createElement('div');
        eventCard.className = 'event-card';
        eventCard.setAttribute('data-event-id', event._id);
        const placeholderUrl = 'https://placehold.co/280x160/121212/7f8c8d?text=Flamenco';
        const eventImageUrl = event.imageUrl || placeholderUrl;
        const artistName = sanitizeField(event.artist, 'Artista por confirmar');
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
        eventCard.className = 'evento-card'; // Usaremos una clase diferente para la ficha completa
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

    function displayNightPlan(planData) {
        if (window.marked) {
            modalContent.innerHTML = marked.parse(planData.content);
        } else {
            console.warn("Librería 'marked.js' no encontrada. Mostrando texto plano.");
            modalContent.innerHTML = `<pre style="white-space: pre-wrap;">${planData.content}</pre>`;
        }
        const newBannersHtml = `
            <div class="banner-container" style="text-align: center; margin: 30px 0;">
                <a href="#"><img src="${BANNER_URL_M2}" alt="Publicidad para restaurantes y tablaos flamencos" style="max-width: 100%; height: auto; margin-bottom: 20px;" /></a>
                <a href="#"><img src="${BANNER_URL_M3}" alt="Publicidad para hoteles y alojamientos con encanto" style="max-width: 100%; height: auto;" /></a>
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
        }
    }

    function displayEvents(events) {
        hideSkeletonLoader();
        resultsContainer.innerHTML = '';
        eventsCache = {};
        if (!events || events.length === 0) {
            statusMessage.textContent = 'No se encontraron eventos que coincidan con tu búsqueda.';
            noResultsMessage.style.display = 'block';
            if (totalEventsSpan) totalEventsSpan.parentElement.style.display = 'none';
            return;
        }
        statusMessage.textContent = '';
        noResultsMessage.style.display = 'none';
        if (totalEventsSpan) {
            totalEventsSpan.parentElement.style.display = 'block';
            totalEventsSpan.textContent = events.length;
        }
        const fragment = document.createDocumentFragment();
        events.forEach(event => {
            eventsCache[event._id] = event;
            fragment.appendChild(createEventCard(event));
        });

        // <-- CORREGIDO: Esta línea AHORA ESTÁ FUERA del bucle forEach
        resultsContainer.appendChild(fragment);

        // <-- CORREGIDO: Esta lógica AHORA ESTÁ FUERA del bucle forEach
        if (events.length === 1) {
            const resultsSection = document.querySelector('.full-events-section');
            if (resultsSection) resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }

    // <-- CORREGIDO: Eliminada la llave '}' que sobraba aquí.

    // --- LÓGICA DE BÚSQUEDA Y MANEJO DE EVENTOS ---

    // --- LÓGICA DE BÚSQUEDA Y MANEJO DE EVENTOS ---

    // --- LÓGICA DE BÚSQUEDA Y MANEJO DE EVENTOS ---

    async function performSearch(params) {
        showSkeletonLoader();

        let url = `${API_BASE_URL}/api/events`;
        let isSingleEventSearch = false; // <-- Variable de control

        // Si el parámetro 'params' contiene un _id, construimos una URL diferente
        if (params._id) {
            url = `${API_BASE_URL}/api/events/${params._id}`;
            isSingleEventSearch = true; // <-- Marcamos que es una búsqueda individual
        }
        // Si no, construimos la URL con parámetros de búsqueda normales.
        else {
            const queryParams = new URLSearchParams(params).toString();
            if (queryParams) {
                url += `?${queryParams}`;
            }
        }

        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error(`Error del servidor: ${response.statusText}`);

            const data = await response.json();

            // --- LÍNEA CLAVE CORREGIDA ---
            // Si es una búsqueda de un solo evento, 'data' es el evento. Lo metemos en un array.
            // Si es una búsqueda general, los eventos están en 'data.events'.
            const eventsToShow = isSingleEventSearch ? [data] : data.events || [];

            displayEvents(eventsToShow);

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
        const clickedCard = event.target.closest('.event-card');

        if (geminiBtn) {
            const eventId = geminiBtn.dataset.eventId;
            const eventData = eventsCache[eventId];
            if (eventData) getAndShowNightPlan(eventData);
            return;
        }

        if (shareBtn) {
            // Lógica de compartir...
            return;
        }

        if (image) {
            imageModalContent.src = image.src;
            imageModalOverlay.style.display = 'flex';
            return;
        }

        if (clickedCard && clickedCard.parentElement.classList.contains('slider-container')) {
            const eventId = clickedCard.dataset.eventId;
            if (eventId) {
                const slidersSection = document.querySelector('.sliders-section');
                if (slidersSection) slidersSection.style.display = 'none';
                performSearch({ _id: eventId });
            }
        }
    }

    // --- EVENT LISTENERS ---

    // --- EVENT LISTENERS ---

    function setupEventListeners() {
        // Para cada elemento, comprobamos si existe (!= null) antes de añadir el listener.
        if (searchForm) {
            searchForm.addEventListener('submit', (e) => {
                e.preventDefault();
                performSearch({ search: searchInput.value.trim() });
            });
        }

        if (nearbyEventsBtn) {
            nearbyEventsBtn.addEventListener('click', () => {
                if (navigator.geolocation) {
                    statusMessage.textContent = 'Buscando tu ubicación...';
                    navigator.geolocation.getCurrentPosition(geolocationSuccess, geolocationError, { timeout: 5000 });
                } else {
                    showNotification("La geolocalización no es soportada por tu navegador.", 'warning');
                }
            });
        }

        if (resultsContainer) {
            resultsContainer.addEventListener('click', handleResultsContainerClick);
        }

        if (featuredSlider) {
            featuredSlider.addEventListener('click', handleResultsContainerClick);
        }

        if (recentSlider) {
            recentSlider.addEventListener('click', handleResultsContainerClick);
        }

        if (modalCloseBtn) {
            modalCloseBtn.addEventListener('click', hideModal);
        }

        if (modalOverlay) {
            modalOverlay.addEventListener('click', (e) => { if (e.target === modalOverlay) hideModal(); });
        }

        if (copyPlanBtn) {
            copyPlanBtn.addEventListener('click', () => {
                const planText = modalContent.innerText;
                navigator.clipboard.writeText(planText)
                    .then(() => showNotification('¡Plan copiado al portapapeles!', 'success'))
                    .catch(err => {
                        console.error('Error al copiar: ', err);
                        showNotification('No se pudo copiar el plan.', 'error');
                    });
            });
        }

        if (imageModalOverlay) {
            imageModalOverlay.addEventListener('click', () => { imageModalOverlay.style.display = 'none'; });
        }

        if (imageModalCloseBtn) {
            imageModalCloseBtn.addEventListener('click', () => { imageModalOverlay.style.display = 'none'; });
        }

        const viewAllBtn = document.getElementById('view-all-btn');
        if (viewAllBtn) {
            viewAllBtn.addEventListener('click', () => {
                if (searchInput) searchInput.value = '';
                // Hacemos que la sección de sliders vuelva a aparecer si estaba oculta
                const slidersSection = document.querySelector('.sliders-section');
                if (slidersSection) slidersSection.style.display = 'block';
                performSearch({});
            });
        }
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
        performSearch({});
    }

    init();

}); // <-- CORREGIDO: Faltaba el paréntesis y el punto y coma final.