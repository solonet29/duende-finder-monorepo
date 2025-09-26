
// RUTA: /src/pages/api/share/[eventId].js

import { connectToMainDb } from '@/lib/database.js';
import { ObjectId } from 'mongodb';

function sanitizeField(value, defaultText = '') {
    return (value && typeof value === 'string' && value.trim()) ? value.trim() : defaultText;
}

export default async function handler(req, res) {
    const { eventId } = req.query;

    if (!eventId || !ObjectId.isValid(eventId)) {
        return res.status(400).send('Invalid Event ID');
    }

    try {
        const db = await connectToMainDb();
        const event = await db.collection('events').findOne({ _id: new ObjectId(eventId) });

        if (!event) {
            return res.status(404).send('Event not found');
        }

        // --- Generar datos para las metaetiquetas ---
        const pageTitle = sanitizeField(event.name, 'Evento de Flamenco');
        const description = sanitizeField(event.description, 'Descubre la magia del flamenco con Duende Finder.');
        const imageUrl = event.imageUrl || 'https://www.afland.es/wp-content/uploads/2024/04/DUENDE-FINDER-LOGO-1200-X-630-PX.png';
        const pageUrl = `https://www.duendefinder.com/eventos/${event._id}-${event.slug || 'evento'}`;

        // --- Generar el HTML con metaetiquetas y redirección ---
        const html = `
            <!DOCTYPE html>
            <html lang="es">
            <head>
                <meta charset="UTF-8">
                <title>${pageTitle}</title>
                <meta property="og:title" content="${pageTitle}" />
                <meta property="og:description" content="${description}" />
                <meta property="og:image" content="${imageUrl}" />
                <meta property="og:url" content="${pageUrl}" />
                <meta property="og:type" content="website" />
                <meta name="twitter:card" content="summary_large_image">

                <!-- Redirección inmediata usando JavaScript -->
                <script>
                    window.location.replace("${pageUrl}");
                </script>
            </head>
            <body>
                <p>Redirigiendo al evento...</p>
            </body>
            </html>
        `;

        res.setHeader('Content-Type', 'text/html');
        res.status(200).send(html);

    } catch (error) {
        console.error("Error en el endpoint de share:", error);
        // Redirección de fallback si algo falla en el servidor
        res.redirect(307, '/');
    }
}
