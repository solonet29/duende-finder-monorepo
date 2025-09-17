// publish-content.js
// OBJETIVO: Seleccionar eventos futuros, generarles contenido si no lo tienen, y publicarlos como posts individuales en WordPress.

require('dotenv').config();
const { connectToDatabase, closeDatabaseConnection } = require('./lib/database.js');
const { publishToWordPress } = require('./lib/wordpressClient.js');
const { generateContentForEvent } = require('./enrich-events.js'); // <-- Importamos la función de enriquecimiento
const config = require('./config.js');
const showdown = require('showdown');

const converter = new showdown.Converter();

async function publishPosts() {
    const db = await connectToDatabase();
    const eventsCollection = db.collection('events');

    // 1. Lógica de selección de eventos con fallback
    console.log('⚙️ Buscando eventos para publicar...');
    const batchSize = config.PUBLISH_BATCH_SIZE;
    let eventsToPublish = [];

    // Fechas para las consultas (convertidas a string YYYY-MM-DD)
    const todayObj = new Date();
    todayObj.setUTCHours(0, 0, 0, 0);

    const twoDaysFromNowObj = new Date(todayObj);
    twoDaysFromNowObj.setDate(todayObj.getDate() + 2);
    const fourDaysFromNowObj = new Date(todayObj);
    fourDaysFromNowObj.setDate(todayObj.getDate() + 4);

    const twoDaysFromNowString = twoDaysFromNowObj.toISOString().split('T')[0];
    const fourDaysFromNowString = fourDaysFromNowObj.toISOString().split('T')[0];

    // Búsqueda Primaria: Eventos en 2-3 días
    const primaryQuery = {
        date: { $gte: twoDaysFromNowString, $lt: fourDaysFromNowString },
        wordpressPostId: { $exists: false },
    };
    const primaryEvents = await eventsCollection.find(primaryQuery).sort({ date: 1 }).limit(batchSize).toArray();
    eventsToPublish.push(...primaryEvents);

    // Búsqueda de Fallback: Si no llenamos el lote, buscar en el futuro
    if (eventsToPublish.length < batchSize) {
        const needed = batchSize - eventsToPublish.length;
        const fallbackQuery = {
            date: { $gte: fourDaysFromNowString },
            wordpressPostId: { $exists: false },
        };
        const fallbackEvents = await eventsCollection.find(fallbackQuery).sort({ date: 1 }).limit(needed).toArray();
        eventsToPublish.push(...fallbackEvents);
    }

    if (eventsToPublish.length === 0) {
        console.log('✅ No hay eventos nuevos para publicar hoy.');
        return;
    }

    console.log(`   -> Se encontraron ${eventsToPublish.length} eventos para procesar.`);

    // 2. Lógica para escalonar la publicación
    const scheduleBaseDate = new Date();
    scheduleBaseDate.setUTCHours(0, 0, 0, 0);
    const tomorrow = new Date(scheduleBaseDate);
    tomorrow.setDate(tomorrow.getDate() + 1);
    let publicationDate = new Date(tomorrow);
    publicationDate.setUTCHours(6, 0, 0, 0);
    const intervalMinutes = 90;

    // 3. Procesar y publicar cada evento del lote
    for (let event of eventsToPublish) {
        try {
            // A. Generar contenido si es necesario
            if (event.contentStatus !== 'content_ready') {
                console.log(`   -> ✍️  El contenido para "${event.name}" no está listo. Generando...`);
                event = await generateContentForEvent(event, db);

                if (event.contentStatus === 'enrichment_failed') {
                    console.error(`   -> ❌ Falló la generación de contenido para "${event.name}". Saltando este evento.`);
                    continue; // Saltar al siguiente evento del lote
                }
                console.log(`   -> ✅ Contenido generado para "${event.name}".`);
            }

            // B. Preparar el nuevo contenido del post
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

            // C. Preparar datos para WordPress
            const postData = {
                title: event.blogPostTitle,
                content: postBody,
                status: 'future',
                date: publicationDate.toISOString(),
                categories: [config.WORDPRESS_EVENTS_CATEGORY_ID],
                featured_media: event.imageId,
            };

            console.log(`   -> 🗓️  Programando "${postData.title}" para las ${publicationDate.toISOString()}`);

            // D. Publicar en WordPress
            const wordpressResponse = await publishToWordPress(postData);

            // E. Actualizar nuestro evento en la BBDD
            await eventsCollection.updateOne(
                { _id: event._id },
                {
                    $set: {
                        contentStatus: 'published',
                        wordpressPostId: wordpressResponse.id,
                        publicationDate: publicationDate,
                        blogPostUrl: wordpressResponse.link,
                    }
                }
            );

            console.log(`   -> ✅ Post para "${event.name}" programado. URL: ${wordpressResponse.link}`);

            // Incrementar la fecha para el siguiente post
            publicationDate = new Date(publicationDate.getTime() + intervalMinutes * 60 * 1000);

        } catch (error) {
            console.error(`   -> ❌ Error fatal publicando "${event.name}":`, error.message);
            // Opcional: Marcar como 'publishing_failed' si se quiere evitar reintentos inmediatos
            await eventsCollection.updateOne({ _id: event._id }, { $set: { contentStatus: 'publishing_failed' } });
        }
    }
}

// Exportar la función principal para que el orquestador pueda usarla
module.exports = { publishPosts };

// Permitir la ejecución directa del script
if (require.main === module) {
    console.log("Ejecutando el publicador de WordPress de forma manual...");
    publishPosts()
        .catch(err => {
            console.error("Ocurrió un error durante la publicación manual:", err);
            process.exit(1); // Salir con código de error para que el runner falle.
        })
        .finally(async () => {
            console.log("Proceso de publicación manual finalizado.");
            await closeDatabaseConnection(); // <-- CLAVE: Cerrar la conexión.
        });
}