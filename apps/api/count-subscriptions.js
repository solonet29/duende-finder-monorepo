
// count-subscriptions.js
// Script para contar el número total de suscripciones a notificaciones push.

import { connectToMainDb } from './lib/database.js';

async function countSubscriptions() {
    let mainConnection;
    try {
        console.log('Conectando a la base de datos...');
        mainConnection = await connectToMainDb();
        const subscriptionsCollection = mainConnection.collection('push_subscriptions');

        console.log('Contando documentos en la colección push_subscriptions...');
        const count = await subscriptionsCollection.countDocuments();

        console.log(`Número total de usuarios suscritos a notificaciones: ${count}`);

    } catch (error) {
        console.error('Error al contar las suscripciones:', error);
    } finally {
        if (mainConnection) {
            // No hay un método explícito como mainConnection.close() en el wrapper.
            // La conexión se gestiona de forma centralizada.
            // Si la librería subyacente es MongoClient, se podría necesitar,
            // pero aquí asumimos que la gestión de la conexión es manejada por el wrapper.
            console.log('Proceso finalizado.');
        }
    }
}

countSubscriptions();
