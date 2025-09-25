import { getEventModel } from '@/lib/database.js';
import { runMiddleware, corsMiddleware } from '@/lib/cors.js';

export default async function handler(req, res) {
    await runMiddleware(req, res, corsMiddleware);

    try {
        const Event = await getEventModel();

        // Definimos la fecha de hoy como string, igual que en dashboard.js
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        const todayString = todayStart.toISOString().split('T')[0];

        // Este es el filtro exacto que está fallando en el dashboard
        const filter = {
            date: { $gte: todayString },
            contentStatus: { $in: ['content_ready', 'published', 'pending', 'archived'] }
        };

        // Ejecutamos la consulta de conteo y la de búsqueda
        const eventCount = await Event.countDocuments(filter);
        const foundEvents = await Event.find(filter).lean();

        // Devolvemos un reporte completo
        res.status(200).json({
            description: "Resultado de la consulta de depuración final.",
            filterUsed: filter,
            eventCountFromQuery: eventCount,
            foundEvents: foundEvents
        });

    } catch (err) {
        console.error("Error in /api/final-debug:", err);
        res.status(500).json({ error: "Internal Server Error", details: err.message });
    }
}
