// RUTA: apps/ojeador/api/orchestrator.js
// VERSIÓN FINAL Y COMPLETA DEL "INVESTIGADOR"

const fs = require('fs');
const path = require('path');
require('dotenv').config();
const { MongoClient } = require('mongodb');
const { google } = require('googleapis');
const Groq = require('groq-sdk');

// --- Configuración ---
const TIER1_BATCH_SIZE = 5; // Lotes pequeños para ejecuciones frecuentes
const mongoUri = process.env.MONGO_URI;
const dbName = process.env.DB_NAME || 'DuendeDB';
const artistsCollectionName = 'artists';
const googleApiKey = process.env.GOOGLE_API_KEY;
const customSearchEngineId = process.env.GOOGLE_CX;

// --- Inicialización de Servicios ---
const customsearch = google.customsearch('v1');
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// --- Helpers ---

const searchQueries = (artistName) => {
    const currentYear = new Date().getFullYear();
    const nextYear = currentYear + 1;
    return [
        `"${artistName}" "agenda" OR "programacion" site:deflamenco.com OR site:globalflamenco.com OR site:juntadeandalucia.es/cultura/flamenco`,
        `"${artistName}" "entradas" OR "tickets" site:ticketmaster.es OR site:elcorteingles.es OR site:dice.fm`,
        `"${artistName}" "concierto" OR "gira ${currentYear}" OR "gira ${nextYear}" -site:facebook.com -site:instagram.com -site:biografiasyvidas.com -site:wikipedia.org`
    ];
};

async function extractCluesFromUrl(urlToAnalyze) {
    try {
        // 1. Leemos la plantilla del prompt desde nuestro nuevo archivo de texto.
        const promptTemplatePath = path.join(process.cwd(), 'prompts', 'url_clue_extractor.prompt.txt');
        const promptTemplate = fs.readFileSync(promptTemplatePath, 'utf8');

        // 2. Reemplazamos la variable en la plantilla con la URL real.
        const prompt = promptTemplate.replace('{URL_A_ANALIZAR}', urlToAnalyze);

        // 3. El resto de la lógica es la misma.
        const chatCompletion = await groq.chat.completions.create({
            messages: [{ role: 'user', content: prompt }],
            model: 'llama-3.1-8b-instant',
            response_format: { type: "json_object" },
        });
        const responseText = chatCompletion.choices[0]?.message?.content || '{"clues":[]}';
        const parsed = JSON.parse(responseText);
        return Array.isArray(parsed.clues) ? parsed.clues : [];
    } catch (error) {
        console.error(`   -> ⚠️ Error analizando la URL ${urlToAnalyze}:`, error.message);
        return [];
    }
}

// --- Flujo Principal del Orquestador ---
async function findAndPrepareSearches() {
    console.log('🚀 Estratega de Búsqueda iniciado...');
    const client = new MongoClient(mongoUri);

    try {
        await client.connect();
        const db = client.db(dbName);
        const artistsCollection = db.collection(artistsCollectionName);
        console.log("✅ Conectado a MongoDB.");

        const artistsToProcess = await artistsCollection.find({ name: { $exists: true, $ne: null, $ne: "" } })
            .sort({ lastScrapedAt: 1 }).limit(TIER1_BATCH_SIZE).toArray();

        if (artistsToProcess.length === 0) {
            console.log("📪 No se encontraron artistas para procesar.");
            return { message: "No hay artistas para preparar.", searchQueries: [] };
        }
        console.log(`🔍 Lote de ${artistsToProcess.length} artistas obtenido.`);

        let allGeneratedQueries = new Set();
        let initialUrls = new Set();

        // FASE 1: Búsqueda Inicial
        for (const artist of artistsToProcess) {
            const initialQueries = searchQueries(artist.name);
            initialQueries.forEach(q => allGeneratedQueries.add(q));

            const searchPromises = initialQueries.map(query =>
                customsearch.cse.list({ cx: customSearchEngineId, q: query, auth: googleApiKey, num: 2 })
                    .then(res => (res.data.items || []).forEach(item => initialUrls.add(item.link)))
                    .catch(err => console.error(`   ❌ Error en búsqueda inicial para "${artist.name}": ${err.message}`))
            );
            await Promise.all(searchPromises);
        }
        console.log(`📄 Fase 1 completada. ${initialUrls.size} URLs iniciales encontradas.`);

        // FASE 2: Análisis de Pistas y Búsqueda Secundaria
        const cluePromises = Array.from(initialUrls).map(url => extractCluesFromUrl(url));
        const cluesResults = await Promise.all(cluePromises);
        const discoveredClues = new Set(cluesResults.flat());

        console.log(`🧠 Fase 2 completada. ${discoveredClues.size} pistas únicas extraídas de las URLs.`);

        if (discoveredClues.size > 0) {
            for (const clue of discoveredClues) {
                if (clue.length > 3) { // Evitar pistas demasiado cortas
                    allGeneratedQueries.add(`"${clue}" programacion OR cartel OR entradas`);
                }
            }
        }

        const finalQueries = Array.from(allGeneratedQueries);
        console.log(`✅ ${finalQueries.length} consultas de búsqueda finales generadas.`);

        return { message: 'Proceso de preparación de búsquedas finalizado.', searchQueries: finalQueries };

    } catch (error) {
        console.error('💥 Error fatal en el Orquestador:', error);
        throw error;
    } finally {
        await client.close();
        console.log("🔚 Conexión con MongoDB cerrada.");
    }
}

// Endpoint para Vercel (Serverless Function)
export default async function handler(req, res) {
    try {
        const executionDetails = await findAndPrepareSearches();
        res.status(200).json({ status: 'success', details: executionDetails });
    } catch (error) {
        res.status(500).json({ status: 'error', message: error.message });
    }
}