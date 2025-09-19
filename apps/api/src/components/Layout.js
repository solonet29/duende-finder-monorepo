
import Head from 'next/head';
import Script from 'next/script';

const Layout = ({ children }) => {
  return (
    <>
      <Head>
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Buscador de Conciertos Flamencos - Duende Finder</title>
        <meta name="description" content="Descubre la magia del flamenco. Busca conciertos, tablaos y festivales por todo el Mundo." />
        <meta property="og:image" content="https://www.afland.es/wp-content/uploads/2024/04/DUENDE-FINDER-LOGO-1200-X-630-PX.png" />

        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="true" />
        <link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@700&family=Inter:wght@400;700;900&family=Montserrat:wght@700&display=swap" rel="stylesheet" />

        <link rel="icon" type="image/png" href="/assets/favicon.png" />
        <link rel="manifest" href="/assets/manifest.json" />
        <meta name="theme-color" content="#121212" />

        {/* Los CSS se cargarán desde la carpeta /public de la app 'api' */}
        <link rel="stylesheet" href="/styles.css" />
        <link rel="stylesheet" href="/chatbot.css" />
      </Head>

      {/* Estructura principal de la página copiada de index.html */}
      <header className="header-main">
        <div className="container">
            <nav className="filter-bar">
                <a href="#destacados-section" className="filter-chip active">Destacados</a>
                <a href="#semana-section" className="filter-chip">Esta Semana</a>
                <a href="#hoy-section" className="filter-chip">Hoy</a>
                <a href="#cerca-section" className="filter-chip" data-filter="cerca">Cerca de Mí</a>
            </nav>
        </div>
      </header>

      <main className="container">
        {children} { /* Aquí se renderizará el contenido de cada página */}
      </main>

      <nav id="bottom-nav">
        <button className="nav-btn active" id="nav-home-btn" title="Inicio"><ion-icon name="home"></ion-icon></button>
        <button className="nav-btn" id="nav-how-it-works-btn" title="Cómo Funciona"><ion-icon name="help-circle-outline"></ion-icon></button>
        <button className="nav-btn" id="nav-terms-btn" title="Términos"><ion-icon name="document-text-outline"></ion-icon></button>
        <button className="nav-btn" id="nav-notifications-btn" title="Notificaciones"><ion-icon name="notifications-outline"></ion-icon></button>
        <button className="nav-btn" id="nav-theme-toggle" title="Tema"><ion-icon name="moon-outline"></ion-icon></button>
        <a href="https://afland.es" target="_blank" rel="noopener noreferrer" className="nav-btn" title="Visitar Afland.es"><ion-icon name="flame-outline"></ion-icon></a>
      </nav>

      {/* Scripts externos y de la aplicación */}
      <Script type="module" src="https://unpkg.com/ionicons@7.1.0/dist/ionicons/ionicons.esm.js" strategy="lazyOnload" />
      <Script noModule src="https://unpkg.com/ionicons@7.1.0/dist/ionicons/ionicons.js" strategy="lazyOnload" />
      <Script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js" strategy="lazyOnload" />
      
      {/* Los scripts de la app se cargarán desde /public */}
      {/* Nota: La lógica de script.js deberá ser migrada a componentes de React más adelante */}
      <Script src="/script.js" strategy="lazyOnload" /> 
      <Script src="/chatbot.js" strategy="lazyOnload" />
    </>
  );
};

export default Layout;
