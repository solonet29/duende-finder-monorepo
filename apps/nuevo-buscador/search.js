document.addEventListener('DOMContentLoaded', () => {
    // --- ELEMENTOS DEL DOM ---
    const headerSearchForm = document.getElementById('header-search-form');
    const headerSearchInput = document.getElementById('header-search-input');
    const searchModalOverlay = document.getElementById('search-modal-overlay');
    const modalSearchInput = document.getElementById('modal-search-input');
    const searchModalCloseBtn = document.getElementById('search-modal-close-btn');
    const searchResultsContainer = document.getElementById('search-results-container');

    const API_BASE_URL = 'https://api-v2.afland.es';

    // --- LÓGICA DE DEBOUNCE ---
    let debounceTimer;
    function debounce(func, delay) {
        return function(...args) {
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => {
                func.apply(this, args);
            }, delay);
        };
    }

    // --- MANEJO DEL MODAL ---
    function openModal() {
        searchModalOverlay.classList.add('visible');
        modalSearchInput.focus();
    }

    function closeModal() {
        searchModalOverlay.classList.remove('visible');
    }

    // --- LLAMADA A LA API Y RENDERIZADO ---
    async function performSearch(query) {
        if (!query || query.length < 2) {
            searchResultsContainer.innerHTML = '<p class="search-feedback">Escribe algo para buscar...</p>';
            return;
        }

        searchResultsContainer.innerHTML = '<p class="search-feedback">Buscando...</p>';

        try {
            const response = await fetch(`${API_BASE_URL}/api/search?q=${encodeURIComponent(query)}`);
            if (!response.ok) {
                throw new Error(`Error en la petición: ${response.statusText}`);
            }
            const results = await response.json();
            renderResults(results);
        } catch (error) {
            console.error('Error al buscar:', error);
            searchResultsContainer.innerHTML = '<p class="search-feedback">Error al conectar con el buscador. Inténtalo de nuevo.</p>';
        }
    }

    function renderResults(results) {
        if (results.length === 0) {
            searchResultsContainer.innerHTML = '<p class="search-feedback">No se encontraron resultados.</p>';
            return;
        }

        searchResultsContainer.innerHTML = results.map(event => {
            const { title, city, venue, imageUrl, slug } = event;
            const eventUrl = `/evento.html?slug=${slug}`; // Asumiendo una página de detalle de evento

            return `
                <a href="${eventUrl}" class="search-result-item">
                    <img src="${imageUrl || 'assets/placeholder.png'}" alt="${title}">
                    <div class="search-result-info">
                        <h4>${title}</h4>
                        <p>${city || ''}${venue ? `, ${venue}` : ''}</p>
                    </div>
                </a>
            `;
        }).join('');
    }

    const debouncedSearch = debounce(performSearch, 300);

    // --- EVENT LISTENERS ---

    // Abrir modal desde la cabecera
    headerSearchForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const query = headerSearchInput.value.trim();
        modalSearchInput.value = query;
        openModal();
        if (query) {
            performSearch(query);
        }
    });

    // Búsqueda dinámica en el modal
    modalSearchInput.addEventListener('input', () => {
        const query = modalSearchInput.value.trim();
        debouncedSearch(query);
    });

    // Cerrar modal
    searchModalCloseBtn.addEventListener('click', closeModal);
    searchModalOverlay.addEventListener('click', (e) => {
        if (e.target === searchModalOverlay) {
            closeModal();
        }
    });

    // Cerrar con tecla Escape
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && searchModalOverlay.classList.contains('visible')) {
            closeModal();
        }
    });
});
