import sharp from '../node_modules/sharp/lib/index.js';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const src = path.join(root, 'materiais', 'Logo_So_Seade_altaresol.png');

async function makeIcon(size, outFile) {
  const padding = Math.round(size * 0.15);
  const logoSize = size - padding * 2;

  // Redimensiona o logo para caber dentro da área (preserva proporção), saída como PNG buffer
  const logoBuf = await sharp(src)
    .resize(logoSize, logoSize, { fit: 'inside' })
    .png()
    .toBuffer();

  // Obtém dimensões reais após resize
  const meta = await sharp(logoBuf).metadata();
  const w = meta.width;
  const h = meta.height;

  await sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: { r: 11, g: 34, b: 49, alpha: 1 }, // #0b2231
    },
  })
    .composite([{
      input: logoBuf,
      left: Math.round((size - w) / 2),
      top: Math.round((size - h) / 2),
    }])
    .png()
    .toFile(outFile);

  console.log(`✓ ${path.basename(outFile)} (${size}x${size})`);
}

await makeIcon(192, path.join(root, 'public', 'icon-192x192.png'));
await makeIcon(512, path.join(root, 'public', 'icon-512x512.png'));

// Apple touch icon (180x180)
const logoBuf180 = await sharp(src)
  .resize(150, 150, { fit: 'inside' })
  .png()
  .toBuffer();
const meta180 = await sharp(logoBuf180).metadata();
await sharp({
  create: { width: 180, height: 180, channels: 4, background: { r: 11, g: 34, b: 49, alpha: 1 } },
})
  .composite([{
    input: logoBuf180,
    left: Math.round((180 - meta180.width) / 2),
    top: Math.round((180 - meta180.height) / 2),
  }])
  .png()
  .toFile(path.join(root, 'public', 'apple-touch-icon.png'));
console.log('✓ apple-touch-icon.png (180x180)');
