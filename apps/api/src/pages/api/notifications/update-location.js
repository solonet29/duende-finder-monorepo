// /pages/api/notifications/update-location.js

import { connectToDatabase } from '../../../lib/database';
import webpush from '../../../lib/webPush';

// Este endpoint es el cerebro de las notificaciones por geolocalización.
// Se activa cuando el frontend detecta un cambio de ciudad del usuario.
export default async function handler(req, res) {
    if (req.method !== 'POST') {
        res.setHeader('Allow', ['POST']);
        return res.status(405).end(`Method ${req.method} Not Allowed`);
    }

    const { subscription, city } = req.body;

    if (!subscription || !subscription.endpoint || !city) {
        return res.status(400).json({ error: 'Faltan datos de suscripción o ciudad.' });
    }

    try {
        const db = await connectToDatabase();
        const subscriptionsCollection = db.collection('push_subscriptions');
        const eventsCollection = db.collection('events');

        // 1. Buscar la suscripción del usuario
        const userSubscription = await subscriptionsCollection.findOne({ "endpoint": subscription.endpoint });

        if (!userSubscription) {
            // Si no se encuentra, podría ser una suscripción nueva. La guardamos.
            await subscriptionsCollection.insertOne({ ...subscription, lastKnownCity: city });
            return res.status(201).json({ message: 'Nueva suscripción registrada con su ciudad.' });
        }

        // 2. Comprobar si la ciudad ha cambiado y si ya hemos notificado sobre esta ciudad
        if (userSubscription.lastKnownCity === city && userSubscription.lastNotifiedCity === city) {
            return res.status(200).json({ message: 'El usuario sigue en la misma ciudad y ya fue notificado. No se requiere acción.' });
        }
        
        // Actualizamos la última ciudad conocida en cada check-in
        await subscriptionsCollection.updateOne(
            { _id: userSubscription._id },
            { $set: { lastKnownCity: city } }
        );

        if (userSubscription.lastNotifiedCity === city) {
             return res.status(200).json({ message: 'El usuario ha vuelto a una ciudad sobre la que ya se notificó. No se requiere acción.' });
        }

        // 3. Si la ciudad es nueva, buscar eventos cercanos en el tiempo
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const sevenDaysFromNow = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);

        const eventsInNewCity = await eventsCollection.find({
            city: city,
            date: { 
                $gte: today.toISOString().split('T')[0],
                $lte: sevenDaysFromNow.toISOString().split('T')[0]
            },
            status: 'content_ready'
        }).limit(5).toArray();

        if (eventsInNewCity.length === 0) {
            return res.status(200).json({ message: 'Nueva ciudad detectada, pero no hay eventos cercanos para notificar.' });
        }

        // 4. Si hay eventos, enviar notificación y actualizar el estado
        const eventCount = eventsInNewCity.length;
        const payload = JSON.stringify({
            title: `¡Bienvenid@ a ${city}! `,
            body: `Hemos encontrado ${eventCount} eventos de flamenco para ti en los próximos 7 días. ¡Descúbrelos!`,
            icon: 'https://buscador.afland.es/favicon.png',
            badge: 'https://buscador.afland.es/favicon.png',
            url: `https://buscador.afland.es/` // Podríamos incluso llevar a una URL filtrada por ciudad en el futuro
        });

        await webpush.sendNotification(userSubscription, payload);
        console.log(`Notificación de bienvenida a ${city} enviada a ${userSubscription.endpoint.substring(0, 50)}...`);

        // 5. Actualizar la BBDD para no volver a notificar en esta ciudad
        await subscriptionsCollection.updateOne(
            { _id: userSubscription._id },
            { $set: { lastNotifiedCity: city } }
        );

        res.status(200).json({ message: 'Notificación de nueva ciudad enviada con éxito.' });

    } catch (error) {
        console.error('Error en la lógica de notificación por ubicación:', error);
        // Si la suscripción es inválida, la eliminamos
        if (error.statusCode === 410 || error.statusCode === 404) {
            console.log(`Suscripción caducada. Eliminando: ${subscription.endpoint.substring(0, 50)}...`);
            await db.collection('push_subscriptions').deleteOne({ "endpoint": subscription.endpoint });
        }
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
}
