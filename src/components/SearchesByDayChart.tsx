// src/components/SearchesByDayChart.tsx

"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

// Definimos la estructura de los datos que espera el gráfico
interface ChartData {
  day: string;
  search_count: number;
}

// MODIFICACIÓN: Añadimos 'timeRange' a las props que recibe el componente
interface SearchesByDayChartProps {
  data: ChartData[];
  timeRange: number; // <-- NUEVA PROP
}

// El componente de React para nuestro gráfico
export default function SearchesByDayChart({ data, timeRange }: SearchesByDayChartProps) { // <-- AÑADIMOS timeRange AQUÍ
  return (
    <div className="bg-gray-800 p-6 rounded-lg shadow-lg">
      {/* MODIFICACIÓN: El título ahora usa la prop 'timeRange' para ser dinámico */}
      <h2 className="text-gray-400 text-sm font-medium mb-4">
        Búsquedas por Día (Últimos {timeRange} días)
      </h2>
      <div style={{ width: '100%', height: 300 }}>
        <ResponsiveContainer>
          <BarChart
            data={data}
            margin={{
              top: 5,
              right: 20,
              left: -10,
              bottom: 5,
            }}
          >
            <XAxis dataKey="day" stroke="#9ca3af" fontSize={12} tickLine={false} axisLine={false} />
            <YAxis stroke="#9ca3af" fontSize={12} tickLine={false} axisLine={false} />
            <Tooltip
              cursor={{ fill: 'rgba(136, 132, 216, 0.1)' }}
              contentStyle={{ backgroundColor: '#2d3748', border: 'none', borderRadius: '8px' }}
            />
            <Legend wrapperStyle={{ fontSize: '14px' }} />
            <Bar dataKey="search_count" name="Búsquedas" fill="#8884d8" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}