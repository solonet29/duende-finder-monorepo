import Head from 'next/head';

// Esta es la plantilla para cada página de evento individual.
const EventoPage = ({ event }) => {

    // Si el evento no se encuentra, Next.js mostrará una página 404.
    if (!event) {
        return <div>Evento no encontrado.</div>;
    }

    // --- Preparación de datos para mostrar y para SEO ---
    const pageTitle = `${event.name} - ${event.artist} en ${event.city} | Duende Finder`;
    const pageDescription = event.description.substring(0, 160) + '...';
    const eventDate = new Date(event.date).toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' });
    const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${event.name}, ${event.venue}, ${event.city}`)}`;

    // --- Datos Estructurados para Google (JSON-LD) --- 
    const structuredData = {
        '@context': 'https://schema.org',
        '@type': 'Event',
        name: event.name,
        startDate: event.date,
        description: event.description,
        image: event.imageUrl,
        eventStatus: 'https://schema.org/EventScheduled',
        location: {
            '@type': 'Place',
            name: event.venue,
            address: {
                '@type': 'PostalAddress',
                addressLocality: event.city,
                addressCountry: event.country
            }
        },
        performer: {
            '@type': 'Person',
            name: event.artist
        },
        offers: {
            '@type': 'Offer',
            url: event.url, // Asumiendo que hay una URL para comprar tickets
            price: '0', // Asumiendo que es gratis o precio desconocido
            priceCurrency: 'EUR',
            availability: 'https://schema.org/InStock'
        }
    };

    return (
        <>
            <Head>
                <title>{pageTitle}</title>
                <meta name="description" content={pageDescription} />

                {/* Assets para que la página se vea bien */}
                <meta charSet="UTF-8" />
                <meta name="viewport" content="width=device-width, initial-scale=1.0" />
                <link rel="preconnect" href="https://fonts.googleapis.com" />
                <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="true" />
                <link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@700&family=Inter:wght@400;700;900&family=Montserrat:wght@700&display=swap" rel="stylesheet" />
                <script type="module" src="https://unpkg.com/ionicons@7.1.0/dist/ionicons/ionicons.esm.js"></script>
                <script nomodule="" src="https://unpkg.com/ionicons@7.1.0/dist/ionicons/ionicons.js"></script>
                <link rel="icon" type="image/png" href="https://nuevobuscador.afland.es/assets/favicon.png" />
                <link rel="stylesheet" href="https://nuevobuscador.afland.es/styles.css" />
                <link rel="stylesheet" href="https://nuevobuscador.afland.es/chatbot.css" />

                {/* Open Graph / Facebook */}
                <meta property="og:title" content={pageTitle} />
                <meta property="og:description" content={pageDescription} />
                <meta property="og:image" content={event.imageUrl || 'https://www.afland.es/wp-content/uploads/2024/04/DUENDE-FINDER-LOGO-1200-X-630-PX.png'} />
                {/* Twitter */}
                <meta property="twitter:card" content="summary_large_image" />
                <meta property="twitter:title" content={pageTitle} />
                <meta property="twitter:description" content={pageDescription} />
                <meta property="twitter:image" content={event.imageUrl || 'https://www.afland.es/wp-content/uploads/2024/04/DUENDE-FINDER-LOGO-1200-X-630-PX.png'} />

                {/* Datos Estructurados JSON-LD */}
                <script 
                    type="application/ld+json"
                    dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
                />
            </Head>

            {/* Contenido de la página del evento (reutilizando clases de la modal para consistencia) */}
            <div className="modal-event-details">
                {event.imageUrl && (
                    <div className="evento-card-img-container">
                        <img src={event.imageUrl} alt={`Imagen de ${event.name}`} className="evento-card-img" />
                    </div>
                )}
                <div className="card-header">
                    <h1 className="titulo-truncado" title={event.name}>{event.name}</h1>
                </div>
                <div className="artista">
                    <ion-icon name="person-outline"></ion-icon> <span>{event.artist}</span>
                </div>
                <p className="descripcion-corta">{event.description}</p>
                <div className="card-detalles">
                    <div className="evento-detalle">
                        <ion-icon name="calendar-outline"></ion-icon><span>{eventDate}</span>
                    </div>
                    <div className="evento-detalle">
                        <ion-icon name="time-outline"></ion-icon><span>{event.time || 'No disponible'}</span>
                    </div>
                    <div className="evento-detalle">
                        <a href={mapsUrl} target="_blank" rel="noopener noreferrer">
                            <ion-icon name="location-outline"></ion-icon><span>{`${event.venue}, ${event.city}`}</span>
                        </a>
                    </div>
                </div>
                {/* Aquí podrías añadir más acciones o información */}
            </div>
        </>
    );
};

// Esta función se ejecuta en el servidor en cada petición
export async function getServerSideProps(context) {
    const { slug } = context.params;
    const eventId = slug.split('-')[0]; // Extrae el ID del slug

    try {
        const res = await fetch(`https://api-v2.afland.es/api/events/${eventId}`);
        if (!res.ok) {
            return { notFound: true }; // Devuelve 404 si el evento no se encuentra
        }
        const event = await res.json();

        // Pasa los datos del evento a la página vía props
        return { props: { event } };
    } catch (error) {
        console.error("Failed to fetch event:", error);
        return { notFound: true }; // Error en el servidor, devuelve 404
    }
}

export default EventoPage;