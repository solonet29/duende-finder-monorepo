// publish-content.js
// OBJETIVO: Tomar eventos con contenido listo y programarlos en WordPress de forma escalonada.

require('dotenv').config();
const { connectToDatabase } = require('./lib/database.js');
const { publishToWordPress } = require('./lib/wordpressClient.js');
const config = require('./config.js');

async function publishPosts() {
    const db = await connectToDatabase();
    const eventsCollection = db.collection('events');

    // 1. Buscar eventos con contenido listo para ser publicados.
    const query = {
        status: 'content_ready',
        wordpressPostId: { $exists: false }
    };

    // Publicar 12 al día. El workflow se ejecuta una vez al día.
    const BATCH_SIZE = 12; 
    const eventsToPublish = await eventsCollection.find(query).limit(BATCH_SIZE).toArray();

    if (eventsToPublish.length === 0) {
        console.log('✅ No hay contenido nuevo para programar en WordPress.');
        return;
    }

    console.log(`⚙️ Se encontraron ${eventsToPublish.length} eventos para programar en WordPress.`);

    // 2. Lógica para escalonar la publicación a lo largo del día.
    const now = new Date();
    // Empezar a publicar en 1 hora desde ahora para dar margen.
    let publicationDate = new Date(now.getTime() + 1 * 60 * 60 * 1000); 
    // Intervalo entre posts. Si son 12 posts en 24h, es uno cada 2 horas.
    const intervalHours = 2; 

    for (const event of eventsToPublish) {
        try {
            // Marcar el evento para evitar que otro proceso lo tome.
            await eventsCollection.updateOne({ _id: event._id }, { $set: { status: 'publishing' } });

            console.log(`   -> Programando: "${event.blogPostTitle}" para las ${publicationDate.toISOString()}`);

            // 3. Preparar los datos para WordPress.
            const postData = {
                title: event.blogPostTitle,
                content: event.blogPostHtml,
                status: 'future', // <-- CLAVE: Programar en lugar de publicar.
                date: publicationDate.toISOString(), // <-- CLAVE: Fecha de publicación futura.
                categories: [config.WORDPRESS_EVENTS_CATEGORY_ID],
                featured_media: event.imageId, // Usamos el ID de la imagen ya subida.
            };

            // 4. Publicar (programar) en WordPress.
            const wordpressResponse = await publishToWordPress(postData);

            // 5. Actualizar nuestro evento en la BBDD.
            await eventsCollection.updateOne(
                { _id: event._id },
                {
                    $set: {
                        status: 'published', // Marcado como finalizado en nuestro sistema.
                        wordpressPostId: wordpressResponse.id,
                        publicationDate: publicationDate,
                        blogPostUrl: wordpressResponse.link,
                    }
                }
            );

            console.log(`   ✅ Post para "${event.name}" programado. URL: ${wordpressResponse.link}`);

            // Incrementar la fecha para el siguiente post.
            publicationDate = new Date(publicationDate.getTime() + intervalHours * 60 * 60 * 1000);

        } catch (error) {
            console.error(`   ❌ Error programando "${event.name}":`, error.message);
            // Si algo falla, revertir el estado para que pueda ser reintentado en la siguiente ejecución.
            await eventsCollection.updateOne({ _id: event._id }, { $set: { status: 'content_ready' } });
        }
    }
}

// Exportar la función principal para que el orquestador pueda usarla
module.exports = { publishPosts };

// Permitir la ejecución directa del script
if (require.main === module) {
    console.log("Ejecutando el publicador de WordPress de forma manual...");
    publishPosts().finally(() => {
        // Asumimos que la conexión se gestiona dentro de los módulos o se cierra en el orquestador principal
        console.log("Proceso de publicación manual finalizado.");
    });
}
