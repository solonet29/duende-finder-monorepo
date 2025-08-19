document.addEventListener('DOMContentLoaded', () => {
    // ... (constants)

    // --- Helper Functions ---
    function sanitizeField(value, defaultText = 'No disponible') {
        if (value && typeof value === 'string' && value.trim() !== '' && value.trim().toLowerCase() !== 'n/a') {
            return value.replace(/\\[object Object\\]/g, '').trim();
        }
        return defaultText;
    }

    function urlBase64ToUint8Array(base64String) {
        // ... (function content)
    }

    // ... (DOM selectors)

    // --- EVENT LISTENERS & HANDLERS ---
    // ... (setupEventListeners and other handlers)

    // --- PUSH NOTIFICATIONS ---
    // ... (notification functions)

    // --- CORE FUNCTIONS ---
    // ... (performSearch, displayEvents)

    function createEventCard(event) {
        const eventCard = document.createElement('article');
        eventCard.className = 'evento-card';

        const eventName = sanitizeField(event.name, 'Evento sin título');
        const artistName = sanitizeField(event.artist, 'Artista por confirmar');
        const description = sanitizeField(event.description, 'Sin descripción disponible.');
        const eventTime = sanitizeField(event.time, 'No disponible');
        const eventVenue = sanitizeField(event.venue, '');
        const eventCity = sanitizeField(event.city, '');
        const eventCountry = sanitizeField(event.country, '');

        const eventDate = event.date ? new Date(event.date).toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' }) : 'Fecha no disponible';
        
        const fullLocation = [eventVenue, eventCity, eventCountry].filter(Boolean).join(', ') || 'Ubicación no disponible';
        const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fullLocation)}`;

        eventCard.innerHTML = `
            <div class="card-header">
                <div class="header-evento">
                    <h3 class="titulo-truncado">${eventName}</h3>
                </div>
            </div>
            <div class="artista"><i class="fas fa-user"></i> <span>${artistName}</span></div>
            <div class="descripcion-container">
                <p class="descripcion-corta">${description}</p>
            </div>
            <div class="card-detalles">
                <div class="evento-detalle"><i class="fas fa-calendar-alt"></i><span><strong>Fecha:</strong> ${eventDate}</span></div>
                <div class="evento-detalle"><i class="fas fa-clock"></i><span><strong>Hora:</strong> ${eventTime}</span></div>
                <div class="evento-detalle"><a href="${mapsUrl}" target="_blank" rel="noopener noreferrer"><i class="fas fa-map-marker-alt"></i><span><strong>Lugar:</strong> ${fullLocation}</span></a></div>
            </div>
            <div class="card-actions">
                ${event.sourceURL ? `<a href="${event.sourceURL}" target="_blank" rel="noopener noreferrer" class="source-link-btn"><i class="fas fa-external-link-alt"></i> Ver Fuente</a>` : ''}
                <div class="card-actions-primary">
                    <button class="gemini-btn" data-event-id="${event._id}">✨ Planear Noche</button>
                    <button class="share-button" data-event-id="${event._id}">
                        <i class="fas fa-solid fa-share-nodes"></i> Compartir
                    </button>
                </div>
            </div>
            ${event.verified ? `<div class="verificado-badge"><i class="fas fa-check"></i> Verificado</div>` : ''}
        `;
        return eventCard;
    }

    // ... (other functions: getFlamencoPlan, getTripPlan, etc.)

    // --- INITIALIZATION ---
    function initialize() {
        // ... (initialize function content)
    }

    initialize();
});