// src/collections/Users.ts

import type { CollectionConfig } from 'payload'

export const Users: CollectionConfig = {
  slug: 'users',

  // --- AÑADE ESTO PARA HABILITAR LAS API KEYS ---
  auth: {
    enableAPIKey: true, // ¡Esta línea es la que activa la función!
  },
  // --- FIN DE LA SECCIÓN A AÑADIR ---

  admin: {
    useAsTitle: 'email',
  },
  fields: [
    // Payload añade los campos de email y contraseña automáticamente
    // No necesitas añadirlos aquí si no quieres personalizarlos
  ],
}