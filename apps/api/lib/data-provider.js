// lib/data-provider.js
const config = require('../config');
const payloadAPI = require('./payload-api');
const { getEventModel, connectToMainDb } = require('./database');
const { ObjectId } = require('mongodb');

// FunciÃ³n para la lÃ³gica de agregaciÃ³n de MongoDB (movida desde la ruta de la API)
async function getMongoAggregatedEvents(queryParams) {
    const Event = await getEventModel();
    const {
        search = null, artist = null, city = null, country = null,
        dateFrom = null, dateTo = null, timeframe = null, lat = null,
        lon = null, radius = null, sort = null, featured = null,
        featured_events = null,
        month = null, page = '1', limit = '10'
    } = queryParams;

    let aggregationPipeline = [];

    // ... (toda la lÃ³gica de agregaciÃ³n de MongoDB que estaba en la API va aquÃ­)
    // ... (geoNear, matchFilter, addFields, sort, skip, limit)

    const events = await Event.aggregate(aggregationPipeline);
    return { events }; // Devolvemos un objeto consistente
}

// FunciÃ³n principal del proveedor de datos
async function getAggregatedEvents(queryParams) {
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
            const normalizedSearch = search.trim().toLowerCase();
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
        if (country) matchFilter.country = { $regex: new RegExp(`^${country}// lib/data-provider.js
const config = require('../config');
const payloadAPI = require('./payload-api');
const { getEventModel } = require('./database');

// FunciÃ³n para la lÃ³gica de agregaciÃ³n de MongoDB (movida desde la ruta de la API)
async function getMongoAggregatedEvents(queryParams) {
    const Event = await getEventModel();
    const {
        search = null, artist = null, city = null, country = null,
        dateFrom = null, dateTo = null, timeframe = null, lat = null,
        lon = null, radius = null, sort = null, featured = null,
        featured_events = null,
        month = null, page = '1', limit = '10'
    } = queryParams;

    let aggregationPipeline = [];

    // ... (toda la lÃ³gica de agregaciÃ³n de MongoDB que estaba en la API va aquÃ­)
    // ... (geoNear, matchFilter, addFields, sort, skip, limit)

    const events = await Event.aggregate(aggregationPipeline);
    return { events }; // Devolvemos un objeto consistente
}

// FunciÃ³n principal del proveedor de datos
, 'i') };

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
        
        let sortOrder = { verificationSort: 1, eventDate: 1 };
        if (sort === 'date' && queryParams.order === 'desc') {
            sortOrder = { eventDate: -1 };
        } else if (sort === 'createdAt') {
            sortOrder = { createdAt: -1 };
        }
        if (!lat) {
            aggregationPipeline.push({ $sort: sortOrder });
        }

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

// ... (la funciÃ³n getAggregatedEvents se mantiene igual)

async function getEventById(id) {
    if (config.USE_PAYLOAD_CMS) {
        console.log(`[DataProvider] Usando Payload CMS para buscar el evento ${id}.`);
        return await payloadAPI.getEventById(id);
    } else {
        console.log(`[DataProvider] Usando MongoDB para buscar el evento ${id}.`);
        if (!ObjectId.isValid(id)) {
            return null; // O lanzar un error, segÃºn el manejo deseado
        }
        const db = await connectToMainDb();
        const eventsCollection = db.collection("events");
        const event = await eventsCollection.findOne({ _id: new ObjectId(id) });
        return event;
    }
}

module.exports = { getAggregatedEvents, getEventById };