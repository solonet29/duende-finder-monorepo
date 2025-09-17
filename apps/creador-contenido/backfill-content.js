// backfill-content.js
// OBJETIVO: Procesar eventos de un rango de fechas pasado para asegurar que su contenido
// en WordPress esté actualizado con la nueva lógica (incluyendo el night_plan).

require('dotenv').config();
const { connectToDatabase, closeDatabaseConnection } = require('./lib/database.js');
const { publishToWordPress, updateWordPressPost } = require('./lib/wordpressClient.js');
const { generateContentForEvent } = require('./enrich-events.js');
const showdown = require('showdown');

const converter = new showdown.Converter();
const GENERATION_LIMIT = 10; // Límite de cuántos contenidos generar por ejecución

async function backfillPastEvents() {
    const db = await connectToDatabase();
    const eventsCollection = db.collection('events');
    let generationCounter = 0;

    // 1. Definir el rango de fechas: últimas 3 semanas (como texto)
    const todayObj = new Date();
    const threeWeeksAgoObj = new Date();
    threeWeeksAgoObj.setDate(todayObj.getDate() - 21);

    const todayString = todayObj.toISOString().split('T')[0];
    const threeWeeksAgoString = threeWeeksAgoObj.toISOString().split('T')[0];

    const query = {
        date: { $gte: threeWeeksAgoString, $lte: todayString }
    };

    console.log(`⚙️ Buscando eventos con fecha de TEXTO entre ${threeWeeksAgoString} y ${todayString} para sanear...`);

    const eventsToProcess = await eventsCollection.find(query).toArray();

    if (eventsToProcess.length === 0) {
        console.log('✅ No se encontraron eventos en el rango de fechas especificado.');
        return;
    }

    console.log(`   -> Se encontraron ${eventsToProcess.length} eventos para procesar.`);

    // 2. Procesar cada evento
    for (let event of eventsToProcess) {
        try {
            console.log(`
--- Procesando evento: "${event.name}" (ID: ${event._id}) ---`);

            // A. Generar contenido si es necesario, respetando el límite
            if (event.contentStatus !== 'content_ready') {
                if (generationCounter >= GENERATION_LIMIT) {
                    console.log(`   -> ⚠️ Límite de generación (${GENERATION_LIMIT}) alcanzado. Saltando la creación de contenido para este evento.`);
                    continue; // Saltar al siguiente evento
                }

                console.log(`   -> ✍️  El contenido no está listo. Generando... (${generationCounter + 1}/${GENERATION_LIMIT})`);
                event = await generateContentForEvent(event, db);
                generationCounter++;

                if (event.contentStatus === 'enrichment_failed') {
                    console.error(`   -> ❌ Falló la generación de contenido. Saltando este evento.`);
                    continue;
                }
                console.log(`   -> ✅ Contenido generado y listo.`);
            } else {
                console.log(`   -> ✅ El contenido ya estaba generado.`);
            }

            // B. Preparar el nuevo cuerpo del post
            const blogPostHtml = converter.makeHtml(event.blogPostMarkdown);
            const summaryHtml = converter.makeHtml(event.eventSummaryMarkdown);
            const nightPlanHtml = converter.makeHtml(event.nightPlanMarkdown);

            const postBody = `
                ${blogPostHtml}
                <hr>
                <h2>Detalles del Evento</h2>
                ${summaryHtml}
                <hr>
                <h2>Plan de Noche</h2>
                ${nightPlanHtml}
                <hr>
                <p><em>Descubre más detalles y eventos como este en nuestro <a href="https://nuevobuscador.afland.es/" target="_blank" rel="noopener noreferrer">buscador de flamenco</a>.</em></p>
            `;

            // C. Decidir si crear o actualizar en WordPress
            if (event.wordpressPostId) {
                // Actualizar post existente
                console.log(`   -> 🔄 Actualizando post existente en WordPress (Post ID: ${event.wordpressPostId})...`);
                const updateData = {
                    content: postBody,
                    title: event.blogPostTitle,
                    // Opcional: asegurar que la categoría y la imagen destacada son correctas
                    // categories: [config.WORDPRESS_EVENTS_CATEGORY_ID],
                    // featured_media: event.imageId 
                };
                await updateWordPressPost(event.wordpressPostId, updateData);
                console.log(`   -> ✅ Post actualizado.`);

            } else {
                // Crear nuevo post
                console.log(`   -> 🚀 Creando nuevo post en WordPress...`);
                const postData = {
                    title: event.blogPostTitle,
                    content: postBody,
                    status: 'publish', // Publicar inmediatamente por ser evento pasado
                    // categories: [config.WORDPRESS_EVENTS_CATEGORY_ID],
                    // featured_media: event.imageId
                };
                const wordpressResponse = await publishToWordPress(postData);

                // Guardar el nuevo ID en nuestra BBDD
                await eventsCollection.updateOne(
                    { _id: event._id },
                    { $set: { 
                        wordpressPostId: wordpressResponse.id, 
                        blogPostUrl: wordpressResponse.link,
                        contentStatus: 'published' 
                    }}
                );
                console.log(`   -> ✅ Nuevo post creado y enlazado (Post ID: ${wordpressResponse.id}).`);
            }

        } catch (error) {
            console.error(`   -> ❌ Error fatal procesando el evento "${event.name}":`, error.message);
        }
    }
}

// Permitir la ejecución directa del script
if (require.main === module) {
    console.log("Ejecutando el script de saneamiento de eventos pasados...");
    backfillPastEvents()
        .catch(err => {
            console.error("Ocurrió un error durante el proceso de backfill:", err);
            process.exit(1);
        })
        .finally(async () => {
            console.log("\nProceso de saneamiento finalizado.");
            await closeDatabaseConnection();
        });
}
