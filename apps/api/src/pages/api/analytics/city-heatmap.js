// src/pages/api/analytics/city-heatmap.js

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
          type: 'eventView',
          'details.eventId': { $exists: true }
        }
      },
      // 2. Convertir el eventId de string a ObjectId para el join
      {
        $addFields: {
          convertedEventId: { $toObjectId: '$details.eventId' }
        }
      },
      // 3. Unir con la colección de eventos
      {
        $lookup: {
          from: 'events',
          localField: 'convertedEventId',
          foreignField: '_id',
          as: 'eventDetails'
        }
      },
      // 4. Descomprimir el array y filtrar si no hay ciudad
      {
        $unwind: '$eventDetails'
      },
      {
        $match: {
          'eventDetails.city': { $exists: true, $ne: null, $ne: "" }
        }
      },
      // 5. Agrupar por ciudad y contar las vistas
      {
        $group: {
          _id: '$eventDetails.city',
          viewCount: { $sum: 1 }
        }
      },
      // 6. Ordenar de más a menos vistas para ver las ciudades más populares
      {
        $sort: {
          viewCount: -1
        }
      },
      // 7. Proyectar el formato final
      {
        $project: {
          _id: 0,
          city: '$_id',
          viewCount: '$viewCount'
        }
      }
    ];

    const cityHeatmapData = await interactionsCollection.aggregate(pipeline).toArray();

    res.status(200).json(cityHeatmapData);
  } catch (error) {
    console.error("Error al obtener los datos para el mapa de calor:", error);
    res.status(500).json({ error: "Error interno del servidor." });
  }
}