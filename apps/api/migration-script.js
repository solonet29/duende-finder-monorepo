// migration-script.js
require('dotenv').config({ path: '.env.local' }); // Para leer las variables de entorno de .env.local
const mongoose = require('mongoose');
const eventSchema = require('./models/eventSchema.js'); // Asegúrate de que la ruta sea correcta

const MONGO_URI = process.env.MONGO_URI;

// --- Define aquí tu lógica para decidir qué es "destacado" ---
const featuredArtists = [
    "Farruquito", "Miguel Poveda", "Marina Heredia", "Pedro el Granaino",
    "Estrella Morente", "Rocío Molina", "Eva Yerbabuena", "Tomatito" // Añade más nombres si es necesario
].map(name => new RegExp(name, 'i')); // 'i' para que no distinga mayúsculas/minúsculas

const featuredEventTitles = [
    "Circuito Andaluz de Peñas", "Bienal de Flamenco" // Añade más textos si es necesario
].map(title => new RegExp(title, 'i'));


async function runMigration() {
    if (!MONGO_URI) {
        console.error("Error: MONGO_URI no encontrada en las variables de entorno.");
        return;
    }

    console.log("Conectando a la base de datos...");
    await mongoose.connect(MONGO_URI);
    console.log("Conexión exitosa.");

    const Event = mongoose.model('Event', eventSchema);
    const allEvents = await Event.find({});
    console.log(`Se encontraron ${allEvents.length} eventos para procesar.`);

    let updatedCount = 0;

    for (const event of allEvents) {
        let needsUpdate = false;

        // --- 1. Migración del campo 'featured' ---
        let isFeatured = false;
        // Comprueba si el artista es destacado
        if (event.artist && featuredArtists.some(regex => regex.test(event.artist))) {
            isFeatured = true;
        }
        // Comprueba si el título del evento es destacado
        if (event.name && featuredEventTitles.some(regex => regex.test(event.name))) {
            isFeatured = true;
        }

        // Si el estado de 'featured' es diferente al guardado, actualizamos
        if (event.featured !== isFeatured) {
            event.featured = isFeatured;
            needsUpdate = true;
        }

        // --- 2. Migración del campo 'date' ---
        // Si la fecha es un string, la convertimos a objeto Date de BSON
        if (typeof event.date === 'string') {
            const newDate = new Date(event.date);
            // Comprobamos que la conversión fue válida
            if (!isNaN(newDate.getTime())) {
                event.date = newDate;
                needsUpdate = true;
            }
        }

        if (needsUpdate) {
            try {
                await event.save();
                updatedCount++;
                console.log(`Evento actualizado: ${event.name} - featured: ${event.featured}`);
            } catch (validationError) {
                console.warn(`
⚠️  Error al guardar el evento ID ${event._id} (${event.name}). Saltando...`);
                console.warn(`   Motivo: ${validationError.message}
`);
            }
        }
    }

    console.log(`\nMigración completada. Se actualizaron ${updatedCount} de ${allEvents.length} eventos.`);
    await mongoose.disconnect();
}

runMigration().catch(console.error);