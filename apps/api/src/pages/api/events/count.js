// src/pages/api/events/count.js

import { connectToMainDb } from '@/lib/database.js';
import { runMiddleware, corsMiddleware } from '@/lib/cors.js';

export default async function handler(req, res) {
  await runMiddleware(req, res, corsMiddleware);

  res.setHeader('Cache-control', 'no-store, max-age=0');
  try {
    const db = await connectToMainDb();

    const eventsCollection = db.collection("events");

    const today = new Date();
    today.setHours(0, 0, 0, 0);


    const count = await eventsCollection.countDocuments({
      eventDate: { $gte: today },
      name: { $ne: null, $nin: ["", "N/A"] },
      artist: { $ne: null, $nin: ["", "N/A"] },
      time: { $ne: null, $nin: ["", "N/A"] },
      venue: { $ne: null, $nin: ["", "N/A"] }
    });

    res.status(200).json({ total: count });
  } catch (error) {
    console.error("Error al contar eventos:", error);
    res.status(500).json({ error: "Error interno del servidor." });
  }
}
