// /api/orchestrator.js - PRODUCTOR
// Misión: Encontrar URLs de posibles eventos y enviarlas a una cola de QStash.

require('dotenv').config();

const { MongoClient } = require('mongodb');
const { google } = require('googleapis');
const { Client } = require('@upstash/qstash');

// --- Configuración ---
const mongoUri = process.env.MONGO_URI;
const dbName = process.env.DB_NAME || 'DuendeDB';
const artistsCollectionName = 'artists';

const googleApiKey = process.env.GOOGLE_API_KEY;
const customSearchEngineId = process.env.GOOGLE_CX;
const BATCH_SIZE = 10;

// --- Inicialización de Servicios ---
const qstashClient = new Client({ token: process.env.QSTASH_TOKEN });
const customsearch = google.customsearch('v1');

// --- Lógica de búsqueda en cascada y por categorías ---
const searchQueries = (artistName) => ({
    redes_sociales: [
        `"${artistName}" "eventos" site:facebook.com`,
        `"${artistName}" "próximos conciertos" site:instagram.com`,
        `"${artistName}" "agenda" site:twitter.com`
    ],
    descubrimiento: [
        `"${artistName}" "agenda" "conciertos"`,
        `"${artistName}" "fechas gira"`,
        `"${artistName}" "próximos eventos"`
    ]
});

// --- Flujo de Principal del Orquestador  o (Productor) ---
async function findAndQueueUrls() {
    console.log('🚀 Orquestador-Productor iniciado. Buscando artistas para encolar...');
    const client = new MongoClient(mongoUri);

    try {
        await client.connect();
        const db = client.db(dbName);
        const artistsCollection = db.collection(artistsCollectionName);
        console.log('✅ Conectado a MongoDB.');

        const artistsToSearch = await artistsCollection
            .find({})
            .sort({ lastScrapedAt: 1 })
            .limit(BATCH_SIZE)
            .toArray();

        if (artistsToSearch.length === 0) {
            const msg = '📪 No hay artistas que necesiten ser procesados.';
            console.error(msg); // Use console.error for visibility
            return { message: msg, urlsEnqueued: 0, artistsProcessed: 0 }; // Return details
        }
        console.log(`🔍 Lote de ${artistsToSearch.length} artistas obtenido. Empezando búsqueda de URLs...`);

        let urlsEnqueued = 0;
        for (const artist of artistsToSearch) {
            console.log(`
---------------------------------
🎤 Buscando URLs para: ${artist.name}`);
            const queriesForArtist = searchQueries(artist.name);
            const urlsToProcess = new Set();
            const searchPromises = [];

            for (const category of Object.keys(queriesForArtist)) {
                for (const query of queriesForArtist[category]) {
                    searchPromises.push(
                        customsearch.cse.list({ cx: customSearchEngineId, q: query, auth: googleApiKey, num: 3 })
                            .then(res => {
                                const items = res.data.items || [];
                                items.forEach(item => urlsToProcess.add(item.link));
                            })
                            .catch(err => {
                                console.error(`   ❌ Error en búsqueda para "${query}": ${err.message}`);
                            })
                    );
                }
            }

            await Promise.all(searchPromises);

            if (urlsToProcess.size > 0) {
                console.log(`   -> Encontradas ${urlsToProcess.size} URLs únicas para ${artist.name}. Encolando...`);

                const messages = Array.from(urlsToProcess).map(url => ({
                    body: JSON.stringify({ url, artistName: artist.name }),
                }));

                await qstashClient.publishJSON({
                    url: `${process.env.VERCEL_URL}/api/process-url`,
                    messages: messages,
                });
                urlsEnqueued += messages.length;
            }

            await artistsCollection.updateOne(
                { _id: artist._id },
                { $set: { lastScrapedAt: new Date() } }
            );
        }

        console.log(`
🎉 Orquestador-Productor finalizado. Total de URLs encoladas: ${urlsEnqueued}.`);
        return { message: 'Proceso de orquestación finalizado.', urlsEnqueued: urlsEnqueued, artistsProcessed: artistsToSearch.length };

    } catch (error) {
        console.error('💥 Error fatal en el Orquestador-Productor:', error);
        // Re-lanzar el error para que el endpoint de Vercel pueda capturarlo
        throw error;
    } finally {
        await client.close();
        console.log('🔚 Conexión con MongoDB cerrada.');
    }
}


// Endpoint para Vercel
module.exports = async (req, res) => {
    let result = { status: 'success', message: 'Orquestador-Productor ejecutado con éxito.', details: {} };
    try {
        const executionDetails = await findAndQueueUrls(); // findAndQueueUrls will now return details
        result.details = executionDetails;
        res.status(200).json(result);
    } catch (error) {
        console.error('💥 Error en el endpoint del Orquestador:', error); // Log the error in Vercel logs
        result.status = 'error';
        result.message = `Error en el Orquestador-Productor: ${error.message}`;
        result.details = { error: error.message, stack: error.stack };
        res.status(500).json(result);
    }
};