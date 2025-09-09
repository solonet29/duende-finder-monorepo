// RUTA: /src/pages/api/process-url.js
// VERSIÓN DE PRUEBA "HOLA MUNDO"

export default function handler(req, res) {
    // Si vemos este log, significa que la función SÍ se está ejecutando.
    console.log("--- ¡HOLA MUNDO DESDE PROCESS-URL! La función se está ejecutando. ---");

    // Respondemos siempre con éxito para esta prueba.
    res.status(200).json({ message: "Hola Mundo recibido con éxito." });
}