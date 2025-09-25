require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { MeiliSearch } = require('meilisearch');

// --- Configuración y Clientes ---
const app = express();
const PORT = process.env.PORT || 3001;

// Cliente de Meilisearch (configuración básica)
const client = new MeiliSearch({
  host: process.env.MEILISEARCH_HOST || 'http://127.0.0.1:7700',
  apiKey: process.env.MEILISEARCH_API_KEY,
});

// --- Middlewares ---
app.use(cors());
app.use(express.json());
app.use(express.static('public')); // Para servir nuestra página de prueba

// --- Endpoints ---

/**
 * Endpoint de Búsqueda
 * Recibe una consulta y la pasa a Meilisearch.
 */
app.get('/search', async (req, res) => {
  const query = req.query.q;

  if (!query) {
    return res.status(400).json({ error: 'El parámetro de búsqueda \'q\' es requerido.' });
  }

  try {
    // Aquí irá la lógica de búsqueda con Meilisearch
    // Por ahora, devolvemos un resultado de ejemplo
    console.log(`Búsqueda recibida: ${query}`);
    const mockResponse = {
        hits: [{ id: 1, name: "Resultado de ejemplo", artist: "Artista Ejemplo" }],
        query: query,
        processingTimeMs: 2,
        limit: 20,
        offset: 0,
        estimatedTotalHits: 1
    };
    res.json(mockResponse);

  } catch (error) {
    console.error('Error al buscar en Meilisearch:', error);
    res.status(500).json({ error: 'Error interno del servidor de búsqueda.' });
  }
});

// --- Iniciar Servidor ---
app.listen(PORT, () => {
  console.log(`🚀 Search-service escuchando en http://localhost:${PORT}`);
  console.log(`   Página de prueba disponible en http://localhost:${PORT}/test.html`);
});
