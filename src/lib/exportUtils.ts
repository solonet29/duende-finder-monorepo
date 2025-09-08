// src/lib/exportUtils.ts - VERSIÓN CORREGIDA

import { unparse } from "papaparse";
import * as XLSX from 'xlsx';

/**
 * Convierte un array de objetos a un string CSV y lo descarga en el navegador.
 * @param data El array de datos a exportar.
 * @param filename El nombre del archivo que se descargará.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
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
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function exportToXlsx(data: Record<string, any>[], filename: string) {
  const ws: XLSX.WorkSheet = XLSX.utils.json_to_sheet(data);
  const wb: XLSX.WorkBook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Datos');
  XLSX.writeFile(wb, filename);
}