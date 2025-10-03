
// RUTA: /apps/api/src/pages/api/artists.js
// OBJETIVO: Devolver un listado paginado de artistas marcados como "destacados" (featured: true).

import { connectToMainDb } from '@/lib/database.js';

const BATCH_SIZE = 50;

// --- Endpoint para Vercel ---
export default async function handler(req, res) {
  try {
    const page = parseInt(req.query.page) || 1;
    
    console.log(`Solicitud para obtener artistas destacados. Página: ${page}`);

    const db = await connectToMainDb();
    const artistsCollection = db.collection('artists');
    console.log("Conectado a MongoDB y a la colección 'artists'.");

    const skip = (page - 1) * BATCH_SIZE;

    // Buscamos artistas que tengan el flag `featured` en `true`
    const query = { featured: true };

    const artists = await artistsCollection
      .find(query)
      .skip(skip)
      .limit(BATCH_SIZE)
      .project({ name: 1, _id: 0 }) // Devolvemos solo el nombre del artista
      .toArray();

    const totalArtists = await artistsCollection.countDocuments(query);

    console.log(`Encontrados ${artists.length} artistas destacados.`);

    res.setHeader('Cache-Control', 'no-store, max-age=0');
    res.status(200).json({
      status: 'success',
      artists,
      pagination: {
        total: totalArtists,
        page: page,
        limit: BATCH_SIZE,
        totalPages: Math.ceil(totalArtists / BATCH_SIZE),
      },
    });
  } catch (error) {
    console.error("ERROR EN EL HANDLER DE /api/artists:", error);
    res.status(500).json({
      status: 'error',
      message: 'Se produjo un error en el servidor al obtener los artistas destacados.',
      errorMessage: error.message,
    });
  }
}
