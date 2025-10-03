// RUTA: /apps/api/src/pages/api/artists.js
// OBJETIVO: Devolver un listado completo y paginado de todos los artistas para búsquedas.

import { connectToMainDb } from '@/lib/database.js';

const BATCH_SIZE = 100; // Aumentamos el tamaño para una lista completa

// --- Endpoint para Vercel ---
export default async function handler(req, res) {
    try {
        const page = parseInt(req.query.page) || 1;
        const result = await getAllArtists(page);
        res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate'); // Cache por 1 hora
        res.status(200).json({ status: 'success', ...result });
    } catch (error) {
        console.error("ERROR EN EL HANDLER DE /api/artists:", error);
        res.status(500).json({
            status: 'error',
            message: 'Se produjo un error en el servidor al obtener los artistas.',
            errorMessage: error.message,
        });
    }
}

/**
 * Obtiene una lista paginada de todos los artistas de la base de datos, ordenados alfabéticamente.
 */
async function getAllArtists(page = 1) {
    console.log(`🚀 Solicitud para obtener el listado completo de artistas únicos. Página: ${page}`);
    
    const db = await connectToMainDb();
    const artistsCollection = db.collection('artists');
    console.log("✅ Conectado a MongoDB y a la colección 'artists'.");

    const skip = (page - 1) * BATCH_SIZE;

    const results = await artistsCollection.aggregate([
        {
            $facet: {
                artists: [
                    { $group: { _id: "$name" } }, // Agrupar por nombre para eliminar duplicados
                    { $sort: { _id: 1 } }, // Ordenar alfabéticamente por el nombre (que ahora es el _id)
                    { $skip: skip },
                    { $limit: BATCH_SIZE },
                    {
                        $project: {
                            _id: 0,
                            name: '$_id' // Devolver solo el campo 'name'
                        }
                    }
                ],
                totalCount: [
                    { $group: { _id: "$name" } }, // Contar los artistas únicos
                    { $count: 'total' }
                ]
            }
        }
    ]).toArray();

    const artists = results[0].artists;
    const totalArtists = results[0].totalCount[0] ? results[0].totalCount[0].total : 0;

    console.log(`✅ Lote de ${artists.length} artistas únicos obtenido.`);

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