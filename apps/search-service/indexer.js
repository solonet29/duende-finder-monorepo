require('dotenv').config();
const { MeiliSearch } = require('meilisearch');
const { MongoClient } = require('mongodb');

// --- CONFIGURACIÓN ---
const MONGO_URI = process.env.MONGO_URI;
const MEILISEARCH_HOST = process.env.MEILISEARCH_HOST || 'http://127.0.0.1:7700';
const MEILISEARCH_API_KEY = process.env.MEILISEARCH_API_KEY;
const INDEX_NAME = 'events';

// --- CLIENTES ---
const meiliClient = new MeiliSearch({ host: MEILISEARCH_HOST, apiKey: MEILISEARCH_API_KEY });
const mongoClient = new MongoClient(MONGO_URI);

/**
 * Función principal para indexar los eventos de MongoDB en Meilisearch.
 */
async function runIndexer() {
  try {
    // 1. Conectar a MongoDB
    await mongoClient.connect();
    const db = mongoClient.db(); // Asume que el nombre de la BD está en la URI
    const eventsCollection = db.collection('events');
    console.log('✅ Conectado a MongoDB.');

    // 2. Obtener eventos publicables de MongoDB
    // Filtramos por eventos que queremos que sean buscables
    const query = {
      contentStatus: { $in: ['content_ready', 'published', 'archived'] },
      date: { $gte: new Date().toISOString().split('T')[0] } // Solo eventos futuros
    };
    const events = await eventsCollection.find(query).toArray();
    console.log(`🔎 Encontrados ${events.length} eventos para indexar.`);

    if (events.length === 0) {
      console.log('No hay eventos nuevos para indexar.');
      return;
    }

    // 3. Preparar y enviar datos a Meilisearch
    console.log(`⏳ Enviando ${events.length} documentos al índice '${INDEX_NAME}' en Meilisearch...`);
    const index = meiliClient.index(INDEX_NAME);
    
    // Opcional: Configurar el índice (filtros, campos de búsqueda, etc.) la primera vez
    await index.updateSettings({
        filterableAttributes: ['city', 'country', 'artist'],
        sortableAttributes: ['date'],
        searchableAttributes: ['name', 'artist', 'description', 'city', 'venue']
    });

    const documents = events.map(({ _id, ...rest }) => ({
      id: _id.toString(), // Meilisearch prefiere 'id' como string
      ...rest
    }));

    const task = await index.addDocuments(documents);
    console.log(`✅ Tarea de indexación enviada. Task ID: ${task.taskUid}`);
    await meiliClient.waitForTask(task.taskUid);
    console.log('🎉 Indexación completada.');

  } catch (error) {
    console.error('❌ Error durante el proceso de indexación:', error);
  } finally {
    // 4. Cerrar conexión a MongoDB
    await mongoClient.close();
    console.log('⚪️ Conexión a MongoDB cerrada.');
  }
}

// Ejecutar el indexador si el script es llamado directamente
if (require.main === module) {
  runIndexer();
}
