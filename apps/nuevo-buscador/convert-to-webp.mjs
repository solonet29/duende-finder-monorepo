import sharp from 'sharp';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const inputPath = path.resolve(__dirname, 'public/assets/img_header.png');
const outputPath = path.resolve(__dirname, 'public/assets/img_header.webp');

try {
  await sharp(inputPath)
    .webp({ quality: 80 })
    .toFile(outputPath);
  console.log('Image converted to WebP successfully.');
} catch (error) {
  console.error('Error converting image to WebP:', error);
}
