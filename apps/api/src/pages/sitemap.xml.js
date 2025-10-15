import { connectToMainDb } from '@/lib/database.js';

const BASE_URL = 'https://nuevobuscador.afland.es'; // El dominio de tu buscador

/**
 * Genera el contenido XML del sitemap a partir de una lista de URLs.
 * @param {Array<Object>} urls - Array de objetos URL con loc, lastmod, y priority.
 * @returns {string} - El sitemap en formato XML.
 */
const generateSitemapXml = (urls) => {
    let xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`;

    urls.forEach(url => {
        xml += `
  <url>
    <loc>${url.loc}</loc>
    <lastmod>${url.lastmod}</lastmod>
    <priority>${url.priority}</priority>
  </url>`;
    });

    xml += `
</urlset>`;
    return xml;
};

/**
 * Componente de página vacío. No renderizará nada en el lado del cliente.
 * La magia ocurre en getServerSideProps.
 */
const Sitemap = () => { };

export async function getServerSideProps({ res }) {
    try {
        const db = await connectToMainDb();
        const eventsCollection = db.collection('events');
        const today = new Date().toISOString().split('T')[0];

        const urls = [];

        // 1. Página principal
        urls.push({ loc: `${BASE_URL}/`, lastmod: today, priority: '1.0' });

        // 2. Páginas de eventos individuales (futuros)
        const events = await eventsCollection.find(
            { date: { $gte: today } },
            { projection: { _id: 1, slug: 1, name: 1, updatedAt: 1 } }
        ).toArray();

        events.forEach(event => {
            const fallbackSlug = (event.name || 'evento').toLowerCase().replace(/[^a-z0-9]+/g, '-');
            const slug = event.slug || fallbackSlug;
            const lastmod = event.updatedAt ? new Date(event.updatedAt).toISOString().split('T')[0] : today;
            urls.push({
                loc: `${BASE_URL}/eventos/${event._id}-${slug}`,
                lastmod: lastmod,
                priority: '0.9'
            });
        });

        // 3. Páginas de búsqueda por artista (con eventos futuros)
        const artists = await eventsCollection.distinct('artist', { date: { $gte: today }, artist: { $ne: null } });
        artists.forEach(artist => {
            urls.push({
                loc: `${BASE_URL}/?artist=${encodeURIComponent(artist)}`,
                lastmod: today,
                priority: '0.7'
            });
        });

        // 4. Páginas de búsqueda por ciudad (con eventos futuros)
        const cities = await eventsCollection.distinct('city', { date: { $gte: today }, city: { $ne: null } });
        cities.forEach(city => {
            urls.push({
                loc: `${BASE_URL}/?city=${encodeURIComponent(city)}`,
                lastmod: today,
                priority: '0.7'
            });
        });

        const sitemap = generateSitemapXml(urls);

        res.setHeader('Content-Type', 'application/xml');
        // Cachear el sitemap por 24 horas para no sobrecargar la base de datos
        res.setHeader('Cache-Control', 'public, s-maxage=86400, stale-while-revalidate');
        res.status(200).send(sitemap);
    } catch (error) {
        console.error("Error al generar el sitemap.xml:", error);
        res.status(500).send('Error al generar el sitemap.');
    }

    // Devolvemos un objeto props vacío porque la respuesta ya se ha enviado.
    return {
        props: {},
    };
}

export default Sitemap;