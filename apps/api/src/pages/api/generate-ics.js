

// RUTA: /src/pages/api/generate-ics.js

import { connectToMainDb } from '@/lib/database.js';
import { ObjectId } from 'mongodb';
import { runMiddleware, corsMiddleware } from '@/lib/cors.js';

// Función para formatear fecha y hora a formato UTC para iCalendar (YYYYMMDDTHHMMSSZ)
function toICSDate(date, time, timezone = 'Europe/Madrid') {
    const timePart = time || '00:00';
    const [hours, minutes] = timePart.split(':').map(Number);
    
    // Crear un objeto de fecha interpretado en la zona horaria del evento
    const localDate = new Date(date);
    localDate.setHours(hours, minutes, 0, 0);

    // Convertir esta fecha a una cadena ISO en UTC
    // Para ello, necesitamos "engañar" al constructor de Date para que trate los componentes como UTC
    // y luego formatear.
    const utcDate = new Date(Date.UTC(
        localDate.getFullYear(),
        localDate.getMonth(),
        localDate.getDate(),
        localDate.getHours(),
        localDate.getMinutes()
    ));

    // Ajustar por el offset de la zona horaria de Madrid (o la que sea)
    // OJO: Esto es una simplificación. Madrid es UTC+1 o UTC+2.
    // Una librería como `date-fns-tz` sería ideal aquí, pero para no añadir dependencias,
    // asumimos un offset promedio. Para España, UTC+2 (verano) es lo más común.
    // Esta es la parte más frágil.
    const offsetHours = 2; // Asumimos UTC+2 para el horario de verano de España
    utcDate.setUTCHours(utcDate.getUTCHours() - offsetHours);

    const pad = (num) => num.toString().padStart(2, '0');
    
    return `${utcDate.getUTCFullYear()}${pad(utcDate.getUTCMonth() + 1)}${pad(utcDate.getUTCDate())}T${pad(utcDate.getUTCHours())}${pad(utcDate.getUTCMinutes())}00Z`;
}


export default async function handler(req, res) {
    await runMiddleware(req, res, corsMiddleware);

    try {
        const { eventId } = req.query;
        if (!eventId || !ObjectId.isValid(eventId)) {
            return res.status(400).json({ error: 'El ID del evento no es válido.' });
        }

        const db = await connectToMainDb();
        const event = await db.collection('events').findOne({ _id: new ObjectId(eventId) });

        if (!event) {
            return res.status(404).json({ error: 'Evento no encontrado.' });
        }

        // --- Construcción del fichero .ics ---
        const eventName = event.name || 'Evento de Flamenco';
        const eventDate = event.date; // Formato YYYY-MM-DD
        const eventTime = event.time || '21:00'; // Asumir una hora si no existe
        const description = event.description || `Detalles para ${eventName}.`;
        const location = [event.venue, event.city, event.country].filter(Boolean).join(', ');
        
        if (!eventDate) {
            return res.status(400).json({ error: 'El evento no tiene una fecha definida.' });
        }

        const startDate = toICSDate(eventDate, eventTime);
        
        // Asumir duración de 2 horas si no hay hora de fin
        const endDateObj = new Date(startDate.replace(/(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z/, '$1-$2-$3T$4:$5:$6Z'));
        endDateObj.setHours(endDateObj.getHours() + 2);
        const endDate = toICSDate(endDateObj.toISOString().split('T')[0], endDateObj.toTimeString().split(' ')[0]);


        const icsContent = [
            'BEGIN:VCALENDAR',
            'VERSION:2.0',
            'PRODID:-//DuendeFinder//Evento Flamenco//ES',
            'BEGIN:VEVENT',
            `UID:${eventId}@duendefinder.com`,
            `DTSTAMP:${toICSDate(new Date().toISOString().split('T')[0], new Date().toTimeString().split(' ')[0])}`,
            `DTSTART:${startDate}`,
            `DTEND:${endDate}`,
            `SUMMARY:${eventName}`,
            `DESCRIPTION:${description.replace(/\n/g, '\\n')}`,
            `LOCATION:${location}`,
            'END:VEVENT',
            'END:VCALENDAR'
        ].join('\r\n');

        res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="${event.slug || 'evento'}.ics"`);
        res.status(200).send(icsContent);

    } catch (error) {
        console.error("Error generando el fichero .ics:", error);
        res.status(500).json({ error: 'Error al generar el fichero .ics.' });
    }
}
