// apps/api/verify-event-urls.js
require('dotenv').config({ path: '.env.local' });
const mongoose = require('mongoose');
const axios = require('axios');
// MEJORA: Importamos directamente el modelo compilado, es más limpio.
const Event = mongoose.models.Event || mongoose.model('Event', require('./models/eventSchema'));

const MONGO_URI = process.env.MONGO_URI;

const verifyEventUrls = async () => {
    if (!MONGO_URI) {
        console.error('🔴 Error: MONGO_URI no está definida en .env.local');
        process.exit(1);
    }

    try {
        console.log('🔵 Conectando a MongoDB...');
        await mongoose.connect(MONGO_URI);
        console.log('✅ Conectado a MongoDB con éxito.');

        // Calculamos la fecha de aquí a 7 días
        const sevenDaysFromNow = new Date();
        sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);

        // Buscamos eventos en los próximos 7 días que no hayan sido verificados hoy
        const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const eventsToVerify = await Event.find({
            sourceUrl: { $exists: true, $ne: null },
            eventDate: { 
                $gte: new Date(), // Solo eventos futuros
                $lte: sevenDaysFromNow // Y que ocurran en los próximos 7 días
            },
            // MEJORA: Evitamos verificar un evento que ya se verificó con éxito recientemente
            $or: [
                { verificationStatus: { $ne: 'verified' } },
                { lastVerifiedAt: { $lt: twentyFourHoursAgo } }
            ]
        }).limit(50); // Limitamos para no sobrecargar los servidores de origen

        if (eventsToVerify.length === 0) {
            console.log('🟢 No se encontraron eventos futuros para verificar.');
            return;
        }

        console.log(`🟡 Encontrados ${eventsToVerify.length} eventos para verificar.`);

        for (const event of eventsToVerify) {
            let status = 'failed';
            try {
                // Usamos una petición HEAD por eficiencia
                const response = await axios.head(event.sourceUrl, { timeout: 10000 });
                if (response.status >= 200 && response.status < 400) {
                    status = 'verified';
                    console.log(`✅ ÉXITO: La URL del evento "${event.name}" es válida.`);
                } else {
                    console.log(`❌ FALLO: La URL del evento "${event.name}" devolvió el estado ${response.status}.`);
                }
            } catch (error) {
                const status = error.response ? error.response.status : 'desconocido';
                console.error(`🔴 ERROR: No se pudo acceder a la URL del evento "${event.name}". Estado: ${status}.`);
            }

            // Usamos updateOne para una operación más atómica y robusta
            await Event.updateOne(
                { _id: event._id },
                {
                    $set: {
                        verificationStatus: status,
                        lastVerifiedAt: new Date(),
                    },
                    $inc: {
                        verificationAttempts: 1
                    }
                }
            );
        }

    } catch (error) {
        console.error('🔴 Ha ocurrido un error durante el proceso de verificación:', error);
    } finally {
        if (mongoose.connection.readyState === 1) {
            await mongoose.disconnect();
            console.log('⚫️ Desconectado de MongoDB.');
        }
    }
};

verifyEventUrls();