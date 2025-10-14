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

        const [featuredEvents, recentEvents, weekEvents, todayEvents] = await Promise.all([
            // Eventos destacados
            Event.find({ featured: true, date: { $gte: today } }).sort({ date: 1 }).limit(10).lean(),
            // Eventos recién creados
            Event.find({ date: { $gte: today } }).sort({ createdAt: -1 }).limit(10).lean(),
            // Eventos de esta semana
            Event.find({ date: { $gte: today, $lte: endOfWeek } }).sort({ date: 1 }).limit(10).lean(),
            // Eventos para hoy
            Event.find({ date: { $gte: today, $lte: endOfToday } }).sort({ date: 1 }).limit(10).lean()
        ]);

        // Ordenamosos los eventos recientes por fecha de evento en lado del servidor
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