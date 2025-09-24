import { connectToMainDb } from '@/lib/database';
import { runMiddleware, corsMiddleware } from '@/lib/cors';
import { GoogleGenerativeAI } from '@google/generative-ai';

require('dotenv').config();

async function getAiSynonyms(searchTerm) {
  if (!process.env.GEMINI_API_KEY) {
    console.error('GEMINI_API_KEY is not defined.');
    return null;
  }

  try {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-pro" });

    const prompt = `Actúa como un lexicógrafo y experto en la cultura flamenca. Un usuario ha buscado el término "${searchTerm}" en un buscador de eventos de flamenco y no ha obtenido resultados. Tu tarea es generar una lista de 3 a 5 términos de búsqueda alternativos, sinónimos o conceptos relacionados que probablemente devuelvan resultados relevantes. Devuelve únicamente los términos, separados por comas.`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    
    if (text) {
      return text.split(',').map(s => s.trim()).filter(Boolean);
    }
  } catch (error) {
    console.error('Error getting AI synonyms:', error);
  }
  return null;
}

export default async function handler(req, res) {
  await runMiddleware(req, res, corsMiddleware);

  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  const { q } = req.query;

  if (!q || typeof q !== 'string') {
    return res.status(400).json({ message: 'Query parameter "q" is required.' });
  }

  try {
    const db = await connectToMainDb();
    const collection = db.collection('events');

    const pipeline = [
      {
        $search: {
          index: 'default',
          "compound": {
            "should": [
              {
                "autocomplete": {
                  "query": q,
                  "path": "title.completion",
                  "tokenOrder": "sequential",
                  "score": { "boost": { "value": 3 } }
                }
              },
              {
                "autocomplete": {
                  "query": q,
                  "path": "artist.completion",
                  "tokenOrder": "sequential",
                  "score": { "boost": { "value": 2 } }
                }
              },
              {
                "text": {
                  "query": q,
                  "path": { "wildcard": "*" },
                  "fuzzy": { "maxEdits": 1 }
                }
              },
              {
                "text": {
                  "query": q,
                  "path": { "wildcard": "*" },
                  "synonyms": "flamencoSynonyms"
                }
              }
            ]
          }
        }
      },
      { $limit: 20 },
      {
        $project: {
          _id: 1,
          title: 1,
          city: 1,
          venue: 1,
          startDate: 1,
          imageUrl: 1,
          slug: 1,
          score: { $meta: "searchScore" }
        }
      }
    ];

    let results = await collection.aggregate(pipeline).toArray();

    if (results.length === 0) {
      console.log(`No results for "${q}", trying AI rescue...`);
      const aiSynonyms = await getAiSynonyms(q);

      if (aiSynonyms && aiSynonyms.length > 0) {
        console.log(`AI synonyms for "${q}": ${aiSynonyms.join(', ')}`);
        const rescueQuery = aiSynonyms.join(' | ');
        const rescuePipeline = [
          {
            $search: {
              index: 'default',
              text: {
                query: rescueQuery,
                path: { wildcard: '*' }
              }
            }
          },
          { $limit: 20 },
          {
            $project: {
              _id: 1,
              title: 1,
              city: 1,
              venue: 1,
              startDate: 1,
              imageUrl: 1,
              slug: 1,
              score: { $meta: "searchScore" }
            }
          }
        ];
        results = await collection.aggregate(rescuePipeline).toArray();
      }
    }

    res.status(200).json(results);
  } catch (error) {
    console.error('Error in /api/search:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
}