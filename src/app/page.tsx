'use client';

import { useState, useEffect } from 'react';
import { fetchAnalyticsData } from '@/lib/api';

// --- Importamos los NUEVOS componentes ---
import ViewsOverTimeChart from '@/components/ViewsOverTimeChart';
import NewTopArtistsChart from '@/components/NewTopArtistsChart';
import NewTopCitiesChart from '@/components/NewTopCitiesChart';
import FunnelChart from '@/components/FunnelChart';
import PeakHoursChart from '@/components/PeakHoursChart';
import PeakWeekdaysChart from '@/components/PeakWeekdaysChart';
import KpiCard from '@/components/KpiCard';

// --- Definimos las NUEVAS estructuras de datos ---
interface ViewsOverTimeData { date: string; views: number; }
interface TopArtistData { artist: string; viewCount: number; }
interface TopCityData { city: string; viewCount: number; }
interface FunnelData { name: string; value: number; }
interface PeakHoursData { hour: number; count: number; }
interface PeakWeekdaysData { dayOfWeek: number; count: number; }
interface TotalViewsData { total: number; }

export default function HomePage() {
  // --- ESTADOS ---
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // --- Nuevos estados para todos los datos de nuestra API ---
  const [totalViews, setTotalViews] = useState<TotalViewsData>({ total: 0 });
  const [viewsOverTime, setViewsOverTime] = useState<ViewsOverTimeData[]>([]);
  const [topArtists, setTopArtists] = useState<TopArtistData[]>([]);
  const [topCities, setTopCities] = useState<TopCityData[]>([]);
  const [funnelData, setFunnelData] = useState<FunnelData[]>([]);
  const [peakHours, setPeakHours] = useState<PeakHoursData[]>([]);
  const [peakWeekdays, setPeakWeekdays] = useState<PeakWeekdaysData[]>([]);

  // --- EFECTO PARA OBTENER TODOS LOS DATOS DESDE NUESTRA API ---
  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        const [
          totalViewsResult,
          viewsOverTimeResult,
          topArtistsResult,
          topCitiesResult,
          funnelResult,
          peakHoursResult,
          peakWeekdaysResult
        ] = await Promise.all([
          fetchAnalyticsData('/total-event-views'),
          fetchAnalyticsData('/views-over-time'),
          fetchAnalyticsData('/top-artists'),
          fetchAnalyticsData('/city-heatmap'),
          fetchAnalyticsData('/conversion-funnel'),
          fetchAnalyticsData('/peak-hours'),
          fetchAnalyticsData('/peak-weekdays')
        ]);

        // Procesamos y guardamos todos los resultados
        setTotalViews(totalViewsResult);
        setViewsOverTime(viewsOverTimeResult);
        setTopArtists(topArtistsResult);
        setTopCities(topCitiesResult);
        
        // El funnel lo procesamos para que sea más fácil de usar en el gráfico
        const funnelSteps = [
            { name: 'Búsquedas Cerca', value: funnelResult.nearMeSearch },
            { name: 'Vistas de Evento', value: funnelResult.eventView },
            { name: 'Planear Noche', value: funnelResult.planNightRequest }
        ];
        setFunnelData(funnelSteps);

        setPeakHours(peakHoursResult);
        setPeakWeekdays(peakWeekdaysResult);

      } catch (err) {
        if (err instanceof Error) { setError(err.message); } 
        else { setError("Ocurrió un error inesperado al obtener los datos"); }
        console.error("Error fetching data:", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []); // Se elimina el filtro de tiempo por ahora

  // --- RENDERIZADO DE LA PÁGINA ---
  return (
    <main className="flex min-h-screen flex-col items-center p-4 sm:p-8 bg-gray-900 text-white">
      <header className="w-full max-w-6xl text-center mb-12">
        <h1 className="text-4xl md:text-5xl font-bold">Dashboard de Analíticas</h1>
        <p className="text-lg text-gray-400">Duende Finder</p>
      </header>
      
      <div className="w-full max-w-6xl">
        {isLoading ? (
          <div className="text-center py-20">Cargando datos de la API...</div>
        ) : error ? (
          <div className="text-center py-20 text-red-500">Error: {error}</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            
            {/* KPIs Principales */}
            <div className="lg:col-span-1">
                <KpiCard title="Vistas Totales de Eventos" value={totalViews.total} />
            </div>
            <div className="lg:col-span-3">
                <FunnelChart data={funnelData} />
            </div>

            {/* Gráfico principal de tendencias */}
            <div className="md:col-span-2 lg:col-span-4">
              <ViewsOverTimeChart data={viewsOverTime} />
            </div>
            
            {/* Gráficos secundarios */}
            <div className="md:col-span-2 lg:col-span-2">
                <NewTopCitiesChart data={topCities} />
            </div>
            <div className="md:col-span-2 lg:col-span-2">
                <NewTopArtistsChart data={topArtists} />
            </div>

            {/* Gráficos de actividad */}
            <div className="md:col-span-1 lg:col-span-2">
                <PeakHoursChart data={peakHours} />
            </div>
            <div className="md:col-span-1 lg:col-span-2">
                <PeakWeekdaysChart data={peakWeekdays} />
            </div>
            
          </div>
        )}
      </div>
    </main>
  );
}