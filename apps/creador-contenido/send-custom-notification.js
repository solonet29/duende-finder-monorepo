// send-custom-notification.js
// OBJETIVO: Enviar una notificación push con un mensaje personalizado a todos los suscriptores.

require('dotenv').config();
const { connectToDatabase, closeDatabaseConnection } = require('./lib/database.js');
const webpush = require('../api/lib/webPush.js'); // Reutilizamos la configuración de web-push de la API

async function sendCustomNotification() {
    // --- OBTENCIÓN DE DATOS DESDE LA LÍNEA DE COMANDOS ---
    const args = process.argv.slice(2); // Ignora 'node' y el nombre del script

    if (args.length < 3) {
        console.error('❌ Error: Faltan argumentos. El uso correcto es:');
        console.error('   node send-custom-notification.js "Título de la notificación" "Cuerpo del mensaje" "https://url-de-destino.com"');
        process.exit(1); // Termina el script si no hay argumentos suficientes
    }

    const [title, body, url] = args;

    const PAYLOAD = {
        title,
        body,
        icon: 'https://buscador.afland.es/favicon.png',
        badge: 'https://buscador.afland.es/favicon.png',
        url
    };

    console.log('🚀 Iniciando script de notificación personalizada...');
    console.log(`   -> Título: "${PAYLOAD.title}"`);
    console.log(`   -> Cuerpo: "${PAYLOAD.body}"`);
    console.log(`   -> URL: "${PAYLOAD.url}"`);

    const db = await connectToDatabase();

    try {
        // PASO 1: Obtener todos los suscriptores
        const subscriptionsCollection = db.collection('push_subscriptions');
        const subscriptions = await subscriptionsCollection.find({}).toArray();

        if (subscriptions.length === 0) {
            console.log('✅ No hay suscriptores a los que notificar.');
            return;
        }

        console.log(`ℹ️ ${subscriptions.length} suscriptores encontrados. Enviando notificaciones...`);

        // PASO 2: Enviar las notificaciones
        const payloadString = JSON.stringify(PAYLOAD);
        let successCount = 0;
        let failureCount = 0;

        const notificationPromises = subscriptions.map(async (sub) => {
            try {
                await webpush.sendNotification(sub, payloadString);
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

        console.log(`\n🎉 Proceso de envío finalizado.`);
        console.log(`   -> ${successCount} notificaciones enviadas con éxito.`);
        console.log(`   -> ${failureCount} envíos fallidos (y eliminados si procede).`);

    } catch (error) {
        console.error('❌ Ha ocurrido un error general en el script de notificación personalizada:', error);
    } finally {
        await closeDatabaseConnection();
        console.log('✅ Conexión a la base de datos cerrada.');
    }
}

sendCustomNotification();
