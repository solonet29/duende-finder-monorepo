// src/pages/api/analytics/top-events.js

import { connectToAnalyticsDb } from '@/lib/database.js';
import { runMiddleware, corsMiddleware } from '@/lib/cors.js';
import { ObjectId } from 'mongodb';

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
      // Convertir el eventId de string a ObjectId para el join
      {
        $addFields: {
          convertedEventId: { $toObjectId: '$details.eventId' }
        }
      },
      // 2. Agrupar por eventId y contar las vistas
      {
        $group: {
          _id: '$convertedEventId',
          viewCount: { $sum: 1 }
        }
      },
      // 3. Ordenar de más a menos vistas
      {
        $sort: {
          viewCount: -1
        }
      },
      // 4. Limitar al top 10
      {
        $limit: 10
      },
      // 5. Unir con la colección de eventos para obtener detalles
      {
        $lookup: {
          from: 'events',
          localField: '_id',
          foreignField: '_id',
          as: 'eventDetails'
        }
      },
      // 6. Descomprimir el array de eventDetails
      {
        $unwind: '$eventDetails'
      },
      // 7. Proyectar el formato final de salida
      {
        $project: {
          _id: 0,
          eventId: '$_id',
          viewCount: '$viewCount',
          name: '$eventDetails.name',
          artist: '$eventDetails.artist',
          imageUrl: '$eventDetails.imageUrl',
          date: '$eventDetails.date',
          city: '$eventDetails.city'
        }
      }
    ];

    const topEvents = await interactionsCollection.aggregate(pipeline).toArray();

    res.status(200).json(topEvents);
  } catch (error) {
    console.error("Error al obtener los eventos más vistos:", error);
    res.status(500).json({ error: "Error interno del servidor." });
  }
}