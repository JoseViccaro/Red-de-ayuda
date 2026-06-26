const fs = require('fs');
const path = require('path');

const iconsDir = path.join(__dirname, '..', 'public', 'icons');

// Crear la carpeta de iconos si no existe
if (!fs.existsSync(iconsDir)){
    fs.mkdirSync(iconsDir, { recursive: true });
}

// Representación en Base64 de un PNG minimalista de color azul de 1x1 px
// Esto evita depender de librerías nativas de canvas difíciles de instalar en móviles modestos
const pixelBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkWPjfDwAEfQHzXp5vdwAAAABJRU5ErkJggg==';
const imageBuffer = Buffer.from(pixelBase64, 'base64');

fs.writeFileSync(path.join(iconsDir, 'icon-192.png'), imageBuffer);
fs.writeFileSync(path.join(iconsDir, 'icon-512.png'), imageBuffer);

console.log('Iconos de la PWA generados con éxito.');
