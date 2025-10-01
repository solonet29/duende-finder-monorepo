// distributor.js (Refactorizado como Módulo)
// OBJETIVO: Distribuir posts ya publicados en WordPress a redes sociales.

require('dotenv').config();
const dataProvider = require('./lib/data-provider');
const config = require('./config.js'); // Importar la configuración central
const { XClient } = require('./lib/xClient.js'); // --- NUEVO: Importar el cliente de X ---
const { RedditClient } = require('./lib/redditClient.js'); // Importar el cliente de Reddit

// ... (el resto de las funciones de publicaciÃ³n en redes sociales no cambian)

/**
 * Función principal del módulo.
 */
async function distributePosts() {
    const postsToDistribute = await dataProvider.getPostsToDistribute(config.DISTRIBUTE_BATCH_SIZE);

    if (postsToDistribute.length === 0) {
        console.log('✅ No hay posts nuevos para distribuir en redes sociales.');
        return;
    }

    console.log(`⚙️ Se encontraron ${postsToDistribute.length} posts para distribuir.`);

    for (const event of postsToDistribute) {
        console.log(`   -> Distribuyendo: "${event.blogPostTitle || (event.content && event.content.blogPostTitle)}"`);

        const eventId = event.id || event._id.toString();
        const title = event.blogPostTitle || (event.content && event.content.blogPostTitle);
        const url = event.blogPostUrl || (event.content && event.content.blogPostUrl);
        const imageUrl = event.featuredImageUrl || (event.content && event.content.imageUrl);

        if (!imageUrl) {
            console.warn(`   ⚠️ No se encontró URL de imagen destacada para "${event.name}". No se puede publicar en Pinterest.`);
        }

        // --- Bucle de publicación actualizado ---
        if (imageUrl) await publishToPinterest(imageUrl, title, url);
        await publishToReddit(title, url, imageUrl);
        await publishToX(title, url, imageUrl);

        await dataProvider.markPostAsDistributed(eventId);
        console.log(`   ✅ Evento '${event.name}' marcado como distribuido.`);
    }
}

module.exports = { distributePosts };