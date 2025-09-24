// models/eventSchema.js
const mongoose = require('mongoose');

const eventSchema = new mongoose.Schema({
    name: {
        type: String,
        trim: true,
        default: 'Evento de Flamenco',
    },
    artist: {
        type: String,
        required: true,
        trim: true,
        index: true, // Indexamos para búsquedas rápidas por artista
    },
    description: {
        type: String,
        trim: true,
    },
    date: {
        type: Date,
        required: true,
        index: true, // Indexamos para búsquedas rápidas por fecha
    },
    time: {
        type: String,
    },
    venue: {
        type: String,
        trim: true,
    },
    city: {
        type: String,
        trim: true,
    },
    country: {
        type: String,
        trim: true,
    },
    location: {
        type: {
            type: String,
            enum: ['Point'],
        },
        coordinates: {
            type: [Number], // [longitud, latitud]
        },
    },
    imageUrl: {
        type: String,
    },
    sourceUrl: {
        type: String,
        required: true,
    },
    blogPostUrl: {
        type: String,
    },
    featured: {
        type: Boolean,
        default: false,
    },
    // --- Campos para el pipeline de contenido ---
    contentStatus: {
        type: String,
        enum: ['pending_enrichment', 'enrichment_failed', 'content_ready', 'publishing', 'published', 'publishing_failed', 'archived', 'pending'],
        default: 'pending_enrichment',
        index: true
    },
    night_plan: { // El plan detallado del evento generado por IA
        type: String,
    },
    blogPostTitle: { // Título generado para el post de WordPress
        type: String,
    },
    blogPostHtml: { // Contenido HTML generado para el post de WordPress
        type: String,
    },
    imageId: { // ID de la imagen destacada en WordPress
        type: Number,
    },
    wordpressPostId: { // ID del post creado en WordPress
        type: Number,
        index: true
    },
    publicationDate: { // Fecha en la que se programó la publicación
        type: Date,
    }
}, {
    timestamps: true, // Añade automáticamente createdAt y updatedAt
});

// Creamos un índice geoespacial para las búsquedas "Cerca de Mí"
eventSchema.index({ location: '2dsphere' });

module.exports = eventSchema;