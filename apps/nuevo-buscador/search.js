/**
 * @file search.js
 * @description Gestiona la funcionalidad de búsqueda de eventos.
 * @author Gemini
 */

document.addEventListener('DOMContentLoaded', () => {
    // --- 1. Selección de Elementos del DOM ---
    const headerSearchForm = document.getElementById('header-search-form');
    const headerSearchInput = document.getElementById('header-search-input');
    const searchModalOverlay = document.getElementById('search-modal-overlay');
    const searchResultsContainer = document.getElementById('search-results-container');
    const searchModalCloseBtn = document.getElementById('search-modal-close-btn');
    const modalSearchInput = document.getElementById('modal-search-input');

    // --- 2. Configuración ---
    const getApiBaseUrl = () => {
        const hostname = window.location.hostname;
        if (hostname === 'localhost' || hostname === '127.0.0.1') {
            return 'http://localhost:3000';
        }
        return 'https://api-v2.afland.es';
    };
    const API_BASE_URL = getApiBaseUrl();

    // --- 3. Funciones ---

    /**
     * Ejecuta la búsqueda y muestra los resultados en el modal.
     * @param {string} query - El término de búsqueda.
     */
    const performSearch = async (query) => {
        // Siempre mostrar el modal al iniciar una búsqueda
        searchModalOverlay.classList.add('visible');

        if (!query || query.trim().length < 2) {
            searchResultsContainer.innerHTML = '<div class="search-feedback">Escribe al menos 2 caracteres para buscar.</div>';
            return;
        }

        // Mostrar estado de carga
        searchResultsContainer.innerHTML = '<div class="search-feedback">Buscando...</div>';

        try {
            const response = await fetch(`${API_BASE_URL}/api/events?search=${encodeURIComponent(query)}`);
            if (!response.ok) {
                throw new Error('La búsqueda falló');
            }
            const data = await response.json();
            renderSearchResults(data.events || []);
        } catch (error) {
            console.error('Error en la búsqueda:', error);
            searchResultsContainer.innerHTML = '<div class="search-feedback">Ocurrió un error al buscar. Inténtalo de nuevo.</div>';
        }
    };

    /**
     * Renderiza los resultados de la búsqueda en el contenedor.
     * @param {Array} events - Array de eventos encontrados.
     */
    const renderSearchResults = (events) => {
        if (events.length === 0) {
            searchResultsContainer.innerHTML = '<div class="search-feedback">No se encontraron resultados. Por favor, refina tu búsqueda.</div>';
            return;
        }

        searchResultsContainer.innerHTML = ''; // Limpiar resultados anteriores
        events.forEach(event => {
            const eventElement = document.createElement('div');
            eventElement.className = 'search-result-item';
            eventElement.setAttribute('data-event-id', event._id);
            eventElement.setAttribute('data-event-slug', event.slug || (event.name || 'evento').toLowerCase().replace(/[^a-z0-9]+/g, '-'));

            eventElement.innerHTML = `
                <div class="search-result-info">
                    <h4>${event.name}</h4>
                    <p>${event.artist || ''} - ${new Date(event.date).toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
                    <p>${event.city || 'Ubicación desconocida'}</p>
                </div>
            `;
            searchResultsContainer.appendChild(eventElement);
        });
    };

    /**
     * Oculta el modal de búsqueda.
     */
    const hideModal = () => {
        searchModalOverlay.classList.remove('visible');
    };

    // --- 4. Asignación de Listeners ---

    // Al enviar el formulario de la cabecera
    headerSearchForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const query = headerSearchInput.value;
        modalSearchInput.value = query; // Sincronizar inputs
        performSearch(query);
    });

    // Búsqueda en tiempo real en el input del modal
    let searchTimeout;
    modalSearchInput.addEventListener('input', () => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
            const query = modalSearchInput.value;
            performSearch(query);
        }, 300); // Debounce de 300ms
    });

    // Cerrar el modal
    searchModalCloseBtn.addEventListener('click', hideModal);
    searchModalOverlay.addEventListener('click', (e) => {
        if (e.target === searchModalOverlay) {
            hideModal();
        }
    });

    // Clic en un resultado de búsqueda
    searchResultsContainer.addEventListener('click', (e) => {
        const resultItem = e.target.closest('.search-result-item');
        if (resultItem) {
            const eventId = resultItem.dataset.eventId;
            const eventSlug = resultItem.dataset.eventSlug;
            if (eventId) {
                // Asumimos que la navegación a la página del evento es la acción deseada
                window.location.href = `/eventos/${eventId}-${eventSlug}`;
            }
        }
    });
});
