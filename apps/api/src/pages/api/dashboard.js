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
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const endOfToday = new Date(today);
        endOfToday.setHours(23, 59, 59, 999);

        const endOfWeek = new Date(today);
        endOfWeek.setDate(today.getDate() + (7 - today.getDay()));
        endOfWeek.setHours(23, 59, 59, 999);

        // Filtro de estado: Solo mostrar eventos que están listos o ya publicados.
        const visibleStatuses = ['content_ready', 'published', 'pending', 'archived'];

        const [featuredEvents, recentEvents, weekEvents, todayEvents] = await Promise.all([
            // Eventos destacados
            Event.find({ featured: true, date: { $gte: today }, contentStatus: { $in: visibleStatuses } }).sort({ date: 1 }).limit(10).lean(),
            // Eventos recién creados
            Event.find({ date: { $gte: today }, contentStatus: { $in: visibleStatuses } }).sort({ createdAt: -1 }).limit(10).lean(),
            // Eventos de esta semana
            Event.find({ date: { $gte: today, $lte: endOfWeek }, contentStatus: { $in: visibleStatuses } }).sort({ date: 1 }).limit(10).lean(),
            // Eventos para hoy
            Event.find({ date: { $gte: today, $lte: endOfToday }, contentStatus: { $in: visibleStatuses } }).sort({ date: 1 }).limit(10).lean()
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