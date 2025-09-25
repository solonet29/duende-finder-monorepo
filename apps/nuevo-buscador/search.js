/**
 * @file search.js
 * @description Gestiona la funcionalidad del modal de búsqueda, guiando a los usuarios hacia
 *              las funcionalidades de descubrimiento existentes mientras la búsqueda por texto se finaliza.
 * @author Gemini
 */

document.addEventListener('DOMContentLoaded', () => {
  // --- 1. Selección de Elementos del DOM ---
  const searchForm = document.getElementById('header-search-form');
  const searchModalOverlay = document.getElementById('search-modal-overlay');
  const searchResultsContainer = document.getElementById('search-results-container');
  const searchModalCloseBtn = document.getElementById('search-modal-close-btn');

  if (!searchForm || !searchModalOverlay || !searchResultsContainer || !searchModalCloseBtn) {
    console.error('Error: No se encontraron los elementos esenciales del DOM (header-search-form, search-modal-overlay, search-results-container, search-modal-close-btn).');
    return;
  }

  // --- 2. Lógica de Eventos ---

  /**
   * Muestra el modal con contenido dinámico que guía al usuario.
   */
  const showGuidingModal = () => {
    // Contenido HTML dinámico con las URLs e IDs correctos
    searchResultsContainer.innerHTML = `
      <div style="padding: 20px; text-align: center;">
        <h2>Una nueva y potente forma de buscar está en camino</h2>
        <p>Estamos desarrollando una búsqueda inteligente para que encuentres exactamente lo que quieres. Mientras la preparamos, explora el flamenco con estas opciones:</p>
        <div class="modal-actions" style="display: flex; flex-direction: column; gap: 10px; margin-top: 20px;">
          <a href="#cerca-section" class="modal-action-button">📍 Explorar cerca de ti</a>
          <a href="#semana-section" class="modal-action-button">📅 Agenda de la semana</a>
          <a href="#trip-planner-section" class="modal-action-button">✈️ Planificar un viaje flamenco</a>
          <a href="#" id="trigger-map-modal" class="modal-action-button">🗺️ Descubrir en el mapa</a>
        </div>
        <p class="modal-footer-note" style="margin-top: 20px; font-size: 0.9em; color: #666;">¡Gracias por tu paciencia!</p>
      </div>
    `;
    searchModalOverlay.style.display = 'flex';
  };

  /**
   * Oculta el modal.
   */
  const hideModal = () => {
    searchModalOverlay.style.display = 'none';
  };

  // --- 3. Asignación de Listeners ---

  searchForm.addEventListener('submit', (event) => {
    event.preventDefault();
    showGuidingModal();
  });

  searchModalOverlay.addEventListener('click', (event) => {
    // Si se hace clic en el overlay (fuera del contenido del modal), se cierra
    if (event.target === searchModalOverlay) {
      hideModal();
    }
  });

  searchModalCloseBtn.addEventListener('click', hideModal);

  searchResultsContainer.addEventListener('click', (event) => {
    const link = event.target.closest('a');
    if (!link) return;

    const href = link.getAttribute('href');

    // Comportamiento para el mapa
    if (link.id === 'trigger-map-modal') {
        event.preventDefault();
        hideModal();
        // Simulamos un clic en el botón que ya existe para mostrar el mapa
        document.getElementById('show-map-btn')?.click();
        return;
    }

    if (href && href.startsWith('#')) {
      event.preventDefault();
      const targetElement = document.querySelector(href);
      hideModal();

      if (targetElement) {
        // Si es el planificador de viajes, lo abrimos también
        if(href === '#trip-planner-section' && !targetElement.classList.contains('active')){
            targetElement.querySelector('#trip-planner-toggle')?.click();
        }

        setTimeout(() => {
          targetElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 100);
      }
    }
  });
});