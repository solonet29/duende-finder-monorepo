
require('dotenv').config({ path: '../../.env' });
const { MongoClient, ObjectId } = require('mongodb');

/**
 * Combina el contenido de campos de texto relevantes de un evento en un solo string normalizado.
 * @param {object} event - El documento del evento.
 * @returns {string} Un string en minúsculas con todo el texto relevante.
 */
function getEventTextSource(event) {
    return [
        event.artist,
        event.venue,
        event.description,
        event.blogPostTitle,
        event.blogPostMarkdown,
        event.nightPlan
    ].filter(Boolean).join(' ').toLowerCase();
}

/**
 * Determina la categoría y subcategoría de un evento basándose en palabras clave.
 * @param {object} event - El documento del evento.
 * @returns {{category: string, subcategory: string}} El objeto con la categoría y subcategoría.
 */
function categorizeEvent(event) {
    const textSource = getEventTextSource(event);

    let subcategory = 'Concierto'; // Valor por defecto

    if (textSource.includes('zambomba')) {
        subcategory = 'Zambomba';
    } else if (textSource.includes('tablao') || textSource.includes('corral')) {
        subcategory = 'Tablao';
    } else if (textSource.includes('festival')) {
        subcategory = 'Festival';
    } else if (textSource.includes('curso') || textSource.includes('masterclass') || textSource.includes('clase magistral')) {
        subcategory = 'Curso';
    } else if (textSource.includes('exposición') || textSource.includes('muestra')) {
        subcategory = 'Exposición';
    } else if (textSource.includes('concierto') || textSource.includes('gira') || textSource.includes('recital')) {
        subcategory = 'Concierto';
    }

    let category = 'Varios'; // Valor por defecto final

    const hasCante = textSource.includes('cante') || textSource.includes('cantaor');
    const hasBaile = textSource.includes('baile') || textSource.includes('bailaor');
    const hasToque = textSource.includes('guitarra') || textSource.includes('guitarrista');

    if (hasToque && !hasCante && !hasBaile) {
        category = 'Toque';
    } else if (hasBaile) {
        category = 'Baile';
    } else if (hasCante) {
        category = 'Cante';
    } else {
        // Deducción por subcategoría si no hay una categoría explícita
        if (['Tablao', 'Festival', 'Zambomba', 'Concierto'].includes(subcategory)) {
            category = 'Cante';
        }
    }

    return { category, subcategory };
}

/**
 * Función principal para ejecutar el script de categorización.
 */
async function run() {
    const uri = process.env.MONGO_URI;
    if (!uri) {
        console.error("Error: La variable de entorno MONGO_URI no está definida.");
        process.exit(1);
    }

    const client = new MongoClient(uri);
    console.log('Conectando a MongoDB...');

    try {
        await client.connect();
        const db = client.db('DuendeDB'); // Reemplaza con el nombre de tu DB si es diferente
        const eventsCollection = db.collection('events');
        console.log('Conexión exitosa.');

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        console.log('Buscando todos los eventos futuros para categorizar...');
        const eventsToUpdate = await eventsCollection.find({
            date: { $gte: today.toISOString().split('T')[0] }
        }).toArray();

        if (eventsToUpdate.length === 0) {
            console.log('No se encontraron eventos para actualizar.');
            return;
        }

        console.log(`Se encontraron ${eventsToUpdate.length} eventos para categorizar.`);

        const bulkOps = eventsToUpdate.map(event => {
            const { category, subcategory } = categorizeEvent(event);
            console.log(`- Evento: ${event.name} (ID: ${event._id}) -> Category: ${category}, Subcategory: ${subcategory}`);
            return {
                updateOne: {
                    filter: { _id: new ObjectId(event._id) },
                    update: { $set: { category, subcategory } }
                }
            };
        });

        console.log('\nActualizando la base de datos...');
        const result = await eventsCollection.bulkWrite(bulkOps);
        console.log('¡Actualización completada!');
        console.log(`Eventos modificados: ${result.modifiedCount}`);

    } catch (error) {
        console.error('Ocurrió un error durante la ejecución del script:', error);
    } finally {
        await client.close();
        console.log('Conexión a MongoDB cerrada.');
    }
}

run();
