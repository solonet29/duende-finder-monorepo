import { CollectionConfig } from 'payload/types'

export const Sliders: CollectionConfig = {
  slug: 'sliders',
  admin: {
    useAsTitle: 'title',
  },
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
