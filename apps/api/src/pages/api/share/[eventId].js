// RUTA: /src/pages/api/share/[eventId].js
// Este endpoint gestiona las URLs de compartición y redirige a la página canónica del evento.

import { connectToMainDb } from '@/lib/database.js';
import { ObjectId } from 'mongodb';

export default async function handler(req, res) {
    const { eventId } = req.query;

    if (!eventId || !ObjectId.isValid(eventId)) {
        return res.status(400).send('Invalid Event ID');
    }

    try {
        const db = await connectToMainDb();
        const event = await db.collection('events').findOne(
            { _id: new ObjectId(eventId) },
            { projection: { slug: 1 } } // Solo necesitamos el slug para construir la URL
        );

        if (!event) {
            return res.status(404).send('Event not found');
        }

        // Construir la URL de destino canónica y correcta
        const destinationUrl = `https://nuevobuscador.afland.es/eventos/${event._id}-${event.slug || 'evento'}`;

        // Realizar una redirección permanente (301) a la página del evento.
        // Esto es amigable para SEO y para los crawlers de redes sociales.
        res.redirect(301, destinationUrl);

    } catch (error) {
        console.error("Error en el endpoint de share:", error);
        // Redirección de fallback a la página principal si algo falla
        res.redirect(307, '/');
    }
}