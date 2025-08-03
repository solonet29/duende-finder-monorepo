"use client";

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';

// Importamos todos nuestros componentes
import SearchesByDayChart from '@/components/SearchesByDayChart';
import SearchTermsTable from '@/components/SearchTermsTable';
import TopCitiesChart from '@/components/TopCitiesChart';
import TopArtistsChart from '@/components/TopArtistsChart';
import DeviceDistributionChart from '@/components/DeviceDistributionChart';


// Definimos las estructuras de datos que vamos a manejar
interface DailySearchData { day: string; search_count: number; }
interface TermData { term: string; search_count: number; avg_results: number; zero_result_percentage: number; }
interface TopCityData { city: string; search_count: number; }
interface TopArtistData { artist: string; search_count: number; }

export default function HomePage() {
  // --- ESTADOS ---
  const [totalSearches, setTotalSearches] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState<number>(30); // Default a 30 días

  // Estados para cada visualización
  const [dailyData, setDailyData] = useState<DailySearchData[]>([]);
  const [termData, setTermData] = useState<TermData[]>([]);
  const [topCitiesData, setTopCitiesData] = useState<TopCityData[]>([]);
  const [topArtistsData, setTopArtistsData] = useState<TopArtistData[]>([]);

  // --- EFECTO PARA OBTENER TODOS LOS DATOS ---
  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        // Ahora ejecutamos 5 consultas en paralelo
        const [totalResult, dailyResult, termsResult, citiesResult, artistsResult] = await Promise.all([
          supabase.from('search_events').select('*', { count: 'exact', head: true }),
          supabase.rpc('get_daily_search_counts', { days_limit: timeRange }),
          supabase.rpc('get_search_term_analysis', { days_limit: timeRange }),
          supabase.rpc('get_top_cities', { days_limit: timeRange }), // NUEVA LLAMADA
          supabase.rpc('get_top_artists', { days_limit: timeRange })  // NUEVA LLAMADA
        ]);

        // Procesamos todos los resultados
        if (totalResult.error) throw totalResult.error;
        setTotalSearches(totalResult.count);

        if (dailyResult.error) throw dailyResult.error;
        setDailyData(dailyResult.data || []);
        
        if (termsResult.error) throw termsResult.error;
        setTermData(termsResult.data || []);
        
        if (citiesResult.error) throw citiesResult.error;
        setTopCitiesData(citiesResult.data || []);
        
        if (artistsResult.error) throw artistsResult.error;
        setTopArtistsData(artistsResult.data || []);

      } catch (err) {
        if (err instanceof Error) { setError(err.message); } 
        else { setError("Ocurrió un error inesperado al obtener los datos"); }
        console.error("Error fetching data:", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [timeRange]);

  // --- COMPONENTE PARA LOS BOTONES DE FILTRADO ---
  const TimeRangeButtons = () => (
    <div className="flex justify-start items-center gap-2 mb-6">
      {[7, 30, 90].map((days) => (
        <button key={days} onClick={() => setTimeRange(days)}
          className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
            timeRange === days ? 'bg-indigo-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
          }`}
        >Últimos {days} días</button>
      ))}
    </div>
  );

  // --- RENDERIZADO DE LA PÁGINA ---
  return (
    <main className="flex min-h-screen flex-col items-center p-8 bg-gray-900 text-white">
      <header className="w-full max-w-5xl text-center mb-12">
        <h1 className="text-4xl font-bold">Panel de análisis V3</h1>
        <p className="text-lg text-gray-400">Buscador Duende Finder</p>
      </header>

      <div className="w-full max-w-5xl"><TimeRangeButtons /></div>
      
      <div className="w-full max-w-5xl">
        {isLoading ? (
          <div className="text-center py-20">Cargando datos...</div>
        ) : error ? (
          <div className="text-center py-20 text-red-500">Error: {error}</div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* KPI CARD - ahora es un componente individual dentro del grid */}
            <div className="bg-gray-800 p-6 rounded-lg shadow-lg flex flex-col justify-center items-center">
              <h2 className="text-gray-400 text-sm font-medium mb-2">Interacciones Totales (en período)</h2>
              <p className="text-5xl font-semibold">
                {totalSearches !== null ? totalSearches.toLocaleString('es-ES') : 'N/A'}
              </p>
            </div>
            
            {/* KPI CARD Placeholder para Búsquedas sin resultados - una futura mejora */}
            <div className="bg-gray-800 p-6 rounded-lg shadow-lg flex flex-col justify-center items-center">
              <h2 className="text-gray-400 text-sm font-medium mb-2">KPI Adicional (Próximamente)</h2>
              <p className="text-5xl font-semibold">...</p>
            </div>

            {/* GRÁFICO DE TENDENCIAS */}
            <div className="lg:col-span-2">
              <SearchesByDayChart data={dailyData} timeRange={timeRange} />
            </div>
            
            {/* NUEVOS GRÁFICOS */}
            <div><TopCitiesChart data={topCitiesData} /></div>
            <div><TopArtistsChart data={topArtistsData} /></div>

            {/* TABLA DE TÉRMINOS */}
            <div className="lg:col-span-2">
              <SearchTermsTable data={termData} />
            </div>
            
          </div>
        )}
      </div>
    </main>
  );
  //PRUEBA CARGA GITHUB
}