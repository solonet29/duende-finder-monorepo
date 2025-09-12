// /pages/api/location/city.js

// Este endpoint convierte coordenadas (lat, lon) en un nombre de ciudad
// utilizando la API de Geocodificación de Google Maps de forma segura en el servidor.

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        res.setHeader('Allow', ['GET']);
        return res.status(405).end(`Method ${req.method} Not Allowed`);
    }

    const { lat, lon } = req.query;

    if (!lat || !lon) {
        return res.status(400).json({ error: 'Los parámetros lat y lon son obligatorios.' });
    }

    const apiKey = process.env.GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
        console.error('GOOGLE_MAPS_API_KEY no está definida.');
        return res.status(500).json({ error: 'Configuración de geolocalización incompleta en el servidor.' });
    }

    const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lon}&key=${apiKey}&language=es&result_type=locality`;

    try {
        const geoResponse = await fetch(url);
        const geoData = await geoResponse.json();

        if (geoData.status !== 'OK' || !geoData.results || geoData.results.length === 0) {
            console.warn('La respuesta de la API de Geocodificación no fue exitosa:', geoData.status);
            return res.status(404).json({ error: 'No se pudo determinar la ciudad para las coordenadas proporcionadas.' });
        }

        // Extraer el nombre de la ciudad del primer resultado
        const addressComponents = geoData.results[0].address_components;
        const cityComponent = addressComponents.find(c => c.types.includes('locality'));

        const cityName = cityComponent ? cityComponent.long_name : null;

        if (!cityName) {
            return res.status(404).json({ error: 'No se encontró el nombre de la ciudad en la respuesta de la API.' });
        }

        res.status(200).json({ city: cityName });

    } catch (error) {
        console.error('Error al contactar con la API de Google Maps:', error);
        res.status(500).json({ error: 'Error interno del servidor al procesar la geolocalización.' });
    }
}
