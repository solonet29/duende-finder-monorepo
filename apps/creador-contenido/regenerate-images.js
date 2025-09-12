// regenerate-images.js
// OBJETIVO: Script de único uso para encontrar eventos con imágenes placeholder y regenerarlas.

require('dotenv').config();
const { connectToDatabase, closeDatabaseConnection } = require('./lib/database.js');
const { generateAndUploadImage } = require('./image-enricher.js');
const { ObjectId } = require('mongodb');

async function regenerateAllPlaceholderImages() {
    console.log('🚀 Iniciando script para regenerar imágenes placeholder...');
    const db = await connectToDatabase();
    const eventsCollection = db.collection('events');

    // Criterio de búsqueda ampliado:
    // Busca eventos donde la imageUrl...
    // 1. No existe.
    // 2. Es nula o una cadena vacía.
    // 3. O no es una URL de WordPress válida.
    const query = {
        $or: [
            { imageUrl: { $exists: false } },
            { imageUrl: null },
            { imageUrl: '' },
            { imageUrl: { $not: /\/wp-content\/uploads\// } }
        ]
    };

    try {
        const eventsToFix = await eventsCollection.find(query).toArray();

        if (eventsToFix.length === 0) {
            console.log('✅ No se encontraron eventos con imágenes placeholder para regenerar.');
            return;
        }

        console.log(`🔍 Se encontraron ${eventsToFix.length} eventos para corregir.`);

        for (const event of eventsToFix) {
            console.log(`
Processing event: "${event.name}" (ID: ${event._id})`);
            try {
                // 1. Generar y subir la nueva imagen
                const imageData = await generateAndUploadImage(event);

                if (imageData && imageData.imageUrl && imageData.imageId) {
                    // 2. Actualizar el evento en la base de datos
                    const updateResult = await eventsCollection.updateOne(
                        { _id: new ObjectId(event._id) },
                        {
                            $set: {
                                imageUrl: imageData.imageUrl,
                                imageId: imageData.imageId
                            }
                        }
                    );

                    if (updateResult.modifiedCount > 0) {
                        console.log(`✅ Evento "${event.name}" actualizado con la nueva imagen.`);
                    } else {
                        console.warn(`⚠️ No se pudo actualizar el evento "${event.name}".`);
                    }
                } else {
                    throw new Error('generateAndUploadImage no devolvió datos de imagen válidos.');
                }
            } catch (error) {
                console.error(`❌ Error procesando el evento "${event.name}":`, error.message);
                // Opcional: Marcar el evento como fallido para revisión manual
                await eventsCollection.updateOne(
                    { _id: new ObjectId(event._id) },
                    { $set: { status: 'image_regeneration_failed' } }
                );
            }
        }
    } catch (error) {
        console.error('❌ Error fatal durante la ejecución del script:', error);
    } finally {
        await closeDatabaseConnection();
        console.log('\n🏁 Proceso de regeneración de imágenes finalizado.');
    }
}

regenerateAllPlaceholderImages();
