import { MongoClient } from 'mongodb';
import { GoogleGenerativeAI } from '@google/generative-ai';

// --- Configuración de Clientes ---
// Es buena práctica inicializar los clientes fuera del handler para reutilizar conexiones.
const uri = process.env.MONGO_URI;
const client = new MongoClient(uri);

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });


/**
 * Genera sinónimos y términos relacionados usando la IA de Gemini
 * si una búsqueda inicial no produce resultados.
 * @param {string} searchTerm El término de búsqueda original.
 * @returns {Promise<string[]|null>} Un array de términos alternativos o null si hay un error.
 */
async function getAiSynonyms(searchTerm) {
    if (!searchTerm) return null;

    const prompt = `Actúa como un lexicógrafo y experto en la cultura flamenca. Un usuario ha buscado el término "${searchTerm}" en un buscador de eventos de flamenco y no ha obtenido resultados. Tu tarea es generar una lista de 3 a 5 términos de búsqueda alternativos, sinónimos o conceptos relacionados que probablemente devuelvan resultados relevantes. Devuelve únicamente los términos, separados por comas.`;

    try {
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();
        // Limpiamos la respuesta para devolver un array de strings, eliminando elementos vacíos.
        return text.split(',').map(term => term.trim()).filter(term => term);
    } catch (error) {
        console.error("Error fetching synonyms from AI:", error);
        return null;
    }
}


// --- API Handler ---
export default async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ message: 'Method not allowed' });
    }

    const searchTerm = req.query.q;
    if (!searchTerm) {
        return res.status(400).json({ message: 'Search term is required' });
    }

    try {
        await client.connect();
        const db = client.db('DuendeDB');
        const eventsCollection = db.collection('events');

        // Pipeline de búsqueda inicial
        const initialPipeline = [
            {
                $search: {
                    index: 'buscador',
                    text: {
                        query: searchTerm,
                        path: { wildcard: '*.text' },
                        fuzzy: {
                            maxEdits: 2,
                            prefixLength: 3
                        }
                    }
                }
            },
            { $limit: 50 },
            {
                $project: {
                    _id: 1, title: 1, artist: 1, date: 1, city: 1, country: 1, url: 1, imageUrl: 1,
                    score: { $meta: 'searchScore' }
                }
            }
        ];

        let results = await eventsCollection.aggregate(initialPipeline).toArray();

        // Lógica de "rescate" con IA si no hay resultados
        if (results.length === 0 && searchTerm.length > 3) {
            console.log(`Initial search for "${searchTerm}" failed. Triggering AI rescue...`);
            const alternativeTerms = await getAiSynonyms(searchTerm);

            if (alternativeTerms && alternativeTerms.length > 0) {
                // Creamos una query que busca cualquiera de los términos sugeridos (OR)
                const rescueQuery = alternativeTerms.join(' ');
                console.log(`AI suggested terms. New rescue query: ${rescueQuery}`);

                const rescuePipeline = [
                    {
                        $search: {
                            index: 'buscador',
                            text: {
                                query: rescueQuery,
                                path: { wildcard: '*.text' }
                            }
                        }
                    },
                    { $limit: 50 },
                    {
                        $project: {
                            _id: 1, title: 1, artist: 1, date: 1, city: 1, country: 1, url: 1, imageUrl: 1,
                            score: { $meta: 'searchScore' }
                        }
                    }
                ];
                results = await eventsCollection.aggregate(rescuePipeline).toArray();
            }
        }

        res.status(200).json(results);

    } catch (error) {
        console.error('Error in /api/search:', error);
        const errorMessage = error.message || 'Internal Server Error';
        res.status(500).json({ message: errorMessage, details: error.toString() });
    } finally {
        // Es una buena práctica asegurarse de que la conexión siempre se cierre
        await client.close();
    }
}