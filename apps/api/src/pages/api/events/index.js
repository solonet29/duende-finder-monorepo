// Importamos nuestro conector COMPARTIDO
const { connectToDatabase } = require('@duende-finder/db-client');

export default async function handler(req, res) {
    try {
        const db = await connectToDatabase();

        // Hacemos una consulta para traer los eventos
        const events = await db.collection('events').find({}).limit(20).toArray();

        if (!events || events.length === 0) {
            return res.status(404).json({ message: 'No se encontraron eventos' });
        }

        // Devolvemos la lista de eventos
        res.status(200).json(events);
    } catch (error) {
        console.error("Error en /api/events:", error);
        res.status(500).json({ error: 'Error del servidor' });
    }
}