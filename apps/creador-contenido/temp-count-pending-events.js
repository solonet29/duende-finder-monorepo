// temp-count-pending-events.js
// OBJETIVO: Contar el número de eventos en un rango de fechas que no tienen contenido generado.

require('dotenv').config();
const { connectToDatabase, closeDatabaseConnection } = require('./lib/database.js');

async function countPendingEvents() {
    let db;
    try {
        db = await connectToDatabase();
        const eventsCollection = db.collection('events');

        // Definir el rango de fechas: últimas 3 semanas (como texto)
        const todayObj = new Date('2025-09-17T12:00:00.000Z');
        const threeWeeksAgoObj = new Date(todayObj);
        threeWeeksAgoObj.setDate(todayObj.getDate() - 21);

        const todayString = todayObj.toISOString().split('T')[0];
        const threeWeeksAgoString = threeWeeksAgoObj.toISOString().split('T')[0];

        const query = {
            date: { $gte: threeWeeksAgoString, $lte: todayString },
            contentStatus: { $ne: 'content_ready' }
        };

        console.log(`⚙️  Contando eventos entre ${threeWeeksAgoString} y ${todayString} que NO tienen estado 'content_ready'...`);

        const count = await eventsCollection.countDocuments(query);

        console.log(`\n✅ RESULTADO: Se encontraron ${count} eventos pendientes de generación de contenido.`);

    } catch (error) {
        console.error('❌ Error durante el conteo:', error);
    } finally {
        if (db) {
            await closeDatabaseConnection();
        }
    }
}

countPendingEvents();
