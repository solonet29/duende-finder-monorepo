// backfill-future-posts.js
// OBJETIVO: Encontrar eventos futuros con contenido de blog antiguo,
// regenerarlo con el nuevo prompt y actualizar el post en WordPress.

require('dotenv').config();
const { connectToDatabase, closeDatabaseConnection } = require('./lib/database.js');
const { updateWordPressPost } = require('./lib/wordpressClient.js');
const { ObjectId } = require('mongodb');
const Groq = require('groq-sdk');
const showdown = require('showdown');
const config = require('./config.js');

// --- INICIALIZACIÓN DE SERVICIOS ---
if (!process.env.GROQ_API_KEY) throw new Error('GROQ_API_KEY no está definida.');
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const GROQ_MODEL = 'llama-3.1-8b-instant';
const converter = new showdown.Converter();
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// --- CONFIGURACIÓN ---
const today = new Date();
const todayString = today.toISOString().split('T')[0];

// Buscamos eventos futuros, que ya tengan un post en WordPress,
// pero que NO tengan el campo `blogPostMarkdown` (marcador de la lógica antigua).
const QUERY = {
    wordpressPostId: { $exists: true, $ne: null },
    date: { $gte: todayString },
    blogPostMarkdown: { $exists: false }
};
const BATCH_SIZE = 10; // Un lote pequeño para no sobrecargar la API

async function backfillPosts() {
    console.log("--- 🔄 INICIANDO BACKFILL DE CONTENIDO DE BLOG ---");
    const db = await connectToDatabase();
    const eventsCollection = db.collection('events');

    try {
        console.log("🔎 Buscando eventos futuros con contenido de blog antiguo...");
        const eventsToUpdate = await eventsCollection.find(QUERY).limit(BATCH_SIZE).toArray();

        if (eventsToUpdate.length === 0) {
            console.log("✅ No se encontraron posts para actualizar. ¡Trabajo hecho!");
            return;
        }

        console.log(`⚙️ Se encontraron ${eventsToUpdate.length} posts para regenerar en este lote.`);

        for (const event of eventsToUpdate) {
            console.log(`
-----------------------------------------------------`);
            console.log(`🔄 Regenerando contenido para: "${event.name}" (Post ID: ${event.wordpressPostId})`);

            try {
                // 1. Generar el nuevo contenido de texto con la IA
                console.log(`   -> ✍️  Generando nuevo paquete de texto...`);
                const prompt = config.prompts.generateFullContentPackage(event);
                const chatCompletion = await groq.chat.completions.create({
                    messages: [{ role: "user", content: prompt }],
                    model: GROQ_MODEL,
                    response_format: { type: "json_object" },
                });
                const responseText = chatCompletion.choices[0]?.message?.content || '{}';
                const generatedContent = JSON.parse(responseText);

                if (!generatedContent.blogTitle || !generatedContent.blogPostMarkdown) {
                    throw new Error('La respuesta de la IA no incluyó los campos de blog esperados.');
                }
                console.log(`   ✅ Nuevo contenido de texto generado.`);

                // 2. Preparar los datos para la actualización de WordPress
                const newHtmlBody = converter.makeHtml(generatedContent.blogPostMarkdown);
                // Asumimos que los bloques de intro/CTA no han cambiado y los re-aplicamos
                const introHtml = config.htmlBlocks.postIntro(event);
                const ctaHtml = config.htmlBlocks.ctaBanners;
                const finalHtmlContent = introHtml + newHtmlBody + ctaHtml;

                const updateData = {
                    title: generatedContent.blogTitle,
                    content: finalHtmlContent,
                };

                // 3. Llamar a la API de WordPress para actualizar el post.
                const result = await updateWordPressPost(event.wordpressPostId, updateData);

                // 4. Actualizar el evento en MongoDB
                if (result) {
                    console.log(`   ✅ Post actualizado en WordPress con éxito.`);
                    await eventsCollection.updateOne(
                        { _id: new ObjectId(event._id) },
                        {
                            $set: {
                                blogPostTitle: generatedContent.blogTitle,
                                blogPostMarkdown: generatedContent.blogPostMarkdown,
                                blogPostHtml: finalHtmlContent,
                                contentRefreshedDate: new Date()
                            }
                        }
                    );
                    console.log(`   ✅ Evento actualizado en MongoDB.`);
                }
                 await delay(1000); // Pequeña pausa para no saturar las APIs
            } catch (error) {
                console.error(`   ❌ Error al procesar el post de "${event.name}":`, error.message);
            }
        }
    } catch (error) {
        console.error("Ha ocurrido un error fatal durante el backfill:", error);
    } finally {
        await closeDatabaseConnection();
        console.log("\n--- ✨ PROCESO DE BACKFILL FINALIZADO ---");
    }
}

backfillPosts();
