// apps/api/src/lib/data-provider.js

const config = require('../config');
const payloadAPI = require('./payload-api');
const { getEventModel } = require('./database');
const { ObjectId } = require('mongodb');

/**
 * Obtiene eventos agregados, ya sea desde Payload CMS o MongoDB,
 * dependiendo de la variable de entorno USE_PAYLOAD_CMS.
 * @param {object} queryParams - Parámetros de la consulta para filtrar y paginar.
 * @returns {Promise<object>} - Un objeto que contiene el array de eventos.
 */
async function getAggregatedEvents(queryParams) {
    // Usamos el Feature Flag para decidir qué fuente de datos usar
    if (config.USE_PAYLOAD_CMS) {
        console.log("[DataProvider] Usando Payload CMS para buscar eventos.");
        return await payloadAPI.getEvents(queryParams);
    } else {
        console.log("[DataProvider] Usando MongoDB para buscar eventos.");
        const Event = await getEventModel();
        const {
            search = null, artist = null, city = null, country = null,
            dateFrom = null, dateTo = null, timeframe = null, lat = null,
            lon = null, radius = null, sort = null, featured = null,
            featured_events = null,
            month = null, page = '1', limit = '10'
        } = queryParams;

        let aggregationPipeline = [];

        // Etapa de geolocalización si se proveen coordenadas
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

        // Construcción del filtro de búsqueda ($match)
        const matchFilter = {};
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        if (!month) {
            matchFilter.eventDate = { $gte: today };
        }
        matchFilter.name = { $ne: null, $nin: ["", "N/A"] };

        if (month) {
            const year = parseInt(month.split('-')[0]);
            const monthIndex = parseInt(month.split('-')[1]) - 1;
            const startDate = new Date(Date.UTC(year, monthIndex, 1));
            const endDate = new Date(Date.UTC(year, monthIndex + 1, 1));
            endDate.setUTCMilliseconds(-1);
            matchFilter.eventDate = { $gte: startDate, $lte: endDate };
        } else if (search && !lat) {
            matchFilter.$or = [
                { name: { $regex: new RegExp(search, 'i') } },
                { artist: { $regex: new RegExp(search, 'i') } },
                { city: { $regex: new RegExp(search, 'i') } },
                { venue: { $regex: new RegExp(search, 'i') } }
            ];
        }

        if (featured === 'true') matchFilter.featured = true;
        if (featured_events === 'true') matchFilter.artist = { $exists: true, $ne: null, $ne: "" };
        if (artist) matchFilter.artist = { $regex: new RegExp(artist, 'i') };
        if (city) matchFilter.city = { $regex: new RegExp(city, 'i') };

        // --- ESTA ES LA LÍNEA QUE ESTABA ROTA ---
        if (country) matchFilter.country = { $regex: new RegExp(`^${country}`, 'i') };
        // -----------------------------------------

        if (dateFrom) {
            if (!matchFilter.eventDate) matchFilter.eventDate = {};
            matchFilter.eventDate.$gte = new Date(dateFrom);
        }
        if (dateTo) {
            if (!matchFilter.eventDate) matchFilter.eventDate = {};
            const endDate = new Date(dateTo);
            endDate.setHours(23, 59, 59, 999);
            matchFilter.eventDate.$lte = endDate;
        }

        if (timeframe === 'today') {
            const endOfDay = new Date(today);
            endOfDay.setHours(23, 59, 59, 999);
            if (!matchFilter.eventDate) matchFilter.eventDate = {};
            matchFilter.eventDate.$lte = endOfDay;
        }

        aggregationPipeline.push({ $match: matchFilter });

        // Añadir campo para ordenar por estado de verificación
        aggregationPipeline.push({
            $addFields: {
                verificationSort: {
                    $switch: {
                        branches: [
                            { case: { $eq: ["$verificationStatus", "verified"] }, then: 1 },
                            { case: { $eq: ["$verificationStatus", "pending"] }, then: 2 },
                        ],
                        default: 3
                    }
                }
            }
        });

        // Ordenamiento
        let sortOrder = { verificationSort: 1, eventDate: 1 };
        if (sort === 'date' && queryParams.order === 'desc') {
            sortOrder = { eventDate: -1 };
        } else if (sort === 'createdAt') {
            sortOrder = { createdAt: -1 };
        }
        if (!lat) {
            aggregationPipeline.push({ $sort: sortOrder });
        }

        // Paginación
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
        return { events };
    }
}

/**
 * Obtiene un evento por su ID.
 * @param {string} id - El ID del evento a buscar.
 * @returns {Promise<object|null>} - El evento encontrado o null.
 */
async function getEventById(id) {
    if (config.USE_PAYLOAD_CMS) {
        console.log(`[DataProvider] Usando Payload CMS para buscar el evento ${id}.`);
        return await payloadAPI.getEventById(id);
    } else {
        console.log(`[DataProvider] Usando MongoDB para buscar el evento ${id}.`);
        if (!ObjectId.isValid(id)) {
            return null;
        }
        const Event = await getEventModel();
        const event = await Event.findOne({ _id: new ObjectId(id) });
        return event;
    }
}

module.exports = { getAggregatedEvents, getEventById };