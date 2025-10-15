import { connectToMainDb } from '@/lib/database.js';
import { runMiddleware, corsMiddleware } from '@/lib/cors.js';
import { ObjectId } from 'mongodb';

export default async function handler(req, res) {
    await runMiddleware(req, res, corsMiddleware);

    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const MARKER_THRESHOLD = 50; // Umbral para cambiar a marcadores
    const forcedView = req.query.view; // 'heatmap' o 'markers'

    try {
        const db = await connectToMainDb();
        const eventsCollection = db.collection('events');

        // Construir la consulta dinámicamente a partir de los parámetros
        const query = {
            'location.coordinates': { $exists: true, $ne: [] },
            'date': { $gte: new Date().toISOString().split('T')[0] } // Eventos desde hoy
        };

        if (req.query.city) {
            query.city = { $regex: `^${req.query.city}$`, $options: 'i' };
        }
        if (req.query.artist) {
            query.artist = { $regex: `^${req.query.artist}$`, $options: 'i' };
        }
        if (req.query.dateFrom) {
            query.date.$gte = req.query.dateFrom;
        }
        if (req.query.dateTo) {
            query.date.$lte = req.query.dateTo;
        }
        if (req.query.bbox) {
            const [sw_lng, sw_lat, ne_lng, ne_lat] = req.query.bbox.split(',').map(parseFloat);
            if ([sw_lng, sw_lat, ne_lng, ne_lat].every(c => !isNaN(c))) {
                query['location.coordinates'] = {
                    $geoWithin: { $box: [[sw_lng, sw_lat], [ne_lng, ne_lat]] }
                };
            }
        }

        const count = await eventsCollection.countDocuments(query);

        if (forcedView === 'heatmap' || (!forcedView && count > MARKER_THRESHOLD)) {
            // Modo Heatmap: solo coordenadas
            const events = await eventsCollection.find(query, { projection: { '_id': 0, 'location.coordinates': 1 } }).toArray();
            const coordinates = events
                .map(event => {
                    if (event.location?.coordinates?.length === 2) {
                        const [lon, lat] = event.location.coordinates;
                        if (typeof lat === 'number' && typeof lon === 'number') {
                            return [lat, lon];
                        }
                    }
                    return null;
                })
                .filter(coord => coord !== null);
            res.setHeader('Cache-Control', 'public, s-maxage=900, stale-while-revalidate=59');
            return res.status(200).json({ type: 'heatmap', data: coordinates });
        } else { // Modo Marcadores (por defecto, si es forzado, o si count <= THRESHOLD)
            // Modo Marcadores: datos completos del evento
            const events = await eventsCollection.find(query, {
                projection: { _id: 1, name: 1, artist: 1, slug: 1, 'location.coordinates': 1 }
            }).limit(MARKER_THRESHOLD).toArray();

            const eventMarkers = events.map(event => ({
                id: event._id,
                name: event.name,
                artist: event.artist,
                slug: event.slug,
                coords: [event.location.coordinates[1], event.location.coordinates[0]] // [lat, lon]
            }));
            res.setHeader('Cache-Control', 'public, s-maxage=900, stale-while-revalidate=59');
            return res.status(200).json({ type: 'markers', data: eventMarkers });
        }

    } catch (error) {
        console.error("Error en el endpoint del mapa de calor:", error);
        return res.status(500).json({ error: 'Error al obtener los datos para el mapa de calor.' });
    }
}