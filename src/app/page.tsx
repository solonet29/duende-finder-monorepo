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
        setError(null);
        // Ejecutamos ambas consultas en paralelo para mayor eficiencia
        const [totalResult, dailyResult] = await Promise.all([
          supabase.from('search_events').select('*', { count: 'exact', head: true }),
          supabase.rpc('get_daily_search_counts', { days_limit: timeRange })
        ]);
        if (totalResult.error) throw totalResult.error;
        setTotalSearches(totalResult.count);
        if (dailyResult.error) throw dailyResult.error;
        setDailyData(dailyResult.data || []);
      } catch (err) {
        if (err instanceof Error) setError(err.message);
        else setError("Ocurrió un error inesperado al obtener los datos");
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
        <button
          key={days}
          onClick={() => setTimeRange(days)}
          className="px-4 py-2 text-sm font-medium rounded"
        >
          Últimos {days} días
        </button>
      ))}
    </div>
    );
  
  }
