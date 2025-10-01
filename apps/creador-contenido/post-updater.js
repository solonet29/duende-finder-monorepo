// post-updater.js

require('dotenv').config();
const dataProvider = require('./lib/data-provider');
const { updateWordPressPost } = require('./lib/wordpressClient.js');

// --- CONFIGURACIÓN ---
const BATCH_SIZE = 50;

async function updatePosts() {
    console.log("--- 🔄 INICIANDO ACTUALIZADOR DE POSTS ---");

    try {
        await dataProvider.connect();

        console.log("🔎 Buscando eventos con posts y nuevas imágenes...");
        const eventsToUpdate = await dataProvider.getEventsForPostUpdate(BATCH_SIZE);

        if (eventsToUpdate.length === 0) {
            console.log("✅ No se encontraron posts para actualizar. ¡Trabajo hecho!");
            return;
        }

        console.log(`⚙️ Se encontraron ${eventsToUpdate.length} posts para procesar en este lote.`);

        for (const event of eventsToUpdate) {
            console.log(`\n-----------------------------------------------------`);
            console.log(`🖼️ Actualizando post para el evento: "${event.name}"`);

            try {
                const eventId = event.id || event._id.toString();
                const imageId = event.imageId || (event.content && event.content.imageId);
                const postId = event.wordpressPostId;

                if (!postId || !imageId) {
                    console.log(` ⚠️  Faltan datos clave (postId o imageId) para "${event.name}". Saltando.`);
                    continue;
                }

                const updateData = {
                    featured_media: imageId
                };

                const result = await updateWordPressPost(postId, updateData);

                if (result) {
                    console.log(` ✅ Post actualizado en WordPress con éxito.`);
                    await dataProvider.markPostAsImageUpdated(eventId);
                    console.log(` ✅ Estado del evento actualizado en el origen de datos.`);
                }
            } catch (error) {
                console.error(` ❌ Error al procesar el post de "${event.name}":`, error.message);
            }
        }

    } catch (error) {
        console.error("Ha ocurrido un error fatal durante la actualización de posts:", error);
    } finally {
        await dataProvider.disconnect();
        console.log("\n--- ✨ PROCESO DE ACTUALIZACIÓN FINALIZADO ---");
    }
}

updatePosts();