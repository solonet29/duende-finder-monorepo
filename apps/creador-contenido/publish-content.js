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

    console.log(`  -> Se encontraron ${eventsToPublish.length} eventos para procesar.`);

    // 2. Lógica para escalonar la publicación
    const scheduleBaseDate = new Date();
    scheduleBaseDate.setUTCHours(0, 0, 0, 0);
    const tomorrow = new Date(scheduleBaseDate);
    tomorrow.setDate(tomorrow.getDate() + 1);
    let publicationDate = new Date(tomorrow);
    publicationDate.setUTCHours(6, 0, 0, 0);
    const intervalMinutes = 90;

    // 3. Procesar y publicar cada evento del lote
    for (const event of eventsToPublish) {
        const eventId = event._id ? event._id.toString() : event.id;

        if (!eventId) {
            console.error(`  -> ??? CRÍTICO: Evento "${event.name}" no tiene un ID válido. Saltando...`);
            continue;
        }

        try {
            // --- CORRECCIÓN ---
            // Usamos una nueva variable para mantener el estado más reciente del evento.
            let currentEventData = event;

            // A. Generar contenido si es necesario
            if (currentEventData.contentStatus !== 'content_ready') {
                console.log(`  -> ✍️  El contenido para "${currentEventData.name}" no está listo. Generando...`);

                // --- CORRECCIÓN ---
                // Capturamos el resultado que ahora devuelve 'generateContentForEvent'.
                currentEventData = await generateContentForEvent(currentEventData);

                // --- CORRECCIÓN ---
                // Añadimos una comprobación de seguridad. Si el enriquecimiento falló, saltamos al siguiente evento.
                if (!currentEventData) {
                    console.error(`  -> ⏭️  El enriquecimiento para "${event.name}" falló. Saltando al siguiente evento.`);
                    continue; // Pasa al siguiente evento del bucle
                }
            }

            // --- CORRECCIÓN ---
            // A partir de aquí, usamos SIEMPRE 'currentEventData' para asegurar que tenemos los datos más frescos.
            // También hacemos el acceso a las propiedades anidadas más seguro.

            // B. Preparar el contenido del post
            const postBodyMarkdown = (currentEventData.blogPostMarkdown) ? currentEventData.blogPostMarkdown : '';
            const postBody = converter.makeHtml(postBodyMarkdown);

            // C. Preparar datos para WordPress
            const postData = {
                title: currentEventData.blogPostTitle,
                content: postBody,
                status: 'future',
                date: publicationDate.toISOString(),
                categories: [config.WORDPRESS_EVENTS_CATEGORY_ID],
                featured_media: currentEventData.imageId,
            };

            // Verificación de datos esenciales antes de publicar
            if (!postData.title || !postData.featured_media) {
                throw new Error(`Faltan datos críticos para publicar: Título o Imagen Destacada no encontrados para el evento ${eventId}.`);
            }

            console.log(`  -> 🗓️  Programando "${postData.title}" para las ${publicationDate.toISOString()}`);

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

            console.log(`  -> ✅ Post para "${currentEventData.name}" programado. URL: ${wordpressResponse.link}`);

            // Incrementar la fecha para el siguiente post
            publicationDate = new Date(publicationDate.getTime() + intervalMinutes * 60 * 1000);

        } catch (error) {
            console.error(`  -> ❌ Error publicando "${event.name}":`, error.message);
            try {
                console.log(`  -> 📝 Marcando "${event.name}" como 'publishing_failed'.`);
                await dataProvider.updateEventAfterPublishing(eventId, { contentStatus: 'publishing_failed' });
            } catch (updateError) {
                console.error(`  -> 🚨 CRÍTICO: Fallo al intentar marcar "${event.name}" como fallido.`, updateError.message);
            }
        }
    }
}

// Exportar la función principal para que el orquestador pueda usarla
module.exports = { publishPosts };

// Permitir la ejecución directa del script
if (require.main === module) {
    console.log("Ejecuting the WordPress publisher manually...");

    (async () => {
        try {
            await dataProvider.connect();
            await publishPosts();
        } catch (err) {
            console.error("An error occurred during manual publishing:", err);
            process.exit(1);
        } finally {
            await dataProvider.disconnect();
            console.log("Manual publishing process finished.");
        }
    })();
}