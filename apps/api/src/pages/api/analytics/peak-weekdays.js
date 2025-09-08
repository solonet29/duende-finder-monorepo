// src/pages/api/analytics/peak-weekdays.js

import { connectToAnalyticsDb } from '@/lib/database.js';
import { runMiddleware, corsMiddleware } from '@/lib/cors.js';

export default async function handler(req, res) {
  await runMiddleware(req, res, corsMiddleware);

  res.setHeader('Cache-control', 's-maxage=3600, stale-while-revalidate'); // Cache por 1 hora

  try {
    const db = await connectToAnalyticsDb();
    const interactionsCollection = db.collection("interactions");

    const pipeline = [
      // 1. Proyectar una nueva propiedad 'dayOfWeek' extraída del timestamp del _id
      {
        $project: {
          dayOfWeek: { 
            $isoDayOfWeek: { 
              date: { $toDate: "$_id" },
              timezone: "Europe/Madrid" // Usar una timezone relevante. 1 = Lunes, 7 = Domingo.
            }
          }
        }
      },
      // 2. Agrupar por ese día y contar las interacciones
      {
        $group: {
          _id: '$dayOfWeek',
          count: { $sum: 1 }
        }
      },
      // 3. Ordenar por el día de la semana
      {
        $sort: {
          _id: 1
        }
      },
      // 4. Proyectar el formato final
      {
        $project: {
          _id: 0,
          dayOfWeek: '$_id',
          count: '$count'
        }
      }
    ];

    const peakWeekdays = await interactionsCollection.aggregate(pipeline).toArray();

    res.status(200).json(peakWeekdays);
  } catch (error) {
    console.error("Error al calcular los días pico de actividad:", error);
    res.status(500).json({ error: "Error interno del servidor." });
  }
}