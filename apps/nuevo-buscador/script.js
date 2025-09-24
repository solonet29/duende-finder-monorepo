import { CountUp } from './libs/countup.js';
import { initPushNotifications } from './notifications.js';

document.addEventListener('DOMContentLoaded', () => {
    // =========================================================================
    // 1. CONFIGURACIÓN Y SELECTORES
    // =========================================================================
    const APP_CONFIG = {
        USAR_PAGINAS_DE_EVENTOS: true // Poner en false para volver al modo modal
    };

    const getApiBaseUrl = () => {
        const hostname = window.location.hostname;
        if (hostname.includes('localhost')) {
            return 'http://localhost:3000';
        }
        return 'https://api-v2.afland.es';
    };

    const API_BASE_URL = getApiBaseUrl();
    let eventsCache = {};
    let modalMapInstance = null;

    const modalContent = {
        howItWorks: `
        <p><strong>Duende Finder es tu asistente inteligente para descubrir el flamenco a tu alrededor y en todo el mundo.</strong></p>
        <ol>
            <li><strong>Encuentra Eventos Cerca de Ti:</strong> Pulsa el botón <strong>"Cerca de mí"</strong> para que el buscador te muestre al instante los tablaos y eventos más próximos a tu ubicación actual.</li>
            <li><strong>Explora el Resto:</strong> Navega por la lista completa de eventos. Usamos IA para encontrar y organizar actuaciones de múltiples fuentes públicas.</li>
            <li><strong>Planifica tu Noche:</strong> Haz clic en "Planear Noche" en cualquier evento. Gemini, nuestro copiloto de IA, te creará una guía con recomendaciones de restaurantes, transporte y consejos para disfrutar al máximo.</li>
        </ol>
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
    const tripCityInput = document.getElementById('trip-city');
    const tripStartDateInput = document.getElementById('trip-start-date');
    const tripEndDateInput = document.getElementById('trip-end-date');
    const tripSearchBtn = document.getElementById('trip-search-btn');
    const tripResultsSlider = document.getElementById('trip-results-slider');
    const tripResultsMessage = document.getElementById('trip-results-message');
    const showMapBtn = document.getElementById('show-map-btn');
    const mapModalOverlay = document.getElementById('map-modal-overlay');
    const closeMapModalBtn = document.getElementById('close-map-modal-btn');

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

    async function displayEventCount() {
        const counterElement = document.getElementById('event-stats');
        if (!counterElement) return;
        try {
            const response = await fetch(`${API_BASE_URL}/api/events/count`);
            if (!response.ok) throw new Error('Error en la respuesta de la API');
            const data = await response.json();
            const totalEvents = data.total;
            const countUp = new CountUp(counterElement, totalEvents, { prefix: '+', suffix: ' eventos de flamenco verificados', duration: 2.5, separator: '.', useEasing: true });
            if (!countUp.error) {
                countUp.start();
            } else {
                counterElement.textContent = `+${totalEvents.toLocaleString('es-ES')} eventos de flamenco verificados`;
            }
            counterElement.classList.add('loaded');
        } catch (error) {
            console.error('Error al cargar el contador de eventos:', error);
            counterElement.style.display = 'none';
        }
    }

    function openMapModal() {
        if (!mapModalOverlay) return;
        const eventsToShow = getEventsForMap();
        if (eventsToShow.length === 0) {
            alert('No hay eventos para mostrar en el mapa para el filtro actual.');
            return;
        }
        mapModalOverlay.classList.add('visible');
        // Forzamos la invalidación del tamaño del mapa un poco después de que el modal sea visible
        setTimeout(() => initializeModalMap(eventsToShow), 10);
    }

    function closeMapModal() {
        if (mapModalOverlay) {
            mapModalOverlay.classList.remove('visible');
        }
    }

    function getEventsForMap() {
        const activeFilter = document.querySelector('.filter-bar .filter-chip.active');
        let sliderId;

        if (activeFilter) {
            const filterHref = activeFilter.getAttribute('href');
            if (filterHref && filterHref.startsWith('#')) {
                const sectionId = filterHref.substring(1);
                const section = document.getElementById(sectionId);
                if (section) {
                    const slider = section.querySelector('.slider-container');
                    if (slider) {
                        sliderId = slider.id;
                    }
                }
            } else if (activeFilter.dataset.filter === 'cerca') {
                sliderId = 'nearby-events-slider';
            }
        }

        if (!sliderId) {
            // Fallback a los eventos destacados si no hay filtro activo
            sliderId = 'featured-events-slider';
        }
        
        const slider = document.getElementById(sliderId);
        if (!slider) return [];

        const eventCards = slider.querySelectorAll('.event-card');
        const eventIds = Array.from(eventCards).map(card => card.dataset.eventId);
        
        return eventIds.map(id => eventsCache[id]).filter(Boolean);
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

    async function initializeDashboard() {
        const sliders = [featuredSlider, weekSlider, todaySlider];
        sliders.forEach(slider => {
            if (slider) {
                const section = slider.closest('.sliders-section');
                if (section) section.style.display = 'block';
                slider.innerHTML = ''; // Limpiar contenido existente
                for (let i = 0; i < 5; i++) { // Mostrar 5 tarjetas de esqueleto
                    slider.appendChild(createSkeletonCard());
                }
            }
        });

        try {
            const userLocationPromise = getUserLocation().catch(() => null);

            const [featuredData, weekData, todayData, allEventsData] = await Promise.all([
                fetch(`${API_BASE_URL}/api/events?featured=true&limit=10`).then(res => res.json()),
                fetch(`${API_BASE_URL}/api/events?timeframe=week&limit=10`).then(res => res.json()),
                fetch(`${API_BASE_URL}/api/events?timeframe=today&limit=10`).then(res => res.json()),
                fetch(`${API_BASE_URL}/api/events?sort=date`).then(res => res.json())
            ]);

            const userLocation = await userLocationPromise;
            let featuredEvents = featuredData?.events || [];
            let weekEvents = weekData?.events || [];
            let todayEvents = todayData?.events || [];

            const sortByDate = (a, b) => new Date(a.date) - new Date(b.date);
            featuredEvents.sort(sortByDate);
            weekEvents.sort(sortByDate);
            todayEvents.sort(sortByDate);

            renderSlider(featuredSlider, featuredEvents);
            renderSlider(weekSlider, weekEvents);
            renderSlider(todaySlider, todayEvents);

            if (allEventsData?.events) {
                const monthlyGroups = groupEventsByMonth(allEventsData.events);
                renderMonthlySliders(monthlyGroups);
            }
        } catch (error) {
            console.error("Error fatal al cargar el dashboard:", error);
            if (mainContainer) mainContainer.innerHTML = '<h2>Oops! No se pudo cargar el contenido.</h2>';
        }
    }

    function renderSlider(container, events) {
        if (!container) return;
        const section = container.closest('.sliders-section');
        if (!events || events.length === 0) {
            if (section) section.style.display = 'none';
            return;
        }
        if (section) section.style.display = 'block';
        container.innerHTML = '';
        events.forEach(event => {
            eventsCache[event._id] = event;
            container.appendChild(createSliderCard(event));
        });
    }

    function renderMonthlySliders(monthlyGroups) {
        if (!monthlySlidersContainer) return;
        monthlySlidersContainer.innerHTML = '';
        const sortedMonths = Object.keys(monthlyGroups).sort();
        sortedMonths.forEach(monthKey => {
            const events = monthlyGroups[monthKey];
            const [year, month] = monthKey.split('-');
            const monthDate = new Date(year, parseInt(month, 10) - 1);
            const monthName = monthDate.toLocaleString('es-ES', { month: 'long' });
            const titleText = `${monthName.charAt(0).toUpperCase() + monthName.slice(1)} ${year}`;
            const section = document.createElement('section');
            section.className = 'sliders-section';
            section.id = `month-${monthKey}-section`;
            const title = document.createElement('h2');
            title.textContent = titleText;
            const sliderContainer = document.createElement('div');
            sliderContainer.className = 'slider-container';
            sliderContainer.id = `slider-month-${monthKey}`;
            events.forEach(event => {
                eventsCache[event._id] = event;
                sliderContainer.appendChild(createSliderCard(event));
            });
            section.appendChild(title);
            section.appendChild(sliderContainer);
            monthlySlidersContainer.appendChild(section);
        });
    }

    function createSliderCard(event) {
        const eventCard = document.createElement('div');
        eventCard.className = 'event-card';
        eventCard.setAttribute('data-event-id', event._id);
        const artistName = sanitizeField(event.artist, 'Artista por confirmar');
        const eventName = sanitizeField(event.name, 'evento');
        eventCard.setAttribute('data-artist-name', artistName);
        eventCard.setAttribute('data-event-name', eventName);

        const placeholderUrl = './assets/flamenco-placeholder.png';
        let eventImageUrl = placeholderUrl;
        if (event.imageUrl && typeof event.imageUrl === 'string' && event.imageUrl.trim().startsWith('http')) {
            eventImageUrl = event.imageUrl.trim();
        }

        eventCard.innerHTML = `<img src="${eventImageUrl}" alt="${artistName}" class="card-image" onerror="this.onerror=null;this.src='${placeholderUrl}'"><div class="card-content"><h3 class="card-title">${artistName}</h3></div>`;
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
        const blogUrl = event.blogPostUrl || 'https://afland.es/';
        const blogText = event.blogPostUrl ? 'Leer en el Blog' : 'Explorar Blog';

        let imageHtml = '';
        if (event.imageUrl && typeof event.imageUrl === 'string' && event.imageUrl.trim().startsWith('http')) {
            imageHtml = `<div class="evento-card-img-container"><img src="${event.imageUrl.trim()}" alt="Imagen de ${eventName}" class="evento-card-img" onerror="this.parentElement.style.display='none'"></div>`;
        }

        const pageHtml = `
            <div class="event-page-container" data-event-id="${event._id}">
                <div class="event-page-content">
                    <div id="sponsored-banner-container"></div>
                    ${imageHtml}
                    
                    <h1>${eventName}</h1>
                    <div class="artist-name">
                        <ion-icon name="person-outline"></ion-icon>
                        <span>${artistName}</span>
                    </div>

                    <div class="event-details-group">
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
                        <p class="share-title">Compartir:</p>
                        <div class="share-buttons-container">
                            <button class="share-btn" data-social="twitter" title="Compartir en Twitter/X"><ion-icon name="logo-twitter"></ion-icon></button>
                            <button class="share-btn" data-social="facebook" title="Compartir en Facebook"><ion-icon name="logo-facebook"></ion-icon></button>
                            <button class="share-btn" data-social="whatsapp" title="Compartir en WhatsApp"><ion-icon name="logo-whatsapp"></ion-icon></button>
                            <button class="share-btn" data-social="copy" title="Copiar enlace"><ion-icon name="copy-outline"></ion-icon></button>
                        </div>
                    </div>
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
                src="https://www.openstreetmap.org/export/embed.html?bbox=${lon - 0.01}%2C${lat - 0.01}%2C${lon + 0.01}%2C${lat + 0.01}&layer=mapnik&marker=${lat}%2C${lon}"
                style="border: 1px solid var(--color-borde); border-radius: 12px;">
            </iframe>`;
            mapContainer.innerHTML = mapHtml;
        }

        window.scrollTo(0, 0); // Scroll to top

        // Modificar la cabecera para mostrar el botón de "Volver"
        const headerContainer = document.querySelector('header.header-main .container');
        if (headerContainer) {
            headerContainer.innerHTML = `
                <nav class="event-page-nav">
                    <a href="/" class="back-button">&larr; Volver a la lista</a>
                </nav>
            `;
        }
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
        if (event.imageUrl && typeof event.imageUrl === 'string' && event.imageUrl.trim().startsWith('http')) {
            imageHtml = `<div class="evento-card-img-container"><img src="${event.imageUrl.trim()}" alt="Imagen de ${eventName}" class="evento-card-img" onerror="this.parentElement.style.display='none'"></div>`;
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

    function geolocationSearch() {
        const cercaSection = document.getElementById('cerca-section');
        if (!cercaSection || !navigator.geolocation) return;
        cercaSection.style.display = 'block';
        const headerOffset = document.querySelector('header.header-main')?.offsetHeight + 15 || 80;
        const elementPosition = cercaSection.getBoundingClientRect().top;
        const offsetPosition = elementPosition + window.pageYOffset - headerOffset;
        window.scrollTo({ top: offsetPosition, behavior: "smooth" });
        navigator.permissions.query({ name: 'geolocation' }).then(result => {
            if (result.state === 'granted') fetchNearbyEvents();
            else if (result.state === 'prompt') renderGeolocationPrompt();
            else if (result.state === 'denied') renderGeolocationDenied();
        });
    }

    function renderGeolocationPrompt() {
        if (nearbySlider) nearbySlider.innerHTML = `<div class="cta-section" style="margin: 0; padding: 1.5rem;"><p style="margin-bottom: 1rem;">Para ver eventos cercanos, necesitamos tu permiso de ubicación.</p><button id="request-location-btn" class="cta-btn">Permitir Ubicación</button></div>`;
    }

    function renderGeolocationDenied() {
        if (nearbySlider) nearbySlider.innerHTML = `<p style="color: var(--color-texto-secundario); padding: 1rem; text-align: center;">Has bloqueado los permisos de ubicación.</p>`;
    }

    function fetchNearbyEvents() {
        if (nearbySlider) nearbySlider.innerHTML = `<div class="skeleton-card" style="width: 100%;"></div>`;
        navigator.geolocation.getCurrentPosition(
            async position => {
                const { latitude, longitude } = position.coords;
                trackInteraction('nearMeSearch', { location: { lat: latitude, lng: longitude } });
                try {
                    const response = await fetch(`${API_BASE_URL}/api/events?lat=${latitude}&lon=${longitude}&radius=60&limit=10`);
                    if (!response.ok) throw new Error('Error en la petición');
                    const nearbyData = await response.json();
                    renderSlider(nearbySlider, nearbyData?.events);
                } catch (error) {
                    renderGeolocationDenied();
                }
            },
            error => {
                console.error("Error de geolocalización:", error);
                renderGeolocationDenied();
            }
        );
    }

    async function fetchTripEvents() {
        if (!tripCityInput || !tripStartDateInput || !tripEndDateInput || !tripResultsSlider || !tripResultsMessage) return;

        const city = tripCityInput.value.trim();
        const startDate = tripStartDateInput.value;
        const endDate = tripEndDateInput.value;

        if (!city || !startDate || !endDate) {
            tripResultsMessage.textContent = 'Por favor, completa todos los campos: ciudad y fechas.';
            tripResultsMessage.style.display = 'block';
            tripResultsSlider.style.display = 'none';
            return;
        }

        tripResultsSlider.innerHTML = `<div class="skeleton-card" style="width: 100%;"></div>`;
        tripResultsSlider.style.display = 'flex';
        tripResultsMessage.style.display = 'none';

        try {
            const response = await fetch(`${API_BASE_URL}/api/events?city=${encodeURIComponent(city)}&dateFrom=${startDate}&dateTo=${endDate}&limit=20`);
            if (!response.ok) throw new Error('Error en la respuesta del servidor.');

            const data = await response.json();

            if (data.events && data.events.length > 0) {
                renderSlider(tripResultsSlider, data.events);
            } else {
                tripResultsMessage.textContent = 'No se encontraron eventos para esa ciudad y fechas.';
                tripResultsMessage.style.display = 'block';
                tripResultsSlider.innerHTML = '';
                tripResultsSlider.style.display = 'none';
            }
        } catch (error) {
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
        if (modalContent) modalContent.innerHTML = `<div class="loading-container"><div class="loader"></div><p>Planeando tu noche...</p></div>`;
        try {
            const response = await fetch(`${API_BASE_URL}/api/generate-night-plan?eventId=${event._id}`);
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ error: "Error desconocido en el servidor" }));
                throw new Error(errorData.error);
            }
            const data = await response.json();
            const footerHtml = `<footer class="ai-footer"><p class="ai-disclaimer"><em>Contenido generado por IA. La información puede no ser exacta.</em></p><a href="https://afland.es/contact" target="_blank" rel="noopener noreferrer" class="business-cta">¿Quieres ver tu negocio aquí? Contacta</a></footer>`;
            const aiHtmlContent = window.marked ? window.marked.parse(data.content) : `<pre>${data.content}</pre>`;
            if (modalContent) modalContent.innerHTML = aiHtmlContent + footerHtml;
        } catch (error) {
            console.error("Error al generar Plan Noche:", error);
            if (modalContent) modalContent.innerHTML = `<div class="error-container"><h3>¡Vaya! Algo ha fallado</h3><p>${error.message}</p></div>`;
        }
    }

    async function handleShare(socialPlatform, eventId) {
        const event = eventsCache[eventId];
        if (!event) {
            console.error('Evento no encontrado en caché para compartir');
            // Opcional: mostrar un mensaje al usuario
            alert('No se pudo compartir el evento. Inténtalo de nuevo.');
            return;
        }

        const eventUrl = window.location.href;
        let shareText;

        try {
            if (window.ai && (await window.ai.canCreateTextSession()) === "readily") {
                const session = await window.ai.createTextSession();
                const prompt = `Genera un texto corto y atractivo para compartir en redes sociales sobre el siguiente evento de flamenco. Incluye el nombre del evento, el artista y la ciudad. Máximo 280 caracteres. El evento es: ${event.name} con ${event.artist} en ${event.city}.`;
                shareText = await session.prompt(prompt);
                session.destroy();
            } else {
                throw new Error('window.ai no disponible o no listo.');
            }
        } catch (e) {
            console.log('Fallback a texto de compartido por defecto:', e.message);
            shareText = event.description || `${event.name} con ${event.artist}`;
        }

        let shareUrl;
        switch (socialPlatform) {
            case 'twitter':
                shareUrl = `https://twitter.com/intent/tweet?url=${encodeURIComponent(eventUrl)}&text=${encodeURIComponent(shareText)}`;
                break;
            case 'facebook':
                shareUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(eventUrl)}`;
                break;
            case 'whatsapp':
                shareUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(shareText + ' ' + eventUrl)}`;
                break;
            case 'copy':
                try {
                    await navigator.clipboard.writeText(eventUrl);
                    // Considera mostrar una notificación más sutil que un alert
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
                    const bannerHtml = `
                        <div class="sponsored-banner">
                            <span>Patrocinado</span>
                            <a href="${config.banner_linkUrl || '#'}" target="_blank" rel="noopener noreferrer">
                                <img src="${config.banner_imageUrl}" alt="Banner promocional">
                            </a>
                        </div>
                    `;
                    bannerContainer.innerHTML = bannerHtml;
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
            const sliderCard = e.target.closest('.slider-container .event-card');
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
            const sliderCard = e.target.closest('.slider-container .event-card');
            const geminiBtn = e.target.closest('.gemini-btn');
            const modalOverlay = e.target.closest('.modal-overlay:not(#welcome-modal-overlay)');
            const modalCloseBtn = e.target.closest('.modal-close-btn');
            const requestLocationBtn = e.target.closest('#request-location-btn');
            const shareBtn = e.target.closest('.share-btn');

            if (sliderCard) {
                const eventId = sliderCard.dataset.eventId;
                if (eventId) {
                    if (APP_CONFIG.USAR_PAGINAS_DE_EVENTOS) {
                        try {
                            // Obtenemos los datos completos del evento (deberían estar en caché por el mouseover)
                            let eventData = eventsCache[eventId];
                            if (!eventData) {
                                console.log("Cache miss on click, fetching event data...");
                                const response = await fetch(`${API_BASE_URL}/api/events/${eventId}`);
                                if (!response.ok) throw new Error('Evento no encontrado al hacer clic');
                                eventData = await response.json();
                                eventsCache[eventId] = eventData;
                            }

                            // Lógica de slug retrocompatible
                            const fallbackSlug = (eventData.name || 'evento').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
                            const finalSlug = eventData.slug || fallbackSlug;

                            const url = `/eventos/${eventData._id}-${finalSlug}`;
                            window.location.href = url;

                        } catch (error) {
                            console.error('Error al generar la URL del evento:', error);
                            // Fallback a la URL antigua si todo lo demás falla
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
                const eventData = eventsCache[eventId];
                trackInteraction('planNightRequest', { eventId: eventData._id });
                if (eventData) getAndShowNightPlan(eventData);
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
            }
        });
        if (filterBar) {
            filterBar.addEventListener('click', (e) => {
                const filterChip = e.target.closest('.filter-chip');
                if (filterChip) {
                    e.preventDefault();
                    filterBar.querySelectorAll('.filter-chip').forEach(btn => btn.classList.remove('active'));
                    filterChip.classList.add('active');
                    if (filterChip.dataset.filter === 'cerca') {
                        geolocationSearch();
                        return;
                    }
                    const targetId = filterChip.getAttribute('href');
                    const targetSection = document.querySelector(targetId);
                    if (targetSection) {
                        const headerOffset = document.querySelector('header.header-main')?.offsetHeight + 15 || 80;
                        const elementPosition = targetSection.getBoundingClientRect().top;
                        const offsetPosition = elementPosition + window.pageYOffset - headerOffset;
                        window.scrollTo({ top: offsetPosition, behavior: "smooth" });
                    }
                }
            });
        }
        if (navHomeBtn) navHomeBtn.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
        if (navThemeToggle) navThemeToggle.addEventListener('click', () => {
            const currentTheme = document.documentElement.getAttribute('data-theme');
            applyTheme(currentTheme === 'dark' ? 'light' : 'dark');
        });
        if (navHowItWorksBtn) navHowItWorksBtn.addEventListener('click', () => howItWorksModal?.classList.add('visible'));
        if (navTermsBtn) navTermsBtn.addEventListener('click', () => termsModal?.classList.add('visible'));
        
        const tripPlannerToggle = document.getElementById('trip-planner-toggle');
        if (tripPlannerToggle) {
            tripPlannerToggle.addEventListener('click', () => {
                const tripPlannerSection = document.getElementById('trip-planner-section');
                tripPlannerSection.classList.toggle('active');
            });
        }

        if (tripSearchBtn) {
            tripSearchBtn.addEventListener('click', fetchTripEvents);
        }

        if (showMapBtn) {
            showMapBtn.addEventListener('click', (e) => {
                e.preventDefault();
                openMapModal();
            });
        }
        if (closeMapModalBtn) {
            closeMapModalBtn.addEventListener('click', closeMapModal);
        }
        if (mapModalOverlay) {
            mapModalOverlay.addEventListener('click', (e) => {
                if (e.target === mapModalOverlay) closeMapModal();
            });
        }
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
        initPushNotifications();
        populateInfoModals();
        handleWelcomeModal();

        const isEventPage = await handleInitialPageLoadRouting();

        if (!isEventPage) {
            // Si NO es una página de evento, cargar el dashboard y el contador
            displayEventCount();
            initializeDashboard();
        }
    }

    // =========================================================================
    // 4. INICIALIZACIÓN
    // =========================================================================
    init();

});
