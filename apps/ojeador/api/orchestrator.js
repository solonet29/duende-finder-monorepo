// /api/orchestrator.js - PRODUCTOR
// Misión: Encontrar URLs de eventos usando una estrategia de dos niveles basada en el día de la semana.

require('dotenv').config();
const { MongoClient } = require('mongodb');
const { google } = require('googleapis');
const { Client } = require('@upstash/qstash');

// --- Configuración de Lotes y Búsquedas ---
const TIER1_EVENT_COUNT_THRESHOLD = 3;
const TIER1_BATCH_SIZE = 30;
const TIER1_SEARCHES_PER_ARTIST = 4;

const TIER2_PROMISING_BATCH_SIZE = 5;
const TIER2_LOTTERY_BATCH_SIZE = 5;
const TIER2_SEARCHES_PER_ARTIST = 2;

// --- Configuración de Conexiones ---
const mongoUri = process.env.MONGO_URI;
const dbName = process.env.DB_NAME || 'DuendeDB';
const artistsCollectionName = 'artists';
const googleApiKey = process.env.GOOGLE_API_KEY;
const customSearchEngineId = process.env.GOOGLE_CX;

// --- Inicialización de Servicios ---
const qstashClient = new Client({ token: process.env.QSTASH_TOKEN });
const customsearch = google.customsearch('v1');

// --- Lógica de búsqueda (4 variaciones de alta calidad) ---
const searchQueries = (artistName) => {
    const currentYear = new Date().getFullYear();
    const nextYear = currentYear + 1;

    return [
        // Búsqueda específica en los portales de flamenco más importantes
        `"${artistName}" "agenda" OR "programacion" OR "calendario" site:deflamenco.com OR site:globalflamenco.com OR site:jondoweb.com`,

        // Búsqueda en la agenda oficial de la Junta de Andalucía
        `"${artistName}" site:juntadeandalucia.es/cultura/flamenco`,

        // Búsqueda en los grandes vendedores de entradas
        `"${artistName}" "entradas" OR "tickets" site:ticketmaster.es OR site:elcorteingles.es OR site:dice.fm`,

        // Búsqueda genérica "inteligente" con palabras clave, excluyendo fuentes de baja calidad
        `"${artistName}" "concierto" OR "actuacion" OR "recital" OR "gira ${currentYear}" OR "gira ${nextYear}" -site:facebook.com -site:instagram.com -site:twitter.com -site:biografiasyvidas.com -site:wikipedia.org`
    ];
};

// --- Helpers ---
function isUrlValid(url) {
    const forbiddenKeywords = ['biografia', 'biography', 'historia', 'history', 'discografia', 'vida-y-obra', 'about', 'sobre-el-artista', 'artist-info'];
    const lowerCaseUrl = url.toLowerCase();
    // Devuelve 'true' si la URL NO contiene ninguna palabra prohibida
    return !forbiddenKeywords.some(keyword => lowerCaseUrl.includes(keyword));
}

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
            console.log(`   -> Encontradas ${urlsToProcess.size} URLs únicas para ${artist.name}. Aplicando filtro de validez...`);

            const initialUrls = Array.from(urlsToProcess);
            const validUrls = initialUrls.filter(isUrlValid); // <-- APLICAMOS EL NUEVO FILTRO

            if (validUrls.length > 0) {
                console.log(`   -> ${validUrls.length} URLs válidas restantes. Encolando...`);

                const destinationUrl = `${process.env.QSTASH_DESTINATION_URL}/api/process-url`;
                // Importante: Ahora usamos 'validUrls' para crear los mensajes
                const messages = validUrls.map(url => ({
                    url: destinationUrl,
                    body: JSON.stringify({
                        url: url,
                        artistName: artist.name,
                        artistId: artist._id.toString()
                    })
                }));

                try {
                    const response = await qstashClient.batch(messages);
                    urlsEnqueuedInBatch += messages.length;
                    const messageIds = response.map(r => r.messageId).join(', ');
                    console.log(`   ✅ ${messages.length} URLs encoladas con éxito en QStash. Message IDs: [${messageIds}]`);
                } catch (qstashError) {
                    console.error(`   ❌ Error al publicar en QStash para ${artist.name}: ${qstashError.message}`);
                }

            } else {
                console.log(`   -> Ninguna URL pasó el filtro de validez para ${artist.name}.`);
            }
        } else {
            console.log(`   -> No se encontraron URLs nuevas para ${artist.name} en esta ejecución.`);
        }

        await artistsCollection.updateOne({ _id: artist._id }, { $set: { lastScrapedAt: new Date() } });
        await new Promise(resolve => setTimeout(resolve, 500));
    }
    return urlsEnqueuedInBatch;
}


// --- Flujo Principal del Orquestador ---
async function findAndQueueUrls() {
    console.log('🚀 Orquestador-Productor iniciado...');
    const client = new MongoClient(mongoUri);

    try {
        await client.connect();
        const db = client.db(dbName);
        const artistsCollection = db.collection(artistsCollectionName);
        console.log("✅ Conectado a MongoDB.");

        let totalUrlsEnqueued = 0;
        let totalArtistsProcessed = 0;

        // --- INICIO: Ataque Directo a URLs de Alta Prioridad ---
        console.log('🎯 Iniciando ataque directo a URLs de alta prioridad...');
        const highPriorityUrls = [
            { url: 'https://www.corraldelamoreria.com/espectaculos-y-eventos/', artistName: 'Corral de la Morería' },
            { url: 'https://www.tablaoelarenal.com/espectaculos-flamenco-sevilla.html', artistName: 'Tablao El Arenal' },
            { url: 'https://www.juntadeandalucia.es/cultura/flamenco/actividades', artistName: 'Junta de Andalucía' }
        ];

        const destinationUrl = `${process.env.QSTASH_DESTINATION_URL}/api/process-url`;
        const directMessages = highPriorityUrls.map(item => ({
            url: destinationUrl,
            body: JSON.stringify({
                url: item.url,
                artistName: item.artistName,
                artistId: 'direct-scrape' // ID especial para estos scrapes
            })
        }));

        try {
            if (directMessages.length > 0) {
                const response = await qstashClient.batch(directMessages);
                totalUrlsEnqueued += directMessages.length;
                const messageIds = response.map(r => r.messageId).join(', ');
                console.log(`   ✅ ${directMessages.length} URLs de alta prioridad encoladas con éxito. Message IDs: [${messageIds}]`);
            }
        } catch (qstashError) {
            console.error(`   ❌ Error al encolar URLs de alta prioridad en QStash: ${qstashError.message}`);
        }
        // --- FIN: Ataque Directo ---

        // --- Lógica condicional basada en el día de la semana ---
        console.log('🧠 Iniciando búsqueda basada en artistas y día de la semana...');
        const dayOfWeek = new Date().getDay(); // Domingo=0, Lunes=1, Martes=2, ...
        let artistsToProcess = [];
        const validNameFilter = { name: { $exists: true, $ne: null, $ne: "" } };

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

            const promisingQuery = { ...validNameFilter, eventCount: { $in: [1, 2] } };
            const promisingArtists = await artistsCollection.aggregate([{ $match: promisingQuery }, { $sample: { size: TIER2_PROMISING_BATCH_SIZE } }]).toArray();
            console.log(`   -> Encontrados ${promisingArtists.length} artistas 'prometedores'.`);

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

        console.log(`
🎉 Orquestador-Productor finalizado. Total de URLs encoladas: ${totalUrlsEnqueued}. Artistas procesados: ${totalArtistsProcessed}.`);
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