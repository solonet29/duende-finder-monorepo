document.addEventListener('DOMContentLoaded', () => {
    const API_BASE_URL = 'https://duende-api.vercel.app';
    const resultsContainer = document.getElementById('resultsContainer');
    const skeletonContainer = document.getElementById('skeleton-container');
    const statusMessage = document.getElementById('statusMessage');
    const totalEventsSpan = document.getElementById('total-events');
    const searchForm = document.getElementById('search-form');
    const searchInput = document.getElementById('search-input');
    const mainContainer = document.querySelector('main.container');
    let isResultsView = false;
    
    function getSessionId() {
        let sessionId = sessionStorage.getItem('duendeSessionId');
        if (!sessionId) {
            sessionId = self.crypto.randomUUID();
            sessionStorage.setItem('duendeSessionId', sessionId);
        }
        return sessionId;
    }

    async function logInteraction(type, eventData) {
        // Analíticas desactivadas temporalmente
    }

    async function logSearch(params, resultsCount) {
        // Analíticas desactivadas temporalmente
    }

    const themeToggle = document.getElementById('theme-toggle');
    const toggleIcon = themeToggle.querySelector('i');
    const themeMeta = document.getElementById('theme-color-meta');
    const root = document.documentElement;
    
    function setTheme(theme) {
        root.setAttribute('data-theme', theme);
        localStorage.setItem('theme', theme);
        if (theme === 'dark') {
            toggleIcon.classList.remove('fa-moon');
            toggleIcon.classList.add('fa-sun');
            themeMeta.setAttribute('content', getComputedStyle(root).getPropertyValue('--color-fondo-dark').trim());
        } else {
            toggleIcon.classList.remove('fa-sun');
            toggleIcon.classList.add('fa-moon');
            themeMeta.setAttribute('content', getComputedStyle(root).getPropertyValue('--color-fondo-light').trim());
        }
    }
    
    const backToTopBtn = document.getElementById('back-to-top-btn');
    const modalOverlay = document.getElementById('gemini-modal-overlay');
    const modalContent = document.getElementById('modal-content');
    const modalCloseBtn = document.getElementById('modal-close-btn');
    const synth = window.speechSynthesis;
    function showModal() { modalOverlay.classList.add('visible'); }
    function hideModal() { 
        if (synth.speaking) {
            synth.cancel();
        }
        modalOverlay.classList.remove('visible'); 
    }
    
    function setupFilterToggle(toggleId, containerId) {
        const toggleButton = document.getElementById(toggleId);
        const container = document.getElementById(containerId);
        if (toggleButton && container) {
            toggleButton.addEventListener('click', () => {
                const isVisible = container.classList.toggle('visible');
                const icon = toggleButton.querySelector('i');
                icon.classList.toggle('fa-chevron-down', !isVisible);
                icon.classList.toggle('fa-chevron-up', isVisible);
            });
        }
    }
    
    async function getFlamencoPlan(event) {
        showModal();
        modalContent.innerHTML = `<div class="loader-container"><div class="loader"></div><p>Un momento, el duende está afinando la guitarra...</p></div>`;
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 20000);
            const response = await fetch(`${API_BASE_URL}/gemini`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ event: event }),
                signal: controller.signal
            });
            clearTimeout(timeoutId);
            if (!response.ok) {
                throw new Error(`Error del servidor: ${response.statusText}`);
            }
            const result = await response.json();
            if (result && result.text) {
                let text = result.text;
                text = text.replace(/### (.*)/g, '<h3>$1</h3>').replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
                text = text.replace(/\[(.*?)\]/g, (match, placeName) => {
                    const query = encodeURIComponent(`${placeName}, ${event.city}`);
                    return `<a href="https://www.google.com/maps/search/?api=1&query=${query}" target="_blank" rel="noopener noreferrer">${placeName}</a>`;
                });
                text = text.replace(/\n/g, '<br>');
                const calendarLinks = generateCalendarLinks(event);
                modalContent.innerHTML = `
                    <div class="modal-header"><h2>✨ Tu Noche Flamenca ✨</h2></div>
                    <div id="plan-text">${text}</div>
                    <div class="modal-footer" style="border-top: 1px solid var(--color-borde-light); margin-top: 1.5rem; padding-top: 1.5rem;">
                        <h3 style="margin:0; margin-bottom: 1rem; color: var(--color-texto-principal-light);">Añadir el evento principal al calendario</h3>
                        <div style="display:flex; flex-direction:column; align-items:center; gap:1rem;">
                            <a href="${calendarLinks.google}" target="_blank" rel="noopener noreferrer" class="calendar-link-btn"><i class="fab fa-google" style="color:#4285F4;"></i> Google Calendar</a>
                            <a href="${calendarLinks.ical}" download="${event.name}.ics" class="calendar-link-btn"><i class="fab fa-apple" style="color:#000;"></i> Apple / iCal</a>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <div class="modal-footer-buttons">
                            <button id="listen-plan-btn" class="listen-plan-btn"><i class="fas fa-volume-up"></i> Escuchar Plan</button>
                            <button id="copy-plan-btn" class="copy-plan-btn">Copiar Plan</button>
                        </div>
                        <p class="ai-disclaimer">Contenido generado por IA. La información puede no ser precisa.</p>
                    </div>`;
                document.getElementById('copy-plan-btn').addEventListener('click', (e) => {
                    const planText = document.getElementById('plan-text').innerText;
                    const copyButton = e.currentTarget;
                    navigator.clipboard.writeText(planText).then(() => {
                        copyButton.textContent = '¡Copiado!';
                        setTimeout(() => { copyButton.textContent = 'Copiar Plan'; }, 2000);
                    }).catch(err => { console.error('Error al copiar el texto: ', err); });
                });
                const listenButton = document.getElementById('listen-plan-btn');
                const listenIcon = listenButton.querySelector('i');
                const utterance = new SpeechSynthesisUtterance();
                utterance.lang = 'es-ES';
                utterance.onstart = () => { listenIcon.classList.remove('fa-volume-up'); listenIcon.classList.add('fa-stop'); listenButton.childNodes[1].textContent = ' Detener'; };
                utterance.onend = () => { listenIcon.classList.remove('fa-stop'); listenIcon.classList.add('fa-volume-up'); listenButton.childNodes[1].textContent = ' Escuchar Plan'; };
                listenButton.addEventListener('click', () => {
                    if (synth.speaking) {
                        synth.cancel();
                    } else {
                        utterance.text = document.getElementById('plan-text').innerText;
                        synth.speak(utterance);
                    }
                });
            } else { throw new Error("La IA no devolvió una respuesta válida."); }
        } catch (error) {
            console.error("Error en getFlamencoPlan:", error);
            if (error.name === 'AbortError') { modalContent.innerHTML = `<h3>Error</h3><p>La petición ha tardado demasiado en responder. Por favor, inténtalo de nuevo.</p>`; }
            else { modalContent.innerHTML = `<h3>Error</h3><p>No se pudo generar el plan.</p>`; }
        }
    }
    
    function showSkeletonLoader() {
        skeletonContainer.innerHTML = '';
        resultsContainer.style.display = 'none';
        skeletonContainer.style.display = 'grid';
        statusMessage.textContent = '';
        for (let i = 0; i < 6; i++) {
            const skeletonCard = document.createElement('div');
            skeletonCard.className = 'skeleton-card';
            skeletonCard.innerHTML = `<div class="skeleton title"></div><div class="skeleton text text-short"></div><div class="skeleton text text-long"></div><div class="skeleton text"></div>`;
            skeletonContainer.appendChild(skeletonCard);
        }
    }
    
    function hideSkeletonLoader() {
        skeletonContainer.style.display = 'none';
        resultsContainer.style.display = 'grid';
    }
    
    async function performSearch(params, isUserSearch = false) {
        showSkeletonLoader();
        if (isUserSearch) {
            mainContainer.classList.add('results-active');
            isResultsView = true;
            setTimeout(() => { statusMessage.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 100);
        }
        const queryString = new URLSearchParams(params).toString();
        try {
            const response = await fetch(`${API_BASE_URL}/events?${queryString}`);
            if (!response.ok) throw new Error(`Error de red: ${response.statusText}`);
            const events = await response.json();
            
            //logSearch(params, events.length);
            
            displayEvents(events);
        } catch (error) {
            console.error('Error al realizar la búsqueda:', error);
            statusMessage.textContent = 'Hubo un error al realizar la búsqueda. Por favor, inténtalo de nuevo.';
            hideSkeletonLoader();
        }
    }
    
    function displayEvents(events) {
        hideSkeletonLoader();
        statusMessage.textContent = '';
        if (events.length === 0) {
            statusMessage.textContent = 'No se encontraron eventos que coincidan con tu búsqueda.';
            resultsContainer.innerHTML = '';
            return;
        }
        resultsContainer.innerHTML = '';
        const fragment = document.createDocumentFragment();
        events.forEach(event => {
            fragment.appendChild(createEventCard(event));
        });
        resultsContainer.appendChild(fragment);
    }
    
    function createEventCard(event) {
        const eventCard = document.createElement('article');
        eventCard.className = 'evento-card';
        
        const eventDate = new Date(event.date).toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' });
        const fullLocation = [event.venue, event.city, event.country].filter(Boolean).join(', ');
        const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fullLocation)}`;

        eventCard.innerHTML = `
            <div class="card-header"><h3>${event.name || 'Evento sin título'}</h3></div>
            <div class="artista"><i class="fas fa-user"></i> <span>${event.artist || 'Artista por confirmar'}</span></div>
            <div class="descripcion-container">
                <p class="descripcion">${event.description || ''}</p>
                ${event.verified ? `<div class="verificado-badge"><i class="fas fa-check"></i> Verificado</div>` : ''}
            </div>
            <div class="evento-detalle"><i class="fas fa-calendar-alt"></i><span><strong>Fecha:</strong> ${eventDate}</span></div>
            <div class="evento-detalle"><i class="fas fa-clock"></i><span><strong>Hora:</strong> ${event.time || 'N/A'}</span></div>
            <div class="evento-detalle"><a href="${mapsUrl}" target="_blank" rel="noopener noreferrer"><i class="fas fa-map-marker-alt"></i><span><strong>Lugar:</strong> ${fullLocation}</span></a></div>
            <div class="card-actions">
                ${event.sourceURL ? `<a href="${event.sourceURL}" target="_blank" rel="noopener noreferrer" class="source-link-btn"><i class="fas fa-external-link-alt"></i> Ver Fuente</a>` : ''}
                <div class="card-actions-primary">
                    <button class="gemini-btn">✨ Planear Noche</button>
                    <button class="calendar-btn"><i class="fas fa-calendar-plus"></i> Añadir</button>
                </div>
            </div>
        `;
        
        eventCard.querySelector('.gemini-btn').addEventListener('click', () => {
            //logInteraction('plan_night_click', event);
            getFlamencoPlan(event);
        });
        eventCard.querySelector('.calendar-btn').addEventListener('click', () => {
            //logInteraction('add_to_calendar_click', event);
            showCalendarLinks(event);
        });
        
        return eventCard;
    }
    
    async function loadTotalEventsCount() {
        try {
            const response = await fetch(`${API_BASE_URL}/events/count`);
            if (!response.ok) return;
            const data = await response.json();
            if (data.total !== undefined) {
                totalEventsSpan.textContent = data.total;
            }
        } catch (error) {
            console.warn('No se pudo cargar el contador total de eventos.');
        }
    }
    
    const tripPlannerBtn = document.getElementById('trip-planner-btn');
    const tripModalOverlay = document.getElementById('trip-planner-modal-overlay');
    const tripModalCloseBtn = document.getElementById('trip-modal-close-btn');
    const tripPlannerForm = document.getElementById('trip-planner-form');
    tripPlannerBtn.addEventListener('click', () => tripModalOverlay.classList.add('visible'));
    tripModalCloseBtn.addEventListener('click', () => tripModalOverlay.classList.remove('visible'));
    tripModalOverlay.addEventListener('click', (e) => {
        if (e.target === tripModalOverlay) tripModalOverlay.classList.remove('visible');
    });
    
    tripPlannerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const destination = document.getElementById('trip-destination').value;
        const startDate = document.getElementById('trip-start-date').value;
        const endDate = document.getElementById('trip-end-date').value;
        const tripPlannerResult = document.getElementById('trip-planner-result');
        tripPlannerResult.innerHTML = `<div class="loader-container"><div class="loader"></div><p>Buscando eventos y creando tu ruta flamenca...</p></div>`;
        try {
            const response = await fetch(`${API_BASE_URL}/trip-planner`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ destination, startDate, endDate })
            });
            if (!response.ok) {
                throw new Error('No se pudo generar el plan de viaje.');
            }
            const result = await response.json();
            if (result && result.text) {
                let text = result.text;
                text = text.replace(/### (.*)/g, '<h3>$1</h3>').replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
                text = text.replace(/\[(.*?)\]/g, (match, placeName) => {
                    const query = encodeURIComponent(`${placeName}, ${destination}`);
                    return `<a href="https://www.google.com/maps/search/?api=1&query=${query}" target="_blank" rel="noopener noreferrer">${placeName}</a>`;
                });
                text = text.replace(/\n/g, '<br>');
                tripPlannerResult.innerHTML = text;
            } else {
                throw new Error("La IA no devolvió un plan válido.");
            }
        } catch (error) {
            console.error("Error en el planificador de viajes:", error);
            tripPlannerResult.innerHTML = `<p style="color: red;">Ha ocurrido un error al generar tu plan: ${error.message}</p>`;
        }
    });
    
    function generateCalendarLinks(event) {
        const startTime = new Date(`${event.date}T${event.time || '00:00:00'}`);
        const endTime = new Date(startTime.getTime() + (2 * 60 * 60 * 1000));
        const formatTime = (date) => date.toISOString().replace(/-|:|\.\d+/g, '');
        const startTimeFormatted = formatTime(startTime);
        const endTimeFormatted = formatTime(endTime);
        const eventDetails = {
            title: encodeURIComponent(event.name),
            details: encodeURIComponent(`Ver a ${event.artist}.\n\n${event.description || ''}`),
            location: encodeURIComponent(event.venue),
            startTime: startTimeFormatted,
            endTime: endTimeFormatted
        };
        const googleLink = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${eventDetails.title}&dates=${eventDetails.startTime}/${eventDetails.endTime}&details=${eventDetails.details}&location=${eventDetails.location}`;
        const icsContent = `BEGIN:VCALENDAR\nVERSION:2.0\nBEGIN:VEVENT\nDTSTART:${startTimeFormatted}\nDTEND:${endTimeFormatted}\nSUMMARY:${event.name}\nDESCRIPTION:Ver a ${event.artist}.\\n\\n${event.description || ''}\nLOCATION:${event.venue}\nEND:VEVENT\nEND:VCALENDAR`;
        const icsLink = `data:text/calendar;charset=utf-8,${encodeURIComponent(icsContent)}`;
        return { google: googleLink, ical: icsLink };
    }
    
    function showCalendarLinks(event) {
        const links = generateCalendarLinks(event);
        modalContent.innerHTML = `
            <div class="modal-header">
                <h2>Añadir "${event.name}" a tu calendario</h2>
            </div>
            <div style="display:flex; flex-direction:column; align-items:center; gap:1rem; margin-top:1.5rem;">
                <a href="${links.google}" target="_blank" rel="noopener noreferrer" class="calendar-link-btn">
                    <i class="fab fa-google" style="color:#4285F4;"></i> Google Calendar
                </a>
                <a href="${links.ical}" download="${event.name}.ics" class="calendar-link-btn">
                    <i class="fab fa-apple" style="color:#000;"></i> Apple / iCal
                </a>
            </div>
        `;
        showModal();
    }
    
    function handleQuickFilter(event) {
        event.preventDefault();
        const url = new URL(event.currentTarget.href);
        window.location.href = url.toString(); // Forzamos recarga con el nuevo filtro
    }
    
    document.querySelectorAll('.quick-filter-btn').forEach(btn => {
        btn.addEventListener('click', handleQuickFilter);
    });
    
    function initialize() {
        loadTotalEventsCount();
        const urlParams = new URLSearchParams(window.location.search);
        const params = Object.fromEntries(urlParams.entries());
        if (Object.keys(params).length === 0) {
            params.timeframe = 'week';
        }
        if (params.search) {
            searchInput.value = params.search;
        }
        performSearch(params, Object.keys(params).length > 0 && !!(params.search || params.city || params.country));
    }
    
    themeToggle.addEventListener('click', () => {
        const newTheme = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
        setTheme(newTheme);
    });
    const savedTheme = localStorage.getItem('theme');
    const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    setTheme(savedTheme || (prefersDark ? 'dark' : 'dark'));

    window.addEventListener('scroll', () => {
        backToTopBtn.classList.toggle('visible', window.scrollY > 300);
        if (isResultsView && window.scrollY < 150) {
            mainContainer.classList.remove('results-active');
            isResultsView = false;
        }
    });
    
    modalCloseBtn.addEventListener('click', hideModal);
    modalOverlay.addEventListener('click', (e) => {
        if (e.target === modalOverlay) hideModal();
    });

    setupFilterToggle('province-filters-toggle', 'province-filters-container');
    setupFilterToggle('country-filters-toggle', 'country-filters-container');
    
    searchForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const searchTerm = searchInput.value.trim();
        if (searchTerm) {
            window.location.href = `${window.location.pathname}?search=${encodeURIComponent(searchTerm)}`;
        } else {
            window.location.href = window.location.pathname;
        }
    });

    initialize();
});