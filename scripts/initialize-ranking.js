// scripts/initialize-ranking.js
require('dotenv').config();
const { MongoClient } = require('mongodb');

const MONGO_URI = process.env.MONGO_URI;
const DB_NAME = process.env.DB_NAME;

async function initializeArtistRanking() {
    if (!MONGO_URI || !DB_NAME) {
        console.error("Por favor, define MONGO_URI y DB_NAME en tu archivo .env");
        return;
    }

    const client = new MongoClient(MONGO_URI);
    console.log("🚀 Iniciando la inicialización del ranking de artistas...");

    try {
        await client.connect();
        const db = client.db(DB_NAME);
        const artistsCollection = db.collection('artists');
        const eventsCollection = db.collection('events');
        console.log("✅ Conectado a MongoDB.");

        // Paso 1: Resetear todos los contadores a 0
        console.log("🔄 Reseteando todos los contadores 'eventCount' a 0...");
        await artistsCollection.updateMany({}, { $set: { eventCount: 0 } });
        console.log("✅ Contadores reseteados.");

        // Paso 2: Usar un pipeline de agregación avanzado para unir, contar y actualizar.
        console.log("📊 Uniendo colecciones y contando eventos por artista...");

        const aggregationPipeline = [
            // Une 'events' con 'artists' donde event.artist == artist.name
            {
                $lookup: {
                    from: "artists",
                    localField: "artist",
                    foreignField: "name",
                    as: "artistDetails"
                }
            },
            // Filtra los eventos que no encontraron un artista coincidente
            {
                $match: {
                    "artistDetails": { $ne: [] }
                }
            },
            // Descomprime el array de artistDetails
            {
                $unwind: "$artistDetails"
            },
            // Agrupa por el ID del artista y cuenta los eventos
            {
                $group: {
                    _id: "$artistDetails._id",
                    eventCount: { $sum: 1 }
                }
            },
            // Fusiona los resultados directamente en la colección de artistas
            {
                $merge: {
                    into: "artists",
                    on: "_id",
                    whenMatched: "merge",
                    whenNotMatched: "discard"
                }
            }
        ];

        // Ejecuta el pipeline
        await eventsCollection.aggregate(aggregationPipeline).toArray();

        console.log("✅ ¡Ranking inicializado con éxito! La colección de artistas ha sido actualizada.");

    } catch (error) {
        console.error("💥 Error durante el proceso:", error);
    } finally {
        await client.close();
        console.log("🔚 Proceso finalizado. Conexión cerrada.");
    }
}

initializeArtistRanking();