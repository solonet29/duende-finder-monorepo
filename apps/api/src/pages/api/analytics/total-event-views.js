// src/pages/api/analytics/total-event-views.js

import { connectToAnalyticsDb } from '@/lib/database.js';
import { runMiddleware, corsMiddleware } from '@/lib/cors.js';

export default async function handler(req, res) {
  // Ejecutar middleware de CORS
  await runMiddleware(req, res, corsMiddleware);

  // Evitar cacheo de la respuesta
  res.setHeader('Cache-control', 'no-store, max-age=0');

  try {
    // Conectar a la base de datos
    const db = await connectToAnalyticsDb();

    // Acceder a la colección donde se guardan las interacciones
    const interactionsCollection = db.collection("interactions");

    // Contar los documentos que son de tipo 'eventView'
    const count = await interactionsCollection.countDocuments({
      type: 'eventView'
    });

    // Devolver el total en la respuesta
    res.status(200).json({ total: count });
  } catch (error) {
    console.error("Error al contar las vistas de eventos:", error);
    res.status(500).json({ error: "Error interno del servidor." });
  }
}