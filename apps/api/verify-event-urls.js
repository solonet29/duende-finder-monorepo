// apps/api/verify-event-urls.js
require('dotenv').config({ path: '.env.local' });
const mongoose = require('mongoose');
const axios = require('axios');
const eventSchema = require('./models/eventSchema');

const MONGO_URI = process.env.MONGO_URI;
const Event = mongoose.model('Event', eventSchema);

const verifyEventUrls = async () => {
    if (!MONGO_URI) {
        console.error('Error: MONGO_URI is not defined in .env.local');
        process.exit(1);
    }

    let isConnected = false;
    try {
        await mongoose.connect(MONGO_URI);
        isConnected = true;
        console.log('Successfully connected to MongoDB.');

        const eventsToVerify = await Event.find({
            verificationStatus: 'pending',
            date: { $gte: new Date() } // Solo verificar eventos futuros
        }).limit(50); // Limitar a 50 para no sobrecargar los servidores de origen

        if (eventsToVerify.length === 0) {
            console.log('No events pending verification.');
            return;
        }

        console.log(`Found ${eventsToVerify.length} events to verify.`);

        for (const event of eventsToVerify) {
            let status = 'failed';
            try {
                // Usamos una petición HEAD por eficiencia, solo nos interesa el código de estado
                const response = await axios.head(event.sourceUrl, { timeout: 10000 });
                if (response.status >= 200 && response.status < 400) {
                    status = 'verified';
                    console.log(`SUCCESS: ${event.sourceUrl} for event "${event.name}" is valid.`);
                } else {
                     console.log(`FAILED: ${event.sourceUrl} for event "${event.name}" returned status ${response.status}.`);
                }
            } catch (error) {
                if (error.response) {
                    console.error(`ERROR: ${event.sourceUrl} for event "${event.name}" returned status ${error.response.status}.`);
                } else {
                    console.error(`ERROR: Could not reach ${event.sourceUrl} for event "${event.name}". ${error.message}`);
                }
            }

            event.verificationStatus = status;
            event.lastVerifiedAt = new Date();
            event.verificationAttempts = (event.verificationAttempts || 0) + 1;
            await event.save();
        }

    } catch (error) {
        console.error('An error occurred during the verification process:', error);
    } finally {
        if (isConnected) {
            await mongoose.disconnect();
            console.log('Disconnected from MongoDB.');
        }
    }
};

verifyEventUrls();