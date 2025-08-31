document.addEventListener('DOMContentLoaded', () => {
    // =========================================================================
    // 1. CONFIGURACIÓN Y SELECTORES
    // =========================================================================
    const API_BASE_URL = window.location.hostname.includes('localhost') ? 'http://localhost:3000' : '';

    // --- Contenedores de Sliders y Secciones ---
    const mainContainer = document.querySelector('.container');
    const featuredSlider = document.getElementById('featured-events-slider');
    const weekSlider = document.getElementById('week-events-slider');
    const todaySlider = document.getElementById('today-events-slider');
    const nearbySlider = document.getElementById('nearby-events-slider');
    const monthlySlidersContainer = document.getElementById('monthly-sliders-container');

    // --- Cabecera y Filtros ---
    const filterBar = document.querySelector('.filter-bar');
    const cercaDeMiChip = document.getElementById('cerca-de-mi-chip');

    // --- (Resto de selectores que se mantengan) ---

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
        // ... (Tu función completa aquí) ...
    }

    // =========================================================================
    // 4. FUNCIONES AUXILIARES
    // =========================================================================

    function groupEventsByMonth(events) {
        // --- LÓGICA CORREGIDA ---
        // Simplemente agrupa todos los eventos por mes, sin filtrar nada.
        return events.reduce((acc, event) => {
            if (!event.date) return acc;
            const monthKey = event.date.substring(0, 7); // Extrae 'AAAA-MM'
            if (!acc[monthKey]) {
                acc[monthKey] = [];
            }
            acc[monthKey].push(event);
            return acc;
        }, {});
    }

    async function fetchWithCache(endpoint, cacheKey, expiryInMinutes = 30) {
        const cachedItem = localStorage.getItem(cacheKey);
        const now = new Date().getTime();
        if (cachedItem) {
            const { timestamp, data } = JSON.parse(cachedItem);
            if ((now - timestamp) / (1000 * 60) < expiryInMinutes) {
                return Promise.resolve(data);
            }
        }
        const response = await fetch(`${API_BASE_URL}${endpoint}`);
        if (!response.ok) throw new Error(`Fallo en la petición de red para ${endpoint}`);
        const data = await response.json();
        localStorage.setItem(cacheKey, JSON.stringify({ timestamp: now, data }));
        return data;
    }

    function sanitizeField(value, defaultText = 'No disponible') {
        if (value && typeof value === 'string' && value.trim()) {
            return value.trim();
        }
        return defaultText;
    }

    // ... (El resto de tus funciones auxiliares: applyTheme, geolocationSearch, etc.)

    // =========================================================================
    // 5. GESTORES DE EVENTOS Y LISTENERS
    // =========================================================================
    function setupEventListeners() {
        // ... (Tu función completa aquí) ...
    }

    // =========================================================================
    // 6. INICIALIZACIÓN
    // =========================================================================
    function init() {
        // ... (Tu función de inicialización aquí) ...
        initializeDashboard();
    }

    init();
});