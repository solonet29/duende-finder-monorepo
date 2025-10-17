import { connectToDatabase } from '@/lib/database.js';
import { runMiddleware, corsMiddleware } from '@/lib/cors.js';

export default async function handler(req, res) {
    await runMiddleware(req, res, corsMiddleware);

    if (req.method !== 'GET') {
        res.setHeader('Allow', ['GET']);
        return res.status(405).end(`Method ${req.method} Not Allowed`);
    }

    try {
        const db = await connectToDatabase();
        const config = await db.collection('config').findOne({ _id: 'main_config' });

        if (!config) {
            console.warn("No se encontró el documento 'main_config' en la colección 'config'. Devolviendo configuración por defecto.");
            return res.status(200).json({
                banner_enabled: false,
                post_banners_enabled: false,
            });
        }

        // Añadimos cache para mejorar el rendimiento
        res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=120');
        res.status(200).json(config);

    } catch (error) {
        console.error("Error al obtener la configuración:", error);
        res.status(500).json({ error: 'Error interno del servidor al obtener la configuración.' });
    }
}
