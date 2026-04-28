import { chromium } from 'playwright';
import sharp from '../node_modules/sharp/lib/index.js';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

const browser = await chromium.launch({
  args: ['--enable-webgl', '--use-gl=angle', '--ignore-gpu-blocklist'],
});
const page = await browser.newPage({ viewport: { width: 600, height: 900 } });

// Abre a landing page no dev server
await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });

// Aguarda a esfera renderizar (WebGL precisa de alguns frames)
await page.waitForTimeout(2500);

// Localiza o canvas da esfera (DitheringShader)
const canvas = page.locator('canvas').first();
await canvas.waitFor({ state: 'visible' });

// Screenshot do canvas como PNG buffer
const rawBuf = await canvas.screenshot({ type: 'png' });

// Garante quadrado recortando o centro
const meta = await sharp(rawBuf).metadata();
const cropSize = Math.min(meta.width, meta.height);
const squareBuf = await sharp(rawBuf)
  .extract({ left: Math.round((meta.width - cropSize) / 2), top: Math.round((meta.height - cropSize) / 2), width: cropSize, height: cropSize })
  .toBuffer();

// Gera ícone com padding para que a esfera não encoste nas bordas (macOS arredonda o container)
// A esfera ocupa ~78% do ícone; o restante é fundo #0b2231
async function saveIcon(sizePx, outFile) {
  const PADDING_RATIO = 0.11; // 11% de cada lado → esfera em 78% do espaço
  const padding = Math.round(sizePx * PADDING_RATIO);
  const innerSize = sizePx - padding * 2;

  const sphereBuf = await sharp(squareBuf)
    .resize(innerSize, innerSize, { fit: 'fill' })
    .png()
    .toBuffer();

  await sharp({
    create: { width: sizePx, height: sizePx, channels: 4, background: { r: 11, g: 34, b: 49, alpha: 1 } },
  })
    .composite([{ input: sphereBuf, left: padding, top: padding }])
    .png()
    .toFile(outFile);
  console.log(`✓ ${path.basename(outFile)} (${sizePx}×${sizePx}, padding ${padding}px)`);
}

await saveIcon(512, path.join(root, 'public', 'icon-512x512.png'));
await saveIcon(192, path.join(root, 'public', 'icon-192x192.png'));
await saveIcon(180, path.join(root, 'public', 'apple-touch-icon.png'));

await browser.close();
console.log('Ícones gerados a partir da esfera renderizada.');
