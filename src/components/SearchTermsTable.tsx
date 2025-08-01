// src/components/SearchTermsTable.tsx

"use client";

// MODIFICACIÓN: Ahora importamos nuestra nueva utilidad de Excel
import { exportToXlsx } from "@/lib/exportUtils";

interface TermData {
  term: string;
  search_count: number;
  avg_results: number;
  zero_result_percentage: number;
}

interface SearchTermsTableProps {
  data: TermData[];
}

export default function SearchTermsTable({ data }: SearchTermsTableProps) {
  
  const handleExport = () => {
    // Preparamos los datos con cabeceras amigables
    const dataToExport = data.map(item => ({
      'Término de Búsqueda': item.term,
      'Número de Búsquedas': item.search_count,
      'Resultados Promedio': item.avg_results,
      '% Búsquedas sin Resultados': item.zero_result_percentage,
    }));
    
    // MODIFICACIÓN: Llamamos a la nueva función de utilidad y cambiamos la extensión del archivo
    const date = new Date().toISOString().split('T')[0];
    exportToXlsx(dataToExport, `analisis_terminos_duende_finder_${date}.xlsx`);
  };

  return (
    <div className="bg-gray-800 p-6 rounded-lg shadow-lg">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-gray-400 text-sm font-medium">
          Análisis de Términos de Búsqueda
        </h2>
        {/* MODIFICACIÓN: Cambiamos el texto del botón */}
        <button
          onClick={handleExport}
          disabled={data.length === 0}
          className="px-3 py-1 text-xs font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 disabled:bg-gray-600 disabled:cursor-not-allowed"
        >
          Exportar a Excel
        </button>
      </div>
      <div className="overflow-x-auto">
        {/* El resto de la tabla se queda exactamente igual que antes */}
        <table className="w-full text-sm text-left text-gray-300">
          {/* ... thead y tbody se mantienen igual ... */}
          <thead className="text-xs text-gray-400 uppercase bg-gray-700">
            <tr>
              <th scope="col" className="px-4 py-3">Término de Búsqueda</th>
              <th scope="col" className="px-4 py-3 text-center">Nº de Búsquedas</th>
              <th scope="col" className="px-4 py-3 text-center">Resultados Promedio</th>
              <th scope="col" className="px-4 py-3 text-center">% Búsquedas sin Resultados</th>
            </tr>
          </thead>
          <tbody>
            {data.length > 0 ? (
              data.map((item) => (
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
                  No hay datos de términos de búsqueda para este período.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}