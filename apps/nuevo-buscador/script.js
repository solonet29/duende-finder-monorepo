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
    let currentFilteredEvents = [];
    let currentPage = 1;
    const EVENTS_PER_PAGE = 10;
    let isLoadingMore = false;
    let eventsCache = {};
    let map = null;
    let markersLayer = null;
    let markerEventMap = {};

    // =========================================================================
    // 2. ROUTER Y VISTAS
    // =========================================================================

    async function handleRouting() {
        const path = window.location.pathname;
        // Expresión regular mejorada para capturar el ID de evento de una URL con slug opcional.
        // Ej: /eventos/nombre-evento-12345 o /eventos/12345
        const eventPageMatch = path.match(/^\/eventos\/(?:[a-z0-9-]+\-)?([a-f0-9]{24})$/);
        if (eventPageMatch && eventPageMatch[1]) { // El ID del evento es el primer grupo capturado
            await showEventPageView(eventPageMatch[1]);
        } else {
            await showDashboardView();
        }
    }

    function navigateTo(url, options = {}) {
        const { replace = false } = options;
        const state = { path: url };
        if (replace) {
            // Reemplaza la entrada actual en el historial, útil para fallbacks sin crear un bucle de "atrás".
            history.replaceState(state, '', url);
        } else {
            // Añade una nueva entrada al historial, para la navegación normal.
            history.pushState(state, '', url);
        }
        handleRouting();
    }

    async function showDashboardView() {
        clearMetaTags();
        clearStructuredData();
        document.body.classList.remove('view-detail');
        document.querySelector('header.header-main .container').innerHTML = `
            <h1 class="main-title">Duende Finder</h1>
            <p id="event-counter" class="subtitle-counter">Cargando...</p>
            <nav id="category-filters" class="filter-bar">
                <button class="filter-chip active" data-filter="destacados">Destacados</button>
                <button class="filter-chip" data-filter="hoy">Hoy</button>
                <button class="filter-chip" data-filter="semana">Esta Semana</button>
                <button class="filter-chip" data-filter="cerca">Cerca de Mí</button>
            </nav>
        `;
        document.getElementById('main-content').innerHTML = `
            <div id="list-wrapper">
                <div class="map-view-toggle-wrapper">
                    <button id="show-map-btn" class="map-view-toggle-btn"><ion-icon name="map-outline"></ion-icon> Ver en el Mapa</button>
                </div>
                <div id="event-list-container"></div>
            </div>
            <div id="desktop-map-container"></div>
        `;
        
        handleViewLayout();

        if (allEvents.length === 0) {
            await loadAndRenderEvents();
        } else {
            const activeFilter = document.querySelector('#category-filters .filter-chip.active')?.dataset.filter || 'destacados';
            await applyFilter(activeFilter);
        }
    }

    async function showEventPageView(eventId) {
        if (map) {
            map.remove();
            map = null;
        }
        document.body.classList.add('view-detail');
        document.querySelector('header.header-main .container').innerHTML = `
            <nav class="event-page-nav">
                <a href="/" class="back-button">&larr; Volver a la lista</a>
            </nav>
        `;
        const mainContainer = document.getElementById('main-content');
        mainContainer.innerHTML = `<div class="loading-indicator">Cargando evento...</div>`;

        try {
            let event = eventsCache[eventId];
            if (!event) {
                const response = await fetch(`${API_BASE_URL}/api/events/${eventId}`);
                if (!response.ok) throw new Error('Evento no encontrado');
                event = await response.json();
                eventsCache[eventId] = event;
            }

            // Actualizar título y metaetiquetas para SEO y redes sociales
            const eventName = event.name || 'Evento de Flamenco';
            document.title = `${eventName} | Duende Finder`;
            updateMetaTags({
                'og:title': eventName,
                'og:description': event.description || `Descubre todo sobre ${eventName}, un evento de flamenco que no te puedes perder.`,
                'og:image': event.imageUrl || `${window.location.origin}/assets/flamenco-placeholder.png`,
                'og:url': window.location.href,
                'og:type': 'website'
            });
            updateStructuredData(event);

            renderEventPage(event);
        } catch (error) {
            mainContainer.innerHTML = `<h2>Error al cargar el evento</h2>`;
            clearMetaTags(); // Limpiar metaetiquetas en caso de error
            clearStructuredData();
        }
    }

    // =========================================================================
    // 3. LÓGICA DE LAYOUT (MÓVIL/ESCRITORIO)
    // =========================================================================

    function handleViewLayout() {
        if (window.innerWidth > 768) {
            if (!map) initMap('desktop-map-container');
            const activeFilter = document.querySelector('#category-filters .filter-chip.active')?.dataset.filter || 'destacados';
            applyFilter(activeFilter, true);
        } else {
            if (map) {
                map.remove();
                map = null;
            }
        }
    }

    function openMapModal() {
        const modal = document.getElementById('map-modal-overlay');
        modal.classList.add('visible');
        initMap('modal-map-container');
        const activeFilter = document.querySelector('#category-filters .filter-chip.active')?.dataset.filter || 'destacados';
        applyFilter(activeFilter, true);
    }

    function closeMapModal() {
        const modal = document.getElementById('map-modal-overlay');
        modal.classList.remove('visible');
        if (map) {
            map.remove();
            map = null;
        }
    }

    // =========================================================================
    // 4. LÓGICA DE FILTRADO Y DATOS
    // =========================================================================

    async function applyFilter(filterType, forMap = false) {
        let results = [];
        switch (filterType) {
            case 'destacados':
                results = allEvents.filter(event => event.name.includes('Circuito Andaluz de Peñas'));
                break;
            case 'hoy':
                const today = new Date().toISOString().slice(0, 10);
                results = allEvents.filter(event => event.date === today);
                break;
            case 'semana':
                const startOfWeek = new Date();
                startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay() + (startOfWeek.getDay() === 0 ? -6 : 1));
                const endOfWeek = new Date(startOfWeek);
                endOfWeek.setDate(endOfWeek.getDate() + 6);
                const startStr = startOfWeek.toISOString().slice(0, 10);
                const endStr = endOfWeek.toISOString().slice(0, 10);
                results = allEvents.filter(event => event.date >= startStr && event.date <= endStr);
                break;
            case 'cerca':
                try {
                    document.getElementById('event-list-container').innerHTML = '<div class="loading-indicator">Obteniendo ubicación...</div>';
                    const userLocation = await getUserLocation();
                    const { latitude, longitude } = userLocation.coords;
                    results = allEvents.map(event => {
                        event.distance = event.location?.coordinates?.length === 2 ? calculateDistance(latitude, longitude, event.location.coordinates[1], event.location.coordinates[0]) : Infinity;
                        return event;
                    }).filter(event => event.distance <= 100).sort((a, b) => a.distance - b.distance);
                } catch (error) {
                    alert('No se pudo obtener tu ubicación.');
                    results = [];
                }
                break;
            default:
                results = allEvents;
                break;
        }

        currentFilteredEvents = results;
        currentPage = 1;
        isLoadingMore = false;

        if (forMap) {
            renderMapMarkers(currentFilteredEvents);
        } else {
            const totalFound = currentFilteredEvents.length;
            const eventsToRender = currentFilteredEvents.slice(0, EVENTS_PER_PAGE);
            renderEventList(eventsToRender);
            updateEventCount(totalFound);
            if (window.innerWidth > 768 && map) {
                renderMapMarkers(currentFilteredEvents);
            }
        }
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
            eventsCache = allEvents.reduce((acc, event) => { acc[event._id] = event; return acc; }, {});
            await applyFilter('destacados');
        } catch (error) {
            if (eventListContainer) eventListContainer.innerHTML = '<h2>Oops! No se pudo cargar el contenido.</h2>';
        }
    }

    // =========================================================================
    // 5. FUNCIONES DE RENDERIZADO
    // =========================================================================

    function appendEventList(events) {
        const container = document.getElementById('event-list-container');
        if (!container || !events || events.length === 0) return;

        const loadingEl = container.querySelector('.loading-indicator');
        if (loadingEl) loadingEl.remove();

        events.forEach(event => container.appendChild(createEventCard(event)));
    }

    async function loadMoreEvents() {
        if (isLoadingMore) return;

        const totalEvents = currentFilteredEvents.length;
        const currentlyLoaded = currentPage * EVENTS_PER_PAGE;

        if (currentlyLoaded >= totalEvents) {
            return; // No hay más eventos para cargar
        }

        isLoadingMore = true;
        const container = document.getElementById('event-list-container');
        if (container) {
            const loadingEl = document.createElement('div');
            loadingEl.className = 'loading-indicator';
            loadingEl.textContent = 'Cargando más eventos...';
            container.appendChild(loadingEl);
        }

        await new Promise(resolve => setTimeout(resolve, 300));

        currentPage++;
        const nextBatchStart = (currentPage - 1) * EVENTS_PER_PAGE;
        const nextBatchEnd = currentPage * EVENTS_PER_PAGE;
        const eventsToAppend = currentFilteredEvents.slice(nextBatchStart, nextBatchEnd);

        appendEventList(eventsToAppend);
        isLoadingMore = false;
    }

    function initMap(containerId) {
        if (map) map.remove();
        const mapContainer = document.getElementById(containerId);
        if (mapContainer) {
            map = L.map(mapContainer).setView([40.4, -3.7], 5);
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '&copy; OpenStreetMap' }).addTo(map);
            markersLayer = L.layerGroup().addTo(map);
        }
    }

    function renderEventList(events) {
        const container = document.getElementById('event-list-container');
        if (!container) return;
        container.innerHTML = !events || events.length === 0 ? '<p class="loading-indicator">No se encontraron eventos.</p>' : '';
        events.forEach(event => container.appendChild(createEventCard(event)));
    }

    function renderMapMarkers(events) {
        if (!map || !markersLayer) return;
        markersLayer.clearLayers();
        markerEventMap = {};

        const orangeIcon = new L.Icon({
            iconUrl: 'data:image/svg+xml;charset=UTF-8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" fill="%23E58A2D"><path d="M16 0C9.37 0 4 5.37 4 12c0 8 12 20 12 20s12-12 12-20c0-6.63-5.37-12-12-12zm0 16a4 4 0 110-8 4 4 0 010 8z"/></svg>',
            iconSize: [32, 32],
            iconAnchor: [16, 32],
            popupAnchor: [0, -32]
        });

        const markers = events.map(event => {
            if (event.location?.coordinates?.length === 2) {
                const marker = L.marker([event.location.coordinates[1], event.location.coordinates[0]], { icon: orangeIcon });
                
                // Asocia el popup pero no lo vincules al click por defecto
                marker.bindPopup(`<b>${event.name}</b>`);

                // Al hacer clic, cerramos el modal en móvil y luego navegamos.
                marker.on('click', () => {
                    if (window.innerWidth <= 768) {
                        closeMapModal();
                    }
                    const slug = event.slug || slugify(event.name);
                    navigateTo(`/eventos/${slug}-${event._id}`);
                });

                // Muestra/oculta el popup con el ratón
                marker.on('mouseover', function (e) { this.openPopup(); });
                marker.on('mouseout', function (e) { this.closePopup(); });

                markerEventMap[event._id] = marker;
                return marker;
            }
            return null;
        }).filter(Boolean);

        if (markers.length > 0) {
            const group = new L.featureGroup(markers);
            markersLayer.addLayer(group);
            map.fitBounds(group.getBounds().pad(0.2));
        }
    }

    function createEventCard(event) {
        const card = document.createElement('a');
        card.className = 'event-card';
        const slug = event.slug || slugify(event.name);
        card.href = `/eventos/${slug}-${event._id}`;
        card.dataset.eventId = event._id;
        const eventDate = event.date ? new Date(event.date + 'T00:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'long' }) : '';
        
        card.innerHTML = `
            <div class="card-image" style="background-image: url('${event.imageUrl || './assets/flamenco-placeholder.png'}')"></div>
            <div class="card-content">
                <h3 class="card-title">${event.name || 'Evento'}</h3>
                <p class="card-artist">${event.artist || 'N/A'}</p>
                <div class="card-details">
                    <span><ion-icon name="location-outline"></ion-icon> ${event.city || ''}</span>
                    <span><ion-icon name="calendar-outline"></ion-icon> ${eventDate}</span>
                </div>
            </div>`;
        return card;
    }

    function renderEventPage(event) {
        const mainContainer = document.getElementById('main-content');
        const eventName = event.name || 'Evento sin título';
        const displayLocation = `${event.venue || ''}, ${event.city || ''}`.replace(/^,|,$/g, '');
        const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${eventName}, ${displayLocation}`)}`;
        
        const sponsorBannerHtml = `
            <div class="sponsor-banner" style="margin-bottom: 1.5rem; text-align: center;">
                <a href="https://afland.es/" target="_blank" rel="noopener sponsored">
                    <img src="https://afland.es/wp-content/uploads/2025/08/banner-publicidad-1.jpg" alt="Patrocinado por Andalucía Flamenco Land" style="max-width: 100%; height: auto; border-radius: 8px;">
                </a>
            </div>
        `;

        mainContainer.innerHTML = `
            <div class="event-page-container">
                ${sponsorBannerHtml}
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
    // 6. MANEJADORES DE EVENTOS
    // =========================================================================

    function setupGlobalListeners() {
        document.body.addEventListener('click', e => {
            const backBtn = e.target.closest('.back-button');
            if (backBtn) {
                e.preventDefault();
                // Si hay más de una entrada en el historial, podemos volver atrás de forma segura.
                if (window.history.length > 1) {
                    history.back();
                } else {
                    // Si no hay historial (ej. se abrió un enlace directo al evento en la PWA),
                    // navegamos a la página principal para no dejar al usuario atrapado.
                    // Usamos { replace: true } para que la página de evento no quede en el historial.
                    navigateTo('/', { replace: true });
                }
                return;
            }

            const eventCard = e.target.closest('.event-card');
            if (eventCard) { e.preventDefault(); navigateTo(eventCard.href); return; }

            if (e.target.closest('#show-map-btn')) { openMapModal(); return; }
            if (e.target.closest('#close-map-modal-btn')) { closeMapModal(); return; }

            const filterBtn = e.target.closest('#category-filters .filter-chip');
            if (filterBtn && !filterBtn.classList.contains('active')) {
                document.querySelector('#category-filters .active')?.classList.remove('active');
                filterBtn.classList.add('active');
                applyFilter(filterBtn.dataset.filter);
                return;
            }
            
            const shareMainBtn = e.target.closest('.share-btn-main');
            if (shareMainBtn) { shareMainBtn.nextElementSibling.classList.toggle('active'); return; }

            const shareOptionBtn = e.target.closest('.share-option-btn');
            if (shareOptionBtn) { e.preventDefault(); handleShare(shareOptionBtn.dataset.social); return; }
        });

        window.addEventListener('resize', handleViewLayout);
        window.addEventListener('popstate', handleRouting);

        // Listener para scroll infinito
        window.addEventListener('scroll', () => {
            if (document.body.classList.contains('view-detail') || isLoadingMore) {
                return;
            }

            const { scrollTop, scrollHeight, clientHeight } = document.documentElement;
            
            // Cargar más cuando el usuario esté a 400px del final
            if (scrollTop + clientHeight >= scrollHeight - 400) {
                loadMoreEvents();
            }
        }, { passive: true });
    }

    function handleShare(social) {
        const url = window.location.href;
        const text = document.title;
        let shareUrl;
        switch (social) {
            case 'twitter': shareUrl = `https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`; break;
            case 'facebook': shareUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`; break;
            case 'whatsapp': shareUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(text + ' ' + url)}`; break;
            case 'copy': navigator.clipboard.writeText(url).then(() => alert('¡Enlace copiado!')); return;
        }
        if (shareUrl) window.open(shareUrl, '_blank');
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

    function slugify(text) {
        if (!text) return 'evento';
        return text
            .toString()
            .toLowerCase()
            .normalize('NFD') // Normaliza para separar acentos
            .replace(/[\u0300-\u036f]/g, '') // Elimina los diacríticos
            .replace(/\s+/g, '-') // Reemplaza espacios con -
            .replace(/[^\w\-]+/g, '') // Elimina caracteres no alfanuméricos (excepto guiones)
            .replace(/\-\-+/g, '-') // Reemplaza múltiples guiones con uno solo
            .replace(/^-+/, '') // Elimina guiones al principio
            .replace(/-+$/, ''); // Elimina guiones al final
    }

    function updateMetaTags(tags) {
        // Limpia las metaetiquetas dinámicas anteriores para evitar duplicados.
        document.querySelectorAll('meta[data-dynamic-meta]').forEach(tag => tag.remove());
    
        Object.entries(tags).forEach(([property, content]) => {
            if (content) {
                const meta = document.createElement('meta');
                meta.setAttribute('property', property);
                meta.setAttribute('content', content);
                meta.setAttribute('data-dynamic-meta', 'true'); // Etiqueta para facilitar su eliminación
                document.head.appendChild(meta);
            }
        });
    }
    
    function clearMetaTags() {
        // Elimina solo las metaetiquetas que hemos añadido dinámicamente.
        document.querySelectorAll('meta[data-dynamic-meta]').forEach(tag => tag.remove());
        // Restaura el título original de la página principal.
        document.title = 'Duende Finder - El Buscador de Flamenco';
    }

    function updateStructuredData(event) {
        clearStructuredData(); // Limpiar datos anteriores para evitar duplicados

        const structuredData = {
            '@context': 'https://schema.org',
            '@type': 'Event',
            name: event.name || 'Evento de Flamenco',
            startDate: event.date,
            description: event.description || `Detalles sobre el evento de flamenco ${event.name}.`,
            image: event.imageUrl || `${window.location.origin}/assets/flamenco-placeholder.png`,
            eventStatus: 'https://schema.org/EventScheduled',
            location: {
                '@type': 'Place',
                name: event.venue || 'Lugar por confirmar',
                address: {
                    '@type': 'PostalAddress',
                    addressLocality: event.city || 'Ciudad no especificada',
                    addressCountry: event.country || 'ES'
                }
            },
            performer: {
                '@type': 'Person',
                name: event.artist || 'Artista por confirmar'
            },
            offers: {
                '@type': 'Offer',
                url: window.location.href,
                price: '0',
                priceCurrency: 'EUR',
                availability: 'https://schema.org/InStock'
            }
        };

        const script = document.createElement('script');
        script.type = 'application/ld+json';
        script.setAttribute('data-dynamic-structured-data', 'true');
        script.textContent = JSON.stringify(structuredData);
        document.head.appendChild(script);
    }

    function clearStructuredData() {
        document.querySelectorAll('script[data-dynamic-structured-data]').forEach(tag => tag.remove());
    }

    // =========================================================================
    // 8. INICIALIZACIÓN
    // =========================================================================
    function init() {
        setupGlobalListeners();
        handleRouting();
    }

    init();
});
