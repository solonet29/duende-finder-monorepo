// /pages/api/notifications/subscribe.js

import { connectToDatabase } from '../../../../lib/database';

// Este endpoint recibe una suscripción push del cliente y la guarda en la BBDD.
export default async function handler(req, res) {
    if (req.method !== 'POST') {
        res.setHeader('Allow', ['POST']);
        return res.status(405).end(`Method ${req.method} Not Allowed`);
    }

    const subscription = req.body;

    // Validación básica de la suscripción
    if (!subscription || !subscription.endpoint) {
        return res.status(400).json({ error: 'El objeto de suscripción es inválido.' });
    }

    try {
        const db = await connectToDatabase();
        const subscriptionsCollection = db.collection('push_subscriptions');

        // Evitar duplicados: si ya existe una suscripción con el mismo endpoint, no la insertamos de nuevo.
        const existingSubscription = await subscriptionsCollection.findOne({ "endpoint": subscription.endpoint });

        if (existingSubscription) {
            console.log('Suscripción ya existente. No se requiere acción.');
            return res.status(200).json({ message: 'Suscripción ya existente.' });
        }

        // Guardar la nueva suscripción
        await subscriptionsCollection.insertOne(subscription);
        console.log('Nueva suscripción guardada con éxito.');

        res.status(201).json({ message: 'Suscripción guardada con éxito.' });

    } catch (error) {
        console.error('Error al guardar la suscripción en la base de datos:', error);
        res.status(500).json({ error: 'Error interno del servidor al guardar la suscripción.' });
    }
}
