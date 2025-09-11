// find-event-by-name.js
// OBJETIVO: Encontrar un evento específico por su nombre y mostrar sus datos.

require('dotenv').config({ path: '../../.env' });
const { connectToDatabase, closeDatabaseConnection } = require('../lib/database.js');

const EVENT_NAME_TO_FIND = "Homenaje a La Perla de Cádiz";

async function findEvent() {
    console.log(`🚀 Buscando el evento: "${EVENT_NAME_TO_FIND}"...`);
    const db = await connectToDatabase();
    const eventsCollection = db.collection('events');

    // Usamos una expresión regular para ser más flexibles con la búsqueda.
    const filter = { name: { $regex: new RegExp(EVENT_NAME_TO_FIND, "i") } };

    const event = await eventsCollection.findOne(filter);

    if (!event) {
        console.log(`❌ No se encontró ningún evento con el nombre "${EVENT_NAME_TO_FIND}".`);
        return;
    }

    console.log('✅ ¡Evento encontrado! Aquí están sus datos:');
    console.log(JSON.stringify(event, null, 2));
}

async function main() {
    try {
        await findEvent();
    } catch (error) {
        console.error('💥 Ocurrió un error crítico durante la búsqueda:', error);
    } finally {
        await closeDatabaseConnection();
    }
}

main();
