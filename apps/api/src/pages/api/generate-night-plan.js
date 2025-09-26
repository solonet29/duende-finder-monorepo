// RUTA: /src/pages/api/generate-night-plan.js

import { connectToMainDb } from '@/lib/database.js';
import { ObjectId } from 'mongodb';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { runMiddleware, corsMiddleware } from '@/lib/cors.js';

// --- INICIALIZACIÓN DE SERVICIOS ---
if (!process.env.GEMINI_API_KEY) throw new Error('GEMINI_API_KEY no está definida.');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-pro" });

// =======================================================================
// --- LÓGICA DE GENERACIÓN DE CONTENIDO ---
// =======================================================================

async function generateAndSavePlan(db, event) {
    console.log(`🔥 Generando nuevo contenido con Gemini para: ${event.name}`);

    // --- LÓGICA DE FECHAS Y ENLACE DE GOOGLE MAPS ---
    const eventDate = new Date(event.date);
    const dateOptions = { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Madrid' };
    const formattedDate = eventDate.toLocaleDateString('es-ES', dateOptions);

    const mapQuery = [
        event.name,
        event.venue,
        event.city
    ].filter(Boolean).join(', ');

    const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapQuery)}`;

    // --- LLAMADA AL PROMPT ---
    const prompt = nightPlanPromptTemplate(event, formattedDate, mapsUrl);

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const generatedContent = response.text();

    if (!generatedContent || !generatedContent.includes('---')) {
        console.warn("La respuesta de Gemini no tiene el formato esperado. Contenido recibido:", generatedContent);
        throw new Error("La respuesta de la IA no tiene el formato esperado.");
    }

    await db.collection('events').updateOne(
        { _id: event._id },
        { $set: { nightPlan: generatedContent } }
    );
    console.log(`💾 Contenido de Gemini para \"${event.name}\" guardado en la base de datos.`);
    return generatedContent;
}

// =======================================================================
// --- PROMPT MAESTRO ---
// =======================================================================
const nightPlanPromptTemplate = (event, formattedDate, mapsUrl) => `
# REGLA DE ORO: FORMATO Y ESTRUCTURA
Tu misión principal es generar una respuesta que siga ESTRICTAMENTE el formato Markdown y la estructura de 3 secciones separadas por "---". No añadas texto antes de la primera sección o después de la última. La estructura es INNEGOCIABLE.

# INSTRUCCIONES
Eres "Duende Planner", un asistente experto en flamenco y cultura andaluza. Tu objetivo es crear un plan de noche atractivo y útil para un usuario que asistirá a un evento de flamenco. El tono debe ser cercano, apasionado y un poco poético, usando lenguaje que evoque la magia del flamenco.

// --- NUEVA DIRECTRIZ DE CALIDAD ---
- **Principio de Prudencia:** Tu credibilidad es clave. Si no tienes información 100% segura sobre un dato fáctico del artista (biografía, familia, lugar de nacimiento, etc.), **NO LO INVENTES**. En su lugar, enfócate en la emoción del arte flamenco: habla del duende, la pasión, el sentimiento del cante o la fuerza del baile. Tu misión es generar expectación, no ser una enciclopedia.

# CONTEXTO DEL EVENTO
- **Artista Principal:** ${event.artist || 'Artista por confirmar'}
- **Nombre del Evento:** ${event.name}
- **Fecha:** ${formattedDate}
- **Lugar:** ${event.venue || 'Lugar por confirmar'}, ${event.city || ''}
- **Descripción:** ${event.description || 'Sin descripción detallada.'}

# ESTRUCTURA DE LA RESPUESTA (OBLIGATORIA)

### 🔮 Una Noche con Duende: ${event.artist || event.name}
* **La Previa Perfecta:** Describe el ambiente ideal para empezar la noche, como una taberna andaluza o un bar de tapas animado. Sugiere una o dos tapas y una bebida típica (ej: "un buen vino de Jerez"). Indícale al usuario que puede encontrar lugares así explorando los alrededores del recinto en el mapa. **No inventes un nombre específico para el bar.**
* **El Atuendo Ideal:** Sugiere un código de vestimenta. Debe ser elegante pero cómodo, algo que respete la ocasión sin ser excesivamente formal. Piensa en el "smart casual" con un toque andaluz.
* **El Momento Cumbre:** Describe con emoción qué puede esperar el espectador del artista o del evento. Usa lenguaje evocador. Si no tienes datos concretos del artista, aplica el "Principio de Prudencia" y habla sobre la magia del palo flamenco (si se conoce) o del flamenco en general.
* **Después de los Aplausos:** De forma similar a la previa, describe un tipo de lugar con encanto para tomar la última copa y anímale a explorar el mapa para encontrarlo. **No inventes un nombre específico.**

---
### 💡 Consejos del Duende
- **Puntualidad:** Recomienda llegar con tiempo para encontrar un buen sitio y disfrutar del ambiente previo.
- **Respeto y Silencio:** Menciona la importancia de guardar silencio durante el espectáculo para respetar a los artistas y al "duende".
- **Disfruta el Momento:** Anima al usuario a dejarse llevar por la música y la emoción.

---
### 🎟️ Ficha Rápida
- **Qué:** ${event.name}
- **Quién:** ${event.artist || 'Artista por confirmar'}
- **Cuándo:** ${formattedDate} a las ${event.time || 'hora por confirmar'}
- **Dónde:** ${event.venue || 'Lugar por confirmar'}, ${event.city || ''}
- **Cómo llegar:** [Ver en Google Maps](${mapsUrl})
`;


// --- HANDLER DE LA RUTA ---
export default async function handler(req, res) {
    await runMiddleware(req, res, corsMiddleware);

    try {
        const { eventId } = req.query;
        if (!eventId || !ObjectId.isValid(eventId)) {
            return res.status(400).json({ error: 'El ID del evento no es válido.' });
        }

        const db = await connectToMainDb();

        const eventsCollection = db.collection('events');
        const event = await eventsCollection.findOne({ _id: new ObjectId(eventId) });

        if (!event) {
            return res.status(404).json({ error: 'Evento no encontrado.' });
        }

        if (event.nightPlan) {
            console.log(`✅ Devolviendo contenido cacheado para: ${event.name}`);
            return res.status(200).json({ content: event.nightPlan, source: 'cache' });
        }

        const generatedContent = await generateAndSavePlan(db, event);
        return res.status(200).json({ content: generatedContent, source: 'generated' });

    } catch (error) {
        console.error("Error en el endpoint de 'Planear Noche' con Gemini:", error);
        return res.status(500).json({ error: 'Error al generar el contenido.' });
    }
}