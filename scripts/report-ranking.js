// scripts/report-ranking.js
require('dotenv').config();
const { MongoClient } = require('mongodb');

const MONGO_URI = process.env.MONGO_URI;
const DB_NAME = process.env.DB_NAME;

async function reportArtistRanking() {
    if (!MONGO_URI || !DB_NAME) {
        console.error("Por favor, define MONGO_URI y DB_NAME en tu archivo .env");
        return;
    }

    const client = new MongoClient(MONGO_URI);
    console.log("🚀 Generando reporte de ranking de artistas...");

    try {
        await client.connect();
        const db = client.db(DB_NAME);
        const artistsCollection = db.collection('artists');
        console.log("✅ Conectado a MongoDB.");

        // --- LÓGICA MEJORADA ---
        // Se añade un filtro para excluir artistas sin nombre.
        const query = {
            eventCount: { $gt: 0 },
            name: { $exists: true, $ne: null, $ne: "" }
        };

        // Buscar el top 100 de artistas por eventCount
        const topArtists = await artistsCollection.find(query)
        .sort({ eventCount: -1 })
        .limit(100)
        .project({ name: 1, eventCount: 1, _id: 0 })
        .toArray();

        if (topArtists.length === 0) {
            console.log("No se encontraron artistas con eventos y nombre válido para generar un reporte.");
            return;
        }

        console.log("\n🏆 Top 100 de Artistas por Número de Eventos (con nombre válido) 🏆");
        console.log("------------------------------------------------------------------");
        
        topArtists.forEach((artist, index) => {
            console.log(`${index + 1}. ${artist.name} - ${artist.eventCount} eventos`);
        });

        console.log("------------------------------------------------------------------");

        if (topArtists.length >= 100) {
            const threshold = topArtists[99].eventCount;
            console.log(`📊 El umbral para entrar en el Top 100 es de ${threshold} evento(s).`);
        } else {
            console.log(`📊 Se encontraron ${topArtists.length} artistas con eventos y nombre válido.`);
        }

    } catch (error) {
        console.error("💥 Error durante la generación del reporte:", error);
    } finally {
        await client.close();
        console.log("\n🔚 Reporte finalizado. Conexión cerrada.");
    }
}

reportArtistRanking();