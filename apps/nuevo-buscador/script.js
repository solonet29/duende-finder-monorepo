import { CountUp } from './libs/countup.js';

document.addEventListener('DOMContentLoaded', () => {
    // =========================================================================
    // 1. CONFIGURACIÓN Y VARIABLES GLOBALES
    // =========================================================================
    const API_BASE_URL = (() => {
        const hostname = window.location.hostname;
        if (hostname.includes('localhost') || hostname.includes('127.0.0.1')) return 'http://localhost:3000';
        return 'https://api-v2.afland.es';
    })();

    let allEvents = [];
    let eventsCache = {};
    let map = null;
    let markersLayer = null;
    let markerEventMap = {};

    const mainContainer = document.getElementById('main-content');
    const headerContainer = document.querySelector('header.header-main .container');

    // =========================================================================
    // 2. ROUTER Y VISTAS
    // =========================================================================

    async function handleRouting() {
        const path = window.location.pathname;
        const eventPageMatch = path.match(/^\/eventos\/([a-f0-9]{24})/);

        if (eventPageMatch && eventPageMatch[1]) {
            const eventId = eventPageMatch[1];
            await showEventPageView(eventId);
        } else {
            await showDashboardView();
        }
    }

    function navigateTo(url) {
        history.pushState({ path: url }, '', url);
        handleRouting();
    }

    async function showDashboardView() {
        document.body.style.overflow = 'hidden';
        headerContainer.innerHTML = `
            <h1 class="main-title">Duende Finder</h1>
            <p id="event-counter" class="subtitle-counter">Cargando...</p>
            <nav id="category-filters" class="filter-bar">
                <button class="filter-chip active" data-filter="destacados">Destacados</button>
                <button class="filter-chip" data-filter="hoy">Hoy</button>
                <button class="filter-chip" data-filter="semana">Esta Semana</button>
                <button class="filter-chip" data-filter="cerca">Cerca de Mí</button>
            </nav>
        `;
        mainContainer.innerHTML = `
            <div id="content-wrapper">
                <div id="event-list-container"></div>
                <div id="map-container"></div>
            </div>
        `;
        
        initMap();
        if (allEvents.length === 0) {
            await loadAndRenderEvents();
        } else {
            const activeFilter = headerContainer.querySelector('.filter-chip.active')?.dataset.filter || 'destacados';
            await applyFilter(activeFilter);
        }
    }

    async function showEventPageView(eventId) {
        document.body.style.overflow = 'auto';
        headerContainer.innerHTML = `
            <nav class="event-page-nav">
                <a href="/" class="back-button">&larr; Volver a la lista</a>
            </nav>
        `;
        mainContainer.innerHTML = `<div class="loading-indicator">Cargando evento...</div>`;

        try {
            let event = eventsCache[eventId];
            if (!event) {
                const response = await fetch(`${API_BASE_URL}/api/events/${eventId}`);
                if (!response.ok) throw new Error('Evento no encontrado');
                event = await response.json();
                eventsCache[eventId] = event;
            }
            renderEventPage(event);
        } catch (error) {
            mainContainer.innerHTML = `<h2>Error al cargar el evento</h2>`;
        }
    }

    // =========================================================================
    // 3. LÓGICA DE FILTRADO Y DATOS (DASHBOARD)
    // =========================================================================

    async function applyFilter(filterType) {
        let filteredEvents = [];
        switch (filterType) {
            case 'destacados':
                filteredEvents = allEvents.filter(event => event.name.includes('Circuito Andaluz de Peñas'));
                break;
            case 'hoy':
                const today = new Date().toISOString().slice(0, 10);
                filteredEvents = allEvents.filter(event => event.date === today);
                break;
            case 'semana':
                const startOfWeek = new Date();
                startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay() + (startOfWeek.getDay() === 0 ? -6 : 1));
                const endOfWeek = new Date(startOfWeek);
                endOfWeek.setDate(endOfWeek.getDate() + 6);
                const startStr = startOfWeek.toISOString().slice(0, 10);
                const endStr = endOfWeek.toISOString().slice(0, 10);
                filteredEvents = allEvents.filter(event => event.date >= startStr && event.date <= endStr);
                break;
            case 'cerca':
                try {
                    document.getElementById('event-list-container').innerHTML = '<div class="loading-indicator">Obteniendo ubicación...</div>';
                    const userLocation = await getUserLocation();
                    const { latitude, longitude } = userLocation.coords;
                    filteredEvents = allEvents.map(event => {
                        if (event.location?.coordinates?.length === 2) {
                            const [eventLon, eventLat] = event.location.coordinates;
                            event.distance = calculateDistance(latitude, longitude, eventLat, eventLon);
                        } else {
                            event.distance = Infinity;
                        }
                        return event;
                    })
                    .filter(event => event.distance <= 100)
                    .sort((a, b) => a.distance - b.distance);
                } catch (error) {
                    alert('No se pudo obtener tu ubicación. Por favor, activa los permisos.');
                    filteredEvents = [];
                }
                break;
            default:
                filteredEvents = allEvents;
                break;
        }
        renderEventList(filteredEvents);
        renderMapMarkers(filteredEvents);
        updateEventCount(filteredEvents.length);
    }

    async function loadAndRenderEvents() {
        const eventListContainer = document.getElementById('event-list-container');
        if (!eventListContainer) return;
        eventListContainer.innerHTML = '<div class="loading-indicator">Cargando eventos...</div>';
        try {
            const response = await fetch(`${API_BASE_URL}/api/events?sort=date`);
            if (!response.ok) throw new Error('Error al cargar eventos');
            const data = await response.json();
            allEvents = data.events || [];
            eventsCache = allEvents.reduce((acc, event) => {
                acc[event._id] = event;
                return acc;
            }, {});
            await applyFilter('destacados');
        } catch (error) {
            if (eventListContainer) eventListContainer.innerHTML = '<h2>Oops! No se pudo cargar el contenido.</h2>';
        }
    }

    // =========================================================================
    // 4. FUNCIONES DE RENDERIZADO
    // =========================================================================

    function initMap() {
        const mapContainer = document.getElementById('map-container');
        if (mapContainer && !map) {
            map = L.map(mapContainer).setView([40.416775, -3.703790], 5);
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            }).addTo(map);
            markersLayer = L.layerGroup().addTo(map);
        }
    }

    function renderEventList(events) {
        const eventListContainer = document.getElementById('event-list-container');
        if (!eventListContainer) return;
        if (!events || events.length === 0) {
            eventListContainer.innerHTML = '<p style="text-align: center; padding: 20px;">No se encontraron eventos.</p>';
            return;
        }
        eventListContainer.innerHTML = '';
        events.forEach(event => {
            eventListContainer.appendChild(createEventCard(event));
        });
    }

    function renderMapMarkers(events) {
        if (!map || !markersLayer) return;
        markersLayer.clearLayers();
        markerEventMap = {};
        const markers = [];
        events.forEach(event => {
            if (event.location?.coordinates?.length === 2) {
                const [lon, lat] = event.location.coordinates;
                const marker = L.marker([lat, lon]);
                marker.bindPopup(`<b>${event.name}</b>`);
                marker.on('click', () => {
                    const card = document.querySelector(`.event-card[data-event-id="${event._id}"]`);
                    if (card) {
                        card.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        card.classList.add('highlighted');
                        setTimeout(() => card.classList.remove('highlighted'), 2500);
                    }
                });
                markersLayer.addLayer(marker);
                markers.push(marker);
                markerEventMap[event._id] = marker;
            }
        });
        if (markers.length > 0) {
            const group = new L.featureGroup(markers);
            map.fitBounds(group.getBounds().pad(0.2));
        }
    }

    function createEventCard(event) {
        const eventCard = document.createElement('a');
        eventCard.className = 'event-card';
        eventCard.setAttribute('data-event-id', event._id);
        eventCard.href = `/eventos/${event._id}-${(event.name || 'evento').toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
        const eventDate = event.date ? new Date(event.date + 'T00:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'long' }) : '';
        eventCard.innerHTML = `
            <div class="card-image" style="background-image: url('${event.imageUrl || './assets/flamenco-placeholder.png'}')"></div>
            <div class="card-content">
                <h3 class="card-title">${event.name || 'Evento sin nombre'}</h3>
                <p class="card-artist">${event.artist || 'Artista por confirmar'}</p>
                <div class="card-details">
                    <span><ion-icon name="location-outline"></ion-icon> ${event.city || ''}</span>
                    <span><ion-icon name="calendar-outline"></ion-icon> ${eventDate}</span>
                </div>
            </div>
        `;
        return eventCard;
    }

    function renderEventPage(event) {
        const eventName = event.name || 'Evento sin título';
        const displayLocation = `${event.venue || ''}, ${event.city || ''}`.replace(/^,|,$/g, '');
        const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${eventName}, ${displayLocation}`)}`;
        mainContainer.innerHTML = `
            <div class="event-page-container">
                <img src="${event.imageUrl || './assets/flamenco-placeholder.png'}" alt="Imagen de ${eventName}" class="event-page-image">
                <div class="event-page-content">
                    <h1>${eventName}</h1>
                    <p class="artist-name">${event.artist || 'Artista por confirmar'}</p>
                    <div class="event-details-grid">
                        <div><ion-icon name="calendar-outline"></ion-icon> ${event.date ? new Date(event.date + 'T00:00:00').toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' }) : 'Fecha no disponible'}</div>
                        <div><a href="${mapsUrl}" target="_blank"><ion-icon name="location-outline"></ion-icon> ${displayLocation}</a></div>
                    </div>
                    <p class="description">${event.description || 'Sin descripción disponible.'}</p>
                    <div class="event-page-actions">
                        <a href="${event.blogPostUrl || 'https://afland.es/'}" target="_blank" class="action-btn blog-btn">Leer en el Blog</a>
                        <div class="share-section">
                            <button class="action-btn share-btn-main">Compartir <ion-icon name="share-social-outline"></ion-icon></button>
                            <div class="share-options">
                                <a href="#" class="share-option-btn" data-social="twitter"><ion-icon name="logo-twitter"></ion-icon></a>
                                <a href="#" class="share-option-btn" data-social="facebook"><ion-icon name="logo-facebook"></ion-icon></a>
                                <a href="#" class="share-option-btn" data-social="whatsapp"><ion-icon name="logo-whatsapp"></ion-icon></a>
                                <a href="#" class="share-option-btn" data-social="copy"><ion-icon name="copy-outline"></ion-icon></a>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    function updateEventCount(count) {
        const eventCounter = document.getElementById('event-counter');
        if (!eventCounter) return;
        const suffix = count === 1 ? ' evento encontrado' : ' eventos encontrados';
        const countUp = new CountUp(eventCounter, count, { prefix: '+', suffix, duration: 1.5, separator: '.' });
        if (!countUp.error) countUp.start();
        else eventCounter.textContent = `+${count}${suffix}`;
    }

    // =========================================================================
    // 5. MANEJADORES DE EVENTOS
    // =========================================================================

    function setupGlobalListeners() {
        document.body.addEventListener('click', e => {
            // Navegación
            const backButton = e.target.closest('.back-button');
            if (backButton) {
                e.preventDefault();
                history.back();
                return;
            }
            const eventCard = e.target.closest('.event-card');
            if (eventCard) {
                e.preventDefault();
                navigateTo(eventCard.href);
                return;
            }

            // Filtros Dashboard
            const filterButton = e.target.closest('#category-filters .filter-chip');
            if (filterButton && !filterButton.classList.contains('active')) {
                document.querySelector('#category-filters .active')?.classList.remove('active');
                filterButton.classList.add('active');
                applyFilter(filterButton.dataset.filter);
                return;
            }

            // Acciones Página de Evento
            const shareMainBtn = e.target.closest('.share-btn-main');
            if (shareMainBtn) {
                shareMainBtn.nextElementSibling.classList.toggle('active');
                return;
            }
            const shareOptionBtn = e.target.closest('.share-option-btn');
            if (shareOptionBtn) {
                e.preventDefault();
                handleShare(shareOptionBtn.dataset.social);
                return;
            }
        });

        document.body.addEventListener('mouseover', e => {
            const eventCard = e.target.closest('#event-list-container .event-card');
            if (eventCard && eventCard.dataset.eventId) {
                const marker = markerEventMap[eventCard.dataset.eventId];
                if (marker) marker.openPopup();
            }
        });

        document.body.addEventListener('mouseout', e => {
            const eventCard = e.target.closest('#event-list-container .event-card');
            if (eventCard && eventCard.dataset.eventId) {
                const marker = markerEventMap[eventCard.dataset.eventId];
                if (marker) marker.closePopup();
            }
        });
    }

    function handleShare(social) {
        const url = window.location.href;
        const text = document.title;
        let shareUrl;

        switch (social) {
            case 'twitter':
                shareUrl = `https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`;
                break;
            case 'facebook':
                shareUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`;
                break;
            case 'whatsapp':
                shareUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(text + ' ' + url)}`;
                break;
            case 'copy':
                navigator.clipboard.writeText(url).then(() => alert('¡Enlace copiado!'));
                return;
        }
        if (shareUrl) window.open(shareUrl, '_blank');
    }

    // =========================================================================
    // 6. INICIALIZACIÓN
    // =========================================================================

    function init() {
        setupGlobalListeners();
        window.addEventListener('popstate', handleRouting);
        handleRouting(); // Maneja la carga inicial de la página
    }

    // =========================================================================
    // 7. FUNCIONES AUXILIARES
    // =========================================================================
    function getUserLocation() {
        return new Promise((resolve, reject) => {
            if (!navigator.geolocation) return reject(new Error('Geolocalización no soportada.'));
            navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 });
        });
    }

    function calculateDistance(lat1, lon1, lat2, lon2) {
        const R = 6371;
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a = 0.5 - Math.cos(dLat) / 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * (1 - Math.cos(dLon)) / 2;
        return R * 2 * Math.asin(Math.sqrt(a));
    }

    init();
});
