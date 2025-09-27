// verify-event-urls.js
require('dotenv').config({ path: '.env.local' });
const mongoose = require('mongoose');
const axios = require('axios');
const eventSchema = require('./models/eventSchema.js'); // Asegúrate que la ruta es correcta

const MONGO_URI = process.env.MONGO_URI;

// Función para pausar la ejecución y no saturar los servidores
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function verifyEventUrls() {
    if (!MONGO_URI) {
        console.error("Error: MONGO_URI no encontrada en las variables de entorno.");
        process.exit(1);
    }

    let connection;
    try {
        console.log("Conectando a la base de datos...");
        connection = await mongoose.connect(MONGO_URI);
        console.log("Conexión exitosa.");

        const Event = mongoose.model('Event', eventSchema);

        // Buscamos eventos que no hayan sido verificados recientemente
        // Para este ejemplo, los verificamos todos. En producción, se podría filtrar.
        const eventsToVerify = await Event.find({
            sourceUrl: { $exists: true, $ne: null, $ne: "" }
        }).lean(); // .lean() para que sea más rápido, ya que solo leemos

        console.log(`🔍 Se encontraron ${eventsToVerify.length} eventos con URL para verificar.`);

        let verifiedCount = 0;
        let brokenCount = 0;
        let unverifiedCount = 0;

        for (const event of eventsToVerify) {
            let newStatus = 'unverified';
            try {
                // Usamos un User-Agent para parecer un navegador normal
                const response = await axios.head(event.sourceUrl, {
                    timeout: 5000, // 5 segundos de timeout
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
                    }
                });

                if (response.status >= 200 && response.status < 300) {
                    newStatus = 'verified';
                    verifiedCount++;
                }
            } catch (error) {
                if (error.response && (error.response.status === 404 || error.response.status === 410)) {
                    newStatus = 'link_broken'; // La URL está rota, evento probablemente cancelado
                    brokenCount++;
                    console.log(`❌ URL rota (404/410) para "${event.name}": ${event.sourceUrl}`);
                } else {
                    unverifiedCount++;
                    console.warn(`⚠️  No se pudo verificar la URL para "${event.name}": ${event.sourceUrl}`);
                }
            }

            // Actualizamos el evento en la BBDD
            await Event.updateOne({ _id: event._id }, { $set: { verificationStatus: newStatus } });

            // Pausa de 250ms entre peticiones para ser respetuosos
            await sleep(250);
        }

        console.log('\n--- ✅ Proceso de verificación completado ---');
        console.log(`   - ${verifiedCount} URLs verificadas correctamente.`);
        console.log(`   - ${brokenCount} URLs rotas (posibles cancelaciones).`);
        console.log(`   - ${unverifiedCount} URLs no se pudieron verificar (errores de red, etc).`);

    } catch (error) {
        console.error('Ha ocurrido un error fatal durante la verificación:', error);
        process.exit(1);
    } finally {
        if (connection) await mongoose.disconnect();
        console.log('🔌 Desconectado de la base de datos.');
        process.exit(0);
    }
}

verifyEventUrls();