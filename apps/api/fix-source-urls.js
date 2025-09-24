// fix-source-urls.js
require('dotenv').config({ path: '.env.local' });
const mongoose = require('mongoose');
const eventSchema = require('./models/eventSchema.js');

const MONGO_URI = process.env.MONGO_URI;
const DEFAULT_URL = 'https://afland.es';

async function fixSourceUrls() {
    if (!MONGO_URI) {
        console.error("Error: MONGO_URI no encontrada en las variables de entorno.");
        process.exit(1);
    }

    try {
        console.log("Conectando a la base de datos...");
        await mongoose.connect(MONGO_URI);
        console.log("Conexión exitosa.");

        const Event = mongoose.model('Event', eventSchema);

        console.log(`Buscando eventos sin 'sourceUrl' para establecerla a '${DEFAULT_URL}'...`);

        const result = await Event.updateMany(
            {
                $or: [
                    { sourceUrl: { $exists: false } },
                    { sourceUrl: null },
                    { sourceUrl: "" }
                ]
            },
            { $set: { sourceUrl: DEFAULT_URL } }
        );

        console.log('\n--- ✅ Proceso completado ---');
        console.log(`Documentos que cumplían el criterio: ${result.matchedCount}`);
        console.log(`Documentos modificados: ${result.modifiedCount}`);

    } catch (error) {
        console.error('Ha ocurrido un error durante el proceso:', error);
        process.exit(1);
    } finally {
        await mongoose.disconnect();
        console.log('Desconectado de la base de datos.');
        process.exit(0);
    }
}

fixSourceUrls();
