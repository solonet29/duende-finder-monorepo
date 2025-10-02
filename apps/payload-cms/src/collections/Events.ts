import type { CollectionConfig } from 'payload';

const Events: CollectionConfig = {
  slug: 'events',
  admin: {
    useAsTitle: 'name',
    description: 'Eventos de flamenco que se descubren, enriquecen y publican.',
    defaultColumns: ['name', 'artist', 'city', 'date', 'status']
  },
  fields: [
    {
      name: 'name',
      label: 'Nombre del Evento',
      type: 'text',
      required: true,
      admin: {
        description: 'El nombre principal del espectÃ¡culo o evento.'
      }
    },
    {
      name: 'status',
      label: 'Estado del Evento',
      type: 'select',
      options: [
        { label: 'Borrador', value: 'draft' },
        { label: 'Publicado', value: 'published' },
        { label: 'Archivado', value: 'archived' },
      ],
      defaultValue: 'draft',
      required: true,
      admin: {
        position: 'sidebar',
        description: 'Controla la visibilidad global del evento.'
      }
    },
    {
      name: 'date',
      label: 'Fecha del Evento',
      type: 'date',
      required: true,
      admin: {
        position: 'sidebar',
        date: {
          pickerAppearance: 'dayOnly',
          displayFormat: 'd MMM yyyy',
        }
      }
    },
    {
      name: 'artist',
      label: 'Artista',
      type: 'text',
    },
    {
      name: 'city',
      label: 'Ciudad',
      type: 'text',
    },
    {
      name: 'venue',
      label: 'Lugar / Sala',
      type: 'text',
    },
    {
      name: 'time',
      label: 'Hora',
      type: 'text',
      admin: {
        description: 'Ej: 21:00h'
      }
    },
    {
      name: 'sourceUrl',
      label: 'URL de Origen',
      type: 'text',
      admin: {
        description: 'La pÃ¡gina web original de donde se extrajo el evento.'
      }
    },
    {
      name: 'verificationStatus',
      label: 'Estado de VerificaciÃ³n de URL',
      type: 'select',
      options: [
        { label: 'Pendiente', value: 'pending' },
        { label: 'Verificada', value: 'verified' },
        { label: 'Fallida', value: 'failed' },
      ],
      defaultValue: 'pending',
    },
    {
      label: 'Contenido Generado',
      name: 'content',
      type: 'group',
      admin: {
        description: 'Contenido generado automÃ¡ticamente por la IA.'
      },
      fields: [
        {
          name: 'status',
          label: 'Estado del Contenido',
          type: 'select',
          options: [
            { label: 'Pendiente', value: 'pending' },
            { label: 'Generado', value: 'generated' },
            { label: 'Fallido', value: 'failed' },
          ],
          defaultValue: 'pending',
        },
        {
          name: 'blogTitle',
          label: 'TÃ­tulo del Post',
          type: 'text',
        },
        {
          name: 'blogPostMarkdown',
          label: 'Contenido del Post (Markdown)',
          type: 'textarea',
        },
        {
          name: 'nightPlanMarkdown',
          label: 'Plan de Noche (Markdown)',
          type: 'textarea',
        },
        {
          name: 'imageId',
          label: 'ID de Imagen en WordPress',
          type: 'text',
        },
        {
          name: 'imageUrl',
          label: 'URL de la Imagen',
          type: 'text',
        },
        {
            name: 'generatedAt',
            label: 'Fecha de GeneraciÃ³n',
            type: 'date',
        }
      ]
    },
    {
      label: 'Datos de PublicaciÃ³n',
      name: 'publication',
      type: 'group',
      fields: [
        {
          name: 'wordpressPostId',
          label: 'ID del Post en WordPress',
          type: 'number',
        },
        {
          name: 'blogPostUrl',
          label: 'URL del Post',
          type: 'text',
        },
        {
          name: 'publicationDate',
          label: 'Fecha de PublicaciÃ³n Programada',
          type: 'date',
        },
        {
          name: 'isDistributed',
          label: 'Â¿Distribuido en Redes Sociales?',
          type: 'checkbox',
          defaultValue: false,
        },
        {
          name: 'postImageUpdated',
          label: 'Â¿Imagen del Post Actualizada?',
          type: 'checkbox',
          defaultValue: false,
        }
      ]
    }
  ],
};

export default Events;
