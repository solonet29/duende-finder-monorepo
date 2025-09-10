// /api/orchestrator.js - ESTRATEGA DE BÚSQUEDA
// Misión: Generar una lista de consultas de búsqueda de Google optimizadas para un operador humano.

require('dotenv').config();
const { MongoClient } = require('mongodb');
const { google } = require('googleapis');
const Groq = require('groq-sdk');

// --- Configuración de Lotes y Búsquedas ---
const TIER1_EVENT_COUNT_THRESHOLD = 3;
const TIER1_BATCH_SIZE = 15; // Reducido para una ejecución más rápida y enfocada
const TIER2_PROMISING_BATCH_SIZE = 5;
const TIER2_LOTTERY_BATCH_SIZE = 5;

// --- Configuración de Conexiones ---
const mongoUri = process.env.MONGO_URI;
const dbName = process.env.DB_NAME || 'DuendeDB';
const artistsCollectionName = 'artists';
const googleApiKey = process.env.GOOGLE_API_KEY;
const customSearchEngineId = process.env.GOOGLE_CX;

// --- Inicialización de Servicios ---
const customsearch = google.customsearch('v1');
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });


// --- Helpers ---

/**
 * Genera las consultas de búsqueda iniciales para un artista.
 */
const searchQueries = (artistName) => {
    const currentYear = new Date().getFullYear();
    const nextYear = currentYear + 1;
    return [
        `"${artistName}" "agenda" OR "programacion" site:deflamenco.com OR site:globalflamenco.com OR site:juntadeandalucia.es/cultura/flamenco`,
        `"${artistName}" "entradas" OR "tickets" site:ticketmaster.es OR site:elcorteingles.es OR site:dice.fm`,
        `"${artistName}" "concierto" OR "gira ${currentYear}" -site:facebook.com -site:instagram.com -site:wikipedia.org`
    ];
};

/**
 * Usa la IA para analizar una URL y extraer pistas (palabras clave).
 */
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
3. Devuelve el resultado como un array JSON de strings bajo la clave "clues". Si no encuentras nada, devuelve { "clues": [] }.
# FORMATO DE SALIDA
` + '```json
{ 