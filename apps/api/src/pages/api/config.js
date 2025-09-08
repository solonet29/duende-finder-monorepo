import { connectToMainDb } from '@/lib/database.js';
import cors from 'cors';

function runMiddleware(req, res, fn) {
    return new Promise((resolve, reject) => {
        fn(req, res, (result) => {
            if (result instanceof Error) {
                return reject(result);
            }
            return resolve(result);
        });
    });
}

const corsMiddleware = cors({
    origin: [
        'https://buscador.afland.es',
        'https://duende-frontend.vercel.app',
        'https://afland.es',
        'http://localhost:3000',
        'http://127.0.0.1:5500',
        'http://0.0.0.0:5500',
        'http://localhost:5173',
        'https://duende-frontend-git-new-fro-50ee05-angel-picon-caleros-projects.vercel.app',
        'https://duende-control-panel.vercel.app',
        'https://duende-frontend-zklp-byru9i3nw-angel-picon-caleros-projects.vercel.app',
        'https://nuevobuscador.afland.es'
    ],
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
});

export default async function handler(req, res) {
    await runMiddleware(req, res, corsMiddleware);

    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Método no permitido' });
    }

    try {
        const db = await connectToMainDb();

        const config = await db.collection('config').findOne({ _id: 'main_config' });

        if (!config) {
            return res.status(200).json({ welcomeModal_enabled: false });
        }

        res.status(200).json(config);

    } catch (error) {
        console.error("Error al obtener la configuración:", error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
}