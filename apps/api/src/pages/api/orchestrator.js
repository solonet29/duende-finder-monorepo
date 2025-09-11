// RUTA: /apps/api/src/pages/api/orchestrator.js
// OBJETIVO: Devolver un listado paginado de artistas para búsqueda manual, ordenado por ranking de eventos.

import { connectToDatabase } from '@/lib/database.js';

const BATCH_SIZE = 50;

// --- Endpoint para Vercel ---
export default async function handler(req, res) {
    try {
        // Obtenemos el número de página de la query string, por defecto 1
        const page = parseInt(req.query.page) || 1;
        const result = await getRankedArtistsBatch(page);
        res.status(200).json({ status: 'success', ...result });
    } catch (error) {
        console.error("ERROR EN EL HANDLER DEL ORCHESTRATOR:", error);
        // Devolvemos el error detallado en la respuesta para depuración en producción
        res.status(500).json({
            status: 'error_en_produccion',
            message: 'Se produjo un error en el servidor al ejecutar la lógica principal.',
            errorMessage: error.message,
            errorStack: error.stack
        });
    }
}

/**
 * Obtiene una lista paginada de artistas de la base de datos, ordenados por su ranking de eventos.
 * @param {number} page - El número de página a obtener.
 * @returns {Promise<object>} Un objeto con la lista de artistas y la información de paginación.
 */
async function getRankedArtistsBatch(page = 1) {
    // No usamos try-catch aquí para que cualquier error suba al handler y pueda ser reportado.
    console.log(`🚀 Solicitud para obtener el lote de artistas por ranking. Página: ${page}`);
    const { db } = await connectToDatabase('main');

    const artistsCollection = db.collection('artists');
    console.log("✅ Conectado a MongoDB y a la colección 'artists'.");

    const skip = (page - 1) * BATCH_SIZE;

    const query = {
        name: { $exists: true, $ne: null, $ne: "" },
        eventCount: { $exists: true, $gt: 0 }
    };

    const totalArtists = await artistsCollection.countDocuments(query);
    
    const artists = await artistsCollection.find(query)
        .sort({ eventCount: -1 })
        .skip(skip)
        .limit(BATCH_SIZE)
        .toArray();

    console.log(`✅ Lote de ${artists.length} artistas obtenido, ordenado por ranking.`);

    return {
        artists,
        pagination: {
            total: totalArtists,
            page: page,
            limit: BATCH_SIZE,
            totalPages: Math.ceil(totalArtists / BATCH_SIZE)
        }
    };
}
