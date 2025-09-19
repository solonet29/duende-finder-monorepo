// enrich-events.js
// OBJETIVO: Tomar eventos con estado 'pending' y enriquecerlos con un paquete de contenido completo (texto e imagen).

require('dotenv').config();
const { connectToDatabase } = require('./lib/database.js');
const { ObjectId } = require('mongodb');
const showdown = require('showdown');
const config = require('./config.js');
const { generateAndUploadImage } = require('./image-enricher.js');
const { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } = require('@google/generative-ai');

// --- INICIALIZACIÓN DE SERVICIOS ---
if (!process.env.GEMINI_API_KEY) throw new Error('GEMINI_API_KEY no está definida.');
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const geminiModel = genAI.getGenerativeModel({ model: "gemini-1.5-flash"});
const converter = new showdown.Converter();

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// --- PROMPT PARA GEMINI ---
const contentGenerationPrompt = (event) => `
Tu tarea es actuar como un experto en marketing de eventos de flamenco y generar un paquete de contenido completo para el siguiente evento.
La respuesta DEBE ser un único objeto JSON válido con la siguiente estructura y NADA MÁS:
{
  "blogTitle": "string",
  "blogPostMarkdown": "string",
  "nightPlanMarkdown": "string",
  "urlSlug": "string"
}

Aquí están los detalles del evento:
- Nombre: ${event.name}
- Artista: ${event.artist || 'Artista por confirmar'}
- Ciudad: ${event.city}
- Lugar: ${event.venue || 'Lugar por confirmar'}
- Fecha: ${event.date}
- Hora: ${event.time}

Instrucciones para cada campo del JSON:

1.  **blogTitle**: Crea un título SEO amigable y atractivo para un post de blog sobre el evento. Máximo 70 caracteres.

2.  **blogPostMarkdown**: Escribe un artículo para el blog sobre el evento. El tono debe ser evocador y periodístico. El objetivo es generar expectación. El texto debe tener al menos 250 palabras y estar estructurado en varios párrafos. Enfócate en:
    - Introducción: Presenta al artista y su importancia.
    - Desarrollo: Describe la propuesta artística del espectáculo.
    - Conclusión: Cierra con una invitación a vivir la experiencia.

3.  **nightPlanMarkdown**: Genera un "plan de noche" en formato Markdown. Debe ser útil y evocador. Sigue esta estructura concisa:
    ### La Previa: Ambiente y Sabor
    Sugiere un tipo de ambiente para tapear antes del evento (sin dar nombres de locales).
    ### El Evento: ${event.name}
    Crea expectación sobre el espectáculo.
    ### Post-Espectáculo: La Última Copa
    Sugiere un tipo de lugar para tomar una copa después (sin dar nombres de locales).

4.  **urlSlug**: Crea un slug para la URL a partir del nombre del artista y el nombre del evento. Debe estar en minúsculas, usar guiones en lugar de espacios, y no tener más de 6-7 palabras clave relevantes. No incluyas la fecha ni la ciudad.
`;

async function generateContentForEvent(event, db) {
    const eventsCollection = db.collection('events');

    // Normalizar datos del evento
    if (event.title && !event.name) event.name = event.title;
    if (typeof event.artist === 'object' && event.artist !== null && event.artist.name) event.artist = event.artist.name;

    try {
        console.log(`   -> Enriqueciendo: "${event.name}" con Gemini.`);

        // PASO 1: Generar contenido de texto con Gemini
        console.log(`      -> ✍️  Generando paquete de texto con Gemini...`);
        const prompt = contentGenerationPrompt(event);
        const result = await geminiModel.generateContent(prompt);
        const responseText = result.response.text().replace(/```json|```/g, '').trim();
        const generatedContentPackage = JSON.parse(responseText);

        if (!generatedContentPackage.blogTitle || !generatedContentPackage.blogPostMarkdown || !generatedContentPackage.nightPlanMarkdown || !generatedContentPackage.urlSlug) {
            throw new Error('La respuesta JSON de Gemini no contiene todos los campos esperados.');
        }
        console.log(`      ✅ Textos generados por Gemini.`);

        // PASO 2: Generar y subir la imagen (sin cambios)
        const imageData = await generateAndUploadImage(event);
        if (!imageData) {
            throw new Error('El proceso de generación de imagen falló.');
        }

        // PASO 3: Combinar y guardar todo
        const blogPostContentHtml = converter.makeHtml(generatedContentPackage.blogPostMarkdown);
        const finalHtmlContent = blogPostContentHtml; // Simplificado, se pueden añadir bloques HTML si se desea

        const updates = {
            blogPostTitle: generatedContentPackage.blogTitle,
            blogPostMarkdown: generatedContentPackage.blogPostMarkdown,
            slug: generatedContentPackage.urlSlug, // <-- AÑADIDO EL NUEVO SLUG
            eventSummaryMarkdown: generatedContentPackage.eventSummaryMarkdown,
            nightPlanMarkdown: generatedContentPackage.nightPlanMarkdown,
            nightPlan: generatedContentPackage.nightPlanMarkdown, // Guardamos también en el campo que usa el API
            blogPostHtml: finalHtmlContent,
            imageId: imageData.imageId,
            imageUrl: imageData.imageUrl,
            contentGenerationDate: new Date(),
            contentStatus: 'content_ready',
        };

        await eventsCollection.updateOne({ _id: new ObjectId(event._id) }, { $set: updates });
        console.log(`   💾 Paquete de contenido COMPLETO para "${event.name}" guardado.`);

        return await eventsCollection.findOne({ _id: new ObjectId(event._id) });

    } catch (error) {
        console.error(`   ❌ Error fatal enriqueciendo "${event.name}" con Gemini:`, error.message);
        await eventsCollection.updateOne({ _id: new ObjectId(event._id) }, { $set: { contentStatus: 'enrichment_failed' } });
        return await eventsCollection.findOne({ _id: new ObjectId(event._id) });
    }
}

async function enrichEvents() {
    const db = await connectToDatabase();
    const eventsCollection = db.collection('events');
    
    const today = new Date();
    const todayString = today.toISOString().split('T')[0];

    const query = {
        contentStatus: 'pending_enrichment',
        date: { $gte: todayString }
    };

    const eventsToProcess = await eventsCollection.find(query)
        .sort({ _id: -1 })
        .limit(config.ENRICH_BATCH_SIZE)
        .toArray();

    if (eventsToProcess.length === 0) {
        console.log("✅ No se encontraron eventos nuevos para enriquecer.");
        return;
    }

    console.log(`⚙️ Se encontraron ${eventsToProcess.length} eventos para enriquecer con Gemini.`);

    for (const event of eventsToProcess) {
        await generateContentForEvent(event, db);
    }
}

module.exports = { enrichEvents, generateContentForEvent };

if (require.main === module) {
    console.log("Ejecutando el enriquecedor de eventos de forma manual...");
    enrichEvents()
        .catch(err => {
            console.error("Ocurrió un error durante el enriquecimiento manual:", err);
            process.exit(1);
        })
        .finally(async () => {
            console.log("Proceso de enriquecimiento manual finalizado.");
            const { closeDatabaseConnection } = require('./lib/database.js');
            await closeDatabaseConnection();
        });
}