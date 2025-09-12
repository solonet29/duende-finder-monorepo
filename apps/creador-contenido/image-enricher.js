// image-enricher.js - Módulo para generar y subir imágenes

require('dotenv').config();
const { createPostImage } = require('./lib/imageGenerator.js');
const { uploadImage } = require('./lib/wordpressClient.js');
const fs = require('fs').promises;

/**
 * Genera una imagen para un evento, la sube a WordPress y limpia el fichero temporal.
 * @param {object} event - El objeto del evento para el que se creará la imagen.
 * @returns {Promise<{imageId: number, imageUrl: string}|null>} Un objeto con el ID y la URL de la imagen en WordPress, o null si falla.
 */
async function generateAndUploadImage(event) {
    console.log(`   -> 🖼️  Iniciando proceso de imagen para: "${event.name}".`);
    let imagePath = null;
    try {
        // 1. Crear la imagen localmente
        console.log("      1/3: Creando imagen con Sharp...");
        imagePath = await createPostImage(event);
        if (!imagePath) throw new Error("La creación de la imagen falló.");

        // 2. Subir la imagen a WordPress
        console.log("      2/3: Subiendo imagen a WordPress...");
        const imageTitle = `${event.name} - ${event.city}`;
        const uploadResponse = await uploadImage(imagePath, imageTitle);
        if (!uploadResponse || !uploadResponse.imageId || !uploadResponse.imageUrl) {
            throw new Error("La subida a WordPress falló o no devolvió los datos correctos.");
        }
        console.log(`      ✅ Imagen subida con éxito. ID: ${uploadResponse.imageId}`);
        
        return {
            imageId: uploadResponse.imageId,
            imageUrl: uploadResponse.imageUrl
        };

    } catch (error) {
        console.error(`      ❌ Error en generateAndUploadImage para "${event.name}":`, error.message);
        return null; // Devolvemos null para indicar que el proceso de imagen falló
    } finally {
        // 3. Limpiar la imagen temporal
        if (imagePath) {
            try {
                await fs.unlink(imagePath);
                console.log(`      3/3: Imagen temporal eliminada.`);
            } catch (cleanupError) {
                console.error(`      ⚠️ Error al eliminar la imagen temporal ${imagePath}:`, cleanupError.message);
            }
        }
    }
}

module.exports = { generateAndUploadImage };
