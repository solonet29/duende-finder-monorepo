import sharp from 'sharp';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const assetsDir = path.resolve(__dirname, 'public/assets');

async function convertImages() {
  try {
    console.log(`Buscando imágenes .png en: ${assetsDir}`);
    const files = await fs.readdir(assetsDir);
    const pngFiles = files.filter(file => file.toLowerCase().endsWith('.png'));

    if (pngFiles.length === 0) {
      console.log('No se encontraron imágenes .png para convertir.');
      return;
    }

    console.log(`Se encontraron ${pngFiles.length} imágenes .png. Convirtiendo a .webp...`);

    for (const file of pngFiles) {
      const inputPath = path.join(assetsDir, file);
      const outputFileName = `${path.parse(file).name}.webp`;
      const outputPath = path.join(assetsDir, outputFileName);

      try {
        await sharp(inputPath)
          .webp({ quality: 80 })
          .toFile(outputPath);
        console.log(`- Convertido: ${file} -> ${outputFileName}`);
      } catch (error) {
        console.error(`Error convirtiendo ${file}:`, error);
      }
    }

    console.log('\nConversión completada.');

  } catch (error) {
    console.error('Ocurrió un error en el proceso:', error);
  }
}

convertImages();