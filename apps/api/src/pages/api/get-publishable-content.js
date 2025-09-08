import { connectToMainDb } from '@/lib/database.js';
import { runMiddleware, corsMiddleware } from '@/lib/cors.js';

export default async function handler(req, res) {
    // Usar el middleware de CORS centralizado
    await runMiddleware(req, res, corsMiddleware);

    if (req.method !== 'GET') {
        res.setHeader('Allow', ['GET']);
        return res.status(405).end(`Method ${req.method} Not Allowed`);
    }

    try {
        const db = await connectToMainDb();
        const eventsCollection = db.collection("events");

        // Buscar eventos que tengan contenido listo para publicar
        const query = { status: 'content_ready' };

        // Definir qué campos queremos devolver para no enviar datos innecesarios
        const projection = {
            _id: 1,
            name: 1,
            artist: 1,
            date: 1,
            city: 1,
            blogPostTitle: 1,
            tweetText: 1,
            instagramText: 1,
            imageUrl: 1,
            // El blogPostUrl se generará en el paso de publicación a WordPress,
            // por lo que puede no estar disponible aquí. Se incluirá si existe.
            blogPostUrl: 1 
        };

        const publishableEvents = await eventsCollection
            .find(query)
            .project(projection)
            .sort({ contentGenerationDate: -1 }) // Mostrar los más recientes primero
            .toArray();

        res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate');
        res.status(200).json({ events: publishableEvents });

    } catch (err) {
        console.error("Error en /api/get-publishable-content:", err);
        res.status(500).json({ error: "Error interno del servidor", details: err.message });
    }
}
