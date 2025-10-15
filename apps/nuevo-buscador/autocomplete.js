import { connectToMainDb } from '@/lib/database.js';
import { runMiddleware, corsMiddleware } from '@/lib/cors.js';

export default async function handler(req, res) {
    await runMiddleware(req, res, corsMiddleware);

    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const { query } = req.query;

    if (!query || query.length < 2) {
        return res.status(200).json([]);
    }

    try {
        const db = await connectToMainDb();
        const eventsCollection = db.collection('events');

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // Usamos `distinct` en el campo 'city' para obtener nombres únicos de forma eficiente.
        const cities = await eventsCollection.distinct('city', {
            city: { $regex: `^${query}`, $options: 'i' },
            date: { $gte: today.toISOString() } // Sugerir solo ciudades con eventos futuros
        });

        const limitedCities = cities.slice(0, 10);

        res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=59');
        return res.status(200).json(limitedCities);

    } catch (error) {
        console.error("Error en el endpoint de autocompletado de ciudades:", error);
        return res.status(500).json({ error: 'Error al obtener las sugerencias de ciudades.' });
    }
}