import { connectToMainDb } from '@/lib/database';
import { runMiddleware, corsMiddleware } from '@/lib/cors';

export default async function handler(req, res) {
  // Ejecutar el middleware de CORS
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

    // --- INICIO DEL PIPELINE CORREGIDO ---
    // Esta es la consulta ajustada para coincidir con tu nuevo índice de Atlas Search
    const pipeline = [
      {
        $search: {
          index: 'default',
          "compound": {
            "should": [
              {
                "autocomplete": {
                  "query": q,
                  "path": "title.completion", // Apunta al subcampo .completion
                  "tokenOrder": "sequential",
                  "score": { "boost": { "value": 3 } }
                }
              },
              {
                "autocomplete": {
                  "query": q,
                  "path": "artist.completion", // Apunta al subcampo .completion
                  "tokenOrder": "sequential",
                  "score": { "boost": { "value": 2 } }
                }
              },
              {
                "text": {
                  "query": q,
                  "path": {
                    "wildcard": "*" // Busca en todos los demás campos
                  },
                  "fuzzy": { "maxEdits": 1 },
                  "synonyms": "flamencoSynonyms" // Activa los sinónimos
                }
              }
            ]
          }
        }
      },
      {
        $limit: 20
      },
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
    // --- FIN DEL PIPELINE CORREGIDO ---

    const results = await collection.aggregate(pipeline).toArray();

    res.status(200).json(results);
  } catch (error) {
    console.error('Error in /api/search:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
}
