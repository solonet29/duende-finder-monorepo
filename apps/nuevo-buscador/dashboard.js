// /apps/api/src/pages/api/dashboard.js

import { getEventModel } from '../../../lib/database';
import { runMiddleware, corsMiddleware } from '../../../lib/cors';

/**
 * Este endpoint está optimizado para cargar todos los datos necesarios
 * para el dashboard principal en una sola petición, reduciendo drásticamente
 * los tiempos de carga iniciales.
 */
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
            Event.find({ featured: true, eventDate: { $gte: today } }).sort({ eventDate: 1 }).limit(10).lean(),
            // Eventos recién creados
            Event.find({ eventDate: { $gte: today } }).sort({ createdAt: -1 }).limit(10).lean(),
            // Eventos de esta semana
            Event.find({ eventDate: { $gte: today, $lte: endOfWeek } }).sort({ eventDate: 1 }).limit(10).lean(),
            // Eventos para hoy
            Event.find({ eventDate: { $gte: today, $lte: endOfToday } }).sort({ eventDate: 1 }).limit(10).lean()
        ]);

        // Ordenamos los eventos recientes por fecha de evento en el lado del servidor
        recentEvents.sort((a, b) => new Date(a.date) - new Date(b.date));

        res.status(200).json({
            featuredEvents,
            recentEvents,
            weekEvents,
            todayEvents
        });

    } catch (error) {
        console.error('Error fetching dashboard data:', error);
        res.status(500).json({ error: 'Error interno del servidor al obtener los datos del dashboard.' });
    }
}