import Layout from '../components/Layout';

// Este componente especial _app.js es el punto de entrada principal de la aplicación Next.js.
// Al envolver la 'Component' con nuestro 'Layout', nos aseguramos de que todas las páginas
// tengan la misma cabecera, pie de página, estilos y scripts.

function MyApp({ Component, pageProps }) {
  return (
    <Layout>
      <Component {...pageProps} />
    </Layout>
  );
}

export default MyApp;