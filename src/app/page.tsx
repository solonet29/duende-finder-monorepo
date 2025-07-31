// src/app/page.tsx

"use client";

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';

// NUEVA IMPORTACIÓN: Importamos nuestro componente de gráfico
import SearchesByDayChart from '@/components/SearchesByDayChart';

// NUEVA INTERFAZ: Definimos la forma de los datos del gráfico
interface DailySearchData {
  day: string;
  search_count: number;
}

export default function HomePage() {
  // Estados que ya teníamos
  const [totalSearches, setTotalSearches] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // NUEVO ESTADO: para guardar los datos del gráfico de búsquedas diarias
  const [dailyData, setDailyData] = useState<DailySearchData[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true);
        
        // Haremos las dos consultas a la vez para más eficiencia con Promise.all
        const [totalResult, dailyResult] = await Promise.all([
          // Consulta 1: Obtener el conteo total (como antes)
          supabase.from('search_events').select('*', { count: 'exact', head: true }),
          
          // Consulta 2: LLAMADA RPC a nuestra función de base de datos
          supabase.rpc('get_daily_search_counts', { days_limit: 7 })
        ]);

        // Manejo de error para el conteo total
        if (totalResult.error) throw totalResult.error;
        setTotalSearches(totalResult.count);

        // Manejo de error para los datos diarios
        if (dailyResult.error) throw dailyResult.error;
        setDailyData(dailyResult.data || []);

      } catch (err: any) {
        setError(err.message);
        console.error("Error fetching data:", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  return (
    <main className="flex min-h-screen flex-col items-center p-8 bg-gray-900 text-white">
      <header className="w-full max-w-5xl text-center mb-12">
        <h1 className="text-4xl font-bold">Dashboard de Analíticas</h1>
        <p className="text-lg text-gray-400">Buscador Duende Finder</p>
      </header>

      <div className="w-full max-w-5xl">
        {isLoading ? (
          <div className="text-center">Cargando datos...</div>
        ) : error ? (
          <div className="text-center text-red-500">Error: {error}</div>
        ) : (
          // Contenedor para nuestros widgets
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Widget 1: Total de Búsquedas */}
            <div className="bg-gray-800 p-6 rounded-lg shadow-lg lg:col-span-1">
              <h2 className="text-gray-400 text-sm font-medium mb-2">Búsquedas Totales</h2>
              <p className="text-3xl font-semibold">
                {totalSearches !== null ? totalSearches.toLocaleString('es-ES') : 'N/A'}
              </p>
            </div>

            {/* NUEVO WIDGET: Gráfico de Búsquedas por Día */}
            <div className="lg:col-span-2">
              <SearchesByDayChart data={dailyData} />
            </div>

          </div>
        )}
      </div>
    </main>
  );
}