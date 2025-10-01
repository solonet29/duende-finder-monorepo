// apps/api/migrate-source-urls.js
const { MongoClient, ObjectId } = require('mongodb');
require('dotenv').config({ path: '.env.local' });

// --- SCRIPT DE MIGRACIÓN DE DATOS (VERSIÓN FINAL Y ROBUSTA) ---

async function runDataMigration() {
    const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
    if (!uri) {
        console.error('🔴 Error: La variable de entorno MONGO_URI no está definida.');
        return;
    }

    const client = new MongoClient(uri);
    console.log('🔵 Conectando a la base de datos para la migración...');

    try {
        await client.connect();
        console.log('✅ Conectado al servidor de MongoDB.');

        // --- MEJORA CLAVE ---
        // Al llamar a client.db() sin argumentos, el driver usa automáticamente
        // el nombre de la base de datos especificado en tu MONGO_URI.
        // Esto evita errores si la base de datos no se llama 'duende-finder'.
        const database = client.db();
        console.log(`✅ Usando la base de datos: "${database.databaseName}"`);

        const eventsCollection = database.collection('events');

        // La consulta es correcta, ahora debería encontrar los documentos.
        const query = { sourceUrl: 'https://afland.es' };
        const faultyEvents = await eventsCollection.find(query).toArray();

        if (faultyEvents.length === 0) {
            console.log('🟢 No se encontraron eventos para corregir. Esto podría significar que ya está todo bien.');
            return;
        }

        console.log(`🟡 Encontrados ${faultyEvents.length} eventos para corregir.`);

        const bulkOperations = faultyEvents.map(event => ({
            updateOne: {
                filter: { _id: new ObjectId(event._id) },
                update: { $set: { sourceUrl: event.referenceURL } }
            }
        }));

        console.log('🚀 Ejecutando la corrección masiva en la base de datos...');
        const result = await eventsCollection.bulkWrite(bulkOperations);

        console.log('✅ ¡Migración completada con éxito!');
        console.log(`   - Documentos modificados: ${result.modifiedCount}`);

    } catch (error) {
        console.error('🔴 Error crítico durante la migración:', error);
    } finally {
        await client.close();
        console.log('⚫️ Conexión con la base de datos cerrada.');
    }
}

runDataMigration();