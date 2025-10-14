// /pages/api/notifications/vapid-public-key.js

// 1. Importamos las herramientas de CORS desde nuestra librería compartida.
// Asegúrate de que la ruta relativa ('../../../lib/cors') sea correcta desde tu archivo.
import { runMiddleware, corsMiddleware } from '@/api/lib/cors';

// 2. Convertimos la función a 'async' para poder usar 'await' con el middleware.
export default async function handler(req, res) {

    // 3. ¡Este es el cambio clave!
    // Ejecutamos el middleware de CORS antes que cualquier otra lógica.
    // Si el origen (ej: buscador.afland.es) no está en nuestra lista permitida,
    // el código se detendrá aquí y devolverá un error.
    try {
        await runMiddleware(req, res, corsMiddleware);
    } catch (error) {
        return res.status(403).json({ error: 'Acceso no permitido por CORS' });
    }

    // --- A partir de aquí, tu código original sigue funcionando igual ---

    if (req.method !== 'GET') {
        res.setHeader('Allow', ['GET']);
        return res.status(405).end(`Method ${req.method} Not Allowed`);
    }

    const publicKey = process.env.VAPID_PUBLIC_KEY;

    if (!publicKey) {
        console.error('VAPID_PUBLIC_KEY no está definida en las variables de entorno.');
        return res.status(500).json({ error: 'Configuración de notificaciones incompleta en el servidor.' });
    }

    res.status(200).json({ publicKey });
}