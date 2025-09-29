require('dotenv').config({ path: './.env' });
const { MongoClient } = require('mongodb');

const uri = process.env.MONGO_URI;
const dbName = 'DuendeDB';
const COLLECTION_NAME = 'events';

const client = new MongoClient(uri);

async function deduplicateEvents() {
    console.log('🚀 Iniciando script para de-duplicar eventos...');

    try {
        await client.connect();
        console.log('🔗 Conectado a MongoDB.');
        const database = client.db(dbName);
        const eventsCollection = database.collection(COLLECTION_NAME);

        const aggregationPipeline = [
            {
                $group: {
                    _id: { date: "$date", artist: "$artist", name: "$name" },
                    docs: { $push: { _id: "$_id", contentStatus: "$contentStatus" } },
                    count: { $sum: 1 }
                }
            },
            {
                $match: {
                    count: { $gt: 1 }
                }
            }
        ];

        const duplicates = await eventsCollection.aggregate(aggregationPipeline).toArray();

        if (duplicates.length === 0) {
            console.log('✅ No se encontraron eventos duplicados.');
            return;
        }

        console.log(`🔎 Encontrados ${duplicates.length} grupos de eventos duplicados.`);

        const statusOrder = ['published', 'content_ready', 'pending_enrichment', 'enrichment_failed'];
        let totalDeletedCount = 0;

        for (const group of duplicates) {
            // Encontrar el "mejor" documento para conservar
            let bestDoc = group.docs[0];
            for (let i = 1; i < group.docs.length; i++) {
                const currentDoc = group.docs[i];
                const bestStatusIndex = statusOrder.indexOf(bestDoc.contentStatus);
                const currentStatusIndex = statusOrder.indexOf(currentDoc.contentStatus);

                // Un índice más bajo en statusOrder es mejor
                if (currentStatusIndex < bestStatusIndex) {
                    bestDoc = currentDoc;
                }
            }

            // IDs de todos los documentos en el grupo, excepto el que queremos conservar
            const idsToDelete = group.docs
                .map(doc => doc._id)
                .filter(id => !id.equals(bestDoc._id));

            if (idsToDelete.length > 0) {
                const result = await eventsCollection.deleteMany({ _id: { $in: idsToDelete } });
                totalDeletedCount += result.deletedCount;
                console.log(`🗑️ Para el grupo ${group._id.name}, se ha conservado el evento con status '${bestDoc.contentStatus}' y se han eliminado ${result.deletedCount} duplicados.`);
            }
        }

        console.log(`
✅ Proceso finalizado. Total de eventos duplicados eliminados: ${totalDeletedCount}`);

    } catch (error) {
        console.error('💥 Error durante la de-duplicación de eventos:', error);
    } finally {
        await client.close();
        console.log('🚪 Conexión a MongoDB cerrada.');
    }
}

deduplicateEvents();