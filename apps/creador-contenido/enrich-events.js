// enrich-events.js
// OBJETIVO: Tomar eventos con estado 'pending' y enriquecerlos con un paquete de contenido completo.

// --- DECLARACIÓN DE DEPENDENCIAS ---
require('dotenv').config();
const dataProvider = require('./lib/data-provider');
const showdown = require('showdown');
const config = require('./config.js');
const { generateAndUploadImage } = require('./image-enricher.js');
const { GoogleGenerativeAI } = require('@google/generative-ai');

// --- INICIALIZACIÓN DE SERVICIOS ---
if (!process.env.GEMINI_API_KEY) throw new Error('La variable de entorno GEMINI_API_KEY no está definida.');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
// CORRECCIÓN: Se cambió el nombre del modelo a uno válido y recomendado como gemini-1.5-flash
const geminiModel = genAI.getGenerativeModel({ model: "models/gemini-1.5-flash" });
const converter = new showdown.Converter();

// --- PROMPT PARA GEMINI ---
const contentGenerationPrompt = (event) => `
Actúa como un experto en marketing musical y creación de contenido para redes sociales.
Tu tarea es generar un paquete de contenido para el siguiente evento musical.

**Evento:**
- Título: ${event.name}
- Artista: ${event.artist}
- Ciudad: ${event.city}
- Sala: ${event.venue}
- Fecha: ${new Date(event.date).toLocaleDateString()}

**Instrucciones:**
1.  Genera un paquete de contenido en formato JSON.
2.  El JSON debe tener la siguiente estructura:
    {
      "blogTitle": "string",
      "blogPostMarkdown": "string",
      "urlSlug": "string",
      "nightPlanMarkdown": "string",
      "tweetText": "string",
      "instagramText": "string",
      "hashtags": ["string"]
    }
3.  El contenido debe ser atractivo, informativo y optimizado para SEO y redes sociales.
4.  El urlSlug debe ser una cadena de texto corta, en minúsculas y separada por guiones, ideal para una URL.
5.  El blogPostMarkdown debe ser un artículo de blog completo sobre el evento.
6.  El nightPlanMarkdown debe ser una breve descripción de un "plan de noche" para alguien que asista al evento.
7.  El tweetText debe ser un tweet corto y atractivo para promocionar el evento.
8.  El instagramText debe ser un post para Instagram, un poco más largo que el tweet.
9.  Los hashtags deben ser relevantes para el evento y el artista.

**IMPORTANTE:** Responde únicamente con el objeto JSON, sin texto introductorio ni explicaciones adicionales. Asegúrate de que el JSON sea válido y no contenga comas al final de las listas o de los objetos.
`;

// --- LÓGICA PRINCIPAL ---

async function generateContentForEvent(event) {
    // Normalizar datos del evento
    if (event.title && !event.name) event.name = event.title;
    if (typeof event.artist === 'object' && event.artist !== null && event.artist.name) event.artist = event.artist.name;

    try {
        console.log(`  -> Enriqueciendo: "${event.name}" con Gemini.`);
        console.log(`     -> ✍️  Generando paquete de texto con Gemini...`);

        const prompt = contentGenerationPrompt(event);
        const result = await geminiModel.generateContent(prompt);
        const response = await result.response;
        const responseText = response.text().replace(/```json|```/g, '').trim();

        let generatedContentPackage;
        try {
            generatedContentPackage = JSON.parse(responseText);
        } catch (e) {
            console.error(`  ❌ Error fatal: No se pudo parsear el JSON para "${event.name}". Respuesta de Gemini:`, responseText);
            // MODIFICACIÓN: Devolvemos null en lugar de return vacío para ser más explícitos
            return null;
        }

        if (!generatedContentPackage.blogTitle || !generatedContentPackage.blogPostMarkdown) {
            throw new Error('La respuesta JSON de Gemini no contiene todos los campos esperados.');
        }
        console.log(`     ✅ Textos generados por Gemini.`);

        const imageData = await generateAndUploadImage(event);
        if (!imageData) {
            throw new Error('El proceso de generación de imagen falló.');
        }

        const blogPostContentHtml = converter.makeHtml(generatedContentPackage.blogPostMarkdown);

        const finalContentPackage = {
            blogPostTitle: generatedContentPackage.blogTitle,
            blogPostMarkdown: generatedContentPackage.blogPostMarkdown,
            slug: generatedContentPackage.urlSlug,
            nightPlan: generatedContentPackage.nightPlanMarkdown,
            blogPostHtml: blogPostContentHtml,
            social: {
                tweet: generatedContentPackage.tweetText,
                instagram: generatedContentPackage.instagramText,
                hashtags: generatedContentPackage.hashtags,
            },
            imageId: imageData.imageId,
            imageUrl: imageData.imageUrl,
            socialImageId: imageData.socialImageId,
            socialImageUrl: imageData.socialImageUrl,
        };

        const eventId = event._id ? event._id.toString() : event.id;
        if (!eventId) {
            console.error(`  ❌ Error fatal: El evento "${event.name}" no tiene un ID válido.`);
            // MODIFICACIÓN: Devolvemos null en lugar de return vacío
            return null;
        }
        await dataProvider.updateEventWithContent(eventId, finalContentPackage);
        console.log(`  💾 Paquete de contenido COMPLETO para "${event.name}" guardado.`);

        // --- INICIO DE LA CORRECCIÓN ---
        // 1. Después de guardar, volvemos a leer el evento completo desde la base de datos.
        const updatedEvent = await dataProvider.getEventById(eventId);

        // 2. Devolvemos el objeto actualizado.
        return updatedEvent;
        // --- FIN DE LA CORRECIÓN ---

    } catch (error) {
        console.error(`  ❌ Error fatal enriqueciendo "${event.name}" con Gemini:`, error.message);
        // MODIFICACIÓN: Devolvemos null para que el llamador sepa que hubo un fallo.
        return null;
    }
}

async function enrichEvents() {
    const eventsToProcess = await dataProvider.getEventsToEnrich(config.ENRICH_BATCH_SIZE);

    if (eventsToProcess.length === 0) {
        console.log("✅ No se encontraron eventos nuevos para enriquecer.");
        return;
    }

    console.log(`⚙️ Se encontraron ${eventsToProcess.length} eventos para enriquecer con Gemini.`);

    for (const event of eventsToProcess) {
        await generateContentForEvent(event);
    }
}

module.exports = { enrichEvents, generateContentForEvent };

// --- BLOQUE DE EJECUCIÓN MANUAL ---
if (require.main === module) {
    console.log("Ejecutando el enriquecedor de eventos de forma manual...");

    (async () => {
        try {
            await dataProvider.connect();
            await enrichEvents();
        } catch (err) {
            console.error("Ocurrió un error durante el enriquecimiento manual:", err);
            process.exit(1);
        } finally {
            await dataProvider.disconnect();
            console.log("Proceso de enriquecimiento manual finalizado.");
        }
    })();
}