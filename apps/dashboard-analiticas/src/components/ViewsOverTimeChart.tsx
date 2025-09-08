// src/components/ViewsOverTimeChart.tsx
"use client";

import { LineChart, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid } from "recharts";

// La estructura de datos de nuestra API
interface ChartData {
  date: string;
  views: number;
}

interface ViewsOverTimeChartProps {
  data: ChartData[];
}

export default function ViewsOverTimeChart({ data }: ViewsOverTimeChartProps) {
  return (
    <div className="bg-gray-800 p-6 rounded-lg shadow-lg">
      <h2 className="text-gray-400 text-sm font-medium mb-4">
        Vistas de Eventos por Día
      </h2>
      <div style={{ width: '100%', height: 300 }}>
        <ResponsiveContainer>
          <LineChart
            data={data}
            margin={{
              top: 5,
              right: 20,
              left: -10,
              bottom: 5,
            }}
          >
            <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.2} />
            <XAxis dataKey="date" stroke="#9ca3af" fontSize={12} tickLine={false} axisLine={false} />
            <YAxis stroke="#9ca3af" fontSize={12} tickLine={false} axisLine={false} />
            <Tooltip
              cursor={{ fill: 'rgba(136, 132, 216, 0.1)' }}
              contentStyle={{ backgroundColor: '#2d3748', border: 'none', borderRadius: '8px' }}
            />
            <Legend wrapperStyle={{ fontSize: '14px' }} />
            <Line type="monotone" dataKey="views" name="Vistas" stroke="#8884d8" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 8 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
