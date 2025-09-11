// RUTA: /apps/api/src/pages/api/orchestrator.js
// OBJETIVO: Devolver un listado paginado de artistas para búsqueda manual, ordenado por ranking de eventos.

import { connectToDatabase } from '@/lib/database.js';

const BATCH_SIZE = 50;

// --- Endpoint para Vercel ---
export default async function handler(req, res) {
    // PRUEBA DE DEPURACIÓN:
    // Devolvemos un mensaje fijo para verificar si el nuevo código se está ejecutando.
    res.status(200).json({
        message: "TEST DE DEPURACIÓN v2: Si ves este mensaje, el nuevo código se está desplegando correctamente.",
        timestamp: new Date().toISOString()
    });

    /*
    try {
        // Obtenemos el número de página de la query string, por defecto 1
        const page = parseInt(req.query.page) || 1;

        const result = await getRankedArtistsBatch(page);
        
        res.status(200).json({ status: 'success', ...result });
    } catch (error) {
        res.status(500).json({ status: 'error', message: error.message });
    }
    */
}


/**
 * Obtiene una lista paginada de artistas de la base de datos, ordenados por su ranking de eventos.
 * @param {number} page - El número de página a obtener.
 * @returns {Promise<object>} Un objeto con la lista de artistas y la información de paginación.
 */
async function getRankedArtistsBatch(page = 1) {
    console.log(`🚀 Solicitud para obtener el lote de artistas por ranking. Página: ${page}`);
    const { db } = await connectToDatabase('main');

    try {
        const artistsCollection = db.collection('artists');
        console.log("✅ Conectado a MongoDB y a la colección 'artists'.");

        const skip = (page - 1) * BATCH_SIZE;

        // Filtramos para incluir solo artistas con nombre y un eventCount definido y mayor que 0.
        const query = {
            name: { $exists: true, $ne: null, $ne: "" },
            eventCount: { $exists: true, $gt: 0 }
        };

        const totalArtists = await artistsCollection.countDocuments(query);
        
        const artists = await artistsCollection.find(query)
            .sort({ eventCount: -1 }) // Ordenamos por eventCount descendente (más alto primero)
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

    } catch (error) {
        console.error('💥 Error fatal obteniendo el listado de artistas por ranking:', error);
        throw error;
    }
}