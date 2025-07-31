// src/lib/supabaseClient.ts

import { createClient } from '@supabase/supabase-js'

// Obtenemos las variables de entorno que configuraste en el .env.local
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

// Es una buena práctica asegurarse de que las variables de entorno existan
if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Supabase URL or Anon Key is missing from .env.local")
}

// Creamos y exportamos el cliente de Supabase para usarlo en toda la app
export const supabase = createClient(supabaseUrl, supabaseAnonKey)
