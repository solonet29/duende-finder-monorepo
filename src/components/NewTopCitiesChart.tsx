// src/components/NewTopCitiesChart.tsx
"use client";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

// La nueva estructura de datos de nuestra API
interface ChartData { 
  city: string; 
  viewCount: number; 
}

interface NewTopCitiesChartProps { 
  data: ChartData[]; 
}

export default function NewTopCitiesChart({ data }: NewTopCitiesChartProps) {
  return (
    <div className="bg-gray-800 p-6 rounded-lg shadow-lg">
      <h2 className="text-gray-400 text-sm font-medium mb-4">Ciudades con Más Vistas</h2>
      <div style={{ width: '100%', height: 250 }}>
        <ResponsiveContainer>
          <BarChart layout="vertical" data={data} margin={{ top: 5, right: 20, left: 30, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.2} />
            <XAxis type="number" stroke="#9ca3af" fontSize={12} />
            <YAxis type="category" dataKey="city" stroke="#9ca3af" fontSize={12} width={80} />
            <Tooltip 
              cursor={{ fill: 'rgba(136, 132, 216, 0.1)' }} 
              contentStyle={{ backgroundColor: '#2d3748', border: 'none', borderRadius: '8px' }} 
            />
            {/* Cambiamos el dataKey a viewCount y el nombre a Vistas */}
            <Bar dataKey="viewCount" name="Vistas" fill="#82ca9d" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
