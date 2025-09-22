import { CountUp } from './libs/countup.js';
import { initPushNotifications } from './notifications.js';

document.addEventListener('DOMContentLoaded', () => {
    // =========================================================================
    // 1. CONFIGURACIÓN Y SELECTORES
    // =========================================================================
    const APP_CONFIG = {
        USAR_PAGINAS_DE_EVENTOS: true
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

    const modalContent = {
        howItWorks: `<p>...</p>`,
        terms: `<p>...</p>`
    };

    // =========================================================================
    // 2. DEFINICIÓN DE FUNCIONES
    // =========================================================================

    async function displayEventCount() {
        const counterElement = document.getElementById('event-counter');
        if (!counterElement) return;
        try {
            const response = await fetch(`${API_BASE_URL}/api/events/count`);
            if (!response.ok) throw new Error('Error en la respuesta de la API');
            const data = await response.json();
            const totalEvents = data.total;
            const options = {
                prefix: '+',
                suffix: ' eventos de flamenco verificados',
                duration: 3,
                separator: '.',
                useEasing: true
            };
            const countUp = new CountUp(counterElement, totalEvents, options);
            if (!countUp.error) {
                countUp.start(() => {
                    setTimeout(() => {
                        counterElement.classList.add('fading-out');
                    }, 10000);
                });
            } else {
                counterElement.textContent = `+${totalEvents.toLocaleString('es-ES')} eventos de flamenco verificados`;
                setTimeout(() => {
                    counterElement.classList.add('fading-out');
                }, 10000);
            }
            counterElement.classList.add('loaded');
        } catch (error) {
            console.error('Error al cargar el contador de eventos:', error);
            counterElement.style.display = 'none';
        }
    }

    function openMapModal() {
        if (!mapModalOverlay) return;
        const visibleEvents = getAllVisibleEvents();
        if (visibleEvents.length === 0) {
            alert('No hay eventos para mostrar en el mapa.');
            return;
        }
        mapModalOverlay.classList.add('visible');
        initializeModalMap(visibleEvents);
    }

    function closeMapModal() {
        if (mapModalOverlay) {
            mapModalOverlay.classList.remove('visible');
        }
    }

    function getAllVisibleEvents() {
        const eventCards = document.querySelectorAll('.slider-container .event-card');
        const visibleEventIds = new Set();
        eventCards.forEach(card => {
            if (card.offsetParent !== null) {
                const eventId = card.dataset.eventId;
                if (eventId) visibleEventIds.add(eventId);
            }
        });
        return Array.from(visibleEventIds).map(id => eventsCache[id]).filter(Boolean);
    }

    function initializeModalMap(events) {
        const mapContainer = document.getElementById('modal-map-container');
        if (!mapContainer) return;
        if (!modalMapInstance) {
            modalMapInstance = L.map(mapContainer).setView([40.416775, -3.703790], 5);
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            }).addTo(modalMapInstance);
        }
        modalMapInstance.eachLayer(layer => { if (layer instanceof L.Marker) modalMapInstance.removeLayer(layer); });
        const markers = [];
        events.forEach(event => {
            if (event.location?.coordinates?.length === 2) {
                const [lon, lat] = event.location.coordinates;
                const marker = L.marker([lat, lon]).addTo(modalMapInstance);
                marker.bindPopup(`<b>${event.name}</b><br>${event.artist || ''}`);
                marker.on('click', () => {
                    const fallbackSlug = (event.name || 'evento').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
                    const finalSlug = event.slug || fallbackSlug;
                    window.location.href = `/eventos/${event._id}-${finalSlug}`;
                });
                markers.push(marker);
            }
        });
        if (markers.length > 0) {
            const group = new L.featureGroup(markers);
            modalMapInstance.fitBounds(group.getBounds().pad(0.1));
        }
        setTimeout(() => modalMapInstance.invalidateSize(), 100);
    }

    // ... (el resto de las funciones del script original)
    // (initializeDashboard, renderSlider, renderEventPage, etc.)

    function setupEventListeners() {
        // ... (listeners originales)
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

    async function init() {
        // ... (código de inicialización original)
        const isEventPage = await handleInitialPageLoadRouting();
        if (!isEventPage) {
            displayEventCount();
            initializeDashboard();
        }
    }

    init();
});