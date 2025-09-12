// /pages/api/notifications/vapid-public-key.js

// Este endpoint devuelve la clave pública VAPID necesaria para que el frontend
// se suscriba a las notificaciones push.

export default function handler(req, res) {
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
