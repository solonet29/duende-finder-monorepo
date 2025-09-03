document.addEventListener('DOMContentLoaded', () => {
    // =========================================================================
    // 1. CONFIGURACIÓN Y SELECTORES
    // =========================================================================
    const API_BASE_URL = window.location.hostname.includes('localhost') ? 'http://localhost:3000' : 'https://duende-api.vercel.app';
    let eventsCache = {};
    const modalContent = {
        howItWorks: `
        <p><strong>Duende Finder es tu asistente inteligente para descubrir el flamenco a tu alrededor.</strong></p>
        <ol>
            <li><strong>Encuentra Eventos Cerca de Ti:</strong> Pulsa el botón <strong>"Cerca de mí"</strong> para que el buscador te muestre al instante los tablaos y eventos más próximos a tu ubicación actual.</li>
            <li><strong>Explora el Resto:</strong> Navega por la lista completa de eventos. Usamos IA para encontrar y organizar actuaciones de múltiples fuentes públicas.</li>
            <li><strong>Planifica tu Noche:</strong> Haz clic en "Planear Noche" en cualquier evento. Gemini, nuestro copiloto de IA, te creará una guía con recomendaciones de restaurantes, transporte y consejos para disfrutar al máximo.</li>
        </ol>
        <p>¡Todo está pensado para que solo te preocupes de disfrutar del duende!</p>
    `, // <-- ¡LA COMA ES CRUCIAL AQUÍ!

        terms: `
        <ul>
            <li><strong>Propósito:</strong> Duende Finder es una herramienta experimental con fines informativos y de entretenimiento, diseñada para facilitar el descubrimiento de eventos de flamenco.</li>
            <li><strong>Fuentes de Datos:</strong> La información de los eventos se recopila automáticamente de fuentes públicas en internet. No nos hacemos responsables de posibles inexactitudes, cancelaciones o cambios en la programación. Siempre verifica la información con la fuente original.</li>
            <li><strong>Contenido Generado por IA:</strong> Funcionalidades como "Planear Noche" y las descripciones de los eventos son generadas por la inteligencia artificial de Google (Gemini). Este contenido puede contener imprecisiones y debe ser considerado como una sugerencia, no como un hecho verificado.</li>
            <li><strong>Uso:</strong> El uso de este servicio implica la aceptación de estos términos.</li>
        </ul>
    `
    };
    const mainContainer = document.querySelector('.container');
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
    function applyTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('duende-theme', theme);
        if (navThemeToggle) {
            const icon = navThemeToggle.querySelector('ion-icon');
            if (icon) icon.setAttribute('name', theme === 'dark' ? 'moon-outline' : 'sunny-outline');
        }
    }

    // =========================================================================
    // 2. LÓGICA PRINCIPAL DE ORQUESTACIÓN Y CARGA
    // =========================================================================
    /**
     * @description Función principal que arranca toda la aplicación.
     */
    async function init() {
        const savedTheme = localStorage.getItem('duende-theme') || 'dark';
        applyTheme(savedTheme);
        setupEventListeners();
        populateInfoModals(); // <-- ¡AÑADE ESTA LÍNEA AQUÍ!

        const modalPromise = handleWelcomeModal();
        const dashboardPromise = initializeDashboard();

        const modalInfo = await modalPromise;
        await modalInfo.timer;

        await dashboardPromise;

        const overlay = document.getElementById('welcome-modal-overlay');
        if (overlay && modalInfo.active) {
            overlay.classList.remove('visible');
        }
    }

    /**
     * @description Gestiona el modal de bienvenida. Es visible por defecto.
     */
    async function handleWelcomeModal() {
        const overlay = document.getElementById('welcome-modal-overlay');
        if (!overlay) return { active: false, timer: Promise.resolve() };

        try {
            const response = await fetch(`${API_BASE_URL}/api/config`);
            const config = await response.json();

            if (config && config.welcomeModal_enabled) {
                const sponsorLink = document.getElementById('sponsor-link');
                const sponsorLogo = document.getElementById('sponsor-logo');
                if (sponsorLink && sponsorLogo) {
                    sponsorLink.href = config.sponsor_website_url || '#';
                    sponsorLogo.src = config.sponsor_logo_url;
                    sponsorLogo.alt = `Logo de ${config.sponsor_name} `;
                }
                const bannerContainer = document.getElementById('welcome-banner-container');
                if (config.banner_enabled && bannerContainer) {
                    document.getElementById('banner-link').href = config.banner_linkUrl || '#';
                    document.getElementById('banner-image').src = config.banner_imageUrl;
                    bannerContainer.classList.remove('hidden');
                }
                const timerPromise = new Promise(resolve => setTimeout(resolve, config.welcomeModal_minDuration_ms || 2500));
                return { active: true, timer: timerPromise };
            } else {
                overlay.classList.remove('visible');
                return { active: false, timer: Promise.resolve() };
            }
        } catch (error) {
            console.error("Error al cargar config del modal, se ocultará:", error);
            overlay.classList.remove('visible');
            return { active: false, timer: Promise.resolve() };
        }
    }

    /**
     * @description Carga los datos de eventos para los sliders.
     */
    async function initializeDashboard() {
        try {
            const [featuredData, weekData, todayData, allEventsData] = await Promise.all([
                fetch(`${API_BASE_URL} /api/events ? featured = true & limit=10`).then(res => res.json()),
                fetch(`${API_BASE_URL} /api/events ? timeframe = week & limit=10`).then(res => res.json()),
                fetch(`${API_BASE_URL} /api/events ? timeframe = today & limit=10`).then(res => res.json()),
                fetch(`${API_BASE_URL} /api/events ? sort = date`).then(res => res.json())
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
            if (mainContainer) mainContainer.innerHTML = '<h2>Oops! No se pudo cargar el contenido.</h2>';
        }
    }

    // =========================================================================
    // 3. FUNCIONES DE RENDERIZADO
    // =========================================================================
    function renderSlider(container, events) {
        if (!container) return;
        const section = container.closest('.sliders-section');
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
            const titleText = `${monthName.charAt(0).toUpperCase() + monthName.slice(1)} ${year} `;
            const section = document.createElement('section');
            section.className = 'sliders-section';
            section.id = `month - ${monthKey} -section`;
            const title = document.createElement('h2');
            title.textContent = titleText;
            const sliderContainer = document.createElement('div');
            sliderContainer.className = 'slider-container';
            events.forEach(event => sliderContainer.appendChild(createSliderCard(event)));
            section.appendChild(title);
            section.appendChild(sliderContainer);
            monthlySlidersContainer.appendChild(section);
        });

        function createSliderCard(event) {
            const eventCard = document.createElement('div');
            eventCard.className = 'event-card';
            eventCard.setAttribute('data-event-id', event._id);
            const artistName = sanitizeField(event.artist, 'Artista por confirmar');
            eventCard.setAttribute('data-artist-name', artistName);
            const placeholderUrl = './assets/flamenco-placeholder.png';
            const eventImageUrl = event.imageUrl || placeholderUrl;
            // You can add more DOM elements to eventCard here if needed
            return eventCard;
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
            if (venue && city) displayLocation = `${venue}, ${city} `;
            else if (venue || city) displayLocation = venue || city;
            const mapQuery = [eventName, venue, city, sanitizeField(event.country || (event.location && event.location.country), '')].filter(Boolean).join(', ');
            const mapsUrl = `https://maps.google.com/?q=${encodeURIComponent(mapQuery)}`;
            const blogUrl = event.blogPostUrl || 'https://afland.es/';
            const blogText = event.blogPostUrl ? 'Leer en el Blog' : 'Explorar Blog';
            const blogIcon = event.blogPostUrl ? 'book-outline' : 'newspaper-outline';
            const blogButtonClass = event.blogPostUrl ? 'blog-link-btn' : 'btn-blog-explorar';
            const eventImageUrl = event.imageUrl || './assets/flamenco-placeholder.png';
            eventDetailModalOverlay.innerHTML = `<div class="modal"><button class="modal-close-btn">×</button><div class="modal-content modal-event-details">${event.imageUrl ? `<div class="evento-card-img-container"><img src="${eventImageUrl}" alt="Imagen de ${eventName}" class="evento-card-img" onerror="this.parentElement.style.display='none'"></div>` : ''}<div class="card-header"><h2 class="titulo-truncado" title="${eventName}">${eventName}</h2></div><div class="artista"><ion-icon name="person-outline"></ion-icon> <span>${artistName}</span></div><p class="descripcion-corta">${description}</p><div class="card-detalles"><div class="evento-detalle"><ion-icon name="calendar-outline"></ion-icon><span>${eventDate}</span></div><div class="evento-detalle"><ion-icon name="time-outline"></ion-icon><span>${eventTime}</span></div><div class="evento-detalle"><a href="${mapsUrl}" target="_blank" rel="noopener noreferrer"><ion-icon name="location-outline"></ion-icon><span>${displayLocation}</span></a></div></div><div class="card-actions"><div class="card-actions-primary"><button class="gemini-btn" data-event-id="${event._id}"><ion-icon name="sparkles-outline"></ion-icon> Planear Noche</button><a href="${blogUrl}" target="_blank" rel="noopener noreferrer" class="${blogButtonClass}"><ion-icon name="${blogIcon}"></ion-icon> ${blogText}</a></div></div></div></div>`;
            eventDetailModalOverlay.classList.add('visible');
        }

        // =========================================================================
        // 4. FUNCIONES AUXILIARES
        // =========================================================================
        // --- AÑADE ESTA FUNCIÓN AQUÍ ---
        /**
         * @description Inyecta el contenido HTML en los modales de información.
         */
        function populateInfoModals() {
            const howItWorksContainer = document.getElementById('how-it-works-text-container');
            const termsContainer = document.getElementById('terms-text-container');

            if (howItWorksContainer) {
                howItWorksContainer.innerHTML = modalContent.howItWorks;
            }
            if (termsContainer) {
                termsContainer.innerHTML = modalContent.terms;
            }
        }
        function groupEventsByMonth(events) {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            return events.reduce((acc, event) => {
                if (!event.date) return acc;
                const eventDate = new Date(event.date);
                const isToday = eventDate.toISOString().slice(0, 10) === today.toISOString().slice(0, 10);
                const diffDays = (eventDate - today) / (1000 * 60 * 60 * 24);
                if (!isToday && diffDays >= 0 && diffDays < 7) { return acc; }
                const monthKey = event.date.substring(0, 7);
                if (!acc[monthKey]) { acc[monthKey] = []; }
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
                    try {
                        const response = await fetch(`${API_BASE_URL}/api/events?lat=${latitude}&lon=${longitude}&radius=60&limit=10`);
                        if (!response.ok) throw new Error('Error en la petición');
                        const nearbyData = await response.json();
                        renderSlider(nearbySlider, nearbyData?.events);
                    } catch (error) { renderGeolocationDenied(); }
                },
                error => {
                    console.error("Error de geolocalización:", error);
                    renderGeolocationDenied();
                }
            );
        }

        async function getAndShowNightPlan(event) {
            if (!geminiModalOverlay) return;
            const modalContent = geminiModalOverlay.querySelector('.modal-content');
            geminiModalOverlay.classList.add('visible');
            if (modalContent) modalContent.innerHTML = `<div class="loading-container"><div class="loader"></div><p>Planeando tu noche...</p></div>`;
            try {
                const response = await fetch(`${API_BASE_URL}/api/generate-night-plan?eventId=${event._id}`);
                if (!response.ok) throw new Error('La respuesta del servidor no fue OK');
                const data = await response.json();
                const footerHtml = `<footer class="ai-footer"><p class="ai-disclaimer"><em>Contenido generado por IA. La información puede no ser exacta.</em></p><a href="https://afland.es/contact" target="_blank" rel="noopener noreferrer" class="business-cta">¿Quieres ver tu negocio aquí? Contacta</a></footer>`;
                const aiHtmlContent = window.marked ? marked.parse(data.content) : `<pre>${data.content}</pre>`;
                if (modalContent) modalContent.innerHTML = aiHtmlContent + footerHtml;
            } catch (error) {
                console.error("Error al generar Plan Noche:", error);
                if (modalContent) modalContent.innerHTML = `<h3>Error</h3><p>No se pudo generar el plan en este momento.</p>`;
            }
        }

        function showNotification(message, type = 'info') { /* ... Tu código original ... */ }
        function showSkeletonLoader() { /* ... Tu código original ... */ }
        function hideSkeletonLoader() { /* ... Tu código original ... */ }

        // =========================================================================
        // 5. GESTIÓN DE EVENT LISTENERS (VERSIÓN CORREGIDA)
        // =========================================================================
        function setupEventListeners() {
            const header = document.querySelector('.header-main');
            if (header) {
                window.addEventListener('scroll', () => {
                    header.classList.toggle('scrolled', window.scrollY > 10);
                });
            } // Cierre del if (header)

            document.body.addEventListener('click', async (e) => {
                // Seleccionamos todos los posibles objetivos del clic
                const sliderCard = e.target.closest('.slider-container .event-card');
                const geminiBtn = e.target.closest('.gemini-btn');
                const modalOverlay = e.target.closest('.modal-overlay:not(#welcome-modal-overlay)');
                const modalCloseBtn = e.target.closest('.modal-close-btn');
                const requestLocationBtn = e.target.closest('#request-location-btn');

                // Lógica condicional para cada tipo de clic
                if (sliderCard) {
                    const eventId = sliderCard.dataset.eventId;
                    if (eventId) {
                        try {
                            const response = await fetch(`${API_BASE_URL}/api/events/${eventId}`);
                            if (!response.ok) throw new Error('Evento no encontrado');
                            const eventData = await response.json();
                            eventsCache[eventId] = eventData;
                            renderEventDetailModal(eventData);
                        } catch (error) {
                            console.error('Error al cargar detalles del evento:', error);
                            // Aquí podrías llamar a una función de notificación si la tienes
                        }
                    } // Cierre del if (eventId)
                } else if (geminiBtn) {
                    const eventId = geminiBtn.dataset.eventId;
                    const eventData = eventsCache[eventId];
                    if (eventData) getAndShowNightPlan(eventData);
                } else if (requestLocationBtn) {
                    fetchNearbyEvents();
                } else if (modalCloseBtn || (modalOverlay && e.target === modalOverlay)) {
                    // Si se hace clic en el botón de cerrar o fuera del contenido del modal
                    const overlayToClose = modalCloseBtn ? modalCloseBtn.closest('.modal-overlay') : modalOverlay;
                    if (overlayToClose) {
                        overlayToClose.classList.remove('visible');
                    }
                } // Cierre de la cadena if/else if
            }); // Cierre del document.body.addEventListener

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
                    } // Cierre del if (filterChip)
                }); // Cierre del filterBar.addEventListener
            } // Cierre del if (filterBar)

            if (navHomeBtn) navHomeBtn.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));

            if (navThemeToggle) navThemeToggle.addEventListener('click', () => {
                const currentTheme = document.documentElement.getAttribute('data-theme');
                applyTheme(currentTheme === 'dark' ? 'light' : 'dark');
            });

            if (navHowItWorksBtn) navHowItWorksBtn.addEventListener('click', () => howItWorksModal?.classList.add('visible'));

            if (navTermsBtn) navTermsBtn.addEventListener('click', () => termsModal?.classList.add('visible'));

        }
    }

    // =========================================================================
    // 6. INICIALIZACIÓN
    // =========================================================================
    init();
});