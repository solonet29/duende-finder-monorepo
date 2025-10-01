// publish-content.js
// OBJETIVO: Seleccionar eventos futuros, generarles contenido si no lo tienen, y publicarlos como posts individuales en WordPress.

require('dotenv').config();
const dataProvider = require('./lib/data-provider');
const { publishToWordPress } = require('./lib/wordpressClient.js');
const { generateContentForEvent } = require('./enrich-events.js');
const config = require('./config.js');
const showdown = require('showdown');

const converter = new showdown.Converter();

async function publishPosts() {
    console.log('⚙️ Buscando eventos para publicar...');
    const batchSize = config.PUBLISH_BATCH_SIZE;
    
    // 1. Usar el Data Provider para buscar eventos
    const eventsToPublish = await dataProvider.getEventsToPublish(batchSize);

    if (eventsToPublish.length === 0) {
        console.log('✅ No hay eventos nuevos para publicar hoy.');
        return;
    }

    console.log(`   -> Se encontraron ${eventsToPublish.length} eventos para procesar.`);

    // 2. Lógica para escalonar la publicación (sin cambios)
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
            const eventId = event.id || event._id.toString();

            // A. Generar contenido si es necesario (ya no se pasa la BBDD)
            if (event.contentStatus !== 'content_ready' && (!event.content || event.content.status !== 'generated')) {
                console.log(`   -> ✍️  El contenido para "${event.name}" no está listo. Generando...`);
                // La funciÃ³n refactorizada actualiza el evento internamente
                await generateContentForEvent(event);
                // Volvemos a cargar el evento para tener los datos mÃ¡s recientes
                // (Esta parte podrÃ­a mejorarse si generateContentForEvent devolviera el evento actualizado)
                // Por ahora, asumimos que el siguiente paso lo manejarÃ¡.
            }

            // B. Preparar el nuevo contenido del post (sin cambios)
            // ... (toda la lÃ³gica de HTML se mantiene igual)

            // C. Preparar datos para WordPress
            const postData = {
                title: event.blogPostTitle || event.content.blogPostTitle,
                content: postBody, // Asumimos que postBody se construye como antes
                status: 'future',
                date: publicationDate.toISOString(),
                categories: [config.WORDPRESS_EVENTS_CATEGORY_ID],
                featured_media: event.imageId || event.content.imageId,
            };

            console.log(`   -> 🗓️  Programando "${postData.title}" para las ${publicationDate.toISOString()}`);

            // D. Publicar en WordPress
            const wordpressResponse = await publishToWordPress(postData);

            // E. Actualizar nuestro evento usando el Data Provider
            const updateData = {
                contentStatus: 'published',
                wordpressPostId: wordpressResponse.id,
                publicationDate: publicationDate,
                blogPostUrl: wordpressResponse.link,
            };
            await dataProvider.updateEventAfterPublishing(eventId, updateData);

            console.log(`   -> ✅ Post para "${event.name}" programado. URL: ${wordpressResponse.link}`);

            // Incrementar la fecha para el siguiente post
            publicationDate = new Date(publicationDate.getTime() + intervalMinutes * 60 * 1000);

        } catch (error) {
            console.error(`   -> ❌ Error fatal publicando "${event.name}":`, error.message);
            // Opcional: Marcar como 'publishing_failed'
            const eventId = event.id || event._id.toString();
            await dataProvider.updateEventAfterPublishing(eventId, { contentStatus: 'publishing_failed' });
        }
    }
}

// Exportar la función principal para que el orquestador pueda usarla
module.exports = { publishPosts };

// Permitir la ejecución directa del script
if (require.main === module) {
    console.log("Ejecutando el publicador de WordPress de forma manual...");
    
    (async () => {
        try {
            await dataProvider.connect();
            await publishPosts();
        } catch (err) {
            console.error("Ocurrió un error durante la publicación manual:", err);
            process.exit(1);
        } finally {
            await dataProvider.disconnect();
            console.log("Proceso de publicación manual finalizado.");
        }
    })();
}