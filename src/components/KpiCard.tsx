// src/components/KpiCard.tsx
"use client";

interface KpiCardProps {
  title: string;
  value: number | string;
  unit?: string;
}

export default function KpiCard({ title, value, unit }: KpiCardProps) {
  return (
    <div className="bg-gray-800 p-6 rounded-lg shadow-lg flex flex-col justify-center items-center">
      <h2 className="text-gray-400 text-sm font-medium mb-2 text-center">{title}</h2>
      <p className="text-5xl font-semibold">
        {typeof value === 'number' ? value.toLocaleString('es-ES') : value}
        {unit && <span className="text-3xl ml-2">{unit}</span>}
      </p>
    </div>
  );
}
