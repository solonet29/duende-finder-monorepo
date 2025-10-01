// lib/payload-api.js
const axios = require('axios');

const PAYLOAD_API_URL = process.env.PAYLOAD_API_URL;
const PAYLOAD_API_KEY = process.env.PAYLOAD_API_KEY;

// No lanzamos error si no estÃ¡n definidas, para poder operar con la DB antigua.
if (process.env.USE_PAYLOAD_CMS === 'true' && (!PAYLOAD_API_URL || !PAYLOAD_API_KEY)) {
    throw new Error('Para usar Payload CMS, necesita definir PAYLOAD_API_URL y PAYLOAD_API_KEY en su archivo .env');
}

const api = axios.create({
    baseURL: PAYLOAD_API_URL,
    headers: {
        'Authorization': `users API-Key ${PAYLOAD_API_KEY}`,
    },
});

async function getEventsToEnrich(limit = 5) {
    try {
        console.log(`[PayloadAPI] Buscando hasta ${limit} eventos para enriquecer...`);
        const response = await api.get('/api/events', {
            params: {
                where: {
                    and: [
                        {
                            status: {
                                equals: 'published',
                            },
                        },
                        {
                            'content.status': {
                                equals: 'pending',
                            },
                        },
                    ],
                },
                limit: limit,
                sort: '-date', // Priorizar eventos recientes
            },
        });

        const events = response.data.docs || [];
        console.log(`[PayloadAPI] Encontrados ${events.length} eventos.`);
        return events;
    } catch (error) {
        const errorMessage = error.response ? JSON.stringify(error.response.data, null, 2) : error.message;
        console.error('Error buscando eventos para enriquecer en Payload:', errorMessage);
        return [];
    }
}

async function updateEventWithContent(eventId, contentPackage) {
    try {
        console.log(`[PayloadAPI] Actualizando evento ${eventId} con nuevo contenido...`);
        const response = await api.patch(`/api/events/${eventId}`, {
            content: {
                ...contentPackage,
                status: 'generated',
                generatedAt: new Date().toISOString(),
            },
        });
        console.log(`[PayloadAPI] Evento ${eventId} actualizado correctamente.`);
        return response.data;
    } catch (error) {
        const errorMessage = error.response ? JSON.stringify(error.response.data, null, 2) : error.message;
        console.error(`Error actualizando evento ${eventId} en Payload:`, errorMessage);
        throw error;
    }
}

async function getEventsToPublish(batchSize) {
    console.log(`[PayloadAPI] Buscando hasta ${batchSize} eventos para publicar...`);
    const todayObj = new Date();
    todayObj.setUTCHours(0, 0, 0, 0);
    const twoDaysFromNowObj = new Date(todayObj);
    twoDaysFromNowObj.setDate(todayObj.getDate() + 2);
    const fourDaysFromNowObj = new Date(todayObj);
    fourDaysFromNowObj.setDate(todayObj.getDate() + 4);

    const twoDaysFromNowISO = twoDaysFromNowObj.toISOString();
    const fourDaysFromNowISO = fourDaysFromNowObj.toISOString();

    let eventsToPublish = [];

    try {
        // BÃºsqueda Primaria
        const primaryResponse = await api.get('/api/events', {
            params: {
                where: {
                    and: [
                        { date: { gte: twoDaysFromNowISO } },
                        { date: { lt: fourDaysFromNowISO } },
                        { wordpressPostId: { exists: false } },
                    ],
                },
                sort: 'date',
                limit: batchSize,
            },
        });
        eventsToPublish.push(...(primaryResponse.data.docs || []));

        // BÃºsqueda de Fallback
        if (eventsToPublish.length < batchSize) {
            const needed = batchSize - eventsToPublish.length;
            const fallbackResponse = await api.get('/api/events', {
                params: {
                    where: {
                        and: [
                            { date: { gte: fourDaysFromNowISO } },
                            { wordpressPostId: { exists: false } },
                        ],
                    },
                    sort: 'date',
                    limit: needed,
                },
            });
            eventsToPublish.push(...(fallbackResponse.data.docs || []));
        }

        console.log(`[PayloadAPI] Encontrados ${eventsToPublish.length} eventos para publicar.`);
        return eventsToPublish;
    } catch (error) {
        const errorMessage = error.response ? JSON.stringify(error.response.data, null, 2) : error.message;
        console.error('Error buscando eventos para publicar en Payload:', errorMessage);
        return [];
    }
}

async function updateEventAfterPublishing(eventId, updateData) {
    try {
        console.log(`[PayloadAPI] Actualizando evento ${eventId} tras publicaciÃ³n...`);
        const response = await api.patch(`/api/events/${eventId}`, updateData);
        console.log(`[PayloadAPI] Evento ${eventId} actualizado.`);
        return response.data;
    } catch (error) {
        const errorMessage = error.response ? JSON.stringify(error.response.data, null, 2) : error.message;
        console.error(`Error actualizando evento ${eventId} en Payload tras publicaciÃ³n:`, errorMessage);
        throw error;
    }
}

async function getEventsForPostUpdate(batchSize) {
    console.log(`[PayloadAPI] Buscando hasta ${batchSize} eventos para actualizar imagen del post...`);
    try {
        const response = await api.get('/api/events', {
            params: {
                where: {
                    and: [
                        { wordpressPostId: { exists: true } },
                        { 'content.imageId': { exists: true } },
                        { postImageUpdated: { not_equals: true } }, // Opcional: para no re-actualizar
                    ],
                },
                limit: batchSize,
            },
        });
        const events = response.data.docs || [];
        console.log(`[PayloadAPI] Encontrados ${events.length} eventos para actualizar imagen.`);
        return events;
    } catch (error) {
        const errorMessage = error.response ? JSON.stringify(error.response.data, null, 2) : error.message;
        console.error('Error buscando eventos para actualizar imagen en Payload:', errorMessage);
        return [];
    }
}

async function markPostAsImageUpdated(eventId) {
    try {
        console.log(`[PayloadAPI] Marcando evento ${eventId} como actualizado...`);
        const response = await api.patch(`/api/events/${eventId}`, { postImageUpdated: true });
        console.log(`[PayloadAPI] Evento ${eventId} marcado como actualizado.`);
        return response.data;
    } catch (error) {
        const errorMessage = error.response ? JSON.stringify(error.response.data, null, 2) : error.message;
        console.error(`Error marcando evento ${eventId} como actualizado en Payload:`, errorMessage);
        throw error;
    }
}

async function getPostsToDistribute(batchSize) {
    console.log(`[PayloadAPI] Buscando hasta ${batchSize} posts para distribuir...`);
    try {
        const response = await api.get('/api/events', {
            params: {
                where: {
                    and: [
                        { status: { equals: 'published' } },
                        { isDistributed: { not_equals: true } },
                    ],
                },
                limit: batchSize,
            },
        });
        const events = response.data.docs || [];
        console.log(`[PayloadAPI] Encontrados ${events.length} posts para distribuir.`);
        return events;
    } catch (error) {
        const errorMessage = error.response ? JSON.stringify(error.response.data, null, 2) : error.message;
        console.error('Error buscando posts para distribuir en Payload:', errorMessage);
        return [];
    }
}

async function markPostAsDistributed(eventId) {
    try {
        console.log(`[PayloadAPI] Marcando evento ${eventId} como distribuido...`);
        const response = await api.patch(`/api/events/${eventId}`, { isDistributed: true });
        console.log(`[PayloadAPI] Evento ${eventId} marcado como distribuido.`);
        return response.data;
    } catch (error) {
        const errorMessage = error.response ? JSON.stringify(error.response.data, null, 2) : error.message;
        console.error(`Error marcando evento ${eventId} como distribuido en Payload:`, errorMessage);
        throw error;
    }
}

module.exports = {
    getEventsToEnrich,
    updateEventWithContent,
    getEventsToPublish,
    updateEventAfterPublishing,
    getEventsForPostUpdate,
    markPostAsImageUpdated,
    getPostsToDistribute,
    markPostAsDistributed,
};
