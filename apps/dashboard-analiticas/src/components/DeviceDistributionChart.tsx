// src/components/DeviceDistributionChart.tsx

"use client"; // Marcamos este como un Componente de Cliente para usar hooks

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient'; // Importamos nuestro cliente centralizado
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';

// Definimos una interfaz para la forma de nuestros datos, buena práctica con TypeScript
interface DeviceData {
    device_type: string;
    count: number;
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042'];

const DeviceDistributionChart = () => {
    const [data, setData] = useState<DeviceData[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function fetchDataForDeviceChart() {
            setLoading(true);
            // Llama a la función que creamos en la base de datos
            const { data: chartData, error } = await supabase.rpc('get_device_distribution');

            if (error) {
                console.error('Error fetching device distribution:', error);
                setData([]);
            } else {
                setData(chartData);
            }
            setLoading(false);
        }

        fetchDataForDeviceChart();
    }, []); // El array vacío asegura que esto se ejecute solo una vez

    if (loading) {
        return <div>Cargando datos de dispositivos...</div>;
    }

    return (
        <div style={{ width: '100%', height: 300 }}>
            <h3>Uso por Dispositivo</h3>
            <ResponsiveContainer>
                <PieChart>
                    <Pie
                        data={data}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="count"
                        nameKey="device_type"
                        label={(entry) => `${entry.device_type} (${entry.count})`}
                    >
                        {data.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                </PieChart>
            </ResponsiveContainer>
        </div>
    );
};

export default DeviceDistributionChart;