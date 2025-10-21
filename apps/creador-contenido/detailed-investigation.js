// detailed-investigation.js
// OBJETIVO: Analizar en detalle el estado de los eventos que están listos para ser publicados.

require('dotenv').config();
const { connectToDatabase, closeDatabaseConnection } = require('./lib/database.js');

async function detailedInvestigation() {
    let db;
    try {
        db = await connectToDatabase();
        const eventsCollection = db.collection('events');

        const today = new Date();
        today.setUTCHours(0, 0, 0, 0);
        const todayString = today.toISOString().split('T')[0];

        console.log(`⚙️  Investigando en detalle los eventos listos para publicar (desde ${todayString})...`);

        // Query para eventos futuros que NO tienen un wordpressPostId
        const withoutWpIdQuery = {
            date: { $gte: todayString },
            wordpressPostId: { $exists: false }
        };

        // Limitamos a 20 para no inundar la consola
        const eventsToInvestigate = await eventsCollection.find(withoutWpIdQuery).sort({ date: 1 }).limit(20).toArray();

        if (eventsToInvestigate.length === 0) {
            console.log('\n✅ No se encontraron eventos pendientes de publicación.');
            return;
        }

        console.log(`\n🔎 Analizando una muestra de ${eventsToInvestigate.length} eventos pendientes:\n`);

        let problemCount = 0;
        eventsToInvestigate.forEach((event, index) => {
            const hasTitle = !!event.blogPostTitle;
            const hasImage = !!event.imageId;
            const status = event.contentStatus || 'undefined';

            console.log(`--- Evento ${index + 1} ---`);
            console.log(`  ID: ${event._id}`);
            console.log(`  Nombre: ${event.name}`);
            console.log(`  Fecha: ${event.date}`);
            console.log(`  Content Status: ${status}`);
            console.log(`  Tiene Título?: ${hasTitle}`);
            console.log(`  Tiene Imagen?: ${hasImage}`);

            if (status === 'content_ready' && (!hasTitle || !hasImage)) {
                console.log(`  🚨 PROBLEMA: El estado es 'content_ready' pero falta título o imagen.`);
                problemCount++;
            } else if (status !== 'content_ready') {
                 console.log(`  ℹ️ INFO: El estado es '${status}', se intentará generar contenido.`);
            } else {
                 console.log(`  ✅ OK: Parece estar listo para publicar.`);
            }
            console.log(''); // Newline for readability
        });

        if (problemCount > 0) {
            console.log(`\n🚨 RESUMEN: Se encontraron ${problemCount} eventos marcados como 'content_ready' pero incompletos.`);
            console.log("   Esto causaría un error 'Faltan datos críticos para publicar' en el script 'publish-content.js'.");
        } else {
            console.log("\n✅ RESUMEN: La muestra de eventos parece estar en un estado coherente para ser procesada.");
        }


    } catch (error) {
        console.error('❌ Error durante la investigación detallada:', error);
    } finally {
        if (db) {
            await closeDatabaseConnection();
        }
    }
}

detailedInvestigation();
