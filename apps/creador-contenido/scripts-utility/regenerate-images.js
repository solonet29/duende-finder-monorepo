// regenerate-images.js
// OBJETIVO: Encontrar eventos que tengan una imagen placeholder y regenerarles una nueva imagen de evento.

require('dotenv').config({ path: '../../.env' });
const { connectToDatabase, closeDatabaseConnection } = require('../lib/database.js');
const { generateAndUploadImage } = require('../image-enricher.js');
const { ObjectId } = require('mongodb');

async function regenerateImages() {
    console.log('🚀 Iniciando script para regenerar imágenes placeholder...');
    const db = await connectToDatabase();
    const eventsCollection = db.collection('events');

    // Filtro para encontrar eventos que usan la imagen placeholder.
    const filter = { imageUrl: /flamenco-placeholder.png/ };

    const eventsToFix = await eventsCollection.find(filter).toArray();

    if (eventsToFix.length === 0) {
        console.log('✅ No se encontraron eventos con imágenes placeholder. No se necesita ninguna acción.');
        return;
    }

    console.log(`🔎 Se encontraron ${eventsToFix.length} eventos con imágenes placeholder para regenerar.`);

    for (const event of eventsToFix) {
        console.log(`
🛠️  Procesando evento: "${event.name}" (ID: ${event._id})`);
        try {
            // 1. Regenerar y subir la imagen.
            const imageData = await generateAndUploadImage(event);

            if (!imageData || !imageData.imageId || !imageData.imageUrl) {
                throw new Error('La regeneración de la imagen falló o no devolvió los datos esperados.');
            }

            // 2. Actualizar el evento en la base de datos con la nueva imagen.
            const updates = {
                imageId: imageData.imageId,
                imageUrl: imageData.imageUrl,
                // Opcional: cambiar el estado si es necesario para que sea reprocesado por otros sistemas.
                // status: 'content_ready' 
            };

            await eventsCollection.updateOne({ _id: new ObjectId(event._id) }, { $set: updates });

            console.log(`   ✨ ¡Éxito! Imagen regenerada y actualizada para "${event.name}". Nueva URL: ${imageData.imageUrl}`);

        } catch (error) {
            console.error(`   ❌ Error regenerando la imagen para "${event.name}":`, error.message);
            // Opcional: Marcar el evento con un estado de fallo específico si se desea.
            await eventsCollection.updateOne({ _id: new ObjectId(event._id) }, { $set: { status: 'image_regeneration_failed' } });
        }
    }
}

async function main() {
    try {
        await regenerateImages();
    } catch (error) {
        console.error('💥 Ocurrió un error crítico durante el proceso de regeneración de imágenes:', error);
    } finally {
        await closeDatabaseConnection();
    }
}

main();
