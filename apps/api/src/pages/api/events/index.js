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
            featured_events = null,
            month = null, // Param para paginación de meses
            page = '1',     // Param para paginación de meses
            limit = '10'   // Param para paginación de meses
        } = req.query;

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

        // Por defecto, solo mostrar eventos futuros, a menos que se filtre por un mes específico
        if (!month) {
            matchFilter.date = { $gte: today };
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
            matchFilter.featured = true;
        }
        if (featured_events === 'true') {
            matchFilter.artist = { $exists: true, $ne: null, $ne: "" };
        }
        if (artist) matchFilter.artist = { $regex: new RegExp(artist, 'i') };
        if (city) matchFilter.city = { $regex: new RegExp(city, 'i') };
        if (country) matchFilter.country = { $regex: new RegExp(`^${country}$`, 'i') };

        if (dateFrom) {
            if (!matchFilter.date) matchFilter.date = {};
            matchFilter.date.$gte = new Date(dateFrom);
        }
        if (dateTo) {
            if (!matchFilter.date) matchFilter.date = {};
            const endDate = new Date(dateTo);
            endDate.setHours(23, 59, 59, 999);
            matchFilter.date.$lte = endDate;
        }

        if (timeframe === 'today') {
            const endOfDay = new Date(today);
            endOfDay.setHours(23, 59, 59, 999);
            if (!matchFilter.date) matchFilter.date = {};
            matchFilter.date.$lte = endOfDay;
        } else if (timeframe === 'week' && !dateTo) {
            const nextWeek = new Date(today);
            nextWeek.setDate(today.getDate() + 7);
            if (!matchFilter.date) matchFilter.date = {};
            matchFilter.date.$lte = nextWeek;
        }

        aggregationPipeline.push({ $match: matchFilter });

        // Add a field for sorting by verification status for all queries
        aggregationPipeline.push({
            $addFields: {
                verificationSort: {
                    $switch: {
                        branches: [
                            { case: { $eq: ["$verificationStatus", "verified"] }, then: 1 },
                            { case: { $eq: ["$verificationStatus", "pending"] }, then: 2 },
                        ],
                        default: 3 // 'failed' and others
                    }
                }
            }
        });
        
        // Agrupar para eliminar duplicados
        aggregationPipeline.push({ $group: { _id: { date: "$date", artist: "$artist", name: "$name" }, firstEvent: { $first: "$ROOT" } } });
        aggregationPipeline.push({ $match: { firstEvent: { $ne: null } } });
        aggregationPipeline.push({ $replaceRoot: { newRoot: "$firstEvent" } });


        // Ordenación
        // Default sort: prioritize verified events, then by date
        let sortOrder = { verificationSort: 1, eventDate: 1 }; 

        if (sort === 'date' && req.query.order === 'desc') {
            sortOrder = { eventDate: -1 };
        } else if (sort === 'createdAt') {
            sortOrder = { createdAt: -1 };
        }
        
        // The 'Cerca de Mí' (nearby) query uses $geoNear and doesn't need this sort
        if (!lat) {
            aggregationPipeline.push({ $sort: sortOrder });
        }

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
