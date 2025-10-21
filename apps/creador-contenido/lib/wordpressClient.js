// lib/wordpressClient.js

const axios = require('axios');
const fs = require('fs');
const path = require('path');
const FormData = require('form-data');

const WP_URL = process.env.WORDPRESS_URL;
const WP_USER = process.env.WORDPRESS_USER;
const WP_PASSWORD = process.env.WORDPRESS_APP_PASSWORD;
const BOT_USER_AGENT = 'DuendeFinder-ContentBot/1.0';

if (!WP_URL || !WP_USER || !WP_PASSWORD) {
    throw new Error('Faltan variables de entorno de WordPress.');
}

const wpAuth = Buffer.from(`${WP_USER}:${WP_PASSWORD}`).toString('base64');
const authHeaders = { 'Authorization': `Basic ${wpAuth}` };

/**
 * Sube una imagen a la Biblioteca de Medios de WordPress.
 * @param {string} imagePath - La ruta local al archivo de imagen.
 * @param {string} title - El título que se le dará a la imagen en WordPress.
 * @param {string} [mimeType] - El tipo MIME del fichero (ej. 'image/webp'). Si no se provee, se infiere.
 * @returns {Promise<object|null>} Un objeto con imageId y imageUrl si la subida fue exitosa, o null en caso de error.
 */
async function uploadImage(imagePath, title, mimeType = null) {
    if (!imagePath || !fs.existsSync(imagePath)) {
        console.error(`⚠️ La imagen no existe en la ruta: ${imagePath}`);
        return null;
    }
    const endpoint = `${WP_URL}/wp-json/wp/v2/media`;

    try {
        const fileBuffer = fs.readFileSync(imagePath);
        const filename = path.basename(imagePath);
        const form = new FormData();
        
        const fileOptions = { filename };
        if (mimeType) {
            fileOptions.contentType = mimeType;
        }

        form.append('file', fileBuffer, fileOptions);
        if (title) form.append('title', title);

        const response = await axios.post(endpoint, form, {
            headers: { ...authHeaders, 'User-Agent': BOT_USER_AGENT, ...form.getHeaders() },
            timeout: 60000
        });

        if (response.status === 201 && response.data) {
            console.log(`✅ Imagen subida con éxito. ID: ${response.data.id}`);
            return {
                imageId: response.data.id,
                imageUrl: response.data.source_url
            };
        } else {
            console.error('❌ Error al subir la imagen:', response.statusText);
            return null;
        }

    } catch (error) {
        console.error('❌ Error al subir la imagen a WordPress:', error.response?.data?.message || error.message);
        return null;
    }
}

/**
 * Publica un nuevo post en WordPress.
 * @param {object} postData - El objeto con los datos del post (title, content, etc.).
 * @returns {Promise<object>} - La respuesta de la API de WordPress.
 */
async function publishToWordPress(postData) {
    const endpoint = `${WP_URL}/wp-json/wp/v2/posts`;
    try {
        console.log(`🚀 Enviando post a WordPress titulado: "${postData.title}"`);
        console.log(`   -> Endpoint: ${endpoint}`);
        console.log(`   -> Iniciando llamada a axios.post...`);

        const response = await axios.post(endpoint, postData, {
            headers: { ...authHeaders, 'Content-Type': 'application/json', 'User-Agent': BOT_USER_AGENT },
            timeout: 45000
        });

        console.log(`   -> Llamada a axios.post finalizada. Estado: ${response.status}`);

        if (response && response.data && response.data.link) {
            console.log(`✅ Post programado con éxito. URL: ${response.data.link}`);
            return response.data;
        } else {
            console.error('❌ Error: La respuesta de WordPress no fue la esperada.');
            console.error('   -> Respuesta recibida:', JSON.stringify(response.data, null, 2));
            throw new Error('Respuesta inválida de WordPress al publicar.');
        }

    } catch (error) {
        console.error('❌ Error al publicar en WordPress:', error.response?.data?.message || error.message);
        if (error.code === 'ECONNABORTED') {
            console.error('   -> La petición ha superado el tiempo de espera (timeout).');
        }
        throw error;
    }
}

/**
 * Actualiza un post existente en WordPress.
 * @param {number|string} postId - El ID del post a actualizar.
 * @param {object} updateData - Objeto con los campos a actualizar (ej. content, featured_media).
 * @returns {Promise<object>} - La respuesta de la API de WordPress.
 */
async function updateWordPressPost(postId, updateData) {
    const endpoint = `${WP_URL}/wp-json/wp/v2/posts/${postId}`;
    console.log(`🔄 Actualizando post en WordPress con ID: ${postId}`);
    try {
        const response = await axios.post(endpoint, updateData, {
            headers: { ...authHeaders, 'Content-Type': 'application/json', 'User-Agent': BOT_USER_AGENT },
            timeout: 45000
        });
        console.log(`✅ Post ID ${postId} actualizado con éxito. URL: ${response.data.link}`);
        return response.data;
    } catch (error) {
        console.error(`❌ Error al actualizar el post ID ${postId}:`, error.response?.data?.message || error.message);
        throw new Error('La actualización en WordPress ha fallado.');
    }
}
/**
 * Obtiene un post de WordPress por su ID.
 * @param {number|string} postId - El ID del post a obtener.
 * @returns {Promise<object>} - El objeto del post de la API de WordPress.
 */
async function getPost(postId) {
    const endpoint = `${WP_URL}/wp-json/wp/v2/posts/${postId}`;
    console.log(`🔎 Obteniendo post de WordPress con ID: ${postId}`);
    try {
        const response = await axios.get(endpoint, {
            headers: { 'User-Agent': BOT_USER_AGENT, ...authHeaders },
            timeout: 15000
        });

        if (response.status === 200) {
            console.log(`✅ Post ID ${postId} obtenido con éxito.`);
            return response.data;
        } else {
            console.error(`❌ Error al obtener el post ID ${postId}:`, response.statusText);
            return null;
        }
    } catch (error) {
        console.error(`❌ Error al obtener el post ID ${postId}:`, error.response?.data?.message || error.message);
        throw new Error('La obtención del post ha fallado.');
    }
}
/**
 * Elimina un post de WordPress de forma permanente.
 * @param {number} postId - El ID del post a eliminar.
 * @returns {Promise<object>} - La respuesta de la API de WordPress.
 */
async function deleteWordPressPost(postId) {
    if (!postId) {
        throw new Error('Se requiere un ID de post para eliminar.');
    }

    const endpoint = `${WP_URL}/wp-json/wp/v2/posts/${postId}?force=true`;
    console.log(`🗑️ Intentando eliminar el post con ID: ${postId}`);

    try {
        const response = await axios.delete(endpoint, {
            headers: { ...authHeaders, 'User-Agent': BOT_USER_AGENT }
        });

        console.log(`✅ Post ID ${postId} eliminado con éxito.`);
        return response.data;
    } catch (error) {
        console.error(`❌ Error al eliminar el post ID ${postId}:`, error.response?.data?.message || error.message);
        throw new Error('La eliminación en WordPress ha fallado.');
    }
}
// Añade esta función a tu archivo lib/wordpressClient.js
// ... (código anterior)

/**
 * Busca una imagen en la Biblioteca de Medios de WordPress por su título.
 * @param {string} title - El título o parte del título de la imagen a buscar.
 * @returns {Promise<object|null>} Un objeto con imageId y imageUrl de la imagen encontrada, o null.
 */
async function findImageByTitle(title) {
    const endpoint = `${WP_URL}/wp-json/wp/v2/media?search=${encodeURIComponent(title)}&per_page=1`;
    console.log(`🔎 Buscando imagen en WordPress con el título: "${title}"`);
    try {
        const response = await axios.get(endpoint, {
            headers: { ...authHeaders, 'User-Agent': BOT_USER_AGENT },
            timeout: 15000
        });

        if (response.status === 200 && response.data.length > 0) {
            const imageData = response.data[0];
            console.log(`✅ Imagen encontrada. ID: ${imageData.id}, URL: ${imageData.source_url}`);
            return {
                imageId: imageData.id,
                imageUrl: imageData.source_url
            };
        } else {
            console.log(`❌ No se encontró una imagen para el título: "${title}"`);
            return null;
        }
    } catch (error) {
        console.error(`❌ Error al buscar la imagen en WordPress:`, error.response?.data?.message || error.message);
        return null;
    }
}

// Exportamos todas las funciones para que sean accesibles desde otros módulos
module.exports = {
    publishToWordPress,
    uploadImage,
    deleteWordPressPost,
    updateWordPressPost,
    findImageByTitle,
    getPost
};
