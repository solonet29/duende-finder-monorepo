document.addEventListener('DOMContentLoaded', () => {
    // =========================================================================
    // 1. CONFIGURACIÓN Y SELECTORES
    // =========================================================================
    const API_BASE_URL = window.location.hostname.includes('localhost') ? 'http://localhost:3000' : '';
    let eventsCache = {};

    // --- Contenedores Principales ---
    const mainContainer = document.querySelector('.container');
    const featuredSlider = document.getElementById('featured-events-slider');
    const weekSlider = document.getElementById('week-events-slider');
    const todaySlider = document.getElementById('today-events-slider');
    const nearbySlider = document.getElementById('nearby-events-slider');
    const monthlySlidersContainer = document.getElementById('monthly-sliders-container');
    const filterBar = document.querySelector('.filter-bar');
    const cercaDeMiChip = document.getElementById('cerca-de-mi-chip');

    // --- Barra de Navegación Inferior ---
    const navHomeBtn = document.getElementById('nav-home-btn');
    const navHowItWorksBtn = document.getElementById('nav-how-it-works-btn');
    const navTermsBtn = document.getElementById('nav-terms-btn');
    const navThemeToggle = document.getElementById('nav-theme-toggle');

    // --- Modales ---
    const eventDetailModalOverlay = document.getElementById('event-detail-modal-overlay');
    const howItWorksModal = document.getElementById('how-it-works-modal-overlay');
    const termsModal = document.getElementById('terms-modal-overlay');
    const geminiModalOverlay = document.getElementById('gemini-modal-overlay');

    // =========================================================================
    // 2. LÓGICA PRINCIPAL DE CARGA DEL DASHBOARD
    // =========================================================================
    async function initializeDashboard() {
        // ... (Tu función completa aquí, sin cambios)
    }

    // =========================================================================
    // 3. FUNCIONES DE RENDERIZADO
    // =========================================================================
    function renderSlider(container, events) { /* ... (Tu función completa aquí, sin cambios) ... */ }
    function renderMonthlySliders(monthlyGroups) { /* ... (Tu función completa aquí, sin cambios) ... */ }
    function createSliderCard(event) { /* ... (Tu función completa aquí, sin cambios) ... */ }
    function renderEventDetailModal(event) { /* ... (Tu función completa aquí, sin cambios) ... */ }

    // =========================================================================
    // 4. FUNCIONES AUXILIARES
    // =========================================================================
    function groupEventsByMonth(events) { /* ... (Tu función completa aquí, sin cambios) ... */ }
    async function fetchWithCache(endpoint, cacheKey, expiryInMinutes = 30) { /* ... (Tu función completa aquí, sin cambios) ... */ }
    function sanitizeField(value, defaultText = 'No disponible') { /* ... (Tu función completa aquí, sin cambios) ... */ }
    function applyTheme(theme) { /* ... (Tu función completa aquí, sin cambios) ... */ }
    function geolocationSearch() { /* ... (Tu función completa aquí, sin cambios) ... */ }
    async function getAndShowNightPlan(event) { /* ... (Tu función completa aquí, sin cambios) ... */ }
    function showNotification(message, type = 'info') { /* ... (Tu función completa aquí, sin cambios) ... */ }
    function showSkeletonLoader() { /* ... (Tu función completa aquí, sin cambios) ... */ }
    function hideSkeletonLoader() { /* ... (Tu función completa aquí, sin cambios) ... */ }

    // =========================================================================
    // 5. GESTORES DE EVENTOS Y LISTENERS
    // =========================================================================
    function setupEventListeners() {
        // --- GESTOR DE CLICS PRINCIPAL (DELEGACIÓN DE EVENTOS) ---
        document.body.addEventListener('click', async (e) => {
            const sliderCard = e.target.closest('.slider-container .event-card');
            const geminiBtn = e.target.closest('.gemini-btn');
            const shareBtn = e.target.closest('.share-button');
            const modalOverlay = e.target.closest('.modal-overlay');
            const modalCloseBtn = e.target.closest('.modal-close-btn');

            // --- Clic en una tarjeta de slider ---
            if (sliderCard) {
                const eventId = sliderCard.dataset.eventId;
                if (eventId) {
                    try {
                        const eventData = await fetchWithCache(`/api/events/${eventId}`, `event-${eventId}`, 120);
                        eventsCache[eventId] = eventData; // Guardamos los datos completos en caché
                        renderEventDetailModal(eventData);
                    } catch (error) {
                        console.error('Error al cargar detalles del evento:', error);
                        showNotification('No se pudo cargar la información del evento.', 'error');
                    }
                }
                return;
            }

            // --- Clic en Planear Noche ---
            if (geminiBtn) {
                const eventId = geminiBtn.dataset.eventId;
                const eventData = eventsCache[eventId];
                if (eventData) {
                    getAndShowNightPlan(eventData);
                } else {
                    console.error("Datos del evento no encontrados en caché para Planear Noche.");
                    showNotification('Error: No se encontraron los datos del evento.', 'error');
                }
                return;
            }

            // --- Clic en Compartir ---
            if (shareBtn) {
                showNotification('Función de compartir próximamente.', 'info');
                return;
            }

            // --- Cierre de Modales ---
            if (modalCloseBtn || (modalOverlay && e.target === modalOverlay)) {
                if (modalOverlay) modalOverlay.classList.remove('visible');
            }
        });

        // --- Listeners de la cabecera y barra de navegación (no necesitan delegación) ---
        if (filterBar) {
            filterBar.addEventListener('click', (e) => {
                const filterChip = e.target.closest('.filter-chip');
                if (filterChip) {
                    e.preventDefault();
                    filterBar.querySelectorAll('.filter-chip').forEach(btn => btn.classList.remove('active'));
                    filterChip.classList.add('active');
                    const targetId = filterChip.getAttribute('href');
                    if (targetId === '#') {
                        geolocationSearch();
                        return;
                    }
                    const targetSection = document.querySelector(targetId);
                    if (targetSection) {
                        const headerOffset = document.querySelector('header.header-main').offsetHeight + 15;
                        const elementPosition = targetSection.getBoundingClientRect().top;
                        const offsetPosition = elementPosition + window.pageYOffset - headerOffset;
                        window.scrollTo({ top: offsetPosition, behavior: "smooth" });
                    }
                }
            });
        }

        if (cercaDeMiChip) {
            cercaDeMiChip.addEventListener('click', (e) => {
                e.preventDefault();
                geolocationSearch();
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
            navHowItWorksBtn.addEventListener('click', () => howItWorksModal?.classList.add('visible'));
        }
        if (navTermsBtn) {
            navTermsBtn.addEventListener('click', () => termsModal?.classList.add('visible'));
        }
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