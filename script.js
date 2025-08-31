document.addEventListener('DOMContentLoaded', () => {
    // =========================================================================
    // 1. CONFIGURACIÓN Y SELECTORES
    // =========================================================================
    const API_BASE_URL = window.location.hostname.includes('localhost') ? 'http://localhost:3000' : '';

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
    const cercaDeMiChip = document.getElementById('cerca-de-mi-chip');

    const eventDetailModalOverlay = document.getElementById('event-detail-modal-overlay');
    const howItWorksModal = document.getElementById('how-it-works-modal-overlay');
    const termsModal = document.getElementById('terms-modal-overlay');

    // =========================================================================
    // 2. LÓGICA PRINCIPAL DE CARGA DEL DASHBOARD
    // =========================================================================
    async function initializeDashboard() {
        try {
            const [featuredData, weekData, todayData, allEventsData] = await Promise.all([
                fetchWithCache('/api/events?featured=true&limit=10', 'featured-events', 60),
                fetchWithCache('/api/events?dateRange=week&limit=10', 'week-events', 30),
                fetchWithCache('/api/events?date=today&limit=10', 'today-events', 15),
                fetchWithCache('/api/events?sort=date', 'all-events', 180)
            ]);

            renderSlider(featuredSlider, featuredData?.events);
            renderSlider(weekSlider, weekData?.events);
            renderSlider(todaySlider, todayData?.events);

            if (allEventsData?.events) {
                const monthlyGroups = groupEventsByMonth(allEventsData.events);
                renderMonthlySliders(monthlyGroups);
            }
        } catch (error) {
            console.error("Error fatal al cargar el dashboard:", error);
            const mainContainer = document.querySelector('.container');
            if (mainContainer) mainContainer.innerHTML = '<h2>Oops! No se pudo cargar el contenido. Inténtalo de nuevo más tarde.</h2>';
        }
    }

    // =========================================================================
    // 3. FUNCIONES DE RENDERIZADO
    // =========================================================================
    function renderSlider(container, events) {
        if (!container) return;
        const section = container.parentElement;
        if (!events || events.length === 0) {
            if (section) section.style.display = 'none';
            return;
        }
        if (section) section.style.display = 'block';
        container.innerHTML = '';
        events.forEach(event => container.appendChild(createSliderCard(event)));
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

            events.forEach(event => sliderContainer.appendChild(createSliderCard(event)));

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
        eventCard.setAttribute('data-artist-name', artistName);
        const placeholderUrl = './assets/flamenco-placeholder.png';
        const eventImageUrl = event.imageUrl || placeholderUrl;
        eventCard.innerHTML = `
            <img src="${eventImageUrl}" alt="${artistName}" class="card-image" onerror="this.src='${placeholderUrl}'">
            <div class="card-content">
                <h3 class="card-title">${artistName}</h3>
            </div>
        `;
        return eventCard;
    }

    function renderEventDetailModal(event) {
        if (!eventDetailModalOverlay) return;
        const eventName = sanitizeField(event.name, 'Evento sin título');
        const artistName = sanitizeField(event.artist, 'Artista por confirmar');
        const description = sanitizeField(event.description, 'Sin descripción disponible.');
        const eventTime = sanitizeField(event.time, 'No disponible');
        const eventDate = event.date ? new Date(event.date).toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' }) : 'Fecha no disponible';
        const venue = sanitizeField(event.location?.venue, '');
        const city = sanitizeField(event.location?.city, '');
        let displayLocation = 'Ubicación no disponible';
        if (venue && city) displayLocation = `${venue}, ${city}`;
        else if (venue || city) displayLocation = venue || city;
        const mapQuery = [eventName, venue, city, sanitizeField(event.location?.country, '')].filter(Boolean).join(', ');
        const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapQuery)}`;
        const blogUrl = event.blogPostUrl || 'https://afland.es/';
        const blogText = event.blogPostUrl ? 'Leer en el Blog' : 'Explorar Blog';
        const blogIcon = event.blogPostUrl ? 'book-outline' : 'newspaper-outline';
        const blogButtonClass = event.blogPostUrl ? 'blog-link-btn' : 'btn-blog-explorar';
        const eventImageUrl = event.imageUrl || './assets/flamenco-placeholder.png';

        eventDetailModalOverlay.innerHTML = `
            <div class="modal">
                <button class="modal-close-btn">&times;</button>
                <div class="modal-content modal-event-details">
                    ${event.imageUrl ? `<div class="evento-card-img-container"><img src="${eventImageUrl}" alt="Imagen de ${eventName}" class="evento-card-img" onerror="this.parentElement.style.display='none'"></div>` : ''}
                    <div class="card-header">
                        <h3 class="titulo-truncado" title="${eventName}">${eventName}</h3>
                    </div>
                    <div class="artista"><ion-icon name="person-outline"></ion-icon> <span>${artistName}</span></div>
                    <p class="descripcion-corta">${description}</p>
                    <div class="card-detalles">
                        <div class="evento-detalle"><ion-icon name="calendar-outline"></ion-icon><span>${eventDate}</span></div>
                        <div class="evento-detalle"><ion-icon name="time-outline"></ion-icon><span>${eventTime}</span></div>
                        <div class="evento-detalle"><a href="${mapsUrl}" target="_blank" rel="noopener noreferrer"><ion-icon name="location-outline"></ion-icon><span>${displayLocation}</span></a></div>
                    </div>
                    <div class="card-actions">
                        <div class="card-actions-primary">
                            <button class="gemini-btn" data-event-id="${event._id}"><ion-icon name="sparkles-outline"></ion-icon> Planear Noche</button>
                            <a href="${blogUrl}" target="_blank" rel="noopener noreferrer" class="${blogButtonClass}"><ion-icon name="${blogIcon}"></ion-icon> ${blogText}</a>
                            <button class="share-button" data-event-id="${event._id}"><ion-icon name="share-social-outline"></ion-icon> Compartir</button>
                        </div>
                    </div>
                </div>
            </div>`;
        eventDetailModalOverlay.classList.add('visible');
    }

    // =========================================================================
    // 4. FUNCIONES AUXILIARES
    // =========================================================================
    function groupEventsByMonth(events) { /* ... (Sin cambios) ... */ }
    async function fetchWithCache(endpoint, cacheKey, expiryInMinutes = 30) { /* ... (Sin cambios) ... */ }
    function sanitizeField(value, defaultText = 'No disponible') { /* ... (Sin cambios) ... */ }
    function applyTheme(theme) { /* ... (Sin cambios) ... */ }
    // ... (Otras funciones auxiliares)

    // =========================================================================
    // 5. GESTORES DE EVENTOS Y LISTENERS
    // =========================================================================
    function setupEventListeners() {
        // Clics en los sliders para abrir el modal de detalle
        document.querySelectorAll('.slider-container').forEach(slider => {
            slider.addEventListener('click', async (e) => {
                const card = e.target.closest('.event-card');
                if (card && card.dataset.eventId) {
                    const eventId = card.dataset.eventId;
                    try {
                        const data = await fetchWithCache(`/api/events/${eventId}`, `event-${eventId}`, 120);
                        renderEventDetailModal(data);
                    } catch (error) {
                        console.error('Error al cargar detalles del evento:', error);
                    }
                }
            });
        });

        // Clics en los filtros de la cabecera para hacer scroll
        if (filterBar) {
            filterBar.addEventListener('click', (e) => {
                if (e.target.classList.contains('filter-chip')) {
                    filterBar.querySelectorAll('.filter-chip').forEach(btn => btn.classList.remove('active'));
                    e.target.classList.add('active');
                }
            });
        }

        // Clic en "Cerca de Mí"
        if (cercaDeMiChip) {
            cercaDeMiChip.addEventListener('click', geolocationSearch);
        }

        // --- Listeners para la Barra de Navegación Inferior ---
        // ... (Tu código de listeners para la barra de navegación)

        // Cierre genérico para todos los modales
        document.body.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal-overlay') || e.target.classList.contains('modal-close-btn')) {
                const modal = e.target.closest('.modal-overlay');
                if (modal) modal.classList.remove('visible');
            }
        });
    }

    // =========================================================================
    // 6. INICIALIZACIÓN
    // =========================================================================
    function init() {
        const savedTheme = localStorage.getItem('duende-theme') || 'dark';
        applyTheme(savedTheme);
        setupEventListeners();
        initializeDashboard();
    }

    init();
});