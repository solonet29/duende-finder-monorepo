import type { CollectionConfig } from 'payload'

export const Sliders: CollectionConfig = {
  slug: 'sliders',
  admin: {
    useAsTitle: 'title',
  },

  // --- AÑADIDO: Bloque de Control de Acceso ---
  // Esto soluciona el error 403 permitiendo la lectura pública.
  access: {
    read: () => true, // Cualquiera puede LEER
    create: ({ req: { user } }) => Boolean(user), // Solo admins pueden CREAR
    update: ({ req: { user } }) => Boolean(user), // Solo admins pueden ACTUALIZAR
    delete: ({ req: { user } }) => Boolean(user), // Solo admins pueden BORRAR
  },
  // --- FIN DEL BLOQUE AÑADIDO ---

  fields: [
    {
      name: 'title',
      type: 'text',
      required: true,
    },
    {
      name: 'type',
      type: 'select',
      options: [
        {
          label: 'Automatic',
          value: 'automatic',
        },
        {
          label: 'Manual',
          value: 'manual',
        },
      ],
      required: true,
    },
    {
      name: 'automaticSource',
      type: 'text',
      admin: {
        condition: ({ type }) => type === 'automatic',
      },
      label: 'API Query Parameters',
    },
    {
      name: 'manualEvents',
      type: 'array',
      label: 'Manual Event IDs',
      minRows: 1,
      maxRows: 20,
      admin: {
        condition: ({ type }) => type === 'manual',
      },
      fields: [
        {
          name: 'eventId',
          type: 'text',
          label: 'Event ID',
          required: true,
        },
      ],
    },
  ],
}