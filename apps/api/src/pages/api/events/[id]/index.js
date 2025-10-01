// RUTA: /src/pages/api/events/[id]/index.js
// VERSIÃN REFACTORIZADA USANDO EL DATA PROVIDER

import { getEventById } from '@/lib/data-provider.js';
import { runMiddleware, corsMiddleware } from '@/lib/cors.js';

export default async function handler(req, res) {
    await runMiddleware(req, res, corsMiddleware);

    const { id } = req.query;

    if (!id) {
        return res.status(400).json({ error: 'ID de evento no proporcionado.' });
    }

    try {
        const event = await getEventById(id);

        if (!event) {
            return res.status(404).json({ error: 'Evento no encontrado.' });
        }

        res.setHeader('Cache-Control', 's-maxage=7200, stale-while-revalidate=59');
        res.status(200).json(event);

    } catch (err) {
        console.error(`Error en /api/events/${id}:`, err);
        res.status(500).json({ error: "Error interno del servidor", details: err.message });
    }
}