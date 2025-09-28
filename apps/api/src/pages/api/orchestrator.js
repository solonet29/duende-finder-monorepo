// RUTA: /apps/api/src/pages/api/orchestrator.js
// OBJETIVO: Devolver un listado paginado de artistas para búsqueda manual, ordenado por ranking de eventos.

// CORRECCIÓN FINAL: Importamos la función correcta (connectToMainDb) del fichero de base de datos.
import { connectToMainDb } from '@/lib/database.js';

const BATCH_SIZE = 50;

// --- Endpoint para Vercel ---
export default async function handler(req, res) {
    try {
        const page = parseInt(req.query.page) || 1;
        const result = await getRankedArtistsBatch(page);
        res.setHeader('Cache-Control', 'no-store, max-age=0');
        res.status(200).json({ status: 'success', ...result });
    } catch (error) {
        console.error("ERROR EN EL HANDLER DEL ORCHESTRATOR:", error);
        res.status(500).json({
            status: 'error_en_produccion',
            message: 'Se produjo un error en el servidor al ejecutar la lógica principal.',
            errorMessage: error.message,
            errorStack: error.stack
        });
    }
}

/**
 * Obtiene una lista paginada de artistas de la base de datos, ordenados por popularidad (número de vistas de eventos).
 */
async function getRankedArtistsBatch(page = 1) {
    console.log(`🚀 Solicitud para obtener el lote de artistas por popularidad. Página: ${page}`);
    
    const db = await connectToMainDb();
    const interactionsCollection = db.collection('user_interactions');
    console.log("✅ Conectado a MongoDB y a la colección 'user_interactions'.");

    const skip = (page - 1) * BATCH_SIZE;

    const popularityPipeline = [
        {
            $match: { type: 'eventView' }
        },
        {
            $group: {
                _id: '$details.eventId',
                views: { $sum: 1 }
            }
        },
        {
            $addFields: {
                eventId: { $toObjectId: '$_id' }
            }
        },
        {
            $lookup: {
                from: 'events',
                localField: 'eventId',
                foreignField: '_id',
                as: 'event'
            }
        },
        {
            $unwind: '$event'
        },
        {
            $group: {
                _id: '$event.artist',
                totalViews: { $sum: '$views' }
            }
        },
        {
            $sort: { totalViews: -1 }
        }
    ];

    const results = await interactionsCollection.aggregate([
        {
            $facet: {
                artists: [
                    ...popularityPipeline,
                    { $skip: skip },
                    { $limit: BATCH_SIZE },
                    {
                        $project: {
                            name: '$_id',
                            _id: 0
                        }
                    }
                ],
                totalCount: [
                    ...popularityPipeline,
                    { $count: 'total' }
                ]
            }
        }
    ]).toArray();

    const artists = results[0].artists;
    const totalArtists = results[0].totalCount[0] ? results[0].totalCount[0].total : 0;

    console.log(`✅ Lote de ${artists.length} artistas obtenido, ordenado por popularidad.`);

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