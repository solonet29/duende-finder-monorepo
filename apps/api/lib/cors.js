// lib/cors.js

import Cors from 'cors';

const allowedOrigins = [
    'http://127.0.0.1:5500',
    'https://buscador.afland.es',
    'https://nuevobuscador.afland.es',
];

// Inicializamos el middleware de CORS
const cors = Cors({
    methods: ['GET', 'HEAD', 'POST', 'PUT', 'DELETE'], // Permite estos métodos
    origin: (origin, callback) => {
        // Permite solicitudes sin origen (como aplicaciones móviles o solicitudes curl)
        if (!origin) return callback(null, true);

        if (allowedOrigins.includes(origin) || /https:\/\/.*-angel-picon-caleros-projects\.vercel\.app$/.test(origin)) {
            return callback(null, true);
        }

        const msg = 'The CORS policy for this site does not allow access from the specified Origin.';
        return callback(new Error(msg), false);
    },
});

// Helper para ejecutar el middleware
export default function runMiddleware(req, res, fn) {
    return new Promise((resolve, reject) => {
        fn(req, res, (result) => {
            if (result instanceof Error) {
                return reject(result);
            }
            return resolve(result);
        });
    });
}