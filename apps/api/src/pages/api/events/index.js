// RUTA: /src/pages/api/events/index.js
// VERSIÓN RESTAURADA Y CORREGIDA CON PAGINACIÓN

import { getEventModel } from '@/lib/database.js';
import { runMiddleware, corsMiddleware } from '@/lib/cors.js';

// --- MANEJADOR PRINCIPAL DE LA API ---
export default async function handler(req, res) {
    await runMiddleware(req, res, corsMiddleware);

    try {
        const Event = await getEventModel();
        
        console.log("--- DIAGNOSTIC MODE: Bypassing all filters ---");

        const { limit = '10' } = req.query;
        const limitNum = parseInt(limit, 10) || 10;

        // Simple query to get the most recent events, bypassing all complex logic
        const events = await Event.find({}).sort({ createdAt: -1 }).limit(limitNum);

        console.log(`--- DIAGNOSTIC MODE: Found ${events.length} events ---`);

        res.setHeader('Cache-Control', 'no-store');
        res.status(200).json({ events, isAmbiguous: false });

    } catch (err) {
        console.error("Error en /api/events:", err);
        res.status(500).json({ error: "Internal Server Error", details: err.message });
    }
}
