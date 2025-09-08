
const { MongoClient } = require('mongodb');

const uri = process.env.MONGO_URI;
if (!uri) {
  throw new Error('La variable de entorno MONGO_URI debe estar definida.');
}

/**
 * @type {import('mongodb').MongoClient}
 */
let client;
let clientPromise;

/**
 * Obtiene una instancia del cliente de MongoDB y la promesa de conexión.
 * Utiliza un patrón Singleton para evitar múltiples conexiones.
 * @returns {{client: import('mongodb').MongoClient, clientPromise: Promise<import('mongodb').MongoClient>}}
 */
function getClient() {
  if (!client) {
    client = new MongoClient(uri);
    // client.connect() devuelve una promesa que se resuelve con el cliente conectado.
    // La almacenamos para reutilizarla y no llamar a .connect() múltiples veces.
    clientPromise = client.connect();
    console.log('MongoDB Client: Nueva conexión iniciada.');
  } else {
    console.log('MongoDB Client: Usando conexión existente.');
  }
  return { client, clientPromise };
}

module.exports = { getClient };
