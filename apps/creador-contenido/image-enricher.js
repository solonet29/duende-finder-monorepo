// image-enricher.js - Módulo para generar y subir imágenes

require('dotenv').config();
const { createPostImage } = require('./lib/imageGenerator.js');
const { uploadImage } = require('./lib/wordpressClient.js');
const fs = require('fs').promises;
const sharp = require('sharp');
const path = require('path');

/**
 * Optimiza una imagen: la redimensiona, la convierte a WebP y la comprime.
 * @param {string} imagePath - La ruta de la imagen a optimizar.
 * @returns {Promise<string|null>} La ruta de la imagen optimizada o null si falla.
 */
async function optimizeImage(imagePath) {
    try {
        const optimizedPath = imagePath.replace(/\.png$/, '.webp');
        await sharp(imagePath)
            .resize({ width: 1024 })
            .webp({ quality: 80 })
            .toFile(optimizedPath);
        console.log(`      ✨ Imagen optimizada y convertida a WebP en: ${optimizedPath}`);
        return optimizedPath;
    } catch (error) {
        console.error(`      ❌ Error al optimizar la imagen ${imagePath}:`, error.message);
        return null;
    }
}

/**
 * Genera dos imágenes para un evento (una estándar y otra para redes sociales),
 * las optimiza, las sube a WordPress y limpia los ficheros temporales.
 * @param {object} event - El objeto del evento para el que se creará la imagen.
 * @returns {Promise<{imageId: number, imageUrl: string, socialImageId: number, socialImageUrl: string}|null>} Un objeto con los IDs y URLs de ambas imágenes, o null si falla.
 */
async function generateAndUploadImage(event) {
    console.log(`   -> 🖼️  Iniciando proceso de imagen para: "${event.name}".`);
    let standardImagePath = null;
    let optimizedStandardImagePath = null;
    let socialImagePath = null;
    let optimizedSocialImagePath = null;

    try {
        // --- IMAGEN ESTÁNDAR ---
        console.log("      -> Creando imagen estándar (1200x675)...");
        standardImagePath = await createPostImage(event); // Dimensiones por defecto
        if (!standardImagePath) throw new Error("La creación de la imagen estándar falló.");

        console.log("      -> Optimizando imagen estándar...");
        optimizedStandardImagePath = await optimizeImage(standardImagePath);
        if (!optimizedStandardImagePath) throw new Error("La optimización de la imagen estándar falló.");

        console.log("      -> Subiendo imagen estándar a WordPress...");
        const standardImageTitle = `${event.name} - ${event.city}`;
        const standardUploadResponse = await uploadImage(optimizedStandardImagePath, standardImageTitle, `image/${path.extname(optimizedStandardImagePath).substring(1)}`);
        if (!standardUploadResponse?.imageId || !standardUploadResponse?.imageUrl) {
            throw new Error("La subida de la imagen estándar a WordPress falló.");
        }
        console.log(`      ✅ Imagen estándar subida. ID: ${standardUploadResponse.imageId}`);

        // --- IMAGEN PARA REDES SOCIALES ---
        console.log("      -> Creando imagen para redes sociales (1200x630)...");
        socialImagePath = await createPostImage(event, { height: 630 }); // Proporción 1.91:1
        if (!socialImagePath) throw new Error("La creación de la imagen para redes sociales falló.");

        console.log("      -> Optimizando imagen para redes sociales...");
        optimizedSocialImagePath = await optimizeImage(socialImagePath);
        if (!optimizedSocialImagePath) throw new Error("La optimización de la imagen para redes sociales falló.");

        console.log("      -> Subiendo imagen para redes sociales a WordPress...");
        const socialImageTitle = `${event.name} - ${event.city} (Social Media)`;
        const socialUploadResponse = await uploadImage(optimizedSocialImagePath, socialImageTitle, `image/${path.extname(optimizedSocialImagePath).substring(1)}`);
        if (!socialUploadResponse?.imageId || !socialUploadResponse?.imageUrl) {
            throw new Error("La subida de la imagen para redes sociales a WordPress falló.");
        }
        console.log(`      ✅ Imagen para redes sociales subida. ID: ${socialUploadResponse.imageId}`);

        // --- Devolver todos los datos ---
        return {
            imageId: standardUploadResponse.imageId,
            imageUrl: standardUploadResponse.imageUrl,
            socialImageId: socialUploadResponse.imageId,
            socialImageUrl: socialUploadResponse.imageUrl
        };

    } catch (error) {
        console.error(`      ❌ Error en generateAndUploadImage para "${event.name}":`, error.message);
        return null;
    } finally {
        // --- Limpiar todas las imágenes temporales ---
        const cleanupPromises = [];
        if (standardImagePath) {
            cleanupPromises.push(fs.unlink(standardImagePath).catch(err => 
                console.error(`      ⚠️ Error al eliminar la imagen temporal estándar ${standardImagePath}:`, err.message)
            ));
        }
        if (optimizedStandardImagePath) {
            cleanupPromises.push(fs.unlink(optimizedStandardImagePath).catch(err => 
                console.error(`      ⚠️ Error al eliminar la imagen temporal estándar optimizada ${optimizedStandardImagePath}:`, err.message)
            ));
        }
        if (socialImagePath) {
            cleanupPromises.push(fs.unlink(socialImagePath).catch(err => 
                console.error(`      ⚠️ Error al eliminar la imagen temporal social ${socialImagePath}:`, err.message)
            ));
        }
        if (optimizedSocialImagePath) {
            cleanupPromises.push(fs.unlink(optimizedSocialImagePath).catch(err => 
                console.error(`      ⚠️ Error al eliminar la imagen temporal social optimizada ${optimizedSocialImagePath}:`, err.message)
            ));
        }
        await Promise.all(cleanupPromises);
        if (cleanupPromises.length > 0) {
            console.log(`      -> Imágenes temporales eliminadas.`);
        }
    }
}

module.exports = { generateAndUploadImage };