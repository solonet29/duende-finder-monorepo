import { getEventModel } from '@/lib/database.js';
import { runMiddleware, corsMiddleware } from '@/lib/cors.js';

// --- HELPERS ---

/**
 * Define los campos a proyectar para mantener los payloads ligeros.
 */
const lightweightProjection = {
    name: 1,
    artist: 1,
    date: 1,
    time: 1,
    city: 1,
    venue: 1,
    imageUrl: 1,
    slug: 1,
};

/**
 * Obtiene los próximos N meses en formato YYYY-MM.
 * @param {number} count - El número de meses a obtener.
 * @returns {string[]} - Array de meses, ej: ['2025-09', '2025-10', ...].
 */
function getNextMonths(count) {
    const months = [];
    const today = new Date();
    for (let i = 0; i < count; i++) {
        const d = new Date(today.getFullYear(), today.getMonth() + i, 1);
        const year = d.getFullYear();
        const month = (d.getMonth() + 1).toString().padStart(2, '0');
        months.push(`${year}-${month}`);
    }
    return months;
}


// --- MANEJADOR PRINCIPAL ---

export default async function handler(req, res) {
    await runMiddleware(req, res, corsMiddleware);

    try {
        const Event = await getEventModel();
        
        // --- Definición robusta de rangos de fechas con objetos Date ---
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);

        const tomorrowStart = new Date(todayStart);
        tomorrowStart.setDate(todayStart.getDate() + 1);

        const nextWeekEnd = new Date(todayStart);
        nextWeekEnd.setDate(todayStart.getDate() + 7);

        // --- Consultas a la Base de Datos en Paralelo ---

        const [
            totalEvents,
            featuredEvents,
            weekEvents,
            todayEvents,
            ...monthlyResults
        ] = await Promise.all([
            // 1. Conteo total de eventos activos (muy eficiente)
            Event.countDocuments({ date: { $gte: todayStart }, status: 'active' }),

            // 2. Eventos destacados
            Event.find({ featured: true, date: { $gte: todayStart } }, { projection: lightweightProjection, limit: 10, sort: { date: 1 } }).lean(),

            // 3. Eventos de la semana
            Event.find({ date: { $gte: todayStart, $lte: nextWeekEnd } }, { projection: lightweightProjection, limit: 10, sort: { date: 1 } }).lean(),

            // 4. Eventos de hoy (CORREGIDO: usando rango de 24h)
            Event.find({ date: { $gte: todayStart, $lt: tomorrowStart } }, { projection: lightweightProjection, limit: 10, sort: { time: 1 } }).lean(),
            
            // 5. Eventos para los próximos 3 meses
            ...getNextMonths(3).map(monthKey => {
                const startDate = new Date(monthKey + '-01');
                const endDate = new Date(startDate);
                endDate.setMonth(endDate.getMonth() + 1);

                const startDateString = startDate.toISOString().split('T')[0];
                const endDateString = endDate.toISOString().split('T')[0];

                return Event.find(
                    { date: { $gte: startDateString, $lt: endDateString } },
                    { projection: lightweightProjection, limit: 10, sort: { date: 1 } }
                ).lean();
            })
        ]);

        // --- Ensamblaje de la Respuesta ---

        const monthlyEvents = getNextMonths(3).map((monthKey, index) => ({
            monthKey,
            events: monthlyResults[index] || []
        }));

        const dashboardData = {
            totalEvents,
            featuredEvents,
            weekEvents,
            todayEvents,
            monthlyEvents
        };

        // --- Configuración del Caching ---
        // Cachear en CDN por 10 mins, y permitir servir 'stale' mientras se revalida en background.
        res.setHeader(
            'Cache-Control',
            'public, s-maxage=600, stale-while-revalidate=1800'
        );

        res.status(200).json(dashboardData);

    } catch (err) {
        console.error("Error en /api/dashboard:", err);
        res.status(500).json({ error: "Internal Server Error", details: err.message });
    }
}