// src/app/page.tsx - VERSIÓN CON TABLA DE TÉRMINOS

"use client";

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import SearchesByDayChart from '@/components/SearchesByDayChart';
// ---- NUEVA IMPORTACIÓN ----
import SearchTermsTable from '@/components/SearchTermsTable';

// ---- NUEVA INTERFAZ ----
interface TermData {
  term: string;
  search_count: number;
  avg_results: number;
  zero_result_percentage: number;
}

interface DailySearchData {
  day: string;
  search_count: number;
}

export default function HomePage() {
  // Estados que ya teníamos
  const [totalSearches, setTotalSearches] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dailyData, setDailyData] = useState<DailySearchData[]>([]);
  const [timeRange, setTimeRange] = useState<number>(7);

  // ---- NUEVO ESTADO PARA LA TABLA ----
  const [termData, setTermData] = useState<TermData[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        // ---- TERCERA LLAMADA RPC AÑADIDA A PROMISE.ALL ----
        const [totalResult, dailyResult, termsResult] = await Promise.all([
          supabase.from('search_events').select('*', { count: 'exact', head: true }),
          supabase.rpc('get_daily_search_counts', { days_limit: timeRange }),
          supabase.rpc('get_search_term_analysis', { days_limit: timeRange }) // <-- NUEVA LLAMADA
        ]);

        if (totalResult.error) throw totalResult.error;
        setTotalSearches(totalResult.count);

        if (dailyResult.error) throw dailyResult.error;
        setDailyData(dailyResult.data || []);
        
        // ---- MANEJO DE LOS NUEVOS DATOS ----
        if (termsResult.error) throw termsResult.error;
        setTermData(termsResult.data || []);

      } catch (err) {
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
  }, [timeRange]);

  const TimeRangeButtons = () => (
    <div className="flex justify-start items-center gap-2 mb-6">
      {[7, 30, 90].map((days) => (
        <button
          key={days}
          onClick={() => setTimeRange(days)}
          className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
            timeRange === days
              ? 'bg-indigo-600 text-white'
              : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
          }`}
        >
          Últimos {days} días
        </button>
      ))}
    </div>
  );

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
          // El grid ahora contendrá todos nuestros componentes
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="bg-gray-800 p-6 rounded-lg shadow-lg lg:col-span-1">
              <h2 className="text-gray-400 text-sm font-medium mb-2">Búsquedas Totales</h2>
              <p className="text-3xl font-semibold">
                {totalSearches !== null ? totalSearches.toLocaleString('es-ES') : 'N/A'}
              </p>
            </div>
            <div className="lg:col-span-2">
              <SearchesByDayChart data={dailyData} timeRange={timeRange} />
            </div>

            {/* ---- NUEVO COMPONENTE DE TABLA AÑADIDO AL GRID ---- */}
            <div className="lg:col-span-3">
              <SearchTermsTable data={termData} />
            </div>
            
          </div>
        )}
      </div>
    </main>
  );
}