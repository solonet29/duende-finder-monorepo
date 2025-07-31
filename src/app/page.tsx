//Reforzando la conexión con Verce

"use client";

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import SearchesByDayChart from '@/components/SearchesByDayChart';

// Interfaz para la forma de los datos del gráfico
interface DailySearchData {
  day: string;
  search_count: number;
}

export default function HomePage() {
  // --- ESTADOS ---
  const [totalSearches, setTotalSearches] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dailyData, setDailyData] = useState<DailySearchData[]>([]);
  const [timeRange, setTimeRange] = useState<number>(7); // Filtro de tiempo en días

  // --- EFECTO PARA OBTENER DATOS ---
  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true);
        setError(null); // Limpiar errores de peticiones anteriores
        
        // Ejecutamos ambas consultas en paralelo para mayor eficiencia
        const [totalResult, dailyResult] = await Promise.all([
          supabase.from('search_events').select('*', { count: 'exact', head: true }),
          supabase.rpc('get_daily_search_counts', { days_limit: timeRange })
        ]);

        // Procesamos el resultado del conteo total
        if (totalResult.error) throw totalResult.error;
        setTotalSearches(totalResult.count);

        // Procesamos el resultado de los datos diarios para el gráfico
        if (dailyResult.error) throw dailyResult.error;
        setDailyData(dailyResult.data || []);

      } catch (err) {
        // Manejo de errores seguro, sin usar ': any'
        if (err instanceof Error) {
          setError(err.message);
        } else {
          setError("Ocurrió un error inesperado al obtener los datos");
        }
        console.error("Error fetching data:", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [timeRange]); // La lista de dependencias hace que se vuelva a ejecutar si 'timeRange' cambia

  // --- COMPONENTE PARA LOS BOTONES DE FILTRADO ---
  const TimeRangeButtons = () => (
    <div className="flex justify-start items-center gap-2 mb-6">
      {[7, 30, 90].map((days) => (
        <button
          key={days}
          onClick={() => setTimeRange(days)}
          className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
            timeRange === days
              ? 'bg-indigo-600 text-white' // Estilo activo
              : 'bg-gray-700 text-gray-300 hover:bg-gray-600' // Estilo inactivo
          }`}
        >
          Últimos {days} días
        </button>
      ))}
    </div>
  );

  // --- RENDERIZADO DE LA PÁGINA ---
  return (
    <main className="flex min-h-screen flex-col items-center p-8 bg-gray-900 text-white">
      <header className="w-full max-w-5xl text-center mb-12">
        <h1 className="text-4xl font-bold">Panel de análisis</h1>
        <p className="text-lg text-gray-400">Buscador Duende Finder</p>
      </header>

      <div className="w-full max-w-5xl">
        <TimeRangeButtons />
      </div>
      
      <div className="w-full max-w-5xl">
        {isLoading ? (
          <div className="text-center">Cargando datos...</div>
        ) : error ? (
          <div className="text-center text-red-500">Error: {error}</div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="bg-gray-800 p-6 rounded-lg shadow-lg lg:col-span-1">
              <h2 className="text-gray-400 text-sm font-medium mb-2">Búsquedas Totales</h2>
              <p className="text-3xl font-semibold">
                {totalSearches !== null ? totalSearches.toLocaleString('es-ES') : 'N/A'}
              </p>
            </div>
            <div className="lg:col-span-2">
              <SearchesByDayChart data={dailyData} />
            </div>
          </div>
        )}
      </div>
    </main>
  );
}