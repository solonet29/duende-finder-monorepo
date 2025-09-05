// src/components/FunnelChart.tsx
"use client";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from "recharts";

// La estructura de datos de nuestra API
interface FunnelStep {
  name: string;
  value: number;
}

interface FunnelChartProps { 
  data: FunnelStep[]; 
}

export default function FunnelChart({ data }: FunnelChartProps) {
  return (
    <div className="bg-gray-800 p-6 rounded-lg shadow-lg">
      <h2 className="text-gray-400 text-sm font-medium mb-4">Funnel de Conversión de Usuario</h2>
      <div style={{ width: '100%', height: 250 }}>
        <ResponsiveContainer>
          <BarChart layout="vertical" data={data} margin={{ top: 5, right: 20, left: 30, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.2} />
            <XAxis type="number" stroke="#9ca3af" fontSize={12} />
            <YAxis type="category" dataKey="name" stroke="#9ca3af" fontSize={12} width={100} />
            <Tooltip 
              cursor={{ fill: 'rgba(136, 132, 216, 0.1)' }} 
              contentStyle={{ backgroundColor: '#2d3748', border: 'none', borderRadius: '8px' }} 
            />
            <Legend wrapperStyle={{ fontSize: '14px' }} />
            <Bar dataKey="value" name="Usuarios" fill="#8884d8" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
