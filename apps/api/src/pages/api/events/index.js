// RUTA: /src/pages/api/events/index.js
// VERSIÃN REFACTORIZADA USANDO EL DATA PROVIDER

import { getAggregatedEvents } from '@/lib/data-provider.js';
import { runMiddleware, corsMiddleware } from '@/lib/cors.js';

// --- MANEJADOR PRINCIPAL DE LA API ---
export default async function handler(req, res) {
    await runMiddleware(req, res, corsMiddleware);

    try {
        // Toda la lÃ³gica compleja de agregaciÃ³n ahora vive en el data-provider
        const { events, isAmbiguous } = await getAggregatedEvents(req.query);

        res.setHeader('Cache-Control', 's-maxage=600, stale-while-revalidate=1800');
        res.status(200).json({ events, isAmbiguous: isAmbiguous || false });

    } catch (err) {
        console.error("Error en /api/events:", err);
        res.status(500).json({ error: "Internal Server Error", details: err.message });
    }
}
