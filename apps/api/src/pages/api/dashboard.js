import { getEventModel } from '../../../lib/database';
import { runMiddleware, corsMiddleware } from '../../../lib/cors';

export default async function handler(req, res) {
    await runMiddleware(req, res, corsMiddleware);

    if (req.method !== 'GET') {
        res.setHeader('Allow', ['GET']);
        return res.status(405).end(`Method ${req.method} Not Allowed`);
    }

    try {
        const Event = await getEventModel();

        // Helper para formatear la fecha a YYYY-MM-DD, que es comparable como string.
        const formatDate = (date) => date.toISOString().split('T')[0];

        const todayObj = new Date();
        todayObj.setHours(0, 0, 0, 0);

        const endOfWeekObj = new Date(todayObj);
        endOfWeekObj.setDate(todayObj.getDate() + (7 - todayObj.getDay()));
        endOfWeekObj.setHours(23, 59, 59, 999);

        const todayStr = formatDate(todayObj);
        const endOfWeekStr = formatDate(endOfWeekObj);

        // Filtro de estado: Solo mostrar eventos que están listos para ser visibles.
        const visibleStatuses = ['content_ready', 'published', 'pending', 'archived'];

        const [featuredEvents, recentEvents, weekEvents, todayEvents] = await Promise.all([
            // Eventos destacados: Desde hoy en adelante
            Event.find({ featured: true, date: { $gte: todayStr }, contentStatus: { $in: visibleStatuses } }).sort({ date: 1 }).limit(10).lean(),

            // Eventos recién creados: Desde hoy en adelante, ordenados por fecha de creación
            Event.find({ date: { $gte: todayStr }, contentStatus: { $in: visibleStatuses } }).sort({ createdAt: -1 }).limit(10).lean(),

            // Eventos de esta semana: Desde hoy hasta el final de la semana
            Event.find({ date: { $gte: todayStr, $lte: endOfWeekStr }, contentStatus: { $in: visibleStatuses } }).sort({ date: 1 }).limit(10).lean(),

            // Eventos para hoy: Solo los que tienen la fecha de hoy
            Event.find({ date: todayStr, contentStatus: { $in: visibleStatuses } }).sort({ date: 1 }).limit(10).lean()
        ]);

        // Ordenamos los eventos recientes por fecha de evento en lado del servidor
        recentEvents.sort((a, b) => new Date(a.date) - new Date(b.date));

        res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=300');

        res.status(200).json({
            featuredEvents,
            recentEvents,
            weekEvents,
            todayEvents
        });

    } catch (err) {
        console.error("Error fetching dashboard data:", err);
        res.status(500).json({ error: "Internal Server Error", details: err.message });
    }
}