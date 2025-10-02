// /apps/payload-cms/src/collections/Artists.ts

import type { CollectionConfig } from 'payload'

const slugify = (text: string): string => {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .normalize('NFD') // Normaliza para separar acentos de las letras
    .replace(/[\u0300-\u036f]/g, '') // Elimina los diacríticos (acentos)
    .replace(/\s+/g, '-') // Reemplaza espacios con guiones
    .replace(/[^\w\-]+/g, '') // Elimina todos los caracteres no alfanuméricos excepto guiones
    .replace(/\-\-+/g, '-'); // Reemplaza múltiples guiones con uno solo
};

export const Artists: CollectionConfig = {
  slug: 'artists',
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'image', 'updatedAt'],
    description: 'Colección de artistas y figuras del flamenco.',
  },
  access: {
    read: () => true,
    create: ({ req }: { req: { user: any } }) => Boolean(req.user),
    update: ({ req }: { req: { user: any } }) => Boolean(req.user),
    delete: ({ req }: { req: { user: any } }) => Boolean(req.user),
  },
  hooks: {
    // Este hook se ejecuta antes de guardar un documento
    beforeChange: [
      ({ data }: { data: any }) => {
        // Si el campo 'name' ha cambiado, genera un nuevo slug
        if (data.name) {
          data.slug = slugify(data.name)
        }
        return data
      },
    ],
  },
  fields: [
    {
      name: 'name',
      label: 'Nombre del Artista',
      type: 'text',
      required: true,
    },
    {
      name: 'image',
      label: 'Foto del Artista',
      type: 'upload',
      relationTo: 'media', // Relación con la colección de Media
      required: true,
    },
    {
      name: 'bio',
      label: 'Biografía',
      type: 'richText', // Permite texto con formato (negritas, enlaces, etc.)
    },
    {
      name: 'slug',
      label: 'Slug (URL amigable)',
      type: 'text',
      unique: true,
      admin: {
        position: 'sidebar',
        description: 'Se genera automáticamente a partir del nombre. Ideal para URLs.',
      },
      // Hacemos que el slug sea de solo lectura si ya existe
      // para evitar cambios accidentales que rompan URLs.
      hooks: {
        beforeChange: [
          ({ data, operation }) => {
            if (operation === 'create' && data?.name) {
              return slugify(data.name);
            }
            if (operation === 'update' && data?.name) {
              return slugify(data.name);
            }
            return data?.slug;
          }
        ],
      },
    },
    {
      name: 'socialLinks',
      label: 'Enlaces a Redes Sociales',
      type: 'group',
      fields: [
        {
          name: 'spotifyURL',
          label: 'URL de Spotify',
          type: 'text',
        },
        {
          name: 'instagramURL',
          label: 'URL de Instagram',
          type: 'text',
        },
        {
          name: 'websiteURL',
          label: 'Sitio Web Oficial',
          type: 'text',
        },
      ],
    },
  ],
}