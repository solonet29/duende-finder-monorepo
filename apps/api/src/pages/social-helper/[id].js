
import React from 'react';
import Head from 'next/head';
import { getEventModel } from '@/lib/database';
import { ObjectId } from 'mongodb';

function SocialHelperPage({ event }) {
  if (!event) {
    return <div><h1>Evento no encontrado</h1></div>;
  }

  // --- Funciones para compartir ---
  const publicEventUrl = `https://duendefinder.com/eventos/${event._id}-${event.slug}`;

  const shareOnTwitter = () => {
    const text = encodeURIComponent(event.social?.tweet || event.blogPostTitle);
    const url = `https://twitter.com/intent/tweet?text=${text}&url=${encodeURIComponent(publicEventUrl)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const shareOnFacebook = () => {
    const url = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(publicEventUrl)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text).then(() => {
      alert('¡Copiado al portapapeles!');
    }, (err) => {
      alert('Error al copiar');
      console.error('Error al copiar: ', err);
    });
  };

  // --- NUEVO: Generar el post completo para copiar ---
  const fullPostText = 
`${event.social?.instagram || ''}

${event.social?.hashtags?.join(' ') || ''}

👇 Toda la información y entradas en:
${publicEventUrl}`;


  // --- Estilos ---
  const styles = {
    body: { fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif', color: '#333', backgroundColor: '#f4f4f9', margin: 0, padding: '20px' },
    container: { maxWidth: '800px', margin: '0 auto', backgroundColor: 'white', padding: '20px 40px', borderRadius: '8px', boxShadow: '0 4px 8px rgba(0,0,0,0.1)' },
    header: { borderBottom: '1px solid #eee', paddingBottom: '10px', marginBottom: '20px' },
    h1: { color: '#1a1a1a' },
    h2: { color: '#333', borderBottom: '1px solid #eee', paddingBottom: '8px', marginTop: '30px' },
    img: { maxWidth: '100%', borderRadius: '8px', marginTop: '10px' },
    textarea: { width: '100%', minHeight: '120px', padding: '10px', border: '1px solid #ccc', borderRadius: '4px', fontSize: '1rem', marginTop: '10px', whiteSpace: 'pre-wrap' },
    pre: { whiteSpace: 'pre-wrap', wordWrap: 'break-word', backgroundColor: '#f0f0f0', padding: '15px', borderRadius: '4px', border: '1px solid #ccc' },
    button: { display: 'inline-block', padding: '8px 15px', backgroundColor: '#0070f3', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', marginTop: '10px', fontSize: '0.9rem', marginRight: '10px' },
    shareButton: { backgroundColor: '#28a745' },
    fieldContainer: { marginBottom: '25px' }
  };

  return (
    <>
      <Head>
        <title>Asistente Social: {event.blogPostTitle}</title>
        <meta name="robots" content="noindex, nofollow" />
        {/* Open Graph / Facebook */}
        <meta property="og:title" content={event.blogPostTitle} />
        <meta property="og:description" content={event.social?.instagram?.substring(0, 150) + '...'} />
        <meta property="og:image" content={event.imageUrl} />
        <meta property="og:url" content={publicEventUrl} />
        <meta property="og:type" content="article" />
        {/* Twitter */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={event.blogPostTitle} />
        <meta name="twitter:description" content={event.social?.instagram?.substring(0, 150) + '...'} />
        <meta name="twitter:image" content={event.imageUrl} />
      </Head>
      <div style={styles.body}>
        <div style={styles.container}>
          <header style={styles.header}>
            <h1 style={styles.h1}>Asistente de Contenido para Redes Sociales</h1>
          </header>

          {/* --- NUEVO: Sección para copiar post completo --- */}
          <div style={styles.fieldContainer}>
            <h2>Publicación completa para Facebook / Redes</h2>
            <p>Copia y pega este texto directamente en tu publicación. Facebook generará la vista previa del enlace automáticamente.</p>
            <textarea style={{...styles.textarea, minHeight: '200px'}} defaultValue={fullPostText} readOnly />
            <button style={{...styles.button, backgroundColor: '#1877F2'}} onClick={() => copyToClipboard(fullPostText)}>Copiar Publicación Completa</button>
          </div>

          <div style={styles.fieldContainer}>
            <h2>Compartir Directamente en X</h2>
            <button style={{...styles.button, ...styles.shareButton}} onClick={shareOnTwitter}>Compartir en X (Twitter)</button>
          </div>

          <hr />

          <h2>Componentes individuales</h2>

          <div style={styles.fieldContainer}>
            <h4>Título del Evento</h4>
            <pre style={styles.pre}>{event.blogPostTitle || 'No disponible'}</pre>
            <button style={styles.button} onClick={() => copyToClipboard(event.blogPostTitle)}>Copiar Título</button>
          </div>

          <div style={styles.fieldContainer}>
            <h4>Imagen del Evento</h4>
            {event.imageUrl ? <img src={event.imageUrl} alt="Imagen del evento" style={styles.img} /> : <p>No hay imagen disponible.</p>}
          </div>

          <div style={styles.fieldContainer}>
            <h4>Texto para Instagram / Facebook</h4>
            <textarea style={styles.textarea} defaultValue={event.social?.instagram || 'No disponible'} readOnly />
            <button style={styles.button} onClick={() => copyToClipboard(event.social?.instagram)}>Copiar Texto</button>
          </div>

          <div style={styles.fieldContainer}>
            <h4>Texto para X (Twitter)</h4>
            <textarea style={styles.textarea} defaultValue={event.social?.tweet || 'No disponible'} readOnly />
            <button style={styles.button} onClick={() => copyToClipboard(event.social?.tweet)}>Copiar Tweet</button>
          </div>

          <div style={styles.fieldContainer}>
            <h4>Hashtags</h4>
            <textarea style={styles.textarea} defaultValue={event.social?.hashtags?.join(' ') || 'No disponible'} readOnly />
            <button style={styles.button} onClick={() => copyToClipboard(event.social?.hashtags?.join(' '))}>Copiar Hashtags</button>
          </div>
        </div>
      </div>
    </>
  );
}

export async function getServerSideProps(context) {
  const { id } = context.params;

  if (!ObjectId.isValid(id)) {
    return { notFound: true };
  }

  try {
    const Event = await getEventModel();
    const event = await Event.findById(id).lean();

    if (!event) {
      return { notFound: true };
    }
    
    const serializableEvent = JSON.parse(JSON.stringify(event));

    return {
      props: { event: serializableEvent },
    };
  } catch (error) {
    console.error('Error fetching event for social helper:', error);
    return { notFound: true };
  }
}

export default SocialHelperPage;
