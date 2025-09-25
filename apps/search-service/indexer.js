require('dotenv').config();
const mongoose = require('mongoose');
const { MeiliSearch } = require('meilisearch');

const eventSchema = require('../api/models/eventSchema.js');

const MONGO_URI = process.env.MONGO_URI;
const MEILISEARCH_HOST = process.env.MEILISEARCH_HOST || 'http://localhost:7700';
const MEILISEARCH_API_KEY = process.env.MEILISEARCH_API_KEY;
const INDEX_NAME = 'events';

const meiliClient = new MeiliSearch({ host: MEILISEARCH_HOST, apiKey: MEILISEARCH_API_KEY });

async function runIndexer() {
  try {
    console.log('Conectando a MongoDB con Mongoose...');
    await mongoose.connect(MONGO_URI);
    console.log('✅ Conectado a MongoDB.');

    const Event = mongoose.models.Event || mongoose.model('Event', eventSchema);

    const query = {};
    const events = await Event.find(query).lean();
    console.log(`🔎 Encontrados ${events.length} eventos para indexar.`);

    if (events.length === 0) {
      console.log('No hay eventos en la base de datos para indexar.');
      return;
    }

    const index = meiliClient.index(INDEX_NAME);

    await index.updateSettings({
      filterableAttributes: ['city', 'country', 'artist', 'date'],
      sortableAttributes: ['date'],
      searchableAttributes: ['name', 'artist', 'description', 'city', 'venue']
    });

    const documents = events.map(({ _id, ...rest }) => ({ id: _id.toString(), ...rest }));

    const task = await index.addDocuments(documents);
    console.log(`✅ Tarea de indexación enviada. Task ID: ${task.taskUid}`);
    await meiliClient.waitForTask(task.taskUid);
    console.log('🎉 Indexación completada.');

  } catch (error) {
    console.error('❌ Error durante el proceso de indexación:', error);
  } finally {
    await mongoose.disconnect();
    console.log('⚪️ Conexión a MongoDB cerrada.');
  }
}

runIndexer();