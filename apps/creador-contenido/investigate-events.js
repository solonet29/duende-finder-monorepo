// investigate-events.js
// OBJETIVO: Contar eventos futuros y ver cuántos tienen y no tienen un wordpressPostId.

require('dotenv').config();
const { connectToDatabase, closeDatabaseConnection } = require('./lib/database.js');

async function investigateEvents() {
    let db;
    try {
        db = await connectToDatabase();
        const eventsCollection = db.collection('events');

        const today = new Date();
        today.setUTCHours(0, 0, 0, 0);
        const todayString = today.toISOString().split('T')[0];

        console.log(`⚙️  Investigando eventos desde ${todayString} en adelante...`);

        // Query para todos los eventos futuros
        const futureEventsQuery = {
            date: { $gte: todayString }
        };

        const totalFutureEvents = await eventsCollection.countDocuments(futureEventsQuery);
        console.log(`  -> Total de eventos futuros encontrados: ${totalFutureEvents}`);

        // Query para eventos futuros que YA tienen un wordpressPostId
        const withWpIdQuery = {
            date: { $gte: todayString },
            wordpressPostId: { $exists: true }
        };

        const futureEventsWithWpId = await eventsCollection.countDocuments(withWpIdQuery);
        console.log(`  -> Eventos futuros que YA tienen un wordpressPostId: ${futureEventsWithWpId}`);

        // Query para eventos futuros que NO tienen un wordpressPostId
        const withoutWpIdQuery = {
            date: { $gte: todayString },
            wordpressPostId: { $exists: false }
        };

        const futureEventsWithoutWpId = await eventsCollection.countDocuments(withoutWpIdQuery);
        console.log(`  -> Eventos futuros que NO tienen un wordpressPostId: ${futureEventsWithoutWpId}`);


        if (futureEventsWithoutWpId === 0 && totalFutureEvents > 0) {
            console.log('\n🚨 ALERTA: Hay eventos futuros, pero todos tienen ya un wordpressPostId. El publicador no seleccionarÃ¡ ninguno.');
        } else if (totalFutureEvents === 0) {
            console.log('\n✅ No hay eventos futuros en la base de datos.');
        } else {
            console.log(`\n✅ Hay ${futureEventsWithoutWpId} evento(s) futuro(s) listos para ser publicados.`);
        }


    } catch (error) {
        console.error('❌ Error durante la investigaciÃ³n:', error);
    } finally {
        if (db) {
            await closeDatabaseConnection();
        }
    }
}

investigateEvents();
