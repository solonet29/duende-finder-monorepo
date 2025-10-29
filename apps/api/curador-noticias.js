import { MongoClient } from 'mongodb';
import axios from 'axios';
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';
import 'dotenv/config';

// --- Configuración y Constantes ---
const ID_CATEGORIA_NOTICIAS = 12; // ID de la categoría "Noticias" en WordPress

// --- Inicialización de Clientes de API ---
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const generationConfig = {
  temperature: 0.7,
  topP: 1,
  topK: 1,
  maxOutputTokens: 8192,
  response_mime_type: "application/json",
};
const safetySettings = [
    { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
    { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
    { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
    { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
];
const geminiModel = genAI.getGenerativeModel({ model: "gemini-1.5-flash", generationConfig, safetySettings });


/**
 * Función principal que se ejecuta como una Serverless Function de Vercel.
 */
export default async function handler(req, res) {
  // 1. Autenticación del Cron Job de Vercel
  const authHeader = req.headers['authorization'];
  if (authHeader !== `Bearer ${process.env.VERCEL_CRON_SECRET}`) {
    console.warn('Acceso no autorizado al curador de noticias.');
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const client = new MongoClient(process.env.MONGODB_URI);

  try {
    // 2. Conexión a MongoDB
    await client.connect();
    const db = client.db(process.env.DB_NAME);
    const processedUrlsCollection = db.collection('processed_news_urls');
    console.log('Conectado a MongoDB.');

    // 3. Búsqueda de Noticias en Google
    console.log('Buscando noticias de flamenco...');
    const searchTerms = ['"noticias flamenco actualidad"', '"nuevo disco" flamenco', '"premio" flamenco'];
    const q = searchTerms.join(' OR ');
    const googleSearchUrl = `https://www.googleapis.com/customsearch/v1`;
    
    const searchResponse = await axios.get(googleSearchUrl, {
      params: {
        key: process.env.GOOGLE_SEARCH_API_KEY,
        cx: process.env.GOOGLE_SEARCH_CX_ID,
        q: q,
        num: 5,
      }
    });

    if (!searchResponse.data.items || searchResponse.data.items.length === 0) {
      console.log('Google Search no devolvió resultados.');
      return res.status(200).json({ message: 'No search results found.' });
    }

    // 4. Filtrado y Deduplicación
    console.log('Filtrando noticias no procesadas...');
    let newArticle = null;
    for (const item of searchResponse.data.items) {
      const urlExists = await processedUrlsCollection.findOne({ url: item.link });
      if (!urlExists) {
        newArticle = item;
        break; // Encontramos la primera noticia nueva
      }
    }

    if (!newArticle) {
      console.log('Todas las noticias encontradas ya han sido procesadas.');
      return res.status(200).json({ message: 'No new articles to process.' });
    }
    console.log(`Noticia nueva encontrada: ${newArticle.title}`);

    // 5. y 6. Curación del Contenido con Gemini AI
    console.log('Generando resumen con Gemini AI...');
    const prompt = `
      Actúa como un redactor para la web afland.es, especializada en flamenco.
      Tu tarea es escribir un post para la sección de noticias.
      A partir de la siguiente información de una noticia, crea un título atractivo y un resumen de 2 a 3 párrafos en formato HTML.
      El resumen debe ser informativo, fácil de leer y mantener un tono neutral pero interesante para los aficionados al flamenco.
      Al final del contenido, incluye un enlace a la fuente original con el texto "Fuente: [Nombre de la fuente]".

      Información de la noticia:
      - Título: ${newArticle.title}
      - Snippet: ${newArticle.snippet}
      - URL: ${newArticle.link}
      - Fuente: ${newArticle.displayLink}

      La respuesta debe ser únicamente un objeto JSON válido con el siguiente formato:
      {
        "title": "...",
        "content": "..."
      }
    `;

    const result = await geminiModel.generateContent(prompt);
    const geminiResponseText = result.response.text();
    const curatedContent = JSON.parse(geminiResponseText);
    console.log(`Contenido generado: ${curatedContent.title}`);

    // 7. y 8. Publicación en WordPress como Borrador
    console.log('Publicando borrador en WordPress...');
    const wpApiUrl = process.env.WP_API_URL;
    const wpUser = process.env.WP_USERNAME;
    const wpPass = process.env.WP_APP_PASSWORD;

    const wpAuth = Buffer.from(`${wpUser}:${wpPass}`).toString('base64');

    const postData = {
      title: curatedContent.title,
      content: curatedContent.content,
      status: 'draft',
      categories: [ID_CATEGORIA_NOTICIAS],
    };

    const wpResponse = await axios.post(`${wpApiUrl}/posts`, postData, {
      headers: {
        'Authorization': `Basic ${wpAuth}`,
        'Content-Type': 'application/json',
      },
    });
    console.log(`Borrador creado en WordPress con ID: ${wpResponse.data.id}`);

    // 9. Registro de la URL Procesada
    await processedUrlsCollection.insertOne({
      url: newArticle.link,
      processedAt: new Date(),
      wpPostId: wpResponse.data.id,
    });
    console.log('URL de la noticia guardada en la base de datos.');

    // Éxito
    res.status(201).json({
      message: 'News curated and posted as a draft successfully.',
      article: {
        title: curatedContent.title,
        wpPostId: wpResponse.data.id,
        source: newArticle.link,
      },
    });

  } catch (error) {
    // 10. Manejo de Errores
    console.error('Ha ocurrido un error en el proceso del curador de noticias:', error.response ? error.response.data : error.message);
    res.status(500).json({
      error: 'Internal Server Error',
      details: error.response ? error.response.data : error.message,
    });
  } finally {
    // 10. Cierre de la Conexión a MongoDB
    await client.close();
    console.log('Conexión a MongoDB cerrada.');
  }
}
