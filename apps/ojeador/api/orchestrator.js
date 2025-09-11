// RUTA: /apps/api/src/pages/api/orchestrator.js
// VERSIÓN FINAL Y COMPLETA DEL "INVESTIGADOR"

import { connectToDatabase } from '@/lib/database.js';
import { google } from 'googleapis';
import Groq from 'groq-sdk';

// --- Configuración ---
const TIER1_BATCH_SIZE = 5; // Lotes pequeños para ejecuciones frecuentes
const googleApiKey = process.env.GOOGLE_API_KEY;
const customSearchEngineId = process.env.GOOGLE_CX;

// --- Inicialización de Servicios ---
const customsearch = google.customsearch('v1');
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// --- Helpers ---

const searchQueries = (artistName) => {
    const currentYear = new Date().getFullYear();
    const nextYear = currentYear + 1;
    const keywords = `"actuacion" OR "recital" OR "concierto" OR "espectaculo" OR "gala" OR "festival" OR "entradas"`;
    return [
        `"${artistName}" "agenda" OR "programacion" site:deflamenco.com OR site:globalflamenco.com OR site:juntadeandalucia.es/cultura/flamenco`,
        `"${artistName}" "entradas" OR "tickets" site:ticketmaster.es OR site:elcorteingles.es OR site:dice.fm`,
        `"${artistName}" (${keywords} OR "gira ${currentYear}" OR "gira ${nextYear}") -site:facebook.com -site:instagram.com -site:twitter.com`
    ];
};

async function extractCluesFromUrl(urlToAnalyze) {
    try {
        const prompt = `
# CONTEXTO
Eres un asistente de IA experto en SEO y análisis de URLs, especializado en eventos de flamenco.
# TAREA
Analiza la siguiente URL. Extrae las palabras clave o "slugs" más relevantes que podrían usarse para encontrar otros eventos relacionados. Ignora palabras genéricas como "www", "https://", ".com", ".es", "es", "evento", "agenda".
# REGLAS
1. Identifica nombres de festivales, artistas, tablaos o ciudades.
2. Limpia los "slugs": reemplaza guiones ("-") por espacios.
3. Devuelve el resultado como un objeto JSON con una clave "clues" que contenga un array de strings. Si no encuentras nada, el array debe estar vacío.
# FORMATO DE SALIDA
\`\`\`json
{
  "clues": ["palabra clave 1", "palabra clave 2"]
}
\`\`\`
# URL A ANALIZAR
${urlToAnalyze}
`;
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
    const { db } = await connectToDatabase('main');

    try {
        const artistsCollection = db.collection('artists');
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
        if (initialUrls.size > 0) {
            const cluePromises = Array.from(initialUrls).map(url => extractCluesFromUrl(url));
            const cluesResults = await Promise.all(cluePromises);
            const discoveredClues = new Set(cluesResults.flat());

            console.log(`🧠 Fase 2 completada. ${discoveredClues.size} pistas únicas extraídas de las URLs.`);

            if (discoveredClues.size > 0) {
                for (const clue of discoveredClues) {
                    if (clue.length > 3) {
                        allGeneratedQueries.add(`"${clue}" programacion OR cartel OR entradas`);
                    }
                }
            }
        }

        const finalQueries = Array.from(allGeneratedQueries);
        console.log(`✅ ${finalQueries.length} consultas de búsqueda finales generadas.`);

        return { message: 'Proceso de preparación de búsquedas finalizado.', searchQueries: finalQueries };

    } catch (error) {
        console.error('💥 Error fatal en el Orquestador:', error);
        throw error;
    }
    // La conexión a la base de datos es gestionada por el helper, no necesitamos cerrarla aquí.
}

// --- Endpoint para Vercel ---
export default async function handler(req, res) {
    try {
        const executionDetails = await findAndPrepareSearches();
        res.status(200).json({ status: 'success', details: executionDetails });
    } catch (error) {
        res.status(500).json({ status: 'error', message: error.message });
    }
};