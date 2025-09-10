// RUTA: /src/pages/api/process-url.js
// VERSIÓN FINAL CON FRENO DE SEGURIDAD (SLEEP) PARA RATE LIMITING

import { verifySignature } from "@upstash/qstash/nextjs";
import { connectToDatabase } from '@/lib/database.js';
import Groq from 'groq-sdk';
import axios from 'axios';
import * as cheerio from 'cheerio';

// --- CONFIGURACIÓN ---
// Desactivamos el bodyParser automático de Next.js para leer el body crudo
export const config = {
    api: {
        bodyParser: false,
    },
};

// --- SERVICIOS ---
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// --- HELPERS ---

// ▼▼▼ FUNCIÓN AÑADIDA ▼▼▼
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
// ▲▲▲ FIN DE LA FUNCIÓN AÑADIDA ▲▲▲

// Función para leer el body crudo, necesaria para la verificación de firma
async function parseRawBody(req) {
    const chunks = [];
    for await (const chunk of req) {
        chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
    }
    const bodyBuffer = Buffer.concat(chunks);
    return {
        raw: bodyBuffer.toString(),
        json: JSON.parse(bodyBuffer.toString() || '{}')
    };
}

// Función para limpiar el HTML antes de enviarlo a la IA
function cleanHtmlForAI(html) {
    const $ = cheerio.load(html);
    $('script, style, nav, footer, header, aside, form, iframe').remove();
    return $('body').text().replace(/\s\s+/g, ' ').trim().substring(0, 15000);
}

// --- LÓGICA PRINCIPAL ---
export default async function handler(req, res) {
    if (req.method !== 'POST') {
        res.setHeader('Allow', ['POST']);
        return res.status(405).end(`Method ${req.method} Not Allowed`);
    }

    try {
        const { raw, json: body } = await parseRawBody(req);

        // Reactivamos la verificación de firma de QStash (SEGURIDAD)
        await verifySignature({
            body: raw,
            signature: req.headers["upstash-signature"],
            signingKey: process.env.QSTASH_CURRENT_SIGNING_KEY,
        });

        console.log("✅ Firma de QStash verificada. Body recibido:", body);

        const { url, artistName, artistId } = body;
        if (!url || !artistName || !artistId) {
            return res.status(400).send('Faltan url, artistName o artistId en el cuerpo de la petición.');
        }

        console.log(`🤖 Procesando URL: ${url} para el artista ${artistName}`);

        // --- Lógica de Scraping y Extracción con IA ---
        const pageResponse = await axios.get(url, { timeout: 15000 });
        const cleanedContent = cleanHtmlForAI(pageResponse.data);

        if (cleanedContent.length < 100) {
            console.log('🟡 Contenido demasiado corto, saltando.');
            return res.status(200).json({ success: true, message: 'Contenido demasiado corto.' });
        }

        const prompt = eventExtractionPrompt(artistName, url, cleanedContent);

        const chatCompletion = await groq.chat.completions.create({
            messages: [{ role: 'user', content: prompt }],
            model: 'llama-3.1-8b-instant',
            response_format: { type: "json_object" },
        });

        const responseText = chatCompletion.choices[0]?.message?.content || '[]';
        const eventsFromPage = JSON.parse(responseText)?.events || [];

        if (eventsFromPage.length === 0) {
            console.log(`🟡 No se encontraron eventos en ${url}.`);
            return res.status(200).json({ success: true, message: 'No se encontraron eventos.' });
        }

        console.log(`✨ La IA encontró ${eventsFromPage.length} posibles eventos en ${url}.`);

        // --- Lógica de Guardado en Base de Datos (Eficiente) ---
        const { db } = await connectToDatabase('main'); // Conexión eficiente
        const tempCollection = db.collection('temp_scraped_events');

        const eventsToInsert = eventsFromPage.filter(event => event.name && event.date && event.venue).map(event => ({
            ...event,
            sourceUrl: url,
            artistName: artistName,
            artistId: artistId,
            status: 'pending',
            createdAt: new Date(),
        }));

        if (eventsToInsert.length > 0) {
            await tempCollection.insertMany(eventsToInsert);
            console.log(`✅ ${eventsToInsert.length} nuevos eventos temporales añadidos a la base de datos.`);
        }

        // ▼▼▼ PAUSA ESTRATÉGICA AÑADIDA ▼▼▼
        // Forzamos una pequeña pausa para no saturar la API de Groq con la siguiente petición.
        await sleep(2000); // Pausa de 2 segundos
        // ▲▲▲ FIN DE LA PAUSA ▲▲▲

        res.status(200).json({ success: true, message: `URL procesada, ${eventsToInsert.length} eventos guardados.` });

    } catch (error) {
        console.error("❌ Error fatal en el worker process-url.js:", error);
        res.status(500).json({ error: "Error interno del servidor.", details: error.message });
    }
}


// No olvides definir esta función en el mismo archivo
const eventExtractionPrompt = (artistName, url, content) => {
    const currentDate = new Date().toISOString().split('T')[0];
    return `
# CONTEXTO
Eres un asistente de IA especializado en la extracción de datos estructurados (ETL) desde contenido web no estructurado. Tu dominio es el mundo del flamenco.

- FECHA_ACTUAL: ${currentDate}
- ARTISTA_OBJETIVO: ${artistName}
- URL_FUENTE: ${url}

# TAREA
Analiza el CONTENIDO_WEB proporcionado para extraer todos los eventos futuros (conciertos, actuaciones, recitales) del ARTISTA_OBJETIVO.

# REGLAS
1.  **FILTRO DE FECHA**: Extrae únicamente eventos cuya fecha de inicio sea igual o posterior a la FECHA_ACTUAL. Descarta categóricamente cualquier evento pasado.
2.  **FILTRO DE RELEVANCIA**: Extrae únicamente eventos explícitamente relacionados con el flamenco (menciones a cante, baile, toque, etc.). Si no es claro, descarta el evento.
3.  **FILTRO DE TIPO DE EVENTO**: Ignora talleres, clases, cursos, entrevistas o eventos online.
4.  **RIGOR DE DATOS**: No inventes información. Si un campo no puede ser extraído, usa los valores por defecto del esquema. La fecha DEBE ser completa (año, mes y día).
5.  **GENERACIÓN DE ID**: El campo "id" debe generarse en minúsculas, sin acentos, uniendo artista, ciudad y fecha (YYYY-MM-DD) con guiones. Ejemplo: "miguel-poveda-sevilla-2025-10-20".

# FORMATO DE SALIDA
Tu respuesta debe ser ÚNICAMENTE un bloque de código con un array JSON válido bajo la clave "events". No incluyas explicaciones ni texto adicional. Si no encuentras eventos, devuelve 
    { "events": [] }.

El esquema para cada objeto debe ser:
{
    "id": "string (generado según la REGLA 5)",
    "name": "string (nombre del evento; si no existe, usa el nombre del artista)",
    "artist": "string (el ARTISTA_OBJETIVO)",
    "description": "string (descripción concisa, máx 150 caracteres)",
    "date": "string (formato YYYY-MM-DD, OBLIGATORIO)",
    "time": "string (formato HH:MM, usa '00:00' como defecto)",
    "venue": "string (nombre del recinto, OBLIGATORIO)",
    "city": "string (ciudad del evento, OBLIGATORIO)",
    "country": "string (país del evento)",
    "address": "string (dirección postal completa, si se encuentra)",
    "location": { "type": "Point", "coordinates": [] },
    "verified": false,
    "referenceURL": "string (la URL_FUENTE)"
}

# CONTENIDO A ANALIZAR
${content}
`;
};