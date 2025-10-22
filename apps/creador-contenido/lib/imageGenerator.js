// lib/imageGenerator.js (Refactorizado)

const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

/**
 * Crea la imagen para un post del blog seleccionando una plantilla al azar.
 * @param {object} event - El objeto del evento.
 * @returns {Promise<string>} La ruta a la imagen generada.
 */
async function createPostImage(event, options = {}) {
    try {
        const imageWidth = 1200;
        const imageHeight = options.height || 675;
        const sidebarWidth = 240; // Ancho donde empieza el área de texto

        // Lógica para elegir una plantilla al azar
        const templates = ['template1.png', 'template2.png'];
        const chosenTemplate = templates[Math.floor(Math.random() * templates.length)];
        const templatePath = path.join(__dirname, '..', 'templates', chosenTemplate);

        const eventDate = new Date(event.date);
        const dateOptions = { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Madrid' };
        const dateText = eventDate.toLocaleDateString('es-ES', dateOptions);
        const cityText = event.city ? event.city.toUpperCase() : '';

        const textAreaXCenter = 720; // Centro del área de texto
        const yCenter = imageHeight / 2;
        const dateY = yCenter - 7; // Ajustado para centrar dinámicamente
        const cityY = yCenter + 53; // Ajustado para centrar dinámicamente

                const fontPath = path.join(__dirname, '..', 'templates', 'Cinzel-Bold.ttf');
        const fontBase64 = fs.readFileSync(fontPath, 'base64');

        const svgContent = `
        <svg width="${imageWidth}" height="${imageHeight}">
            <style>
                @font-face {
                    font-family: 'Cinzel-Bold';
                    src: url(data:font/truetype;charset=utf-8;base64,${fontBase64});
                }
                .date { fill: #FFFFFF; font-size: 55px; font-family: 'Cinzel-Bold', sans-serif; font-weight: bold; }
                .city { fill: #FFFFFF; font-size: 36px; font-family: 'Cinzel-Bold', sans-serif; font-weight: bold; }
            </style>
            <text x="${textAreaXCenter}" y="${dateY}" text-anchor="middle" class="date">${dateText}</text>
            <text x="${textAreaXCenter}" y="${cityY}" text-anchor="middle" class="city">${cityText}</text>
        </svg>
        `;

        const svgBuffer = Buffer.from(svgContent);
        const outputPath = path.join(__dirname, '..', `generated_images`, `post-image-${Date.now()}.png`);

        // Asegurarse de que el directorio de salida exista
        const outputDir = path.dirname(outputPath);
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }

        await sharp(templatePath)
            .resize(imageWidth, imageHeight)
            .flatten({ background: '#121212' })
            .composite([{
                input: svgBuffer,
                top: 0,
                left: 0,
            }])
            .toFile(outputPath);

        console.log(`   ✅ Imagen para el post creada en: ${outputPath}`);
        return outputPath;

    } catch (error) {
        console.error("   ❌ Error al crear la imagen del post:", error);
        throw error;
    }
}

// Exportamos únicamente la función que nos interesa
module.exports = { createPostImage };
