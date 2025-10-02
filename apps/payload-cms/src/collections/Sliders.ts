import type { CollectionConfig } from 'payload'

export const Sliders: CollectionConfig = {
  slug: 'sliders',
  admin: {
    useAsTitle: 'title',
  },
  access: {
    read: () => true, // Cualquiera puede LEER
    create: ({ req: { user } }) => Boolean(user), // Solo admins pueden CREARLO
    update: ({ req: { user } }) => Boolean(user), // Solo admins pueden ACTUALIZAR
    delete: ({ req: { user } }) => Boolean(user), // Solo admins pueden BORRAR
  },
  fields: [
    {
      name: 'title',
      label: 'Título del Slider',
      type: 'text',
      required: true,
    },
    {
      name: 'sliderItems',
      label: 'Items del Slider',
      type: 'relationship',
      relationTo: ['artists', 'events'] as const,
      hasMany: true,
      admin: {
        description: 'Añade artistas o eventos a este slider.',
      },
    },
  ],
}