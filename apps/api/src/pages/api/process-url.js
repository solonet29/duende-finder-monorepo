// RUTA: /src/pages/api/process-url.js
// VERSIÓN DE DIAGNÓSTICO PARA VER EL BODY RECIBIDO

import { getTempScrapedEventModel } from '@/lib/database.js';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        res.setHeader('Allow', ['POST']);
        return res.status(405).end(`Method ${req.method} Not Allowed`);
    }

    // ▼▼▼ EL CAMBIO MÁS IMPORTANTE ▼▼▼
    // Imprimimos el body exacto que nos llega de QStash.
    console.log("DIAGNÓSTICO: BODY RECIBIDO:", JSON.stringify(req.body, null, 2));
    // ▲▲▲ FIN DEL CAMBIO ▲▲▲

    try {
        // La verificación de firma sigue desactivada para esta prueba.
        console.log("ADVERTENCIA: La verificación de firma de QStash está desactivada.");

        // Tu lógica de validación actual
        const { url, artistName, artistId } = req.body;
        if (!url || !artistName || !artistId) {
            console.error("VALIDATION FAILED: Faltan url, artistName, o artistId en el body.");
            return res.status(400).json({ error: "Datos requeridos no encontrados en el body." });
        }

        console.log(`Procesando URL: ${url}`);
        
        // ... (resto de tu lógica de scraping y guardado) ...

        res.status(200).json({ success: true, message: `URL procesada: ${url}` });

    } catch (error) {
        console.error("Error fatal en el worker process-url.js:", error);
        res.status(500).json({ error: "Error interno del servidor.", details: error.message });
    }
}