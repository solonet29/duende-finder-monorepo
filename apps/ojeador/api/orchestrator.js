// /api/orchestrator.js - PRODUCTOR
// Misión: Encontrar URLs de eventos usando una estrategia de dos niveles basada en el día de la semana.

require('dotenv').config();
const { MongoClient } = require('mongodb');
const { google } = require('googleapis');
const { Client } = require('@upstash/qstash'); // <-- ESTA ES LA LÍNEA QUE FALTABA

// --- Configuración de Lotes y Búsquedas ---
const TIER1_EVENT_COUNT_THRESHOLD = 3;
const TIER1_BATCH_SIZE = 30;
const TIER1_SEARCHES_PER_ARTIST = 3;

const TIER2_PROMISING_BATCH_SIZE = 5;
const TIER2_LOTTERY_BATCH_SIZE = 5;
const TIER2_SEARCHES_PER_ARTIST = 3;

// --- Configuración de Conexiones ---
const mongoUri = process.env.MONGO_URI;
const dbName = process.env.DB_NAME || 'DuendeDB';
const artistsCollectionName = 'artists';
const googleApiKey = process.env.GOOGLE_API_KEY;
const customSearchEngineId = process.env.GOOGLE_CX;

// --- Inicialización de Servicios ---
const qstashClient = new Client({ token: process.env.QSTASH_TOKEN });
const customsearch = google.customsearch('v1');

// --- Lógica de búsqueda (3 variaciones) ---
const searchQueries = (artistName) => ([
    `"${artistName}" "entradas" OR "concierto" OR "gira"`,
    `"${artistName}" "eventos" site:facebook.com OR site:instagram.com`,
    `"${artistName}" "agenda" site:songkick.com OR site:bandsintown.com`
]);

// --- Función Refactorizada para Procesar un Lote de Artistas ---
async function processArtistBatch(artists, db, artistsCollection, searchesPerArtist) {
    let urlsEnqueuedInBatch = 0;

    for (const artist of artists) {
        console.log(`
---------------------------------
🎤 Buscando URLs para: ${artist.name} (eventCount: ${artist.eventCount || 0})`);

        const queriesForArtist = searchQueries(artist.name);
        const urlsToProcess = new Set();
        const searchPromises = [];

        for (const query of queriesForArtist.slice(0, searchesPerArtist)) {
            searchPromises.push(
                customsearch.cse.list({ cx: customSearchEngineId, q: query, auth: googleApiKey, num: 3 })
                    .then(res => {
                        const items = res.data.items || [];
                        items.forEach(item => urlsToProcess.add(item.link));
                    })
                    .catch(err => console.error(`   ❌ Error en búsqueda para "${query}": ${err.message}`))
            );
        }

        await Promise.all(searchPromises);

        if (urlsToProcess.size > 0) {
            console.log(`   -> Encontradas ${urlsToProcess.size} URLs únicas para ${artist.name}. Encolando...`);
            const messages = Array.from(urlsToProcess).map(url => ({
                body: JSON.stringify({ url, artistName: artist.name, artistId: artist._id.toString() }),
            }));

            try {
                const destinationUrl = `${process.env.QSTASH_DESTINATION_URL}/api/process-url`;
                // Simplemente cambiamos el nombre del método a "publish"
                const response = await qstashClient.publish({
                    url: destinationUrl,
                    messages: messages // "messages" es el array de objetos { body: "..." }
                }); // <-- MÉTODO CORRECTO
                urlsEnqueuedInBatch += messages.length;
                const messageIds = Array.isArray(response) ? response.map(r => r.messageId).join(', ') : response.messageId;
                console.log(`   ✅ ${messages.length} URLs encoladas con éxito en QStash. Message IDs: [${messageIds}]`);
            } catch (qstashError) {
                console.error(`   ❌ Error al publicar en QStash para ${artist.name}: ${qstashError.message}`);
            }
        } else {
            console.log(`   -> No se encontraron URLs nuevas para ${artist.name} en esta ejecución.`);
        }

        await artistsCollection.updateOne({ _id: artist._id }, { $set: { lastScrapedAt: new Date() } });
    }
    return urlsEnqueuedInBatch;
}


// --- Flujo Principal del Orquestador ---
async function findAndQueueUrls() {
    console.log('🚀 Orquestador-Productor iniciado con lógica condicional por día...');
    const client = new MongoClient(mongoUri);

    try {
        await client.connect();
        const db = client.db(dbName);
        const artistsCollection = db.collection(artistsCollectionName);
        console.log("✅ Conectado a MongoDB.");

        const dayOfWeek = new Date().getDay(); // Domingo=0, Lunes=1, Martes=2, ...
        let totalUrlsEnqueued = 0;
        let totalArtistsProcessed = 0;
        let artistsToProcess = [];

        const validNameFilter = { name: { $exists: true, $ne: null, $ne: "" } };

        // --- Lógica condicional basada en el día de la semana ---
        if (dayOfWeek === 2 || dayOfWeek === 5) { // Martes o Viernes: Foco en el Nivel 1
            console.log("✅ Hoy es Martes o Viernes. Buscando artistas de Nivel 1...");
            const query = { ...validNameFilter, eventCount: { $gte: TIER1_EVENT_COUNT_THRESHOLD } };
            artistsToProcess = await artistsCollection.find(query).sort({ lastScrapedAt: 1 }).limit(TIER1_BATCH_SIZE).toArray();

            if (artistsToProcess.length > 0) {
                console.log(`🔍 Lote de ${artistsToProcess.length} artistas de Nivel 1 obtenido.`);
                totalUrlsEnqueued += await processArtistBatch(artistsToProcess, db, artistsCollection, TIER1_SEARCHES_PER_ARTIST);
                totalArtistsProcessed += artistsToProcess.length;
            } else {
                console.log("📪 No se encontraron artistas de Nivel 1 para procesar.");
            }

        } else { // Resto de la semana: Foco en el Nivel 2 (Oportunidad)
            console.log("✅ Hoy es día de oportunidad. Buscando artistas de Nivel 2...");

            // Grupo A: "Prometedores" (1 o 2 eventos), selección aleatoria
            const promisingQuery = { ...validNameFilter, eventCount: { $in: [1, 2] } };
            const promisingArtists = await artistsCollection.aggregate([{ $match: promisingQuery }, { $sample: { size: TIER2_PROMISING_BATCH_SIZE } }]).toArray();
            console.log(`   -> Encontrados ${promisingArtists.length} artistas 'prometedores'.`);

            // Grupo B: "Lotería" (0 eventos), selección aleatoria
            const lotteryQuery = { ...validNameFilter, eventCount: 0 };
            const lotteryArtists = await artistsCollection.aggregate([{ $match: lotteryQuery }, { $sample: { size: TIER2_LOTTERY_BATCH_SIZE } }]).toArray();
            console.log(`   -> Encontrados ${lotteryArtists.length} artistas de 'lotería'.`);

            artistsToProcess = [...promisingArtists, ...lotteryArtists];

            if (artistsToProcess.length > 0) {
                console.log(`🔍 Lote de ${artistsToProcess.length} artistas de Nivel 2 obtenido.`);
                totalUrlsEnqueued += await processArtistBatch(artistsToProcess, db, artistsCollection, TIER2_SEARCHES_PER_ARTIST);
                totalArtistsProcessed += artistsToProcess.length;
            } else {
                console.log("📪 No se encontraron artistas de Nivel 2 para procesar.");
            }
        }

        console.log(`\n🎉 Orquestador-Productor finalizado. Total de URLs encoladas: ${totalUrlsEnqueued}. Artistas procesados: ${totalArtistsProcessed}.`);
        return { message: 'Proceso de orquestación finalizado.', urlsEnqueued: totalUrlsEnqueued, artistsProcessed: totalArtistsProcessed };

    } catch (error) {
        console.error('💥 Error fatal en el Orquestador-Productor:', error);
        throw error;
    } finally {
        await client.close();
        console.log("🔚 Conexión con MongoDB cerrada.");
    }
}

// Endpoint para Vercel
module.exports = async (req, res) => {
    let result = { status: 'success', message: 'Orquestador-Productor ejecutado con éxito.', details: {} };
    try {
        const executionDetails = await findAndQueueUrls();
        result.details = executionDetails;
        res.status(200).json(result);
    } catch (error) {
        console.error('💥 Error en el endpoint del Orquestador:', error);
        result.status = 'error';
        result.message = `Error en el Orquestador-Productor: ${error.message}`;
        result.details = { error: error.message, stack: error.stack };
        res.status(500).json(result);
    }
};