// src/pages/api/analytics/peak-hours.js

import { connectToAnalyticsDb } from '@/lib/database.js';
import { runMiddleware, corsMiddleware } from '@/lib/cors.js';

export default async function handler(req, res) {
  await runMiddleware(req, res, corsMiddleware);

  res.setHeader('Cache-control', 's-maxage=3600, stale-while-revalidate'); // Cache por 1 hora

  try {
    const db = await connectToAnalyticsDb();
    const interactionsCollection = db.collection("interactions");

    const pipeline = [
      // 1. Proyectar una nueva propiedad 'hour' extraída del timestamp del _id
      {
        $project: {
          hour: { 
            $hour: { 
              date: { $toDate: "$_id" },
              timezone: "Europe/Madrid" // Usar una timezone relevante
            }
          }
        }
      },
      // 2. Agrupar por esa hora y contar las interacciones
      {
        $group: {
          _id: '$hour',
          count: { $sum: 1 }
        }
      },
      // 3. Ordenar por la hora
      {
        $sort: {
          _id: 1
        }
      },
      // 4. Proyectar el formato final
      {
        $project: {
          _id: 0,
          hour: '$_id',
          count: '$count'
        }
      }
    ];

    const peakHours = await interactionsCollection.aggregate(pipeline).toArray();

    res.status(200).json(peakHours);
  } catch (error) {
    console.error("Error al calcular las horas pico de actividad:", error);
    res.status(500).json({ error: "Error interno del servidor." });
  }
}