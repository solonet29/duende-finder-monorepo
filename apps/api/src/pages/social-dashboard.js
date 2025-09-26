
import React, { useState } from 'react';
import { getEventModel } from '../lib/database';

function SocialDashboardPage({ initialEvents }) {
  const [events, setEvents] = useState(initialEvents);

  const handleMarkAsPublished = async (eventId) => {
    try {
      const response = await fetch(`/api/events/${eventId}/mark-as-published`, {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Failed to mark as published');
      }

      // Update the UI without a full reload
      setEvents(currentEvents =>
        currentEvents.map(event =>
          event._id === eventId
            ? { ...event, social: { ...event.social, publishedAt: new Date().toISOString() } }
            : event
        )
      );
    } catch (error) {
      console.error('Error:', error);
      alert('No se pudo marcar como publicado. Inténtalo de nuevo.');
    }
  };

  const styles = {
    body: { fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif', color: '#333', backgroundColor: '#f4f4f9', margin: 0, padding: '20px', minHeight: '100vh' },
    container: { maxWidth: '900px', margin: '0 auto', backgroundColor: 'white', padding: '20px 40px', borderRadius: '8px', boxShadow: '0 4px 8px rgba(0,0,0,0.1)' },
    header: { borderBottom: '1px solid #eee', paddingBottom: '10px', marginBottom: '20px' },
    h1: { color: '#1a1a1a' },
    eventList: { listStyle: 'none', padding: 0 },
    eventItem: { borderBottom: '1px solid #eee', padding: '15px 10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '15px' },
    eventLink: { textDecoration: 'none', color: '#0070f3', fontWeight: 'bold', fontSize: '1.1rem' },
    eventInfo: { flex: 1 },
    eventDate: { color: '#666', fontSize: '0.9rem', marginTop: '5px' },
    statusLabel: { padding: '5px 10px', borderRadius: '15px', fontSize: '0.8rem', fontWeight: 'bold' },
    statusPublished: { backgroundColor: '#e0f2e9', color: '#28a745' },
    publishButton: { padding: '8px 12px', fontSize: '0.9rem', cursor: 'pointer', border: '1px solid #0070f3', backgroundColor: 'white', color: '#0070f3', borderRadius: '5px' },
    noEvents: { textAlign: 'center', padding: '40px', color: '#666' }
  };

  // Re-sort events on the client-side after state updates
  const sortedEvents = [...events].sort((a, b) => {
    const aPublished = !!a.social?.publishedAt;
    const bPublished = !!b.social?.publishedAt;
    if (aPublished !== bPublished) {
      return aPublished ? 1 : -1;
    }
    return new Date(b.contentGenerationDate) - new Date(a.contentGenerationDate);
  });

  return (
    <div style={styles.body}>
      <div style={styles.container}>
        <header style={styles.header}>
          <h1 style={styles.h1}>Panel de Contenido para Redes Sociales</h1>
        </header>
        
        {sortedEvents.length > 0 ? (
          <ul style={styles.eventList}>
            {sortedEvents.map(event => (
              <li key={event._id} style={styles.eventItem}>
                <div style={styles.eventInfo}>
                  <a href={`/social-helper/${event._id}`} style={styles.eventLink} target="_blank" rel="noopener noreferrer">
                    {event.blogPostTitle || event.name}
                  </a>
                  <div style={styles.eventDate}>
                    Fecha del Evento: {new Date(event.date).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}
                  </div>
                </div>
                <div>
                  {event.social?.publishedAt ? (
                    <span style={{...styles.statusLabel, ...styles.statusPublished}}>Publicado</span>
                  ) : (
                    <button style={styles.publishButton} onClick={() => handleMarkAsPublished(event._id)}>
                      Marcar como Publicado
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <div style={styles.noEvents}>
            <h2>No hay eventos listos para publicar en este momento.</h2>
            <p>El sistema de enriquecimiento se ejecuta periódicamente. Vuelve a comprobarlo más tarde.</p>
          </div>
        )}
      </div>
    </div>
  );
}

export async function getServerSideProps(context) {
  try {
    const Event = await getEventModel();
    const events = await Event.find({
      contentStatus: 'content_ready'
    })
    .sort({ 'social.publishedAt': 1, contentGenerationDate: -1 })
    .limit(200)
    .lean();

    const serializableEvents = JSON.parse(JSON.stringify(events));

    return {
      props: { initialEvents: serializableEvents },
    };
  } catch (error) {
    console.error('Error fetching events for social dashboard:', error);
    return {
      props: { initialEvents: [] },
    };
  }
}

export default SocialDashboardPage;
