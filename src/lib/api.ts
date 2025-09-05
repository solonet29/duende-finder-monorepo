// src/lib/api.ts

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://duende-api-next.vercel.app/api/analytics';

/**
 * Función genérica para hacer fetch a nuestros endpoints de analíticas.
 * Maneja errores y parsea el JSON de la respuesta.
 * @param endpoint - La ruta del endpoint, ej: '/top-artists'
 * @returns - La data de la respuesta.
 */
export async function fetchAnalyticsData(endpoint: string) {
  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`);
    if (!response.ok) {
      throw new Error(`Error fetching ${endpoint}: ${response.statusText}`);
    }
    return await response.json();
  } catch (error) {
    console.error(`Failed to fetch analytics data from ${endpoint}:`, error);
    // Devolvemos un array vacío o un objeto por defecto para no romper la UI
    return []; 
  }
}
