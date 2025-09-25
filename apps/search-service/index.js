// Contenido completo y correcto para index.js
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { MeiliSearch } from 'meilisearch';
import path from 'path';
import { fileURLToPath } from 'url';

const app = express();
const PORT = process.env.PORT || 3001;

const client = new MeiliSearch({
  host: process.env.MEILISEARCH_HOST || 'http://127.0.0.1:7700',
  apiKey: process.env.MEILISEARCH_API_KEY,
});

app.use(cors());
app.use(express.json());

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
app.use(express.static(path.join(__dirname, 'public')));

// Esta es la ruta que faltaba en la versión que se está ejecutando
app.get('/search', async (req, res) => {
  const query = req.query.q;
  if (!query) {
    return res.status(400).json({ error: "El parámetro de búsqueda 'q' es requerido." });
  }
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayTimestamp = Math.floor(today.getTime() / 1000);
    const filter = `date >= ${todayTimestamp}`;

    const searchResults = await client.index('events').search(query, {
      limit: 20,
      filter: [filter]
    });
    res.json(searchResults.hits);
  } catch (error) {
    console.error('Error al buscar en Meilisearch:', error);
    res.status(500).json({ error: 'Error interno del servidor de búsqueda.' });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Search-service escuchando en http://localhost:${PORT}`);
});