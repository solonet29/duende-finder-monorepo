// lib/cors.js

import Cors from 'cors';

const allowedOrigins = [
    'http://127.0.0.1:5500',
    'https://buscador.afland.es',
    'https://nuevobuscador.afland.es',
    'https://afland.es',
    'http://localhost:3000',
    'http://0.0.0.0:5500',
    'http://localhost:5173',
];

// Inicializamos el middleware de CORS
export const corsMiddleware = Cors({
    methods: ['GET', 'HEAD', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    origin: (origin, callback) => {
        // Permite solicitudes sin origen (como aplicaciones móviles o solicitudes curl)
        if (!origin) return callback(null, true);

        if (allowedOrigins.includes(origin) || origin.endsWith('.vercel.app')) {
            return callback(null, true);
        }

        const msg = 'The CORS policy for this site does not allow access from the specified Origin.';
        return callback(new Error(msg), false);
    },
});

// Helper para ejecutar el middleware
export function runMiddleware(req, res, fn) {
    return new Promise((resolve, reject) => {
        fn(req, res, (result) => {
            if (result instanceof Error) {
                return reject(result);
            }
            return resolve(result);
        });
    });
}
