// ======================================================================
// SCRIPT: ingesta.js (Versión 3.0 - Refactorizada para Monorepo)
// OBJETIVO: Procesar eventos usando paquetes compartidos.
// ======================================================================

// --- Dependencias y Configuración ---
require('dotenv').config();
const { ObjectId } = require('mongodb');
const { Client } = require("@googlemaps/google-maps-services-js");

// --- Paquetes del Monorepo ---
const { getClient } = require('@duende-finder/db-client');
const { sanitizeEvent } = require('sanitizers');

// --- Configuración ---
const googleMapsClient = new Client({});
const dbName = 'DuendeDB';
const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY;
const TEMP_COLLECTION_NAME = 'temp_scraped_events';
const FINAL_COLLECTION_NAME = 'events';
const CONTENT_STATUS_PENDING = 'pending';

// --- Funciones Auxiliares (específicas de esta app) ---

async function findExistingUrls(urls, finalCollection) {
  if (urls.length === 0) return new Set();
  const existingEvents = await finalCollection.find({ referenceURL: { $in: urls } }).project({ referenceURL: 1 }).toArray();
  return new Set(existingEvents.map(e => e.referenceURL));
}

async function geocodeAddress(address) {
  if (!address) return null;
  try {
    const response = await googleMapsClient.geocode({
      params: { address: address, key: GOOGLE_MAPS_API_KEY, components: 'country:ES' },
    });
    if (response.data.results.length > 0) {
      const { lng, lat } = response.data.results[0].geometry.location;
      return [lng, lat];
    }
  } catch (error) {
    console.error(`❌ Error al geocodificar '${address}':`, error.response?.data?.error_message || error.message);
  }
  return null;
}

// ======================================================================
// FUNCIÓN PRINCIPAL: processEvents()
// ======================================================================
async function processEvents() {
  console.log('🚀 Iniciando proceso de ingesta de eventos (v3.0 Monorepo)...');
  const summary = { processed: 0, added: 0, duplicates: 0, invalid: 0 };

  const { client, clientPromise } = getClient();

  try {
    await clientPromise; // Asegurarse de que la conexión esté lista
    console.log('🔗 Conectado a MongoDB.');
    const database = client.db(dbName);
    const tempCollection = database.collection(TEMP_COLLECTION_NAME);
    const finalCollection = database.collection(FINAL_COLLECTION_NAME);

    const eventsToProcess = await tempCollection.find({}).toArray();
    summary.processed = eventsToProcess.length;

    if (summary.processed === 0) {
      console.log('No hay eventos nuevos para procesar.');
      return;
    }
    console.log(`🔎 Se encontraron ${summary.processed} eventos para procesar.`);

    const urlsToCheck = eventsToProcess.map(event => event.referenceURL).filter(Boolean);
    const existingUrls = await findExistingUrls(urlsToCheck, finalCollection);

    for (const event of eventsToProcess) {
      const sanitizedEvent = sanitizeEvent(event);

      if (!sanitizedEvent.referenceURL) {
        summary.invalid++;
      } else if (existingUrls.has(sanitizedEvent.referenceURL)) {
        summary.duplicates++;
      } else {
        let coordinates = null;
        let isApproximate = false;

        if (sanitizedEvent.address) {
          coordinates = await geocodeAddress(sanitizedEvent.address);
        }
        if (!coordinates && sanitizedEvent.city) {
          coordinates = await geocodeAddress(`${sanitizedEvent.city}, España`);
          if (coordinates) isApproximate = true;
        }

        if (coordinates) {
          sanitizedEvent.location = { type: 'Point', coordinates, isApproximate };
        } else {
          delete sanitizedEvent.location;
        }

        const artist = sanitizedEvent.artist || '';
        const title = sanitizedEvent.title || '';
        const search_synonyms = `${artist} ${title}`.trim();

        await finalCollection.insertOne({
          ...sanitizedEvent,
          search_synonyms,
          contentStatus: CONTENT_STATUS_PENDING,
          createdAt: new Date()
        });
        summary.added++;
      }
      await tempCollection.deleteOne({ _id: new ObjectId(event._id) });
    }

  } catch (err) {
    console.error('💥 Ocurrió un error crítico durante el proceso de ingesta:', err);
  } 
  // No cerramos el cliente aquí para que pueda ser reutilizado por otras operaciones

  console.log('\n--- Resumen de la Ingesta ---');
  console.log(`Eventos Procesados: ${summary.processed}`);
  console.log(`Nuevos Eventos Añadidos: ${summary.added}`);
  console.log(`Duplicados Descartados: ${summary.duplicates}`);
  console.log(`Inválidos/Fallidos: ${summary.invalid}`);
  console.log('-----------------------------\n');
}

module.exports = { processEvents };

if (require.main === module) {
  processEvents().finally(() => {
    // Cerramos la conexión solo cuando el script termina su ejecución directa
    const { client } = getClient();
    if(client) client.close().then(() => console.log('🚪 Conexión a MongoDB cerrada.'));
  });
}
