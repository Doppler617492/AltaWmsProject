const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const svgPath = path.join(__dirname, 'frontend-pwa/public/logo-mark.svg');
const publicDir = path.join(__dirname, 'frontend-pwa/public');

async function generateIcons() {
  try {
    const svgBuffer = fs.readFileSync(svgPath);
    
    // 192x192 with dark background
    await sharp(svgBuffer, { density: 192 })
      .resize(192, 192, { fit: 'contain', background: { r: 5, g: 7, b: 13, alpha: 1 } })
      .png()
      .toFile(path.join(publicDir, 'icon-192x192.png'));
    console.log('✓ Created icon-192x192.png');
    
    // 512x512 with dark background
    await sharp(svgBuffer, { density: 512 })
      .resize(512, 512, { fit: 'contain', background: { r: 5, g: 7, b: 13, alpha: 1 } })
      .png()
      .toFile(path.join(publicDir, 'icon-512x512.png'));
    console.log('✓ Created icon-512x512.png');
    
    // 192x192 maskable (transparent for adaptive icons)
    const img192 = await sharp(svgBuffer, { density: 192 })
      .resize(120, 120, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .extend({ top: 36, bottom: 36, left: 36, right: 36, background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toFile(path.join(publicDir, 'icon-192x192-maskable.png'));
    console.log('✓ Created icon-192x192-maskable.png');
    
    // 512x512 maskable (transparent for adaptive icons)
    const img512 = await sharp(svgBuffer, { density: 512 })
      .resize(320, 320, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .extend({ top: 96, bottom: 96, left: 96, right: 96, background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toFile(path.join(publicDir, 'icon-512x512-maskable.png'));
    console.log('✓ Created icon-512x512-maskable.png');
    
    console.log('\n✅ All PWA icons updated with Alta WMS logo!');
  } catch (error) {
    console.error('Error generating icons:', error);
    process.exit(1);
  }
}

generateIcons();
