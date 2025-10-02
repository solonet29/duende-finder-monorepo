// /apps/payload-cms/src/collections/Users.ts

import type { CollectionConfig } from 'payload'

export const Users: CollectionConfig = {
  slug: 'users',

  auth: {
    useAPIKey: true,
    verify: true,
  },

  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'email', 'roles', 'createdAt'],
    description: 'Colección para los usuarios, administradores y editores del sistema.',
  },

  // REGLAS DE ACCESO TEMPORALES PARA PODER GENERAR TIPOS
  access: {
    create: () => true,
    read: () => true, // TEMPORAL
    readVersions: () => true, // TEMPORAL
    delete: () => true, // TEMPORAL
    update: () => true, // TEMPORAL
  },

  fields: [
    {
      name: 'name',
      label: 'Nombre',
      type: 'text',
    },
    {
      name: 'roles',
      label: 'Roles',
      type: 'select',
      hasMany: true,
      defaultValue: ['editor'],
      required: true,

      // REGLAS DE ACCESO TEMPORALES PARA PODER GENERAR TIPOS
      access: {
        read: () => true, // TEMPORAL
        create: () => true, // TEMPORAL
        update: () => true, // TEMPORAL
      },

      options: [
        {
          label: 'Administrador',
          value: 'admin',
        },
        {
          label: 'Editor',
          value: 'editor',
        },
      ],
    },
  ],
}