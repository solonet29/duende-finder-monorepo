// src/collections/Users.ts

import type { CollectionConfig } from 'payload'

export const Users: CollectionConfig = {
  slug: 'users',

  auth: true,
  apiKeys: true,

  admin: {
    useAsTitle: 'email',
  },
  fields: [
    // Payload añade los campos de email y contraseña automáticamente
    // No necesitas añadirlos aquí si no quieres personalizarlos
  ],
}