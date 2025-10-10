// Importamos los módulos 'fs' (File System) y 'path' para manejar rutas de archivos de forma segura.
const fs = require('fs');
const path = require('path');

// --- CONFIGURACIÓN ---
const DOMINIO_BUSCADOR = 'https://nuevobuscador.afland.es';
const FECHA_HOY = new Date().toISOString().split('T')[0]; // Formato YYYY-MM-DD

// La ruta a la raíz del monorepo, para construir la ruta de guardado correctamente.
const MONOREPO_ROOT = path.resolve(__dirname, '..', '..', '..');


// --- OBTENCIÓN DE DATOS ---

// Función que simula la obtención de páginas del buscador
async function obtenerPaginasBuscador() {
  console.log('Obteniendo páginas del buscador...');
  // Aquí iría tu lógica real para obtener las URLs importantes de la app del buscador
  return [
    { path: '/buscar?categoria=conciertos' },
    { path: '/buscar?categoria=teatro' },
    { path: '/explorar/musica' },
  ];
}


// --- LÓGICA DE GENERACIÓN DE SITEMAP ---

/**
 * Genera el sitemap para el subdominio del buscador
 */
async function generarSitemapBuscador() {
  const paginas = await obtenerPaginasBuscador();

  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${DOMINIO_BUSCADOR}/</loc>
    <lastmod>${FECHA_HOY}</lastmod>
    <priority>1.0</priority>
  </url>`;

  paginas.forEach(pagina => {
    xml += `  <url>
    <loc>${DOMINIO_BUSCADOR}${pagina.path}</loc>
    <lastmod>${FECHA_HOY}</lastmod>
    <priority>0.8</priority>
  </url>\n`;
  });

  xml += `</urlset>`;

  // Se asegura de que la ruta 'apps/nuevo-buscador/dist' sea correcta.
  const outputDir = path.join(MONOREPO_ROOT, 'apps', 'nuevo-buscador', 'dist');
  const outputPath = path.join(outputDir, 'sitemap.xml');

  // Asegurarse de que el directorio de salida exista
  fs.mkdirSync(outputDir, { recursive: true });

  fs.writeFileSync(outputPath, xml);
  console.log(`✅ Sitemap para el buscador generado con éxito en: ${outputPath}`);
}

// --- FUNCIÓN PRINCIPAL ---
async function main() {
  console.log('Iniciando la generación de sitemap para el buscador...');
  await generarSitemapBuscador();
  console.log('🎉 Proceso completado.');
}

// Ejecutamos la función principal
main();