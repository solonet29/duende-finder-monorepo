// notify-new-events.js
// OBJETIVO: Enviar una notificación push a todos los suscriptores sobre eventos recién creados.

require('dotenv').config();
const { connectToDatabase, closeDatabaseConnection } = require('./lib/database.js');
const webpush = require('../api/lib/webPush.js'); // Reutilizamos la configuración de web-push de la API

async function notifyAboutNewEvents() {
    console.log('🚀 Iniciando script de notificación de nuevos eventos...');
    const db = await connectToDatabase();
    
    try {
        // PASO 1: Buscar eventos pendientes de notificar.
        const eventsCollection = db.collection('events');
        const query = { notificationStatus: 'pending' };
        const eventsToNotify = await eventsCollection.find(query).toArray();

        if (eventsToNotify.length === 0) {
            console.log('✅ No se encontraron eventos nuevos para notificar.');
            return;
        }

        const newEventsCount = eventsToNotify.length;
        console.log(`🔍 Se encontraron ${newEventsCount} eventos nuevos. Preparando notificación...`);

        // PASO 2: Obtener todos los suscriptores
        const subscriptionsCollection = db.collection('push_subscriptions');
        const subscriptions = await subscriptionsCollection.find({}).toArray();

        if (subscriptions.length === 0) {
            console.log('✅ No hay suscriptores a los que notificar.');
            return;
        }

        console.log(`ℹ️ ${subscriptions.length} suscriptores encontrados. Enviando notificaciones...`);

        // PASO 3: Crear el payload y enviar las notificaciones
        const payload = JSON.stringify({
            title: newEventsCount > 1 ? `¡${newEventsCount} nuevos eventos de flamenco!` : '¡Un nuevo evento de flamenco te espera!',
            body: 'Pulsa aquí para descubrir los últimos espectáculos añadidos.',
            icon: 'https://buscador.afland.es/favicon.png',
            badge: 'https://buscador.afland.es/favicon.png',
            url: 'https://buscador.afland.es/' // URL a la que se redirige al hacer clic
        });

        let successCount = 0;
        let failureCount = 0;

        const notificationPromises = subscriptions.map(async (sub) => {
            try {
                await webpush.sendNotification(sub, payload);
                successCount++;
            } catch (error) {
                failureCount++;
                // Si la suscripción no es válida (error 410 o 404), la eliminamos
                if (error.statusCode === 410 || error.statusCode === 404) {
                    console.log(`   -> Suscripción caducada o no válida. Eliminando: ${sub.endpoint.substring(0, 50)}...`);
                    await subscriptionsCollection.deleteOne({ _id: sub._id });
                }
            }
        });

        await Promise.all(notificationPromises);

        // PASO 4: Actualizar el estado de notificación de los eventos.
        const eventIdsToUpdate = eventsToNotify.map(event => event._id);
        await eventsCollection.updateMany(
            { _id: { $in: eventIdsToUpdate } },
            { $set: { notificationStatus: 'sent' } }
        );
        console.log(`   -> ${eventIdsToUpdate.length} eventos actualizados a 'notificationStatus: sent'.`);

        console.log(`
🎉 Proceso de envío finalizado.`);
        console.log(`   -> ${successCount} notificaciones enviadas con éxito.`);
        console.log(`   -> ${failureCount} envíos fallidos (y eliminados si procede).`);

    } catch (error) {
        console.error('❌ Ha ocurrido un error general en el script de notificación:', error);
    } finally {
        await closeDatabaseConnection();
        console.log('✅ Conexión a la base de datos cerrada.');
    }
}

notifyAboutNewEvents();