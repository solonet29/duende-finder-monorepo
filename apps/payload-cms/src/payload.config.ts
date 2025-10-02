// storage-adapter-import-placeholder
import { mongooseAdapter } from '@payloadcms/db-mongodb'
import { payloadCloudPlugin } from '@payloadcms/payload-cloud'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import path from 'path'
import { buildConfig } from 'payload'
import { fileURLToPath } from 'url'

import { Users } from './collections/Users.js'
import { Media } from './collections/Media.js'
import { Sliders } from './collections/Sliders.js'
import Events from './collections/Events.js';

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

export default buildConfig({
  // AÃADIDO: Clave para que las URLs de las imÃ¡genes sean correctas
  serverURL: process.env.PAYLOAD_PUBLIC_SERVER_URL || 'http://localhost:3000',

  admin: {
    user: Users.slug,
    importMap: {
      baseDir: path.resolve(dirname),
    },
  },
  collections: [Users, Media, Sliders, Events],
  editor: lexicalEditor(),
  secret: process.env.PAYLOAD_SECRET || '',
  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },
  db: mongooseAdapter({
    url: process.env.DATABASE_URI || '',
  }),

  // --- CONFIGURACIÓN DE SEGURIDAD COMPLETA ---
  cors: [
    'https://cms-duendefinder.vercel.app',
    'https://buscador.afland.es',
    'https://afland.es',
    'http://localhost:8080',
    'http://localhost:3000',
    'http://127.0.0.1:5500', // Para pruebas con Live Server
  ],
  // AÑADIDO: Esta propiedad faltaba y es CRUCIAL
  csrf: [
    'https://cms-duendefinder.vercel.app',
    'https://buscador.afland.es',
    'https://afland.es',
    'http://localhost:8080',
    'http://localhost:3000',
    'http://127.0.0.1:5500', // Para pruebas con Live Server
  ],
  // --- FIN DE LA CONFIGURACIÓN DE SEGURIDAD ---

  plugins: [
    payloadCloudPlugin(),
    // storage-adapter-placeholders
  ],
})
