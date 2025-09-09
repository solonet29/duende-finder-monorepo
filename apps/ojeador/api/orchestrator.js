// --- Configuración de Lotes y Búsquedas ---
const TIER1_EVENT_COUNT_THRESHOLD = 3;
const TIER1_BATCH_SIZE = 30;
const TIER2_BATCH_SIZE = 3;
const SEARCHES_PER_ARTIST = 3;

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
async function processArtistBatch(artists, db, artistsCollection) {
    let urlsEnqueuedInBatch = 0;

    for (const artist of artists) {
        if (!artist.name) {
            console.log('⏭️ Saltando artista con nombre no definido.');
            continue;
        }

        console.log(`
---------------------------------
🎤 Buscando URLs para: ${artist.name} (eventCount: ${artist.eventCount || 0})`);

        const queriesForArtist = searchQueries(artist.name);
        const urlsToProcess = new Set();
        const searchPromises = [];

        for (const query of queriesForArtist.slice(0, SEARCHES_PER_ARTIST)) {
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
                body: JSON.stringify({ url, artistName: artist.name, artistId: artist._id }),
            }));

            try {
                const destinationUrl = `${process.env.QSTASH_DESTINATION_URL}/api/process-url`;
                const response = await qstashClient.publishJSON({ url: destinationUrl, messages: messages });
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
    console.log('🚀 Orquestador-Productor iniciado con lógica de dos niveles...');
    const client = new MongoClient(mongoUri);

    try {
        await client.connect();
        const db = client.db(dbName);
        const artistsCollection = db.collection(artistsCollectionName);
        console.log("✅ Conectado a MongoDB.");

        let totalUrlsEnqueued = 0;
        let totalArtistsProcessed = 0;

        // --- Nivel 1: Artistas Prioritarios ---
        console.log("\n--- Buscando Lote de Nivel 1 (eventCount >= 3) ---");
        const tier1Artists = await artistsCollection
            .find({ eventCount: { $gte: TIER1_EVENT_COUNT_THRESHOLD } })
            .sort({ lastScrapedAt: 1 })
            .limit(TIER1_BATCH_SIZE)
            .toArray();

        if (tier1Artists.length > 0) {
            console.log(`🔍 Lote de ${tier1Artists.length} artistas de Nivel 1 obtenido.`);
            totalUrlsEnqueued += await processArtistBatch(tier1Artists, db, artistsCollection);
            totalArtistsProcessed += tier1Artists.length;
        } else {
            console.log("📪 No se encontraron artistas de Nivel 1 para procesar.");
        }

        // --- Nivel 2: Artistas de Oportunidad ---
        console.log("\n--- Buscando Lote de Nivel 2 (eventCount < 3) ---");
        const tier2Artists = await artistsCollection
            .find({ eventCount: { $lt: TIER1_EVENT_COUNT_THRESHOLD } })
            .sort({ lastScrapedAt: 1 })
            .limit(TIER2_BATCH_SIZE)
            .toArray();

        if (tier2Artists.length > 0) {
            console.log(`🔍 Lote de ${tier2Artists.length} artistas de Nivel 2 obtenido.`);
            totalUrlsEnqueued += await processArtistBatch(tier2Artists, db, artistsCollection);
            totalArtistsProcessed += tier2Artists.length;
        } else {
            console.log("📪 No se encontraron artistas de Nivel 2 para procesar.");
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