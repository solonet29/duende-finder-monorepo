// config.js
require('dotenv').config();
// Almacena toda la configuración del worker para mantener los scripts de lógica limpios.

const config = {
    // --- NUEVO: Configuración de Lotes Independientes ---
    // Lote para el ENRIQUECEDOR (Paso 1): Cuántos eventos procesar para añadir texto/imagen.
    ENRICH_BATCH_SIZE: 5,
    // Lote para el PUBLICADOR (Paso 2): Cuántos posts crear en WordPress por ejecución.
    PUBLISH_BATCH_SIZE: 5,
    // Lote para el DISTRIBUIDOR (Paso 3): Cuántos posts enviar a redes sociales por ejecución.
    DISTRIBUTE_BATCH_SIZE: 4,


    // Configuración de WordPress
    WORDPRESS_EVENTS_CATEGORY_ID: 96, // ID de la categoría "Eventos"
    WORDPRESS_CIRCUIT_CATEGORY_ID: 101, // ID de la categoría para Circuitos/Peñas Flamencas

    // Prompts de IA (Groq)
    prompts: {
        generateFullContentPackage: (event) => `
Tu tarea es actuar como un experto en marketing de eventos de flamenco y generar un paquete de contenido completo para el siguiente evento.
La respuesta DEBE ser un único objeto JSON válido con la siguiente estructura y NADA MÁS:
{
  "blogTitle": "string",
  "blogPostMarkdown": "string",
  "nightPlanMarkdown": "string",
  "tweetText": "string",
  "instagramText": "string"
}

Aquí están los detalles del evento:
- Nombre: ${event.name}
- Artista: ${event.artist || 'Artista por confirmar'}
- Ciudad: ${event.city}
- Lugar: ${event.venue ? event.venue.name : 'Lugar por confirmar'}
- Fecha: ${event.date}
- Hora: ${event.time}

Instrucciones para cada campo del JSON:

1.  **blogTitle**: Crea un título SEO amigable y atractivo para un post de blog sobre el evento. Máximo 70 caracteres.

2.  **blogPostMarkdown**: Escribe un artículo para el blog sobre el evento. El tono debe ser evocador y periodístico, como un crítico de flamenco escribiendo para una revista cultural. El objetivo es generar expectación y mostrar la relevancia del evento. El texto debe tener al menos 250 palabras y estar estructurado en varios párrafos. No uses la estructura de "La Previa / El Evento / Post-Espectáculo". En su lugar, enfócate en:
    - **Introducción**: Presenta al artista y su importancia en el mundo del flamenco. Si el evento es especial (ej. un festival, un estreno), menciónalo.
    - **Desarrollo**: Describe la propuesta artística del espectáculo. ¿Qué lo hace único? ¿Qué emociones o experiencias puede esperar el público? Usa un lenguaje rico y metafórico para hablar de la música y el baile.
    - **Conclusión**: Cierra con una reflexión sobre la importancia de no perderse esta oportunidad y una invitación a vivir la experiencia del flamenco en directo.

3.  **nightPlanMarkdown**: Genera un "plan de noche" en formato Markdown. Debe ser útil y evocador. Sigue esta estructura concisa:
    ### La Previa: Ambiente y Sabor
    Sugiere el tipo de ambiente o barrio para buscar un bar de tapas antes del evento. No des nombres específicos.
    ### El Evento: ${event.name}
    Crea expectación sobre el espectáculo. Habla del artista o del tipo de flamenco de forma breve.
    ### Post-Espectáculo: La Última Copa
    Sugiere un tipo de lugar para tomar una copa después y comentar la actuación.

4.  **tweetText**: Escribe un tweet para X. Debe ser corto, impactante y menor de 280 caracteres. Incluye el nombre del evento, la ciudad y la fecha. Usa los hashtags #flamenco y #${event.city ? event.city.replace(/\s/g, '') : 'evento'}.

5.  **instagramText**: Escribe un post para Instagram/Facebook. Debe ser más descriptivo y emocional. Usa emojis flamencos (💃, 🎸, 👏). Estructúralo con párrafos cortos. Termina con una pregunta para fomentar la interacción. Incluye los hashtags #flamenco #${event.city ? event.city.replace(/\s/g, '') : 'evento'} #musicaenvivo #${event.artist ? event.artist.replace(/\s/g, '') : 'arte'}.
`
    },

    // Bloques de HTML reutilizables
    htmlBlocks: {
        // ... (tu bloque postIntro sin cambios)
        postIntro: (event) => `...`,
        // ... (tu bloque postFooter sin cambios)
        postFooter: (event) => `...`,
        // ... (tu bloque ctaBanners sin cambios)
        ctaBanners: `...`
    },

    // Configuración de Redes Sociales
    socialMedia: {
        x: {
            appKey: process.env.TWITTER_API_KEY,
            appSecret: process.env.TWITTER_API_KEY_SECRET,
            accessToken: process.env.TWITTER_ACCESS_TOKEN,
            accessSecret: process.env.TWITTER_ACCESS_TOKEN_SECRET,
        },
        pinterest: {
            accessToken: process.env.PINTEREST_ACCESS_TOKEN,
            boardId: process.env.PINTEREST_BOARD_ID || "default-board-id",
        },
        reddit: {
            clientId: process.env.REDDIT_CLIENT_ID,
            clientSecret: process.env.REDDIT_CLIENT_SECRET,
            username: process.env.REDDIT_USERNAME,
            password: process.env.REDDIT_PASSWORD,
            subreddits: ['flamenco', 'spain', 'andalucia', 'Flamenco'],
            redditSubreddit: 'flamenco' // Default subreddit for posting
        }
    }
};

module.exports = config;
