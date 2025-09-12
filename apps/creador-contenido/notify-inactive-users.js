// notify-inactive-users.js
// OBJETIVO: Encontrar usuarios inactivos y enviarles una notificación de re-engagement.

require('dotenv').config();
const { connectToDatabase, closeDatabaseConnection } = require('./lib/database.js');
const webpush = require('../api/lib/webPush.js');
const { ObjectId } = require('mongodb');

const INACTIVITY_THRESHOLD_HOURS = 72;

async function notifyInactiveUsers() {
    console.log('🚀 Iniciando script para notificar a usuarios inactivos...');
    const db = await connectToDatabase();
    
    try {
        const subscriptionsCollection = db.collection('push_subscriptions');
        const thresholdDate = new Date(Date.now() - INACTIVITY_THRESHOLD_HOURS * 60 * 60 * 1000);

        // Criterio: usuarios no vistos desde la fecha umbral y a los que no se les haya enviado ya esta notificación.
        const query = {
            lastSeenAt: { $lt: thresholdDate },
            reEngagementNotificationSentAt: null
        };

        const inactiveUsers = await subscriptionsCollection.find(query).toArray();

        if (inactiveUsers.length === 0) {
            console.log('✅ No se encontraron usuarios inactivos para notificar.');
            return;
        }

        console.log(`🔍 Se encontraron ${inactiveUsers.length} usuarios inactivos. Preparando notificación de re-engagement...`);

        const payload = JSON.stringify({
            title: '👋 ¿Echabas de menos el duende?',
            body: 'Descubre los eventos cerca de ti o planea tu próxima noche flamenca con nuestra IA. ¡Te esperamos!',
            icon: 'https://buscador.afland.es/favicon.png',
            badge: 'https://buscador.afland.es/favicon.png',
            url: 'https://buscador.afland.es/'
        });

        let successCount = 0;
        let failureCount = 0;

        const notificationPromises = inactiveUsers.map(async (user) => {
            try {
                await webpush.sendNotification(user, payload);
                successCount++;

                // Marcar como notificado para no volver a enviar
                await subscriptionsCollection.updateOne(
                    { _id: new ObjectId(user._id) },
                    { $set: { reEngagementNotificationSentAt: new Date() } }
                );

            } catch (error) {
                failureCount++;
                if (error.statusCode === 410 || error.statusCode === 404) {
                    console.log(`   -> Suscripción caducada. Eliminando: ${user.endpoint.substring(0, 50)}...`);
                    await subscriptionsCollection.deleteOne({ _id: new ObjectId(user._id) });
                }
            }
        });

        await Promise.all(notificationPromises);

        console.log(`
🎉 Proceso de envío a inactivos finalizado.`);
        console.log(`   -> ${successCount} notificaciones enviadas con éxito.`);
        console.log(`   -> ${failureCount} envíos fallidos.`);

    } catch (error) {
        console.error('❌ Ha ocurrido un error general en el script de inactivos:', error);
    } finally {
        await closeDatabaseConnection();
        console.log('✅ Conexión a la base de datos cerrada.');
    }
}

notifyInactiveUsers();
