
// lib/data-provider.js
// Este mÃ³dulo actÃºa como un adaptador, proveyendo una interfaz unificada para acceder a los datos,
// ya sea desde la base de datos directa de MongoDB o desde la API de Payload CMS.

const config = require('../config');
const { ObjectId } = require('mongodb');

// Importa los mÃ³dulos de acceso a datos
const payloadAPI = require('./payload-api');
const { connectToDatabase, closeDatabaseConnection } = require('./database');

// --- ConexiÃ³n y DesconexiÃ³n ---

async function connect() {
    // La API de Payload no requiere una conexiÃ³n explÃ­cita, pero la de MongoDB sÃ­.
    if (!config.USE_PAYLOAD_CMS) {
        return await connectToDatabase();
    }
    // Si usamos Payload, no hacemos nada, pero mantenemos la funciÃ³n por consistencia.
    console.log("[DataProvider] Usando Payload CMS. No se requiere conexiÃ³n de base de datos explÃ­cita.");
    return Promise.resolve();
}

async function disconnect() {
    if (!config.USE_PAYLOAD_CMS) {
        await closeDatabaseConnection();
    }
    // Si usamos Payload, no hacemos nada.
    return Promise.resolve();
}

// --- LÃ³gica para MongoDB (adaptada de enrich-events.js) ---

async function getMongoEventsToEnrich(limit) {
    const db = await connectToDatabase();
    const eventsCollection = db.collection('events');
    const today = new Date();
    const todayString = today.toISOString().split('T')[0];

    const query = {
        contentStatus: { $in: ['pending_enrichment', 'pending', 'enrichment_failed'] },
        date: { $gte: todayString }
    };

    const events = await eventsCollection.find(query)
        .sort({ _id: -1 })
        .limit(limit)
        .toArray();
    console.log(`[DataProvider-Mongo] Encontrados ${events.length} eventos.`);
    return events;
}

async function updateMongoEventWithContent(eventId, contentPackage) {
    const db = await connectToDatabase();
    const eventsCollection = db.collection('events');
    const updates = {
        ...contentPackage,
        contentStatus: 'content_ready', // O el estado que corresponda
        contentGenerationDate: new Date(),
    };
    await eventsCollection.updateOne({ _id: new ObjectId(eventId) }, { $set: updates });
    console.log(`[DataProvider-Mongo] Evento ${eventId} actualizado.`);
    return await eventsCollection.findOne({ _id: new ObjectId(eventId) });
}

async function getMongoEventsToPublish(batchSize) {
    const db = await connectToDatabase();
    const eventsCollection = db.collection('events');
    let eventsToPublish = [];

    const todayObj = new Date();
    todayObj.setUTCHours(0, 0, 0, 0);
    const twoDaysFromNowObj = new Date(todayObj);
    twoDaysFromNowObj.setDate(todayObj.getDate() + 2);
    const fourDaysFromNowObj = new Date(todayObj);
    fourDaysFromNowObj.setDate(todayObj.getDate() + 4);
    const twoDaysFromNowString = twoDaysFromNowObj.toISOString().split('T')[0];
    const fourDaysFromNowString = fourDaysFromNowObj.toISOString().split('T')[0];

    const primaryQuery = {
        date: { $gte: twoDaysFromNowString, $lt: fourDaysFromNowString },
        wordpressPostId: { $exists: false },
    };
    const primaryEvents = await eventsCollection.find(primaryQuery).sort({ date: 1 }).limit(batchSize).toArray();
    eventsToPublish.push(...primaryEvents);

    if (eventsToPublish.length < batchSize) {
        const needed = batchSize - eventsToPublish.length;
        const fallbackQuery = {
            date: { $gte: fourDaysFromNowString },
            wordpressPostId: { $exists: false },
        };
        const fallbackEvents = await eventsCollection.find(fallbackQuery).sort({ date: 1 }).limit(needed).toArray();
        eventsToPublish.push(...fallbackEvents);
    }
    console.log(`[DataProvider-Mongo] Encontrados ${eventsToPublish.length} eventos para publicar.`);
    return eventsToPublish;
}

async function updateMongoEventAfterPublishing(eventId, updateData) {
    const db = await connectToDatabase();
    const eventsCollection = db.collection('events');
    await eventsCollection.updateOne({ _id: new ObjectId(eventId) }, { $set: updateData });
    console.log(`[DataProvider-Mongo] Evento ${eventId} actualizado tras publicaciÃ³n.`);
}

async function getMongoEventsForPostUpdate(batchSize) {
    const db = await connectToDatabase();
    const eventsCollection = db.collection('events');
    const query = {
        blogPostId: { $exists: true, $ne: null },
        imageId: { $exists: true, $ne: null },
        postImageUpdated: { $ne: true },
    };
    const events = await eventsCollection.find(query).limit(batchSize).toArray();
    console.log(`[DataProvider-Mongo] Encontrados ${events.length} eventos para actualizar imagen.`);
    return events;
}

async function markMongoPostAsImageUpdated(eventId) {
    const db = await connectToDatabase();
    const eventsCollection = db.collection('events');
    await eventsCollection.updateOne({ _id: new ObjectId(eventId) }, { $set: { postImageUpdated: true } });
    console.log(`[DataProvider-Mongo] Evento ${eventId} marcado como actualizado.`);
}

async function getMongoPostsToDistribute(batchSize) {
    const db = await connectToDatabase();
    const eventsCollection = db.collection('events');
    const query = {
        status: 'published',
        isDistributed: { $exists: false }
    };
    const posts = await eventsCollection.find(query).limit(batchSize).toArray();
    console.log(`[DataProvider-Mongo] Encontrados ${posts.length} posts para distribuir.`);
    return posts;
}

async function markMongoPostAsDistributed(eventId) {
    const db = await connectToDatabase();
    const eventsCollection = db.collection('events');
    await eventsCollection.updateOne({ _id: new ObjectId(eventId) }, { $set: { isDistributed: true } });
    console.log(`[DataProvider-Mongo] Evento ${eventId} marcado como distribuido.`);
}

// --- Interfaz PÃºblica del Proveedor de Datos ---

async function getEventsToEnrich(limit = 5) {
    if (config.USE_PAYLOAD_CMS) {
        return await payloadAPI.getEventsToEnrich(limit);
    } else {
        return await getMongoEventsToEnrich(limit);
    }
}

async function updateEventWithContent(eventId, contentPackage) {
    if (config.USE_PAYLOAD_CMS) {
        return await payloadAPI.updateEventWithContent(eventId, contentPackage);
    } else {
        return await updateMongoEventWithContent(eventId, contentPackage);
    }
}

async function getEventsToPublish(batchSize) {
    if (config.USE_PAYLOAD_CMS) {
        return await payloadAPI.getEventsToPublish(batchSize);
    } else {
        return await getMongoEventsToPublish(batchSize);
    }
}

async function updateEventAfterPublishing(eventId, updateData) {
    if (config.USE_PAYLOAD_CMS) {
        return await payloadAPI.updateEventAfterPublishing(eventId, updateData);
    } else {
        return await updateMongoEventAfterPublishing(eventId, updateData);
    }
}

async function getEventsForPostUpdate(batchSize) {
    if (config.USE_PAYLOAD_CMS) {
        return await payloadAPI.getEventsForPostUpdate(batchSize);
    } else {
        return await getMongoEventsForPostUpdate(batchSize);
    }
}

async function markPostAsImageUpdated(eventId) {
    if (config.USE_PAYLOAD_CMS) {
        return await payloadAPI.markPostAsImageUpdated(eventId);
    } else {
        return await markMongoPostAsImageUpdated(eventId);
    }
}

async function getPostsToDistribute(batchSize) {
    if (config.USE_PAYLOAD_CMS) {
        return await payloadAPI.getPostsToDistribute(batchSize);
    } else {
        return await getMongoPostsToDistribute(batchSize);
    }
}

async function markPostAsDistributed(eventId) {
    if (config.USE_PAYLOAD_CMS) {
        return await payloadAPI.markPostAsDistributed(eventId);
    } else {
        return await markMongoPostAsDistributed(eventId);
    }
}

module.exports = {
    connect,
    disconnect,
    getEventsToEnrich,
    updateEventWithContent,
    getEventsToPublish,
    updateEventAfterPublishing,
    getEventsForPostUpdate,
    markPostAsImageUpdated,
    getPostsToDistribute,
    markPostAsDistributed,
};
