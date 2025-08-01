// src/components/SearchTermsTable.tsx

"use client";

import { useState, useMemo } from 'react'; // <-- AÑADIMOS useState y useMemo
import { exportToXlsx } from "@/lib/exportUtils";

// La interfaz de datos no cambia
interface TermData {
  term: string;
  search_count: number;
  avg_results: number;
  zero_result_percentage: number;
}

interface SearchTermsTableProps {
  data: TermData[];
}

// Definimos los tipos para nuestras claves de ordenación
type SortKey = keyof TermData;
type SortDirection = 'ascending' | 'descending';

export default function SearchTermsTable({ data }: SearchTermsTableProps) {
  // --- NUEVOS ESTADOS PARA LA ORDENACIÓN ---
  const [sortKey, setSortKey] = useState<SortKey>('search_count');
  const [sortDirection, setSortDirection] = useState<SortDirection>('descending');

  // --- NUEVA LÓGICA DE ORDENACIÓN CON useMemo ---
  const sortedData = useMemo(() => {
    const sorted = [...data].sort((a, b) => {
      if (a[sortKey] < b[sortKey]) {
        return sortDirection === 'ascending' ? -1 : 1;
      }
      if (a[sortKey] > b[sortKey]) {
        return sortDirection === 'ascending' ? 1 : -1;
      }
      return 0;
    });
    return sorted;
  }, [data, sortKey, sortDirection]);

  // --- NUEVA FUNCIÓN PARA MANEJAR CLICS EN CABECERAS ---
  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      // Si ya estamos ordenando por esta columna, invertimos la dirección
      setSortDirection(sortDirection === 'ascending' ? 'descending' : 'ascending');
    } else {
      // Si es una nueva columna, la establecemos y ordenamos de forma descendente por defecto
      setSortKey(key);
      setSortDirection('descending');
    }
  };
  
  const handleExport = () => {
    // La lógica de exportación no cambia, pero usará los datos ordenados
    const dataToExport = sortedData.map(item => ({
      'Término de Búsqueda': item.term,
      'Número de Búsquedas': item.search_count,
      'Resultados Promedio': item.avg_results,
      '% Búsquedas sin Resultados': item.zero_result_percentage,
    }));
    const date = new Date().toISOString().split('T')[0];
    exportToXlsx(dataToExport, `analisis_terminos_duende_finder_${date}.xlsx`);
  };

  // Pequeño componente para el icono de ordenación
  const SortIcon = ({ columnKey }: { columnKey: SortKey }) => {
    if (sortKey !== columnKey) return null;
    return sortDirection === 'ascending' ? ' 🔼' : ' 🔽';
  };

  return (
    <div className="bg-gray-800 p-6 rounded-lg shadow-lg">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-gray-400 text-sm font-medium">
          Análisis de Términos de Búsqueda
        </h2>
        <button
          onClick={handleExport}
          disabled={data.length === 0}
          className="px-3 py-1 text-xs font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 disabled:bg-gray-600 disabled:cursor-not-allowed"
        >
          Exportar a Excel
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left text-gray-300">
          <thead className="text-xs text-gray-400 uppercase bg-gray-700">
            <tr>
              {/* --- CABECERAS AHORA CLICABLES --- */}
              <th scope="col" className="px-4 py-3 cursor-pointer" onClick={() => handleSort('term')}>
                Término de Búsqueda<SortIcon columnKey="term" />
              </th>
              <th scope="col" className="px-4 py-3 text-center cursor-pointer" onClick={() => handleSort('search_count')}>
                Nº de Búsquedas<SortIcon columnKey="search_count" />
              </th>
              <th scope="col" className="px-4 py-3 text-center cursor-pointer" onClick={() => handleSort('avg_results')}>
                Resultados Promedio<SortIcon columnKey="avg_results" />
              </th>
              <th scope="col" className="px-4 py-3 text-center cursor-pointer" onClick={() => handleSort('zero_result_percentage')}>
                % Búsquedas sin Resultados<SortIcon columnKey="zero_result_percentage" />
              </th>
            </tr>
          </thead>
          <tbody>
            {/* --- LA TABLA AHORA USA 'sortedData' EN LUGAR DE 'data' --- */}
            {sortedData.length > 0 ? (
              sortedData.map((item) => (
                <tr key={item.term} className="border-b border-gray-700 hover:bg-gray-600">
                  <th scope="row" className="px-4 py-4 font-medium text-white whitespace-nowrap">
                    {item.term}
                  </th>
                  <td className="px-4 py-4 text-center">{item.search_count}</td>
                  <td className="px-4 py-4 text-center">{item.avg_results}</td>
                  <td className={`px-4 py-4 text-center font-semibold ${
                      item.zero_result_percentage > 50 ? 'text-red-400' :
                      item.zero_result_percentage > 20 ? 'text-yellow-400' : 'text-green-400'
                    }`}
                  >
                    {item.zero_result_percentage}%
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={4} className="text-center py-8 text-gray-500">
                  No hay datos de términos de búsqueda para este período seleccionado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}