// src/lib/exportUtils.ts

import { unparse } from "papaparse";
// ---- NUEVA IMPORTACIÓN PARA EXCEL ----
import * as XLSX from 'xlsx';

/**
 * Convierte un array de objetos a un string CSV y lo descarga en el navegador.
 */
export function exportToCsv(data: Record<string, any>[], filename: string) {
  const csv = unparse(data);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Convierte un array de objetos a un archivo .xlsx y lo descarga en el navegador.
 * @param data El array de datos a exportar.
 * @param filename El nombre del archivo que se descargará (debe terminar en .xlsx).
 */
export function exportToXlsx(data: Record<string, any>[], filename: string) {
  // 1. Crear una 'hoja de trabajo' (worksheet) a partir de nuestros datos.
  const ws: XLSX.WorkSheet = XLSX.utils.json_to_sheet(data);

  // 2. Crear un 'libro' (workbook) y añadirle nuestra hoja de trabajo.
  const wb: XLSX.WorkBook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Datos'); // 'Datos' será el nombre de la pestaña en Excel.

  // 3. Usar la librería para escribir el archivo y forzar la descarga.
  XLSX.writeFile(wb, filename);
}