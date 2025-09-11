// retry-failed-enrichments.js
// OBJETIVO: Encontrar eventos cuyo enriquecimiento de contenido haya fallado (status: 'enrichment_failed')
// y resetear su estado a 'pending' para que el pipeline principal los pueda reintentar.

require('dotenv').config({ path: '../../.env' }); // Ajustar la ruta al .env raíz
const { connectToDatabase, closeDatabaseConnection } = require('../lib/database.js');

async function retryFailedEnrichments() {
    console.log('🚀 Iniciando script para reintentar enriquecimientos fallidos...');
    const db = await connectToDatabase();
    const eventsCollection = db.collection('events');

    // Filtro para encontrar los eventos que fallaron en la etapa de enriquecimiento.
    const filter = { status: 'enrichment_failed' };

    // El documento de actualización para resetear el estado a 'pending'.
    const updateDoc = {
        $set: { status: 'pending' },
    };

    const result = await eventsCollection.updateMany(filter, updateDoc);

    if (result.modifiedCount > 0) {
        console.log(`✅ Operación completada. Se resetearon ${result.modifiedCount} eventos a estado 'pending'.`);
        console.log('   Estos eventos serán procesados de nuevo en la siguiente ejecución del pipeline.');
    } else {
        console.log('✅ No se encontraron eventos con estado "enrichment_failed". No se necesita ninguna acción.');
    }
}

async function main() {
    try {
        await retryFailedEnrichments();
    } catch (error) {
        console.error('💥 Ocurrió un error crítico durante el proceso de reseteo:', error);
    } finally {
        await closeDatabaseConnection();
    }
}

main();
