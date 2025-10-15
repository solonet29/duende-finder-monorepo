import { useState, useEffect, useCallback } from 'react';
import Head from 'next/head';

// --- Componentes de UI Reutilizables ---
const EventCard = ({ event }) => {
    // Lógica para el slug, igual que en script.js
    const eventName = event.name || 'evento';
    const slug = `${event._id}-${eventName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')}`;
    const eventUrl = `/eventos/${slug}`;

    // Manejo del campo artist: si es un objeto, usa event.artist.name
    const artistDisplayName = typeof event.artist === 'object' && event.artist !== null
        ? event.artist.name
        : event.artist || 'Artista por confirmar';

    return (
        <a href={eventUrl} className="event-card">
            <img src={event.imageUrl || '/assets/flamenco-placeholder.png'} alt={artistDisplayName} className="card-image" onError={(e) => { e.target.onerror = null; e.target.src = '/assets/flamenco-placeholder.png' }} />
            <div className="card-content">
                <h3 className="card-title">{artistDisplayName}</h3>
            </div>
        </a>
    );
};

const EventSlider = ({ events }) => {
    if (!events || events.length === 0) return null;
    return (
        <div className="slider-container">
            {events.map(event => <EventCard key={event._id} event={event} />)}
        </div>
    );
};

// --- Funciones de Ayuda para Geolocalización ---
const getUserLocation = () => {
    return new Promise((resolve, reject) => {
        if (typeof navigator !== 'undefined' && navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(resolve, reject);
        } else {
            reject(new Error('Geolocation not supported'));
        }
    });
};

const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371; // km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 0.5 - Math.cos(dLat) / 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * (1 - Math.cos(dLon)) / 2;
    return R * 2 * Math.asin(Math.sqrt(a));
};


// --- Componente Principal de la Página ---
const HomePage = ({ staticProps }) => {
    const { featuredEvents: initialFeaturedEvents, weekEvents, todayEvents, eventCount } = staticProps;

    // --- Estados de la Aplicación ---
    const [featuredEvents, setFeaturedEvents] = useState(initialFeaturedEvents);
    const [monthlyEvents, setMonthlyEvents] = useState({});

    // --- Efectos para Lógica de Cliente ---

    // Efecto para ordenar el slider principal por proximidad
    useEffect(() => {
        const sortEventsByProximity = async () => {
            try {
                const userLocation = await getUserLocation();
                const { latitude, longitude } = userLocation.coords;

                const sortedEvents = [...initialFeaturedEvents].map(event => {
                    if (event.location?.coordinates?.length === 2) {
                        const [eventLon, eventLat] = event.location.coordinates;
                        return { ...event, distance: calculateDistance(latitude, longitude, eventLat, eventLon) };
                    } else {
                        return { ...event, distance: Infinity };
                    }
                }).sort((a, b) => a.distance - b.distance);

                setFeaturedEvents(sortedEvents);

            } catch (error) {
                console.warn("No se pudo obtener la ubicación para ordenar eventos cercanos.");
            }
        };

        if (initialFeaturedEvents.length > 0) {
            sortEventsByProximity();
        }
    }, [initialFeaturedEvents]); // Se ejecuta si los eventos iniciales cambian

    return (
        <>
            <Head>
                {/* El Head principal ya está en Layout.js, esto es para contenido específico de la página si se necesita */}
            </Head>

            <h1 class="main-title">Duende Finder</h1>
            {/* El contador ahora es parte de la página y no necesita su propio script */}
            <p class="subtitle-counter loaded">+{eventCount.toLocaleString('es-ES')} eventos de flamenco verificados</p>

            {/* Aquí irían los componentes para Planificador de Viaje y Cerca de Mí si se migran */}

            <section id="destacados-section" class="sliders-section">
                <h2>Eventos Destacados</h2>
                <EventSlider events={featuredEvents} />
            </section>
            <section id="semana-section" className="sliders-section">
                <h2>Esta Semana 🔥</h2>
                <EventSlider events={weekEvents} />
            </section>
            <section id="hoy-section" className="sliders-section">
                <h2>Eventos para Hoy 📅</h2>
                <EventSlider events={todayEvents} />
            </section>

        </>
    );
};

// --- Funciones de Ayuda ---
// (calculateDistance ya está definida arriba)

// --- Carga de Datos del Lado del Servidor ---
export async function getStaticProps() {
    const API_BASE_URL = process.env.API_BASE_URL || 'https://api-v2.afland.es';
    try {
        const [featuredData, weekData, todayData, countData] = await Promise.all([
            fetch(`${API_BASE_URL}/api/events?featured_events=true&limit=100`).then(res => res.json()),
            fetch(`${API_BASE_URL}/api/events?timeframe=week&limit=10`).then(res => res.json()),
            fetch(`${API_BASE_URL}/api/events?timeframe=today&limit=10`).then(res => res.json()),
            fetch(`${API_BASE_URL}/api/events/count`).then(res => res.json())
        ]);

        return {
            props: {
                staticProps: {
                    featuredEvents: featuredData?.events || [],
                    weekEvents: weekData?.events || [],
                    todayEvents: todayData?.events || [],
                    eventCount: countData?.total || 0,
                }
            },
            revalidate: 300, // Re-generar la página cada 5 minutos
        };
    } catch (error) {
        console.error("Error fetching data for home page:", error);
        return { props: { staticProps: { featuredEvents: [], weekEvents: [], todayEvents: [], eventCount: 0 } } };
    }
}

export default HomePage;