// enrich-events.js
// OBJETIVO: Tomar eventos con estado 'pending' y enriquecerlos con un paquete de contenido completo (texto e imagen).

require('dotenv').config();
const { connectToDatabase } = require('./lib/database.js');
const Groq = require('groq-sdk');
const { ObjectId } = require('mongodb');
const showdown = require('showdown');
const config = require('./config.js');
const { generateAndUploadImage } = require('./image-enricher.js'); // <-- Importar la nueva función

// --- INICIALIZACIÓN DE SERVICIOS ---
if (!process.env.GROQ_API_KEY) throw new Error('GROQ_API_KEY no está definida.');
const groq = new Groq({
    apiKey: process.env.GROQ_API_KEY
});
const GROQ_MODEL = 'llama-3.1-8b-instant';
const converter = new showdown.Converter();

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function enrichEvents() {
    const db = await connectToDatabase();
    const eventsCollection = db.collection('events');

    // Obtener la fecha de hoy en formato YYYY-MM-DD para la consulta.
    const today = new Date();
    const todayString = today.toISOString().split('T')[0];

    // Buscamos eventos validados por el ingestor que estén pendientes de creación de contenido.
    const query = {
        contentStatus: 'pending',
        blogPostTitle: { $exists: false },
        date: { $gte: todayString } // Solo procesar eventos futuros o de hoy.
    };

    // Ordenamos por ID descendente para procesar los más recientes primero.
    const eventsToProcess = await eventsCollection.find(query)
        .sort({ _id: -1 })
        .limit(config.ENRICH_BATCH_SIZE)
        .toArray();

    if (eventsToProcess.length === 0) {
        console.log("✅ No se encontraron eventos nuevos para enriquecer.");
        return;
    }

    console.log(`⚙️ Se encontraron ${eventsToProcess.length} eventos para enriquecer.`);

    for (const event of eventsToProcess) {
        // Normalizar el objeto del evento para asegurar que `name` siempre exista.
        if (event.title && !event.name) {
            event.name = event.title;
        }

        // Normalizar el objeto del artista para asegurar que `artist` sea un string.
        if (typeof event.artist === 'object' && event.artist !== null && event.artist.name) {
            event.artist = event.artist.name;
        }

        try {
            console.log(`   -> Enriqueciendo: "${event.name}".`);

            // PASO 1: Generar contenido de texto
            console.log(`      -> ✍️  Generando paquete de texto...`);
            const MAX_RETRIES = 3;
            const RETRY_DELAY = 5000;
            let generatedContentPackage = null;
            let lastError = null;

            for (let i = 0; i < MAX_RETRIES; i++) {
                try {
                    const prompt = config.prompts.generateFullContentPackage(event);
                    const chatCompletion = await groq.chat.completions.create({
                        messages: [{ role: "user", content: prompt }],
                        model: GROQ_MODEL,
                        response_format: { type: "json_object" },
                    });
                    
                    const responseText = chatCompletion.choices[0]?.message?.content || '{}';
                    const parsedResponse = JSON.parse(responseText);

                    if (parsedResponse.blogTitle && parsedResponse.nightPlanMarkdown && parsedResponse.tweetText && parsedResponse.instagramText) {
                        generatedContentPackage = parsedResponse;
                        lastError = null;
                        break; 
                    } else {
                        throw new Error('La respuesta JSON de la IA no contiene todos los campos esperados.');
                    }

                } catch (error) {
                    lastError = error;
                    console.warn(`      ⚠️ Intento de texto ${i + 1}/${MAX_RETRIES} fallido. Reintentando...`);
                    if (i < MAX_RETRIES - 1) await delay(RETRY_DELAY);
                }
            }

            if (lastError) throw lastError;
            console.log(`      ✅ Textos generados.`);

            // PASO 2: Generar y subir la imagen
            const imageData = await generateAndUploadImage(event);
            if (!imageData) {
                throw new Error('El proceso de generación de imagen falló y es un paso crítico.');
            }

            // PASO 3: Combinar y guardar todo
            const nightPlanHtml = converter.makeHtml(generatedContentPackage.nightPlanMarkdown);
            const introHtml = config.htmlBlocks.postIntro(event);
            const ctaHtml = config.htmlBlocks.ctaBanners;
            const finalHtmlContent = introHtml + nightPlanHtml + ctaHtml;

            const updates = {
                blogPostTitle: generatedContentPackage.blogTitle,
                nightPlanMarkdown: generatedContentPackage.nightPlanMarkdown,
                blogPostHtml: finalHtmlContent,
                tweetText: generatedContentPackage.tweetText,
                instagramText: generatedContentPackage.instagramText,
                imageId: imageData.imageId,
                imageUrl: imageData.imageUrl,
                contentGenerationDate: new Date(),
                contentStatus: 'content_ready',
                notificationStatus: 'pending' // <-- NUEVO: Marcar para notificación.
            };

            await eventsCollection.updateOne({ _id: new ObjectId(event._id) }, { $set: updates });
            console.log(`   💾 Paquete de contenido COMPLETO para "${event.name}" guardado.`);

        } catch (error) {
            console.error(`   ❌ Error fatal enriqueciendo "${event.name}":`, error.message);
            await eventsCollection.updateOne({ _id: new ObjectId(event._id) }, { $set: { contentStatus: 'enrichment_failed' } });
        }
    }
}

module.exports = { enrichEvents };

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