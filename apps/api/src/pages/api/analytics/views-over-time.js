// src/pages/api/analytics/views-over-time.js

import { connectToAnalyticsDb } from '@/lib/database.js';
import { runMiddleware, corsMiddleware } from '@/lib/cors.js';

export default async function handler(req, res) {
  await runMiddleware(req, res, corsMiddleware);

  res.setHeader('Cache-control', 's-maxage=3600, stale-while-revalidate'); // Cache por 1 hora

  try {
    const db = await connectToAnalyticsDb();
    const interactionsCollection = db.collection("interactions");

    const pipeline = [
      // 1. Filtrar solo las vistas de eventos
      {
        $match: {
          type: 'eventView'
        }
      },
      // 2. Proyectar solo la fecha de la interacción, extraída del _id de MongoDB
      {
        $project: {
          date: {
            $dateToString: {
              format: "%Y-%m-%d",
              date: { $toDate: "$_id" }
            }
          }
        }
      },
      // 3. Agrupar por fecha y contar las vistas
      {
        $group: {
          _id: '$date',
          views: { $sum: 1 }
        }
      },
      // 4. Ordenar por fecha ascendente
      {
        $sort: {
          _id: 1
        }
      },
      // 5. Proyectar el formato final
      {
        $project: {
          _id: 0,
          date: '$_id',
          views: '$views'
        }
      }
    ];

    const viewsOverTime = await interactionsCollection.aggregate(pipeline).toArray();

    res.status(200).json(viewsOverTime);
  } catch (error) {
    console.error("Error al obtener las vistas a lo largo del tiempo:", error);
    res.status(500).json({ error: "Error interno del servidor." });
  }
}