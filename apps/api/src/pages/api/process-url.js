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
    const currentYear = new Date().getFullYear();
    return `
    Tu tarea es actuar como un asistente experto en extracción de datos de eventos de flamenco.
    Analiza el siguiente contenido de la URL "${url}" para encontrar los próximos conciertos o actuaciones en vivo del artista "${artistName}".
    El año de referencia es ${currentYear}. Extrae únicamente eventos que ocurran en ${currentYear} o en años posteriores.
    Devuelve un array JSON de objetos de evento bajo la clave "events". Si no hay eventos, devuelve { "events": [] }.
    El esquema del objeto es: { "name": "...", "description": "...", "date": "YYYY-MM-DD", "time": "HH:MM", "venue": "...", "city": "...", "country": "..." }.
    Ignora talleres, clases o eventos pasados. Asegúrate de que la fecha es completa.
    Contenido a analizar:
    ${content}
    `;
};