// enrich-events.js
// OBJETIVO: Tomar eventos con estado 'pending' y enriquecerlos con un paquete de contenido completo (texto, imagen y posts para redes sociales).

require('dotenv').config();
const dataProvider = require('./lib/data-provider');
const showdown = require('showdown');
const config = require('./config.js');
const { generateAndUploadImage } = require('./image-enricher.js');
const genai = require('@google/genai');

// --- INICIALIZACIÓN DE SERVICIOS ---
if (!process.env.GEMINI_API_KEY) throw new Error('GEMINI_API_KEY no está definida.');
const genAI = new genai.GoogleGenAI(process.env.GEMINI_API_KEY);
const geminiModel = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
const converter = new showdown.Converter();

// --- PROMPT PARA GEMINI (sin cambios) ---
const contentGenerationPrompt = (event) => `...`; // El prompt se mantiene igual

async function generateContentForEvent(event) {
    // Normalizar datos del evento
    if (event.title && !event.name) event.name = event.title;
    if (typeof event.artist === 'object' && event.artist !== null && event.artist.name) event.artist = event.artist.name;

    try {
        console.log(`   -> Enriqueciendo: "${event.name}" con Gemini.`);

        // PASO 1: Generar contenido de texto con Gemini
        console.log(`      -> ✍️  Generando paquete de texto con Gemini...`);
        const prompt = contentGenerationPrompt(event);
        const result = await geminiModel.generateContent(prompt);
        const response = await result.response;
        const responseText = response.text().replace(/```json|```/g, '').trim();
        const generatedContentPackage = JSON.parse(responseText);

        if (!generatedContentPackage.blogTitle || !generatedContentPackage.blogPostMarkdown || !generatedContentPackage.nightPlanMarkdown || !generatedContentPackage.urlSlug || !generatedContentPackage.tweetText || !generatedContentPackage.instagramText || !generatedContentPackage.hashtags) {
            throw new Error('La respuesta JSON de Gemini no contiene todos los campos esperados.');
        }
        console.log(`      ✅ Textos generados por Gemini.`);

        // PASO 2: Generar y subir la imagen
        const imageData = await generateAndUploadImage(event);
        if (!imageData) {
            throw new Error('El proceso de generación de imagen falló.');
        }

        // PASO 3: Combinar y guardar todo
        const blogPostContentHtml = converter.makeHtml(generatedContentPackage.blogPostMarkdown);

        const finalContentPackage = {
            blogPostTitle: generatedContentPackage.blogTitle,
            blogPostMarkdown: generatedContentPackage.blogPostMarkdown,
            slug: generatedContentPackage.urlSlug,
            nightPlanMarkdown: generatedContentPackage.nightPlanMarkdown,
            nightPlan: generatedContentPackage.nightPlanMarkdown, // Duplicado para compatibilidad
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

        // Usamos el dataProvider para actualizar el evento
        await dataProvider.updateEventWithContent(event.id || event._id.toString(), finalContentPackage);
        console.log(`   💾 Paquete de contenido COMPLETO para "${event.name}" guardado.`);

    } catch (error) {
        console.error(`   ❌ Error fatal enriqueciendo "${event.name}" con Gemini:`, error.message);
        // Opcional: se podría añadir una función al dataProvider para marcar como fallido
        // await dataProvider.markEventAsFailed(event.id || event._id.toString());
    }
}

async function enrichEvents() {
    // Usamos el dataProvider para obtener los eventos
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