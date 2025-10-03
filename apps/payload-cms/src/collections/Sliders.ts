import type { CollectionConfig } from 'payload'

export const Sliders: CollectionConfig = {
  slug: 'sliders',
  admin: {
    useAsTitle: 'title',
  },
  access: {
    read: () => true, // Cualquiera puede LEER
    create: ({ req: { user } }) => Boolean(user), // Solo usuarios logueados pueden CREARLO

    // --- INICIO DEL CÓDIGO DE DEPURACIÓN ---
    update: ({ req: { user } }) => {
      console.log('--- DEBUG: EJECUTANDO ACCESO DE UPDATE EN SLIDERS ---');
      console.log('Usuario recibido en la petición:', JSON.stringify(user, null, 2));
      console.log('Roles del usuario (si existen):', user?.roles);

      const hasPermission = Boolean(user); // Usamos tu lógica actual para la prueba
      console.log('¿Tiene permiso (según Boolean(user))?:', hasPermission);

      // Más adelante cambiaremos esto por la comprobación de roles
      const isAdmin = user?.roles?.includes('admin');
      console.log('¿Es admin?:', isAdmin);

      return hasPermission; // De momento, dejamos la regla original
    },
    // --- FIN DEL CÓDIGO DE DEPURACIÓN ---

    delete: ({ req: { user } }) => Boolean(user), // Solo usuarios logueados pueden BORRAR
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
      relationTo: 'events', // Correcto, ya está simplificado.
      hasMany: true,
      admin: {
        description: 'Añade eventos a este slider.',
      },
    },
  ],
}