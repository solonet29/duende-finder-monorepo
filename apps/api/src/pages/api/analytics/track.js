// RUTA: /src/pages/api/analytics/track.js
// VERSIÓN CORREGIDA CON SU PROPIO GESTOR DE CORS

import { getUserInteractionModel } from '@/lib/database.js';
import { runMiddleware, corsMiddleware } from '@/lib/cors.js';

export default async function handler(req, res) {
    // Ejecutamos el middleware de CORS al principio
    await runMiddleware(req, res, corsMiddleware);

    // El resto de tu lógica se mantiene igual
    if (req.method !== 'POST') {
        res.setHeader('Allow', ['POST']);
        return res.status(405).end(`Method ${req.method} Not Allowed`);
    }

    try {
        const { type, sessionId, details } = req.body;

        if (!type || !sessionId || !details) {
            return res.status(400).json({ msg: 'Faltan datos en la petición' });
        }

        const UserInteraction = await getUserInteractionModel();
        const newInteraction = new UserInteraction({ type, sessionId, details });
        await newInteraction.save();

        return res.status(201).json({ msg: 'Interacción registrada con éxito' });

    } catch (err) {
        console.error('Error al registrar interacción:', err.message);
        return res.status(500).json({ msg: 'Error del servidor' });
    }
}
