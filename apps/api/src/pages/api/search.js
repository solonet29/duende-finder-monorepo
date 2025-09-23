
import { getDb } from '../../../../lib/database';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  const { q } = req.query;

  if (!q || typeof q !== 'string') {
    return res.status(400).json({ message: 'Query parameter "q" is required.' });
  }

  try {
    const db = await getDb();
    const collection = db.collection('events');

    const pipeline = [
      {
        $search: {
          index: 'default', // Asume que el índice de búsqueda se llama 'default'
          compound: {
            must: [
              {
                autocomplete: {
                  query: q,
                  path: 'title',
                  tokenOrder: 'sequential',
                  score: { boost: { value: 3 } } // Mayor prioridad al título
                }
              },
              {
                autocomplete: {
                  query: q,
                  path: 'artist',
                  tokenOrder: 'sequential'
                }
              }
            ],
            should: [
              {
                wildcard: {
                  query: `${q}*`,
                  path: { wildcard: '*' }, // Busca en todos los campos
                  allowAnalyzedField: true
                }
              }
            ]
          },
          fuzzy: {
            maxEdits: 1, // Tolera un error tipográfico
            prefixLength: 2
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
          score: { $meta: "searchScore" } // Proyectar el score para depuración si es necesario
        }
      }
    ];

    const results = await collection.aggregate(pipeline).toArray();

    res.status(200).json(results);
  } catch (error) {
    console.error('Error in /api/search:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
}
