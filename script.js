document.addEventListener('DOMContentLoaded', () => {
    // ... (API_BASE_URL and other constants remain the same)

    // --- DOM Element Selectors ---
    const mainContainer = document.querySelector('main.container');
    // ... (existing selectors for search, results, etc.)

    // NEW: Settings Modal Elements
    const settingsBtn = document.getElementById('settings-btn');
    const settingsModalOverlay = document.getElementById('settings-modal-overlay');
    const settingsModalCloseBtn = document.getElementById('settings-modal-close-btn');
    const themeToggleSwitch = document.getElementById('theme-toggle-switch');
    const notificationsToggleSwitch = document.getElementById('notifications-toggle-switch');

    // ... (other global variables like isResultsView, eventsCache)

    // --- EVENT LISTENERS SETUP ---
    function setupEventListeners() {
        // ... (searchForm, nearbyEventsBtn, etc. listeners remain)

        // NEW: Settings Modal Listeners
        settingsBtn.addEventListener('click', () => settingsModalOverlay.classList.add('visible'));
        settingsModalCloseBtn.addEventListener('click', () => settingsModalOverlay.classList.remove('visible'));
        settingsModalOverlay.addEventListener('click', (e) => {
            if (e.target === settingsModalOverlay) settingsModalOverlay.classList.remove('visible');
        });

        // NEW: Listeners for controls inside settings modal
        themeToggleSwitch.addEventListener('change', () => {
            const newTheme = themeToggleSwitch.checked ? 'dark' : 'light';
            setTheme(newTheme);
        });
        notificationsToggleSwitch.addEventListener('change', handleNotificationToggle);

        // ... (other existing listeners like resultsContainer, tripPlannerBtn, etc.)
    }

    // ... (handleResultsContainerClick, handleTripPlannerSubmit, etc. remain the same)

    // --- PUSH NOTIFICATIONS ---
    async function registerServiceWorkerAndSubscribe() {
        // ... (this function remains the same)
    }

    // NEW: Unsubscribe logic
    async function unsubscribeUser() {
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();
        if (subscription) {
            try {
                const response = await fetch(`${API_BASE_URL}/api/unsubscribe`, {
                    method: 'POST',
                    body: JSON.stringify({ endpoint: subscription.endpoint }),
                    headers: { 'Content-Type': 'application/json' }
                });
                if (response.ok) {
                    await subscription.unsubscribe();
                    showNotification('Suscripción a notificaciones cancelada.', 'info');
                } else {
                    throw new Error('Error en el servidor al cancelar la suscripción.');
                }
            } catch (error) {
                console.error('Error al cancelar la suscripción:', error);
                showNotification('No se pudo cancelar la suscripción.', 'error');
            }
        }
        updateNotificationToggleState();
    }

    // NEW: Update toggle state based on permission
    function updateNotificationToggleState() {
        if (!('Notification' in window)) {
            notificationsToggleSwitch.disabled = true;
            return;
        }
        switch (Notification.permission) {
            case 'granted':
                notificationsToggleSwitch.checked = true;
                notificationsToggleSwitch.disabled = false;
                break;
            case 'denied':
                notificationsToggleSwitch.checked = false;
                notificationsToggleSwitch.disabled = true;
                break;
            case 'default':
                notificationsToggleSwitch.checked = false;
                notificationsToggleSwitch.disabled = false;
                break;
        }
    }

    // NEW: Handle the notification toggle switch logic
    function handleNotificationToggle() {
        if (notificationsToggleSwitch.checked) {
            registerServiceWorkerAndSubscribe().catch(err => {
                console.error(err);
                updateNotificationToggleState(); // Revert toggle on failure
            });
        } else {
            unsubscribeUser();
        }
    }

    // ... (urlBase64ToUint8Array, performSearch, displayEvents, etc. remain the same)

    // --- UI & THEME ---
    // MODIFIED: setTheme now also updates the toggle switch
    function setTheme(theme) {
        const root = document.documentElement;
        root.setAttribute('data-theme', theme);
        localStorage.setItem('theme', theme);
        
        // Update the new toggle switch in the settings modal
        if (themeToggleSwitch) {
            themeToggleSwitch.checked = theme === 'dark';
        }

        document.getElementById('theme-color-meta').setAttribute('content',
            getComputedStyle(root).getPropertyValue(theme === 'dark' ? '--color-fondo-dark' : '--color-fondo-light').trim()
        );
    }

    // ... (showModal, hideModal, etc. remain the same)

    // --- INITIALIZATION ---
    function proactiveNotificationPrompt() {
        // ... (this function remains the same)
    }

    function initialize() {
        // ... (existing setupEventListeners call)

        // MODIFIED: Update UI states on load
        const savedTheme = localStorage.getItem('theme') || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
        setTheme(savedTheme);
        updateNotificationToggleState();

        // ... (existing logic for URL params and geolocation)

        // Proactive prompt timer
        setTimeout(proactiveNotificationPrompt, 20000);
    }

    initialize();
});
