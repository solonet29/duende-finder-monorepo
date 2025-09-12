// /pages/api/notifications/check-in.js

import { connectToDatabase } from '../../../lib/database';

// Este endpoint registra la actividad de un usuario.
// El frontend lo llamará cada vez que se inicie la aplicación.
export default async function handler(req, res) {
    if (req.method !== 'POST') {
        res.setHeader('Allow', ['POST']);
        return res.status(405).end(`Method ${req.method} Not Allowed`);
    }

    const { subscription } = req.body;

    if (!subscription || !subscription.endpoint) {
        return res.status(400).json({ error: 'El objeto de suscripción es inválido.' });
    }

    try {
        const db = await connectToDatabase();
        const subscriptionsCollection = db.collection('push_subscriptions');

        const updateResult = await subscriptionsCollection.updateOne(
            { "endpoint": subscription.endpoint },
            {
                $set: {
                    lastSeenAt: new Date(), // Actualizamos la fecha de última visita
                    reEngagementNotificationSentAt: null // Reseteamos el flag de notificación de inactividad
                }
            }
        );

        if (updateResult.matchedCount === 0) {
            // Si no existe, podría ser un buen momento para registrarlo también
            await subscriptionsCollection.insertOne({
                ...subscription,
                lastSeenAt: new Date(),
                reEngagementNotificationSentAt: null
            });
            return res.status(201).json({ message: 'Nueva suscripción registrada con check-in.' });
        }

        res.status(200).json({ message: 'Check-in de actividad registrado con éxito.' });

    } catch (error) {
        console.error('Error al registrar el check-in:', error);
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
}
