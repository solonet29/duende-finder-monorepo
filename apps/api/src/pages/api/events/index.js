// RUTA: /src/pages/api/events/index.js
// VERSIÓN RESTAURADA Y CORREGIDA CON PAGINACIÓN

import { getEventModel } from '@/lib/database.js';
import { runMiddleware, corsMiddleware } from '@/lib/cors.js';

// --- MANEJADOR PRINCIPAL DE LA API ---
export default async function handler(req, res) {
    await runMiddleware(req, res, corsMiddleware);

    try {
        const Event = await getEventModel();

        const {
            search = null, artist = null, city = null, country = null,
            dateFrom = null, dateTo = null, timeframe = null, lat = null,
            lon = null, radius = null, sort = null, featured = null,
            month = null, // Param para paginación de meses
            page = '1',     // Param para paginación de meses
            limit = '10'   // Param para paginación de meses
        } = req.query;

        const featuredArtists = [
            'Farruquito', 'Pedro el Granaino', 'Miguel Poveda', 'Argentina',
            'Marina Heredia', 'Tomatito', 'Alba Heredia', 'Ivan Vargas', 'Estrella Morente',
        ];

        let aggregationPipeline = [];

        if (lat && lon) {
            const latitude = parseFloat(lat);
            const longitude = parseFloat(lon);
            const searchRadiusMeters = (parseFloat(radius) || 60) * 1000;
            if (!isNaN(latitude) && !isNaN(longitude) && !isNaN(searchRadiusMeters)) {
                aggregationPipeline.push({
                    $geoNear: {
                        near: { type: 'Point', coordinates: [longitude, latitude] },
                        distanceField: 'dist.calculated',
                        maxDistance: searchRadiusMeters,
                        spherical: true
                    }
                });
            }
        }

        const matchFilter = {};
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todayString = today.toISOString().split('T')[0];

        // Por defecto, solo mostrar eventos futuros, a menos que se filtre por un mes específico
        if (!month) {
            matchFilter.date = { $gte: todayString };
        }

        matchFilter.name = { $ne: null, $nin: ["", "N/A"] };

        // --- LÓGICA DE FILTRADO ---
        if (month) {
            matchFilter.date = { $regex: `^${month}` };
        } else if (search && !lat) {
            const normalizedSearch = search.trim().toLowerCase();
            matchFilter.$or = [
                { name: { $regex: new RegExp(search, 'i') } }, 
                { artist: { $regex: new RegExp(search, 'i') } },
                { city: { $regex: new RegExp(search, 'i') } }, 
                { venue: { $regex: new RegExp(search, 'i') } }
            ];
        }

        if (featured === 'true') {
            matchFilter.artist = { $in: featuredArtists };
        }
        if (artist) matchFilter.artist = { $regex: new RegExp(artist, 'i') };
        if (city) matchFilter.city = { $regex: new RegExp(city, 'i') };
        if (country) matchFilter.country = { $regex: new RegExp(`^${country}$`, 'i') };
        
        if (dateFrom) {
            if (!matchFilter.date) matchFilter.date = {};
            matchFilter.date.$gte = dateFrom;
        }
        if (dateTo) {
            if (!matchFilter.date) matchFilter.date = {};
            matchFilter.date.$lte = dateTo;
        }

        if (timeframe === 'week' && !dateTo) {
            const nextWeek = new Date(today);
            nextWeek.setDate(today.getDate() + 7);
            if (!matchFilter.date) matchFilter.date = {};
            matchFilter.date.$lte = nextWeek.toISOString().split('T')[0];
        }

        aggregationPipeline.push({ $match: matchFilter });
        
        // Agrupar para eliminar duplicados
        aggregationPipeline.push({ $group: { _id: { date: "$date", artist: "$artist", name: "$name" }, firstEvent: { $first: "$$ROOT" } } });
        aggregationPipeline.push({ $match: { firstEvent: { $ne: null } } });
        aggregationPipeline.push({ $replaceRoot: { newRoot: "$firstEvent" } });
        aggregationPipeline.push({ $addFields: { contentStatus: '$contentStatus', blogPostUrl: '$blogPostUrl' } });

        // Ordenación
        let sortOrder = { date: 1 };
        if (sort === 'date' && req.query.order === 'desc') sortOrder = { date: -1 };
        // No se puede ordenar por textScore cuando se usa $regex. Se usará el orden por defecto (fecha).
        // if (search && !lat) sortOrder = { score: { $meta: "textScore" } };
        if (!lat) aggregationPipeline.push({ $sort: sortOrder });

        // --- LÓGICA DE PAGINACIÓN ---
        const pageNum = parseInt(page, 10);
        const limitNum = parseInt(limit, 10);
        if (!isNaN(pageNum) && !isNaN(limitNum) && pageNum > 0 && limitNum > 0) {
            const skipNum = (pageNum - 1) * limitNum;
            if (skipNum > 0) {
                aggregationPipeline.push({ $skip: skipNum });
            }
            aggregationPipeline.push({ $limit: limitNum });
        }

        const events = await Event.aggregate(aggregationPipeline);

        res.setHeader('Cache-Control', 's-maxage=600, stale-while-revalidate=1800');
        res.status(200).json({ events, isAmbiguous: false });

    } catch (err) {
        console.error("Error en /api/events:", err);
        res.status(500).json({ error: "Internal Server Error", details: err.message });
    }
}