// lib/payload-api.js
const axios = require('axios');

const PAYLOAD_API_URL = process.env.PAYLOAD_API_URL;
const PAYLOAD_API_KEY = process.env.PAYLOAD_API_KEY;

if (process.env.USE_PAYLOAD_CMS === 'true' && (!PAYLOAD_API_URL || !PAYLOAD_API_KEY)) {
    throw new Error('Para usar Payload CMS, necesita definir PAYLOAD_API_URL y PAYLOAD_API_KEY en su archivo .env');
}

const api = axios.create({
    baseURL: PAYLOAD_API_URL,
    headers: {
        'Authorization': `users API-Key ${PAYLOAD_API_KEY}`,
    },
});

async function getEvents(queryParams) {
    const { 
        search, artist, city, country, dateFrom, dateTo, 
        timeframe, month, page = 1, limit = 10, sort = '-date' 
    } = queryParams;

    const where = { and: [] };
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Por defecto, solo eventos futuros si no hay filtro de mes
    if (!month) {
        where.and.push({ date: { gte: today.toISOString() } });
    }

    if (month) {
        const year = parseInt(month.split('-')[0]);
        const monthIndex = parseInt(month.split('-')[1]) - 1;
        const startDate = new Date(Date.UTC(year, monthIndex, 1));
        const endDate = new Date(Date.UTC(year, monthIndex + 1, 0, 23, 59, 59, 999));
        where.and.push({ date: { gte: startDate.toISOString() } });
        where.and.push({ date: { lte: endDate.toISOString() } });
    } else if (search) {
        where.and.push({
            or: [
                { name: { like: search } },
                { artist: { like: search } },
                { city: { like: search } },
                { venue: { like: search } },
            ]
        });
    }

    if (artist) where.and.push({ artist: { like: artist } });
    if (city) where.and.push({ city: { like: city } });
    if (country) where.and.push({ country: { equals: country } }); // Asumiendo que paÃ­s es un match exacto

    if (dateFrom) {
        where.and.push({ date: { gte: new Date(dateFrom).toISOString() } });
    }
    if (dateTo) {
        where.and.push({ date: { lte: new Date(dateTo).toISOString() } });
    }

    if (timeframe === 'today') {
        const endOfDay = new Date(today);
        endOfDay.setHours(23, 59, 59, 999);
        where.and.push({ date: { lte: endOfDay.toISOString() } });
    } else if (timeframe === 'week' && !dateTo) {
        const nextWeek = new Date(today);
        nextWeek.setDate(today.getDate() + 7);
        where.and.push({ date: { lte: nextWeek.toISOString() } });
    }

    try {
        const params = {
            where,
            limit,
            page,
            sort,
        };
        const response = await api.get('/api/events', { params });
        // Devolvemos un objeto que simula la respuesta de una agregaciÃ³n de Mongoose
        return { events: response.data.docs }; 
    } catch (error) {
        console.error('Error fetching events from Payload:', error.response ? error.response.data : error.message);
        throw new Error('Failed to fetch events from Payload');
    }
}

async function getEventById(id) {
    try {
        const response = await api.get(`/api/events/${id}`);
        return response.data;
    } catch (error) {
        console.error(`Error fetching event ${id} from Payload:`, error.response ? error.response.data : error.message);
        throw new Error(`Failed to fetch event ${id} from Payload`);
    }
}

module.exports = {
    getEvents,
    getEventById,
};
