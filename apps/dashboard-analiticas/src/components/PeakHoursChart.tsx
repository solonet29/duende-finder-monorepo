// src/components/PeakHoursChart.tsx
"use client";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

interface ChartData { 
  hour: number;
  count: number; 
}

interface PeakHoursChartProps { 
  data: ChartData[]; 
}

export default function PeakHoursChart({ data }: PeakHoursChartProps) {
  return (
    <div className="bg-gray-800 p-6 rounded-lg shadow-lg">
      <h2 className="text-gray-400 text-sm font-medium mb-4">Actividad por Hora del Día (UTC)</h2>
      <div style={{ width: '100%', height: 250 }}>
        <ResponsiveContainer>
          <BarChart data={data} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.2} />
            <XAxis dataKey="hour" stroke="#9ca3af" fontSize={12} />
            <YAxis stroke="#9ca3af" fontSize={12} />
            <Tooltip 
              cursor={{ fill: 'rgba(136, 132, 216, 0.1)' }} 
              contentStyle={{ backgroundColor: '#2d3748', border: 'none', borderRadius: '8px' }} 
            />
            <Bar dataKey="count" name="Interacciones" fill="#ffc658" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
