// src/components/PeakWeekdaysChart.tsx
"use client";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

interface ChartData { 
  dayOfWeek: number;
  count: number; 
}

interface PeakWeekdaysChartProps { 
  data: ChartData[]; 
}

const dayNames = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

const getDayName = (dayOfWeek: number) => {
  return dayNames[dayOfWeek - 1] || 'Día desc.';
};

export default function PeakWeekdaysChart({ data }: PeakWeekdaysChartProps) {
  const processedData = data.map(item => ({
    ...item,
    dayName: getDayName(item.dayOfWeek)
  }));

  return (
    <div className="bg-gray-800 p-6 rounded-lg shadow-lg">
      <h2 className="text-gray-400 text-sm font-medium mb-4">Actividad por Día de la Semana</h2>
      <div style={{ width: '100%', height: 250 }}>
        <ResponsiveContainer>
          <BarChart data={processedData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.2} />
            <XAxis dataKey="dayName" stroke="#9ca3af" fontSize={12} />
            <YAxis stroke="#9ca3af" fontSize={12} />
            <Tooltip 
              cursor={{ fill: 'rgba(136, 132, 216, 0.1)' }} 
              contentStyle={{ backgroundColor: '#2d3748', border: 'none', borderRadius: '8px' }} 
            />
            <Bar dataKey="count" name="Interacciones" fill="#82ca9d" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
