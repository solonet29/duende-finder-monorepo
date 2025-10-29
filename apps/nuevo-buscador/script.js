import { CountUp } from './libs/countup.js';
import { initPushNotifications } from './notifications.js';

document.addEventListener('DOMContentLoaded', () => {
    // =========================================================================
    // 1. CONFIGURACIÓN Y SELECTORES
    // =========================================================================
    const APP_CONFIG = {
        USAR_PAGINAS_DE_EVENTOS: true,
        INFINITE_SCROLL_ENABLED: false, // Poner en false para desactivar la funcionalidad de scroll infinito en los sliders
        HEATMAP_ENABLED: true, // Control para activar/desactivar el mapa de calor
    };
    const getApiBaseUrl = () => {
        const hostname = window.location.hostname;
        if (hostname === 'localhost' || hostname === '127.0.0.1') {
            return 'http://localhost:3000';
        }
        return 'https://api-v2.afland.es';
    };

    const API_BASE_URL = getApiBaseUrl();
    let eventsCache = {};
    let modalMapInstance = null;
    let isTripPlannerInitialized = false;

    const modalContent = {
        howItWorks: `
        <p><strong>Duende Finder es tu asistente inteligente para descubrir el flamenco a tu alrededor y en todo el mundo.</strong></p>
        <ol>
            <li><strong>Encuentra Eventos Cerca de Ti:</strong> Pulsa el botón <strong>"Cerca de mí"</strong> para que el buscador te muestre al instante los tablaos y eventos más próximos a tu ubicación actual.</li>
            <li><strong>Explora el Resto:</strong> Navega por la lista completa de eventos. Usamos IA para encontrar y organizar actuaciones de múltiples fuentes públicas.</li>
            <li><strong>Planifica tu Noche:</strong> Haz clic en "Planear Noche" en cualquier evento. Gemini, nuestro copiloto de IA, te creará una guía con recomendaciones de restaurantes, transporte y consejos para disfrutar al máximo.</li>
            <li><strong>Ver en Mapa:</strong> Cada sección de eventos tiene un botón de "Mapa" para visualizar todos los eventos de esa categoría en un mapa interactivo.</li>
            <li><strong>Planificar Viaje:</strong> Usa el planificador de viajes para encontrar eventos en una ciudad y fechas específicas.</li>
        </ol>
        <h4>¿Qué significan los estados de los eventos?</h4>
        <ul>
            <li><ion-icon name="checkmark-circle-outline"></ion-icon> <strong>Verificado:</strong> La fuente original del evento ha sido comprobada recientemente y estaba activa.</li>
            <li><ion-icon name="hourglass-outline"></ion-icon> <strong>Pendiente:</strong> El evento está pendiente de nuestra comprobación automática.</li>
            <li><ion-icon name="close-circle-outline"></ion-icon> <strong>No Verificado:</strong> No pudimos acceder a la fuente original. El evento podría estar cancelado.</li>
        </ul>
        <p>¡Todo está pensado para que solo te preocupes de disfrutar del duende!</p>
    `,
        terms: `
        <ul>
            <li><strong>Propósito:</strong> Duende Finder es una herramienta experimental con fines informativos y de entretenimiento, diseñada para facilitar el descubrimiento de eventos de flamenco.</li>
            <li><strong>Fuentes de Datos:</strong> La información de los eventos se recopila automáticamente de fuentes públicas en internet. No nos hacemos responsables de posibles inexactitudes, cancelaciones o cambios en la programación. Siempre verifica la información con la fuente original.</li>
            <li><strong>Contenido Generado por IA:</strong> Funcionalidades como "Planear Noche" y las descripciones de los eventos son generadas por la inteligencia artificial de Google (Gemini). Este contenido puede contener imprecisiones y debe ser considerado como una sugerencia, no como un hecho verificado.</li>
            <li><strong>Uso:</strong> El uso de este servicio implica la aceptación de estos términos.</li>
        </ul>
    `
    };

    const mainContainer = document.querySelector('main.container');
    const featuredSlider = document.getElementById('featured-events-slider');
    const recentSlider = document.getElementById('recent-events-slider');
    const weekSlider = document.getElementById('week-events-slider');
    const todaySlider = document.getElementById('today-events-slider');
    const nearbySlider = document.getElementById('nearby-events-slider');
    const monthlySlidersContainer = document.getElementById('monthly-sliders-container');
    const filterBar = document.querySelector('.filter-bar');
    const navHomeBtn = document.getElementById('nav-home-btn');
    const navHowItWorksBtn = document.getElementById('nav-how-it-works-btn');
    const navTermsBtn = document.getElementById('nav-terms-btn');
    const navThemeToggle = document.getElementById('nav-theme-toggle');
    const eventDetailModalOverlay = document.getElementById('event-detail-modal-overlay');
    const howItWorksModal = document.getElementById('how-it-works-modal-overlay');
    const termsModal = document.getElementById('terms-modal-overlay');
    const geminiModalOverlay = document.getElementById('gemini-modal-overlay');
    const tripPlannerToggle = document.getElementById('trip-planner-toggle');
    const tripCityInput = document.getElementById('trip-city');
    const tripStartDateInput = document.getElementById('trip-start-date');
    const tripEndDateInput = document.getElementById('trip-end-date');
    const tripSearchBtn = document.getElementById('trip-search-btn');
    const tripResultsSlider = document.getElementById('trip-results-slider');
    const tripResultsMessage = document.getElementById('trip-results-message');
    const showMapBtn = document.getElementById('show-map-btn');
    const mapModalOverlay = document.getElementById('map-modal-overlay');
    const closeMapModalBtn = document.getElementById('close-map-modal-btn');
    // Nuevos selectores para el modal de filtros
    const advancedFilterModalOverlay = document.getElementById('advanced-filter-modal-overlay');
    const advancedFilterForm = document.getElementById('advanced-filter-form');
    const modalCityInput = document.getElementById('modal-city-search-input');
    const modalCityResults = document.getElementById('modal-city-autocomplete-results');


    // =========================================================================
    // 2. DEFINICIÓN DE TODAS LAS FUNCIONES generadas
    // =========================================================================

    function getSessionId() {
        let sessionId = sessionStorage.getItem('duendeFinderSessionId');
        if (!sessionId) {
            sessionId = Date.now().toString() + Math.random().toString(36).substring(2);
            sessionStorage.setItem('duendeFinderSessionId', sessionId);
        }
        return sessionId;
    }

    // =========================================================================
    // 1.5. UTILIDADES DE CACHÉ EN CLIENTE
    // =========================================================================
    const CACHE_TTL = 5 * 60 * 1000; // 5 minutos de Time-To-Live

    function setCache(key, data) {
        const cacheItem = {
            timestamp: Date.now(),
            data: data
        };
        try {
            // Usamos sessionStorage para que la caché se limpie al cerrar la pestaña.
            sessionStorage.setItem(key, JSON.stringify(cacheItem));
        } catch (error) {
            console.warn("Error al guardar en caché (posiblemente llena):", error);
            // Si el almacenamiento está lleno, una estrategia simple es limpiarlo.
            sessionStorage.clear();
        }
    }

    function getCache(key) {
        try {
            const cachedItem = sessionStorage.getItem(key);
            if (!cachedItem) return null;

            const { timestamp, data } = JSON.parse(cachedItem);
            const isExpired = (Date.now() - timestamp) > CACHE_TTL;

            if (isExpired) { sessionStorage.removeItem(key); return null; }
            return data;
        } catch (error) {
            console.warn("Error al leer de la caché:", error);
            return null;
        }
    }
    async function trackInteraction(type, details) {
        const sessionId = getSessionId();
        const apiUrl = 'https://api-v2.afland.es/api/analytics/track';
        try {
            if (navigator.sendBeacon) {
                const blob = new Blob([JSON.stringify({ type, sessionId, details })], { type: 'application/json' });
                navigator.sendBeacon(apiUrl, blob);
            } else {
                await fetch(apiUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ type, sessionId, details }),
                    keepalive: true
                });
            }
        } catch (error) {
            console.error('Error sending tracking event:', error);
        }
    }

    function animateEventCounter(totalEvents) {
        const counterElement = document.getElementById('event-stats');
        if (!counterElement) return;
        // Asegurarse de que totalEvents es un número válido y mayor que cero
        if (typeof totalEvents !== 'number' || totalEvents <= 0) {
            counterElement.style.display = 'none';
            return;
        }
        try {
            const countUp = new CountUp(counterElement, totalEvents, { prefix: '+', suffix: ' eventos de flamenco verificados', duration: 2.5, separator: '.', useEasing: true });
            if (!countUp.error) {
                countUp.start();
            } else {
                counterElement.textContent = `+${totalEvents.toLocaleString('es-ES')} eventos de flamenco verificados`;
            }
            counterElement.classList.add('loaded');
        } catch (error) {
            console.error('Error al animar el contador de eventos:', error);
            counterElement.style.display = 'none';
        }
    }

    async function openMapModal(sliderContainer) {
        if (!mapModalOverlay || !sliderContainer) return;

        const eventCards = sliderContainer.querySelectorAll('.event-card');
        const eventIds = Array.from(eventCards).map(card => card.dataset.eventId);
        const eventsToShow = eventIds.map(id => eventsCache[id]).filter(Boolean);

        if (eventsToShow.length === 0) {
            alert('No hay eventos en esta sección para mostrar en el mapa.');
            return;
        }
        mapModalOverlay.classList.add('visible');

        const mapContainer = document.getElementById('modal-map-container');
        if (mapContainer) {
            mapContainer.innerHTML = '<div class="loading-indicator" style="display: flex; justify-content: center; align-items: center; height: 100%; flex-direction: column; gap: 1rem;"><ion-icon name="map-outline" style="font-size: 3rem;"></ion-icon><p>Cargando mapa...</p></div>';
        }

        try {
            if (!document.querySelector('link[href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"]')) {
                const link = document.createElement('link');
                link.rel = 'stylesheet';
                link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
                document.head.appendChild(link);
            }

            if (!window.L) {
                await import('https://unpkg.com/leaflet@1.9.4/dist/leaflet.js');
            }

            initializeModalMap(eventsToShow);

        } catch (error) {
            console.error("Error al cargar Leaflet:", error);
            if (mapContainer) {
                mapContainer.innerHTML = '<p style="text-align: center; padding: 2rem;">Error al cargar el mapa.</p>';
            }
        }
    }

    function closeMapModal() {
        if (mapModalOverlay) {
            mapModalOverlay.classList.remove('visible');
        }
        // Destruir la instancia del mapa para asegurar una reinicialización limpia
        if (modalMapInstance) {
            modalMapInstance.remove();
            modalMapInstance = null;
        }
    }

    function initializeModalMap(events) {
        const mapContainer = document.getElementById('modal-map-container');
        if (!mapContainer) return;

        // Si el mapa no está inicializado, créalo
        if (!modalMapInstance) {
            modalMapInstance = L.map(mapContainer).setView([40.416775, -3.703790], 5); // Vista inicial de España
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            }).addTo(modalMapInstance);
        }

        // Limpiar marcadores anteriores
        modalMapInstance.eachLayer(layer => {
            if (layer instanceof L.Marker) {
                modalMapInstance.removeLayer(layer);
            }
        });

        const markers = [];
        events.forEach(event => {
            if (event.location?.coordinates?.length === 2) {
                const [lon, lat] = event.location.coordinates;
                // Asegurarse de que las coordenadas son números válidos
                if (typeof lat === 'number' && typeof lon === 'number') {
                    const marker = L.marker([lat, lon]);
                    const popupContent = `<b>${event.artist || event.name}</b><br>${new Date(event.date).toLocaleDateString('es-ES', { day: 'numeric', month: 'long' })}`;
                    marker.bindPopup(popupContent);

                    marker.on('mouseover', function (e) {
                        this.openPopup();
                    });
                    marker.on('mouseout', function (e) {
                        this.closePopup();
                    });

                    marker.on('click', () => {
                        // Cerrar el modal del mapa y navegar a la página del evento
                        closeMapModal();
                        const fallbackSlug = (event.name || 'evento').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
                        const finalSlug = event.slug || fallbackSlug;
                        window.location.href = `/eventos/${event._id}-${finalSlug}`;
                    });
                    markers.push(marker);
                }
            }
        });

        if (markers.length > 0) {
            // Añadir todos los marcadores al mapa a la vez
            const group = new L.featureGroup(markers).addTo(modalMapInstance);
            // Ajustar el zoom para que todos los marcadores sean visibles
            modalMapInstance.fitBounds(group.getBounds().pad(0.1));
        } else {
            // Si no hay marcadores, centrar el mapa en una vista por defecto
            modalMapInstance.setView([40.416775, -3.703790], 5);
        }

        // Forzar al mapa a recalcular su tamaño. Esencial cuando se muestra en un modal.
        setTimeout(() => {
            modalMapInstance.invalidateSize();
        }, 10); // Un pequeño retardo para asegurar que el modal es visible
    }

    function applyTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('duende-theme', theme);
        if (navThemeToggle) {
            const icon = navThemeToggle.querySelector('ion-icon');
            if (icon) icon.setAttribute('name', theme === 'dark' ? 'moon-outline' : 'sunny-outline');
        }
    }

    function populateInfoModals() {
        const howItWorksContainer = document.getElementById('how-it-works-text-container');
        const termsContainer = document.getElementById('terms-text-container');
        if (howItWorksContainer) howItWorksContainer.innerHTML = modalContent.howItWorks;
        if (termsContainer) termsContainer.innerHTML = modalContent.terms;
    }

    async function handleWelcomeModal() {
        const overlay = document.getElementById('welcome-modal-overlay');
        if (overlay) {
            overlay.style.display = 'none';
        }
        return { active: false, timer: Promise.resolve() };
    }

    function getUserLocation() {
        return new Promise((resolve, reject) => {
            if (!navigator.geolocation) {
                return reject(new Error('Geolocation not supported'));
            }
            navigator.geolocation.getCurrentPosition(resolve, reject);
        });
    }

    function calculateDistance(lat1, lon1, lat2, lon2) {
        const R = 6371; // km
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a = 0.5 - Math.cos(dLat) / 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * (1 - Math.cos(dLon)) / 2;
        return R * 2 * Math.asin(Math.sqrt(a));
    }

    function createSkeletonCard() {
        const skeletonCard = document.createElement('div');
        skeletonCard.className = 'event-card';
        skeletonCard.innerHTML = `
            <div class="skeleton" style="height: 125px; border-radius: 8px 8px 0 0;"></div>
            <div class="card-content">
                <div class="skeleton" style="height: 20px; width: 80%; margin: 10px auto;"></div>
            </div>
        `;
        return skeletonCard;
    }

    function createTripPlannerSkeleton() {
        const skeletonContainer = document.createElement('div');
        skeletonContainer.className = 'slider-container';
        for (let i = 0; i < 3; i++) {
            skeletonContainer.appendChild(createSkeletonCard());
        }
        return skeletonContainer.innerHTML;
    }

    function getCurrentWeekDateRange() {
        const today = new Date();
        const dayOfWeek = today.getDay(); // Sunday = 0, Monday = 1, etc.
        const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
        const monday = new Date(new Date().setDate(today.getDate() + diffToMonday));
        const sunday = new Date(new Date(monday).setDate(monday.getDate() + 6));

        const formatDate = (date) => date.toISOString().split('T')[0];

        return {
            startDate: formatDate(monday),
            endDate: formatDate(sunday)
        };
    }

    // =========================================================================
    // NUEVA LÓGICA DE SCROLL INFINITO
    // =========================================================================
    let infiniteScrollObserver;
    let infiniteScrollPage = 1;
    let activeFilters = {
        type: 'proximos', // 'proximos', 'destacados', 'recientes'
        lat: null,
        lon: null,
        city: null,
        dateFrom: null,
        dateTo: null,
        artist: null
    };
    let isLoadingInfiniteScroll = false;
    let isForceRefreshing = false;

    async function handleForceRefresh() {
        console.log('Forzando actualización de datos...');
        const refreshBtn = document.getElementById('force-refresh-btn');
        if (refreshBtn) {
            refreshBtn.innerHTML = '<ion-icon name="sync-outline" style="vertical-align: middle;"></ion-icon> Actualizando...';
            refreshBtn.disabled = true;
        }

        // 1. Limpiar la caché de eventos de la sesión
        try {
            let clearedCount = 0;
            for (let i = 0; i < sessionStorage.length; i++) {
                const key = sessionStorage.key(i);
                if (key && key.includes('/api/events')) {
                    sessionStorage.removeItem(key);
                    clearedCount++;
                }
            }
            console.log(`Caché de ${clearedCount} entradas de eventos de la sesión limpiada.`);
        } catch (error) {
            console.error("Error limpiando la caché de sesión:", error);
        }

        // 2. Recargar los eventos con el parámetro para saltar la caché de Vercel
        isForceRefreshing = true;
        await applyFiltersAndReload();
        isForceRefreshing = false;
        console.log('Recarga forzada completada.');

        if (refreshBtn) {
            refreshBtn.innerHTML = '<ion-icon name="refresh-outline" style="vertical-align: middle;"></ion-icon> Actualizar Datos';
            refreshBtn.disabled = false;
        }
    }

    function createInfiniteScrollContainer() {
        if (document.getElementById('infinite-scroll-section')) return;

        const section = document.createElement('section');
        section.id = 'infinite-scroll-section';
        section.className = 'sliders-section'; // Reutilizamos estilos
        section.innerHTML = `
            <div id="infinite-scroll-title-container" class="slider-title-container">
                <h2>Próximos Eventos</h2>
            </div>
            <div id="infinite-scroll-container" class="grid-container"></div> 
            <div id="infinite-scroll-sentinel"></div>
        `;
        mainContainer.appendChild(section);
    }

    function resetInfiniteScroll() {
        infiniteScrollPage = 1;
        isLoadingInfiniteScroll = false;
        const container = document.getElementById('infinite-scroll-container');
        if (container) container.innerHTML = '';
        if (infiniteScrollObserver) infiniteScrollObserver.disconnect();
    }

    function getApiUrlForFilter() {
        let baseUrl = `${API_BASE_URL}/api/events?limit=12&page=${infiniteScrollPage}`;
        let sortParam = 'sort=date'; // Orden por fecha por defecto

        switch (activeFilters.type) {
            case 'destacados': baseUrl += '&featured=true'; break; // Mantenemos orden por fecha
            case 'recientes': sortParam = 'sort=createdAt&sortOrder=-1'; break; // Ordenamos por fecha de creación
            case 'cerca':
                if (activeFilters.lat && activeFilters.lon) {
                    let url = `${baseUrl}&lat=${activeFilters.lat}&lon=${activeFilters.lon}&radius=100`;
                    if (isForceRefreshing) {
                        url += '&refresh=true';
                    }
                    return url;
                }
                return null; // No hacer petición si no hay coordenadas
        }

        const params = new URLSearchParams();
        if (activeFilters.city) params.append('city', activeFilters.city);
        if (activeFilters.dateFrom) params.append('dateFrom', activeFilters.dateFrom);
        if (activeFilters.artist) params.append('artist', activeFilters.artist);
        if (activeFilters.dateTo) params.append('dateTo', activeFilters.dateTo);

        let finalUrl = `${baseUrl}&${sortParam}&${params.toString()}`;
        if (isForceRefreshing) {
            finalUrl += '&refresh=true';
        }
        return finalUrl;
    }

    async function loadMoreInfiniteScrollEvents() {
        if (isLoadingInfiniteScroll) return;
        isLoadingInfiniteScroll = true;

        const container = document.getElementById('infinite-scroll-container');
        const sentinel = document.getElementById('infinite-scroll-sentinel');
        if (!container || !sentinel) return;

        // Mostrar indicador de carga
        const skeletonContainer = document.createElement('div');
        skeletonContainer.className = 'slider-container'; // Reutilizamos la clase para el layout
        skeletonContainer.id = 'skeleton-loader';
        for (let i = 0; i < 3; i++) {
            const skeletonCard = createSkeletonCard();
            skeletonContainer.appendChild(skeletonCard);
        }
        sentinel.innerHTML = ''; // Limpiar contenido anterior
        sentinel.appendChild(skeletonContainer);

        const apiUrl = getApiUrlForFilter();
        if (!apiUrl) {
            sentinel.innerHTML = '<p style="text-align: center; color: var(--color-texto-secundario); padding: 2rem;">Activa la ubicación para ver eventos cercanos.</p>';
            isLoadingInfiniteScroll = false;
            return;
        }

        // 1. Comprobar la caché primero (y saltarla si forzamos refresh)
        if (!isForceRefreshing) {
            const cachedData = getCache(apiUrl);
            if (cachedData) {
                console.log(`[CACHE HIT] Cargando eventos desde caché para la página ${infiniteScrollPage}.`);
                processInfiniteScrollData(cachedData);
                isLoadingInfiniteScroll = false;
                return;
            }
        }

        try {
            // 2. Si no está en caché o se fuerza, hacer la petición a la red
            const response = await fetch(apiUrl);
            if (!response.ok) throw new Error('Failed to fetch events');
            const data = await response.json();

            // 3. Guardar en caché y procesar los datos
            setCache(apiUrl, data);
            processInfiniteScrollData(data);

        } catch (error) {
            console.error('Error loading more events:', error);
            sentinel.innerHTML = '<p style="text-align: center; color: var(--color-texto-error); padding: 2rem;">Error al cargar más eventos.</p>';
        } finally {
            isLoadingInfiniteScroll = false;
        }
    }

    function processInfiniteScrollData(data) {
        const container = document.getElementById('infinite-scroll-container');
        const sentinel = document.getElementById('infinite-scroll-sentinel');
        if (!container || !sentinel) return;

        // Limpiar el skeleton loader
        const skeletonLoader = document.getElementById('skeleton-loader');
        if (skeletonLoader) {
            skeletonLoader.remove();
        }

        if (data.events && data.events.length > 0) {
            data.events.forEach((event, index) => {
                eventsCache[event._id] = event;
                const isLCP = infiniteScrollPage === 1 && index < 2;
                container.appendChild(createSliderCard(event, isLCP));
            });
            infiniteScrollPage++;
        } else {
            if (infiniteScrollObserver) infiniteScrollObserver.disconnect();
            sentinel.innerHTML = '<p style="text-align: center; color: var(--color-texto-secundario); padding: 2rem;">Has llegado al final. ¡No hay más eventos por ahora!</p>';
        }
    }

    function setupInfiniteScrollObserver() {
        const sentinel = document.getElementById('infinite-scroll-sentinel');
        if (!sentinel) return;

        infiniteScrollObserver = new IntersectionObserver((entries) => {
            if (entries[0].isIntersecting && !isLoadingInfiniteScroll) {
                loadMoreInfiniteScrollEvents();
            }
        }, { rootMargin: '400px' }); // Empezar a cargar 400px antes de que sea visible

        infiniteScrollObserver.observe(sentinel);
    }

    async function applyFiltersAndReload() {
        resetInfiniteScroll();
        renderActiveFilterPills();

        const titleContainer = document.getElementById('infinite-scroll-title-container');
        const titleElement = titleContainer?.querySelector('h2');

        if (titleElement) {
            let title = 'Eventos';
            const titles = {
                proximos: 'Próximos Eventos',
                destacados: 'Eventos Destacados',
                recientes: 'Recién Añadidos',
                cerca: 'Eventos Cerca de Ti'
            };
            if (activeFilters.city) {
                title = `Eventos en ${activeFilters.city}`;
            } else {
                title = titles[activeFilters.type] || 'Eventos';
            }
            titleElement.textContent = title;
        }

        await loadMoreInfiniteScrollEvents();
        setupInfiniteScrollObserver();
    }

    function renderActiveFilterPills() {
        const container = document.getElementById('active-filters-container');
        if (!container) return;
        container.innerHTML = '';

        if (activeFilters.city) {
            const pill = createFilterPill(`Ciudad: ${activeFilters.city}`, 'city');
            container.appendChild(pill);
        }
        if (activeFilters.dateFrom && activeFilters.dateTo) {
            const dateText = `Fechas: ${new Date(activeFilters.dateFrom).toLocaleDateString()} - ${new Date(activeFilters.dateTo).toLocaleDateString()}`;
            const pill = createFilterPill(dateText, 'date');
            container.appendChild(pill);
        }
    }

    function createFilterPill(text, filterType) {
        const pill = document.createElement('div');
        pill.className = 'active-filter-pill';
        pill.innerHTML = `
            <span>${text}</span>
            <button class="remove-filter-btn" data-filter-type="${filterType}" title="Eliminar filtro">&times;</button>
        `;
        pill.querySelector('.remove-filter-btn').addEventListener('click', () => {
            if (filterType === 'date') {
                activeFilters.dateFrom = null;
                activeFilters.dateTo = null;
            } else {
                activeFilters[filterType] = null;
            }

            // Opcional: volver a la vista "Próximos" y recargar
            const proximosChip = document.querySelector('.filter-chip[data-filter="proximos"]');
            if (proximosChip) proximosChip.click();
            else applyFiltersAndReload();
        });
        return pill;
    }

    async function handleFilterModalSubmit(e) {
        e.preventDefault();
        const city = document.getElementById('modal-city-search-input').value;
        const startDate = document.getElementById('modal-start-date').value;
        const endDate = document.getElementById('modal-end-date').value;
        const artist = document.getElementById('modal-artist-search-input').value;

        activeFilters.city = city || null;
        activeFilters.dateFrom = startDate || null;
        activeFilters.dateTo = endDate || null;
        activeFilters.artist = artist || null;

        // Si hay filtros, la categoría principal ya no es relevante, usamos 'proximos' como base
        activeFilters.type = 'proximos';
        document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
        const proximosChip = document.querySelector('.filter-chip[data-filter="proximos"]');
        if (proximosChip) proximosChip.classList.add('active');

        if (advancedFilterModalOverlay) {
            advancedFilterModalOverlay.classList.remove('visible');
        }

        await applyFiltersAndReload();
    }

    async function initializeDashboard() {
        // --- 1. Inicializar el mapa de calor o el hero header tradicional ---
        const heroHeader = document.querySelector('.hero-header');
        if (heroHeader) heroHeader.style.display = 'block';
    
        // --- 2. Asegurar visibilidad de elementos principales ---
        const filterBar = document.querySelector('.filter-bar');
        if (filterBar) filterBar.style.display = 'flex';
    
        const actionsContainer = document.querySelector('.main-actions-container');
        if (actionsContainer) actionsContainer.style.display = 'flex';
    
        // --- 3. Añadir disclaimer de imágenes ---
        if (!document.getElementById('image-disclaimer-container')) {
            const disclaimerContainer = document.createElement('div');
            disclaimerContainer.id = 'image-disclaimer-container';
            disclaimerContainer.className = 'image-disclaimer-global';
            disclaimerContainer.innerHTML = '<p><ion-icon name="information-circle-outline"></ion-icon> Las imágenes de los eventos sin un artista asignado son representaciones de la categoría y no del evento en sí.</p>';
            
            if (actionsContainer) {
                actionsContainer.insertAdjacentElement('afterend', disclaimerContainer);
            }
        }
    
        // --- 4. Inicializar el nuevo scroll infinito ---
        createInfiniteScrollContainer();
        await loadMoreInfiniteScrollEvents(); // Cargar la primera página
        setupInfiniteScrollObserver();
    }
    function renderSlider(container, events, monthKey = null, isLCPSection = false) {
        if (!container) return;
        const section = container.closest('.sliders-section');

        // Siempre mostrar la sección para que los filtros funcionen
        if (section) section.style.display = 'block';

        if (!events || events.length === 0) {
            // En lugar de ocultar, mostrar un mensaje informativo
            container.innerHTML = '<p style="padding: 1rem; text-align: center; color: var(--color-texto-secundario);">No hay eventos en esta categoría por ahora.</p>';
            return;
        }

        // Si es la primera carga (no scroll infinito), limpiar
        if (container.dataset.page !== '1') {
            container.innerHTML = '';
        }

        events.forEach((event, index) => {
            eventsCache[event._id] = event;
            const isLCP = isLCPSection && index === 0;
            container.appendChild(createSliderCard(event, isLCP));
        });

        // Configurar para scroll infinito si es un slider mensual y tiene potencial de más eventos
        if (monthKey && events.length === 10) {
            container.dataset.month = monthKey;
            container.dataset.page = '1';

            // Eliminar sentinel anterior si existe
            const oldSentinel = container.querySelector('.sentinel');
            if (oldSentinel) oldSentinel.remove();

            // Añadir un elemento "sentinel" al final para IntersectionObserver
            const sentinel = document.createElement('div');
            sentinel.className = 'sentinel';
            container.appendChild(sentinel);
            setupInfiniteScroll(sentinel);
        }
    }

    function renderMonthlySliders(monthlyGroups) {
        if (!monthlySlidersContainer) return;
        monthlySlidersContainer.innerHTML = '';

        // El backend ya nos da solo los meses que necesitamos
        monthlyGroups.forEach(group => {
            const { monthKey, events } = group;
            const [year, month] = monthKey.split('-');
            const monthDate = new Date(year, parseInt(month, 10) - 1);
            const monthName = monthDate.toLocaleString('es-ES', { month: 'long' });
            const titleText = `${monthName.charAt(0).toUpperCase() + monthName.slice(1)} ${year}`;

            const section = document.createElement('section');
            section.className = 'sliders-section';
            section.id = `month-${monthKey}-section`;

            const titleContainer = document.createElement('div');
            titleContainer.className = 'slider-title-container';

            const title = document.createElement('h2');
            title.textContent = titleText;

            const mapButton = document.createElement('button');
            mapButton.className = 'slider-map-btn';
            mapButton.innerHTML = '<ion-icon name="map-outline"></ion-icon> Mapa';

            titleContainer.appendChild(title);
            titleContainer.appendChild(mapButton);

            const sliderContainer = document.createElement('div');
            sliderContainer.className = 'slider-container';
            sliderContainer.id = `slider-month-${monthKey}`;

            section.appendChild(titleContainer);
            section.appendChild(sliderContainer);
            monthlySlidersContainer.appendChild(section);

            // Renderizar los eventos iniciales y preparar para scroll infinito
            renderSlider(sliderContainer, events, monthKey);
        });
    }

    function setupInfiniteScroll(sentinel) {
        const slider = sentinel.parentElement;

        const observer = new IntersectionObserver(async (entries) => {
            if (entries[0].isIntersecting) {
                observer.unobserve(sentinel); // Dejar de observar para no hacer múltiples peticiones

                const month = slider.dataset.month;
                let page = parseInt(slider.dataset.page || '1', 10);
                page++;

                try {
                    const response = await fetch(`${API_BASE_URL}/api/events?month=${month}&page=${page}&limit=10`);
                    if (!response.ok) return;

                    const data = await response.json();
                    if (data.events && data.events.length > 0) {
                        data.events.forEach(event => {
                            eventsCache[event._id] = event;
                            slider.insertBefore(createSliderCard(event), sentinel);
                        });
                        slider.dataset.page = page;

                        // Si se recibieron 10 eventos, es probable que haya más. Volver a observar.
                        if (data.events.length === 10) {
                            observer.observe(sentinel);
                        } else {
                            sentinel.remove(); // No hay más eventos, quitar el sentinel
                        }
                    } else {
                        sentinel.remove(); // No hay más eventos, quitar el sentinel
                    }
                } catch (error) {
                    console.error('Error cargando más eventos:', error);
                    // Re-observar en caso de error de red para poder reintentar
                    observer.observe(sentinel);

                }
            }
        }, { rootMargin: '200px' }); // Empezar a cargar 200px antes de que sea visible

        observer.observe(sentinel);
    }

    const categoryImages = {
        'Cante': ['cante1.webp', 'cante2.webp', 'cante3.webp'],
        'Baile': ['baile1.webp', 'baile2.webp', 'baile3.webp'],
        'Toque': ['toque1.webp', 'toque2.webp', 'toque3.webp']
    };

    function createSliderCard(event, isLCP = false) {
        const eventCard = document.createElement('div');
        eventCard.className = 'event-card';
        eventCard.setAttribute('data-event-id', event._id);
        const artistName = sanitizeField(event.artist, 'Artista por confirmar');
        const eventName = sanitizeField(event.name, 'evento');
        eventCard.setAttribute('data-artist-name', artistName);
        eventCard.setAttribute('data-event-name', eventName);

        // --- NUEVA Lógica de selección de imagen ---
        const placeholderUrl = './assets/flamenco-placeholder.webp';
        let imageUrl = placeholderUrl; // Fallback por defecto

        // 1. Prioridad: Imagen del artista
        if (event.artistImageUrl) {
            let rawImageUrl = event.artistImageUrl;
            if (rawImageUrl.startsWith('/')) {
                imageUrl = API_BASE_URL + rawImageUrl;
            } else if (rawImageUrl.startsWith('http')) {
                imageUrl = rawImageUrl;
            }
        } else {
            // 2. Fallback: Imagen de categoría aleatoria (se ignora event.imageUrl)
            const category = event.category;
            if (category && categoryImages[category]) {
                const images = categoryImages[category];
                const randomIndex = Math.floor(Math.random() * images.length);
                imageUrl = `./assets/${images[randomIndex]}`;
            }
        }

        const eventDate = new Date(event.date);
        const day = eventDate.getDate();
        const month = eventDate.toLocaleString('es-ES', { month: 'short' }).replace('.', '');

        const description = sanitizeField(event.description, 'Haz clic para ver los detalles de este evento flamenco.');

        const fallbackSlug = (event.name || 'evento').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
        const finalSlug = event.slug || fallbackSlug;
        const eventUrl = `/eventos/${event._id}-${finalSlug}`;

        let categoryBadgeHtml = '';
        if (event.category) {
            categoryBadgeHtml = `<div class="card-category">${event.category}</div>`;
        }

        eventCard.innerHTML = `
            <div class="card-image-container">
                <img src="${imageUrl}"
                     alt="${artistName}"
                     class="card-image"
                     loading="${isLCP ? 'eager' : 'lazy'}"
                     fetchpriority="${isLCP ? 'high' : 'auto'}"
                     decoding="async"
                     onerror="this.onerror=null; this.src='${placeholderUrl}';">
                <div class="card-date-badge">
                    <span class="day">${day}</span>
                    <span class="month">${month}</span>
                </div>
                ${categoryBadgeHtml}
            </div>
            <div class="card-content">
                <div style="display: flex; align-items: center; gap: 8px;">
                    <h3 class="card-title card-title-button" style="margin: 0;">
                        <a href="${eventUrl}" class="card-link-title">${artistName}</a>
                    </h3>
                    ${event.verificationStatus === 'verified' ? '<ion-icon name="checkmark-circle" style="color: #1abc9c; font-size: 1.2rem;"></ion-icon>' : ''}
                </div>
                <p class="card-description">${description}</p>
                <a href="${eventUrl}" class="card-know-more-btn">Saber más</a>
            </div>`;
        return eventCard;
    }

    function renderEventPage(event) {
        if (!mainContainer) return;

        const eventName = sanitizeField(event.name, 'Evento sin título');
        const artistName = sanitizeField(event.artist, 'Artista por confirmar');
        const description = sanitizeField(event.description, 'Sin descripción disponible.');
        const eventTime = sanitizeField(event.time, 'No disponible');
        const eventDate = event.date ? new Date(event.date).toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' }) : 'Fecha no disponible';
        const venue = sanitizeField(event.venue || (event.location && event.location.venue), '');
        const city = sanitizeField(event.city || (event.location && event.location.city), '');
        let displayLocation = 'Ubicación no disponible';
        if (venue && city) displayLocation = `${venue}, ${city}`;
        else if (venue || city) displayLocation = venue || city;
        const mapQuery = [eventName, venue, city, sanitizeField(event.country || (event.location && event.location.country), '')].filter(Boolean).join(', ');
        const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapQuery)}`;
        const blogText = event.blogPostUrl ? 'Leer en el Blog' : 'Explorar Blog';
        const blogUrl = event.blogPostUrl || 'https://afland.es/';
        let imageHtml = '';
        if (event.imageUrl && typeof event.imageUrl === 'string' && event.imageUrl.trim()) {
            let finalImageUrl = event.imageUrl.trim();
            if (finalImageUrl.startsWith('/')) {
                finalImageUrl = API_BASE_URL + finalImageUrl;
            }

            // Solo hay que renderizar si tenemos una URL que parece válida (absoluta o completada)
            if (finalImageUrl.startsWith('http')) {
                imageHtml = `<div class="evento-card-img-container"><img src="${finalImageUrl}" alt="Imagen de ${eventName}" class="evento-card-img" onerror="this.parentElement.style.display='none'"></div>`;
            }
        }

        // --- INICIO: Lógica para la etiqueta "Verificado" y la fuente en la página de evento ---
        let verificationInfoHtml = '';
        if (event.verificationStatus === 'verified' && event.sourceUrl) {
            verificationInfoHtml = `
                <div class="verification-info">
                    <span class="verified-badge-page">
                        <ion-icon name="shield-checkmark-outline"></ion-icon> Verificado
                    </span>
                </div>
            `;
        } else if (event.verificationStatus === 'link_broken') {
            verificationInfoHtml = `
                <div class="verification-info">
                     <span class="unverified-badge-page"><ion-icon name="alert-circle-outline"></ion-icon> No verificado (posiblemente cancelado)</span>
                </div>
            `;
        }
        // --- FIN ---

        const pageHtml = `
            <div class="event-page-container" data-event-id="${event._id}">
                <div class="event-page-content">
                    <div id="sponsored-banner-container"></div>
                    ${imageHtml}
                    
                    <h1>${eventName}</h1>

                    <div class="verification-badge" data-status="${event.verificationStatus || 'pending'}">
                        <ion-icon name="${getVerificationIcon(event.verificationStatus)}"></ion-icon>
                        <span>${getVerificationText(event.verificationStatus)}</span>
                        <ion-icon name="information-circle-outline" class="info-icon"></ion-icon>
                        <div class="tooltip">
                            ${getVerificationTooltip(event.verificationStatus, event.lastVerifiedAt)}
                        </div>
                    </div>

                    <div class="artist-name">
                        <ion-icon name="person-outline"></ion-icon>
                        <span>${artistName}</span>
                    </div>

                    ${verificationInfoHtml}

                    <div class="event-details-group">
                        <div class="evento-detalle">
                            <ion-icon name="link-outline"></ion-icon>
                            <a href="${event.sourceUrl}" target="_blank" rel="noopener noreferrer" style="color: inherit; text-decoration: none;">Fuente original</a>
                        </div>
                        <div class="evento-detalle">
                            <ion-icon name="calendar-outline"></ion-icon><span>${eventDate}</span>
                        </div>
                        <div class="evento-detalle">
                            <ion-icon name="time-outline"></ion-icon><span>${eventTime}</span>
                        </div>
                        <div class="evento-detalle">
                            <ion-icon name="location-outline"></ion-icon><span>${displayLocation}</span>
                        </div>
                    </div>

                    <div class="action-buttons-container">
                        <button class="action-button primary" data-event-id="${event._id}">
                            <ion-icon name="sparkles-outline"></ion-icon> Planear Noche
                        </button>
                        <a href="${blogUrl}" target="_blank" rel="noopener noreferrer" class="action-button secondary">
                            <ion-icon name="newspaper-outline"></ion-icon> ${blogText}
                        </a>
                    </div>

                    <p class="event-description">${description}</p>
                    
                    <div class="map-wrapper">
                        <div id="map-container"></div>
                        <a href="${mapsUrl}" class="map-overlay-button" target="_blank" rel="noopener noreferrer">Ver en Mapa</a>
                    </div>

                    <div class="card-actions-secondary">
                        <p class="share-title">Compartir y Guardar:</p>
                        <div class="share-buttons-container">
                            <button class="share-btn" data-social="google" title="Añadir a Google Calendar"><ion-icon name="logo-google"></ion-icon></button>
                            <button class="share-btn" data-social="ics" title="Descargar .ics para Apple/Outlook"><ion-icon name="calendar-outline"></ion-icon></button>
                            <button class="share-btn" data-social="twitter" title="Compartir en Twitter/X"><ion-icon name="logo-twitter"></ion-icon></button>
                            <button class="share-btn" data-social="facebook" title="Compartir en Facebook"><ion-icon name="logo-facebook"></ion-icon></button>
                            <button class="share-btn" data-social="whatsapp" title="Compartir en WhatsApp"><ion-icon name="logo-whatsapp"></ion-icon></button>
                            <button class="share-btn" data-social="copy" title="Copiar enlace"><ion-icon name="copy-outline"></ion-icon></button>
                        </div>
                    </div>
                    <a href="/" class="back-to-list-link">
                      <ion-icon name="arrow-back-outline"></ion-icon>
                      Volver a la lista
                    </a>
                </div>
                <footer class="event-page-footer">
                    <p class="ai-disclaimer"><em>Contenido generado por IA. La información puede no ser exacta.</em></p>
                    <a href="https://afland.es/contact/" target="_blank" rel="noopener noreferrer" class="business-cta">¿Quieres ver tu negocio aquí? Contacta</a>
                </footer>
            </div>
        `;

        mainContainer.innerHTML = pageHtml;

        displaySponsoredBanner(event);

        const mapContainer = document.getElementById('map-container');
        if (mapContainer && event.location?.coordinates?.length === 2) {
            const [lon, lat] = event.location.coordinates;
            const mapHtml = `<iframe
                width="100%"
                height="300"
                frameborder="0"
                scrolling="no"
                marginheight="0"
                marginwidth="0"
                src="https://www.openstreetmap.org/export/embed.html?bbox=${lon - 0.01}%2C${lat - 0.01}%2C${lon + 0.01}%2C${lat + 0.01}&amp;layer=mapnik&amp;marker=${lat}%2C${lon}"
                style="border: 1px solid var(--color-borde); border-radius: 12px;">
            </iframe>`;
            mapContainer.innerHTML = mapHtml;
        }

        window.scrollTo(0, 0); // Scroll to top
    }

    function renderEventDetailModal(event) {
        if (!eventDetailModalOverlay) return;
        const eventName = sanitizeField(event.name, 'Evento sin título');
        const artistName = sanitizeField(event.artist, 'Artista por confirmar');
        const description = sanitizeField(event.description, 'Sin descripción disponible.');
        const eventTime = sanitizeField(event.time, 'No disponible');
        const eventDate = event.date ? new Date(event.date).toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' }) : 'Fecha no disponible';
        const venue = sanitizeField(event.venue || (event.location && event.location.venue), '');
        const city = sanitizeField(event.city || (event.location && event.location.city), '');
        let displayLocation = 'Ubicación no disponible';
        if (venue && city) displayLocation = `${venue}, ${city}`;
        else if (venue || city) displayLocation = venue || city;
        const mapQuery = [eventName, venue, city, sanitizeField(event.country || (event.location && event.location.country), '')].filter(Boolean).join(', ');
        const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapQuery)}`;
        const blogUrl = event.blogPostUrl || 'https://afland.es/';
        const blogText = event.blogPostUrl ? 'Leer en el Blog' : 'Explorar Blog';
        const blogIcon = event.blogPostUrl ? 'book-outline' : 'newspaper-outline';
        const blogButtonClass = event.blogPostUrl ? 'blog-link-btn' : 'btn-blog-explorar';

        let imageHtml = '';
        if (event.imageUrl && typeof event.imageUrl === 'string' && event.imageUrl.trim()) {
            let finalImageUrl = event.imageUrl.trim();
            if (finalImageUrl.startsWith('/')) {
                finalImageUrl = API_BASE_URL + finalImageUrl;
            }

            if (finalImageUrl.startsWith('http')) {
                imageHtml = `<div class="evento-card-img-container"><img src="${finalImageUrl}" alt="Imagen de ${eventName}" class="evento-card-img" onerror="this.parentElement.style.display='none'"></div>`;
            }
        }

        eventDetailModalOverlay.innerHTML = `<div class="modal"><button class="modal-close-btn">×</button><div class="modal-content modal-event-details">${imageHtml}<div class="card-header"><h2 class="titulo-truncado" title="${eventName}">${eventName}</h2></div><div class="artista"><ion-icon name="person-outline"></ion-icon> <span>${artistName}</span></div><p class="descripcion-corta">${description}</p><div class="card-detalles"><div class="evento-detalle"><ion-icon name="calendar-outline"></ion-icon><span>${eventDate}</span></div><div class="evento-detalle"><ion-icon name="time-outline"></ion-icon><span>${eventTime}</span></div><div class="evento-detalle"><a href="${mapsUrl}" target="_blank" rel="noopener noreferrer"><ion-icon name="location-outline"></ion-icon><span>${displayLocation}</span></a></div></div><div class="card-actions"><div class="card-actions-primary"><button class="gemini-btn" data-event-id="${event._id}"><ion-icon name="sparkles-outline"></ion-icon> Planear Noche</button><a href="${blogUrl}" target="_blank" rel="noopener noreferrer" class="${blogButtonClass}"><ion-icon name="${blogIcon}"></ion-icon> ${blogText}</a></div></div></div></div>`;
        eventDetailModalOverlay.classList.add('visible');
    }

    function groupEventsByMonth(events) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        return events.reduce((acc, event) => {
            if (!event.date) return acc;
            const eventDate = new Date(event.date + 'T00:00:00');
            if (isNaN(eventDate.getTime())) return acc;
            const monthKey = event.date.substring(0, 7);
            if (!acc[monthKey]) acc[monthKey] = [];
            acc[monthKey].push(event);
            return acc;
        }, {});
    }

    function sanitizeField(value, defaultText = 'No disponible') {
        return (value && typeof value === 'string' && value.trim()) ? value.trim() : defaultText;
    }

    function getVerificationIcon(status) {
        switch (status) {
            case 'verified': return 'checkmark-circle-outline';
            case 'failed': return 'close-circle-outline';
            default: return 'hourglass-outline';
        }
    }

    function getVerificationText(status) {
        switch (status) {
            case 'verified': return 'Verificado';
            case 'failed': return 'No Verificado';
            default: return 'Pendiente';
        }
    }

    function getVerificationTooltip(status, lastVerifiedAt) {
        const date = lastVerifiedAt ? new Date(lastVerifiedAt).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' }) : 'N/A';
        switch (status) {
            case 'verified':
                return `La fuente original de este evento fue comprobada y estaba activa por última vez el ${date}.`;
            case 'failed':
                return `No pudimos acceder a la fuente original de este evento en la última comprobación (${date}). El evento podría haber sido cancelado o la información podría ser incorrecta.`;
            default:
                return 'Este evento está pendiente de nuestra comprobación automática.';
        }
    }

    async function geolocationSearch() {
        if (!navigator.geolocation) {
            alert("La geolocalización no es compatible con tu navegador.");
            return;
        }

        navigator.permissions.query({ name: 'geolocation' }).then(result => {
            if (result.state === 'granted') {
                fetchNearbyEvents();
            } else if (result.state === 'prompt') {
                // El navegador mostrará su propio prompt al llamar a getCurrentPosition
                fetchNearbyEvents();
            } else if (result.state === 'denied') {
                renderGeolocationDenied();
            }

            // Actualizar la UI del chip de filtro
            const allChips = filterBar.querySelectorAll('.filter-chip');
            allChips.forEach(btn => btn.classList.remove('active'));
            const cercaChip = filterBar.querySelector('.filter-chip[data-filter="cerca"]');
            if (cercaChip) {
                cercaChip.classList.add('active');
            }
        });
    }

    function renderGeolocationPrompt() {
        if (nearbySlider) nearbySlider.innerHTML = `<div class="cta-section" style="margin: 0; padding: 1.5rem;"><p style="margin-bottom: 1rem;">Para ver eventos cercanos, necesitamos tu permiso de ubicación.</p><button id="request-location-btn" class="cta-btn">Permitir Ubicación</button></div>`;
    }

    function renderGeolocationDenied() {
        const modal = document.getElementById('geolocation-error-modal-overlay');
        if (modal) {
            modal.classList.add('visible');
        }
    }

    function fetchNearbyEvents() {
        if (nearbySlider) nearbySlider.innerHTML = `<div class="skeleton-card" style="width: 100%;"></div>`;
        navigator.geolocation.getCurrentPosition(
            async position => {
                const { latitude, longitude } = position.coords;
                activeFilters.type = 'cerca';
                activeFilters.lat = latitude;
                activeFilters.lon = longitude;
                activeFilters.city = null; // Limpiar filtro de ciudad si lo hubiera

                trackInteraction('nearMeSearch', { location: { lat: latitude, lng: longitude } });

                // Recargar la vista con los nuevos filtros de geolocalización
                await applyFiltersAndReload();
            },
            error => {
                console.error("Error de geolocalización:", error);
                activeFilters.type = 'proximos'; // Volver a la vista por defecto si hay error
                renderGeolocationDenied();
            }
        );
    }

    async function fetchTripEvents(city, startDate, endDate) {
        if (!tripResultsSlider || !tripResultsMessage) return;

        // 1. Show skeleton and apply margin
        tripResultsSlider.innerHTML = createTripPlannerSkeleton();
        tripResultsSlider.style.display = 'flex';
        tripResultsSlider.style.marginTop = '32px';
        tripResultsMessage.style.display = 'none';
        tripResultsMessage.style.marginTop = '32px';

        try {
            // 2. Fetch data
            const response = await fetch(`${API_BASE_URL}/api/events?city=${encodeURIComponent(city)}&dateFrom=${startDate}&dateTo=${endDate}&limit=20`);
            if (!response.ok) throw new Error('Error en la respuesta del servidor.');

            const data = await response.json();

            // 3. Render results or "not found" message
            if (data.events && data.events.length > 0) {
                renderSlider(tripResultsSlider, data.events);
                tripResultsSlider.style.display = 'flex';
            } else {
                tripResultsMessage.textContent = `No se encontraron eventos para ${city} en estas fechas.`;
                tripResultsMessage.style.display = 'block';
                tripResultsSlider.innerHTML = '';
                tripResultsSlider.style.display = 'none';
            }
        } catch (error) {
            // 4. Render error message
            console.error('Error en la búsqueda de viaje:', error);
            tripResultsMessage.textContent = 'Ocurrió un error al realizar la búsqueda. Inténtalo de nuevo.';
            tripResultsMessage.style.display = 'block';
            tripResultsSlider.innerHTML = '';
            tripResultsSlider.style.display = 'none';
        }
    }

    async function getAndShowNightPlan(event) {
        if (!geminiModalOverlay) return;
        const modalContent = geminiModalOverlay.querySelector('.modal-content');
        geminiModalOverlay.classList.add('visible');

        const loadingMessages = [
            "Buscando la inspiración del duende...",
            "Consultando al maestro Gemini...",
            "Diseñando la previa perfecta...",
            "Afinando los últimos detalles de tu plan..."
        ];
        let messageIndex = 0;
        let loadingInterval;

        if (modalContent) {
            modalContent.innerHTML = `<div class="loading-container"><div class="loader"></div><p>${loadingMessages[messageIndex]}</p></div>`;
            const loadingTextElement = modalContent.querySelector('p');

            loadingInterval = setInterval(() => {
                messageIndex = (messageIndex + 1) % loadingMessages.length;
                if (loadingTextElement) {
                    loadingTextElement.textContent = loadingMessages[messageIndex];
                }
            }, 2500); // Cambia el mensaje cada 2.5 segundos
        }

        try {
            const response = await fetch(`${API_BASE_URL}/api/generate-night-plan?eventId=${event._id}`);
            clearInterval(loadingInterval); // Detener el carrusel de mensajes
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ error: "Error desconocido en el servidor" }));
                throw new Error(errorData.error);
            }
            const data = await response.json();
            const footerHtml = `<footer class="ai-footer"><p class="ai-disclaimer"><em>Contenido generado por IA. La información puede no ser exacta.</em></p><a href="https://afland.es/contact" target="_blank" rel="noopener noreferrer" class="business-cta">¿Quieres ver tu negocio aquí? Contacta</a></footer>`;
            const aiHtmlContent = window.marked ? window.marked.parse(data.content) : `<pre>${data.content}</pre>`;
            if (modalContent) modalContent.innerHTML = aiHtmlContent + footerHtml;
        } catch (error) {
            clearInterval(loadingInterval); // Asegurarse de detenerlo también en caso de error
            console.error("Error al generar Plan Noche:", error);
            if (modalContent) modalContent.innerHTML = `<div class="error-container"><h3>¡Vaya! Algo ha fallado</h3><p>${error.message}</p></div>`;
        }
    }

    async function handleShare(socialPlatform, eventId) {
        const event = eventsCache[eventId];
        if (!event) {
            console.error('Evento no encontrado en caché para compartir');
            alert('No se pudo procesar la acción. Inténtalo de nuevo.');
            return;
        }

        const eventUrl = window.location.href;
        const eventName = event.name || 'Evento de Flamenco';
        // Simplificado: Usar la descripción del evento directamente para compartir.
        const shareText = event.description || `No te pierdas ${eventName}`;
        const location = [event.venue, event.city, event.country].filter(Boolean).join(', ');

        let shareUrl;

        switch (socialPlatform) {
            case 'google':
                // Formato de fecha para Google Calendar: YYYYMMDDTHHMMSSZ
                const toGoogleISO = (dateStr, timeStr) => {
                    const time = timeStr || '21:00'; // Asumir hora por defecto
                    const [hours, minutes] = time.split(':').map(Number);
                    const d = new Date(`${dateStr}T00:00:00`); // Usar T00:00:00 para evitar problemas de zona horaria del navegador
                    d.setHours(hours, minutes, 0, 0);

                    // Convertir a UTC para el enlace. Google lo ajustará a la zona del usuario.
                    const utcDate = new Date(d.getTime() - (d.getTimezoneOffset() * 60000));
                    return utcDate.toISOString().replace(/\.\d{3}Z$/, "Z").replace(/[-:]/g, '');
                };

                const startTime = toGoogleISO(event.date, event.time);

                // Crear fecha de fin asumiendo 2 horas de duración
                const endDateObj = new Date(`${event.date}T00:00:00`);
                const [startHours, startMinutes] = (event.time || '21:00').split(':').map(Number);
                endDateObj.setHours(startHours + 2, startMinutes, 0, 0);
                const endTime = toGoogleISO(endDateObj.toISOString().split('T')[0], endDateObj.toTimeString().split(' ')[0].substring(0, 5));

                shareUrl = `https://www.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(eventName)}&dates=${startTime}/${endTime}&details=${encodeURIComponent(shareText)}&location=${encodeURIComponent(location)}&ctz=Europe/Madrid`;
                break;

            case 'ics':
                window.location.href = `${API_BASE_URL}/api/generate-ics?eventId=${eventId}`;
                return; // Salir de la función

            case 'twitter':
                shareUrl = `https://twitter.com/intent/tweet?url=${encodeURIComponent(eventUrl)}&text=${encodeURIComponent(shareText)}`;
                break;
            case 'facebook':
                const shareableUrl = `${API_BASE_URL}/api/share/${eventId}`;
                shareUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareableUrl)}`;
                break;
            case 'whatsapp':
                shareUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(shareText + ' ' + eventUrl)}`;
                break;
            case 'copy':
                try {
                    await navigator.clipboard.writeText(eventUrl);
                    alert('¡Enlace copiado al portapapeles!');
                } catch (err) {
                    console.error('Error al copiar el enlace: ', err);
                    alert('No se pudo copiar el enlace.');
                }
                return; // Salir de la función después de copiar
        }

        if (shareUrl) {
            window.open(shareUrl, '_blank', 'noopener,noreferrer');
        }
    }

    async function displaySponsoredBanner(event) {
        try {
            const response = await fetch(`${API_BASE_URL}/api/config`);
            const config = await response.json();

            if (config && config.banner_enabled) {
                const bannerContainer = document.getElementById('sponsored-banner-container');
                if (bannerContainer) {
                    // --- Lógica de Banner Aleatorio ---
                    // Decidimos aleatoriamente cuál de los dos banners mostrar.
                    const bannerToShow = Math.random() < 0.5 ? 1 : 2;

                    const imageUrl = bannerToShow === 1 ? config.banner_1_imageUrl : config.banner_2_imageUrl;
                    const linkUrl = bannerToShow === 1 ? config.banner_1_linkUrl : config.banner_2_linkUrl;

                    // Si la URL de la imagen seleccionada no existe, no mostramos nada.
                    if (imageUrl) {
                        const bannerHtml = `
                        <div class="sponsored-banner">
                            <span>Patrocinado</span>
                            <a href="${linkUrl || '#'}" target="_blank" rel="noopener noreferrer">
                                <img src="${imageUrl}" alt="Banner promocional">
                            </a>
                        </div>
                    `;
                        bannerContainer.innerHTML = bannerHtml;
                    }
                }
            }
        } catch (error) {
            console.error('Error al mostrar el banner de patrocinado:', error);
        }
    }

    function setupEventListeners() {
        const header = document.querySelector('.header-main');
        if (header) {
            window.addEventListener('scroll', () => {
                header.classList.toggle('scrolled', window.scrollY > 10);
            });
        }

        // Listener para la precarga en mouseover
        document.body.addEventListener('mouseover', async (e) => {
            const sliderCard = e.target.closest('.event-card'); // Generalizamos para que funcione en grid y sliders
            if (sliderCard) {
                const eventId = sliderCard.dataset.eventId;
                if (eventId && !eventsCache[eventId]) {
                    // Pre-cargamos los datos del evento en cache
                    try {
                        const response = await fetch(`${API_BASE_URL}/api/events/${eventId}`);
                        if (!response.ok) return;
                        const eventData = await response.json();
                        eventsCache[eventId] = eventData;
                    } catch (error) {
                        // Fallo silencioso. Si el usuario hace clic, el manejador del clic se encargará.
                    }
                }
            }
        });

        document.body.addEventListener('click', async (e) => {
            const sliderCard = e.target.closest('.event-card'); // Generalizamos para que funcione en grid y sliders
            const geminiBtn = e.target.closest('.action-button.primary');
            const modalOverlay = e.target.closest('.modal-overlay:not(#welcome-modal-overlay)');
            const modalCloseBtn = e.target.closest('.modal-close-btn');
            const requestLocationBtn = e.target.closest('#request-location-btn');
            const shareBtn = e.target.closest('.share-btn');
            const modalTrigger = e.target.closest('[data-modal-trigger]');
            const sliderMapBtn = e.target.closest('.slider-map-btn');
            const retryGeolocationBtn = e.target.closest('#retry-geolocation-btn');

            if (sliderMapBtn) {
                const sliderSection = sliderMapBtn.closest('.sliders-section');
                if (sliderSection) {
                    const sliderContainer = sliderSection.querySelector('.slider-container');
                    if (sliderContainer) {
                        openMapModal(sliderContainer);
                    }
                }
            } else if (sliderCard) {
                const eventId = sliderCard.dataset.eventId;
                if (eventId) {
                    if (APP_CONFIG.USAR_PAGINAS_DE_EVENTOS) {
                        try {
                            let eventData = eventsCache[eventId];
                            if (!eventData) {
                                console.log("Cache miss on click, fetching event data...");
                                const response = await fetch(`${API_BASE_URL}/api/events/${eventId}`);
                                if (!response.ok) throw new Error('Evento no encontrado al hacer clic');
                                eventData = await response.json();
                                eventsCache[eventId] = eventData;
                            }
                            const fallbackSlug = (eventData.name || 'evento').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
                            const finalSlug = eventData.slug || fallbackSlug;
                            const url = `/eventos/${eventData._id}-${finalSlug}`;
                            window.location.href = url;
                        } catch (error) {
                            console.error('Error al generar la URL del evento:', error);
                            const eventName = sliderCard.dataset.eventName || 'evento';
                            const slug = `${eventId}-${eventName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')}`;
                            window.location.href = `/eventos/${slug}`;
                        }
                    } else {
                        try {
                            let eventData = eventsCache[eventId];
                            if (!eventData) {
                                const response = await fetch(`${API_BASE_URL}/api/events/${eventId}`);
                                if (!response.ok) throw new Error('Evento no encontrado');
                                eventData = await response.json();
                                eventsCache[eventId] = eventData;
                            }
                            trackInteraction('eventView', { eventId: eventData._id });
                            renderEventDetailModal(eventData);
                        } catch (error) {
                            console.error('Error al cargar detalles del evento:', error);
                        }
                    }
                }
            } else if (geminiBtn) {
                const eventId = geminiBtn.dataset.eventId;
                if (eventId && eventsCache[eventId]) {
                    const eventData = eventsCache[eventId];
                    trackInteraction('planNightRequest', { eventId: eventData._id });
                    getAndShowNightPlan(eventData);
                } else if (eventId) {
                    // Si el evento no está en caché, búscalo primero
                    try {
                        const response = await fetch(`${API_BASE_URL}/api/events/${eventId}`);
                        if (!response.ok) throw new Error('Evento no encontrado para Planear Noche');
                        const eventData = await response.json();
                        eventsCache[eventId] = eventData;
                        trackInteraction('planNightRequest', { eventId: eventData._id });
                        getAndShowNightPlan(eventData);
                    } catch (error) {
                        console.error(error);
                    }
                }
            } else if (requestLocationBtn) {
                fetchNearbyEvents();
            } else if (modalCloseBtn || (modalOverlay && e.target === modalOverlay)) {
                const overlayToClose = modalCloseBtn ? modalCloseBtn.closest('.modal-overlay') : modalOverlay;
                if (overlayToClose) overlayToClose.classList.remove('visible');
            } else if (shareBtn) {
                const eventPageContainer = e.target.closest('.event-page-container');
                const eventId = eventPageContainer?.dataset.eventId;
                const social = shareBtn.dataset.social;
                if (eventId && social) {
                    handleShare(social, eventId);
                }
            } else if (modalTrigger) {
                const modalId = modalTrigger.dataset.modalTrigger;
                const modal = document.getElementById(modalId);
                if (modal) {
                    modal.classList.add('visible');
                }
            } else if (retryGeolocationBtn) {
                const geoErrorModal = document.getElementById('geolocation-error-modal-overlay');
                if (geoErrorModal) {
                    geoErrorModal.classList.remove('visible');
                }
                geolocationSearch(); // Reintentar la búsqueda de geolocalización
            }
        });

        if (filterBar) {
            filterBar.addEventListener('click', (e) => {
                const filterChip = e.target.closest('.filter-chip');
                if (filterChip) {
                    e.preventDefault(); // Prevenir el salto de #
                    const newFilter = filterChip.dataset.filter;
                    if (!newFilter) return;

                    // Manejo especial para "Cerca de Mí"
                    if (newFilter === 'cerca') {
                        geolocationSearch();
                        // No continuamos, geolocationSearch se encargará del resto.
                        return;
                    }

                    const allChips = filterBar.querySelectorAll('.filter-chip');
                    allChips.forEach(btn => btn.classList.remove('active'));
                    filterChip.classList.add('active');

                    activeFilters.type = newFilter;
                    applyFiltersAndReload();
                }
            });
        }
        if (navHomeBtn) {
            navHomeBtn.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
        }
        if (navThemeToggle) {
            navThemeToggle.addEventListener('click', () => {
                const currentTheme = document.documentElement.getAttribute('data-theme');
                applyTheme(currentTheme === 'dark' ? 'light' : 'dark');
            });
        }
        if (navHowItWorksBtn) {
            navHowItWorksBtn.addEventListener('click', () => {
                if (howItWorksModal) howItWorksModal.classList.add('visible');
            });
        }
        if (navTermsBtn) {
            navTermsBtn.addEventListener('click', () => {
                if (termsModal) termsModal.classList.add('visible');
            });
        }

        // if (tripPlannerToggle) {
        //     tripPlannerToggle.addEventListener('click', () => {
        //         const tripPlannerSection = document.getElementById('trip-planner-section');
        //         if (tripPlannerSection) {
        //             tripPlannerSection.classList.toggle('active');
        //         }
        //     });
        // }

        // if (tripSearchBtn) {
        //     tripSearchBtn.addEventListener('click', () => {
        //         const city = tripCityInput.value.trim();
        //         const startDate = tripStartDateInput.value;
        //         const endDate = tripEndDateInput.value;

        //         if (!city || !startDate || !endDate) {
        //             tripResultsMessage.textContent = 'Por favor, completa todos los campos: ciudad y fechas.';
        //             tripResultsMessage.style.display = 'block';
        //             tripResultsSlider.style.display = 'none';
        //             return;
        //         }
        //         fetchTripEvents(city, startDate, endDate);
        //     });
        // }

        if (closeMapModalBtn) {
            closeMapModalBtn.addEventListener('click', closeMapModal);
        }
        if (mapModalOverlay) {
            mapModalOverlay.addEventListener('click', (e) => {
                if (e.target === mapModalOverlay) closeMapModal();
            });
        }

        // Listener para el nuevo botón de limpiar caché
        const clearCacheBtn = document.getElementById('clear-cache-btn');
        if (clearCacheBtn) {
            clearCacheBtn.addEventListener('click', () => {
                sessionStorage.clear();
                alert('Caché de la sesión limpiada. La página se recargará.');
                window.location.reload();
            });
        }

        const forceRefreshBtn = document.getElementById('force-refresh-btn');
        if (forceRefreshBtn) {
            forceRefreshBtn.addEventListener('click', handleForceRefresh);
        }
    }

    function initializeAdvancedFilters() {
        const toggleBtn = document.getElementById('advanced-filter-toggle-btn');

        if (toggleBtn && advancedFilterModalOverlay) {
            toggleBtn.addEventListener('click', () => {
                advancedFilterModalOverlay.classList.add('visible');
            });
        }

        if (advancedFilterForm) {
            advancedFilterForm.addEventListener('submit', handleFilterModalSubmit);
        }

        if (modalCityInput && modalCityResults) {
            setupAutocomplete(modalCityInput, modalCityResults, `${API_BASE_URL}/api/cities/autocomplete`, (city) => {
                // La selección solo rellena el input, el envío se hace con el botón del formulario
                modalCityInput.value = city;
                modalCityResults.innerHTML = '';
            });
        }
    }

    // --- Función Genérica de Autocompletado ---
    function setupAutocomplete(inputElement, resultsContainer, apiUrl, onSelect) {
        let debounce;
        inputElement.addEventListener('input', () => {
            clearTimeout(debounce);
            // FIX: No hacer trim() aquí para permitir espacios intermedios,
            // pero sí asegurarse de que no es solo un espacio en blanco.
            const rawQuery = inputElement.value;
            if (rawQuery.trim().length === 0) { resultsContainer.innerHTML = ''; return; }

            const query = rawQuery;
            if (query.length < 2) { resultsContainer.innerHTML = ''; return; }
            debounce = setTimeout(async () => {
                const fullApiUrl = `${apiUrl}?query=${encodeURIComponent(query)}`;
                const cached = getCache(fullApiUrl);
                if (cached) { renderAutocomplete(cached, resultsContainer, inputElement, onSelect); return; }
                try {
                    const res = await fetch(fullApiUrl);
                    const suggestions = await res.json();
                    setCache(fullApiUrl, suggestions);
                    renderAutocomplete(suggestions, resultsContainer, inputElement, onSelect);
                } catch (e) { console.error('Autocomplete fetch error:', e); }
            }, 300);
        });
        document.addEventListener('click', (e) => { if (!inputElement.parentElement.contains(e.target)) resultsContainer.innerHTML = ''; });
    }

    function renderAutocomplete(suggestions, resultsContainer, inputElement, onSelect) {
        resultsContainer.innerHTML = '';
        suggestions.forEach(suggestion => {
            const item = document.createElement('div');
            item.className = 'autocomplete-item';
            item.textContent = suggestion;
            item.onclick = () => { onSelect(suggestion.trim()); };
            resultsContainer.appendChild(item);
        });
    }

    function createVerifiedInfoModal() {
        const modalHtml = `
            <div class="modal-overlay" id="verified-info-modal">
                <div class="modal">
                    <button class="modal-close-btn">×</button>
                    <div class="modal-content">
                        <h2><ion-icon name="shield-checkmark-outline"></ion-icon> ¿Qué significa "Verificado"?</h2>
                        <p>La etiqueta "Verificado" indica que nuestro sistema ha comprobado recientemente que la <strong>página web original</strong> donde se anunció este evento sigue activa.</p>
                        <p>Esto nos da un alto grado de confianza de que el evento no ha sido cancelado, pero <strong>no es una garantía absoluta</strong>.</p>
                        <hr>
                        <h4>¿Y si no aparece la etiqueta?</h4>
                        <p>Si un evento no está verificado, puede significar varias cosas:</p>
                        <ul>
                            <li>Aún no hemos procesado su URL.</li>
                            <li>La página original ha sido eliminada (lo que podría indicar una cancelación).</li>
                            <li>Hubo un error temporal al intentar acceder a la página.</li>
                        </ul>
                        <p>En la página de detalles del evento, siempre que sea posible, te proporcionaremos un enlace a la "Fuente original" para que puedas confirmarlo por ti mismo.</p>
                    </div>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHtml);
    }

    function setupHorizontalInfiniteScroll(sentinel, category) {
        const slider = sentinel.parentElement;

        const observer = new IntersectionObserver(async (entries) => {
            if (entries[0].isIntersecting) {
                observer.unobserve(sentinel);

                let page = parseInt(slider.dataset.page || '1', 10);
                page++;

                try {
                    const response = await fetch(`${API_BASE_URL}/api/events?${category}&page=${page}&limit=10`);
                    if (!response.ok) return;

                    const data = await response.json();
                    if (data.events && data.events.length > 0) {
                        data.events.forEach(event => {
                            eventsCache[event._id] = event;
                            slider.insertBefore(createSliderCard(event), sentinel);
                        });
                        slider.dataset.page = page;

                        if (data.events.length === 10) {
                            observer.observe(sentinel);
                        } else {
                            sentinel.remove();
                        }
                    } else {
                        sentinel.remove();
                    }
                } catch (error) {
                    console.error('Error cargando más eventos en scroll horizontal:', error);
                    observer.observe(sentinel);
                }
            }
        }, { root: slider, rootMargin: '0px 200px 0px 0px' }); // Observe on the horizontal axis

        sentinel.observer = observer;
        observer.observe(sentinel);
    }

    function openInfiniteScrollModal(category, title) {
        const modalOverlay = document.getElementById('infinite-scroll-modal-overlay');
        const modalTitle = document.getElementById('infinite-scroll-modal-title');
        const modalSlider = document.getElementById('infinite-scroll-modal-slider');
        const closeBtn = document.getElementById('infinite-scroll-modal-close-btn');

        if (!modalOverlay || !modalTitle || !modalSlider || !closeBtn) {
            console.error('Elementos del modal de scroll infinito no encontrados.');
            return;
        }

        // 1. Reset state
        modalSlider.innerHTML = '';
        modalTitle.textContent = title;
        modalSlider.dataset.page = '1';
        modalSlider.dataset.category = category;

        // 2. Add loading skeletons
        for (let i = 0; i < 5; i++) {
            modalSlider.appendChild(createSkeletonCard());
        }

        // 3. Fetch initial data
        fetch(`${API_BASE_URL}/api/events?${category}&page=1&limit=10`)
            .then(response => response.json())
            .then(data => {
                modalSlider.innerHTML = ''; // Clear skeletons
                if (data.events && data.events.length > 0) {
                    renderSlider(modalSlider, data.events);

                    // 4. Setup infinite scroll if needed
                    if (data.events.length === 10) {
                        const sentinel = document.createElement('div');
                        sentinel.className = 'sentinel';
                        modalSlider.appendChild(sentinel);
                        setupHorizontalInfiniteScroll(sentinel, category);
                    }
                } else {
                    modalSlider.innerHTML = '<p style="padding: 1rem; text-align: center; color: var(--color-texto-secundario);">No hay más eventos en esta categoría.</p>';
                }
            })
            .catch(error => {
                console.error('Error al cargar eventos para el modal:', error);
                modalSlider.innerHTML = '<p style="padding: 1rem; text-align: center; color: var(--color-texto-secundario);">Error al cargar eventos.</p>';
            });

        // 5. Show modal and add close listener
        modalOverlay.classList.add('visible');

        const closeModal = () => {
            modalOverlay.classList.remove('visible');
            // Clean up observer to avoid memory leaks
            const sentinel = modalSlider.querySelector('.sentinel');
            if (sentinel && sentinel.observer) {
                sentinel.observer.disconnect();
            }
        };

        closeBtn.onclick = closeModal;
        modalOverlay.onclick = (e) => {
            if (e.target === modalOverlay) {
                closeModal();
            }
        };
    }

    function initializeInfiniteScrollFeature() {
        const sliderSections = [
            { id: 'destacados-section', category: 'featured=true', title: 'Artistas Destacados 2025' },
            { id: 'recent-section', category: 'sort=createdAt', title: 'Recién Añadidos' },
            { id: 'semana-section', category: 'timeframe=week', title: 'Esta Semana' },
        ];

        sliderSections.forEach(sectionInfo => {
            const sectionElement = document.getElementById(sectionInfo.id);
            if (sectionElement) {
                const titleContainer = sectionElement.querySelector('.slider-title-container');
                if (titleContainer) {
                    const seeAllBtn = document.createElement('button');
                    seeAllBtn.className = 'see-all-btn';
                    seeAllBtn.innerHTML = 'Ver todos <ion-icon name="arrow-forward-outline"></ion-icon>';
                    seeAllBtn.addEventListener('click', () => {
                        openInfiniteScrollModal(sectionInfo.category, sectionInfo.title);
                    });
                    titleContainer.appendChild(seeAllBtn);
                }
            }
        });
    }

    // =========================================================================
    // 3. FUNCIÓN PRINCIPAL DE ORQUESTACIÓN
    // =========================================================================
    async function handleInitialPageLoadRouting() {
        if (!APP_CONFIG.USAR_PAGINAS_DE_EVENTOS) return false;

        const path = window.location.pathname;
        const eventPageMatch = path.match(/^\/eventos\/([a-f0-9]{24})-/);

        if (eventPageMatch && eventPageMatch[1]) {
            const eventId = eventPageMatch[1];
            try {
                // --- 1. Modificar UI para la página de evento ---
                // Ocultar filtros y búsqueda
                const filterBar = document.querySelector('.filter-bar');
                if (filterBar) filterBar.style.display = 'none';
                const actionsContainer = document.querySelector('.main-actions-container');
                if (actionsContainer) actionsContainer.style.display = 'none';

                // Cambiar subtítulo del hero
                const eventStats = document.getElementById('event-stats');
                if (eventStats) eventStats.textContent = 'Evento disponible';

                // --- 2. Cargar datos del evento ---
                mainContainer.innerHTML = `<div class="loading-container"><div class="loader"></div><p>Cargando evento...</p></div>`;

                let eventData = eventsCache[eventId];
                if (!eventData) {
                    const response = await fetch(`${API_BASE_URL}/api/events/${eventId}`);
                    if (!response.ok) throw new Error('Evento no encontrado');
                    eventData = await response.json();
                    eventsCache[eventId] = eventData;
                }
                trackInteraction('eventView', { eventId: eventData._id, source: 'directURL' });
                renderEventPage(eventData); // <-- USAMOS LA NUEVA FUNCIÓN
                return true; // Indicamos que se ha cargado una página de evento
            } catch (error) {
                console.error('Error al cargar el evento desde la URL:', error);
                if (mainContainer) {
                    mainContainer.innerHTML = `<div class="error-container"><h3>Evento no encontrado</h3><p>El evento que buscas no existe o ha sido eliminado.</p></div>`;
                }
                return true; // Aunque hay un error, seguimos en una URL de evento, no cargar dashboard.
            }
        }
        return false; // No es una URL de evento, proceder con la carga normal.
    }

    async function init() {
        const savedTheme = localStorage.getItem('duende-theme') || 'light';
        applyTheme(savedTheme);
        setupEventListeners();
        initializeAdvancedFilters(); // Esto ya incluye los listeners de los filtros avanzados
        initPushNotifications();
        populateInfoModals();
        createVerifiedInfoModal();
        handleWelcomeModal();

        // Escuchar los cambios de historial (botón atrás/adelante del navegador)
        window.addEventListener('popstate', (event) => {
            // Si el usuario navega hacia atrás a una URL sin parámetros, recargar el dashboard.
            if (!window.location.search) {
                initializeDashboard();
            }
        });

        const isEventPage = await handleInitialPageLoadRouting();

        // Si no es una página de evento, siempre inicializar el dashboard por defecto.
        if (!isEventPage) {
            initializeDashboard();
        }
    }

    // =========================================================================
    // 4. INICIALIZACIÓN
    // =========================================================================
    init();

});