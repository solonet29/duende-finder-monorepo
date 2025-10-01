import type { CollectionConfig } from 'payload'

export const Sliders: CollectionConfig = {
  slug: 'sliders',
  admin: {
    useAsTitle: 'title',
  },
  access: {
    read: () => true, // Cualquiera puede LEER
    create: ({ req: { user } }) => Boolean(user), // Solo admins pueden CREAR
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
      label: 'Artistas del Slider',
      type: 'array',
      minRows: 1,
      maxRows: 20,
      fields: [
        {
          name: 'artistName',
          label: 'Nombre del Artista',
          type: 'text',
          required: true,
        },
        {
          name: 'artistImageURL',
          label: 'URL de la Imagen',
          type: 'text',
          required: true,
        },
        {
          name: 'artistProfileURL',
          label: 'URL del Perfil',
          type: 'text',
          required: true,
        },
      ],
    },
  ],
}
