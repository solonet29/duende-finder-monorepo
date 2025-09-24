// RUTA: /src/pages/api/events/index.js
// VERSIÓN FINAL DE PRODUCCIÓN CON CORS A NUEVO BUSCADOR
// AÑADIDA LÓGICA DE PAGINACIÓN PARA SCROLL INFINITO

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
        const paises = [
            'Japón', 'China', 'Corea del Sur', 'Alemania', 'EEUU', 'Reino Unido', 'Suecia', 'España', 'Francia', 'Italia', 'Portugal', 'Países Bajos', 'Bélgica', 'Austria', 'Bulgaria', 'Croacia', 'Chipre', 'República Checa', 'Dinamarca', 'Estonia', 'Finlandia', 'Grecia', 'Hungría', 'Irlanda', 'Letonia', 'Lituania', 'Luxemburgo', 'Malta', 'Polonia', 'Rumanía', 'Eslovaquia', 'Eslovenia', 'Suiza', 'Noruega', 'Argentina'
        ];
        const ciudadesYProvincias = [
            'Sevilla', 'Málaga', 'Granada', 'Cádiz', 'Ceuta', 'Córdoba', 'Huelva', 'Jaén', 'Almería', 'Madrid', 'Barcelona', 'Valencia', 'Murcia', 'Alicante', 'Bilbao', 'Zaragoza', 'Jerez', 'Úbeda', 'Baeza', 'Ronda', 'Estepona', 'Lebrija', 'Morón de la Frontera', 'Utrera', 'Algeciras', 'Cartagena', 'Logroño', 'Santander', 'Vitoria', 'Pamplona', 'Vigo', 'A Coruña', 'Oviedo', 'Gijón', 'León', 'Salamanca', 'Valladolid', 'Burgos', 'Cáceres', 'Badajoz', 'Toledo', 'Cuenca', 'Guadalajara', 'Albacete'
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
        matchFilter.date = { $gte: todayString };

        matchFilter.name = { $ne: null, $nin: ["", "N/A"] };

        // --- LÓGICA DE FILTRADO ---
        if (month) {
            // Si se pide un mes específico (para scroll infinito), este filtro es prioritario
            matchFilter.date = { $regex: `^${month}` };
        } else if (search && !lat) {
            const normalizedSearch = search.trim().toLowerCase();
            if (ciudadesYProvincias.some(cp => cp.toLowerCase() === normalizedSearch)) {
                matchFilter.city = { $regex: new RegExp(`^${normalizedSearch}, 'i') };
            } else if (paises.some(p => p.toLowerCase().includes(normalizedSearch))) {
                matchFilter.country = { $regex: new RegExp(`^${normalizedSearch}, 'i') };
            } else {
                matchFilter.$or = [
                    { name: { $regex: new RegExp(search, 'i') } }, { artist: { $regex: new RegExp(search, 'i') } },
                    { city: { $regex: new RegExp(search, 'i') } }, { venue: { $regex: new RegExp(search, 'i') } }
                ];
            }
        }

        if (featured === 'true') {
            matchFilter.artist = { $in: featuredArtists };
        }
        if (artist) matchFilter.artist = { $regex: new RegExp(artist, 'i') };
        if (city) matchFilter.city = { $regex: new RegExp(city, 'i') };
        if (country) matchFilter.country = { $regex: new RegExp(`^${country}, 'i') };
        if (dateFrom) matchFilter.date.$gte = dateFrom;
        if (dateTo) matchFilter.date.$lte = dateTo;
        if (timeframe === 'week' && !dateTo) {
            const nextWeek = new Date(today);
            nextWeek.setDate(today.getDate() + 7);
            matchFilter.date.$lte = nextWeek.toISOString().split('T')[0];
        }

        aggregationPipeline.push({ $match: matchFilter });
        aggregationPipeline.push({ $group: { _id: { date: "$date", artist: "$artist", name: "$name" }, firstEvent: { $first: "$ROOT" } } });
        aggregationPipeline.push({ $match: { firstEvent: { $ne: null } } }); // FIX: Filter out null events
        aggregationPipeline.push({ $replaceRoot: { newRoot: "$firstEvent" } });
        aggregationPipeline.push({ $addFields: { contentStatus: '$contentStatus', blogPostUrl: '$blogPostUrl' } });

        let sortOrder = { date: 1 };
        if (sort === 'date' && req.query.order === 'desc') sortOrder = { date: -1 };
        if (search && !lat) sortOrder = { score: { $meta: "textScore" } };
        if (!lat) aggregationPipeline.push({ $sort: sortOrder });

        // --- LÓGICA DE PAGINACIÓN (NUEVO) ---
        if (month) {
            const pageNum = parseInt(page, 10);
            const limitNum = parseInt(limit, 10);
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