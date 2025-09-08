
// Constantes para valores por defecto, exportables para consistencia
const DEFAULT_ARTIST = 'Artista no especificado';
const DEFAULT_DATE = 'Fecha no disponible';
const DEFAULT_DESCRIPTION = 'Más información en la web del evento.';

/**
 * Sanea un objeto de evento, aplicando valores por defecto a campos vacíos.
 * @param {object} event - El objeto del evento original.
 * @returns {object} Un nuevo objeto de evento saneado.
 */
function sanitizeEvent(event) {
  const sanitized = { ...event };

  if (!sanitized.artist || sanitized.artist.length === 0) {
    sanitized.artist = DEFAULT_ARTIST;
  }
  if (!sanitized.date || sanitized.date.length === 0) {
    sanitized.date = DEFAULT_DATE;
  }
  if (!sanitized.description || sanitized.description.length === 0) {
    sanitized.description = DEFAULT_DESCRIPTION;
  }
  
  // Podríamos añadir más saneadores aquí en el futuro (sanitizeTitle, sanitizeLocation, etc.)

  return sanitized;
}

module.exports = {
  sanitizeEvent,
  DEFAULT_ARTIST,
  DEFAULT_DATE,
  DEFAULT_DESCRIPTION
};
