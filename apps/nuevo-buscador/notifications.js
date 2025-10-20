// notifications.js
// Módulo para gestionar todo lo relacionado con las Notificaciones Push.

// Función para determinar la URL de la API dinámicamente
const getApiBaseUrl = () => {
    const hostname = window.location.hostname;
    if (hostname.includes('localhost')) {
        return 'http://localhost:3000';
    }
    return 'https://api-v2.afland.es';
};
const API_BASE_URL = getApiBaseUrl();

/**
 * Convierte una cadena DE base64 (URL-safe) a un Uint8Array.
 * Necesario para la suscripción push.
 */
function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
}

/**
 * Actualiza la apariencia del botón de notificaciones según el estado del permiso.
 */
async function updateNotificationButtonUI() {
    const navNotificationsBtn = document.getElementById('nav-notifications-btn');
    if (!navNotificationsBtn) return;

    try {
        const permission = await navigator.permissions.query({ name: 'notifications' });
        const icon = navNotificationsBtn.querySelector('ion-icon');

        if (permission.state === 'granted') {
            icon.setAttribute('name', 'notifications');
            navNotificationsBtn.classList.add('active');
            navNotificationsBtn.title = 'Notificaciones activadas';
        } else if (permission.state === 'denied') {
            icon.setAttribute('name', 'notifications-off-outline');
            navNotificationsBtn.classList.add('disabled');
            navNotificationsBtn.title = 'Notificaciones bloqueadas';
        } else {
            icon.setAttribute('name', 'notifications-outline');
            navNotificationsBtn.classList.remove('active', 'disabled');
            navNotificationsBtn.title = 'Activar notificaciones';
        }
    } catch (error) {
        console.error("Error al actualizar UI del botón de notificación:", error);
        if (navNotificationsBtn) navNotificationsBtn.style.display = 'none';
    }
}

/**
 * Gestiona el proceso completo de suscripción a notificaciones push.
 */
async function handlePushSubscription() {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        alert('Tu navegador no soporta notificaciones push.');
        return;
    }

    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
        console.log('Permiso de notificación no concedido.');
        updateNotificationButtonUI();
        return;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/api/notifications/vapid-public-key`);
        const { publicKey } = await response.json();
        if (!publicKey) throw new Error('No se pudo obtener la VAPID public key.');

        const applicationServerKey = urlBase64ToUint8Array(publicKey);

        const swRegistration = await navigator.serviceWorker.ready;
        const subscription = await swRegistration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey
        });

        await fetch(`${API_BASE_URL}/api/notifications/subscribe`, {
            method: 'POST',
            body: JSON.stringify(subscription),
            headers: { 'Content-Type': 'application/json' }
        });

        console.log('Usuario suscrito a notificaciones push con éxito.');
        updateNotificationButtonUI();

    } catch (error) {
        console.error('Fallo al suscribirse a las notificaciones push:', error);
    }
}

/**
 * Comprueba la ubicación actual del usuario y, si ha cambiado, notifica al backend.
 */
async function checkLocationForNotification() {
    console.log("Comprobando ubicación para notificaciones...");
    const permission = await navigator.permissions.query({ name: 'geolocation' });
    if (permission.state !== 'granted') {
        console.log("Permiso de geolocalización no concedido. No se comprobará la ubicación.");
        return;
    }

    navigator.geolocation.getCurrentPosition(async (position) => {
        const { latitude, longitude } = position.coords;

        try {
            // 1. Convertir coordenadas a ciudad usando nuestro endpoint seguro
            const cityResponse = await fetch(`${API_BASE_URL}/api/location/city?lat=${latitude}&lon=${longitude}`);
            if (!cityResponse.ok) throw new Error('No se pudo obtener el nombre de la ciudad.');
            const { city } = await cityResponse.json();

            // 2. Comprobar si la ciudad ha cambiado
            const lastKnownCity = localStorage.getItem('duende_last_known_city');
            if (city && city !== lastKnownCity) {
                console.log(`Cambio de ciudad detectado: de ${lastKnownCity || 'ninguna'} a ${city}`);

                // 3. Obtener la suscripción push actual
                const swRegistration = await navigator.serviceWorker.ready;
                const subscription = await swRegistration.pushManager.getSubscription();

                if (subscription) {
                    // 4. Notificar al backend sobre la nueva ubicación
                    await fetch(`${API_BASE_URL}/api/notifications/update-location`, {
                        method: 'POST',
                        body: JSON.stringify({ subscription, city }),
                        headers: { 'Content-Type': 'application/json' }
                    });
                    console.log('Backend notificado sobre el cambio de ubicación.');
                }

                // 5. Actualizar la ciudad en localStorage
                localStorage.setItem('duende_last_known_city', city);
            }
        } catch (error) {
            console.error('Error en el proceso de notificación por geolocalización:', error);
        }
    });
}

/**
 * Envía un "check-in" al backend para registrar la actividad del usuario.
 */
async function performCheckIn() {
    try {
        const swRegistration = await navigator.serviceWorker.ready;
        const subscription = await swRegistration.pushManager.getSubscription();

        if (subscription) {
            await fetch(`${API_BASE_URL}/api/notifications/check-in`, {
                method: 'POST',
                body: JSON.stringify({ subscription }),
                headers: { 'Content-Type': 'application/json' }
            });
            console.log("Check-in de actividad enviado al backend.");
        }
    } catch (error) {
        console.error("Error durante el proceso de check-in:", error);
    }
}

/**
 * Función principal que se exporta para inicializar toda la lógica de notificaciones.
 */
export function initPushNotifications() {
    const navNotificationsBtn = document.getElementById('nav-notifications-btn');
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        if (navNotificationsBtn) navNotificationsBtn.style.display = 'none';
        return;
    }

    if (navNotificationsBtn) {
        navNotificationsBtn.addEventListener('click', handlePushSubscription);
        updateNotificationButtonUI();
    }

    // Defer non-critical tasks to improve LCP
    setTimeout(() => {
        // Realizar el check-in de actividad al iniciar
        performCheckIn();

        // Comprobar la ubicación al iniciar la app
        checkLocationForNotification();
    }, 4000); // 4 seconds delay
}
