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
            <img src={event.imageUrl || '/assets/flamenco-placeholder.png'} alt={artistDisplayName} className="card-image" onError={(e) => { e.target.onerror = null; e.target.src='/assets/flamenco-placeholder.png'}} />
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
    const a = 0.5 - Math.cos(dLat)/2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * (1 - Math.cos(dLon))/2;
    return R * 2 * Math.asin(Math.sqrt(a));
};


// --- Componente Principal de la Página ---
const HomePage = ({ staticProps }) => {
    const { circuitoEvents: initialCircuitoEvents, weekEvents, todayEvents, allEvents, eventCount } = staticProps;

    // --- Estados de la Aplicación ---
    const [circuitoEvents, setCircuitoEvents] = useState(initialCircuitoEvents);
    const [monthlyEvents, setMonthlyEvents] = useState({});

    // --- Efectos para Lógica de Cliente ---

    // Efecto para ordenar el slider principal por proximidad
    useEffect(() => {
        const sortEventsByProximity = async () => {
            try {
                const userLocation = await getUserLocation();
                const { latitude, longitude } = userLocation.coords;

                const sortedEvents = [...initialCircuitoEvents].map(event => {
                    if (event.location?.coordinates?.length === 2) {
                        const [eventLon, eventLat] = event.location.coordinates;
                        return { ...event, distance: calculateDistance(latitude, longitude, eventLat, eventLon) };
                    } else {
                        return { ...event, distance: Infinity };
                    }
                }).sort((a, b) => a.distance - b.distance);

                setCircuitoEvents(sortedEvents);

            } catch (error) {
                console.warn("No se pudo obtener la ubicación para ordenar eventos cercanos.");
            }
        };

        if (initialCircuitoEvents.length > 0) {
            sortEventsByProximity();
        }
    }, [initialCircuitoEvents]); // Se ejecuta si los eventos iniciales cambian

    // Efecto para agrupar eventos por mes
    useEffect(() => {
        if (allEvents.length > 0) {
            const grouped = allEvents.reduce((acc, event) => {
                if (!event.date) return acc;
                const monthKey = event.date.substring(0, 7);
                if (!acc[monthKey]) acc[monthKey] = [];
                acc[monthKey].push(event);
                return acc;
            }, {});
            setMonthlyEvents(grouped);
        }
    }, [allEvents]);

    return (
        <>
            <Head>
                {/* El Head principal ya está en Layout.js, esto es para contenido específico de la página si se necesita */}
            </Head>

            <h1 className="main-title">Duende Finder</h1>
            {/* El contador ahora es parte de la página y no necesita su propio script */}
            <p className="subtitle-counter loaded">+{eventCount.toLocaleString('es-ES')} eventos de flamenco verificados</p>

            {/* Aquí irían los componentes para Planificador de Viaje y Cerca de Mí si se migran */}

            <section id="destacados-section" className="sliders-section">
                <h2>Circuito Andaluz de Peñas 2025</h2>
                <EventSlider events={circuitoEvents} />
            </section>
            <section id="semana-section" className="sliders-section">
                <h2>Esta Semana 🔥</h2>
                <EventSlider events={weekEvents} />
            </section>
            <section id="hoy-section" className="sliders-section">
                <h2>Eventos para Hoy 📅</h2>
                <EventSlider events={todayEvents} />
            </section>

            <div id="monthly-sliders-container">
                {Object.keys(monthlyEvents).sort().map(monthKey => {
                    const monthName = new Date(monthKey + '-02').toLocaleString('es-ES', { month: 'long' });
                    const year = monthKey.split('-')[0];
                    return (
                        <section key={monthKey} className="sliders-section">
                            <h2>{`${monthName.charAt(0).toUpperCase() + monthName.slice(1)} ${year}`}</h2>
                            <EventSlider events={monthlyEvents[monthKey]} />
                        </section>
                    );
                })}
            </div>
        </>
    );
};

// --- Funciones de Ayuda ---
// (calculateDistance ya está definida arriba)

// --- Carga de Datos del Lado del Servidor ---
export async function getStaticProps() {
    const API_BASE_URL = process.env.API_BASE_URL || 'https://api-v2.afland.es';
    try {
        const [circuitoData, weekData, todayData, allEventsData, countData] = await Promise.all([
            fetch(`${API_BASE_URL}/api/events?q=Circuito Andaluz de Peñas 2025&limit=100`).then(res => res.json()),
            fetch(`${API_BASE_URL}/api/events?timeframe=week&limit=10`).then(res => res.json()),
            fetch(`${API_BASE_URL}/api/events?timeframe=today&limit=10`).then(res => res.json()),
            fetch(`${API_BASE_URL}/api/events?sort=date`).then(res => res.json()),
            fetch(`${API_BASE_URL}/api/events/count`).then(res => res.json())
        ]);

        return {
            props: {
                staticProps: {
                    circuitoEvents: circuitoData?.events || [],
                    weekEvents: weekData?.events || [],
                    todayEvents: todayData?.events || [],
                    allEvents: allEventsData?.events || [],
                    eventCount: countData?.total || 0,
                }
            },
            revalidate: 300, // Re-generar la página cada 5 minutos
        };
    } catch (error) {
        console.error("Error fetching data for home page:", error);
        return { props: { staticProps: { circuitoEvents: [], weekEvents: [], todayEvents: [], allEvents: [], eventCount: 0 } } };
    }
}

export default HomePage;