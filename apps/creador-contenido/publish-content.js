// publish-content.js
// OBJETIVO: Tomar eventos con contenido listo y programarlos en WordPress de forma escalonada.

require('dotenv').config({ path: '../../.env' });
const { connectToDatabase, closeDatabaseConnection } = require('./lib/database.js');
const { publishToWordPress } = require('./lib/wordpressClient.js');
const config = require('./config.js');

async function publishPosts() {
    const db = await connectToDatabase();
    const eventsCollection = db.collection('events');

    // 1. Buscar eventos con contenido listo para ser publicados.
    const query = {
        contentStatus: 'content_ready',
        wordpressPostId: { $exists: false }
    };

    // Usar el tamaño de lote desde el fichero de configuración.
    const BATCH_SIZE = config.PUBLISH_BATCH_SIZE;
    const eventsToPublish = await eventsCollection.find(query).limit(BATCH_SIZE).toArray();

    if (eventsToPublish.length === 0) {
        console.log('✅ No hay contenido nuevo para programar en WordPress.');
        return;
    }

    console.log(`⚙️ Se encontraron ${eventsToPublish.length} eventos para programar en WordPress.`);

    // 2. Lógica para escalonar la publicación a lo largo del día.
    // El primer post se programa para el día siguiente a las 6:00 AM UTC.
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    let publicationDate = new Date(tomorrow);
    publicationDate.setUTCHours(6, 0, 0, 0);

    // Intervalo de 90 minutos (1.5 horas) entre posts.
    const intervalMinutes = 90;

    for (const event of eventsToPublish) {
        try {
            // Marcar el evento para evitar que otro proceso lo tome.
            await eventsCollection.updateOne({ _id: event._id }, { $set: { contentStatus: 'publishing' } });

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
                        contentStatus: 'published', // Marcado como finalizado en nuestro sistema.
                        wordpressPostId: wordpressResponse.id,
                        publicationDate: publicationDate,
                        blogPostUrl: wordpressResponse.link,
                    }
                }
            );

            console.log(`   ✅ Post para "${event.name}" programado. URL: ${wordpressResponse.link}`);

            // Incrementar la fecha para el siguiente post.
            publicationDate = new Date(publicationDate.getTime() + intervalMinutes * 60 * 1000);

        } catch (error) {
            console.error(`   ❌ Error programando "${event.name}":`, error.message);
            // Si algo falla, revertir el estado para que pueda ser reintentado en la siguiente ejecución.
            await eventsCollection.updateOne({ _id: event._id }, { $set: { contentStatus: 'content_ready' } });
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