// update-existing-posts.js
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });
const { connectToDatabase } = require('../lib/database.js');
const { getPost, updateWordPressPost } = require('../lib/wordpressClient.js');
const { ObjectId } = require('mongodb');

// --- FUNCIÓN PARA CREAR BANNERS ---
// Acepta la configuración de banners obtenida de la API.
function createBannersHtml(bannerConfig) {
    // Decidimos aleatoriamente cuál de los dos banners mostrar.
    const bannerToShow = Math.random() < 0.5 ? 1 : 2;

    const imageUrl = bannerToShow === 1 ? bannerConfig.post_banner_1_imageUrl : bannerConfig.post_banner_2_imageUrl;
    const linkUrl = bannerToShow === 1 ? bannerConfig.post_banner_1_linkUrl : bannerConfig.post_banner_2_linkUrl;

    // Si la URL de la imagen seleccionada no existe, no devolvemos nada.
    if (!imageUrl) return '';

    return `
        <div class="banner-container" style="text-align: center; margin: 30px 0;">
            <a href="${linkUrl || '#'}" target="_blank" rel="noopener noreferrer">
                <img src="${imageUrl}" alt="Publicidad de AFland" style="max-width: 100%; height: auto;" />
            </a>
        </div>
    `;
}

// --- QUERY DE MONGODB ---
// Busca TODOS los posts que tienen una referencia en WordPress.
const QUERY = {
    wordpressPostId: { $exists: true, $ne: null }
};

async function updatePostBanners() {
    console.log("--- 🚀 INICIANDO ACTUALIZACIÓN DE BANNERS EN POSTS PUBLICADOS ---");

    try {
        const db = await connectToDatabase();
        const eventsCollection = db.collection('events');

        // 1. Obtener la configuración de los banners desde la API
        console.log("📡 Obteniendo configuración de banners desde la API...");
        // const apiResponse = await fetch('https://api-v2.afland.es/api/config');
        // if (!apiResponse.ok) throw new Error(`No se pudo obtener la configuración de la API. Status: ${apiResponse.status}`);
        // const bannerConfig = await apiResponse.json();
        const bannerConfig = {
            post_banners_enabled: true,
            post_banner_1_imageUrl: "https://afland.es/wp-content/uploads/2025/10/IMG_0814.webp",
            post_banner_1_linkUrl: "http://www.turismohuelva.org/inicio//",
            post_banner_2_imageUrl: "https://afland.es/wp-content/uploads/2025/10/Cabecera-revolut-afiliados.png",
            post_banner_2_linkUrl: "https://revolut.com/referral/?referral-code=piconasus!OCT1-25-AR-CH1H-CRY&geo-redirect"
        };
        console.log("... Usando configuración de banners local temporalmente.");

        if (!bannerConfig.post_banners_enabled) {
            console.log("🟡 Los banners en posts están desactivados en la configuración. No se realizarán cambios.");
            return;
        }

        const eventsToProcess = await eventsCollection.find(QUERY).toArray();

        if (eventsToProcess.length === 0) {
            console.log("✅ No se encontraron posts para actualizar. ¡Trabajo completado!");
            return;
        }

        console.log(`⚙️ Se encontraron ${eventsToProcess.length} posts para actualizar sus banners.`);

        for (const event of eventsToProcess) {
            console.log(`\n-----------------------------------------------------`);
            console.log(`🖼️  Procesando banners para: "${event.name || event.blogPostTitle}" (WP ID: ${event.wordpressPostId})`);

            try {
                const wordpressPost = await getPost(event.wordpressPostId);

                if (!wordpressPost) {
                    console.warn(`   ⚠️ No se pudo encontrar el post con ID ${event.wordpressPostId}. Omitiendo.`);
                    continue;
                }

                let originalContent = wordpressPost.content.rendered;

                // 1. Usar una expresión regular para encontrar y eliminar cualquier rastro de banners anteriores.
                const bannerRegex = /<div[^>]*class="banner-container"[^>]*>[\s\S]*?<\/div>/g;
                let contentWithoutOldBanners = originalContent.replace(bannerRegex, '').trim();

                // 2. Añadir el bloque de banners actualizado al final del contenido.
                // Se genera un banner aleatorio para CADA post.
                const updatedContent = contentWithoutOldBanners + createBannersHtml(bannerConfig);

                // 3. Actualizar el post en WordPress.
                await updateWordPressPost(event.wordpressPostId, { content: updatedContent });

                // 4. Marcar el evento en nuestra base de datos.
                await eventsCollection.updateOne(
                    { _id: new ObjectId(event._id) },
                    { $set: { bannersUpdated: true, bannersUpdateDate: new Date() } }
                );

                console.log(`   ✅ Post ${event.wordpressPostId} actualizado en WordPress con los nuevos banners.`);

            } catch (error) {
                console.error(`   ❌ Error actualizando el post "${event.name}":`, error.message);
            }
        }

    } catch (error) {
        console.error("Ha ocurrido un error fatal:", error);
    } finally {
        console.log("\n--- ✨ PROCESO FINALIZADO ---");
        process.exit(0);
    }
}

updatePostBanners();