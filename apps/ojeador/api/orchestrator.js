// RUTA: /apps/ojeador/api/orchestrator.js
// OBJETIVO: Devolver un listado paginado de artistas para búsqueda manual.

import { connectToDatabase } from '../../../api/lib/database.js';

const BATCH_SIZE = 50;

/**
 * Obtiene una lista paginada de artistas de la base de datos.
 * @param {number} page - El número de página a obtener.
 * @returns {Promise<object>} Un objeto con la lista de artistas y la información de paginación.
 */
async function getArtistsBatch(page = 1) {
    console.log(`🚀 Solicitud para obtener el lote de artistas página: ${page}`);
    const { db } = await connectToDatabase('main');

    try {
        const artistsCollection = db.collection('artists');
        console.log("✅ Conectado a MongoDB y a la colección 'artists'.");

        const skip = (page - 1) * BATCH_SIZE;

        const totalArtists = await artistsCollection.countDocuments({ name: { $exists: true, $ne: null, $ne: "" } });
        
        const artists = await artistsCollection.find({ name: { $exists: true, $ne: null, $ne: "" } })
            .sort({ name: 1 }) // Ordenamos alfabéticamente por nombre para consistencia
            .skip(skip)
            .limit(BATCH_SIZE)
            .toArray();

        console.log(`✅ Lote de ${artists.length} artistas obtenido.`);

        return {
            artists,
            pagination: {
                total: totalArtists,
                page: page,
                limit: BATCH_SIZE,
                totalPages: Math.ceil(totalArtists / BATCH_SIZE)
            }
        };

    } catch (error) {
        console.error('💥 Error fatal obteniendo el listado de artistas:', error);
        throw error;
    }
}

// --- Endpoint para Vercel ---
export default async function handler(req, res) {
    try {
        // Obtenemos el número de página de la query string, por defecto 1
        const page = parseInt(req.query.page) || 1;

        const result = await getArtistsBatch(page);
        
        res.status(200).json({ status: 'success', ...result });
    } catch (error) {
        res.status(500).json({ status: 'error', message: error.message });
    }
};
