import { defineConfig } from 'vite';

export default defineConfig({
  optimizeDeps: {
    // 🛑 SOLUCIÓN: Excluir la librería que causa el error de parsing.
    // Esto evita que Vite intente pre-agrupar (pre-bundle) y analizar los archivos minificados de Ionicons.
    exclude: [
      'ionicons',     // Si solo usas la librería de iconos directamente
    ],
  },
  build: {
    rollupOptions: {
      output: {
        entryFileNames: `assets/[name].js`,
        chunkFileNames: `assets/[name].js`,
        assetFileNames: `assets/[name].[ext]`
      }
    },
    // Es recomendable añadir esto también, aunque 'exclude' suele ser suficiente
    commonjsOptions: {
      ignore: ['ionicons'],
    }
  }
});